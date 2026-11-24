import { Gift } from '../types';

/**
 * Persistent On-Device Gift Media Cache (IndexedDB + In-Memory Blob URL Registry).
 *
 * Ensures animated gift assets (WebM, SVGA, MP4, MOV, GIF, SVG) and PNG gift icons
 * are downloaded once to local storage inside the app. Subsequent gift plays receive
 * ONLY lightweight transaction metadata over WebSocket/Firestore and render instantly
 * from the local Blob URL with zero buffering, zero stalling, and locked smooth playback.
 */

const DB_NAME = 'alphamate_gift_media_cache_v1';
const STORE_NAME = 'media_blobs';
const DB_VERSION = 1;

interface CachedMediaRecord {
  url: string;
  giftId: string;
  blob: Blob;
  mimeType: string;
  sizeBytes: number;
  updatedAtMs: number;
}

export interface GiftMediaCacheSnapshot {
  cachedUrls: Set<string>;
  downloadingUrls: Set<string>;
  sizeByUrl: Map<string, number>;
  totalBytes: number;
  ready: boolean;
}

const memoryObjectUrls = new Map<string, string>();
const cachedUrls = new Set<string>();
const downloadingUrls = new Set<string>();
const sizeByUrl = new Map<string, number>();
const inflightDownloads = new Map<string, Promise<string | null>>();
const listeners = new Set<() => void>();

let dbPromise: Promise<IDBDatabase | null> | null = null;
let indexHydrated = false;
let indexHydratePromise: Promise<void> | null = null;

function notifyListeners(): void {
  listeners.forEach((cb) => {
    try {
      cb();
    } catch {
      // ignore subscriber errors
    }
  });
}

function isCacheableUrl(url: string | undefined | null): url is string {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith('blob:') || trimmed.startsWith('data:')) return false;
  return (
    trimmed.startsWith('https://') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('/')
  );
}

function openCacheDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  if (dbPromise) return dbPromise;

  dbPromise = new Promise<IDBDatabase | null>((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'url' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

/**
 * Hydrates the in-memory index of cached URLs & byte sizes from IndexedDB once on boot.
 */
export async function hydrateGiftMediaCacheIndex(): Promise<void> {
  if (indexHydrated) return;
  if (indexHydratePromise) return indexHydratePromise;

  indexHydratePromise = (async () => {
    const db = await openCacheDb();
    if (!db) {
      indexHydrated = true;
      notifyListeners();
      return;
    }
    await new Promise<void>((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.openCursor();
        req.onsuccess = () => {
          const cursor = req.result;
          if (cursor) {
            const rec = cursor.value as CachedMediaRecord;
            if (rec?.url && rec?.blob instanceof Blob && rec.blob.size > 0) {
              cachedUrls.add(rec.url);
              sizeByUrl.set(rec.url, rec.sizeBytes || rec.blob.size);
            }
            cursor.continue();
          } else {
            resolve();
          }
        };
        req.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
    indexHydrated = true;
    notifyListeners();
  })();

  return indexHydratePromise;
}

async function readRecordFromDb(url: string): Promise<CachedMediaRecord | null> {
  const db = await openCacheDb();
  if (!db) return null;
  return new Promise<CachedMediaRecord | null>((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(url);
      req.onsuccess = () => {
        const rec = req.result as CachedMediaRecord | undefined;
        if (rec && rec.blob instanceof Blob && rec.blob.size > 0) {
          resolve(rec);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function writeRecordToDb(record: CachedMediaRecord): Promise<void> {
  const db = await openCacheDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

/**
 * Synchronous fast-path lookup for an already-loaded local Blob URL.
 */
export function getCachedGiftMediaUrlSync(remoteUrl: string): string | null {
  if (!remoteUrl) return null;
  return memoryObjectUrls.get(remoteUrl) || null;
}

/**
 * Resolves a gift media URL to an instant local Blob URL if stored in IndexedDB.
 * If not yet cached locally, triggers a background download (when `autoCache` is true)
 * so the next play is 100% instant and never hits the network.
 */
export async function resolveCachedGiftMediaUrl(
  remoteUrl: string,
  options?: { giftId?: string; autoCache?: boolean }
): Promise<{ playableUrl: string; fromCache: boolean }> {
  if (!isCacheableUrl(remoteUrl)) {
    return { playableUrl: remoteUrl, fromCache: false };
  }

  const existingMem = memoryObjectUrls.get(remoteUrl);
  if (existingMem) {
    return { playableUrl: existingMem, fromCache: true };
  }

  const record = await readRecordFromDb(remoteUrl);
  if (record?.blob) {
    const objectUrl = URL.createObjectURL(record.blob);
    memoryObjectUrls.set(remoteUrl, objectUrl);
    cachedUrls.add(remoteUrl);
    sizeByUrl.set(remoteUrl, record.sizeBytes || record.blob.size);
    notifyListeners();
    return { playableUrl: objectUrl, fromCache: true };
  }

  if (options?.autoCache !== false) {
    // Download & persist in background without blocking first playback
    void downloadMediaUrlToCache(remoteUrl, options?.giftId || 'gift');
  }

  return { playableUrl: remoteUrl, fromCache: false };
}

/**
 * Downloads a single remote media URL into persistent IndexedDB cache and returns its Blob URL.
 */
export async function downloadMediaUrlToCache(
  remoteUrl: string,
  giftId = 'gift'
): Promise<string | null> {
  if (!isCacheableUrl(remoteUrl)) return null;

  const existingMem = memoryObjectUrls.get(remoteUrl);
  if (existingMem) return existingMem;

  const existingInflight = inflightDownloads.get(remoteUrl);
  if (existingInflight) return existingInflight;

  const task = (async (): Promise<string | null> => {
    try {
      // Check IndexedDB first before hitting network
      const existingDb = await readRecordFromDb(remoteUrl);
      if (existingDb?.blob) {
        const objUrl = URL.createObjectURL(existingDb.blob);
        memoryObjectUrls.set(remoteUrl, objUrl);
        cachedUrls.add(remoteUrl);
        sizeByUrl.set(remoteUrl, existingDb.sizeBytes || existingDb.blob.size);
        notifyListeners();
        return objUrl;
      }

      downloadingUrls.add(remoteUrl);
      notifyListeners();

      const response = await fetch(remoteUrl, { mode: 'cors', credentials: 'omit' }).catch(
        () => fetch(remoteUrl)
      );
      if (!response.ok) return null;

      const blob = await response.blob();
      if (!blob || blob.size === 0) return null;

      const record: CachedMediaRecord = {
        url: remoteUrl,
        giftId,
        blob,
        mimeType: blob.type || response.headers.get('content-type') || 'application/octet-stream',
        sizeBytes: blob.size,
        updatedAtMs: Date.now(),
      };

      await writeRecordToDb(record);

      const objectUrl = URL.createObjectURL(blob);
      memoryObjectUrls.set(remoteUrl, objectUrl);
      cachedUrls.add(remoteUrl);
      sizeByUrl.set(remoteUrl, blob.size);
      return objectUrl;
    } catch {
      return null;
    } finally {
      downloadingUrls.delete(remoteUrl);
      inflightDownloads.delete(remoteUrl);
      notifyListeners();
    }
  })();

  inflightDownloads.set(remoteUrl, task);
  return task;
}

/**
 * Extracts the primary animation URL for a Gift (if it has one).
 */
export function getGiftPrimaryAnimationUrl(gift: Gift): string {
  const cfg = gift.advancedConfig;
  if (!cfg) return '';
  if (cfg.optimizedFileUrl && cfg.conversionStatus === 'completed') {
    return cfg.optimizedFileUrl;
  }
  return cfg.animationUrl || cfg.optimizedFileUrl || cfg.originalFileUrl || '';
}

/**
 * Downloads a gift's animation asset (and PNG thumbnail if present) into local device cache.
 */
export async function downloadGiftToLocalCache(gift: Gift): Promise<boolean> {
  const animUrl = getGiftPrimaryAnimationUrl(gift);
  const thumbUrl = gift.thumbnailUrl || gift.advancedConfig?.thumbnailUrl || '';
  const tasks: Array<Promise<string | null>> = [];

  if (isCacheableUrl(animUrl)) {
    tasks.push(downloadMediaUrlToCache(animUrl, gift.id));
  }
  if (isCacheableUrl(thumbUrl) && thumbUrl !== animUrl) {
    tasks.push(downloadMediaUrlToCache(thumbUrl, `${gift.id}_thumb`));
  }

  if (tasks.length === 0) return false;
  const results = await Promise.all(tasks);
  return results.some((r) => Boolean(r));
}

/**
 * Downloads all animated gifts in the catalog into persistent on-device storage
 * with controlled concurrency (2 at a time) so UI and audio stay silky smooth.
 */
export async function downloadAllGiftsToLocalCache(
  gifts: Gift[],
  onProgress?: (done: number, total: number) => void
): Promise<{ cached: number; total: number }> {
  await hydrateGiftMediaCacheIndex();
  const animated = gifts.filter((g) => isCacheableUrl(getGiftPrimaryAnimationUrl(g)));
  const total = animated.length;
  if (total === 0) {
    onProgress?.(0, 0);
    return { cached: 0, total: 0 };
  }

  let done = 0;
  let cached = 0;
  const queue = [...animated];

  const worker = async () => {
    while (queue.length > 0) {
      const next = queue.shift();
      if (!next) break;
      const ok = await downloadGiftToLocalCache(next);
      if (ok) cached += 1;
      done += 1;
      onProgress?.(done, total);
    }
  };

  await Promise.all([worker(), worker()]);
  return { cached, total };
}

export function isGiftAnimationCached(gift: Gift): boolean {
  const animUrl = getGiftPrimaryAnimationUrl(gift);
  if (!animUrl) return false;
  return cachedUrls.has(animUrl) || memoryObjectUrls.has(animUrl);
}

export function isGiftAnimationDownloading(gift: Gift): boolean {
  const animUrl = getGiftPrimaryAnimationUrl(gift);
  if (!animUrl) return false;
  return downloadingUrls.has(animUrl);
}

export function getGiftCachedSizeBytes(gift: Gift): number {
  const animUrl = getGiftPrimaryAnimationUrl(gift);
  if (!animUrl) return 0;
  return sizeByUrl.get(animUrl) || 0;
}

export function getGiftMediaCacheSnapshot(): GiftMediaCacheSnapshot {
  let totalBytes = 0;
  sizeByUrl.forEach((sz) => {
    totalBytes += sz;
  });
  return {
    cachedUrls: new Set(cachedUrls),
    downloadingUrls: new Set(downloadingUrls),
    sizeByUrl: new Map(sizeByUrl),
    totalBytes,
    ready: indexHydrated,
  };
}

export function formatCacheBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 KB';
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function subscribeGiftMediaCache(listener: () => void): () => void {
  listeners.add(listener);
  void hydrateGiftMediaCacheIndex();
  return () => {
    listeners.delete(listener);
  };
}

export async function clearGiftMediaCache(): Promise<void> {
  memoryObjectUrls.forEach((objUrl) => {
    try {
      URL.revokeObjectURL(objUrl);
    } catch {
      // ignore
    }
  });
  memoryObjectUrls.clear();
  cachedUrls.clear();
  sizeByUrl.clear();

  const db = await openCacheDb();
  if (db) {
    await new Promise<void>((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).clear();
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  }
  notifyListeners();
}
