import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Gift } from '../types';
import { audioManager } from '../services/audioManager';
import { virtualGiftDatabase } from '../services/virtual-gift-database';
import { resolvePlayableGiftUrl } from '../services/giftAnimationEngine';
import {
  getCachedGiftMediaUrlSync,
  hydrateGiftMediaCacheIndex,
  isWeakNetworkConnection,
  resolveCachedGiftMediaUrl,
} from '../services/giftMediaCache';

export interface UsePartyGiftAudioPreloaderOptions {
  /** Active Party Room ID; eager preloading fires immediately whenever the user enters a party room */
  roomId: string | null | undefined;
  /** Published gift catalog (standard + advanced video/SVGA/GIF gifts) */
  gifts?: Gift[];
  /** Enable/disable hook execution (defaults to true) */
  enabled?: boolean;
  /** Max uncached remote video gift tracks to pre-decode on standard networks (defaults to 8) */
  maxUncachedVideoTracks?: number;
}

export interface UsePartyGiftAudioPreloaderResult {
  status: 'idle' | 'preloading' | 'ready';
  loadedCount: number;
  totalCount: number;
  decodedBufferCount: number;
  isAudioUnlocked: boolean;
  preloadNow: () => Promise<void>;
}

const VIDEO_GIFT_FORMATS = new Set(['webm', 'mp4', 'mov']);

// Module-level deduplication so mounting the hook globally never triggers duplicate parallel loads
let lastCompletedSignature: string | null = null;
let inflightPreloadSignature: string | null = null;
let inflightPreloadPromise: Promise<void> | null = null;

function buildCatalogSignature(gifts: Gift[]): string {
  if (!gifts.length) return 'default';
  return gifts
    .map((g) => {
      const adv = g.advancedConfig;
      const mediaKey = adv
        ? adv.optimizedFileUrl || adv.animationUrl || adv.originalFileUrl || ''
        : '';
      return `${g.id}:${g.audioAssetPath || ''}:${mediaKey}`;
    })
    .sort()
    .join('|');
}

/**
 * Global Party Room Gift Audio Preloading Hook.
 *
 * Eagerly unlocks the Web Audio API graph and decodes all gift animation SFX,
 * combo/VIP sound cues, and cached/catalog video gift audio tracks into Web Audio
 * `AudioBuffer`s as soon as the user enters a Party Room, ensuring zero-latency
 * synchronized playback across all room participants without disturbing Agora Voice.
 */
