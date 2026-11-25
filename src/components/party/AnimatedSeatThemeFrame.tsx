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
    name: 'Crystal Gold',
    shortLabel: 'Gold Orb',
    starFillFrom: '#FEF08A',
    starFillTo: '#D97706',
    starStroke: '#FDE68A',
    activeGlow: '0 0 14px rgba(251,191,36,0.85)',
    activeBorder: 'border-amber-300/90 bg-amber-500/25',
  },
  {
    id: 'royal_purple_lotus',
    name: 'Crystal Violet',
    shortLabel: 'Violet Orb',
    starFillFrom: '#F5D0FE',
    starFillTo: '#9333EA',
    starStroke: '#F0ABFC',
    activeGlow: '0 0 14px rgba(217,70,239,0.85)',
    activeBorder: 'border-fuchsia-300/90 bg-fuchsia-500/25',
  },
  {
    id: 'diamond_ice_blue',
    name: 'Crystal Ice',
    shortLabel: 'Ice Orb',
    starFillFrom: '#E0F2FE',
    starFillTo: '#0284C7',
    starStroke: '#7DD3FC',
    activeGlow: '0 0 14px rgba(56,189,248,0.88)',
    activeBorder: 'border-sky-300/90 bg-sky-500/25',
  },
];

export const isValidPartySeatTheme = (val: unknown): val is PartySeatThemeId =>
  val === 'royal_gold_diya' || val === 'royal_purple_lotus' || val === 'diamond_ice_blue';

interface OrbPalette {
  glassCore: string;
  glassMid: string;
  glassEdge: string;
  rimLight: string;
  rimMid: string;
  rimDark: string;
  crescentStart: string;
  crescentMid: string;
  crescentEnd: string;
  glintStroke: string;
  outerShadow: string;
  heroOuterShadow: string;
  reactiveAura: string;
  iconGlow: string;
}

const ORB_PALETTES: Record<PartySeatThemeId, OrbPalette> = {
  diamond_ice_blue: {
    glassCore: 'rgba(12, 26, 32, 0.42)',
    glassMid: 'rgba(30, 58, 66, 0.26)',
    glassEdge: 'rgba(186, 238, 255, 0.24)',
    rimLight: 'rgba(232, 250, 255, 0.92)',
    rimMid: 'rgba(125, 226, 238, 0.56)',
    rimDark: 'rgba(148, 205, 224, 0.22)',
    crescentStart: '#A7F3D0',
    crescentMid: '#67E8F9',
    crescentEnd: '#E0F2FE',
    glintStroke: '#E0F9FF',
    outerShadow: '0 4px 16px rgba(0, 0, 0, 0.34), 0 0 14px rgba(103, 232, 249, 0.22)',
    heroOuterShadow: '0 6px 20px rgba(0, 0, 0, 0.4), 0 0 22px rgba(103, 232, 249, 0.38)',
    reactiveAura: 'rgba(103, 232, 249, 0.55)',
    iconGlow: 'drop-shadow(0 1px 4px rgba(103, 232, 249, 0.42))',
  },
  royal_gold_diya: {
    glassCore: 'rgba(28, 20, 10, 0.44)',
    glassMid: 'rgba(66, 46, 18, 0.28)',
    glassEdge: 'rgba(254, 240, 178, 0.24)',
    rimLight: 'rgba(255, 249, 219, 0.94)',
    rimMid: 'rgba(251, 191, 36, 0.62)',
    rimDark: 'rgba(217, 119, 6, 0.24)',
    crescentStart: '#FEF08A',
    crescentMid: '#FBBF24',
    crescentEnd: '#FDBA74',
    glintStroke: '#FFFBEB',
    outerShadow: '0 4px 16px rgba(0, 0, 0, 0.34), 0 0 14px rgba(251, 191, 36, 0.24)',
    heroOuterShadow: '0 6px 20px rgba(0, 0, 0, 0.4), 0 0 22px rgba(251, 191, 36, 0.4)',
    reactiveAura: 'rgba(251, 191, 36, 0.55)',
    iconGlow: 'drop-shadow(0 1px 4px rgba(251, 191, 36, 0.42))',
  },
  royal_purple_lotus: {
    glassCore: 'rgba(24, 12, 34, 0.44)',
    glassMid: 'rgba(58, 26, 78, 0.28)',
    glassEdge: 'rgba(245, 208, 254, 0.24)',
    rimLight: 'rgba(253, 244, 255, 0.94)',
    rimMid: 'rgba(217, 70, 239, 0.6)',
    rimDark: 'rgba(147, 51, 234, 0.24)',
    crescentStart: '#F5D0FE',
    crescentMid: '#E879F9',
    crescentEnd: '#C084FC',
    glintStroke: '#FDF4FF',
    outerShadow: '0 4px 16px rgba(0, 0, 0, 0.34), 0 0 14px rgba(217, 70, 239, 0.26)',
    heroOuterShadow: '0 6px 20px rgba(0, 0, 0, 0.4), 0 0 22px rgba(217, 70, 239, 0.42)',
    reactiveAura: 'rgba(217, 70, 239, 0.55)',
    iconGlow: 'drop-shadow(0 1px 4px rgba(232, 121, 249, 0.45))',
  },
};

