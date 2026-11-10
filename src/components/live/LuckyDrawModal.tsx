import React, { useState } from 'react';
import { Sparkles, Trophy, Gift, X, Flame, AlertCircle } from 'lucide-react';

export interface LuckyReward {
  id: string;
  name: string;
  coins: number;
  icon: string;
  chance: string;
  color: string;
  isJackpot?: boolean;
}

export const LUCKY_WHEEL_SLOTS: LuckyReward[] = [
  { id: '1', name: 'Mini Coins', coins: 10, icon: '🪙', chance: '35%', color: '#38BDF8' },
  { id: '2', name: 'Lucky Rose', coins: 50, icon: '🌹', chance: '25%', color: '#F43F5E' },
  { id: '3', name: 'Coin Pouch', coins: 100, icon: '💰', chance: '18%', color: '#F59E0B' },
  { id: '4', name: 'Neon Heart', coins: 250, icon: '💖', chance: '10%', color: '#EC4899' },
  { id: '5', name: 'Gold Pot', coins: 500, icon: '🍯', chance: '6%', color: '#EAB308' },
  { id: '6', name: 'Royal Crown', coins: 1000, icon: '👑', chance: '4%', color: '#A855F7' },
  { id: '7', name: 'Super Mystery', coins: 2000, icon: '💎', chance: '1.5%', color: '#6366F1' },
  { id: '8', name: 'MEGA JACKPOT', coins: 5000, icon: '🚀', chance: '0.5%', color: '#10B981', isJackpot: true },
];

interface LuckyDrawModalProps {
  isOpen: boolean;
  onClose: () => void;
  userCoins: number;
  onWinCoins: (amount: number, rewardName: string) => void;
  onSendBonusGiftToHost?: (coinsWon: number) => void;
  hostName?: string;
}

