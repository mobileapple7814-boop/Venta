/**
 * app.js — روتر اصلی Vanta Core
 *
 * ساختار مسیرها:
 *   /                      → صفحه‌ی قلابی (decoy) — دنیای بیرون این را می‌بیند
 *   /core                  → مسیر WebSocket رله‌ی VLESS (بدون هدر Upgrade → 404 قلابی)
 *   /api/health            → {"ok":true} ساده (برای مانیتورینگ Railway)
 *   /sub/<uuid>            → سابسکریپشن (عمومی؛ کلاینت‌ها صدا می‌زنند)
 *   /bot/webhook/<secret>  → وب‌هوک تلگرام
 *   /<ADMIN_PATH>/         → صفحه‌ی ورود پنل (مخفی)
 *   /<ADMIN_PATH>/dashboard→ داشبورد (نیازمند سشن)
 *   /<ADMIN_PATH>/api/*    → API ادمین (نیازمند سشن + rate limit)
 *
 * سپر (stealth) روی همه‌ی مسیرها فعال است: فیلتر اسکنر، محدودیت نرخ،
 * قفل تلاش ورود، حالت پنیک و سقف ترافیک.
 */
import { createSessionCookie, verifySessionCookie, parseCookies } from "./session.js";
import { getStore } from "./store.js";
import { buildLinks, subscriptionUrl, DEFAULT_CLEAN_IPS } from "./linkforge.js";
import * as bot from "./bot.js";
import * as ui from "./ui-dash.js";
import { loginPage } from "./ui-login.js";
import { decoyPage, notFoundPage } from "./decoy.js";
import {
  getShield,
  saveShield,
  looksLikeScanner,
  rateLimit,
  registerFailedLogin,
  clearFailedLogins,
  isLoginLocked,
  getPanicMode,
  setPanicMode,
  isTrafficCeilingExceeded,
  securitySnapshot,
  reportSecurityEvent,
} from "./stealth.js";
import https from "node:https";
import fs from "node:fs";

const WS_PATH = "/core";
const DEFAULT_CLEAN_IP_LIST_URL = "https://hoplimit.shop/ips.txt";
const DEFAULT_PROXY_LIST_URL = "https://hoplimit.shop/proxy_vip/{country}.txt";
const DEFAULT_DAILY_REQUEST_LIMIT = 100000;
const SESSION_COOKIE = "vanta_session";

// رنج‌های رسمی IPv4 کلادفلر — از https://www.cloudflare.com/ips-v4/
// اسکنر «آی‌پی تمیز» با نمونه‌گیری تصادفی از همین رنج‌ها کار می‌کند.
const CF_IPV4_RANGES = [
  "173.245.48.0/20", "103.21.244.0/22", "103.22.200.0/22", "103.31.4.0/22",
  "141.101.64.0/18", "108.162.192.0/18", "190.93.240.0/20", "188.114.96.0/20",
  "197.234.240.0/22", "198.41.128.0/17", "162.158.0.0/15", "104.16.0.0/13",
  "104.24.0.0/14", "172.64.0.0/13", "131.0.72.0/22",
];

function ipToInt(ip) {
  const parts = ip.split(".").map(Number);
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}
function intToIp(n) {
  return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join(".");
}
function randomIpFromCidr(cidr) {
  const [base, prefixStr] = cidr.split("/");
  const prefix = parseInt(prefixStr, 10);
  const hostBits = 32 - prefix;
  const baseInt = ipToInt(base);
  const maxHostVal = hostBits >= 31 ? 0 : (2 ** hostBits) >>> 0;
  // آدرس شبکه (.0) و براد‌کست انتخاب نمی‌شوند
  const hostVal = hostBits <= 1 ? 0 : 1 + Math.floor(Math.random() * (maxHostVal - 2));
  return intToIp((baseInt + hostVal) >>> 0);
}
function randomCleanIpCandidates(n, ranges) {
  const out = new Set();
  let guard = 0;
  while (out.size < n && guard < n * 20) {
    guard++;
    const cidr = ranges[Math.floor(Math.random() * ranges.length)];
    out.add(randomIpFromCidr(cidr));
  }
  return [...out];
}

async function testOneIp(host, ip, timeoutMs) {
  // اتصال TCP مستقیم به همان IP، ولی هدر Host و SNI روی دامنه‌ی خود سرویس.
  const started = Date.now();
  return new Promise((resolve) => {
    const req = https.request(
      {
        host,
        servername: host,
        path: "/api/health",
        method: "GET",
        timeout: timeoutMs,
        lookup: (_hostname, _opts, cb) => cb(null, ip, 4),
      },
      (res) => {
        res.resume();
        resolve({ ip, ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode, ms: Date.now() - started });
      }
    );
    req.on("timeout", () => {
      req.destroy();
      resolve({ ip, ok: false, error: "timeout", ms: Date.now() - started });
    });
    req.on("error", (e) => {
      resolve({ ip, ok: false, error: e && e.message ? e.message : "خطا در اتصال", ms: Date.now() - started });
    });
    req.end();
  });
}

