import {
  Gift,
  GiftAnimationType,
  GiftCssAnimationClass,
  GiftRarityTier,
} from '../types';
import {
  audioManager,
  COMBO_SFX_ASSET_PATH,
  GIFT_SFX_ASSET_MAP,
  PlayGiftSfxOptions,
  SfxPlaybackSource,
} from './audioManager';

/**
 * Rich metadata record for a virtual gift in Alpha Mate Live & Party.
 * Links visual CSS animation classes from `src/index.css`, high-DPI thumbnail image URLs,
 * coin costs, and `/audio/*.mp3` sound effect asset paths managed by `audioManager`.
 */
export interface VirtualGiftRecord extends Gift {
  id: string;
  name: string;
  icon: string;
  coins: number;
  costInCoins: number;
  animationType: GiftAnimationType;
  animationClassName: GiftCssAnimationClass;
  secondaryAnimationClassNames: GiftCssAnimationClass[];
  comboAnimationClassName: 'animate-combo-pop';
  screenShakeClassName: 'animate-gift-shake' | null;
  thumbnailUrl: string;
  thumbnailAssetPath: string;
  audioAssetPath: string;
  triggerAudioAssetPath: string;
  comboAudioAssetPath: string;
  defaultAudioVolume: number;
  tier: GiftRarityTier;
  durationMs: number;
  isBannerOnly: boolean;
  triggersScreenShake: boolean;
  description: string;
}

interface ThumbnailPalette {
  bgStart: string;
  bgEnd: string;
  glow: string;
  ring: string;
  icon: string;
}

/**
 * Generates a self-contained, zero-latency SVG badge data URI for a virtual gift thumbnail.
 * Works reliably offline, in web preview, and inside Android Capacitor WebView without 404s.
 */
function createGiftThumbnailDataUri(palette: ThumbnailPalette): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
  <defs>
    <radialGradient id="glow" cx="50%" cy="44%" r="52%">
      <stop offset="0%" stop-color="${palette.glow}" stop-opacity="0.58"/>
      <stop offset="65%" stop-color="${palette.bgStart}" stop-opacity="0.92"/>
      <stop offset="100%" stop-color="${palette.bgEnd}" stop-opacity="1"/>
    </radialGradient>
    <linearGradient id="rim" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${palette.ring}" stop-opacity="0.95"/>
      <stop offset="50%" stop-color="#ffffff" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="${palette.glow}" stop-opacity="0.9"/>
    </linearGradient>
  </defs>
  <rect x="6" y="6" width="116" height="116" rx="30" fill="url(#glow)" stroke="url(#rim)" stroke-width="3.5"/>
  <circle cx="64" cy="58" r="36" fill="${palette.glow}" fill-opacity="0.22"/>
  <circle cx="96" cy="28" r="3" fill="#ffffff" fill-opacity="0.75"/>
  <circle cx="30" cy="34" r="2.2" fill="#ffffff" fill-opacity="0.55"/>
  <text x="64" y="76" font-size="56" text-anchor="middle" dominant-baseline="middle">${palette.icon}</text>
</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/**
 * Canonical catalog of all available virtual gifts with exact `src/index.css` animation classes,
 * thumbnail image URLs, coin costs, and audio asset paths linked to `audioManager`.
 */