interface AnimatedSeatThemeFrameProps {
  theme: PartySeatThemeId;
  sizeClass: string;
  role?: 'host' | 'vip' | 'guest';
  compact?: boolean;
  children: React.ReactNode;
}

/**
 * Translucent Glass-Bubble / Crystal-Orb Party Seat Container.
 * Zero bulky ornate frames or overhanging borders — clean circular frosted glass
 * orb with a luminous theme-tinted iridescent crescent rim, subtle orbiting glint,
 * and Web Audio API energy reactivity (--party-audio-energy / --party-audio-bass).
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
  const palette = ORB_PALETTES[theme];
  const isHero = role !== 'guest';

  return (
    <div
      className={`relative ${sizeClass} rounded-full flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-[1.04]`}
    >
      {/* Synchronized Audio-Reactive Glass Orb Halo (driven by Web Audio AnalyserNode) */}
      <div
        aria-hidden="true"
        className="pointer-events-none select-none absolute -inset-[14%] rounded-full z-[2]"
        style={{
          background: `radial-gradient(circle, ${palette.reactiveAura} 0%, transparent 70%)`,
          opacity: 'calc(var(--party-audio-energy, 0) * 0.78)',
          transform: 'scale(calc(0.95 + var(--party-audio-energy, 0) * 0.25)) translateZ(0)',
          willChange: 'transform, opacity',
        }}
      />

      {/* Inner Circular Glass Orb Surface — translucent backdrop + unobstructed content */}
      <div
        className="relative z-10 w-full h-full rounded-full overflow-hidden backdrop-blur-[2.5px]"
        style={{
          boxShadow: isHero ? palette.heroOuterShadow : palette.outerShadow,
          transform: 'scale(calc(1 + var(--party-audio-bass, 0) * 0.04)) translateZ(0)',
          willChange: 'transform',
        }}
      >
        {children}

        {/* Translucent Glass Rim, Top-Left Specular Arc & Iridescent Bottom-Right Crescent */}
        <svg
          aria-hidden="true"
          viewBox="0 0 100 100"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="pointer-events-none select-none absolute inset-0 w-full h-full z-20"
        >
          <defs>
            {/* Outer Glass Hairline Stroke */}
            <linearGradient id={`orb-rim-${uid}`} x1="12" y1="8" x2="88" y2="92" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor={palette.rimLight} />
              <stop offset="48%" stopColor={palette.rimDark} />
              <stop offset="78%" stopColor={palette.rimMid} />
              <stop offset="100%" stopColor={palette.rimLight} />
            </linearGradient>

            {/* Signature Luminous Lower-Right Crescent Refraction */}
            <linearGradient id={`orb-crescent-${uid}`} x1="88" y1="36" x2="30" y2="94" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor={palette.crescentStart} stopOpacity="0.1" />
              <stop offset="42%" stopColor={palette.crescentMid} stopOpacity="0.88" />
              <stop offset="78%" stopColor={palette.crescentEnd} stopOpacity="0.95" />
              <stop offset="100%" stopColor={palette.crescentStart} stopOpacity="0.06" />
            </linearGradient>

            {/* Soft Inner Bottom-Right Iridescent Wash */}
            <radialGradient id={`orb-wash-${uid}`} cx="74%" cy="76%" r="48%">
              <stop offset="0%" stopColor={palette.crescentMid} stopOpacity="0.34" />
              <stop offset="55%" stopColor={palette.crescentEnd} stopOpacity="0.12" />
              <stop offset="100%" stopColor={palette.crescentMid} stopOpacity="0" />
            </radialGradient>

            {/* Top-Left Convex Glass Specular Arc */}
            <linearGradient id={`orb-spec-${uid}`} x1="14" y1="14" x2="54" y2="42" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.58" />
              <stop offset="55%" stopColor="#FFFFFF" stopOpacity="0.16" />
              <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
            </linearGradient>

            {/* Orbiting Light Glint Stroke */}
            <linearGradient id={`orb-glint-${uid}`} x1="50" y1="2" x2="96" y2="50" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor={palette.glintStroke} stopOpacity="0" />
              <stop offset="55%" stopColor={palette.glintStroke} stopOpacity="0.95" />
              <stop offset="100%" stopColor={palette.glintStroke} stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Subtle inner iridescent glow hugging lower-right curvature */}
          <circle cx="50" cy="50" r="48.5" fill={`url(#orb-wash-${uid})`} className="animate-orb-crescent" />

          {/* Crisp top-left glass bubble highlight */}
          <path
            d="M 16 36 A 39 39 0 0 1 64 13"
            stroke={`url(#orb-spec-${uid})`}
            strokeWidth={isHero ? '3.4' : '2.8'}
            strokeLinecap="round"
          />

          {/* Signature glowing bottom-right glass crescent rim */}
          <path
            d="M 88.5 46 A 39.5 39.5 0 0 1 32 86.2"
            stroke={`url(#orb-crescent-${uid})`}
            strokeWidth={isHero ? '4.8' : '4.2'}
            strokeLinecap="round"
            className="animate-orb-crescent"
          />

          {/* Thin crisp outer crystal rim */}
          <circle
            cx="50"
            cy="50"
            r="48.4"
            stroke={`url(#orb-rim-${uid})`}
            strokeWidth={isHero ? '2.1' : '1.7'}
          />

          {/* Silky slow-orbiting specular glass edge glint */}
          {!compact && (
            <g className="animate-orb-glint">
              <path
                d="M 54 1.8 A 48.2 48.2 0 0 1 94.6 32"
                stroke={`url(#orb-glint-${uid})`}
                strokeWidth="2.1"
                strokeLinecap="round"
              />
            </g>
          )}
        </svg>
      </div>
    </div>
  );
};

