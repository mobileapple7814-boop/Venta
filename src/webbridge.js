/**
 * webbridge.js — پل بین http.IncomingMessage/ServerResponse خام Node.js
 * و Request/Response استاندارد وب.
 */

function fullUrl(req) {
  const proto = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers["x-forwarded-host"] || req.headers.host || "localhost";
  return `${proto}://${host}${req.url}`;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    if (req.method === "GET" || req.method === "HEAD") return resolve(undefined);
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(chunks.length ? Buffer.concat(chunks) : undefined));
    req.on("error", reject);
  });
}

export async function nodeRequestToWebRequest(req) {
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) continue;
    headers.set(key, Array.isArray(value) ? value.join(", ") : value);
  }
  const body = await readBody(req);
  return new Request(fullUrl(req), {
    method: req.method,
    headers,
    body,
  });
}

export async function sendWebResponse(res, response) {
  res.statusCode = response.status;
  // چند مقدار Set-Cookie ممکن است جدا باشند؛ getSetCookie همه را برمی‌گرداند.
  const setCookies = typeof response.headers.getSetCookie === "function" ? response.headers.getSetCookie() : [];
  for (const [key, value] of response.headers.entries()) {
    if (key.toLowerCase() === "set-cookie") continue;
    res.setHeader(key, value);
  }
  if (setCookies.length) res.setHeader("Set-Cookie", setCookies);
  const buf = Buffer.from(await response.arrayBuffer());
  res.end(buf);
}