const INITIAL_VIRTUAL_GIFT_CATALOG: readonly VirtualGiftRecord[] = [
  {
    id: 'gift_rose',
    name: 'Red Rose',
    icon: '🌹',
    coins: 10,
    costInCoins: 10,
    animationType: 'sparkle',
    animationClassName: 'animate-combo-pop',
    secondaryAnimationClassNames: ['animate-shockwave', 'animate-float-heart'],
    comboAnimationClassName: 'animate-combo-pop',
    screenShakeClassName: null,
    thumbnailUrl: createGiftThumbnailDataUri({
      bgStart: '#3B0A26',
      bgEnd: '#16071A',
      glow: '#F43F5E',
      ring: '#FB7185',
      icon: '🌹',
    }),
    thumbnailAssetPath: '/assets/gifts/gift-rose.svg',
    audioAssetPath: '/audio/gift-rose.mp3',
    triggerAudioAssetPath: GIFT_SFX_ASSET_MAP.sparkle.assetPath,
    comboAudioAssetPath: COMBO_SFX_ASSET_PATH,
    defaultAudioVolume: GIFT_SFX_ASSET_MAP.sparkle.defaultVolume,
    tier: 'common',
    durationMs: 1900,
    isBannerOnly: true,
    triggersScreenShake: false,
    description: 'A fresh scented rose for your favorite host',
  },
  {
    id: 'gift_ice_cream',
    name: 'Sweet Gelato',
    icon: '🍦',
    coins: 50,
    costInCoins: 50,
    animationType: 'sparkle',
    animationClassName: 'animate-combo-pop',
    secondaryAnimationClassNames: ['animate-shockwave', 'animate-float-heart'],
    comboAnimationClassName: 'animate-combo-pop',
    screenShakeClassName: null,
    thumbnailUrl: createGiftThumbnailDataUri({
      bgStart: '#2D1446',
      bgEnd: '#130924',
      glow: '#EC4899',
      ring: '#F9A8D4',
      icon: '🍦',
    }),
    thumbnailAssetPath: '/assets/gifts/gift-gelato.svg',
    audioAssetPath: '/audio/gift-gelato.mp3',
    triggerAudioAssetPath: GIFT_SFX_ASSET_MAP.sparkle.assetPath,
    comboAudioAssetPath: COMBO_SFX_ASSET_PATH,
    defaultAudioVolume: GIFT_SFX_ASSET_MAP.sparkle.defaultVolume,
    tier: 'common',
    durationMs: 2000,
    isBannerOnly: true,
    triggersScreenShake: false,
    description: 'Refreshing treat to brighten up the chat',
  },
  {
    id: 'gift_heart',
    name: 'Heart Sparkle',
    icon: '💖',
    coins: 100,
    costInCoins: 100,
    animationType: 'heart',
    animationClassName: 'animate-combo-pop',
    secondaryAnimationClassNames: ['animate-petal'],
    comboAnimationClassName: 'animate-combo-pop',
    screenShakeClassName: null,
    thumbnailUrl: createGiftThumbnailDataUri({
      bgStart: '#430D39',
      bgEnd: '#190722',
      glow: '#EC4899',
      ring: '#F472B6',
      icon: '💖',
    }),
    thumbnailAssetPath: '/assets/gifts/gift-heart.svg',
    audioAssetPath: '/audio/gift-heart.mp3',
    triggerAudioAssetPath: GIFT_SFX_ASSET_MAP.heart.assetPath,
    comboAudioAssetPath: COMBO_SFX_ASSET_PATH,
    defaultAudioVolume: GIFT_SFX_ASSET_MAP.heart.defaultVolume,
    tier: 'rare',
    durationMs: 2000,
    isBannerOnly: true,
    triggersScreenShake: false,
    description: 'Animated pulse of affection and loyalty',
  },
  {
    id: 'gift_ring',
    name: 'Diamond Ring',
    icon: '💍',
    coins: 520,
    costInCoins: 520,
    animationType: 'ring',
    animationClassName: 'animate-ring-levitate',
    secondaryAnimationClassNames: [],
    comboAnimationClassName: 'animate-combo-pop',
    screenShakeClassName: null,
    thumbnailUrl: createGiftThumbnailDataUri({
      bgStart: '#0B2B45',
      bgEnd: '#071426',
      glow: '#22D3EE',
      ring: '#67E8F9',
      icon: '💍',
    }),
    thumbnailAssetPath: '/assets/gifts/gift-diamond-ring.svg',
    audioAssetPath: '/audio/gift-diamond-ring.mp3',
    triggerAudioAssetPath: GIFT_SFX_ASSET_MAP.ring.assetPath,
    comboAudioAssetPath: COMBO_SFX_ASSET_PATH,
    defaultAudioVolume: GIFT_SFX_ASSET_MAP.ring.defaultVolume,
    tier: 'rare',
    durationMs: 7100,
    isBannerOnly: false,
    triggersScreenShake: false,
    description: 'Sparkling engagement diamond of prestige',
  },
  {
    id: 'gift_crown',
    name: 'Alpha Crown',
    icon: '👑',
    coins: 1999,
    costInCoins: 1999,
    animationType: 'crown',
    animationClassName: 'animate-crown-drop',
    secondaryAnimationClassNames: ['animate-gift-shake'],
    comboAnimationClassName: 'animate-combo-pop',
    screenShakeClassName: 'animate-gift-shake',
    thumbnailUrl: createGiftThumbnailDataUri({
      bgStart: '#422808',
      bgEnd: '#1B1005',
      glow: '#F59E0B',
      ring: '#FDE047',
      icon: '👑',
    }),
    thumbnailAssetPath: '/assets/gifts/gift-crown.svg',
    audioAssetPath: '/audio/gift-crown.mp3',
    triggerAudioAssetPath: GIFT_SFX_ASSET_MAP.crown.assetPath,
    comboAudioAssetPath: COMBO_SFX_ASSET_PATH,
    defaultAudioVolume: GIFT_SFX_ASSET_MAP.crown.defaultVolume,
    tier: 'epic',
    durationMs: 7200,
    isBannerOnly: false,
    triggersScreenShake: true,
    description: 'Royal imperial crown of honor',
  },
  {
    id: 'gift_car',
    name: 'Cyber Supercar',
    icon: '🏎️',
    coins: 4999,
    costInCoins: 4999,
    animationType: 'car',
    animationClassName: 'animate-supercar',
    secondaryAnimationClassNames: ['animate-gift-shake'],
    comboAnimationClassName: 'animate-combo-pop',
    screenShakeClassName: 'animate-gift-shake',
    thumbnailUrl: createGiftThumbnailDataUri({
      bgStart: '#2A0F4D',
      bgEnd: '#110724',
      glow: '#A855F7',
      ring: '#C084FC',
      icon: '🏎️',
    }),
    thumbnailAssetPath: '/assets/gifts/gift-supercar.svg',
    audioAssetPath: '/audio/gift-supercar.mp3',
    triggerAudioAssetPath: GIFT_SFX_ASSET_MAP.car.assetPath,
    comboAudioAssetPath: COMBO_SFX_ASSET_PATH,
    defaultAudioVolume: GIFT_SFX_ASSET_MAP.car.defaultVolume,
    tier: 'epic',
    durationMs: 7300,
    isBannerOnly: false,
    triggersScreenShake: true,
    description: 'Twin-turbo neon supercar road takeover',
  },
  {
    id: 'gift_yacht',
    name: 'Royal Yacht',
    icon: '🛥️',
    coins: 9999,
    costInCoins: 9999,
    animationType: 'yacht',
    animationClassName: 'animate-yacht',
    secondaryAnimationClassNames: [],
    comboAnimationClassName: 'animate-combo-pop',
    screenShakeClassName: null,
    thumbnailUrl: createGiftThumbnailDataUri({
      bgStart: '#082E3F',
      bgEnd: '#051522',
      glow: '#06B6D4',
      ring: '#38BDF8',
      icon: '🛥️',
    }),
    thumbnailAssetPath: '/assets/gifts/gift-yacht.svg',
    audioAssetPath: '/audio/gift-yacht.mp3',
    triggerAudioAssetPath: GIFT_SFX_ASSET_MAP.yacht.assetPath,
    comboAudioAssetPath: COMBO_SFX_ASSET_PATH,
    defaultAudioVolume: GIFT_SFX_ASSET_MAP.yacht.defaultVolume,
    tier: 'legendary',
    durationMs: 7400,
    isBannerOnly: false,
    triggersScreenShake: false,
    description: 'Cruise the private neon sea in luxury',
  },
  {
    id: 'gift_rocket',
    name: 'Galaxy Rocket',
    icon: '🚀',
    coins: 19999,
    costInCoins: 19999,
    animationType: 'rocket',
    animationClassName: 'animate-rocket-launch',
    secondaryAnimationClassNames: ['animate-gift-shake'],
    comboAnimationClassName: 'animate-combo-pop',
    screenShakeClassName: 'animate-gift-shake',
    thumbnailUrl: createGiftThumbnailDataUri({
      bgStart: '#3A150B',
      bgEnd: '#140824',
      glow: '#F97316',
      ring: '#FB923C',
      icon: '🚀',
    }),
    thumbnailAssetPath: '/assets/gifts/gift-rocket.svg',
    audioAssetPath: '/audio/gift-rocket.mp3',
    triggerAudioAssetPath: GIFT_SFX_ASSET_MAP.rocket.assetPath,
    comboAudioAssetPath: COMBO_SFX_ASSET_PATH,
    defaultAudioVolume: GIFT_SFX_ASSET_MAP.rocket.defaultVolume,
    tier: 'mythic',
    durationMs: 7500,
    isBannerOnly: false,
    triggersScreenShake: true,
    description: 'Blast off across the cosmos with orbital sparks',
  },
  {
    id: 'gift_dragon',
    name: 'Mythic Dragon',
    icon: '🐉',
    coins: 49999,
    costInCoins: 49999,
    animationType: 'dragon',
    animationClassName: 'animate-dragon-fly',
    secondaryAnimationClassNames: ['animate-gift-shake'],
    comboAnimationClassName: 'animate-combo-pop',
    screenShakeClassName: 'animate-gift-shake',
    thumbnailUrl: createGiftThumbnailDataUri({
      bgStart: '#470B12',
      bgEnd: '#1A060B',
      glow: '#EF4444',
      ring: '#FBBF24',
      icon: '🐉',
    }),
    thumbnailAssetPath: '/assets/gifts/gift-dragon.svg',
    audioAssetPath: '/audio/gift-dragon.mp3',
    triggerAudioAssetPath: GIFT_SFX_ASSET_MAP.dragon.assetPath,
    comboAudioAssetPath: COMBO_SFX_ASSET_PATH,
    defaultAudioVolume: GIFT_SFX_ASSET_MAP.dragon.defaultVolume,
    tier: 'mythic',
    durationMs: 7600,
    isBannerOnly: false,
    triggersScreenShake: true,
    description: 'Imperial fire-breathing mythical dragon screen takeover!',
  },
];

