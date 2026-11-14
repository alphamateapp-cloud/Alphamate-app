import React from 'react';
import { UserBadgeId, UserBadgeTier } from '../../types';
import { BADGE_BY_ID } from '../../services/badgeService';

interface UserBadgeIconProps {
  badgeId: UserBadgeId;
  tier?: UserBadgeTier | null;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  locked?: boolean;
  title?: string;
}

const SIZE_MAP = {
  xs: 'w-5 h-5',
  sm: 'w-7 h-7',
  md: 'w-11 h-11',
  lg: 'w-14 h-14',
};

const TIER_RING: Record<UserBadgeTier, string> = {
  bronze: '#D97706',
  silver: '#CBD5E1',
  gold: '#FACC15',
  mythic: '#EC4899',
};

export const UserBadgeIcon: React.FC<UserBadgeIconProps> = ({
  badgeId,
  tier = 'bronze',
  size = 'md',
  locked = false,
  title,
}) => {
  const def = BADGE_BY_ID[badgeId];
  const label = title || (def ? `${def.name}${tier ? ` (${tier})` : ''}` : badgeId);
  const ringColor = locked ? '#3F3F46' : TIER_RING[tier || 'bronze'];
  const uid = `${badgeId}_${size}_${tier || 'base'}`;

  return (
    <span
      title={label}
      aria-label={label}
      className={`inline-flex items-center justify-center shrink-0 select-none ${SIZE_MAP[size]} ${
        locked ? 'opacity-45 grayscale' : ''
      }`}
    >
      <svg
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full drop-shadow-sm"
      >
        <defs>
          <linearGradient id={`bg_${uid}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor={def?.accentFrom || '#7928CA'} />
            <stop offset="100%" stopColor={def?.accentTo || '#EC4899'} />
          </linearGradient>
        </defs>

        {/* Outer Crest Frame */}
        <path
          d="M32 4L54 14.5V33C54 46.2 44.6 56.2 32 60C19.4 56.2 10 46.2 10 33V14.5L32 4Z"
          fill="#120A24"
          stroke={ringColor}
          strokeWidth="3.2"
          strokeLinejoin="round"
        />

        {/* Inner Gradient Medallion */}
        <path
          d="M32 9.5L49 17.6V32.5C49 43 41.6 51.2 32 54.4C22.4 51.2 15 43 15 32.5V17.6L32 9.5Z"
          fill={`url(#bg_${uid})`}
          fillOpacity="0.92"
        />

        {/* Unique Per-Achievement Vector Artwork */}
        {badgeId === 'top_contributor' && (
          <g>
            {/* Radiant 4-point Sovereign Star + Laurels */}
            <path
              d="M32 16L36.2 26.8L47 31L36.2 35.2L32 46L27.8 35.2L17 31L27.8 26.8L32 16Z"
              fill="#FFFFFF"
            />
            <circle cx="32" cy="31" r="3.4" fill="#120A24" />
            <path d="M19 42C22.5 46 27 48.2 32 48.8C37 48.2 41.5 46 45 42" stroke="#FDE68A" strokeWidth="2.4" strokeLinecap="round" />
          </g>
        )}

        {badgeId === 'gift_king' && (
          <g>
            {/* Sovereign Gift Crown */}
            <path
              d="M19 34L22 21L32 28L42 21L45 34H19Z"
              fill="#FEF08A"
              stroke="#FFFFFF"
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
            <rect x="20" y="36" width="24" height="10" rx="2.5" fill="#FFFFFF" />
            <rect x="30" y="36" width="4" height="10" fill="#B45309" />
            <circle cx="22" cy="19.5" r="2.2" fill="#FFFFFF" />
            <circle cx="32" cy="24" r="2.4" fill="#FFFFFF" />
            <circle cx="42" cy="19.5" r="2.2" fill="#FFFFFF" />
          </g>
        )}

        {badgeId === 'longest_party_attendee' && (
          <g>
            {/* Acoustic Party Headphones + Time Soundwaves */}
            <path
              d="M19 35V30C19 22.8 24.8 17 32 17C39.2 17 45 22.8 45 30V35"
              stroke="#FFFFFF"
              strokeWidth="3.4"
              strokeLinecap="round"
            />
            <rect x="16.5" y="31" width="5.5" height="11" rx="2.75" fill="#FFFFFF" />
            <rect x="42" y="31" width="5.5" height="11" rx="2.75" fill="#FFFFFF" />
            <path d="M27 31V39M32 26V42M37 30V40" stroke="#FDE68A" strokeWidth="2.8" strokeLinecap="round" />
          </g>
        )}

        {badgeId === 'diamond_patron' && (
          <g>
            {/* Faceted Imperial Diamond */}
            <path
              d="M23 20H41L48 29L32 47L16 29L23 20Z"
              fill="#E0F2FE"
              stroke="#FFFFFF"
              strokeWidth="1.8"
              strokeLinejoin="round"
            />
            <path d="M16 29H48M23 20L27 29L32 47L37 29L41 20" stroke="#0284C7" strokeWidth="1.8" strokeLinejoin="round" />
          </g>
        )}

        {badgeId === 'live_marathoner' && (
          <g>
            {/* Broadcast Lens & Orbital Ring */}
            <ellipse cx="32" cy="32" rx="14" ry="7" transform="rotate(-24 32 32)" stroke="#A7F3D0" strokeWidth="2.2" />
            <circle cx="32" cy="32" r="7.5" fill="#FFFFFF" />
            <path d="M30 28.5L36.5 32L30 35.5V28.5Z" fill="#0F172A" />
          </g>
        )}

        {badgeId === 'streak_champion' && (
          <g>
            {/* Ignited Twin-Flame Streak Torch */}
            <path
              d="M33 16C33 16 42 23.5 42 32.5C42 39 37.5 44 32 44C26.5 44 22 39 22 32.5C22 27.5 25 23.5 27.5 21.5C27.5 25.5 29.8 27 31 27C30 22.5 33 16 33 16Z"
              fill="#FFFFFF"
            />
            <path
              d="M32 29.5C35 32 36.5 34.5 36.5 37.5C36.5 40.5 34.5 42.5 32 42.5C29.5 42.5 27.5 40.5 27.5 37.5C27.5 34.8 29.3 32.4 32 29.5Z"
              fill="#F59E0B"
            />
          </g>
        )}

        {badgeId === 'social_creator' && (
          <g>
            {/* Radiant Prism Play Spark */}
            <rect x="20" y="21" width="24" height="20" rx="5" fill="#FFFFFF" />
            <path d="M29 26.5L37.5 31L29 35.5V26.5Z" fill="#7928CA" />
            <circle cx="43" cy="20" r="3" fill="#FDE047" />
          </g>
        )}

        {badgeId === 'royal_vip' && (
          <g>
            {/* Winged Imperial V-Shield */}
            <path d="M22 21L32 44L42 21H36.8L32 33.5L27.2 21H22Z" fill="#FFFFFF" />
            <path d="M18 26H22.5M41.5 26H46M19 32H24M40 32H45" stroke="#FEF08A" strokeWidth="2.2" strokeLinecap="round" />
          </g>
        )}
      </svg>
    </span>
  );
};

export const UserBadgeStrip: React.FC<{
  badgeIds?: UserBadgeId[];
  earnedBadges?: Record<string, { tier?: UserBadgeTier }>;
  size?: 'xs' | 'sm';
  onClick?: () => void;
}> = ({ badgeIds, earnedBadges, size = 'xs', onClick }) => {
  const list = Array.isArray(badgeIds) ? badgeIds.slice(0, 3) : [];
  if (list.length === 0) return null;

  const content = (
    <span className="inline-flex items-center gap-1 shrink-0">
      {list.map((id) => (
        <UserBadgeIcon
          key={id}
          badgeId={id}
          tier={earnedBadges?.[id]?.tier || 'bronze'}
          size={size}
        />
      ))}
    </span>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        title="View earned profile badges"
        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition-colors cursor-pointer shrink-0"
      >
        {content}
      </button>
    );
  }

  return content;
};
