/**
 * store.js — لایه‌ی ذخیره‌سازی Vanta Core روی Redis
 *
 * Railway (برخلاف Cloudflare) معادل Durable Object ندارد؛ هر دیپلوی یک
 * پروسه‌ی بلندمدت است ولی حالت باید در ری‌استارت‌ها و مقیاس‌بندی‌ها زنده
 * بماند، پس همه‌چیز روی Redis نگه داشته می‌شود.
 *
 * کلیدهای Redis (همه با پیشوند v):
 *   vcfg   → هش کانفیگ‌ها         { id: json }
 *   vuse   → هش مصرف هر کانفیگ    { id: bytes }
 *   vmap   → ایندکس uuid → id
 *   vtraf  → ترافیک ساعتی         { epochHour: bytes }
 *   vtotal → شمارنده‌ی کل بایت‌های عبوری (برای سقف ترافیک کلی)
 *   vonl   → zset آنلاین‌ها        { "configId:ip": lastSeenSec }
 *   vlogs  → لیست لاگ اتصال‌ها
 *   vsec   → لیست رویدادهای امنیتی (سپر)
 *   botv:* → تنظیمات/اعضای ربات
 *   vset   → تنظیمات عمومی key/value
 *   vreq:<day> → شمارنده‌ی درخواست روزانه
 */
import Redis from "ioredis";

const LOG_MAX_ALL = 1000;
const SEC_LOG_MAX = 500;
const ONLINE_TTL_SECONDS = 120;
const ONLINE_ACTIVE_WINDOW = 90;
const CONFIG_CACHE_MS = 5000;

function newId() {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 12);
}

let _redis = null;
function redisClient() {
  if (_redis) return _redis;
  const url = process.env.REDIS_URL;
  if (!url) {
    throw new Error(
      "REDIS_URL تنظیم نشده — در پروژه‌ی Railway یک دیتابیس Redis بساز (New → Database → Redis) و REDIS_URL را با مقدار ${{Redis.REDIS_URL}} تنظیم کن."
    );
  }
  _redis = new Redis(url, {
    maxRetriesPerRequest: 3,
    lazyConnect: false,
    keepAlive: 10000, // جلوی قطع خاموش اتصال توسط پراکسی/NAT
    connectTimeout: 10000,
    retryStrategy: (times) => Math.min(times * 200, 3000),
    reconnectOnError: (err) => /READONLY|ECONNRESET|ETIMEDOUT/.test(err.message),
    // دستورهای هم‌tick به‌طور خودکار در یک رفت‌وبرگشت گروهی ارسال می‌شوند.
    enableAutoPipelining: true,
  });
  _redis.on("error", (e) => console.error("redis error:", e && e.message));
  return _redis;
}

export class VaultStore {
  constructor() {
    this.r = redisClient();
    this._cfgCache = new Map();
  }

  // ---------------------------------------------------------------- configs
  async listConfigs() {
    const all = await this.r.hgetall("vcfg");
    const usage = await this.r.hgetall("vuse");
    const out = Object.entries(all).map(([id, raw]) => {
      const cfg = JSON.parse(raw);
      return { ...cfg, used_bytes: parseFloat(usage[id] || "0") };
    });
    out.sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
    return out;
  }

  async getConfig(id) {
    const raw = await this.r.hget("vcfg", id);
    if (!raw) return null;
    const cfg = JSON.parse(raw);
    const used = parseFloat((await this.r.hget("vuse", id)) || "0");
    return { ...cfg, used_bytes: used };
  }

