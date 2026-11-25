import { useEffect, useState } from 'react';

/**
 * Alpha Mate Smart Network Mode Engine.
 *
 * Classifies actual live connection quality into 5 actionable tiers:
 *   - 'fast'      : High throughput, low RTT, low packet loss -> High quality media & HD streams
 *   - 'normal_4g' : Balanced mobile 4G -> Optimized 720p media & balanced bitrate
 *   - 'weak_4g'   : High latency / throttled downlink / packet loss -> Low bandwidth mode
 *   - 'very_weak' : Severe congestion / 2G / Save-Data / >8% loss -> Disable autoplay & load lightweight assets
 *   - 'offline'   : No connectivity -> Serve cached content only
 *
 * IMPORTANT: Never relies solely on navigator.connection.effectiveType ("4g"/"5g" label).
 * Continuously fuses measured HTTP RTT/throughput, Agora network quality scores, and WebRTC packet loss.
 */

export type SmartNetworkTier = 'fast' | 'normal_4g' | 'weak_4g' | 'very_weak' | 'offline';

export interface SmartNetworkPolicy {
  tier: SmartNetworkTier;
  isOffline: boolean;
  /** Target max width & quality for remote images (Unsplash/CDN) */
  imageMaxWidth: number;
  imageQuality: number;
  thumbnailWidth: number;
  thumbnailQuality: number;
  /** Whether short-form feed / story videos should autoplay */
  autoplayVideos: boolean;
  /** HTML5 <video preload> strategy for active and next slides */
  activeVideoPreload: 'auto' | 'metadata' | 'none';
  nextVideoPreload: 'auto' | 'metadata' | 'none';
  /** Whether background gift animation downloads / audio pre-decoding should run */
  allowBackgroundGiftPrewarm: boolean;
  maxUncachedGiftAudioPreloads: number;
  /** Adaptive Live Video & Voice targets */
  liveVideoMaxBitrateKbps: number;
  liveVideoScaleDownBy: number;
  liveVideoMaxFramerate: number;
  voicePriorityMode: 'high' | 'balanced' | 'low_bandwidth' | 'ultra_low_bandwidth';
  agoraAudioProfile: 'music_standard' | 'speech_standard' | 'speech_low_quality';
  /** Polling & heartbeat throttle multiplier (1x on fast, up to 3x slower on weak networks) */
  backgroundPollMultiplier: number;
}

export interface SmartNetworkSnapshot {
  tier: SmartNetworkTier;
  policy: SmartNetworkPolicy;
  measuredRttMs: number | null;
  measuredThroughputKbps: number | null;
  packetLossPct: number | null;
  effectiveType: string | null;
  saveData: boolean;
  online: boolean;
  updatedAtMs: number;
}

