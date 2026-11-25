import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as SVGAModule from 'svgaplayerweb';
import {
  AdvancedGiftConfig,
  Gift,
  GiftDisplayMode,
  GiftEdgeBlendMode,
  GiftPlaybackPosition,
} from '../../types';
import { resolvePlayableGiftUrl } from '../../services/giftAnimationEngine';
import {
  cacheMediaUrlAfterPlayback,
  getCachedGiftMediaUrlSync,
  resolveCachedGiftMediaUrl,
} from '../../services/giftMediaCache';
import { audioManager } from '../../services/audioManager';
import { DEFAULT_AVATAR_URL, safeImageSrc } from '../../utils/imageHd';
import { Sparkles } from 'lucide-react';

export interface UniversalGiftEvent {
  id: string;
  gift: Gift;
  senderName: string;
  senderAvatar?: string;
  senderVipTier?: number;
  recipientName: string;
  comboCount: number;
  quantity: number;
  timestamp: number;
}

interface UniversalGiftPlayerProps {
  event: UniversalGiftEvent | null;
  /**
   * 'background' renders Layer 2 (z-[5]) BEHIND host & guest seats (used for overlay_background mode).
   * 'foreground' renders Layer 5 (z-[35]) ABOVE host & seats but BELOW comments (z-40) & controls (z-50).
   * 'both' renders in a single container (e.g., Admin Stage Simulator or Moments).
   */
  layer: 'background' | 'foreground' | 'both';
  /** Optional override for live previewing display mode or opacity in Admin Manager */
  overrideConfig?: Partial<AdvancedGiftConfig>;
  /** Keep sound muted in silent previews or when live voice (Agora/WebRTC) must stay uninterrupted */
  forceMuted?: boolean;
  /** Concurrent playback lane (0, 1, 2) so 2-3 simultaneous gifts render & stack sender capsules cleanly */
  slotIndex?: number;
  /** If true, keeps playing continuously (Admin preview mode) */
  previewLoopOverride?: boolean;
  onComplete?: (eventId: string) => void;
  /** Reports real detected video/SVGA duration in ms so parent fail-safe timers never cut off long animations */
  onDurationDetected?: (eventId: string, durationMs: number) => void;
  /** Heartbeat emitted while buffering or advancing frames so parent fail-safe never cuts off active animations */
  onProgress?: (eventId: string, currentTimeMs: number, durationMs: number) => void;
}

const POSITION_CLASSES: Record<GiftPlaybackPosition, string> = {
  center: 'items-center justify-center',
  top: 'items-start justify-center',
  bottom: 'items-end justify-center',
  fullscreen: 'items-center justify-center',
};

/**
 * Multi-axis nested CSS alpha feathering masks.
 * Eliminates all 4 rectangular corners and hard top/bottom/side clip borders so uploaded
 * WebM/MP4/MOV videos melt organically into the live screen on every WebView & browser.
 */
const VERTICAL_FEATHER_MASK: React.CSSProperties = {
  WebkitMaskImage:
    'linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.42) 6%, #000 18%, #000 82%, rgba(0,0,0,0.42) 94%, transparent 100%)',
  maskImage:
    'linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.42) 6%, #000 18%, #000 82%, rgba(0,0,0,0.42) 94%, transparent 100%)',
};

const HORIZONTAL_FEATHER_MASK: React.CSSProperties = {
  WebkitMaskImage:
    'linear-gradient(to right, transparent 0%, rgba(0,0,0,0.52) 4%, #000 11%, #000 89%, rgba(0,0,0,0.52) 96%, transparent 100%)',
  maskImage:
    'linear-gradient(to right, transparent 0%, rgba(0,0,0,0.52) 4%, #000 11%, #000 89%, rgba(0,0,0,0.52) 96%, transparent 100%)',
};

const RADIAL_CORNER_FEATHER_MASK: React.CSSProperties = {
  WebkitMaskImage:
    'radial-gradient(ellipse 88% 84% at 50% 50%, #000 56%, rgba(0,0,0,0.84) 74%, rgba(0,0,0,0.34) 89%, transparent 100%)',
  maskImage:
    'radial-gradient(ellipse 88% 84% at 50% 50%, #000 56%, rgba(0,0,0,0.84) 74%, rgba(0,0,0,0.34) 89%, transparent 100%)',
};

/**
 * Ambient non-blocking particle layer (Layer 3, z-[8]) for Mode 2 (Semi-Transparent) & Mode 3 (Overlay/Background).
 */
