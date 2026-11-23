/**
 * Real-time Web Audio API Voice Modulation Engine for Alpha Mate Audio Party Rooms.
 * Transforms live microphone MediaStreams in real time (Robot, Chipmunk, Deep Echo, Concert Echo,
 * Deep Bass, Studio Crisp) and outputs a processed MediaStream compatible with WebRTC & Agora Web.
 */

export type VoiceFilterPresetId =
  | 'normal'
  | 'robot'
  | 'chipmunk'
  | 'deep_echo'
  | 'echo'
  | 'deep'
  | 'studio';

export interface VoiceFilterPresetMeta {
  id: VoiceFilterPresetId;
  label: string;
  shortLabel: string;
  emoji: string;
  description: string;
  accentGradient: string;
  tag?: string;
}

export const VOICE_FILTER_PRESETS: VoiceFilterPresetMeta[] = [
  {
    id: 'normal',
    label: 'Original Voice',
    shortLabel: 'Normal',
    emoji: '🎙️',
    description: 'Natural clear microphone audio',
    accentGradient: 'from-zinc-600 to-zinc-700',
  },
  {
    id: 'robot',
    label: 'Robot',
    shortLabel: 'Robot',
    emoji: '🤖',
    description: 'Metallic ring-modulated sci-fi vocoder',
    accentGradient: 'from-cyan-500 to-blue-600',
    tag: 'Popular',
  },
  {
    id: 'chipmunk',
    label: 'Chipmunk',
    shortLabel: 'Chipmunk',
    emoji: '🐿️',
    description: 'Playful high-pitch (+8 semitones) shift',
    accentGradient: 'from-amber-400 to-pink-500',
    tag: 'Fun',
  },
  {
    id: 'deep_echo',
    label: 'Deep Echo',
    shortLabel: 'Deep Echo',
    emoji: '🌌',
    description: 'Deep bass pitch with dramatic hall echo',
    accentGradient: 'from-violet-600 to-fuchsia-700',
    tag: 'New',
  },
  {
    id: 'echo',
    label: 'Concert Echo',
    shortLabel: 'Echo',
    emoji: '🏔️',
    description: 'Lush arena reflection & vocal delay',
    accentGradient: 'from-purple-500 to-indigo-600',
  },
  {
    id: 'deep',
    label: 'Deep Titan',
    shortLabel: 'Deep',
    emoji: '🗿',
    description: 'Rich low-pitch (-5 semitones) bass voice',
    accentGradient: 'from-rose-600 to-purple-800',
  },
  {
    id: 'studio',
    label: 'Studio Crisp',
    shortLabel: 'Studio',
    emoji: '🎧',
    description: 'Broadcast EQ presence & vocal warmth',
    accentGradient: 'from-emerald-500 to-teal-600',
  },
];

const DEFAULT_SAMPLE_RATE = 48000;

export class AudioFilter {
  private ctx: AudioContext | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private destinationNode: MediaStreamAudioDestinationNode | null = null;
  private masterGainNode: GainNode | null = null;
  private monitorGainNode: GainNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  private analyserData: Uint8Array<ArrayBuffer> | null = null;

  private processedStream: MediaStream | null = null;
  private activeInputStream: MediaStream | null = null;
  private previewOwnedStream: MediaStream | null = null;

  private cleanupNodes: Array<() => void> = [];
  private activePreset: VoiceFilterPresetId = 'normal';
  private isMuted: boolean = false;
  private localMonitorEnabled: boolean = false;
  private listeners = new Set<(preset: VoiceFilterPresetId) => void>();

  public getPreset(): VoiceFilterPresetId {
    return this.activePreset;
  }

  public getPresetMeta(id: VoiceFilterPresetId = this.activePreset): VoiceFilterPresetMeta {
    return VOICE_FILTER_PRESETS.find((p) => p.id === id) || VOICE_FILTER_PRESETS[0];
  }

  public subscribe(listener: (preset: VoiceFilterPresetId) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach((cb) => {
      try {
        cb(this.activePreset);
      } catch {
        // ignore subscriber errors
      }
    });
  }

