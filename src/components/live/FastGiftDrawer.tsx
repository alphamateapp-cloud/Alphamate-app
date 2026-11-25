import React, { useEffect, useState } from 'react';
import { Gift as GiftIcon, Sparkles, X } from 'lucide-react';
import { Gift } from '../../types';
import { GiftCacheBadge, GiftCacheBar, GiftIconImage } from './GiftBoxMedia';
import {
  getGiftMediaCacheSnapshot,
  getGiftPrimaryAnimationUrl,
  subscribeGiftMediaCache,
} from '../../services/giftMediaCache';

interface FastGiftCardProps {
  gift: Gift;
  isSelected: boolean;
  isCached: boolean;
  isDownloading: boolean;
  showTierBadges?: boolean;
  onSelect: (gift: Gift) => void;
}

const FastGiftCard: React.FC<FastGiftCardProps> = React.memo(
  ({ gift, isSelected, isCached, isDownloading, showTierBadges = false, onSelect }) => {
    const isTestGift = Boolean(gift.isTestGift || gift.advancedConfig?.isTestGift);
    const isAdvanced = Boolean(gift.advancedConfig);
    const cost = gift.costInCoins ?? gift.coins;
    const isMythic = showTierBadges && !isTestGift && cost >= 19999;
    const isEpic = showTierBadges && !isTestGift && cost >= 1999 && !isMythic;

    return (
      <button
        type="button"
        onClick={() => onSelect(gift)}
        className={`relative rounded-2xl p-2 flex flex-col items-center justify-center text-center cursor-pointer select-none ${
          isSelected
            ? 'bg-[#2C164F] border-2 border-[#EC4899]'
            : isTestGift
            ? 'bg-[#14253B] border border-cyan-400/45'
            : 'bg-[#1D1438] border border-white/10'
        }`}
        style={{ contain: 'layout style' }}
      >
        {isTestGift && (
          <span className="absolute -top-1.5 -right-1 px-1.5 rounded bg-cyan-600 text-[7px] font-black text-white">
            TEST
          </span>
        )}
        {!isTestGift && isAdvanced && (
          <span className="absolute -top-1.5 -left-1 px-1 rounded bg-emerald-600 text-[6.5px] font-black text-white uppercase">
            {gift.advancedConfig?.format}
          </span>
        )}
        {isMythic && (
          <span className="absolute -top-1.5 -right-1 px-1 rounded bg-red-600 text-[7px] font-black text-white">
            MYTHIC
          </span>
        )}
        {isEpic && (
          <span className="absolute -top-1.5 -right-1 px-1 rounded bg-purple-600 text-[7px] font-black text-white">
            VIP
          </span>
        )}
        <GiftIconImage
          gift={gift}
          className="w-10 h-10 object-contain mb-1"
          emojiClassName="text-2xl mb-1"
        />
        <span className="text-[10px] font-bold text-white truncate w-full">{gift.name}</span>
        <span className="text-[10px] text-amber-400 font-semibold mt-0.5 tabular-nums">
          {cost.toLocaleString()}
        </span>
        <GiftCacheBadge
          gift={gift}
          cachedOverride={isCached}
          downloadingOverride={isDownloading}
        />
      </button>
    );
  }
);

interface FastGiftDrawerProps {
  isOpen: boolean;
  mode: 'party' | 'live';
  gifts: Gift[];
  selectedGift: Gift;
  coins: number;
  recipientLabel?: string;
  quantityMultiplier?: number;
  onSelectGift: (gift: Gift) => void;
  onSelectQuantity?: (qty: number) => void;
  onSend: () => void;
  onClose: () => void;
  onRecharge: () => void;
  onOpenLuckyDraw?: () => void;
}

const LIVE_QUANTITIES = [1, 5, 10, 66, 99, 188, 520] as const;

/**
 * High-performance isolated Gift Drawer component.
 * - Completely decoupled from high-frequency Party Room / Live Stream re-renders via React.memo.
 * - Marked `data-no-ptr="true"` and stops touch bubbling so PullToRefresh NEVER blocks or slows scroll.
 * - Uses native GPU-composited touch scrolling with zero heavy backdrop-blur/shadow repaints during scroll.
 * - Single batched cache snapshot subscription shared by all cards instead of N subscriptions.
 */
