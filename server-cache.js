import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import tls from 'node:tls';
import zlib from 'node:zlib';
import crypto from 'node:crypto';

/**
 * Alpha Mate Production Backend Performance Layer:
 * 1. Shared Keep-Alive HTTP/HTTPS Agents for upstream connection reuse.
 * 2. Native Node zlib Brotli + Gzip HTTP response compression middleware.
 * 3. Bounded In-Memory LRU Cache + Optional Zero-Dependency Redis Client (REDIS_URL).
 * 4. Singleflight concurrent request coalescing (prevents thundering herd on hot endpoints).
 * 5. Lightweight ETag / 304 helper & telemetry metrics for /api/health.
 */

export const sharedHttpAgent = new http.Agent({
  keepAlive: true,
  keepAliveMsecs: 30_000,
  maxSockets: 128,
  maxFreeSockets: 32,
  timeout: 60_000,
});

export const sharedHttpsAgent = new https.Agent({
  keepAlive: true,
  keepAliveMsecs: 30_000,
  maxSockets: 128,
  maxFreeSockets: 32,
  timeout: 60_000,
});

// =========================================================================
// BOUNDED LRU CACHE + OPTIONAL REDIS (REDIS_URL)
// =========================================================================
class LightweightRedisBridge {
  constructor(redisUrl) {
    this.redisUrl = redisUrl;
    this.connected = false;
    this.socket = null;
    this.buffer = '';
    this.pending = [];
    this.reconnectTimer = null;
    this.parsed = null;
    try {
      this.parsed = new URL(redisUrl);
    } catch {
      this.parsed = null;
    }
    if (this.parsed) {
      this.connect();
    }
  }

  connect() {
    if (!this.parsed || this.socket) return;
    const isTls = this.parsed.protocol === 'rediss:';
    const host = this.parsed.hostname || '127.0.0.1';
    const port = Number(this.parsed.port || 6379);
    const password = this.parsed.password ? decodeURIComponent(this.parsed.password) : '';
    const username = this.parsed.username ? decodeURIComponent(this.parsed.username) : '';

    const onConnect = () => {
      this.connected = true;
      if (password) {
        const authArgs = username && username !== 'default' ? ['AUTH', username, password] : ['AUTH', password];
        this.sendCommand(authArgs).catch(() => {});
      }
    };

    try {
      const sock = isTls
        ? tls.connect({ host, port, servername: host }, onConnect)
        : net.createConnection({ host, port }, onConnect);
      sock.setKeepAlive(true, 30_000);
      sock.setNoDelay(true);
      sock.on('data', (chunk) => this.onData(chunk.toString('utf8')));
      sock.on('error', () => this.handleDisconnect());
      sock.on('close', () => this.handleDisconnect());
      this.socket = sock;
    } catch {
      this.handleDisconnect();
    }
  }

  handleDisconnect() {
    this.connected = false;
    if (this.socket) {
      try {
        this.socket.destroy();
      } catch {
        // ignore
      }
      this.socket = null;
    }
    while (this.pending.length > 0) {
      const item = this.pending.shift();
      clearTimeout(item.timer);
      item.resolve(null);
    }
    if (!this.reconnectTimer && this.parsed) {
      this.reconnectTimer = setTimeout(() => {
        this.reconnectTimer = null;
        this.connect();
      }, 15_000);
      this.reconnectTimer.unref?.();
    }
  }

  encodeCommand(args) {
    let out = `*${args.length}\r\n`;
    for (const arg of args) {
      const str = String(arg);
      out += `$${Buffer.byteLength(str, 'utf8')}\r\n${str}\r\n`;
    }
    return out;
  }

  onData(chunk) {
    this.buffer += chunk;
    while (this.buffer.length > 0 && this.pending.length > 0) {
      const parsed = this.tryParseResp(this.buffer);
      if (!parsed) break;
      this.buffer = this.buffer.slice(parsed.consumed);
      const item = this.pending.shift();
      clearTimeout(item.timer);
      item.resolve(parsed.value);
    }
  }

