import React, { useEffect, useMemo, useState } from 'react';
import { VipAvatarFrame, VIP_TIER_CONFIGS } from '../brand/VipAvatarFrame';
import { audioManager } from '../../services/audioManager';

/** Minimum VIP tier required to trigger the grand Party Room VIP Entry Animation */
export const VIP_ENTRY_MIN_TIER = 3;

export interface VipEntryEvent {
  id: string;
  roomId: string;
  userId: string;
  displayName: string;
  avatar: string;
  vipTier: number;
  level?: number;
  isHost?: boolean;
  timestamp: number;
  isPreview?: boolean;
}

export type VipPrestigeClass = 'royal' | 'imperial' | 'sovereign';

export interface VipEntryStyleProfile {
  prestigeClass: VipPrestigeClass;
  tierName: string;
  tierLabel: string;
  accentHex: string;
  secondaryHex: string;
  borderRgba: string;
  surfaceGradient: string;
  sheenGradient: string;
  durationMs: number;
}

export function getVipEntryStyleProfile(vipTier: number): VipEntryStyleProfile {
  const clampedTier = Math.max(1, Math.min(12, Math.floor(Number(vipTier) || 3)));
  const config =
    VIP_TIER_CONFIGS.find((c) => c.tier === clampedTier) || VIP_TIER_CONFIGS[2];

  if (clampedTier >= 9) {
    // Sovereign Emperor Class (VIP 9–12)
    const accentHex =
      clampedTier === 9
        ? '#BAE6FD'
        : clampedTier === 11
        ? '#E879F9'
        : '#FDE047';
    const secondaryHex =
      clampedTier === 9
        ? '#38BDF8'
        : clampedTier === 11
        ? '#FACC15'
        : '#EC4899';

    return {
      prestigeClass: 'sovereign',
      tierName: config.name,
      tierLabel: `VIP ${clampedTier}`,
      accentHex,
      secondaryHex,
      borderRgba:
        clampedTier === 9
          ? 'rgba(186, 230, 253, 0.5)'
          : clampedTier === 11
          ? 'rgba(232, 121, 249, 0.5)'
          : 'rgba(253, 224, 71, 0.58)',
      surfaceGradient:
        clampedTier === 9
          ? 'linear-gradient(105deg, rgba(11, 22, 42, 0.95) 0%, rgba(16, 36, 68, 0.92) 55%, rgba(10, 18, 34, 0.95) 100%)'
          : clampedTier === 11
          ? 'linear-gradient(105deg, rgba(24, 10, 44, 0.95) 0%, rgba(50, 16, 82, 0.92) 55%, rgba(22, 10, 36, 0.95) 100%)'
          : 'linear-gradient(105deg, rgba(24, 14, 10, 0.96) 0%, rgba(56, 26, 16, 0.92) 52%, rgba(28, 12, 34, 0.95) 100%)',
      sheenGradient: `linear-gradient(90deg, transparent 0%, ${accentHex}40 48%, rgba(255,255,255,0.45) 54%, transparent 100%)`,
      durationMs: 5200,
    };
  }

  if (clampedTier >= 6) {
    // Imperial Gem Class (VIP 6–8)
    const accentHex =
      clampedTier === 6
        ? '#34D399'
        : clampedTier === 7
        ? '#F87171'
        : '#C084FC';
    const secondaryHex =
      clampedTier === 6
        ? '#10B981'
        : clampedTier === 7
        ? '#F97316'
        : '#FACC15';

    return {
      prestigeClass: 'imperial',
      tierName: config.name,
      tierLabel: `VIP ${clampedTier}`,
      accentHex,
      secondaryHex,
      borderRgba:
        clampedTier === 6
          ? 'rgba(52, 211, 153, 0.48)'
          : clampedTier === 7
          ? 'rgba(248, 113, 113, 0.5)'
          : 'rgba(192, 132, 252, 0.5)',
      surfaceGradient:
        clampedTier === 6
          ? 'linear-gradient(105deg, rgba(8, 28, 24, 0.95) 0%, rgba(12, 46, 38, 0.92) 55%, rgba(8, 22, 20, 0.95) 100%)'
          : clampedTier === 7
          ? 'linear-gradient(105deg, rgba(34, 10, 16, 0.95) 0%, rgba(62, 16, 24, 0.92) 55%, rgba(28, 9, 16, 0.95) 100%)'
          : 'linear-gradient(105deg, rgba(22, 10, 42, 0.95) 0%, rgba(44, 18, 76, 0.92) 55%, rgba(18, 10, 34, 0.95) 100%)',
      sheenGradient: `linear-gradient(90deg, transparent 0%, ${accentHex}38 50%, transparent 100%)`,
      durationMs: 4700,
    };
  }

  // Royal Gold / Platinum / Sapphire Class (VIP 3–5)
  const accentHex =
    clampedTier === 3 ? '#FACC15' : clampedTier === 4 ? '#38BDF8' : '#60A5FA';
  const secondaryHex =
    clampedTier === 3 ? '#F59E0B' : clampedTier === 4 ? '#7DD3FC' : '#3B82F6';

  return {
    prestigeClass: 'royal',
    tierName: config.name,
    tierLabel: `VIP ${clampedTier}`,
    accentHex,
    secondaryHex,
    borderRgba:
      clampedTier === 3
        ? 'rgba(250, 204, 21, 0.45)'
        : clampedTier === 4
        ? 'rgba(56, 189, 248, 0.45)'
        : 'rgba(96, 165, 250, 0.45)',
    surfaceGradient:
      clampedTier === 3
        ? 'linear-gradient(105deg, rgba(26, 18, 10, 0.94) 0%, rgba(48, 32, 12, 0.9) 55%, rgba(20, 14, 10, 0.94) 100%)'
        : 'linear-gradient(105deg, rgba(10, 18, 38, 0.94) 0%, rgba(16, 32, 66, 0.9) 55%, rgba(10, 16, 32, 0.94) 100%)',
    sheenGradient: `linear-gradient(90deg, transparent 0%, ${accentHex}34 50%, transparent 100%)`,
    durationMs: 4300,
  };
}

