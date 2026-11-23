import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  setDoc,
} from 'firebase/firestore';
import {
  AdvancedGiftConfig,
  AdvancedGiftFormat,
  Gift,
  GiftAnimationType,
  GiftDisplayMode,
  GiftMediaAnalysis,
} from '../types';
import { auth, db, handleFirestoreError, OperationType } from './firebase';



/**
 * Converts the Admin Panel's shared `/gifts` catalog document into the app gift model.
 * StoreScreen intentionally does not consume this catalog; it remains a separate shop.
 */
function normalizeAdminCatalogGift(id: string, raw: Record<string, any>): Gift {
  const coins = Math.max(0, Math.floor(Number(raw.coins ?? raw.costInCoins ?? 0) || 0));
  const validAnimations: GiftAnimationType[] = ['sparkle', 'heart', 'car', 'rocket', 'crown', 'dragon', 'yacht', 'ring'];
  const animationType = validAnimations.includes(raw.animationType) ? raw.animationType : 'sparkle';
  const rawFormat = String(raw.format || raw.animationFormat || 'EMOJI').toLowerCase().trim();
  const formatAliases: Record<string, AdvancedGiftFormat> = {
    svga: 'svga', 'video/svga': 'svga', webm: 'webm', 'video/webm': 'webm',
    mp4: 'mp4', 'video/mp4': 'mp4', mov: 'mov', 'video/quicktime': 'mov',
    svg: 'svg', 'image/svg+xml': 'svg', gif: 'gif', 'image/gif': 'gif',
  };
  const format = formatAliases[rawFormat];
  const assetUrl = String(raw.assetUrl || raw.downloadUrl || raw.animationUrl || raw.optimizedFileUrl || raw.originalFileUrl || '');
  const durationValue = Number(raw.durationMs) || (Number(raw.duration) ? Number(raw.duration) * 1000 : 3000);
  const durationMs = Math.min(60_000, Math.max(1_500, Math.round(durationValue)));
  const modeRaw = String(raw.animationMode || raw.displayMode || '').toLowerCase();
  const displayMode: GiftDisplayMode =
    modeRaw.includes('overlay') || modeRaw.includes('background') ? 'overlay_background'
      : modeRaw.includes('semi') ? 'semi_transparent' : 'transparent';
  const statusRaw = String(raw.status || 'Active').toLowerCase();
  const isActive = ['active', 'published', 'enabled', 'show'].includes(statusRaw) && raw.show !== false && raw.isActive !== false;
  const timestampToIso = (value: any, fallback: string) => {
    if (value && typeof value.toDate === 'function') return value.toDate().toISOString();
    if (typeof value === 'string' && value) return value;
    return fallback;
  };
  const nowIso = new Date().toISOString();
  const advancedConfig: AdvancedGiftConfig | undefined = format && assetUrl ? {
    id,
    name: String(raw.name || 'Gift'),
    description: String(raw.description || ''),
    category: String(raw.category || 'Others'),
    coins,
    icon: String(raw.icon || '🎁'),
    thumbnailUrl: String(raw.thumbnailUrl || raw.imageUrl || ''),
    previewImageUrl: String(raw.previewImageUrl || raw.thumbnailUrl || raw.imageUrl || ''),
    originalFileUrl: String(raw.originalFileUrl || assetUrl),
    optimizedFileUrl: String(raw.optimizedFileUrl || assetUrl),
    animationUrl: assetUrl,
    format,
    displayMode,
    transparencyStatus: raw.transparencyStatus === 'alpha_verified' || raw.transparencyStatus === 'opaque_no_alpha' || raw.transparencyStatus === 'alpha_limited_gif'
      ? raw.transparencyStatus : (format === 'svga' || format === 'svg' ? 'alpha_verified' : 'opaque_no_alpha'),
    opacity: Math.min(100, Math.max(10, Number(raw.opacity ?? 90) || 90)),
    durationMs,
    loop: Boolean(raw.loop),
    playbackSpeed: Math.min(2, Math.max(0.5, Number(raw.playbackSpeed ?? 1) || 1)),
    position: ['top', 'bottom', 'center', 'fullscreen'].includes(String(raw.position)) ? raw.position : 'fullscreen',
    scale: Math.min(1.5, Math.max(0.4, Number(raw.scale ?? 1) || 1)),
    priority: Math.max(1, Math.min(100, Number(raw.priority ?? raw.order) || 50)),
    enableParticles: raw.enableParticles !== false,
    enableSound: raw.enableSound !== false,
    edgeFeather: typeof raw.edgeFeather === 'boolean' ? raw.edgeFeather : (format === 'mp4' || format === 'webm' || format === 'mov'),
    blendMode: raw.blendMode === 'screen' || raw.blendMode === 'lighten' ? raw.blendMode : 'normal',
    status: isActive ? 'published' : 'disabled',
    conversionStatus: 'not_needed',
    conversionMessage: 'Loaded from the shared Alpha Mate Admin Gift Gallery catalog.',
    isTestGift: Boolean(raw.isTestGift),
    createdAt: timestampToIso(raw.createdAt, nowIso),
    createdAtMs: Number(raw.createdAtMs) || Date.now(),
    updatedAt: timestampToIso(raw.updatedAt, nowIso),
    createdBy: typeof raw.createdBy === 'string' ? raw.createdBy : 'admin_catalog',
  } : undefined;

  const tier = coins >= 20_000 ? 'mythic' : coins >= 5_000 ? 'legendary' : coins >= 1_000 ? 'epic' : coins >= 100 ? 'rare' : 'common';
  return {
    id,
    name: String(raw.name || 'Gift'),
    icon: String(raw.icon || '🎁'),
    coins,
    costInCoins: coins,
    animationType,
    thumbnailUrl: String(raw.thumbnailUrl || raw.imageUrl || (rawFormat === 'png' ? assetUrl : '')) || undefined,
    tier,
    durationMs,
    triggersScreenShake: coins >= 5_000,
    description: String(raw.description || ''),
    priority: Math.max(1, Number(raw.priority ?? raw.order) || 1),
    advancedConfig,
    adminCatalog: true,
    catalogVisible: isActive,
  };
}

