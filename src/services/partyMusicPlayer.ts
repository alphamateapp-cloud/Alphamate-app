import type { PartyMusicTrack } from '../types';
import { resolvePlayableStreamUrls } from './partyMusicService';

export interface PartyMusicSyncInput {
  roomId: string;
  isPlaying: boolean;
  track: PartyMusicTrack | null;
  startedAtMs?: number;
  positionSec?: number;
  loop?: boolean;
  speakerOn: boolean;
}

export interface PartyMusicPlaybackSnapshot {
  isPlaying: boolean;
  isLoading: boolean;
  isAutoplayBlocked: boolean;
  isPreviewMode: boolean;
  previewTrackId: string | null;
  currentTimeSec: number;
  durationSec: number;
  localVolume: number;
  localMuted: boolean;
  voiceDuckingEnabled: boolean;
  isCurrentlyDucked: boolean;
  errorMessage: string | null;
}

type SnapshotListener = (snapshot: PartyMusicPlaybackSnapshot) => void;
type TrackEndedListener = (track: PartyMusicTrack) => void;

const STORAGE_VOLUME_KEY = 'alphamate_party_music_volume';
const STORAGE_MUTED_KEY = 'alphamate_party_music_muted';
const STORAGE_DUCKING_KEY = 'alphamate_party_music_ducking';

const DEFAULT_BACKGROUND_VOLUME = 0.28; // Balanced so Party Voice always stays dominant & clear
const VOICE_DUCK_MULTIPLIER = 0.46; // Ducks background music smoothly while anyone speaks
const VOICE_DUCK_RELEASE_MS = 580;
const MAX_SYNC_DRIFT_SEC = 2.2;

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_BACKGROUND_VOLUME;
  return Math.max(0, Math.min(1, value));
}

function readStoredNumber(key: string, fallback: number): number {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return fallback;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? clamp01(parsed) : fallback;
  } catch {
    return fallback;
  }
}

function readStoredBool(key: string, fallback: boolean): boolean {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return fallback;
    return raw === 'true';
  } catch {
    return fallback;
  }
}

/**
 * Voice-Safe Synchronized Party Room Background Music Engine.
 *
 * Architecture highlights:
 * - Plays streamed songs via HTML5 <audio> alongside Agora Party Voice without muting mics or speakers.
 * - Uses timestamp-based playback sync (`startedAtMs` + `positionSec`) so Host, Seated Guests, and
 *   Viewers (including late joiners) stay synchronized on the same beat.
 * - Automatic Smart Voice Ducking gently lowers background music whenever anyone speaks, then
 *   smoothly restores the user's chosen music volume when voices pause.
 * - Optional CORS-clean Web Audio AnalyserNode tap exposes real-time music beat energy for the
 *   Party Room frequency visualizer, with automatic fallback to direct HTTPS playback if CORS fails.
 */
class PartyMusicPlayer {
  private audioEl: HTMLAudioElement | null = null;
  private audioCtx: AudioContext | null = null;
  private sourceNode: MediaElementAudioSourceNode | null = null;
  private gainNode: GainNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  private freqBuf: Uint8Array<ArrayBuffer> | null = null;
  private webAudioConnected = false;

  private activeRoomSync: PartyMusicSyncInput | null = null;
  private activeTrackId: string | null = null;
  private activeUrlCandidate: 'primary' | 'fallback' = 'primary';
  private activeTrack: PartyMusicTrack | null = null;

  private previewTrack: PartyMusicTrack | null = null;
  private isLoading = false;
  private isAutoplayBlocked = false;
  private errorMessage: string | null = null;
  private speakerOn = true;