  public setPreset(preset: VoiceFilterPresetId): VoiceFilterPresetId {
    const normalized = VOICE_FILTER_PRESETS.some((p) => p.id === preset)
      ? preset
      : 'normal';
    if (this.activePreset === normalized) return this.activePreset;
    this.activePreset = normalized;
    this.notifyListeners();
    return this.activePreset;
  }

  public setMuted(muted: boolean): void {
    this.isMuted = Boolean(muted);
    if (this.processedStream) {
      this.processedStream.getAudioTracks().forEach((track) => {
        track.enabled = !this.isMuted;
      });
    }
  }

  public isLocalMonitorActive(): boolean {
    return this.localMonitorEnabled;
  }

  /**
   * Returns a normalized 0..1 live microphone/processed audio level for UI metering.
   */
  public getLiveAudioLevel(): number {
    if (!this.analyserNode || !this.analyserData) return 0;
    try {
      this.analyserNode.getByteTimeDomainData(this.analyserData);
      let sumSquares = 0;
      for (let i = 0; i < this.analyserData.length; i++) {
        const normalized = (this.analyserData[i] - 128) / 128;
        sumSquares += normalized * normalized;
      }
      const rms = Math.sqrt(sumSquares / this.analyserData.length);
      return Math.min(1, rms * 3.4);
    } catch {
      return 0;
    }
  }

  /**
   * Enables or disables local headphone/speaker preview monitoring so the user can hear
   * their own modulated voice in real time. Automatically opens a temporary mic stream
   * if no live broadcast input stream is attached yet.
   */
  public async setLocalMonitor(enabled: boolean): Promise<boolean> {
    this.localMonitorEnabled = Boolean(enabled);

    if (!this.localMonitorEnabled) {
      if (this.monitorGainNode && this.ctx) {
        this.monitorGainNode.gain.setTargetAtTime(0, this.ctx.currentTime, 0.02);
      }
      if (this.previewOwnedStream) {
        const owned = this.previewOwnedStream;
        this.previewOwnedStream = null;
        if (this.activeInputStream === owned) {
          this.teardownGraph(true);
          this.activeInputStream = null;
        }
        owned.getTracks().forEach((t) => {
          try {
            t.stop();
          } catch {
            // ignore
          }
        });
      }
      return false;
    }

    // If a live stream is already attached and processed, unmute monitor bus
    if (this.monitorGainNode && this.ctx) {
      if (this.ctx.state === 'suspended') {
        await this.ctx.resume().catch(() => {});
      }
      this.monitorGainNode.gain.setTargetAtTime(0.82, this.ctx.currentTime, 0.03);
      return true;
    }

    // If a raw input stream exists (e.g. preset === 'normal' or live mic), build graph with monitor
    if (this.activeInputStream) {
      await this.attachInputStream(this.activeInputStream, {
        preset: this.activePreset,
        isMuted: false,
        forceGraph: true,
      });
      return true;
    }

    // Otherwise acquire a temporary microphone stream strictly for live local voice preview
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      this.localMonitorEnabled = false;
      throw new Error('Microphone preview is not supported on this device.');
    }

