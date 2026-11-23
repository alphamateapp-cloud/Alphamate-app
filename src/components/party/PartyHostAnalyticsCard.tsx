import React, { useMemo, useState } from 'react';
import { X, TrendingUp, Users, Gift, Heart, Clock } from 'lucide-react';
import { PartyLeaderboardEntry } from './PartyLeaderboardModal';

export interface PartySessionSample {
  timestampMs: number;
  viewers: number;
  retentionPct: number;
  giftCoins: number;
  hearts: number;
}

interface PartyHostAnalyticsCardProps {
  isOpen: boolean;
  roomTitle: string;
  sessionStartMs: number;
  activeViewers: number;
  peakViewers: number;
  totalGiftCoins: number;
  totalHeartCount: number;
  sessionGivers: PartyLeaderboardEntry[];
  samples: PartySessionSample[];
  onClose: () => void;
}

type ChartSeriesMode = 'both' | 'retention' | 'gifts';

function formatCompactNumber(value: number): string {
  const safe = Math.max(0, Math.floor(Number(value) || 0));
  if (safe >= 1_000_000) return `${(safe / 1_000_000).toFixed(1)}M`;
  if (safe >= 1_000) return `${(safe / 1_000).toFixed(1)}k`;
  return safe.toLocaleString();
}

function formatElapsedTime(startMs: number, nowMs: number): string {
  const elapsedSec = Math.max(0, Math.floor((nowMs - startMs) / 1000));
  const hrs = Math.floor(elapsedSec / 3600);
  const mins = Math.floor((elapsedSec % 3600) / 60);
  const secs = elapsedSec % 60;
  if (hrs > 0) {
    return `${hrs}h ${String(mins).padStart(2, '0')}m`;
  }
  return `${mins}m ${String(secs).padStart(2, '0')}s`;
}

function formatAxisTick(timestampMs: number, startMs: number): string {
  const diffMin = Math.max(0, Math.round((timestampMs - startMs) / 60000));
  if (diffMin === 0) return 'Start';
  if (diffMin < 60) return `${diffMin}m`;
  const h = Math.floor(diffMin / 60);
  const m = diffMin % 60;
  return m > 0 ? `${h}h${m}m` : `${h}h`;
}

function buildPolylinePoints(
  values: number[],
  maxValue: number,
  width: number,
  height: number,
  padX: number,
  padY: number
): Array<{ x: number; y: number }> {
  const usableW = Math.max(1, width - padX * 2);
  const usableH = Math.max(1, height - padY * 2);
  const safeMax = Math.max(1, maxValue);
  const count = values.length;

  if (count === 0) return [];
  if (count === 1) {
    const ratio = Math.min(1, Math.max(0, values[0] / safeMax));
    const y = padY + usableH - ratio * usableH;
    return [
      { x: padX, y },
      { x: padX + usableW, y },
    ];
  }

  return values.map((v, idx) => {
    const x = padX + (idx / (count - 1)) * usableW;
    const ratio = Math.min(1, Math.max(0, v / safeMax));
    const y = padY + usableH - ratio * usableH;
    return { x, y };
  });
}

function pointsToLinePath(pts: Array<{ x: number; y: number }>): string {
  if (pts.length === 0) return '';
  return pts
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ');
}

function pointsToAreaPath(
  pts: Array<{ x: number; y: number }>,
  baselineY: number
): string {
  if (pts.length === 0) return '';
  const line = pointsToLinePath(pts);
  const last = pts[pts.length - 1];
  const first = pts[0];
  return `${line} L ${last.x.toFixed(1)} ${baselineY.toFixed(1)} L ${first.x.toFixed(1)} ${baselineY.toFixed(1)} Z`;
}

