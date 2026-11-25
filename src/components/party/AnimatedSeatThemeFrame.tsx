import React, { useId } from 'react';

export type PartySeatThemeId = 'royal_gold_diya' | 'royal_purple_lotus' | 'diamond_ice_blue';

export interface PartySeatThemeMeta {
  id: PartySeatThemeId;
  name: string;
  shortLabel: string;
  starFillFrom: string;
  starFillTo: string;
  starStroke: string;
  activeGlow: string;
  activeBorder: string;
}

export const PARTY_SEAT_THEMES: PartySeatThemeMeta[] = [
  {
    id: 'royal_gold_diya',
    name: 'Royal Gold Diya',
    shortLabel: 'Gold Diya',
    starFillFrom: '#FEF08A',
    starFillTo: '#D97706',
    starStroke: '#FDE68A',
    activeGlow: '0 0 14px rgba(251,191,36,0.85)',
    activeBorder: 'border-amber-300/90 bg-amber-500/25',
  },
  {
    id: 'royal_purple_lotus',
    name: 'Royal Purple Lotus',
    shortLabel: 'Purple Lotus',
    starFillFrom: '#F5D0FE',
    starFillTo: '#9333EA',
    starStroke: '#F0ABFC',
    activeGlow: '0 0 14px rgba(217,70,239,0.85)',
    activeBorder: 'border-fuchsia-300/90 bg-fuchsia-500/25',
  },
  {
    id: 'diamond_ice_blue',
    name: 'Diamond Ice Blue',
    shortLabel: 'Diamond Blue',
    starFillFrom: '#E0F2FE',
    starFillTo: '#0284C7',
    starStroke: '#7DD3FC',
    activeGlow: '0 0 14px rgba(56,189,248,0.88)',
    activeBorder: 'border-sky-300/90 bg-sky-500/25',
  },
];

export const isValidPartySeatTheme = (val: unknown): val is PartySeatThemeId =>
  val === 'royal_gold_diya' || val === 'royal_purple_lotus' || val === 'diamond_ice_blue';

interface AnimatedSeatThemeFrameProps {
  theme: PartySeatThemeId;
  sizeClass: string;
  role?: 'host' | 'vip' | 'guest';
  compact?: boolean;
  children: React.ReactNode;
}

/**
 * Reusable, lightweight SVG + GPU-composited animated seat frame skin.
 * Geometry: overlay sits at -inset-[25%] (150% of inner circle diameter), so inside
 * viewBox="0 0 160 160", the user's circular avatar occupies exact center (80, 80)
 * with radius 53.33. Every theme hugs r=54.5 around the outside — keeping 100% of
 * the user's profile picture face completely unobstructed.
 */
export const AnimatedSeatThemeFrame: React.FC<AnimatedSeatThemeFrameProps> = ({
  theme,
  sizeClass,
  role = 'guest',
  compact = false,
  children,
}) => {
  const rawId = useId();
  const uid = rawId.replace(/[^a-zA-Z0-9_-]/g, '');

  const ringGlowShadow =
    theme === 'royal_gold_diya'
      ? 'shadow-[0_0_16px_rgba(251,191,36,0.44)]'
      : theme === 'royal_purple_lotus'
      ? 'shadow-[0_0_16px_rgba(217,70,239,0.44)]'
      : 'shadow-[0_0_16px_rgba(56,189,248,0.48)]';

  const reactiveAuraColor =
    theme === 'royal_gold_diya'
      ? 'rgba(251, 191, 36, 0.55)'
      : theme === 'royal_purple_lotus'
      ? 'rgba(217, 70, 239, 0.55)'
      : 'rgba(56, 189, 248, 0.58)';

  return (
    <div className={`relative ${sizeClass} rounded-full flex items-center justify-center shrink-0`}>
      {/* Synchronized Audio-Reactive Seat Theme Aura (driven by Web Audio AnalyserNode --party-audio-energy) */}
      <div
        aria-hidden="true"
        className="pointer-events-none select-none absolute -inset-[12%] rounded-full z-[4]"
        style={{
          background: `radial-gradient(circle, ${reactiveAuraColor} 0%, transparent 70%)`,
          opacity: 'calc(var(--party-audio-energy, 0) * 0.72)',
          transform: 'scale(calc(0.96 + var(--party-audio-energy, 0) * 0.24)) translateZ(0)',
          willChange: 'transform, opacity',
        }}
      />

      {/* Inner Circular Aperture — 100% unobstructed user DP / empty seat placeholder */}
      <div
        className={`relative z-10 w-full h-full rounded-full overflow-hidden ${ringGlowShadow}`}
      >
        {children}
      </div>

      {/* Animated Outer Frame Overlay (strictly pointer-events-none so seat & mic taps pass through) */}
      <div
        aria-hidden="true"
        className="pointer-events-none select-none absolute -inset-[25%] z-[15]"
        style={{
          transform: 'scale(calc(1 + var(--party-audio-bass, 0) * 0.035)) translateZ(0)',
          willChange: 'transform',
        }}
      >
        {theme === 'royal_gold_diya' && (
          <RoyalGoldDiyaSvg uid={uid} isHero={role !== 'guest'} compact={compact} />
        )}
        {theme === 'royal_purple_lotus' && (
          <RoyalPurpleLotusSvg uid={uid} isHero={role !== 'guest'} compact={compact} />
        )}
        {theme === 'diamond_ice_blue' && (
          <DiamondIceBlueSvg uid={uid} isHero={role !== 'guest'} compact={compact} />
        )}
      </div>
    </div>
  );
};

/* =========================================================================
   THEME 1 — ROYAL GOLD / DIYA SEAT
   Inspired by royal gold filigree arch, glowing marquee beads, golden thali
   pedestal, mini marigold blossoms, and a continuously flickering diya flame.
   ========================================================================= */
