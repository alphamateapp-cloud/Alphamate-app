import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AdvancedGiftConfig, Gift, GiftDisplayMode, GiftPlaybackPosition } from '../../types';
import { resolvePlayableGiftUrl } from '../../services/giftAnimationEngine';
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
}

const POSITION_CLASSES: Record<GiftPlaybackPosition, string> = {
  center: 'items-center justify-center',
  top: 'items-start justify-center pt-16',
  bottom: 'items-end justify-center pb-28',
  fullscreen: 'items-center justify-center',
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

export const UniversalGiftPlayer: React.FC<UniversalGiftPlayerProps> = ({
  event,
  layer,
  overrideConfig,
  forceMuted = false,
  previewLoopOverride = false,
  onComplete,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const completedIdRef = useRef<string | null>(null);
  const endTimerRef = useRef<number | undefined>(undefined);
  const exitTimerRef = useRef<number | undefined>(undefined);

  // Store latest onComplete in a ref so parent re-renders (e.g. 1s live timer or 80ms combo ticks)
  // NEVER trigger cleanup or interrupt the running video animation.
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const [phase, setPhase] = useState<'enter' | 'visible' | 'exit'>('enter');
  const [isVideoReady, setIsVideoReady] = useState(false);

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
  }, [config?.optimizedFileUrl, config?.conversionStatus, config?.animationUrl, config?.originalFileUrl, config?.format]);

  const effectiveFormat = resolvedMedia?.effectiveFormat || config?.format || 'webm';
  const mediaUrl = resolvedMedia?.url || '';
  const isVideoFormat = effectiveFormat === 'webm' || effectiveFormat === 'mov' || effectiveFormat === 'mp4';

  const analysisDurationMs =
    config?.analysis?.durationSec && Number.isFinite(config.analysis.durationSec)
      ? Math.round(config.analysis.durationSec * 1000)
      : 0;
  const configuredDurationMs = Math.max(
    1500,
    Math.min(60_000, Math.max(config?.durationMs || 6000, analysisDurationMs))
  );
  const opacityFraction =
    displayMode === 'transparent'
      ? 1
      : Math.min(1, Math.max(0.1, (config?.opacity ?? 82) / 100));
  const scale = Math.min(1.5, Math.max(0.4, config?.scale ?? 1));
  const position: GiftPlaybackPosition = config?.position || 'center';
  const playbackSpeed = Math.min(2, Math.max(0.5, config?.playbackSpeed ?? 1));
  const shouldLoop = previewLoopOverride || Boolean(config?.loop);

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

    if (withFade) {
      setPhase('exit');
      endTimerRef.current = window.setTimeout(() => {
        onCompleteRef.current?.(eventId);
      }, 240);
    } else {
      onCompleteRef.current?.(eventId);
    }
  };

  // Lifecycle: direct animation playback -> full duration completion -> clean auto-dismiss & resource release
  useEffect(() => {
    if (!event || !config) return;

    const currentEventId = event.id;
    completedIdRef.current = null;
    setIsVideoReady(false);
    setPhase('enter');

    const enterTimer = window.setTimeout(() => setPhase('visible'), 30);

    if (!previewLoopOverride && ownsCompletionLifecycle) {
      if (isVideoFormat && !shouldLoop) {
        // Non-looping videos play to their EXACT natural end via `onEnded`.
        // Set only a generous stall safety deadline (adjusted further in onLoadedMetadata)
        // so slow buffering NEVER cuts off a 10-second video prematurely.
        const stallSafetyMs = Math.min(
          65_000,
          Math.round(configuredDurationMs / playbackSpeed) + 6000
        );
        endTimerRef.current = window.setTimeout(() => {
          finishPlayback(currentEventId, true);
        }, stallSafetyMs);
      } else {
        // Non-video (SVG/GIF) or explicitly looping videos run for their full configured duration
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
    mediaUrl,
    configuredDurationMs,
    playbackSpeed,
    isVideoFormat,
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
          // If playback genuinely cannot start on this device, close cleanly instead of showing a static card image
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

  // Dynamic opacity for enter/visible/exit fade transitions (strictly scoped to animation element ONLY)
  const animatedOpacity =
    phase === 'enter' ? 0 : phase === 'exit' ? 0 : opacityFraction;

  // Layer z-index strictly obeys the 7-Layer Live Room Rendering Architecture
  const layerZIndexClass =
    layer === 'background'
      ? 'z-[5]'
      : layer === 'foreground'
      ? 'z-[35]'
      : isOverlayBackgroundMode
      ? 'z-[5]'
      : 'z-[35]';

  const mediaSizingClass =
    position === 'fullscreen' || isOverlayBackgroundMode
      ? 'w-full h-full object-cover'
      : 'max-w-[92%] max-h-[76%] object-contain';

  // Card thumbnail/photo is used ONLY inside the compact gift notification capsule — NEVER on the animation canvas
  const notificationGiftThumb =
    config.thumbnailUrl || config.previewImageUrl || event.gift.thumbnailUrl;

  return (
    <>
      {/* Optional ambient particles for Semi-Transparent (Mode 2) & Overlay/Background (Mode 3) */}
      {shouldRenderAnimationOnThisLayer &&
        (displayMode === 'semi_transparent' || displayMode === 'overlay_background') &&
        config.enableParticles !== false && (
          <GiftParticlesLayer active={phase === 'visible' && (!isVideoFormat || isVideoReady)} />
        )}

      {/* Main Animation Layer: plays ONLY the direct animation media (NO card sticker/crown/poster overlay) */}
      {shouldRenderAnimationOnThisLayer && (
        <div
          className={`absolute inset-0 ${layerZIndexClass} pointer-events-none overflow-hidden flex ${POSITION_CLASSES[position]}`}
          style={{
            backgroundColor: 'transparent',
            willChange: 'opacity, transform',
          }}
          data-gift-layer={layer}
          data-gift-mode={displayMode}
          data-gift-format={effectiveFormat}
        >
          <div
            className={`relative flex items-center justify-center transition-opacity duration-300 ease-out ${
              position === 'fullscreen' || isOverlayBackgroundMode ? 'w-full h-full' : 'w-full h-full p-2'
            }`}
            style={{
              opacity: isVideoFormat && !isVideoReady ? 0 : animatedOpacity,
              transform: `scale(${scale}) translateZ(0)`,
              transformOrigin: 'center center',
              backgroundColor: 'transparent',
            }}
          >
            {isVideoFormat ? (
              <video
                key={`${event.id}_${mediaUrl}`}
                ref={videoRef}
                src={mediaUrl}
                playsInline
                autoPlay
                loop={shouldLoop}
                preload="auto"
                muted={forceMuted || audioManager.getIsMuted() || config.enableSound === false}
                onLoadedMetadata={(e) => {
                  const vid = e.currentTarget;
                  if (
                    !shouldLoop &&
                    !previewLoopOverride &&
                    ownsCompletionLifecycle &&
                    Number.isFinite(vid.duration) &&
                    vid.duration > 0
                  ) {
                    // Reschedule stall safety deadline to match the video's true full duration + generous buffer
                    const realDurationMs = Math.ceil((vid.duration * 1000) / playbackSpeed);
                    if (endTimerRef.current !== undefined) {
                      window.clearTimeout(endTimerRef.current);
                    }
                    endTimerRef.current = window.setTimeout(() => {
                      finishPlayback(event.id, true);
                    }, Math.min(68_000, realDurationMs + 5000));
                  }
                }}
                onLoadedData={() => setIsVideoReady(true)}
                onPlaying={() => setIsVideoReady(true)}
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
                className={`${mediaSizingClass} select-none`}
                style={{
                  backgroundColor: 'transparent',
                  transform: 'translateZ(0)',
                }}
              />
            ) : (
              /* Sanitized SVG Animation & Animated GIF Renderer (native transparent background, zero JS execution) */
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
                className={`${mediaSizingClass} select-none`}
                style={{
                  backgroundColor: 'transparent',
                  transform: 'translateZ(0)',
                }}
              />
            )}
          </div>
        </div>
      )}

      {/* Non-Blocking Gift Notification Capsule (shows sender + gift photo/thumbnail + coins inside the notification only) */}
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