export const LuckyDrawModal: React.FC<LuckyDrawModalProps> = ({
  isOpen,
  onClose,
  userCoins,
  onWinCoins,
  onSendBonusGiftToHost,
  hostName = 'Host',
}) => {
  const [spinCost, setSpinCost] = useState<number>(20); // 20 coins per standard spin
  const [isSpinning, setIsSpinning] = useState<boolean>(false);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [rotation, setRotation] = useState<number>(0);
  const [recentWin, setRecentWin] = useState<LuckyReward | null>(null);
  const [multiplier, setMultiplier] = useState<1 | 5 | 10>(1);

  if (!isOpen) return null;

  const handleSpin = () => {
    const totalCost = spinCost * multiplier;
    if (userCoins < totalCost) {
      return;
    }

    if (isSpinning) return;
    setIsSpinning(true);
    setRecentWin(null);

    // Random weighted prize selection
    // 0: 35%, 1: 25%, 2: 18%, 3: 10%, 4: 6%, 5: 4%, 6: 1.5%, 7: 0.5%
    const rand = Math.random() * 100;
    let targetSlot = 0;
    if (rand < 35) targetSlot = 0;
    else if (rand < 60) targetSlot = 1;
    else if (rand < 78) targetSlot = 2;
    else if (rand < 88) targetSlot = 3;
    else if (rand < 94) targetSlot = 4;
    else if (rand < 98) targetSlot = 5;
    else if (rand < 99.5) targetSlot = 6;
    else targetSlot = 7;

    // Calculate rotation: 8 slots = 45 deg per slot
    const slotAngle = 360 / LUCKY_WHEEL_SLOTS.length;
    // Extra rotations for excitement (5 to 7 full circles)
    const extraSpins = 360 * 6;
    const targetAngle = extraSpins + (LUCKY_WHEEL_SLOTS.length - targetSlot) * slotAngle;

    setRotation((prev) => prev + targetAngle);
    setSelectedIndex(targetSlot);

    setTimeout(() => {
      setIsSpinning(false);
      const prize = LUCKY_WHEEL_SLOTS[targetSlot];
      const totalCoinsWon = prize.coins * multiplier;
      setRecentWin(prize);

      // Credit wallet
      onWinCoins(totalCoinsWon, prize.name);
    }, 3800);
  };

  const currentTotalCost = spinCost * multiplier;
  const canAfford = userCoins >= currentTotalCost;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 select-none">
      <div className="relative w-full max-w-[340px] rounded-3xl bg-gradient-to-b from-[#1E0D38] via-[#140929] to-[#0A0417] border border-[#EC4899]/40 p-4 shadow-2xl shadow-purple-950/80 flex flex-col items-center animate-in fade-in zoom-in-95 duration-200">
        {/* Glow halo */}
        <div className="absolute -top-12 -left-12 w-36 h-36 rounded-full bg-[#EC4899]/30 blur-2xl pointer-events-none" />
        <div className="absolute -bottom-12 -right-12 w-36 h-36 rounded-full bg-[#7928CA]/30 blur-2xl pointer-events-none" />

        {/* Header */}
        <div className="w-full flex items-center justify-between pb-2 border-b border-white/10">
          <div className="flex items-center gap-1.5">
            <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-amber-400 to-[#EC4899] flex items-center justify-center shadow-md">
              <Sparkles className="w-4 h-4 text-amber-950" />
            </div>
            <div>
              <div className="flex items-center gap-1">
                <h3 className="text-sm font-black text-white tracking-wide">Live Lucky Draw</h3>
                <span className="px-1.5 py-0.2 rounded-full bg-[#EC4899]/30 border border-[#EC4899]/60 text-[#EC4899] text-[8px] font-black uppercase">
                  Mini Game
                </span>
              </div>
              <p className="text-[9.5px] text-zinc-400">Spin to win coins & support {hostName}!</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-zinc-300 flex items-center justify-center transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* User Balance & Bet Multiplier Bar */}
        <div className="w-full flex items-center justify-between py-2 px-1">
          <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-black/50 border border-amber-400/40 text-amber-300 text-[10.5px] font-bold">
            <span>🪙</span>
            <span>{userCoins.toLocaleString()} Coins</span>
          </div>

          {/* Multiplier Pills */}
          <div className="flex items-center gap-1 bg-[#180E2E] p-0.5 rounded-full border border-white/10">
            {([1, 5, 10] as const).map((m) => (
              <button
                key={m}
                onClick={() => !isSpinning && setMultiplier(m)}
                className={`px-2 py-0.5 rounded-full text-[9px] font-black transition-all cursor-pointer ${
                  multiplier === m
                    ? 'bg-gradient-to-r from-amber-400 to-pink-500 text-black shadow-xs scale-105'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                x{m}
              </button>
            ))}
          </div>
        </div>

        {/* Lucky Wheel Canvas / Visual Area */}
        <div className="relative w-56 h-56 my-2 flex items-center justify-center">
          {/* Wheel Pointer Arrow at Top */}
          <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 z-20 pointer-events-none drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
            <div className="w-0 h-0 border-l-[9px] border-l-transparent border-r-[9px] border-r-transparent border-t-[14px] border-t-amber-400 animate-pulse" />
          </div>

          {/* Outer Neon Ring */}
          <div className="absolute inset-0 rounded-full border-4 border-[#EC4899]/40 shadow-[0_0_20px_rgba(236,72,153,0.3)] pointer-events-none" />

          {/* Rotating Wheel Disk */}
          <div
            className="w-full h-full rounded-full relative overflow-hidden transition-transform ease-out"
            style={{
              transform: `rotate(${rotation}deg)`,
              transitionDuration: isSpinning ? '3.8s' : '0s',
              transitionTimingFunction: 'cubic-bezier(0.15, 0.9, 0.2, 1)',
            }}
          >
            {LUCKY_WHEEL_SLOTS.map((slot, index) => {
              const angle = (360 / LUCKY_WHEEL_SLOTS.length) * index;
              return (
                <div
                  key={slot.id}
                  className="absolute w-full h-full left-0 top-0 flex justify-center origin-center"
                  style={{
                    transform: `rotate(${angle}deg)`,
                  }}
                >
                  <div
                    className="pt-2 flex flex-col items-center"
                    style={{
                      transformOrigin: '50% 112px',
                    }}
                  >
                    <span className="text-xl drop-shadow">{slot.icon}</span>
                    <span
                      className="text-[8.5px] font-black tracking-tight"
                      style={{ color: slot.color }}
                    >
                      {slot.coins * multiplier}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Center Hub Button */}
          <button
            onClick={handleSpin}
            disabled={isSpinning || !canAfford}
            className={`absolute z-10 w-15 h-15 rounded-full flex flex-col items-center justify-center shadow-xl transition-all active:scale-95 cursor-pointer border-2 ${
              canAfford
                ? 'bg-gradient-to-tr from-[#EC4899] via-[#9333EA] to-amber-400 border-white text-white shadow-pink-500/50 hover:brightness-110'
                : 'bg-zinc-800 border-zinc-600 text-zinc-500 cursor-not-allowed'
            }`}
          >
            <span className="text-[11px] font-black uppercase tracking-tight">
              {isSpinning ? '...' : 'SPIN'}
            </span>
            <span className="text-[8px] font-bold opacity-90">
              {currentTotalCost} 🪙
            </span>
          </button>
        </div>

        {/* Win Reward Alert Banner */}
        {recentWin && (
          <div className="w-full mt-1.5 p-2 rounded-2xl bg-gradient-to-r from-amber-400/20 via-[#EC4899]/20 to-purple-500/20 border border-amber-400/40 text-center animate-bounce">
            <div className="flex items-center justify-center gap-1.5">
              <span className="text-lg">{recentWin.icon}</span>
              <span className="text-xs font-black text-amber-300">
                You Won {(recentWin.coins * multiplier).toLocaleString()} Coins!
              </span>
              <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
            </div>
            <p className="text-[9.5px] text-zinc-300 mt-0.5">
              Credited directly to your Alpha Mate coin wallet!
            </p>

            {/* Quick gift reward to host option */}
            {onSendBonusGiftToHost && (
              <button
                onClick={() => {
                  onSendBonusGiftToHost(recentWin.coins * multiplier);
                  onClose();
                }}
                className="mt-1.5 px-3 py-1 rounded-xl bg-gradient-to-r from-[#EC4899] to-[#7928CA] text-white text-[9.5px] font-black shadow hover:brightness-110 cursor-pointer flex items-center justify-center gap-1 mx-auto"
              >
                <Gift className="w-3 h-3" />
                <span>Gift 50% to {hostName}</span>
              </button>
            )}
          </div>
        )}

        {/* Bottom Spin Action Trigger */}
        <div className="w-full mt-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1 text-[9.5px] text-zinc-400">
            <Flame className="w-3.5 h-3.5 text-amber-400" />
            <span>Cost: {currentTotalCost} Coins</span>
          </div>

          <button
            onClick={handleSpin}
            disabled={isSpinning || !canAfford}
            className={`flex-1 h-9 rounded-xl font-black text-xs shadow-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              canAfford
                ? 'bg-gradient-to-r from-[#7928CA] via-[#9333EA] to-[#EC4899] text-white hover:brightness-110 active:scale-95'
                : 'bg-zinc-800 text-zinc-400 cursor-not-allowed'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>{isSpinning ? 'Spinning...' : `Spin Now (${currentTotalCost} 🪙)`}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