async function scanCleanIps({ host, want = 10, candidates = 60, concurrency = 10, timeoutMs = 4000, deadlineMs = 25000 }) {
  const pool = randomCleanIpCandidates(candidates, CF_IPV4_RANGES);
  const found = [];
  const failReasons = {};
  const start = Date.now();
  let idx = 0;
  async function worker() {
    while (idx < pool.length) {
      if (Date.now() - start > deadlineMs) return;
      if (found.length >= want) return;
      const ip = pool[idx++];
      const result = await testOneIp(host, ip, timeoutMs);
      if (result.ok) {
        found.push(result);
      } else {
        const key = result.error || `status ${result.status}`;
        failReasons[key] = (failReasons[key] || 0) + 1;
      }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
  found.sort((a, b) => a.ms - b.ms);
  return { found, tested: idx, candidates: pool.length, failReasons };
}

function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { "Content-Type": "application/json; charset=utf-8", ...(init.headers || {}) },
  });
}

function html(str, init = {}) {
  return new Response(str, {
    ...init,
    headers: { "Content-Type": "text/html; charset=utf-8", "X-Robots-Tag": "noindex, nofollow", ...(init.headers || {}) },
  });
}

function errorJson(status, detail, extra = {}) {
  return json({ detail, ...extra }, { status });
}

function hostOf(request, env) {
  // PUBLIC_HOST ممکن است اشتباهاً با https:// یا / انتهایی وارد شده باشد.
  const pub = String(env.PUBLIC_HOST || "")
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/+$/, "");
  return pub || new URL(request.url).host;
}

function clientIpOf(request) {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  const xri = request.headers.get("x-real-ip");
  if (xri) return xri.trim();
  return "unknown";
}

// ── config helpers ─────────────────────────────────────────────────────
function parseList(raw) {
  return String(raw || "")
    // علاوه بر newline واقعی، «\n» literal هم جداکننده حساب می‌شود.
    .split(/\\n|[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}
const parseCleanIps = parseList;

function publicConfig(config, host) {
  const links = buildLinks(config, host);
  return {
    id: config.id,
    name: config.name,
    uuid: config.uuid,
    enabled: config.enabled !== false,
    created_at: config.created_at,
    expires_at: config.expires_at,
    traffic_limit_bytes: config.traffic_limit_bytes || 0,
    used_bytes: config.used_bytes || 0,
    ip_limit: config.ip_limit || 0,
    fingerprint: config.fingerprint || "chrome",
    alpn: config.alpn || "http/1.1",
    port: config.port || 443,
    transport: config.transport || "ws",
    proxy: (config.proxies && config.proxies[0]) || config.proxy || "",
    proxies: config.proxies || (config.proxy ? [config.proxy] : []),
    clean_ips: config.clean_ips || [],
    location: config.location || "",
    ip_operator: config.ip_operator || "all",
    ip_count: config.ip_count || 20,
    auto_rotate_ip: !!config.auto_rotate_ip,
    rotate_minutes: config.rotate_minutes || 0,
    last_rotate_time: config.last_rotate_time || 0,
    blocklist: config.blocklist || [],
    link: links[0],
    links,
    sub_url: subscriptionUrl(config, host),
  };
}

// محتوای سابسکریپشن: یک لینک vless به ازای هر آی‌پی تمیز، Base64 شده.
function buildSubscriptionResponse(config, host) {
  const links = buildLinks(config, host);
  const content = links.join("\n");
  const b64 = btoa(unescape(encodeURIComponent(content)));

  const usedBytes = Math.floor(config.used_bytes || 0);
  const totalBytes = config.traffic_limit_bytes || 0;
  const expire = config.expires_at ? Math.floor(config.expires_at) : 0;
  const userInfo = `upload=0; download=${usedBytes}; total=${totalBytes}; expire=${expire}`;

  return new Response(b64, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*",
      "Subscription-Userinfo": userInfo,
      "Profile-Title": `base64:${btoa(unescape(encodeURIComponent(config.name)))}`,
      "Profile-Update-Interval": "6",
    },
  });
}

function botWebhookUrl(host, secret) {
  return `https://${host}/bot/webhook/${secret}`;
}

// ── چرخش خودکار آی‌پی تمیز ────────────────────────────────────────────
// فرمت لیست: بلوک‌های جداشده با «----------»، هر بلوک یک خط «# نام‌گروه»
// و چند خط IP.
function parseIpBlocks(text) {
  const blocks = text.split("----------");
  const out = {};
  for (const block of blocks) {
    const lines = block
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (!lines.length) continue;
    let opName = "Unknown";
    const ips = [];
    for (const line of lines) {
      if (line.includes("#")) opName = line.split("#")[1].trim();
      else if (!line.startsWith("[source")) ips.push(line);
    }
    if (ips.length) out[opName] = ips;
  }
  return out;
}

function pickRandomN(arr, n) {
  const uniq = [...new Set(arr)];
  if (n >= uniq.length) return uniq;
  const shuffled = uniq.slice();
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, n);
}