  async getConfigByUuid(uuid) {
    const cached = this._cfgCache.get(uuid);
    if (cached && Date.now() - cached.ts < CONFIG_CACHE_MS) return cached.value;

    const id = await this.r.hget("vmap", uuid);
    if (id) {
      const cfg = await this.getConfig(id);
      if (cfg && cfg.uuid === uuid) {
        this._cfgCache.set(uuid, { value: cfg, ts: Date.now() });
        return cfg;
      }
    }
    // fallback + خودترمیمی ایندکس (برای داده‌های بازیابی‌شده از بکاپ)
    const all = await this.r.hgetall("vcfg");
    for (const [cid, raw] of Object.entries(all)) {
      const cfg = JSON.parse(raw);
      if (cfg.uuid === uuid) {
        await this.r.hset("vmap", uuid, cid);
        const used = parseFloat((await this.r.hget("vuse", cid)) || "0");
        const full = { ...cfg, used_bytes: used };
        this._cfgCache.set(uuid, { value: full, ts: Date.now() });
        return full;
      }
    }
    return null;
  }

  async saveConfig(config) {
    const pipe = this.r.pipeline();
    pipe.hset("vcfg", config.id, JSON.stringify(config));
    if (config.uuid) {
      pipe.hset("vmap", config.uuid, config.id);
    }
    await pipe.exec();
    if (config.uuid) this._cfgCache.delete(config.uuid);
    return true;
  }

  async deleteConfig(id) {
    const raw = await this.r.hget("vcfg", id);
    const existing = raw ? JSON.parse(raw) : null;
    const used = parseFloat((await this.r.hget("vuse", id)) || "0");
    const pipe = this.r.pipeline();
    pipe.hdel("vcfg", id);
    pipe.hdel("vuse", id);
    if (used > 0) pipe.incrby("vtotal", -Math.floor(used));
    await pipe.exec();
    // فقط ورودی‌های آنلاینِ همین کانفیگ پاک می‌شوند (نه کل مجموعه)
    const members = await this.r.zrange("vonl", 0, -1);
    const toRemove = members.filter((m) => m.startsWith(`${id}:`));
    if (toRemove.length) await this.r.zrem("vonl", ...toRemove);
    if (existing && existing.uuid) {
      await this.r.hdel("vmap", existing.uuid);
      this._cfgCache.delete(existing.uuid);
    }
    return true;
  }

  async resetUsage(id) {
    const used = parseFloat((await this.r.hget("vuse", id)) || "0");
    const pipe = this.r.pipeline();
    pipe.hdel("vuse", id);
    if (used > 0) pipe.incrby("vtotal", -Math.floor(used));
    // ترافیک ساعتیِ همین لحظه هم صفر شود تا نمودار با مصرف ریست‌شده هماهنگ بماند
    pipe.hdel("vtraf", String(Math.floor(Date.now() / 1000 / 3600) * 3600));
    await pipe.exec();
    return true;
  }

  async getUsage(id) {
    return parseFloat((await this.r.hget("vuse", id)) || "0");
  }

  async bumpUsage(id, amount) {
    const pipe = this.r.pipeline();
    pipe.hincrbyfloat("vuse", id, amount);
    if (amount >= 1) pipe.incrby("vtotal", Math.floor(amount));
    const [val] = await pipe.exec();
    return val[1];
  }

  // ---------------------------------------------------------------- traffic
  async recordTrafficBucket(nbytes) {
    const bucket = Math.floor(Date.now() / 1000 / 3600) * 3600;
    const pipe = this.r.pipeline();
    pipe.hincrby("vtraf", String(bucket), nbytes);
    // جلوگیری از رشد بی‌حد هش (فقط ۷۲ ساعت نگه می‌داریم)
    pipe.hdel("vtraf", String(bucket - 72 * 3600));
    await pipe.exec();
    return true;
  }

  async getTrafficSeries(hours = 24) {
    const now = Math.floor(Date.now() / 1000);
    const nowBucket = Math.floor(now / 3600) * 3600;
    const buckets = [];
    for (let i = hours - 1; i >= 0; i--) buckets.push(String(nowBucket - i * 3600));
    // یک HMGET به‌جای N تا HGET جدا
    const vals = buckets.length ? await this.r.hmget("vtraf", ...buckets) : [];
    return buckets.map((bucket, idx) => ({ hour: Number(bucket), bytes: parseInt(vals[idx] || "0", 10) }));
  }