const POLICIES: Record<SmartNetworkTier, SmartNetworkPolicy> = {
  fast: {
    tier: 'fast',
    isOffline: false,
    imageMaxWidth: 1080,
    imageQuality: 85,
    thumbnailWidth: 420,
    thumbnailQuality: 78,
    autoplayVideos: true,
    activeVideoPreload: 'auto',
    nextVideoPreload: 'auto',
    allowBackgroundGiftPrewarm: true,
    maxUncachedGiftAudioPreloads: 4,
    liveVideoMaxBitrateKbps: 1500,
    liveVideoScaleDownBy: 1,
    liveVideoMaxFramerate: 30,
    voicePriorityMode: 'high',
    agoraAudioProfile: 'music_standard',
    backgroundPollMultiplier: 1,
  },
  normal_4g: {
    tier: 'normal_4g',
    isOffline: false,
    imageMaxWidth: 720,
    imageQuality: 75,
    thumbnailWidth: 320,
    thumbnailQuality: 70,
    autoplayVideos: true,
    activeVideoPreload: 'auto',
    nextVideoPreload: 'metadata',
    allowBackgroundGiftPrewarm: false,
    maxUncachedGiftAudioPreloads: 2,
    liveVideoMaxBitrateKbps: 850,
    liveVideoScaleDownBy: 1,
    liveVideoMaxFramerate: 24,
    voicePriorityMode: 'balanced',
    agoraAudioProfile: 'speech_standard',
    backgroundPollMultiplier: 1.5,
  },
  weak_4g: {
    tier: 'weak_4g',
    isOffline: false,
    imageMaxWidth: 480,
    imageQuality: 65,
    thumbnailWidth: 240,
    thumbnailQuality: 60,
    autoplayVideos: true,
    activeVideoPreload: 'metadata',
    nextVideoPreload: 'none',
    allowBackgroundGiftPrewarm: false,
    maxUncachedGiftAudioPreloads: 0,
    liveVideoMaxBitrateKbps: 400,
    liveVideoScaleDownBy: 1.5,
    liveVideoMaxFramerate: 18,
    voicePriorityMode: 'low_bandwidth',
    agoraAudioProfile: 'speech_low_quality',
    backgroundPollMultiplier: 2.2,
  },
  very_weak: {
    tier: 'very_weak',
    isOffline: false,
    imageMaxWidth: 320,
    imageQuality: 50,
    thumbnailWidth: 180,
    thumbnailQuality: 48,
    autoplayVideos: false,
    activeVideoPreload: 'none',
    nextVideoPreload: 'none',
    allowBackgroundGiftPrewarm: false,
    maxUncachedGiftAudioPreloads: 0,
    liveVideoMaxBitrateKbps: 180,
    liveVideoScaleDownBy: 2,
    liveVideoMaxFramerate: 12,
    voicePriorityMode: 'ultra_low_bandwidth',
    agoraAudioProfile: 'speech_low_quality',
    backgroundPollMultiplier: 3,
  },
  offline: {
    tier: 'offline',
    isOffline: true,
    imageMaxWidth: 320,
    imageQuality: 50,
    thumbnailWidth: 180,
    thumbnailQuality: 48,
    autoplayVideos: false,
    activeVideoPreload: 'none',
    nextVideoPreload: 'none',
    allowBackgroundGiftPrewarm: false,
    maxUncachedGiftAudioPreloads: 0,
    liveVideoMaxBitrateKbps: 0,
    liveVideoScaleDownBy: 2,
    liveVideoMaxFramerate: 0,
    voicePriorityMode: 'ultra_low_bandwidth',
    agoraAudioProfile: 'speech_low_quality',
    backgroundPollMultiplier: 4,
  },
};

class SmartNetworkService {
  private measuredRttMs: number | null = null;
  private measuredThroughputKbps: number | null = null;
  private packetLossPct: number | null = null;
  private agoraWorstQuality = 0; // Agora scale: 0 unknown, 1 excellent .. 6 down
  private consecutiveNetworkFailures = 0;
  private lastMeasurementAtMs = 0;
  private currentTier: SmartNetworkTier = 'normal_4g';
  private listeners = new Set<(snap: SmartNetworkSnapshot) => void>();
  private initialized = false;
  private overrideTier: SmartNetworkTier | null = null;

  constructor() {
    this.init();
  }

  private init(): void {
    if (this.initialized || typeof window === 'undefined') return;
    this.initialized = true;

    const handleChange = () => this.recompute(true);
    window.addEventListener('online', () => {
      this.consecutiveNetworkFailures = 0;
      this.recompute(true);
    });
    window.addEventListener('offline', () => {
      this.recompute(true);
    });

    const conn = this.getNavigatorConnection();
    if (conn && typeof conn.addEventListener === 'function') {
      try {
        conn.addEventListener('change', handleChange);
      } catch {
        // ignore older browsers
      }
    }

    this.recompute(false);
  }

  private getNavigatorConnection(): any {
    if (typeof navigator === 'undefined') return null;
    return (
      (navigator as any).connection ||
      (navigator as any).mozConnection ||
      (navigator as any).webkitConnection ||
      null
    );
  }

