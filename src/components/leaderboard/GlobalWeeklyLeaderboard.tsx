import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Clock,
  Crown,
  Gift,
  Globe,
  RefreshCw,
  Search,
  Sparkles,
  Trophy,
  Users,
  X,
  ChevronRight,
  Calendar,
  ArrowUpRight,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { PullToRefresh, RefreshScopeButton } from '../common/PullToRefresh';
import {
  LeaderboardMetric,
  LeaderboardMonthView,
  LeaderboardScope,
} from '../../types';
import {
  buildMergedLeaderboardList,
  formatDurationMinutes,
  formatMonthLabel,
  formatWeekLabel,
  getCountdownUntilMonthReset,
  getCountdownUntilWeekReset,
  RankedLeaderboardEntry,
} from '../../services/leaderboardService';
import { UserBadgeStrip } from '../badges/UserBadgeIcon';

const AVATAR_GRADIENTS = [
  'from-[#7928CA] to-[#EC4899]',
  'from-[#2563EB] to-[#7C3AED]',
  'from-[#059669] to-[#0284C7]',
  'from-[#D97706] to-[#E11D48]',
  'from-[#9333EA] to-[#06B6D4]',
  'from-[#DB2777] to-[#F59E0B]',
];

function getInitials(name: string): string {
  const parts = String(name || 'AM')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return 'AM';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
}

function getGradientClass(uid: string): string {
  let sum = 0;
  for (let i = 0; i < uid.length; i += 1) {
    sum += uid.charCodeAt(i);
  }
  return AVATAR_GRADIENTS[sum % AVATAR_GRADIENTS.length];
}

