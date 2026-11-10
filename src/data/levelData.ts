export interface LevelConfig {
  level: number;
  totalCumulativeCoins: number;
  additionalCoins: number;
  tier:
    | 'Normal'
    | 'Bronze'
    | 'Silver'
    | 'Gold'
    | 'Platinum'
    | 'Sapphire'
    | 'Emerald'
    | 'Ruby'
    | 'Amethyst'
    | 'Diamond'
    | 'Master'
    | 'Legend';
  tierGroup: number; // 0 to 11
  tierName: string;
  tierBadge: string;
  tierColor: string;
  gradientBg: string;
  borderColor: string;
  unlockedVipTier?: number;
}

export interface LevelTierGroup {
  tierGroup: number;
  name: string;
  tagline: string;
  minLevel: number;
  maxLevel: number;
  badge: string;
  color: string;
  gradientBg: string;
  borderColor: string;
  perks: string;
}

/**
 * 12 Distinct Official Level Tier Groups (Levels 0 to 100):
 * - Level 0: Normal (Grey)
 * - Levels 1-9: Bronze (Bronze)
 * - Levels 10-19: Silver (Silver)
 * - Levels 20-29: Gold (Gold)
 * - Levels 30-39: Platinum (Platinum)
 * - Levels 40-49: Sapphire (Blue)
 * - Levels 50-59: Emerald (Green)
 * - Levels 60-69: Ruby (Red)
 * - Levels 70-79: Amethyst (Purple)
 * - Levels 80-89: Diamond (Ice Blue)
 * - Levels 90-99: Master (Gold + Purple)
 * - Level 100: Legend (Royal Gold + Purple)
 */
