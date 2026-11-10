import React from 'react';
import { getTierGroupForLevel } from '../../data/levelData';

export interface LevelBadgeIconProps {
  level: number;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'hero';
  className?: string;
  showShadow?: boolean;
}

interface TierColorTheme {
  primary: string;
  secondary: string;
  accent: string;
  shieldGradTop: string;
  shieldGradBottom: string;
  wingsGradTop: string;
  wingsGradBottom: string;
  bevelLight: string;
  bevelDark: string;
  centerBg: string;
  centerText: string;
  ringBorder: string;
  glowColor: string;
  starColor: string;
}

const TIER_THEMES: Record<string, TierColorTheme> = {
  Normal: {
    primary: '#94A3B8',
    secondary: '#64748B',
    accent: '#CBD5E1',
    shieldGradTop: '#475569',
    shieldGradBottom: '#1E293B',
    wingsGradTop: '#94A3B8',
    wingsGradBottom: '#475569',
    bevelLight: '#E2E8F0',
    bevelDark: '#334155',
    centerBg: '#F8FAFC',
    centerText: '#1E293B',
    ringBorder: '#94A3B8',
    glowColor: 'rgba(148, 163, 184, 0.4)',
    starColor: '#CBD5E1',
  },
  Bronze: {
    primary: '#CD7F32',
    secondary: '#8C5523',
    accent: '#FBBF24',
    shieldGradTop: '#B45309',
    shieldGradBottom: '#451A03',
    wingsGradTop: '#D97706',
    wingsGradBottom: '#78350F',
    bevelLight: '#FDE68A',
    bevelDark: '#78350F',
    centerBg: '#FFFBEB',
    centerText: '#78350F',
    ringBorder: '#F59E0B',
    glowColor: 'rgba(217, 119, 6, 0.45)',
    starColor: '#FDE047',
  },
  Silver: {
    primary: '#E2E8F0',
    secondary: '#94A3B8',
    accent: '#FFFFFF',
    shieldGradTop: '#94A3B8',
    shieldGradBottom: '#334155',
    wingsGradTop: '#E2E8F0',
    wingsGradBottom: '#64748B',
    bevelLight: '#FFFFFF',
    bevelDark: '#475569',
    centerBg: '#FFFFFF',
    centerText: '#0F172A',
    ringBorder: '#CBD5E1',
    glowColor: 'rgba(226, 232, 240, 0.5)',
    starColor: '#FFFFFF',
  },
  Gold: {
    primary: '#F59E0B',
    secondary: '#B45309',
    accent: '#FEF08A',
    shieldGradTop: '#F59E0B',
    shieldGradBottom: '#78350F',
    wingsGradTop: '#FBBF24',
    wingsGradBottom: '#92400E',
    bevelLight: '#FEF9C3',
    bevelDark: '#78350F',
    centerBg: '#FFFDF0',
    centerText: '#78350F',
    ringBorder: '#FDE047',
    glowColor: 'rgba(245, 158, 11, 0.6)',
    starColor: '#FEF08A',
  },
  Platinum: {
    primary: '#38BDF8',
    secondary: '#0284C7',
    accent: '#E0F2FE',
    shieldGradTop: '#0284C7',
    shieldGradBottom: '#0C4A6E',
    wingsGradTop: '#7DD3FC',
    wingsGradBottom: '#0369A1',
    bevelLight: '#E0F2FE',
    bevelDark: '#075985',
    centerBg: '#F0F9FF',
    centerText: '#0C4A6E',
    ringBorder: '#38BDF8',
    glowColor: 'rgba(56, 189, 248, 0.6)',
    starColor: '#BAE6FD',
  },
  Sapphire: {
    primary: '#2563EB',
    secondary: '#1D4ED8',
    accent: '#93C5FD',
    shieldGradTop: '#2563EB',
    shieldGradBottom: '#0F172A',
    wingsGradTop: '#60A5FA',
    wingsGradBottom: '#1E40AF',
    bevelLight: '#BFDBFE',
    bevelDark: '#1E3A8A',
    centerBg: '#EFF6FF',
    centerText: '#1E3A8A',
    ringBorder: '#3B82F6',
    glowColor: 'rgba(37, 99, 235, 0.65)',
    starColor: '#93C5FD',
  },
  Emerald: {
    primary: '#10B981',
    secondary: '#059669',
    accent: '#A7F3D0',
    shieldGradTop: '#10B981',
    shieldGradBottom: '#064E3B',
    wingsGradTop: '#34D399',
    wingsGradBottom: '#047857',
    bevelLight: '#D1FAE5',
    bevelDark: '#065F46',
    centerBg: '#ECFDF5',
    centerText: '#064E3B',
    ringBorder: '#10B981',
    glowColor: 'rgba(16, 185, 129, 0.65)',
    starColor: '#A7F3D0',
  },
  Ruby: {
    primary: '#EF4444',
    secondary: '#DC2626',
    accent: '#FECACA',
    shieldGradTop: '#EF4444',
    shieldGradBottom: '#450A0A',
    wingsGradTop: '#F87171',
    wingsGradBottom: '#991B1B',
    bevelLight: '#FEE2E2',
    bevelDark: '#7F1D1D',
    centerBg: '#FEF2F2',
    centerText: '#7F1D1D',
    ringBorder: '#EF4444',
    glowColor: 'rgba(239, 68, 68, 0.7)',
    starColor: '#FECACA',
  },
  Amethyst: {
    primary: '#9333EA',
    secondary: '#7E22CE',
    accent: '#E9D5FF',
    shieldGradTop: '#9333EA',
    shieldGradBottom: '#3B0764',
    wingsGradTop: '#C084FC',
    wingsGradBottom: '#581C87',
    bevelLight: '#F3E8FF',
    bevelDark: '#4C1D95',
    centerBg: '#FAF5FF',
    centerText: '#3B0764',
    ringBorder: '#A855F7',
    glowColor: 'rgba(147, 51, 234, 0.7)',
    starColor: '#E9D5FF',
  },
  Diamond: {
    primary: '#38BDF8',
    secondary: '#0EA5E9',
    accent: '#FFFFFF',
    shieldGradTop: '#38BDF8',
    shieldGradBottom: '#082F49',
    wingsGradTop: '#BAE6FD',
    wingsGradBottom: '#0284C7',
    bevelLight: '#FFFFFF',
    bevelDark: '#0369A1',
    centerBg: '#F0F9FF',
    centerText: '#082F49',
    ringBorder: '#7DD3FC',
    glowColor: 'rgba(56, 189, 248, 0.75)',
    starColor: '#FFFFFF',
  },
  Master: {
    primary: '#F59E0B',
    secondary: '#7C3AED',
    accent: '#FEF08A',
    shieldGradTop: '#7C3AED',
    shieldGradBottom: '#2E1065',
    wingsGradTop: '#FBBF24',
    wingsGradBottom: '#B45309',
    bevelLight: '#FEF08A',
    bevelDark: '#4C1D95',
    centerBg: '#FFFDF0',
    centerText: '#3B0764',
    ringBorder: '#F59E0B',
    glowColor: 'rgba(245, 158, 11, 0.85)',
    starColor: '#FDE047',
  },
  Legend: {
    primary: '#FBBF24',
    secondary: '#9333EA',
    accent: '#FFFFFF',
    shieldGradTop: '#9333EA',
    shieldGradBottom: '#2E1065',
    wingsGradTop: '#FDE047',
    wingsGradBottom: '#B45309',
    bevelLight: '#FEF08A',
    bevelDark: '#78350F',
    centerBg: '#FFFDF0',
    centerText: '#4C1D95',
    ringBorder: '#FBBF24',
    glowColor: 'rgba(251, 191, 36, 0.95)',
    starColor: '#FEF08A',
  },
};

