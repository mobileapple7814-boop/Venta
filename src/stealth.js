/**
 * stealth.js — سپر مخفی‌کاری و ضد بن Vanta Core برای Railway
 *
 * این ماژول چند لایه‌ی دفاعی دارد که هدفشان این است که سرویس از بیرون
 * شبیه یک وب‌اپ معمولی به نظر برسد، نه یک پروکسی؛ و رفتارهای الگومحورِ
 * (signature-based) بن‌شدن دیده نشوند:
 *
 *  1) صفحه‌ی قلابی (decoy): مسیر ‎/‎ و مسیرهای معمولی یک صفحه‌ی عمومی
 *     بی‌خطر نشان می‌دهند. پنل واقعی روی یک مسیر مخفی است (‎ADMIN_PATH‎)
 *     که خودت انتخاب می‌کنی.
 *  2) مسدودسازی اسکنرها/بات‌ها بر اساس User-Agent (curl/wget/obot/...).
 *  3) محدودیت نرخ درخواست به ازای IP (پنجره‌ی لغزان) — بدون آن، یک
 *     اسکن ساده می‌تواند الگوی «ترافیک غیرعادی» بسازد.
 *  4) قفل تلاش ورود: بعد از N تلاش ناموفق، آن IP برای مدتی از ورود
 *     محروم می‌شود (prefix ban محلی، نه وابسته به Railway).
 *  5) کلید پنیک (PANIC_KEY): با بازکردن یک URL مخفی از هر جای دنیا،
 *     همه‌ی سرویس فوراً به حالت «سرد» می‌رود (همه‌ی رله‌ها قطع و ورود
 *     قفل می‌شود) — برای وقتی که خبری از بن قریب‌الوقوع داری.
 *  6) سقف ترافیک کل (TRAFFIC_CEILING_GB): از مصرف بیش از حد (که مهم‌ترین
 *     علت بن حساب Railway است) جلوگیری می‌کند؛ با رسیدن به سقف، رله‌ها
 *     بسته می‌شوند و پنل زنده می‌ماند.
 *  7) ماسک IP در لاگ‌ها: دو رقم آخر IPv4 ستاره می‌شود تا در صورت درز
 *     لاگ، حریم خصوصی کاربران لو نرود.
 *  8) هدرهای X-Robots-Tag و نوار متا: از ایندکس‌شدن توسط موتورهای
 *     جستجو جلوگیری می‌کند.
 *  9) صفحات خطای عمومی (404/405) که عمداً شبیه یک سایت استاتیک‌اند.
 *
 * همه‌ی تنظیمات از متغیرهای محیطی خوانده می‌شوند و از پنل هم قابل
 * تغییرند (در store با کلیدهای ‎sec:*‎ ذخیره می‌شوند و بر متغیر محیطی
 * اولویت دارند).
 */

const DAY_MS = 86_400_000;

// ── پیکربندی ──────────────────────────────────────────────────────────

export function defaultShieldConfig() {
  return {
    admin_path: process.env.ADMIN_PATH || "vanta-admin",
    panic_key: process.env.PANIC_KEY || "",
    login_max_attempts: 5, // تلاش ناموفق تا قفل
    login_lock_minutes: 15, // مدت قفل ورود
    rate_limit_per_minute: 60, // سقف درخواست/دقیقه برای هر IP (مسیرهای ادمین)
    rate_limit_ws_per_minute: 40, // سقف هندشیک/دقیقه برای هر IP
    traffic_ceiling_gb: parseFloat(process.env.TRAFFIC_CEILING_GB || "0") || 0, // 0 = بی‌سقف
    log_ip_mask: true,
    strict_mode: process.env.SHIELD_STRICT !== "off", // فیلتر UA فعال باشد؟
  };
}

// تنظیمات در حافظه (با cache کوتاه از Redis تازه می‌شود)
let _shield = { cfg: defaultShieldConfig(), ts: 0 };
const SHIELD_CACHE_MS = 5000;

export async function getShield(store) {
  if (Date.now() - _shield.ts < SHIELD_CACHE_MS) return _shield.cfg;
  try {
    const raw = await store.getSetting("sec:shield");
    if (raw) {
      const parsed = JSON.parse(raw);
      _shield = { cfg: { ...defaultShieldConfig(), ...parsed }, ts: Date.now() };
    } else {
      _shield = { cfg: defaultShieldConfig(), ts: Date.now() };
    }
  } catch {
    _shield = { cfg: defaultShieldConfig(), ts: Date.now() };
  }
  return _shield.cfg;
}

export async function saveShield(store, patch) {
  const cfg = { ...(await getShield(store)), ...(patch || {}) };
  // مقادیر عددی را نرمال کن
  cfg.login_max_attempts = Math.max(1, parseInt(cfg.login_max_attempts, 10) || 5);
  cfg.login_lock_minutes = Math.max(1, parseInt(cfg.login_lock_minutes, 10) || 15);
  cfg.rate_limit_per_minute = Math.max(5, parseInt(cfg.rate_limit_per_minute, 10) || 60);
  cfg.rate_limit_ws_per_minute = Math.max(5, parseInt(cfg.rate_limit_ws_per_minute, 10) || 40);
  cfg.traffic_ceiling_gb = Math.max(0, parseFloat(cfg.traffic_ceiling_gb) || 0);
  cfg.log_ip_mask = !!cfg.log_ip_mask;
  cfg.strict_mode = !!cfg.strict_mode;
  cfg.admin_path = String(cfg.admin_path || "vanta-admin").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64) || "vanta-admin";
  await store.setSetting("sec:shield", JSON.stringify(cfg));
  _shield = { cfg, ts: Date.now() };
  return cfg;
}