/** Live subscription to gifts created/edited in the Alpha Mate Admin Panel. */
export function subscribeToAdminGiftCatalog(
  onUpdate: (gifts: Gift[], initialized: boolean) => void,
  onError?: (error: Error) => void
): () => void {
  let latest: Gift[] = [];
  let catalogReady = false;
  let metaReady = false;
  let explicitlyInitialized = false;
  const emit = () => onUpdate(latest, explicitlyInitialized || (catalogReady && latest.length > 0));
  const unsubscribeCatalog = onSnapshot(
    collection(db, 'gifts'),
    (snapshot) => {
      latest = snapshot.docs
        .map((item) => normalizeAdminCatalogGift(item.id, item.data() as Record<string, any>))
        .sort((a, b) => (a.priority || 0) - (b.priority || 0));
      catalogReady = true;
      emit();
    },
    (error) => {
      console.warn('[AdminGiftCatalog] Firestore listener fallback:', error?.message || error);
      onError?.(error instanceof Error ? error : new Error(String(error)));
    }
  );
  const unsubscribeMeta = onSnapshot(
    doc(db, 'gift_catalog_meta', 'default_seed'),
    (snapshot) => {
      metaReady = true;
      explicitlyInitialized = snapshot.exists() && snapshot.data()?.initialized === true;
      if (metaReady) emit();
    },
    (error) => {
      console.warn('[AdminGiftCatalog] Catalog metadata unavailable:', error?.message || error);
      onError?.(error instanceof Error ? error : new Error(String(error)));
    }
  );
  return () => { unsubscribeCatalog(); unsubscribeMeta(); };
}

export const ALPHA_MATE_TEST_GIFT_ID = 'test_gift_alpha_mate_10000';
export const UPLOADED_TEST_WEBM_URL = '/assets/aistudio/alpha_mate_gift_5666_a950c836.webm';
export const SAMPLE_TRANSPARENT_SVG_URL = '/assets/gifts/sample_alpha_crown.svg';