  async getTotalUsedBytes() {
    return parseInt((await this.r.get("vtotal")) || "0", 10);
  }

  // ------------------------------------------------------------------ online
  async markOnline(configId, clientIp) {
    await this.r.zadd("vonl", Date.now() / 1000, `${configId}:${clientIp}`);
    return true;
  }

  async markOffline(configId, clientIp) {
    await this.r.zrem("vonl", `${configId}:${clientIp}`);
    return true;
  }

  async _activeOnlineMembers(configId) {
    const now = Date.now() / 1000;
    await this.r.zremrangebyscore("vonl", "-inf", now - ONLINE_TTL_SECONDS);
    const prefix = `${configId}:`;
    const members = await this.r.zrangebyscore("vonl", now - ONLINE_ACTIVE_WINDOW, "+inf");
    return members.filter((m) => m.startsWith(prefix)).map((m) => m.slice(prefix.length));
  }

  async onlineIpCount(configId) {
    const ips = await this._activeOnlineMembers(configId);
    return new Set(ips).size;
  }

  async onlineIpCountsForAll() {
    const now = Date.now() / 1000;
    await this.r.zremrangebyscore("vonl", "-inf", now - ONLINE_TTL_SECONDS);
    const members = await this.r.zrangebyscore("vonl", now - ONLINE_ACTIVE_WINDOW, "+inf");
    const counts = {};
    const uniq = new Set(); // هر (config,ip) فقط یک‌بار شمرده شود
    for (const m of members) {
      if (uniq.has(m)) continue;
      uniq.add(m);
      const sep = m.indexOf(":");
      if (sep === -1) continue;
      const configId = m.slice(0, sep);
      counts[configId] = (counts[configId] || 0) + 1;
    }
    return counts;
  }

  async isIpWithinLimit(config, clientIp) {
    const limit = config.ip_limit || 0;
    if (!limit) return true;
    const ips = await this._activeOnlineMembers(config.id);
    const set = new Set(ips);
    return set.has(clientIp) || set.size < limit;
  }

  // -------------------------------------------------------------------- logs
  // یک لیست کلی نگه می‌داریم و نمای «لاگ یک کانفیگ خاص» را موقع خواندن
  // فیلتر می‌کنیم (خواندن خیلی کمتر از نوشتن است).
  async logConnection(configId, configName, clientIp, address, port, nbytes) {
    const entry = {
      config_id: configId,
      config_name: configName,
      ip: clientIp,
      address,
      port,
      bytes: nbytes,
      ts: Date.now() / 1000,
    };
    const pipe = this.r.pipeline();
    pipe.lpush("vlogs", JSON.stringify(entry));
    pipe.ltrim("vlogs", 0, LOG_MAX_ALL - 1);
    await pipe.exec();
    return true;
  }

  async getLogs(configId, limit = 100) {
    if (!configId) {
      const raw = await this.r.lrange("vlogs", 0, limit - 1);
      return raw.map((s) => JSON.parse(s));
    }
    const raw = await this.r.lrange("vlogs", 0, LOG_MAX_ALL - 1);
    const out = [];
    for (const s of raw) {
      const entry = JSON.parse(s);
      if (entry.config_id === configId) {
        out.push(entry);
        if (out.length >= limit) break;
      }
    }
    return out;
  }

  // -------------------------------------------------------- security events
  async logSecurityEvent(kind, ip, detail) {
    const entry = { kind, ip, detail: String(detail || "").slice(0, 300), ts: Date.now() / 1000 };
    const pipe = this.r.pipeline();
    pipe.lpush("vsec", JSON.stringify(entry));
    pipe.ltrim("vsec", 0, SEC_LOG_MAX - 1);
    await pipe.exec();
    return true;
  }

  async getSecurityEvents(limit = 100) {
    const raw = await this.r.lrange("vsec", 0, Math.min(limit, SEC_LOG_MAX) - 1);
    return raw.map((s) => JSON.parse(s));
  }