  tryParseResp(buf) {
    const first = buf[0];
    const lineEnd = buf.indexOf('\r\n');
    if (lineEnd === -1) return null;

    if (first === '+' || first === '-' || first === ':') {
      const val = buf.slice(1, lineEnd);
      return {
        value: first === '-' ? null : first === ':' ? Number(val) : val,
        consumed: lineEnd + 2,
      };
    }
    if (first === '$') {
      const len = Number(buf.slice(1, lineEnd));
      if (len < 0) return { value: null, consumed: lineEnd + 2 };
      const bodyStart = lineEnd + 2;
      const bodyEnd = bodyStart + len;
      if (buf.length < bodyEnd + 2) return null;
      return {
        value: buf.slice(bodyStart, bodyEnd),
        consumed: bodyEnd + 2,
      };
    }
    return { value: null, consumed: lineEnd + 2 };
  }

  sendCommand(args, timeoutMs = 450) {
    if (!this.connected || !this.socket) return Promise.resolve(null);
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        const idx = this.pending.findIndex((p) => p.resolve === resolve);
        if (idx !== -1) this.pending.splice(idx, 1);
        resolve(null);
      }, timeoutMs);
      this.pending.push({ resolve, timer });
      try {
        this.socket.write(this.encodeCommand(args));
      } catch {
        clearTimeout(timer);
        this.pending.pop();
        resolve(null);
      }
    });
  }

  async getJson(key) {
    const raw = await this.sendCommand(['GET', key]);
    if (typeof raw !== 'string') return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  async setJson(key, value, ttlMs) {
    const sec = Math.max(1, Math.ceil(ttlMs / 1000));
    await this.sendCommand(['SET', key, JSON.stringify(value), 'EX', String(sec)]);
  }
}

export class HybridServerCache {
  constructor(options = {}) {
    this.maxEntries = Math.max(50, Number(options.maxEntries || 800));
    this.prefix = String(options.prefix || 'alphamate:v1:');
    this.memory = new Map(); // key -> { value, expiresAt }
    this.inflight = new Map(); // key -> Promise
    this.stats = {
      hits: 0,
      misses: 0,
      coalesced: 0,
      redisHits: 0,
      sets: 0,
    };
    const redisUrl = (options.redisUrl ?? process.env.REDIS_URL ?? '').trim();
    this.redis = redisUrl ? new LightweightRedisBridge(redisUrl) : null;
  }

  getSync(key) {
    const entry = this.memory.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.memory.delete(key);
      return undefined;
    }
    // LRU touch
    this.memory.delete(key);
    this.memory.set(key, entry);
    this.stats.hits += 1;
    return entry.value;
  }

  setSync(key, value, ttlMs = 60_000) {
    if (this.memory.size >= this.maxEntries && !this.memory.has(key)) {
      const oldestKey = this.memory.keys().next().value;
      if (oldestKey !== undefined) this.memory.delete(oldestKey);
    }
    this.memory.set(key, { value, expiresAt: Date.now() + ttlMs });
    this.stats.sets += 1;
    if (this.redis?.connected) {
      void this.redis.setJson(`${this.prefix}${key}`, value, ttlMs);
    }
  }

  async get(key) {
    const local = this.getSync(key);
    if (local !== undefined) return local;
    if (this.redis?.connected) {
      const remote = await this.redis.getJson(`${this.prefix}${key}`);
      if (remote !== null) {
        this.stats.hits += 1;
        this.stats.redisHits += 1;
        this.setSync(key, remote, 30_000);
        return remote;
      }
    }
    this.stats.misses += 1;
    return undefined;
  }

  /**
   * Singleflight cache-aside helper: coalesces concurrent identical requests
   * into a single upstream/database execution.
   */
  async getOrSet(key, ttlMs, loader) {
    const cached = await this.get(key);
    if (cached !== undefined) {
      return { value: cached, cached: true };
    }

    const existing = this.inflight.get(key);
    if (existing) {
      this.stats.coalesced += 1;
      const value = await existing;
      return { value, cached: true };
    }

    const promise = Promise.resolve()
      .then(() => loader())
      .then((value) => {
        if (value !== undefined && value !== null) {
          this.setSync(key, value, ttlMs);
        }
        return value;
      })
      .finally(() => {
        this.inflight.delete(key);
      });

    this.inflight.set(key, promise);
    const value = await promise;
    return { value, cached: false };
  }

  delete(key) {
    this.memory.delete(key);
  }

  getMetrics() {
    const total = this.stats.hits + this.stats.misses;
    return {
      backend: this.redis?.connected ? 'redis+memory-lru' : 'memory-lru',
      entries: this.memory.size,
      maxEntries: this.maxEntries,
      hits: this.stats.hits,
      misses: this.stats.misses,
      coalesced: this.stats.coalesced,
      redisHits: this.stats.redisHits,
      hitRate: total > 0 ? Math.round((this.stats.hits / total) * 1000) / 10 : 0,
    };
  }
}

