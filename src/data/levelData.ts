export interface LevelConfig {
  level: number;
  totalCumulativeCoins: number;
  additionalCoins: number;
  tier: 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'Diamond' | 'Master';
  tierBadge: string;
  tierColor: string;
  unlockedVipTier?: number;
}

export interface LevelTierGroup {
  name: string;
  urduName: string;
  minLevel: number;
  maxLevel: number;
  badge: string;
  color: string;
  borderGradient: string;
  perks: string;
}

export const LEVEL_TIER_GROUPS: LevelTierGroup[] = [
  {
    name: 'Bronze Guardian',
    urduName: 'برونز',
    minLevel: 1,
    maxLevel: 10,
    badge: '🥉',
    color: 'from-[#CD7F32] to-[#8C5523]',
    borderGradient: 'from-[#CD7F32] via-[#D4976A] to-[#8C5523]',
    perks: 'Basic chat flair, standard room entry. Unlocks VIP 1 at Level 8.',
  },
  {
    name: 'Silver Vanguard',
    urduName: 'سلور',
    minLevel: 11,
    maxLevel: 25,
    badge: '🥈',
    color: 'from-[#94A3B8] to-[#475569]',
    borderGradient: 'from-[#94A3B8] via-[#E2E8F0] to-[#64748B]',
    perks: 'Custom nickname color, anti-kick in normal lounges. Unlocks VIP 2 at Lv.16 & VIP 3 at Lv.24.',
  },
  {
    name: 'Royal Gold Sovereign',
    urduName: 'گولڈ',
    minLevel: 26,
    maxLevel: 45,
    badge: '🥇',
    color: 'from-[#F59E0B] to-[#B45309]',
    borderGradient: 'from-[#F59E0B] via-[#FDE047] to-[#D97706]',
    perks: 'Screen takeover effects, VIP 4 at Lv.32 & VIP 5 at Lv.40.',
  },
  {
    name: 'Platinum Luminary',
    urduName: 'پلاٹینم',
    minLevel: 46,
    maxLevel: 65,
    badge: '💎',
    color: 'from-[#6366F1] to-[#3730A3]',
    borderGradient: 'from-[#6366F1] via-[#A5B4FC] to-[#4338CA]',
    perks: 'Hypercar entry animation, priority stream queue, VIP 6 at Lv.48, VIP 7 at Lv.56 & VIP 8 at Lv.64.',
  },
  {
    name: 'Celestial Diamond',
    urduName: 'ڈائمنڈ',
    minLevel: 66,
    maxLevel: 85,
    badge: '✨',
    color: 'from-[#06B6D4] to-[#0E7490]',
    borderGradient: 'from-[#06B6D4] via-[#67E8F9] to-[#0891B2]',
    perks: 'Exclusive private broadcaster lounge, VIP 9 at Lv.72 & VIP 10 at Lv.80.',
  },
  {
    name: 'Alpha Emperor Master',
    urduName: 'ماسٹر / ایمپرر',
    minLevel: 86,
    maxLevel: 100,
    badge: '👑',
    color: 'from-[#EC4899] via-[#A855F7] to-[#F59E0B]',
    borderGradient: 'from-[#EC4899] via-[#A855F7] to-[#F59E0B]',
    perks: 'Server-wide announcement fanfare, Golden Yacht entry, VIP 11 at Lv.88 & VIP 12 at Lv.96.',
  },
];

// Helper to determine tier from level
const getTierInfo = (lvl: number) => {
  if (lvl <= 10) return { tier: 'Bronze' as const, badge: '🥉', color: '#CD7F32' };
  if (lvl <= 25) return { tier: 'Silver' as const, badge: '🥈', color: '#94A3B8' };
  if (lvl <= 45) return { tier: 'Gold' as const, badge: '🥇', color: '#F59E0B' };
  if (lvl <= 65) return { tier: 'Platinum' as const, badge: '💎', color: '#6366F1' };
  if (lvl <= 85) return { tier: 'Diamond' as const, badge: '✨', color: '#06B6D4' };
  return { tier: 'Master' as const, badge: '👑', color: '#EC4899' };
};

// Check if a level unlocks a VIP tier (Every 8 levels: 8, 16, 24, 32, 40, 48, 56, 64, 72, 80, 88, 96)
const getUnlockedVip = (lvl: number): number | undefined => {
  if (lvl % 8 === 0 && lvl <= 96) {
    return lvl / 8;
  }
  return undefined;
};

// Raw Level Target Data generated from public/assets/aistudio/Alpha_Mate_Level_System_1_to_100_021a8084.csv
const RAW_LEVEL_DATA: [number, number, number][] = [
  [1, 50000, 50000],
  [2, 80000, 30000],
  [3, 130000, 50000],
  [4, 180000, 50000],
  [5, 230000, 50000],
  [6, 280000, 50000],
  [7, 330000, 50000],
  [8, 380000, 50000],
  [9, 440000, 60000],
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

export const ALL_LEVELS_1_TO_100: LevelConfig[] = RAW_LEVEL_DATA.map(
  ([level, totalCumulativeCoins, additionalCoins]) => {
    const tierInfo = getTierInfo(level);
    return {
      level,
      totalCumulativeCoins,
      additionalCoins,
      tier: tierInfo.tier,
      tierBadge: tierInfo.badge,
      tierColor: tierInfo.color,
      unlockedVipTier: getUnlockedVip(level),
    };
  }
);

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

// Retrieve config for a given level
export const getLevelConfig = (lvl: number): LevelConfig => {
  const index = Math.max(1, Math.min(100, lvl)) - 1;
  return ALL_LEVELS_1_TO_100[index];
};

// Next level config
export const getNextLevelConfig = (currentLvl: number): LevelConfig | null => {
  if (currentLvl >= 100) return null;
  return ALL_LEVELS_1_TO_100[currentLvl];
};

// Information regarding the next VIP tier unlock
export const getNextVipUnlockInfo = (currentLevel: number, totalCoins: number = 0) => {
  // Current VIP unlocked
  const currentVipTier = Math.min(12, Math.floor(currentLevel / 8));
  const nextVipTier = currentVipTier < 12 ? currentVipTier + 1 : 12;
  const targetLevel = nextVipTier * 8;

  if (targetLevel > 96 || currentVipTier >= 12) {
    return {
      currentVipTier: 12,
      nextVipTier: 12,
      targetLevel: 96,
      requiredCoins: ALL_LEVELS_1_TO_100[95].totalCumulativeCoins,
      levelsRemaining: 0,
      coinsRemaining: 0,
      isMaxVip: true,
    };
  }

  const targetLevelConfig = ALL_LEVELS_1_TO_100[targetLevel - 1];
  const requiredCoins = targetLevelConfig.totalCumulativeCoins;
  const currentLevelConfig = ALL_LEVELS_1_TO_100[Math.max(0, currentLevel - 1)];
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