  // --------------------------------------------------------------- bot config
  async getBotSettings() {
    const [token, enabled, secret] = await this.r.hmget("botv:settings", "token", "enabled", "secret");
    return { token: token || "", enabled: enabled === "1", secret: secret || "" };
  }

  async saveBotSettings(token, enabled, secret) {
    const fields = ["token", token || ""];
    if (secret) fields.push("secret", secret);
    fields.push("enabled", enabled ? "1" : "0");
    await this.r.hmset("botv:settings", ...fields);
    return true;
  }

  async listBotAdmins() {
    const all = await this.r.hgetall("botv:admins");
    const admins = Object.values(all).map((v) => JSON.parse(v));
    admins.sort((a, b) => (a.added_at || 0) - (b.added_at || 0));
    return admins;
  }

  async isBotAdmin(tgId) {
    return !!(await this.r.hexists("botv:admins", String(tgId)));
  }

  async addBotAdmin(tgId, addedBy = "") {
    await this.r.hset(
      "botv:admins",
      String(tgId),
      JSON.stringify({ id: String(tgId), added_at: Date.now() / 1000, added_by: addedBy })
    );
    return true;
  }

  async removeBotAdmin(tgId) {
    await this.r.hdel("botv:admins", String(tgId));
    return true;
  }

  async upsertBotMember(tgId, username, firstName) {
    const now = Date.now() / 1000;
    const key = String(tgId);
    const existingRaw = await this.r.hget("botv:members", key);
    const existing = existingRaw ? JSON.parse(existingRaw) : null;
    const data = existing
      ? { ...existing, username, first_name: firstName, last_seen: now }
      : { id: key, username, first_name: firstName, joined_at: now, last_seen: now };
    await this.r.hset("botv:members", key, JSON.stringify(data));
    return true;
  }

  async listBotMembers() {
    const all = await this.r.hgetall("botv:members");
    const members = Object.values(all).map((v) => JSON.parse(v));
    members.sort((a, b) => (b.last_seen || 0) - (a.last_seen || 0));
    return members;
  }

  async removeBotMember(tgId) {
    await this.r.hdel("botv:members", String(tgId));
    return true;
  }

  async setBotPending(tgId, data) {
    await this.r.hset("botv:pending", String(tgId), JSON.stringify(data));
    return true;
  }

  async getBotPending(tgId) {
    const raw = await this.r.hget("botv:pending", String(tgId));
    return raw ? JSON.parse(raw) : null;
  }

  async clearBotPending(tgId) {
    await this.r.hdel("botv:pending", String(tgId));
    return true;
  }

  // ------------------------------------------------- settings (generic kv)
  async getSetting(key) {
    const v = await this.r.hget("vset", key);
    return v === null || v === undefined ? null : v;
  }

  async setSetting(key, value) {
    await this.r.hset("vset", key, value);
    return true;
  }

  // ------------------------------------------------------------ request counter
  _utcDay() {
    return new Date().toISOString().slice(0, 10);
  }

  async bumpRequestCounter() {
    const day = this._utcDay();
    const key = `vreq:${day}`;
    const pipe = this.r.pipeline();
    pipe.incr(key);
    pipe.expire(key, 3 * 86400); // بعد از ۳ روز خودش پاک شود
    const [val] = await pipe.exec();
    return val[1];
  }

  async getRequestCounter() {
    return parseInt((await this.r.get(`vreq:${this._utcDay()}`)) || "0", 10);
  }

