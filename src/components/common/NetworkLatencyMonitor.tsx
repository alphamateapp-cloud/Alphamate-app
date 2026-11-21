import React, { useEffect, useMemo, useRef, useState } from 'react';
import { WifiOff, X } from 'lucide-react';
import { p2pStreamingEngine } from '../../services/webrtcService';
import { agoraPartyEngine } from '../../services/agoraPartyEngine';

export type LatencyTier = 'good' | 'fair' | 'poor';

interface NetworkLatencyMonitorProps {
  mode: 'solo_live' | 'party_room';
  sessionId: string;
  enabled?: boolean;
  className?: string;
}

interface LatencySnapshot {
  rttMs: number | null;
  packetLossPct: number | null;
  txQuality: number;
  connectionState: string;
  tier: LatencyTier;
  isOffline: boolean;
}

function classifyTier(params: {
  rttMs: number | null;
  packetLossPct: number | null;
  txQuality: number;
  connectionState: string;
  isOffline: boolean;
}): LatencyTier {
  const { rttMs, packetLossPct, txQuality, connectionState, isOffline } = params;
  const normState = connectionState.toLowerCase();

  if (
    isOffline ||
    normState === 'failed' ||
    normState === 'disconnected' ||
    txQuality >= 4 ||
    (packetLossPct !== null && packetLossPct >= 6) ||
    (rttMs !== null && rttMs > 380)
  ) {
    return 'poor';
  }

  if (
    normState === 'reconnecting' ||
    normState === 'connecting' ||
    txQuality === 3 ||
    (packetLossPct !== null && packetLossPct >= 2) ||
    (rttMs !== null && rttMs > 160)
  ) {
    return 'fair';
  }

  return 'good';
}

function formatAgoraQualityLabel(txQuality: number): string {
  switch (txQuality) {
    case 1:
      return 'Excellent';
    case 2:
      return 'Good';
    case 3:
      return 'Fair';
    case 4:
      return 'Poor';
    case 5:
      return 'Very Poor';
    case 6:
      return 'Down';
    default:
      return 'Measuring';
  }
}