export const serverCache = new HybridServerCache({
  maxEntries: 1000,
  prefix: 'alphamate:api:',
});

// =========================================================================
// ETAG / CONDITIONAL 304 HELPER
// =========================================================================
export function sendCachedJson(req, res, payload, options = {}) {
  const maxAge = Number(options.maxAgeSeconds ?? 60);
  const swr = Number(options.staleWhileRevalidateSeconds ?? Math.max(maxAge * 2, 120));
  const isPrivate = Boolean(options.isPrivate);
  const body = JSON.stringify(payload);
  const etag = `W/"${crypto.createHash('sha1').update(body).digest('base64url').slice(0, 18)}"`;

  res.setHeader(
    'Cache-Control',
    `${isPrivate ? 'private' : 'public'}, max-age=${maxAge}, stale-while-revalidate=${swr}`
  );
  res.setHeader('ETag', etag);

  const inm = String(req.headers['if-none-match'] || '').trim();
  if (inm && (inm === etag || inm === '*')) {
    return res.status(304).end();
  }

  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  return res.status(options.status || 200).send(body);
}

// =========================================================================
// NATIVE ZLIB BROTLI + GZIP RESPONSE COMPRESSION MIDDLEWARE
// =========================================================================
const COMPRESSIBLE_CONTENT_TYPE_RE =
  /^(?:text\/|application\/(?:json|javascript|ecmascript|xml|xhtml\+xml|manifest\+json|wasm|x-javascript)|image\/svg\+xml)/i;

const ALREADY_COMPRESSED_PATH_RE =
  /\.(?:png|jpe?g|webp|avif|gif|ico|woff2?|mp4|webm|mov|mp3|m4a|aac|ogg|opus|svga|zip|gz|br)$/i;

