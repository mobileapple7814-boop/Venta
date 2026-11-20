/**
 * server.js — نقطه‌ی ورود Vanta Core روی Railway
 *
 * Railway یک پروسه‌ی Node.js بلندمدت اجرا می‌کند — یعنی:
 *   - بدون سقف زمانی روی اتصال WebSocket؛ رله تا وقتی کلاینت یا سرور
 *     نبنده‌ش باز می‌ماند.
 *   - WebSocket مسیر ‎/core‎ قبل از رسیدن به روتر، در رویداد upgrade به
 *     رله سپرده می‌شود (با چک‌های سپر: پنیک، سقف ترافیک، محدودیت نرخ).
 *   - heartbeat دوره‌ای هم ترافیک رد می‌کند و هم اتصال‌های مرده را
 *     تمیز می‌کند.
 */
import http from "node:http";
import { WebSocketServer } from "ws";
import app from "./src/app.js";
import { runSession, clientIpFromNodeRequest } from "./src/relay.js";
import { nodeRequestToWebRequest, sendWebResponse } from "./src/webbridge.js";
import { getStore } from "./src/store.js";
import { getShield, getPanicMode, isTrafficCeilingExceeded, rateLimit } from "./src/stealth.js";

const WS_PATH = "/core";

const server = http.createServer(async (req, res) => {
  try {
    const webRequest = await nodeRequestToWebRequest(req);
    const ctx = { waitUntil: (p) => { Promise.resolve(p).catch(() => {}); } };
    const response = await app.fetch(webRequest, process.env, ctx);
    await sendWebResponse(res, response);
  } catch (err) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ detail: err && err.message ? err.message : "internal error" }));
  }
});

// perMessageDeflate خاموش: ترافیک رله از قبل رمزنگاری‌شده (تصادفی/بی‌الگو)
// است؛ فشرده‌سازی نه چیزی را کوچک می‌کند، نه CPU می‌گیرد و نه تأخیر اضافه می‌کند.
const wss = new WebSocketServer({ noServer: true, perMessageDeflate: false });

server.on("upgrade", async (req, socket, head) => {
  const path = (req.url || "").split("?")[0];
  if (path !== WS_PATH) {
    socket.destroy();
    return;
  }
  try {
    const store = getStore();
    const shield = await getShield(store);
    const clientIp = clientIpFromNodeRequest(req);

    // سپر روی هندشیک‌ها: در پنیک یا سقف ترافیک پر‌شده، هیچ اتصالی
    // پذیرفته نمی‌شود — کلوز خاموش (بدون پاسخ خطای قابل‌تشخیص).
    if (await getPanicMode(store)) {
      socket.destroy();
      return;
    }
    const ceiling = await isTrafficCeilingExceeded(store, shield);
    if (ceiling.exceeded) {
      socket.destroy();
      return;
    }
    // محدودیت نرخ هندشیک به ازای IP (ضد اسکن/بروت‌فورس)
    const rl = rateLimit(`ws:${clientIp}`, shield.rate_limit_ws_per_minute);
    if (!rl.allowed) {
      socket.destroy();
      return;
    }

    socket.setNoDelay(true); // خاموش‌کردن Nagle: بسته‌های کوچک فوراً بروند
    wss.handleUpgrade(req, socket, head, (ws) => {
      ws.isAlive = true;
      ws.on("pong", () => {
        ws.isAlive = true;
      });
      runSession(ws, clientIp).catch(() => {
        try {
          ws.close(1011, "internal error");
        } catch {
          /* ignore */
        }
      });
    });
  } catch {
    socket.destroy();
  }
});

// Heartbeat: هر ۲۵ ثانیه ping — هم ترافیک رد می‌شود (پراکسی/NAT اتصال
// بی‌کار را نمی‌بُرند) هم اتصال‌های مرده (بدون pong) تمیز می‌شوند.
const HEARTBEAT_MS = 25_000;
setInterval(() => {
  for (const ws of wss.clients) {
    if (ws.isAlive === false) {
      ws.terminate();
      continue;
    }
    ws.isAlive = false;
    try {
      ws.ping();
    } catch {
      /* ignore */
    }
  }
}, HEARTBEAT_MS).unref();

// پشت پراکسی Railway، keep-alive پیش‌فرض Node (۵ ثانیه) باعث 502 تصادفی می‌شود.
server.keepAliveTimeout = 65_000;

// یک خطای مدیریت‌نشده نباید کل پروسه (و همه‌ی اتصال‌ها) را بکشد.
process.on("uncaughtException", (e) => console.error("uncaughtException:", e));
process.on("unhandledRejection", (e) => console.error("unhandledRejection:", e));

// موقع دیپلوی/ری‌استارت، اتصال‌ها تمیز بسته شوند تا کلاینت‌ها فوراً دوباره وصل شوند.
process.on("SIGTERM", () => {
  for (const ws of wss.clients) {
    try {
      ws.close(1001, "server restarting");
    } catch {
      /* ignore */
    }
  }
  setTimeout(() => process.exit(0), 3000).unref();
});

// Railway پورت را با PORT تزریق می‌کند؛ باید روی 0.0.0.0 بایند شود.
const port = Number(process.env.PORT) || 3000;
server.headersTimeout = 66_000;
server.requestTimeout = 0; // اتصال‌های بلند (رله) نباید به‌خاطر تایم‌اوت پیش‌فرض قطع شوند
server.listen(port, "0.0.0.0", () => {
  console.log(`Vanta Core listening on 0.0.0.0:${port} (ws path: ${WS_PATH})`);
});

export default server;