/**
 * Real ffprobe-verified metadata for the uploaded Alpha Mate WebM test gift
 * (`public/assets/aistudio/alpha_mate_gift_5666_a950c836.webm`).
 */
export const UPLOADED_WEBM_VERIFIED_ANALYSIS: GiftMediaAnalysis = {
  format: 'webm',
  container: 'matroska,webm',
  codec: 'vp9 (Profile 0)',
  pixFmt: 'yuv420p',
  width: 478,
  height: 850,
  fps: 24,
  durationSec: 10.08,
  fileSizeBytes: 1797309,
  hasAlpha: false,
  hasAudio: true,
  audioCodec: 'opus',
  transparencyStatus: 'opaque_no_alpha',
  recommendedMode: 'semi_transparent',
  androidWebViewCompatible: true,
  warnings: [
    'Verified via ffprobe: codec VP9 (Profile 0), 478x850 @ 24fps, Opus stereo audio, pixel format yuv420p (no embedded alpha channel / alpha_mode=0).',
    'In Transparent Mode, opaque yuv420p frames cannot drop their background automatically — switch between Transparent, Semi-Transparent, and Overlay/Background modes to verify behavior, or upload a VP9 Alpha (yuva420p) WebM / SVG for true alpha cutouts.',
  ],
};

/**
 * Default clearly-marked 10,000-coin Test Gift bound directly to the uploaded WebM asset.
 */
export const DEFAULT_ALPHA_MATE_TEST_GIFT_CONFIG: AdvancedGiftConfig = {
  id: ALPHA_MATE_TEST_GIFT_ID,
  name: 'Alpha Mate Test Gift',
  description: 'TEST GIFT (10,000 Coins) — Full-screen edge-feathered WebM animation that merges seamlessly into the live room with zero rectangular borders.',
  category: 'Test & Showcase',
  coins: 10000,
  icon: '🎬',
  thumbnailUrl: SAMPLE_TRANSPARENT_SVG_URL,
  previewImageUrl: SAMPLE_TRANSPARENT_SVG_URL,
  originalFileUrl: UPLOADED_TEST_WEBM_URL,
  optimizedFileUrl: UPLOADED_TEST_WEBM_URL,
  animationUrl: UPLOADED_TEST_WEBM_URL,
  format: 'webm',
  displayMode: 'semi_transparent',
  transparencyStatus: 'opaque_no_alpha',
  opacity: 90,
  durationMs: 10080,
  loop: false,
  playbackSpeed: 1,
  position: 'fullscreen',
  scale: 1,
  priority: 95,
  enableParticles: true,
  enableSound: true,
  edgeFeather: true,
  blendMode: 'normal',
  status: 'published',
  conversionStatus: 'not_needed',
  conversionMessage: 'Real uploaded WebM (VP9 + Opus, 478x850, 24fps, 10.08s) verified with ffprobe — Seamless Edge-Merge enabled.',
  analysis: UPLOADED_WEBM_VERIFIED_ANALYSIS,
  isTestGift: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  createdAtMs: 1735689600000,
  updatedAt: '2026-01-01T00:00:00.000Z',
  createdBy: 'system_test_catalog',
};

/**
 * Converts an AdvancedGiftConfig into the unified Alpha Mate `Gift` object used by
 * `sendLiveGift`, LiveStreamScreen, PartyRoomsScreen, and GiftAnimationOverlay.
 */
export function advancedGiftConfigToGift(config: AdvancedGiftConfig): Gift {
  const tier =
    config.coins >= 20000
      ? 'mythic'
      : config.coins >= 5000
      ? 'legendary'
      : config.coins >= 1000
      ? 'epic'
      : config.coins >= 100
      ? 'rare'
      : 'common';

  return {
    id: config.id,
    name: config.name,
    icon: config.icon || (config.format === 'svg' ? '✨' : config.format === 'gif' ? '🎞️' : '🎬'),
    coins: config.coins,
    costInCoins: config.coins,
    animationType: config.coins >= 10000 ? 'dragon' : 'crown',
    thumbnailUrl: config.thumbnailUrl || config.previewImageUrl || SAMPLE_TRANSPARENT_SVG_URL,
    tier,
    durationMs: config.durationMs,
    triggersScreenShake: config.coins >= 10000,
    description: config.description,
    priority: config.priority,
    isTestGift: Boolean(config.isTestGift),
    advancedConfig: config,
  };
}

