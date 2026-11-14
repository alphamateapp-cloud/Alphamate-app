import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { PullToRefresh } from '../components/common/PullToRefresh';
import { VIP_TIER_CONFIGS, VipAvatarFrame, VipTierConfig } from '../components/brand/VipAvatarFrame';
import {
  ALL_LEVELS_1_TO_100,
  LEVEL_TIER_GROUPS,
  formatCoinsCompact,
  getLevelConfig,
  getNextLevelConfig,
  getNextVipUnlockInfo,
  LevelConfig,
} from '../data/levelData';
import {
  ArrowLeft,
  Trophy,
  Crown,
  Flame,
  Sparkles,
  Check,
  Lock,
  Star,
  ShoppingBag,
  Zap,
  Shield,
  ChevronRight,
  Target,
  Coins,
  ArrowUpRight,
  Filter,
  Image as ImageIcon,
  X,
} from 'lucide-react';
import { LevelBadgeIcon } from '../components/brand/LevelBadgeIcon';

export const LevelSystemScreen: React.FC = () => {
  const { currentUser, navigateBack, setCurrentScreen, updateUserProfile, refreshScope } = useApp();
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const [selectedTab, setSelectedTab] = useState<'levels' | 'vips' | 'tiers' | 'leaderboard'>('levels');
  const [tierFilter, setTierFilter] = useState<
    | 'ALL'
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
    | 'Legend'
  >('ALL');
  const [activeLeaderboard, setActiveLeaderboard] = useState<'Daily' | 'Weekly' | 'AllTime'>('Daily');
  const [showChartModal, setShowChartModal] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const currentLevelRef = useRef<HTMLDivElement>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  // Current level details & next level calculation from CSV
  const currentLvlConfig = getLevelConfig(currentUser.level);
  const nextLvlConfig = getNextLevelConfig(currentUser.level);
  const nextVipInfo = getNextVipUnlockInfo(currentUser.level, currentUser.coins);

  // Coins needed for next level
  const totalCoinsNeededForNextLevel = nextLvlConfig ? nextLvlConfig.totalCumulativeCoins : currentLvlConfig.totalCumulativeCoins;
  const additionalCoinsForNext = nextLvlConfig ? nextLvlConfig.additionalCoins : 0;
  
  // Progress percentage to next level
  const currentLvlBaseCoins = currentLvlConfig.totalCumulativeCoins;
  const progressRatio = nextLvlConfig && additionalCoinsForNext > 0
    ? Math.min(100, Math.max(10, Math.round(((currentUser.xp % additionalCoinsForNext) / additionalCoinsForNext) * 100)))
    : 100;

  // Filtered levels for tab 1
  const filteredLevels = ALL_LEVELS_1_TO_100.filter((item) => {
    if (tierFilter === 'ALL') return true;
    return item.tier === tierFilter;
  });

  // Jump to current user level in the 1-100 list
  const scrollToMyLevel = () => {
    setTierFilter('ALL');
    setTimeout(() => {
      currentLevelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  };

  const leaderboardUsers = [
    { rank: 1, name: 'Luna Star 🌙', level: 98, vipTier: 12, coins: '1,906,000,000', tier: 'Master' },
    { rank: 2, name: 'DJ Kairo 🔥', level: 82, vipTier: 10, coins: '1,297,000,000', tier: 'Diamond' },
    { rank: 3, name: 'QueenBee 👑', level: 65, vipTier: 8, coins: '861,000,000', tier: 'Platinum' },
    { rank: 4, name: `${currentUser.displayName} (You)`, level: currentUser.level, vipTier: currentUser.vipTier, coins: formatCoinsCompact(currentLvlConfig.totalCumulativeCoins), tier: currentLvlConfig.tier },
    { rank: 5, name: 'Electro Dance 💃', level: 24, vipTier: 3, coins: '6,000,000', tier: 'Silver' },
  ];

  return (
    <div
      ref={scrollContainerRef}
      className="relative w-full h-full min-h-screen pb-32 bg-[#09070F] text-white overflow-y-auto"
    >
      <PullToRefresh
        scrollContainerRef={scrollContainerRef}
        label="Refreshing levels..."
        onRefresh={() => refreshScope('levels')}
      />
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 px-5 py-2.5 rounded-full bg-[#180E2C]/95 border border-[#A855F7]/40 text-white text-xs font-bold shadow-2xl backdrop-blur-md flex items-center gap-2 animate-bounce pointer-events-none">
          <Sparkles className="w-4 h-4 text-amber-300" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Header */}
      <div className="sticky top-0 z-30 w-full bg-[#09070F]/90 backdrop-blur-md border-b border-[#A855F7]/15 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={navigateBack}
            className="w-8 h-8 rounded-full bg-[#1A1133] flex items-center justify-center text-zinc-300 hover:text-white cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-base font-black text-white flex items-center gap-1.5">
              <span>Levels 0 – 100 & 12 VIPs</span>
            </h1>
            <p className="text-[10px] text-zinc-400">Official Coin Target & VIP Unlock Progression</p>
          </div>
        </div>

        {/* Quick Link to Store */}
        <button
          onClick={() => setCurrentScreen('store')}
          className="flex items-center gap-1 px-3 py-1 rounded-full bg-gradient-to-r from-[#7928CA] to-[#EC4899] text-white text-xs font-bold shadow-md shadow-[#7928CA]/40 cursor-pointer hover:brightness-110 active:scale-95 transition-all"
        >
          <ShoppingBag className="w-3.5 h-3.5" />
          <span>Store</span>
        </button>
      </div>

      {/* =========================================================================
          SECTION 1: USER PROGRESSION CARD WITH EXACT REQUIRED COINS FOR NEXT LEVEL
         ========================================================================= */}
      <div className="p-4">
        <div className="relative rounded-3xl p-4 sm:p-5 overflow-hidden bg-gradient-to-tr from-[#1E0F38] via-[#33175E] to-[#140A28] border border-[#A855F7]/30 shadow-2xl">
          {/* Ambient Corner Aura */}
          <div className="absolute top-0 right-0 w-48 h-48 bg-[#EC4899]/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-[#7928CA]/25 rounded-full blur-3xl pointer-events-none" />

          {/* Top user row */}
          <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3.5">
            <div className="flex items-center gap-3">
              <VipAvatarFrame
                avatarUrl={currentUser.avatar}
                vipTier={currentUser.vipTier}
                size="md"
                showCrownBadge={true}
              />
              <div>
                <span className="text-[10px] font-black text-amber-400 uppercase tracking-wider flex items-center gap-1">
                  <Crown className="w-3.5 h-3.5 fill-amber-400" />
                  <span>VIP {currentUser.vipTier} • {currentLvlConfig.tier} Tier {currentLvlConfig.tierBadge}</span>
                </span>
                <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
                  <span>Level {currentUser.level}</span>
                  <span className="text-xs sm:text-sm text-zinc-400 font-normal">/ 100</span>
                </h2>
              </div>
            </div>

            {/* Quick jump to level button */}
            <button
              onClick={scrollToMyLevel}
              className="self-start sm:self-auto px-3 py-1 rounded-xl bg-[#221340] border border-[#A855F7]/40 text-[#C084FC] hover:text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
            >
              <Target className="w-3.5 h-3.5 text-amber-400" />
              <span>Locate My Level</span>
            </button>
          </div>

          {/* Detailed Coins Required Card */}
          <div className="relative p-3 rounded-2xl bg-black/45 border border-white/10 mb-3 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-400 flex items-center gap-1">
                <Coins className="w-3.5 h-3.5 text-amber-400" />
                <span>Current Total Target:</span>
              </span>
              <span className="font-mono font-bold text-amber-300">
                {currentLvlConfig.totalCumulativeCoins.toLocaleString()} Coins
              </span>
            </div>

            {nextLvlConfig ? (
              <>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-300 flex items-center gap-1 font-semibold">
                    <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Next Level {nextLvlConfig.level} Target:</span>
                  </span>
                  <span className="font-mono font-extrabold text-white">
                    {nextLvlConfig.totalCumulativeCoins.toLocaleString()} Coins
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] pt-1 border-t border-white/5">
                  <span className="text-[#C084FC] font-bold">
                    Additional Coins Required:
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                    +{additionalCoinsForNext.toLocaleString()} Coins
                  </span>
                </div>
              </>
            ) : (
              <div className="text-center text-xs text-amber-300 font-bold">
                👑 Maximum Level 100 Reached! Alpha Emperor Prestige
              </div>
            )}
          </div>

          {/* XP Progress Bar towards next level */}
          <div className="relative w-full h-3 rounded-full bg-black/60 overflow-hidden p-[1.5px] border border-white/10 mb-2">
            <div
              className="h-full bg-gradient-to-r from-[#7928CA] via-[#A855F7] to-[#EC4899] rounded-full transition-all duration-500 shadow-[0_0_12px_#A855F7]"
              style={{ width: `${progressRatio}%` }}
            />
          </div>

          {/* Next VIP Unlock Banner */}
          <div className="flex items-center justify-between text-[10.5px] sm:text-[11px] text-zinc-300 font-medium">
            <span>Level {currentUser.level}</span>
            {nextVipInfo && !nextVipInfo.isMaxVip ? (
              <span className="text-amber-300 font-bold flex items-center gap-1">
                <Crown className="w-3 h-3 text-amber-400 fill-amber-400" />
                <span>Next VIP {nextVipInfo.nextVipTier} at Level {nextVipInfo.targetLevel} ({formatCoinsCompact(nextVipInfo.requiredCoins)} Coins)</span>
              </span>
            ) : (
              <span className="text-amber-300 font-bold">All 12 VIP Tiers Unlocked! 👑</span>
            )}
            <span>Lv.100</span>
          </div>
        </div>
      </div>

      {/* =========================================================================
          SECTION 2: SUB-NAVIGATION TABS (100 Levels | 12 VIPs | 11 Tiers | Hall of Fame)
         ========================================================================= */}
      <div className="px-4 mb-3">
        <div className="grid grid-cols-4 gap-1 p-1 rounded-2xl bg-[#140A26] border border-white/5 text-center">
          <button
            onClick={() => setSelectedTab('levels')}
            className={`py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              selectedTab === 'levels'
                ? 'bg-gradient-to-r from-[#7928CA] to-[#EC4899] text-white shadow-md'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            0 – 100 Roadmap
          </button>
          <button
            onClick={() => setSelectedTab('vips')}
            className={`py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              selectedTab === 'vips'
                ? 'bg-gradient-to-r from-[#7928CA] to-[#EC4899] text-white shadow-md'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            12 VIP Frames
          </button>
          <button
            onClick={() => setSelectedTab('tiers')}
            className={`py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              selectedTab === 'tiers'
                ? 'bg-gradient-to-r from-[#7928CA] to-[#EC4899] text-white shadow-md'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            11 Honor Tiers
          </button>
          <button
            onClick={() => setSelectedTab('leaderboard')}
            className={`py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              selectedTab === 'leaderboard'
                ? 'bg-gradient-to-r from-[#7928CA] to-[#EC4899] text-white shadow-md'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Hall of Fame
          </button>
        </div>
      </div>

      {/* =========================================================================
          TAB 1: COMPLETE 0 TO 100 LEVELS SCROLLABLE ROADMAP
         ========================================================================= */}
      {selectedTab === 'levels' && (
        <div className="px-4 space-y-3">
          {/* Tier Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {(
              [
                'ALL',
                'Normal',
                'Bronze',
                'Silver',
                'Gold',
                'Platinum',
                'Sapphire',
                'Emerald',
                'Ruby',
                'Amethyst',
                'Diamond',
                'Master',
                'Legend',
              ] as const
            ).map((tier) => (
              <button
                key={tier}
                onClick={() => setTierFilter(tier)}
                className={`px-3 py-1 rounded-full text-[10.5px] font-bold whitespace-nowrap cursor-pointer transition-all ${
                  tierFilter === tier
                    ? 'bg-gradient-to-r from-[#7928CA] to-[#EC4899] text-white shadow-md'
                    : 'bg-[#160D2A] text-zinc-400 hover:text-white border border-white/5'
                }`}
              >
                {tier === 'ALL' ? 'All (0–100)' : tier}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between text-xs text-zinc-400 px-1">
            <span>Scrollable roadmap from Level 0 to 100</span>
            <div className="flex items-center gap-2">
              <span className="text-amber-400 font-bold">Showing {filteredLevels.length} Levels</span>
              <button
                onClick={() => setShowChartModal(true)}
                className="px-2.5 py-0.5 rounded-full bg-gradient-to-r from-amber-500/20 to-yellow-500/20 border border-amber-400/40 text-amber-300 text-[10px] font-bold flex items-center gap-1 cursor-pointer hover:bg-amber-500/30 active:scale-95 transition-all shadow-xs"
                title="View Full Official Badge Chart"
              >
                <ImageIcon className="w-3 h-3 text-amber-300" />
                <span>Chart</span>
              </button>
            </div>
          </div>

          {/* 1 to 100 Levels Scrollable List */}
          <div className="space-y-2.5">
            {filteredLevels.map((lvl) => {
              const isCurrent = currentUser.level === lvl.level;
              const isCompleted = currentUser.level > lvl.level;
              const isLocked = currentUser.level < lvl.level;
              const unlocksVip = lvl.unlockedVipTier;

              return (
                <div
                  key={lvl.level}
                  ref={isCurrent ? currentLevelRef : undefined}
                  className={`relative p-3.5 rounded-2xl border transition-all ${
                    isCurrent
                      ? 'bg-gradient-to-r from-[#2F1555] via-[#1B0B33] to-[#120824] border-[#EC4899] shadow-lg shadow-[#EC4899]/25 ring-2 ring-[#EC4899]/50'
                      : isCompleted
                      ? 'bg-[#140C26] border-white/10'
                      : 'bg-[#100820] border-white/5 opacity-80'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    {/* Level Number & Tier Badge */}
                    <div className="flex items-center gap-3">
                      {/* Official Level Badge SVG Icon */}
                      <div className="shrink-0">
                        <LevelBadgeIcon level={lvl.level} size="md" />
                      </div>

                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-black text-white">
                            Level {lvl.level}
                          </span>
                          <span
                            className="px-1.5 py-0.2 rounded text-[9px] font-black border"
                            style={{
                              borderColor: `${lvl.tierColor}60`,
                              backgroundColor: `${lvl.tierColor}20`,
                              color: lvl.tierColor,
                            }}
                          >
                            {lvl.tierBadge} {lvl.tier}
                          </span>
                        </div>

                        {/* Cumulative Coins Target */}
                        <div className="flex items-center gap-2 text-[11px] text-zinc-300 mt-0.5">
                          <span className="font-mono font-bold text-amber-300">
                            💰 {lvl.totalCumulativeCoins.toLocaleString()} Coins
                          </span>
                          <span className="text-zinc-500">•</span>
                          <span className="text-zinc-400">
                            {lvl.level === 0
                              ? 'Starting Rank (0 Coins)'
                              : `+${lvl.additionalCoins.toLocaleString()} from Lv.${lvl.level - 1}`}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Status Pill */}
                    <div>
                      {isCurrent ? (
                        <span className="px-2.5 py-1 rounded-full bg-[#EC4899] text-white text-[10px] font-black shadow-md flex items-center gap-1 animate-pulse">
                          <Zap className="w-3 h-3 fill-white" />
                          <span>CURRENT</span>
                        </span>
                      ) : isCompleted ? (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold flex items-center gap-1 border border-emerald-500/30">
                          <Check className="w-3 h-3" />
                          <span>PASSED</span>
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 text-[10px] font-bold flex items-center gap-1 border border-white/5">
                          <Lock className="w-3 h-3" />
                          <span>LOCKED</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* VIP Unlock Special Banner (Levels 8, 16, 24, 32, 40, 48, 56, 64, 72, 80, 88, 96) */}
                  {unlocksVip && (
                    <div className="mt-2.5 pt-2 border-t border-white/10 flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Crown className="w-3.5 h-3.5 text-amber-400 fill-amber-400 animate-bounce" />
                        <span className="text-[11px] font-extrabold text-amber-300">
                          ⭐ Unlocks VIP {unlocksVip} Avatar Frame & Privileges!
                        </span>
                      </div>
                      <button
                        onClick={() => setSelectedTab('vips')}
                        className="text-[10px] text-[#C084FC] hover:text-white font-bold underline cursor-pointer"
                      >
                        View VIP Frame →
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 2: 12 VIP FRAMES & UNLOCK REQUIREMENTS (EVERY 8 LEVELS)
         ========================================================================= */}
      {selectedTab === 'vips' && (
        <div className="px-4 space-y-3">
          <div className="flex items-center justify-between text-xs text-zinc-400 px-1">
            <span>Every 8 levels permanently unlocks a luxury VIP avatar frame</span>
            <button
              onClick={() => setCurrentScreen('store')}
              className="text-[#EC4899] font-bold hover:underline cursor-pointer"
            >
              VIP Store →
            </button>
          </div>

          <div className="space-y-3">
            {VIP_TIER_CONFIGS.map((vip) => {
              const isUnlocked = currentUser.level >= vip.requiredLevel;
              const isEquipped = currentUser.vipTier === vip.tier;
              const levelsLeft = Math.max(0, vip.requiredLevel - currentUser.level);
              const coinsLeft = Math.max(0, vip.requiredCoins - currentLvlConfig.totalCumulativeCoins);

              return (
                <div
                  key={vip.tier}
                  className={`p-4 rounded-3xl border transition-all ${
                    isEquipped
                      ? 'bg-gradient-to-r from-[#2F1455] via-[#1B0B33] to-[#120824] border-[#EC4899] shadow-xl shadow-[#EC4899]/25 ring-1 ring-[#EC4899]'
                      : isUnlocked
                      ? 'bg-[#150D2A] border-[#A855F7]/30'
                      : 'bg-[#100820] border-white/5 opacity-75'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    {/* Left: SVGA Animated Avatar Frame Preview */}
                    <div className="flex items-center gap-3.5">
                      <VipAvatarFrame
                        avatarUrl={currentUser.avatar}
                        vipTier={vip.tier}
                        size="md"
                        showCrownBadge={true}
                      />

                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-black text-white">{vip.name}</h3>
                          <span
                            className="text-[10px] font-black px-2 py-0.2 rounded-full text-black shadow-xs"
                            style={{ backgroundColor: vip.crownColor }}
                          >
                            VIP {vip.tier}
                          </span>
                        </div>

                        {/* Required Level & Target Coins from CSV */}
                        <div className="text-[11px] text-zinc-300 mt-0.5 space-y-0.5">
                          <div className="flex items-center gap-1.5 font-bold text-amber-300">
                            <span>Unlocks at Level {vip.requiredLevel}</span>
                            <span>•</span>
                            <span className="font-mono font-extrabold">{vip.requiredCoins.toLocaleString()} Coins</span>
                          </div>
                          <p className="text-[10.5px] text-zinc-400 leading-snug">{vip.description}</p>
                        </div>
                      </div>
                    </div>

                    {/* Right: Equip / Unlock Status */}
                    <div className="shrink-0 flex flex-col items-end gap-1.5">
                      {isEquipped ? (
                        <span className="px-2.5 py-1 rounded-full bg-gradient-to-r from-[#7928CA] to-[#EC4899] text-white text-[10px] font-black shadow-sm">
                          EQUIPPED
                        </span>
                      ) : isUnlocked ? (
                        <button
                          onClick={() => {
                            updateUserProfile({ vipTier: vip.tier });
                            showToast(`Equipped VIP ${vip.tier} Frame! 👑`);
                          }}
                          className="px-3 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-black cursor-pointer shadow-md transition-all active:scale-95"
                        >
                          Equip
                        </button>
                      ) : (
                        <div className="text-right">
                          <span className="px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 text-[9.5px] font-bold flex items-center gap-1 border border-white/5">
                            <Lock className="w-2.5 h-2.5" />
                            <span>Lv.{vip.requiredLevel} Required</span>
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Locked Remaining Distance info */}
                  {!isUnlocked && (
                    <div className="mt-3 pt-2.5 border-t border-white/5 flex items-center justify-between text-[10.5px] text-zinc-400">
                      <span className="text-zinc-300">
                        Remaining: <span className="font-bold text-white">{levelsLeft} Levels</span> & <span className="font-mono font-bold text-amber-400">{coinsLeft.toLocaleString()} Coins</span>
                      </span>
                      <button
                        onClick={() => setCurrentScreen('store')}
                        className="text-[#C084FC] hover:text-white font-bold underline cursor-pointer"
                      >
                        Buy in Store ({vip.priceCoins.toLocaleString()} 💰)
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 3: 11 HONOR PRESTIGE TIERS (Levels 0 to 100)
         ========================================================================= */}
      {selectedTab === 'tiers' && (
        <div className="px-4 space-y-3">
          <div className="flex items-center justify-between text-xs text-zinc-400 px-1">
            <span>Official 11 Honor Prestige Tiers</span>
            <span className="text-amber-400 font-bold">Cap: Lv.100 (2B Coins)</span>
          </div>

          <div className="space-y-3">
            {LEVEL_TIER_GROUPS.map((tier) => {
              const isCurrent = currentUser.level >= tier.minLevel && currentUser.level <= tier.maxLevel;
              const isUnlocked = currentUser.level >= tier.minLevel;

              return (
                <div
                  key={tier.name}
                  className={`p-4 rounded-3xl border transition-all ${
                    isCurrent
                      ? 'bg-gradient-to-r from-[#2B1450] to-[#170A2E] border-[#EC4899] shadow-lg shadow-[#EC4899]/20 ring-1 ring-[#EC4899]/40'
                      : isUnlocked
                      ? 'bg-[#150D28] border-white/10'
                      : 'bg-[#100820] border-white/5 opacity-60'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2.5">
                      <div className="shrink-0">
                        <LevelBadgeIcon level={tier.minLevel} size="md" />
                      </div>
                      <div>
                        <h3 className="text-sm font-black text-white flex items-center gap-1.5">
                          <span>{tier.name}</span>
                          <span className="text-xs text-zinc-400">({tier.tagline})</span>
                        </h3>
                        <span className="text-[11px] text-[#C084FC] font-semibold">
                          Levels {tier.minLevel} – {tier.maxLevel}
                        </span>
                      </div>
                    </div>

                    {isCurrent ? (
                      <span className="px-2.5 py-0.5 rounded-full bg-[#EC4899] text-white text-[10px] font-black shadow-sm">
                        CURRENT TIER
                      </span>
                    ) : isUnlocked ? (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold flex items-center gap-1">
                        <Check className="w-3 h-3" /> COMPLETED
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 text-[10px] font-bold flex items-center gap-1">
                        <Lock className="w-3 h-3" /> LOCKED
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-zinc-300 leading-snug mt-1">{tier.perks}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 4: HALL OF FAME LEADERBOARD
         ========================================================================= */}
      {selectedTab === 'leaderboard' && (
        <div className="px-4 space-y-3">
          <div className="flex items-center justify-between p-1 rounded-2xl bg-[#140A26] border border-white/5">
            {(['Daily', 'Weekly', 'AllTime'] as const).map((period) => (
              <button
                key={period}
                onClick={() => setActiveLeaderboard(period)}
                className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeLeaderboard === period
                    ? 'bg-gradient-to-r from-[#7928CA] to-[#EC4899] text-white shadow-md'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                {period === 'AllTime' ? 'All Time' : period}
              </button>
            ))}
          </div>

          <div className="space-y-2.5">
            {leaderboardUsers.map((u) => (
              <div
                key={u.rank}
                className={`p-3 rounded-2xl border flex items-center justify-between ${
                  u.rank === 1
                    ? 'bg-gradient-to-r from-amber-950/40 via-[#1F103A] to-[#120824] border-amber-500/40 shadow-md'
                    : u.rank === 4
                    ? 'bg-[#2A1450]/40 border-[#A855F7]/40'
                    : 'bg-[#140C26] border-white/5'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`w-6 text-center font-black text-sm ${
                      u.rank === 1
                        ? 'text-amber-400'
                        : u.rank === 2
                        ? 'text-zinc-300'
                        : u.rank === 3
                        ? 'text-amber-600'
                        : 'text-zinc-500'
                    }`}
                  >
                    #{u.rank}
                  </span>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-white">{u.name}</span>
                      <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 text-[8px] font-black border border-amber-500/30">
                        Lv.{u.level}
                      </span>
                    </div>
                    <span className="text-[10px] text-[#C084FC] font-semibold">VIP {u.vipTier} • {u.tier}</span>
                  </div>
                </div>

                <span className="font-mono font-bold text-xs text-amber-300">
                  {u.coins} 💰
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* =========================================================================
          FULL OFFICIAL LEVEL BADGE CHART IMAGE MODAL (0 - 100)
         ========================================================================= */}
      {showChartModal && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-3 animate-in fade-in duration-200">
          <div className="relative w-full max-w-2xl max-h-[92vh] rounded-3xl bg-[#120B24] border border-[#A855F7]/40 shadow-2xl flex flex-col overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 bg-[#1A1033] border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Crown className="w-4 h-4 text-amber-300" />
                <h3 className="text-sm font-black text-white">
                  Alpha Mate – Official Level Badge Chart (0 – 100)
                </h3>
              </div>
              <button
                onClick={() => setShowChartModal(false)}
                className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-zinc-300 hover:text-white cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Chart Graphic */}
            <div className="p-3 overflow-auto max-h-[calc(92vh-60px)] flex items-center justify-center bg-black/60">
              <img
                src="/assets/aistudio/file_000000001ae482118972b47ae5eb383f_cf872efe.png"
                alt="Alpha Mate Complete Level Badge System (0 - 100)"
                className="w-full h-auto object-contain rounded-2xl shadow-2xl border border-white/10"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