const RoyalGoldDiyaSvg: React.FC<{ uid: string; isHero: boolean; compact: boolean }> = ({
  uid,
  isHero,
  compact,
}) => {
  const cx = 80;
  const cy = 80;
  const ringR = 54.5;

  // 12 golden marquee beads evenly placed along the circular rim
  const beads = Array.from({ length: 12 }, (_, idx) => {
    const angle = ((idx * 30 - 90) * Math.PI) / 180;
    return {
      cx: cx + Math.cos(angle) * (ringR + 2.8),
      cy: cy + Math.sin(angle) * (ringR + 2.8),
      delay: `${(idx % 4) * 0.35}s`,
    };
  });

  return (
    <svg
      viewBox="0 0 160 160"
      className="w-full h-full overflow-visible"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id={`gd-gold-${uid}`} x1="16" y1="12" x2="144" y2="148" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFF7C2" />
          <stop offset="28%" stopColor="#FBBF24" />
          <stop offset="56%" stopColor="#B45309" />
          <stop offset="80%" stopColor="#FDE047" />
          <stop offset="100%" stopColor="#D97706" />
        </linearGradient>
        <linearGradient id={`gd-rim-${uid}`} x1="80" y1="18" x2="80" y2="142" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FEF08A" />
          <stop offset="50%" stopColor="#F59E0B" />
          <stop offset="100%" stopColor="#92400E" />
        </linearGradient>
        <linearGradient id={`gd-ruby-${uid}`} x1="80" y1="6" x2="80" y2="26" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FDA4AF" />
          <stop offset="45%" stopColor="#E11D48" />
          <stop offset="100%" stopColor="#881337" />
        </linearGradient>
        <linearGradient id={`gd-diya-${uid}`} x1="62" y1="130" x2="98" y2="148" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#F43F5E" />
          <stop offset="50%" stopColor="#B91C1C" />
          <stop offset="100%" stopColor="#7F1D1D" />
        </linearGradient>
        <radialGradient id={`gd-flame-halo-${uid}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FEF08A" stopOpacity="0.95" />
          <stop offset="48%" stopColor="#F59E0B" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#EA580C" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`gd-flame-${uid}`} x1="80" y1="112" x2="80" y2="136" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFFBEB" />
          <stop offset="42%" stopColor="#FDE047" />
          <stop offset="80%" stopColor="#F97316" />
          <stop offset="100%" stopColor="#DC2626" />
        </linearGradient>
        <linearGradient id={`gd-arc-${uid}`} x1="20" y1="20" x2="140" y2="80" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFFBEB" stopOpacity="0" />
          <stop offset="45%" stopColor="#FEF08A" stopOpacity="0.95" />
          <stop offset="65%" stopColor="#FFFFFF" stopOpacity="1" />
          <stop offset="100%" stopColor="#F59E0B" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Soft ambient outer gold halo */}
      <circle cx={cx} cy={cy} r={ringR + 7.2} stroke="#F59E0B" strokeOpacity="0.24" strokeWidth="4.8" />

      {/* Sculpted royal gold outer circular channel */}
      <circle cx={cx} cy={cy} r={ringR + 2.8} stroke={`url(#gd-gold-${uid})`} strokeWidth="6" />
      <circle cx={cx} cy={cy} r={ringR + 2.8} stroke="#581C3E" strokeOpacity="0.58" strokeWidth="2.8" />
      <circle cx={cx} cy={cy} r={ringR - 0.5} stroke={`url(#gd-rim-${uid})`} strokeWidth="1.9" />

      {/* Traveling golden light sweep orbiting around exact circle center */}
      <g className="animate-seat-orbit">
        <circle
          cx={cx}
          cy={cy}
          r={ringR + 2.8}
          stroke={`url(#gd-arc-${uid})`}
          strokeWidth="3.2"
          strokeLinecap="round"
          strokeDasharray="64 295"
        />
        <circle cx={cx} cy={cy - (ringR + 2.8)} r="2.7" fill="#FFFBEB" />
      </g>

      {/* Ornamental glowing marquee gold light beads */}
      {beads.map((b, i) => (
        <circle
          key={i}
          cx={b.cx}
          cy={b.cy}
          r={i % 2 === 0 ? 1.8 : 1.2}
          fill={i % 2 === 0 ? '#FEF08A' : '#FBBF24'}
          className="animate-seat-sparkle"
          style={{ animationDelay: b.delay }}
        />
      ))}

      {/* Sweeping golden acanthus side flourishes */}
      <path
        d="M25 103 C14 99 12 87 20 81 C17 90 21 95 28 97 Z"
        fill={`url(#gd-gold-${uid})`}
        stroke="#92400E"
        strokeWidth="0.6"
      />
      <path
        d="M135 103 C146 99 148 87 140 81 C143 90 139 95 132 97 Z"
        fill={`url(#gd-gold-${uid})`}
        stroke="#92400E"
        strokeWidth="0.6"
      />

      {/* Top Royal Lotus-Ruby Finial Crest */}
      <g>
        <path
          d="M62 24 C65 15 72 12 80 5 C88 12 95 15 98 24 C91 21 86 23 80 26 C74 23 69 21 62 24 Z"
          fill={`url(#gd-gold-${uid})`}
          stroke="#92400E"
          strokeWidth="0.9"
        />
        <path
          d="M80 10 L85 17 L80 23.5 L75 17 Z"
          fill={`url(#gd-ruby-${uid})`}
          stroke="#FEF08A"
          strokeWidth="0.8"
        />
        <circle cx="79" cy="14.5" r="1.1" fill="#FFF1F2" opacity="0.9" />
      </g>

      {/* Bottom Golden Thali Pedestal Saucer */}
      <g>
        <path
          d="M36 131 C46 144 62 150 80 150 C98 150 114 144 124 131 C113 137 97 140 80 140 C63 140 47 137 36 131 Z"
          fill={`url(#gd-gold-${uid})`}
          stroke="#92400E"
          strokeWidth="0.9"
        />
        <ellipse
          cx="80"
          cy="135.5"
          rx="34"
          ry="3.8"
          fill="#FEF08A"
          fillOpacity="0.28"
          stroke={`url(#gd-rim-${uid})`}
          strokeWidth="1.1"
        />
        <path
          d="M70 146 L80 155 L90 146 L80 142 Z"
          fill={`url(#gd-gold-${uid})`}
          stroke="#92400E"
          strokeWidth="0.7"
        />
        <circle cx="80" cy="147.5" r="2.1" fill={`url(#gd-ruby-${uid})`} stroke="#FEF08A" strokeWidth="0.6" />
      </g>

      {/* Mini Festive Marigold Blossoms flanking the Diya */}
      {!compact && (
        <g>
          <circle cx="50" cy="134" r="4.8" fill="#F97316" stroke="#FDE047" strokeWidth="0.9" />
          <circle cx="50" cy="134" r="2.4" fill="#FBBF24" />
          <circle cx="56.5" cy="137" r="2.6" fill="#E11D48" stroke="#FDA4AF" strokeWidth="0.5" />

          <circle cx="110" cy="134" r="4.8" fill="#F97316" stroke="#FDE047" strokeWidth="0.9" />
          <circle cx="110" cy="134" r="2.4" fill="#FBBF24" />
          <circle cx="103.5" cy="137" r="2.6" fill="#E11D48" stroke="#FDA4AF" strokeWidth="0.5" />
        </g>
      )}

      {/* Decorative Crimson & Gold DIYA Lamp + Flickering Animated Flame (outside bottom rim) */}
      <g>
        <circle
          cx="80"
          cy="126"
          r={isHero ? 14 : 11.5}
          fill={`url(#gd-flame-halo-${uid})`}
          className="animate-diya-halo"
        />
        <g className="animate-diya-flame">
          <path
            d="M80 115.5 C84 121.5 85.1 127 83 130.8 C82.1 132.5 80.9 133.1 80 133.1 C79.1 133.1 77.9 132.5 77 130.8 C74.9 127 76 121.5 80 115.5 Z"
            fill={`url(#gd-flame-${uid})`}
          />
          <path
            d="M80 121.2 C82 125 82.2 128.6 81.1 130.7 C80.6 131.5 80.3 131.8 80 131.8 C79.7 131.8 79.4 131.5 78.9 130.7 C77.8 128.6 78 125 80 121.2 Z"
            fill="#FFFBEB"
          />
        </g>
        <path
          d="M66 133.5 C68 140.5 73.2 143.8 80 143.8 C86.8 143.8 92 140.5 94 133.5 C89.5 135.5 84.8 136.3 80 136.3 C75.2 136.3 70.5 135.5 66 133.5 Z"
          fill={`url(#gd-diya-${uid})`}
          stroke="#FDE047"
          strokeWidth="1.2"
        />
        <ellipse cx="80" cy="133.8" rx="14" ry="2.4" fill="#991B1B" stroke="#FBBF24" strokeWidth="1" />
        <path d="M76.5 139.8 L80 137.2 L83.5 139.8 L80 142 Z" fill="#FDE047" />
      </g>

      {/* Golden 4-Point Sparkling Light Particles */}
      <g className="animate-seat-sparkle" style={{ animationDelay: '0s' }}>
        <path d="M21 35 L22.5 39 L26.5 40.5 L22.5 42 L21 46 L19.5 42 L15.5 40.5 L19.5 39 Z" fill="#FEF08A" />
      </g>
      <g className="animate-seat-sparkle" style={{ animationDelay: '0.8s' }}>
        <path d="M139 36 L140.4 39.5 L144 41 L140.4 42.4 L139 46 L137.6 42.4 L134 41 L137.6 39.5 Z" fill="#FDE047" />
      </g>
      <g className="animate-seat-sparkle" style={{ animationDelay: '1.3s' }}>
        <circle cx="145" cy="72" r="1.8" fill="#FEF08A" />
        <circle cx="15" cy="70" r="1.6" fill="#FBBF24" />
      </g>
    </svg>
  );
};

/* =========================================================================
   THEME 2 — ROYAL PINK / PURPLE LOTUS SEAT
   Inspired by blooming pink/purple lotus petals with golden borders, glowing
   amethyst/magenta light rings, faceted lotus gemstones & floating sparkles.
   ========================================================================= */
const RoyalPurpleLotusSvg: React.FC<{ uid: string; isHero: boolean; compact: boolean }> = ({
  uid,
  compact,
}) => {
  const cx = 80;
  const cy = 80;
  const ringR = 54.5;

  return (
    <svg
      viewBox="0 0 160 160"
      className="w-full h-full overflow-visible"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id={`lp-gold-${uid}`} x1="16" y1="14" x2="144" y2="146" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FEF08A" />
          <stop offset="35%" stopColor="#F59E0B" />
          <stop offset="70%" stopColor="#FDE68A" />
          <stop offset="100%" stopColor="#B45309" />
        </linearGradient>
        <linearGradient id={`lp-neon-${uid}`} x1="26" y1="24" x2="134" y2="136" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#F0ABFC" />
          <stop offset="50%" stopColor="#EC4899" />
          <stop offset="100%" stopColor="#9333EA" />
        </linearGradient>
        <linearGradient id={`lp-petal-pink-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#F9A8D4" />
          <stop offset="52%" stopColor="#EC4899" />
          <stop offset="100%" stopColor="#7E22CE" />
        </linearGradient>
        <linearGradient id={`lp-petal-purple-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#E9D5FF" />
          <stop offset="48%" stopColor="#A855F7" />
          <stop offset="100%" stopColor="#581C87" />
        </linearGradient>
        <linearGradient id={`lp-gem-${uid}`} x1="80" y1="4" x2="80" y2="26" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FAE8FF" />
          <stop offset="42%" stopColor="#D946EF" />
          <stop offset="100%" stopColor="#6B21A8" />
        </linearGradient>
        <linearGradient id={`lp-arc-${uid}`} x1="20" y1="20" x2="140" y2="120" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#F5D0FE" stopOpacity="0" />
          <stop offset="50%" stopColor="#F472B6" stopOpacity="0.95" />
          <stop offset="75%" stopColor="#FFFFFF" stopOpacity="1" />
          <stop offset="100%" stopColor="#A855F7" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Soft pulsing purple-pink outer halo ring */}
      <g className="animate-lotus-pulse">
        <circle cx={cx} cy={cy} r={ringR + 7.2} stroke={`url(#lp-neon-${uid})`} strokeOpacity="0.34" strokeWidth="5.6" />
        <ellipse
          cx={cx}
          cy={cy}
          rx="67"
          ry="45"
          stroke="#FDE68A"
          strokeOpacity="0.28"
          strokeWidth="1"
          transform="rotate(-14 80 80)"
        />
      </g>

      {/* Outer Golden Ornamental Ring + Glowing Inner Pink-Purple Light Ring */}
      <circle cx={cx} cy={cy} r={ringR + 3.2} stroke={`url(#lp-gold-${uid})`} strokeWidth="4.2" />
      <circle cx={cx} cy={cy} r={ringR - 0.2} stroke={`url(#lp-neon-${uid})`} strokeWidth="2.6" />

      {/* Traveling magenta-gold light pulse orbiting exact circle center */}
      <g className="animate-seat-orbit">
        <circle
          cx={cx}
          cy={cy}
          r={ringR + 1.2}
          stroke={`url(#lp-arc-${uid})`}
          strokeWidth="3.1"
          strokeLinecap="round"
          strokeDasharray="60 300"
        />
        <circle cx={cx} cy={cy - (ringR + 1.2)} r="2.6" fill="#FAE8FF" />
      </g>

      {/* Top Golden Lotus Crest with Faceted Amethyst Gemstone */}
      <g>
        <path
          d="M78 21 C71 13 64 11 58 14 C62 21 68 24 76 24 Z"
          fill={`url(#lp-petal-pink-${uid})`}
          stroke={`url(#lp-gold-${uid})`}
          strokeWidth="1.2"
        />
        <path
          d="M82 21 C89 13 96 11 102 14 C98 21 92 24 84 24 Z"
          fill={`url(#lp-petal-pink-${uid})`}
          stroke={`url(#lp-gold-${uid})`}
          strokeWidth="1.2"
        />
        <path
          d="M80 4 L88 15 L80 25 L72 15 Z"
          fill={`url(#lp-gem-${uid})`}
          stroke={`url(#lp-gold-${uid})`}
          strokeWidth="1.5"
        />
        <path d="M80 7 L84.5 15 L80 22 L75.5 15 Z" fill="#FAE8FF" opacity="0.35" />
      </g>

      {/* Blooming Pink & Purple Lotus Petals Fanning Around the Lower Outer Frame */}
      <g className="animate-lotus-sway">
        <path
          d="M29 116 C19 104 16 89 22 77 C30 86 34 100 37 113 Z"
          fill={`url(#lp-petal-purple-${uid})`}
          stroke={`url(#lp-gold-${uid})`}
          strokeWidth="1.3"
        />
        <path
          d="M131 116 C141 104 144 89 138 77 C130 86 126 100 123 113 Z"
          fill={`url(#lp-petal-purple-${uid})`}
          stroke={`url(#lp-gold-${uid})`}
          strokeWidth="1.3"
        />

        {!compact && (
          <>
            <path
              d="M44 134 C24 130 11 116 7 101 C22 104 36 113 49 128 Z"
              fill={`url(#lp-petal-pink-${uid})`}
              stroke={`url(#lp-gold-${uid})`}
              strokeWidth="1.4"
            />
            <path
              d="M116 134 C136 130 149 116 153 101 C138 104 124 113 111 128 Z"
              fill={`url(#lp-petal-pink-${uid})`}
              stroke={`url(#lp-gold-${uid})`}
              strokeWidth="1.4"
            />
          </>
        )}

        <path
          d="M66 143 C46 143 30 133 24 119 C40 121 55 127 70 138 Z"
          fill={`url(#lp-petal-pink-${uid})`}
          stroke={`url(#lp-gold-${uid})`}
          strokeWidth="1.35"
        />
        <path
          d="M94 143 C114 143 130 133 136 119 C120 121 105 127 90 138 Z"
          fill={`url(#lp-petal-pink-${uid})`}
          stroke={`url(#lp-gold-${uid})`}
          strokeWidth="1.35"
        />

        <ellipse
          cx="80"
          cy="146.5"
          rx="35"
          ry="5.2"
          fill="#581C87"
          fillOpacity="0.88"
          stroke={`url(#lp-gold-${uid})`}
          strokeWidth="1.3"
        />
        <ellipse cx="80" cy="146" rx="25" ry="2.4" fill="#E879F9" fillOpacity="0.45" />

        <path
          d="M64 139 C69 133 74 133 80 127 C86 133 91 133 96 139 C90 143 85 146 80 149 C75 146 70 143 64 139 Z"
          fill={`url(#lp-gold-${uid})`}
          stroke="#78350F"
          strokeWidth="0.7"
        />
        <path
          d="M80 129 L86 138 L80 147 L74 138 Z"
          fill={`url(#lp-gem-${uid})`}
          stroke="#FEF08A"
          strokeWidth="1"
        />
        <circle cx="79" cy="135.5" r="1.2" fill="#FFFFFF" opacity="0.88" />
      </g>

      {/* Floating Pink & Gold Sparkling Particles */}
      <g className="animate-seat-sparkle" style={{ animationDelay: '0.1s' }}>
        <path d="M22 36 L23.5 40 L27.5 41.5 L23.5 43 L22 47 L20.5 43 L16.5 41.5 L20.5 40 Z" fill="#F5D0FE" />
      </g>
      <g className="animate-seat-sparkle" style={{ animationDelay: '0.9s' }}>
        <path d="M138 35 L139.5 39 L143.5 40.5 L139.5 42 L138 46 L136.5 42 L132.5 40.5 L136.5 39 Z" fill="#FEF08A" />
      </g>
      <g className="animate-seat-sparkle" style={{ animationDelay: '1.4s' }}>
        <circle cx="145" cy="68" r="1.9" fill="#F472B6" />
        <circle cx="15" cy="66" r="1.7" fill="#E879F9" />
      </g>
    </svg>
  );
};

/* =========================================================================
   THEME 3 — DIAMOND / ICE BLUE SEAT
   Silver-platinum & ice-blue circular bevel frame, sculpted crystal tiara,
   faceted side ice shards, moving cyan light beam & rotating diamond sparkles.
   ========================================================================= */
const DiamondIceBlueSvg: React.FC<{ uid: string; isHero: boolean; compact: boolean }> = ({
  uid,
  compact,
}) => {
  const cx = 80;
  const cy = 80;
  const ringR = 54.5;

  return (
    <svg
      viewBox="0 0 160 160"
      className="w-full h-full overflow-visible"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id={`db-silver-${uid}`} x1="18" y1="12" x2="142" y2="148" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="28%" stopColor="#BAE6FD" />
          <stop offset="56%" stopColor="#0284C7" />
          <stop offset="82%" stopColor="#E0F2FE" />
          <stop offset="100%" stopColor="#0369A1" />
        </linearGradient>
        <linearGradient id={`db-cyan-${uid}`} x1="26" y1="20" x2="134" y2="136" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#E0F2FE" />
          <stop offset="50%" stopColor="#38BDF8" />
          <stop offset="100%" stopColor="#06B6D4" />
        </linearGradient>
        <linearGradient id={`db-crystal-${uid}`} x1="80" y1="4" x2="80" y2="30" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="35%" stopColor="#7DD3FC" />
          <stop offset="75%" stopColor="#0284C7" />
          <stop offset="100%" stopColor="#1E3A8A" />
        </linearGradient>
        <linearGradient id={`db-arc-${uid}`} x1="20" y1="20" x2="140" y2="120" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#38BDF8" stopOpacity="0" />
          <stop offset="48%" stopColor="#67E8F9" stopOpacity="0.95" />
          <stop offset="72%" stopColor="#FFFFFF" stopOpacity="1" />
          <stop offset="100%" stopColor="#0EA5E9" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Glowing Cyan & Ice-Blue Outer Aura */}
      <circle cx={cx} cy={cy} r={ringR + 7.2} stroke="#38BDF8" strokeOpacity="0.28" strokeWidth="5.2" />

      {/* Platinum Silver & Ice-Blue Bevelled Circular Frame */}
      <circle cx={cx} cy={cy} r={ringR + 3.1} stroke={`url(#db-silver-${uid})`} strokeWidth="5.1" />
      <circle cx={cx} cy={cy} r={ringR - 0.3} stroke={`url(#db-cyan-${uid})`} strokeWidth="2" />

      {/* Bright moving cyan light beam + counter-rotating faceted crystal orbit */}
      <g className="animate-seat-orbit">
        <circle
          cx={cx}
          cy={cy}
          r={ringR + 3.1}
          stroke={`url(#db-arc-${uid})`}
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeDasharray="68 290"
        />
        <circle cx={cx} cy={cy - (ringR + 3.1)} r="2.8" fill="#FFFFFF" />
      </g>
      <g className="animate-seat-orbit-reverse">
        <circle
          cx={cx}
          cy={cy}
          r={ringR + 6.2}
          stroke="#BAE6FD"
          strokeOpacity="0.45"
          strokeWidth="1.2"
          strokeDasharray="16 26"
        />
      </g>

      {/* Top Diamond Tiara Crystal Cluster */}
      <g>
        <polygon points="66,24 60,11 72,18 74,24" fill={`url(#db-crystal-${uid})`} stroke="#E0F2FE" strokeWidth="0.9" />
        <polygon points="94,24 100,11 88,18 86,24" fill={`url(#db-crystal-${uid})`} stroke="#E0F2FE" strokeWidth="0.9" />
        <polygon points="80,3.5 89,14 80,25 71,14" fill={`url(#db-crystal-${uid})`} stroke="#FFFFFF" strokeWidth="1.2" />
        <polygon points="80,3.5 84.5,14 80,14" fill="#FFFFFF" opacity="0.72" />
        <polygon points="75.5,14 80,14 80,25" fill="#BAE6FD" opacity="0.52" />
      </g>

      {/* Symmetrical Faceted Ice-Crystal Shards Flanking the Lower Outer Frame */}
      <g>
        <polygon points="27,108 11,93 20,86 30,97" fill={`url(#db-crystal-${uid})`} stroke="#E0F2FE" strokeWidth="1" />
        {!compact && (
          <polygon points="37,124 14,117 21,107 39,114" fill={`url(#db-cyan-${uid})`} stroke="#FFFFFF" strokeWidth="0.9" />
        )}
        <polygon points="133,108 149,93 140,86 130,97" fill={`url(#db-crystal-${uid})`} stroke="#E0F2FE" strokeWidth="1" />
        {!compact && (
          <polygon points="123,124 146,117 139,107 121,114" fill={`url(#db-cyan-${uid})`} stroke="#FFFFFF" strokeWidth="0.9" />
        )}
      </g>

      {/* Bottom Faceted Crystal Pedestal & Radiant Diamond Emblem */}
      <g>
        <path
          d="M42 134 L56 144 L104 144 L118 134 L102 139 L58 139 Z"
          fill={`url(#db-silver-${uid})`}
          stroke="#E0F2FE"
          strokeWidth="0.9"
        />
        <polygon
          points="80,129.5 89.5,139 80,150.5 70.5,139"
          fill={`url(#db-crystal-${uid})`}
          stroke="#FFFFFF"
          strokeWidth="1.2"
        />
        <polygon points="80,129.5 85,139 80,139" fill="#FFFFFF" opacity="0.8" />
      </g>

      {/* Rotating Diamond Star Sparkle Flares & Crystal Particles */}
      <g className="animate-diamond-glint" style={{ animationDelay: '0s' }}>
        <path d="M22 33 L23.8 38 L28.8 39.8 L23.8 41.6 L22 46.6 L20.2 41.6 L15.2 39.8 L20.2 38 Z" fill="#FFFFFF" />
      </g>
      <g className="animate-diamond-glint" style={{ animationDelay: '0.75s' }}>
        <path d="M138 34 L139.6 38.5 L144.1 40.1 L139.6 41.7 L138 46.2 L136.4 41.7 L131.9 40.1 L136.4 38.5 Z" fill="#BAE6FD" />
      </g>
      <g className="animate-diamond-glint" style={{ animationDelay: '1.35s' }}>
        <path d="M136 127 L137.3 130.2 L140.5 131.5 L137.3 132.8 L136 136 L134.7 132.8 L131.5 131.5 L134.7 130.2 Z" fill="#67E8F9" />
      </g>
      <g className="animate-seat-sparkle" style={{ animationDelay: '0.45s' }}>
        <polygon points="17,69 19.5,72 17,75 14.5,72" fill="#7DD3FC" />
        <polygon points="143,70 145.5,73 143,76 140.5,73" fill="#E0F2FE" />
      </g>
    </svg>
  );
};

/* =========================================================================
   ANIMATED LUXURY SOFA INTERIOR FOR EMPTY PARTY SEATS
   Renders inside the circular seat aperture when no user is seated, matching
   all three themes:
   - royal_gold_diya    -> Royal Crimson & Gold Tufted Maharaja Sofa
   - royal_purple_lotus -> Royal Pink/Purple Scalloped Lotus Velvet Sofa
   - diamond_ice_blue   -> Platinum & Ice-Blue Faceted Crystal Throne Sofa
   ========================================================================= */
interface AnimatedEmptySeatSofaProps {
  theme: PartySeatThemeId;
  isLocked?: boolean;
  isVip?: boolean;
  compact?: boolean;
}

export const AnimatedEmptySeatSofa: React.FC<AnimatedEmptySeatSofaProps> = ({
  theme,
  isLocked = false,
  isVip = false,
  compact = false,
}) => {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');

  const palette =
    theme === 'royal_gold_diya'
      ? {
          bgTop: '#3B0A1E',
          bgMid: '#240714',
          bgBot: '#12040B',
          aura: '#F59E0B',
          trimLight: '#FEF08A',
          trimMid: '#F59E0B',
          trimDark: '#92400E',
          velvetLight: '#F43F5E',
          velvetMid: '#BE123C',
          velvetDark: '#6B0F26',
          cushionTop: '#E11D48',
          cushionEdge: '#881337',
          gem: '#FDE047',
          sparkle: '#FEF08A',
          floorGlow: '#FBBF24',
        }
      : theme === 'royal_purple_lotus'
      ? {
          bgTop: '#330B4D',
          bgMid: '#1F0733',
          bgBot: '#0F041B',
          aura: '#E879F9',
          trimLight: '#FEF08A',
          trimMid: '#F59E0B',
          trimDark: '#B45309',
          velvetLight: '#F472B6',
          velvetMid: '#A855F7',
          velvetDark: '#581C87',
          cushionTop: '#D946EF',
          cushionEdge: '#6B21A8',
          gem: '#F5D0FE',
          sparkle: '#F9A8D4',
          floorGlow: '#E879F9',
        }
      : {
          bgTop: '#0B2B4B',
          bgMid: '#071B33',
          bgBot: '#040E1D',
          aura: '#38BDF8',
          trimLight: '#FFFFFF',
          trimMid: '#BAE6FD',
          trimDark: '#0284C7',
          velvetLight: '#7DD3FC',
          velvetMid: '#0284C7',
          velvetDark: '#1E3A8A',
          cushionTop: '#38BDF8',
          cushionEdge: '#0369A1',
          gem: '#FFFFFF',
          sparkle: '#BAE6FD',
          floorGlow: '#38BDF8',
        };

  return (
    <div className="relative w-full h-full rounded-full overflow-hidden flex items-center justify-center">
      <svg
        viewBox="0 0 100 100"
        className={`w-full h-full transition-transform duration-300 group-hover:scale-105 ${
          isLocked ? 'opacity-65 saturate-75' : 'opacity-100'
        }`}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <radialGradient id={`sf-bg-${uid}`} cx="50%" cy="38%" r="65%">
            <stop offset="0%" stopColor={palette.bgTop} />
            <stop offset="58%" stopColor={palette.bgMid} />
            <stop offset="100%" stopColor={palette.bgBot} />
          </radialGradient>
          <radialGradient id={`sf-aura-${uid}`} cx="50%" cy="54%" r="44%">
            <stop offset="0%" stopColor={palette.aura} stopOpacity="0.46" />
            <stop offset="65%" stopColor={palette.aura} stopOpacity="0.12" />
            <stop offset="100%" stopColor={palette.aura} stopOpacity="0" />
          </radialGradient>
          <linearGradient id={`sf-trim-${uid}`} x1="16" y1="22" x2="84" y2="82" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor={palette.trimLight} />
            <stop offset="50%" stopColor={palette.trimMid} />
            <stop offset="100%" stopColor={palette.trimDark} />
          </linearGradient>
          <linearGradient id={`sf-velvet-${uid}`} x1="50" y1="26" x2="50" y2="74" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor={palette.velvetLight} />
            <stop offset="52%" stopColor={palette.velvetMid} />
            <stop offset="100%" stopColor={palette.velvetDark} />
          </linearGradient>
          <linearGradient id={`sf-cushion-${uid}`} x1="24" y1="54" x2="76" y2="74" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor={palette.cushionTop} />
            <stop offset="55%" stopColor={palette.velvetMid} />
            <stop offset="100%" stopColor={palette.cushionEdge} />
          </linearGradient>
          <linearGradient id={`sf-sheen-${uid}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0" />
            <stop offset="50%" stopColor="#FFFFFF" stopOpacity="0.72" />
            <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
          </linearGradient>
          <clipPath id={`sf-clip-${uid}`}>
            <circle cx="50" cy="50" r="48" />
          </clipPath>
        </defs>

        {/* Rich Theme-Matched Circular Alcove Backdrop */}
        <circle cx="50" cy="50" r="50" fill={`url(#sf-bg-${uid})`} />

        {/* Pulsing Ambient Spotlight Behind the Sofa */}
        <circle cx="50" cy="54" r="42" fill={`url(#sf-aura-${uid})`} className="animate-lotus-pulse" />

        {/* Glowing Floor Reflection Disc */}
        <ellipse cx="50" cy="78" rx="31" ry="6.5" fill={palette.floorGlow} fillOpacity="0.22" />
        <ellipse cx="50" cy="78" rx="22" ry="3.2" fill={palette.trimLight} fillOpacity="0.28" />

        {/* Animated Plush Luxury Sofa Group */}
        <g clipPath={`url(#sf-clip-${uid})`}>
          <g className="animate-sofa-breathe">
            {/* Ornate Curved Sofa Feet */}
            <path
              d="M27 72 L24 78.5 L28.5 78.5 L31 73 Z"
              fill={`url(#sf-trim-${uid})`}
            />
            <path
              d="M73 72 L76 78.5 L71.5 78.5 L69 73 Z"
              fill={`url(#sf-trim-${uid})`}
            />

            {/* THEME-SPECIFIC BACKREST SILHOUETTE */}
            {theme === 'royal_gold_diya' && (
              /* Royal Maharaja Baroque Arch Backrest */
              <g>
                <path
                  d="M24 56 C23 41 29 31 39 30 C43 24 46.5 22 50 20 C53.5 22 57 24 61 30 C71 31 77 41 76 56 Z"
                  fill={`url(#sf-velvet-${uid})`}
                  stroke={`url(#sf-trim-${uid})`}
                  strokeWidth="2.8"
                  strokeLinejoin="round"
                />
                {/* Top mini crown jewel */}
                <path
                  d="M50 18.5 L53.5 23 L50 27 L46.5 23 Z"
                  fill={palette.gem}
                  stroke="#92400E"
                  strokeWidth="0.7"
                />
              </g>
            )}

            {theme === 'royal_purple_lotus' && (
              /* Scalloped 3-Petal Lotus Velvet Backrest */
              <g>
                {/* Left & Right Lotus Backrest Petals */}
                <path
                  d="M36 55 C24 52 21 38 28 31 C35 31 41 38 43 52 Z"
                  fill={`url(#sf-velvet-${uid})`}
                  stroke={`url(#sf-trim-${uid})`}
                  strokeWidth="2.2"
                />
                <path
                  d="M64 55 C76 52 79 38 72 31 C65 31 59 38 57 52 Z"
                  fill={`url(#sf-velvet-${uid})`}
                  stroke={`url(#sf-trim-${uid})`}
                  strokeWidth="2.2"
                />
                {/* Center Tall Lotus Petal Backrest */}
                <path
                  d="M35 55 C34 37 41 25 50 20.5 C59 25 66 37 65 55 Z"
                  fill={`url(#sf-velvet-${uid})`}
                  stroke={`url(#sf-trim-${uid})`}
                  strokeWidth="2.5"
                />
                <path
                  d="M50 23 L53 28 L50 32.5 L47 28 Z"
                  fill={palette.gem}
                  stroke="#FDE047"
                  strokeWidth="0.8"
                />
              </g>
            )}

            {theme === 'diamond_ice_blue' && (
              /* Faceted Crystal & Platinum Throne Backrest */
              <g>
                <polygon
                  points="25,56 23,39 34,29 50,21 66,29 77,39 75,56"
                  fill={`url(#sf-velvet-${uid})`}
                  stroke={`url(#sf-trim-${uid})`}
                  strokeWidth="2.6"
                  strokeLinejoin="round"
                />
                {/* Faceted ice geometric ridge highlights */}
                <polyline
                  points="34,29 50,41 66,29"
                  stroke="#E0F2FE"
                  strokeOpacity="0.48"
                  strokeWidth="1.2"
                />
                <polygon
                  points="50,18.5 54,24 50,29 46,24"
                  fill="#FFFFFF"
                  stroke="#38BDF8"
                  strokeWidth="0.9"
                />
              </g>
            )}

            {/* Plush Diamond-Tufted Velvet Buttons on Backrest */}
            <g opacity="0.85">
              <circle cx="41" cy="40" r="1.4" fill={palette.trimLight} />
              <circle cx="50" cy="36.5" r="1.5" fill={palette.trimLight} />
              <circle cx="59" cy="40" r="1.4" fill={palette.trimLight} />
              <circle cx="45.5" cy="46.5" r="1.3" fill={palette.trimLight} />
              <circle cx="54.5" cy="46.5" r="1.3" fill={palette.trimLight} />
            </g>

            {/* Accent Mini Bolster Cushions (Left & Right) */}
            <ellipse
              cx="31.5"
              cy="54"
              rx="5.5"
              ry="4.2"
              transform="rotate(-14 31.5 54)"
              fill={palette.velvetLight}
              stroke={`url(#sf-trim-${uid})`}
              strokeWidth="1.1"
            />
            <ellipse
              cx="68.5"
              cy="54"
              rx="5.5"
              ry="4.2"
              transform="rotate(14 68.5 54)"
              fill={palette.velvetLight}
              stroke={`url(#sf-trim-${uid})`}
              strokeWidth="1.1"
            />

            {/* Plush Tufted Seat Cushion */}
            <path
              d="M25 57 C25 53.5 34 51.5 50 51.5 C66 51.5 75 53.5 75 57 L74 65.5 C74 68.5 64 70.5 50 70.5 C36 70.5 26 68.5 26 65.5 Z"
              fill={`url(#sf-cushion-${uid})`}
              stroke={`url(#sf-trim-${uid})`}
              strokeWidth="1.6"
            />
            {/* Cushion middle crease & sheen */}
            <path
              d="M32 58.5 Q50 61.5 68 58.5"
              stroke="#FFFFFF"
              strokeOpacity="0.34"
              strokeWidth="1.2"
              strokeLinecap="round"
            />
            <line
              x1="50"
              y1="52.5"
              x2="50"
              y2="68.5"
              stroke={palette.velvetDark}
              strokeOpacity="0.55"
              strokeWidth="1.1"
            />

            {/* Sculpted Rolled Luxury Armrests (Left & Right) */}
            <path
              d="M17.5 52 C17.5 47 23.5 46.5 26 51.5 L28 66 C26.5 69.5 21 70 19 66.5 Z"
              fill={`url(#sf-velvet-${uid})`}
              stroke={`url(#sf-trim-${uid})`}
              strokeWidth="2.1"
              strokeLinejoin="round"
            />
            <circle cx="21.2" cy="51.5" r="2.2" fill={`url(#sf-trim-${uid})`} />

            <path
              d="M82.5 52 C82.5 47 76.5 46.5 74 51.5 L72 66 C73.5 69.5 79 70 81 66.5 Z"
              fill={`url(#sf-velvet-${uid})`}
              stroke={`url(#sf-trim-${uid})`}
              strokeWidth="2.1"
              strokeLinejoin="round"
            />
            <circle cx="78.8" cy="51.5" r="2.2" fill={`url(#sf-trim-${uid})`} />

            {/* Lower Sculpted Gold/Platinum Base Rail & Center Gem Medallion */}
            <path
              d="M23 68.5 C32 72.5 68 72.5 77 68.5 L75.5 73.5 C66 76.5 34 76.5 24.5 73.5 Z"
              fill={`url(#sf-trim-${uid})`}
            />
            <path
              d="M50 69.2 L53.4 72.8 L50 76.4 L46.6 72.8 Z"
              fill={palette.gem}
              stroke={palette.trimDark}
              strokeWidth="0.7"
            />

            {/* Gliding Specular Velvet Shimmer Sweep */}
            <rect
              x="0"
              y="16"
              width="24"
              height="68"
              fill={`url(#sf-sheen-${uid})`}
              className="animate-sofa-shimmer"
            />
          </g>
        </g>

        {/* Subtle Floating Sparkle Motes Inside the Seat Alcove */}
        {!compact && (
          <>
            <g className="animate-seat-sparkle" style={{ animationDelay: '0.2s' }}>
              <path d="M24 27 L25 29.8 L27.8 30.8 L25 31.8 L24 34.6 L23 31.8 L20.2 30.8 L23 29.8 Z" fill={palette.sparkle} />
            </g>
            <g className="animate-seat-sparkle" style={{ animationDelay: '1.05s' }}>
              <path d="M76 26 L77 28.5 L79.5 29.5 L77 30.5 L76 33 L75 30.5 L72.5 29.5 L75 28.5 Z" fill={palette.sparkle} />
            </g>
          </>
        )}

        {/* Tiny VIP Crown Accent if VIP 1 Seat */}
        {isVip && !isLocked && (
          <circle cx="50" cy="14" r="2" fill={palette.gem} className="animate-seat-sparkle" />
        )}
      </svg>

      {/* Subtle Lock Overlay ONLY when seat is locked (preserves luxury sofa behind a crisp lock emblem) */}
      {isLocked && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
          <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-[#130826]/85 border border-amber-300/65 flex items-center justify-center shadow-md">
            <svg viewBox="0 0 24 24" className="w-3 h-3 text-amber-300" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <rect x="4" y="11" width="16" height="10" rx="2" />
              <path d="M8 11V7a4 4 0 0 1 8 0v4" />
            </svg>
          </div>
        </div>
      )}
    </div>
  );
};

/* =========================================================================
   THREE-STAR SEAT THEME SELECTOR CONTROL
   Exactly three star-shaped buttons:
   - Gold Star   -> Royal Gold / Diya
   - Purple Star -> Royal Pink / Purple Lotus
   - Blue Star   -> Diamond / Ice Blue
   ========================================================================= */
interface PartySeatThemeStarSelectorProps {
  selectedTheme: PartySeatThemeId;
  onSelectTheme: (theme: PartySeatThemeId) => void;
  orientation?: 'vertical' | 'horizontal';
}

export const PartySeatThemeStarSelector: React.FC<PartySeatThemeStarSelectorProps> = ({
  selectedTheme,
  onSelectTheme,
  orientation = 'vertical',
}) => {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');

  return (
    <div
      role="group"
      aria-label="Party Seat Theme Selector"
      className={`flex ${
        orientation === 'vertical' ? 'flex-col gap-1.5 py-1.5 px-1' : 'flex-row gap-1.5 px-1.5 py-1'
      } items-center rounded-full bg-[#130826]/80 backdrop-blur-md border border-white/15 shadow-[0_8px_24px_rgba(0,0,0,0.45)]`}
    >
      {PARTY_SEAT_THEMES.map((item) => {
        const isSelected = selectedTheme === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelectTheme(item.id)}
            aria-label={`Select ${item.name} seat theme`}
            aria-pressed={isSelected}
            title={item.name}
            className={`relative w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 active:scale-90 ${
              isSelected
                ? `${item.activeBorder} border scale-105`
                : 'border border-white/10 bg-white/[0.04] hover:bg-white/12 opacity-80 hover:opacity-100'
            }`}
            style={isSelected ? { boxShadow: item.activeGlow } : undefined}
          >
            <svg
              viewBox="0 0 24 24"
              className={`w-[18px] h-[18px] transition-transform duration-200 ${
                isSelected ? 'scale-110' : 'scale-95'
              }`}
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
                <linearGradient id={`star-grad-${item.id}-${uid}`} x1="4" y1="2" x2="20" y2="22" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor={item.starFillFrom} />
                  <stop offset="100%" stopColor={item.starFillTo} />
                </linearGradient>
              </defs>
              <path
                d="M12 2.2L14.88 8.04L21.32 8.98L16.66 13.52L17.76 19.94L12 16.9L6.24 19.94L7.34 13.52L2.68 8.98L9.12 8.04L12 2.2Z"
                fill={`url(#star-grad-${item.id}-${uid})`}
                stroke={isSelected ? '#FFFFFF' : item.starStroke}
                strokeWidth={isSelected ? '1.35' : '1'}
                strokeLinejoin="round"
              />
              <path
                d="M12 4.6L13.5 8.5L12 11.4L10.5 8.5Z"
                fill="#FFFFFF"
                opacity={isSelected ? '0.68' : '0.35'}
              />
            </svg>
          </button>
        );
      })}
    </div>
  );
};
