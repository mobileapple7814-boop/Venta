/**
 * test/fake-redis.mjs — پیاده‌سازی تستی رابط‌های Redis که store استفاده می‌کند
 *
 * فقط همان دستورهایی که VaultStore صدا می‌زند پیاده شده‌اند؛ برای تست
 * بدون سرور Redis واقعی.
 */
export class FakeRedis {
  constructor() {
    this.data = new Map(); // key -> value (string) یا Map برای هش‌ها / آرایه برای لیست‌ها / Map برای zset
  }

  _hash(key) {
    if (!this.data.has(key)) this.data.set(key, new Map());
    return this.data.get(key);
  }
  _list(key) {
    if (!this.data.has(key)) this.data.set(key, []);
    return this.data.get(key);
  }
  _zset(key) {
    if (!this.data.has(key)) this.data.set(key, new Map());
    return this.data.get(key);
  }

  async hgetall(key) {
    const h = this.data.get(key);
    if (!(h instanceof Map)) return {};
    return Object.fromEntries(h.entries());
  }
  async hget(key, field) {
    const h = this.data.get(key);
    return h instanceof Map && h.has(field) ? h.get(field) : null;
  }
  async hset(key, ...args) {
    const h = this._hash(key);
    for (let i = 0; i < args.length; i += 2) h.set(args[i], String(args[i + 1]));
    return "OK";
  }
  async hmset(key, ...args) {
    return this.hset(key, ...args);
  }
  async hmget(key, ...fields) {
    const h = this.data.get(key);
    return fields.map((f) => (h instanceof Map && h.has(f) ? h.get(f) : null));
  }
  async hdel(key, ...fields) {
    const h = this.data.get(key);
    if (!(h instanceof Map)) return 0;
    let n = 0;
    for (const f of fields) if (h.delete(f)) n++;
    return n;
  }
  async hexists(key, field) {
    const h = this.data.get(key);
    return h instanceof Map && h.has(field) ? 1 : 0;
  }
  async hincrbyfloat(key, field, amount) {
    const h = this._hash(key);
    const cur = parseFloat(h.get(field) || "0");
    const v = cur + amount;
    h.set(field, String(v));
    return String(v);
  }
  async hincrby(key, field, amount) {
    const h = this._hash(key);
    const cur = parseInt(h.get(field) || "0", 10);
    const v = cur + amount;
    h.set(field, String(v));
    return v;
  }
  async incr(key) {
    const cur = parseInt(this.data.get(key) || "0", 10);
    const v = cur + 1;
    this.data.set(key, String(v));
    return v;
  }
  async incrby(key, amount) {
    const cur = parseInt(this.data.get(key) || "0", 10);
    const v = cur + amount;
    this.data.set(key, String(v));
    return v;
  }
  async get(key) {
    const v = this.data.get(key);
    return typeof v === "string" ? v : null;
  }
  async set(key, value) {
    this.data.set(key, String(value));
    return "OK";
  }
  async del(...keys) {
    let n = 0;
    for (const k of keys) if (this.data.delete(k)) n++;
    return n;
  }
  async expire(key, _sec) {
    return this.data.has(key) ? 1 : 0;
  }
  async mget(...keys) {
    return keys.map((k) => {
      const v = this.data.get(k);
      return typeof v === "string" ? v : null;
    });
  }
  async lpush(key, value) {
    this._list(key).unshift(String(value));
    return this.data.get(key).length;
  }
  async rpush(key, value) {
    this._list(key).push(String(value));
    return this.data.get(key).length;
  }
  async ltrim(key, start, end) {
    const l = this._list(key);
    if (start === 0 && end >= 0) {
      this.data.set(key, l.slice(0, end + 1));
    }
    return "OK";
  }
  async lrange(key, start, end) {
    const l = this._list(key);
    if (start < 0) start = l.length + start;
    if (end < 0) end = l.length + end;
    return l.slice(start, end + 1);
  }
  async zadd(key, score, member) {
    this._zset(key).set(member, score);
    return 1;
  }
  async zrem(key, ...members) {
    const z = this.data.get(key);
    let n = 0;
    if (z instanceof Map) for (const m of members) if (z.delete(m)) n++;
    return n;
  }
  async zrange(key, start, end) {
    const z = this.data.get(key);
    if (!(z instanceof Map)) return [];
    return [...z.keys()].slice(start, end < 0 ? undefined : end + 1);
  }
  async zremrangebyscore(key, min, max) {
    const z = this.data.get(key);
    if (!(z instanceof Map)) return 0;
    let n = 0;
    for (const [m, s] of z) {
      if (s >= min && s <= max) {
        z.delete(m);
        n++;
      }
    }
    return n;
  }
  async zrangebyscore(key, min, max) {
    const z = this.data.get(key);
    if (!(z instanceof Map)) return [];
    const out = [];
    for (const [m, s] of z) {
      if (s >= min && s <= max) out.push(m);
    }
    return out;
  }

  // pipeline: دستورات را به‌ترتیب و بی‌درنگ اجرا می‌کند؛ نتیجه مثل ioredis
  // به‌صورت [[null, result], ...]
  pipeline() {
    const self = this;
    const calls = [];
    const proxy = new Proxy(
      {},
      {
        get(_t, prop) {
          if (prop === "exec") {
            return async () => {
              const out = [];
              for (const [cmd, args] of calls) {
                const r = await self[cmd](...args);
                out.push([null, r]);
              }
              return out;
            };
          }
          return (...args) => {
            calls.push([prop, args]);
            return proxy;
          };
        },
      }
    );
    return proxy;
  }

  on() {}
}
