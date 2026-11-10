import React from 'react';
import { Crown, Sparkles, Zap, Shield, Flame, Star, Trophy, Award, Diamond } from 'lucide-react';

export interface LevelTierMeta {
  tierGroup: number; // 1 to 10
  name: string;
  minLevel: number;
  maxLevel: number;
  badgeSymbol: string;
  gradientBg: string;
  borderColor: string;
  glowShadow: string;
  textColor: string;
  icon: any;
  shapeStyle: string; // Tailored badge geometric silhouette
  starsCount: number;
  bannerText: string;
}

/**
 * 10 Distinct Level Badge Tiers for Levels 1 to 100:
 * Every 10 levels the badge shape, tier color, ornamentations, and jewels enhance progressively.
 */
import { LevelBadgeIcon } from './LevelBadgeIcon';
import { getTierGroupForLevel } from '../../data/levelData';

export const LEVEL_100_TIERS: LevelTierMeta[] = [
  {
    tierGroup: 0,
    name: 'Normal',
    minLevel: 0,
    maxLevel: 0,
    badgeSymbol: '🛡️',
    gradientBg: 'from-[#1E293B] via-[#334155] to-[#0F172A]',
    borderColor: 'border-slate-500/40',
    glowShadow: 'shadow-[0_0_10px_rgba(100,116,139,0.3)]',
    textColor: 'text-slate-300',
    icon: Shield,
    shapeStyle: 'rounded-xl',
    starsCount: 1,
    bannerText: 'NORMAL',
  },
  {
    tierGroup: 1,
    name: 'Bronze',
    minLevel: 1,
    maxLevel: 9,
    badgeSymbol: '🥉',
    gradientBg: 'from-[#8C5523] via-[#B46A34] to-[#593311]',
    borderColor: 'border-[#CD7F32]/80',
    glowShadow: 'shadow-[0_0_15px_rgba(205,127,50,0.45)]',
    textColor: 'text-amber-200',
    icon: Award,
    shapeStyle: 'rounded-xl',
    starsCount: 2,
    bannerText: 'BRONZE',
  },
  {
    tierGroup: 2,
    name: 'Silver',
    minLevel: 10,
    maxLevel: 19,
    badgeSymbol: '🥈',
    gradientBg: 'from-[#475569] via-[#94A3B8] to-[#334155]',
    borderColor: 'border-slate-200/90',
    glowShadow: 'shadow-[0_0_18px_rgba(226,232,240,0.55)]',
    textColor: 'text-white',
    icon: Star,
    shapeStyle: 'rounded-xl',
    starsCount: 3,
    bannerText: 'SILVER',
  },
  {
    tierGroup: 3,
    name: 'Gold',
    minLevel: 20,
    maxLevel: 29,
    badgeSymbol: '🥇',
    gradientBg: 'from-[#B45309] via-[#F59E0B] to-[#78350F]',
    borderColor: 'border-amber-300',
    glowShadow: 'shadow-[0_0_20px_rgba(245,158,11,0.6)]',
    textColor: 'text-yellow-100',
    icon: Trophy,
    shapeStyle: 'rounded-xl',
    starsCount: 4,
    bannerText: 'GOLD',
  },
  {
    tierGroup: 4,
    name: 'Platinum',
    minLevel: 30,
    maxLevel: 39,
    badgeSymbol: '💠',
    gradientBg: 'from-[#0369A1] via-[#0284C7] to-[#0C4A6E]',
    borderColor: 'border-sky-400',
    glowShadow: 'shadow-[0_0_22px_rgba(56,189,248,0.6)]',
    textColor: 'text-sky-100',
    icon: Diamond,
    shapeStyle: 'rounded-xl',
    starsCount: 5,
    bannerText: 'PLATINUM',
  },
  {
    tierGroup: 5,
    name: 'Sapphire',
    minLevel: 40,
    maxLevel: 49,
    badgeSymbol: '🔷',
    gradientBg: 'from-[#1E3A8A] via-[#2563EB] to-[#172554]',
    borderColor: 'border-blue-400',
    glowShadow: 'shadow-[0_0_24px_rgba(59,130,246,0.7)]',
    textColor: 'text-blue-100',
    icon: Diamond,
    shapeStyle: 'rounded-xl',
    starsCount: 6,
    bannerText: 'SAPPHIRE',
  },
  {
    tierGroup: 6,
    name: 'Emerald',
    minLevel: 50,
    maxLevel: 59,
    badgeSymbol: '🟢',
    gradientBg: 'from-[#065F46] via-[#10B981] to-[#064E3B]',
    borderColor: 'border-emerald-300',
    glowShadow: 'shadow-[0_0_25px_rgba(16,185,129,0.7)]',
    textColor: 'text-emerald-100',
    icon: Flame,
    shapeStyle: 'rounded-xl',
    starsCount: 7,
    bannerText: 'EMERALD',
  },
  {
    tierGroup: 7,
    name: 'Ruby',
    minLevel: 60,
    maxLevel: 69,
    badgeSymbol: '🔴',
    gradientBg: 'from-[#991B1B] via-[#EF4444] to-[#7F1D1D]',
    borderColor: 'border-red-400',
    glowShadow: 'shadow-[0_0_28px_rgba(239,68,68,0.75)]',
    textColor: 'text-red-100',
    icon: Sparkles,
    shapeStyle: 'rounded-xl',
    starsCount: 8,
    bannerText: 'RUBY',
  },
  {
    tierGroup: 8,
    name: 'Amethyst',
    minLevel: 70,
    maxLevel: 79,
    badgeSymbol: '🔮',
    gradientBg: 'from-[#581C87] via-[#9333EA] to-[#3B0764]',
    borderColor: 'border-purple-400',
    glowShadow: 'shadow-[0_0_28px_rgba(168,85,247,0.75)]',
    textColor: 'text-purple-100',
    icon: Sparkles,
    shapeStyle: 'rounded-xl',
    starsCount: 8,
    bannerText: 'AMETHYST',
  },
  {
    tierGroup: 9,
    name: 'Diamond',
    minLevel: 80,
    maxLevel: 89,
    badgeSymbol: '💎',
    gradientBg: 'from-[#0E7490] via-[#06B6D4] to-[#164E63]',
    borderColor: 'border-cyan-300',
    glowShadow: 'shadow-[0_0_30px_rgba(6,182,212,0.8)]',
    textColor: 'text-cyan-100',
    icon: Diamond,
    shapeStyle: 'rounded-xl',
    starsCount: 9,
    bannerText: 'DIAMOND',
  },
  {
    tierGroup: 10,
    name: 'Master',
    minLevel: 90,
    maxLevel: 99,
    badgeSymbol: '👑',
    gradientBg: 'from-[#581C87] via-[#A855F7] to-[#F59E0B]',
    borderColor: 'border-amber-300',
    glowShadow: 'shadow-[0_0_35px_rgba(245,158,11,0.85)]',
    textColor: 'text-yellow-200',
    icon: Crown,
    shapeStyle: 'rounded-xl',
    starsCount: 9,
    bannerText: 'MASTER',
  },
  {
    tierGroup: 11,
    name: 'Legend',
    minLevel: 100,
    maxLevel: 100,
    badgeSymbol: '✨',
    gradientBg: 'from-[#4C0519] via-[#A855F7] to-[#F59E0B]',
    borderColor: 'border-yellow-300',
    glowShadow: 'shadow-[0_0_40px_rgba(251,191,36,0.95)]',
    textColor: 'text-yellow-200',
    icon: Crown,
    shapeStyle: 'rounded-xl',
    starsCount: 10,
    bannerText: 'LEGEND',
  },
];