/** Crisp geometric tier crest emblem rendered on the right edge of the banner */
const VipPrestigeCrest: React.FC<{
  prestigeClass: VipPrestigeClass;
  accentHex: string;
  secondaryHex: string;
}> = ({ prestigeClass, accentHex, secondaryHex }) => {
  if (prestigeClass === 'sovereign') {
    return (
      <svg
        viewBox="0 0 44 36"
        className="w-10 h-8 shrink-0"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="vipCrestSov" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={accentHex} />
            <stop offset="100%" stopColor={secondaryHex} />
          </linearGradient>
        </defs>
        {/* Twin sovereign geometric wings */}
        <path
          d="M2 19 L11 13 L9 20 L13 24 L4 23 Z M42 19 L33 13 L35 20 L31 24 L40 23 Z"
          fill="url(#vipCrestSov)"
          opacity="0.72"
        />
        {/* Crown silhouette */}
        <path
          d="M12 24 L10 11 L17 16 L22 7 L27 16 L34 11 L32 24 Z"
          fill="url(#vipCrestSov)"
          stroke="#FFFFFF"
          strokeOpacity="0.45"
          strokeWidth="0.9"
          strokeLinejoin="round"
        />
        {/* Base bar & jewel */}
        <rect x="12" y="25.5" width="20" height="2.6" rx="1.3" fill={accentHex} />
        <circle cx="22" cy="18" r="2.1" fill="#FFFFFF" opacity="0.9" />
      </svg>
    );
  }

  if (prestigeClass === 'imperial') {
    return (
      <svg
        viewBox="0 0 38 36"
        className="w-8 h-8 shrink-0"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="vipCrestImp" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={accentHex} />
            <stop offset="100%" stopColor={secondaryHex} />
          </linearGradient>
        </defs>
        {/* Faceted imperial gem */}
        <polygon
          points="19,4 31,14 19,32 7,14"
          fill="url(#vipCrestImp)"
          fillOpacity="0.22"
          stroke={accentHex}
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
        <polygon
          points="19,9 26,15 19,26 12,15"
          fill="url(#vipCrestImp)"
          opacity="0.9"
        />
        <path d="M7 14 L31 14" stroke="#FFFFFF" strokeOpacity="0.45" strokeWidth="0.9" />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 36 36"
      className="w-8 h-8 shrink-0"
      aria-hidden="true"
    >
      <path
        d="M18 5 L21.4 13.4 L30 14.2 L23.5 19.8 L25.5 28.4 L18 23.8 L10.5 28.4 L12.5 19.8 L6 14.2 L14.6 13.4 Z"
        fill={accentHex}
        fillOpacity="0.22"
        stroke={accentHex}
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <circle cx="18" cy="18" r="3" fill={accentHex} />
    </svg>
  );
};

interface VipEntryBannerOverlayProps {
  currentEvent: VipEntryEvent | null;
  onComplete: (eventId: string) => void;
}

/**
 * Non-blocking VIP Entry Animation Overlay for Party Rooms.
 * Sits in a dedicated upper-stage lane (z-[42], pointer-events-none) so it
 * never overlaps header controls, seats, comments, or full-screen gift effects.
 */
export const VipEntryBannerOverlay: React.FC<VipEntryBannerOverlayProps> = ({
  currentEvent,
  onComplete,
}) => {
  const [phase, setPhase] = useState<'enter' | 'exit'>('enter');

  const profile = useMemo(
    () => (currentEvent ? getVipEntryStyleProfile(currentEvent.vipTier) : null),
    [currentEvent?.vipTier]
  );

  useEffect(() => {
    if (!currentEvent || !profile) return;

    setPhase('enter');

    // Trigger prestige entrance fanfare (respects global mute/volume in audioManager)
    void audioManager.playVipEntrySfx(currentEvent.vipTier);

    const exitLeadMs = 340;
    const exitAtMs = Math.max(1200, profile.durationMs - exitLeadMs);

    const exitTimer = window.setTimeout(() => {
      setPhase('exit');
    }, exitAtMs);

    const completeTimer = window.setTimeout(() => {
      onComplete(currentEvent.id);
    }, profile.durationMs);

    return () => {
      window.clearTimeout(exitTimer);
      window.clearTimeout(completeTimer);
    };
  }, [currentEvent?.id, profile, onComplete]);

  if (!currentEvent || !profile) return null;

  return (
    <div
      data-keep-dark="true"
      aria-live="polite"
      className="pointer-events-none absolute inset-x-0 top-2 z-[42] flex justify-center px-3 select-none"
    >
      <div
        key={currentEvent.id}
        className={`relative w-full max-w-[364px] rounded-2xl overflow-hidden backdrop-blur-md shadow-2xl ${
          phase === 'exit' ? 'animate-vip-entry-out' : 'animate-vip-entry-in'
        }`}
        style={
          {
            background: profile.surfaceGradient,
            border: `1px solid ${profile.borderRgba}`,
            boxShadow: `0 12px 32px -10px rgba(0, 0, 0, 0.75), 0 0 24px -8px ${profile.accentHex}55`,
            '--vip-entry-duration': `${profile.durationMs}ms`,
          } as React.CSSProperties
        }
      >
        {/* Single diagonal specular sheen pass */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-0 w-1/2 animate-vip-entry-sheen"
          style={{ background: profile.sheenGradient }}
        />

        {/* Subtle ambient edge highlight behind avatar */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-4 top-1/2 -translate-y-1/2 w-24 h-24 rounded-full blur-2xl opacity-35"
          style={{ background: profile.accentHex }}
        />

        <div className="relative z-10 flex items-center gap-3 px-3.5 py-2.5">
          {/* Framed VIP Avatar */}
          <VipAvatarFrame
            avatarUrl={currentEvent.avatar}
            vipTier={currentEvent.vipTier}
            size="sm"
            showCrownBadge={false}
            animated={false}
          />

          {/* Typographic hierarchy: clean unboxed tier metadata + crisp announcement */}
          <div className="min-w-0 flex-1">
            <div
              className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide truncate"
              style={{ color: profile.accentHex }}
            >
              <span className="shrink-0">{profile.tierLabel}</span>
              <span aria-hidden="true" className="opacity-55">
                ·
              </span>
              <span className="truncate">{profile.tierName}</span>
            </div>

            <div className="mt-0.5 flex items-baseline gap-1.5 min-w-0">
              <span className="text-[13px] font-bold text-white truncate">
                {currentEvent.displayName}
              </span>
              <span className="text-[11px] font-medium text-zinc-300 whitespace-nowrap shrink-0">
                entered the room
              </span>
            </div>
          </div>

          {/* Prestige SVG Crest */}
          <VipPrestigeCrest
            prestigeClass={profile.prestigeClass}
            accentHex={profile.accentHex}
            secondaryHex={profile.secondaryHex}
          />
        </div>

        {/* Hairline bottom duration bar */}
        <div className="relative h-[2px] w-full bg-white/10 overflow-hidden">
          <div
            className="h-full w-full animate-vip-entry-progress"
            style={{
              background: `linear-gradient(90deg, ${profile.secondaryHex}, ${profile.accentHex})`,
            }}
          />
        </div>
      </div>
    </div>
  );
};
