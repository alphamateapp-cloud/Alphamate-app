/**
 * Alpha Mate Live - Virtual Gift Synthesized Sound Effects
 * Native Web Audio API synthesizer for zero-latency, realistic celebration sounds
 * without needing external audio files.
 */

class GiftSoundEngine {
  private ctx: AudioContext | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private isMuted: boolean = false;

  constructor() {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('am_gift_sfx_muted');
      this.isMuted = saved === 'true';
    }
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (typeof window !== 'undefined') {
      localStorage.setItem('am_gift_sfx_muted', String(this.isMuted));
    }
    return this.isMuted;
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (typeof window !== 'undefined') {
      localStorage.setItem('am_gift_sfx_muted', String(this.isMuted));
    }
  }

  private getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    try {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          this.ctx = new AudioCtx();
        }
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      if (this.ctx && !this.compressor) {
        const comp = this.ctx.createDynamicsCompressor();
        comp.threshold.setValueAtTime(-16, this.ctx.currentTime);
        comp.knee.setValueAtTime(18, this.ctx.currentTime);
        comp.ratio.setValueAtTime(5, this.ctx.currentTime);
        comp.connect(this.ctx.destination);
        this.compressor = comp;
      }
      return this.ctx;
    } catch {
      return null;
    }
  }

  private getOutputNode(ctx: AudioContext): AudioNode {
    return this.compressor || ctx.destination;
  }

  private playFilteredNoise(
    ctx: AudioContext,
    opts: {
      startTime: number;
      duration: number;
      filterType: BiquadFilterType;
      startFreq: number;
      endFreq: number;
      peakGain: number;
    }
  ) {
    if (!this.noiseBuffer) {
      const length = Math.floor(ctx.sampleRate * 1.5);
      const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      this.noiseBuffer = buffer;
    }

    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = opts.filterType;
    filter.frequency.setValueAtTime(opts.startFreq, opts.startTime);
    filter.frequency.exponentialRampToValueAtTime(
      Math.max(40, opts.endFreq),
      opts.startTime + opts.duration
    );

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, opts.startTime);
    gain.gain.linearRampToValueAtTime(opts.peakGain, opts.startTime + Math.min(0.12, opts.duration * 0.25));
    gain.gain.exponentialRampToValueAtTime(0.001, opts.startTime + opts.duration);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.getOutputNode(ctx));

    src.start(opts.startTime);
    src.stop(opts.startTime + opts.duration + 0.05);
  }

  public play(animationType: string) {
    if (this.isMuted) return;
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;

      switch (animationType) {
        case 'heart':
          this.playHarpChime(ctx, [523.25, 659.25, 783.99, 1046.5]); // C5, E5, G5, C6
          break;
        case 'sparkle':
          this.playSparkleBells(ctx);
          break;
        case 'ring':
          this.playDiamondChime(ctx);
          break;
        case 'crown':
          this.playRoyalFanfare(ctx);
          break;
        case 'car':
          this.playSupercarRev(ctx);
          break;
        case 'yacht':
          this.playYachtCelebration(ctx);
          break;
        case 'rocket':
          this.playRocketLaunch(ctx);
          break;
        case 'dragon':
          this.playDragonRoar(ctx);
          break;
        default:
          this.playHarpChime(ctx, [440, 554.37, 659.25, 880]);
      }
    } catch {
      // Audio autoplay policy or browser restriction
    }
  }

  // Play Combo Pop Sound
  public playComboSound(multiplier: number) {
    if (this.isMuted) return;
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      const baseFreq = 400 + Math.min(multiplier * 50, 1200);
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(baseFreq, now);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.5, now + 0.12);

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.16);
    } catch {}
  }

  // Soft Harp Arpeggio (Lucky Rose)
  private playHarpChime(ctx: AudioContext, freqs: number[]) {
    const now = ctx.currentTime;
    freqs.forEach((freq, index) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const startTime = now + index * 0.08;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.18, startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.6);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + 0.65);
    });
  }

  // Sparkle Bells (Neon Heart)
  private playSparkleBells(ctx: AudioContext) {
    const now = ctx.currentTime;
    const freqs = [659.25, 880, 1046.5, 1318.51, 1567.98];
    freqs.forEach((f, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const startTime = now + i * 0.06;

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, startTime);

      gain.gain.setValueAtTime(0.15, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.45);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + 0.5);
    });
  }

  // Diamond Ring Prismatic Shimmer
  private playDiamondChime(ctx: AudioContext) {
    const now = ctx.currentTime;
    const notes = [739.99, 932.33, 1108.73, 1479.98]; // F# maj
    notes.forEach((f, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const startTime = now + i * 0.07;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, startTime);

      gain.gain.setValueAtTime(0.16, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.8);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + 0.85);
    });
  }

  // Royal Fanfare (Alpha Crown)
  private playRoyalFanfare(ctx: AudioContext) {
    const now = ctx.currentTime;
    // Fanfare: C4 -> G4 -> C5 -> E5 -> G5 chord
    const sequence = [
      { f: 261.63, t: 0, d: 0.15 },
      { f: 392.0, t: 0.15, d: 0.15 },
      { f: 523.25, t: 0.3, d: 0.2 },
      { f: 659.25, t: 0.45, d: 0.2 },
      { f: 783.99, t: 0.6, d: 0.7 },
      { f: 1046.5, t: 0.6, d: 0.7 },
    ];

    sequence.forEach((item) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const startTime = now + item.t;

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(item.f, startTime);

      gain.gain.setValueAtTime(0.12, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + item.d);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + item.d + 0.05);
    });
  }

  // Cyber Supercar Roar & Rev
  private playSupercarRev(ctx: AudioContext) {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    // Engine rev pitch glide: 90Hz -> 380Hz -> 180Hz
    osc.frequency.setValueAtTime(90, now);
    osc.frequency.exponentialRampToValueAtTime(420, now + 0.5);
    osc.frequency.exponentialRampToValueAtTime(220, now + 1.2);

    gain.gain.setValueAtTime(0.05, now);
    gain.gain.linearRampToValueAtTime(0.2, now + 0.4);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.3);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 1.35);

    // Turbo whistle
    const turboOsc = ctx.createOscillator();
    const turboGain = ctx.createGain();
    turboOsc.type = 'sine';
    turboOsc.frequency.setValueAtTime(1200, now + 0.2);
    turboOsc.frequency.exponentialRampToValueAtTime(3200, now + 0.6);

    turboGain.gain.setValueAtTime(0.06, now + 0.2);
    turboGain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);

    turboOsc.connect(turboGain);
    turboGain.connect(this.getOutputNode(ctx));

    turboOsc.start(now + 0.2);
    turboOsc.stop(now + 0.75);

    this.playFilteredNoise(ctx, {
      startTime: now,
      duration: 1.15,
      filterType: 'bandpass',
      startFreq: 260,
      endFreq: 950,
      peakGain: 0.14,
    });
  }

  // Royal Yacht Nautical Celebration & Fireworks
  private playYachtCelebration(ctx: AudioContext) {
    const now = ctx.currentTime;

    // Horn / Ship chime
    const hornNotes = [329.63, 440];
    hornNotes.forEach((f) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, now);

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.9);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.95);
    });

    // Fireworks pop
    [0.35, 0.7].forEach((delay) => {
      const popOsc = ctx.createOscillator();
      const popGain = ctx.createGain();
      popOsc.type = 'triangle';
      popOsc.frequency.setValueAtTime(600, now + delay);
      popOsc.frequency.exponentialRampToValueAtTime(100, now + delay + 0.2);

      popGain.gain.setValueAtTime(0.15, now + delay);
      popGain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.22);

      popOsc.connect(popGain);
      popGain.connect(ctx.destination);

      popOsc.start(now + delay);
      popOsc.stop(now + delay + 0.25);
    });
  }

  // Galaxy Rocket Launch
  private playRocketLaunch(ctx: AudioContext) {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    // Low rumble soaring up
    osc.frequency.setValueAtTime(80, now);
    osc.frequency.exponentialRampToValueAtTime(1100, now + 1.4);

    gain.gain.setValueAtTime(0.1, now);
    gain.gain.linearRampToValueAtTime(0.22, now + 0.6);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);

    osc.connect(gain);
    gain.connect(this.getOutputNode(ctx));

    osc.start(now);
    osc.stop(now + 1.55);

    this.playFilteredNoise(ctx, {
      startTime: now,
      duration: 1.35,
      filterType: 'lowpass',
      startFreq: 240,
      endFreq: 1600,
      peakGain: 0.16,
    });
  }

  // Mythic Dragon Roar & Flame Surge
  private playDragonRoar(ctx: AudioContext) {
    const now = ctx.currentTime;

    // Sub rumble
    const subOsc = ctx.createOscillator();
    const subGain = ctx.createGain();
    subOsc.type = 'sawtooth';
    subOsc.frequency.setValueAtTime(150, now);
    subOsc.frequency.exponentialRampToValueAtTime(50, now + 1.2);

    subGain.gain.setValueAtTime(0.18, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 1.3);

    subOsc.connect(subGain);
    subGain.connect(this.getOutputNode(ctx));

    subOsc.start(now);
    subOsc.stop(now + 1.35);

    this.playFilteredNoise(ctx, {
      startTime: now + 0.08,
      duration: 1.2,
      filterType: 'bandpass',
      startFreq: 700,
      endFreq: 220,
      peakGain: 0.16,
    });

    // Fire sizzle arpeggio
    const sizzle = [440, 660, 880, 1320];
    sizzle.forEach((f, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const st = now + 0.2 + idx * 0.1;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, st);

      gain.gain.setValueAtTime(0.12, st);
      gain.gain.exponentialRampToValueAtTime(0.001, st + 0.6);

      osc.connect(gain);
      gain.connect(this.getOutputNode(ctx));

      osc.start(st);
      osc.stop(st + 0.65);
    });
  }

  /**
   * Synthesized VIP Party Room Entrance Fanfare
   * Three prestige acoustic tiers:
   * - VIP 3–5 (Gold/Platinum): Luminous ascending royal harp chime
   * - VIP 6–8 (Imperial Gem): Rich harmonic chord + crystalline chime cascade
   * - VIP 9–12 (Sovereign Emperor): Grand warm chord bloom + celestial arpeggio shimmer
   */
  public playVipEntryFanfare(vipTier: number) {
    if (this.isMuted) return;
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      const tier = Math.max(1, Math.min(12, Math.floor(Number(vipTier) || 3)));

      if (tier >= 9) {
        // Sovereign Emperor Class (VIP 9-12): Regal velvet chord swell + crystalline cascade
        this.playFilteredNoise(ctx, {
          startTime: now,
          duration: 0.45,
          filterType: 'bandpass',
          startFreq: 600,
          endFreq: 2400,
          peakGain: 0.06,
        });

        // Warm royal brass/pad fifth chord (A3, E4, A4)
        [220, 329.63, 440].forEach((freq) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          const filter = ctx.createBiquadFilter();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, now);

          filter.type = 'lowpass';
          filter.frequency.setValueAtTime(1400, now);
          filter.frequency.exponentialRampToValueAtTime(2600, now + 0.55);

          gain.gain.setValueAtTime(0.001, now);
          gain.gain.linearRampToValueAtTime(0.085, now + 0.12);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 1.35);

          osc.connect(filter);
          filter.connect(gain);
          gain.connect(this.getOutputNode(ctx));

          osc.start(now);
          osc.stop(now + 1.4);
        });

        // Ascending celestial shimmer arpeggio (C#5, E5, A5, C#6, E6)
        [554.37, 659.25, 880, 1108.73, 1318.51].forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          const st = now + 0.1 + idx * 0.085;

          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, st);

          gain.gain.setValueAtTime(0.001, st);
          gain.gain.linearRampToValueAtTime(0.11, st + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.001, st + 0.85);

          osc.connect(gain);
          gain.connect(this.getOutputNode(ctx));

          osc.start(st);
          osc.stop(st + 0.9);
        });
      } else if (tier >= 6) {
        // Imperial Gem Class (VIP 6-8): Shimmer whoosh + D major 9th crystal chimes
        this.playFilteredNoise(ctx, {
          startTime: now,
          duration: 0.35,
          filterType: 'highpass',
          startFreq: 900,
          endFreq: 2800,
          peakGain: 0.045,
        });

        [293.66, 440].forEach((freq) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, now);

          gain.gain.setValueAtTime(0.001, now);
          gain.gain.linearRampToValueAtTime(0.07, now + 0.09);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 1.05);

          osc.connect(gain);
          gain.connect(this.getOutputNode(ctx));

          osc.start(now);
          osc.stop(now + 1.1);
        });

        [587.33, 739.99, 880, 1174.66].forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          const st = now + 0.08 + idx * 0.08;

          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, st);

          gain.gain.setValueAtTime(0.001, st);
          gain.gain.linearRampToValueAtTime(0.1, st + 0.018);
          gain.gain.exponentialRampToValueAtTime(0.001, st + 0.7);

          osc.connect(gain);
          gain.connect(this.getOutputNode(ctx));

          osc.start(st);
          osc.stop(st + 0.75);
        });
      } else {
        // Royal Gold / Platinum Class (VIP 3-5): Crisp ascending luminous harp chime
        [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          const st = now + idx * 0.075;

          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, st);

          gain.gain.setValueAtTime(0.001, st);
          gain.gain.linearRampToValueAtTime(0.095, st + 0.015);
          gain.gain.exponentialRampToValueAtTime(0.001, st + 0.62);

          osc.connect(gain);
          gain.connect(this.getOutputNode(ctx));

          osc.start(st);
          osc.stop(st + 0.65);
        });
      }
    } catch {
      // Fail gracefully if Web Audio is blocked prior to user interaction
    }
  }
}

export const giftSoundEngine = new GiftSoundEngine();
