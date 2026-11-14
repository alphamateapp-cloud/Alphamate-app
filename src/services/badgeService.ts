import {
  doc,
  onSnapshot,
  setDoc,
} from 'firebase/firestore';
import {
  EarnedBadgeRecord,
  GiftTransactionRecord,
  LeaderboardEntry,
  User,
  UserBadgeId,
  UserBadgeTier,
  UserHistoricalStats,
  VideoPost,
  WalletTransaction,
} from '../types';
import {
  auth,
  db,
  handleFirestoreError,
  OperationType,
} from './firebase';

const STORAGE_PREFIX = 'alphamate_user_badge_stats_v1_';
const VALID_ID_RE = /^[a-zA-Z0-9_-]{1,128}$/;
export const MAX_EQUIPPED_BADGES = 3;

export interface BadgeTierThresholds {
  bronze: number;
  silver: number;
  gold: number;
  mythic: number;
}

export interface BadgeDefinition {
  id: UserBadgeId;
  name: string;
  shortLabel: string;
  category: 'Community' | 'Gifting' | 'Party & Live' | 'Milestones';
  description: string;
  requirementLabel: string;
  unit: string;
  thresholds: BadgeTierThresholds;
  accentFrom: string;
  accentTo: string;
}

export const BADGE_DEFINITIONS: BadgeDefinition[] = [
  {
    id: 'top_contributor',
    name: 'Top Contributor',
    shortLabel: 'Contributor',
    category: 'Community',
    description: 'Recognized for combined community engagement across gifting, active time, and top rankings.',
    requirementLabel: 'Reach 2,500 Contribution Score (gifts + active time) or Top 50 Leaderboard rank',
    unit: 'pts',
    thresholds: {
      bronze: 2500,
      silver: 15000,
      gold: 50000,
      mythic: 150000,
    },
    accentFrom: '#7928CA',
    accentTo: '#06B6D4',
  },
  {
    id: 'gift_king',
    name: 'Gift King',
    shortLabel: 'Gift King',
    category: 'Gifting',
    description: 'Awarded to generous patrons who support hosts and party creators with virtual gifts.',
    requirementLabel: 'Send 1,000+ Alpha Coins in virtual gifts across rooms & streams',
    unit: 'Coins',
    thresholds: {
      bronze: 1000,
      silver: 5000,
      gold: 25000,
      mythic: 100000,
    },
    accentFrom: '#F59E0B',
    accentTo: '#EF4444',
  },
  {
    id: 'longest_party_attendee',
    name: 'Longest Party Attendee',
    shortLabel: 'Party Legend',
    category: 'Party & Live',
    description: 'Honors dedicated listeners and speakers who spend sustained hours in Alpha Mate Party Rooms.',
    requirementLabel: 'Spend 30+ historical minutes inside Audio Party Rooms',
    unit: 'min',
    thresholds: {
      bronze: 30,
      silver: 120,
      gold: 600,
      mythic: 1800,
    },
    accentFrom: '#EC4899',
    accentTo: '#8B5CF6',
  },
  {
    id: 'diamond_patron',
    name: 'Diamond Host',
    shortLabel: 'Diamond Host',
    category: 'Gifting',
    description: 'Earned by creators and hosts who receive community gifts and build their Diamond treasury.',
    requirementLabel: 'Earn 500+ Diamonds from received community gifts',
    unit: '💎',
    thresholds: {
      bronze: 500,
      silver: 2500,
      gold: 15000,
      mythic: 75000,
    },
    accentFrom: '#38BDF8',
    accentTo: '#6366F1',
  },
  {
    id: 'live_marathoner',
    name: 'Live Marathoner',
    shortLabel: 'Marathoner',
    category: 'Party & Live',
    description: 'Granted for consistent long-form presence across live broadcasts and active app sessions.',
    requirementLabel: 'Accumulate 45+ active minutes across live & community sessions',
    unit: 'min',
    thresholds: {
      bronze: 45,
      silver: 180,
      gold: 720,
      mythic: 2400,
    },
    accentFrom: '#10B981',
    accentTo: '#0EA5E9',
  },
  {
    id: 'streak_champion',
    name: 'Streak Champion',
    shortLabel: 'Streak Pro',
    category: 'Milestones',
    description: 'Celebrates loyal members who maintain multi-day Daily Check-In reward streaks.',
    requirementLabel: 'Reach a 3-day or longer Daily Check-In streak',
    unit: 'days',
    thresholds: {
      bronze: 3,
      silver: 7,
      gold: 14,
      mythic: 30,
    },
    accentFrom: '#F97316',
    accentTo: '#FACC15',
  },
  {
    id: 'social_creator',
    name: 'Alpha Creator',
    shortLabel: 'Creator',
    category: 'Community',
    description: 'Awarded to active creators sharing Moments, reels, and earning community likes.',
    requirementLabel: 'Publish 2+ posts/reels or earn 50+ likes across profile content',
    unit: 'score',
    thresholds: {
      bronze: 50,
      silver: 500,
      gold: 5000,
      mythic: 25000,
    },
    accentFrom: '#A855F7',
    accentTo: '#EC4899',
  },
  {
    id: 'royal_vip',
    name: 'VIP Sovereign',
    shortLabel: 'Sovereign',
    category: 'Milestones',
    description: 'Reserved for seasoned members advancing through Alpha Mate Honor Levels and VIP tiers.',
    requirementLabel: 'Reach Honor Level 10+ or VIP Tier 2+',
    unit: 'Lv',
    thresholds: {
      bronze: 10,
      silver: 25,
      gold: 50,
      mythic: 80,
    },
    accentFrom: '#EAB308',
    accentTo: '#D97706',
  },
];

