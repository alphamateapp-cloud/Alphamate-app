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
  /** Keep sound muted in silent previews */
  forceMuted?: boolean;
  /** If true, keeps playing continuously (Admin preview mode) */
  previewLoopOverride?: boolean;
  onComplete?: (eventId: string) => void;
  /** Reports real detected video/SVGA duration in ms so parent fail-safe timers never cut off long animations */
  onDurationDetected?: (eventId: string, durationMs: number) => void;
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
  previewLoopOverride = false,
  onComplete,
  onDurationDetected,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const completedIdRef = useRef<string | null>(null);
  const endTimerRef = useRef<number | undefined>(undefined);
  const exitTimerRef = useRef<number | undefined>(undefined);

  // Store latest callbacks in refs so parent re-renders NEVER reset or interrupt running video animations.
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const onDurationDetectedRef = useRef(onDurationDetected);
  onDurationDetectedRef.current = onDurationDetected;

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
  const lastProgressAtRef = useRef<number>(Date.now());
  const lastVideoTimeRef = useRef<number>(0);

  // Lock the playable URL ONCE per event.id:
  // - If already cached in IndexedDB/memory, play immediately from local Blob URL (<30ms, zero buffering).
  // - Otherwise stream remoteMediaUrl cleanly WITHOUT competing download fetches or mid-playback src swaps,
  //   and cache it into IndexedDB right AFTER playback finishes so every subsequent play is instant!
  const mediaUrl = useMemo(() => {
    if (!remoteMediaUrl) return '';
    return getCachedGiftMediaUrlSync(remoteMediaUrl) || remoteMediaUrl;
  }, [event?.id, remoteMediaUrl]);

  const isVideoFormat =
    effectiveFormat === 'webm' || effectiveFormat === 'mov' || effectiveFormat === 'mp4';
  const isSvgaFormat = effectiveFormat === 'svga';
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
    Math.min(120_000, Math.max(config?.durationMs || 10_000, analysisDurationMs))
  );
  const opacityFraction =
    displayMode === 'transparent' || isNativeTransparentAsset
      ? Math.min(1, Math.max(0.25, (config?.opacity ?? 100) / 100))
      : Math.min(1, Math.max(0.1, (config?.opacity ?? 90) / 100));
  const scale = Math.min(1.5, Math.max(0.4, config?.scale ?? 1));
  const position: GiftPlaybackPosition = config?.position || 'fullscreen';
  const playbackSpeed = Math.min(2, Math.max(0.5, config?.playbackSpeed ?? 1));
  // In live/party rooms, video gifts ALWAYS play cleanly once from 0:00 to natural onEnded
  // so stale `loop: true` + `durationMs: 5000` can never chop a 10s+ video halfway.
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

  const finishPlayback = (eventId: string, withFade = true) => {
    if (completedIdRef.current === eventId) return;
    completedIdRef.current = eventId;

    if (exitTimerRef.current !== undefined) {
      window.clearTimeout(exitTimerRef.current);
      exitTimerRef.current = undefined;
    }
    if (endTimerRef.current !== undefined) {
      window.clearTimeout(endTimerRef.current);
      endTimerRef.current = undefined;
    }

    // Cache this remote asset into IndexedDB now that playback is finished (zero contention)
    if (remoteMediaUrl && !mediaUrl.startsWith('blob:')) {
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

  const armVideoStallWatchdog = (eventId: string, durationHintMs: number) => {
    if (previewLoopOverride || !ownsCompletionLifecycle || shouldLoop) return;
    if (endTimerRef.current !== undefined) {
      window.clearTimeout(endTimerRef.current);
      endTimerRef.current = undefined;
    }
    const checkMs = Math.min(115_000, Math.max(16_000, Math.round(durationHintMs) + 12_000));
    endTimerRef.current = window.setTimeout(() => {
      const vid = videoRef.current;
      // Never cut off a video that is still advancing frames or has buffered data to play!
      if (vid && !vid.ended) {
        if (vid.paused && vid.readyState >= 2) {
          vid.play().catch(() => {});
        }
        if (Date.now() - lastProgressAtRef.current < 12_000) {
          armVideoStallWatchdog(eventId, 12_000);
          return;
        }
      }
      finishPlayback(eventId, true);
    }, checkMs);
  };

  // Lifecycle: direct animation playback -> full duration completion -> clean auto-dismiss & resource release
  useEffect(() => {
    if (!event || !config) return;

    const currentEventId = event.id;
    completedIdRef.current = null;
    lastProgressAtRef.current = Date.now();
    lastVideoTimeRef.current = 0;
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
        // Non-looping videos finish naturally via onEnded (any duration: 6s, 10s, 15s, 30s+).
        armVideoStallWatchdog(currentEventId, Math.round(configuredDurationMs / playbackSpeed) + 10_000);
      } else if (isSvgaFormat && !shouldLoop) {
        const stallSafetyMs = Math.min(
          65_000,
          Math.round(configuredDurationMs / playbackSpeed) + 10_000
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
    displayMode,
    remoteMediaUrl,
    configuredDurationMs,
    playbackSpeed,
    isVideoFormat,
    isSvgaFormat,
    shouldLoop,
    previewLoopOverride,
    ownsCompletionLifecycle,
  ]);

  // Configure video playback rate & autoplay safely without crashing live room
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !isVideoFormat || !shouldRenderAnimationOnThisLayer || !mediaUrl) return;

    const appMuted = forceMuted || audioManager.getIsMuted() || config?.enableSound === false;
    v.muted = appMuted;
    v.playbackRate = playbackSpeed;
    v.loop = shouldLoop;

    const tryPlay = async () => {
      try {
        v.currentTime = 0;
      } catch {
        // ignore seek before metadata
      }
      try {
        await v.play();
      } catch {
        // Autoplay with audio blocked on mobile browser/WebView -> retry muted so animation ALWAYS plays smoothly
        try {
          v.muted = true;
          await v.play();
        } catch {
          if (event?.id && !previewLoopOverride && ownsCompletionLifecycle) {
            finishPlayback(event.id, false);
          }
        }
      }
    };
    void tryPlay();
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
      return (
        <video
          key={event.id}
          ref={videoRef}
          src={mediaUrl}
          playsInline
          autoPlay
          loop={shouldLoop}
          preload="auto"
          muted={forceMuted || audioManager.getIsMuted() || config.enableSound === false}
          onLoadedMetadata={(e) => {
            const vid = e.currentTarget;
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
              armVideoStallWatchdog(event.id, realDurationMs);
            }
          }}
          onLoadedData={() => setIsMediaReady(true)}
          onPlaying={(e) => {
            lastProgressAtRef.current = Date.now();
            setIsMediaReady(true);
            const vid = e.currentTarget;
            if (Number.isFinite(vid.duration) && vid.duration > 0) {
              const realDurationMs = Math.ceil((vid.duration * 1000) / playbackSpeed);
              onDurationDetectedRef.current?.(event.id, realDurationMs);
              const remainingMs = Math.max(
                3000,
                Math.ceil(((vid.duration - vid.currentTime) * 1000) / playbackSpeed)
              );
              armVideoStallWatchdog(event.id, remainingMs);
            }
          }}
          onTimeUpdate={(e) => {
            const ct = e.currentTarget.currentTime;
            if (ct > lastVideoTimeRef.current + 0.01) {
              lastVideoTimeRef.current = ct;
              lastProgressAtRef.current = Date.now();
            }
          }}
          onCanPlay={(e) => {
            const vid = e.currentTarget;
            if (vid.paused && !vid.ended) {
              vid.play().catch(() => {});
            }
          }}
          onWaiting={() => {
            armVideoStallWatchdog(event.id, 14_000);
          }}
          onStalled={(e) => {
            armVideoStallWatchdog(event.id, 14_000);
            const vid = e.currentTarget;
            if (vid.paused && !vid.ended) {
              vid.play().catch(() => {});
            }
          }}
          onEnded={() => {
            if (!shouldLoop && !previewLoopOverride && ownsCompletionLifecycle) {
              finishPlayback(event.id, true);
            }
          }}
          onError={() => {
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

  return (
    <>
      {/* Optional ambient particles for Semi-Transparent (Mode 2) & Overlay/Background (Mode 3) */}
      {shouldRenderAnimationOnThisLayer &&
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
          data-gift-mode={displayMode}
          data-gift-format={effectiveFormat}
          data-gift-feather={shouldFeatherEdges ? 'true' : 'false'}
        >
          <div
            className="relative w-full h-full flex items-center justify-center transition-[opacity,transform,filter] duration-300 ease-out"
            style={{
              opacity: animatedOpacity,
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

      {/* Non-Blocking Gift Notification Capsule (shows sender + gift thumbnail + coins cleanly) */}
      {shouldRenderSenderCapsule && (
        <div
          data-keep-dark="true"
          className={`absolute top-28 left-3 z-[36] pointer-events-none transition-all duration-300 ${
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