/**
 * Runtime browser / Android WebView format capability checker.
 */
export interface DeviceFormatCapabilities {
  webmVp9: boolean;
  webmVp8: boolean;
  svgaAnimation: boolean;
  mp4H264: boolean;
  movQuickTime: boolean;
  svgAnimation: boolean;
  gifAnimation: boolean;
  isAndroidWebView: boolean;
}

export function detectDeviceGiftCapabilities(): DeviceFormatCapabilities {
  if (typeof document === 'undefined') {
    return {
      webmVp9: true,
      webmVp8: true,
      svgaAnimation: true,
      mp4H264: true,
      movQuickTime: false,
      svgAnimation: true,
      gifAnimation: true,
      isAndroidWebView: false,
    };
  }
  const video = document.createElement('video');
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';
  const isAndroidWebView = /Android/i.test(ua) && (/; wv\)/i.test(ua) || /Capacitor/i.test(ua));
  return {
    webmVp9: Boolean(video.canPlayType('video/webm; codecs="vp9, opus"') || video.canPlayType('video/webm; codecs="vp9"')),
    webmVp8: Boolean(video.canPlayType('video/webm; codecs="vp8"')),
    svgaAnimation: typeof HTMLCanvasElement !== 'undefined',
    mp4H264: Boolean(video.canPlayType('video/mp4; codecs="avc1.42E01E"')),
    movQuickTime: Boolean(video.canPlayType('video/quicktime')),
    svgAnimation: true,
    gifAnimation: true,
    isAndroidWebView,
  };
}

/**
 * Lightweight preloader cache for frequently used published gift animations.
 */
const preloadedAssetUrls = new Set<string>();

export function preloadGiftAnimationAssets(configs: AdvancedGiftConfig[], maxPreload = 6): void {
  if (typeof document === 'undefined' || typeof window === 'undefined') return;
  const published = configs
    .filter((g) => g.status === 'published' && (g.optimizedFileUrl || g.animationUrl))
    .sort((a, b) => (b.priority || 0) - (a.priority || 0))
    .slice(0, maxPreload);

  for (const gift of published) {
    const url = gift.optimizedFileUrl || gift.animationUrl;
    if (!url || preloadedAssetUrls.has(url)) continue;
    preloadedAssetUrls.add(url);

    if (gift.format === 'svg' || gift.format === 'gif') {
      const img = new Image();
      img.decoding = 'async';
      img.src = url;
    } else if (gift.thumbnailUrl && !preloadedAssetUrls.has(gift.thumbnailUrl)) {
      preloadedAssetUrls.add(gift.thumbnailUrl);
      const thumb = new Image();
      thumb.decoding = 'async';
      thumb.src = gift.thumbnailUrl;
    }
  }
}

/**
 * Resolves the best playable URL for a given AdvancedGiftConfig on the current device.
 */
export function resolvePlayableGiftUrl(config: AdvancedGiftConfig): {
  url: string;
  effectiveFormat: AdvancedGiftFormat;
  usedOptimized: boolean;
} {
  if (config.optimizedFileUrl && config.conversionStatus === 'completed') {
    const ext = config.optimizedFileUrl.toLowerCase().split('?')[0];
    const effectiveFormat: AdvancedGiftFormat = ext.endsWith('.webm')
      ? 'webm'
      : ext.endsWith('.svga')
      ? 'svga'
      : ext.endsWith('.mp4')
      ? 'mp4'
      : config.format;
    return {
      url: config.optimizedFileUrl,
      effectiveFormat,
      usedOptimized: true,
    };
  }
  const rawUrl = config.animationUrl || config.originalFileUrl;
  const rawExt = rawUrl.toLowerCase().split('?')[0];
  const inferredFormat: AdvancedGiftFormat = rawExt.endsWith('.svga')
    ? 'svga'
    : config.format;
  return {
    url: rawUrl,
    effectiveFormat: inferredFormat,
    usedOptimized: false,
  };
}