/**
 * Default animation class mapping from `GiftAnimationType` to `src/index.css` keyframes
 * for resolving ad-hoc or legacy persisted gifts that only carry `animationType`.
 */
export const ANIMATION_TYPE_TO_CSS_CLASS_MAP: Record<
  GiftAnimationType,
  {
    primary: GiftCssAnimationClass;
    secondary: GiftCssAnimationClass[];
    triggersScreenShake: boolean;
  }
> = {
  sparkle: {
    primary: 'animate-combo-pop',
    secondary: ['animate-shockwave', 'animate-float-heart'],
    triggersScreenShake: false,
  },
  heart: {
    primary: 'animate-combo-pop',
    secondary: ['animate-petal'],
    triggersScreenShake: false,
  },
  ring: {
    primary: 'animate-ring-levitate',
    secondary: [],
    triggersScreenShake: false,
  },
  crown: {
    primary: 'animate-crown-drop',
    secondary: ['animate-gift-shake'],
    triggersScreenShake: true,
  },
  car: {
    primary: 'animate-supercar',
    secondary: ['animate-gift-shake'],
    triggersScreenShake: true,
  },
  yacht: {
    primary: 'animate-yacht',
    secondary: [],
    triggersScreenShake: false,
  },
  rocket: {
    primary: 'animate-rocket-launch',
    secondary: ['animate-gift-shake'],
    triggersScreenShake: true,
  },
  dragon: {
    primary: 'animate-dragon-fly',
    secondary: ['animate-gift-shake'],
    triggersScreenShake: true,
  },
};

