import React, { useId } from 'react';
import { X, ShieldCheck, Crown, CheckCircle2, Sparkles } from 'lucide-react';

export type VerificationTickSize = 'xs' | 'sm' | 'md' | 'lg';

const SIZE_CLASSES: Record<VerificationTickSize, string> = {
  xs: 'w-3.5 h-3.5',
  sm: 'w-4 h-4',
  md: 'w-[19px] h-[19px]',
  lg: 'w-5 h-5',
};

interface SingleTickProps {
  size?: VerificationTickSize;
  className?: string;
}

/**
 * Automatic Green Tick — granted automatically when a user completes account/email verification.
 */
export const GreenTickIcon: React.FC<SingleTickProps> = ({ size = 'sm', className = '' }) => {
  const gradId = `amGreenTick_${useId().replace(/:/g, '')}`;
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={`${SIZE_CLASSES[size]} shrink-0 drop-shadow-[0_0_6px_rgba(16,185,129,0.55)] ${className}`}
    >
      <defs>
        <linearGradient id={gradId} x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#34D399" />
          <stop offset="55%" stopColor="#10B981" />
          <stop offset="100%" stopColor="#059669" />
        </linearGradient>
      </defs>
      <path
        d="M12 2L14.55 3.62L17.55 3.45L18.92 6.14L21.55 7.64L21.17 10.63L22.6 13.28L20.52 15.46L20.1 18.44L17.16 19.26L15.16 21.52L12.25 20.55L9.34 21.52L7.34 19.26L4.4 18.44L3.98 15.46L1.9 13.28L3.33 10.63L2.95 7.64L5.58 6.14L6.95 3.45L9.95 3.62L12 2Z"
        fill={`url(#${gradId})`}
        stroke="#A7F3D0"
        strokeWidth="0.9"
      />
      <path
        d="M8.3 12.25L10.85 14.8L16.1 9.45"
        stroke="#FFFFFF"
        strokeWidth="2.35"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

/**
 * Official Blue Tick — Admin-granted Respect Badge exclusively for Hosts & Gifters.
 */
export const BlueTickIcon: React.FC<SingleTickProps> = ({ size = 'sm', className = '' }) => {
  const gradId = `amBlueTick_${useId().replace(/:/g, '')}`;
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={`${SIZE_CLASSES[size]} shrink-0 drop-shadow-[0_0_7px_rgba(56,189,248,0.65)] ${className}`}
    >
      <defs>
        <linearGradient id={gradId} x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#38BDF8" />
          <stop offset="50%" stopColor="#0EA5E9" />
          <stop offset="100%" stopColor="#2563EB" />
        </linearGradient>
      </defs>
      <path
        d="M12 2L14.55 3.62L17.55 3.45L18.92 6.14L21.55 7.64L21.17 10.63L22.6 13.28L20.52 15.46L20.1 18.44L17.16 19.26L15.16 21.52L12.25 20.55L9.34 21.52L7.34 19.26L4.4 18.44L3.98 15.46L1.9 13.28L3.33 10.63L2.95 7.64L5.58 6.14L6.95 3.45L9.95 3.62L12 2Z"
        fill={`url(#${gradId})`}
        stroke="#BAE6FD"
        strokeWidth="0.9"
      />
      <path
        d="M8.3 12.25L10.85 14.8L16.1 9.45"
        stroke="#FFFFFF"
        strokeWidth="2.35"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

export interface VerificationTicksProps {
  /** Automatic Green Tick (account / email verified) */
  isAccountVerified?: boolean;
  /** Admin-granted Blue Tick (Respect Badge for Hosts & Gifters) */
  isBlueTickVerified?: boolean;
  size?: VerificationTickSize;
  onClick?: (tick: 'green' | 'blue') => void;
  className?: string;
}

/**
 * Dual-tick verification indicator:
 * - Green Tick: Automatic account verification badge
 * - Blue Tick: Official Admin-granted Respect Badge for Hosts & Gifters
 */
export const VerificationTicks: React.FC<VerificationTicksProps> = ({
  isAccountVerified = false,
  isBlueTickVerified = false,
  size = 'sm',
  onClick,
  className = '',
}) => {
  if (!isAccountVerified && !isBlueTickVerified) return null;

  const renderTick = (
    type: 'green' | 'blue',
    title: string,
    ariaLabel: string,
    icon: React.ReactNode
  ) => {
    if (onClick) {
      return (
        <button
          key={type}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClick(type);
          }}
          title={title}
          aria-label={ariaLabel}
          className="inline-flex items-center justify-center rounded-full hover:scale-110 active:scale-95 transition-transform cursor-pointer focus:outline-none focus:ring-2 focus:ring-white/30"
        >
          {icon}
        </button>
      );
    }

    return (
      <span
        key={type}
        title={title}
        aria-label={ariaLabel}
        className="inline-flex items-center justify-center"
      >
        {icon}
      </span>
    );
  };

  return (
    <span className={`inline-flex items-center gap-1 shrink-0 ${className}`}>
      {isAccountVerified &&
        renderTick(
          'green',
          'Green Tick — Verified Account (Automatic)',
          'Verified Account Green Tick',
          <GreenTickIcon size={size} />
        )}
      {isBlueTickVerified &&
        renderTick(
          'blue',
          'Blue Tick — Official Respect Badge (Admin Granted for Hosts & Gifters)',
          'Official Blue Tick Respect Badge',
          <BlueTickIcon size={size} />
        )}
    </span>
  );
};

