import React, { useState } from 'react';
import { User } from '../../types';
import { VipAvatarFrame } from '../brand/VipAvatarFrame';
import { LevelBadgeIcon } from '../brand/LevelBadgeIcon';
import {
  Trophy,
  Crown,
  Medal,
  Sparkles,
  ChevronRight,
  X,
  Gift as GiftIcon,
  Flame,
  TrendingUp,
} from 'lucide-react';

export interface SessionGiver {
  user: User;
  totalCoins: number;
  giftCount: number;
  lastGiftName?: string;
  lastGiftIcon?: string;
}

interface TopGiversLeaderboardProps {
  givers: SessionGiver[];
  currentUser: User;
  onSelectUser: (user: User) => void;
  onOpenGiftDrawer: () => void;
}

export const TopGiversLeaderboard: React.FC<TopGiversLeaderboardProps> = ({
  givers,
  currentUser,
  onSelectUser,
  onOpenGiftDrawer,
}) => {
  const [showFullModal, setShowFullModal] = useState(false);

  // Sort givers by total coins descending
  const sortedGivers = [...givers].sort((a, b) => b.totalCoins - a.totalCoins);
  const top3 = sortedGivers.slice(0, 3);
  const totalSessionCoins = sortedGivers.reduce((acc, g) => acc + g.totalCoins, 0);

  // Find current user's session rank
  const currentUserIndex = sortedGivers.findIndex((g) => g.user.id === currentUser.id);
  const currentUserStats = currentUserIndex !== -1 ? sortedGivers[currentUserIndex] : null;
  const currentUserRank = currentUserIndex !== -1 ? currentUserIndex + 1 : null;

  // Medals and styles for Top 3
  const rankStyles = [
    {
      badge: '🥇',
      label: '#1 Gold',
      glow: 'shadow-[0_0_15px_rgba(251,191,36,0.6)]',
      border: 'border-amber-400',
      bg: 'from-amber-500/30 via-yellow-400/20 to-amber-600/30',
      podiumBg: 'from-amber-500/40 to-yellow-600/40 border-amber-400',
      height: 'h-28',
      textGrad: 'from-amber-200 to-yellow-400',
      crownColor: 'text-yellow-400',
    },
    {
      badge: '🥈',
      label: '#2 Silver',
      glow: 'shadow-[0_0_15px_rgba(203,213,225,0.5)]',
      border: 'border-slate-300',
      bg: 'from-slate-400/30 via-zinc-300/20 to-slate-500/30',
      podiumBg: 'from-slate-400/30 to-zinc-600/30 border-slate-300',
      height: 'h-24',
      textGrad: 'from-slate-200 to-zinc-300',
      crownColor: 'text-slate-300',
    },
    {
      badge: '🥉',
      label: '#3 Bronze',
      glow: 'shadow-[0_0_15px_rgba(217,119,6,0.5)]',
      border: 'border-amber-700',
      bg: 'from-amber-700/30 via-orange-600/20 to-amber-900/30',
      podiumBg: 'from-amber-700/30 to-orange-800/30 border-amber-700',
      height: 'h-20',
      textGrad: 'from-amber-300 to-orange-400',
      crownColor: 'text-amber-600',
    },
  ];

  return (
    <>
      {/* =========================================================================
          1. COMPACT STREAM BAR WIDGET (Directly under Host Name)
          ========================================================================= */}
      <div className="relative z-20 flex items-center max-w-full">
        <div className="inline-flex items-center gap-1 p-0.5 pl-1.5 pr-1 rounded-full bg-black/75 backdrop-blur-md border border-amber-400/25 shadow-md hover:border-amber-400/50 transition-all max-w-full">
          {/* Trophy Header / Total coins */}
          <div
            onClick={() => setShowFullModal(true)}
            className="flex items-center gap-1 cursor-pointer hover:opacity-90 transition-opacity"
            title="View Full Top Givers Leaderboard"
          >
            <div className="w-4 h-4 rounded-full bg-gradient-to-tr from-amber-500 to-yellow-300 flex items-center justify-center text-black shadow shrink-0">
              <Trophy className="w-2.5 h-2.5 text-black fill-current" />
            </div>
            <div className="flex items-center gap-1 pr-1 border-r border-white/15">
              <span className="text-[8px] font-black text-amber-300 uppercase tracking-tight">
                Top
              </span>
              <span className="text-[8px] text-zinc-300 font-bold truncate">
                {totalSessionCoins >= 1000
                  ? `${(totalSessionCoins / 1000).toFixed(1)}k`
                  : totalSessionCoins}
              </span>
            </div>
          </div>

          {/* Top 3 Avatars Podium in Compact Bar */}
          <div className="flex items-center gap-1">
            {top3.map((giver, idx) => {
              const style = rankStyles[idx];
              const isCurrentUser = giver.user.id === currentUser.id;
              return (
                <div
                  key={giver.user.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectUser(giver.user);
                  }}
                  className={`group relative flex items-center gap-0.5 p-0.5 pr-1 rounded-full bg-white/5 hover:bg-white/15 border ${
                    style.border
                  } ${style.glow} cursor-pointer transition-all ${
                    isCurrentUser ? 'ring-1 ring-pink-500' : ''
                  }`}
                  title={`#${idx + 1} ${giver.user.displayName}: ${giver.totalCoins.toLocaleString()} coins`}
                >
                  {/* Rank Crown/Medal Badge */}
                  <span className="text-[9px] drop-shadow shrink-0">{style.badge}</span>

                  {/* Avatar */}
                  <img
                    src={giver.user.avatar}
                    alt={giver.user.displayName}
                    className="w-4 h-4 rounded-full object-cover shrink-0"
                  />

                  {/* Coins formatted */}
                  <span className="text-[8px] font-extrabold text-amber-300">
                    {giver.totalCoins >= 1000
                      ? `${(giver.totalCoins / 1000).toFixed(0)}k`
                      : giver.totalCoins}
                  </span>
                </div>
              );
            })}

            {top3.length === 0 && (
              <span className="text-[8px] text-zinc-400 italic px-1">No gifts yet</span>
            )}
          </div>

          {/* Expand Button / Chevron */}
          <button
            onClick={() => setShowFullModal(true)}
            className="w-4 h-4 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-zinc-300 hover:text-white cursor-pointer transition-colors shrink-0"
            title="Expand Full Leaderboard"
          >
            <ChevronRight className="w-2.5 h-2.5" />
          </button>
        </div>
      </div>

      {/* =========================================================================
          2. FULL TOP GIVERS LEADERBOARD MODAL
          ========================================================================= */}
      {showFullModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex flex-col justify-end animate-fade-in">
          <div className="w-full max-w-md mx-auto rounded-t-3xl bg-[#140C26] border-t border-amber-500/30 p-4 pb-6 shadow-2xl flex flex-col max-h-[85vh] animate-slide-up">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-500 to-yellow-300 flex items-center justify-center text-black shadow-lg">
                  <Trophy className="w-4 h-4 fill-current" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white flex items-center gap-1.5">
                    <span>Broadcast Top Givers</span>
                    <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                  </h3>
                  <p className="text-[10px] text-zinc-400">
                    Current Live Stream Session Leaderboard
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="px-2.5 py-1 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-black">
                  💰 {totalSessionCoins.toLocaleString()}
                </div>
                <button
                  onClick={() => setShowFullModal(false)}
                  className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-zinc-300 hover:text-white flex items-center justify-center cursor-pointer transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto py-3 space-y-4">
              {/* Olympic-style 3D Top 3 Podium (Rank 2, Rank 1, Rank 3) */}
              {top3.length > 0 ? (
                <div className="pt-2 px-2">
                  <div className="flex items-end justify-center gap-2 pt-6 pb-2">
                    {/* Rank 2 (Silver - Left) */}
                    {top3[1] ? (
                      <div
                        onClick={() => {
                          onSelectUser(top3[1].user);
                          setShowFullModal(false);
                        }}
                        className="flex flex-col items-center flex-1 cursor-pointer group"
                      >
                        <div className="relative mb-1 flex items-center justify-center">
                          <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-lg z-20">🥈</span>
                          <VipAvatarFrame
                            avatarUrl={top3[1].user.avatar}
                            vipTier={top3[1].user.vipTier || 2}
                            size="md"
                            showCrownBadge={false}
                          />
                        </div>
                        <div className="flex items-center justify-center gap-1 my-0.5">
                          <span className="text-[11px] font-black text-white truncate max-w-[70px] text-center">
                            {top3[1].user.displayName}
                          </span>
                          <LevelBadgeIcon level={top3[1].user.level || 15} size="xs" />
                        </div>
                        <span className="text-[10px] font-extrabold text-amber-400">
                          {top3[1].totalCoins.toLocaleString()} 💰
                        </span>
                        {/* Podium Box */}
                        <div className="w-full mt-2 h-16 rounded-t-xl bg-gradient-to-b from-slate-400/25 to-slate-700/40 border-t border-l border-r border-slate-300/40 flex items-center justify-center">
                          <span className="text-xl font-black text-slate-300">2</span>
                        </div>
                      </div>
                    ) : (
                      <div className="flex-1 h-20" />
                    )}

                    {/* Rank 1 (Gold - Center Champion) */}
                    {top3[0] ? (
                      <div
                        onClick={() => {
                          onSelectUser(top3[0].user);
                          setShowFullModal(false);
                        }}
                        className="flex flex-col items-center flex-1 -mt-4 cursor-pointer group"
                      >
                        <div className="relative mb-1 flex items-center justify-center">
                          <div className="absolute -top-5 left-1/2 -translate-x-1/2 text-2xl animate-bounce z-20">
                            👑
                          </div>
                          <VipAvatarFrame
                            avatarUrl={top3[0].user.avatar}
                            vipTier={top3[0].user.vipTier || 3}
                            size="lg"
                            showCrownBadge={true}
                          />
                        </div>
                        <div className="flex items-center justify-center gap-1 my-0.5">
                          <span className="text-xs font-black text-amber-300 truncate max-w-[85px] text-center">
                            {top3[0].user.displayName}
                          </span>
                          <LevelBadgeIcon level={top3[0].user.level || 42} size="xs" />
                        </div>
                        <span className="text-[11px] font-black text-yellow-300">
                          {top3[0].totalCoins.toLocaleString()} 💰
                        </span>
                        {/* Podium Box */}
                        <div className="w-full mt-2 h-22 rounded-t-2xl bg-gradient-to-b from-amber-500/35 to-yellow-700/40 border-t border-l border-r border-amber-400/60 flex flex-col items-center justify-center shadow-[0_0_25px_rgba(251,191,36,0.3)]">
                          <Crown className="w-4 h-4 text-amber-300 fill-current mb-0.5" />
                          <span className="text-2xl font-black text-amber-300">1</span>
                        </div>
                      </div>
                    ) : null}

                    {/* Rank 3 (Bronze - Right) */}
                    {top3[2] ? (
                      <div
                        onClick={() => {
                          onSelectUser(top3[2].user);
                          setShowFullModal(false);
                        }}
                        className="flex flex-col items-center flex-1 cursor-pointer group"
                      >
                        <div className="relative mb-1 flex items-center justify-center">
                          <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-lg z-20">🥉</span>
                          <VipAvatarFrame
                            avatarUrl={top3[2].user.avatar}
                            vipTier={top3[2].user.vipTier || 1}
                            size="md"
                            showCrownBadge={false}
                          />
                        </div>
                        <div className="flex items-center justify-center gap-1 my-0.5">
                          <span className="text-[11px] font-black text-white truncate max-w-[70px] text-center">
                            {top3[2].user.displayName}
                          </span>
                          <LevelBadgeIcon level={top3[2].user.level || 8} size="xs" />
                        </div>
                        <span className="text-[10px] font-extrabold text-amber-400">
                          {top3[2].totalCoins.toLocaleString()} 💰
                        </span>
                        {/* Podium Box */}
                        <div className="w-full mt-2 h-12 rounded-t-xl bg-gradient-to-b from-amber-700/25 to-amber-900/40 border-t border-l border-r border-amber-700/40 flex items-center justify-center">
                          <span className="text-xl font-black text-amber-600">3</span>
                        </div>
                      </div>
                    ) : (
                      <div className="flex-1 h-20" />
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-zinc-400">
                  <Trophy className="w-10 h-10 mx-auto text-zinc-600 mb-2" />
                  <p className="text-xs font-bold text-white">No gifts sent yet this session!</p>
                  <p className="text-[11px] mt-1">Be the first to send a gift and claim Rank #1 👑</p>
                </div>
              )}

              {/* Remaining Ranks List (Rank 4 to 10) */}
              {sortedGivers.length > 3 && (
                <div className="space-y-1.5 pt-2">
                  <div className="text-[11px] font-bold text-zinc-400 px-1 uppercase tracking-wider">
                    Contenders
                  </div>
                  {sortedGivers.slice(3, 10).map((giver, idx) => {
                    const rank = idx + 4;
                    const isCurrentUser = giver.user.id === currentUser.id;
                    return (
                      <div
                        key={giver.user.id}
                        onClick={() => {
                          onSelectUser(giver.user);
                          setShowFullModal(false);
                        }}
                        className={`flex items-center justify-between p-2.5 rounded-2xl border transition-all cursor-pointer ${
                          isCurrentUser
                            ? 'bg-gradient-to-r from-purple-900/40 to-pink-900/30 border-pink-500/50'
                            : 'bg-[#1C1236]/70 border-white/5 hover:border-white/20'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="w-6 text-center text-xs font-black text-zinc-400">
                            #{rank}
                          </span>
                          <div className="relative shrink-0">
                            <img
                              src={giver.user.avatar}
                              alt={giver.user.displayName}
                              className="w-9 h-9 rounded-full object-cover border border-white/10"
                            />
                            {giver.user.vipTier > 0 && (
                              <span className="absolute -bottom-1 -right-1 px-1 rounded bg-gradient-to-r from-amber-500 to-amber-700 text-[7px] font-black text-black">
                                V{giver.user.vipTier}
                              </span>
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-black text-white truncate">
                                {giver.user.displayName}
                              </span>
                              <LevelBadgeIcon level={giver.user.level || 12} size="xs" />
                              {isCurrentUser && (
                                <span className="px-1.5 py-0.2 rounded bg-pink-500/30 text-pink-300 text-[8px] font-black uppercase">
                                  You
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-zinc-400">
                              {giver.giftCount} gift{giver.giftCount > 1 ? 's' : ''} sent
                            </div>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <div className="text-xs font-black text-amber-400">
                            +{giver.totalCoins.toLocaleString()} 💰
                          </div>
                          <div className="text-[9px] text-zinc-400">Session</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Current User Session Status & Climb Action Footer */}
            <div className="pt-3 border-t border-white/10">
              <div className="flex items-center justify-between p-2.5 rounded-2xl bg-gradient-to-r from-[#22123F] via-[#2A164D] to-[#1E0F38] border border-[#A855F7]/30 mb-2">
                <div className="flex items-center gap-2.5">
                  <img
                    src={currentUser.avatar}
                    alt={currentUser.displayName}
                    className="w-8 h-8 rounded-full object-cover border border-amber-400"
                  />
                  <div>
                    <div className="text-xs font-black text-white flex items-center gap-1">
                      <span>{currentUser.displayName}</span>
                      <span className="text-[10px] text-zinc-400">
                        {currentUserRank ? `(Rank #${currentUserRank})` : '(Not on board yet)'}
                      </span>
                    </div>
                    <div className="text-[10px] text-amber-300 font-bold">
                      {currentUserStats
                        ? `${currentUserStats.totalCoins.toLocaleString()} Coins Contributed`
                        : '0 Coins Contributed this session'}
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  {currentUserRank && currentUserRank <= 3 ? (
                    <span className="px-2 py-1 rounded-full bg-gradient-to-r from-amber-500 to-yellow-500 text-black text-[9px] font-black flex items-center gap-1 shadow">
                      <Crown className="w-3 h-3 fill-current" />
                      <span>TOP 3 PODIUM</span>
                    </span>
                  ) : (
                    <span className="text-[10px] text-pink-400 font-bold flex items-center gap-1">
                      <TrendingUp className="w-3.5 h-3.5" />
                      <span>Climb Board</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Action Button: Send Gift to Climb */}
              <button
                onClick={() => {
                  setShowFullModal(false);
                  onOpenGiftDrawer();
                }}
                className="w-full py-3 rounded-2xl bg-gradient-to-r from-[#7928CA] via-[#9333EA] to-[#EC4899] text-white font-black text-xs shadow-lg shadow-[#7928CA]/50 hover:brightness-110 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <GiftIcon className="w-4 h-4" />
                <span>Send Gift & Climb Top Givers 🚀</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