export const LevelBadgeIcon: React.FC<LevelBadgeIconProps> = ({
  level,
  size = 'md',
  className = '',
  showShadow = true,
}) => {
  const safeLvl = Math.max(0, Math.min(100, Math.floor(level || 0)));
  const tierGroup = getTierGroupForLevel(safeLvl);
  const theme = TIER_THEMES[tierGroup.name] || TIER_THEMES.Normal;

  // Size configurations
  const dimensions = {
    xs: { w: 22, h: 18, fontSize: 8.5, radius: 6 },
    sm: { w: 30, h: 24, fontSize: 10, radius: 7.5 },
    md: { w: 42, h: 34, fontSize: 13, radius: 9.5 },
    lg: { w: 60, h: 48, fontSize: 17, radius: 13 },
    hero: { w: 78, h: 62, fontSize: 21, radius: 16 },
  }[size];

  const idPrefix = `lvl-${safeLvl}-${size}`;
  const isMaster = safeLvl >= 90 && safeLvl <= 99;
  const isLegend = safeLvl === 100;

  // ViewBox:
  // Standard shields: 0 0 100 80
  // Legend grand wings: 0 0 130 84
  const viewBox = isLegend ? '0 0 130 84' : isMaster ? '0 0 100 86' : '0 0 100 80';
  const centerX = isLegend ? 65 : 50;
  const centerY = isLegend ? 46 : isMaster ? 49 : 42;

  return (
    <svg
      width={isLegend ? Math.round(dimensions.w * 1.3) : dimensions.w}
      height={dimensions.h}
      viewBox={viewBox}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`inline-block select-none overflow-visible ${
        showShadow ? 'drop-shadow-sm' : ''
      } ${className}`}
      style={{
        filter: showShadow ? `drop-shadow(0 2px 4px ${theme.glowColor})` : undefined,
      }}
    >
      <defs>
        {/* Shield Gradient */}
        <linearGradient id={`${idPrefix}-shield`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={theme.shieldGradTop} />
          <stop offset="100%" stopColor={theme.shieldGradBottom} />
        </linearGradient>

        {/* Wings Gradient */}
        <linearGradient id={`${idPrefix}-wings`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={theme.wingsGradTop} />
          <stop offset="100%" stopColor={theme.wingsGradBottom} />
        </linearGradient>

        {/* Metallic Bevel Gradient */}
        <linearGradient id={`${idPrefix}-bevel`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={theme.bevelLight} />
          <stop offset="50%" stopColor={theme.primary} />
          <stop offset="100%" stopColor={theme.bevelDark} />
        </linearGradient>

        {/* Crown Gold Gradient */}
        <linearGradient id={`${idPrefix}-crown`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FEF08A" />
          <stop offset="40%" stopColor="#F59E0B" />
          <stop offset="100%" stopColor="#78350F" />
        </linearGradient>
      </defs>

      {/* ========================================================
          1. WINGS & LAURELS
         ======================================================== */}
      {isLegend ? (
        // Grand Majestic Golden Wings for Level 100
        <g id="legend-wings">
          {/* Left Grand Wing */}
          <path
            d="M 65,50 C 45,50 30,42 16,30 C 10,24 4,14 2,6 C 10,12 20,20 34,24 C 20,16 12,8 9,2 C 18,8 28,16 42,20 C 30,12 24,6 20,0 C 32,5 45,14 55,24 Z"
            fill={`url(#${idPrefix}-wings)`}
            stroke={theme.bevelLight}
            strokeWidth="0.8"
          />
          {/* Right Grand Wing */}
          <path
            d="M 65,50 C 85,50 100,42 114,30 C 120,24 126,14 128,6 C 120,12 110,20 96,24 C 110,16 118,8 121,2 C 112,8 102,16 88,20 C 100,12 106,6 110,0 C 98,5 85,14 75,24 Z"
            fill={`url(#${idPrefix}-wings)`}
            stroke={theme.bevelLight}
            strokeWidth="0.8"
          />
          {/* Bottom Laurel Arc */}
          <path
            d="M 38,62 C 48,72 82,72 92,62"
            stroke={`url(#${idPrefix}-bevel)`}
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </g>
      ) : (
        // Standard Sculpted Wings for Tiers 0 to 99
        <g id="standard-wings">
          {/* Left Wing Flares */}
          <path
            d="M 45,45 C 32,45 22,38 12,28 C 7,23 3,15 1,8 C 7,13 15,20 26,24 C 16,17 10,10 7,5 C 14,10 23,17 34,21 C 28,15 22,9 18,3 C 27,8 36,15 44,23 Z"
            fill={`url(#${idPrefix}-wings)`}
            stroke={theme.bevelLight}
            strokeWidth="0.6"
          />
          {/* Right Wing Flares */}
          <path
            d="M 55,45 C 68,45 78,38 88,28 C 93,23 97,15 99,8 C 93,13 85,20 74,24 C 84,17 90,10 93,5 C 86,10 77,17 66,21 C 72,15 78,9 82,3 C 73,8 64,15 56,23 Z"
            fill={`url(#${idPrefix}-wings)`}
            stroke={theme.bevelLight}
            strokeWidth="0.6"
          />
        </g>
      )}

      {/* ========================================================
          2. MAIN SHIELD (OUTER BEVEL + INNER FACET)
         ======================================================== */}
      {/* Outer Metallic Beveled Shield */}
      <polygon
        points={
          isLegend
            ? '42,16 88,16 97,26 97,55 65,80 33,55 33,26'
            : isMaster
            ? '28,21 72,21 80,30 80,59 50,82 20,59 20,30'
            : '28,15 72,15 80,25 80,54 50,77 20,54 20,25'
        }
        fill={`url(#${idPrefix}-bevel)`}
        stroke={theme.bevelLight}
        strokeWidth="1.2"
        strokeLinejoin="round"
      />

      {/* Inner Faceted Shield Surface */}
      <polygon
        points={
          isLegend
            ? '45,19 85,19 93,28 93,53 65,76 37,53 37,28'
            : isMaster
            ? '31,24 69,24 76,32 76,56 50,78 24,56 24,32'
            : '31,18 69,18 76,27 76,51 50,73 24,51 24,27'
        }
        fill={`url(#${idPrefix}-shield)`}
      />

      {/* Glossy Upper Highlight Slice */}
      <polygon
        points={
          isLegend
            ? '45,19 85,19 91,26 65,40 39,26'
            : isMaster
            ? '31,24 69,24 74,30 50,44 26,30'
            : '31,18 69,18 74,25 50,39 26,25'
        }
        fill="white"
        opacity="0.22"
      />

      {/* ========================================================
          3. CROWN FOR MASTER (90-99) & LEGEND (100)
         ======================================================== */}
      {isMaster && (
        <g id="master-crown">
          <path
            d="M 36,22 L 40,11 L 46,16 L 50,7 L 54,16 L 60,11 L 64,22 Z"
            fill={`url(#${idPrefix}-crown)`}
            stroke="#FEF08A"
            strokeWidth="0.8"
            strokeLinejoin="round"
          />
          {/* Crown Jewels */}
          <circle cx="50" cy="9" r="1.5" fill="#EF4444" />
          <circle cx="40" cy="13" r="1.2" fill="#38BDF8" />
          <circle cx="60" cy="13" r="1.2" fill="#38BDF8" />
        </g>
      )}

      {isLegend && (
        <g id="legend-crown">
          {/* Triple Royal Golden Crown */}
          <path
            d="M 48,16 L 53,4 L 60,10 L 65,0 L 70,10 L 77,4 L 82,16 Z"
            fill={`url(#${idPrefix}-crown)`}
            stroke="#FFFFFF"
            strokeWidth="1"
            strokeLinejoin="round"
          />
          {/* Center Crown Ruby */}
          <circle cx="65" cy="4" r="2" fill="#EF4444" stroke="#FFF" strokeWidth="0.5" />
          <circle cx="54" cy="7" r="1.5" fill="#38BDF8" />
          <circle cx="76" cy="7" r="1.5" fill="#38BDF8" />
        </g>
      )}

      {/* ========================================================
          4. CENTER EMBLEM WITH LEVEL NUMBER
         ======================================================== */}
      {/* Outer Metallic Coin Ring */}
      <circle
        cx={centerX}
        cy={centerY}
        r={isLegend ? 18 : 16}
        fill={`url(#${idPrefix}-bevel)`}
        stroke={theme.bevelLight}
        strokeWidth="1"
      />

      {/* Inner Crisp White Center Disc */}
      <circle
        cx={centerX}
        cy={centerY}
        r={isLegend ? 15 : 13.5}
        fill={theme.centerBg}
        stroke={theme.ringBorder}
        strokeWidth="0.6"
      />

      {/* Crisp Level Number */}
      <text
        x={centerX}
        y={centerY + (safeLvl === 100 ? 0.5 : 0.8)}
        textAnchor="middle"
        dominantBaseline="central"
        fill={theme.centerText}
        fontSize={
          safeLvl === 100
            ? 12
            : safeLvl >= 10
            ? 15.5
            : 17
        }
        fontWeight="900"
        fontFamily="ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
        letterSpacing={safeLvl === 100 ? '-0.8px' : safeLvl >= 10 ? '-0.4px' : '0px'}
        style={{
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {safeLvl}
      </text>

      {/* ========================================================
          5. BOTTOM STAR / GEM ACCENT
         ======================================================== */}
      {isLegend ? (
        // Golden Diamond Pedestal
        <polygon
          points="65,77 71,83 65,88 59,83"
          fill="#FEF08A"
          stroke="#78350F"
          strokeWidth="0.8"
        />
      ) : (
        // 5-Point Mini Star at bottom V
        <g transform={`translate(${centerX - 4}, ${centerY + 29}) scale(0.8)`}>
          <polygon
            points="5,0 6.5,3.2 10,3.6 7.5,6.1 8.2,9.6 5,7.9 1.8,9.6 2.5,6.1 0,3.6 3.5,3.2"
            fill={theme.starColor}
            stroke={theme.bevelDark}
            strokeWidth="0.6"
          />
        </g>
      )}
    </svg>
  );
};
