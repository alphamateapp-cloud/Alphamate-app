import { UnifiedGiftConfig } from '../types';

/**
 * Alpha Mate Official 10-Gift Animated Package (Source of Truth: gift_manifest.json / gift_price_list.csv).
 * - PNG files are used exclusively as static Gift Box thumbnails (`thumbnailUrl` / `previewImageUrl`).
 * - WEBM files are used as the full-screen moving animations when sent in Live & Party rooms.
 * - Configured with `displayMode: 'semi_transparent'`, `opacity: 82`, `edgeFeather: true`,
 *   `position: 'fullscreen'`, and `loop: false` so room seats & background stay visible with soft
 *   blurred/dissolved edges and zero rectangular borders.
 * - All durations & stream specs are verified via ffprobe against the deployed public assets.
 */

const PACK_CREATED_AT_ISO = '2026-11-24T06:00:00.000Z';
const PACK_CREATED_AT_MS = 1795413600000;

interface AlphaMateGiftManifestSeed {
  id: string;
  name: string;
  coins: number;
  packTier: 'Small' | 'Medium' | 'Large';
  category: string;
  icon: string;
  description: string;
  animationType: UnifiedGiftConfig['animationType'];
  priority: number;
  webmPath: string;
  pngPath: string;
  durationSec: number;
  durationMs: number;
  width: number;
  height: number;
  fps: number;
  hasAudio: boolean;
  audioCodec: string | null;
  fileSizeBytes: number;
}

const ALPHA_MATE_10_GIFT_SEEDS: AlphaMateGiftManifestSeed[] = [
  {
    id: 'gift_6337',
    name: 'Stardust Heart',
    coins: 3000,
    packTier: 'Small',
    category: 'Romantic',
    icon: '💖',
    description: 'Shimmering stardust heart burst with semi-transparent soft-edge blending.',
    animationType: 'heart',
    priority: 10,
    webmPath: '/assets/aistudio/stardust_heart_421f2759.webm',
    pngPath: '/assets/aistudio/stardust_heart_caf19caf.png',
    durationSec: 9.5,
    durationMs: 9498,
    width: 480,
    height: 848,
    fps: 25,
    hasAudio: true,
    audioCodec: 'vorbis',
    fileSizeBytes: 1150375,
  },
  {
    id: 'gift_6383',
    name: 'Love You Letter',
    coins: 3000,
    packTier: 'Small',
    category: 'Romantic',
    icon: '💌',
    description: 'Floating golden love letter reveal with soft edge-blurred room overlay.',
    animationType: 'heart',
    priority: 11,
    webmPath: '/assets/aistudio/love_you_letter_7e9a1d92.webm',
    pngPath: '/assets/aistudio/love_you_letter_45223e2c.png',
    durationSec: 6.03,
    durationMs: 6033,
    width: 480,
    height: 848,
    fps: 30,
    hasAudio: false,
    audioCodec: null,
    fileSizeBytes: 263201,
  },
  {
    id: 'gift_5645',
    name: 'Twin Moon Candles',
    coins: 5000,
    packTier: 'Small',
    category: 'Romantic',
    icon: '🕯️',
    description: 'Twin moonlit candles glowing gently across the live party room.',
    animationType: 'sparkle',
    priority: 12,
    webmPath: '/assets/aistudio/twin_moon_candles_7cbda702.webm',
    pngPath: '/assets/aistudio/twin_moon_candles_42e2e705.png',
    durationSec: 10.01,
    durationMs: 10009,
    width: 480,
    height: 848,
    fps: 24,
    hasAudio: true,
    audioCodec: 'vorbis',
    fileSizeBytes: 463932,
  },
  {
    id: 'gift_6367',
    name: 'Sunset Promise',
    coins: 5000,
    packTier: 'Small',
    category: 'Romantic',
    icon: '🌅',
    description: 'Golden sunset horizon promise with seamless semi-transparent edges.',
    animationType: 'heart',
    priority: 13,
    webmPath: '/assets/aistudio/sunset_promise_a3d1bfb8.webm',
    pngPath: '/assets/aistudio/sunset_promise_d18a08d3.png',
    durationSec: 10.17,
    durationMs: 10172,
    width: 720,
    height: 1280,
    fps: 30,
    hasAudio: true,
    audioCodec: 'vorbis',
    fileSizeBytes: 907010,
  },
  {
    id: 'gift_6334',
    name: 'Divine Touch',
    coins: 8000,
    packTier: 'Medium',
    category: 'VIP & Special',
    icon: '✨',
    description: 'Celestial divine touch aura illuminating the live stage.',
    animationType: 'sparkle',
    priority: 14,
    webmPath: '/assets/aistudio/divine_touch_5b6e53b3.webm',
    pngPath: '/assets/aistudio/divine_touch_f9f773d6.png',
    durationSec: 6.06,
    durationMs: 6062,
    width: 480,
    height: 848,
    fps: 24,
    hasAudio: true,
    audioCodec: 'vorbis',
    fileSizeBytes: 313785,
  },
  {
    id: 'gift_5648',
    name: 'Eternal Flame Heart',
    coins: 10000,
    packTier: 'Medium',
    category: 'VIP & Special',
    icon: '🔥',
    description: 'Blazing eternal flame heart with full-screen edge-feathered glow.',
    animationType: 'heart',
    priority: 15,
    webmPath: '/assets/aistudio/eternal_flame_heart_24b518e9.webm',
    pngPath: '/assets/aistudio/eternal_flame_heart_eab57ee7.png',
    durationSec: 6.02,
    durationMs: 6015,
    width: 480,
    height: 848,
    fps: 24,
    hasAudio: true,
    audioCodec: 'vorbis',
    fileSizeBytes: 339425,
  },
  {
    id: 'gift_6347',
    name: 'Royal Proposal',
    coins: 15000,
    packTier: 'Large',
    category: 'Luxury',
    icon: '💍',
    description: 'Grand royal proposal spectacle merging seamlessly into the live room.',
    animationType: 'ring',
    priority: 16,
    webmPath: '/assets/aistudio/royal_proposal_5e20f862.webm',
    pngPath: '/assets/aistudio/royal_proposal_95e30b36.png',
    durationSec: 6.11,
    durationMs: 6108,
    width: 480,
    height: 848,
    fps: 24,
    hasAudio: true,
    audioCodec: 'vorbis',
    fileSizeBytes: 268036,
  },
  {
    id: 'gift_6373',
    name: 'White Tiger',
    coins: 15000,
    packTier: 'Large',
    category: 'Luxury',
    icon: '🐅',
    description: 'Majestic white tiger entrance leaping across the semi-transparent stage.',
    animationType: 'dragon',
    priority: 17,
    webmPath: '/assets/aistudio/white_tiger_e7b4022b.webm',
    pngPath: '/assets/aistudio/white_tiger_d7c0e46d.png',
    durationSec: 8.57,
    durationMs: 8570,
    width: 480,
    height: 848,
    fps: 30,
    hasAudio: true,
    audioCodec: 'vorbis',
    fileSizeBytes: 483190,
  },
  {
    id: 'gift_5848',
    name: 'Mountain Wolf',
    coins: 15000,
    packTier: 'Large',
    category: 'Luxury',
    icon: '🐺',
    description: 'Alpha mountain wolf spirit howling across the live room.',
    animationType: 'dragon',
    priority: 18,
    webmPath: '/assets/aistudio/mountain_wolf_6563afd7.webm',
    pngPath: '/assets/aistudio/mountain_wolf_7a12f7ce.png',
    durationSec: 10.15,
    durationMs: 10149,
    width: 720,
    height: 1280,
    fps: 30,
    hasAudio: true,
    audioCodec: 'vorbis',
    fileSizeBytes: 700473,
  },
  {
    id: 'gift_6354',
    name: 'Celebration Airship',
    coins: 20000,
    packTier: 'Large',
    category: 'Luxury',
    icon: '🎈',
    description: 'Royal celebration airship soaring across the entire room with festive lights.',
    animationType: 'rocket',
    priority: 19,
    webmPath: '/assets/aistudio/celebration_airship_fca57eba.webm',
    pngPath: '/assets/aistudio/celebration_airship_6161978b.png',
    durationSec: 10.01,
    durationMs: 10009,
    width: 480,
    height: 848,
    fps: 24,
    hasAudio: true,
    audioCodec: 'vorbis',
    fileSizeBytes: 626218,
  },
];