  async getRequestCounterHistory(days = 7) {
    const now = new Date();
    const dayKeys = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 86400000).toISOString().slice(0, 10);
      dayKeys.push(d);
    }
    const keys = dayKeys.map((d) => `vreq:${d}`);
    const vals = keys.length ? await this.r.mget(...keys) : [];
    return dayKeys.map((day, idx) => ({ day, count: parseInt(vals[idx] || "0", 10) }));
  }

  // ------------------------------------------------------------------ misc
  async newId() {
    return newId();
  }

  async healthBackend() {
    return "redis";
  }

  // --------------------------------------------------------- backup/restore
  async exportAll() {
    const configsRaw = await this.r.hgetall("vcfg");
    const configs = Object.fromEntries(Object.entries(configsRaw).map(([k, v]) => [k, JSON.parse(v)]));
    const usageRaw = await this.r.hgetall("vuse");
    const usage = Object.fromEntries(Object.entries(usageRaw).map(([k, v]) => [k, parseFloat(v)]));
    const trafficRaw = await this.r.hgetall("vtraf");
    const trafficHourly = Object.fromEntries(Object.entries(trafficRaw).map(([k, v]) => [k, parseInt(v, 10)]));
    const botSettings = await this.getBotSettings();
    const adminsRaw = await this.r.hgetall("botv:admins");
    const botAdmins = Object.fromEntries(Object.entries(adminsRaw).map(([k, v]) => [k, JSON.parse(v)]));
    const membersRaw = await this.r.hgetall("botv:members");
    const botMembers = Object.fromEntries(Object.entries(membersRaw).map(([k, v]) => [k, JSON.parse(v)]));
    const logsAll = (await this.r.lrange("vlogs", 0, LOG_MAX_ALL - 1)).map((s) => JSON.parse(s));

    return {
      version: 2,
      app: "vanta-core",
      exported_at: Date.now() / 1000,
      configs,
      usage,
      traffic_hourly: trafficHourly,
      bot_settings: botSettings,
      bot_admins: botAdmins,
      bot_members: botMembers,
      logs_all: logsAll,
    };
  }

  async importAll(data, mode = "replace") {
    if (!data || typeof data !== "object" || !("configs" in data)) {
      throw new Error("فایل بکاپ معتبر نیست");
    }

    if (mode === "replace") {
      await this.r.del("vcfg", "vuse", "vmap", "vtraf", "vtotal", "botv:admins", "botv:members", "vlogs", "vonl");
      this._cfgCache.clear();
    }

    const counters = { configs: 0, admins: 0, members: 0 };

    for (const [configId, cfg] of Object.entries(data.configs || {})) {
      await this.r.hset("vcfg", configId, JSON.stringify(cfg));
      if (cfg && cfg.uuid) await this.r.hset("vmap", cfg.uuid, configId);
      counters.configs++;
    }
    let totalImported = 0;
    for (const [configId, used] of Object.entries(data.usage || {})) {
      await this.r.hset("vuse", configId, String(used));
      totalImported += parseFloat(used) || 0;
    }
    if (totalImported > 0) await this.r.incrby("vtotal", Math.floor(totalImported));
    for (const [bucket, val] of Object.entries(data.traffic_hourly || {})) {
      await this.r.hset("vtraf", bucket, String(val));
    }

    const botSettings = data.bot_settings || {};
    if (botSettings.token) {
      await this.saveBotSettings(botSettings.token || "", !!botSettings.enabled, botSettings.secret || "");
    }

    for (const [tgId, admin] of Object.entries(data.bot_admins || {})) {
      await this.r.hset("botv:admins", tgId, JSON.stringify(admin));
      counters.admins++;
    }
    for (const [tgId, member] of Object.entries(data.bot_members || {})) {
      await this.r.hset("botv:members", tgId, JSON.stringify(member));
      counters.members++;
    }

    // بکاپ‌های نسخه‌ی قبلی (logs_per_config) هم با لیست کلی ادغام می‌شوند.
    const allLogEntries = [...(data.logs_all || [])];
    for (const entries of Object.values(data.logs_per_config || {})) {
      if (Array.isArray(entries)) allLogEntries.push(...entries);
    }
    if (allLogEntries.length) {
      const pipe = this.r.pipeline();
      for (const entry of allLogEntries) pipe.rpush("vlogs", JSON.stringify(entry));
      pipe.ltrim("vlogs", 0, LOG_MAX_ALL - 1);
      await pipe.exec();
    }

    return counters;
  }
}

/** singleton سراسری */
let _store = null;
export function getStore() {
  if (!_store) _store = new VaultStore();
  return _store;
}
