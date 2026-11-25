import { useCallback, useEffect, useRef } from 'react';
import { agoraPartyEngine } from '../services/agoraPartyEngine';

export interface PartyAudioSpectrumFrame {
  /** Overall normalized RMS/mean energy (0..1) */
  energy: number;
  /** Low vocal / bass band energy (0..1) */
  bass: number;
  /** Mid vocal formant energy (0..1) */
  mid: number;
  /** Upper vocal air / treble energy (0..1) */
  treble: number;
  /** True when live Web Audio AnalyserNode or native Agora voice input is driving the spectrum */
  hasLiveSignal: boolean;
  /** Number of currently active speaking participants */
  activeSpeakers: number;
}

interface UsePartyAudioAnalyserOptions {
  roomId: string | null | undefined;
  isSpeakerOn: boolean;
  remoteStreams?: Array<{ peerId: string; stream: MediaStream }>;
  fftSize?: 64 | 128 | 256;
}

interface ConnectedTrackSource {
  track: MediaStreamTrack;
  source: MediaStreamAudioSourceNode;
  onEnded: () => void;
}

/**
 * Real-time Web Audio API `AnalyserNode` hook for Party Rooms.
 *
 * - Taps every active local & remote Agora WebRTC `MediaStreamTrack` read-only into
 *   a summing `GainNode` -> `AnalyserNode` (NEVER connected to `ctx.destination`, so
 *   there is zero echo, zero feedback, and zero disruption to Agora Party Voice).
 * - Exposes a zero-allocation `sampleSpectrum(outBars)` reader intended for 60fps
 *   `requestAnimationFrame` canvas rendering with zero React state re-renders.
 * - On Native Android Capacitor (where Agora audio runs natively outside WebRTC
 *   browser tracks), gracefully blends real native Agora speaker volume telemetry
 *   when `AnalyserNode` bins are zero.
 */
