/**
 * linkforge.js — منطق مشترک ساخت لینک vless و آدرس سابسکریپشن
 *
 * پنل وب و ربات تلگرام هر دو از همین‌جا استفاده می‌کنند تا ساخت لینک
 * هرگز بین دو رابط واگرا نشود.
 */
const WS_PATH = "/core";

// آی‌پی‌های پیش‌فرض برای کانفیگ‌های بدون آی‌پی سفارشی — به‌جای اینکه
// لینک مستقیم به دامنه‌ی خود سرویس بخورد.
export const DEFAULT_CLEAN_IPS = ["69.46.46.57", "69.46.46.50"];

// از کد کشور (۲ حرفی) ایموجی پرچم می‌سازد — بدون نیاز به لیست ثابت.
export function flagEmoji(cc) {
  if (!cc) return "🌐";
  const up = String(cc).toUpperCase().replace(/[^A-Z]/g, "");
  if (up.length !== 2) return "🌐";
  const points = [...up].map((c) => 127397 + c.charCodeAt(0));
  return String.fromCodePoint(...points);
}

// برای هر «آی‌پی تمیز» یک لینک vless می‌سازد؛ SNI/Host همیشه دامنه‌ی خودِ
// سرویس می‌ماند چون روتینگ TLS/کلادفلر بر همان اساس است — فقط آدرس مقصدی
// که کلاینت به آن وصل می‌شود عوض می‌شود. لوکیشن ست‌شده به اسم لینک
// می‌چسبد تا با پروکسی‌های همان کشور هماهنگ باشد.
export function buildLinks(config, host) {
  const fp = config.fingerprint || "chrome";
  const alpn = config.alpn || "http/1.1";
  const port = config.port || 443;
  const cleanIps =
    Array.isArray(config.clean_ips) && config.clean_ips.length ? config.clean_ips : DEFAULT_CLEAN_IPS;
  const params =
    `type=ws&path=${encodeURIComponent(WS_PATH)}&host=${host}` +
    `&security=tls&sni=${host}&fp=${fp}&alpn=${encodeURIComponent(alpn)}`;
  const locTag = config.location ? `${flagEmoji(config.location)} ${config.location} ` : "";
  return cleanIps.map((addr) => {
    const label = cleanIps.length > 1 ? `${locTag}${config.name} | ${addr}` : `${locTag}${config.name}`;
    const remark = encodeURIComponent(label);
    return `vless://${config.uuid}@${addr}:${port}?${params}#${remark}`;
  });
}

export function subscriptionUrl(config, host) {
  return `https://${host}/sub/${config.uuid}`;
}
