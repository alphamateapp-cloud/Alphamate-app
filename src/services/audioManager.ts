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

export const VIP_ENTRY_SFX_PATHS = [
  '/audio/vip-entry-gold.mp3',
  '/audio/vip-entry-imperial.mp3',
  '/audio/vip-entry-sovereign.mp3',
] as const;

export interface GiftAudioPreloadProgress {
  status: 'idle' | 'preloading' | 'ready';
  loaded: number;
  total: number;
  decodedCount: number;
}

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

export interface MediaAudioTrackOptions {
  /** Stable cache key (e.g. remote CDN URL even when playing from a local blob: URL) */
  cacheKey?: string;
  volume?: number;
  playbackRate?: number;
  /** Returns current video playback time in seconds right as audio starts so tracks stay in sync */
  getOffsetSec?: () => number;
  /** Abort remote audio fetch if slow network exceeds this timeout so fallback SFX plays promptly */
  fetchTimeoutMs?: number;
}

export interface MediaAudioTrackResult {
  played: boolean;
  reason?: 'muted' | 'no_audio' | 'fetch_failed' | 'timeout' | 'context_unavailable';
  stop: () => void;
}

const NOOP = () => {};
const MAX_DECODED_BUFFER_CACHE = 48;

class GiftAudioManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;

  private bufferCache = new Map<string, BufferCacheEntry>();
  private inflightLoads = new Map<string, Promise<{ buffer: AudioBuffer | null; reason?: 'no_audio' | 'fetch_failed' | 'timeout' }>>();
  private activeSources = new Set<AudioBufferSourceNode>();
  private customTriggerOverrides = new Map<string, string>();
  private muteListeners = new Set<(muted: boolean) => void>();

  private isMuted: boolean = false;
  private masterVolume: number = 0.85;
  private unlocked: boolean = false;
  private listenersAttached: boolean = false;

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
      this.attachGlobalUnlockListeners();
    }
  }

  private attachGlobalUnlockListeners(): void {
    if (typeof window === 'undefined' || this.listenersAttached) return;
    this.listenersAttached = true;

    const handleGesture = () => {
      void this.unlock();
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && this.ctx && this.ctx.state === 'suspended') {
        void this.ctx.resume().catch(() => {});
      }
    };

    window.addEventListener('pointerdown', handleGesture, { capture: true, passive: true });
    window.addEventListener('touchstart', handleGesture, { capture: true, passive: true });
    window.addEventListener('click', handleGesture, { capture: true, passive: true });
    window.addEventListener('keydown', handleGesture, { capture: true, passive: true });
    document.addEventListener('visibilitychange', handleVisibility);
  }

  public async unlock(): Promise<boolean> {
    const graph = this.ensureAudioGraph();
    const synthUnlock = giftSoundEngine.unlock();
    if (!graph) {
      await synthUnlock;
      return false;
    }
    try {
      if (graph.ctx.state === 'suspended') {
        await Promise.race([
          graph.ctx.resume(),
          new Promise<void>((resolve) => setTimeout(resolve, 180)),
        ]);
      }
      if (!this.unlocked && graph.ctx.state === 'running') {
        // Prime with 1-sample silent buffer so iOS Safari & Android WebView unlock immediately
        const silentBuf = graph.ctx.createBuffer(1, 1, graph.ctx.sampleRate || 44100);
        const src = graph.ctx.createBufferSource();
        src.buffer = silentBuf;
        src.connect(graph.ctx.destination);
        src.start(0);
        this.unlocked = true;
      }
      await synthUnlock;
      return graph.ctx.state === 'running';
    } catch {
      await synthUnlock;
      return false;
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

  private async ensureRunningGraph(
    timeoutMs = 220
  ): Promise<{ ctx: AudioContext; masterGain: GainNode } | null> {
    const graph = this.ensureAudioGraph();
    if (!graph) return null;
    if (graph.ctx.state === 'suspended') {
      try {
        await Promise.race([
          graph.ctx.resume(),
          new Promise<void>((resolve) => setTimeout(resolve, timeoutMs)),
        ]);
      } catch {
        // continue with best-effort playback
      }
    }
    return graph;
  }

  private cacheDecodedBuffer(key: string, buffer: AudioBuffer): void {
    this.bufferCache.delete(key);
    this.bufferCache.set(key, { status: 'decoded', buffer });
    // Cap decoded AudioBuffer memory during long Party Room sessions
    let decodedCount = 0;
    for (const entry of this.bufferCache.values()) {
      if (entry.status === 'decoded') decodedCount += 1;
    }
    if (decodedCount > MAX_DECODED_BUFFER_CACHE) {
      for (const [k, v] of this.bufferCache.entries()) {
        if (v.status === 'decoded') {
          this.bufferCache.delete(k);
          decodedCount -= 1;
          if (decodedCount <= MAX_DECODED_BUFFER_CACHE) break;
        }
      }
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
    if (this.customTriggerOverrides.get(trigger) === assetPath) return;
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

  public hasDecodedBuffer(cacheKey: string): boolean {
    return this.bufferCache.get(cacheKey)?.status === 'decoded';
  }

  public getBufferStats(): { decodedCount: number; missingCount: number } {
    let decodedCount = 0;
    let missingCount = 0;
    for (const entry of this.bufferCache.values()) {
      if (entry.status === 'decoded') decodedCount += 1;
      else missingCount += 1;
    }
    return { decodedCount, missingCount };
  }

  private async loadAndDecodeAssetDetailed(
    assetPath: string,
    options: {
      cacheKey?: string;
      fetchTimeoutMs?: number;
      cacheMissingOnNetworkError?: boolean;
      signal?: AbortSignal;
    } = {}
  ): Promise<{ buffer: AudioBuffer | null; reason?: 'no_audio' | 'fetch_failed' | 'timeout' }> {
    const cacheKey = options.cacheKey || assetPath;
    const cached = this.bufferCache.get(cacheKey);
    if (cached) {
      return cached.status === 'decoded'
        ? { buffer: cached.buffer }
        : { buffer: null, reason: 'no_audio' };
    }

    if (options.signal?.aborted) {
      return { buffer: null, reason: 'timeout' };
    }

    const existingInflight = this.inflightLoads.get(cacheKey);
    if (existingInflight) {
      return existingInflight;
    }

    const graph = this.ensureAudioGraph();
    if (!graph || typeof fetch === 'undefined') {
      return { buffer: null, reason: 'fetch_failed' };
    }

    const isBlobUrl = assetPath.startsWith('blob:');
    const timeoutMs = options.fetchTimeoutMs ?? (isBlobUrl ? 8000 : 3200);
    const cacheMissingOnNetworkError = options.cacheMissingOnNetworkError ?? true;

    const loadPromise = (async (): Promise<{
      buffer: AudioBuffer | null;
      reason?: 'no_audio' | 'fetch_failed' | 'timeout';
    }> => {
      let timerId: ReturnType<typeof setTimeout> | null = null;
      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      let timedOut = false;
      let externallyAborted = false;

      const onExternalAbort = () => {
        externallyAborted = true;
        controller?.abort();
      };

      if (options.signal) {
        if (options.signal.aborted) {
          return { buffer: null, reason: 'timeout' };
        }
        options.signal.addEventListener('abort', onExternalAbort, { once: true });
      }

      try {
        if (controller && timeoutMs > 0) {
          timerId = setTimeout(() => {
            timedOut = true;
            controller.abort();
          }, timeoutMs);
        }

        const res = await fetch(assetPath, {
          cache: isBlobUrl ? 'no-store' : 'force-cache',
          signal: controller?.signal,
        });
        if (!res.ok) {
          if (cacheMissingOnNetworkError && res.status === 404) {
            this.bufferCache.set(cacheKey, { status: 'missing' });
          }
          return { buffer: null, reason: 'fetch_failed' };
        }
        // Guard against SPA HTML fallbacks (e.g. Vite returning 200 index.html for missing assets)
        const contentType = (res.headers.get('content-type') || '').toLowerCase();
        if (contentType.includes('text/html') || contentType.includes('application/json')) {
          this.bufferCache.set(cacheKey, { status: 'missing' });
          return { buffer: null, reason: 'no_audio' };
        }

        const arrayBuffer = await res.arrayBuffer();
        if (timerId) {
          clearTimeout(timerId);
          timerId = null;
        }
        if (externallyAborted || options.signal?.aborted) {
          return { buffer: null, reason: 'timeout' };
        }
        if (arrayBuffer.byteLength < 64) {
          this.bufferCache.set(cacheKey, { status: 'missing' });
          return { buffer: null, reason: 'no_audio' };
        }

        try {
          const decoded = await graph.ctx.decodeAudioData(arrayBuffer.slice(0));
          if (!decoded || decoded.duration <= 0.02) {
            this.bufferCache.set(cacheKey, { status: 'missing' });
            return { buffer: null, reason: 'no_audio' };
          }
          this.cacheDecodedBuffer(cacheKey, decoded);
          return { buffer: decoded };
        } catch {
          // Valid media bytes fetched, but file contains no decodable audio track (e.g. silent WebM/MP4)
          this.bufferCache.set(cacheKey, { status: 'missing' });
          return { buffer: null, reason: 'no_audio' };
        }
      } catch {
        if (timedOut || externallyAborted) {
          return { buffer: null, reason: 'timeout' };
        }
        if (cacheMissingOnNetworkError) {
          this.bufferCache.set(cacheKey, { status: 'missing' });
        }
        return { buffer: null, reason: 'fetch_failed' };
      } finally {
        if (timerId) clearTimeout(timerId);
        if (options.signal) {
          options.signal.removeEventListener('abort', onExternalAbort);
        }
        this.inflightLoads.delete(cacheKey);
      }
    })();

    this.inflightLoads.set(cacheKey, loadPromise);
    return loadPromise;
  }

  private async loadAndDecodeAsset(
    assetPath: string,
    signal?: AbortSignal
  ): Promise<AudioBuffer | null> {
    const res = await this.loadAndDecodeAssetDetailed(assetPath, { signal });
    return res.buffer;
  }

  public async preloadGiftSfx(
    triggers?: GiftAnimationTrigger[],
    options: {
      extraPaths?: string[];
      includeVipEntry?: boolean;
      concurrency?: number;
      signal?: AbortSignal;
      onItemComplete?: (done: number, total: number) => void;
    } = {}
  ): Promise<{ decoded: number; total: number }> {
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
    if (options.includeVipEntry !== false) {
      VIP_ENTRY_SFX_PATHS.forEach((p) => paths.add(p));
    }
    if (options.extraPaths) {
      options.extraPaths.forEach((p) => {
        if (typeof p === 'string' && p.trim()) paths.add(p.trim());
      });
    }

    const pathList = Array.from(paths);
    const total = pathList.length;
    if (total === 0) return { decoded: 0, total: 0 };

    const concurrency = Math.max(1, Math.min(6, options.concurrency ?? 4));
    let cursor = 0;
    let done = 0;
    let decoded = 0;

    const worker = async () => {
      while (cursor < pathList.length) {
        if (options.signal?.aborted) return;
        const nextPath = pathList[cursor++];
        const buf = await this.loadAndDecodeAsset(nextPath, options.signal);
        if (buf) decoded += 1;
        done += 1;
        options.onItemComplete?.(done, total);
      }
    };

    await Promise.all(Array.from({ length: Math.min(concurrency, total) }, () => worker()));
    return { decoded, total };
  }

  public async preloadMediaAudioTrack(
    mediaUrl: string,
    options: { cacheKey?: string; fetchTimeoutMs?: number; signal?: AbortSignal } = {}
  ): Promise<boolean> {
    if (!mediaUrl || options.signal?.aborted) return false;
    const cacheKey = options.cacheKey || mediaUrl;
    const existing = this.bufferCache.get(cacheKey);
    if (existing) {
      return existing.status === 'decoded';
    }
    const res = await this.loadAndDecodeAssetDetailed(mediaUrl, {
      cacheKey,
      fetchTimeoutMs: options.fetchTimeoutMs ?? (mediaUrl.startsWith('blob:') ? 8000 : 4500),
      cacheMissingOnNetworkError: false,
      signal: options.signal,
    });
    return Boolean(res.buffer);
  }

  public async preloadMediaAudioTracks(
    entries: Array<{ url: string; cacheKey?: string }>,
    options: {
      concurrency?: number;
      signal?: AbortSignal;
      onItemComplete?: (done: number, total: number) => void;
    } = {}
  ): Promise<{ decoded: number; skipped: number; failed: number }> {
    const deduped: Array<{ url: string; cacheKey: string }> = [];
    const seen = new Set<string>();
    for (const item of entries) {
      if (!item?.url) continue;
      const key = item.cacheKey || item.url;
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push({ url: item.url, cacheKey: key });
    }

    const total = deduped.length;
    if (total === 0) return { decoded: 0, skipped: 0, failed: 0 };

    const concurrency = Math.max(1, Math.min(4, options.concurrency ?? 2));
    let cursor = 0;
    let done = 0;
    let decoded = 0;
    let skipped = 0;
    let failed = 0;

    const worker = async () => {
      while (cursor < deduped.length) {
        if (options.signal?.aborted) return;
        const entry = deduped[cursor++];
        const existing = this.bufferCache.get(entry.cacheKey);
        if (existing) {
          if (existing.status === 'decoded') decoded += 1;
          else skipped += 1;
          done += 1;
          options.onItemComplete?.(done, total);
          continue;
        }
        const ok = await this.preloadMediaAudioTrack(entry.url, {
          cacheKey: entry.cacheKey,
          signal: options.signal,
        });
        if (ok) decoded += 1;
        else failed += 1;
        done += 1;
        options.onItemComplete?.(done, total);
      }
    };

    await Promise.all(Array.from({ length: Math.min(concurrency, total) }, () => worker()));
    return { decoded, skipped, failed };
  }

  public async preloadAll(): Promise<void> {
    await this.preloadGiftSfx();
  }

  private startDecodedBuffer(
    graph: { ctx: AudioContext; masterGain: GainNode },
    buffer: AudioBuffer,
    volume: number,
    playbackRate: number = 1,
    offsetSec: number = 0
  ): (() => void) | null {
    try {
      const safeOffset = Math.max(0, offsetSec);
      if (safeOffset >= Math.max(0.05, buffer.duration - 0.05)) {
        return null;
      }

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

      let stopped = false;
      const cleanup = () => {
        if (stopped) return;
        stopped = true;
        this.activeSources.delete(source);
        try {
          source.stop();
        } catch {
          // already ended
        }
        try {
          source.disconnect();
          cueGain.disconnect();
        } catch {
          // ignore
        }
      };

      this.activeSources.add(source);
      source.onended = () => {
        stopped = true;
        this.activeSources.delete(source);
        try {
          source.disconnect();
          cueGain.disconnect();
        } catch {
          // ignore
        }
      };

      source.start(0, safeOffset);
      return cleanup;
    } catch {
      return null;
    }
  }

  /**
   * Voice-Safe Embedded Media Audio Player:
   * Demuxes & decodes the embedded audio track from WebM / MP4 / MOV gift videos through
   * Web Audio API so EVERY user (sender + passive remote listeners) hears crystal-clear
   * gift sound alongside live Agora Party Voice — with ZERO Android AudioFocus loss and
   * ZERO <video> autoplay NotAllowedError!
   */
  public async playMediaAudioTrack(
    mediaUrl: string,
    options: MediaAudioTrackOptions = {}
  ): Promise<MediaAudioTrackResult> {
    if (this.isMuted || !mediaUrl) {
      return { played: false, reason: 'muted', stop: NOOP };
    }

    const graph = await this.ensureRunningGraph(240);
    if (!graph) {
      return { played: false, reason: 'context_unavailable', stop: NOOP };
    }

    const decodedRes = await this.loadAndDecodeAssetDetailed(mediaUrl, {
      cacheKey: options.cacheKey || mediaUrl,
      fetchTimeoutMs: options.fetchTimeoutMs ?? (mediaUrl.startsWith('blob:') ? 8000 : 2800),
      cacheMissingOnNetworkError: false,
    });

    if (this.isMuted) {
      return { played: false, reason: 'muted', stop: NOOP };
    }
    if (!decodedRes.buffer) {
      return { played: false, reason: decodedRes.reason || 'no_audio', stop: NOOP };
    }

    // Re-ensure context is running right before scheduling in case tab resumed mid-decode
    const activeGraph = await this.ensureRunningGraph(140);
    if (!activeGraph || this.isMuted) {
      return { played: false, reason: this.isMuted ? 'muted' : 'context_unavailable', stop: NOOP };
    }

    const offsetSec = Math.max(0, Number(options.getOffsetSec?.() ?? 0) || 0);
    const volume = typeof options.volume === 'number' ? options.volume : 0.78;
    const playbackRate = typeof options.playbackRate === 'number' ? options.playbackRate : 1;

    const stopHandle = this.startDecodedBuffer(
      activeGraph,
      decodedRes.buffer,
      volume,
      playbackRate,
      offsetSec
    );

    if (!stopHandle) {
      return { played: false, reason: 'context_unavailable', stop: NOOP };
    }
    return { played: true, stop: stopHandle };
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

    const graph = await this.ensureRunningGraph(220);
    let playedFromAsset = false;

    if (graph && !this.isMuted) {
      for (const path of candidatePaths) {
        const cached = this.bufferCache.get(path);
        if (cached?.status === 'missing') continue;

        const buffer =
          cached?.status === 'decoded'
            ? cached.buffer
            : await this.loadAndDecodeAsset(path);

        if (this.isMuted) return 'muted';
        if (buffer && this.startDecodedBuffer(graph, buffer, effectiveVolume, computedPlaybackRate)) {
          playedFromAsset = true;
          break;
        }
      }
    }

    if (!playedFromAsset && !this.isMuted) {
      giftSoundEngine.play(animationType, effectiveVolume);
    }

    if (comboCount > 1 && !options.skipComboSfx && !this.isMuted) {
      void this.playComboSfx(comboCount);
    }

    return playedFromAsset ? 'asset' : 'synth';
  }

  public async playComboSfx(multiplier: number): Promise<SfxPlaybackSource> {
    if (this.isMuted) return 'muted';
    const rate = 1 + Math.min(Math.max(multiplier - 1, 0), 14) * 0.04;
    const cached = this.bufferCache.get(COMBO_SFX_ASSET_PATH);
    const graph = await this.ensureRunningGraph(180);

    if (graph && cached?.status !== 'missing') {
      const buffer =
        cached?.status === 'decoded'
          ? cached.buffer
          : await this.loadAndDecodeAsset(COMBO_SFX_ASSET_PATH);
      if (this.isMuted) return 'muted';
      if (buffer && this.startDecodedBuffer(graph, buffer, 0.75, rate)) {
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
    const graph = await this.ensureRunningGraph(200);
    if (graph && cached?.status !== 'missing') {
      const buffer =
        cached?.status === 'decoded'
          ? cached.buffer
          : await this.loadAndDecodeAsset(assetPath);
      if (this.isMuted) return 'muted';
      if (buffer && this.startDecodedBuffer(graph, buffer, 0.85, 1)) {
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