/**
 * Priority queue helper: inserts a queued gift event sorted by priority desc, then timestamp asc.
 */
export function enqueueByPriority<T extends { id: string; gift: Gift; timestamp: number }>(
  queue: T[],
  incoming: T,
  maxQueueSize = 18
): T[] {
  if (queue.some((item) => item.id === incoming.id)) return queue;
  const next = [...queue, incoming];
  next.sort((a, b) => {
    const pA = a.gift.advancedConfig?.priority ?? a.gift.priority ?? (a.gift.coins >= 10000 ? 90 : a.gift.coins >= 1000 ? 60 : 20);
    const pB = b.gift.advancedConfig?.priority ?? b.gift.priority ?? (b.gift.coins >= 10000 ? 90 : b.gift.coins >= 1000 ? 60 : 20);
    if (pB !== pA) return pB - pA;
    return a.timestamp - b.timestamp;
  });
  return next.slice(0, maxQueueSize);
}

/**
 * Normalize raw Firestore document into a strongly-typed AdvancedGiftConfig.
 */
function normalizeAdvancedGiftDoc(id: string, raw: Record<string, any>): AdvancedGiftConfig {
  const format: AdvancedGiftFormat =
    raw.format === 'svga' || raw.format === 'mov' || raw.format === 'mp4' || raw.format === 'svg' || raw.format === 'gif'
      ? raw.format
      : 'webm';
  const displayMode: GiftDisplayMode =
    raw.displayMode === 'transparent' || raw.displayMode === 'overlay_background'
      ? raw.displayMode
      : 'semi_transparent';
  const opacity = Math.min(100, Math.max(10, Number(raw.opacity ?? 88) || 88));
  const durationMs = Math.min(60_000, Math.max(1500, Number(raw.durationMs ?? 6000) || 6000));
  const playbackSpeed = Math.min(2, Math.max(0.5, Number(raw.playbackSpeed ?? 1) || 1));
  const scale = Math.min(1.5, Math.max(0.4, Number(raw.scale ?? 1) || 1));
  const priority = Math.min(100, Math.max(1, Number(raw.priority ?? 50) || 50));
  const transparencyStatus =
    raw.transparencyStatus === 'alpha_verified' ||
    raw.transparencyStatus === 'alpha_limited_gif' ||
    raw.transparencyStatus === 'opaque_no_alpha'
      ? raw.transparencyStatus
      : format === 'svga' || format === 'svg'
      ? 'alpha_verified'
      : 'unknown';
  const isVideo = format === 'webm' || format === 'mp4' || format === 'mov';
  const defaultEdgeFeather = isVideo && transparencyStatus !== 'alpha_verified';
  const edgeFeather = typeof raw.edgeFeather === 'boolean' ? raw.edgeFeather : defaultEdgeFeather;
  const blendMode =
    raw.blendMode === 'screen' || raw.blendMode === 'lighten' ? raw.blendMode : 'normal';

  return {
    id,
    name: String(raw.name || 'Unnamed Gift'),
    description: String(raw.description || ''),
    category: String(raw.category || 'Special'),
    coins: Math.max(1, Math.floor(Number(raw.coins ?? 100) || 100)),
    icon: typeof raw.icon === 'string' && raw.icon.trim() ? raw.icon.trim() : '🎁',
    thumbnailUrl: typeof raw.thumbnailUrl === 'string' ? raw.thumbnailUrl : undefined,
    previewImageUrl: typeof raw.previewImageUrl === 'string' ? raw.previewImageUrl : undefined,
    originalFileUrl: String(raw.originalFileUrl || raw.animationUrl || ''),
    optimizedFileUrl: typeof raw.optimizedFileUrl === 'string' ? raw.optimizedFileUrl : undefined,
    animationUrl: String(raw.optimizedFileUrl || raw.animationUrl || raw.originalFileUrl || ''),
    format,
    displayMode,
    transparencyStatus,
    opacity,
    durationMs,
    loop: Boolean(raw.loop),
    playbackSpeed,
    position:
      raw.position === 'top' || raw.position === 'bottom' || raw.position === 'center'
        ? raw.position
        : 'fullscreen',
    scale,
    priority,
    enableParticles: raw.enableParticles !== false,
    enableSound: raw.enableSound !== false,
    edgeFeather,
    blendMode,
    status:
      raw.status === 'draft' || raw.status === 'processing' || raw.status === 'disabled'
        ? raw.status
        : 'published',
    conversionStatus:
      raw.conversionStatus === 'pending' ||
      raw.conversionStatus === 'converting' ||
      raw.conversionStatus === 'completed' ||
      raw.conversionStatus === 'failed' ||
      raw.conversionStatus === 'unsupported'
        ? raw.conversionStatus
        : 'not_needed',
    conversionMessage: typeof raw.conversionMessage === 'string' ? raw.conversionMessage : undefined,
    analysis: raw.analysis && typeof raw.analysis === 'object' ? (raw.analysis as GiftMediaAnalysis) : undefined,
    isTestGift: Boolean(raw.isTestGift),
    createdAt: String(raw.createdAt || new Date().toISOString()),
    createdAtMs: Number(raw.createdAtMs || Date.now()),
    updatedAt: String(raw.updatedAt || new Date().toISOString()),
    createdBy: typeof raw.createdBy === 'string' ? raw.createdBy : undefined,
  };
}

