import React from 'react';
import { Flame, Zap, Sparkles, X } from 'lucide-react';
import { Gift } from '../../types';

export interface LiveGiftComboState {
  gift: Gift;
  recipientId: string;
  recipientName: string;
  comboCount: number;
  unitQuantity: number;
  totalCoins: number;
  startedAt: number;
  lastSentAt: number;
  expiresAt: number;
}

interface LiveGiftComboCounterProps {
  combo: LiveGiftComboState | null;
  remainingMs: number;
  windowMs: number;
  canAffordNext: boolean;
  isHostBarLayout?: boolean;
  onRapidSend: () => void;
  onDismiss: () => void;
}

export const LiveGiftComboCounter: React.FC<LiveGiftComboCounterProps> = ({
  combo,
  remainingMs,
  windowMs,
  canAffordNext,
  isHostBarLayout = false,
  onRapidSend,
  onDismiss,
}) => {
  if (!combo || remainingMs <= 0) return null;

  const pct = Math.max(0, Math.min(100, (remainingMs / windowMs) * 100));
  const count = combo.comboCount;

  const tier =
    count >= 10
      ? {
          label: 'LEGENDARY',
          border: 'border-yellow-300/80',
          glow: 'shadow-[0_0_28px_rgba(245,158,11,0.75)]',
          bg: 'from-rose-600/95 via-amber-500/95 to-purple-700/95',
          badgeBg: 'from-yellow-300 to-amber-500 text-black',
          bar: 'from-yellow-300 via-white to-amber-400',
        }
      : count >= 5
      ? {
          label: 'MEGA COMBO',
          border: 'border-pink-400/75',
          glow: 'shadow-[0_0_24px_rgba(236,72,153,0.65)]',
          bg: 'from-[#7928CA]/95 via-[#EC4899]/95 to-amber-500/90',
          badgeBg: 'from-pink-400 to-amber-300 text-black',
          bar: 'from-amber-300 via-pink-400 to-purple-300',
        }
      : count >= 2
      ? {
          label: 'HOT STREAK',
          border: 'border-amber-400/70',
          glow: 'shadow-[0_0_20px_rgba(249,115,22,0.55)]',
          bg: 'from-[#2A1046]/95 via-[#9333EA]/90 to-[#EA580C]/90',
          badgeBg: 'from-amber-400 to-orange-500 text-black',
          bar: 'from-amber-300 to-orange-500',
        }
      : {
          label: 'TAP COMBO',
          border: 'border-[#A855F7]/65',
          glow: 'shadow-[0_0_18px_rgba(168,85,247,0.45)]',
          bg: 'from-[#180D30]/95 via-[#4C1D95]/90 to-[#9D174D]/90',
          badgeBg: 'from-purple-400 to-pink-400 text-black',
          bar: 'from-purple-400 to-pink-400',
        };

  const nextCost = combo.gift.coins * combo.unitQuantity;

  return (
    <div
      className={`fixed right-3 z-40 pointer-events-auto select-none ${
        isHostBarLayout ? 'bottom-28' : 'bottom-16'
      }`}
    >
      <div
        className={`relative w-52 rounded-2xl border ${tier.border} bg-gradient-to-br ${tier.bg} backdrop-blur-xl p-2.5 ${tier.glow}`}
      >
        {/* Dismiss button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDismiss();
          }}
          aria-label="Dismiss gift combo counter"
          className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-black/80 border border-white/25 text-zinc-300 hover:text-white flex items-center justify-center cursor-pointer shadow"
        >
          <X className="w-3 h-3" />
        </button>

        {/* Interactive Rapid-Tap Combo Surface */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRapidSend();
          }}
          className="w-full text-left flex items-center justify-between gap-2 active:scale-95 transition-transform cursor-pointer"
          title={`Tap rapidly to send ${combo.unitQuantity > 1 ? `${combo.unitQuantity}x ` : ''}${combo.gift.name} combo`}
        >
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-black/35 border border-white/20 flex items-center justify-center text-xl shrink-0 shadow-inner">
              {combo.gift.icon}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1">
                <span
                  className={`inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded bg-gradient-to-r ${tier.badgeBg} text-[8px] font-black uppercase tracking-wider`}
                >
                  {count >= 5 ? (
                    <Sparkles className="w-2.5 h-2.5" />
                  ) : (
                    <Flame className="w-2.5 h-2.5 fill-current" />
                  )}
                  <span>{tier.label}</span>
                </span>
              </div>
              <div className="text-[11px] font-extrabold text-white truncate mt-0.5">
                {combo.gift.name}
                {combo.unitQuantity > 1 ? ` x${combo.unitQuantity}` : ''}
              </div>
              <div className="text-[9.5px] font-bold text-amber-200/95">
                +{combo.totalCoins.toLocaleString()} 💰 · {canAffordNext ? `${nextCost.toLocaleString()} next` : 'Low coins'}
              </div>
            </div>
          </div>

          {/* Animated Combo Multiplier Counter using existing animate-combo-pop */}
          <div
            key={`hud-combo-${combo.gift.id}-${count}`}
            className="animate-combo-pop shrink-0 flex flex-col items-center justify-center px-2.5 py-1 rounded-xl bg-black/45 border border-yellow-300/50 shadow-lg"
          >
            <div className="flex items-baseline gap-0.5 leading-none">
              <span className="text-[11px] font-black text-amber-300 italic">x</span>
              <span className="text-xl font-black italic tracking-tighter text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.85)] tabular-nums">
                {count}
              </span>
            </div>
            <span className="text-[8px] font-extrabold uppercase tracking-wider text-yellow-200 flex items-center gap-0.5 mt-0.5">
              <Zap className="w-2.5 h-2.5 fill-current text-yellow-300" />
              <span>Tap</span>
            </span>
          </div>
        </button>

        {/* Rapid-Combo Decay Timer Bar */}
        <div className="mt-2 h-1.5 w-full rounded-full bg-black/45 overflow-hidden border border-white/10">
          <div
            className={`h-full rounded-full bg-gradient-to-r ${tier.bar} transition-[width] duration-100 ease-linear`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  );
};
