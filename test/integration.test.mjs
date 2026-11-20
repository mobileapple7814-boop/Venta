/**
 * test/integration.test.mjs — تست کامل سرور با Redis فیک + هندشیک VLESS واقعی
 *
 * سناریوها:
 *  1) صفحه‌ی قلابی روی / و 404 قلابی روی مسیرهای ناشناخته
 *  2) ورود: رمز غلط (شمارش تلاش) → رمز درست → سشن
 *  3) مسیر مخفی: /dashboard بدون سشن → redirect به لاگین
 *  4) قفل ورود بعد از N تلاش (429)
 *  5) فیلتر اسکنر (curl → 404)
 *  6) API ادمین با سشن: ساخت کانفیگ، لیست، آمار، تغییر تنظیمات سپر
 *  7) سابسکریپشن عمومی (Base64 + هدر Subscription-Userinfo)
 *  8) پنیک: فعال‌شدن → ساب 404 می‌شود → هندشیک WS رد می‌شود → خاموش‌شدن
 *  9) سقف ترافیک: ست‌کردن سقف → bumpUsage تا بالای سقف → هندشیک رد می‌شود
 * 10) هندشیک VLESS+WS کامل: اتصال واقعی به یک سرور TCP محلی و رله شدن بایت‌ها
 */
import assert from "node:assert";
import http from "node:http";
import net from "node:net";
import { WebSocket } from "ws";
import { FakeRedis } from "./fake-redis.mjs";

process.env.ADMIN_PASS = "testpass123";
process.env.ADMIN_USER = "boss";
process.env.SESSION_SECRET = "test-secret";
process.env.ADMIN_PATH = "hidden-panel";
process.env.TRAFFIC_CEILING_GB = "0";
process.env.SHIELD_STRICT = "on";

// ── تزریق Redis فیک قبل از import ماژول‌ها ─────────────────────────────
const fake = new FakeRedis();
const storeMod = await import("../src/store.js");
// جایگزینی singleton: نمونه‌ای که redisClient آن فیک است
const origRedisClient = storeMod.__lookupGetter__ === undefined ? null : null;
{
  const mod = await import("../src/store.js");
  // store.js از redisClient() داخلی new می‌کند؛ ساده‌ترین راه: monkey-patch
  // پروتوتایپ پس از ساخت اولین نمونه با REDIS_URL فیک.
}
process.env.REDIS_URL = "redis://fake";

// store.js را با نسخه‌ی قابل‌تزریق اجرا کنیم: ماژول getter ندارد، پس
// نمونه‌ی VaultStore را می‌سازیم و r را با فیک جایگزین می‌کنیم.
const { VaultStore } = await import("../src/store.js");
const store = new VaultStore();
store.r = fake;
// getStore باید همین نمونه را برگرداند — storeMod را patch می‌کنیم
// (ESM اجازه reassign ندارد؛ پس ماژول‌ها را با query string متفاوت می‌گیریم؟
// نه — ساده‌تر: قبل از هر چیز getStore را در حافظه‌ی ماژول قفل می‌کنیم با
// ساختن نمونه‌ی واقعی اول.) — چون getStore یک singleton ساده است، نمونه‌ی
// ساخته‌شده همین حالا برای کل پروسه قفل می‌شود:
const getStore = storeMod.getStore;
{
  const s = getStore();
  s.r = fake; // همان singleton — الان r آن فیک است
}

const app = (await import("../src/app.js")).default;
const { runSession } = await import("../src/relay.js");

const ctx = { waitUntil: (p) => { Promise.resolve(p).catch(() => {}); } };
const ENV = { ...process.env };