  private localVolume: number = typeof window !== 'undefined'
    ? readStoredNumber(STORAGE_VOLUME_KEY, DEFAULT_BACKGROUND_VOLUME)
    : DEFAULT_BACKGROUND_VOLUME;
  private localMuted: boolean = typeof window !== 'undefined'
    ? readStoredBool(STORAGE_MUTED_KEY, false)
    : false;
  private voiceDuckingEnabled: boolean = typeof window !== 'undefined'
    ? readStoredBool(STORAGE_DUCKING_KEY, true)
    : true;
  private isCurrentlyDucked = false;
  private duckReleaseTimer: ReturnType<typeof setTimeout> | null = null;

  private listeners = new Set<SnapshotListener>();
  private trackEndedListeners = new Set<TrackEndedListener>();
  private unlockListenersBound = false;
  private pendingSyncSeekSec: number | null = null;
  private lastEmitMs = 0;

  private ensureAudioElement(useCors: boolean): HTMLAudioElement {
    if (this.audioEl && this.webAudioConnected && !useCors) {
      // If an earlier MediaElementAudioSourceNode was bound with CORS, recreate element cleanly for non-CORS fallback
      this.teardownAudioElement();
    }

    if (!this.audioEl) {
      const el = document.createElement('audio');
      el.preload = 'auto';
      (el as any).playsInline = true;
      el.setAttribute('playsinline', 'true');
      el.setAttribute('webkit-playsinline', 'true');
      if (useCors) {
        el.crossOrigin = 'anonymous';
      }
      el.volume = this.computeTargetGain();
      this.bindElementEvents(el);
      this.audioEl = el;
    }

    return this.audioEl;
  }

  private teardownAudioElement(): void {
    if (this.sourceNode) {
      try {
        this.sourceNode.disconnect();
      } catch {
        // ignore
      }
      this.sourceNode = null;
    }
    if (this.gainNode) {
      try {
        this.gainNode.disconnect();
      } catch {
        // ignore
      }
      this.gainNode = null;
    }
    if (this.analyserNode) {
      try {
        this.analyserNode.disconnect();
      } catch {
        // ignore
      }
      this.analyserNode = null;
    }
    this.freqBuf = null;
    this.webAudioConnected = false;

    if (this.audioEl) {
      try {
        this.audioEl.pause();
        this.audioEl.removeAttribute('src');
        this.audioEl.load();
      } catch {
        // ignore
      }
      this.audioEl = null;
    }
  }

  private tryAttachWebAudioGraph(el: HTMLAudioElement): void {
    if (this.webAudioConnected || !el.crossOrigin) return;
    if (typeof window === 'undefined') return;
    const AudioCtxCtor = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtxCtor) return;