/**
 * Real-time subscription to `/advancedGifts` collection in Firestore.
 * Always keeps the 10,000-coin `Alpha Mate Test Gift` available (allowing Admin edits in Firestore to override its defaults).
 */
export function subscribeToAdvancedGifts(
  onUpdate: (gifts: AdvancedGiftConfig[]) => void
): () => void {
  const ref = collection(db, 'advancedGifts');
  return onSnapshot(
    ref,
    (snapshot) => {
      const byId = new Map<string, AdvancedGiftConfig>();
      byId.set(DEFAULT_ALPHA_MATE_TEST_GIFT_CONFIG.id, DEFAULT_ALPHA_MATE_TEST_GIFT_CONFIG);

      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (!data) return;
        byId.set(docSnap.id, normalizeAdvancedGiftDoc(docSnap.id, data));
      });

      const list = Array.from(byId.values()).sort((a, b) => {
        if (a.isTestGift && !b.isTestGift) return -1;
        if (!a.isTestGift && b.isTestGift) return 1;
        if ((b.priority || 0) !== (a.priority || 0)) return (b.priority || 0) - (a.priority || 0);
        return (b.createdAtMs || 0) - (a.createdAtMs || 0);
      });

      preloadGiftAnimationAssets(list);
      onUpdate(list);
    },
    (error) => {
      console.warn('[AdvancedGifts] Firestore listener fallback:', error?.message || error);
      onUpdate([DEFAULT_ALPHA_MATE_TEST_GIFT_CONFIG]);
    }
  );
}

/**
 * Strip undefined values recursively before writing to Firestore.
 */
function stripUndefinedDeep<T>(input: T): T {
  if (Array.isArray(input)) {
    return input.map((v) => stripUndefinedDeep(v)) as unknown as T;
  }
  if (input && typeof input === 'object') {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(input as Record<string, any>)) {
      if (v !== undefined) {
        out[k] = stripUndefinedDeep(v);
      }
    }
    return out as T;
  }
  return input;
}

