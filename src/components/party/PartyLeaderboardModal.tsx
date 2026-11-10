import React, { useState } from 'react';
import { User } from '../../types';
import { VipAvatarFrame } from '../brand/VipAvatarFrame';
import { LevelBadgeIcon } from '../brand/LevelBadgeIcon';
import {
  Trophy,
  Crown,
  Sparkles,
  X,
  Gift as GiftIcon,
  TrendingUp,
  Flame,
  Radio,
  ChevronRight,
} from 'lucide-react';

export interface PartyLeaderboardEntry {
  user: User;
  totalCoins: number;
  giftCount?: number;
  rank?: number;
  badge?: string;
  roomTitle?: string;
  roomId?: string;
  lastGiftName?: string;
  lastGiftIcon?: string;
}

interface PartyLeaderboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  sessionGivers: PartyLeaderboardEntry[];
  dailyTopGivers?: PartyLeaderboardEntry[];
  topHosts?: PartyLeaderboardEntry[];
  activeRoomTitle?: string;
  onSelectUser: (user: User) => void;
  onOpenGiftDrawer?: () => void;
  onJoinRoom?: (roomId: string) => void;
}

export const PartyLeaderboardModal: React.FC<PartyLeaderboardModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  sessionGivers,
  dailyTopGivers = [],
  topHosts = [],
  activeRoomTitle = 'Party Room',
  onSelectUser,
  onOpenGiftDrawer,
  onJoinRoom,
}) => {
  const [activeTab, setActiveTab] = useState<'session' | 'daily' | 'hosts'>('session');

  if (!isOpen) return null;

  // Active list based on tab
  const getActiveList = () => {
    if (activeTab === 'session') {
      return [...sessionGivers].sort((a, b) => b.totalCoins - a.totalCoins);
    }
    if (activeTab === 'daily') {
      return [...dailyTopGivers].sort((a, b) => b.totalCoins - a.totalCoins);
    }
    return [...topHosts].sort((a, b) => b.totalCoins - a.totalCoins);
  };

  const list = getActiveList();
  const top3 = list.slice(0, 3);
  const totalSessionCoins = sessionGivers.reduce((acc, g) => acc + g.totalCoins, 0);

  // Current user's rank in active list
  const currentUserIndex = list.findIndex((g) => g.user.id === currentUser.id);
  const currentUserEntry = currentUserIndex !== -1 ? list[currentUserIndex] : null;
  const currentUserRank = currentUserIndex !== -1 ? currentUserIndex + 1 : null;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex flex-col justify-end animate-fadeIn select-none">
      <div className="w-full max-w-md mx-auto rounded-t-3xl bg-[#140B28] border-t border-amber-500/40 p-4 pb-6 shadow-2xl flex flex-col max-h-[88vh] animate-slideUp">
        {/* ===================================================================
            HEADER: Trophy Icon + Title + Total Coins + Close
           =================================================================== */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-amber-500 via-yellow-400 to-amber-600 flex items-center justify-center text-black shadow-lg shadow-amber-500/30">
              <Trophy className="w-5 h-5 fill-current" />
            </div>
            <div>
              <h3 className="text-sm font-black text-white flex items-center gap-1.5">
                <span>Party Leaderboard</span>
                <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
              </h3>
              <p className="text-[10px] text-zinc-400">
                {activeTab === 'session'
                  ? `${activeRoomTitle} • Top Contributors`
                  : activeTab === 'daily'
                  ? 'Daily Top Supporters & Gifters'
                  : 'Top Party Room Hosts & Lounges'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="px-2.5 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-black flex items-center gap-1">
              <span>💰</span>
              <span>{totalSessionCoins.toLocaleString()}</span>
            </div>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-zinc-300 hover:text-white flex items-center justify-center cursor-pointer transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ===================================================================
            TAB SWITCHER: Room Session | Daily Top | Top Hosts
           =================================================================== */}
        <div className="grid grid-cols-3 gap-1.5 p-1 rounded-2xl bg-[#0C061A] border border-white/5 my-3">
          <button
            onClick={() => setActiveTab('session')}
            className={`py-1.5 rounded-xl text-[10.5px] font-black transition-all cursor-pointer flex items-center justify-center gap-1 ${
              activeTab === 'session'
                ? 'bg-gradient-to-r from-[#7928CA] to-[#EC4899] text-white shadow-md'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Sparkles className="w-3 h-3 text-amber-300" />
            <span>Room</span>
          </button>

          <button
            onClick={() => setActiveTab('daily')}
            className={`py-1.5 rounded-xl text-[10.5px] font-black transition-all cursor-pointer flex items-center justify-center gap-1 ${
              activeTab === 'daily'
                ? 'bg-gradient-to-r from-[#7928CA] to-[#EC4899] text-white shadow-md'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Flame className="w-3 h-3 text-rose-400" />
            <span>Daily</span>
          </button>

          <button
            onClick={() => setActiveTab('hosts')}
            className={`py-1.5 rounded-xl text-[10.5px] font-black transition-all cursor-pointer flex items-center justify-center gap-1 ${
              activeTab === 'hosts'
                ? 'bg-gradient-to-r from-[#7928CA] to-[#EC4899] text-white shadow-md'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Radio className="w-3 h-3 text-cyan-400" />
            <span>Hosts</span>
          </button>
        </div>

        {/* ===================================================================
            SCROLLABLE BODY: Olympic 3D Podium & Contenders
           =================================================================== */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-none">
          {/* 3D Olympic Podium: Rank 2 (Left), Rank 1 (Center Champion), Rank 3 (Right) */}
          {top3.length > 0 ? (
            <div className="pt-4 px-1">
              <div className="flex items-end justify-center gap-2 pt-6 pb-2">
                {/* RANK 2: SILVER (Left) */}
                {top3[1] ? (
                  <div
                    onClick={() => {
                      onSelectUser(top3[1].user);
                    }}
                    className="flex flex-col items-center flex-1 cursor-pointer group"
                  >
                    <div className="relative mb-1 flex items-center justify-center">
                      <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 text-lg z-20 drop-shadow">
                        🥈
                      </span>
                      <VipAvatarFrame
                        avatarUrl={top3[1].user.avatar}
                        vipTier={top3[1].user.vipTier || 2}
                        size="md"
                        showCrownBadge={false}
                      />
                    </div>
                    <div className="flex items-center justify-center gap-1 my-0.5 max-w-full">
                      <span className="text-[11px] font-black text-white truncate max-w-[70px] text-center">
                        {top3[1].user.displayName}
                      </span>
                      <LevelBadgeIcon level={top3[1].user.level || 15} size="xs" />
                    </div>
                    <span className="text-[10px] font-extrabold text-amber-400">
                      {top3[1].totalCoins.toLocaleString()} 💰
                    </span>
                    {/* 3D Silver Podium Box */}
                    <div className="w-full mt-2 h-16 rounded-t-xl bg-gradient-to-b from-slate-400/30 via-slate-600/30 to-slate-800/40 border-t-2 border-l border-r border-slate-300/50 flex flex-col items-center justify-center shadow-lg">
                      <span className="text-xl font-black text-slate-200">2</span>
                      <span className="text-[8px] text-slate-400 font-bold uppercase">Silver</span>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 h-20" />
                )}

                {/* RANK 1: GOLD (Center Champion) */}
                {top3[0] ? (
                  <div
                    onClick={() => {
                      onSelectUser(top3[0].user);
                    }}
                    className="flex flex-col items-center flex-1 -mt-5 cursor-pointer group"
                  >
                    <div className="relative mb-1 flex items-center justify-center">
                      <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-2xl animate-bounce z-20 filter drop-shadow-[0_0_8px_rgba(251,191,36,0.8)]">
                        👑
                      </div>
                      <VipAvatarFrame
                        avatarUrl={top3[0].user.avatar}
                        vipTier={top3[0].user.vipTier || 4}
                        size="lg"
                        showCrownBadge={true}
                      />
                    </div>
                    <div className="flex items-center justify-center gap-1 my-0.5 max-w-full">
                      <span className="text-xs font-black text-amber-300 truncate max-w-[85px] text-center">
                        {top3[0].user.displayName}
                      </span>
                      <LevelBadgeIcon level={top3[0].user.level || 45} size="xs" />
                    </div>
                    <span className="text-[11px] font-black text-yellow-300">
                      {top3[0].totalCoins.toLocaleString()} 💰
                    </span>
                    {/* 3D Gold Podium Box */}
                    <div className="w-full mt-2 h-22 rounded-t-2xl bg-gradient-to-b from-amber-500/40 via-yellow-600/35 to-amber-900/40 border-t-2 border-l border-r border-amber-400/80 flex flex-col items-center justify-center shadow-[0_0_30px_rgba(251,191,36,0.35)]">
                      <Crown className="w-4 h-4 text-amber-300 fill-current mb-0.5" />
                      <span className="text-2xl font-black text-amber-300">1</span>
                      <span className="text-[8.5px] text-amber-200 font-black uppercase tracking-wider">
                        Champion
                      </span>
                    </div>
                  </div>
                ) : null}

                {/* RANK 3: BRONZE (Right) */}
                {top3[2] ? (
                  <div
                    onClick={() => {
                      onSelectUser(top3[2].user);
                    }}
                    className="flex flex-col items-center flex-1 cursor-pointer group"
                  >
                    <div className="relative mb-1 flex items-center justify-center">
                      <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 text-lg z-20 drop-shadow">
                        🥉
                      </span>
                      <VipAvatarFrame
                        avatarUrl={top3[2].user.avatar}
                        vipTier={top3[2].user.vipTier || 1}
                        size="md"
                        showCrownBadge={false}
                      />
                    </div>
                    <div className="flex items-center justify-center gap-1 my-0.5 max-w-full">
                      <span className="text-[11px] font-black text-white truncate max-w-[70px] text-center">
                        {top3[2].user.displayName}
                      </span>
                      <LevelBadgeIcon level={top3[2].user.level || 8} size="xs" />
                    </div>
                    <span className="text-[10px] font-extrabold text-amber-400">
                      {top3[2].totalCoins.toLocaleString()} 💰
                    </span>
                    {/* 3D Bronze Podium Box */}
                    <div className="w-full mt-2 h-13 rounded-t-xl bg-gradient-to-b from-amber-700/30 via-orange-800/30 to-amber-950/40 border-t-2 border-l border-r border-amber-700/50 flex flex-col items-center justify-center shadow-lg">
                      <span className="text-xl font-black text-amber-600">3</span>
                      <span className="text-[8px] text-amber-400 font-bold uppercase">Bronze</span>
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
              <p className="text-xs font-bold text-white">No contributors ranked yet!</p>
              <p className="text-[11px] mt-1 text-zinc-400">
                Be the first to send a gift and claim Rank #1 👑
              </p>
            </div>
          )}

          {/* ===================================================================
              CONTENDERS LIST (Ranks 4 to 10)
             =================================================================== */}
          {list.length > 3 && (
            <div className="space-y-1.5 pt-1">
              <div className="text-[10px] font-black text-zinc-400 px-1 uppercase tracking-wider flex items-center justify-between">
                <span>Contenders (4 - 10)</span>
                <span>Contributions</span>
              </div>

              {list.slice(3, 10).map((entry, idx) => {
                const rank = idx + 4;
                const isCurrentUser = entry.user.id === currentUser.id;

                return (
                  <div
                    key={`${entry.user.id}_${idx}`}
                    onClick={() => onSelectUser(entry.user)}
                    className={`flex items-center justify-between p-2.5 rounded-2xl border transition-all cursor-pointer ${
                      isCurrentUser
                        ? 'bg-gradient-to-r from-purple-900/50 to-pink-900/40 border-pink-500/60 shadow-md'
                        : 'bg-[#190F30]/70 border-white/5 hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-5 text-center text-xs font-black text-zinc-400 shrink-0">
                        #{rank}
                      </span>
                      <div className="relative shrink-0">
                        <img
                          src={entry.user.avatar}
                          alt={entry.user.displayName}
                          className="w-9 h-9 rounded-full object-cover border border-white/10"
                        />
                        {entry.user.vipTier > 0 && (
                          <span className="absolute -bottom-1 -right-1 px-1 rounded bg-gradient-to-r from-amber-500 to-amber-700 text-[7px] font-black text-black">
                            V{entry.user.vipTier}
                          </span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-black text-white truncate max-w-[120px]">
                            {entry.user.displayName}
                          </span>
                          <LevelBadgeIcon level={entry.user.level || 12} size="xs" />
                          {isCurrentUser && (
                            <span className="px-1.5 py-0.2 rounded bg-pink-500/30 text-pink-300 text-[7.5px] font-black uppercase">
                              You
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-zinc-400 truncate">
                          {entry.giftCount ? `${entry.giftCount} gifts sent` : entry.roomTitle || 'Active supporter'}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-xs font-black text-amber-400">
                        +{entry.totalCoins.toLocaleString()} 💰
                      </div>
                      <div className="text-[9px] text-zinc-500 font-semibold">
                        {activeTab === 'hosts' ? 'Earned' : 'Gifted'}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ===================================================================
            CURRENT USER STATUS FOOTER & SEND GIFT TO CLIMB
           =================================================================== */}
        <div className="pt-3 border-t border-white/10 mt-2">
          <div className="flex items-center justify-between p-2.5 rounded-2xl bg-gradient-to-r from-[#221040] via-[#2A144E] to-[#1C0D34] border border-[#A855F7]/30 mb-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <img
                src={currentUser.avatar}
                alt={currentUser.displayName}
                className="w-8 h-8 rounded-full object-cover border border-amber-400 shrink-0"
              />
              <div className="min-w-0">
                <div className="text-xs font-black text-white flex items-center gap-1">
                  <span className="truncate max-w-[110px]">{currentUser.displayName}</span>
                  <span className="text-[10px] text-zinc-400 shrink-0">
                    {currentUserRank ? `(Rank #${currentUserRank})` : '(Not ranked yet)'}
                  </span>
                </div>
                <div className="text-[10px] text-amber-300 font-bold truncate">
                  {currentUserEntry
                    ? `${currentUserEntry.totalCoins.toLocaleString()} Coins Contributed`
                    : '0 Coins contributed this session'}
                </div>
              </div>
            </div>

            <div className="text-right shrink-0">
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
          {onOpenGiftDrawer && (
            <button
              onClick={() => {
                onClose();
                onOpenGiftDrawer();
              }}
              className="w-full py-2.5 rounded-2xl bg-gradient-to-r from-[#7928CA] via-[#9333EA] to-[#EC4899] text-white font-black text-xs shadow-lg shadow-[#7928CA]/50 hover:brightness-110 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <GiftIcon className="w-4 h-4 text-amber-300" />
              <span>Send Gift & Climb Party Leaderboard 🚀</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
