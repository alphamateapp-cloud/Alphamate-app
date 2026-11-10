import React, { useEffect, useState, useMemo } from 'react';
import { Gift } from '../../types';
import { Sparkles, Flame, Volume2, VolumeX, Crown } from 'lucide-react';
import { giftSoundEngine } from '../../utils/giftSoundEffects';

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
}

interface GiftAnimationOverlayProps {
  currentEvent: ActiveGiftEvent | null;
  onComplete: () => void;
}

export const GiftAnimationOverlay: React.FC<GiftAnimationOverlayProps> = ({
  currentEvent,
  onComplete,
}) => {
  const [isMuted, setIsMuted] = useState(() => giftSoundEngine.getIsMuted());
  const [shakeScreen, setShakeScreen] = useState(false);

  useEffect(() => {
    if (!currentEvent) return;

    // Trigger sound effect
    giftSoundEngine.play(currentEvent.gift.animationType);
    if (currentEvent.comboCount > 1) {
      giftSoundEngine.playComboSound(currentEvent.comboCount);
    }

    // Trigger screen shake for heavy/epic gifts
    if (['car', 'rocket', 'dragon', 'crown'].includes(currentEvent.gift.animationType)) {
      setShakeScreen(true);
      const shakeTimer = setTimeout(() => setShakeScreen(false), 500);
      return () => clearTimeout(shakeTimer);
    }
  }, [currentEvent?.id]);

  useEffect(() => {
    if (!currentEvent) return;

    // Auto-dismiss animation after duration
    const duration = currentEvent.gift.coins >= 4999 ? 4200 : 3200;
    const timer = setTimeout(() => {
      onComplete();
    }, duration);

    return () => clearTimeout(timer);
  }, [currentEvent?.id, onComplete]);

  const handleToggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    const muted = giftSoundEngine.toggleMute();
    setIsMuted(muted);
  };

  // Randomized petals for Lucky Rose
  const rosePetals = useMemo(() => {
    return Array.from({ length: 18 }).map((_, i) => ({
      id: i,
      left: `${(i * 5.5 + Math.random() * 8) % 95}%`,
      drift: `${(Math.random() - 0.5) * 120}px`,
      delay: `${Math.random() * 0.8}s`,
      size: `${14 + Math.random() * 12}px`,
      rotate: `${Math.random() * 360}deg`,
    }));
  }, [currentEvent?.id]);

  // Randomized neon mini hearts
  const neonHearts = useMemo(() => {
    return Array.from({ length: 16 }).map((_, i) => ({
      id: i,
      left: `${(i * 6 + Math.random() * 8) % 92}%`,
      delay: `${Math.random() * 0.7}s`,
      scale: 0.6 + Math.random() * 0.8,
    }));
  }, [currentEvent?.id]);

  // Fireworks particles for Yacht
  const fireworks = useMemo(() => {
    return [
      { x: '25%', y: '28%', color: '#EC4899', delay: '0.3s' },
      { x: '75%', y: '22%', color: '#F59E0B', delay: '0.6s' },
      { x: '50%', y: '18%', color: '#3B82F6', delay: '0.9s' },
      { x: '35%', y: '35%', color: '#10B981', delay: '1.2s' },
      { x: '68%', y: '30%', color: '#A855F7', delay: '1.5s' },
    ];
  }, [currentEvent?.id]);

  if (!currentEvent) return null;

  const { gift, senderName, senderAvatar, senderVipTier = 1, recipientName, comboCount, quantity } = currentEvent;
  const isEpic = gift.coins >= 4999;
  const totalCoins = gift.coins * quantity;

  return (
    <div
      className={`fixed inset-0 z-50 pointer-events-none flex flex-col justify-between overflow-hidden ${
        shakeScreen ? 'animate-gift-shake' : ''
      }`}
    >
      {/* Sound Mute/Unmute Float Toggle (Top-Right under stream HUD) */}
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
              <Volume2 className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
              <span className="text-[10px] text-amber-300 font-bold">SFX On</span>
            </>
          )}
        </button>
      </div>

      {/* =========================================================================
          1. SPECTACULAR TOP VIP SENDER CAPSULE BANNER
          ========================================================================= */}
      <div className="pt-20 px-3 sm:px-6 w-full max-w-lg mx-auto">
        <div className="relative rounded-2xl p-[2px] bg-gradient-to-r from-amber-400 via-[#EC4899] to-[#7928CA] shadow-[0_0_35px_rgba(236,72,153,0.6)] animate-slide-up">
          <div className="rounded-[14px] bg-[#120B24]/95 backdrop-blur-xl px-3.5 py-2.5 flex items-center justify-between gap-3">
            {/* Sender with VIP Badge & Avatar */}
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

            {/* Gift Icon & Coin Bounty */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-3xl animate-bounce drop-shadow-[0_0_12px_rgba(255,215,0,0.8)]">
                {gift.icon}
              </span>
              <div className="text-right">
                <div className="text-xs font-black text-amber-400 flex items-center gap-0.5 justify-end">
                  <span>+{totalCoins.toLocaleString()}</span>
                  <span className="text-[10px]">💰</span>
                </div>
                <div className="text-[9px] text-zinc-400 font-semibold uppercase tracking-wider">
                  {gift.animationType}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          2. COMBO MULTIPLIER COUNTER (PUNCHY SPRING BOUNCE)
          ========================================================================= */}
      {comboCount > 1 && (
        <div className="absolute top-36 left-4 z-40 animate-combo-pop">
          <div className="relative flex items-center gap-2 px-4 py-2 rounded-2xl bg-gradient-to-r from-red-600 via-amber-500 to-purple-600 shadow-[0_0_30px_rgba(239,68,68,0.8)] border border-yellow-300/60">
            <Flame className="w-6 h-6 text-yellow-200 animate-pulse fill-current" />
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-yellow-200">
                {comboCount >= 10 ? 'LEGENDARY STREAK' : 'COMBO'}
              </div>
              <div className="text-2xl font-black italic tracking-tighter text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                x {comboCount}
              </div>
            </div>
            <span className="text-xl">🔥</span>
          </div>
        </div>
      )}

      {/* =========================================================================
          3. FULL-SCREEN 3D VISUAL ANIMATION EFFECTS (CUSTOM FOR EACH GIFT)
          ========================================================================= */}
      <div className="relative flex-1 flex items-center justify-center pointer-events-none">
        {/* A. LUCKY ROSE 🌹 (Cascading Petal Storm & Golden Bloom) */}
        {gift.animationType === 'heart' && (
          <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
            {/* Falling Rose Petals */}
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
                🌹
              </div>
            ))}

            {/* Central Blooming Giant Rose with Halo */}
            <div className="relative flex flex-col items-center justify-center animate-combo-pop">
              <div className="absolute w-64 h-64 rounded-full bg-rose-500/20 blur-3xl animate-pulse" />
              <div className="relative text-8xl sm:text-9xl animate-spin-slow drop-shadow-[0_0_45px_rgba(244,63,94,0.9)]">
                🌹
              </div>
              <div className="mt-4 px-4 py-1.5 rounded-full bg-rose-950/80 border border-rose-500/40 backdrop-blur-md shadow-xl text-rose-200 text-xs font-black tracking-widest uppercase flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-rose-400" />
                <span>Sweet Appreciation</span>
                <Sparkles className="w-3.5 h-3.5 text-rose-400" />
              </div>
            </div>
          </div>
        )}

        {/* B. NEON HEART 💖 (Multi-Layer Shockwave & Pulsing Cyber Core) */}
        {gift.animationType === 'sparkle' && (
          <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
            {/* Triple Shockwave Rings */}
            <div className="absolute w-56 h-56 rounded-full border-4 border-pink-500 animate-shockwave" />
            <div
              className="absolute w-56 h-56 rounded-full border-4 border-purple-400 animate-shockwave"
              style={{ animationDelay: '0.4s' }}
            />
            <div
              className="absolute w-56 h-56 rounded-full border-4 border-amber-300 animate-shockwave"
              style={{ animationDelay: '0.8s' }}
            />

            {/* Rising Neon Mini Hearts */}
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
                💖
              </div>
            ))}

            {/* Massive Pulsing Neon Heart Core */}
            <div className="relative flex flex-col items-center justify-center animate-combo-pop">
              <div className="absolute w-72 h-72 rounded-full bg-pink-500/30 blur-3xl animate-pulse" />
              <div className="relative text-8xl sm:text-9xl animate-bounce drop-shadow-[0_0_60px_rgba(236,72,153,1)]">
                💖
              </div>
              <div className="mt-4 px-5 py-2 rounded-2xl bg-[#2A0E3B]/90 border border-pink-500/50 backdrop-blur-md shadow-2xl text-pink-200 text-sm font-black tracking-wider uppercase flex items-center gap-2">
                <span>⚡ NEON LOVE PULSE ⚡</span>
              </div>
            </div>
          </div>
        )}

        {/* C. DIAMOND RING 💍 (Prismatic Volumetric Beams & Shimmering Box) */}
        {gift.animationType === 'ring' && (
          <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
            {/* Prismatic Rotating Rays */}
            <div className="absolute w-96 h-96 animate-spin-slow opacity-40">
              <svg viewBox="0 0 100 100" className="w-full h-full fill-cyan-400">
                {Array.from({ length: 12 }).map((_, i) => (
                  <polygon
                    key={i}
                    points="50,50 46,0 54,0"
                    transform={`rotate(${i * 30} 50 50)`}
                    opacity="0.25"
                  />
                ))}
              </svg>
            </div>

            {/* Floating Brilliant Diamond */}
            <div className="relative flex flex-col items-center justify-center animate-ring-levitate">
              <div className="absolute w-80 h-80 rounded-full bg-cyan-400/25 blur-3xl animate-pulse" />
              <div className="text-8xl sm:text-9xl drop-shadow-[0_0_50px_rgba(34,211,238,0.9)] animate-pulse">
                💍
              </div>
              <div className="mt-4 px-5 py-2 rounded-2xl bg-[#091E33]/90 border border-cyan-400/60 backdrop-blur-md shadow-2xl text-cyan-200 text-xs font-black tracking-widest uppercase flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-cyan-300 animate-spin" />
                <span>Eternal Diamond Sparkle</span>
                <Sparkles className="w-4 h-4 text-cyan-300 animate-spin" />
              </div>
            </div>
          </div>
        )}

        {/* D. ALPHA CROWN 👑 (Imperial Coronation Descent & Gold Confetti) */}
        {gift.animationType === 'crown' && (
          <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
            {/* Celestial Golden Sunbeams */}
            <div className="absolute inset-0 bg-gradient-to-b from-amber-400/20 via-transparent to-transparent pointer-events-none" />

            {/* Golden Descending Imperial Crown */}
            <div className="relative flex flex-col items-center justify-center animate-crown-drop">
              <div className="absolute w-80 h-80 rounded-full bg-amber-400/30 blur-3xl animate-pulse" />
              <div className="text-8xl sm:text-9xl drop-shadow-[0_0_65px_rgba(251,191,36,1)]">
                👑
              </div>
              <div className="mt-3 px-6 py-2 rounded-2xl bg-gradient-to-r from-amber-600 via-yellow-400 to-amber-600 p-[2px] shadow-[0_0_30px_rgba(251,191,36,0.8)]">
                <div className="px-4 py-1.5 rounded-[14px] bg-black/90 backdrop-blur-md flex items-center gap-2 text-yellow-300 font-black text-xs uppercase tracking-widest">
                  <Crown className="w-4 h-4 text-yellow-400" />
                  <span>Imperial Alpha Crown</span>
                  <Crown className="w-4 h-4 text-yellow-400" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* E. CYBER SUPERCAR 🏎️ (Twin-Turbo Drift & Neon Burnout Smoke) */}
        {gift.animationType === 'car' && (
          <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
            {/* Neon Speed Lines */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-70">
              <div className="absolute top-1/3 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent animate-pulse" />
              <div className="absolute top-1/2 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-pink-500 to-transparent animate-pulse" />
              <div className="absolute top-2/3 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-purple-400 to-transparent animate-pulse" />
            </div>

            {/* Cruising Supercar */}
            <div className="relative flex flex-col items-center justify-center animate-supercar">
              <div className="absolute -left-12 -right-12 bottom-0 h-12 bg-purple-600/40 blur-2xl rounded-full" />
              <div className="text-8xl sm:text-9xl drop-shadow-[0_0_55px_rgba(168,85,247,0.9)] transform -scale-x-100">
                🏎️
              </div>
              <div className="mt-4 px-6 py-2 rounded-2xl bg-[#1E0B36]/90 border border-purple-500/70 backdrop-blur-md shadow-[0_0_25px_rgba(168,85,247,0.8)] text-purple-200 text-xs font-black tracking-widest uppercase flex items-center gap-2">
                <Flame className="w-4 h-4 text-cyan-400 animate-pulse" />
                <span>Cyber Supercar Twin-Turbo</span>
                <Flame className="w-4 h-4 text-pink-400 animate-pulse" />
              </div>
            </div>
          </div>
        )}

        {/* F. ROYAL YACHT 🛥️ (Ocean Waves & Fireworks Starbursts) */}
        {gift.animationType === 'yacht' && (
          <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
            {/* Fireworks Overhead */}
            {fireworks.map((fw, idx) => (
              <div
                key={idx}
                className="absolute w-20 h-20 rounded-full animate-ping opacity-75 pointer-events-none"
                style={{
                  left: fw.x,
                  top: fw.y,
                  backgroundColor: fw.color,
                  animationDelay: fw.delay,
                  animationDuration: '1.2s',
                }}
              />
            ))}

            {/* Cruising Yacht */}
            <div className="relative flex flex-col items-center justify-center animate-yacht">
              <div className="absolute w-80 h-40 -bottom-4 bg-cyan-500/20 blur-2xl rounded-full" />
              <div className="text-8xl sm:text-9xl drop-shadow-[0_0_50px_rgba(6,182,212,0.9)]">
                🛥️
              </div>
              <div className="mt-4 px-6 py-2 rounded-2xl bg-[#081F2C]/90 border border-cyan-400/60 backdrop-blur-md shadow-2xl text-cyan-200 text-xs font-black tracking-widest uppercase flex items-center gap-2">
                <span>🥂 VIP Royal Yacht Cruise 🎆</span>
              </div>
            </div>
          </div>
        )}

        {/* G. GALAXY ROCKET 🚀 (Cosmic Blast Off & Hyperspace Trails) */}
        {gift.animationType === 'rocket' && (
          <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
            {/* Deep Space Starfield & Exhaust Glow */}
            <div className="absolute inset-0 bg-indigo-950/40 pointer-events-none" />

            {/* Launching Rocket */}
            <div className="relative flex flex-col items-center justify-center animate-rocket-launch">
              <div className="text-8xl sm:text-9xl drop-shadow-[0_0_65px_rgba(249,115,22,1)]">
                🚀
              </div>
              {/* Fiery Exhaust Trail */}
              <div className="w-16 h-28 bg-gradient-to-t from-transparent via-yellow-400 to-orange-600 rounded-full blur-md animate-pulse -mt-4 opacity-90" />
              <div className="mt-2 px-6 py-2 rounded-2xl bg-[#1A0B2E]/90 border border-orange-500/70 backdrop-blur-md shadow-[0_0_30px_rgba(249,115,22,0.8)] text-orange-200 text-xs font-black tracking-widest uppercase flex items-center gap-2">
                <span>🌌 Galaxy Orbital Blast-Off 🌌</span>
              </div>
            </div>
          </div>
        )}

        {/* H. MYTHIC DRAGON 🐉 (Imperial Fire Breath & Serpentine Sky Curve) */}
        {gift.animationType === 'dragon' && (
          <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
            {/* Lightning Flashes */}
            <div className="absolute inset-0 bg-amber-500/10 animate-pulse pointer-events-none" />

            {/* Flying Serpentine Mythic Dragon */}
            <div className="relative flex flex-col items-center justify-center animate-dragon-fly">
              <div className="absolute w-96 h-96 rounded-full bg-red-600/25 blur-3xl animate-pulse" />
              <div className="text-9xl sm:text-[140px] drop-shadow-[0_0_75px_rgba(239,68,68,1)] transform scale-x-[-1]">
                🐉
              </div>
              {/* Fire Torrent */}
              <div className="mt-2 flex items-center gap-1 text-3xl animate-pulse">
                <span>🔥</span>
                <span>🔥</span>
                <span>🔥</span>
                <span>🔥</span>
                <span>🔥</span>
              </div>
              <div className="mt-3 px-7 py-2.5 rounded-2xl bg-gradient-to-r from-red-600 via-amber-500 to-red-600 p-[2px] shadow-[0_0_40px_rgba(239,68,68,0.9)]">
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