export const LEVEL_TIER_GROUPS: LevelTierGroup[] = [
  {
    tierGroup: 0,
    name: 'Normal',
    tagline: 'Standard Tier',
    minLevel: 0,
    maxLevel: 0,
    badge: '🛡️',
    color: '#94A3B8',
    gradientBg: 'from-[#334155] via-[#475569] to-[#1E293B]',
    borderColor: 'border-slate-500/50',
    perks: 'Default free lounge guest seat. Reach 50,000 coins spent to unlock Level 1 Bronze!',
  },
  {
    tierGroup: 1,
    name: 'Bronze',
    tagline: 'Bronze Elite',
    minLevel: 1,
    maxLevel: 9,
    badge: '🥉',
    color: '#CD7F32',
    gradientBg: 'from-[#8C5523] via-[#B46A34] to-[#593311]',
    borderColor: 'border-[#CD7F32]/80',
    perks: 'Bronze badge & chat nameplate. Unlocks VIP 1 at Level 8.',
  },
  {
    tierGroup: 2,
    name: 'Silver',
    tagline: 'Silver Knight',
    minLevel: 10,
    maxLevel: 19,
    badge: '🥈',
    color: '#E2E8F0',
    gradientBg: 'from-[#475569] via-[#94A3B8] to-[#334155]',
    borderColor: 'border-slate-200/90',
    perks: 'Silver metallic badge with laurels. VIP 2 at Lv.16.',
  },
  {
    tierGroup: 3,
    name: 'Gold',
    tagline: 'Golden Crown',
    minLevel: 20,
    maxLevel: 29,
    badge: '🥇',
    color: '#F59E0B',
    gradientBg: 'from-[#B45309] via-[#F59E0B] to-[#78350F]',
    borderColor: 'border-amber-300',
    perks: 'Radiant 24K gold winged badge. VIP 3 at Lv.24.',
  },
  {
    tierGroup: 4,
    name: 'Platinum',
    tagline: 'Platinum Sovereign',
    minLevel: 30,
    maxLevel: 39,
    badge: '💠',
    color: '#38BDF8',
    gradientBg: 'from-[#0369A1] via-[#0284C7] to-[#0C4A6E]',
    borderColor: 'border-sky-400',
    perks: 'Platinum crystal wings, VIP 4 at Lv.32.',
  },
  {
    tierGroup: 5,
    name: 'Sapphire',
    tagline: 'Sapphire Lord',
    minLevel: 40,
    maxLevel: 49,
    badge: '🔷',
    color: '#2563EB',
    gradientBg: 'from-[#1E3A8A] via-[#2563EB] to-[#172554]',
    borderColor: 'border-blue-400',
    perks: 'Royal blue sapphire faceted badge, VIP 5 at Lv.40 & VIP 6 at Lv.48.',
  },
  {
    tierGroup: 6,
    name: 'Emerald',
    tagline: 'Emerald Knight',
    minLevel: 50,
    maxLevel: 59,
    badge: '🟢',
    color: '#10B981',
    gradientBg: 'from-[#065F46] via-[#10B981] to-[#064E3B]',
    borderColor: 'border-emerald-300',
    perks: 'Vivid emerald green wings, VIP 7 at Lv.56.',
  },
  {
    tierGroup: 7,
    name: 'Ruby',
    tagline: 'Ruby Champion',
    minLevel: 60,
    maxLevel: 69,
    badge: '🔴',
    color: '#EF4444',
    gradientBg: 'from-[#991B1B] via-[#EF4444] to-[#7F1D1D]',
    borderColor: 'border-red-400',
    perks: 'Crimson ruby flame wings, VIP 8 at Lv.64.',
  },
  {
    tierGroup: 8,
    name: 'Amethyst',
    tagline: 'Amethyst Royal',
    minLevel: 70,
    maxLevel: 79,
    badge: '🔮',
    color: '#A855F7',
    gradientBg: 'from-[#581C87] via-[#9333EA] to-[#3B0764]',
    borderColor: 'border-purple-400',
    perks: 'Radiant amethyst violet crystal badge, VIP 9 at Lv.72.',
  },
  {
    tierGroup: 9,
    name: 'Diamond',
    tagline: 'Diamond Legend',
    minLevel: 80,
    maxLevel: 89,
    badge: '💎',
    color: '#67E8F9',
    gradientBg: 'from-[#0E7490] via-[#06B6D4] to-[#164E63]',
    borderColor: 'border-cyan-300',
    perks: 'Ice-blue diamond cut wings, VIP 10 at Lv.80 & VIP 11 at Lv.88.',
  },
  {
    tierGroup: 10,
    name: 'Master',
    tagline: 'Grand Master',
    minLevel: 90,
    maxLevel: 99,
    badge: '👑',
    color: '#F59E0B',
    gradientBg: 'from-[#581C87] via-[#A855F7] to-[#F59E0B]',
    borderColor: 'border-amber-300',
    perks: 'Imperial purple crowned master wings, VIP 12 at Lv.96.',
  },
  {
    tierGroup: 11,
    name: 'Legend',
    tagline: 'Ultimate Legend',
    minLevel: 100,
    maxLevel: 100,
    badge: '✨',
    color: '#EAB308',
    gradientBg: 'from-[#4C0519] via-[#A855F7] to-[#F59E0B]',
    borderColor: 'border-yellow-300',
    perks: 'Supreme Level 100 Legend badge with grand golden wings and triple crown.',
  },
];

// Helper to determine tier from exact level matching the chart:
export const getTierGroupForLevel = (lvl: number): LevelTierGroup => {
  if (lvl <= 0) return LEVEL_TIER_GROUPS[0]; // Normal
  if (lvl <= 9) return LEVEL_TIER_GROUPS[1]; // Bronze (1-9)
  if (lvl <= 19) return LEVEL_TIER_GROUPS[2]; // Silver (10-19)
  if (lvl <= 29) return LEVEL_TIER_GROUPS[3]; // Gold (20-29)
  if (lvl <= 39) return LEVEL_TIER_GROUPS[4]; // Platinum (30-39)
  if (lvl <= 49) return LEVEL_TIER_GROUPS[5]; // Sapphire (40-49)
  if (lvl <= 59) return LEVEL_TIER_GROUPS[6]; // Emerald (50-59)
  if (lvl <= 69) return LEVEL_TIER_GROUPS[7]; // Ruby (60-69)
  if (lvl <= 79) return LEVEL_TIER_GROUPS[8]; // Amethyst (70-79)
  if (lvl <= 89) return LEVEL_TIER_GROUPS[9]; // Diamond (80-89)
  if (lvl <= 99) return LEVEL_TIER_GROUPS[10]; // Master (90-99)
  return LEVEL_TIER_GROUPS[11]; // Legend (100)
};