export const PartyHostAnalyticsCard: React.FC<PartyHostAnalyticsCardProps> = ({
  isOpen,
  roomTitle,
  sessionStartMs,
  activeViewers,
  peakViewers,
  totalGiftCoins,
  totalHeartCount,
  sessionGivers,
  samples,
  onClose,
}) => {
  const [seriesMode, setSeriesMode] = useState<ChartSeriesMode>('both');

  const safePeak = Math.max(1, peakViewers, activeViewers);
  const currentRetentionPct =
    peakViewers > 0
      ? Math.min(100, Math.round((activeViewers / safePeak) * 100))
      : activeViewers > 0
      ? 100
      : 0;

  const totalGiftsCount = useMemo(() => {
    return sessionGivers.reduce((sum, entry) => sum + Math.max(1, Number(entry.giftCount || 1)), 0);
  }, [sessionGivers]);

  const avgViewers = useMemo(() => {
    if (samples.length === 0) return activeViewers;
    const sum = samples.reduce((acc, s) => acc + s.viewers, 0);
    return Math.round(sum / samples.length);
  }, [samples, activeViewers]);

  const topSupporter = sessionGivers[0] || null;

  const chartData = useMemo(() => {
    const effectiveSamples: PartySessionSample[] =
      samples.length > 0
        ? samples
        : [
            {
              timestampMs: sessionStartMs,
              viewers: activeViewers,
              retentionPct: currentRetentionPct,
              giftCoins: totalGiftCoins,
              hearts: totalHeartCount,
            },
          ];

    const W = 320;
    const H = 132;
    const padX = 10;
    const padY = 14;
    const baselineY = H - padY;

    const retentionValues = effectiveSamples.map((s) => s.retentionPct);
    const giftValues = effectiveSamples.map((s) => s.giftCoins);

    const maxGiftCoins = Math.max(100, ...giftValues);

    const retentionPts = buildPolylinePoints(retentionValues, 100, W, H, padX, padY);
    const giftPts = buildPolylinePoints(giftValues, maxGiftCoins, W, H, padX, padY);

    const firstTs = effectiveSamples[0]?.timestampMs ?? sessionStartMs;
    const midTs =
      effectiveSamples[Math.floor(effectiveSamples.length / 2)]?.timestampMs ?? firstTs;
    const lastTs = effectiveSamples[effectiveSamples.length - 1]?.timestampMs ?? Date.now();

    return {
      W,
      H,
      padX,
      padY,
      baselineY,
      maxGiftCoins,
      retentionPts,
      giftPts,
      retentionLine: pointsToLinePath(retentionPts),
      retentionArea: pointsToAreaPath(retentionPts, baselineY),
      giftLine: pointsToLinePath(giftPts),
      giftArea: pointsToAreaPath(giftPts, baselineY),
      startLabel: formatAxisTick(firstTs, sessionStartMs),
      midLabel: effectiveSamples.length > 2 ? formatAxisTick(midTs, sessionStartMs) : '',
      endLabel: 'Now',
      lastTs,
    };
  }, [samples, sessionStartMs, activeViewers, currentRetentionPct, totalGiftCoins, totalHeartCount]);

  if (!isOpen) return null;

  const sessionDuration = formatElapsedTime(sessionStartMs, Math.max(Date.now(), chartData.lastTs));

  return (
    <div
      data-keep-dark="true"
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 select-none"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-t-3xl sm:rounded-3xl bg-[#120A22]/98 border-t sm:border border-white/12 p-5 shadow-2xl text-white flex flex-col max-h-[86vh]"
      >
        {/* Subtle handle bar on mobile */}
        <div className="w-10 h-1 rounded-full bg-white/15 mx-auto mb-3 sm:hidden" />

        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-2xl bg-[#1D1236] border border-white/10 flex items-center justify-center shrink-0">
              <TrendingUp className="w-4 h-4 text-cyan-300" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-white leading-tight">Session Insights</h3>
              <p className="text-[11px] text-zinc-400 truncate">{roomTitle}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close session insights"
            className="w-11 h-11 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-zinc-300 hover:text-white cursor-pointer shrink-0 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto pt-4 pb-1 space-y-4">
          {/* 3 Clean KPI Summary Cards */}
          <div className="grid grid-cols-3 gap-2.5">
            <div className="p-3 rounded-2xl bg-[#191030] border border-white/8">
              <div className="flex items-center gap-1.5 text-cyan-300 mb-1">
                <Users className="w-3.5 h-3.5 shrink-0" />
                <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400 truncate">
                  Retention
                </span>
              </div>
              <div className="text-lg font-extrabold text-white tabular-nums leading-none">
                {currentRetentionPct}%
              </div>
              <p className="text-[10px] text-zinc-400 mt-1 tabular-nums truncate">
                {activeViewers} now · {peakViewers} peak
              </p>
            </div>

            <div className="p-3 rounded-2xl bg-[#191030] border border-white/8">
              <div className="flex items-center gap-1.5 text-amber-300 mb-1">
                <Gift className="w-3.5 h-3.5 shrink-0" />
                <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400 truncate">
                  Gifts
                </span>
              </div>
              <div className="text-lg font-extrabold text-white tabular-nums leading-none">
                {formatCompactNumber(totalGiftCoins)}
              </div>
              <p className="text-[10px] text-zinc-400 mt-1 tabular-nums truncate">
                {totalGiftsCount} {totalGiftsCount === 1 ? 'gift' : 'gifts'}
              </p>
            </div>

            <div className="p-3 rounded-2xl bg-[#191030] border border-white/8">
              <div className="flex items-center gap-1.5 text-pink-300 mb-1">
                <Clock className="w-3.5 h-3.5 shrink-0" />
                <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400 truncate">
                  Session
                </span>
              </div>
              <div className="text-lg font-extrabold text-white tabular-nums leading-none">
                {sessionDuration}
              </div>
              <p className="text-[10px] text-zinc-400 mt-1 tabular-nums truncate flex items-center gap-1">
                <Heart className="w-2.5 h-2.5 text-pink-400 fill-pink-400 shrink-0" />
                <span>{formatCompactNumber(totalHeartCount)}</span>
              </p>
            </div>
          </div>

          {/* Simple Line Chart Container */}
          <div className="p-3.5 rounded-2xl bg-[#0E071B] border border-white/10">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div>
                <h4 className="text-xs font-bold text-white">Session Trend</h4>
                <p className="text-[10px] text-zinc-400">
                  {seriesMode === 'both'
                    ? 'Audience retention & gifts over time'
                    : seriesMode === 'retention'
                    ? 'Audience retention percentage (0–100%)'
                    : 'Total gift coins received'}
                </p>
              </div>

              {/* Clean Metric Selector */}
              <div className="inline-flex p-0.5 rounded-xl bg-white/5 border border-white/10 shrink-0">
                {(
                  [
                    { id: 'both', label: 'Both' },
                    { id: 'retention', label: 'Retention' },
                    { id: 'gifts', label: 'Gifts' },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setSeriesMode(tab.id)}
                    className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-colors cursor-pointer ${
                      seriesMode === tab.id
                        ? 'bg-white/15 text-white'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Clean SVG Line Chart */}
            <div className="relative">
              <svg
                viewBox={`0 0 ${chartData.W} ${chartData.H}`}
                className="w-full h-36 overflow-visible"
                role="img"
                aria-label="Party room session statistics line chart"
              >
                <defs>
                  <linearGradient id="partyRetentionFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.28" />
                    <stop offset="100%" stopColor="#38BDF8" stopOpacity="0.01" />
                  </linearGradient>
                  <linearGradient id="partyGiftsFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#F59E0B" stopOpacity="0.26" />
                    <stop offset="100%" stopColor="#F59E0B" stopOpacity="0.01" />
                  </linearGradient>
                </defs>

                {/* Subtle Horizontal Gridlines */}
                {[0, 0.5, 1].map((frac) => {
                  const y =
                    chartData.padY + (1 - frac) * (chartData.H - chartData.padY * 2);
                  return (
                    <line
                      key={frac}
                      x1={chartData.padX}
                      x2={chartData.W - chartData.padX}
                      y1={y}
                      y2={y}
                      stroke="rgba(255,255,255,0.08)"
                      strokeDasharray="3 4"
                      strokeWidth="1"
                    />
                  );
                })}

                {/* Audience Retention Series */}
                {(seriesMode === 'both' || seriesMode === 'retention') && (
                  <>
                    <path d={chartData.retentionArea} fill="url(#partyRetentionFill)" />
                    <path
                      d={chartData.retentionLine}
                      fill="none"
                      stroke="#38BDF8"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    {chartData.retentionPts.length > 0 && (
                      <circle
                        cx={chartData.retentionPts[chartData.retentionPts.length - 1].x}
                        cy={chartData.retentionPts[chartData.retentionPts.length - 1].y}
                        r="3.5"
                        fill="#38BDF8"
                        stroke="#0E071B"
                        strokeWidth="1.5"
                      />
                    )}
                  </>
                )}

                {/* Total Gifts Received Series */}
                {(seriesMode === 'both' || seriesMode === 'gifts') && (
                  <>
                    <path d={chartData.giftArea} fill="url(#partyGiftsFill)" />
                    <path
                      d={chartData.giftLine}
                      fill="none"
                      stroke="#F59E0B"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    {chartData.giftPts.length > 0 && (
                      <circle
                        cx={chartData.giftPts[chartData.giftPts.length - 1].x}
                        cy={chartData.giftPts[chartData.giftPts.length - 1].y}
                        r="3.5"
                        fill="#F59E0B"
                        stroke="#0E071B"
                        strokeWidth="1.5"
                      />
                    )}
                  </>
                )}
              </svg>

              {/* Time Axis Labels */}
              <div className="flex items-center justify-between text-[10px] text-zinc-500 mt-1 px-1 tabular-nums">
                <span>{chartData.startLabel}</span>
                {chartData.midLabel && <span>{chartData.midLabel}</span>}
                <span className="text-zinc-300 font-medium">{chartData.endLabel}</span>
              </div>
            </div>

            {/* Clean Legend */}
            <div className="flex items-center justify-between pt-2.5 mt-2.5 border-t border-white/8 text-[10.5px]">
              <div className="flex items-center gap-4">
                {(seriesMode === 'both' || seriesMode === 'retention') && (
                  <span className="inline-flex items-center gap-1.5 text-zinc-300">
                    <span className="w-2.5 h-0.5 rounded-full bg-sky-400" />
                    <span>Retention ({currentRetentionPct}%)</span>
                  </span>
                )}
                {(seriesMode === 'both' || seriesMode === 'gifts') && (
                  <span className="inline-flex items-center gap-1.5 text-zinc-300">
                    <span className="w-2.5 h-0.5 rounded-full bg-amber-400" />
                    <span>Gifts ({formatCompactNumber(totalGiftCoins)} coins)</span>
                  </span>
                )}
              </div>
              {seriesMode === 'gifts' && (
                <span className="text-[10px] text-zinc-500 tabular-nums">
                  Peak {formatCompactNumber(chartData.maxGiftCoins)}
                </span>
              )}
            </div>
          </div>

          {/* Calm Session Highlights Row */}
          <div className="grid grid-cols-2 gap-2.5 text-xs">
            <div className="p-3 rounded-2xl bg-[#160E2B] border border-white/8">
              <span className="text-[10px] font-semibold text-zinc-400 block">
                Average Audience
              </span>
              <span className="text-sm font-bold text-white tabular-nums mt-0.5 block">
                {avgViewers.toLocaleString()} listeners
              </span>
            </div>

            <div className="p-3 rounded-2xl bg-[#160E2B] border border-white/8">
              <span className="text-[10px] font-semibold text-zinc-400 block">
                Top Supporter
              </span>
              <span className="text-sm font-bold text-white truncate mt-0.5 block">
                {topSupporter
                  ? `${topSupporter.user.displayName} (${formatCompactNumber(topSupporter.totalCoins)})`
                  : 'No gifts yet'}
              </span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full min-h-[44px] rounded-2xl bg-white/10 hover:bg-white/15 border border-white/10 text-zinc-200 text-xs font-bold hover:text-white cursor-pointer transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  );
};