export const GiftParticlesLayer: React.FC<{ active: boolean; accentColor?: string }> = ({
  active,
  accentColor = '#F59E0B',
}) => {
  const particles = useMemo(
    () =>
      Array.from({ length: 18 }, (_, i) => ({
        id: i,
        left: `${6 + ((i * 19) % 88)}%`,
        top: `${12 + ((i * 23) % 72)}%`,
        size: 4 + (i % 4) * 2.5,
        delay: `${(i % 6) * 0.28}s`,
        duration: `${2.2 + (i % 4) * 0.65}s`,
        color: i % 3 === 0 ? accentColor : i % 3 === 1 ? '#EC4899' : '#38BDF8',
      })),
    [accentColor]
  );

  if (!active) return null;

  return (
    <div
      className="absolute inset-0 z-[8] pointer-events-none overflow-hidden"
      aria-hidden="true"
    >
      {particles.map((p) => (
        <span
          key={p.id}
          className="absolute rounded-full animate-pulse"
          style={{
            left: p.left,
            top: p.top,
            width: `${p.size}px`,
            height: `${p.size}px`,
            backgroundColor: p.color,
            boxShadow: `0 0 ${p.size * 2.5}px ${p.color}`,
            opacity: 0.72,
            animationDelay: p.delay,
            animationDuration: p.duration,
            transform: 'translateZ(0)',
          }}
        />
      ))}
    </div>
  );
};

/**
 * Native Transparent SVGA Canvas Renderer (100% transparent background, zero box).
 */
const SvgaGiftCanvas: React.FC<{
  url: string;
  shouldLoop: boolean;
  contentMode: 'AspectFill' | 'AspectFit';
  onReady: (durationMs?: number) => void;
  onFinished: () => void;
  onError: () => void;
}> = ({ url, shouldLoop, contentMode, onReady, onFinished, onError }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const onReadyRef = useRef(onReady);
  const onFinishedRef = useRef(onFinished);
  const onErrorRef = useRef(onError);
  onReadyRef.current = onReady;
  onFinishedRef.current = onFinished;
  onErrorRef.current = onError;

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !url) return;

    let cancelled = false;
    let player: SVGAModule.Player | null = null;

    try {
      const svgaRuntime =
        ((SVGAModule as unknown as { default?: typeof SVGAModule }).default ||
          SVGAModule) as typeof SVGAModule;

      player = new svgaRuntime.Player(container);
      player.loops = shouldLoop ? 0 : 1;
      player.clearsAfterStop = true;
      player.setContentMode(contentMode);
      player.onFinished(() => {
        if (!cancelled && !shouldLoop) {
          onFinishedRef.current();
        }
      });

      const parser = new svgaRuntime.Parser();
      parser.load(
        url,
        (videoItem) => {
          if (cancelled || !player) return;
          try {
            player.setVideoItem(videoItem);
            player.startAnimation();
            const fps = Number(videoItem?.FPS || 30);
            const frames = Number(videoItem?.frames || 0);
            const durationMs =
              fps > 0 && frames > 0 ? Math.round((frames / fps) * 1000) : undefined;
            onReadyRef.current(durationMs);
          } catch {
            onErrorRef.current();
          }
        },
        () => {
          if (!cancelled) {
            onErrorRef.current();
          }
        }
      );
    } catch {
      onErrorRef.current();
    }

    return () => {
      cancelled = true;
      if (player) {
        try {
          player.stopAnimation(true);
          player.clear();
        } catch {
          // ignore cleanup error
        }
      }
      if (container) {
        container.innerHTML = '';
      }
    };
  }, [url, shouldLoop, contentMode]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full select-none pointer-events-none"
      style={{ backgroundColor: 'transparent', transform: 'translateZ(0)' }}
    />
  );
};

