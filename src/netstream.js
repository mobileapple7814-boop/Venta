/**
 * netstream.js — لایه‌ی اتصال TCP خام با ظاهر Web Streams
 *
 * uplink.js انتظار یک شیء با ‎.readable‎/‎.writable‎ (استاندارد Web Streams)
 * و ‎.close()‎ دارد؛ اینجا همان قرارداد را با یک سوکت TCP بومی Node
 * (‎net.connect‎) می‌سازیم. نکته‌های عملی:
 *   - ‎setNoDelay‎ برای تأخیر کم (خاموش‌کردن الگوریتم Nagle).
 *   - تایم‌اوت اتصال ۱۰ ثانیه تا مقصد بی‌پاسخ پروسه را آویزان نکند.
 *   - ‎keepAlive‎ دوره‌ای تا فایروال/NAT میانی، اتصال بی‌کار را نکُشد.
 *   - جلوگیری از کرش پروسه با شنونده‌ی خطای بی‌اثر.
 */
import net from "node:net";
import { Duplex } from "node:stream";

export function connect({ hostname, port }) {
  const sock = net.connect({ host: hostname, port, allowHalfOpen: true });
  sock.setNoDelay(true);
  const connectTimer = setTimeout(() => sock.destroy(new Error("connect timeout")), 10_000);
  sock.once("connect", () => clearTimeout(connectTimer));
  sock.once("close", () => clearTimeout(connectTimer));
  sock.on("error", () => {});
  sock.setKeepAlive(true, 30_000);

  // Duplex.toWeb تبدیلی هماهنگ برای یک duplex واحد است (نه دو تبدیل جدا).
  const { readable, writable } = Duplex.toWeb(sock);

  return {
    readable,
    writable,
    close: () =>
      new Promise((resolve) => {
        if (sock.destroyed) return resolve();
        sock.end(() => resolve());
        sock.once("error", () => resolve());
      }),
  };
}
