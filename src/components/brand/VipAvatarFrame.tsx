import React from 'react';
import { Crown, Sparkles, Shield, Zap } from 'lucide-react';

export interface VipAvatarFrameProps {
  avatarUrl: string;
  vipTier: number; // 0 to 12
  customFrameId?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  showCrownBadge?: boolean;
  className?: string;
}

export interface VipTierConfig {
  tier: number;
  name: string;
  badgeTitle: string;
  colorName: string;
  borderGradient: string;
  glowShadow: string;
  crownColor: string;
  iconBg: string;
  description: string;
  requiredLevel: number; // Level 8, 16, 24, 32, 40, 48, 56, 64, 72, 80, 88, 96
  requiredCoins: number; // Exact cumulative coins target from CSV
  priceCoins: number; // Store purchase price
}

export const VIP_TIER_CONFIGS: VipTierConfig[] = [
  {
    tier: 1,
    name: 'Bronze Knight',
    badgeTitle: 'VIP 1 Bronze',
    colorName: 'Bronze',
    borderGradient: 'from-[#CD7F32] via-[#E2A76F] to-[#8C5523]',
    glowShadow: 'shadow-[0_0_15px_rgba(205,127,50,0.6)]',
    crownColor: '#CD7F32',
    iconBg: 'bg-[#CD7F32]/25',
    description: 'Unlocked at Level 8 (380,000 Coins). Bronze laurel ring with +5% room entry fanfare.',
    requiredLevel: 8,
    requiredCoins: 380000,
    priceCoins: 5000,
  },
  {
    tier: 2,
    name: 'Silver Guardian',
    badgeTitle: 'VIP 2 Silver',
    colorName: 'Silver',
    borderGradient: 'from-[#94A3B8] via-[#F1F5F9] to-[#64748B]',
    glowShadow: 'shadow-[0_0_16px_rgba(226,232,240,0.6)]',
    crownColor: '#E2E8F0',
    iconBg: 'bg-slate-400/25',
    description: 'Unlocked at Level 16 (1,400,000 Coins). Luminous silver chrome ring & lounge anti-kick privileges.',
    requiredLevel: 16,
    requiredCoins: 1400000,
    priceCoins: 12000,
  },
  {
    tier: 3,
    name: 'Royal Gold Champion',
    badgeTitle: 'VIP 3 Gold',
    colorName: 'Gold',
    borderGradient: 'from-[#F59E0B] via-[#FEF08A] to-[#D97706]',
    glowShadow: 'shadow-[0_0_18px_rgba(245,158,11,0.7)]',
    crownColor: '#F59E0B',
    iconBg: 'bg-amber-400/25',
    description: 'Unlocked at Level 24 (6,000,000 Coins). Golden winged solar halo, nameplate & live chat badge.',
    requiredLevel: 24,
    requiredCoins: 6000000,
    priceCoins: 25000,
  },
  {
    tier: 4,
    name: 'Platinum Luminary',
    badgeTitle: 'VIP 4 Platinum',
    colorName: 'Platinum',
    borderGradient: 'from-[#6366F1] via-[#C7D2FE] to-[#4338CA]',
    glowShadow: 'shadow-[0_0_20px_rgba(99,102,241,0.7)]',
    crownColor: '#A5B4FC',
    iconBg: 'bg-indigo-400/25',
    description: 'Unlocked at Level 32 (24,700,000 Coins). Platinum crystal border & custom chat bubble.',
    requiredLevel: 32,
    requiredCoins: 24700000,
    priceCoins: 45000,
  },
  {
    tier: 5,
    name: 'Sapphire Diamond',
    badgeTitle: 'VIP 5 Diamond',
    colorName: 'Sapphire',
    borderGradient: 'from-[#0284C7] via-[#7DD3FC] to-[#0369A1]',
    glowShadow: 'shadow-[0_0_22px_rgba(56,189,248,0.75)]',
    crownColor: '#38BDF8',
    iconBg: 'bg-sky-400/25',
    description: 'Unlocked at Level 40 (101,900,000 Coins). Sparkling blue diamond ring & special gift multiplier.',
    requiredLevel: 40,
    requiredCoins: 101900000,
    priceCoins: 75000,
  },
  {
    tier: 6,
    name: 'Amethyst Dragon',
    badgeTitle: 'VIP 6 Royal',
    colorName: 'Amethyst',
    borderGradient: 'from-[#7928CA] via-[#E879F9] to-[#9333EA]',
    glowShadow: 'shadow-[0_0_24px_rgba(168,85,247,0.8)]',
    crownColor: '#C084FC',
    iconBg: 'bg-purple-500/30',
    description: 'Unlocked at Level 48 (420,900,000 Coins). Royal purple aura, dragon emblem & priority room queue.',
    requiredLevel: 48,
    requiredCoins: 420900000,
    priceCoins: 120000,
  },
  {
    tier: 7,
    name: 'Crown Prince Nebula',
    badgeTitle: 'VIP 7 Nebula',
    colorName: 'Nebula',
    borderGradient: 'from-[#EC4899] via-[#FBCFE8] to-[#BE185D]',
    glowShadow: 'shadow-[0_0_26px_rgba(236,72,153,0.8)]',
    crownColor: '#F472B6',
    iconBg: 'bg-pink-500/30',
    description: 'Unlocked at Level 56 (693,000,000 Coins). Cosmic pink aura & luxury sports car entrance animation.',
    requiredLevel: 56,
    requiredCoins: 693000000,
    priceCoins: 180000,
  },
  {
    tier: 8,
    name: 'Imperial Phoenix',
    badgeTitle: 'VIP 8 Phoenix',
    colorName: 'Phoenix',
    borderGradient: 'from-[#EA580C] via-[#FED7AA] to-[#C2410C]',
    glowShadow: 'shadow-[0_0_28px_rgba(249,115,22,0.85)]',
    crownColor: '#FB923C',
    iconBg: 'bg-orange-500/30',
    description: 'Unlocked at Level 64 (841,000,000 Coins). Blazing fiery ring, phoenix badge & top room banner.',
    requiredLevel: 64,
    requiredCoins: 841000000,
    priceCoins: 250000,
  },
  {
    tier: 9,
    name: 'Solar Monarch',
    badgeTitle: 'VIP 9 Monarch',
    colorName: 'Solar',
    borderGradient: 'from-[#CA8A04] via-[#FEF08A] to-[#854D0E]',
    glowShadow: 'shadow-[0_0_30px_rgba(250,204,21,0.9)]',
    crownColor: '#FACC15',
    iconBg: 'bg-yellow-500/30',
    description: 'Unlocked at Level 72 (1,019,000,000 Coins). Radiant sun flare ring & exclusive private broadcast lounge.',
    requiredLevel: 72,
    requiredCoins: 1019000000,
    priceCoins: 350000,
  },
  {
    tier: 10,
    name: 'Sovereign Galaxy',
    badgeTitle: 'VIP 10 Sovereign',
    colorName: 'Galaxy',
    borderGradient: 'from-[#4F46E5] via-[#A5B4FC] to-[#312E81]',
    glowShadow: 'shadow-[0_0_32px_rgba(99,102,241,0.9)]',
    crownColor: '#818CF8',
    iconBg: 'bg-indigo-600/35',
    description: 'Unlocked at Level 80 (1,236,000,000 Coins). Deep space galaxy rotation & 24/7 dedicated account manager.',
    requiredLevel: 80,
    requiredCoins: 1236000000,
    priceCoins: 500000,
  },
  {
    tier: 11,
    name: 'Celestial Overlord',
    badgeTitle: 'VIP 11 Overlord',
    colorName: 'Celestial',
    borderGradient: 'from-[#E11D48] via-[#FECDD3] to-[#881337]',
    glowShadow: 'shadow-[0_0_35px_rgba(244,63,94,0.95)]',
    crownColor: '#FB7185',
    iconBg: 'bg-rose-600/35',
    description: 'Unlocked at Level 88 (1,498,000,000 Coins). Ruby crimson corona & server-wide live entrance fanfare.',
    requiredLevel: 88,
    requiredCoins: 1498000000,
    priceCoins: 750000,
  },
  {
    tier: 12,
    name: 'Alpha Emperor Crown',
    badgeTitle: 'VIP 12 Emperor',
    colorName: 'Emperor Gold & Purple',
    borderGradient: 'from-[#FACC15] via-[#EC4899] to-[#7928CA]',
    glowShadow: 'shadow-[0_0_40px_rgba(250,204,21,1)]',
    crownColor: '#FDE047',
    iconBg: 'bg-gradient-to-tr from-amber-400 to-purple-600',
    description: 'Unlocked at Level 96+ (1,816,000,000 Coins). Grand Supreme Emperor Crown, Golden Yacht entrance & supreme emblem!',
    requiredLevel: 96,
    requiredCoins: 1816000000,
    priceCoins: 1000000,
  },
];

