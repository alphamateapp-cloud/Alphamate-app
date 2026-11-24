import React, { useCallback, useEffect, useState, useMemo, useRef } from 'react';
import { Gift } from '../../types';
import { Sparkles, Flame, Volume2, VolumeX, Crown } from 'lucide-react';
import { audioManager } from '../../services/audioManager';
import { virtualGiftDatabase } from '../../services/virtual-gift-database';
import { UniversalGiftPlayer } from './UniversalGiftPlayer';

export interface ActiveGiftEvent {
  id: string;
  gift: Gift;
  senderName: string;
  senderAvatar?: string;
  senderVipTier?: number;
  recipientName: string;
  comboCount: number;
  quantity: number;
  timestamp: number;
  streamId?: string;
  roomId?: string;
}

interface GiftAnimationOverlayProps {
  currentEvent: ActiveGiftEvent | null;
  onComplete: () => void;
  /**
   * 7-Layer Live Room Rendering selector:
   * - 'background': Layer 2 (z-[5]) BEHIND Host & Guest Seats (for overlay_background mode)
   * - 'foreground': Layer 5 (z-[35]) ABOVE Host & Seats, BELOW Comments (z-40) & Controls (z-50)
   * - 'both': default single-container fallback (Moments / standalone)
   */
  layer?: 'background' | 'foreground' | 'both';
  onDurationDetected?: (eventId: string, durationMs: number) => void;
  onProgress?: (eventId: string, currentTimeMs: number, durationMs: number) => void;
}

