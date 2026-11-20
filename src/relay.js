/**
 * relay.js — موتور رله‌ی VLESS+WS برای Vanta Core
 *
 * ویژگی‌ها:
 *  - پردازش سریالی پیام‌ها (فریم دوم در حین هندشیک به‌عنوان هدر جدید
 *    پارس نمی‌شود — رفع قطع‌ووصلی).
 *  - backpressure سمت کلاینت (pause/resume سوکت) تا حافظه باد نکند.
 *  - پشتیبانی UDP (DNS/QUIC) روی VLESS؛ MUX صریحاً رد می‌شود.
 *  - ثبت دوره‌ای مصرف (هر ۳۰ ثانیه) و اعمال سقف حجم روی اتصال‌های بلند.
 *  - چک «حالت پنیک» و «سقف ترافیک کل» در حین اتصال: اگر سپر فعال شود،
 *    اتصال‌های زنده هم به‌صورت خودکار و بی‌سروصدا بسته می‌شوند (تمام
 *    ترافیک در همان لحظه متوقف می‌شود) — این بخشی از مکانیزم ضد بن است.
 */
import dgram from "node:dgram";
import { parseVlessHeader, buildResponseHeader, VlessParseError } from "./vless.js";
import { getStore } from "./store.js";
import { connectUpstream } from "./uplink.js";
import { isBlocked } from "./firewall.js";
import { getPanicMode, isTrafficCeilingExceeded, getShield, maskIp } from "./stealth.js";

const HANDSHAKE_TIMEOUT_MS = 10_000;
const TICK_INTERVAL_MS = 30_000;
const UDP_IDLE_MS = 60_000;
const MAX_PENDING_BYTES = 4 << 20;
const LOW_PENDING_BYTES = 1 << 20;
const HIGH_WATERMARK = 1 << 20;
const GUARD_INTERVAL_MS = 60_000;

// تعداد اتصال‌های زنده به‌ازای (config, ip) — برای پاک‌کردن آنلاین فقط
// وقتی آخرین اتصال همان IP بسته شد.
const liveIps = new Map();