const FastGiftDrawerInner: React.FC<FastGiftDrawerProps> = ({
  isOpen,
  mode,
  gifts,
  selectedGift,
  coins,
  recipientLabel,
  quantityMultiplier = 1,
  onSelectGift,
  onSelectQuantity,
  onSend,
  onClose,
  onRecharge,
  onOpenLuckyDraw,
}) => {
  const [cacheSnapshot, setCacheSnapshot] = useState(() => getGiftMediaCacheSnapshot());

  // Always invoke latest parent callbacks without breaking React.memo isolation during scroll
  const callbacksRef = React.useRef({
    onSelectGift,
    onSelectQuantity,
    onSend,
    onClose,
    onRecharge,
    onOpenLuckyDraw,
  });
  callbacksRef.current = {
    onSelectGift,
    onSelectQuantity,
    onSend,
    onClose,
    onRecharge,
    onOpenLuckyDraw,
  };

  const handleSelectGift = React.useCallback((g: Gift) => {
    callbacksRef.current.onSelectGift(g);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    setCacheSnapshot(getGiftMediaCacheSnapshot());
    return subscribeGiftMediaCache(() => {
      setCacheSnapshot(getGiftMediaCacheSnapshot());
    });
  }, [isOpen]);

  if (!isOpen) return null;

  const unitCost = selectedGift.costInCoins ?? selectedGift.coins;
  const totalCost = unitCost * (mode === 'live' ? quantityMultiplier : 1);

  return (
    <div
      data-no-ptr="true"
      onClick={() => callbacksRef.current.onClose()}
      onTouchStart={(e) => e.stopPropagation()}
      onTouchMove={(e) => e.stopPropagation()}
      className="fixed inset-0 z-50 bg-black/70 flex flex-col justify-end"
    >
      <div
        data-no-ptr="true"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md mx-auto rounded-t-3xl bg-[#160E2C] border-t border-[#A855F7]/30 p-4 pb-[max(1rem,var(--app-safe-bottom,0px))] shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-2.5 border-b border-[#A855F7]/15 gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            {mode === 'live' && <GiftIcon className="w-4 h-4 text-amber-400 shrink-0" />}
            <span className="text-sm font-bold text-white truncate">
              {mode === 'party' ? 'Party Room Gifts' : 'Send Virtual Gift'}
            </span>
            {mode === 'party' ? (
              <span className="text-xs text-amber-400 font-bold shrink-0 tabular-nums">
                💰 {coins.toLocaleString()}
              </span>
            ) : recipientLabel ? (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-900/60 border border-purple-500/40 text-purple-200 truncate max-w-[100px]">
                {recipientLabel}
              </span>
            ) : null}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {mode === 'live' && (
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/60 border border-amber-400/30">
                <span className="text-[11px] text-amber-400 font-black tabular-nums">
                  💰 {coins.toLocaleString()}
                </span>
              </div>
            )}
            {mode === 'live' && onOpenLuckyDraw && (
              <button
                type="button"
                onClick={() => callbacksRef.current.onOpenLuckyDraw?.()}
                className="px-2 py-1 rounded-full bg-gradient-to-r from-amber-400 to-[#EC4899] text-black font-black text-[10px] cursor-pointer flex items-center gap-1"
              >
                <Sparkles className="w-3 h-3 text-amber-950" />
                <span>Lucky</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => callbacksRef.current.onRecharge()}
              className="px-2.5 py-1 rounded-full bg-[#7928CA] text-white text-[10px] font-bold cursor-pointer"
            >
              + Recharge
            </button>
            <button
              type="button"
              onClick={() => callbacksRef.current.onClose()}
              aria-label="Close Gift Drawer"
              className="w-7 h-7 rounded-full bg-white/10 text-zinc-300 hover:text-white flex items-center justify-center cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* On-device Gift Animation Cache Bar */}
        <GiftCacheBar gifts={gifts} />

        {/* Ultra-Fast Native GPU-Accelerated Scroll Grid */}
        <div
          data-no-ptr="true"
          className="grid grid-cols-4 gap-2 py-3 max-h-[42vh] min-h-[190px] overflow-y-auto overscroll-contain touch-pan-y"
          style={{
            WebkitOverflowScrolling: 'touch',
            willChange: 'scroll-position',
            contain: 'layout style',
          }}
        >
          {gifts.map((g) => {
            const animUrl = getGiftPrimaryAnimationUrl(g);
            return (
              <FastGiftCard
                key={g.id}
                gift={g}
                isSelected={selectedGift.id === g.id}
                isCached={Boolean(animUrl && cacheSnapshot.cachedUrls.has(animUrl))}
                isDownloading={Boolean(animUrl && cacheSnapshot.downloadingUrls.has(animUrl))}
                showTierBadges={mode === 'live'}
                onSelect={handleSelectGift}
              />
            );
          })}
        </div>

        {/* Quantity Multiplier Bar (Live Stream mode) */}
        {mode === 'live' && onSelectQuantity && (
          <div className="pt-2 pb-2 border-t border-[#A855F7]/15 flex items-center justify-between gap-1.5">
            <span className="text-[11px] font-bold text-zinc-400 shrink-0">Quantity:</span>
            <div className="flex items-center gap-1 overflow-x-auto py-0.5">
              {LIVE_QUANTITIES.map((num) => {
                const isActive = quantityMultiplier === num;
                return (
                  <button
                    type="button"
                    key={num}
                    onClick={() => callbacksRef.current.onSelectQuantity?.(num)}
                    className={`px-2 py-0.5 rounded-lg text-[10px] font-black cursor-pointer shrink-0 ${
                      isActive
                        ? 'bg-gradient-to-r from-amber-400 to-pink-500 text-black'
                        : 'bg-[#221642] text-zinc-300 border border-white/5'
                    }`}
                  >
                    x{num}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Selected Gift Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-[#A855F7]/15 gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <GiftIconImage
              gift={selectedGift}
              className="w-8 h-8 object-contain rounded-lg shrink-0"
              emojiClassName="text-xl shrink-0"
            />
            <div className="min-w-0">
              <div className="text-xs font-bold text-white truncate">{selectedGift.name}</div>
              <div className="text-[10px] text-zinc-400 truncate">
                {selectedGift.description || 'Animated Virtual Gift'}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => callbacksRef.current.onSend()}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#7928CA] via-[#9333EA] to-[#EC4899] text-white font-bold text-xs shadow-lg active:scale-95 cursor-pointer shrink-0"
          >
            Send ({totalCost.toLocaleString()} 💰)
          </button>
        </div>
      </div>
    </div>
  );
};

export const FastGiftDrawer = React.memo(FastGiftDrawerInner, (prev, next) => {
  if (!prev.isOpen && !next.isOpen) return true;
  return (
    prev.isOpen === next.isOpen &&
    prev.mode === next.mode &&
    prev.gifts === next.gifts &&
    prev.selectedGift.id === next.selectedGift.id &&
    prev.coins === next.coins &&
    prev.recipientLabel === next.recipientLabel &&
    prev.quantityMultiplier === next.quantityMultiplier
  );
});