let _lastRotateCheck = 0;
async function maybeRotateCleanIps() {
  try {
    const now = Date.now();
    if (now - _lastRotateCheck < 60000) return;
    _lastRotateCheck = now;

    const store = getStore();
    const configs = await store.listConfigs();
    const due = configs.filter(
      (c) => c.auto_rotate_ip && c.rotate_minutes > 0 && now >= (c.last_rotate_time || 0) + c.rotate_minutes * 60000
    );
    if (!due.length) return;

    const listUrl = (await store.getSetting("clean_ip_list_url")) || DEFAULT_CLEAN_IP_LIST_URL;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    let text;
    try {
      const resp = await fetch(listUrl, { signal: controller.signal });
      if (!resp.ok) return;
      text = await resp.text();
    } finally {
      clearTimeout(timer);
    }
    const grouped = parseIpBlocks(text);

    for (const c of due) {
      let pool = [];
      if (c.ip_operator === "all" || !c.ip_operator) {
        for (const ips of Object.values(grouped)) pool = pool.concat(ips);
      } else {
        pool = grouped[c.ip_operator] || [];
      }
      const picked = pickRandomN(pool, c.ip_count || 20);
      if (!picked.length) continue;
      c.clean_ips = picked;
      c.last_rotate_time = now;
      delete c.used_bytes; // فیلد مشتق‌شده؛ جدا زیر vuse ذخیره می‌شود
      await store.saveConfig(c);
    }
  } catch {
    /* چرخش خودکار نباید مسیر اصلی را خراب کند */
  }
}

let _rotateTimerStarted = false;
function startRotateTimer() {
  if (_rotateTimerStarted) return;
  _rotateTimerStarted = true;
  setInterval(() => maybeRotateCleanIps().catch(() => {}), 60_000).unref();
}
startRotateTimer();

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;
    const store0 = getStore();
    const clientIp = clientIpOf(request);
    const shield = await getShield(store0);

    // شمارش تقریبی درخواست‌ها + چرخش خودکار در پس‌زمینه
    ctx.waitUntil(store0.bumpRequestCounter().catch(() => {}));
    ctx.waitUntil(maybeRotateCleanIps());

    try {
      // ── WebSocket رله‌ی VLESS ────────────────────────────────────
      // خودِ اتصال WS هرگز به این تابع نمی‌رسد (سرور upgrade را می‌گیرد)؛
      // رسیدن به این یعنی درخواست بدون Upgrade — مثل یک اسکنر.
      if (path === WS_PATH) {
        if (request.headers.get("upgrade")) {
          return new Response("upgrading", { status: 400 });
        }
        return html(notFoundPage(), { status: 404 });
      }

      // ── health (برای مانیتورینگ Railway) ─────────────────────────
      if (path === "/api/health" && method === "GET") {
        return json({ ok: true, service: "app" });
      }

      // ── کتابخانه‌ی QR (لوکال — بدون CDN) ────────────────────────
      // روی هر مسیری سرو می‌شود تا داشبورد (که مسیرش مخفی است) بتواند
      // ../qrcode.min.js را لود کند.
      if (path === "/qrcode.min.js" && method === "GET") {
        const data = await fs.promises.readFile(new URL("../public/qrcode.min.js", import.meta.url));
        return new Response(data, {
          headers: { "Content-Type": "application/javascript; charset=utf-8", "Cache-Control": "public, max-age=86400" },
        });
      }

      // ── وب‌هوک تلگرام (تلگرام صدا می‌زند) ────────────────────────
      // باید قبل از فیلتر اسکنر باشد: User-Agent تلگرام ("TelegramBot ...")
      // شامل «bot» است و فیلتر UA آن را 404 می‌کرد → ربات هرگز جواب نمی‌داد.
      if (path.startsWith("/bot/webhook/") && method === "POST") {
        const secretFromPath = path.slice("/bot/webhook/".length);
        const settings = await store0.getBotSettings();
        if (!settings.enabled || !settings.token || secretFromPath !== settings.secret) {
          return json({ ok: true });
        }
        const update = await request.json().catch(() => ({}));
        try {
          await bot.handleUpdate(store0, settings.token, update, hostOf(request, env));
        } catch (e) {
          // خطای پردازش نباید 500 بدهد؛ وگرنه تلگرام همان آپدیت را مدام دوباره می‌فرستد.
          console.error("bot update error:", e && e.message ? e.message : e);
        }
        return json({ ok: true });
      }

      // ── سپر: مسدودسازی اسکنرها ──────────────────────────────────
      // /sub/ مستثناست: کلاینت‌های VPN (okhttp، Go-http-client، java و…)
      // با همین UAها ساب را می‌گیرند و نباید 404 بخورند.
      if (!path.startsWith("/sub/") && shield.strict_mode && looksLikeScanner(request.headers.get("user-agent"))) {
        ctx.waitUntil(reportSecurityEvent(store0, "scanner_blocked", clientIp, `UA: ${String(request.headers.get("user-agent") || "").slice(0, 80)}`, shield.log_ip_mask));
        return html(notFoundPage(), { status: 404 });
      }

      // ── سابسکریپشن (عمومی؛ کلاینت‌های vless صدا می‌زنند) ──────────
      if (path.startsWith("/sub/") && method === "GET") {
        // در حالت پنیک، ساب هم سرد می‌شود (404 بی‌صدا).
        if (await getPanicMode(store0)) return new Response("not found", { status: 404 });
        const uuid = path.slice("/sub/".length);
        const cfg = await store0.getConfigByUuid(uuid);
        if (!cfg || cfg.enabled === false) {
          return new Response("not found", { status: 404 });
        }
        return buildSubscriptionResponse(cfg, hostOf(request, env));
      }

      // ── مسیر مخفی پنل ────────────────────────────────────────────
      const adminBase = "/" + (shield.admin_path || "vanta-admin");
      if (path === adminBase && method === "GET") {
        // بدون «/» انتهایی، آدرس‌های نسبی صفحه‌ی ورود (api/login و ./dashboard) خراب می‌شوند.
        return Response.redirect(new URL(adminBase + "/", url).toString(), 302);
      }
      if (path === adminBase || path === adminBase + "/" || path === adminBase + "/dashboard" || path.startsWith(adminBase + "/api/")) {
        return handleAdmin(request, env, ctx, store0, shield, url, path, method, adminBase, clientIp);
      }

      // ── هر چیز دیگر: صفحه‌ی قلابی (یا 404 قلابی) ─────────────────
      if (path === "/" && method === "GET") {
        return html(decoyPage());
      }
      if (path === "/favicon.ico" && method === "GET") {
        return new Response("", { status: 204 });
      }
      return html(notFoundPage(), { status: 404 });
    } catch (err) {
      return errorJson(500, err && err.message ? err.message : "internal error");
    }
  },
};