export const UniversalGiftPlayer: React.FC<UniversalGiftPlayerProps> = ({
  event,
  layer,
  overrideConfig,
  forceMuted = false,
  slotIndex = 0,
  previewLoopOverride = false,
  onComplete,
  onDurationDetected,
  onProgress,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const completedIdRef = useRef<string | null>(null);
  const endTimerRef = useRef<number | undefined>(undefined);
  const exitTimerRef = useRef<number | undefined>(undefined);
  const playRetryTimerRef = useRef<number | undefined>(undefined);
  const lastHeartbeatEmitAtRef = useRef<number>(0);

  // Store latest callbacks in refs so parent re-renders NEVER reset or interrupt running video animations.
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const onDurationDetectedRef = useRef(onDurationDetected);
  onDurationDetectedRef.current = onDurationDetected;
  const onProgressRef = useRef(onProgress);
  onProgressRef.current = onProgress;

  const [phase, setPhase] = useState<'enter' | 'visible' | 'exit'>('enter');
  const [isMediaReady, setIsMediaReady] = useState(false);
  const [videoAspect, setVideoAspect] = useState<'portrait' | 'landscape' | null>(null);

  const baseConfig = event?.gift.advancedConfig;
  const config: AdvancedGiftConfig | null = useMemo(() => {
    if (!baseConfig) return null;
    return overrideConfig ? { ...baseConfig, ...overrideConfig } : baseConfig;
  }, [baseConfig, overrideConfig]);

  const displayMode: GiftDisplayMode = config?.displayMode || 'semi_transparent';
  const isOverlayBackgroundMode = displayMode === 'overlay_background';

  // Determine whether this layer should render the main visual animation
  const shouldRenderAnimationOnThisLayer = useMemo(() => {
    if (!event || !config) return false;
    if (layer === 'both') return true;
    if (layer === 'background') return isOverlayBackgroundMode;
    return !isOverlayBackgroundMode;
  }, [event?.id, config?.id, layer, isOverlayBackgroundMode]);

  // Render the compact non-blocking gift notification capsule ONLY on the foreground (or 'both') layer
  const shouldRenderSenderCapsule = Boolean(
    event && config && (layer === 'foreground' || layer === 'both')
  );

  // Only the layer responsible for the animation lifecycle fires onComplete (prevents double-completion)
  const ownsCompletionLifecycle = shouldRenderAnimationOnThisLayer;

  const resolvedMedia = useMemo(() => {
    if (!config) return null;
    return resolvePlayableGiftUrl(config);
  }, [
    config?.optimizedFileUrl,
    config?.conversionStatus,
    config?.animationUrl,
    config?.originalFileUrl,
    config?.format,
  ]);

  const effectiveFormat = resolvedMedia?.effectiveFormat || config?.format || 'webm';
  const remoteMediaUrl = resolvedMedia?.url || '';
  const isVideoFormat =
    effectiveFormat === 'webm' || effectiveFormat === 'mov' || effectiveFormat === 'mp4';
  const isSvgaFormat = effectiveFormat === 'svga';

  const lastProgressAtRef = useRef<number>(Date.now());
  const lastVideoTimeRef = useRef<number>(0);
  const stallRecoveryAttemptsRef = useRef<number>(0);

  // Instant local-cache-first + immediate progressive streaming:
  // 1. Synchronous memory Blob URL -> instant (<10ms), zero network traffic.
  // 2. Quick IndexedDB lookup (<15ms) -> instant local Blob URL if previously cached.
  // 3. Uncached video -> starts streaming <video src={remoteMediaUrl}> IMMEDIATELY on first keyframe
  //    (no multi-second wait to fetch the entire file first on normal/weak 3G/4G!), then caches
  //    quietly in the background AFTER playback finishes so future plays are 0-byte instant.
  const [resolvedPlayableUrl, setResolvedPlayableUrl] = useState<string>(() => {
    if (!remoteMediaUrl) return '';
    return getCachedGiftMediaUrlSync(remoteMediaUrl) || '';
  });

  useEffect(() => {
    if (!event?.id || !remoteMediaUrl) {
      setResolvedPlayableUrl('');
      return;
    }
    const cachedSync = getCachedGiftMediaUrlSync(remoteMediaUrl);
    if (cachedSync) {
      setResolvedPlayableUrl(cachedSync);
      return;
    }
    if (!isVideoFormat) {
      setResolvedPlayableUrl(remoteMediaUrl);
      return;
    }

    let cancelled = false;
    lastProgressAtRef.current = Date.now();
    onProgressRef.current?.(event.id, 0, Math.max(10_000, config?.durationMs || 10_000));

    (async () => {
      try {
        // Fast IndexedDB check (<15ms, 0 network bytes). If not cached yet, stream remote URL immediately!
        const idbResult = await resolveCachedGiftMediaUrl(remoteMediaUrl, {
          giftId: event.gift.id || config?.id || 'gift',
          autoCache: false,
        });
        if (cancelled) return;
        setResolvedPlayableUrl(idbResult.playableUrl || remoteMediaUrl);
      } catch {
        if (!cancelled) {
          setResolvedPlayableUrl(remoteMediaUrl);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [event?.id, remoteMediaUrl, isVideoFormat]);

  const mediaUrl = resolvedPlayableUrl;

  const isNativeTransparentAsset =
    isSvgaFormat ||
    effectiveFormat === 'svg' ||
    config?.transparencyStatus === 'alpha_verified';

  const analysisDurationMs =
    config?.analysis?.durationSec && Number.isFinite(config.analysis.durationSec)
      ? Math.round(config.analysis.durationSec * 1000)
      : 0;
  const configuredDurationMs = Math.max(
    1500,
    Math.min(180_000, Math.max(config?.durationMs || 10_000, analysisDurationMs))
  );
  const opacityFraction =
    displayMode === 'transparent' || isNativeTransparentAsset
      ? Math.min(1, Math.max(0.25, (config?.opacity ?? 100) / 100))
      : Math.min(1, Math.max(0.1, (config?.opacity ?? 90) / 100));
  const scale = Math.min(1.5, Math.max(0.4, config?.scale ?? 1));
  const position: GiftPlaybackPosition = config?.position || 'fullscreen';
  const playbackSpeed = Math.min(2, Math.max(0.5, config?.playbackSpeed ?? 1));
  // In live/party rooms, video gifts ALWAYS play cleanly once from 0:00 to natural onEnded
  // so stale `loop: true` + `durationMs: 5000` can NEVER chop an 8s/10s/12s+ video halfway.
  const shouldLoop = previewLoopOverride || (!isVideoFormat && Boolean(config?.loop));

  // Seamless Edge Feathering: auto-ON for opaque videos (removes 4 sharp corners & top/bottom/side edges),
  // auto-OFF for natively transparent SVGA/SVG/VP9-Alpha unless Admin explicitly toggles it.
  const shouldFeatherEdges =
    config?.edgeFeather !== undefined
      ? config.edgeFeather
      : isVideoFormat && !isNativeTransparentAsset;

  const blendMode: GiftEdgeBlendMode =
    config?.blendMode === 'screen' || config?.blendMode === 'lighten'
      ? config.blendMode
      : 'normal';

  const emitProgressHeartbeat = (eventId: string, currentTimeMs: number, durationMs: number, force = false) => {
    const now = Date.now();
    if (!force && now - lastHeartbeatEmitAtRef.current < 900) return;
    lastHeartbeatEmitAtRef.current = now;
    onProgressRef.current?.(eventId, currentTimeMs, durationMs);
  };

  const finishPlayback = (eventId: string, withFade = true) => {
    if (completedIdRef.current === eventId) return;
    completedIdRef.current = eventId;

    if (playRetryTimerRef.current !== undefined) {
      window.clearTimeout(playRetryTimerRef.current);
      playRetryTimerRef.current = undefined;
    }
    if (exitTimerRef.current !== undefined) {
      window.clearTimeout(exitTimerRef.current);
      exitTimerRef.current = undefined;
    }
    if (endTimerRef.current !== undefined) {
      window.clearTimeout(endTimerRef.current);
      endTimerRef.current = undefined;
    }

    // Cache this remote asset into IndexedDB if we had to fall back to direct streaming
    if (remoteMediaUrl && mediaUrl && !mediaUrl.startsWith('blob:')) {
      cacheMediaUrlAfterPlayback(remoteMediaUrl, event?.gift.id || config?.id || 'gift');
    }

    if (withFade) {
      setPhase('exit');
      endTimerRef.current = window.setTimeout(() => {
        onCompleteRef.current?.(eventId);
      }, 340);
    } else {
      onCompleteRef.current?.(eventId);
    }
  };

  /**
   * Non-destructive stall watchdog for video gifts:
   * - NEVER terminates a video that is still playing or buffering!
   * - Only dismisses if the video decoder has produced ZERO frame movement for 28+ full seconds
   *   even after active play() recovery nudges.
   */
  const armVideoStallWatchdog = (eventId: string, checkDelayMs = 15_000) => {
    if (previewLoopOverride || !ownsCompletionLifecycle || shouldLoop) return;
    if (endTimerRef.current !== undefined) {
      window.clearTimeout(endTimerRef.current);
      endTimerRef.current = undefined;
    }
    const clampedDelay = Math.max(8_000, Math.min(30_000, Math.round(checkDelayMs)));
    endTimerRef.current = window.setTimeout(() => {
      if (completedIdRef.current === eventId) return;
      const vid = videoRef.current;

      // Still pre-buffering local blob before <video> mounts -> keep waiting safely
      if (!vid) {
        if (Date.now() - lastProgressAtRef.current < 32_000) {
          armVideoStallWatchdog(eventId, 10_000);
          return;
        }
        finishPlayback(eventId, true);
        return;
      }

      if (vid.ended) {
        finishPlayback(eventId, true);
        return;
      }

      const silentMs = Date.now() - lastProgressAtRef.current;
      // Video is actively advancing frames -> re-arm without interrupting!
      if (silentMs < 14_000) {
        emitProgressHeartbeat(
          eventId,
          Math.round((vid.currentTime || 0) * 1000),
          Number.isFinite(vid.duration) && vid.duration > 0 ? Math.round(vid.duration * 1000) : configuredDurationMs,
          true
        );
        armVideoStallWatchdog(eventId, 10_000);
        return;
      }

      // Video paused/stalled mid-way -> gently kick the WebView decoder to finish remaining frames!
      if (stallRecoveryAttemptsRef.current < 3 && vid.readyState >= 2) {
        stallRecoveryAttemptsRef.current += 1;
        try {
          if (vid.paused) {
            vid.muted = true;
            void vid.play().catch(() => {});
          } else if (Number.isFinite(vid.duration) && vid.currentTime < vid.duration - 0.25) {
            vid.currentTime = Math.min(vid.duration - 0.05, vid.currentTime + 0.04);
            void vid.play().catch(() => {});
          }
        } catch {
          // ignore seek error
        }
        armVideoStallWatchdog(eventId, 8_000);
        return;
      }

      // Only give up after 28s+ of complete decoder freeze
      if (silentMs < 28_000) {
        armVideoStallWatchdog(eventId, 8_000);
        return;
      }

      finishPlayback(eventId, true);
    }, clampedDelay);
  };

  // Lifecycle: direct animation playback -> full duration completion -> clean auto-dismiss & resource release
  useEffect(() => {
    if (!event || !config) return;

    const currentEventId = event.id;
    completedIdRef.current = null;
    lastProgressAtRef.current = Date.now();
    lastVideoTimeRef.current = 0;
    stallRecoveryAttemptsRef.current = 0;
    setIsMediaReady(!isVideoFormat && !isSvgaFormat);
    setVideoAspect(
      config.analysis?.width && config.analysis?.height
        ? config.analysis.width > config.analysis.height
          ? 'landscape'
          : 'portrait'
        : null
    );
    setPhase('enter');

    const enterTimer = window.setTimeout(() => setPhase('visible'), 25);

    if (!previewLoopOverride && ownsCompletionLifecycle) {
      if (isVideoFormat && !shouldLoop) {
        // Non-looping videos finish EXCLUSIVELY via natural onEnded (8s, 10s, 12s, 20s+ all play 100%).
        armVideoStallWatchdog(currentEventId, 16_000);
      } else if (isSvgaFormat && !shouldLoop) {
        const stallSafetyMs = Math.min(
          90_000,
          Math.round(configuredDurationMs / playbackSpeed) + 15_000
        );
        endTimerRef.current = window.setTimeout(() => {
          finishPlayback(currentEventId, true);
        }, stallSafetyMs);
      } else {
        // Non-video (SVG/GIF) or explicitly looping animations run for their full configured duration
        const effectiveMs = Math.round(configuredDurationMs / playbackSpeed);
        const fadeOutLeadMs = Math.min(420, Math.round(effectiveMs * 0.12));
        exitTimerRef.current = window.setTimeout(() => {
          setPhase('exit');
        }, Math.max(400, effectiveMs - fadeOutLeadMs));

        endTimerRef.current = window.setTimeout(() => {
          finishPlayback(currentEventId, false);
        }, effectiveMs);
      }
    }

    return () => {
      window.clearTimeout(enterTimer);
      if (playRetryTimerRef.current !== undefined) {
        window.clearTimeout(playRetryTimerRef.current);
        playRetryTimerRef.current = undefined;
      }
      if (exitTimerRef.current !== undefined) {
        window.clearTimeout(exitTimerRef.current);
        exitTimerRef.current = undefined;
      }
      if (endTimerRef.current !== undefined) {
        window.clearTimeout(endTimerRef.current);
        endTimerRef.current = undefined;
      }

      // Guaranteed video decoder & memory release on completion/unmount
      const v = videoRef.current;
      if (v) {
        try {
          v.pause();
          v.removeAttribute('src');
          v.load();
        } catch {
          // ignore cleanup error
        }
      }
    };
  }, [
    event?.id,
    isVideoFormat,
    isSvgaFormat,
    shouldLoop,
    previewLoopOverride,
    ownsCompletionLifecycle,
  ]);

  // Configure video playback rate & autoplay safely without crashing or aborting on slow networks
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !isVideoFormat || !shouldRenderAnimationOnThisLayer || !mediaUrl) return;

    let cancelled = false;
    const appMuted = forceMuted || audioManager.getIsMuted() || config?.enableSound === false;
    v.muted = appMuted;
    v.playbackRate = playbackSpeed;
    v.loop = shouldLoop;

    const attemptStart = async (retryCount = 0) => {
      if (cancelled || !videoRef.current || completedIdRef.current === event?.id) return;
      const el = videoRef.current;
      if (retryCount === 0 && el.currentTime > 0.05 && el.ended) {
        try {
          el.currentTime = 0;
        } catch {
          // ignore
        }
      }
      try {
        await el.play();
      } catch {
        if (cancelled) return;
        // Retry muted first (mobile WebView autoplay policy), then wait gently for buffered data
        try {
          el.muted = true;
          await el.play();
        } catch {
          if (cancelled) return;
          if (retryCount < 4) {
            playRetryTimerRef.current = window.setTimeout(() => {
              void attemptStart(retryCount + 1);
            }, 350 * (retryCount + 1));
          }
          // NEVER kill the animation here; onCanPlay / stall watchdog handles real unplayable failures cleanly
        }
      }
    };
    void attemptStart(0);

    return () => {
      cancelled = true;
      if (playRetryTimerRef.current !== undefined) {
        window.clearTimeout(playRetryTimerRef.current);
        playRetryTimerRef.current = undefined;
      }
    };
  }, [
    event?.id,
    mediaUrl,
    isVideoFormat,
    shouldRenderAnimationOnThisLayer,
    playbackSpeed,
    shouldLoop,
    forceMuted,
    config?.enableSound,
    previewLoopOverride,
    ownsCompletionLifecycle,
  ]);

  if (!event || !config) return null;
  if (!shouldRenderAnimationOnThisLayer && !shouldRenderSenderCapsule) return null;

  // Dynamic opacity & subtle emergence bloom so the animation feels born from inside the screen
  const isWaitingMedia = (isVideoFormat || isSvgaFormat) && !isMediaReady;
  const animatedOpacity = isWaitingMedia
    ? 0
    : phase === 'enter'
    ? 0
    : phase === 'exit'
    ? 0
    : opacityFraction;
  const animatedScale =
    phase === 'enter' ? scale * 1.05 : phase === 'exit' ? scale * 1.03 : scale;
  const animatedBlurPx =
    shouldFeatherEdges && (phase === 'enter' || phase === 'exit') ? 6 : 0;

  // Layer z-index strictly obeys the 7-Layer Live Room Rendering Architecture
  const layerZIndexClass =
    layer === 'background'
      ? 'z-[5]'
      : layer === 'foreground'
      ? 'z-[35]'
      : isOverlayBackgroundMode
      ? 'z-[5]'
      : 'z-[35]';

  // Full-width edge-to-edge sizing: NEVER leave left/right gaps or boxed margins!
  const isFullViewportCover =
    position === 'fullscreen' ||
    isOverlayBackgroundMode ||
    (isVideoFormat && videoAspect !== 'landscape');

  const videoSizingClass = isFullViewportCover
    ? 'w-full h-full object-cover'
    : 'w-full h-auto max-h-full object-cover';

  const rasterSizingClass =
    position === 'fullscreen' || isOverlayBackgroundMode
      ? 'w-full h-full object-contain'
      : 'w-full h-full object-contain';

  // Card thumbnail/photo is used ONLY inside the compact gift notification capsule — NEVER on the animation canvas
  const notificationGiftThumb =
    config.thumbnailUrl || config.previewImageUrl || event.gift.thumbnailUrl;

  const renderCoreMedia = () => {
    if (isSvgaFormat) {
      return (
        <SvgaGiftCanvas
          key={`${event.id}_${mediaUrl}`}
          url={mediaUrl}
          shouldLoop={shouldLoop}
          contentMode={position === 'fullscreen' || isOverlayBackgroundMode ? 'AspectFill' : 'AspectFit'}
          onReady={(svgaDurationMs) => {
            setIsMediaReady(true);
            if (
              !shouldLoop &&
              !previewLoopOverride &&
              ownsCompletionLifecycle &&
              svgaDurationMs &&
              svgaDurationMs > 0
            ) {
              if (endTimerRef.current !== undefined) {
                window.clearTimeout(endTimerRef.current);
              }
              endTimerRef.current = window.setTimeout(() => {
                finishPlayback(event.id, true);
              }, Math.min(68_000, svgaDurationMs + 4000));
            }
          }}
          onFinished={() => {
            if (!shouldLoop && !previewLoopOverride && ownsCompletionLifecycle) {
              finishPlayback(event.id, true);
            }
          }}
          onError={() => {
            if (!previewLoopOverride && ownsCompletionLifecycle) {
              finishPlayback(event.id, false);
            }
          }}
        />
      );
    }

    if (isVideoFormat) {
      if (!mediaUrl) {
        return null;
      }
      return (
        <video
          key={`${event.id}_${mediaUrl.startsWith('blob:') ? 'blob' : 'net'}`}
          ref={videoRef}
          src={mediaUrl}
          playsInline
          autoPlay
          loop={shouldLoop}
          preload="auto"
          muted={forceMuted || audioManager.getIsMuted() || config.enableSound === false}
          onLoadedMetadata={(e) => {
            const vid = e.currentTarget;
            lastProgressAtRef.current = Date.now();
            if (vid.videoWidth > 0 && vid.videoHeight > 0) {
              setVideoAspect(vid.videoWidth > vid.videoHeight ? 'landscape' : 'portrait');
            }
            if (
              !shouldLoop &&
              !previewLoopOverride &&
              ownsCompletionLifecycle &&
              Number.isFinite(vid.duration) &&
              vid.duration > 0
            ) {
              const realDurationMs = Math.ceil((vid.duration * 1000) / playbackSpeed);
              onDurationDetectedRef.current?.(event.id, realDurationMs);
              emitProgressHeartbeat(event.id, 0, realDurationMs, true);
              armVideoStallWatchdog(event.id, 14_000);
            }
          }}
          onLoadedData={() => {
            lastProgressAtRef.current = Date.now();
            setIsMediaReady(true);
          }}
          onPlaying={(e) => {
            lastProgressAtRef.current = Date.now();
            stallRecoveryAttemptsRef.current = 0;
            setIsMediaReady(true);
            const vid = e.currentTarget;
            const realDurationMs =
              Number.isFinite(vid.duration) && vid.duration > 0
                ? Math.ceil((vid.duration * 1000) / playbackSpeed)
                : configuredDurationMs;
            onDurationDetectedRef.current?.(event.id, realDurationMs);
            emitProgressHeartbeat(event.id, Math.round((vid.currentTime || 0) * 1000), realDurationMs, true);
            armVideoStallWatchdog(event.id, 14_000);
          }}
          onTimeUpdate={(e) => {
            const vid = e.currentTarget;
            const ct = vid.currentTime;
            if (ct > lastVideoTimeRef.current + 0.01) {
              lastVideoTimeRef.current = ct;
              lastProgressAtRef.current = Date.now();
              stallRecoveryAttemptsRef.current = 0;
              const realDurationMs =
                Number.isFinite(vid.duration) && vid.duration > 0
                  ? Math.ceil((vid.duration * 1000) / playbackSpeed)
                  : configuredDurationMs;
              emitProgressHeartbeat(event.id, Math.round(ct * 1000), realDurationMs);
            }
          }}
          onCanPlay={(e) => {
            lastProgressAtRef.current = Date.now();
            const vid = e.currentTarget;
            if (vid.paused && !vid.ended) {
              vid.play().catch(() => {
                vid.muted = true;
                vid.play().catch(() => {});
              });
            }
          }}
          onWaiting={() => {
            // Network still downloading chunks — keep alive & inform parent heartbeat
            lastProgressAtRef.current = Date.now();
            emitProgressHeartbeat(
              event.id,
              Math.round(lastVideoTimeRef.current * 1000),
              configuredDurationMs
            );
            armVideoStallWatchdog(event.id, 16_000);
          }}
          onStalled={(e) => {
            armVideoStallWatchdog(event.id, 16_000);
            const vid = e.currentTarget;
            if (vid.paused && !vid.ended && vid.readyState >= 2) {
              vid.play().catch(() => {});
            }
          }}
          onEnded={() => {
            if (!shouldLoop && !previewLoopOverride && ownsCompletionLifecycle) {
              finishPlayback(event.id, true);
            }
          }}
          onError={() => {
            // If a local Blob URL ever failed to decode, fall back once to remoteMediaUrl before dismissing
            if (mediaUrl.startsWith('blob:') && remoteMediaUrl && mediaUrl !== remoteMediaUrl) {
              setResolvedPlayableUrl(remoteMediaUrl);
              return;
            }
            if (!previewLoopOverride && ownsCompletionLifecycle) {
              finishPlayback(event.id, false);
            }
          }}
          className={`${videoSizingClass} block select-none`}
          style={{
            backgroundColor: 'transparent',
            transform: 'translateZ(0)',
            ...(shouldFeatherEdges ? RADIAL_CORNER_FEATHER_MASK : undefined),
          }}
        />
      );
    }

    // Sanitized SVG Animation & Animated GIF Renderer (native transparent background, zero box)
    return (
      <img
        key={`${event.id}_${mediaUrl}`}
        src={
          effectiveFormat === 'gif' && !shouldLoop
            ? `${mediaUrl}${mediaUrl.includes('?') ? '&' : '?'}play=${event.timestamp}`
            : mediaUrl
        }
        alt={event.gift.name}
        decoding="async"
        onError={() => {
          if (!previewLoopOverride && ownsCompletionLifecycle) {
            finishPlayback(event.id, false);
          }
        }}
        className={`${rasterSizingClass} block select-none`}
        style={{
          backgroundColor: 'transparent',
          transform: 'translateZ(0)',
          ...(shouldFeatherEdges ? RADIAL_CORNER_FEATHER_MASK : undefined),
        }}
      />
    );
  };

  const capsuleTopPx = 112 + Math.max(0, slotIndex) * 52;

  return (
    <>
      {/* Optional ambient particles for primary slot only (saves mobile GPU during 2-3 concurrent gifts) */}
      {slotIndex === 0 &&
        shouldRenderAnimationOnThisLayer &&
        (displayMode === 'semi_transparent' || displayMode === 'overlay_background') &&
        config.enableParticles !== false && (
          <GiftParticlesLayer active={phase === 'visible' && !isWaitingMedia} />
        )}

      {/* Main Animation Layer: 100% transparent backdrop, edge-to-edge width, zero boxy frame */}
      {shouldRenderAnimationOnThisLayer && (
        <div
          className={`absolute inset-0 ${layerZIndexClass} pointer-events-none overflow-hidden flex ${POSITION_CLASSES[position]}`}
          style={{
            backgroundColor: 'transparent',
            mixBlendMode: blendMode !== 'normal' ? blendMode : undefined,
            willChange: 'opacity, transform',
          }}
          data-gift-layer={layer}
          data-gift-slot={slotIndex}
          data-gift-mode={displayMode}
          data-gift-format={effectiveFormat}
          data-gift-feather={shouldFeatherEdges ? 'true' : 'false'}
        >
          <div
            className="relative w-full h-full flex items-center justify-center transition-[opacity,transform,filter] duration-300 ease-out"
            style={{
              opacity: slotIndex > 0 ? Math.min(animatedOpacity, 0.78) : animatedOpacity,
              transform: `scale(${animatedScale}) translateZ(0)`,
              filter: animatedBlurPx > 0 ? `blur(${animatedBlurPx}px)` : undefined,
              transformOrigin: 'center center',
              backgroundColor: 'transparent',
            }}
          >
            {shouldFeatherEdges ? (
              /* Dual-axis soft edge blur-dissolve wrappers + elliptical corner dissolve on media */
              <div
                className="w-full h-full flex items-center justify-center"
                style={{
                  ...VERTICAL_FEATHER_MASK,
                  backgroundColor: 'transparent',
                }}
              >
                <div
                  className={`w-full ${isFullViewportCover ? 'h-full' : 'max-h-full'} flex items-center justify-center`}
                  style={{
                    ...HORIZONTAL_FEATHER_MASK,
                    backgroundColor: 'transparent',
                  }}
                >
                  {renderCoreMedia()}
                </div>
              </div>
            ) : (
              /* Pure transparent SVGA / SVG / VP9-Alpha WebM: crystal-clear, zero backdrop */
              <div
                className="w-full h-full flex items-center justify-center"
                style={{ backgroundColor: 'transparent' }}
              >
                {renderCoreMedia()}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Non-Blocking Gift Notification Capsule (staggered vertically by slotIndex for concurrent multi-user gifts) */}
      {shouldRenderSenderCapsule && (
        <div
          data-keep-dark="true"
          style={{ top: `${capsuleTopPx}px` }}
          className={`absolute left-3 z-[36] pointer-events-none transition-all duration-300 ${
            phase === 'visible' ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4'
          }`}
        >
          <div className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-full bg-gradient-to-r from-[#190B31]/90 via-[#2E1059]/85 to-[#EC4899]/75 border border-amber-400/50 shadow-[0_6px_22px_rgba(121,40,202,0.55)] backdrop-blur-md max-w-[295px]">
            <img
              src={safeImageSrc(event.senderAvatar, DEFAULT_AVATAR_URL)}
              alt={event.senderName}
              className="w-7 h-7 rounded-full object-cover border border-amber-300 shrink-0"
            />
            <div className="min-w-0 leading-tight">
              <div className="flex items-center gap-1">
                <span className="text-[11px] font-black text-white truncate max-w-[96px]">
                  {event.senderName}
                </span>
              </div>
              <div className="text-[9.5px] text-amber-200 font-bold truncate">
                sent {event.gift.name} {event.quantity > 1 ? `x${event.quantity}` : ''}
              </div>
            </div>

            {/* Gift Card Photo / Thumbnail shown inside the notification capsule only */}
            <div className="w-7 h-7 rounded-lg bg-black/35 border border-amber-300/40 flex items-center justify-center shrink-0 overflow-hidden">
              {notificationGiftThumb ? (
                <img
                  src={notificationGiftThumb}
                  alt={event.gift.name}
                  className="w-6 h-6 object-contain"
                />
              ) : (
                <span className="text-sm leading-none">{event.gift.icon || '🎁'}</span>
              )}
            </div>

            <div className="flex items-center gap-0.5 pl-0.5 shrink-0">
              <Sparkles className="w-3 h-3 text-amber-300" />
              <span className="text-[11px] font-black text-amber-300 tabular-nums">
                {event.comboCount > 1
                  ? `x${event.comboCount}`
                  : `${(event.gift.coins * event.quantity).toLocaleString()} 💰`}
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