function inferRarityTierFromCoins(coins: number): GiftRarityTier {
  if (coins >= 19999) return 'mythic';
  if (coins >= 9999) return 'legendary';
  if (coins >= 1999) return 'epic';
  if (coins >= 100) return 'rare';
  return 'common';
}

class VirtualGiftDatabaseService {
  private readonly giftMap = new Map<string, VirtualGiftRecord>();

  constructor(initialCatalog: readonly VirtualGiftRecord[]) {
    for (const record of initialCatalog) {
      this.giftMap.set(record.id, { ...record });
    }
    this.syncAudioManagerMappings();
  }

  /**
   * Registers every gift's ID, primary CSS animation class, and animation trigger
   * with `audioManager` so gift playback always resolves the exact `/audio/*.mp3` asset.
   */
  public syncAudioManagerMappings(): void {
    const dedicatedCssClasses = new Set<GiftCssAnimationClass>([
      'animate-supercar',
      'animate-rocket-launch',
      'animate-dragon-fly',
      'animate-yacht',
      'animate-crown-drop',
      'animate-ring-levitate',
    ]);

    for (const gift of this.giftMap.values()) {
      audioManager.registerAssetMapping(gift.id, gift.audioAssetPath);
      if (dedicatedCssClasses.has(gift.animationClassName)) {
        audioManager.registerAssetMapping(gift.animationClassName, gift.audioAssetPath);
      }
    }
  }

  /**
   * Returns all available virtual gifts sorted ascending by coin cost.
   */
  public getAllGifts(): VirtualGiftRecord[] {
    return Array.from(this.giftMap.values()).sort(
      (a, b) => a.costInCoins - b.costInCoins
    );
  }

  /**
   * Looks up a virtual gift by its unique ID (e.g., `'gift_car'`).
   */
  public getGiftById(id: string): VirtualGiftRecord | undefined {
    if (!id) return undefined;
    return this.giftMap.get(id);
  }