export const BADGE_BY_ID: Record<UserBadgeId, BadgeDefinition> = BADGE_DEFINITIONS.reduce(
  (acc, def) => {
    acc[def.id] = def;
    return acc;
  },
  {} as Record<UserBadgeId, BadgeDefinition>
);

export function createEmptyHistoricalStats(uid: string): UserHistoricalStats {
  const nowIso = new Date().toISOString();
  return {
    uid,
    totalGiftCoinsSent: 0,
    totalGiftsSentCount: 0,
    totalGiftCoinsReceived: 0,
    totalDiamondsEarned: 0,
    totalActiveMinutes: 0,
    partyRoomMinutes: 0,
    liveStreamMinutes: 0,
    longestPartySessionMinutes: 0,
    bestLeaderboardRank: null,
    checkInDaysCount: 0,
    maxDailyStreak: 0,
    postsCreatedCount: 0,
    equippedBadgeIds: [],
    earnedBadges: {},
    updatedAt: nowIso,
    updatedAtMs: Date.now(),
  };
}

export function loadLocalUserBadgeStats(uid: string): UserHistoricalStats {
  const safeUid = String(uid || 'guest').trim();
  if (typeof window === 'undefined') return createEmptyHistoricalStats(safeUid);
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${safeUid}`);
    if (!raw) return createEmptyHistoricalStats(safeUid);
    const parsed = JSON.parse(raw);
    return {
      ...createEmptyHistoricalStats(safeUid),
      ...parsed,
      uid: safeUid,
      equippedBadgeIds: Array.isArray(parsed.equippedBadgeIds) ? parsed.equippedBadgeIds : [],
      earnedBadges: parsed.earnedBadges && typeof parsed.earnedBadges === 'object' ? parsed.earnedBadges : {},
    };
  } catch {
    return createEmptyHistoricalStats(safeUid);
  }
}

export function saveLocalUserBadgeStats(stats: UserHistoricalStats): void {
  if (typeof window === 'undefined' || !stats?.uid) return;
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${stats.uid}`, JSON.stringify(stats));
  } catch {
    // ignore storage quota errors
  }
}

