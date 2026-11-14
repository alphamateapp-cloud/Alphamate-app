import React, { useMemo, useState } from 'react';
import {
  Award,
  Check,
  ChevronRight,
  Lock,
  Sparkles,
  X,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { UserBadgeId, UserBadgeTier } from '../../types';
import { UserBadgeIcon, UserBadgeStrip } from './UserBadgeIcon';
import { MAX_EQUIPPED_BADGES } from '../../services/badgeService';

const TIER_LABEL: Record<UserBadgeTier, string> = {
  bronze: 'Bronze',
  silver: 'Silver',
  gold: 'Gold',
  mythic: 'Mythic',
};

const TIER_TEXT_COLOR: Record<UserBadgeTier, string> = {
  bronze: 'text-amber-400',
  silver: 'text-slate-200',
  gold: 'text-yellow-300',
  mythic: 'text-pink-300',
};

function formatMetric(value: number, unit: string): string {
  const n = Math.round(Number(value) || 0);
  if (unit === 'min') {
    if (n < 60) return `${n}m`;
    const h = Math.floor(n / 60);
    const m = n % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }
  return `${n.toLocaleString()} ${unit}`.trim();
}

export const ProfileBadgeShowcase: React.FC = () => {
  const {
    evaluatedBadges,
    userHistoricalStats,
    openBadgesModal,
  } = useApp();

  const unlockedCount = evaluatedBadges.filter((b) => b.unlocked).length;
  const totalCount = evaluatedBadges.length;

  // Pick top 4 badges prioritizing equipped, unlocked, then closest to unlocking
  const previewBadges = useMemo(() => {
    return [...evaluatedBadges]
      .sort((a, b) => {
        if (a.isEquipped !== b.isEquipped) return a.isEquipped ? -1 : 1;
        if (a.unlocked !== b.unlocked) return a.unlocked ? -1 : 1;
        return b.progressPercent - a.progressPercent;
      })
      .slice(0, 4);
  }, [evaluatedBadges]);

  return (
    <div className="mt-3 p-3 rounded-2xl bg-[#160E2C] border border-[#A855F7]/25">
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <Award className="w-4 h-4 text-amber-400 shrink-0" />
            <h3 className="text-xs font-black text-white truncate">
              Profile Badges
            </h3>
          </div>
          <p className="text-[10.5px] text-zinc-400 tabular-nums mt-0.5 truncate">
            {unlockedCount} of {totalCount} earned · {userHistoricalStats.equippedBadgeIds.length}/{MAX_EQUIPPED_BADGES} shown on profile
          </p>
        </div>

        <button
          type="button"
          onClick={openBadgesModal}
          className="min-h-[40px] px-3 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-bold text-white flex items-center gap-1 shrink-0 transition-colors cursor-pointer"
        >
          <span>Badge Vault</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {previewBadges.map((item) => (
          <button
            key={item.definition.id}
            type="button"
            onClick={openBadgesModal}
            className={`min-h-[68px] p-2 rounded-xl border text-left flex items-center gap-2 transition-colors cursor-pointer ${
              item.unlocked
                ? item.isEquipped
                  ? 'bg-[#221445] border-amber-400/50'
                  : 'bg-[#120A24] border-white/10 hover:border-[#A855F7]/40'
                : 'bg-[#0C0718] border-white/5 opacity-80 hover:opacity-100'
            }`}
          >
            <UserBadgeIcon
              badgeId={item.definition.id}
              tier={item.tier || 'bronze'}
              size="md"
              locked={!item.unlocked}
            />
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-bold text-white truncate">
                {item.definition.shortLabel}
              </div>
              <div className="text-[10px] text-zinc-400 tabular-nums truncate">
                {item.unlocked
                  ? item.isEquipped
                    ? `Equipped · ${TIER_LABEL[item.tier || 'bronze']}`
                    : `${TIER_LABEL[item.tier || 'bronze']} Tier`
                  : `${item.progressPercent}%`}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

export const UserBadgesModal: React.FC = () => {
  const {
    showBadgesModal,
    setShowBadgesModal,
    currentUser,
    evaluatedBadges,
    userHistoricalStats,
    toggleEquipUserBadge,
  } = useApp();

  const [filter, setFilter] = useState<'all' | 'earned' | 'locked'>('all');
  const [notice, setNotice] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (filter === 'earned') return evaluatedBadges.filter((b) => b.unlocked);
    if (filter === 'locked') return evaluatedBadges.filter((b) => !b.unlocked);
    return evaluatedBadges;
  }, [evaluatedBadges, filter]);

  if (!showBadgesModal) return null;

  const unlockedCount = evaluatedBadges.filter((b) => b.unlocked).length;

  const handleToggleEquip = (badgeId: UserBadgeId, badgeName: string) => {
    const res = toggleEquipUserBadge(badgeId);
    setNotice(res.message || `Updated ${badgeName}`);
    setTimeout(() => setNotice(null), 2400);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="User Achievement Badges"
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-end sm:items-center justify-center sm:p-4"
    >
      <div className="w-full sm:max-w-xl h-[90dvh] sm:h-[86dvh] rounded-t-3xl sm:rounded-3xl bg-[#0D0919] border border-[#A855F7]/30 shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-4 pt-4 pb-3 border-b border-white/10 bg-gradient-to-b from-[#1A1035] to-[#0D0919] shrink-0">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#7928CA] via-[#EC4899] to-amber-400 flex items-center justify-center text-white shadow-lg shrink-0">
                <Award className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h2 className="text-base font-black text-white tracking-tight truncate">
                  User Badge Vault
                </h2>
                <p className="text-[11px] text-zinc-400 tabular-nums truncate">
                  {unlockedCount} / {evaluatedBadges.length} Badges Unlocked · Equip up to {MAX_EQUIPPED_BADGES} profile icons
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowBadgesModal(false)}
              aria-label="Close badge vault"
              className="w-11 h-11 rounded-2xl bg-white/5 hover:bg-white/15 border border-white/10 flex items-center justify-center text-zinc-300 hover:text-white transition-colors cursor-pointer shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Live Equipped Profile Preview */}
          <div className="mt-3 p-3 rounded-2xl bg-[#130C26] border border-white/10 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <span className="text-[10.5px] text-zinc-400 block">
                Live Profile Icon Preview
              </span>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="text-sm font-black text-white truncate">
                  {currentUser.displayName}
                </span>
                <UserBadgeStrip
                  badgeIds={userHistoricalStats.equippedBadgeIds}
                  earnedBadges={userHistoricalStats.earnedBadges}
                  size="sm"
                />
                {userHistoricalStats.equippedBadgeIds.length === 0 && (
                  <span className="text-[11px] text-zinc-500">
                    No badges equipped yet
                  </span>
                )}
              </div>
            </div>
            <div className="text-right shrink-0 tabular-nums">
              <span className="text-xs font-black text-amber-300 block">
                {userHistoricalStats.equippedBadgeIds.length}/{MAX_EQUIPPED_BADGES}
              </span>
              <span className="text-[10px] text-zinc-400">Equipped</span>
            </div>
          </div>

          {/* Historical Metrics Driving Badge Unlocks */}
          <div className="mt-2.5 grid grid-cols-4 gap-1.5 text-center">
            <div className="py-1.5 px-2 rounded-xl bg-[#090612] border border-white/5">
              <div className="text-xs font-black text-white tabular-nums">
                {userHistoricalStats.totalGiftCoinsSent.toLocaleString()}
              </div>
              <div className="text-[9.5px] text-zinc-400">Coins Sent</div>
            </div>
            <div className="py-1.5 px-2 rounded-xl bg-[#090612] border border-white/5">
              <div className="text-xs font-black text-white tabular-nums">
                {formatMetric(userHistoricalStats.partyRoomMinutes, 'min')}
              </div>
              <div className="text-[9.5px] text-zinc-400">Party Time</div>
            </div>
            <div className="py-1.5 px-2 rounded-xl bg-[#090612] border border-white/5">
              <div className="text-xs font-black text-white tabular-nums">
                {formatMetric(userHistoricalStats.totalActiveMinutes, 'min')}
              </div>
              <div className="text-[9.5px] text-zinc-400">Active Time</div>
            </div>
            <div className="py-1.5 px-2 rounded-xl bg-[#090612] border border-white/5">
              <div className="text-xs font-black text-white tabular-nums">
                {userHistoricalStats.bestLeaderboardRank
                  ? `#${userHistoricalStats.bestLeaderboardRank}`
                  : '—'}
              </div>
              <div className="text-[9.5px] text-zinc-400">Best Rank</div>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="mt-2.5 grid grid-cols-3 rounded-2xl bg-[#090612] border border-white/10 p-1">
            {(
              [
                { id: 'all', label: `All (${evaluatedBadges.length})` },
                { id: 'earned', label: `Earned (${unlockedCount})` },
                {
                  id: 'locked',
                  label: `In Progress (${evaluatedBadges.length - unlockedCount})`,
                },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setFilter(t.id)}
                className={`min-h-[38px] px-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                  filter === t.id
                    ? 'bg-gradient-to-r from-[#7928CA] to-[#EC4899] text-white'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {notice && (
            <div className="mt-2 py-1.5 px-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-200 text-xs font-bold text-center">
              {notice}
            </div>
          )}
        </div>

        {/* Badge List */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-3 space-y-2.5">
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-xs text-zinc-400">
              {filter === 'earned'
                ? 'Keep gifting, attending Party Rooms, and staying active to unlock your first badge.'
                : 'You have unlocked every available User Badge!'}
            </div>
          ) : (
            filtered.map((item) => {
              const { definition, unlocked, tier, currentValue, targetValue, progressPercent, unlockedAt, isEquipped } =
                item;

              return (
                <div
                  key={definition.id}
                  className={`p-3.5 rounded-2xl border transition-colors ${
                    unlocked
                      ? isEquipped
                        ? 'bg-[#1C1238] border-amber-400/50'
                        : 'bg-[#140E27] border-white/10'
                      : 'bg-[#0F0A1E] border-white/5'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <UserBadgeIcon
                        badgeId={definition.id}
                        tier={tier || 'bronze'}
                        size="lg"
                        locked={!unlocked}
                      />

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm font-black text-white">
                            {definition.name}
                          </h3>
                          {unlocked && tier ? (
                            <span
                              className={`text-[11px] font-bold ${TIER_TEXT_COLOR[tier]}`}
                            >
                              · {TIER_LABEL[tier]} Tier
                            </span>
                          ) : (
                            <span className="text-[11px] font-semibold text-zinc-500 flex items-center gap-1">
                              <Lock className="w-3 h-3" />
                              <span>Locked</span>
                            </span>
                          )}
                        </div>

                        <p className="text-[11px] text-zinc-400 mt-0.5 leading-snug">
                          {definition.description}
                        </p>
                        <p className="text-[10.5px] text-zinc-300 mt-1 tabular-nums">
                          {definition.requirementLabel}
                        </p>
                      </div>
                    </div>

                    {unlocked && (
                      <button
                        type="button"
                        onClick={() => handleToggleEquip(definition.id, definition.name)}
                        className={`min-h-[44px] px-3 rounded-xl text-xs font-bold flex items-center gap-1 shrink-0 transition-colors cursor-pointer ${
                          isEquipped
                            ? 'bg-amber-400 text-amber-950 font-black'
                            : 'bg-gradient-to-r from-[#7928CA] to-[#EC4899] text-white hover:brightness-110'
                        }`}
                      >
                        {isEquipped ? (
                          <>
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                            <span>Equipped</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>Equip</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>

                  {/* Progress & Historical Footer */}
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-[10.5px] text-zinc-400 tabular-nums mb-1">
                      <span>
                        Progress: {formatMetric(currentValue, definition.unit)} /{' '}
                        {formatMetric(targetValue, definition.unit)}
                      </span>
                      <span>
                        {unlocked && unlockedAt
                          ? `Earned ${new Date(unlockedAt).toLocaleDateString()}`
                          : `${progressPercent}%`}
                      </span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-black/60 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-200"
                        style={{
                          width: `${progressPercent}%`,
                          background: unlocked
                            ? `linear-gradient(90deg, ${definition.accentFrom}, ${definition.accentTo})`
                            : '#52525B',
                        }}
                      />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