export const NetworkLatencyMonitor: React.FC<NetworkLatencyMonitorProps> = ({
  mode,
  sessionId,
  enabled = true,
  className = '',
}) => {
  const [snapshot, setSnapshot] = useState<LatencySnapshot>({
    rttMs: null,
    packetLossPct: null,
    txQuality: 0,
    connectionState: 'connecting',
    tier: 'good',
    isOffline: typeof navigator !== 'undefined' ? navigator.onLine === false : false,
  });

  const [showPopover, setShowPopover] = useState(false);
  const [alertTier, setAlertTier] = useState<'fair' | 'poor' | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const consecutiveUnstableRef = useRef<number>(0);
  const lastDismissedAtRef = useRef<number>(0);
  const lastDismissedTierRef = useRef<'fair' | 'poor' | null>(null);

  useEffect(() => {
    if (!enabled || !sessionId) return;

    let cancelled = false;
    let activeAbort: AbortController | null = null;

    const measureFallbackRtt = async (): Promise<number | null> => {
      if (typeof navigator !== 'undefined' && navigator.onLine === false) return null;
      const base = agoraPartyEngine.getResolvedApiBase();
      const targetUrl = `${base}/api/health`;
      const controller = new AbortController();
      activeAbort = controller;
      const timer = setTimeout(() => controller.abort(), 3800);
      const started = performance.now();
      try {
        const res = await fetch(targetUrl, {
          method: 'GET',
          cache: 'no-store',
          signal: controller.signal,
        });
        if (!res.ok && res.status >= 500) return null;
        return Math.max(1, Math.round(performance.now() - started));
      } catch {
        return null;
      } finally {
        clearTimeout(timer);
        if (activeAbort === controller) activeAbort = null;
      }
    };

    const sampleNow = async () => {
      if (cancelled) return;
      const isOffline = typeof navigator !== 'undefined' && navigator.onLine === false;

      let rttMs: number | null = null;
      let packetLossPct: number | null = null;
      let txQuality = 0;
      let connectionState = 'connected';

      if (mode === 'solo_live') {
        const stats = await p2pStreamingEngine.getHostNetworkLatencyStats(sessionId);
        rttMs = stats.rttMs;
        packetLossPct = stats.packetLossPct;
        connectionState = stats.connectionState;
      } else {
        const stats = agoraPartyEngine.getNetworkLatencyStats(sessionId);
        rttMs = stats.rttMs;
        txQuality = stats.txQuality;
        connectionState = stats.connectionState;
      }

      if (rttMs === null && !isOffline) {
        rttMs = await measureFallbackRtt();
        if (cancelled) return;
      }

      const tier = classifyTier({
        rttMs,
        packetLossPct,
        txQuality,
        connectionState,
        isOffline,
      });

      setSnapshot({
        rttMs,
        packetLossPct,
        txQuality,
        connectionState,
        tier,
        isOffline,
      });

      if (tier === 'good') {
        consecutiveUnstableRef.current = 0;
        setAlertTier(null);
      } else {
        consecutiveUnstableRef.current += 1;
        const requiredSamples = isOffline ? 1 : 2;
        if (consecutiveUnstableRef.current >= requiredSamples) {
          const now = Date.now();
          const inCooldown =
            now - lastDismissedAtRef.current < 45_000 &&
            !(tier === 'poor' && lastDismissedTierRef.current === 'fair');
          if (!inCooldown) {
            setAlertTier(tier);
          }
        }
      }
    };

    const handleOnlineChange = () => {
      void sampleNow();
    };

    window.addEventListener('online', handleOnlineChange);
    window.addEventListener('offline', handleOnlineChange);
    void sampleNow();
    const timer = setInterval(() => {
      void sampleNow();
    }, 3000);

    return () => {
      cancelled = true;
      clearInterval(timer);
      if (activeAbort) activeAbort.abort();
      window.removeEventListener('online', handleOnlineChange);
      window.removeEventListener('offline', handleOnlineChange);
    };
  }, [enabled, mode, sessionId]);

  useEffect(() => {
    if (!showPopover) return;
    const handleOutside = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowPopover(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('touchstart', handleOutside);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('touchstart', handleOutside);
    };
  }, [showPopover]);

  const theme = useMemo(() => {
    if (snapshot.tier === 'poor') {
      return {
        litBars: 1,
        barColor: 'bg-rose-500',
        border: 'border-rose-500/45',
        text: 'text-rose-300',
        label: snapshot.isOffline ? 'Offline' : 'Unstable',
      };
    }
    if (snapshot.tier === 'fair') {
      return {
        litBars: 2,
        barColor: 'bg-amber-400',
        border: 'border-amber-400/45',
        text: 'text-amber-300',
        label: 'Moderate Lag',
      };
    }
    return {
      litBars: 3,
      barColor: 'bg-emerald-400',
      border: 'border-emerald-400/35',
      text: 'text-emerald-300',
      label: 'Stable',
    };
  }, [snapshot.tier, snapshot.isOffline]);

  if (!enabled || !sessionId) return null;

  const rttDisplay = snapshot.isOffline
    ? 'Off'
    : snapshot.rttMs !== null
      ? `${snapshot.rttMs}ms`
      : '--';

  return (
    <>
      <div ref={containerRef} className={`relative inline-flex items-center shrink-0 ${className}`}>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setShowPopover((prev) => !prev);
          }}
          aria-label={`Network status: ${theme.label}, latency ${rttDisplay}`}
          title={`Network ${theme.label} (${rttDisplay})`}
          className={`flex items-center gap-1.5 px-2 py-1 rounded-full bg-black/65 backdrop-blur-md border ${theme.border} hover:bg-black/80 transition-colors cursor-pointer`}
        >
          {snapshot.isOffline ? (
            <WifiOff className="w-3 h-3 text-rose-400 animate-pulse" />
          ) : (
            <span className="flex items-end gap-[2px] h-3" aria-hidden="true">
              <span
                className={`w-[3px] h-1.5 rounded-[1px] transition-colors ${
                  theme.litBars >= 1
                    ? `${theme.barColor} ${snapshot.tier === 'poor' ? 'animate-pulse' : ''}`
                    : 'bg-white/20'
                }`}
              />
              <span
                className={`w-[3px] h-2.5 rounded-[1px] transition-colors ${
                  theme.litBars >= 2 ? theme.barColor : 'bg-white/20'
                }`}
              />
              <span
                className={`w-[3px] h-3 rounded-[1px] transition-colors ${
                  theme.litBars >= 3 ? theme.barColor : 'bg-white/20'
                }`}
              />
            </span>
          )}
          <span className={`text-[9px] font-extrabold tabular-nums leading-none ${theme.text}`}>
            {rttDisplay}
          </span>
        </button>

        {showPopover && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute right-0 top-full mt-1.5 w-48 rounded-2xl bg-[#140826]/95 backdrop-blur-xl border border-white/15 p-2.5 shadow-2xl z-50 text-left"
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400">
                Network Health
              </span>
              <span className={`text-[10px] font-extrabold ${theme.text}`}>
                {theme.label}
              </span>
            </div>
            <div className="space-y-1 text-[10px] text-zinc-300">
              <div className="flex items-center justify-between">
                <span className="text-zinc-400">Latency (RTT)</span>
                <span className="font-bold text-white tabular-nums">
                  {snapshot.rttMs !== null ? `${snapshot.rttMs} ms` : 'Measuring…'}
                </span>
              </div>
              {mode === 'solo_live' && snapshot.packetLossPct !== null && (
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">Packet Loss</span>
                  <span className="font-bold text-white tabular-nums">
                    {snapshot.packetLossPct}%
                  </span>
                </div>
              )}
              {mode === 'party_room' && snapshot.txQuality > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">Uplink Signal</span>
                  <span className="font-bold text-white">
                    {formatAgoraQualityLabel(snapshot.txQuality)}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-zinc-400">Transport</span>
                <span className="font-semibold text-zinc-200 capitalize">
                  {snapshot.connectionState}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Unobtrusive Stability Alert Toast (only on sustained yellow/red connection issues) */}
      {alertTier && (
        <div
          role="status"
          aria-live="polite"
          className="fixed top-[max(5.5rem,calc(var(--app-safe-top,0px)+5rem))] left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-xs z-[65] pointer-events-auto animate-fade-in"
        >
          <div
            className={`flex items-center justify-between gap-2 px-3 py-2 rounded-2xl backdrop-blur-md shadow-xl border text-[10px] ${
              alertTier === 'poor'
                ? 'bg-rose-950/90 border-rose-500/45 text-rose-100'
                : 'bg-amber-950/90 border-amber-400/45 text-amber-100'
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${
                  alertTier === 'poor' ? 'bg-rose-400 animate-ping' : 'bg-amber-400'
                }`}
              />
              <span className="font-semibold leading-snug truncate">
                {snapshot.isOffline
                  ? 'Connection lost — attempting to reconnect…'
                  : alertTier === 'poor'
                    ? `Unstable connection (${rttDisplay}) — check signal`
                    : `High network delay (${rttDisplay})`}
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                lastDismissedAtRef.current = Date.now();
                lastDismissedTierRef.current = alertTier;
                setAlertTier(null);
              }}
              aria-label="Dismiss network alert"
              className="w-5 h-5 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center shrink-0 cursor-pointer"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}
    </>
  );
};