  /**
   * Finds a virtual gift matching an exact coin cost (used when reconstructing history events).
   */
  public getGiftByCost(costInCoins: number): VirtualGiftRecord | undefined {
    for (const gift of this.giftMap.values()) {
      if (gift.costInCoins === costInCoins || gift.coins === costInCoins) {
        return gift;
      }
    }
    return undefined;
  }

  /**
   * Filters virtual gifts by `animationType` trigger (e.g., `'car'`, `'dragon'`).
   */
  public getGiftsByAnimationType(animationType: GiftAnimationType): VirtualGiftRecord[] {
    return this.getAllGifts().filter((g) => g.animationType === animationType);
  }

  /**
   * Filters virtual gifts that use a specific CSS animation class from `src/index.css`
   * either as their primary animation or secondary particle/shake effect.
   */
  public getGiftsByAnimationClass(
    animationClassName: GiftCssAnimationClass
  ): VirtualGiftRecord[] {
    return this.getAllGifts().filter(
      (g) =>
        g.animationClassName === animationClassName ||
        g.secondaryAnimationClassNames.includes(animationClassName) ||
        g.comboAnimationClassName === animationClassName ||
        g.screenShakeClassName === animationClassName
    );
  }

  /**
   * Filters virtual gifts by rarity tier (`common`, `rare`, `epic`, `legendary`, `mythic`).
   */
  public getGiftsByTier(tier: GiftRarityTier): VirtualGiftRecord[] {
    return this.getAllGifts().filter((g) => g.tier === tier);
  }

  /**
   * Returns all virtual gifts affordable within the user's current coin balance.
   */
  public getAffordableGifts(coinBalance: number): VirtualGiftRecord[] {
    const safeBalance = Math.max(0, Number(coinBalance) || 0);
    return this.getAllGifts().filter((g) => g.costInCoins <= safeBalance);
  }

  /**
   * Registers or updates a gift record at runtime and links its audio asset path with `audioManager`.
   */
  public registerGift(record: VirtualGiftRecord): void {
    const normalizedCoins = Math.max(0, Number(record.costInCoins ?? record.coins) || 0);
    const normalized: VirtualGiftRecord = {
      ...record,
      coins: normalizedCoins,
      costInCoins: normalizedCoins,
    };
    this.giftMap.set(normalized.id, normalized);
    audioManager.registerAssetMapping(normalized.id, normalized.audioAssetPath);
  }