// ── منطق مسیرهای ادمین (پشت مسیر مخفی + سپر) ─────────────────────────
async function handleAdmin(request, env, ctx, store, shield, url, path, method, adminBase, clientIp) {
  // محدودیت نرخ روی همه‌ی مسیرهای ادمین
  const rl = rateLimit(`admin:${clientIp}`, shield.rate_limit_per_minute);
  if (!rl.allowed) {
    ctx.waitUntil(reportSecurityEvent(store, "rate_limited", clientIp, `retry ${rl.retryAfterSec}s`, shield.log_ip_mask));
    return new Response("Too Many Requests", {
      status: 429,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Retry-After": String(rl.retryAfterSec || 30) },
    });
  }

  const requireAdmin = async () => {
    const cookies = parseCookies(request.headers.get("Cookie") || "");
    const secret = env.SESSION_SECRET || "vanta-dev-secret-change-me";
    return verifySessionCookie(cookies[SESSION_COOKIE] || "", secret);
  };

  // ── ورود ──────────────────────────────────────────────────────────
  if (path === adminBase + "/api/login" && method === "POST") {
    // در حالت پنیک، ورود هم قفل است (سرویس باید کاملاً سرد باشد،
    // به‌جز پنل امنیت که خودش سشن می‌خواهد — پس ورود جدید نمی‌پذیریم).
    if (await getPanicMode(store)) {
      return errorJson(423, "حالت پنیک فعال است — ورود موقتاً بسته است");
    }
    if (await isLoginLocked(store, clientIp, shield.login_max_attempts)) {
      ctx.waitUntil(reportSecurityEvent(store, "login_locked", clientIp, "قفل فعال", shield.log_ip_mask));
      return errorJson(429, "تلاش‌های ناموفق زیاد بوده — بعداً دوباره امتحان کن", { retry_after_minutes: shield.login_lock_minutes });
    }
    const body = await request.json().catch(() => ({}));
    const username = body.username || "";
    const password = body.password || "";
    const adminUser = env.ADMIN_USER || "admin";
    const adminPass = env.ADMIN_PASS || "";

    if (!adminPass) {
      return errorJson(500, "ADMIN_PASS تنظیم نشده — آن را در Environment Variables ست کنید");
    }
    if (username !== adminUser || password !== adminPass) {
      const fails = await registerFailedLogin(store, clientIp);
      ctx.waitUntil(reportSecurityEvent(store, "login_failed", clientIp, `تلاش ${fails}`, shield.log_ip_mask));
      const attemptsLeft = Math.max(0, shield.login_max_attempts - fails);
      return errorJson(401, "نام کاربری یا رمز عبور اشتباه است", { attempts_left: attemptsLeft });
    }
    await clearFailedLogins(store, clientIp);
    ctx.waitUntil(reportSecurityEvent(store, "login_ok", clientIp, username, shield.log_ip_mask));
    const secret = env.SESSION_SECRET || "vanta-dev-secret-change-me";
    const token = await createSessionCookie(username, secret);
    const resp = json({ ok: true });
    resp.headers.append("Set-Cookie", `${SESSION_COOKIE}=${token}; HttpOnly; Secure; SameSite=Lax; Max-Age=${60 * 60 * 12}; Path=${adminBase}/`);
    return resp;
  }

  if (path === adminBase + "/api/logout" && method === "POST") {
    const resp = json({ ok: true });
    resp.headers.append("Set-Cookie", `${SESSION_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Max-Age=0; Path=${adminBase}/`);
    return resp;
  }

  // ── صفحات پنل ─────────────────────────────────────────────────────
  if ((path === adminBase || path === adminBase + "/" || path === adminBase + "/dashboard") && method === "GET") {
    const isDash = path === adminBase + "/dashboard";
    if (await requireAdmin()) {
      if (!isDash) return Response.redirect(new URL(adminBase + "/dashboard", url).toString(), 302);
      return html(ui.dashboardPage());
    }
    if (isDash) return Response.redirect(new URL(adminBase + "/", url).toString(), 302);
    return html(loginPage());
  }

  // ── API ادمین (نیازمند سشن) ───────────────────────────────────────
  const apiPath = path.startsWith(adminBase + "/api/") ? path.slice((adminBase + "/api/").length) : null;
  if (apiPath !== null) {
    if (!(await requireAdmin())) {
      ctx.waitUntil(reportSecurityEvent(store, "unauthorized", clientIp, apiPath, shield.log_ip_mask));
      return errorJson(401, "unauthorized");
    }
    const host = hostOf(request, env);
    return handleAdminApi(request, env, ctx, store, shield, url, apiPath, method, host, clientIp, adminBase);
  }

  return html(notFoundPage(), { status: 404 });
}

