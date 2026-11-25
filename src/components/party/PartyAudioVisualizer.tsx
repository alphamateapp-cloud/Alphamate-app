import React, { useEffect, useRef } from 'react';
import { PartySeatThemeId } from './AnimatedSeatThemeFrame';
import { usePartyAudioAnalyser } from '../../hooks/usePartyAudioAnalyser';

interface PartyAudioVisualizerProps {
  roomId: string | null | undefined;
  theme: PartySeatThemeId;
  isSpeakerOn: boolean;
  isMusicPlaying?: boolean;
  remoteStreams?: Array<{ peerId: string; stream: MediaStream }>;
  /** Optional stage container ref — receives smooth `--party-audio-energy` & `--party-audio-bass` CSS vars so seat theme frames animate in lockstep with live frequencies */
  stageContainerRef?: React.RefObject<HTMLDivElement | null>;
  compact?: boolean;
}

interface VisualizerThemePalette {
  barBottom: string;
  barMid: string;
  barTop: string;
  peakCap: string;
  crestStroke: string;
  haloInner: string;
  haloOuter: string;
  baseline: string;
}

const VISUALIZER_THEME_PALETTES: Record<PartySeatThemeId, VisualizerThemePalette> = {
  royal_gold_diya: {
    barBottom: 'rgba(180, 83, 9, 0.72)',
    barMid: 'rgba(245, 158, 11, 0.92)',
    barTop: 'rgba(254, 240, 138, 0.98)',
    peakCap: '#FB7185', // Ruby-ember diya accent matching Royal Gold Diya crest
    crestStroke: 'rgba(254, 240, 138, 0.48)',
    haloInner: 'rgba(251, 191, 36, 0.28)',
    haloOuter: 'rgba(245, 158, 11, 0)',
    baseline: 'rgba(253, 224, 71, 0.26)',
  },
  royal_purple_lotus: {
    barBottom: 'rgba(126, 34, 206, 0.72)',
    barMid: 'rgba(192, 132, 252, 0.92)',
    barTop: 'rgba(245, 208, 254, 0.98)',
    peakCap: '#F472B6', // Lotus-petal rose highlight matching Royal Purple Lotus
    crestStroke: 'rgba(240, 171, 252, 0.48)',
    haloInner: 'rgba(217, 70, 239, 0.28)',
    haloOuter: 'rgba(147, 51, 234, 0)',
    baseline: 'rgba(232, 121, 249, 0.26)',
  },
  diamond_ice_blue: {
    barBottom: 'rgba(2, 132, 199, 0.72)',
    barMid: 'rgba(56, 189, 248, 0.92)',
    barTop: 'rgba(224, 242, 254, 0.98)',
    peakCap: '#FFFFFF', // Faceted diamond-white specular cap
    crestStroke: 'rgba(186, 230, 253, 0.52)',
    haloInner: 'rgba(56, 189, 248, 0.30)',
    haloOuter: 'rgba(14, 165, 233, 0)',
    baseline: 'rgba(125, 211, 252, 0.28)',
  },
};

const HALF_BAR_COUNT = 16; // Mirrored left + right -> 32 crisp symmetric frequency bars

/**
 * Real-Time Party Room Frequency Visualizer.
 *
 * Renders a zero-clutter, edge-feathered 60fps Canvas spectrum driven by the Web Audio API
 * `AnalyserNode` (`usePartyAudioAnalyser`). Automatically harmonizes its palette, peak glints,
 * and stage aura with the active Party Seat Theme (`Royal Gold Diya`, `Royal Purple Lotus`,
 * `Diamond Ice Blue`) and publishes smoothed `--party-audio-energy` CSS variables to the stage
 * so all seat frames animate in exact rhythmic sync with active stream audio.
 */
