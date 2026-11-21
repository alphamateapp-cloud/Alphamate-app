import React from 'react';
import {
  GreenTickIcon,
  BlueTickIcon,
  VerificationTickSize,
} from './VerificationTicks';

export type VerificationBadgePosition =
  | 'bottom-center'
  | 'bottom-right'
  | 'right-adjacent'
  | 'inline';

export interface VerificationBadgeProps {
  /** Green Tick — automatic account verification status */
  isVerified?: boolean;
  /** Blue Tick — official Admin-granted respect badge for Hosts & Gifters */
  isRespected?: boolean;
  /** Size of the tick icons inside the badge */
  size?: VerificationTickSize;
  /**
   * Absolute positioning preset relative to a `relative` profile picture container,
   * or `'inline'` for standard inline flow. Defaults to `'bottom-center'`.
   */
  position?: VerificationBadgePosition;
  /** Optional click handler (receives which badge was tapped) */
  onClick?: (badge: 'verified' | 'respected') => void;
  /** Optional extra classes on the badge container */
  className?: string;
}

const POSITION_CLASSES: Record<VerificationBadgePosition, string> = {
  'bottom-center': 'absolute -bottom-2.5 left-1/2 -translate-x-1/2 z-30',
  'bottom-right': 'absolute -bottom-1 -right-1 z-30',
  'right-adjacent': 'absolute top-1/2 -translate-y-1/2 left-full ml-1.5 z-30',
  inline: 'relative inline-flex',
};

/**
 * Reusable `VerificationBadge` overlay designed to attach directly to a profile picture container.
 * Uses absolute positioning by default so the Green (verified) and Blue (respected) ticks follow
 * the profile image's layout structure without disturbing surrounding header elements.
 */
export const VerificationBadge: React.FC<VerificationBadgeProps> = ({
  isVerified = false,
  isRespected = false,
  size = 'md',
  position = 'bottom-center',
  onClick,
  className = '',
}) => {
  if (!isVerified && !isRespected) return null;

  const renderBadgeButton = (
    kind: 'verified' | 'respected',
    title: string,
    ariaLabel: string,
    icon: React.ReactNode
  ) => {
    if (onClick) {
      return (
        <button
          key={kind}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClick(kind);
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
        key={kind}
        title={title}
        aria-label={ariaLabel}
        className="inline-flex items-center justify-center"
      >
        {icon}
      </span>
    );
  };

  return (
    <div
      className={`${POSITION_CLASSES[position]} inline-flex items-center justify-center gap-1 px-1.5 py-0.5 rounded-full bg-[#120B22]/95 backdrop-blur-md border border-white/15 shadow-lg shadow-black/60 whitespace-nowrap ${className}`}
    >
      {isVerified &&
        renderBadgeButton(
          'verified',
          'Green Tick — Verified Account (Automatic)',
          'Verified Account Green Tick',
          <GreenTickIcon size={size} />
        )}
      {isRespected &&
        renderBadgeButton(
          'respected',
          'Blue Tick — Official Respect Badge (Admin Granted for Hosts & Gifters)',
          'Official Blue Tick Respect Badge',
          <BlueTickIcon size={size} />
        )}
    </div>
  );
};