function formatCompactNumber(num: number): string {
  const n = Math.round(Number(num) || 0);
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

export const LeaderboardAvatar: React.FC<{
  name: string;
  avatar?: string;
  uid: string;
  sizeClass?: string;
  textClass?: string;
  ringClass?: string;
}> = ({
  name,
  avatar,
  uid,
  sizeClass = 'w-10 h-10',
  textClass = 'text-xs',
  ringClass = 'border border-white/15',
}) => {
  const [imgFailed, setImgFailed] = useState(false);
  const hasValidAvatar = Boolean(avatar && avatar.trim() && !imgFailed);

  if (hasValidAvatar) {
    return (
      <img
        src={avatar}
        alt={name}
        referrerPolicy="no-referrer"
        onError={() => setImgFailed(true)}
        className={`${sizeClass} rounded-full object-cover shrink-0 ${ringClass}`}
      />
    );
  }

  return (
    <div
      aria-label={name}
      className={`${sizeClass} rounded-full bg-gradient-to-br ${getGradientClass(
        uid
      )} flex items-center justify-center font-black text-white shrink-0 select-none ${textClass} ${ringClass}`}
    >
      {getInitials(name)}
    </div>
  );
};

// =========================================================================
// EMBEDDED SPOTLIGHT CARD (FOR HOME & PROFILE)
// =========================================================================

export const LeaderboardSpotlightCard: React.FC<{
  variant?: 'home' | 'profile';
}> = ({ variant = 'home' }) => {
  const {
    currentUser,
    firebaseUser,
    leaderboardMonthKey,
    leaderboardWeekKey,
    firestoreLeaderboardEntries,
    localLeaderboardOverrides,
    openLeaderboard,
    userHistoricalStats,
  } = useApp();

  const [scope, setScope] = useState<LeaderboardScope>('global');

  const { ranked, totalUsers, myRank, myEntry } = useMemo(
    () =>
      buildMergedLeaderboardList({
        firestoreEntries: firestoreLeaderboardEntries,
        localOverrides: localLeaderboardOverrides,
        currentUser,
        activeUid: firebaseUser?.uid || currentUser.id,
        monthKey: leaderboardMonthKey,
        currentWeekKey: leaderboardWeekKey,
        scope,
        metric: 'overall',
        isCurrentMonth: true,
      }),
    [
      firestoreLeaderboardEntries,
      localLeaderboardOverrides,
      currentUser,
      firebaseUser?.uid,
      leaderboardMonthKey,
      leaderboardWeekKey,
      scope,
    ]
  );

  const topThree = ranked.slice(0, 3);
  const resetInfo =
    scope === 'weekly'
      ? getCountdownUntilWeekReset()
      : getCountdownUntilMonthReset();

  return (
    <section
      aria-label="Global and Weekly Leaderboard"
      className={variant === 'home' ? 'px-4 pt-2 pb-1' : 'px-4 mt-3.5'}
    >
      <div className="rounded-3xl bg-gradient-to-b from-[#170F30] to-[#110A23] border border-[#A855F7]/25 p-3.5 shadow-xl shadow-black/40">
        {/* Header Row */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <Trophy className="w-4 h-4 text-amber-400 shrink-0" />
              <h2 className="text-xs sm:text-sm font-black tracking-tight text-white truncate">
                {scope === 'global' ? 'Global Leaderboard' : 'Weekly Leaderboard'}
              </h2>
            </div>
            <p className="text-[10.5px] text-zinc-400 mt-0.5 tabular-nums truncate">
              {totalUsers} users ·{' '}
              {scope === 'global'
                ? `${formatMonthLabel(leaderboardMonthKey)} · Resets in ${resetInfo.formatted}`
                : `${formatWeekLabel(leaderboardWeekKey)} · Resets in ${resetInfo.formatted}`}
            </p>
          </div>

          {/* Interactive Scope Toggle */}
          <div className="flex items-center rounded-xl bg-[#0B0716] border border-white/10 p-0.5 shrink-0">
            <button
              type="button"
              onClick={() => setScope('global')}
              className={`min-h-[34px] px-2.5 rounded-[10px] text-[11px] font-bold transition-colors cursor-pointer ${
                scope === 'global'
                  ? 'bg-gradient-to-r from-[#7928CA] to-[#EC4899] text-white shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Global
            </button>
            <button
              type="button"
              onClick={() => setScope('weekly')}
              className={`min-h-[34px] px-2.5 rounded-[10px] text-[11px] font-bold transition-colors cursor-pointer ${
                scope === 'weekly'
                  ? 'bg-gradient-to-r from-[#7928CA] to-[#EC4899] text-white shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Weekly
            </button>
          </div>
        </div>

        {/* Top 3 Preview Rows */}
        <div className="space-y-2">
          {topThree.map((entry, idx) => {
            const medalColors =
              idx === 0
                ? 'bg-amber-400/15 text-amber-300 border-amber-400/35'
                : idx === 1
                ? 'bg-zinc-300/15 text-zinc-200 border-zinc-300/30'
                : 'bg-orange-400/15 text-orange-300 border-orange-400/30';

            return (
              <button
                key={entry.uid}
                type="button"
                onClick={() => openLeaderboard(scope)}
                className="w-full min-h-[52px] px-2.5 py-2 rounded-2xl bg-[#0D081B]/80 hover:bg-[#1C1238] border border-white/5 hover:border-[#A855F7]/30 flex items-center justify-between gap-2.5 text-left transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className={`w-6 h-6 rounded-lg border text-[11px] font-black flex items-center justify-center shrink-0 tabular-nums ${medalColors}`}
                  >
                    {idx + 1}
                  </span>
                  <LeaderboardAvatar
                    name={entry.displayName}
                    avatar={entry.avatar}
                    uid={entry.uid}
                    sizeClass="w-8 h-8"
                    textClass="text-[11px]"
                    ringClass={
                      idx === 0
                        ? 'border-2 border-amber-400'
                        : 'border border-white/15'
                    }
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-white truncate">
                        {entry.displayName}
                      </span>
                      <UserBadgeStrip
                        badgeIds={
                          entry.uid === (firebaseUser?.uid || currentUser.id)
                            ? userHistoricalStats.equippedBadgeIds
                            : entry.equippedBadgeIds
                        }
                        earnedBadges={
                          entry.uid === (firebaseUser?.uid || currentUser.id)
                            ? userHistoricalStats.earnedBadges
                            : undefined
                        }
                        size="xs"
                      />
                      {entry.countryFlag && (
                        <span className="text-[11px] shrink-0">{entry.countryFlag}</span>
                      )}
                    </div>
                    <p className="text-[10px] text-zinc-400 tabular-nums truncate">
                      {formatCompactNumber(entry.displayGiftsCoins)} gifts ·{' '}
                      {formatDurationMinutes(entry.displayTimeMinutes)} active
                    </p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="text-xs font-black text-amber-300 tabular-nums">
                    {formatCompactNumber(entry.displayScore)}
                  </div>
                  <div className="text-[9.5px] text-zinc-500 font-semibold">pts</div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Your Rank + Open Full Top 100+ Button */}
        <div className="mt-2.5 pt-2.5 border-t border-white/10 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <span className="text-[10.5px] text-zinc-400 block">Your Rank</span>
            <span className="text-xs font-black text-white tabular-nums truncate block">
              {myRank ? `#${myRank}` : 'Unranked'} ·{' '}
              {formatCompactNumber(myEntry?.displayGiftsCoins || 0)} coins ·{' '}
              {formatDurationMinutes(myEntry?.displayTimeMinutes || 0)}
            </span>
          </div>

          <button
            type="button"
            onClick={() => openLeaderboard(scope)}
            className="min-h-[44px] px-3.5 rounded-xl bg-gradient-to-r from-[#7928CA] to-[#EC4899] hover:brightness-110 active:scale-[0.98] text-white text-xs font-bold flex items-center gap-1 shrink-0 transition-all cursor-pointer shadow-md shadow-[#7928CA]/30"
          >
            <span>Top {totalUsers}</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </section>
  );
};

// =========================================================================
// FULL TOP 100+ INTERACTIVE GLOBAL & WEEKLY LEADERBOARD MODAL
// =========================================================================

export const GlobalWeeklyLeaderboardModal: React.FC = () => {
  const {
    showLeaderboardModal,
    setShowLeaderboardModal,
    leaderboardInitialScope,
    currentUser,
    firebaseUser,
    leaderboardMonthKey,
    leaderboardPreviousMonthKey,
    leaderboardWeekKey,
    firestoreLeaderboardEntries,
    previousMonthLeaderboardEntries,
    localLeaderboardOverrides,
    previousMonthLocalOverrides,
    loadPreviousMonthLeaderboard,
    userHistoricalStats,
    refreshScope,
  } = useApp();

  const [scope, setScope] = useState<LeaderboardScope>(leaderboardInitialScope);
  const [metric, setMetric] = useState<LeaderboardMetric>('overall');
  const [monthView, setMonthView] = useState<LeaderboardMonthView>('current');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [loadingPrevMonth, setLoadingPrevMonth] = useState<boolean>(false);

  const myRowRef = useRef<HTMLDivElement | null>(null);
  const listContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (showLeaderboardModal) {
      setScope(leaderboardInitialScope);
    }
  }, [showLeaderboardModal, leaderboardInitialScope]);

  const handleSelectMonthView = async (view: LeaderboardMonthView) => {
    setMonthView(view);
    if (view === 'previous') {
      setScope('global');
      setLoadingPrevMonth(true);
      await loadPreviousMonthLeaderboard().catch(() => {});
      setLoadingPrevMonth(false);
    }
  };

  const activeMonthKey =
    monthView === 'previous' ? leaderboardPreviousMonthKey : leaderboardMonthKey;
  const isCurrentMonth = monthView === 'current';

  const { ranked, totalUsers, myRank, myEntry } = useMemo(
    () =>
      buildMergedLeaderboardList({
        firestoreEntries:
          monthView === 'previous'
            ? previousMonthLeaderboardEntries
            : firestoreLeaderboardEntries,
        localOverrides:
          monthView === 'previous'
            ? previousMonthLocalOverrides
            : localLeaderboardOverrides,
        currentUser,
        activeUid: firebaseUser?.uid || currentUser.id,
        monthKey: activeMonthKey,
        currentWeekKey: leaderboardWeekKey,
        scope: monthView === 'previous' ? 'global' : scope,
        metric,
        isCurrentMonth,
      }),
    [
      monthView,
      previousMonthLeaderboardEntries,
      firestoreLeaderboardEntries,
      previousMonthLocalOverrides,
      localLeaderboardOverrides,
      currentUser,
      firebaseUser?.uid,
      activeMonthKey,
      leaderboardWeekKey,
      scope,
      metric,
      isCurrentMonth,
    ]
  );

  const filteredEntries = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return ranked;
    return ranked.filter(
      (item) =>
        item.displayName.toLowerCase().includes(q) ||
        item.username.toLowerCase().includes(q) ||
        item.uniqueId.toLowerCase().includes(q)
    );
  }, [ranked, searchTerm]);

  if (!showLeaderboardModal) return null;

  const isSearching = searchTerm.trim().length > 0;
  const showPodium = !isSearching && filteredEntries.length >= 3;
  const podium = showPodium ? filteredEntries.slice(0, 3) : [];
  const listRows = showPodium ? filteredEntries.slice(3) : filteredEntries;

  const resetInfo =
    scope === 'weekly' && isCurrentMonth
      ? getCountdownUntilWeekReset()
      : getCountdownUntilMonthReset();

  const myUid = firebaseUser?.uid || currentUser.id;

  const scrollToMyRow = () => {
    if (myRowRef.current) {
      myRowRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else if (listContainerRef.current) {
      listContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Alpha Mate Global and Weekly Leaderboard"
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-end sm:items-center justify-center sm:p-4"
    >
      <div className="w-full sm:max-w-xl h-[92dvh] sm:h-[88dvh] rounded-t-3xl sm:rounded-3xl bg-[#0D0919] border border-[#A855F7]/30 shadow-2xl flex flex-col overflow-hidden">
        {/* Top Header */}
        <div className="px-4 pt-4 pb-3 border-b border-white/10 bg-gradient-to-b from-[#1A1035] to-[#0D0919] shrink-0">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-400 via-[#EC4899] to-[#7928CA] flex items-center justify-center text-white shadow-lg shrink-0">
                <Trophy className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h2 className="text-base font-black text-white tracking-tight truncate">
                  Alpha Mate Leaderboard
                </h2>
                <p className="text-[11px] text-zinc-400 tabular-nums truncate">
                  {totalUsers} Ranked Users ·{' '}
                  {isCurrentMonth
                    ? scope === 'weekly'
                      ? `${formatWeekLabel(leaderboardWeekKey)} · Resets in ${resetInfo.formatted}`
                      : `${formatMonthLabel(activeMonthKey)} · Monthly refresh in ${resetInfo.formatted}`
                    : `${formatMonthLabel(activeMonthKey)} · Past Month Archive`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <RefreshScopeButton scope="leaderboard" compact className="w-11 h-11 rounded-2xl" title="Refresh rankings" />
              <button
                type="button"
                onClick={() => setShowLeaderboardModal(false)}
                aria-label="Close leaderboard"
                className="w-11 h-11 rounded-2xl bg-white/5 hover:bg-white/15 border border-white/10 flex items-center justify-center text-zinc-300 hover:text-white transition-colors cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Primary Scope Toggle: Global (Monthly) vs Weekly + 1-Month Archive Toggle */}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex-1 min-w-[200px] grid grid-cols-2 rounded-2xl bg-[#090612] border border-white/10 p-1">
              <button
                type="button"
                onClick={() => {
                  setMonthView('current');
                  setScope('global');
                }}
                className={`min-h-[40px] px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  isCurrentMonth && scope === 'global'
                    ? 'bg-gradient-to-r from-[#7928CA] to-[#EC4899] text-white shadow-md'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Globe className="w-3.5 h-3.5" />
                <span>Global (Monthly)</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setMonthView('current');
                  setScope('weekly');
                }}
                className={`min-h-[40px] px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  isCurrentMonth && scope === 'weekly'
                    ? 'bg-gradient-to-r from-[#7928CA] to-[#EC4899] text-white shadow-md'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Weekly</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() =>
                handleSelectMonthView(
                  monthView === 'current' ? 'previous' : 'current'
                )
              }
              className={`min-h-[44px] px-3 rounded-2xl border text-[11px] font-bold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 ${
                monthView === 'previous'
                  ? 'bg-amber-400/15 border-amber-400/50 text-amber-300'
                  : 'bg-[#140E27] border-white/10 text-zinc-300 hover:text-white'
              }`}
              title="Retains up to 1 month of previous rankings"
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>
                {monthView === 'previous'
                  ? 'Viewing Last Month'
                  : formatMonthLabel(leaderboardPreviousMonthKey)}
              </span>
            </button>
          </div>

          {/* Metric Filter Row: Combined Score | Received Gifts | Time Spent */}
          <div className="mt-2.5 grid grid-cols-3 gap-1.5">
            {(
              [
                { id: 'overall', label: 'Combined', icon: Trophy },
                { id: 'gifts', label: 'Gifts Received', icon: Gift },
                { id: 'time', label: 'Time Spent', icon: Clock },
              ] as const
            ).map((tab) => {
              const Icon = tab.icon;
              const active = metric === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setMetric(tab.id)}
                  className={`min-h-[40px] px-2 rounded-xl border text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                    active
                      ? 'bg-[#251749] border-[#A855F7]/60 text-white'
                      : 'bg-[#120C22] border-white/5 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <Icon
                    className={`w-3.5 h-3.5 shrink-0 ${
                      active ? 'text-[#EC4899]' : 'text-zinc-500'
                    }`}
                  />
                  <span className="truncate">{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Search Input */}
          <div className="mt-2.5 relative">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={`Search across ${totalUsers} users by name, @username or AM ID...`}
              className="w-full h-11 pl-10 pr-9 rounded-2xl bg-[#090612] border border-white/10 focus:border-[#A855F7] text-xs text-white placeholder-zinc-500 focus:outline-none"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                aria-label="Clear search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full hover:bg-white/10 flex items-center justify-center text-zinc-400 hover:text-white cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="mt-2 flex items-center justify-between text-[10px] text-zinc-400">
            <span>Score = 1 pt per Gift Coin + 25 pts per active minute</span>
            <span className="flex items-center gap-1 text-zinc-300 font-semibold">
              <RefreshCw className="w-3 h-3 text-[#A855F7]" />
              <span>Refreshes monthly (UTC)</span>
            </span>
          </div>
        </div>

        {/* Scrollable Rankings Content */}
        <div
          ref={listContainerRef}
          className="flex-1 overflow-y-auto overscroll-contain px-4 py-3 space-y-3"
        >
          <PullToRefresh
            scrollContainerRef={listContainerRef}
            label="Refreshing rankings..."
            onRefresh={() => refreshScope('leaderboard')}
          />
          {loadingPrevMonth ? (
            <div className="py-12 text-center text-xs text-zinc-400">
              Loading {formatMonthLabel(activeMonthKey)} rankings...
            </div>
          ) : (
            <>
              {/* Top 3 Podium (shown when not filtering by search) */}
              {podium.length === 3 && (
                <div className="grid grid-cols-3 gap-2 items-end pt-2 pb-1">
                  {/* #2 Silver */}
                  <PodiumCard
                    entry={podium[1]}
                    place={2}
                    myUid={myUid}
                    myBadgeIds={userHistoricalStats.equippedBadgeIds}
                    myEarnedBadges={userHistoricalStats.earnedBadges}
                  />
                  {/* #1 Gold */}
                  <PodiumCard
                    entry={podium[0]}
                    place={1}
                    myUid={myUid}
                    myBadgeIds={userHistoricalStats.equippedBadgeIds}
                    myEarnedBadges={userHistoricalStats.earnedBadges}
                  />
                  {/* #3 Bronze */}
                  <PodiumCard
                    entry={podium[2]}
                    place={3}
                    myUid={myUid}
                    myBadgeIds={userHistoricalStats.equippedBadgeIds}
                    myEarnedBadges={userHistoricalStats.earnedBadges}
                  />
                </div>
              )}

              {/* Ranked Rows List */}
              {listRows.length === 0 ? (
                <div className="py-12 px-4 rounded-2xl bg-[#130C24] border border-white/10 text-center">
                  <Users className="w-8 h-8 text-zinc-500 mx-auto mb-2" />
                  <p className="text-xs font-bold text-white">No matching users found</p>
                  <p className="text-[11px] text-zinc-400 mt-1">
                    Try another display name, @handle, or unique Alpha Mate ID.
                  </p>
                </div>
              ) : (
                <div className="space-y-1.5 pb-2">
                  {listRows.map((entry) => {
                    const isMe = entry.uid === myUid;
                    return (
                      <div
                        key={entry.uid}
                        ref={isMe ? myRowRef : undefined}
                        className={`min-h-[60px] px-3 py-2 rounded-2xl border flex items-center justify-between gap-2.5 transition-colors ${
                          isMe
                            ? 'bg-gradient-to-r from-[#7928CA]/25 to-[#EC4899]/20 border-[#EC4899]/60'
                            : 'bg-[#130D24] border-white/5 hover:border-[#A855F7]/25'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className={`w-8 text-center font-black text-xs tabular-nums shrink-0 ${
                              entry.rank <= 10
                                ? 'text-amber-300'
                                : 'text-zinc-400'
                            }`}
                          >
                            #{entry.rank}
                          </div>

                          <LeaderboardAvatar
                            name={entry.displayName}
                            avatar={entry.avatar}
                            uid={entry.uid}
                            sizeClass="w-10 h-10"
                            textClass="text-xs"
                            ringClass={
                              isMe
                                ? 'border-2 border-[#EC4899]'
                                : 'border border-white/15'
                            }
                          />

                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-bold text-white truncate">
                                {entry.displayName}
                              </span>
                              <UserBadgeStrip
                                badgeIds={isMe ? userHistoricalStats.equippedBadgeIds : entry.equippedBadgeIds}
                                earnedBadges={isMe ? userHistoricalStats.earnedBadges : undefined}
                                size="xs"
                              />
                              {isMe && (
                                <span className="text-[10px] font-black text-[#EC4899] shrink-0">
                                  YOU
                                </span>
                              )}
                              {entry.countryFlag && (
                                <span className="text-[11px] shrink-0">
                                  {entry.countryFlag}
                                </span>
                              )}
                            </div>
                            <p className="text-[10.5px] text-zinc-400 tabular-nums truncate">
                              @{entry.username} · Lv.{entry.level}
                              {entry.vipTier > 0 ? ` · VIP ${entry.vipTier}` : ''}
                            </p>
                          </div>
                        </div>

                        <div className="text-right shrink-0 space-y-0.5">
                          <div className="text-xs font-black text-white tabular-nums">
                            {metric === 'gifts'
                              ? `${formatCompactNumber(entry.displayGiftsCoins)} Coins`
                              : metric === 'time'
                              ? formatDurationMinutes(entry.displayTimeMinutes)
                              : `${formatCompactNumber(entry.displayScore)} pts`}
                          </div>
                          <div className="text-[10px] text-zinc-400 tabular-nums">
                            {formatCompactNumber(entry.displayGiftsCoins)} 🎁 ·{' '}
                            {formatDurationMinutes(entry.displayTimeMinutes)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>

        {/* Sticky My Rank Footer */}
        {myEntry && (
          <div className="px-4 py-3 border-t border-white/10 bg-[#150E2B] flex items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-[#7928CA]/40 to-[#EC4899]/40 border border-[#EC4899]/50 text-xs font-black text-white tabular-nums shrink-0">
                #{myRank}
              </div>
              <LeaderboardAvatar
                name={myEntry.displayName}
                avatar={myEntry.avatar}
                uid={myEntry.uid}
                sizeClass="w-9 h-9"
                textClass="text-[11px]"
                ringClass="border border-[#EC4899]"
              />
              <div className="min-w-0">
                <div className="text-xs font-bold text-white truncate">
                  {myEntry.displayName} (You)
                </div>
                <div className="text-[10.5px] text-zinc-300 tabular-nums truncate">
                  {formatCompactNumber(myEntry.displayGiftsCoins)} gift coins ·{' '}
                  {formatDurationMinutes(myEntry.displayTimeMinutes)} ·{' '}
                  {formatCompactNumber(myEntry.displayScore)} pts
                </div>
              </div>
            </div>

            {!isSearching && myRank && myRank > 3 && (
              <button
                type="button"
                onClick={scrollToMyRow}
                className="min-h-[40px] px-3 rounded-xl bg-white/10 hover:bg-white/20 text-white text-[11px] font-bold flex items-center gap-1 shrink-0 cursor-pointer transition-colors"
              >
                <span>Locate</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const PodiumCard: React.FC<{
  entry: RankedLeaderboardEntry;
  place: 1 | 2 | 3;
  myUid: string;
  myBadgeIds: ReturnType<typeof useApp>['userHistoricalStats']['equippedBadgeIds'];
  myEarnedBadges: ReturnType<typeof useApp>['userHistoricalStats']['earnedBadges'];
}> = ({ entry, place, myUid, myBadgeIds, myEarnedBadges }) => {
  const isFirst = place === 1;
  const isMe = entry.uid === myUid;

  const borderClass =
    place === 1
      ? 'border-amber-400/60 bg-gradient-to-b from-amber-500/20 via-[#1D123B] to-[#130C26]'
      : place === 2
      ? 'border-zinc-300/40 bg-gradient-to-b from-zinc-300/10 via-[#191032] to-[#120B23]'
      : 'border-orange-400/40 bg-gradient-to-b from-orange-500/15 via-[#191032] to-[#120B23]';

  const rankBadgeClass =
    place === 1
      ? 'bg-amber-400 text-amber-950'
      : place === 2
      ? 'bg-zinc-200 text-zinc-900'
      : 'bg-orange-400 text-orange-950';

  return (
    <div
      className={`rounded-2xl border p-2.5 text-center flex flex-col items-center ${borderClass} ${
        isFirst ? 'pb-3.5' : 'mt-3'
      }`}
    >
      <div className="relative mb-2">
        {isFirst && (
          <Crown className="w-5 h-5 text-amber-400 fill-amber-400 mx-auto mb-1" />
        )}
        <LeaderboardAvatar
          name={entry.displayName}
          avatar={entry.avatar}
          uid={entry.uid}
          sizeClass={isFirst ? 'w-14 h-14' : 'w-11 h-11'}
          textClass={isFirst ? 'text-sm' : 'text-xs'}
          ringClass={
            place === 1
              ? 'border-2 border-amber-400'
              : place === 2
              ? 'border-2 border-zinc-300'
              : 'border-2 border-orange-400'
          }
        />
        <span
          className={`absolute -bottom-1.5 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded-md text-[10px] font-black tabular-nums shadow ${rankBadgeClass}`}
        >
          #{place}
        </span>
      </div>

      <div className="mt-1 w-full min-w-0">
        <div className="text-[11px] font-black text-white truncate">
          {entry.displayName}
        </div>
        {(isMe ? myBadgeIds : entry.equippedBadgeIds)?.length ? (
          <div className="mt-0.5 flex justify-center">
            <UserBadgeStrip
              badgeIds={isMe ? myBadgeIds : entry.equippedBadgeIds}
              earnedBadges={isMe ? myEarnedBadges : undefined}
              size="xs"
            />
          </div>
        ) : null}
        {isMe && (
          <div className="text-[9px] font-black text-[#EC4899] uppercase">You</div>
        )}
        <div className="text-xs font-black text-amber-300 tabular-nums mt-0.5">
          {formatCompactNumber(entry.displayScore)} pts
        </div>
        <div className="text-[9.5px] text-zinc-400 tabular-nums mt-0.5 truncate">
          {formatCompactNumber(entry.displayGiftsCoins)} 🎁
        </div>
        <div className="text-[9.5px] text-zinc-400 tabular-nums truncate">
          {formatDurationMinutes(entry.displayTimeMinutes)}
        </div>
      </div>
    </div>
  );
};