function concatBytes(a, b) {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function withTimeout(promise, ms) {
  return Promise.race([promise, delay(ms)]);
}

async function waitForDrain(ws) {
  let waited = 0;
  while (ws.readyState === 1 && (ws.bufferedAmount || 0) > HIGH_WATERMARK && waited < 5000) {
    await delay(20);
    waited += 20;
  }
}

async function toUint8(data) {
  if (typeof data === "string") return new TextEncoder().encode(data);
  if (typeof Blob !== "undefined" && data instanceof Blob) {
    return new Uint8Array(await data.arrayBuffer());
  }
  if (data && data.buffer instanceof ArrayBuffer && typeof data.byteOffset === "number" && typeof data.byteLength === "number") {
    return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  }
  return new Uint8Array(data);
}

/** آی‌پی واقعی کلاینت را از هدرهای پراکسی استخراج می‌کند */
export function clientIpFromNodeRequest(req) {
  const xff = req.headers["x-forwarded-for"];
  if (xff) return String(xff).split(",")[0].trim();
  if (req.headers["x-real-ip"]) return String(req.headers["x-real-ip"]).trim();
  return req.socket?.remoteAddress || "unknown";
}

export async function runSession(ws, clientIp) {
  const store = getStore();

  let handshakeDone = false;
  let finalized = false;
  let killSwitchArmed = false; // چک دوره‌ای پنیک/سقف ترافیک
  const handshakeTimer = setTimeout(() => {
    if (!handshakeDone) closeWs(1002, "handshake timeout");
  }, HANDSHAKE_TIMEOUT_MS);

  let socket = null;
  let writer = null;
  let udp = null;
  let udpBuf = new Uint8Array(0);
  let config = null;
  let parsed = null;
  let ticker = null;
  let onlineKey = null;
  let flushed = 0;
  const counters = { up: 0, down: 0 };

  let chain = Promise.resolve();
  let pending = 0;
  let paused = false;

  let lastActivity = Date.now();

  function closeWs(code, reason) {
    try {
      ws.close(code, reason);
    } catch {
      /* ignore */
    }
  }

  function pauseIn() {
    if (paused) return;
    paused = true;
    try {
      ws._socket && ws._socket.pause();
    } catch {
      /* ignore */
    }
  }

  function resumeIn() {
    if (!paused) return;
    paused = false;
    try {
      ws._socket && ws._socket.resume();
    } catch {
      /* ignore */
    }
  }

  async function flushUsage() {
    if (!config) return;
    const total = counters.up + counters.down;
    const delta = total - flushed;
    if (delta <= 0) return;
    flushed = total;
    try {
      const [newUsed] = await Promise.all([
        store.bumpUsage(config.id, delta),
        store.recordTrafficBucket(delta),
      ]);
      const limit = config.traffic_limit_bytes || 0;
      if (limit && parseFloat(newUsed) >= limit) closeWs(1008, "quota exceeded");
    } catch {
      /* ثبت آمار نباید اتصال را بشکند */
    }
  }

  function releaseOnline() {
    if (!onlineKey) return;
    const n = (liveIps.get(onlineKey) || 1) - 1;
    if (n <= 0) {
      liveIps.delete(onlineKey);
      if (config) store.markOffline(config.id, clientIp).catch(() => {});
    } else {
      liveIps.set(onlineKey, n);
    }
    onlineKey = null;
  }

  async function finalize() {
    if (finalized) return;
    finalized = true;
    clearTimeout(handshakeTimer);
    clearInterval(ticker);
    try {
      writer && (await withTimeout(writer.close(), 3000));
    } catch {
      /* ignore */
    }
    try {
      socket && (await withTimeout(socket.close(), 3000));
    } catch {
      /* ignore */
    }
    try {
      udp && udp.stop();
    } catch {
      /* ignore */
    }
    releaseOnline();
    await flushUsage();
    const total = counters.up + counters.down;
    if (config && total > 0) {
      try {
        // ماسک IP طبق تنظیم سپر؛ لاگ‌ها هرگز IP کامل را ذخیره نمی‌کنند.
        const shield = await getShield(store);
        const ipForLog = shield.log_ip_mask ? maskIp(clientIp) : clientIp;
        await store.logConnection(config.id, config.name, ipForLog, parsed?.address, parsed?.port, total);
      } catch {
        /* ignore */
      }
    }
  }

  async function pumpUpstreamToClient() {
    const reader = socket.readable.getReader();
    let sentHeader = false;
    try {
      while (true) {
        await waitForDrain(ws);
        const { value, done } = await reader.read();
        if (done) break;
        const out = sentHeader ? value : concatBytes(buildResponseHeader(), value);
        sentHeader = true;
        try {
          ws.send(out);
        } catch {
          break;
        }
        counters.down += value.length;
        lastActivity = Date.now();
      }
    } catch {
      /* اتصال مقصد بسته/قطع شده */
    } finally {
      if (!sentHeader) {
        try {
          ws.send(buildResponseHeader());
        } catch {
          /* ignore */
        }
      }
      closeWs(1000, "upstream closed");
    }
  }

  // ----------------------------------------------------------------- UDP
  function startUdp() {
    const sock = dgram.createSocket(parsed.address.includes(":") ? "udp6" : "udp4");
    let idle = null;
    const touch = () => {
      clearTimeout(idle);
      idle = setTimeout(() => closeWs(1000, "udp idle"), UDP_IDLE_MS);
    };
    sock.on("message", (msg) => {
      touch();
      const out = new Uint8Array(2 + msg.length);
      out[0] = (msg.length >> 8) & 0xff;
      out[1] = msg.length & 0xff;
      out.set(msg, 2);
      try {
        ws.send(out);
        counters.down += msg.length;
      } catch {
        /* ignore */
      }
    });
    sock.on("error", () => closeWs(1011, "udp error"));
    udp = {
      touch,
      stop() {
        clearTimeout(idle);
        try {
          sock.close();
        } catch {
          /* ignore */
        }
      },
      send(packet) {
        sock.send(packet, parsed.port, parsed.address, () => {});
      },
    };
    touch();
    try {
      ws.send(buildResponseHeader());
    } catch {
      /* ignore */
    }
  }

  function feedUdp(buf) {
    udpBuf = udpBuf.length ? concatBytes(udpBuf, buf) : buf;
    while (udpBuf.length >= 2) {
      const len = (udpBuf[0] << 8) | udpBuf[1];
      if (udpBuf.length < 2 + len) break;
      const packet = udpBuf.subarray(2, 2 + len);
      udpBuf = udpBuf.subarray(2 + len);
      counters.up += packet.length;
      if (len > 0) udp.send(Buffer.from(packet));
    }
    udp.touch();
  }

  async function discardSocket(s) {
    if (s && !(s instanceof Error)) {
      try {
        await withTimeout(s.close(), 3000);
      } catch {
        /* ignore */
      }
    }
  }

  // ------------------------------------------------------------ handshake
  async function doHandshake(buf) {
    clearTimeout(handshakeTimer);

    // سپر: اگر حالت پنیک فعال باشد یا سقف ترافیک کل پر شده باشد، حتی
    // هندشیک هم انجام نمی‌شود؛ اتصال با یک کلوز عادی (بدون هیچ پاسخ
    // خطای قابل‌تشخیصی) بسته می‌شود.
    const shield = await getShield(store);
    if (await getPanicMode(store)) {
      closeWs(1000, "closing");
      return;
    }
    const ceiling = await isTrafficCeilingExceeded(store, shield);
    if (ceiling.exceeded) {
      closeWs(1000, "closing");
      return;
    }

    try {
      parsed = parseVlessHeader(buf);
    } catch (e) {
      if (e instanceof VlessParseError) {
        closeWs(1002, "bad header");
        return;
      }
      throw e;
    }

    if (parsed.command !== 1 && parsed.command !== 2) {
      closeWs(1002, "unsupported command");
      return;
    }
    const isUdp = parsed.command === 2;

    config = await store.getConfigByUuid(parsed.clientUuid);
    if (!config || config.enabled === false) {
      closeWs(1008, "unknown or disabled");
      return;
    }

    const trafficLimit = config.traffic_limit_bytes || 0;
    if (trafficLimit && (config.used_bytes || 0) >= trafficLimit) {
      closeWs(1008, "quota exceeded");
      return;
    }

    if (isBlocked(parsed.address, config.blocklist)) {
      closeWs(1008, "blocked");
      return;
    }

    const limitPromise = store.isIpWithinLimit(config, clientIp);
    const connectPromise = isUdp
      ? Promise.resolve(null)
      : connectUpstream(config, parsed.address, parsed.port).catch((e) => e);

    let withinLimit;
    try {
      withinLimit = await limitPromise;
    } catch (e) {
      await discardSocket(await connectPromise);
      throw e;
    }
    if (!withinLimit) {
      await discardSocket(await connectPromise);
      closeWs(1008, "limit exceeded");
      return;
    }

    if (isUdp) {
      startUdp();
    } else {
      const connectResult = await connectPromise;
      if (connectResult instanceof Error) {
        closeWs(1011, "connect failed");
        return;
      }
      if (ws.readyState !== 1) {
        await discardSocket(connectResult);
        return;
      }
      socket = connectResult;
      writer = socket.writable.getWriter();
      pumpUpstreamToClient().finally(finalize);
    }

    onlineKey = `${config.id}:${clientIp}`;
    liveIps.set(onlineKey, (liveIps.get(onlineKey) || 0) + 1);
    store.markOnline(config.id, clientIp).catch(() => {});
    ticker = setInterval(() => {
      store.markOnline(config.id, clientIp).catch(() => {});
      flushUsage();
      // نگهبان سپر در حین اتصال: پنیک/سقف ترافیک باید اتصال‌های زنده را
      // هم ببندد، نه فقط اتصال‌های جدید را رد کند.
      if (!killSwitchArmed) {
        killSwitchArmed = true;
        (async () => {
          try {
            const sh = await getShield(store);
            if ((await getPanicMode(store)) || (await isTrafficCeilingExceeded(store, sh)).exceeded) {
              closeWs(1000, "closing");
              finalize();
            }
          } catch {
            /* ignore */
          } finally {
            killSwitchArmed = false;
          }
        })();
      }
    }, TICK_INTERVAL_MS);

    handshakeDone = true;

    const initialPayload = buf.subarray(parsed.headerLen);
    if (initialPayload.length > 0) {
      if (isUdp) feedUdp(initialPayload);
      else {
        await writer.write(initialPayload);
        counters.up += initialPayload.length;
      }
    }
  }

  async function handleMessage(event) {
    if (finalized) return;
    try {
      const buf = await toUint8(event.data);
      lastActivity = Date.now();

      if (!handshakeDone) {
        await doHandshake(buf);
        return;
      }

      if (udp) {
        feedUdp(buf);
      } else if (writer) {
        await writer.write(buf);
        counters.up += buf.length;
      }
    } catch {
      closeWs(1011, "relay error");
      await finalize();
    }
  }

  ws.addEventListener("message", (event) => {
    const d = event.data;
    const size = typeof d === "string" ? d.length : d.byteLength ?? d.length ?? 0;
    pending += size;
    if (pending > MAX_PENDING_BYTES) pauseIn();
    chain = chain
      .then(() => handleMessage(event))
      .catch(() => {})
      .finally(() => {
        pending -= size;
        if (paused && pending < LOW_PENDING_BYTES) resumeIn();
      });
  });

  ws.addEventListener("close", () => {
    finalize();
  });

  ws.addEventListener("error", () => {
    finalize();
  });

  // نگهبان اتصال‌های نیمه‌باز: هر نشست کاملاً بی‌کار بعد از چند دقیقه
  // بسته می‌شود تا حافظه و مجموعه‌ی آنلاین نشت نکند.
  const IDLE_SESSION_MS = 10 * 60_000;
  const idleGuard = setInterval(() => {
    if (finalized) return;
    if (Date.now() - lastActivity > IDLE_SESSION_MS) {
      closeWs(1000, "idle timeout");
      finalize();
    }
  }, GUARD_INTERVAL_MS);
  if (idleGuard.unref) idleGuard.unref();
  const _origFinalize = finalize;
  finalize = () => {
    clearInterval(idleGuard);
    _origFinalize();
  };
}
