import { smartNetworkService } from './smartNetworkService';

/**
 * Alpha Mate Unified Network & HTTP Optimization Client:
 * - In-flight GET request deduplication (singleflight Promise coalescing).
 * - Bounded in-memory TTL + optional localStorage stale-while-revalidate response cache.
 * - Request timeouts via AbortController + exponential backoff retry on transient failures.
 * - Feeds measured RTT & payload sizes directly into SmartNetworkService.
 * - Exposes live cache hit-rate & request savings metrics for performance telemetry.
 */

export interface SmartFetchJsonOptions extends RequestInit {
  /** Cache TTL in ms (GET requests only; 0 disables caching) */
  cacheTtlMs?: number;
  /** Persist response to localStorage for offline fallback (GET requests only) */
  persistOfflineKey?: string;
  /** Request timeout in ms (default 8000ms) */
  timeoutMs?: number;
  /** Number of retries for transient 5xx/429/network errors (default 1 for GET, 0 for POST/PUT/DELETE) */
  retries?: number;
  /** Skip in-flight deduplication when explicitly needed */
  skipDedupe?: boolean;
}

interface MemoryCacheEntry {
  data: any;
  expiresAt: number;
  storedAt: number;
}

const MAX_MEMORY_ENTRIES = 200;
const memoryCache = new Map<string, MemoryCacheEntry>();
const inflightGetRequests = new Map<string, Promise<any>>();

const metrics = {
  totalCalls: 0,
  networkRequests: 0,
  cacheHits: 0,
  dedupedHits: 0,
  offlineFallbacks: 0,
  retries: 0,
  failures: 0,
};