export const getLevelTierMeta = (level: number): LevelTierMeta => {
  const safeLvl = Math.max(0, Math.min(100, Math.floor(level || 0)));
  if (safeLvl === 0) return LEVEL_100_TIERS[0];
  if (safeLvl <= 9) return LEVEL_100_TIERS[1];
  if (safeLvl <= 19) return LEVEL_100_TIERS[2];
  if (safeLvl <= 29) return LEVEL_100_TIERS[3];
  if (safeLvl <= 39) return LEVEL_100_TIERS[4];
  if (safeLvl <= 49) return LEVEL_100_TIERS[5];
  if (safeLvl <= 59) return LEVEL_100_TIERS[6];
  if (safeLvl <= 69) return LEVEL_100_TIERS[7];
  if (safeLvl <= 79) return LEVEL_100_TIERS[8];
  if (safeLvl <= 89) return LEVEL_100_TIERS[9];
  if (safeLvl <= 99) return LEVEL_100_TIERS[10];
  return LEVEL_100_TIERS[11];
};

interface LevelBadgeTagProps {
  level: number;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'tag' | 'hero' | 'icon';
  className?: string;
  onClick?: () => void;
  showText?: boolean;
}

export const LevelBadgeTag: React.FC<LevelBadgeTagProps> = ({
  level,
  size = 'hero',
  className = '',
  onClick,
  showText = true,
}) => {
  const safeLvl = Math.max(0, Math.min(100, Math.floor(level || 0)));
  const tier = getLevelTierMeta(safeLvl);

  // Standalone Icon only
  if (size === 'icon') {
    return (
      <div
        onClick={onClick}
        className={`inline-flex items-center justify-center cursor-pointer active:scale-95 transition-transform ${className}`}
        title={`Level ${safeLvl} • ${tier.name}`}
      >
        <LevelBadgeIcon level={safeLvl} size="sm" />
      </div>
    );
  }

  // Micro size for chat messages & in-stream notifications
  if (size === 'xs' || size === 'sm') {
    return (
      <div
        onClick={onClick}
        className={`inline-flex items-center gap-1 cursor-pointer select-none active:scale-95 transition-transform ${className}`}
        title={`Level ${safeLvl} • ${tier.name}`}
      >
        <LevelBadgeIcon level={safeLvl} size={size} />
      </div>
    );
  }

  // Prominent Hero Badge for Profile Card (occupies the open space nicely without being an expanded long bar)
  if (size === 'hero') {
    return (
      <div
        onClick={onClick}
        className={`relative inline-flex items-center gap-2.5 p-1.5 pr-3 rounded-2xl bg-black/40 border border-white/10 hover:border-amber-400/40 shadow-lg cursor-pointer active:scale-95 transition-all select-none group ${className}`}
        title={`Level ${safeLvl} • ${tier.name} Tier Badge (Tap to view 0-100 roadmap)`}
      >
        {/* The Exact Chart Visual Badge (Icon Size LG) */}
        <div className="relative shrink-0 transition-transform duration-300 group-hover:scale-105">
          <LevelBadgeIcon level={safeLvl} size="lg" />
        </div>

        {/* Level & Tier Typography Beside Badge */}
        {showText && (
          <div className="flex flex-col text-left leading-tight pr-1">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-black text-white tracking-wide drop-shadow">
                Level {safeLvl}
              </span>
              <span
                className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md text-amber-300 bg-amber-400/15 border border-amber-400/30 shadow-xs"
              >
                {tier.bannerText}
              </span>
            </div>
            <span className="text-[10px] text-zinc-300 font-medium mt-0.5">
              {tier.name} Insignia →
            </span>
          </div>
        )}
      </div>
    );
  }

  // Medium / Tag variant
  return (
    <div
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-xl bg-black/40 border border-white/10 hover:border-white/20 shadow-md cursor-pointer active:scale-95 transition-all select-none group ${className}`}
      title={`Level ${safeLvl} • ${tier.name}`}
    >
      <LevelBadgeIcon level={safeLvl} size="md" />
      {showText && (
        <div className="flex items-center gap-1">
          <span className="text-xs font-black text-white">Lv.{safeLvl}</span>
          <span className="text-[9px] font-bold text-amber-300 uppercase">
            {tier.bannerText}
          </span>
        </div>
      )}
    </div>
  );
};
