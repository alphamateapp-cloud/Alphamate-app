import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import {
  X,
  Coins,
  Flame,
  Check,
  Lock,
  Sparkles,
  Gift,
  Crown,
  Clock,
  Zap,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';

export const DAILY_LADDER = [
  { day: 1, coins: 50, bonus: null },
  { day: 2, coins: 100, bonus: null },
  { day: 3, coins: 150, bonus: 'Silver Badge' },
  { day: 4, coins: 250, bonus: '2x XP Booster' },
  { day: 5, coins: 400, bonus: null },
  { day: 6, coins: 600, bonus: 'Exclusive Audio Wave' },
  { day: 7, coins: 1500, bonus: '👑 Royal VIP Box', isGrand: true },
];

export const DailyCheckInModal: React.FC = () => {
  const {
    showDailyCheckInModal,
    setShowDailyCheckInModal,
    dailyCheckInState,
    claimDailyReward,
    currentUser,
  } = useApp();

  const [isClaiming, setIsClaiming] = useState(false);
  const [claimedRewardPopup, setClaimedRewardPopup] = useState<{
    coins: number;
    day: number;
  } | null>(null);
  const [timeLeftToReset, setTimeLeftToReset] = useState('');

  // Calculate next reset time countdown (midnight local time)
  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date();
      const midnight = new Date();
      midnight.setHours(24, 0, 0, 0);
      const diffMs = midnight.getTime() - now.getTime();

      const hours = Math.floor(diffMs / (1000 * 60 * 60));
      const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);

      setTimeLeftToReset(
        `${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`
      );
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, []);

  if (!showDailyCheckInModal) return null;

  const currentStreak = dailyCheckInState.streak;
  const isClaimedToday = dailyCheckInState.isClaimedToday;

  // The day currently being claimed, or next day if already claimed today
  const activeClaimDay = isClaimedToday
    ? currentStreak === 0
      ? 1
      : currentStreak
    : currentStreak === 7
    ? 1
    : currentStreak + 1;

  const handleClaim = () => {
    if (isClaimedToday || isClaiming) return;

    setIsClaiming(true);
    setTimeout(() => {
      const result = claimDailyReward();
      setIsClaiming(false);
      if (result.success) {
        setClaimedRewardPopup({
          coins: result.coinsAwarded,
          day: result.day,
        });
      }
    }, 450);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in select-none">
      {/* Background ambient lighting glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-80 h-80 rounded-full bg-gradient-to-tr from-[#7928CA]/50 via-[#EC4899]/30 to-[#F59E0B]/20 blur-3xl pointer-events-none" />

      {/* Main Modal Card */}
      <div className="relative w-full max-w-sm max-h-[92vh] overflow-y-auto rounded-3xl bg-[#140D27]/95 border-2 border-[#A855F7]/40 p-4 sm:p-5 shadow-2xl shadow-purple-900/60 text-white animate-scale-up">
        {/* Close Button */}
        <button
          onClick={() => {
            setShowDailyCheckInModal(false);
            setClaimedRewardPopup(null);
          }}
          className="absolute top-3.5 right-3.5 z-20 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-zinc-300 hover:text-white transition cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Top Header Banner */}
        <div className="text-center pt-1 pb-3 relative z-10">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-400 via-amber-500 to-yellow-300 shadow-xl shadow-amber-500/40 p-0.5 mb-2.5 transform -rotate-3 hover:rotate-0 transition-transform">
            <div className="w-full h-full rounded-[14px] bg-[#1A1033]/30 backdrop-blur-sm flex items-center justify-center">
              <Coins className="w-7 h-7 text-amber-200 fill-amber-300 drop-shadow" />
            </div>
          </div>

          <h2 className="text-xl font-black tracking-tight text-white flex items-center justify-center gap-1.5">
            <span>Daily Check-In Rewards</span>
            <Sparkles className="w-4 h-4 text-amber-400" />
          </h2>

          <p className="text-[11px] text-zinc-400 mt-1 max-w-[260px] mx-auto leading-relaxed">
            Log in each consecutive day to claim free Alpha Coins & unlock exclusive VIP bonuses!
          </p>

          {/* Current Streak Badge */}
          <div className="mt-2.5 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#20153D] border border-amber-500/40 shadow-inner">
            <Flame className="w-4 h-4 text-amber-400 fill-amber-400 animate-pulse" />
            <span className="text-xs font-black text-amber-300 tracking-wide">
              {currentStreak} Day{currentStreak === 1 ? '' : 's'} Streak
            </span>
            <span className="text-[10px] text-zinc-400">
              ({currentStreak}/7 Days)
            </span>
          </div>
        </div>

        {/* 7-Day Rewards Ladder Grid */}
        <div className="grid grid-cols-4 gap-2 my-2 relative z-10">
          {DAILY_LADDER.map((item) => {
            // Determine state of this card
            const isCompleted = isClaimedToday
              ? item.day <= currentStreak
              : item.day < activeClaimDay;
            const isTodayReady = !isClaimedToday && item.day === activeClaimDay;
            const isLocked = !isCompleted && !isTodayReady;

            // Day 7 is the grand prize card
            if (item.isGrand) {
              return (
                <div
                  key={item.day}
                  className={`col-span-2 relative p-2.5 rounded-2xl border flex items-center justify-between transition-all ${
                    isCompleted
                      ? 'bg-[#181131]/60 border-emerald-500/40 opacity-80'
                      : isTodayReady
                      ? 'bg-gradient-to-r from-[#2A1654] via-[#451B78] to-[#2B1050] border-amber-400 shadow-xl shadow-amber-500/25 scale-[1.02]'
                      : 'bg-[#120B24]/70 border-purple-500/20 opacity-70'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-400 to-yellow-600 flex items-center justify-center text-white shadow-md">
                      <Crown className="w-5 h-5 text-amber-950 fill-amber-300" />
                    </div>
                    <div className="text-left">
                      <span className="text-[10px] font-bold text-amber-300 uppercase tracking-wider block">
                        Day 7 • Grand Prize
                      </span>
                      <span className="text-xs font-black text-white">
                        +{item.coins.toLocaleString()} Coins
                      </span>
                      <span className="text-[9px] text-pink-300 block font-semibold truncate max-w-[100px]">
                        {item.bonus}
                      </span>
                    </div>
                  </div>

                  {isCompleted ? (
                    <div className="w-6 h-6 rounded-full bg-emerald-500/20 border border-emerald-400 flex items-center justify-center text-emerald-400">
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    </div>
                  ) : isTodayReady ? (
                    <span className="px-2 py-0.5 rounded-full bg-amber-400 text-amber-950 text-[9px] font-black animate-pulse">
                      READY
                    </span>
                  ) : (
                    <Lock className="w-4 h-4 text-zinc-500 mr-1" />
                  )}
                </div>
              );
            }

            return (
              <div
                key={item.day}
                className={`relative p-2 rounded-2xl border flex flex-col items-center text-center transition-all ${
                  isCompleted
                    ? 'bg-[#160E2C]/60 border-emerald-500/40'
                    : isTodayReady
                    ? 'bg-gradient-to-b from-[#2B1758] to-[#1E0F3D] border-amber-400 shadow-lg shadow-amber-500/20 scale-[1.03]'
                    : 'bg-[#110A22]/70 border-white/10 opacity-75'
                }`}
              >
                {/* Day Tag */}
                <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider">
                  Day {item.day}
                </span>

                {/* Coin Icon & Amount */}
                <div className="my-1.5 relative flex items-center justify-center">
                  <Coins
                    className={`w-6 h-6 ${
                      isCompleted
                        ? 'text-emerald-400 fill-emerald-500/30'
                        : isTodayReady
                        ? 'text-amber-400 fill-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.8)] animate-bounce'
                        : 'text-zinc-500'
                    }`}
                  />
                  {isCompleted && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center text-white">
                        <Check className="w-2.5 h-2.5 stroke-[3]" />
                      </div>
                    </div>
                  )}
                </div>

                <span className="text-[11px] font-black text-white">
                  +{item.coins}
                </span>

                {/* Bonus perk or status */}
                {item.bonus ? (
                  <span className="text-[8px] text-[#EC4899] font-bold truncate max-w-[55px] mt-0.5">
                    {item.bonus}
                  </span>
                ) : isCompleted ? (
                  <span className="text-[8px] text-emerald-400 font-bold mt-0.5">
                    Claimed
                  </span>
                ) : isTodayReady ? (
                  <span className="text-[8px] text-amber-300 font-extrabold mt-0.5 animate-pulse">
                    Today
                  </span>
                ) : (
                  <span className="text-[8px] text-zinc-500 mt-0.5">
                    Locked
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Claim Action Area */}
        <div className="pt-3 relative z-10 flex flex-col gap-2">
          {!isClaimedToday ? (
            <button
              onClick={handleClaim}
              disabled={isClaiming}
              className="group relative w-full h-12 rounded-2xl bg-gradient-to-r from-amber-500 via-[#EC4899] to-[#7928CA] p-[1.5px] shadow-xl shadow-amber-500/25 hover:shadow-amber-500/40 active:scale-[0.98] transition-all cursor-pointer"
            >
              <div className="w-full h-full rounded-[14px] bg-gradient-to-r from-amber-500 via-[#EC4899] to-[#7928CA] flex items-center justify-center gap-2 text-white font-black text-sm tracking-wide">
                {isClaiming ? (
                  <span>Claiming Coins...</span>
                ) : (
                  <>
                    <Gift className="w-4 h-4 text-yellow-200" />
                    <span>Claim Day {activeClaimDay} Reward (+{DAILY_LADDER.find(r => r.day === activeClaimDay)?.coins} Coins)</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </div>
            </button>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <div className="w-full py-2.5 px-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-between text-emerald-300">
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span className="text-xs font-bold">Claimed Today!</span>
                </div>
                <span className="text-[11px] font-mono font-bold text-emerald-200">
                  +{DAILY_LADDER.find(r => r.day === currentStreak)?.coins} Coins
                </span>
              </div>

              {/* Countdown to Next Day Reset */}
              <div className="flex items-center justify-center gap-1.5 text-[11px] text-zinc-400">
                <Clock className="w-3.5 h-3.5 text-purple-400" />
                <span>Next reward resets in:</span>
                <span className="font-mono font-bold text-amber-300">{timeLeftToReset}</span>
              </div>
            </div>
          )}

          {/* Current Wallet Balance Preview */}
          <div className="flex items-center justify-between px-2 pt-1 text-[11px] text-zinc-400">
            <span>Your Wallet Balance:</span>
            <div className="flex items-center gap-1 text-amber-300 font-bold">
              <Coins className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
              <span>{currentUser.coins.toLocaleString()} Coins</span>
            </div>
          </div>
        </div>

        {/* Celebration Pop-up Effect when claimed */}
        {claimedRewardPopup && (
          <div className="absolute inset-0 z-30 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center animate-scale-up">
            <div className="relative mb-3">
              <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-amber-400 via-amber-500 to-yellow-300 flex items-center justify-center shadow-2xl shadow-amber-400/60 animate-bounce">
                <Coins className="w-10 h-10 text-amber-950 fill-amber-200" />
              </div>
              <Sparkles className="absolute -top-2 -right-2 w-7 h-7 text-yellow-300 animate-spin" />
            </div>

            <span className="px-3 py-0.5 rounded-full bg-amber-400/20 border border-amber-400/40 text-[10px] font-black text-amber-300 uppercase tracking-widest mb-1.5">
              CHECK-IN SUCCESS!
            </span>

            <h3 className="text-2xl font-black text-white">
              +{claimedRewardPopup.coins.toLocaleString()} Coins!
            </h3>

            <p className="text-xs text-zinc-300 mt-1 max-w-[240px]">
              Day {claimedRewardPopup.day} reward credited to your wallet balance. Come back tomorrow for more!
            </p>

            <button
              onClick={() => {
                setClaimedRewardPopup(null);
                setShowDailyCheckInModal(false);
              }}
              className="mt-5 w-full h-11 rounded-2xl bg-gradient-to-r from-amber-500 via-[#EC4899] to-[#7928CA] text-white font-extrabold text-xs tracking-wider uppercase shadow-lg shadow-amber-500/30 cursor-pointer"
            >
              Awesome, Let's Go!
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