function readPersistedCache(storageKey: string): any | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(`am_http_${storageKey}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.data ?? null;
  } catch {
    return null;
  }
}

function writePersistedCache(storageKey: string, data: any): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(
      `am_http_${storageKey}`,
      JSON.stringify({ storedAt: Date.now(), data })
    );
  } catch {
    // Ignore storage quota overflow gracefully
  }
}

function setMemoryCache(key: string, data: any, ttlMs: number): void {
  if (ttlMs <= 0) return;
  if (memoryCache.size >= MAX_MEMORY_ENTRIES && !memoryCache.has(key)) {
    const oldest = memoryCache.keys().next().value;
    if (oldest !== undefined) memoryCache.delete(oldest);
  }
  const now = Date.now();
  memoryCache.set(key, { data, expiresAt: now + ttlMs, storedAt: now });
}

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 429 || status === 502 || status === 503 || status === 504 || (status >= 520 && status <= 526);
}

export async function smartFetchJson<T = any>(
  url: string,
  options: SmartFetchJsonOptions = {}
): Promise<T> {
  const method = String(options.method || 'GET').toUpperCase();
  const isGet = method === 'GET';
  const cacheTtlMs = isGet ? Math.max(0, Number(options.cacheTtlMs ?? 0)) : 0;
  const timeoutMs = Math.max(1500, Number(options.timeoutMs ?? 8000));
  const maxRetries = Math.max(0, Number(options.retries ?? (isGet ? 1 : 0)));
  const cacheKey = `${method}:${url}`;

  metrics.totalCalls += 1;

  // 1. Fresh in-memory cache fast-path
  if (isGet && cacheTtlMs > 0) {
    const cached = memoryCache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) {
      metrics.cacheHits += 1;
      return cached.data as T;
    }
  }

  // 2. Offline fast-path: return persisted/stale cached data immediately without stalling
  if (isGet && smartNetworkService.getTier() === 'offline') {
    const staleMem = memoryCache.get(cacheKey)?.data;
    if (staleMem !== undefined) {
      metrics.offlineFallbacks += 1;
      metrics.cacheHits += 1;
      return staleMem as T;
    }
    if (options.persistOfflineKey) {
      const persisted = readPersistedCache(options.persistOfflineKey);
      if (persisted !== null) {
        metrics.offlineFallbacks += 1;
        metrics.cacheHits += 1;
        return persisted as T;
      }
    }
  }

  // 3. In-flight GET request deduplication (singleflight)
  if (isGet && !options.skipDedupe) {
    const inflight = inflightGetRequests.get(cacheKey);
    if (inflight) {
      metrics.dedupedHits += 1;
      return inflight as Promise<T>;
    }
  }

  const execute = async (): Promise<T> => {
    let lastError: any = null;

    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      if (attempt > 0) {
        metrics.retries += 1;
        const backoffMs = Math.min(2400, 350 * Math.pow(2, attempt - 1) + Math.floor(Math.random() * 150));
        await new Promise((r) => setTimeout(r, backoffMs));
      }

      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
      const startedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();

      try {
        metrics.networkRequests += 1;
        const {
          cacheTtlMs: _ttl,
          persistOfflineKey: _pk,
          timeoutMs: _to,
          retries: _rt,
          skipDedupe: _sd,
          ...fetchInit
        } = options;

        const response = await fetch(url, {
          ...fetchInit,
          method,
          headers: {
            Accept: 'application/json',
            ...(fetchInit.headers || {}),
          },
          signal: controller?.signal ?? fetchInit.signal,
        });

        const rawText = await response.text();
        const elapsedMs = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - startedAt;

        if (!response.ok) {
          if (isRetryableStatus(response.status) && attempt < maxRetries) {
            lastError = new Error(`HTTP ${response.status}`);
            continue;
          }
          smartNetworkService.reportMeasuredTransfer({ durationMs: elapsedMs, failed: response.status >= 500 });
          const err: any = new Error(`HTTP ${response.status}`);
          err.status = response.status;
          err.body = rawText;
          throw err;
        }

        smartNetworkService.reportMeasuredTransfer({
          durationMs: elapsedMs,
          bytes: rawText.length,
          failed: false,
        });

        const parsed = rawText ? JSON.parse(rawText) : {};
        if (isGet && cacheTtlMs > 0) {
          setMemoryCache(cacheKey, parsed, cacheTtlMs);
        }
        if (isGet && options.persistOfflineKey) {
          writePersistedCache(options.persistOfflineKey, parsed);
        }
        return parsed as T;
      } catch (err: any) {
        lastError = err;
        const elapsedMs = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - startedAt;
        smartNetworkService.reportMeasuredTransfer({ durationMs: elapsedMs, failed: true });
        const isTransient = err?.name === 'AbortError' || err instanceof TypeError || isRetryableStatus(Number(err?.status));
        if (!isTransient || attempt >= maxRetries) {
          break;
        }
      } finally {
        if (timer) clearTimeout(timer);
      }
    }

    // Fallback to stale/persisted cache on transient network failure for GET requests
    if (isGet) {
      const stale = memoryCache.get(cacheKey)?.data;
      if (stale !== undefined) {
        metrics.offlineFallbacks += 1;
        return stale as T;
      }
      if (options.persistOfflineKey) {
        const persisted = readPersistedCache(options.persistOfflineKey);
        if (persisted !== null) {
          metrics.offlineFallbacks += 1;
          return persisted as T;
        }
      }
    }

    metrics.failures += 1;
    throw lastError || new Error('Network request failed.');
  };

  const promise = execute();
  if (isGet && !options.skipDedupe) {
    inflightGetRequests.set(cacheKey, promise);
    promise.finally(() => {
      inflightGetRequests.delete(cacheKey);
    });
  }
  return promise;
}

export function invalidateHttpCache(urlPrefix?: string): void {
  if (!urlPrefix) {
    memoryCache.clear();
    return;
  }
  for (const key of Array.from(memoryCache.keys())) {
    if (key.includes(urlPrefix)) {
      memoryCache.delete(key);
    }
  }
}

export function getHttpClientMetrics() {
  const savedRequests = metrics.cacheHits + metrics.dedupedHits;
  return {
    ...metrics,
    savedRequests,
    cacheHitRate:
      metrics.totalCalls > 0
        ? Math.round((savedRequests / metrics.totalCalls) * 1000) / 10
        : 0,
    memoryCacheEntries: memoryCache.size,
  };
}