  /**
   * Resolves a complete `VirtualGiftRecord` from either a gift ID string or a partial/legacy `Gift` object.
   * Ensures callers (`GiftAnimationOverlay`, gift drawers, chat history) always get valid CSS class names,
   * thumbnail URLs, coin costs, and audio asset paths.
   */
  public resolveGiftMetadata(giftOrId: Gift | string): VirtualGiftRecord {
    if (typeof giftOrId === 'string') {
      const byId = this.getGiftById(giftOrId);
      if (byId) return byId;
      return this.getAllGifts()[0];
    }

    const existing = this.getGiftById(giftOrId.id);
    if (existing) {
      const coins = Number(giftOrId.costInCoins ?? giftOrId.coins ?? existing.costInCoins);
      const isBannerOnly = coins <= 100;
      const rawDuration = Number(giftOrId.durationMs || existing.durationMs) || (isBannerOnly ? 2000 : 7400);
      const clampedDuration = isBannerOnly
        ? Math.min(2800, Math.max(1500, rawDuration))
        : Math.min(7800, Math.max(7000, rawDuration));
      return {
        ...existing,
        ...giftOrId,
        coins,
        costInCoins: coins,
        animationClassName: giftOrId.animationClassName || existing.animationClassName,
        secondaryAnimationClassNames:
          giftOrId.secondaryAnimationClassNames || existing.secondaryAnimationClassNames,
        thumbnailUrl: giftOrId.thumbnailUrl || existing.thumbnailUrl,
        audioAssetPath: giftOrId.audioAssetPath || existing.audioAssetPath,
        tier: giftOrId.tier || existing.tier,
        durationMs: clampedDuration,
        isBannerOnly,
        triggersScreenShake:
          isBannerOnly
            ? false
            : typeof giftOrId.triggersScreenShake === 'boolean'
            ? giftOrId.triggersScreenShake
            : existing.triggersScreenShake,
      };
    }

    // Fallback synthesis for custom/historical Gift objects not in initial catalog
    const animType: GiftAnimationType =
      giftOrId.animationType in ANIMATION_TYPE_TO_CSS_CLASS_MAP
        ? giftOrId.animationType
        : 'sparkle';
    const cssConfig = ANIMATION_TYPE_TO_CSS_CLASS_MAP[animType];
    const cueConfig = GIFT_SFX_ASSET_MAP[animType];
    const coins = Math.max(0, Number(giftOrId.costInCoins ?? giftOrId.coins) || 10);
    const isBannerOnly = coins <= 100;
    const triggersShake = isBannerOnly
      ? false
      : typeof giftOrId.triggersScreenShake === 'boolean'
      ? giftOrId.triggersScreenShake
      : cssConfig.triggersScreenShake;
    const rawDuration =
      Number(giftOrId.durationMs) ||
      (isBannerOnly ? 2000 : coins >= 49999 ? 7600 : coins >= 19999 ? 7500 : 7200);
    const clampedDuration = isBannerOnly
      ? Math.min(2800, Math.max(1500, rawDuration))
      : Math.min(7800, Math.max(7000, rawDuration));

    return {
      id: giftOrId.id || `gift_custom_${animType}`,
      name: giftOrId.name || 'Virtual Gift',
      icon: giftOrId.icon || '🎁',
      coins,
      costInCoins: coins,
      animationType: animType,
      animationClassName: giftOrId.animationClassName || cssConfig.primary,
      secondaryAnimationClassNames:
        giftOrId.secondaryAnimationClassNames || cssConfig.secondary,
      comboAnimationClassName: 'animate-combo-pop',
      screenShakeClassName: triggersShake ? 'animate-gift-shake' : null,
      thumbnailUrl:
        giftOrId.thumbnailUrl ||
        createGiftThumbnailDataUri({
          bgStart: '#2A114B',
          bgEnd: '#110722',
          glow: '#EC4899',
          ring: '#A855F7',
          icon: giftOrId.icon || '🎁',
        }),
      thumbnailAssetPath: `/assets/gifts/${giftOrId.id || 'custom-gift'}.svg`,
      audioAssetPath:
        giftOrId.audioAssetPath || audioManager.getAssetPath(giftOrId),
      triggerAudioAssetPath: cueConfig.assetPath,
      comboAudioAssetPath: COMBO_SFX_ASSET_PATH,
      defaultAudioVolume: cueConfig.defaultVolume,
      tier: giftOrId.tier || inferRarityTierFromCoins(coins),
      durationMs: clampedDuration,
      isBannerOnly,
      triggersScreenShake: triggersShake,
      description: giftOrId.description || 'Special virtual gift',
    };
  }

  /**
   * Returns the primary `/audio/*.mp3` asset path associated with a gift or gift ID.
   */
  public getGiftAudioAssetPath(giftOrId: Gift | string): string {
    return this.resolveGiftMetadata(giftOrId).audioAssetPath;
  }

  /**
   * Plays the high-quality SFX associated with a gift by resolving its metadata
   * from the database and delegating playback to `audioManager`.
   */
  public playGiftAudio(
    giftOrId: Gift | string,
    options: PlayGiftSfxOptions = {}
  ): Promise<SfxPlaybackSource> {
    const metadata = this.resolveGiftMetadata(giftOrId);
    return audioManager.playGiftSfx(metadata, {
      giftId: metadata.id,
      volume: options.volume ?? metadata.defaultAudioVolume,
      ...options,
    });
  }

  /**
   * Preloads all gift SFX assets registered in `virtualGiftDatabase` and `audioManager`.
   */
  public preloadAllGiftAudio(): Promise<void> {
    this.syncAudioManagerMappings();
    return audioManager.preloadAll();
  }
}

export const virtualGiftDatabase = new VirtualGiftDatabaseService(
  INITIAL_VIRTUAL_GIFT_CATALOG
);

export const VIRTUAL_GIFT_DATABASE: readonly VirtualGiftRecord[] =
  virtualGiftDatabase.getAllGifts();

export const getAllVirtualGifts = (): VirtualGiftRecord[] =>
  virtualGiftDatabase.getAllGifts();

export const getVirtualGiftById = (id: string): VirtualGiftRecord | undefined =>
  virtualGiftDatabase.getGiftById(id);

export const resolveVirtualGiftMetadata = (
  giftOrId: Gift | string
): VirtualGiftRecord => virtualGiftDatabase.resolveGiftMetadata(giftOrId);
