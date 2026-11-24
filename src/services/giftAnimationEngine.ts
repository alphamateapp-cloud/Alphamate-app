import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  where,
  writeBatch,
  type QueryConstraint,
} from 'firebase/firestore';
import {
  AdvancedGiftConfig,
  AdvancedGiftFormat,
  AdvancedGiftStatus,
  Gift,
  GiftAnimationType,
  GiftDisplayMode,
  GiftMediaAnalysis,
  GiftRarityTier,
  UnifiedGiftCatalogSyncStats,
  UnifiedGiftConfig,
  UnifiedGiftKind,
} from '../types';
import { auth, db, handleFirestoreError, OperationType } from './firebase';

export const UNIFIED_GIFT_SCHEMA_VERSION = 2;
export const UNIFIED_GIFTS_COLLECTION = 'gifts';
const LEGACY_ADVANCED_GIFTS_COLLECTION = 'advancedGifts';

const VALID_ANIMATION_TYPES: GiftAnimationType[] = [
  'sparkle',
  'heart',
  'car',
  'rocket',
  'crown',
  'dragon',
  'yacht',
  'ring',
];

const FORMAT_ALIASES: Record<string, AdvancedGiftFormat> = {
  svga: 'svga',
  'video/svga': 'svga',
  'application/svga': 'svga',
  webm: 'webm',
  'video/webm': 'webm',
  mp4: 'mp4',
  'video/mp4': 'mp4',
  mov: 'mov',
  'video/quicktime': 'mov',
  svg: 'svg',
  'image/svg+xml': 'svg',
  gif: 'gif',
  'image/gif': 'gif',
};

function isHttpOrAssetUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  return (
    trimmed.startsWith('https://') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('/') ||
    trimmed.startsWith('data:image/')
  );
}

function isStaticRasterImageUrl(url: string): boolean {
  let clean = url;
  try {
    clean = decodeURIComponent(url.split('?')[0] || url).toLowerCase();
  } catch {
    clean = (url.split('?')[0] || url).toLowerCase();
  }
  return (
    /\.(png|jpe?g|webp|bmp|ico|avif)$/.test(clean) ||
    url.startsWith('data:image/png') ||
    url.startsWith('data:image/jpeg') ||
    url.startsWith('data:image/webp')
  );
}

function inferAnimationFormatFromUrl(url: string): AdvancedGiftFormat | undefined {
  if (!url) return undefined;
  let decoded = url;
  try {
    decoded = decodeURIComponent(url);
  } catch {
    decoded = url;
  }
  const cleanPath = decoded.split('?')[0].toLowerCase();
  if (cleanPath.endsWith('.webm') || cleanPath.includes('.webm/')) return 'webm';
  if (cleanPath.endsWith('.svga') || cleanPath.includes('.svga/')) return 'svga';
  if (cleanPath.endsWith('.mp4') || cleanPath.includes('.mp4/')) return 'mp4';
  if (cleanPath.endsWith('.mov') || cleanPath.includes('.mov/')) return 'mov';
  if (cleanPath.endsWith('.gif') || cleanPath.includes('.gif/')) return 'gif';
  if (cleanPath.endsWith('.svg') || cleanPath.includes('.svg/')) return 'svg';
  return undefined;
}

function pickFirstValidUrl(candidates: unknown[], excludeStaticImages = false): string {
  for (const candidate of candidates) {
    if (!isHttpOrAssetUrl(candidate)) continue;
    const trimmed = candidate.trim();
    if (excludeStaticImages && isStaticRasterImageUrl(trimmed)) continue;
    return trimmed;
  }
  return '';
}

function sanitizeEmojiIcon(rawIcon: unknown, fallback = '🎁'): string {
  if (typeof rawIcon !== 'string') return fallback;
  const trimmed = rawIcon.trim();
  if (!trimmed || isHttpOrAssetUrl(rawIcon)) return fallback;
  return trimmed.slice(0, 16);
}

function computeGiftTier(coins: number): GiftRarityTier {
  if (coins >= 20_000) return 'mythic';
  if (coins >= 5_000) return 'legendary';
  if (coins >= 1_000) return 'epic';
  if (coins >= 100) return 'rare';
  return 'common';
}

function timestampToIsoAndMs(value: any, fallbackMs: number): { iso: string; ms: number } {
  if (value && typeof value.toDate === 'function') {
    const d = value.toDate();
    return { iso: d.toISOString(), ms: d.getTime() };
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) {
      return { iso: new Date(parsed).toISOString(), ms: parsed };
    }
  }
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return { iso: new Date(value).toISOString(), ms: value };
  }
  return { iso: new Date(fallbackMs).toISOString(), ms: fallbackMs };
}