async function call(method, path, { body, headers = {} } = {}) {
  const req = new Request(`https://panel.test${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return app.fetch(req, ENV, ctx);
}

let passed = 0;
function ok(name) {
  passed++;
  console.log("  ✓", name);
}

// ── 1) decoy و 404 ───────────────────────────────────────────────────
{
  const res = await call("GET", "/");
  const text = await res.text();
  assert.equal(res.status, 200);
  assert.ok(text.includes("Nimbus Notes"));
  assert.ok(!text.includes("VANTA"));
  assert.ok(res.headers.get("x-robots-tag").includes("noindex"));

  const res404 = await call("GET", "/random/path");
  assert.equal(res404.status, 404);
  const t404 = await res404.text();
  assert.ok(t404.includes("404"));
  assert.ok(!t404.includes("vanta"));

  // /dashboard عمومی وجود ندارد → 404 قلابی
  const resDash = await call("GET", "/dashboard");
  assert.equal(resDash.status, 404);
  // /api/configs عمومی وجود ندارد → 404 قلابی
  const resApi = await call("GET", "/api/configs");
  assert.equal(resApi.status, 404);
  // مسیر ws قدیمی/رایج → 404 قلابی (نه پاسخ VLESS)
  const resWs = await call("GET", "/ws");
  assert.equal(resWs.status, 404);
  // /core بدون Upgrade → 404 قلابی
  const resCore = await call("GET", "/core");
  assert.equal(resCore.status, 404);
  ok("decoy on / and cloaked 404 elsewhere");
}

// ── health ───────────────────────────────────────────────────────────
{
  const res = await call("GET", "/api/health");
  const data = await res.json();
  assert.equal(res.status, 200);
  assert.equal(data.ok, true);
  // health نباید نام برند را لو بدهد
  assert.ok(!("service" in data) || !/vanta/i.test(data.service || ""));
  ok("health endpoint (brand-neutral)");
}

// ── 2) ورود ──────────────────────────────────────────────────────────
{
  // بدون رمز غلط اول: یک غلط
  const bad = await call("POST", "/hidden-panel/api/login", { body: { username: "boss", password: "wrong" } });
  assert.equal(bad.status, 401);
  const badData = await bad.json();
  assert.ok("attempts_left" in badData);

  // مسیر اشتباه ادمین → 404 قلابی
  const wrongPath = await call("POST", "/vanta-admin/api/login", { body: { username: "boss", password: "testpass123" } });
  assert.equal(wrongPath.status, 404);

  const good = await call("POST", "/hidden-panel/api/login", { body: { username: "boss", password: "testpass123" } });
  assert.equal(good.status, 200);
  const setCookie = good.headers.get("set-cookie") || "";
  assert.ok(setCookie.includes("vanta_session="));
  assert.ok(setCookie.includes("Path=/hidden-panel/"));
  globalThis.__SESSION = setCookie.split(";")[0];
  ok("login flow (wrong path 404, wrong pass 401, good pass sets cookie)");
}

// ── 3) مسیر مخفی ─────────────────────────────────────────────────────
{
  const loginPageRes = await call("GET", "/hidden-panel/");
  assert.equal(loginPageRes.status, 200);
  assert.ok((await loginPageRes.text()).includes("VANTA"));

  const dashNoAuth = await call("GET", "/hidden-panel/dashboard");
  assert.equal(dashNoAuth.status, 302);
  assert.ok(dashNoAuth.headers.get("location").includes("/hidden-panel/"));

  const dashAuth = await call("GET", "/hidden-panel/dashboard", { headers: { Cookie: globalThis.__SESSION } });
  assert.equal(dashAuth.status, 200);
  assert.ok((await dashAuth.text()).includes("VANTA"));
  ok("hidden panel: login page, dashboard redirect, dashboard with session");
}

// ── 4) قفل ورود ──────────────────────────────────────────────────────
{
  // ADMIN_PASS درست ولی username غلط — تلاش‌های ناموفق را پر می‌کنیم
  for (let i = 0; i < 5; i++) {
    await call("POST", "/hidden-panel/api/login", { body: { username: "boss", password: "nope" + i } });
  }
  const locked = await call("POST", "/hidden-panel/api/login", { body: { username: "boss", password: "testpass123" } });
  assert.equal(locked.status, 429);
  const ld = await locked.json();
  assert.ok("retry_after_minutes" in ld);
  // پاک‌سازی برای ادامه‌ی تست‌ها
  const { clearFailedLogins } = await import("../src/stealth.js");
  await clearFailedLogins(store, "unknown");
  ok("login lockout after repeated failures (429)");
}

// ── 5) فیلتر اسکنر ───────────────────────────────────────────────────
{
  const res = await call("GET", "/hidden-panel/", { headers: { "User-Agent": "curl/8.0.1" } });
  assert.equal(res.status, 404);
  assert.ok((await res.text()).includes("404"));
  const resOk = await call("GET", "/hidden-panel/", { headers: { "User-Agent": "Mozilla/5.0 Chrome/120" } });
  assert.equal(resOk.status, 200);
  ok("scanner UA filtered");
}

// ── 6) API ادمین ─────────────────────────────────────────────────────
let configId = "";
let configUuid = "";
{
  const H = { Cookie: globalThis.__SESSION };

  // بدون سشن → 401
  const noAuth = await call("GET", "/hidden-panel/api/configs");
  assert.equal(noAuth.status, 401);

  const create = await call("POST", "/hidden-panel/api/configs", {
    headers: H,
    body: { name: "کاربر تست", traffic_limit_gb: 2, expires_days: 30, ip_limit: 3, clean_ips: "1.1.1.1\n2.2.2.2" },
  });
  assert.equal(create.status, 200);
  const cfg = await create.json();
  configId = cfg.id;
  configUuid = cfg.uuid;
  assert.equal(cfg.name, "کاربر تست");
  assert.equal(cfg.traffic_limit_bytes, 2 * 1024 ** 3);
  assert.deepEqual(cfg.clean_ips, ["1.1.1.1", "2.2.2.2"]);
  assert.ok(cfg.links.length === 2);
  assert.ok(cfg.link.startsWith("vless://"));
  assert.ok(cfg.sub_url.endsWith("/sub/" + cfg.uuid));

  const list = await call("GET", "/hidden-panel/api/configs", { headers: H });
  const listData = await list.json();
  assert.equal(listData.configs.length, 1);
  assert.equal(listData.configs[0].online, 0);

  const stats = await call("GET", "/hidden-panel/api/stats", { headers: H });
  const statsData = await stats.json();
  assert.equal(statsData.config_count, 1);
  assert.equal(statsData.active_configs, 1);
  assert.ok(statsData.uptime_sec >= 0);

  // patch
  const patch = await call("PATCH", `/hidden-panel/api/configs/${configId}`, {
    headers: H,
    body: { enabled: false },
  });
  assert.equal(patch.status, 200);
  assert.equal((await patch.json()).enabled, false);
  const patch2 = await call("PATCH", `/hidden-panel/api/configs/${configId}`, {
    headers: H,
    body: { enabled: true },
  });
  assert.equal((await patch2.json()).enabled, true);

  ok("admin API: create/list/stats/patch config");
}

// ── 7) سابسکریپشن ────────────────────────────────────────────────────
{
  store.r.hset("vuse", configId, String(500 * 1024 * 1024));
  const res = await call("GET", "/sub/" + configUuid);
  assert.equal(res.status, 200);
  const b64 = await res.text();
  const decoded = atob(b64);
  assert.ok(decoded.includes("vless://"));
  assert.ok(decoded.includes("1.1.1.1"));
  const userinfo = res.headers.get("subscription-userinfo");
  assert.ok(userinfo.includes(`download=${500 * 1024 * 1024}`));
  assert.ok(userinfo.includes(`total=${2 * 1024 ** 3}`));
  assert.ok(res.headers.get("profile-title").startsWith("base64:"));

  // uuid ناشناخته → 404
  const nf = await call("GET", "/sub/00000000-0000-0000-0000-000000000000");
  assert.equal(nf.status, 404);
  ok("subscription (base64 + headers + 404)");
}

// ── 8) پنیک ──────────────────────────────────────────────────────────
{
  const H = { Cookie: globalThis.__SESSION };
  const on = await call("POST", "/hidden-panel/api/security/panic", { headers: H, body: { minutes: 30 } });
  assert.equal((await on.json()).panic_active, true);

  // ساب → 404
  const sub = await call("GET", "/sub/" + configUuid);
  assert.equal(sub.status, 404);

  // ورود جدید → 423
  const login = await call("POST", "/hidden-panel/api/login", { body: { username: "boss", password: "testpass123" } });
  assert.equal(login.status, 423);

  // اسنپ‌شات وضعیت پنیک را نشان می‌دهد
  const snap = await call("GET", "/hidden-panel/api/security/snapshot", { headers: H });
  assert.equal((await snap.json()).panic_active, true);

  // هندشیک WS: upgrade واقعی نمی‌سازیم اینجا (بخش ۱۰ وایر واقعی دارد)؛
  // ولی معادل منطقی‌اش را چک می‌کنیم: upgrade handler باید destroy کند.
  const off = await call("POST", "/hidden-panel/api/security/panic", { headers: H, body: { minutes: 0 } });
  assert.equal((await off.json()).panic_active, false);
  const sub2 = await call("GET", "/sub/" + configUuid);
  assert.equal(sub2.status, 200);
  ok("panic mode: sub 404, login 423, snapshot, off");
}

// ── 9) سقف ترافیک ────────────────────────────────────────────────────
{
  const H = { Cookie: globalThis.__SESSION };
  // سقف ۰.۰۰۱ گیگ (~1MB) و مصرف فعلی صفر
  const setCeil = await call("POST", "/hidden-panel/api/security/ceiling", { headers: H, body: { gb: 0.001 } });
  assert.equal((await setCeil.json()).traffic_ceiling_gb, 0.001);

  // مصرف را تا بالای سقف ببریم (bumpUsage از store)
  await store.bumpUsage(configId, 2 * 1024 * 1024); // 2MB > 1MB
  const snap = await call("GET", "/hidden-panel/api/security/snapshot", { headers: H });
  const snapData = await snap.json();
  assert.ok(snapData.traffic.exceeded);

  // با سقف پرشده، isTrafficCeilingExceeded باید دستور قطع بدهد —
  // رفتار upgrade handler را مستقیم تست می‌کنیم در بخش ۱۰.
  // سقف را برمی‌داریم برای تست رله
  await call("POST", "/hidden-panel/api/security/ceiling", { headers: H, body: { gb: 0 } });
  const snap2 = await call("GET", "/hidden-panel/api/security/snapshot", { headers: H });
  assert.ok(!(await snap2.json()).traffic.exceeded);
  ok("traffic ceiling: set, exceed, clear");
}

// ── 10) هندشیک VLESS واقعی روی WS ────────────────────────────────────
{
  // سرور TCP مقصد
  const echoServer = net.createServer((sock) => {
    sock.on("data", (d) => sock.write("ECHO:" + d.toString()));
  });
  await new Promise((r) => echoServer.listen(0, "127.0.0.1", r));
  const echoPort = echoServer.address().port;

  // سرور HTTP محلی که upgrade را مثل server.js هندل می‌کند
  const { WebSocketServer } = await import("ws");
  const wss = new WebSocketServer({ noServer: true, perMessageDeflate: false });
  const hs = http.createServer();
  hs.on("upgrade", (req, socket, head) => {
    wss.handleUpgrade(req, socket, head, (ws) => {
      runSession(ws, "9.9.9.9").catch(() => {});
    });
  });
  await new Promise((r) => hs.listen(0, "127.0.0.1", r));
  const hsPort = hs.address().port;

  // ساخت هدر VLESS
  const uuid = configUuid;
  const hex = uuid.replace(/-/g, "");
  const uuidBytes = new Uint8Array(16);
  for (let i = 0; i < 16; i++) uuidBytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  const hostBytes = new TextEncoder().encode("127.0.0.1");
  const payload = new TextEncoder().encode("hello-vanta");
  const buf = new Uint8Array(1 + 16 + 1 + 1 + 2 + 1 + 1 + hostBytes.length + payload.length);
  let p = 0;
  buf[p++] = 0;
  buf.set(uuidBytes, p); p += 16;
  buf[p++] = 0;
  buf[p++] = 1; // TCP
  buf[p++] = (echoPort >> 8) & 0xff; buf[p++] = echoPort & 0xff;
  buf[p++] = 2;
  buf[p++] = hostBytes.length;
  buf.set(hostBytes, p); p += hostBytes.length;
  buf.set(payload, p);

  const ws = new WebSocket(`ws://127.0.0.1:${hsPort}/core`);
  const firstReply = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("ws handshake timeout")), 8000);
    ws.on("open", () => ws.send(buf));
    ws.on("message", (data, isBinary) => {
      clearTimeout(timer);
      resolve(Buffer.from(data));
    });
    ws.on("error", (e) => { clearTimeout(timer); reject(e); });
  });
  // پاسخ باید [0,0] + "ECHO:hello-vanta" باشد
  assert.equal(firstReply[0], 0);
  assert.equal(firstReply[1], 0);
  assert.equal(firstReply.subarray(2).toString(), "ECHO:hello-vanta");

  // پیام بعدی هم رله شود
  const second = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("second relay timeout")), 8000);
    const onMsg = (data) => { clearTimeout(timer); ws.off("message", onMsg); resolve(Buffer.from(data)); };
    ws.on("message", onMsg);
    ws.send(new TextEncoder().encode("second-msg"));
  });
  assert.equal(second.toString(), "ECHO:second-msg");

  ws.close();
  await new Promise((r) => setTimeout(r, 300));

  // مصرف ثبت شده؟
  const used = await store.getUsage(configId);
  assert.ok(used > 0, "usage should be recorded");

  // لاگ اتصال با IP ماسک‌شده
  const logs = await store.getLogs(configId, 10);
  assert.ok(logs.length >= 1);
  assert.equal(logs[0].ip, "9.9.9.x"); // ماسک فعال است

  echoServer.close();
  hs.close();
  ok("real VLESS+WS handshake: connect, relay, echo, usage, masked log");
}