// Check if a level unlocks a VIP tier (Every 8 levels: 8, 16, 24, 32, 40, 48, 56, 64, 72, 80, 88, 96)
export const getUnlockedVip = (lvl: number): number | undefined => {
  if (lvl > 0 && lvl % 8 === 0 && lvl <= 96) {
    return lvl / 8;
  }
  return undefined;
};

// Complete Level 0 to 100 Dataset
const RAW_LEVEL_0_TO_100: [number, number, number][] = [
  [0, 0, 0], // Starting level: 0 coins
  [1, 50000, 50000], // Level 1 unlocks after spending first 50,000 coins
  [2, 80000, 30000],
  [3, 130000, 50000],
  [4, 180000, 50000],
  [5, 230000, 50000],
  [6, 280000, 50000],
  [7, 330000, 50000],
  [8, 380000, 50000],
  [9, 440000, 60000],
  // 10: Tier Change to Bronze
  [10, 500000, 60000],
  [11, 600000, 100000],
  [12, 700000, 100000],
  [13, 900000, 200000],
  [14, 1000000, 100000],
  [15, 1200000, 200000],
  [16, 1400000, 200000],
  [17, 1700000, 300000],
  [18, 2100000, 400000],
  [19, 2500000, 400000],
  // 20: Tier Change to Silver
  [20, 2900000, 400000],
  [21, 3500000, 600000],
  [22, 4200000, 700000],
  [23, 5000000, 800000],
  [24, 6000000, 1000000],
  [25, 7100000, 1100000],
  [26, 8500000, 1400000],
  [27, 10200000, 1700000],
  [28, 12200000, 2000000],
  [29, 14500000, 2300000],
  // 30: Tier Change to Gold
  [30, 17300000, 2800000],
  [31, 20700000, 3400000],
  [32, 24700000, 4000000],
  [33, 29500000, 4800000],
  [34, 35200000, 5700000],
  [35, 42000000, 6800000],
  [36, 50200000, 8200000],
  [37, 59900000, 9700000],
  [38, 71500000, 11600000],
  [39, 85400000, 13900000],
  // 40: Tier Change to Rose Gold
  [40, 101900000, 16500000],
  [41, 121700000, 19800000],
  [42, 145300000, 23600000],
  [43, 173500000, 28200000],
  [44, 207100000, 33600000],
  [45, 247300000, 40200000],
  [46, 295300000, 48000000],
  [47, 352500000, 57200000],
  [48, 420900000, 68400000],
  [49, 502500000, 81600000],
  // 50: Tier Change to Imperial Purple
  [50, 600000000, 97500000],
  [51, 615000000, 15000000],
  [52, 630000000, 15000000],
  [53, 645000000, 15000000],
  [54, 661000000, 16000000],
  [55, 677000000, 16000000],
  [56, 693000000, 16000000],
  [57, 710000000, 17000000],
  [58, 727000000, 17000000],
  [59, 745000000, 18000000],
  // 60: Tier Change to Sapphire
  [60, 763000000, 18000000],
  [61, 782000000, 19000000],
  [62, 801000000, 19000000],
  [63, 821000000, 20000000],
  [64, 841000000, 20000000],
  [65, 861000000, 20000000],
  [66, 882000000, 21000000],
  [67, 904000000, 22000000],
  [68, 926000000, 22000000],
  [69, 948000000, 22000000],
  // 70: Tier Change to Emerald
  [70, 971000000, 23000000],
  [71, 995000000, 24000000],
  [72, 1019000000, 24000000],
  [73, 1044000000, 25000000],
  [74, 1069000000, 25000000],
  [75, 1095000000, 26000000],
  [76, 1122000000, 27000000],
  [77, 1149000000, 27000000],
  [78, 1178000000, 29000000],
  [79, 1206000000, 28000000],
  // 80: Tier Change to Ruby
  [80, 1236000000, 30000000],
  [81, 1266000000, 30000000],
  [82, 1297000000, 31000000],
  [83, 1328000000, 31000000],
  [84, 1361000000, 33000000],
  [85, 1394000000, 33000000],
  [86, 1428000000, 34000000],
  [87, 1462000000, 34000000],
  [88, 1498000000, 36000000],
  [89, 1535000000, 37000000],
  // 90: Tier Change to Supreme Emperor
  [90, 1572000000, 37000000],
  [91, 1610000000, 38000000],
  [92, 1650000000, 40000000],
  [93, 1690000000, 40000000],
  [94, 1731000000, 41000000],
  [95, 1773000000, 42000000],
  [96, 1816000000, 43000000],
  [97, 1861000000, 45000000],
  [98, 1906000000, 45000000],
  [99, 1952000000, 46000000],
  [100, 2000000000, 48000000],
];