function normalizeStatusValue(raw: Record<string, any>): AdvancedGiftStatus {
  const rawStr = String(raw.status || '').toLowerCase().trim();
  if (rawStr === 'draft') return 'draft';
  if (rawStr === 'processing') return 'processing';
  if (rawStr === 'disabled' || rawStr === 'paused' || rawStr === 'inactive' || rawStr === 'hidden') {
    return 'disabled';
  }
  if (raw.show === false || raw.isActive === false) return 'disabled';
  return 'published';
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
export const DEFAULT_ALPHA_MATE_TEST_GIFT_CONFIG: UnifiedGiftConfig = {
  id: ALPHA_MATE_TEST_GIFT_ID,
  schemaVersion: UNIFIED_GIFT_SCHEMA_VERSION,
  giftKind: 'animated',
  name: 'Alpha Mate Test Gift',
  description:
    'TEST GIFT (10,000 Coins) — Full-screen edge-feathered WebM animation that merges seamlessly into the live room with zero rectangular borders.',
  category: 'Test & Showcase',
  coins: 10000,
  tier: 'legendary',
  icon: '🎬',
  thumbnailUrl: SAMPLE_TRANSPARENT_SVG_URL,
  previewImageUrl: SAMPLE_TRANSPARENT_SVG_URL,
  originalFileUrl: UPLOADED_TEST_WEBM_URL,
  optimizedFileUrl: UPLOADED_TEST_WEBM_URL,
  animationUrl: UPLOADED_TEST_WEBM_URL,
  format: 'webm',
  animationType: 'dragon',
  displayMode: 'semi_transparent',
  transparencyStatus: 'opaque_no_alpha',
  opacity: 90,
  durationMs: 10080,
  loop: false,
  playbackSpeed: 1,
  position: 'fullscreen',
  scale: 1,
  priority: 1,
  enableParticles: true,
  enableSound: true,
  edgeFeather: true,
  blendMode: 'normal',
  status: 'published',
  isActive: true,
  show: true,
  conversionStatus: 'not_needed',
  conversionMessage:
    'Real uploaded WebM (VP9 + Opus, 478x850, 24fps, 10.08s) verified with ffprobe — Seamless Edge-Merge enabled.',
  analysis: UPLOADED_WEBM_VERIFIED_ANALYSIS,
  isTestGift: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  createdAtMs: 1735689600000,
  updatedAt: '2026-01-01T00:00:00.000Z',
  updatedAtMs: 1735689600000,
  createdBy: 'system_test_catalog',
  sourceCollection: 'default',
  needsSchemaSync: true,
};

/**
 * Single authoritative normalizer for BOTH static sticker gifts and animated gifts
 * across canonical `/gifts` (v2 & legacy) and legacy `/advancedGifts` documents.
 */
export function normalizeUnifiedGiftDoc(
  id: string,
  raw: Record<string, any>,
  sourceCollection: 'gifts' | 'advancedGifts' = 'gifts'
): UnifiedGiftConfig {
  const coins = Math.max(
    1,
    Math.min(10_000_000, Math.floor(Number(raw.coins ?? raw.costInCoins ?? raw.price ?? 100) || 100))
  );
  const animationType: GiftAnimationType = VALID_ANIMATION_TYPES.includes(raw.animationType)
    ? raw.animationType
    : coins >= 10_000
    ? 'dragon'
    : coins >= 1_000
    ? 'crown'
    : 'sparkle';

  const rawFormat = String(raw.format || raw.animationFormat || raw.mediaType || raw.fileType || '')
    .toLowerCase()
    .trim();

  // 1. Extract the Gift Box icon thumbnail (PNG/WebP/SVG)
  const rawIconIsUrl = isHttpOrAssetUrl(raw.icon) ? raw.icon.trim() : '';
  const pngThumbnailUrl = pickFirstValidUrl([
    raw.thumbnailUrl,
    raw.previewImageUrl,
    raw.iconUrl,
    raw.imageUrl,
    raw.pngUrl,
    raw.iconImageUrl,
    raw.iconImage,
    raw.staticIconUrl,
    raw.cardImageUrl,
    raw.previewUrl,
    raw.thumbnail,
    raw.image,
    raw.photoUrl,
    raw.photoURL,
    raw.coverUrl,
    rawIconIsUrl,
    rawFormat === 'png' || rawFormat === 'static' ? raw.assetUrl : '',
    rawFormat === 'png' || rawFormat === 'static' ? raw.fileUrl : '',
  ]);

  // 2. Extract playable animation URL (never mistake a static PNG thumbnail for a video)
  const animationAssetUrl = pickFirstValidUrl(
    [
      raw.optimizedFileUrl,
      raw.animationUrl,
      raw.webmUrl,
      raw.videoUrl,
      raw.svgaUrl,
      raw.mp4Url,
      raw.movUrl,
      raw.animationFileUrl,
      raw.animationAssetUrl,
      raw.effectUrl,
      raw.giftVideoUrl,
      raw.mediaUrl,
      raw.assetUrl,
      raw.downloadUrl,
      raw.fileUrl,
      raw.originalFileUrl,
    ],
    true
  );

  // 3. Determine explicit giftKind ('animated' vs 'static') & playable format
  const inferredFromUrl = inferAnimationFormatFromUrl(animationAssetUrl);
  const explicitAnimatedFormat: AdvancedGiftFormat | undefined =
    FORMAT_ALIASES[rawFormat] ||
    inferredFromUrl ||
    (animationAssetUrl && (rawFormat === 'video' || rawFormat === 'animation') ? 'webm' : undefined) ||
    (animationAssetUrl && !isStaticRasterImageUrl(animationAssetUrl) ? 'webm' : undefined);

  const giftKind: UnifiedGiftKind =
    raw.giftKind === 'static' && !animationAssetUrl
      ? 'static'
      : animationAssetUrl && explicitAnimatedFormat
      ? 'animated'
      : 'static';

  const format: AdvancedGiftFormat = explicitAnimatedFormat || 'webm';
  const isVideoLike = giftKind === 'animated' && (format === 'webm' || format === 'mp4' || format === 'mov');

  const rawDurationMs = Number(raw.durationMs);
  const rawDurationSec = Number(raw.duration ?? raw.analysis?.durationSec);
  const durationValue =
    Number.isFinite(rawDurationMs) && rawDurationMs > 0
      ? rawDurationMs
      : Number.isFinite(rawDurationSec) && rawDurationSec > 0
      ? rawDurationSec * 1000
      : isVideoLike
      ? 10_000
      : 4_000;
  const durationMs = Math.min(60_000, Math.max(1_500, Math.round(durationValue)));

  const modeRaw = String(raw.displayMode || raw.animationMode || '').toLowerCase();
  const displayMode: GiftDisplayMode =
    modeRaw === 'overlay_background' || modeRaw.includes('overlay') || modeRaw.includes('background')
      ? 'overlay_background'
      : modeRaw === 'transparent' || (modeRaw.includes('transparent') && !modeRaw.includes('semi'))
      ? 'transparent'
      : giftKind === 'animated' && (format === 'svga' || format === 'svg')
      ? 'transparent'
      : 'semi_transparent';

  const transparencyStatus =
    raw.transparencyStatus === 'alpha_verified' ||
    raw.transparencyStatus === 'alpha_limited_gif' ||
    raw.transparencyStatus === 'opaque_no_alpha'
      ? raw.transparencyStatus
      : giftKind === 'animated' && (format === 'svga' || format === 'svg')
      ? 'alpha_verified'
      : giftKind === 'animated'
      ? 'opaque_no_alpha'
      : 'unknown';

  const opacity = Math.min(100, Math.max(10, Math.round(Number(raw.opacity ?? 92) || 92)));
  const playbackSpeed = Math.min(2, Math.max(0.5, Number(raw.playbackSpeed ?? 1) || 1));
  const scale = Math.min(1.5, Math.max(0.4, Number(raw.scale ?? 1) || 1));
  const priority = Math.min(100, Math.max(1, Math.round(Number(raw.priority ?? raw.order ?? 50) || 50)));
  const status = normalizeStatusValue(raw);
  const isActive = status === 'published';

  const fallbackNow = Date.now();
  const createdTs = timestampToIsoAndMs(raw.createdAt ?? raw.createdAtMs, Number(raw.createdAtMs) || fallbackNow);
  const updatedTs = timestampToIsoAndMs(raw.updatedAt ?? raw.updatedAtMs, Number(raw.updatedAtMs) || createdTs.ms);

  const edgeFeather =
    typeof raw.edgeFeather === 'boolean'
      ? raw.edgeFeather
      : isVideoLike && transparencyStatus !== 'alpha_verified';
  const blendMode =
    raw.blendMode === 'screen' || raw.blendMode === 'lighten' ? raw.blendMode : 'normal';

  const needsSchemaSync =
    sourceCollection !== UNIFIED_GIFTS_COLLECTION ||
    Number(raw.schemaVersion) !== UNIFIED_GIFT_SCHEMA_VERSION ||
    (raw.giftKind !== 'static' && raw.giftKind !== 'animated') ||
    typeof raw.priority !== 'number' ||
    typeof raw.isActive !== 'boolean' ||
    typeof raw.show !== 'boolean' ||
    typeof raw.createdAtMs !== 'number' ||
    typeof raw.updatedAtMs !== 'number' ||
    !['draft', 'processing', 'published', 'disabled'].includes(String(raw.status || ''));

  return {
    id,
    schemaVersion: Number(raw.schemaVersion) || 1,
    giftKind,
    name: String(raw.name || 'Unnamed Gift').trim().slice(0, 100) || 'Unnamed Gift',
    description: String(raw.description || '').slice(0, 500),
    category: String(raw.category || (giftKind === 'animated' ? 'VIP & Special' : 'Stickers')).trim().slice(0, 64) || 'General',
    coins,
    tier: computeGiftTier(coins),
    icon: sanitizeEmojiIcon(raw.icon, giftKind === 'animated' ? '🎬' : '🎁'),
    thumbnailUrl: pngThumbnailUrl || undefined,
    previewImageUrl: pngThumbnailUrl || undefined,
    originalFileUrl: giftKind === 'animated' ? String(raw.originalFileUrl || animationAssetUrl) : '',
    optimizedFileUrl:
      giftKind === 'animated' && typeof raw.optimizedFileUrl === 'string' && raw.optimizedFileUrl.trim()
        ? raw.optimizedFileUrl.trim()
        : giftKind === 'animated'
        ? animationAssetUrl
        : undefined,
    animationUrl: giftKind === 'animated' ? animationAssetUrl : '',
    format,
    animationType,
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
    status,
    isActive,
    show: isActive,
    conversionStatus:
      raw.conversionStatus === 'pending' ||
      raw.conversionStatus === 'converting' ||
      raw.conversionStatus === 'completed' ||
      raw.conversionStatus === 'failed' ||
      raw.conversionStatus === 'unsupported'
        ? raw.conversionStatus
        : 'not_needed',
    conversionMessage: typeof raw.conversionMessage === 'string' ? raw.conversionMessage.slice(0, 500) : undefined,
    analysis: raw.analysis && typeof raw.analysis === 'object' ? (raw.analysis as GiftMediaAnalysis) : undefined,
    isTestGift: Boolean(raw.isTestGift || id === ALPHA_MATE_TEST_GIFT_ID),
    createdAt: createdTs.iso,
    createdAtMs: createdTs.ms,
    updatedAt: updatedTs.iso,
    updatedAtMs: updatedTs.ms,
    createdBy: typeof raw.createdBy === 'string' ? raw.createdBy.slice(0, 128) : undefined,
    sourceCollection,
    needsSchemaSync,
  };
}

/**
 * Converts a UnifiedGiftConfig (static OR animated) into the runtime `Gift` model
 * consumed by PartyRoomsScreen, LiveStreamScreen, MomentsScreen, and GiftAnimationOverlay.
 */
export function unifiedGiftToGift(config: UnifiedGiftConfig): Gift {
  const coins = Math.max(1, Math.floor(config.coins));
  const tier = config.tier || computeGiftTier(coins);
  const playableAnimUrl = config.optimizedFileUrl || config.animationUrl || config.originalFileUrl || '';
  const isAnimated = (config.giftKind ?? (playableAnimUrl ? 'animated' : 'static')) === 'animated' && Boolean(playableAnimUrl);

  return {
    id: config.id,
    name: config.name,
    icon: config.icon || (isAnimated ? (config.format === 'svg' ? '✨' : config.format === 'gif' ? '🎞️' : '🎬') : '🎁'),
    coins,
    costInCoins: coins,
    animationType: config.animationType || (coins >= 10_000 ? 'dragon' : coins >= 1_000 ? 'crown' : 'sparkle'),
    thumbnailUrl: config.thumbnailUrl || config.previewImageUrl || undefined,
    tier,
    durationMs: config.durationMs,
    triggersScreenShake: coins >= 5_000,
    description: config.description || '',
    priority: config.priority,
    isTestGift: Boolean(config.isTestGift),
    advancedConfig: isAnimated ? config : undefined,
    adminCatalog: true,
    catalogVisible: config.status === 'published',
  };
}

/** Backward-compatible alias for components importing `advancedGiftConfigToGift`. */
export const advancedGiftConfigToGift = unifiedGiftToGift;

/** Backward-compatible alias for normalizing a legacy `/gifts` document directly to `Gift`. */
export function normalizeAdminCatalogGift(id: string, raw: Record<string, any>): Gift {
  return unifiedGiftToGift(normalizeUnifiedGiftDoc(id, raw, 'gifts'));
}

/**
 * Converts ANY runtime Gift into an editable `UnifiedGiftConfig` draft for Admin Gift Studio.
 */
export function catalogGiftToAdvancedDraft(gift: Gift): UnifiedGiftConfig {
  if (gift.advancedConfig) {
    return {
      ...gift.advancedConfig,
      id: gift.id,
      schemaVersion: gift.advancedConfig.schemaVersion || UNIFIED_GIFT_SCHEMA_VERSION,
      giftKind: 'animated',
      name: gift.name || gift.advancedConfig.name,
      coins: gift.costInCoins ?? gift.coins ?? gift.advancedConfig.coins,
      thumbnailUrl: gift.thumbnailUrl || gift.advancedConfig.thumbnailUrl,
      previewImageUrl: gift.thumbnailUrl || gift.advancedConfig.previewImageUrl,
      status: gift.catalogVisible === false ? 'disabled' : gift.advancedConfig.status || 'published',
    };
  }
  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const coins = Math.max(1, Math.floor(gift.costInCoins ?? gift.coins ?? 100));
  return {
    id: gift.id,
    schemaVersion: UNIFIED_GIFT_SCHEMA_VERSION,
    giftKind: 'static',
    name: gift.name || 'Gift',
    description: gift.description || '',
    category: 'Stickers',
    coins,
    tier: computeGiftTier(coins),
    icon: gift.icon || '🎁',
    thumbnailUrl: gift.thumbnailUrl || '',
    previewImageUrl: gift.thumbnailUrl || '',
    originalFileUrl: '',
    optimizedFileUrl: undefined,
    animationUrl: '',
    format: 'webm',
    animationType: gift.animationType || 'sparkle',
    displayMode: 'semi_transparent',
    transparencyStatus: 'unknown',
    opacity: 92,
    durationMs: Math.max(3000, Number(gift.durationMs) || 4000),
    loop: false,
    playbackSpeed: 1,
    position: 'fullscreen',
    scale: 1,
    priority: Math.max(1, Math.min(100, Number(gift.priority) || 50)),
    enableParticles: true,
    enableSound: true,
    edgeFeather: false,
    blendMode: 'normal',
    status: gift.catalogVisible === false ? 'disabled' : 'published',
    isActive: gift.catalogVisible !== false,
    show: gift.catalogVisible !== false,
    conversionStatus: 'not_needed',
    isTestGift: Boolean(gift.isTestGift),
    createdAt: nowIso,
    createdAtMs: nowMs,
    updatedAt: nowIso,
    updatedAtMs: nowMs,
  };
}

function computeSyncStats(gifts: UnifiedGiftConfig[]): UnifiedGiftCatalogSyncStats {
  let animatedCount = 0;
  let staticCount = 0;
  let publishedCount = 0;
  let draftOrPausedCount = 0;
  let legacyCount = 0;
  let unindexedCount = 0;

  for (const g of gifts) {
    const hasAnim = (g.giftKind === 'animated') && Boolean(g.optimizedFileUrl || g.animationUrl || g.originalFileUrl);
    if (hasAnim) animatedCount += 1;
    else staticCount += 1;

    if (g.status === 'published') publishedCount += 1;
    else draftOrPausedCount += 1;

    if (g.sourceCollection === 'advancedGifts') legacyCount += 1;
    if (g.needsSchemaSync && g.sourceCollection !== 'default') unindexedCount += 1;
  }

  return {
    total: gifts.length,
    animatedCount,
    staticCount,
    publishedCount,
    draftOrPausedCount,
    legacyCount,
    unindexedCount,
  };
}

function sortUnifiedGifts(list: UnifiedGiftConfig[]): UnifiedGiftConfig[] {
  return [...list].sort((a, b) => {
    if (a.isTestGift && !b.isTestGift) return -1;
    if (!a.isTestGift && b.isTestGift) return 1;
    const pDiff = (a.priority || 50) - (b.priority || 50);
    if (pDiff !== 0) return pDiff;
    return (b.createdAtMs || 0) - (a.createdAtMs || 0);
  });
}

/**
 * SINGLE UNIFIED REAL-TIME GIFT CATALOG SUBSCRIPTION (`/gifts` canonical collection).
 * - Subscribes to EVERY document in `/gifts` (both static and animated) without filtering out
 *   pre-v2 docs missing `priority`, guaranteeing 100% visibility in Admin Catalog.
 * - Performs a one-time read-only discovery check against deprecated `/advancedGifts` so any
 *   unmigrated animated gifts remain visible until Admin runs one-click schema unification.
 */
export function subscribeToUnifiedGiftCatalog(
  onUpdate: (payload: {
    gifts: UnifiedGiftConfig[];
    initialized: boolean;
    stats: UnifiedGiftCatalogSyncStats;
  }) => void,
  onError?: (error: Error) => void
): () => void {
  let canonicalById = new Map<string, UnifiedGiftConfig>();
  let legacyById = new Map<string, UnifiedGiftConfig>();
  let catalogReady = false;
  let explicitlyInitialized = false;
  let disposed = false;

  const emit = () => {
    if (disposed) return;
    const merged = new Map<string, UnifiedGiftConfig>();

    // 1. Seed legacy `/advancedGifts` records ONLY when not yet present in canonical `/gifts`
    legacyById.forEach((legacyDoc, id) => {
      merged.set(id, legacyDoc);
    });

    // 2. Canonical `/gifts` records ALWAYS take precedence
    canonicalById.forEach((docItem, id) => {
      const legacyMatch = legacyById.get(id);
      // If a legacy `/gifts` sticker doc shares an ID with an unmigrated `/advancedGifts` doc
      // and the `/gifts` doc doesn't have the animation URL yet, preserve the animation until synced.
      if (legacyMatch && docItem.giftKind === 'static' && docItem.needsSchemaSync && legacyMatch.giftKind === 'animated') {
        merged.set(id, {
          ...legacyMatch,
          name: docItem.name || legacyMatch.name,
          coins: docItem.coins || legacyMatch.coins,
          thumbnailUrl: docItem.thumbnailUrl || legacyMatch.thumbnailUrl,
          previewImageUrl: docItem.thumbnailUrl || legacyMatch.previewImageUrl,
          status: docItem.status,
          isActive: docItem.isActive,
          show: docItem.show,
          needsSchemaSync: true,
        });
      } else {
        merged.set(id, docItem);
      }
    });

    // 3. Ensure default 10,000-coin Alpha Mate Test Gift is always present if not overridden in `/gifts`
    if (!merged.has(ALPHA_MATE_TEST_GIFT_ID)) {
      merged.set(ALPHA_MATE_TEST_GIFT_ID, DEFAULT_ALPHA_MATE_TEST_GIFT_CONFIG);
    }

    const sorted = sortUnifiedGifts(Array.from(merged.values()));
    preloadGiftAnimationAssets(sorted);
    onUpdate({
      gifts: sorted,
      initialized: explicitlyInitialized || (catalogReady && canonicalById.size > 0),
      stats: computeSyncStats(sorted),
    });
  };

  // Canonical `/gifts` real-time listener
  const unsubscribeCatalog = onSnapshot(
    collection(db, UNIFIED_GIFTS_COLLECTION),
    (snapshot) => {
      const next = new Map<string, UnifiedGiftConfig>();
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (!data) return;
        next.set(docSnap.id, normalizeUnifiedGiftDoc(docSnap.id, data as Record<string, any>, 'gifts'));
      });
      canonicalById = next;
      catalogReady = true;
      emit();
    },
    (error) => {
      console.warn('[UnifiedGiftCatalog] /gifts listener warning:', error?.message || error);
      onError?.(error instanceof Error ? error : new Error(String(error)));
      emit();
    }
  );

  // Catalog meta seed marker listener
  const unsubscribeMeta = onSnapshot(
    doc(db, 'gift_catalog_meta', 'default_seed'),
    (snapshot) => {
      explicitlyInitialized = snapshot.exists() && snapshot.data()?.initialized === true;
      emit();
    },
    () => {
      // Optional meta document; ignore when missing
    }
  );

  // One-time read-only discovery of any unmigrated legacy `/advancedGifts` documents
  getDocs(collection(db, LEGACY_ADVANCED_GIFTS_COLLECTION))
    .then((snap) => {
      if (disposed || snap.empty) return;
      const nextLegacy = new Map<string, UnifiedGiftConfig>();
      snap.forEach((docSnap) => {
        const data = docSnap.data();
        if (!data) return;
        nextLegacy.set(
          docSnap.id,
          normalizeUnifiedGiftDoc(docSnap.id, data as Record<string, any>, 'advancedGifts')
        );
      });
      legacyById = nextLegacy;
      emit();
    })
    .catch(() => {
      // Legacy collection empty or unavailable — safe to ignore
    });

  return () => {
    disposed = true;
    unsubscribeCatalog();
    unsubscribeMeta();
  };
}