export const PartyAudioVisualizer: React.FC<PartyAudioVisualizerProps> = React.memo(
  ({
    roomId,
    theme,
    isSpeakerOn,
    isMusicPlaying = false,
    remoteStreams = [],
    stageContainerRef,
    compact = false,
  }) => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const themeRef = useRef<PartySeatThemeId>(theme);
    themeRef.current = theme;
    const isMusicPlayingRef = useRef<boolean>(isMusicPlaying);
    isMusicPlayingRef.current = isMusicPlaying;

    const { sampleSpectrum } = usePartyAudioAnalyser({
      roomId,
      isSpeakerOn,
      remoteStreams,
      fftSize: 128,
    });

    useEffect(() => {
      if (!roomId) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx2d = canvas.getContext('2d');
      if (!ctx2d) return;

      const reducedMotionQuery =
        typeof window !== 'undefined' && window.matchMedia
          ? window.matchMedia('(prefers-reduced-motion: reduce)')
          : null;

      const bandValues = new Float32Array(HALF_BAR_COUNT);
      const peakHold = new Float32Array(HALF_BAR_COUNT);
      const peakVel = new Float32Array(HALF_BAR_COUNT);

      let rafId = 0;
      let widthCss = 0;
      let heightCss = 0;
      let dpr = 1;
      let smoothedEnergy = 0;
      let smoothedBass = 0;
      let lastCssUpdateAt = 0;
      let lastReducedDrawAt = 0;

      const syncCanvasSize = () => {
        const rect = canvas.getBoundingClientRect();
        widthCss = Math.max(120, Math.round(rect.width));
        heightCss = Math.max(20, Math.round(rect.height));
        dpr = Math.min(window.devicePixelRatio || 1, 2);
        const targetW = Math.round(widthCss * dpr);
        const targetH = Math.round(heightCss * dpr);
        if (canvas.width !== targetW || canvas.height !== targetH) {
          canvas.width = targetW;
          canvas.height = targetH;
        }
      };

      syncCanvasSize();
      const resizeObserver =
        typeof ResizeObserver !== 'undefined' ? new ResizeObserver(syncCanvasSize) : null;
      resizeObserver?.observe(canvas);

      const drawFrame = (nowMs: number) => {
        rafId = window.requestAnimationFrame(drawFrame);

        if (document.hidden || widthCss <= 0 || heightCss <= 0) return;
        const isReducedMotion = Boolean(reducedMotionQuery?.matches);
        if (isReducedMotion && nowMs - lastReducedDrawAt < 180) return;
        lastReducedDrawAt = nowMs;

        const frame = sampleSpectrum(bandValues, nowMs, {
          isMusicPlaying: isMusicPlayingRef.current,
        });

        // Smooth stage energy & publish to CSS custom properties for synchronized seat theme frames
        const energyLerp = frame.energy > smoothedEnergy ? 0.32 : 0.14;
        smoothedEnergy += (frame.energy - smoothedEnergy) * energyLerp;
        smoothedBass += (frame.bass - smoothedBass) * 0.25;

        if (stageContainerRef?.current && nowMs - lastCssUpdateAt >= 32) {
          lastCssUpdateAt = nowMs;
          const clampedEnergy = isReducedMotion
            ? Math.min(0.35, smoothedEnergy * 0.5)
            : smoothedEnergy;
          stageContainerRef.current.style.setProperty(
            '--party-audio-energy',
            clampedEnergy.toFixed(3)
          );
          stageContainerRef.current.style.setProperty(
            '--party-audio-bass',
            smoothedBass.toFixed(3)
          );
        }

        const palette = VISUALIZER_THEME_PALETTES[themeRef.current];
        ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx2d.clearRect(0, 0, widthCss, heightCss);

        const midX = widthCss * 0.5;
        const baselineY = heightCss - 3;
        const maxBarHeight = Math.max(8, heightCss - 7);

        // 1. Subtle radial bass-reactive luminance glow centered behind the spectrum
        const glowRadius = Math.max(48, widthCss * (0.28 + smoothedBass * 0.16));
        const halo = ctx2d.createRadialGradient(
          midX,
          baselineY,
          2,
          midX,
          baselineY,
          glowRadius
        );
        halo.addColorStop(0, palette.haloInner);
        halo.addColorStop(1, palette.haloOuter);
        ctx2d.save();
        ctx2d.globalAlpha = Math.min(1, 0.35 + smoothedEnergy * 0.85);
        ctx2d.fillStyle = halo;
        ctx2d.fillRect(0, 0, widthCss, heightCss);
        ctx2d.restore();

        // 2. Delicate hairline stage horizon rule
        const baseGrad = ctx2d.createLinearGradient(0, baselineY, widthCss, baselineY);
        baseGrad.addColorStop(0, 'rgba(255,255,255,0)');
        baseGrad.addColorStop(0.2, palette.baseline);
        baseGrad.addColorStop(0.5, palette.barTop);
        baseGrad.addColorStop(0.8, palette.baseline);
        baseGrad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx2d.fillStyle = baseGrad;
        ctx2d.globalAlpha = 0.45 + smoothedEnergy * 0.45;
        ctx2d.fillRect(0, baselineY, widthCss, 1);
        ctx2d.globalAlpha = 1;

        // 3. Mirrored 32-bar perceptual frequency spectrum (bass centered, treble tapering outward)
        const totalBars = HALF_BAR_COUNT * 2;
        const usableWidth = widthCss * 0.92;
        const step = usableWidth / totalBars;
        const barW = Math.max(2.2, Math.min(4.6, step * 0.56));
        const barRadius = barW * 0.5;

        const barGrad = ctx2d.createLinearGradient(0, baselineY, 0, baselineY - maxBarHeight);
        barGrad.addColorStop(0, palette.barBottom);
        barGrad.addColorStop(0.58, palette.barMid);
        barGrad.addColorStop(1, palette.barTop);

        const crestPointsLeft: Array<{ x: number; y: number }> = [];
        const crestPointsRight: Array<{ x: number; y: number }> = [];

        for (let i = 0; i < HALF_BAR_COUNT; i++) {
          const edgeTaper = 1 - Math.pow(i / HALF_BAR_COUNT, 1.8) * 0.32;
          const amp = Math.min(1, bandValues[i] * edgeTaper);
          const barH = Math.max(2.2, amp * maxBarHeight);

          // Update gravity-falling peak hold dots
          if (barH >= peakHold[i]) {
            peakHold[i] = barH;
            peakVel[i] = 0;
          } else {
            peakVel[i] += 0.085;
            peakHold[i] = Math.max(barH, peakHold[i] - peakVel[i]);
          }

          const offsetFromCenter = (i + 0.5) * step;
          const xRight = midX + offsetFromCenter - barW * 0.5;
          const xLeft = midX - offsetFromCenter - barW * 0.5;
          const topY = baselineY - barH;

          crestPointsRight.push({ x: midX + offsetFromCenter, y: topY - 1.2 });
          crestPointsLeft.push({ x: midX - offsetFromCenter, y: topY - 1.2 });

          // Draw right & left mirrored bars with rounded top caps (with fallback for older WebViews)
          ctx2d.fillStyle = barGrad;
          ctx2d.beginPath();
          if (typeof ctx2d.roundRect === 'function') {
            ctx2d.roundRect(xRight, topY, barW, barH, [barRadius, barRadius, 1, 1]);
            ctx2d.roundRect(xLeft, topY, barW, barH, [barRadius, barRadius, 1, 1]);
          } else {
            const r = Math.min(barRadius, barH * 0.5);
            for (const x of [xRight, xLeft]) {
              ctx2d.moveTo(x, topY + barH);
              ctx2d.lineTo(x, topY + r);
              ctx2d.quadraticCurveTo(x, topY, x + r, topY);
              ctx2d.lineTo(x + barW - r, topY);
              ctx2d.quadraticCurveTo(x + barW, topY, x + barW, topY + r);
              ctx2d.lineTo(x + barW, topY + barH);
              ctx2d.closePath();
            }
          }
          ctx2d.fill();

          // Draw crisp theme-accent peak-hold glint dots when active
          if (peakHold[i] > 4.5 && !isReducedMotion) {
            const peakY = Math.max(1.5, baselineY - peakHold[i] - 2.2);
            ctx2d.fillStyle = palette.peakCap;
            ctx2d.globalAlpha = Math.min(0.95, 0.3 + amp * 0.7);
            ctx2d.beginPath();
            ctx2d.arc(midX + offsetFromCenter, peakY, Math.min(1.6, barW * 0.38), 0, Math.PI * 2);
            ctx2d.arc(midX - offsetFromCenter, peakY, Math.min(1.6, barW * 0.38), 0, Math.PI * 2);
            ctx2d.fill();
            ctx2d.globalAlpha = 1;
          }
        }

        // 4. Translucent harmonic crest ribbon connecting the live frequency peaks
        if (!isReducedMotion && crestPointsLeft.length > 1) {
          const orderedPoints = [...crestPointsLeft.reverse(), ...crestPointsRight];
          ctx2d.save();
          ctx2d.strokeStyle = palette.crestStroke;
          ctx2d.lineWidth = 1.1;
          ctx2d.lineJoin = 'round';
          ctx2d.lineCap = 'round';
          ctx2d.beginPath();
          ctx2d.moveTo(orderedPoints[0].x, orderedPoints[0].y);
          for (let p = 1; p < orderedPoints.length - 1; p++) {
            const xc = (orderedPoints[p].x + orderedPoints[p + 1].x) * 0.5;
            const yc = (orderedPoints[p].y + orderedPoints[p + 1].y) * 0.5;
            ctx2d.quadraticCurveTo(orderedPoints[p].x, orderedPoints[p].y, xc, yc);
          }
          const lastPt = orderedPoints[orderedPoints.length - 1];
          ctx2d.lineTo(lastPt.x, lastPt.y);
          ctx2d.stroke();
          ctx2d.restore();
        }
      };

      rafId = window.requestAnimationFrame(drawFrame);

      return () => {
        window.cancelAnimationFrame(rafId);
        resizeObserver?.disconnect();
        if (stageContainerRef?.current) {
          stageContainerRef.current.style.setProperty('--party-audio-energy', '0');
          stageContainerRef.current.style.setProperty('--party-audio-bass', '0');
        }
      };
    }, [roomId, sampleSpectrum, stageContainerRef]);

    if (!roomId) return null;

    return (
      <div
        aria-hidden="true"
        className={`relative w-full max-w-sm mx-auto pointer-events-none select-none shrink-0 overflow-hidden ${
          compact ? 'h-5 my-0.5' : 'h-7 mt-1 mb-0.5'
        }`}
        style={{
          WebkitMaskImage:
            'linear-gradient(to right, transparent 0%, #000 10%, #000 90%, transparent 100%)',
          maskImage:
            'linear-gradient(to right, transparent 0%, #000 10%, #000 90%, transparent 100%)',
        }}
      >
        <canvas ref={canvasRef} className="w-full h-full block" />
      </div>
    );
  }
);

PartyAudioVisualizer.displayName = 'PartyAudioVisualizer';