interface VerificationTicksInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  displayName: string;
  isAccountVerified: boolean;
  isBlueTickVerified: boolean;
  isOwnProfile?: boolean;
}

export const VerificationTicksInfoModal: React.FC<VerificationTicksInfoModalProps> = ({
  isOpen,
  onClose,
  displayName,
  isAccountVerified,
  isBlueTickVerified,
  isOwnProfile = false,
}) => {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Profile Verification Badges"
      className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-t-3xl sm:rounded-3xl bg-[#120A24] border border-[#A855F7]/35 shadow-2xl overflow-hidden text-white"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-white/10 bg-gradient-to-r from-[#1D1039] via-[#261248] to-[#170C2E] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-sky-300" />
            </div>
            <div>
              <h3 className="text-sm font-black text-white tracking-tight">
                Profile Verification Ticks
              </h3>
              <p className="text-[11px] text-zinc-400 truncate max-w-[230px]">
                {displayName}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/15 border border-white/10 flex items-center justify-center text-zinc-300 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tick Cards */}
        <div className="p-5 space-y-3.5">
          {/* 1. Green Tick Card */}
          <div
            className={`p-4 rounded-2xl border transition-colors ${
              isAccountVerified
                ? 'bg-emerald-500/10 border-emerald-400/35'
                : 'bg-white/[0.03] border-white/10'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-400/30 flex items-center justify-center shrink-0">
                <GreenTickIcon size="lg" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-xs font-black text-emerald-300">
                    Green Tick • Verified Account
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[9.5px] font-black uppercase tracking-wider ${
                      isAccountVerified
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40'
                        : 'bg-zinc-800 text-zinc-400 border border-white/10'
                    }`}
                  >
                    {isAccountVerified ? 'Active' : 'Not Verified'}
                  </span>
                </div>
                <p className="text-[11.5px] text-zinc-300 mt-1.5 leading-relaxed">
                  Automatically awarded when a member completes official Alpha Mate account verification.
                </p>
                <div className="flex items-center gap-1.5 mt-2 text-[10px] font-semibold text-emerald-300/90">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    {isAccountVerified
                      ? isOwnProfile
                        ? 'Your account is verified — Green Tick is automatically active.'
                        : 'This account has completed automatic verification.'
                      : 'Complete email or Google account verification to receive automatically.'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 2. Blue Tick Card */}
          <div
            className={`p-4 rounded-2xl border transition-colors ${
              isBlueTickVerified
                ? 'bg-sky-500/12 border-sky-400/40'
                : 'bg-white/[0.03] border-white/10'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-sky-500/15 border border-sky-400/30 flex items-center justify-center shrink-0">
                <BlueTickIcon size="lg" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-xs font-black text-sky-300">
                    Blue Tick • Official Respect Badge
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[9.5px] font-black uppercase tracking-wider ${
                      isBlueTickVerified
                        ? 'bg-sky-500/20 text-sky-300 border border-sky-400/40'
                        : 'bg-zinc-800 text-zinc-400 border border-white/10'
                    }`}
                  >
                    {isBlueTickVerified ? 'Active • Admin' : 'Admin Only'}
                  </span>
                </div>
                <p className="text-[11.5px] text-zinc-300 mt-1.5 leading-relaxed">
                  Exclusive respect honor awarded by Alpha Mate Admin to distinguished Hosts and top Gifters.
                </p>
                <div className="flex items-center gap-1.5 mt-2 text-[10px] font-semibold text-sky-300/90">
                  {isBlueTickVerified ? (
                    <Crown className="w-3.5 h-3.5 shrink-0 text-sky-300" />
                  ) : (
                    <ShieldCheck className="w-3.5 h-3.5 shrink-0 text-sky-400/80" />
                  )}
                  <span>
                    {isBlueTickVerified
                      ? 'Granted by Alpha Mate Admin as an official Host / Gifter respect honor.'
                      : 'Cannot be self-enabled — granted exclusively by Alpha Mate Admin.'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-full h-11 rounded-2xl bg-gradient-to-r from-[#7928CA] to-[#EC4899] text-white text-xs font-black shadow-lg shadow-[#7928CA]/25 hover:brightness-110 active:scale-[0.99] transition-all cursor-pointer"
          >
            Got It
          </button>
        </div>
      </div>
    </div>
  );
};