  /**
   * Feed real measured HTTP/API request duration and payload size into EWMA estimators.
   */
  public reportMeasuredTransfer(options: {
    durationMs: number;
    bytes?: number;
    failed?: boolean;
  }): void {
    const now = Date.now();
    this.lastMeasurementAtMs = now;

    if (options.failed) {
      this.consecutiveNetworkFailures = Math.min(10, this.consecutiveNetworkFailures + 1);
      this.recompute(true);
      return;
    }

    this.consecutiveNetworkFailures = 0;
    const dur = Math.max(5, Number(options.durationMs) || 0);
    // Update EWMA RTT estimate
    this.measuredRttMs =
      this.measuredRttMs === null ? dur : Math.round(this.measuredRttMs * 0.72 + dur * 0.28);

    // Only update throughput when payload is large enough (>= 4 KB) to avoid header-overhead skew
    if (typeof options.bytes === 'number' && options.bytes >= 4096 && dur >= 10) {
      const kbps = Math.round(((options.bytes * 8) / dur)); // bits/ms == kbps
      this.measuredThroughputKbps =
        this.measuredThroughputKbps === null
          ? kbps
          : Math.round(this.measuredThroughputKbps * 0.7 + kbps * 0.3);
    }

    this.recompute(true);
  }

  /**
   * Feed live Agora RTC network quality scores (1=Excellent, 2=Good, 3=Poor, 4=Bad, 5=Very Bad, 6=Down) & RTT.
   */
  public reportAgoraNetworkQuality(txQuality: number, rxQuality: number, rttMs?: number | null): void {
    this.lastMeasurementAtMs = Date.now();
    const worst = Math.max(Number(txQuality) || 0, Number(rxQuality) || 0);
    if (worst > 0) {
      this.agoraWorstQuality = worst;
    }
    if (typeof rttMs === 'number' && Number.isFinite(rttMs) && rttMs >= 0) {
      this.measuredRttMs =
        this.measuredRttMs === null ? Math.round(rttMs) : Math.round(this.measuredRttMs * 0.65 + rttMs * 0.35);
    }
    this.recompute(true);
  }

  /**
   * Feed live WebRTC RTCPeerConnection stats (packet loss %, RTT ms, available bitrate kbps).
   */
  public reportWebRtcQuality(stats: {
    rttMs?: number | null;
    packetLossPct?: number | null;
    availableBitrateKbps?: number | null;
  }): void {
    this.lastMeasurementAtMs = Date.now();
    if (typeof stats.rttMs === 'number' && Number.isFinite(stats.rttMs) && stats.rttMs >= 0) {
      this.measuredRttMs =
        this.measuredRttMs === null
          ? Math.round(stats.rttMs)
          : Math.round(this.measuredRttMs * 0.65 + stats.rttMs * 0.35);
    }
    if (typeof stats.packetLossPct === 'number' && Number.isFinite(stats.packetLossPct) && stats.packetLossPct >= 0) {
      this.packetLossPct =
        this.packetLossPct === null
          ? Math.round(stats.packetLossPct * 10) / 10
          : Math.round((this.packetLossPct * 0.6 + stats.packetLossPct * 0.4) * 10) / 10;
    }
    if (
      typeof stats.availableBitrateKbps === 'number' &&
      Number.isFinite(stats.availableBitrateKbps) &&
      stats.availableBitrateKbps > 0
    ) {
      this.measuredThroughputKbps = Math.round(stats.availableBitrateKbps);
    }
    this.recompute(true);
  }

  /**
   * Deterministic override hook for QA/verification testing (pass null to restore live auto-detection).
   */
  public setOverrideTier(tier: SmartNetworkTier | null): void {
    this.overrideTier = tier;
    this.recompute(true);
  }