function resolveTierForValue(
  value: number,
  thresholds: BadgeTierThresholds
): UserBadgeTier | null {
  if (value >= thresholds.mythic) return 'mythic';
  if (value >= thresholds.gold) return 'gold';
  if (value >= thresholds.silver) return 'silver';
  if (value >= thresholds.bronze) return 'bronze';
  return null;
}

const TIER_ORDER: Record<UserBadgeTier, number> = {
  bronze: 1,
  silver: 2,
  gold: 3,
  mythic: 4,
};

function getNextTargetForValue(
  value: number,
  thresholds: BadgeTierThresholds
): number {
  if (value < thresholds.bronze) return thresholds.bronze;
  if (value < thresholds.silver) return thresholds.silver;
  if (value < thresholds.gold) return thresholds.gold;
  return thresholds.mythic;
}

export interface EvaluatedUserBadge {
  definition: BadgeDefinition;
  unlocked: boolean;
  tier: UserBadgeTier | null;
  currentValue: number;
  targetValue: number;
  progressPercent: number;
  unlockedAt: string | null;
  isEquipped: boolean;
}

export function evaluateHistoricalBadges(params: {
  uid: string;
  storedStats: UserHistoricalStats;
  currentUser: User;
  giftTransactions: GiftTransactionRecord[];
  walletTransactions: WalletTransaction[];
  videos: VideoPost[];
  dailyCheckInState: { streak: number; history: string[] };
  currentLeaderboardEntry?: LeaderboardEntry | null;
  previousLeaderboardEntry?: LeaderboardEntry | null;
  currentLeaderboardRank?: number | null;
}): {
  nextStats: UserHistoricalStats;
  evaluatedBadges: EvaluatedUserBadge[];
  newlyUnlockedIds: UserBadgeId[];
  upgradedBadgeIds: UserBadgeId[];
} {
  const {
    uid,
    storedStats,
    currentUser,
    giftTransactions,
    walletTransactions,
    videos,
    dailyCheckInState,
    currentLeaderboardEntry,
    previousLeaderboardEntry,
    currentLeaderboardRank,
  } = params;

  const userIds = new Set([uid, currentUser.id].filter(Boolean));

  // 1. Aggregate sent & received gifts from real giftTransactions + walletTransactions
  let ledgerSentCoins = 0;
  let ledgerSentCount = 0;
  let ledgerReceivedCoins = 0;
  let ledgerDiamonds = 0;

  giftTransactions.forEach((tx) => {
    if (userIds.has(tx.senderId)) {
      ledgerSentCoins += Math.max(0, Number(tx.totalCoins || 0));
      ledgerSentCount += Math.max(1, Number(tx.quantity || 1));
    }
    if (userIds.has(tx.recipientId)) {
      ledgerReceivedCoins += Math.max(0, Number(tx.totalCoins || 0));
      ledgerDiamonds += Math.max(0, Number(tx.hostDiamonds || 0));
    }
  });

  let walletSentCoins = 0;
  let walletSentCount = 0;
  let walletDiamondsReceived = 0;
  walletTransactions.forEach((tx) => {
    if (tx.type === 'gift_sent' && tx.currency === 'coins') {
      walletSentCoins += Math.max(0, Number(tx.amount || 0));
      walletSentCount += 1;
    }
    if (tx.type === 'gift_received' && tx.currency === 'diamonds') {
      walletDiamondsReceived += Math.max(0, Number(tx.amount || 0));
    }
  });

  // 2. Aggregate leaderboard history (current month + previous month)
  const lbReceivedCoins =
    Number(currentLeaderboardEntry?.receivedGiftCoins || 0) +
    Number(previousLeaderboardEntry?.receivedGiftCoins || 0);
  const lbDiamonds =
    Number(currentLeaderboardEntry?.receivedDiamonds || 0) +
    Number(previousLeaderboardEntry?.receivedDiamonds || 0);
  const lbActiveMins =
    Number(currentLeaderboardEntry?.timeSpentMinutes || 0) +
    Number(previousLeaderboardEntry?.timeSpentMinutes || 0);

  const totalGiftCoinsSent = Math.max(
    storedStats.totalGiftCoinsSent,
    ledgerSentCoins,
    walletSentCoins
  );
  const totalGiftsSentCount = Math.max(
    storedStats.totalGiftsSentCount,
    ledgerSentCount,
    walletSentCount
  );
  const totalGiftCoinsReceived = Math.max(
    storedStats.totalGiftCoinsReceived,
    ledgerReceivedCoins,
    lbReceivedCoins
  );
  const totalDiamondsEarned = Math.max(
    storedStats.totalDiamondsEarned,
    ledgerDiamonds,
    lbDiamonds,
    walletDiamondsReceived,
    Number(currentUser.diamonds || 0)
  );
  const totalActiveMinutes = Math.max(
    storedStats.totalActiveMinutes,
    lbActiveMins
  );
  const partyRoomMinutes = Math.max(0, storedStats.partyRoomMinutes);
  const liveStreamMinutes = Math.max(0, storedStats.liveStreamMinutes);
  const longestPartySessionMinutes = Math.max(0, storedStats.longestPartySessionMinutes);

  const bestLeaderboardRank =
    currentLeaderboardRank && storedStats.bestLeaderboardRank
      ? Math.min(currentLeaderboardRank, storedStats.bestLeaderboardRank)
      : currentLeaderboardRank || storedStats.bestLeaderboardRank || null;

  const checkInDaysCount = Math.max(
    storedStats.checkInDaysCount,
    Array.isArray(dailyCheckInState.history) ? dailyCheckInState.history.length : 0
  );
  const maxDailyStreak = Math.max(
    storedStats.maxDailyStreak,
    Number(dailyCheckInState.streak || 0)
  );

  const myContent = videos.filter(
    (v) =>
      userIds.has(v.user?.id) ||
      (Boolean(currentUser.username) && v.user?.username === currentUser.username)
  );
  const postsCreatedCount = Math.max(storedStats.postsCreatedCount, myContent.length);
  const contentLikes = myContent.reduce((sum, v) => sum + Number(v.likes || 0), 0);

  // 3. Compute metric per badge
  const contributionScore =
    totalGiftCoinsSent +
    totalGiftCoinsReceived +
    totalActiveMinutes * 25 +
    partyRoomMinutes * 30 +
    postsCreatedCount * 200 +
    (bestLeaderboardRank && bestLeaderboardRank <= 50 ? 2500 : 0);

  const creatorMetric = Math.max(
    Number(currentUser.likesCount || 0) + contentLikes,
    postsCreatedCount >= 2 ? 50 + postsCreatedCount * 25 : postsCreatedCount * 25
  );

  const vipMetric = Math.max(
    Number(currentUser.level || 1),
    Number(currentUser.vipTier || 0) >= 2 ? 10 + Number(currentUser.vipTier || 0) * 5 : 0
  );

  const metricsByBadge: Record<UserBadgeId, number> = {
    top_contributor: contributionScore,
    gift_king: totalGiftCoinsSent,
    longest_party_attendee: Math.max(partyRoomMinutes, longestPartySessionMinutes),
    diamond_patron: totalDiamondsEarned,
    live_marathoner: Math.max(totalActiveMinutes, liveStreamMinutes + partyRoomMinutes),
    streak_champion: Math.max(maxDailyStreak, checkInDaysCount),
    social_creator: creatorMetric,
    royal_vip: vipMetric,
  };

  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const nextEarnedBadges: Record<string, EarnedBadgeRecord> = {
    ...(storedStats.earnedBadges || {}),
  };
  const newlyUnlockedIds: UserBadgeId[] = [];
  const upgradedBadgeIds: UserBadgeId[] = [];

  BADGE_DEFINITIONS.forEach((def) => {
    const val = Math.max(0, Math.round(metricsByBadge[def.id] || 0));
    const achievedTier = resolveTierForValue(val, def.thresholds);
    const existing = nextEarnedBadges[def.id];

    if (achievedTier) {
      if (!existing) {
        nextEarnedBadges[def.id] = {
          badgeId: def.id,
          tier: achievedTier,
          unlockedAt: nowIso,
          unlockedAtMs: nowMs,
          metricValue: val,
        };
        newlyUnlockedIds.push(def.id);
      } else {
        const isUpgrade = TIER_ORDER[achievedTier] > TIER_ORDER[existing.tier];
        if (isUpgrade) {
          upgradedBadgeIds.push(def.id);
        }
        nextEarnedBadges[def.id] = {
          ...existing,
          tier: isUpgrade ? achievedTier : existing.tier,
          metricValue: Math.max(existing.metricValue || 0, val),
        };
      }
    }
  });

  // Auto-equip up to 3 newly unlocked badges if slots are open
  const validEarnedSet = new Set(Object.keys(nextEarnedBadges));
  let equippedBadgeIds = (storedStats.equippedBadgeIds || []).filter((id) =>
    validEarnedSet.has(id)
  );
  if (equippedBadgeIds.length < MAX_EQUIPPED_BADGES) {
    Object.keys(nextEarnedBadges).forEach((badgeKey) => {
      const id = badgeKey as UserBadgeId;
      if (equippedBadgeIds.length < MAX_EQUIPPED_BADGES && !equippedBadgeIds.includes(id)) {
        equippedBadgeIds = [...equippedBadgeIds, id];
      }
    });
  }

  const nextStats: UserHistoricalStats = {
    uid,
    totalGiftCoinsSent,
    totalGiftsSentCount,
    totalGiftCoinsReceived,
    totalDiamondsEarned,
    totalActiveMinutes,
    partyRoomMinutes,
    liveStreamMinutes,
    longestPartySessionMinutes,
    bestLeaderboardRank,
    checkInDaysCount,
    maxDailyStreak,
    postsCreatedCount,
    equippedBadgeIds: equippedBadgeIds.slice(0, MAX_EQUIPPED_BADGES),
    earnedBadges: nextEarnedBadges,
    updatedAt: nowIso,
    updatedAtMs: nowMs,
  };

  const equippedSet = new Set(nextStats.equippedBadgeIds);
  const evaluatedBadges: EvaluatedUserBadge[] = BADGE_DEFINITIONS.map((def) => {
    const val = Math.max(0, Math.round(metricsByBadge[def.id] || 0));
    const record = nextEarnedBadges[def.id];
    const targetValue = getNextTargetForValue(val, def.thresholds);
    const unlocked = Boolean(record);
    const progressPercent = unlocked
      ? val >= def.thresholds.mythic
        ? 100
        : Math.min(100, Math.max(8, Math.round((val / targetValue) * 100)))
      : Math.min(99, Math.max(0, Math.round((val / def.thresholds.bronze) * 100)));

    return {
      definition: def,
      unlocked,
      tier: record?.tier || null,
      currentValue: val,
      targetValue,
      progressPercent,
      unlockedAt: record?.unlockedAt || null,
      isEquipped: equippedSet.has(def.id),
    };
  });

  return {
    nextStats,
    evaluatedBadges,
    newlyUnlockedIds,
    upgradedBadgeIds,
  };
}