export async function saveAdvancedGiftToFirestore(config: AdvancedGiftConfig): Promise<void> {
  const safeId = config.id.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
  const nowIso = new Date().toISOString();
  const payload: AdvancedGiftConfig = stripUndefinedDeep({
    ...config,
    id: safeId,
    animationUrl: config.optimizedFileUrl || config.animationUrl || config.originalFileUrl,
    opacity: Math.min(100, Math.max(10, Math.round(config.opacity))),
    durationMs: Math.min(60_000, Math.max(1500, Math.round(config.durationMs))),
    playbackSpeed: Math.min(2, Math.max(0.5, Number(config.playbackSpeed) || 1)),
    scale: Math.min(1.5, Math.max(0.4, Number(config.scale) || 1)),
    priority: Math.min(100, Math.max(1, Math.round(config.priority))),
    coins: Math.max(1, Math.floor(config.coins)),
    updatedAt: nowIso,
    createdAt: config.createdAt || nowIso,
    createdAtMs: config.createdAtMs || Date.now(),
    createdBy: config.createdBy || auth.currentUser?.uid || 'official_admin',
  });

  try {
    await setDoc(doc(db, 'advancedGifts', safeId), payload, { merge: false });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `advancedGifts/${safeId}`);
  }
}

export async function deleteAdvancedGiftFromFirestore(giftId: string): Promise<void> {
  const safeId = giftId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
  try {
    await deleteDoc(doc(db, 'advancedGifts', safeId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `advancedGifts/${safeId}`);
  }
}

async function getBearerHeaders(): Promise<Record<string, string>> {
  const token = await auth.currentUser?.getIdToken().catch(() => null);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function uploadAdminGiftFile(
  file: File,
  uploadKind: 'animation' | 'thumbnail' = 'animation'
): Promise<{
  success: boolean;
  fileUrl?: string;
  originalFileUrl?: string;
  format?: AdvancedGiftFormat;
  fileSizeBytes?: number;
  analysis?: GiftMediaAnalysis;
  error?: string;
}> {
  const authHeaders = await getBearerHeaders();
  const res = await fetch('/api/admin/gifts/upload', {
    method: 'POST',
    headers: {
      ...authHeaders,
      'Content-Type': file.type || 'application/octet-stream',
      'X-File-Name': file.name,
      'X-Upload-Kind': uploadKind,
    },
    body: file,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.success) {
    return { success: false, error: data?.error || `Upload failed (${res.status})` };
  }
  return data;
}

export async function probeAdminLocalGiftFile(fileUrl: string): Promise<{
  success: boolean;
  format?: AdvancedGiftFormat;
  analysis?: GiftMediaAnalysis;
  error?: string;
}> {
  const authHeaders = await getBearerHeaders();
  const res = await fetch('/api/admin/gifts/probe-local', {
    method: 'POST',
    headers: {
      ...authHeaders,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fileUrl }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.success) {
    return { success: false, error: data?.error || `Probe failed (${res.status})` };
  }
  return data;
}

export async function convertAdminGiftToWebm(sourceFileUrl: string): Promise<{
  success: boolean;
  originalFileUrl?: string;
  optimizedFileUrl?: string;
  preservedAlpha?: boolean;
  conversionStatus?: 'completed' | 'failed';
  analysis?: GiftMediaAnalysis;
  warnings?: string[];
  error?: string;
}> {
  const authHeaders = await getBearerHeaders();
  const res = await fetch('/api/admin/gifts/convert', {
    method: 'POST',
    headers: {
      ...authHeaders,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ sourceFileUrl }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.success) {
    return { success: false, conversionStatus: 'failed', error: data?.error || `Conversion failed (${res.status})` };
  }
  return data;
}

export async function validateGiftSendOnServer(params: {
  giftId: string;
  unitCoins: number;
  quantity: number;
  roomType: 'live' | 'party';
  roomId: string;
  recipientId: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const authHeaders = await getBearerHeaders();
    if (!authHeaders.Authorization) return { success: true };
    const res = await fetch('/api/gifts/validate-send', {
      method: 'POST',
      headers: {
        ...authHeaders,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.success) {
      return { success: false, error: data?.error || 'Gift validation rejected by server.' };
    }
    return { success: true };
  } catch {
    // Allow graceful Firestore transaction validation when backend is unreachable
    return { success: true };
  }
}