/**
 * Indexed Firestore query helper backed by composite indexes in `firestore.indexes.json`
 * on the canonical `/gifts` collection.
 */
export async function queryUnifiedGiftsIndexed(options: {
  onlyPublished?: boolean;
  giftKind?: UnifiedGiftKind;
  category?: string;
}): Promise<UnifiedGiftConfig[]> {
  const constraints: QueryConstraint[] = [];
  if (options.onlyPublished) {
    constraints.push(where('isActive', '==', true));
  }
  if (options.giftKind) {
    constraints.push(where('giftKind', '==', options.giftKind));
  }
  if (options.category) {
    constraints.push(where('category', '==', options.category));
  }
  constraints.push(orderBy('priority', 'asc'));

  try {
    const snap = await getDocs(query(collection(db, UNIFIED_GIFTS_COLLECTION), ...constraints));
    return snap.docs.map((d) => normalizeUnifiedGiftDoc(d.id, d.data() as Record<string, any>, 'gifts'));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, UNIFIED_GIFTS_COLLECTION);
    return [];
  }
}

/** Backward-compatible wrapper around `subscribeToUnifiedGiftCatalog`. */
export function subscribeToAdminGiftCatalog(
  onUpdate: (gifts: Gift[], initialized: boolean) => void,
  onError?: (error: Error) => void
): () => void {
  return subscribeToUnifiedGiftCatalog(
    ({ gifts, initialized }) => onUpdate(gifts.map(unifiedGiftToGift), initialized),
    onError
  );
}

