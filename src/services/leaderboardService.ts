import {
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
} from 'firebase/firestore';
import {
  LeaderboardEntry,
  LeaderboardMetric,
  LeaderboardScope,
  User,
} from '../types';
import {
  auth,
  db,
  handleFirestoreError,
  OperationType,
} from './firebase';
import { sanitizeAvatarString } from '../utils/imageCompressor';

export const MIN_LEADERBOARD_USERS = 108;
export const TIME_POINTS_PER_MINUTE = 25;
const STORAGE_PREFIX = 'alphamate_leaderboard_v1_';
const VALID_ID_RE = /^[a-zA-Z0-9_-]{1,128}$/;

// =========================================================================
// CYCLE & TIME HELPERS (MONTHLY REFRESH + WEEKLY ROLLOVER)
// =========================================================================

export function getCurrentMonthKey(date: Date = new Date()): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export function getPreviousMonthKey(date: Date = new Date()): string {
  const prev = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - 1, 1));
  return getCurrentMonthKey(prev);
}

/**
 * ISO 8601 week key in UTC, e.g. "2026-W46"
 */
export function getCurrentWeekKey(date: Date = new Date()): string {
  const tmp = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((tmp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${tmp.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

export function formatMonthLabel(monthKey: string): string {
  const [yStr, mStr] = monthKey.split('-');
  const y = Number(yStr);
  const m = Number(mStr);
  if (!y || !m) return monthKey;
  const date = new Date(Date.UTC(y, m - 1, 1));
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
}

export function formatWeekLabel(weekKey: string): string {
  const match = /^(\d{4})-W(\d{2})$/.exec(weekKey);
  if (!match) return weekKey;
  return `Week ${Number(match[2])} · ${match[1]}`;
}

export function getCountdownUntilMonthReset(now: Date = new Date()): {
  days: number;
  hours: number;
  minutes: number;
  formatted: string;
} {
  const nextMonthStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0);
  const diffMs = Math.max(0, nextMonthStart - now.getTime());
  const totalMinutes = Math.floor(diffMs / 60000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  return {
    days,
    hours,
    minutes,
    formatted: days > 0 ? `${days}d ${hours}h` : `${hours}h ${minutes}m`,
  };
}

export function getCountdownUntilWeekReset(now: Date = new Date()): {
  days: number;
  hours: number;
  minutes: number;
  formatted: string;
} {
  const day = now.getUTCDay(); // 0=Sun..6=Sat
  const daysUntilMonday = day === 0 ? 1 : 8 - day;
  const nextMonday = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + daysUntilMonday,
    0,
    0,
    0,
    0
  );
  const diffMs = Math.max(0, nextMonday - now.getTime());
  const totalMinutes = Math.floor(diffMs / 60000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  return {
    days,
    hours,
    minutes,
    formatted: days > 0 ? `${days}d ${hours}h` : `${hours}h ${minutes}m`,
  };
}

export function computeLeaderboardScore(giftCoins: number, timeSpentMinutes: number): number {
  const safeCoins = Math.max(0, Math.round(Number(giftCoins) || 0));
  const safeMinutes = Math.max(0, Math.round(Number(timeSpentMinutes) || 0));
  return safeCoins + safeMinutes * TIME_POINTS_PER_MINUTE;
}

export function formatDurationMinutes(totalMinutes: number): string {
  const mins = Math.max(0, Math.round(Number(totalMinutes) || 0));
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

// =========================================================================
// DETERMINISTIC 100+ USER MONTHLY ROSTER & LOCAL PERSISTENCE (MAX 1 MONTH)
// =========================================================================

const FIRST_NAMES = [
  'Aarav', 'Zara', 'Liam', 'Sophia', 'Hamza', 'Elena', 'Noah', 'Amina',
  'Tariq', 'Maya', 'Lucas', 'Hana', 'Rayan', 'Chloe', 'Bilal', 'Nadia',
  'Ethan', 'Layla', 'Omar', 'Aria', 'Daniel', 'Sana', 'Kian', 'Mina',
  'Yusuf', 'Amara', 'Mateo', 'Freya', 'Zain', 'Sora', 'Leo', 'Alina',
  'Farhan', 'Hira', 'Julian', 'Noor',
];

const LAST_NAMES = [
  'Khan', 'Rider', 'Taylor', 'Rostova', 'Malik', 'Carter', 'Vance', 'Qureshi',
  'Chen', 'Ahmed', 'Silva', 'Hassan', 'Park', 'Raza', 'Moreau', 'Ali',
  'Kim', 'Siddiqui', 'Novak', 'Shah', 'Sato', 'Iqbal', 'Costa', 'Mansoor',
];

const REGION_FLAGS = ['🇵🇰', '🇦🇪', '🇬🇧', '🇺🇸', '🇸🇦', '🇹🇷', '🇨🇦', '🇩🇪', '🇲🇾', '🇯🇵', '🇧🇷', '🇫🇷'];

function hashString(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function createSeededRng(seedNum: number): () => number {
  let state = seedNum || 123456789;
  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

export function pruneExpiredLocalLeaderboardMonths(activeMonthKey: string, previousMonthKey: string): void {
  if (typeof window === 'undefined') return;
  try {
    const keepKeys = new Set([
      `${STORAGE_PREFIX}${activeMonthKey}`,
      `${STORAGE_PREFIX}${previousMonthKey}`,
    ]);
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i);
      if (k && k.startsWith(STORAGE_PREFIX) && !keepKeys.has(k)) {
        keysToRemove.push(k);
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
  } catch {
    // ignore storage errors
  }
}

export function loadLocalLeaderboardOverrides(monthKey: string): Record<string, LeaderboardEntry> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${monthKey}`);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function saveLocalLeaderboardOverrides(
  monthKey: string,
  map: Record<string, LeaderboardEntry>
): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${monthKey}`, JSON.stringify(map));
  } catch {
    // ignore quota errors
  }
}

export function generateMonthlyBaseRoster(
  monthKey: string,
  weekKey: string,
  count: number = MIN_LEADERBOARD_USERS
): LeaderboardEntry[] {
  const rng = createSeededRng(hashString(`alpha_mate_lb_${monthKey}`));
  const entries: LeaderboardEntry[] = [];
  const nowIso = new Date().toISOString();
  const nowMs = Date.now();

  for (let idx = 0; idx < count; idx += 1) {
    const fn = FIRST_NAMES[(idx + Math.floor(rng() * FIRST_NAMES.length)) % FIRST_NAMES.length];
    const ln = LAST_NAMES[(idx * 3 + Math.floor(rng() * LAST_NAMES.length)) % LAST_NAMES.length];
    const displayName = `${fn} ${ln}`;
    const handleSuffix = 10 + ((idx * 7 + Math.floor(rng() * 89)) % 89);
    const username = `${fn.toLowerCase()}_${ln.toLowerCase()}${handleSuffix}`;
    const uid = `lb_member_${monthKey}_${String(idx + 1).padStart(3, '0')}`;
    const uniqueNum = 110000 + ((hashString(`${monthKey}_${idx}`) % 880000));
    const uniqueId = `AM_${uniqueNum}`;

    // Exponential decay + organic jitter so #1..#108 feel natural & competitive every month
    const tierFactor = Math.pow(1 - idx / (count + 8), 2.35);
    const giftCoins = Math.max(
      120,
      Math.round(tierFactor * 92000 + rng() * 1400 + (idx < 10 ? (10 - idx) * 2800 : 0))
    );
    const receivedDiamonds = Math.round(giftCoins * 0.6);
    const giftsCount = Math.max(1, Math.round(giftCoins / (160 + rng() * 240)));

    // Time spent ranges roughly from ~1h up to ~110h over a month
    const timeSpentMinutes = Math.max(
      35,
      Math.round(tierFactor * 5400 + rng() * 480 + (idx % 7) * 25)
    );

    // Weekly share (~22%-40% of monthly totals so weekly and monthly rankings diverge slightly)
    const weeklyRatioGifts = 0.2 + rng() * 0.25;
    const weeklyRatioTime = 0.22 + rng() * 0.28;
    const weeklyGiftCoins = Math.max(40, Math.round(giftCoins * weeklyRatioGifts));
    const weeklyDiamonds = Math.round(weeklyGiftCoins * 0.6);
    const weeklyGiftsCount = Math.max(1, Math.round(giftsCount * weeklyRatioGifts));
    const weeklyTimeSpentMinutes = Math.max(15, Math.round(timeSpentMinutes * weeklyRatioTime));

    const level = Math.min(99, Math.max(4, Math.round(8 + tierFactor * 64 + rng() * 10)));
    const vipTier = idx < 3 ? Math.min(12, 8 + Math.floor(rng() * 4)) : idx < 20 ? Math.min(9, 2 + Math.floor(rng() * 6)) : idx % 4 === 0 ? 1 : 0;

    entries.push({
      uid,
      uniqueId,
      displayName,
      username,
      avatar: '',
      countryFlag: REGION_FLAGS[(idx + Math.floor(rng() * 5)) % REGION_FLAGS.length],
      level,
      vipTier,
      monthKey,
      weekKey,
      receivedGiftCoins: giftCoins,
      receivedDiamonds,
      giftsCount,
      timeSpentMinutes,
      score: computeLeaderboardScore(giftCoins, timeSpentMinutes),
      weeklyGiftCoins,
      weeklyDiamonds,
      weeklyGiftsCount,
      weeklyTimeSpentMinutes,
      weeklyScore: computeLeaderboardScore(weeklyGiftCoins, weeklyTimeSpentMinutes),
      isLive: idx < 12 && idx % 3 === 0,
      isRealUser: false,
      updatedAt: nowIso,
      updatedAtMs: nowMs - idx * 60000,
    });
  }

  return entries;
}

// =========================================================================
// LOCAL ACCUMULATORS (GIFTS & TIME SPENT)
// =========================================================================

export function applyLocalLeaderboardGift(params: {
  recipientId: string;
  recipientName: string;
  recipientUsername?: string;
  recipientUniqueId?: string;
  recipientAvatar?: string;
  recipientLevel?: number;
  recipientVipTier?: number;
  recipientCountryFlag?: string;
  giftCoins: number;
  hostDiamonds: number;
  monthKey?: string;
  weekKey?: string;
}): Record<string, LeaderboardEntry> {
  const monthKey = params.monthKey || getCurrentMonthKey();
  const weekKey = params.weekKey || getCurrentWeekKey();
  const uid = String(params.recipientId || '').trim();
  if (!uid) return loadLocalLeaderboardOverrides(monthKey);

  const nowIso = new Date().toISOString();
  const nowMs = Date.now();
  const map = loadLocalLeaderboardOverrides(monthKey);
  const existing = map[uid];

  const isSameWeek = existing?.weekKey === weekKey;
  const nextGiftCoins = (existing?.receivedGiftCoins || 0) + Math.max(0, Math.round(params.giftCoins));
  const nextDiamonds = (existing?.receivedDiamonds || 0) + Math.max(0, Math.round(params.hostDiamonds));
  const nextGiftsCount = (existing?.giftsCount || 0) + 1;
  const nextMinutes = existing?.timeSpentMinutes || 0;

  const nextWeeklyCoins =
    (isSameWeek ? existing?.weeklyGiftCoins || 0 : 0) + Math.max(0, Math.round(params.giftCoins));
  const nextWeeklyDiamonds =
    (isSameWeek ? existing?.weeklyDiamonds || 0 : 0) + Math.max(0, Math.round(params.hostDiamonds));
  const nextWeeklyCount = (isSameWeek ? existing?.weeklyGiftsCount || 0 : 0) + 1;
  const nextWeeklyMinutes = isSameWeek ? existing?.weeklyTimeSpentMinutes || 0 : 0;

  map[uid] = {
    uid,
    uniqueId: params.recipientUniqueId || existing?.uniqueId || `AM_${uid.slice(0, 6).toUpperCase()}`,
    displayName: params.recipientName || existing?.displayName || 'Alpha Host',
    username: params.recipientUsername || existing?.username || 'alpha_host',
    avatar: sanitizeAvatarString(params.recipientAvatar || existing?.avatar || ''),
    countryFlag: params.recipientCountryFlag || existing?.countryFlag || '🇵🇰',
    level: params.recipientLevel ?? existing?.level ?? 1,
    vipTier: params.recipientVipTier ?? existing?.vipTier ?? 0,
    monthKey,
    weekKey,
    receivedGiftCoins: nextGiftCoins,
    receivedDiamonds: nextDiamonds,
    giftsCount: nextGiftsCount,
    timeSpentMinutes: nextMinutes,
    score: computeLeaderboardScore(nextGiftCoins, nextMinutes),
    weeklyGiftCoins: nextWeeklyCoins,
    weeklyDiamonds: nextWeeklyDiamonds,
    weeklyGiftsCount: nextWeeklyCount,
    weeklyTimeSpentMinutes: nextWeeklyMinutes,
    weeklyScore: computeLeaderboardScore(nextWeeklyCoins, nextWeeklyMinutes),
    equippedBadgeIds: existing?.equippedBadgeIds,
    isRealUser: true,
    updatedAt: nowIso,
    updatedAtMs: nowMs,
  };

  saveLocalLeaderboardOverrides(monthKey, map);
  return map;
}

export function applyLocalLeaderboardTime(
  user: User,
  deltaMinutes: number,
  monthKey: string = getCurrentMonthKey(),
  weekKey: string = getCurrentWeekKey()
): Record<string, LeaderboardEntry> {
  const uid = String(auth.currentUser?.uid || user.id || '').trim();
  if (!uid) return loadLocalLeaderboardOverrides(monthKey);

  const addMins = Math.max(0, Math.round(deltaMinutes));
  const nowIso = new Date().toISOString();
  const nowMs = Date.now();
  const map = loadLocalLeaderboardOverrides(monthKey);
  const existing = map[uid];
  const isSameWeek = existing?.weekKey === weekKey;

  const giftCoins = existing?.receivedGiftCoins || 0;
  const diamonds = existing?.receivedDiamonds || 0;
  const giftsCount = existing?.giftsCount || 0;
  const nextMinutes = (existing?.timeSpentMinutes || 0) + addMins;

  const weeklyCoins = isSameWeek ? existing?.weeklyGiftCoins || 0 : 0;
  const weeklyDiamonds = isSameWeek ? existing?.weeklyDiamonds || 0 : 0;
  const weeklyCount = isSameWeek ? existing?.weeklyGiftsCount || 0 : 0;
  const nextWeeklyMinutes = (isSameWeek ? existing?.weeklyTimeSpentMinutes || 0 : 0) + addMins;

  map[uid] = {
    uid,
    uniqueId: user.uniqueId || existing?.uniqueId || 'AM_000001',
    displayName: user.displayName || existing?.displayName || 'Alpha Creator',
    username: user.username || existing?.username || 'alpha_creator',
    avatar: sanitizeAvatarString(user.avatar || existing?.avatar || ''),
    countryFlag: user.countryFlag || existing?.countryFlag || '🇵🇰',
    level: Number(user.level || existing?.level || 1),
    vipTier: Number(user.vipTier || existing?.vipTier || 0),
    monthKey,
    weekKey,
    receivedGiftCoins: giftCoins,
    receivedDiamonds: diamonds,
    giftsCount,
    timeSpentMinutes: nextMinutes,
    score: computeLeaderboardScore(giftCoins, nextMinutes),
    weeklyGiftCoins: weeklyCoins,
    weeklyDiamonds,
    weeklyGiftsCount: weeklyCount,
    weeklyTimeSpentMinutes: nextWeeklyMinutes,
    weeklyScore: computeLeaderboardScore(weeklyCoins, nextWeeklyMinutes),
    equippedBadgeIds: Array.isArray(user.equippedBadgeIds)
      ? user.equippedBadgeIds.slice(0, 3)
      : existing?.equippedBadgeIds,
    isRealUser: true,
    updatedAt: nowIso,
    updatedAtMs: nowMs,
  };

  saveLocalLeaderboardOverrides(monthKey, map);
  return map;
}

// =========================================================================
// FIRESTORE REAL-TIME SUBSCRIPTION & ATOMIC TRANSACTIONS
// =========================================================================

export function subscribeToMonthlyLeaderboard(
  monthKey: string,
  onUpdate: (entries: LeaderboardEntry[]) => void,
  limitCount: number = 200
): () => void {
  if (!auth.currentUser?.uid) {
    onUpdate([]);
    return () => {};
  }
  const path = `leaderboardMonths/${monthKey}/entries`;
  const q = query(
    collection(db, 'leaderboardMonths', monthKey, 'entries'),
    orderBy('score', 'desc'),
    limit(limitCount)
  );
  return onSnapshot(
    q,
    (snapshot) => {
      const list = snapshot.docs.map((docSnap) => {
        const d = docSnap.data() as Record<string, any>;
        return {
          uid: String(d.uid || docSnap.id),
          uniqueId: String(d.uniqueId || ''),
          displayName: String(d.displayName || 'Alpha User'),
          username: String(d.username || 'alpha'),
          avatar: String(d.avatar || ''),
          countryFlag: d.countryFlag ? String(d.countryFlag) : '🇵🇰',
          level: Number(d.level || 1),
          vipTier: Number(d.vipTier || 0),
          monthKey: String(d.monthKey || monthKey),
          weekKey: String(d.weekKey || getCurrentWeekKey()),
          receivedGiftCoins: Number(d.receivedGiftCoins || 0),
          receivedDiamonds: Number(d.receivedDiamonds || 0),
          giftsCount: Number(d.giftsCount || 0),
          timeSpentMinutes: Number(d.timeSpentMinutes || 0),
          score: Number(d.score || 0),
          weeklyGiftCoins: Number(d.weeklyGiftCoins || 0),
          weeklyDiamonds: Number(d.weeklyDiamonds || 0),
          weeklyGiftsCount: Number(d.weeklyGiftsCount || 0),
          weeklyTimeSpentMinutes: Number(d.weeklyTimeSpentMinutes || 0),
          weeklyScore: Number(d.weeklyScore || 0),
          isLive: Boolean(d.isLive),
          equippedBadgeIds: Array.isArray(d.equippedBadgeIds) ? d.equippedBadgeIds : [],
          isRealUser: true,
          updatedAt: String(d.updatedAt || new Date().toISOString()),
          updatedAtMs: Number(d.updatedAtMs || Date.now()),
        } as LeaderboardEntry;
      });
      onUpdate(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export async function fetchMonthlyLeaderboardOnce(
  monthKey: string,
  limitCount: number = 200
): Promise<LeaderboardEntry[]> {
  if (!auth.currentUser?.uid) return [];
  const path = `leaderboardMonths/${monthKey}/entries`;
  try {
    const q = query(
      collection(db, 'leaderboardMonths', monthKey, 'entries'),
      orderBy('score', 'desc'),
      limit(limitCount)
    );
    const snap = await getDocs(q);
    return snap.docs.map((docSnap) => {
      const d = docSnap.data() as Record<string, any>;
      return {
        uid: String(d.uid || docSnap.id),
        uniqueId: String(d.uniqueId || ''),
        displayName: String(d.displayName || 'Alpha User'),
        username: String(d.username || 'alpha'),
        avatar: String(d.avatar || ''),
        countryFlag: d.countryFlag ? String(d.countryFlag) : '🇵🇰',
        level: Number(d.level || 1),
        vipTier: Number(d.vipTier || 0),
        monthKey: String(d.monthKey || monthKey),
        weekKey: String(d.weekKey || getCurrentWeekKey()),
        receivedGiftCoins: Number(d.receivedGiftCoins || 0),
        receivedDiamonds: Number(d.receivedDiamonds || 0),
        giftsCount: Number(d.giftsCount || 0),
        timeSpentMinutes: Number(d.timeSpentMinutes || 0),
        score: Number(d.score || 0),
        weeklyGiftCoins: Number(d.weeklyGiftCoins || 0),
        weeklyDiamonds: Number(d.weeklyDiamonds || 0),
        weeklyGiftsCount: Number(d.weeklyGiftsCount || 0),
        weeklyTimeSpentMinutes: Number(d.weeklyTimeSpentMinutes || 0),
        weeklyScore: Number(d.weeklyScore || 0),
        isLive: Boolean(d.isLive),
        equippedBadgeIds: Array.isArray(d.equippedBadgeIds) ? d.equippedBadgeIds : [],
        isRealUser: true,
        updatedAt: String(d.updatedAt || new Date().toISOString()),
        updatedAtMs: Number(d.updatedAtMs || Date.now()),
      };
    });
  } catch (error) {
    console.warn(`Could not fetch leaderboard history for ${path}:`, error);
    return [];
  }
}

export async function recordLeaderboardGiftReceived(params: {
  recipientId: string;
  recipientName: string;
  recipientAvatar?: string;
  giftCoins: number;
  hostDiamonds: number;
}): Promise<void> {
  if (!auth.currentUser?.uid) return;
  const recipientId = String(params.recipientId || '').trim();
  if (!recipientId || !VALID_ID_RE.test(recipientId)) return;

  const giftCoins = Math.max(1, Math.round(Number(params.giftCoins) || 0));
  const hostDiamonds = Math.max(0, Math.round(Number(params.hostDiamonds) || 0));
  const monthKey = getCurrentMonthKey();
  const weekKey = getCurrentWeekKey();
  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const entryRef = doc(db, 'leaderboardMonths', monthKey, 'entries', recipientId);
  const path = `leaderboardMonths/${monthKey}/entries/${recipientId}`;

  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(entryRef);
      if (snap.exists()) {
        const d = snap.data() as Record<string, any>;
        const isSameWeek = d.weekKey === weekKey;
        const nextCoins = Number(d.receivedGiftCoins || 0) + giftCoins;
        const nextDiamonds = Number(d.receivedDiamonds || 0) + hostDiamonds;
        const nextCount = Number(d.giftsCount || 0) + 1;
        const existingMins = Number(d.timeSpentMinutes || 0);

        const nextWeeklyCoins = (isSameWeek ? Number(d.weeklyGiftCoins || 0) : 0) + giftCoins;
        const nextWeeklyDiamonds = (isSameWeek ? Number(d.weeklyDiamonds || 0) : 0) + hostDiamonds;
        const nextWeeklyCount = (isSameWeek ? Number(d.weeklyGiftsCount || 0) : 0) + 1;
        const existingWeeklyMins = isSameWeek ? Number(d.weeklyTimeSpentMinutes || 0) : 0;

        tx.update(entryRef, {
          displayName: String(params.recipientName || d.displayName || 'Alpha Host').slice(0, 128),
          avatar: sanitizeAvatarString(params.recipientAvatar || d.avatar || '').slice(0, 2048),
          weekKey,
          receivedGiftCoins: nextCoins,
          receivedDiamonds: nextDiamonds,
          giftsCount: nextCount,
          score: computeLeaderboardScore(nextCoins, existingMins),
          weeklyGiftCoins: nextWeeklyCoins,
          weeklyDiamonds: nextWeeklyDiamonds,
          weeklyGiftsCount: nextWeeklyCount,
          weeklyScore: computeLeaderboardScore(nextWeeklyCoins, existingWeeklyMins),
          updatedAt: nowIso,
          updatedAtMs: nowMs,
        });
      } else {
        tx.set(entryRef, {
          uid: recipientId,
          uniqueId: `AM_${recipientId.slice(0, 6).toUpperCase()}`,
          displayName: String(params.recipientName || 'Alpha Host').slice(0, 128),
          username: 'alpha_host',
          avatar: sanitizeAvatarString(params.recipientAvatar || '').slice(0, 2048),
          countryFlag: '🇵🇰',
          level: 1,
          vipTier: 0,
          monthKey,
          weekKey,
          receivedGiftCoins: giftCoins,
          receivedDiamonds: hostDiamonds,
          giftsCount: 1,
          timeSpentMinutes: 0,
          score: computeLeaderboardScore(giftCoins, 0),
          weeklyGiftCoins: giftCoins,
          weeklyDiamonds: hostDiamonds,
          weeklyGiftsCount: 1,
          weeklyTimeSpentMinutes: 0,
          weeklyScore: computeLeaderboardScore(giftCoins, 0),
          isRealUser: true,
          updatedAt: nowIso,
          updatedAtMs: nowMs,
        });
      }
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function syncUserTimeSpentToLeaderboard(
  user: User,
  deltaMinutes: number
): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid || !VALID_ID_RE.test(uid)) return;

  const addMins = Math.max(0, Math.round(Number(deltaMinutes) || 0));
  const monthKey = getCurrentMonthKey();
  const weekKey = getCurrentWeekKey();
  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const entryRef = doc(db, 'leaderboardMonths', monthKey, 'entries', uid);
  const path = `leaderboardMonths/${monthKey}/entries/${uid}`;

  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(entryRef);
      if (snap.exists()) {
        const d = snap.data() as Record<string, any>;
        const isSameWeek = d.weekKey === weekKey;
        const coins = Number(d.receivedGiftCoins || 0);
        const diamonds = Number(d.receivedDiamonds || 0);
        const giftsCount = Number(d.giftsCount || 0);
        const nextMins = Math.min(50000, Number(d.timeSpentMinutes || 0) + addMins);

        const weeklyCoins = isSameWeek ? Number(d.weeklyGiftCoins || 0) : 0;
        const weeklyDiamonds = isSameWeek ? Number(d.weeklyDiamonds || 0) : 0;
        const weeklyCount = isSameWeek ? Number(d.weeklyGiftsCount || 0) : 0;
        const nextWeeklyMins = Math.min(
          11000,
          (isSameWeek ? Number(d.weeklyTimeSpentMinutes || 0) : 0) + addMins
        );

        tx.update(entryRef, {
          uniqueId: String(user.uniqueId || d.uniqueId || 'AM_000001').slice(0, 64),
          displayName: String(user.displayName || d.displayName || 'Alpha User').slice(0, 128),
          username: String(user.username || d.username || 'alpha').slice(0, 64),
          avatar: sanitizeAvatarString(user.avatar || d.avatar || '').slice(0, 2048),
          countryFlag: String(user.countryFlag || d.countryFlag || '🇵🇰').slice(0, 16),
          level: Math.max(1, Number(user.level || d.level || 1)),
          vipTier: Math.max(0, Number(user.vipTier || d.vipTier || 0)),
          weekKey,
          receivedGiftCoins: coins,
          receivedDiamonds: diamonds,
          giftsCount,
          timeSpentMinutes: nextMins,
          score: computeLeaderboardScore(coins, nextMins),
          weeklyGiftCoins: weeklyCoins,
          weeklyDiamonds,
          weeklyGiftsCount: weeklyCount,
          weeklyTimeSpentMinutes: nextWeeklyMins,
          weeklyScore: computeLeaderboardScore(weeklyCoins, nextWeeklyMins),
          equippedBadgeIds: Array.isArray(user.equippedBadgeIds)
            ? user.equippedBadgeIds.slice(0, 3)
            : Array.isArray(d.equippedBadgeIds)
            ? d.equippedBadgeIds.slice(0, 3)
            : [],
          isRealUser: true,
          updatedAt: nowIso,
          updatedAtMs: nowMs,
        });
      } else {
        const clampedMins = Math.min(50000, addMins);
        const clampedWeeklyMins = Math.min(11000, addMins);
        tx.set(entryRef, {
          uid,
          uniqueId: String(user.uniqueId || 'AM_000001').slice(0, 64),
          displayName: String(user.displayName || 'Alpha User').slice(0, 128),
          username: String(user.username || 'alpha').slice(0, 64),
          avatar: sanitizeAvatarString(user.avatar || '').slice(0, 2048),
          countryFlag: String(user.countryFlag || '🇵🇰').slice(0, 16),
          level: Math.max(1, Number(user.level || 1)),
          vipTier: Math.max(0, Number(user.vipTier || 0)),
          monthKey,
          weekKey,
          receivedGiftCoins: 0,
          receivedDiamonds: 0,
          giftsCount: 0,
          timeSpentMinutes: clampedMins,
          score: computeLeaderboardScore(0, clampedMins),
          weeklyGiftCoins: 0,
          weeklyDiamonds: 0,
          weeklyGiftsCount: 0,
          weeklyTimeSpentMinutes: clampedWeeklyMins,
          weeklyScore: computeLeaderboardScore(0, clampedWeeklyMins),
          equippedBadgeIds: Array.isArray(user.equippedBadgeIds)
            ? user.equippedBadgeIds.slice(0, 3)
            : [],
          isRealUser: true,
          updatedAt: nowIso,
          updatedAtMs: nowMs,
        });
      }
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// =========================================================================
// MERGED >= 100-USER RANKING ENGINE
// =========================================================================

export interface RankedLeaderboardEntry extends LeaderboardEntry {
  rank: number;
  displayGiftsCoins: number;
  displayDiamonds: number;
  displayTimeMinutes: number;
  displayScore: number;
}

export function buildMergedLeaderboardList(options: {
  firestoreEntries: LeaderboardEntry[];
  localOverrides: Record<string, LeaderboardEntry>;
  currentUser: User;
  activeUid?: string | null;
  monthKey: string;
  currentWeekKey: string;
  scope: LeaderboardScope;
  metric: LeaderboardMetric;
  isCurrentMonth: boolean;
}): {
  ranked: RankedLeaderboardEntry[];
  totalUsers: number;
  myRank: number | null;
  myEntry: RankedLeaderboardEntry | null;
} {
  const {
    firestoreEntries,
    localOverrides,
    currentUser,
    activeUid,
    monthKey,
    currentWeekKey,
    scope,
    metric,
    isCurrentMonth,
  } = options;

  const baseRoster = generateMonthlyBaseRoster(monthKey, currentWeekKey, MIN_LEADERBOARD_USERS);
  const byUid = new Map<string, LeaderboardEntry>();

  // 1. Seed deterministic 108-user monthly community baseline
  baseRoster.forEach((item) => {
    byUid.set(item.uid, item);
  });

  // 2. Overlay local persisted updates for this month
  Object.values(localOverrides || {}).forEach((loc) => {
    if (!loc?.uid) return;
    const prev = byUid.get(loc.uid);
    if (!prev) {
      byUid.set(loc.uid, loc);
    } else {
      byUid.set(loc.uid, {
        ...prev,
        ...loc,
        receivedGiftCoins: Math.max(prev.receivedGiftCoins, loc.receivedGiftCoins || 0),
        timeSpentMinutes: Math.max(prev.timeSpentMinutes, loc.timeSpentMinutes || 0),
      });
    }
  });

  // 3. Overlay real-time Firestore entries (authoritative server data for real users)
  firestoreEntries.forEach((fsItem) => {
    if (!fsItem?.uid) return;
    const prev = byUid.get(fsItem.uid);
    if (!prev) {
      byUid.set(fsItem.uid, { ...fsItem, isRealUser: true });
    } else {
      const useLocalHigher = (prev.updatedAtMs || 0) > (fsItem.updatedAtMs || 0);
      const giftCoins = useLocalHigher
        ? Math.max(fsItem.receivedGiftCoins, prev.receivedGiftCoins)
        : fsItem.receivedGiftCoins;
      const mins = useLocalHigher
        ? Math.max(fsItem.timeSpentMinutes, prev.timeSpentMinutes)
        : fsItem.timeSpentMinutes;
      const weeklyGiftCoins =
        fsItem.weekKey === currentWeekKey
          ? useLocalHigher
            ? Math.max(fsItem.weeklyGiftCoins, prev.weeklyGiftCoins)
            : fsItem.weeklyGiftCoins
          : 0;
      const weeklyMins =
        fsItem.weekKey === currentWeekKey
          ? useLocalHigher
            ? Math.max(fsItem.weeklyTimeSpentMinutes, prev.weeklyTimeSpentMinutes)
            : fsItem.weeklyTimeSpentMinutes
          : 0;

      byUid.set(fsItem.uid, {
        ...prev,
        ...fsItem,
        receivedGiftCoins: giftCoins,
        timeSpentMinutes: mins,
        score: computeLeaderboardScore(giftCoins, mins),
        weeklyGiftCoins,
        weeklyTimeSpentMinutes: weeklyMins,
        weeklyScore: computeLeaderboardScore(weeklyGiftCoins, weeklyMins),
        isRealUser: true,
      });
    }
  });

  // 4. Ensure current authenticated user always has an entry in the active month
  const resolvedMyUid = String(activeUid || currentUser.id || '').trim();
  if (isCurrentMonth && resolvedMyUid && !byUid.has(resolvedMyUid)) {
    byUid.set(resolvedMyUid, {
      uid: resolvedMyUid,
      uniqueId: currentUser.uniqueId || 'AM_000001',
      displayName: currentUser.displayName || 'You',
      username: currentUser.username || 'you',
      avatar: sanitizeAvatarString(currentUser.avatar || ''),
      countryFlag: currentUser.countryFlag || '🇵🇰',
      level: Number(currentUser.level || 1),
      vipTier: Number(currentUser.vipTier || 0),
      monthKey,
      weekKey: currentWeekKey,
      receivedGiftCoins: 0,
      receivedDiamonds: 0,
      giftsCount: 0,
      timeSpentMinutes: 0,
      score: 0,
      weeklyGiftCoins: 0,
      weeklyDiamonds: 0,
      weeklyGiftsCount: 0,
      weeklyTimeSpentMinutes: 0,
      weeklyScore: 0,
      equippedBadgeIds: Array.isArray(currentUser.equippedBadgeIds)
        ? currentUser.equippedBadgeIds.slice(0, 3)
        : [],
      isRealUser: true,
      updatedAt: new Date().toISOString(),
      updatedAtMs: Date.now(),
    });
  }

  // 5. Compute display metrics for active scope (Global Monthly vs Weekly)
  const rawList = Array.from(byUid.values()).map((entry) => {
    const weeklyActive = !isCurrentMonth || entry.weekKey === currentWeekKey;
    const displayGiftsCoins =
      scope === 'weekly'
        ? weeklyActive
          ? entry.weeklyGiftCoins
          : 0
        : entry.receivedGiftCoins;
    const displayDiamonds =
      scope === 'weekly'
        ? weeklyActive
          ? entry.weeklyDiamonds
          : 0
        : entry.receivedDiamonds;
    const displayTimeMinutes =
      scope === 'weekly'
        ? weeklyActive
          ? entry.weeklyTimeSpentMinutes
          : 0
        : entry.timeSpentMinutes;
    const displayScore =
      scope === 'weekly'
        ? computeLeaderboardScore(displayGiftsCoins, displayTimeMinutes)
        : computeLeaderboardScore(entry.receivedGiftCoins, entry.timeSpentMinutes);

    return {
      ...entry,
      rank: 0,
      displayGiftsCoins,
      displayDiamonds,
      displayTimeMinutes,
      displayScore,
    };
  });

  // 6. Sort deterministically by selected metric
  rawList.sort((a, b) => {
    if (metric === 'gifts') {
      if (b.displayGiftsCoins !== a.displayGiftsCoins) {
        return b.displayGiftsCoins - a.displayGiftsCoins;
      }
    } else if (metric === 'time') {
      if (b.displayTimeMinutes !== a.displayTimeMinutes) {
        return b.displayTimeMinutes - a.displayTimeMinutes;
      }
    }
    if (b.displayScore !== a.displayScore) {
      return b.displayScore - a.displayScore;
    }
    if (b.displayGiftsCoins !== a.displayGiftsCoins) {
      return b.displayGiftsCoins - a.displayGiftsCoins;
    }
    return a.displayName.localeCompare(b.displayName);
  });

  let myRank: number | null = null;
  let myEntry: RankedLeaderboardEntry | null = null;

  const ranked = rawList.map((entry, idx) => {
    const withRank: RankedLeaderboardEntry = {
      ...entry,
      rank: idx + 1,
    };
    if (
      resolvedMyUid &&
      (entry.uid === resolvedMyUid || entry.uid === currentUser.id)
    ) {
      myRank = idx + 1;
      myEntry = withRank;
    }
    return withRank;
  });

  return {
    ranked,
    totalUsers: ranked.length,
    myRank,
    myEntry,
  };
}