// =========================================================================
// FIRESTORE PERSISTENCE (/users/{userId}/badgeStats/summary)
// =========================================================================

export function subscribeToUserBadgeStats(
  userId: string,
  onUpdate: (stats: UserHistoricalStats | null) => void
): () => void {
  if (!userId || !VALID_ID_RE.test(userId) || !auth.currentUser?.uid) {
    return () => {};
  }
  const path = `users/${userId}/badgeStats/summary`;
  return onSnapshot(
    doc(db, 'users', userId, 'badgeStats', 'summary'),
    (snap) => {
      if (!snap.exists()) {
        onUpdate(null);
        return;
      }
      const d = snap.data() as Record<string, any>;
      onUpdate({
        uid: String(d.uid || userId),
        totalGiftCoinsSent: Number(d.totalGiftCoinsSent || 0),
        totalGiftsSentCount: Number(d.totalGiftsSentCount || 0),
        totalGiftCoinsReceived: Number(d.totalGiftCoinsReceived || 0),
        totalDiamondsEarned: Number(d.totalDiamondsEarned || 0),
        totalActiveMinutes: Number(d.totalActiveMinutes || 0),
        partyRoomMinutes: Number(d.partyRoomMinutes || 0),
        liveStreamMinutes: Number(d.liveStreamMinutes || 0),
        longestPartySessionMinutes: Number(d.longestPartySessionMinutes || 0),
        bestLeaderboardRank:
          typeof d.bestLeaderboardRank === 'number' ? d.bestLeaderboardRank : null,
        checkInDaysCount: Number(d.checkInDaysCount || 0),
        maxDailyStreak: Number(d.maxDailyStreak || 0),
        postsCreatedCount: Number(d.postsCreatedCount || 0),
        equippedBadgeIds: Array.isArray(d.equippedBadgeIds) ? d.equippedBadgeIds : [],
        earnedBadges:
          d.earnedBadges && typeof d.earnedBadges === 'object' ? d.earnedBadges : {},
        updatedAt: String(d.updatedAt || new Date().toISOString()),
        updatedAtMs: Number(d.updatedAtMs || Date.now()),
      });
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    }
  );
}