export function usePartyAudioAnalyser({
  roomId,
  isSpeakerOn,
  remoteStreams = [],
  fftSize = 128,
}: UsePartyAudioAnalyserOptions) {
  const ctxRef = useRef<AudioContext | null>(null);
  const mixerGainRef = useRef<GainNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const freqBufferRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const connectedSourcesRef = useRef<Map<string, ConnectedTrackSource>>(new Map());
  const smoothedBarsRef = useRef<Float32Array | null>(null);

  const roomIdRef = useRef<string | null | undefined>(roomId);
  roomIdRef.current = roomId;
  const isSpeakerOnRef = useRef<boolean>(isSpeakerOn);
  isSpeakerOnRef.current = isSpeakerOn;
  const remoteStreamsRef = useRef(remoteStreams);
  remoteStreamsRef.current = remoteStreams;

  const ensureAnalyserGraph = useCallback((): AnalyserNode | null => {
    if (typeof window === 'undefined') return null;
    try {
      if (!ctxRef.current) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioCtx) return null;
        ctxRef.current = new AudioCtx();
      }
      const ctx = ctxRef.current;
      if (!mixerGainRef.current || !analyserRef.current) {
        const mixer = ctx.createGain();
        mixer.gain.setValueAtTime(1.0, ctx.currentTime);

        const analyser = ctx.createAnalyser();
        analyser.fftSize = fftSize;
        analyser.minDecibels = -86;
        analyser.maxDecibels = -16;
        analyser.smoothingTimeConstant = 0.76;

        // Strictly dead-ended at AnalyserNode (NEVER connected to ctx.destination -> zero echo!)
        mixer.connect(analyser);

        mixerGainRef.current = mixer;
        analyserRef.current = analyser;
        freqBufferRef.current = new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount));
      }
      return analyserRef.current;
    } catch {
      return null;
    }
  }, [fftSize]);

  const disconnectAllSources = useCallback(() => {
    connectedSourcesRef.current.forEach((entry) => {
      try {
        entry.track.removeEventListener('ended', entry.onEnded);
        entry.source.disconnect();
      } catch {
        // ignore
      }
    });
    connectedSourcesRef.current.clear();
  }, []);

  const syncActiveStreamTracks = useCallback(() => {
    const activeRoomId = roomIdRef.current;
    if (!activeRoomId) {
      disconnectAllSources();
      return;
    }

    const desiredTracks = new Map<string, MediaStreamTrack>();

    // 1. Live local & remote Agora WebRTC audio tracks
    const agoraTracks = agoraPartyEngine.getVisualizerAudioTracks(activeRoomId);
    for (const item of agoraTracks) {
      if (item.track && item.track.readyState === 'live') {
        desiredTracks.set(item.id, item.track);
      }
    }

    // 2. Any auxiliary MediaStreams passed into PartyRoomsScreen
    if (isSpeakerOnRef.current && remoteStreamsRef.current.length > 0) {
      for (const rs of remoteStreamsRef.current) {
        if (!rs?.stream) continue;
        for (const t of rs.stream.getAudioTracks()) {
          if (t && t.readyState === 'live') {
            desiredTracks.set(`stream:${rs.peerId}:${t.id}`, t);
          }
        }
      }
    }

    // Remove stale/ended sources first
    connectedSourcesRef.current.forEach((entry, key) => {
      const nextTrack = desiredTracks.get(key);
      if (!nextTrack || nextTrack !== entry.track || entry.track.readyState !== 'live') {
        try {
          entry.track.removeEventListener('ended', entry.onEnded);
          entry.source.disconnect();
        } catch {
          // ignore
        }
        connectedSourcesRef.current.delete(key);
      }
    });

    if (desiredTracks.size === 0) return;

    const analyser = ensureAnalyserGraph();
    const ctx = ctxRef.current;
    const mixer = mixerGainRef.current;
    if (!analyser || !ctx || !mixer) return;

    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    desiredTracks.forEach((track, key) => {
      if (connectedSourcesRef.current.has(key)) return;
      try {
        const singleTrackStream = new MediaStream([track]);
        const source = ctx.createMediaStreamSource(singleTrackStream);
        source.connect(mixer);

        const onEnded = () => {
          const current = connectedSourcesRef.current.get(key);
          if (current) {
            try {
              current.source.disconnect();
            } catch {
              // ignore
            }
            connectedSourcesRef.current.delete(key);
          }
        };
        track.addEventListener('ended', onEnded, { once: true });
        connectedSourcesRef.current.set(key, { track, source, onEnded });
      } catch {
        // Ignore tracks that cannot be tapped in restricted browsers
      }
    });
  }, [disconnectAllSources, ensureAnalyserGraph]);

  // Attach track subscriptions & passive user-gesture AudioContext unlock while inside a Party Room
  useEffect(() => {
    if (!roomId) {
      disconnectAllSources();
      return;
    }

    ensureAnalyserGraph();
    syncActiveStreamTracks();

    const unsubscribeTracks = agoraPartyEngine.subscribeAudioTracks(() => {
      syncActiveStreamTracks();
    });

    const handleResumeGesture = () => {
      const ctx = ctxRef.current;
      if (ctx && ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
      syncActiveStreamTracks();
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        handleResumeGesture();
      }
    };

    window.addEventListener('pointerdown', handleResumeGesture, { capture: true, passive: true });
    window.addEventListener('touchstart', handleResumeGesture, { capture: true, passive: true });
    window.addEventListener('click', handleResumeGesture, { capture: true, passive: true });
    document.addEventListener('visibilitychange', handleVisibility);

    // Light safety reconciliation every 2.5s in case a MediaStreamTrack transitions silently
    const syncTimer = window.setInterval(syncActiveStreamTracks, 2500);

    return () => {
      unsubscribeTracks();
      window.clearInterval(syncTimer);
      window.removeEventListener('pointerdown', handleResumeGesture, { capture: true });
      window.removeEventListener('touchstart', handleResumeGesture, { capture: true });
      window.removeEventListener('click', handleResumeGesture, { capture: true });
      document.removeEventListener('visibilitychange', handleVisibility);
      disconnectAllSources();
    };
  }, [roomId, ensureAnalyserGraph, syncActiveStreamTracks, disconnectAllSources]);

  // Re-sync whenever speaker mute or remote streams array changes
  useEffect(() => {
    if (!roomId) return;
    syncActiveStreamTracks();
  }, [roomId, isSpeakerOn, remoteStreams, syncActiveStreamTracks]);

  // Full AudioContext teardown on unmount
  useEffect(() => {
    return () => {
      disconnectAllSources();
      try {
        mixerGainRef.current?.disconnect();
        analyserRef.current?.disconnect();
      } catch {
        // ignore
      }
      if (ctxRef.current && ctxRef.current.state !== 'closed') {
        ctxRef.current.close().catch(() => {});
      }
      ctxRef.current = null;
      mixerGainRef.current = null;
      analyserRef.current = null;
      freqBufferRef.current = null;
    };
  }, [disconnectAllSources]);

  /**
   * Zero-allocation frequency sampler for 60fps canvas rendering.
   * Fills `outBars` (0..1 per visual band) with logarithmic perceptual FFT frequency energy.
   */
  const sampleSpectrum = useCallback(
    (
      outBars: Float32Array,
      nowMs: number,
      opts?: { isMusicPlaying?: boolean }
    ): PartyAudioSpectrumFrame => {
      const barCount = outBars.length;
      if (!smoothedBarsRef.current || smoothedBarsRef.current.length !== barCount) {
        smoothedBarsRef.current = new Float32Array(barCount);
      }
      const smoothed = smoothedBarsRef.current;

      const analyser = analyserRef.current;
      const freqBuf = freqBufferRef.current;
      const ctx = ctxRef.current;
      const activeRoomId = roomIdRef.current;

      let fftHasEnergy = false;
      let rawSum = 0;

      if (
        analyser &&
        freqBuf &&
        ctx &&
        ctx.state === 'running' &&
        connectedSourcesRef.current.size > 0
      ) {
        analyser.getByteFrequencyData(freqBuf);
        const usableBins = Math.max(8, Math.floor(freqBuf.length * 0.78));

        for (let i = 0; i < barCount; i++) {
          // Perceptual logarithmic bin mapping (gives vocal fundamentals & formants rich resolution)
          const t0 = i / barCount;
          const t1 = (i + 1) / barCount;
          const startBin = Math.min(usableBins - 1, Math.floor(Math.pow(t0, 1.38) * usableBins));
          const endBin = Math.max(
            startBin + 1,
            Math.min(usableBins, Math.ceil(Math.pow(t1, 1.38) * usableBins))
          );

          let peakBin = 0;
          let avgBin = 0;
          for (let b = startBin; b < endBin; b++) {
            const val = freqBuf[b];
            avgBin += val;
            if (val > peakBin) peakBin = val;
          }
          avgBin /= Math.max(1, endBin - startBin);

          // Blend peak + average for crisp punchy transients without losing vocal body
          const normalized = Math.min(1, ((peakBin * 0.62 + avgBin * 0.38) / 255) * 1.18);
          if (normalized > 0.025) fftHasEnergy = true;
          rawSum += normalized;

          // Asymmetric smoothing: snappy rise (0.58), silky gravity fall (0.20)
          const prev = smoothed[i];
          const alpha = normalized > prev ? 0.58 : 0.2;
          smoothed[i] = prev + (normalized - prev) * alpha;
          outBars[i] = smoothed[i];
        }
      }

      const snapshot = activeRoomId
        ? agoraPartyEngine.getAudioEnergySnapshot(activeRoomId)
        : { peakVolume: 0, activeSpeakers: 0, speakerLevels: [] };

      if (!fftHasEnergy) {
        const tSec = nowMs * 0.001;
        const nativeEnergy = snapshot.peakVolume;
        const hasNativeVoice = nativeEnergy > 0.02;
        const ambientMusicFloor =
          opts?.isMusicPlaying && isSpeakerOnRef.current ? 0.09 : 0.035;

        for (let i = 0; i < barCount; i++) {
          const normIdx = i / Math.max(1, barCount - 1);
          let target = ambientMusicFloor;

          if (hasNativeVoice) {
            // Shape real native Agora voice volume across natural vocal formant bands
            const formantBell =
              Math.exp(-Math.pow((normIdx - 0.22) / 0.28, 2)) * 0.92 +
              Math.exp(-Math.pow((normIdx - 0.58) / 0.22, 2)) * 0.56;
            const harmonicWave =
              0.68 +
              0.22 * Math.sin(tSec * (7.2 + (i % 5) * 1.4) + i * 0.85) +
              0.1 * Math.cos(tSec * 11.5 - i * 1.3);
            const speakerBoost =
              snapshot.speakerLevels[i % Math.max(1, snapshot.speakerLevels.length)] ??
              nativeEnergy;
            target = Math.min(1, Math.max(ambientMusicFloor, speakerBoost * formantBell * harmonicWave * 1.25));
          } else {
            // Whisper-quiet idle breathing curve so the stage feels alive without fake spikes
            const wave =
              0.55 + 0.45 * Math.sin(tSec * 1.85 + normIdx * Math.PI * 2.2);
            target = ambientMusicFloor * (0.45 + 0.55 * wave) * (1 - normIdx * 0.35);
          }

          const prev = smoothed[i];
          const alpha = target > prev ? 0.42 : 0.16;
          smoothed[i] = prev + (target - prev) * alpha;
          outBars[i] = smoothed[i];
          rawSum += outBars[i];
        }
      }

      // Partition into bass / mid / treble metrics for synchronized seat-theme animations
      const bassEnd = Math.max(1, Math.floor(barCount * 0.28));
      const midEnd = Math.max(bassEnd + 1, Math.floor(barCount * 0.68));
      let bassAcc = 0;
      let midAcc = 0;
      let trebleAcc = 0;
      for (let i = 0; i < barCount; i++) {
        const v = outBars[i];
        if (i < bassEnd) bassAcc += v;
        else if (i < midEnd) midAcc += v;
        else trebleAcc += v;
      }

      const bass = bassAcc / bassEnd;
      const mid = midAcc / Math.max(1, midEnd - bassEnd);
      const treble = trebleAcc / Math.max(1, barCount - midEnd);
      const energy = Math.min(1, (bass * 0.42 + mid * 0.43 + treble * 0.15) * 1.15);

      return {
        energy,
        bass,
        mid,
        treble,
        hasLiveSignal: fftHasEnergy || snapshot.peakVolume > 0.02,
        activeSpeakers: Math.max(
          snapshot.activeSpeakers,
          fftHasEnergy ? 1 : 0
        ),
      };
    },
    []
  );

  return { sampleSpectrum };
}