/* =========================================================================
   EMPTY GLASS-ORB SEAT INTERIOR (+ SIGN FOR OPEN, PADLOCK FOR LOCKED)
   Replaces the old sofa graphic with a clean, translucent frosted-glass button
   matching the reference design. Keeps export name for seamless compatibility.
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
  const palette = ORB_PALETTES[theme];

  return (
    <div
      className="relative w-full h-full rounded-full flex items-center justify-center overflow-hidden select-none"
      style={{
        background: `radial-gradient(circle at 32% 28%, ${palette.glassEdge} 0%, ${palette.glassMid} 44%, ${palette.glassCore} 100%)`,
      }}
    >
      {/* Soft top glass dome bloom */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-[18%] left-[12%] w-[76%] h-[48%] rounded-full"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(255,255,255,0.22) 0%, transparent 72%)',
        }}
      />

      {/* Crisp Centered Icon: White Bold Plus (+) when Open, White Padlock when Locked */}
      {isLocked ? (
        <svg
          viewBox="0 0 36 36"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={`relative z-10 animate-orb-icon-pulse ${
            isVip ? 'w-[46%] h-[46%]' : compact ? 'w-[48%] h-[48%]' : 'w-[46%] h-[46%]'
          }`}
          style={{ filter: palette.iconGlow }}
          aria-hidden="true"
        >
          {/* Rounded Padlock Shackle */}
          <path
            d="M12.5 15.5V12.2C12.5 9.15 14.96 6.7 18 6.7C21.04 6.7 23.5 9.15 23.5 12.2V15.5"
            stroke="#FFFFFF"
            strokeWidth="3.1"
            strokeLinecap="round"
          />
          {/* Solid Clean White Padlock Body */}
          <rect x="8.8" y="15.2" width="18.4" height="14.1" rx="3.4" fill="#FFFFFF" />
          {/* Subtle Center Keyhole Accent */}
          <circle cx="18" cy="21.2" r="1.85" fill={palette.glassCore} fillOpacity="0.82" />
          <rect x="17.15" y="21.9" width="1.7" height="3.3" rx="0.85" fill={palette.glassCore} fillOpacity="0.82" />
        </svg>
      ) : (
        <svg
          viewBox="0 0 36 36"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={`relative z-10 animate-orb-icon-pulse transition-transform duration-200 group-hover:scale-110 ${
            isVip ? 'w-[44%] h-[44%]' : compact ? 'w-[46%] h-[46%]' : 'w-[44%] h-[44%]'
          }`}
          style={{ filter: palette.iconGlow }}
          aria-hidden="true"
        >
          {/* Bold Centered Crisp White Plus Sign */}
          <rect x="15.6" y="7" width="4.8" height="22" rx="2.2" fill="#FFFFFF" />
          <rect x="7" y="15.6" width="22" height="4.8" rx="2.2" fill="#FFFFFF" />
        </svg>
      )}
    </div>
  );
};

/* =========================================================================
   THREE-STAR SEAT COLOR THEME SELECTOR CONTROL
   Preserves the three glowing star buttons so Host & Moderators can switch
   the translucent glass-orb seat colors live across the room:
   - Gold Star   -> Crystal Gold Orb
   - Purple Star -> Crystal Violet Orb
   - Blue Star   -> Crystal Ice Orb
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
      aria-label="Party Seat Color Theme Selector"
      className={`flex ${
        orientation === 'vertical' ? 'flex-col gap-1.5 py-1.5 px-1' : 'flex-row gap-1.5 px-1.5 py-1'
      } items-center rounded-full bg-[#130826]/75 backdrop-blur-md border border-white/15 shadow-[0_8px_24px_rgba(0,0,0,0.45)]`}
    >
      {PARTY_SEAT_THEMES.map((item) => {
        const isSelected = selectedTheme === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelectTheme(item.id)}
            aria-label={`Select ${item.name} seat color`}
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