export function createCompressionMiddleware(options = {}) {
  const threshold = Number(options.threshold ?? 1024);

  return function compressionMiddleware(req, res, next) {
    if (req.method === 'HEAD' || req.method === 'OPTIONS') return next();
    if (ALREADY_COMPRESSED_PATH_RE.test(req.path || '')) return next();
    // Never buffer/compress live audio proxy streams
    if (
      req.path?.startsWith('/api/music/audius/') ||
      req.path?.startsWith('/api/music/deezer/') ||
      req.path === '/api/music/proxy'
    ) {
      return next();
    }

    const acceptEncoding = String(req.headers['accept-encoding'] || '').toLowerCase();
    const supportsBr = acceptEncoding.includes('br');
    const supportsGzip = acceptEncoding.includes('gzip');
    if (!supportsBr && !supportsGzip) return next();

    const originalEnd = res.end.bind(res);
    const originalWrite = res.write.bind(res);
    const chunks = [];
    let totalBytes = 0;
    let passthrough = false;

    const shouldBypass = () => {
      if (res.getHeader('Content-Encoding')) return true;
      const ct = String(res.getHeader('Content-Type') || '').split(';')[0].trim();
      if (ct && !COMPRESSIBLE_CONTENT_TYPE_RE.test(ct)) return true;
      if (res.statusCode === 204 || res.statusCode === 304) return true;
      return false;
    };

    const flushPassthrough = () => {
      passthrough = true;
      for (const c of chunks) {
        originalWrite(c);
      }
      chunks.length = 0;
    };

    res.write = function patchedWrite(chunk, encoding, cb) {
      if (passthrough) return originalWrite(chunk, encoding, cb);
      if (shouldBypass()) {
        flushPassthrough();
        return originalWrite(chunk, encoding, cb);
      }
      if (chunk !== undefined && chunk !== null) {
        const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, typeof encoding === 'string' ? encoding : 'utf8');
        totalBytes += buf.length;
        // Avoid buffering very large streams (> 6 MB) in memory
        if (totalBytes > 6 * 1024 * 1024) {
          flushPassthrough();
          return originalWrite(buf, cb);
        }
        chunks.push(buf);
      }
      if (typeof encoding === 'function') encoding();
      else if (typeof cb === 'function') cb();
      return true;
    };

    res.end = function patchedEnd(chunk, encoding, cb) {
      if (typeof chunk === 'function') {
        cb = chunk;
        chunk = undefined;
        encoding = undefined;
      } else if (typeof encoding === 'function') {
        cb = encoding;
        encoding = undefined;
      }

      if (passthrough) {
        return originalEnd(chunk, encoding, cb);
      }

      if (chunk !== undefined && chunk !== null) {
        const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, typeof encoding === 'string' ? encoding : 'utf8');
        totalBytes += buf.length;
        chunks.push(buf);
      }

      if (totalBytes < threshold || shouldBypass()) {
        const raw = chunks.length === 1 ? chunks[0] : chunks.length > 1 ? Buffer.concat(chunks) : undefined;
        return originalEnd(raw, cb);
      }

      const raw = chunks.length === 1 ? chunks[0] : Buffer.concat(chunks);
      const vary = String(res.getHeader('Vary') || '');
      if (!vary.toLowerCase().includes('accept-encoding')) {
        res.setHeader('Vary', vary ? `${vary}, Accept-Encoding` : 'Accept-Encoding');
      }

      const finishCompressed = (err, compressed, encName) => {
        if (err || !compressed || compressed.length >= raw.length) {
          return originalEnd(raw, cb);
        }
        res.removeHeader('Content-Length');
        res.setHeader('Content-Encoding', encName);
        res.setHeader('Content-Length', String(compressed.length));
        return originalEnd(compressed, cb);
      };

      if (supportsBr) {
        zlib.brotliCompress(
          raw,
          {
            params: {
              [zlib.constants.BROTLI_PARAM_QUALITY]: 4, // Fast real-time compression (~5x faster than q11, ~95% of ratio)
            },
          },
          (err, out) => finishCompressed(err, out, 'br')
        );
      } else {
        zlib.gzip(raw, { level: 6 }, (err, out) => finishCompressed(err, out, 'gzip'));
      }
      return res;
    };

    next();
  };
}

/**
 * Lightweight response latency header (Server-Timing) & API metrics collector.
 */
const apiLatencyStats = {
  totalRequests: 0,
  slowRequests: 0,
  avgMs: 0,
  maxMs: 0,
};

export function createPerformanceMetricsMiddleware() {
  return function performanceMetricsMiddleware(req, res, next) {
    const start = process.hrtime.bigint();
    const originalWriteHead = res.writeHead.bind(res);
    res.writeHead = function patchedWriteHead(...args) {
      const elapsedMs = Number(process.hrtime.bigint() - start) / 1_000_000;
      const rounded = Math.round(elapsedMs * 10) / 10;
      if (!res.headersSent) {
        try {
          res.setHeader('Server-Timing', `app;dur=${rounded}`);
        } catch {
          // ignore
        }
      }
      if (req.path?.startsWith('/api/')) {
        apiLatencyStats.totalRequests += 1;
        apiLatencyStats.avgMs =
          apiLatencyStats.totalRequests === 1
            ? rounded
            : Math.round((apiLatencyStats.avgMs * 0.92 + rounded * 0.08) * 10) / 10;
        if (rounded > apiLatencyStats.maxMs) apiLatencyStats.maxMs = rounded;
        if (rounded > 800) apiLatencyStats.slowRequests += 1;
      }
      return originalWriteHead(...args);
    };
    next();
  };
}

export function getBackendPerformanceSnapshot() {
  const mem = process.memoryUsage();
  return {
    cache: serverCache.getMetrics(),
    apiLatency: { ...apiLatencyStats },
    memoryMb: {
      rss: Math.round((mem.rss / (1024 * 1024)) * 10) / 10,
      heapUsed: Math.round((mem.heapUsed / (1024 * 1024)) * 10) / 10,
      heapTotal: Math.round((mem.heapTotal / (1024 * 1024)) * 10) / 10,
    },
    uptimeSec: Math.round(process.uptime()),
  };
}