  private computeTier(): SmartNetworkTier {
    if (this.overrideTier) return this.overrideTier;

    const online = typeof navigator === 'undefined' ? true : navigator.onLine !== false;
    if (!online) return 'offline';

    const conn = this.getNavigatorConnection();
    const saveData = Boolean(conn?.saveData);
    const eff = String(conn?.effectiveType || '').toLowerCase();
    const navDownlinkKbps =
      typeof conn?.downlink === 'number' && conn.downlink > 0 ? conn.downlink * 1000 : null;
    const navRtt = typeof conn?.rtt === 'number' && conn.rtt > 0 ? conn.rtt : null;

    // Expire stale live measurements older than 90 seconds so recovery is snappy
    const hasFreshMeasurement = Date.now() - this.lastMeasurementAtMs < 90_000;
    const effectiveRtt =
      hasFreshMeasurement && this.measuredRttMs !== null ? this.measuredRttMs : navRtt;
    const effectiveThroughput =
      hasFreshMeasurement && this.measuredThroughputKbps !== null
        ? this.measuredThroughputKbps
        : navDownlinkKbps;
    const effectiveLoss = hasFreshMeasurement ? this.packetLossPct : null;
    const effectiveAgora = hasFreshMeasurement ? this.agoraWorstQuality : 0;

    // 1. Severe degradation / Very Weak detection (takes precedence over 4G/5G label!)
    if (
      saveData ||
      eff === 'slow-2g' ||
      eff === '2g' ||
      this.consecutiveNetworkFailures >= 3 ||
      effectiveAgora >= 5 ||
      (effectiveLoss !== null && effectiveLoss >= 8) ||
      (effectiveRtt !== null && effectiveRtt >= 900) ||
      (effectiveThroughput !== null && effectiveThroughput < 450)
    ) {
      return 'very_weak';
    }

    // 2. Weak 4G / Congested 3G detection (overrides optimistic "4g" label when real RTT/loss degrades)
    if (
      eff === '3g' ||
      this.consecutiveNetworkFailures >= 1 ||
      effectiveAgora === 3 ||
      effectiveAgora === 4 ||
      (effectiveLoss !== null && effectiveLoss >= 3) ||
      (effectiveRtt !== null && effectiveRtt >= 380) ||
      (effectiveThroughput !== null && effectiveThroughput < 1800)
    ) {
      return 'weak_4g';
    }

    // 3. Fast 5G / Wi-Fi detection (requires strong measured/reported downlink AND low RTT)
    const rttIsFast = effectiveRtt === null || effectiveRtt <= 120;
    const lossIsMinimal = effectiveLoss === null || effectiveLoss < 1;
    const agoraIsStrong = effectiveAgora === 0 || effectiveAgora <= 2;
    const throughputIsFast = effectiveThroughput !== null ? effectiveThroughput >= 5000 : eff === '4g' && rttIsFast;

    if (throughputIsFast && rttIsFast && lossIsMinimal && agoraIsStrong) {
      return 'fast';
    }

    // 4. Default balanced Normal 4G
    return 'normal_4g';
  }

  private recompute(emitIfChanged: boolean): void {
    const nextTier = this.computeTier();
    if (nextTier !== this.currentTier) {
      this.currentTier = nextTier;
      if (emitIfChanged) {
        const snap = this.getSnapshot();
        this.listeners.forEach((cb) => {
          try {
            cb(snap);
          } catch {
            // ignore subscriber errors
          }
        });
      }
    }
  }

  public getTier(): SmartNetworkTier {
    this.recompute(false);
    return this.currentTier;
  }

  public getPolicy(): SmartNetworkPolicy {
    return POLICIES[this.getTier()];
  }

  public getSnapshot(): SmartNetworkSnapshot {
    const tier = this.getTier();
    const conn = this.getNavigatorConnection();
    return {
      tier,
      policy: POLICIES[tier],
      measuredRttMs: this.measuredRttMs,
      measuredThroughputKbps: this.measuredThroughputKbps,
      packetLossPct: this.packetLossPct,
      effectiveType: conn?.effectiveType ? String(conn.effectiveType) : null,
      saveData: Boolean(conn?.saveData),
      online: typeof navigator === 'undefined' ? true : navigator.onLine !== false,
      updatedAtMs: Date.now(),
    };
  }

  public subscribe(listener: (snap: SmartNetworkSnapshot) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}

export const smartNetworkService = new SmartNetworkService();

export function useSmartNetworkMode(): SmartNetworkSnapshot {
  const [snapshot, setSnapshot] = useState<SmartNetworkSnapshot>(() =>
    smartNetworkService.getSnapshot()
  );

  useEffect(() => {
    setSnapshot(smartNetworkService.getSnapshot());
    return smartNetworkService.subscribe((next) => setSnapshot(next));
  }, []);

  return snapshot;
}