function computeTierFromCoins(coins: number): UnifiedGiftConfig['tier'] {
  if (coins >= 20000) return 'mythic';
  if (coins >= 5000) return 'legendary';
  if (coins >= 1000) return 'epic';
  if (coins >= 100) return 'rare';
  return 'common';
}

export const ALPHA_MATE_10_ANIMATED_GIFTS: UnifiedGiftConfig[] = ALPHA_MATE_10_GIFT_SEEDS.map(
  (seed) => ({
    id: seed.id,
    schemaVersion: 2,
    giftKind: 'animated',
    name: seed.name,
    description: seed.description,
    category: seed.category,
    coins: seed.coins,
    tier: computeTierFromCoins(seed.coins),
    icon: seed.icon,
    thumbnailUrl: seed.pngPath,
    previewImageUrl: seed.pngPath,
    originalFileUrl: seed.webmPath,
    optimizedFileUrl: seed.webmPath,
    animationUrl: seed.webmPath,
    format: 'webm',
    animationType: seed.animationType,
    displayMode: 'semi_transparent',
    transparencyStatus: 'opaque_no_alpha',
    opacity: 82,
    durationMs: seed.durationMs,
    loop: false,
    playbackSpeed: 1,
    position: 'fullscreen',
    scale: 1,
    priority: seed.priority,
    enableParticles: true,
    enableSound: true,
    edgeFeather: true,
    blendMode: 'normal',
    status: 'published',
    isActive: true,
    show: true,
    conversionStatus: 'not_needed',
    conversionMessage: `Alpha Mate Official 10-Gift Pack (${seed.packTier} Tier • VP8 WebM ${seed.width}x${seed.height} @ ${seed.fps}fps, ${seed.durationSec}s) — Semi-Transparent Soft-Edge Merge enabled.`,
    analysis: {
      format: 'webm',
      container: 'matroska,webm',
      codec: 'vp8',
      pixFmt: 'yuv420p',
      width: seed.width,
      height: seed.height,
      fps: seed.fps,
      durationSec: seed.durationSec,
      fileSizeBytes: seed.fileSizeBytes,
      hasAlpha: false,
      hasAudio: seed.hasAudio,
      audioCodec: seed.audioCodec,
      transparencyStatus: 'opaque_no_alpha',
      recommendedMode: 'semi_transparent',
      androidWebViewCompatible: true,
      warnings: [],
    },
    isTestGift: false,
    createdAt: PACK_CREATED_AT_ISO,
    createdAtMs: PACK_CREATED_AT_MS + seed.priority * 1000,
    updatedAt: PACK_CREATED_AT_ISO,
    updatedAtMs: PACK_CREATED_AT_MS + seed.priority * 1000,
    createdBy: 'alpha_mate_10_gift_pack',
    sourceCollection: 'default',
    needsSchemaSync: true,
  })
);

export const ALPHA_MATE_10_GIFT_BY_ID: ReadonlyMap<string, UnifiedGiftConfig> = new Map(
  ALPHA_MATE_10_ANIMATED_GIFTS.map((gift) => [gift.id, gift])
);