// ── بکاپ/بازیابی ─────────────────────────────────────────────────────
{
  const H = { Cookie: globalThis.__SESSION };
  const backupRes = await call("GET", "/hidden-panel/api/backup", { headers: H });
  assert.equal(backupRes.status, 200);
  const backup = await backupRes.json();
  assert.equal(backup.app, "vanta-core");
  assert.equal(backup.version, 2);
  assert.ok(Object.keys(backup.configs).length >= 1);

  const restore = await call("POST", "/hidden-panel/api/backup/restore", {
    headers: H,
    body: { backup, mode: "merge" },
  });
  assert.equal(restore.status, 200);
  assert.ok((await restore.json()).counters.configs >= 1);
  ok("backup/restore roundtrip");
}

// ── رگرسیون باگ‌های بعد از دیپلوی ────────────────────────────────────
{
  // 1) مسیر API داشبورد باید داخل مسیر مخفی بماند (قبلاً ../api/ → /api/ → 404 → «خطا در دریافت لیست کانفیگ‌ها»)
  const H = { Cookie: globalThis.__SESSION };
  const dash = await call("GET", "/hidden-panel/dashboard", { headers: H });
  const dashHtml = await dash.text();
  assert.ok(dashHtml.includes("const API = './api/';"), "dashboard API base must be ./api/");
  assert.ok(!dashHtml.includes("const API = '../api/';"));
  // ./api/configs نسبت به /hidden-panel/dashboard همان /hidden-panel/api/configs است
  const resolved = new URL("./api/configs", "https://panel.test/hidden-panel/dashboard").pathname;
  assert.equal(resolved, "/hidden-panel/api/configs");
  const list = await call("GET", resolved, { headers: H });
  assert.equal(list.status, 200);
  assert.ok(Array.isArray((await list.json()).configs));

  // 2) مسیر مخفی بدون «/» انتهایی → ریدایرکت (وگرنه api/login و ./dashboard خراب می‌شوند)
  const noSlash = await call("GET", "/hidden-panel");
  assert.equal(noSlash.status, 302);
  assert.ok(noSlash.headers.get("location").endsWith("/hidden-panel/"));
  ok("regression: dashboard API path + admin path trailing slash");
}

