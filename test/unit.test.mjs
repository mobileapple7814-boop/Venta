/**
 * test/unit.test.mjs — تست‌های واحد ماژول‌های پروتکل و سپر
 */
import assert from "node:assert";
import { parseVlessHeader, buildResponseHeader, VlessParseError } from "../src/vless.js";
import { isBlocked } from "../src/firewall.js";
import { buildLinks, subscriptionUrl, flagEmoji, DEFAULT_CLEAN_IPS } from "../src/linkforge.js";
import { createSessionCookie, verifySessionCookie, parseCookies } from "../src/session.js";
import { maskIp, looksLikeScanner, rateLimit } from "../src/stealth.js";

// ── vless.js ─────────────────────────────────────────────────────────
function buildVlessRequest(uuidStr, { command = 1, port = 443, domain = "example.com", payload = new Uint8Array([0xde, 0xad]) } = {}) {
  const hex = uuidStr.replace(/-/g, "");
  const uuidBytes = new Uint8Array(16);
  for (let i = 0; i < 16; i++) uuidBytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  const domainBytes = new TextEncoder().encode(domain);
  const buf = new Uint8Array(1 + 16 + 1 + 1 + 2 + 1 + 1 + domainBytes.length + payload.length);
  let p = 0;
  buf[p++] = 0; // version
  buf.set(uuidBytes, p); p += 16;
  buf[p++] = 0; // addon len
  buf[p++] = command;
  buf[p++] = (port >> 8) & 0xff; buf[p++] = port & 0xff;
  buf[p++] = 2; // domain
  buf[p++] = domainBytes.length;
  buf.set(domainBytes, p); p += domainBytes.length;
  buf.set(payload, p);
  return buf;
}

{
  const uuid = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";
  const req = buildVlessRequest(uuid, { port: 8080, domain: "api.test.io", payload: new Uint8Array([1, 2, 3, 4, 5]) });
  const parsed = parseVlessHeader(req);
  assert.equal(parsed.version, 0);
  assert.equal(parsed.clientUuid, uuid);
  assert.equal(parsed.command, 1);
  assert.equal(parsed.port, 8080);
  assert.equal(parsed.address, "api.test.io");
  assert.equal(parsed.headerLen, req.length - 5);
  assert.deepEqual(buildResponseHeader(), new Uint8Array([0, 0]));

  // header با IPv4
  const parts = "1.2.3.4".split(".").map(Number);
  const buf4 = new Uint8Array(1 + 16 + 1 + 1 + 2 + 1 + 4);
  buf4[0] = 0;
  buf4.set(new Uint8Array(16), 1);
  buf4[17] = 0; buf4[18] = 1;
  buf4[19] = 0; buf4[20] = 80;
  buf4[21] = 1; // ipv4
  buf4.set(parts, 22);
  const p4 = parseVlessHeader(buf4);
  assert.equal(p4.address, "1.2.3.4");
  assert.equal(p4.port, 80);

  // کوتاه
  assert.throws(() => parseVlessHeader(new Uint8Array(10)), VlessParseError);
  // آدرس ناشناخته
  const bad = new Uint8Array(1 + 16 + 1 + 1 + 2 + 1);
  bad[0] = 0; bad.set(new Uint8Array(16), 1); bad[17] = 0; bad[18] = 1; bad[19] = 0; bad[20] = 443; bad[21] = 9;
  assert.throws(() => parseVlessHeader(bad), VlessParseError);
  console.log("✓ vless header parse/build");
}

// ── firewall.js ──────────────────────────────────────────────────────
{
  const bl = ["example.com", "1.2.3.4", "5.6.7.0/24", "*.wild.io"];
  assert.ok(isBlocked("example.com", bl));
  assert.ok(isBlocked("sub.example.com", bl));
  assert.ok(!isBlocked("notexample.com", bl));
  assert.ok(isBlocked("1.2.3.4", bl));
  assert.ok(!isBlocked("1.2.3.5", bl));
  assert.ok(isBlocked("5.6.7.99", bl));
  assert.ok(!isBlocked("5.6.8.1", bl));
  assert.ok(isBlocked("wild.io", bl));
  assert.ok(isBlocked("a.b.wild.io", bl));
  assert.ok(!isBlocked("nowild.io", bl));
  assert.ok(!isBlocked("clean.com", bl));
  assert.ok(!isBlocked("anything", []));
  assert.ok(!isBlocked("", bl));
  // IPv6 تطابق دقیق
  assert.ok(isBlocked("::1", ["::1"]));
  assert.ok(!isBlocked("::2", ["::1"]));
  console.log("✓ firewall blocklist");
}

