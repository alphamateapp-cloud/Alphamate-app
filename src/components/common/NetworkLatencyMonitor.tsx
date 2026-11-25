import React, { useEffect, useMemo, useRef, useState } from 'react';
import { WifiOff } from 'lucide-react';
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
    txQuality >= 5 ||
    (packetLossPct !== null && packetLossPct >= 10) ||
    (rttMs !== null && rttMs > 650)
  ) {
    return 'poor';
  }

  if (
    normState === 'reconnecting' ||
    normState === 'connecting' ||
    txQuality === 4 ||
    (packetLossPct !== null && packetLossPct >= 4) ||
    (rttMs !== null && rttMs > 280)
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
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!enabled || !sessionId) return;

    let cancelled = false;

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

      if (cancelled) return;

      const tier = classifyTier({
        rttMs,
        packetLossPct,
        txQuality,
        connectionState,
        isOffline,
      });

      setSnapshot((prev) => {
        if (
          prev.rttMs === rttMs &&
          prev.packetLossPct === packetLossPct &&
          prev.txQuality === txQuality &&
          prev.connectionState === connectionState &&
          prev.tier === tier &&
          prev.isOffline === isOffline
        ) {
          return prev;
        }
        return {
          rttMs,
          packetLossPct,
          txQuality,
          connectionState,
          tier,
          isOffline,
        };
      });
    };

    const handleOnlineChange = () => {
      void sampleNow();
    };

    window.addEventListener('online', handleOnlineChange);
    window.addEventListener('offline', handleOnlineChange);
    void sampleNow();
    // Poll gently every 8s (no redundant HTTP /api/health requests competing with live voice)
    const timer = setInterval(() => {
      void sampleNow();
    }, 8000);

    return () => {
      cancelled = true;
      clearInterval(timer);
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
    </>
  );
};
