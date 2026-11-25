import React, { useEffect, useState } from 'react';
import { Check, Download, HardDrive, Loader2 } from 'lucide-react';
import { Gift } from '../../types';
import {
  downloadAllGiftsToLocalCache,
  downloadGiftToLocalCache,
  formatCacheBytes,
  getGiftMediaCacheSnapshot,
  getGiftPrimaryAnimationUrl,
  isGiftAnimationCached,
  isGiftAnimationDownloading,
  subscribeGiftMediaCache,
} from '../../services/giftMediaCache';

/**
 * Resolves the PNG / static preview image URL for a gift so the Gift Box ALWAYS
 * shows the Admin-uploaded PNG picture instead of a generic gift box emoji.
 */
export function resolveGiftThumbUrl(gift: Gift | null | undefined): string {
  if (!gift) return '';
  return (
    gift.thumbnailUrl ||
    gift.advancedConfig?.thumbnailUrl ||
    gift.advancedConfig?.previewImageUrl ||
    ''
  );
}

interface GiftIconImageProps {
  gift: Gift;
  className?: string;
  emojiClassName?: string;
}

/**
 * Renders the gift's uploaded PNG picture in the Gift Box & footer, falling back
 * to the emoji icon only if no PNG exists or the image fails to load.
 */
export const GiftIconImage: React.FC<GiftIconImageProps> = React.memo(({
  gift,
  className = 'w-9 h-9 object-contain mb-1',
  emojiClassName = 'text-2xl mb-1',
}) => {
  const thumbUrl = resolveGiftThumbUrl(gift);
  const [failedUrl, setFailedUrl] = useState<string>('');

  if (thumbUrl && failedUrl !== thumbUrl) {
    return (
      <img
        src={thumbUrl}
        alt={gift.name}
        loading="lazy"
        decoding="async"
        draggable={false}
        onError={() => setFailedUrl(thumbUrl)}
        className={className}
      />
    );
  }

  return <span className={emojiClassName}>{gift.icon || '🎁'}</span>;
});

interface GiftCacheBadgeProps {
  gift: Gift;
  cachedOverride?: boolean;
  downloadingOverride?: boolean;
}

/**
 * Per-gift on-device cache indicator & quick single-gift download button inside the Gift Box.
 * Memoized and state-filtered so scrolling 20-50+ gift cards stays locked at 60fps.
 */
export const GiftCacheBadge: React.FC<GiftCacheBadgeProps> = React.memo(({
  gift,
  cachedOverride,
  downloadingOverride,
}) => {
  const animUrl = getGiftPrimaryAnimationUrl(gift);
  const usesExternalState = cachedOverride !== undefined;
  const [status, setStatus] = useState<'idle' | 'downloading' | 'cached'>(() => {
    if (!animUrl) return 'idle';
    if (isGiftAnimationCached(gift)) return 'cached';
    if (isGiftAnimationDownloading(gift)) return 'downloading';
    return 'idle';
  });

  useEffect(() => {
    if (usesExternalState || !animUrl) return;
    return subscribeGiftMediaCache(() => {
      const next: 'idle' | 'downloading' | 'cached' = isGiftAnimationCached(gift)
        ? 'cached'
        : isGiftAnimationDownloading(gift)
        ? 'downloading'
        : 'idle';
      setStatus((prev) => (prev === next ? prev : next));
    });
  }, [usesExternalState, animUrl, gift]);

  if (!animUrl) return null;

  const cached = usesExternalState ? Boolean(cachedOverride) : status === 'cached';
  const downloading = usesExternalState ? Boolean(downloadingOverride) : status === 'downloading';

  if (cached) {
    return (
      <span
        title="Saved on device for instant lag-free playback"
        className="absolute bottom-1 right-1 w-4 h-4 rounded-full bg-emerald-500/90 text-white flex items-center justify-center pointer-events-none"
      >
        <Check className="w-2.5 h-2.5 stroke-[3]" />
      </span>
    );
  }

  return (
    <button
      type="button"
      title="Download animation to device for instant playback"
      onClick={(e) => {
        e.stopPropagation();
        void downloadGiftToLocalCache(gift);
      }}
      className="absolute bottom-1 right-1 w-4 h-4 rounded-full bg-black/70 hover:bg-purple-600 border border-white/25 text-zinc-200 hover:text-white flex items-center justify-center cursor-pointer"
    >
      {downloading ? (
        <Loader2 className="w-2.5 h-2.5 animate-spin text-amber-300" />
      ) : (
        <Download className="w-2.5 h-2.5" />
      )}
    </button>
  );
});

interface GiftCacheBarProps {
  gifts: Gift[];
}

/**
 * Compact on-device Gift Animation Cache bar shown inside the Gift Box header.
 * Allows users to pre-download all animated WebM/SVGA gifts to persistent IndexedDB
 * storage once so every live/party animation plays smoothly from local device storage.
 */
export const GiftCacheBar: React.FC<GiftCacheBarProps> = React.memo(({ gifts }) => {
  const [, setTick] = useState(0);
  const [isDownloadingAll, setIsDownloadingAll] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  useEffect(() => subscribeGiftMediaCache(() => setTick((t) => t + 1)), []);

  const animatedGifts = gifts.filter((g) => Boolean(getGiftPrimaryAnimationUrl(g)));
  if (animatedGifts.length === 0) return null;

  const cachedCount = animatedGifts.filter((g) => isGiftAnimationCached(g)).length;
  const allCached = cachedCount >= animatedGifts.length;
  const snapshot = getGiftMediaCacheSnapshot();

  const handleDownloadAll = async () => {
    if (isDownloadingAll) return;
    setIsDownloadingAll(true);
    setProgress({ done: cachedCount, total: animatedGifts.length });
    try {
      await downloadAllGiftsToLocalCache(animatedGifts, (done, total) => {
        setProgress({ done, total });
      });
    } finally {
      setIsDownloadingAll(false);
      setProgress(null);
    }
  };

  return (
    <div className="mt-2 px-2.5 py-1.5 rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-between gap-2">
      <div className="flex items-center gap-1.5 min-w-0">
        <HardDrive className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
        <span className="text-[10px] text-zinc-300 font-semibold truncate">
          {allCached
            ? `All ${animatedGifts.length} animations saved on device`
            : `Cached ${cachedCount}/${animatedGifts.length} animations`}
          {snapshot.totalBytes > 0 ? ` • ${formatCacheBytes(snapshot.totalBytes)}` : ''}
        </span>
      </div>

      <button
        type="button"
        disabled={isDownloadingAll || allCached}
        onClick={() => void handleDownloadAll()}
        className={`px-2.5 py-1 rounded-lg text-[10px] font-black flex items-center gap-1 shrink-0 ${
          allCached
            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 cursor-default'
            : isDownloadingAll
            ? 'bg-amber-500/20 text-amber-200 border border-amber-400/30 cursor-wait'
            : 'bg-gradient-to-r from-cyan-500 to-purple-600 text-white active:scale-95 cursor-pointer'
        }`}
      >
        {allCached ? (
          <>
            <Check className="w-3 h-3 stroke-[3]" />
            <span>Ready</span>
          </>
        ) : isDownloadingAll ? (
          <>
            <Loader2 className="w-3 h-3 animate-spin" />
            <span>
              {progress ? `${progress.done}/${progress.total}` : 'Saving...'}
            </span>
          </>
        ) : (
          <>
            <Download className="w-3 h-3" />
            <span>Download All</span>
          </>
        )}
      </button>
    </div>
  );
});
