/**
 * test/smoke.test.mjs — بوت سرور واقعی server.js با Redis فیک،
 * چک HTTP کامل روی پورت واقعی + هندشیک WS از طریق upgrade handler
 * خود server.js (نه نسخه‌ی داخلی تست).
 */
import assert from "node:assert";
import http from "node:http";
import net from "node:net";
import { WebSocket } from "ws";

process.env.ADMIN_PASS = "smoke-pass-9";
process.env.ADMIN_USER = "admin";
process.env.SESSION_SECRET = "smoke-secret";
process.env.ADMIN_PATH = "vanta-admin";
process.env.TRAFFIC_CEILING_GB = "0";
process.env.PORT = "4599";
process.env.REDIS_URL = "redis://fake";

// تزریق Redis فیک — قبل از import هر ماژولی که getStore صدا می‌زند
const { FakeRedis } = await import("./fake-redis.mjs");
const storeMod = await import("../src/store.js");
{
  const s = storeMod.getStore();
  s.r = new FakeRedis();
}

// حالا سرور واقعی را بوت کن (heartbeat و upgrade handler واقعی)
await import("../server.js");
await new Promise((r) => setTimeout(r, 400));

const BASE = "http://127.0.0.1:4599";

function req(method, path, { body, headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const data = body === undefined ? null : JSON.stringify(body);
    const r = http.request(
      BASE + path,
      { method, headers: { ...(data ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) } : {}), ...headers } },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString() }));
      }
    );
    r.on("error", reject);
    if (data) r.write(data);
    r.end();
  });
}

let passed = 0;
const ok = (n) => { passed++; console.log("  ✓", n); };

// 1) decoy
{
  const r = await req("GET", "/");
  assert.equal(r.status, 200);
  assert.ok(r.body.includes("Nimbus Notes"));
  assert.ok(r.headers["x-robots-tag"].includes("noindex"));
  const r404 = await req("GET", "/whatever");
  assert.equal(r404.status, 404);
  const rApi = await req("GET", "/api/configs");
  assert.equal(rApi.status, 404);
  ok("server: decoy + cloaked 404s");
}

// 2) health + qrcode
{
  const r = await req("GET", "/api/health");
  assert.equal(r.status, 200);
  assert.equal(JSON.parse(r.body).ok, true);
  const q = await req("GET", "/qrcode.min.js");
  assert.equal(q.status, 200);
  assert.ok(q.body.length > 1000);
  ok("server: health + qrcode asset");
}

// 3) لاگین + سشن
{
  const bad = await req("POST", "/vanta-admin/api/login", { body: { username: "admin", password: "wrong" } });
  assert.equal(bad.status, 401);
  const good = await req("POST", "/vanta-admin/api/login", { body: { username: "admin", password: "smoke-pass-9" } });
  assert.equal(good.status, 200);
  const cookie = (good.headers["set-cookie"] || []).join(";").split(";")[0];
  assert.ok(cookie.startsWith("vanta_session="));
  globalThis.__ck = cookie;

  const dash = await req("GET", "/vanta-admin/dashboard", { headers: { Cookie: cookie } });
  assert.equal(dash.status, 200);
  assert.ok(dash.body.includes("VANTA"));
  assert.ok(dash.body.includes("امنیت و ضد بن"));
  ok("server: login + dashboard render");
}

// 4) ساخت کانفیگ + آمار + سپر
{
  const H = { Cookie: globalThis.__ck };
  const c = await req("POST", "/vanta-admin/api/configs", {
    headers: H,
    body: { name: "smoke", clean_ips: "1.1.1.1" },
  });
  assert.equal(c.status, 200);
  const cfg = JSON.parse(c.body);
  globalThis.__cfg = cfg;

  const stats = await req("GET", "/vanta-admin/api/stats", { headers: H });
  assert.equal(JSON.parse(stats.body).config_count, 1);

  const snap = await req("GET", "/vanta-admin/api/security/snapshot", { headers: H });
  const sd = JSON.parse(snap.body);
  assert.equal(sd.admin_path, "vanta-admin");
  assert.equal(sd.panic_active, false);
  assert.ok(sd.traffic.ceiling_bytes === 0);

  const shield = await req("POST", "/vanta-admin/api/security/shield", {
    headers: H,
    body: { rate_limit_per_minute: 80, log_ip_mask: true, admin_path: "vanta-admin" },
  });
  assert.equal(JSON.parse(shield.body).ok, true);
  ok("server: config create + stats + shield snapshot/settings");
}

// 5) ساب
{
  const r = await req("GET", "/sub/" + globalThis.__cfg.uuid);
  assert.equal(r.status, 200);
  assert.ok(r.headers["subscription-userinfo"]);
  ok("server: subscription served");
}

// 6) هندشیک VLESS از طریق upgrade handler خود server.js
{
  const echoServer = net.createServer((sock) => {
    sock.on("data", (d) => sock.write("ECHO:" + d.toString()));
  });
  await new Promise((r) => echoServer.listen(0, "127.0.0.1", r));
  const echoPort = echoServer.address().port;

  const uuid = globalThis.__cfg.uuid;
  const hex = uuid.replace(/-/g, "");
  const uuidBytes = new Uint8Array(16);
  for (let i = 0; i < 16; i++) uuidBytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  const hostBytes = new TextEncoder().encode("127.0.0.1");
  const payload = new TextEncoder().encode("smoke-relay");
  const buf = new Uint8Array(1 + 16 + 1 + 1 + 2 + 1 + 1 + hostBytes.length + payload.length);
  let p = 0;
  buf[p++] = 0; buf.set(uuidBytes, p); p += 16; buf[p++] = 0; buf[p++] = 1;
  buf[p++] = (echoPort >> 8) & 0xff; buf[p++] = echoPort & 0xff;
  buf[p++] = 2; buf[p++] = hostBytes.length; buf.set(hostBytes, p); p += hostBytes.length;
  buf.set(payload, p);

  const ws = new WebSocket("ws://127.0.0.1:4599/core");
  const reply = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("handshake timeout")), 8000);
    ws.on("open", () => ws.send(buf));
    ws.on("message", (data) => { clearTimeout(timer); resolve(Buffer.from(data)); });
    ws.on("error", (e) => { clearTimeout(timer); reject(e); });
  });
  assert.equal(reply.subarray(2).toString(), "ECHO:smoke-relay");
  ws.close();
  await new Promise((r) => setTimeout(r, 300));
  echoServer.close();
  ok("server: full VLESS relay through real upgrade handler");
}

// 7) پنیک روی سرور واقعی: هندشیک باید destroy شود
{
  const H = { Cookie: globalThis.__ck };
  await req("POST", "/vanta-admin/api/security/panic", { headers: H, body: { minutes: 10 } });
  const ws = new WebSocket("ws://127.0.0.1:4599/core");
  const closed = await new Promise((resolve) => {
    const timer = setTimeout(() => resolve("timeout-kept-open"), 4000);
    ws.on("open", () => ws.send(new Uint8Array(30)));
    ws.on("close", () => { clearTimeout(timer); resolve("closed"); });
    ws.on("error", () => { clearTimeout(timer); resolve("error"); });
  });
  assert.ok(closed !== "timeout-kept-open", "ws must be rejected during panic");
  await req("POST", "/vanta-admin/api/security/panic", { headers: H, body: { minutes: 0 } });
  ok("server: panic blocks real ws handshake");
}

console.log(`\nSMOKE TEST PASSED (${passed} groups)`);
process.exit(0);