export const VipAvatarFrame: React.FC<VipAvatarFrameProps> = ({
  avatarUrl,
  vipTier,
  size = 'md',
  showCrownBadge = true,
  className = '',
}) => {
  const tierConfig = VIP_TIER_CONFIGS.find((c) => c.tier === vipTier) || null;

  const sizeStyles = {
    xs: {
      container: 'w-7 h-7',
      padding: 'p-[1.5px]',
      crown: 'w-2 h-2',
      crownBox: 'w-3 h-3 -bottom-1 -right-0.5',
    },
    sm: {
      container: 'w-9 h-9',
      padding: 'p-[2px]',
      crown: 'w-2.5 h-2.5',
      crownBox: 'w-4 h-4 -bottom-1 -right-1',
    },
    md: {
      container: 'w-12 h-12',
      padding: 'p-[2.5px]',
      crown: 'w-3 h-3',
      crownBox: 'w-4.5 h-4.5 -bottom-1 -right-1',
    },
    lg: {
      container: 'w-16 h-16',
      padding: 'p-[3px]',
      crown: 'w-3.5 h-3.5',
      crownBox: 'w-5 h-5 -bottom-1 -right-1',
    },
    xl: {
      container: 'w-22 h-22 sm:w-24 sm:h-24',
      padding: 'p-[3.5px]',
      crown: 'w-4 h-4',
      crownBox: 'w-6 h-6 -bottom-1.5 -right-1.5',
    },
  }[size];

  if (!tierConfig || vipTier === 0) {
    return (
      <div className={`relative ${sizeStyles.container} ${className}`}>
        <img
          src={avatarUrl}
          alt="Avatar"
          className="w-full h-full rounded-full object-cover bg-zinc-900 border border-white/10"
        />
      </div>
    );
  }

  return (
    <div className={`relative ${sizeStyles.container} ${className} group`}>
      {/* Animated SVGA Rotating Aura Shimmer Ring */}
      <div
        className={`absolute -inset-[2px] rounded-full bg-gradient-to-r ${tierConfig.borderGradient} opacity-70 blur-[3px] animate-spin-slow`}
      />

      {/* Primary Glowing SVGA VIP Halo Ring */}
      <div
        className={`relative w-full h-full rounded-full ${sizeStyles.padding} bg-gradient-to-tr ${tierConfig.borderGradient} ${tierConfig.glowShadow} transition-transform`}
      >
        <img
          src={avatarUrl}
          alt="Avatar"
          className="w-full h-full rounded-full object-cover bg-zinc-950"
        />
      </div>

      {/* VIP Crown Level Mini-Badge */}
      {showCrownBadge && (
        <div
          className={`absolute ${sizeStyles.crownBox} rounded-full bg-gradient-to-tr from-amber-500 to-amber-300 border border-black flex items-center justify-center text-black shadow-md z-10`}
          title={`VIP ${vipTier} - ${tierConfig.name}`}
        >
          <Crown className={`${sizeStyles.crown} fill-black stroke-black`} />
        </div>
      )}
    </div>
  );
};