export const ALL_LEVELS_0_TO_100: LevelConfig[] = RAW_LEVEL_0_TO_100.map(
  ([level, totalCumulativeCoins, additionalCoins]) => {
    const tierGroup = getTierGroupForLevel(level);
    return {
      level,
      totalCumulativeCoins,
      additionalCoins,
      tier: tierGroup.name as LevelConfig['tier'],
      tierGroup: tierGroup.tierGroup,
      tierName: tierGroup.name,
      tierBadge: tierGroup.badge,
      tierColor: tierGroup.color,
      gradientBg: tierGroup.gradientBg,
      borderColor: tierGroup.borderColor,
      unlockedVipTier: getUnlockedVip(level),
    };
  }
);

// Backward-compatible alias
export const ALL_LEVELS_1_TO_100 = ALL_LEVELS_0_TO_100;

// Format large numbers into human-readable compact labels (e.g. 50K, 1.4M, 2B)
export const formatCoinsCompact = (coins: number): string => {
  if (coins >= 1000000000) {
    return `${(coins / 1000000000).toFixed(coins % 1000000000 === 0 ? 0 : 2)}B`;
  }
  if (coins >= 1000000) {
    return `${(coins / 1000000).toFixed(coins % 1000000 === 0 ? 0 : 1)}M`;
  }
  if (coins >= 1000) {
    return `${(coins / 1000).toFixed(0)}K`;
  }
  return coins.toLocaleString();
};

// Retrieve config for a given level (0 to 100)
export const getLevelConfig = (lvl: number): LevelConfig => {
  const safeLvl = Math.max(0, Math.min(100, Math.floor(lvl || 0)));
  return ALL_LEVELS_0_TO_100[safeLvl];
};

// Next level config
export const getNextLevelConfig = (currentLvl: number): LevelConfig | null => {
  if (currentLvl >= 100) return null;
  return ALL_LEVELS_0_TO_100[Math.max(0, currentLvl) + 1];
};

// Information regarding the next VIP tier unlock
export const getNextVipUnlockInfo = (currentLevel: number, totalCoins: number = 0) => {
  const currentVipTier = Math.min(12, Math.floor(currentLevel / 8));
  const nextVipTier = currentVipTier < 12 ? currentVipTier + 1 : 12;
  const targetLevel = nextVipTier * 8;

  if (targetLevel > 96 || currentVipTier >= 12) {
    return {
      currentVipTier: 12,
      nextVipTier: 12,
      targetLevel: 96,
      requiredCoins: ALL_LEVELS_0_TO_100[96].totalCumulativeCoins,
      levelsRemaining: 0,
      coinsRemaining: 0,
      isMaxVip: true,
    };
  }

  const targetLevelConfig = ALL_LEVELS_0_TO_100[targetLevel];
  const requiredCoins = targetLevelConfig.totalCumulativeCoins;
  const currentLevelConfig = ALL_LEVELS_0_TO_100[Math.max(0, currentLevel)];
  const estimatedUserCoins = Math.max(totalCoins, currentLevelConfig.totalCumulativeCoins);
  const coinsRemaining = Math.max(0, requiredCoins - estimatedUserCoins);
  const levelsRemaining = Math.max(0, targetLevel - currentLevel);

  return {
    currentVipTier,
    nextVipTier,
    targetLevel,
    requiredCoins,
    levelsRemaining,
    coinsRemaining,
    isMaxVip: false,
  };
};