export function usePartyGiftAudioPreloader({
  roomId,
  gifts = [],
  enabled = true,
  maxUncachedVideoTracks = 8,
}: UsePartyGiftAudioPreloaderOptions): UsePartyGiftAudioPreloaderResult {
  const [status, setStatus] = useState<'idle' | 'preloading' | 'ready'>('idle');
  const [loadedCount, setLoadedCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [decodedBufferCount, setDecodedBufferCount] = useState(
    () => audioManager.getBufferStats().decodedCount
  );
  const [isAudioUnlocked, setIsAudioUnlocked] = useState(false);

  const giftsRef = useRef<Gift[]>(gifts);
  giftsRef.current = gifts;

  const catalogSignature = useMemo(() => buildCatalogSignature(gifts), [gifts]);
  const abortControllerRef = useRef<AbortController | null>(null);

  const runEagerPreload = useCallback(
    async (force = false) => {
      if (!enabled || !roomId) return;

      // Always unlock/resume the Web Audio API context immediately on room entry
      const unlocked = await audioManager.unlock();
      setIsAudioUnlocked(unlocked);

      const signature = `${catalogSignature}`;
      if (!force && lastCompletedSignature === signature) {
        setDecodedBufferCount(audioManager.getBufferStats().decodedCount);
        setStatus('ready');
        return;
      }

      if (!force && inflightPreloadPromise && inflightPreloadSignature === signature) {
        setStatus('preloading');
        await inflightPreloadPromise;
        setDecodedBufferCount(audioManager.getBufferStats().decodedCount);
        setStatus('ready');
        return;
      }

      // Cancel any stale preload from a previous room/catalog
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;
      const { signal } = controller;

      setStatus('preloading');

      const task = (async () => {
        try {
          // 1. Hydrate local IndexedDB media cache index (0 network bytes) + sync DB SFX mappings
          virtualGiftDatabase.syncAudioManagerMappings();
          await hydrateGiftMediaCacheIndex().catch(() => {});

          if (signal.aborted) return;

          // Collect custom SFX paths from catalog gifts and ensure ID mappings are registered
          const extraSfxPaths: string[] = [];
          const catalog = giftsRef.current;
          for (const g of catalog) {
            if (typeof g.audioAssetPath === 'string' && g.audioAssetPath.trim()) {
              const trimmed = g.audioAssetPath.trim();
              extraSfxPaths.push(trimmed);
              if (g.id) {
                audioManager.registerAssetMapping(g.id, trimmed);
              }
            }
          }

          // 2. Collect advanced video gift audio tracks (prioritizing already-cached local blobs first)
          const cachedVideoEntries: Array<{ url: string; cacheKey: string }> = [];
          const remoteVideoEntries: Array<{ url: string; cacheKey: string }> = [];

          for (const g of catalog) {
            const cfg = g.advancedConfig;
            if (!cfg || cfg.enableSound === false) continue;
            const resolved = resolvePlayableGiftUrl(cfg);
            if (!resolved?.url || !VIDEO_GIFT_FORMATS.has(resolved.effectiveFormat)) continue;

            const remoteUrl = resolved.url;
            if (audioManager.hasDecodedBuffer(remoteUrl)) continue;

            const syncBlob = getCachedGiftMediaUrlSync(remoteUrl);
            if (syncBlob) {
              cachedVideoEntries.push({ url: syncBlob, cacheKey: remoteUrl });
              continue;
            }

            // Fast IndexedDB lookup (0 network bytes)
            try {
              const idb = await resolveCachedGiftMediaUrl(remoteUrl, {
                giftId: g.id || cfg.id || 'gift',
                autoCache: false,
              });
              if (signal.aborted) return;
              if (idb.fromCache && idb.playableUrl) {
                cachedVideoEntries.push({ url: idb.playableUrl, cacheKey: remoteUrl });
                continue;
              }
            } catch {
              // fallback to remote queue below
            }

            remoteVideoEntries.push({ url: remoteUrl, cacheKey: remoteUrl });
          }

          if (signal.aborted) return;

          // Respect weak connections so Party Voice bandwidth is never starved
          const weakNet = isWeakNetworkConnection();
          const remoteCap = weakNet ? Math.min(2, maxUncachedVideoTracks) : maxUncachedVideoTracks;
          const videoAudioQueue = [
            ...cachedVideoEntries,
            ...remoteVideoEntries.slice(0, Math.max(0, remoteCap)),
          ];

          // Estimate total work units (standard SFX cues + VIP cues + video audio tracks)
          const estimatedSfxUnits = 15 + extraSfxPaths.length;
          const grandTotal = estimatedSfxUnits + videoAudioQueue.length;
          setTotalCount(grandTotal);
          setLoadedCount(0);

          let sfxDone = 0;
          let mediaDone = 0;

          // 3. Eagerly preload all standard gift SFX + combo + VIP fanfares into Web Audio API buffers
          await audioManager.preloadGiftSfx(undefined, {
            extraPaths: extraSfxPaths,
            includeVipEntry: true,
            concurrency: weakNet ? 2 : 4,
            signal,
            onItemComplete: (done, total) => {
              sfxDone = done;
              setTotalCount(total + videoAudioQueue.length);
              setLoadedCount(sfxDone + mediaDone);
              setDecodedBufferCount(audioManager.getBufferStats().decodedCount);
            },
          });

          if (signal.aborted) return;

          // 4. Eagerly decode video gift audio tracks into Web Audio API buffers (low concurrency = voice-safe)
          if (videoAudioQueue.length > 0) {
            await audioManager.preloadMediaAudioTracks(videoAudioQueue, {
              concurrency: weakNet ? 1 : 2,
              signal,
              onItemComplete: (done) => {
                mediaDone = done;
                setLoadedCount(sfxDone + mediaDone);
                setDecodedBufferCount(audioManager.getBufferStats().decodedCount);
              },
            });
          }

          if (!signal.aborted) {
            lastCompletedSignature = signature;
            setDecodedBufferCount(audioManager.getBufferStats().decodedCount);
            setStatus('ready');
          }
        } catch {
          if (!signal.aborted) {
            setDecodedBufferCount(audioManager.getBufferStats().decodedCount);
            setStatus('ready');
          }
        } finally {
          if (inflightPreloadSignature === signature) {
            inflightPreloadSignature = null;
            inflightPreloadPromise = null;
          }
        }
      })();

      inflightPreloadSignature = signature;
      inflightPreloadPromise = task;
      await task;
    },
    [enabled, roomId, catalogSignature, maxUncachedVideoTracks]
  );

  // Trigger eagerly the moment the user enters a Party Room (or catalog updates while inside)
  useEffect(() => {
    if (!enabled || !roomId) {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      setStatus('idle');
      return;
    }

    void runEagerPreload(false);

    // If the user recovers from an offline/flaky network while in the room, finish preloading
    const handleOnline = () => {
      void runEagerPreload(true);
    };
    window.addEventListener('online', handleOnline);

    return () => {
      window.removeEventListener('online', handleOnline);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, [enabled, roomId, runEagerPreload]);

  const preloadNow = useCallback(() => runEagerPreload(true), [runEagerPreload]);

  return {
    status,
    loadedCount,
    totalCount,
    decodedBufferCount,
    isAudioUnlocked,
    preloadNow,
  };
}