export function invalidateShieldCache() {
  _shield.ts = 0;
}

// ── ماسک IP ────────────────────────────────────────────────────────────

export function maskIp(ip) {
  const s = String(ip || "");
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(s)) {
    const parts = s.split(".");
    return `${parts[0]}.${parts[1]}.${parts[2]}.x`;
  }
  return s;
}

// ── فیلتر User-Agent (اسکنرهای خودکار) ─────────────────────────────────

const SCANNER_UA_RE = /(curl|wget|python-requests|libwww|httpclient|go-http|okhttp|java\/|scrapy|bot|crawler|spider|slurp|bingpreview|facebookexternalhit|node-fetch|axios\/|python-urllib|go-resty)/i;

export function looksLikeScanner(ua) {
  return SCANNER_UA_RE.test(String(ua || ""));
}

// ── محدودیت نرخ (پنجره‌ی لغزان در حافظه؛ بین دیپلوی‌ها کافی است چون ──)
// ── مهاجم معمولاً به یک نمونه‌ی واحد وصل می‌شود                     ───

const rateBuckets = new Map(); // key -> number[] (timestamps)

export function rateLimit(key, limitPerMinute) {
  const now = Date.now();
  let arr = rateBuckets.get(key);
  if (!arr) {
    arr = [];
    rateBuckets.set(key, arr);
  }
  // پاک‌سازی دوره‌ای برای جلوگیری از نشت حافظه
  if (rateBuckets.size > 5000) {
    for (const [k, v] of rateBuckets) {
      if (!v.length || now - v[v.length - 1] > 120_000) rateBuckets.delete(k);
    }
  }
  while (arr.length && now - arr[0] >= 60_000) arr.shift();
  if (arr.length >= limitPerMinute) {
    return { allowed: false, retryAfterSec: Math.ceil((60_000 - (now - arr[0])) / 1000) };
  }
  arr.push(now);
  return { allowed: true };
}

// ── قفل تلاش ورود (مبتنی بر Redis تا بین ری‌استارت‌ها هم بماند) ────────

export async function registerFailedLogin(store, ip) {
  try {
    const key = `sec:fail:${ip}`;
    const n = await store.r.incr(key);
    if (n === 1) await store.r.expire(key, 3600);
    return n;
  } catch {
    return 0;
  }
}

export async function clearFailedLogins(store, ip) {
  try {
    await store.r.del(`sec:fail:${ip}`);
  } catch {
    /* ignore */
  }
}

export async function isLoginLocked(store, ip, maxAttempts) {
  try {
    const n = parseInt((await store.r.get(`sec:fail:${ip}`)) || "0", 10);
    return n >= maxAttempts;
  } catch {
    return false;
  }
}

// ── کلید پنیک (حالت سرد) ───────────────────────────────────────────────

let _panicUntil = 0;
let _panicUntilLoaded = 0;

export async function getPanicMode(store) {
  if (Date.now() - _panicUntilLoaded < 5000) return _panicUntil > Date.now();
  try {
    const until = parseFloat((await store.getSetting("sec:panic_until")) || "0");
    _panicUntil = until;
    _panicUntilLoaded = Date.now();
  } catch {
    _panicUntilLoaded = Date.now();
  }
  return _panicUntil > Date.now();
}

/** حالت پنیک را برای مدت مشخص روشن می‌کند. minutes=0 خاموش می‌کند. */
export async function setPanicMode(store, minutes) {
  const until = minutes > 0 ? Date.now() + minutes * 60_000 : 0;
  await store.setSetting("sec:panic_until", String(until));
  _panicUntil = until;
  _panicUntilLoaded = Date.now();
  return until > Date.now();
}

// ── سقف ترافیک کل ──────────────────────────────────────────────────────

export async function isTrafficCeilingExceeded(store, shield) {
  const ceilingGb = shield.traffic_ceiling_gb || 0;
  if (!ceilingGb) return { exceeded: false, usedBytes: 0, ceilingBytes: 0 };
  const used = await store.getTotalUsedBytes();
  const ceilingBytes = Math.floor(ceilingGb * 1024 * 1024 * 1024);
  return { exceeded: used >= ceilingBytes, usedBytes: used, ceilingBytes };
}

// ── توقف خودکار هشدار (آمار روزانه برای تب امنیت) ──────────────────────

export async function securitySnapshot(store, shield) {
  const [panic, traffic] = await Promise.all([getPanicMode(store), isTrafficCeilingExceeded(store, shield)]);
  return {
    panic_active: panic,
    traffic: {
      ceiling_gb: shield.traffic_ceiling_gb,
      used_bytes: traffic.usedBytes,
      ceiling_bytes: traffic.ceilingBytes,
      exceeded: traffic.exceeded,
    },
    admin_path: shield.admin_path,
    strict_mode: shield.strict_mode,
    log_ip_mask: shield.log_ip_mask,
    rate_limit_per_minute: shield.rate_limit_per_minute,
    rate_limit_ws_per_minute: shield.rate_limit_ws_per_minute,
    login_max_attempts: shield.login_max_attempts,
    login_lock_minutes: shield.login_lock_minutes,
  };
}

/** رویداد امنیتی را ثبت می‌کند؛ ip مطابق تنظیم ماسک می‌شود. */
export async function reportSecurityEvent(store, kind, ip, detail, mask = true) {
  try {
    await store.logSecurityEvent(kind, mask ? maskIp(ip) : ip, detail);
  } catch {
    /* ثبت رویداد نباید مسیر اصلی را بشکند */
  }
}