async function handleAdminApi(request, env, ctx, store, shield, url, apiPath, method, host, clientIp, adminBase) {
  // ── تب امنیت: وضعیت سپر ──────────────────────────────────────────
  if (apiPath === "security/snapshot" && method === "GET") {
    const snap = await securitySnapshot(store, shield);
    snap.panic_until = parseFloat((await store.getSetting("sec:panic_until")) || "0");
    return json(snap);
  }

  if (apiPath === "security/panic" && method === "POST") {
    const body = await request.json().catch(() => ({}));
    const minutes = Math.max(0, parseInt(body.minutes, 10) || 0);
    const active = await setPanicMode(store, minutes);
    await reportSecurityEvent(store, active ? "panic_on" : "panic_off", clientIp, `${minutes} دقیقه`, shield.log_ip_mask);
    return json({ ok: true, panic_active: active, minutes });
  }

  if (apiPath === "security/ceiling" && method === "POST") {
    const body = await request.json().catch(() => ({}));
    const gb = Math.max(0, parseFloat(body.gb) || 0);
    const cfg = await saveShield(store, { traffic_ceiling_gb: gb });
    await reportSecurityEvent(store, "traffic_ceiling", clientIp, `سقف ${gb} GB ست شد`, shield.log_ip_mask);
    return json({ ok: true, traffic_ceiling_gb: cfg.traffic_ceiling_gb });
  }

  if (apiPath === "security/shield" && method === "POST") {
    const body = await request.json().catch(() => ({}));
    const pathChanged = body.admin_path && body.admin_path !== shield.admin_path;
    const cfg = await saveShield(store, body);
    if (pathChanged) {
      await reportSecurityEvent(store, "admin_path_changed", clientIp, `→ /${cfg.admin_path}`, shield.log_ip_mask);
    }
    return json({
      ok: true,
      admin_path: cfg.admin_path,
      admin_path_changed: !!pathChanged,
      new_login_url: `/${cfg.admin_path}/`,
    });
  }

  if (apiPath === "security/events" && method === "GET") {
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "100", 10), 300);
    return json({ events: await store.getSecurityEvents(limit) });
  }

  // ── تست/اسکن آی‌پی تمیز ──────────────────────────────────────────
  if (apiPath === "test-clean-ip" && method === "POST") {
    const body = await request.json().catch(() => ({}));
    const ip = String(body.ip || "").trim();
    if (!ip) return errorJson(400, "آی‌پی وارد نشده است");
    const result = await testOneIp(host, ip, 6000);
    return json(result);
  }

  if (apiPath === "scan-clean-ips" && method === "POST") {
    const body = await request.json().catch(() => ({}));
    let want = parseInt(body.want, 10);
    if (!Number.isFinite(want) || want < 1) want = 10;
    want = Math.min(want, 50);
    let candidates = parseInt(body.candidates, 10);
    if (!Number.isFinite(candidates) || candidates < want) candidates = Math.max(want * 6, 60);
    candidates = Math.min(candidates, 300);
    const result = await scanCleanIps({ host, want, candidates });
    return json(result);
  }

  // ── لیست پروکسی ──────────────────────────────────────────────────
  if (apiPath === "proxy-list-url" && method === "GET") {
    const listUrl = (await store.getSetting("proxy_list_url")) || DEFAULT_PROXY_LIST_URL;
    return json({ url: listUrl });
  }
  if (apiPath === "proxy-list-url" && method === "POST") {
    const body = await request.json().catch(() => ({}));
    await store.setSetting("proxy_list_url", (body.url || "").trim());
    return json({ ok: true });
  }
  // لیست پروکسی‌ها سمت سرور گرفته می‌شود تا هم CORS مشکل نشود و هم
  // آدرس واقعی سرویس فقط پیش خود سرور بماند. {country} جایگزین می‌شود.
  if (apiPath === "proxy-list" && method === "GET") {
    let listUrl = (await store.getSetting("proxy_list_url")) || DEFAULT_PROXY_LIST_URL;
    if (!listUrl) return errorJson(400, "اول آدرس لیست پروکسی را در همین بخش تنظیم کن");
    const country = (url.searchParams.get("country") || "ALL").trim().toUpperCase();
    listUrl = listUrl.includes("{country}") ? listUrl.replace("{country}", country) : listUrl;
    let text;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      let resp;
      try {
        resp = await fetch(listUrl, { signal: controller.signal });
      } finally {
        clearTimeout(timer);
      }
      if (!resp.ok) return errorJson(400, "دریافت لیست ناموفق بود (کد " + resp.status + ")");
      text = await resp.text();
    } catch (e) {
      return errorJson(400, "خطا در دریافت لیست: " + (e && e.message ? e.message : "نامشخص"));
    }
    const proxies = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("#"))
      .slice(0, 500);
    return json({ proxies, country });
  }

  // ── لیست آی‌پی تمیز ──────────────────────────────────────────────
  if (apiPath === "clean-ip-list-url" && method === "GET") {
    const listUrl = (await store.getSetting("clean_ip_list_url")) || DEFAULT_CLEAN_IP_LIST_URL;
    return json({ url: listUrl });
  }
  if (apiPath === "clean-ip-list-url" && method === "POST") {
    const body = await request.json().catch(() => ({}));
    await store.setSetting("clean_ip_list_url", (body.url || "").trim());
    return json({ ok: true });
  }
  if (apiPath === "clean-ip-list" && method === "GET") {
    const listUrl = (await store.getSetting("clean_ip_list_url")) || DEFAULT_CLEAN_IP_LIST_URL;
    if (!listUrl) return errorJson(400, "اول آدرس لیست آی‌پی تمیز را تنظیم کن");
    let text;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      let resp;
      try {
        resp = await fetch(listUrl, { signal: controller.signal });
      } finally {
        clearTimeout(timer);
      }
      if (!resp.ok) return errorJson(400, "دریافت لیست ناموفق بود (کد " + resp.status + ")");
      text = await resp.text();
    } catch (e) {
      return errorJson(400, "خطا در دریافت لیست: " + (e && e.message ? e.message : "نامشخص"));
    }
    const operators = parseIpBlocks(text);
    return json({ operators });
  }

  // ── کانفیگ‌ها ────────────────────────────────────────────────────
  if (apiPath === "configs" && method === "GET") {
    const configs = await store.listConfigs();
    const onlineCounts = await store.onlineIpCountsForAll();
    const out = configs.map((c) => {
      const item = publicConfig(c, host);
      item.online = onlineCounts[c.id] || 0;
      return item;
    });
    return json({ configs: out });
  }

  if (apiPath === "configs" && method === "POST") {
    const body = await request.json().catch(() => ({}));
    const name = (body.name || "").trim();
    if (!name) return errorJson(400, "نام کانفیگ الزامی است");

    const trafficLimitGb = parseFloat(body.traffic_limit_gb || 0);
    const expiresDays = parseInt(body.expires_days || 0, 10);

    const config = {
      id: await store.newId(),
      name,
      uuid: crypto.randomUUID(),
      enabled: true,
      created_at: Date.now() / 1000,
      expires_at: expiresDays ? Date.now() / 1000 + expiresDays * 86400 : null,
      traffic_limit_bytes: Math.trunc(trafficLimitGb * 1024 * 1024 * 1024),
      ip_limit: parseInt(body.ip_limit || 0, 10),
      fingerprint: body.fingerprint || "chrome",
      alpn: body.alpn || "http/1.1",
      port: parseInt(body.port || 443, 10),
      transport: ["ws", "xhttp"].includes(body.transport) ? body.transport : "ws",
      proxy: "",
      proxies: parseList(body.proxies || body.proxy),
      clean_ips: parseCleanIps(body.clean_ips).length ? parseCleanIps(body.clean_ips) : DEFAULT_CLEAN_IPS,
      location: (body.location || "").trim().toUpperCase(),
      ip_operator: (body.ip_operator || "all").trim() || "all",
      ip_count: parseInt(body.ip_count || 20, 10),
      auto_rotate_ip: !!body.auto_rotate_ip,
      rotate_minutes: parseInt(body.rotate_minutes || 0, 10),
      last_rotate_time: Date.now(),
      blocklist: parseList(body.blocklist),
    };
    await store.saveConfig(config);
    return json(publicConfig(config, host));
  }

  const configIdMatch = apiPath.match(/^configs\/([^/]+)$/);
  if (configIdMatch && method === "PATCH") {
    const configId = configIdMatch[1];
    const config = await store.getConfig(configId);
    if (!config) return errorJson(404, "یافت نشد");

    const body = await request.json().catch(() => ({}));
    if ("enabled" in body) config.enabled = !!body.enabled;
    if ("name" in body && body.name.trim()) config.name = body.name.trim();
    if ("traffic_limit_gb" in body) {
      config.traffic_limit_bytes = Math.trunc(parseFloat(body.traffic_limit_gb) * 1024 * 1024 * 1024);
    }
    if ("expires_days" in body) {
      const expiresDays = parseInt(body.expires_days || 0, 10);
      config.expires_at = expiresDays ? Date.now() / 1000 + expiresDays * 86400 : null;
    }
    if ("ip_limit" in body) config.ip_limit = parseInt(body.ip_limit, 10);
    if ("fingerprint" in body) config.fingerprint = body.fingerprint;
    if ("alpn" in body) config.alpn = body.alpn;
    if ("port" in body) config.port = parseInt(body.port, 10);
    if ("transport" in body && ["ws", "xhttp"].includes(body.transport)) config.transport = body.transport;
    if ("proxies" in body || "proxy" in body) config.proxies = parseList(body.proxies || body.proxy);
    if ("clean_ips" in body) {
      config.clean_ips = parseCleanIps(body.clean_ips);
      config.last_rotate_time = Date.now(); // تازه‌سازی دستی = مبدأ جدید چرخش
    }
    if ("location" in body) config.location = (body.location || "").trim().toUpperCase();
    if ("ip_operator" in body) config.ip_operator = (body.ip_operator || "all").trim() || "all";
    if ("ip_count" in body) config.ip_count = parseInt(body.ip_count || 20, 10);
    if ("auto_rotate_ip" in body) config.auto_rotate_ip = !!body.auto_rotate_ip;
    if ("rotate_minutes" in body) config.rotate_minutes = parseInt(body.rotate_minutes || 0, 10);
    if ("blocklist" in body) config.blocklist = parseList(body.blocklist);
    await store.saveConfig(config);
    if (body.reset_usage) {
      await store.resetUsage(configId);
      config.used_bytes = 0;
    }
    const fresh = await store.getConfig(configId);
    return json(publicConfig(fresh, host));
  }

  if (configIdMatch && method === "DELETE") {
    await store.deleteConfig(configIdMatch[1]);
    return json({ ok: true });
  }

  // ── آمار ─────────────────────────────────────────────────────────
  if (apiPath === "stats" && method === "GET") {
    const configs = await store.listConfigs();
    const onlineCounts = await store.onlineIpCountsForAll();
    const totalOnline = Object.values(onlineCounts).reduce((s, n) => s + n, 0);
    const series = await store.getTrafficSeries(24);
    const totalUsed = await store.getTotalUsedBytes();
    const requestsToday = await store.getRequestCounter();
    const requestsHistory = await store.getRequestCounterHistory(7);
    const requestsLimitSetting = await store.getSetting("daily_request_limit");
    const requestsLimit = requestsLimitSetting ? parseInt(requestsLimitSetting, 10) : DEFAULT_DAILY_REQUEST_LIMIT;
    const nowSec = Date.now() / 1000;
    const activeConfigs = configs.filter((c) => c.enabled !== false && (!c.expires_at || c.expires_at > nowSec));
    const trafficLimitTotal = configs.reduce((s, c) => s + (c.traffic_limit_bytes || 0), 0);
    return json({
      config_count: configs.length,
      active_configs: activeConfigs.length,
      online: totalOnline,
      total_used_bytes: totalUsed,
      total_limit_bytes: trafficLimitTotal,
      traffic_series: series,
      backend: await store.healthBackend(),
      requests_today: requestsToday,
      requests_limit: requestsLimit,
      requests_history: requestsHistory,
      uptime_sec: Math.floor(process.uptime()),
    });
  }

  if (apiPath === "request-limit" && method === "POST") {
    const body = await request.json().catch(() => ({}));
    const limit = parseInt(body.limit, 10);
    if (!Number.isFinite(limit) || limit < 1) return errorJson(400, "مقدار سقف نامعتبر است");
    await store.setSetting("daily_request_limit", String(limit));
    return json({ ok: true });
  }

  if (apiPath === "logs" && method === "GET") {
    const configId = url.searchParams.get("config_id") || null;
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "100", 10), 300);
    const logs = await store.getLogs(configId, limit);
    return json({ logs });
  }

  // ── ربات تلگرام ──────────────────────────────────────────────────
  if (apiPath === "bot/settings" && method === "GET") {
    const settings = await store.getBotSettings();
    const admins = await store.listBotAdmins();
    const members = await store.listBotMembers();
    const token = settings.token;
    const masked = token.length > 10 ? `${token.slice(0, 6)}…${token.slice(-4)}` : token ? "•••" : "";
    return json({
      enabled: settings.enabled,
      token_set: !!token,
      token_masked: masked,
      webhook_url: settings.secret ? botWebhookUrl(host, settings.secret) : null,
      admins,
      member_count: members.length,
    });
  }

  if (apiPath === "bot/settings" && method === "POST") {
    const body = await request.json().catch(() => ({}));
    const current = await store.getBotSettings();
    const token = (body.token || "").trim() || current.token;
    const enabled = "enabled" in body ? !!body.enabled : current.enabled;

    if (!token) return errorJson(400, "توکن ربات را وارد کنید");

    // اول توکن را با getMe بررسی کن تا خطای واضح بدهیم (توکن اشتباه / تلگرام در دسترس نیست)
    if (enabled) {
      const me = await bot.getMe(token);
      if (!me.ok) {
        return errorJson(400, `توکن ربات معتبر نیست یا اتصال به تلگرام برقرار نشد: ${me.description || "نامشخص"}`);
      }
    }

    const secret = await bot.makeSecret(token);
    const webhookUrl = botWebhookUrl(host, secret);
    if (enabled) {
      const result = await bot.setWebhook(token, webhookUrl, secret);
      if (!result.ok) {
        return errorJson(400, `خطا در تنظیم Webhook: ${result.description || "نامشخص"}`);
      }
    } else {
      await bot.deleteWebhook(token);
    }
    // فقط بعد از موفقیت ذخیره می‌شود تا تنظیمات نیمه‌کاره نماند.
    await store.saveBotSettings(token, enabled, secret);
    return json({ ok: true, webhook_url: enabled ? webhookUrl : null });
  }

  if (apiPath === "bot/members" && method === "GET") {
    return json({ members: await store.listBotMembers() });
  }

  if (apiPath === "bot/broadcast" && method === "POST") {
    const settings = await store.getBotSettings();
    if (!settings.token) return errorJson(400, "اول توکن ربات را تنظیم کن");
    const body = await request.json().catch(() => ({}));
    const text = (body.text || "").trim();
    if (!text) return errorJson(400, "متن پیام خالی است");

    let chatIds;
    if (Array.isArray(body.target)) {
      chatIds = body.target.map(String).filter((id) => /^\d+$/.test(id));
    } else if (body.target === "admins") {
      const admins = await store.listBotAdmins();
      chatIds = admins.map((a) => a.id);
    } else {
      const members = await store.listBotMembers();
      chatIds = members.map((m) => m.id);
    }
    if (!chatIds.length) return errorJson(400, "هیچ مخاطبی برای ارسال پیدا نشد");
    if (chatIds.length > 5000) return errorJson(400, "حداکثر ۵۰۰۰ نفر در هر بار (محدودیت زمان اجرا)");

    const result = await bot.sendBroadcast(settings.token, chatIds, text);
    for (const tgId of result.blocked) {
      await store.removeBotMember(tgId).catch(() => {});
    }
    return json({ ok: true, sent: result.sent, failed: result.failed, removed: result.blocked.length });
  }

  if (apiPath === "bot/admins" && method === "POST") {
    const body = await request.json().catch(() => ({}));
    const tgId = String(body.id || "").trim();
    if (!/^\d+$/.test(tgId)) return errorJson(400, "آی‌دی عددی تلگرام را وارد کنید");
    await store.addBotAdmin(tgId, "panel");
    return json({ ok: true });
  }

  const botAdminMatch = apiPath.match(/^bot\/admins\/([^/]+)$/);
  if (botAdminMatch && method === "DELETE") {
    await store.removeBotAdmin(botAdminMatch[1]);
    return json({ ok: true });
  }

  // ── بکاپ ─────────────────────────────────────────────────────────
  if (apiPath === "backup" && method === "GET") {
    const data = await store.exportAll();
    const filename = `vanta-backup-${Math.floor(Date.now() / 1000)}.json`;
    return json(data, { headers: { "Content-Disposition": `attachment; filename="${filename}"` } });
  }

  if (apiPath === "backup/restore" && method === "POST") {
    const body = await request.json().catch(() => ({}));
    const backupData = body.backup;
    const mode = body.mode || "replace";
    if (!["replace", "merge"].includes(mode)) return errorJson(400, "mode باید replace یا merge باشد");
    if (!backupData || typeof backupData !== "object") return errorJson(400, "فایل بکاپ معتبر نیست");

    let counters;
    try {
      counters = await store.importAll(backupData, mode);
    } catch (e) {
      return errorJson(400, e.message || "فایل بکاپ معتبر نیست");
    }

    const settings = await store.getBotSettings();
    let webhookUrl = null;
    if (settings.enabled && settings.token) {
      webhookUrl = botWebhookUrl(host, settings.secret);
      const result = await bot.setWebhook(settings.token, webhookUrl, settings.secret);
      if (!result.ok) webhookUrl = null;
    }
    return json({ ok: true, counters, webhook_url: webhookUrl });
  }

  return errorJson(404, "Not found");
}