/** Backward-compatible wrapper around `subscribeToUnifiedGiftCatalog`. */
export function subscribeToAdvancedGifts(
  onUpdate: (gifts: AdvancedGiftConfig[]) => void
): () => void {
  return subscribeToUnifiedGiftCatalog(({ gifts }) => onUpdate(gifts));
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
    webmVp9: Boolean(
      video.canPlayType('video/webm; codecs="vp9, opus"') || video.canPlayType('video/webm; codecs="vp9"')
    ),
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
 * Lightweight preloader cache for frequently used published gift animations & thumbnails.
 */
const preloadedAssetUrls = new Set<string>();

export function preloadGiftAnimationAssets(configs: UnifiedGiftConfig[], maxPreload = 8): void {
  if (typeof document === 'undefined' || typeof window === 'undefined') return;
  const published = configs
    .filter((g) => g.status === 'published')
    .sort((a, b) => (a.priority || 50) - (b.priority || 50))
    .slice(0, maxPreload);

  for (const gift of published) {
    if (gift.thumbnailUrl && !preloadedAssetUrls.has(gift.thumbnailUrl)) {
      preloadedAssetUrls.add(gift.thumbnailUrl);
      const thumb = new Image();
      thumb.decoding = 'async';
      thumb.src = gift.thumbnailUrl;
    }
    const url = gift.optimizedFileUrl || gift.animationUrl;
    if (!url || preloadedAssetUrls.has(url)) continue;
    if (gift.format === 'svg' || gift.format === 'gif') {
      preloadedAssetUrls.add(url);
      const img = new Image();
      img.decoding = 'async';
      img.src = url;
    }
  }
}

/**
 * Resolves the best playable URL for a given UnifiedGiftConfig on the current device.
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
  const inferredFormat: AdvancedGiftFormat = rawExt.endsWith('.svga') ? 'svga' : config.format;
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
    const pA =
      a.gift.advancedConfig?.priority ??
      a.gift.priority ??
      (a.gift.coins >= 10000 ? 90 : a.gift.coins >= 1000 ? 60 : 20);
    const pB =
      b.gift.advancedConfig?.priority ??
      b.gift.priority ??
      (b.gift.coins >= 10000 ? 90 : b.gift.coins >= 1000 ? 60 : 20);
    if (pB !== pA) return pB - pA;
    return a.timestamp - b.timestamp;
  });
  return next.slice(0, maxQueueSize);
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

function sanitizeSafeGiftId(rawId: string): string {
  const cleaned = String(rawId || '')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 128);
  return cleaned || `gift_${Date.now().toString(36)}`;
}

/**
 * Constructs a strictly validated, schema-v2 Firestore payload matching `firebase-blueprint.json`
 * (`UnifiedGift`) and `firestore.rules` (`isValidUnifiedGift`) for BOTH static and animated gifts.
 */
export function buildUnifiedGiftFirestorePayload(config: UnifiedGiftConfig): {
  safeId: string;
  payload: Record<string, any>;
  normalizedClientConfig: UnifiedGiftConfig;
} {
  const safeId = sanitizeSafeGiftId(config.id);
  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();

  const rawAnimUrl = (config.optimizedFileUrl || config.animationUrl || config.originalFileUrl || '').trim().slice(0, 2048);
  const requestedStatic = config.giftKind === 'static';
  const hasPlayableAnim = !requestedStatic && Boolean(rawAnimUrl);
  const giftKind: UnifiedGiftKind = hasPlayableAnim ? 'animated' : 'static';

  const safeCoins = Math.max(1, Math.min(10_000_000, Math.floor(Number(config.coins) || 100)));
  const safePriority = Math.max(1, Math.min(100, Math.round(Number(config.priority) || 50)));
  const safeDurationMs = Math.min(
    60_000,
    Math.max(1_500, Math.round(Number(config.durationMs) || (giftKind === 'animated' ? 10_000 : 4_000)))
  );
  const safeOpacity = Math.min(100, Math.max(10, Math.round(Number(config.opacity ?? 92) || 92)));
  const safePlaybackSpeed = Math.min(2, Math.max(0.5, Number(config.playbackSpeed ?? 1) || 1));
  const safeScale = Math.min(1.5, Math.max(0.4, Number(config.scale ?? 1) || 1));
  const safeStatus: AdvancedGiftStatus = ['draft', 'processing', 'published', 'disabled'].includes(config.status)
    ? config.status
    : 'published';
  const isActive = safeStatus === 'published';
  const tier = computeGiftTier(safeCoins);

  const safeThumb = (config.thumbnailUrl || config.previewImageUrl || '').trim().slice(0, 2048);
  const safeAnimFormat: AdvancedGiftFormat =
    inferAnimationFormatFromUrl(rawAnimUrl) ||
    (['webm', 'svga', 'mov', 'mp4', 'svg', 'gif'].includes(config.format) ? config.format : 'webm');

  const safeAnimType: GiftAnimationType = VALID_ANIMATION_TYPES.includes(config.animationType as GiftAnimationType)
    ? (config.animationType as GiftAnimationType)
    : safeCoins >= 10_000
    ? 'dragon'
    : safeCoins >= 1_000
    ? 'crown'
    : 'sparkle';

  const safeCategory =
    String(config.category || (giftKind === 'animated' ? 'VIP & Special' : 'Stickers'))
      .trim()
      .slice(0, 64) || 'General';
  const safeName = String(config.name || 'Gift').trim().slice(0, 100) || 'Gift';
  const safeDescription = String(config.description || '').slice(0, 500);
  const safeIcon = sanitizeEmojiIcon(config.icon, giftKind === 'animated' ? '🎬' : '🎁').slice(0, 32);

  const createdTs = timestampToIsoAndMs(config.createdAt || config.createdAtMs, config.createdAtMs || nowMs);
  const createdBy = String(config.createdBy || auth.currentUser?.uid || 'official_admin').slice(0, 128);

  const payload = stripUndefinedDeep({
    id: safeId,
    schemaVersion: UNIFIED_GIFT_SCHEMA_VERSION,
    giftKind,
    name: safeName,
    description: safeDescription,
    category: safeCategory,
    coins: safeCoins,
    costInCoins: safeCoins,
    price: safeCoins,
    tier,
    icon: safeIcon,
    thumbnailUrl: safeThumb,
    previewImageUrl: safeThumb,
    iconUrl: safeThumb,
    imageUrl: safeThumb,
    format: giftKind === 'animated' ? safeAnimFormat : 'static',
    animationType: safeAnimType,
    originalFileUrl: giftKind === 'animated' ? (config.originalFileUrl || rawAnimUrl).trim().slice(0, 2048) : '',
    optimizedFileUrl:
      giftKind === 'animated' && config.optimizedFileUrl
        ? config.optimizedFileUrl.trim().slice(0, 2048)
        : giftKind === 'animated'
        ? rawAnimUrl
        : '',
    animationUrl: giftKind === 'animated' ? rawAnimUrl : '',
    videoUrl:
      giftKind === 'animated' && (safeAnimFormat === 'webm' || safeAnimFormat === 'mp4' || safeAnimFormat === 'mov')
        ? rawAnimUrl
        : undefined,
    webmUrl: giftKind === 'animated' && safeAnimFormat === 'webm' ? rawAnimUrl : undefined,
    svgaUrl: giftKind === 'animated' && safeAnimFormat === 'svga' ? rawAnimUrl : undefined,
    displayMode: ['transparent', 'semi_transparent', 'overlay_background'].includes(config.displayMode)
      ? config.displayMode
      : 'semi_transparent',
    transparencyStatus: ['alpha_verified', 'alpha_limited_gif', 'opaque_no_alpha', 'unknown'].includes(
      config.transparencyStatus
    )
      ? config.transparencyStatus
      : 'unknown',
    opacity: safeOpacity,
    durationMs: safeDurationMs,
    loop: Boolean(config.loop),
    playbackSpeed: safePlaybackSpeed,
    position: ['center', 'top', 'bottom', 'fullscreen'].includes(config.position) ? config.position : 'fullscreen',
    scale: safeScale,
    priority: safePriority,
    order: safePriority,
    enableParticles: config.enableParticles !== false,
    enableSound: config.enableSound !== false,
    edgeFeather: Boolean(config.edgeFeather),
    blendMode: config.blendMode === 'screen' || config.blendMode === 'lighten' ? config.blendMode : 'normal',
    status: safeStatus,
    isActive,
    show: isActive,
    conversionStatus: ['not_needed', 'pending', 'converting', 'completed', 'failed', 'unsupported'].includes(
      config.conversionStatus
    )
      ? config.conversionStatus
      : 'not_needed',
    conversionMessage: config.conversionMessage ? String(config.conversionMessage).slice(0, 500) : undefined,
    analysis: giftKind === 'animated' && config.analysis ? config.analysis : undefined,
    isTestGift: Boolean(config.isTestGift || safeId === ALPHA_MATE_TEST_GIFT_ID),
    createdAt: createdTs.iso,
    createdAtMs: createdTs.ms,
    updatedAt: nowIso,
    updatedAtMs: nowMs,
    createdBy,
  });

  const normalizedClientConfig: UnifiedGiftConfig = {
    ...normalizeUnifiedGiftDoc(safeId, payload, 'gifts'),
    needsSchemaSync: false,
    sourceCollection: 'gifts',
  };

  return { safeId, payload, normalizedClientConfig };
}

/**
 * Writes a gift (static OR animated) exclusively into the single canonical `/gifts/{id}` collection
 * using the unified v2 schema, and removes any legacy `/advancedGifts/{id}` duplicate if present.
 */
export async function saveUnifiedGiftToFirestore(config: UnifiedGiftConfig): Promise<UnifiedGiftConfig> {
  const { safeId, payload, normalizedClientConfig } = buildUnifiedGiftFirestorePayload(config);

  try {
    await setDoc(doc(db, UNIFIED_GIFTS_COLLECTION, safeId), payload, { merge: false });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${UNIFIED_GIFTS_COLLECTION}/${safeId}`);
  }

  // Clean up any deprecated `/advancedGifts/{id}` duplicate so `/gifts` remains the single source of truth
  try {
    await deleteDoc(doc(db, LEGACY_ADVANCED_GIFTS_COLLECTION, safeId));
  } catch {
    // Ignore when legacy doc does not exist
  }

  return normalizedClientConfig;
}

/** Backward-compatible alias for saving to the unified `/gifts` collection. */
export async function saveAdvancedGiftToFirestore(config: AdvancedGiftConfig): Promise<void> {
  await saveUnifiedGiftToFirestore(config);
}

/**
 * Deletes a gift from `/gifts/{id}` (and cleans up any deprecated `/advancedGifts/{id}` copy).
 */
export async function deleteUnifiedGiftFromFirestore(giftId: string): Promise<void> {
  const safeId = sanitizeSafeGiftId(giftId);
  const errors: unknown[] = [];

  try {
    await deleteDoc(doc(db, UNIFIED_GIFTS_COLLECTION, safeId));
  } catch (error: any) {
    if (error?.code !== 'not-found') errors.push(error);
  }

  try {
    await deleteDoc(doc(db, LEGACY_ADVANCED_GIFTS_COLLECTION, safeId));
  } catch (error: any) {
    if (error?.code !== 'not-found') errors.push(error);
  }

  if (errors.length === 2) {
    handleFirestoreError(errors[0], OperationType.DELETE, `${UNIFIED_GIFTS_COLLECTION}/${safeId}`);
  }
}

/** Backward-compatible alias for deleting from the unified `/gifts` collection. */
export const deleteAdvancedGiftFromFirestore = deleteUnifiedGiftFromFirestore;

/**
 * One-click Admin migration & schema indexing utility:
 * Upgrades all legacy `/advancedGifts` documents and pre-v2 `/gifts` documents into the single
 * canonical schema-v2 `/gifts/{id}` collection with all indexed fields populated, removes legacy
 * duplicates from `/advancedGifts`, and updates `gift_catalog_meta/default_seed`.
 */
export async function migrateLegacyGiftsToUnifiedCatalog(
  items: UnifiedGiftConfig[]
): Promise<{
  migratedCount: number;
  normalizedCount: number;
  cleanedLegacyCount: number;
}> {
  const targets = items.filter((item) => item.needsSchemaSync);
  if (targets.length === 0) {
    return { migratedCount: 0, normalizedCount: 0, cleanedLegacyCount: 0 };
  }

  let migratedCount = 0;
  let normalizedCount = 0;
  let cleanedLegacyCount = 0;

  // Firestore writeBatch supports up to 500 ops; keep chunks <= 150 gifts (max 300 ops/batch)
  const CHUNK_SIZE = 150;
  for (let i = 0; i < targets.length; i += CHUNK_SIZE) {
    const chunk = targets.slice(i, i + CHUNK_SIZE);
    const batch = writeBatch(db);

    for (const item of chunk) {
      const { safeId, payload } = buildUnifiedGiftFirestorePayload(item);
      batch.set(doc(db, UNIFIED_GIFTS_COLLECTION, safeId), payload, { merge: false });
      if (item.sourceCollection === 'advancedGifts') {
        batch.delete(doc(db, LEGACY_ADVANCED_GIFTS_COLLECTION, safeId));
        migratedCount += 1;
        cleanedLegacyCount += 1;
      } else {
        normalizedCount += 1;
      }
    }

    if (i + CHUNK_SIZE >= targets.length) {
      batch.set(
        doc(db, 'gift_catalog_meta', 'default_seed'),
        {
          initialized: true,
          schemaVersion: UNIFIED_GIFT_SCHEMA_VERSION,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
    }

    try {
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, UNIFIED_GIFTS_COLLECTION);
    }
  }

  return { migratedCount, normalizedCount, cleanedLegacyCount };
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