    try {
      if (!this.audioCtx || this.audioCtx.state === 'closed') {
        this.audioCtx = new AudioCtxCtor();
      }
      const ctx = this.audioCtx;
      const source = ctx.createMediaElementSource(el);
      const gain = ctx.createGain();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 128;
      analyser.smoothingTimeConstant = 0.78;

      gain.gain.value = this.computeTargetGain();
      el.volume = 1; // GainNode controls smooth volume/ducking when Web Audio is attached

      source.connect(gain);
      gain.connect(analyser);
      analyser.connect(ctx.destination);

      this.sourceNode = source;
      this.gainNode = gain;
      this.analyserNode = analyser;
      this.freqBuf = new Uint8Array(analyser.frequencyBinCount);
      this.webAudioConnected = true;
    } catch {
      // Fallback safely to native HTMLAudioElement volume control
      this.webAudioConnected = false;
      el.volume = this.computeTargetGain();
    }
  }

  private bindElementEvents(el: HTMLAudioElement): void {
    el.addEventListener('playing', () => {
      if (this.audioEl !== el) return;
      this.isLoading = false;
      this.isAutoplayBlocked = false;
      this.errorMessage = null;
      this.applyTargetGain(false);
      this.emit(true);
    });

    el.addEventListener('waiting', () => {
      if (this.audioEl !== el) return;
      this.isLoading = true;
      this.emit(true);
    });

    el.addEventListener('canplay', () => {
      if (this.audioEl !== el) return;
      this.isLoading = false;
      if (this.pendingSyncSeekSec !== null && Number.isFinite(el.duration) && el.duration > 1) {
        const clamped = Math.max(0, Math.min(el.duration - 0.5, this.pendingSyncSeekSec));
        if (Math.abs(el.currentTime - clamped) > MAX_SYNC_DRIFT_SEC) {
          try {
            el.currentTime = clamped;
          } catch {
            // ignore seek error on non-seekable stream
          }
        }
        this.pendingSyncSeekSec = null;
      }
      this.emit(true);
    });

    el.addEventListener('timeupdate', () => {
      if (this.audioEl !== el) return;
      this.emit(false);
    });

    el.addEventListener('pause', () => {
      if (this.audioEl !== el) return;
      this.emit(true);
    });

    el.addEventListener('ended', () => {
      if (this.audioEl !== el) return;
      if (this.previewTrack) {
        this.stopPreview();
        return;
      }
      if (this.activeRoomSync?.loop && this.activeRoomSync.isPlaying) {
        try {
          el.currentTime = 0;
          void el.play().catch(() => {});
          return;
        } catch {
          // ignore
        }
      }
      const endedTrack = this.activeTrack;
      this.emit(true);
      if (endedTrack) {
        this.trackEndedListeners.forEach((cb) => {
          try {
            cb(endedTrack);
          } catch {
            // ignore
          }
        });
      }
    });

    el.addEventListener('error', () => {
      if (this.audioEl !== el) return;
      const track = this.previewTrack || this.activeTrack;
      if (!track) return;

      // If primary CORS proxy URL failed, automatically fall back to direct HTTPS stream without CORS
      if (this.activeUrlCandidate === 'primary') {
        const { fallbackUrl } = resolvePlayableStreamUrls(track);
        if (fallbackUrl) {
          this.activeUrlCandidate = 'fallback';
          this.loadAndPlayUrl(track, fallbackUrl, false, this.computeExpectedSyncSec());
          return;
        }
      }

      this.isLoading = false;
      this.errorMessage = 'Could not stream this track. Try another song.';
      this.emit(true);
    });
  }

  private bindAutoplayUnlockListeners(): void {
    if (this.unlockListenersBound || typeof window === 'undefined') return;
    this.unlockListenersBound = true;

    const handleGesture = () => {
      this.unlock();
    };

    window.addEventListener('pointerdown', handleGesture, { passive: true });
    window.addEventListener('touchstart', handleGesture, { passive: true });
    window.addEventListener('keydown', handleGesture, { passive: true });
  }

  public unlock(): void {
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
    if (this.isAutoplayBlocked && this.audioEl) {
      const shouldBePlaying = Boolean(this.previewTrack || (this.activeRoomSync?.isPlaying && this.activeRoomSync?.track));
      if (shouldBePlaying && this.audioEl.paused) {
        this.applyTargetGain(false);
        this.audioEl
          .play()
          .then(() => {
            this.isAutoplayBlocked = false;
            this.errorMessage = null;
            this.emit(true);
          })
          .catch(() => {
            // Still locked; will retry on next gesture
          });
      }
    }
  }

  private computeTargetGain(): number {
    if (!this.speakerOn || this.localMuted) return 0;
    const base = this.previewTrack ? Math.max(0.32, this.localVolume) : this.localVolume;
    const duckFactor = !this.previewTrack && this.voiceDuckingEnabled && this.isCurrentlyDucked
      ? VOICE_DUCK_MULTIPLIER
      : 1;
    return clamp01(base * duckFactor);
  }

  private applyTargetGain(smooth: boolean): void {
    const target = this.computeTargetGain();
    if (this.webAudioConnected && this.gainNode && this.audioCtx && this.audioCtx.state !== 'closed') {
      const now = this.audioCtx.currentTime;
      try {
        this.gainNode.gain.cancelScheduledValues(now);
        if (smooth) {
          this.gainNode.gain.setTargetAtTime(target, now, 0.14);
        } else {
          this.gainNode.gain.setValueAtTime(target, now);
        }
      } catch {
        this.gainNode.gain.value = target;
      }
      if (this.audioEl) this.audioEl.volume = 1;
      return;
    }

    if (this.audioEl) {
      this.audioEl.volume = target;
    }
  }

  private computeExpectedSyncSec(): number {
    if (this.previewTrack) return 0;
    const sync = this.activeRoomSync;
    if (!sync || !sync.track) return 0;
    const basePos = Math.max(0, Number(sync.positionSec) || 0);
    if (!sync.isPlaying || !sync.startedAtMs) return basePos;
    const elapsedSec = Math.max(0, (Date.now() - sync.startedAtMs) / 1000);
    const total = basePos + elapsedSec;
    const dur = Math.max(10, Number(sync.track.durationSec) || 30);
    if (sync.loop && dur > 0) {
      return total % dur;
    }
    return Math.min(Math.max(0, dur - 0.5), total);
  }

  private loadAndPlayUrl(
    track: PartyMusicTrack,
    url: string,
    useCors: boolean,
    targetStartSec: number
  ): void {
    this.bindAutoplayUnlockListeners();
    const el = this.ensureAudioElement(useCors);
    if (useCors) {
      this.tryAttachWebAudioGraph(el);
    }

    this.isLoading = true;
    this.errorMessage = null;
    this.pendingSyncSeekSec = targetStartSec > 1.5 ? targetStartSec : null;

    try {
      el.pause();
      el.src = url;
      el.load();
    } catch {
      // ignore load exception
    }

    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }

    this.applyTargetGain(false);
    const playPromise = el.play();
    if (playPromise && typeof playPromise.then === 'function') {
      playPromise
        .then(() => {
          this.isAutoplayBlocked = false;
          this.isLoading = false;
          this.emit(true);
        })
        .catch((err) => {
          const errName = String(err?.name || '');
          if (errName === 'NotAllowedError' || errName === 'AbortError') {
            this.isAutoplayBlocked = errName === 'NotAllowedError';
            this.isLoading = false;
            this.emit(true);
          } else {
            // Network/decode error will also fire element `error` event and trigger fallback
            this.isLoading = false;
            this.emit(true);
          }
        });
    }
    this.emit(true);
  }

  public syncToRoomState(input: PartyMusicSyncInput): void {
    this.speakerOn = input.speakerOn;
    this.activeRoomSync = input;

    // While user is privately previewing a song, keep room state updated in background without interrupting preview
    if (this.previewTrack) {
      this.applyTargetGain(true);
      return;
    }

    if (!input.track || !input.isPlaying) {
      this.activeTrack = input.track;
      this.activeTrackId = input.track?.id || null;
      this.isLoading = false;
      this.isAutoplayBlocked = false;
      if (this.audioEl && !this.audioEl.paused) {
        try {
          this.audioEl.pause();
        } catch {
          // ignore
        }
      }
      this.emit(true);
      return;
    }

    const incomingTrack = input.track;
    const isSameTrack = this.activeTrackId === incomingTrack.id && Boolean(this.audioEl?.src);
    const expectedSec = this.computeExpectedSyncSec();

    if (!isSameTrack) {
      this.activeTrack = incomingTrack;
      this.activeTrackId = incomingTrack.id;
      const { primaryUrl, fallbackUrl } = resolvePlayableStreamUrls(incomingTrack);
      const isSameOriginOrProxy =
        primaryUrl.startsWith('/api/') ||
        (typeof window !== 'undefined' && primaryUrl.startsWith(window.location.origin));
      this.activeUrlCandidate = 'primary';
      const chosenUrl = primaryUrl || fallbackUrl || '';
      if (!chosenUrl) {
        this.errorMessage = 'No playable audio stream for this track.';
        this.emit(true);
        return;
      }
      this.loadAndPlayUrl(incomingTrack, chosenUrl, isSameOriginOrProxy, expectedSec);
      return;
    }

    // Same track is already loaded: resume if paused and correct large sync drift
    this.activeTrack = incomingTrack;
    const el = this.audioEl;
    if (!el) return;

    this.applyTargetGain(true);

    if (Number.isFinite(el.duration) && el.duration > 1) {
      const clampedExpected = Math.max(0, Math.min(el.duration - 0.5, expectedSec));
      if (Math.abs(el.currentTime - clampedExpected) > MAX_SYNC_DRIFT_SEC) {
        try {
          el.currentTime = clampedExpected;
        } catch {
          // ignore
        }
      }
    }

    if (el.paused) {
      if (this.audioCtx && this.audioCtx.state === 'suspended') {
        this.audioCtx.resume().catch(() => {});
      }
      el.play()
        .then(() => {
          this.isAutoplayBlocked = false;
          this.emit(true);
        })
        .catch((err) => {
          if (err?.name === 'NotAllowedError') {
            this.isAutoplayBlocked = true;
            this.emit(true);
          }
        });
    }
  }

  public startPreview(track: PartyMusicTrack): void {
    this.previewTrack = track;
    this.activeUrlCandidate = 'primary';
    const { primaryUrl, fallbackUrl } = resolvePlayableStreamUrls(track);
    const isSameOriginOrProxy =
      primaryUrl.startsWith('/api/') ||
      (typeof window !== 'undefined' && primaryUrl.startsWith(window.location.origin));
    const chosenUrl = primaryUrl || fallbackUrl || '';
    if (!chosenUrl) return;
    this.loadAndPlayUrl(track, chosenUrl, isSameOriginOrProxy, 0);
  }

  public stopPreview(): void {
    if (!this.previewTrack) return;
    this.previewTrack = null;
    this.activeTrackId = null; // Force clean re-sync back to live room track
    if (this.audioEl) {
      try {
        this.audioEl.pause();
      } catch {
        // ignore
      }
    }
    if (this.activeRoomSync) {
      this.syncToRoomState(this.activeRoomSync);
    } else {
      this.emit(true);
    }
  }

  public stopAll(): void {
    this.previewTrack = null;
    this.activeRoomSync = null;
    this.activeTrack = null;
    this.activeTrackId = null;
    this.isLoading = false;
    this.isAutoplayBlocked = false;
    this.errorMessage = null;
    if (this.duckReleaseTimer) {
      clearTimeout(this.duckReleaseTimer);
      this.duckReleaseTimer = null;
    }
    this.isCurrentlyDucked = false;
    if (this.audioEl) {
      try {
        this.audioEl.pause();
        this.audioEl.removeAttribute('src');
        this.audioEl.load();
      } catch {
        // ignore
      }
    }
    this.emit(true);
  }

  public setSpeakerOn(on: boolean): void {
    this.speakerOn = on;
    this.applyTargetGain(true);
    this.emit(true);
  }

  public setLocalVolume(volume: number): void {
    this.localVolume = clamp01(volume);
    if (this.localVolume > 0.01 && this.localMuted) {
      this.localMuted = false;
      try {
        window.localStorage.setItem(STORAGE_MUTED_KEY, 'false');
      } catch {
        // ignore
      }
    }
    try {
      window.localStorage.setItem(STORAGE_VOLUME_KEY, String(this.localVolume));
    } catch {
      // ignore
    }
    this.applyTargetGain(false);
    this.emit(true);
  }

  public setLocalMuted(muted: boolean): void {
    this.localMuted = muted;
    try {
      window.localStorage.setItem(STORAGE_MUTED_KEY, String(muted));
    } catch {
      // ignore
    }
    this.applyTargetGain(false);
    this.emit(true);
  }

  public setVoiceDuckingEnabled(enabled: boolean): void {
    this.voiceDuckingEnabled = enabled;
    try {
      window.localStorage.setItem(STORAGE_DUCKING_KEY, String(enabled));
    } catch {
      // ignore
    }
    this.applyTargetGain(true);
    this.emit(true);
  }

  /**
   * Called reactively from PartyRoomsScreen when Host or any Seated Speaker talks.
   * Gently ducks background music while someone speaks and smoothly restores volume afterwards.
   */
  public setVoiceDuckingActive(isAnyoneSpeaking: boolean): void {
    if (isAnyoneSpeaking) {
      if (this.duckReleaseTimer) {
        clearTimeout(this.duckReleaseTimer);
        this.duckReleaseTimer = null;
      }
      if (!this.isCurrentlyDucked) {
        this.isCurrentlyDucked = true;
        this.applyTargetGain(true);
        this.emit(false);
      }
      return;
    }

    if (this.isCurrentlyDucked && !this.duckReleaseTimer) {
      this.duckReleaseTimer = setTimeout(() => {
        this.duckReleaseTimer = null;
        this.isCurrentlyDucked = false;
        this.applyTargetGain(true);
        this.emit(false);
      }, VOICE_DUCK_RELEASE_MS);
    }
  }

  public getCurrentPositionSec(): number {
    if (this.audioEl && Number.isFinite(this.audioEl.currentTime)) {
      return this.audioEl.currentTime;
    }
    return this.computeExpectedSyncSec();
  }

  /**
   * Real-time live energy tap (0..1) for PartyAudioVisualizer.
   * Zero allocations on the 60fps animation loop.
   */
  public getMusicEnergy(): number {
    if (!this.audioEl || this.audioEl.paused || !this.speakerOn || this.localMuted) {
      return 0;
    }
    if (this.webAudioConnected && this.analyserNode && this.freqBuf && this.audioCtx?.state === 'running') {
      this.analyserNode.getByteFrequencyData(this.freqBuf);
      const bins = Math.min(24, this.freqBuf.length);
      let sum = 0;
      for (let i = 0; i < bins; i++) {
        sum += this.freqBuf[i];
      }
      const avg = sum / Math.max(1, bins) / 255;
      return Math.min(1, avg * 1.45);
    }
    // Gentle non-CORS fallback beat energy when audio is actively streaming
    return Math.min(0.45, this.localVolume * 0.65);
  }

  public getSnapshot(): PartyMusicPlaybackSnapshot {
    const el = this.audioEl;
    const isPlaying = Boolean(el && !el.paused && !el.ended);
    const active = this.previewTrack || this.activeTrack;
    const rawDuration = el && Number.isFinite(el.duration) && el.duration > 0
      ? el.duration
      : active?.durationSec || 0;
    return {
      isPlaying,
      isLoading: this.isLoading,
      isAutoplayBlocked: this.isAutoplayBlocked,
      isPreviewMode: Boolean(this.previewTrack),
      previewTrackId: this.previewTrack?.id || null,
      currentTimeSec: el && Number.isFinite(el.currentTime) ? el.currentTime : 0,
      durationSec: rawDuration,
      localVolume: this.localVolume,
      localMuted: this.localMuted,
      voiceDuckingEnabled: this.voiceDuckingEnabled,
      isCurrentlyDucked: this.isCurrentlyDucked && this.voiceDuckingEnabled,
      errorMessage: this.errorMessage,
    };
  }

  public subscribe(listener: SnapshotListener): () => void {
    this.listeners.add(listener);
    listener(this.getSnapshot());
    return () => {
      this.listeners.delete(listener);
    };
  }

  public onTrackEnded(listener: TrackEndedListener): () => void {
    this.trackEndedListeners.add(listener);
    return () => {
      this.trackEndedListeners.delete(listener);
    };
  }

  private emit(force: boolean): void {
    const now = Date.now();
    if (!force && now - this.lastEmitMs < 240) return;
    this.lastEmitMs = now;
    const snap = this.getSnapshot();
    this.listeners.forEach((cb) => {
      try {
        cb(snap);
      } catch {
        // ignore
      }
    });
  }
}

export const partyMusicPlayer = new PartyMusicPlayer();
