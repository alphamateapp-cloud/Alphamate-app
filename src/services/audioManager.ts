import { Gift } from '../types';
import { giftSoundEngine } from '../utils/giftSoundEffects';

export type GiftAnimationTrigger = Gift['animationType'];

export interface GiftAudioCueConfig {
  assetPath: string;
  fallbackAnimationType: GiftAnimationTrigger;
  defaultVolume: number;
  allowComboPitchShift?: boolean;
}

export interface PlayGiftSfxOptions {
  giftId?: string;
  comboCount?: number;
  volume?: number;
  playbackRate?: number;
  skipComboSfx?: boolean;
}

export type SfxPlaybackSource = 'asset' | 'synth' | 'muted' | 'unavailable';

const MUTE_STORAGE_KEY = 'am_gift_sfx_muted';
const VOLUME_STORAGE_KEY = 'am_gift_sfx_volume';

export const COMBO_SFX_ASSET_PATH = '/audio/gift-combo.mp3';

/**
 * Canonical mapping between gift animation triggers and external SFX asset paths.
 * High-quality MP3 assets placed in `public/audio/` are preloaded and played cleanly;
 * if an asset is not yet hosted, the Web Audio synthesizer fallback handles playback seamlessly.
 */
export const GIFT_SFX_ASSET_MAP: Record<GiftAnimationTrigger, GiftAudioCueConfig> = {
  sparkle: {
    assetPath: '/audio/gift-sparkle.mp3',
    fallbackAnimationType: 'sparkle',
    defaultVolume: 0.8,
    allowComboPitchShift: true,
  },
  heart: {
    assetPath: '/audio/gift-heart.mp3',
    fallbackAnimationType: 'heart',
    defaultVolume: 0.85,
    allowComboPitchShift: true,
  },
  ring: {
    assetPath: '/audio/gift-diamond-ring.mp3',
    fallbackAnimationType: 'ring',
    defaultVolume: 0.9,
  },
  crown: {
    assetPath: '/audio/gift-crown.mp3',
    fallbackAnimationType: 'crown',
    defaultVolume: 0.95,
  },
  car: {
    assetPath: '/audio/gift-supercar.mp3',
    fallbackAnimationType: 'car',
    defaultVolume: 1.0,
  },
  yacht: {
    assetPath: '/audio/gift-yacht.mp3',
    fallbackAnimationType: 'yacht',
    defaultVolume: 0.95,
  },
  rocket: {
    assetPath: '/audio/gift-rocket.mp3',
    fallbackAnimationType: 'rocket',
    defaultVolume: 1.0,
  },
  dragon: {
    assetPath: '/audio/gift-dragon.mp3',
    fallbackAnimationType: 'dragon',
    defaultVolume: 1.0,
  },
};

/**
 * Optional gift-ID level overrides for named virtual gifts.
 */
export const GIFT_ID_SFX_ASSET_MAP: Record<string, string> = {
  gift_rose: '/audio/gift-rose.mp3',
  gift_ice_cream: '/audio/gift-gelato.mp3',
  gift_heart: '/audio/gift-heart.mp3',
  gift_ring: '/audio/gift-diamond-ring.mp3',
  gift_crown: '/audio/gift-crown.mp3',
  gift_car: '/audio/gift-supercar.mp3',
  gift_yacht: '/audio/gift-yacht.mp3',
  gift_rocket: '/audio/gift-rocket.mp3',
  gift_dragon: '/audio/gift-dragon.mp3',
};

type BufferCacheEntry =
  | { status: 'decoded'; buffer: AudioBuffer }
  | { status: 'missing' };

class GiftAudioManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;

  private bufferCache = new Map<string, BufferCacheEntry>();
  private inflightLoads = new Map<string, Promise<AudioBuffer | null>>();
  private activeSources = new Set<AudioBufferSourceNode>();
  private customTriggerOverrides = new Map<string, string>();
  private muteListeners = new Set<(muted: boolean) => void>();

  private isMuted: boolean = false;
  private masterVolume: number = 0.85;

  constructor() {
    if (typeof window !== 'undefined') {
      try {
        this.isMuted = localStorage.getItem(MUTE_STORAGE_KEY) === 'true';
        const savedVol = Number(localStorage.getItem(VOLUME_STORAGE_KEY));
        if (!Number.isNaN(savedVol) && savedVol >= 0 && savedVol <= 1) {
          this.masterVolume = savedVol;
        }
      } catch {
        // ignore storage errors
      }
      giftSoundEngine.setMuted(this.isMuted);
    }
  }

  private ensureAudioGraph(): { ctx: AudioContext; masterGain: GainNode } | null {
    if (typeof window === 'undefined') return null;
    try {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioCtx) return null;
        this.ctx = new AudioCtx();
      }
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      if (!this.compressor || !this.masterGain) {
        const compressor = this.ctx.createDynamicsCompressor();
        compressor.threshold.setValueAtTime(-14, this.ctx.currentTime);
        compressor.knee.setValueAtTime(18, this.ctx.currentTime);
        compressor.ratio.setValueAtTime(6, this.ctx.currentTime);
        compressor.attack.setValueAtTime(0.005, this.ctx.currentTime);
        compressor.release.setValueAtTime(0.18, this.ctx.currentTime);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(this.isMuted ? 0 : this.masterVolume, this.ctx.currentTime);

        gain.connect(compressor);
        compressor.connect(this.ctx.destination);

        this.compressor = compressor;
        this.masterGain = gain;
      }
      return { ctx: this.ctx, masterGain: this.masterGain };
    } catch {
      return null;
    }
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  public setMuted(muted: boolean): void {
    this.isMuted = Boolean(muted);
    giftSoundEngine.setMuted(this.isMuted);
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(
        this.isMuted ? 0 : this.masterVolume,
        this.ctx.currentTime,
        0.02
      );
    }
    if (this.isMuted) {
      this.stopAll();
    }
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(MUTE_STORAGE_KEY, String(this.isMuted));
      } catch {
        // ignore
      }
    }
    this.muteListeners.forEach((cb) => {
      try {
        cb(this.isMuted);
      } catch {
        // ignore listener errors
      }
    });
  }

  public toggleMute(): boolean {
    this.setMuted(!this.isMuted);
    return this.isMuted;
  }

  public subscribeMute(listener: (muted: boolean) => void): () => void {
    this.muteListeners.add(listener);
    return () => {
      this.muteListeners.delete(listener);
    };
  }

  public getVolume(): number {
    return this.masterVolume;
  }

  public setVolume(volume: number): void {
    const clamped = Math.max(0, Math.min(1, Number(volume) || 0));
    this.masterVolume = clamped;
    if (this.masterGain && this.ctx && !this.isMuted) {
      this.masterGain.gain.setTargetAtTime(clamped, this.ctx.currentTime, 0.02);
    }
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(VOLUME_STORAGE_KEY, String(clamped));
      } catch {
        // ignore
      }
    }
  }

  public registerAssetMapping(trigger: string, assetPath: string): void {
    if (!trigger || !assetPath) return;
    this.customTriggerOverrides.set(trigger, assetPath);
    this.bufferCache.delete(assetPath);
  }

  public getAnimationMap(): Record<GiftAnimationTrigger, GiftAudioCueConfig> {
    return { ...GIFT_SFX_ASSET_MAP };
  }

  public resolveTriggerConfig(
    giftOrTrigger: Gift | GiftAnimationTrigger | string,
    giftIdOverride?: string
  ): {
    animationType: GiftAnimationTrigger;
    candidatePaths: string[];
    cueConfig: GiftAudioCueConfig;
  } {
    const isGiftObject = typeof giftOrTrigger === 'object' && giftOrTrigger !== null;
    const rawTrigger = isGiftObject
      ? giftOrTrigger.animationType
      : String(giftOrTrigger || '');
    const giftId =
      giftIdOverride ||
      (isGiftObject
        ? giftOrTrigger.id
        : rawTrigger.startsWith('gift_')
        ? rawTrigger
        : undefined);

    const cssClassToAnimMap: Record<string, GiftAnimationTrigger> = {
      'animate-supercar': 'car',
      'animate-rocket-launch': 'rocket',
      'animate-dragon-fly': 'dragon',
      'animate-yacht': 'yacht',
      'animate-crown-drop': 'crown',
      'animate-ring-levitate': 'ring',
      'animate-petal': 'heart',
      'animate-shockwave': 'sparkle',
      'animate-float-heart': 'sparkle',
      'animate-combo-pop': 'sparkle',
    };

    const giftIdToAnimMap: Record<string, GiftAnimationTrigger> = {
      gift_rose: 'sparkle',
      gift_ice_cream: 'sparkle',
      gift_heart: 'heart',
      gift_ring: 'ring',
      gift_crown: 'crown',
      gift_car: 'car',
      gift_yacht: 'yacht',
      gift_rocket: 'rocket',
      gift_dragon: 'dragon',
    };

    const normalizedAnim: GiftAnimationTrigger =
      rawTrigger in GIFT_SFX_ASSET_MAP
        ? (rawTrigger as GiftAnimationTrigger)
        : cssClassToAnimMap[rawTrigger] ||
          (giftId ? giftIdToAnimMap[giftId] : undefined) ||
          'sparkle';

    const cueConfig = GIFT_SFX_ASSET_MAP[normalizedAnim];
    const candidatePaths: string[] = [];

    if (giftId && this.customTriggerOverrides.has(giftId)) {
      candidatePaths.push(this.customTriggerOverrides.get(giftId)!);
    }
    if (rawTrigger && this.customTriggerOverrides.has(rawTrigger)) {
      candidatePaths.push(this.customTriggerOverrides.get(rawTrigger)!);
    }
    if (isGiftObject && typeof giftOrTrigger.audioAssetPath === 'string' && giftOrTrigger.audioAssetPath.trim()) {
      candidatePaths.push(giftOrTrigger.audioAssetPath.trim());
    }
    if (
      isGiftObject &&
      typeof giftOrTrigger.animationClassName === 'string' &&
      this.customTriggerOverrides.has(giftOrTrigger.animationClassName)
    ) {
      candidatePaths.push(this.customTriggerOverrides.get(giftOrTrigger.animationClassName)!);
    }
    if (this.customTriggerOverrides.has(normalizedAnim)) {
      candidatePaths.push(this.customTriggerOverrides.get(normalizedAnim)!);
    }
    if (giftId && GIFT_ID_SFX_ASSET_MAP[giftId]) {
      candidatePaths.push(GIFT_ID_SFX_ASSET_MAP[giftId]);
    }
    candidatePaths.push(cueConfig.assetPath);

    return {
      animationType: normalizedAnim,
      candidatePaths: Array.from(new Set(candidatePaths)),
      cueConfig,
    };
  }

  public getAssetPath(
    giftOrTrigger: Gift | GiftAnimationTrigger | string,
    giftIdOverride?: string
  ): string {
    return this.resolveTriggerConfig(giftOrTrigger, giftIdOverride).candidatePaths[0];
  }

  private async loadAndDecodeAsset(assetPath: string): Promise<AudioBuffer | null> {
    const cached = this.bufferCache.get(assetPath);
    if (cached) {
      return cached.status === 'decoded' ? cached.buffer : null;
    }

    const existingInflight = this.inflightLoads.get(assetPath);
    if (existingInflight) {
      return existingInflight;
    }

    const graph = this.ensureAudioGraph();
    if (!graph || typeof fetch === 'undefined') {
      return null;
    }

    const loadPromise = (async (): Promise<AudioBuffer | null> => {
      try {
        const res = await fetch(assetPath, { cache: 'force-cache' });
        if (!res.ok) {
          this.bufferCache.set(assetPath, { status: 'missing' });
          return null;
        }
        // Guard against SPA HTML fallbacks (e.g. Vite returning 200 index.html for missing assets)
        const contentType = (res.headers.get('content-type') || '').toLowerCase();
        if (contentType.includes('text/html') || contentType.includes('application/json')) {
          this.bufferCache.set(assetPath, { status: 'missing' });
          return null;
        }

        const arrayBuffer = await res.arrayBuffer();
        if (arrayBuffer.byteLength < 64) {
          this.bufferCache.set(assetPath, { status: 'missing' });
          return null;
        }

        const decoded = await graph.ctx.decodeAudioData(arrayBuffer.slice(0));
        this.bufferCache.set(assetPath, { status: 'decoded', buffer: decoded });
        return decoded;
      } catch {
        this.bufferCache.set(assetPath, { status: 'missing' });
        return null;
      } finally {
        this.inflightLoads.delete(assetPath);
      }
    })();

    this.inflightLoads.set(assetPath, loadPromise);
    return loadPromise;
  }

  public async preloadGiftSfx(triggers?: GiftAnimationTrigger[]): Promise<void> {
    const keys =
      triggers && triggers.length > 0
        ? triggers
        : (Object.keys(GIFT_SFX_ASSET_MAP) as GiftAnimationTrigger[]);
    const paths = new Set<string>(keys.map((k) => GIFT_SFX_ASSET_MAP[k].assetPath));
    if (!triggers || triggers.length === 0) {
      Object.values(GIFT_ID_SFX_ASSET_MAP).forEach((p) => paths.add(p));
      this.customTriggerOverrides.forEach((p) => paths.add(p));
    }
    paths.add(COMBO_SFX_ASSET_PATH);
    await Promise.allSettled(Array.from(paths).map((p) => this.loadAndDecodeAsset(p)));
  }

  public preloadAll(): Promise<void> {
    return this.preloadGiftSfx();
  }

  private playDecodedBuffer(
    buffer: AudioBuffer,
    volume: number,
    playbackRate: number = 1
  ): boolean {
    const graph = this.ensureAudioGraph();
    if (!graph) return false;
    try {
      const source = graph.ctx.createBufferSource();
      source.buffer = buffer;
      source.playbackRate.setValueAtTime(
        Math.max(0.5, Math.min(2.0, playbackRate)),
        graph.ctx.currentTime
      );

      const cueGain = graph.ctx.createGain();
      cueGain.gain.setValueAtTime(Math.max(0, Math.min(1.5, volume)), graph.ctx.currentTime);

      source.connect(cueGain);
      cueGain.connect(graph.masterGain);

      this.activeSources.add(source);
      source.onended = () => {
        this.activeSources.delete(source);
        try {
          source.disconnect();
          cueGain.disconnect();
        } catch {
          // ignore
        }
      };

      source.start(0);
      return true;
    } catch {
      return false;
    }
  }

  public async playGiftSfx(
    giftOrTrigger: Gift | GiftAnimationTrigger | string,
    options: PlayGiftSfxOptions = {}
  ): Promise<SfxPlaybackSource> {
    if (this.isMuted) return 'muted';

    const { animationType, candidatePaths, cueConfig } = this.resolveTriggerConfig(
      giftOrTrigger,
      options.giftId
    );
    const comboCount = Number(options.comboCount || 1);
    const effectiveVolume =
      typeof options.volume === 'number' ? options.volume : cueConfig.defaultVolume;
    const computedPlaybackRate =
      options.playbackRate ??
      (cueConfig.allowComboPitchShift && comboCount > 1
        ? 1 + Math.min(comboCount - 1, 10) * 0.03
        : 1);

    let playedFromAsset = false;

    for (const path of candidatePaths) {
      const cached = this.bufferCache.get(path);
      if (cached?.status === 'missing') continue;

      const buffer =
        cached?.status === 'decoded'
          ? cached.buffer
          : await this.loadAndDecodeAsset(path);

      if (buffer && this.playDecodedBuffer(buffer, effectiveVolume, computedPlaybackRate)) {
        playedFromAsset = true;
        break;
      }
    }

    if (!playedFromAsset) {
      giftSoundEngine.play(animationType);
    }

    if (comboCount > 1 && !options.skipComboSfx) {
      void this.playComboSfx(comboCount);
    }

    return playedFromAsset ? 'asset' : 'synth';
  }

  public async playComboSfx(multiplier: number): Promise<SfxPlaybackSource> {
    if (this.isMuted) return 'muted';
    const rate = 1 + Math.min(Math.max(multiplier - 1, 0), 14) * 0.04;
    const cached = this.bufferCache.get(COMBO_SFX_ASSET_PATH);

    if (cached?.status !== 'missing') {
      const buffer =
        cached?.status === 'decoded'
          ? cached.buffer
          : await this.loadAndDecodeAsset(COMBO_SFX_ASSET_PATH);
      if (buffer && this.playDecodedBuffer(buffer, 0.75, rate)) {
        return 'asset';
      }
    }

    giftSoundEngine.playComboSound(multiplier);
    return 'synth';
  }

  public async playVipEntrySfx(vipTier: number): Promise<SfxPlaybackSource> {
    if (this.isMuted) return 'muted';
    const tier = Math.max(1, Math.min(12, Math.floor(Number(vipTier) || 3)));
    const assetPath =
      tier >= 9
        ? '/audio/vip-entry-sovereign.mp3'
        : tier >= 6
        ? '/audio/vip-entry-imperial.mp3'
        : '/audio/vip-entry-gold.mp3';

    const cached = this.bufferCache.get(assetPath);
    if (cached?.status !== 'missing') {
      const buffer =
        cached?.status === 'decoded'
          ? cached.buffer
          : await this.loadAndDecodeAsset(assetPath);
      if (buffer && this.playDecodedBuffer(buffer, 0.85, 1)) {
        return 'asset';
      }
    }

    giftSoundEngine.playVipEntryFanfare(tier);
    return 'synth';
  }

  public stopAll(): void {
    this.activeSources.forEach((source) => {
      try {
        source.stop();
        source.disconnect();
      } catch {
        // ignore already-stopped sources
      }
    });
    this.activeSources.clear();
  }
}

export const audioManager = new GiftAudioManager();
export const giftAudioManager = audioManager;