    const previewStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
    this.previewOwnedStream = previewStream;
    await this.attachInputStream(previewStream, {
      preset: this.activePreset,
      isMuted: false,
      forceGraph: true,
    });
    return true;
  }

  private async ensureContext(): Promise<AudioContext | null> {
    if (typeof window === 'undefined') return null;
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return null;

    if (!this.ctx || this.ctx.state === 'closed') {
      this.ctx = new AudioCtx({
        latencyHint: 'interactive',
        sampleRate: DEFAULT_SAMPLE_RATE,
      });
    }
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private teardownGraph(stopOutputTracks: boolean): void {
    this.cleanupNodes.forEach((fn) => {
      try {
        fn();
      } catch {
        // ignore node teardown error
      }
    });
    this.cleanupNodes = [];

    if (this.sourceNode) {
      try {
        this.sourceNode.disconnect();
      } catch {
        // ignore
      }
      this.sourceNode = null;
    }

    if (this.destinationNode) {
      try {
        this.destinationNode.disconnect();
      } catch {
        // ignore
      }
      this.destinationNode = null;
    }

    if (this.masterGainNode) {
      try {
        this.masterGainNode.disconnect();
      } catch {
        // ignore
      }
      this.masterGainNode = null;
    }

    if (this.monitorGainNode) {
      try {
        this.monitorGainNode.disconnect();
      } catch {
        // ignore
      }
      this.monitorGainNode = null;
    }

    if (this.analyserNode) {
      try {
        this.analyserNode.disconnect();
      } catch {
        // ignore
      }
      this.analyserNode = null;
      this.analyserData = null;
    }

    if (stopOutputTracks && this.processedStream) {
      this.processedStream.getTracks().forEach((t) => {
        try {
          t.stop();
        } catch {
          // ignore
        }
      });
      this.processedStream = null;
    }
  }

  /**
   * Connects a raw microphone MediaStream through the currently selected Web Audio modulation graph.
   * When preset is 'normal' and local monitoring is off, returns the raw MediaStream with zero extra latency.
   */
  public async attachInputStream(
    rawMicStream: MediaStream,
    options?: { preset?: VoiceFilterPresetId; isMuted?: boolean; forceGraph?: boolean }
  ): Promise<MediaStream> {
    if (options?.preset) {
      this.setPreset(options.preset);
    }
    if (typeof options?.isMuted === 'boolean') {
      this.isMuted = options.isMuted;
    }

    // If attaching an external live stream while a standalone preview mic was open, release preview mic
    if (this.previewOwnedStream && rawMicStream !== this.previewOwnedStream) {
      this.previewOwnedStream.getTracks().forEach((t) => {
        try {
          t.stop();
        } catch {
          // ignore
        }
      });
      this.previewOwnedStream = null;
    }

    this.activeInputStream = rawMicStream;

    if (this.activePreset === 'normal' && !options?.forceGraph && !this.localMonitorEnabled) {
      this.teardownGraph(true);
      rawMicStream.getAudioTracks().forEach((t) => {
        t.enabled = !this.isMuted;
      });
      return rawMicStream;
    }

    const ctx = await this.ensureContext();
    if (!ctx) {
      return rawMicStream;
    }

    rawMicStream.getAudioTracks().forEach((t) => {
      t.enabled = !this.isMuted;
    });

    this.teardownGraph(true);

    try {
      const source = ctx.createMediaStreamSource(rawMicStream);
      const destination = ctx.createMediaStreamDestination();

      const masterCompressor = ctx.createDynamicsCompressor();
      masterCompressor.threshold.setValueAtTime(-16, ctx.currentTime);
      masterCompressor.knee.setValueAtTime(16, ctx.currentTime);
      masterCompressor.ratio.setValueAtTime(5, ctx.currentTime);
      masterCompressor.attack.setValueAtTime(0.004, ctx.currentTime);
      masterCompressor.release.setValueAtTime(0.16, ctx.currentTime);

      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(1.0, ctx.currentTime);

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.72;

      const monitorGain = ctx.createGain();
      monitorGain.gain.setValueAtTime(this.localMonitorEnabled ? 0.82 : 0, ctx.currentTime);

      masterCompressor.connect(masterGain);
      masterGain.connect(analyser);
      masterGain.connect(destination);
      masterGain.connect(monitorGain);
      monitorGain.connect(ctx.destination);

      this.cleanupNodes.push(() => {
        masterCompressor.disconnect();
        masterGain.disconnect();
        analyser.disconnect();
        monitorGain.disconnect();
      });

      switch (this.activePreset) {
        case 'robot':
          this.buildRobotChain(ctx, source, masterCompressor);
          break;
        case 'chipmunk':
          this.buildPitchShiftChain(ctx, source, masterCompressor, 1.56, {
            formantHz: 2400,
            formantGainDb: 5,
            highpassHz: 180,
          });
          break;
        case 'deep_echo':
          this.buildDeepEchoChain(ctx, source, masterCompressor);
          break;
        case 'deep':
          this.buildPitchShiftChain(ctx, source, masterCompressor, 0.74, {
            formantHz: 165,
            formantGainDb: 6,
            highpassHz: 60,
            lowpassHz: 4200,
          });
          break;
        case 'echo':
          this.buildEchoChain(ctx, source, masterCompressor);
          break;
        case 'studio':
          this.buildStudioChain(ctx, source, masterCompressor);
          break;
        default:
          source.connect(masterCompressor);
          break;
      }

      this.sourceNode = source;
      this.destinationNode = destination;
      this.masterGainNode = masterGain;
      this.monitorGainNode = monitorGain;
      this.analyserNode = analyser;
      this.analyserData = new Uint8Array(analyser.fftSize);
      this.processedStream = destination.stream;
      this.processedStream.getAudioTracks().forEach((track) => {
        track.enabled = !this.isMuted;
      });

      return this.processedStream;
    } catch (err) {
      console.warn('[AudioFilter] Failed to initialize Web Audio filter graph; falling back to raw mic:', err);
      this.teardownGraph(true);
      return rawMicStream;
    }
  }

  public async updateStreamPreset(
    preset: VoiceFilterPresetId,
    rawMicStream?: MediaStream | null,
    options?: { isMuted?: boolean }
  ): Promise<MediaStream | null> {
    this.setPreset(preset);
    const input = rawMicStream || this.activeInputStream;
    if (!input) return null;
    return this.attachInputStream(input, {
      preset,
      isMuted: options?.isMuted,
      forceGraph: this.localMonitorEnabled,
    });
  }

  /**
   * Deep Echo Voice:
   * Chains the real-time deep pitch-down shifter (0.76x, rich bass warmth) into a spacious
   * damped cavern echo network (125ms early reflection + 275ms feedback echo).
   */
  private buildDeepEchoChain(
    ctx: AudioContext,
    input: AudioNode,
    output: AudioNode
  ): void {
    const pitchBus = ctx.createGain();
    pitchBus.gain.setValueAtTime(1.05, ctx.currentTime);

    this.buildPitchShiftChain(ctx, input, pitchBus, 0.76, {
      formantHz: 170,
      formantGainDb: 5.5,
      highpassHz: 65,
      lowpassHz: 3800,
    });

    this.buildEchoChain(ctx, pitchBus, output, {
      earlyDelaySec: 0.125,
      earlyGainValue: 0.34,
      echoDelaySec: 0.275,
      feedbackValue: 0.46,
      wetGainValue: 0.58,
      dampingHz: 2100,
    });

    this.cleanupNodes.push(() => {
      pitchBus.disconnect();
    });
  }

  /**
   * Robot Voice:
   * High-pass cleanup + resonant bandpass + metallic ring modulation (52Hz sine carrier)
   * + tight 14ms comb delay for futuristic vocoder sheen.
   */
  private buildRobotChain(
    ctx: AudioContext,
    input: AudioNode,
    output: AudioNode
  ): void {
    const now = ctx.currentTime;

    const highpass = ctx.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.setValueAtTime(140, now);

    const bandpass = ctx.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.setValueAtTime(1050, now);
    bandpass.Q.setValueAtTime(1.4, now);

    const ringModGain = ctx.createGain();
    ringModGain.gain.setValueAtTime(0.55, now);

    const carrierOsc = ctx.createOscillator();
    carrierOsc.type = 'sine';
    carrierOsc.frequency.setValueAtTime(52, now);

    const carrierDepth = ctx.createGain();
    carrierDepth.gain.setValueAtTime(0.45, now);

    carrierOsc.connect(carrierDepth);
    carrierDepth.connect(ringModGain.gain);
    carrierOsc.start(now);

    const combDelay = ctx.createDelay(0.1);
    combDelay.delayTime.setValueAtTime(0.014, now);
    const combFeedback = ctx.createGain();
    combFeedback.gain.setValueAtTime(0.32, now);

    const wetMix = ctx.createGain();
    wetMix.gain.setValueAtTime(0.45, now);
    const dryMix = ctx.createGain();
    dryMix.gain.setValueAtTime(0.95, now);

    input.connect(highpass);
    highpass.connect(bandpass);
    bandpass.connect(ringModGain);

    ringModGain.connect(dryMix);
    dryMix.connect(output);

    ringModGain.connect(combDelay);
    combDelay.connect(combFeedback);
    combFeedback.connect(combDelay);
    combDelay.connect(wetMix);
    wetMix.connect(output);

    this.cleanupNodes.push(() => {
      try {
        carrierOsc.stop();
      } catch {
        // ignore
      }
      carrierOsc.disconnect();
      carrierDepth.disconnect();
      highpass.disconnect();
      bandpass.disconnect();
      ringModGain.disconnect();
      combDelay.disconnect();
      combFeedback.disconnect();
      wetMix.disconnect();
      dryMix.disconnect();
    });
  }

  /**
   * Real-time Dual-Tap Granular Doppler Pitch Shifter (audio-thread native):
   * Runs purely on AudioContext nodes using two 180°-offset DelayNodes modulated by sample-accurate
   * ramp & Hann-window control buffers so pitch shifts cleanly without AudioWorklet CSP or click artifacts.
   */
  private buildPitchShiftChain(
    ctx: AudioContext,
    input: AudioNode,
    output: AudioNode,
    pitchRatio: number,
    eq: {
      formantHz: number;
      formantGainDb: number;
      highpassHz: number;
      lowpassHz?: number;
    }
  ): void {
    const now = ctx.currentTime;
    const windowSec = 0.055;
    const shiftRateHz = Math.abs(1 - pitchRatio) / windowSec;
    const shiftUp = pitchRatio >= 1;

    const bufferSamples = 2048;
    const sampleRate = ctx.sampleRate;

    const createCycleBuffer = (offset: number, isGainWindow: boolean): AudioBuffer => {
      const buf = ctx.createBuffer(1, bufferSamples, sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < bufferSamples; i++) {
        const phase = (i / bufferSamples + offset) % 1;
        if (isGainWindow) {
          data[i] = Math.sin(Math.PI * phase);
        } else {
          data[i] = (shiftUp ? 1 - phase : phase) * windowSec;
        }
      }
      return buf;
    };

    const playbackRate = (shiftRateHz * bufferSamples) / sampleRate;

    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.setValueAtTime(eq.highpassHz, now);

    const formantPeak = ctx.createBiquadFilter();
    formantPeak.type = 'peaking';
    formantPeak.frequency.setValueAtTime(eq.formantHz, now);
    formantPeak.Q.setValueAtTime(1.1, now);
    formantPeak.gain.setValueAtTime(eq.formantGainDb, now);

    const sumGain = ctx.createGain();
    sumGain.gain.setValueAtTime(0.9, now);

    let outNode: AudioNode = formantPeak;
    let lp: BiquadFilterNode | null = null;
    if (eq.lowpassHz) {
      lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(eq.lowpassHz, now);
      formantPeak.connect(lp);
      outNode = lp;
    }
    outNode.connect(output);

    input.connect(hp);
    sumGain.connect(formantPeak);

    const tapSources: AudioBufferSourceNode[] = [];
    const tapDelays: DelayNode[] = [];
    const tapGains: GainNode[] = [];

    [0, 0.5].forEach((phaseOffset) => {
      const delayNode = ctx.createDelay(0.2);
      delayNode.delayTime.setValueAtTime(0, now);

      const tapGain = ctx.createGain();
      tapGain.gain.setValueAtTime(0, now);

      const delayCtrlSrc = ctx.createBufferSource();
      delayCtrlSrc.buffer = createCycleBuffer(phaseOffset, false);
      delayCtrlSrc.loop = true;
      delayCtrlSrc.playbackRate.setValueAtTime(playbackRate, now);

      const gainCtrlSrc = ctx.createBufferSource();
      gainCtrlSrc.buffer = createCycleBuffer(phaseOffset, true);
      gainCtrlSrc.loop = true;
      gainCtrlSrc.playbackRate.setValueAtTime(playbackRate, now);

      delayCtrlSrc.connect(delayNode.delayTime);
      gainCtrlSrc.connect(tapGain.gain);

      hp.connect(delayNode);
      delayNode.connect(tapGain);
      tapGain.connect(sumGain);

      delayCtrlSrc.start(now);
      gainCtrlSrc.start(now);

      tapSources.push(delayCtrlSrc, gainCtrlSrc);
      tapDelays.push(delayNode);
      tapGains.push(tapGain);
    });

    this.cleanupNodes.push(() => {
      tapSources.forEach((src) => {
        try {
          src.stop();
        } catch {
          // ignore
        }
        src.disconnect();
      });
      tapDelays.forEach((d) => d.disconnect());
      tapGains.forEach((g) => g.disconnect());
      hp.disconnect();
      sumGain.disconnect();
      formantPeak.disconnect();
      if (lp) lp.disconnect();
    });
  }

  /**
   * Echo / Hall Reflection Network:
   * Crisp dry voice mixed with early reflection and damped hall feedback delay.
   */
  private buildEchoChain(
    ctx: AudioContext,
    input: AudioNode,
    output: AudioNode,
    params?: {
      earlyDelaySec?: number;
      earlyGainValue?: number;
      echoDelaySec?: number;
      feedbackValue?: number;
      wetGainValue?: number;
      dampingHz?: number;
    }
  ): void {
    const now = ctx.currentTime;

    const highpass = ctx.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.setValueAtTime(95, now);

    const dryGain = ctx.createGain();
    dryGain.gain.setValueAtTime(0.95, now);

    const earlyDelay = ctx.createDelay(0.5);
    earlyDelay.delayTime.setValueAtTime(params?.earlyDelaySec ?? 0.115, now);
    const earlyGain = ctx.createGain();
    earlyGain.gain.setValueAtTime(params?.earlyGainValue ?? 0.28, now);

    const echoDelay = ctx.createDelay(1.0);
    echoDelay.delayTime.setValueAtTime(params?.echoDelaySec ?? 0.24, now);

    const feedbackDamping = ctx.createBiquadFilter();
    feedbackDamping.type = 'lowpass';
    feedbackDamping.frequency.setValueAtTime(params?.dampingHz ?? 2400, now);

    const feedbackGain = ctx.createGain();
    feedbackGain.gain.setValueAtTime(params?.feedbackValue ?? 0.42, now);

    const wetGain = ctx.createGain();
    wetGain.gain.setValueAtTime(params?.wetGainValue ?? 0.5, now);

    input.connect(highpass);

    highpass.connect(dryGain);
    dryGain.connect(output);

    highpass.connect(earlyDelay);
    earlyDelay.connect(earlyGain);
    earlyGain.connect(output);

    highpass.connect(echoDelay);
    echoDelay.connect(feedbackDamping);
    feedbackDamping.connect(feedbackGain);
    feedbackGain.connect(echoDelay);
    feedbackDamping.connect(wetGain);
    wetGain.connect(output);

    this.cleanupNodes.push(() => {
      highpass.disconnect();
      dryGain.disconnect();
      earlyDelay.disconnect();
      earlyGain.disconnect();
      echoDelay.disconnect();
      feedbackDamping.disconnect();
      feedbackGain.disconnect();
      wetGain.disconnect();
    });
  }

  /**
   * Studio Crisp:
   * Rumble high-pass (90Hz), warm low-mid boost (220Hz), and vocal presence boost (3.2kHz).
   */
  private buildStudioChain(
    ctx: AudioContext,
    input: AudioNode,
    output: AudioNode
  ): void {
    const now = ctx.currentTime;

    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.setValueAtTime(90, now);

    const warmth = ctx.createBiquadFilter();
    warmth.type = 'peaking';
    warmth.frequency.setValueAtTime(220, now);
    warmth.Q.setValueAtTime(1.0, now);
    warmth.gain.setValueAtTime(3.0, now);

    const presence = ctx.createBiquadFilter();
    presence.type = 'peaking';
    presence.frequency.setValueAtTime(3200, now);
    presence.Q.setValueAtTime(1.2, now);
    presence.gain.setValueAtTime(4.0, now);

    input.connect(hp);
    hp.connect(warmth);
    warmth.connect(presence);
    presence.connect(output);

    this.cleanupNodes.push(() => {
      hp.disconnect();
      warmth.disconnect();
      presence.disconnect();
    });
  }

  public dispose(resetPreset: boolean = false): void {
    this.localMonitorEnabled = false;
    this.teardownGraph(true);
    if (this.previewOwnedStream) {
      this.previewOwnedStream.getTracks().forEach((t) => {
        try {
          t.stop();
        } catch {
          // ignore
        }
      });
      this.previewOwnedStream = null;
    }
    this.activeInputStream = null;
    if (resetPreset) {
      this.activePreset = 'normal';
      this.notifyListeners();
    }
    if (this.ctx && this.ctx.state !== 'closed') {
      try {
        void this.ctx.close();
      } catch {
        // ignore
      }
    }
    this.ctx = null;
  }
}

export const audioFilter = new AudioFilter();