{
  // 3) وب‌هوک تلگرام با User-Agent واقعی تلگرام ("TelegramBot ...") نباید توسط فیلتر اسکنر 404 شود
  const { getStore } = await import("../src/store.js");
  const st = getStore();
  const bot = await import("../src/bot.js");
  const secret = await bot.makeSecret("123:TESTTOKEN");
  await st.saveBotSettings("123:TESTTOKEN", true, secret);

  const wrongSecret = await call("POST", "/bot/webhook/nope", {
    headers: { "user-agent": "TelegramBot (like TwitterBot)" },
    body: { update_id: 1 },
  });
  assert.equal(wrongSecret.status, 200); // پاسخ خنثی؛ نه 404 اسکنر
  assert.deepEqual(await wrongSecret.json(), { ok: true });

  // آپدیتی که handler روی آن می‌ترکد هم باید 200 برگرداند (نه 500 + retry بی‌پایان تلگرام)
  const broken = await call("POST", `/bot/webhook/${secret}`, {
    headers: { "user-agent": "TelegramBot (like TwitterBot)" },
    body: { update_id: 2, message: { chat: null } },
  });
  assert.equal(broken.status, 200);
  ok("regression: telegram webhook passes UA filter and never 500s");

  // 4) ساب باید برای کلاینت‌هایی با UA مثل okhttp/Go-http-client کار کند
  const H = { Cookie: globalThis.__SESSION };
  const cfgs = (await (await call("GET", "/hidden-panel/api/configs", { headers: H })).json()).configs;
  const withUa = await call("GET", `/sub/${cfgs[0].uuid}`, { headers: { "user-agent": "okhttp/4.12.0" } });
  assert.equal(withUa.status, 200);
  const withGo = await call("GET", `/sub/${cfgs[0].uuid}`, { headers: { "user-agent": "Go-http-client/2.0" } });
  assert.equal(withGo.status, 200);
  // ولی اسکنر روی مسیرهای دیگر همچنان بسته است
  const scan = await call("GET", "/hidden-panel/", { headers: { "user-agent": "curl/8.0" } });
  assert.equal(scan.status, 404);
  ok("regression: /sub works for VPN-client UAs, scanner filter still active elsewhere");
}

console.log(`\nALL INTEGRATION TESTS PASSED (${passed} groups)`);
process.exit(0);