// ── linkforge.js ─────────────────────────────────────────────────────
{
  const cfg = {
    uuid: "11111111-2222-3333-4444-555555555555",
    name: "تست",
    clean_ips: ["1.1.1.1", "2.2.2.2"],
    port: 443,
    fingerprint: "chrome",
    alpn: "http/1.1",
    location: "DE",
  };
  const links = buildLinks(cfg, "panel.example.com");
  assert.equal(links.length, 2);
  assert.ok(links[0].startsWith("vless://11111111-2222-3333-4444-555555555555@1.1.1.1:443?"));
  assert.ok(links[0].includes("path=%2Fcore"));
  assert.ok(links[0].includes("host=panel.example.com"));
  assert.ok(links[0].includes("sni=panel.example.com"));
  assert.ok(links[0].includes("security=tls"));
  assert.ok(links[0].includes("%F0%9F%87%A9%F0%9F%87%AA")); // پرچم DE در remark

  // بدون clean_ips → پیش‌فرض
  const links2 = buildLinks({ ...cfg, clean_ips: [] }, "x.io");
  assert.equal(links2.length, DEFAULT_CLEAN_IPS.length);

  assert.equal(subscriptionUrl(cfg, "x.io"), "https://x.io/sub/" + cfg.uuid);
  assert.equal(flagEmoji("de"), "🇩🇪");
  assert.equal(flagEmoji(""), "🌐");
  console.log("✓ linkforge links/subscription/flag");
}

// ── session.js ───────────────────────────────────────────────────────
{
  const secret = "topsecret";
  const token = await createSessionCookie("admin", secret);
  assert.ok(await verifySessionCookie(token, secret));
  assert.ok(!(await verifySessionCookie(token, "wrong-secret")));
  assert.ok(!(await verifySessionCookie("garbage", secret)));
  assert.ok(!(await verifySessionCookie("", secret)));
  assert.ok(!(await verifySessionCookie(token + "x", secret)));

  const cookies = parseCookies("a=1; vanta_session=abc; b=2");
  assert.equal(cookies.a, "1");
  assert.equal(cookies.vanta_session, "abc");
  assert.deepEqual(parseCookies(""), {});
  console.log("✓ session cookie HMAC");
}

// ── stealth.js (خالص، بدون store) ────────────────────────────────────
{
  assert.equal(maskIp("1.2.3.4"), "1.2.3.x");
  assert.equal(maskIp("255.10.20.30"), "255.10.20.x");
  assert.equal(maskIp("::1"), "::1");
  assert.equal(maskIp(""), "");

  assert.ok(looksLikeScanner("curl/8.0"));
  assert.ok(looksLikeScanner("Wget/1.21"));
  assert.ok(looksLikeScanner("python-requests/2.31"));
  assert.ok(looksLikeScanner("Googlebot/2.1"));
  assert.ok(!looksLikeScanner("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120"));
  assert.ok(!looksLikeScanner(""));
  assert.ok(!looksLikeScanner(null));

  // نرخ: ۳ مجاز در دقیقه → چهارمی رد
  const key = "test:" + Math.random();
  assert.ok(rateLimit(key, 3).allowed);
  assert.ok(rateLimit(key, 3).allowed);
  assert.ok(rateLimit(key, 3).allowed);
  const denied = rateLimit(key, 3);
  assert.ok(!denied.allowed);
  assert.ok(denied.retryAfterSec > 0 && denied.retryAfterSec <= 60);
  // کلید متفاوت مجاز
  assert.ok(rateLimit(key + "-other", 3).allowed);
  console.log("✓ stealth maskIp/scannerUa/rateLimit");
}

console.log("ALL UNIT TESTS PASSED");