export const GiftAnimationOverlay: React.FC<GiftAnimationOverlayProps> = ({
  currentEvent,
  onComplete,
  layer = 'both',
  onDurationDetected,
  onProgress,
}) => {
  const [isMuted, setIsMuted] = useState(() => audioManager.getIsMuted());
  const [shakeScreen, setShakeScreen] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [completedEventId, setCompletedEventId] = useState<string | null>(null);
  const completedIdsRef = useRef<Set<string>>(new Set());

  const isAdvancedGift = Boolean(currentEvent?.gift?.advancedConfig);

  // Keep latest callback in a ref so parent re-renders (e.g. 1s stream clock / 80ms combo bar)
  // NEVER reset the auto-dismiss timer or interrupt running video animations!
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const handleUniversalGiftComplete = useCallback((finishedId: string) => {
    completedIdsRef.current.add(finishedId);
    setCompletedEventId(finishedId);
    onCompleteRef.current();
  }, []);

  const resolvedGift = useMemo(
    () => (currentEvent ? virtualGiftDatabase.resolveGiftMetadata(currentEvent.gift) : null),
    [currentEvent?.id]
  );

  useEffect(() => {
    void virtualGiftDatabase.preloadAllGiftAudio();
    return () => {
      audioManager.stopAll();
    };
  }, []);

  useEffect(() => {
    return audioManager.subscribeMute(setIsMuted);
  }, []);

  useEffect(() => {
    const eventId = currentEvent?.id;
    // Advanced gifts manage their own lifecycle inside UniversalGiftPlayer.
    // Legacy CSS gifts only run timers on 'foreground' or 'both' layers (never duplicate on 'background').
    if (
      !eventId ||
      !currentEvent ||
      isAdvancedGift ||
      layer === 'background' ||
      completedIdsRef.current.has(eventId)
    ) {
      setIsExiting(false);
      setShakeScreen(false);
      return;
    }

    const meta = virtualGiftDatabase.resolveGiftMetadata(currentEvent.gift);
    const durationMs = meta.isBannerOnly
      ? Math.min(2800, Math.max(1500, Number(meta.durationMs) || 2000))
      : Math.min(7800, Math.max(7000, Number(meta.durationMs) || 7400));
    const fadeLeadMs = meta.isBannerOnly ? 260 : 420;
    const fadeAtMs = Date.now() + Math.max(200, durationMs - fadeLeadMs);
    const deadlineMs = Date.now() + durationMs;
    let finished = false;

    setIsExiting(false);

    // Play mapped gift SFX safely (never block timer setup if WebView audio throws)
    try {
      Promise.resolve(
        virtualGiftDatabase.playGiftAudio(meta, {
          comboCount: currentEvent.comboCount,
        })
      ).catch(() => {});
    } catch {
      // Ignore WebView audio playback errors
    }

    // Screen shake only for heavy/epic non-banner gifts
    let shakeTimer: ReturnType<typeof setTimeout> | null = null;
    if (!meta.isBannerOnly && meta.triggersScreenShake) {
      setShakeScreen(true);
      shakeTimer = setTimeout(() => setShakeScreen(false), 480);
    } else {
      setShakeScreen(false);
    }

    let fadeTimer: ReturnType<typeof setTimeout> | null = null;
    let completeTimer: ReturnType<typeof setTimeout> | null = null;
    let watchdogPoll: ReturnType<typeof setInterval> | null = null;

    const finishOnce = () => {
      if (finished) return;
      finished = true;
      completedIdsRef.current.add(eventId);
      if (completedIdsRef.current.size > 80) {
        const firstKey = completedIdsRef.current.values().next().value;
        if (firstKey) completedIdsRef.current.delete(firstKey);
      }
      if (shakeTimer) clearTimeout(shakeTimer);
      if (fadeTimer) clearTimeout(fadeTimer);
      if (completeTimer) clearTimeout(completeTimer);
      if (watchdogPoll) clearInterval(watchdogPoll);
      setCompletedEventId(eventId);
      setIsExiting(false);
      setShakeScreen(false);
      onCompleteRef.current();
    };

    const checkWallClock = () => {
      const now = Date.now();
      if (now >= deadlineMs) {
        finishOnce();
        return;
      }
      if (now >= fadeAtMs) {
        setIsExiting(true);
      }
    };

    // Smooth fade-out right before completion
    fadeTimer = setTimeout(() => {
      if (!finished) setIsExiting(true);
    }, Math.max(200, durationMs - fadeLeadMs));

    // Primary auto-dismiss timer + Android WebView wall-clock watchdog
    completeTimer = setTimeout(finishOnce, durationMs);
    watchdogPoll = setInterval(checkWallClock, 250);

    window.addEventListener('focus', checkWallClock);
    window.addEventListener('pageshow', checkWallClock);
    document.addEventListener('visibilitychange', checkWallClock);

    return () => {
      finished = true;
      if (shakeTimer) clearTimeout(shakeTimer);
      if (fadeTimer) clearTimeout(fadeTimer);
      if (completeTimer) clearTimeout(completeTimer);
      if (watchdogPoll) clearInterval(watchdogPoll);
      window.removeEventListener('focus', checkWallClock);
      window.removeEventListener('pageshow', checkWallClock);
      document.removeEventListener('visibilitychange', checkWallClock);
    };
  }, [currentEvent?.id, isAdvancedGift, layer]);

  const handleToggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    const muted = audioManager.toggleMute();
    setIsMuted(muted);
  };

  const rosePetals = useMemo(() => {
    return Array.from({ length: 16 }).map((_, i) => ({
      id: i,
      left: `${(i * 5.8 + 4) % 94}%`,
      drift: `${((i % 5) - 2) * 35}px`,
      delay: `${(i % 6) * 0.14}s`,
      size: `${15 + (i % 4) * 3}px`,
      rotate: `${(i * 45) % 360}deg`,
    }));
  }, [currentEvent?.id]);

  const neonHearts = useMemo(() => {
    return Array.from({ length: 14 }).map((_, i) => ({
      id: i,
      left: `${(i * 6.5 + 5) % 92}%`,
      delay: `${(i % 5) * 0.15}s`,
      scale: 0.7 + (i % 4) * 0.18,
    }));
  }, [currentEvent?.id]);

  const fireworks = useMemo(() => {
    return [
      { x: '22%', y: '26%', border: 'border-pink-400', delay: '0.25s' },
      { x: '72%', y: '22%', border: 'border-amber-300', delay: '0.65s' },
      { x: '48%', y: '18%', border: 'border-cyan-300', delay: '1.05s' },
      { x: '32%', y: '34%', border: 'border-emerald-300', delay: '1.45s' },
      { x: '66%', y: '30%', border: 'border-purple-400', delay: '1.85s' },
    ];
  }, [currentEvent?.id]);

  // Delegate Advanced Multi-Format Gifts (WebM / MOV / MP4 / SVG / GIF) to UniversalGiftPlayer
  if (currentEvent && isAdvancedGift) {
    if (currentEvent.id === completedEventId || completedIdsRef.current.has(currentEvent.id)) {
      return null;
    }
    return (
      <UniversalGiftPlayer
        event={currentEvent}
        layer={layer}
        onComplete={handleUniversalGiftComplete}
        onDurationDetected={onDurationDetected}
        onProgress={onProgress}
      />
    );
  }

  // Legacy CSS gifts render on Foreground/Both layers only (never duplicated in Background layer)
  if (layer === 'background') {
    return null;
  }

  if (
    !currentEvent ||
    !resolvedGift ||
    currentEvent.id === completedEventId ||
    completedIdsRef.current.has(currentEvent.id)
  ) {
    return null;
  }

  const {
    senderName,
    senderAvatar,
    senderVipTier = 1,
    recipientName,
    comboCount,
    quantity,
  } = currentEvent;
  const gift = resolvedGift;
  const totalCoins = gift.costInCoins * quantity;
  const isSmallBannerOnly = gift.isBannerOnly;
  const shakeClassName =
    !isSmallBannerOnly && shakeScreen && gift.screenShakeClassName
      ? gift.screenShakeClassName
      : '';
  const primaryAnimClass = gift.animationClassName;

  // =========================================================================
  // SMALL GIFTS (<= 100 COINS, e.g. Flowers / Heart 100):
  // Clean top strip notification banner ONLY — appears & auto-disappears in ~2s!
  // =========================================================================
  if (isSmallBannerOnly) {
    return (
      <div
        key={currentEvent.id}
        className={`fixed top-16 inset-x-0 z-[55] pointer-events-none px-3 sm:px-6 transition-all duration-300 ${
          isExiting ? 'opacity-0 -translate-y-2 scale-95' : 'opacity-100 translate-y-0 scale-100'
        }`}
      >
        <div className="w-full max-w-md mx-auto rounded-2xl p-[1.5px] bg-gradient-to-r from-amber-400/90 via-[#EC4899] to-[#7928CA] shadow-[0_6px_24px_rgba(236,72,153,0.45)] animate-slide-up">
          <div className="rounded-[14.5px] bg-[#120B24]/95 backdrop-blur-xl px-3 py-2 flex items-center justify-between gap-2.5">
            <div className="flex items-center gap-2 min-w-0">
              <img
                src={
                  senderAvatar ||
                  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80'
                }
                alt={senderName}
                className="w-8 h-8 rounded-full object-cover border border-amber-400/80 shrink-0"
              />
              <div className="min-w-0">
                <div className="flex items-center gap-1 text-[11px] truncate">
                  <span className="font-black text-amber-300 truncate max-w-[105px]">
                    {senderName}
                  </span>
                  <span className="text-zinc-400 text-[10px]">sent</span>
                  <span className="font-bold text-pink-200 truncate max-w-[95px]">
                    {gift.name}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-zinc-300 truncate">
                  <span>to {recipientName}</span>
                  {quantity > 1 && (
                    <span className="px-1.5 rounded-full bg-pink-500/25 text-pink-200 font-black">
                      x{quantity}
                    </span>
                  )}
                  {comboCount > 1 && (
                    <span className="px-1.5 rounded-full bg-amber-500/25 text-amber-200 font-black">
                      Combo x{comboCount}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {gift.thumbnailUrl ? (
                <img
                  src={gift.thumbnailUrl}
                  alt={gift.name}
                  className="w-8 h-8 rounded-lg object-contain"
                />
              ) : (
                <span className="text-2xl">{gift.icon}</span>
              )}
              <span className="text-[11px] font-black text-amber-300 whitespace-nowrap">
                +{totalCoins.toLocaleString()} 💰
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // BIG / VIP / MYTHIC GIFTS (> 100 COINS):
  // 5–7.5s non-looping full-screen showcase that cleanly finishes & unmounts!
  // =========================================================================
  return (
    <div
      key={currentEvent.id}
      className={`fixed inset-0 z-[55] pointer-events-none flex flex-col justify-between overflow-hidden transition-opacity duration-400 ${
        isExiting ? 'opacity-0' : 'opacity-100'
      } ${shakeClassName}`}
    >
      {/* Sound Mute/Unmute Float Toggle */}
      <div className="absolute top-24 right-4 z-50 pointer-events-auto">
        <button
          onClick={handleToggleMute}
          title={isMuted ? 'Unmute Gift SFX' : 'Mute Gift SFX'}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/20 text-white text-xs font-semibold hover:bg-black/80 transition-all cursor-pointer shadow-lg"
        >
          {isMuted ? (
            <>
              <VolumeX className="w-3.5 h-3.5 text-zinc-400" />
              <span className="text-[10px] text-zinc-300">SFX Off</span>
            </>
          ) : (
            <>
              <Volume2 className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-[10px] text-amber-300 font-bold">SFX On</span>
            </>
          )}
        </button>
      </div>

      {/* 1. TOP VIP SENDER CAPSULE BANNER */}
      <div className="pt-16 px-3 sm:px-6 w-full max-w-lg mx-auto">
        <div className="relative rounded-2xl p-[2px] bg-gradient-to-r from-amber-400 via-[#EC4899] to-[#7928CA] shadow-[0_0_30px_rgba(236,72,153,0.55)] animate-slide-up">
          <div className="rounded-[14px] bg-[#120B24]/95 backdrop-blur-xl px-3.5 py-2.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="relative flex-shrink-0">
                <img
                  src={
                    senderAvatar ||
                    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80'
                  }
                  alt={senderName}
                  className="w-10 h-10 rounded-full object-cover border-2 border-amber-400 shadow-md"
                />
                <div className="absolute -bottom-1 -right-1 px-1 rounded bg-gradient-to-r from-amber-500 to-amber-700 text-[8px] font-black text-black shadow">
                  VIP {senderVipTier}
                </div>
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs font-black text-amber-300 truncate max-w-[120px]">
                    {senderName}
                  </span>
                  <span className="text-[10px] text-zinc-400">sent to</span>
                  <span className="text-xs font-bold text-white truncate max-w-[100px]">
                    {recipientName}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-xs font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-pink-300 to-purple-200">
                    {gift.name}
                  </span>
                  {quantity > 1 && (
                    <span className="text-[10px] font-black px-1.5 py-0.2 rounded-full bg-pink-500/30 text-pink-300 border border-pink-500/40">
                      x{quantity}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              {gift.thumbnailUrl ? (
                <img
                  src={gift.thumbnailUrl}
                  alt={gift.name}
                  className="w-10 h-10 rounded-xl object-contain drop-shadow-[0_0_10px_rgba(255,215,0,0.65)]"
                />
              ) : (
                <span className="text-3xl drop-shadow-[0_0_10px_rgba(255,215,0,0.65)]">
                  {gift.icon}
                </span>
              )}
              <div className="text-right">
                <div className="text-xs font-black text-amber-400 flex items-center gap-0.5 justify-end">
                  <span>+{totalCoins.toLocaleString()}</span>
                  <span className="text-[10px]">💰</span>
                </div>
                <div className="text-[9px] text-zinc-400 font-semibold uppercase tracking-wider">
                  {gift.tier}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. COMBO MULTIPLIER COUNTER */}
      {comboCount > 1 && (
        <div
          key={`overlay-combo-${gift.id}-${comboCount}`}
          className={`absolute top-32 left-4 z-40 ${gift.comboAnimationClassName}`}
        >
          <div
            className={`relative flex items-center gap-2.5 px-4 py-2 rounded-2xl border shadow-[0_0_28px_rgba(239,68,68,0.65)] ${
              comboCount >= 10
                ? 'bg-gradient-to-r from-red-600 via-amber-500 to-purple-700 border-yellow-200/80'
                : comboCount >= 5
                ? 'bg-gradient-to-r from-[#7928CA] via-[#EC4899] to-amber-500 border-pink-300/75'
                : 'bg-gradient-to-r from-orange-600 via-amber-500 to-rose-600 border-yellow-300/60'
            }`}
          >
            <Flame className="w-5 h-5 text-yellow-200 fill-current shrink-0" />
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-yellow-100">
                {comboCount >= 10
                  ? 'LEGENDARY STREAK'
                  : comboCount >= 5
                  ? 'MEGA COMBO'
                  : 'RAPID COMBO'}
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-2xl font-black italic tracking-tighter text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] tabular-nums">
                  x {comboCount}
                </span>
                <span className="text-xs font-bold text-white/90 truncate max-w-[90px]">
                  {gift.icon} {gift.name}
                </span>
              </div>
            </div>
            <span className="text-xl shrink-0">🔥</span>
          </div>
        </div>
      )}

      {/* 3. FINITE NON-BLINKING FULL-SCREEN 3D VISUAL ANIMATION EFFECTS (5s - 7.5s) */}
      <div className="relative flex-1 flex items-center justify-center pointer-events-none">
        {gift.animationType === 'heart' && (
          <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
            {rosePetals.map((petal) => (
              <div
                key={petal.id}
                className="absolute text-xl animate-petal pointer-events-none"
                style={
                  {
                    left: petal.left,
                    top: '-30px',
                    animationDelay: petal.delay,
                    '--drift-x': petal.drift,
                    fontSize: petal.size,
                    transform: `rotate(${petal.rotate})`,
                  } as React.CSSProperties
                }
              >
                {gift.icon || '💖'}
              </div>
            ))}

            <div className={`relative flex flex-col items-center justify-center ${primaryAnimClass}`}>
              <div className="absolute w-60 h-60 rounded-full bg-rose-500/20 blur-3xl" />
              <div className="relative text-8xl sm:text-9xl drop-shadow-[0_0_40px_rgba(244,63,94,0.85)]">
                {gift.icon || '💖'}
              </div>
              <div className="mt-4 px-4 py-1.5 rounded-full bg-rose-950/85 border border-rose-500/40 backdrop-blur-md shadow-xl text-rose-200 text-xs font-black tracking-widest uppercase flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-rose-400" />
                <span>{gift.name}</span>
                <Sparkles className="w-3.5 h-3.5 text-rose-400" />
              </div>
            </div>
          </div>
        )}

        {gift.animationType === 'sparkle' && (
          <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
            <div className="absolute w-56 h-56 rounded-full border-4 border-pink-500 animate-shockwave" />
            <div
              className="absolute w-56 h-56 rounded-full border-4 border-purple-400 animate-shockwave"
              style={{ animationDelay: '0.4s' }}
            />

            {neonHearts.map((h) => (
              <div
                key={h.id}
                className="absolute bottom-10 animate-float-heart text-2xl"
                style={{
                  left: h.left,
                  animationDelay: h.delay,
                  transform: `scale(${h.scale})`,
                }}
              >
                {gift.icon || '✨'}
              </div>
            ))}

            <div className={`relative flex flex-col items-center justify-center ${primaryAnimClass}`}>
              <div className="absolute w-64 h-64 rounded-full bg-pink-500/25 blur-3xl" />
              <div className="relative text-8xl sm:text-9xl drop-shadow-[0_0_50px_rgba(236,72,153,0.9)]">
                {gift.icon || '✨'}
              </div>
              <div className="mt-4 px-5 py-2 rounded-2xl bg-[#2A0E3B]/90 border border-pink-500/50 backdrop-blur-md shadow-2xl text-pink-200 text-sm font-black tracking-wider uppercase flex items-center gap-2">
                <span>✨ {gift.name} ✨</span>
              </div>
            </div>
          </div>
        )}

        {gift.animationType === 'ring' && (
          <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
            <div className={`relative flex flex-col items-center justify-center ${primaryAnimClass}`}>
              <div className="absolute w-72 h-72 rounded-full bg-cyan-400/20 blur-3xl" />
              <div className="text-8xl sm:text-9xl drop-shadow-[0_0_45px_rgba(34,211,238,0.85)]">
                💍
              </div>
              <div className="mt-4 px-5 py-2 rounded-2xl bg-[#091E33]/90 border border-cyan-400/60 backdrop-blur-md shadow-2xl text-cyan-200 text-xs font-black tracking-widest uppercase flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-cyan-300" />
                <span>Eternal Diamond Sparkle</span>
                <Sparkles className="w-4 h-4 text-cyan-300" />
              </div>
            </div>
          </div>
        )}

        {gift.animationType === 'crown' && (
          <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
            <div className={`relative flex flex-col items-center justify-center ${primaryAnimClass}`}>
              <div className="absolute w-72 h-72 rounded-full bg-amber-400/25 blur-3xl" />
              <div className="text-8xl sm:text-9xl drop-shadow-[0_0_55px_rgba(251,191,36,0.95)]">
                👑
              </div>
              <div className="mt-3 px-6 py-2 rounded-2xl bg-gradient-to-r from-amber-600 via-yellow-400 to-amber-600 p-[2px] shadow-[0_0_26px_rgba(251,191,36,0.7)]">
                <div className="px-4 py-1.5 rounded-[14px] bg-black/90 backdrop-blur-md flex items-center gap-2 text-yellow-300 font-black text-xs uppercase tracking-widest">
                  <Crown className="w-4 h-4 text-yellow-400" />
                  <span>Imperial Alpha Crown</span>
                  <Crown className="w-4 h-4 text-yellow-400" />
                </div>
              </div>
            </div>
          </div>
        )}

        {gift.animationType === 'car' && (
          <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
            <div className={`relative flex flex-col items-center justify-center ${primaryAnimClass}`}>
              <div className="absolute -left-12 -right-12 bottom-0 h-12 bg-purple-600/35 blur-2xl rounded-full" />
              <div className="text-8xl sm:text-9xl drop-shadow-[0_0_50px_rgba(168,85,247,0.9)] transform -scale-x-100">
                🏎️
              </div>
              <div className="mt-4 px-6 py-2 rounded-2xl bg-[#1E0B36]/90 border border-purple-500/70 backdrop-blur-md shadow-[0_0_24px_rgba(168,85,247,0.75)] text-purple-200 text-xs font-black tracking-widest uppercase flex items-center gap-2">
                <Flame className="w-4 h-4 text-cyan-400" />
                <span>Cyber Supercar Twin-Turbo</span>
                <Flame className="w-4 h-4 text-pink-400" />
              </div>
            </div>
          </div>
        )}

        {gift.animationType === 'yacht' && (
          <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
            {fireworks.map((fw, idx) => (
              <div
                key={idx}
                className={`absolute w-24 h-24 rounded-full border-4 ${fw.border} animate-shockwave pointer-events-none`}
                style={{
                  left: fw.x,
                  top: fw.y,
                  animationDelay: fw.delay,
                }}
              />
            ))}

            <div className={`relative flex flex-col items-center justify-center ${primaryAnimClass}`}>
              <div className="absolute w-80 h-40 -bottom-4 bg-cyan-500/20 blur-2xl rounded-full" />
              <div className="text-8xl sm:text-9xl drop-shadow-[0_0_45px_rgba(6,182,212,0.85)]">
                🛥️
              </div>
              <div className="mt-4 px-6 py-2 rounded-2xl bg-[#081F2C]/90 border border-cyan-400/60 backdrop-blur-md shadow-2xl text-cyan-200 text-xs font-black tracking-widest uppercase flex items-center gap-2">
                <span>🥂 VIP Royal Yacht Cruise 🎆</span>
              </div>
            </div>
          </div>
        )}

        {gift.animationType === 'rocket' && (
          <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
            <div className={`relative flex flex-col items-center justify-center ${primaryAnimClass}`}>
              <div className="text-8xl sm:text-9xl drop-shadow-[0_0_60px_rgba(249,115,22,0.95)]">
                🚀
              </div>
              <div className="w-14 h-24 bg-gradient-to-t from-transparent via-yellow-400 to-orange-600 rounded-full blur-md -mt-4 opacity-90" />
              <div className="mt-2 px-6 py-2 rounded-2xl bg-[#1A0B2E]/90 border border-orange-500/70 backdrop-blur-md shadow-[0_0_28px_rgba(249,115,22,0.75)] text-orange-200 text-xs font-black tracking-widest uppercase flex items-center gap-2">
                <span>🌌 Galaxy Orbital Blast-Off 🌌</span>
              </div>
            </div>
          </div>
        )}

        {gift.animationType === 'dragon' && (
          <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
            <div className={`relative flex flex-col items-center justify-center ${primaryAnimClass}`}>
              <div className="absolute w-88 h-88 rounded-full bg-red-600/20 blur-3xl" />
              <div className="text-9xl sm:text-[140px] drop-shadow-[0_0_70px_rgba(239,68,68,0.95)] transform scale-x-[-1]">
                🐉
              </div>
              <div className="mt-2 flex items-center gap-1 text-3xl">
                <span>🔥</span>
                <span>🔥</span>
                <span>🔥</span>
                <span>🔥</span>
                <span>🔥</span>
              </div>
              <div className="mt-3 px-7 py-2.5 rounded-2xl bg-gradient-to-r from-red-600 via-amber-500 to-red-600 p-[2px] shadow-[0_0_36px_rgba(239,68,68,0.85)]">
                <div className="px-5 py-1.5 rounded-[14px] bg-black/95 backdrop-blur-md flex items-center gap-2 text-yellow-300 font-black text-xs uppercase tracking-widest">
                  <Flame className="w-4 h-4 text-red-500" />
                  <span>Mythic Imperial Dragon Roar</span>
                  <Flame className="w-4 h-4 text-red-500" />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer Spacing for stream controls */}
      <div className="h-24 w-full pointer-events-none" />
    </div>
  );
};