export async function syncUserBadgeStatsToFirestore(
  stats: UserHistoricalStats
): Promise<void> {
  const authUid = auth.currentUser?.uid;
  if (!authUid || !stats?.uid || stats.uid !== authUid || !VALID_ID_RE.test(authUid)) {
    return;
  }

  const path = `users/${authUid}/badgeStats/summary`;
  const payload = {
    uid: authUid,
    totalGiftCoinsSent: Math.max(0, Math.round(stats.totalGiftCoinsSent || 0)),
    totalGiftsSentCount: Math.max(0, Math.round(stats.totalGiftsSentCount || 0)),
    totalGiftCoinsReceived: Math.max(0, Math.round(stats.totalGiftCoinsReceived || 0)),
    totalDiamondsEarned: Math.max(0, Math.round(stats.totalDiamondsEarned || 0)),
    totalActiveMinutes: Math.max(0, Math.round(stats.totalActiveMinutes || 0)),
    partyRoomMinutes: Math.max(0, Math.round(stats.partyRoomMinutes || 0)),
    liveStreamMinutes: Math.max(0, Math.round(stats.liveStreamMinutes || 0)),
    longestPartySessionMinutes: Math.max(0, Math.round(stats.longestPartySessionMinutes || 0)),
    bestLeaderboardRank:
      typeof stats.bestLeaderboardRank === 'number' && stats.bestLeaderboardRank >= 1
        ? Math.round(stats.bestLeaderboardRank)
        : null,
    checkInDaysCount: Math.max(0, Math.round(stats.checkInDaysCount || 0)),
    maxDailyStreak: Math.max(0, Math.round(stats.maxDailyStreak || 0)),
    postsCreatedCount: Math.max(0, Math.round(stats.postsCreatedCount || 0)),
    equippedBadgeIds: (stats.equippedBadgeIds || []).slice(0, MAX_EQUIPPED_BADGES),
    earnedBadges: stats.earnedBadges || {},
    updatedAt: stats.updatedAt || new Date().toISOString(),
    updatedAtMs: stats.updatedAtMs || Date.now(),
  };

  try {
    await setDoc(doc(db, 'users', authUid, 'badgeStats', 'summary'), payload, {
      merge: true,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}
