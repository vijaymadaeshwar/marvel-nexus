// audio-engine.ts — Programmatic Web Audio API ambient sound engine for Marvel Nexus

type Genre = 'mcu' | 'xmen' | 'spiderman' | 'cosmic';
type SfxType = 'whoosh' | 'click' | 'reveal' | 'achievement' | 'transition' | 'powerup';
type BeatCallback = (energy: number) => void;

interface OscillatorLayer {
  oscillator: OscillatorNode;
  gain: GainNode;
  filter: BiquadFilterNode;
  lfo?: OscillatorNode;
  lfoGain?: GainNode;
}

interface AmbientTrack {
  genre: Genre;
  layers: OscillatorLayer[];
  masterGain: GainNode;
  start: number;
}

interface BeatDetector {
  animFrame: number;
  callback: BeatCallback | null;
  threshold: number;
  cooldown: boolean;
}

interface VolumeState {
  master: number;
  music: number;
  sfx: number;
}

const GENRE_CONFIG: Record<Genre, { baseFreq: number; padFreq: number; filterFreq: number; detuneSpread: number; lfoRate: number }> = {
  mcu: { baseFreq: 110, padFreq: 220, filterFreq: 800, detuneSpread: 6, lfoRate: 0.15 },
  xmen: { baseFreq: 73.42, padFreq: 146.83, filterFreq: 500, detuneSpread: 10, lfoRate: 0.08 },
  spiderman: { baseFreq: 164.81, padFreq: 329.63, filterFreq: 2000, detuneSpread: 4, lfoRate: 0.3 },
  cosmic: { baseFreq: 55, padFreq: 110, filterFreq: 400, detuneSpread: 15, lfoRate: 0.05 },
};

function createNoiseBuffer(ctx: OfflineAudioContext | AudioContext, duration: number): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const length = sampleRate * duration;
  const buffer = ctx.createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

export class AudioEngine {
  private static instance: AudioEngine | null = null;

  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private analyser: AnalyserNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private currentAmbient: AmbientTrack | null = null;
  private fadeInterval: ReturnType<typeof setInterval> | null = null;
  private beatDetector: BeatDetector = {
    animFrame: 0,
    callback: null,
    threshold: 0.65,
    cooldown: false,
  };
  private volume: VolumeState = { master: 0.7, music: 0.5, sfx: 0.8 };
  private muted = false;
  private initialized = false;
  private resumeHandler: (() => void) | null = null;

  private constructor() {}

  static getInstance(): AudioEngine {
    if (!AudioEngine.instance) {
      AudioEngine.instance = new AudioEngine();
    }
    return AudioEngine.instance;
  }

  init(): void {
    if (this.initialized && this.ctx) {
      this.handleResume();
      return;
    }

    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new AudioCtx();

    this.compressor = this.ctx.createDynamicsCompressor();
    this.compressor.threshold.value = -24;
    this.compressor.knee.value = 30;
    this.compressor.ratio.value = 12;
    this.compressor.attack.value = 0.003;
    this.compressor.release.value = 0.25;

    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.8;

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this.volume.master;

    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = this.volume.music;

    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = this.volume.sfx;

    this.musicGain.connect(this.compressor);
    this.sfxGain.connect(this.compressor);
    this.compressor.connect(this.analyser);
    this.analyser.connect(this.masterGain);
    this.masterGain.connect(this.ctx.destination);

    this.initialized = true;
    this.handleResume();
    this.startBeatDetection();
  }

  private handleResume(): void {
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {
        // Safari / autoplay policy: attach resume to first user gesture
        if (!this.resumeHandler) {
          this.resumeHandler = () => {
            this.ctx?.resume().catch(() => {});
            document.removeEventListener('click', this.resumeHandler!);
            document.removeEventListener('touchstart', this.resumeHandler!);
            document.removeEventListener('keydown', this.resumeHandler!);
            this.resumeHandler = null;
          };
          document.addEventListener('click', this.resumeHandler, { once: true });
          document.addEventListener('touchstart', this.resumeHandler, { once: true });
          document.addEventListener('keydown', this.resumeHandler, { once: true });
        }
      });
    }
  }

  private ensureContext(): AudioContext {
    if (!this.ctx || !this.musicGain || !this.sfxGain) {
      throw new Error('AudioEngine not initialized. Call init() first.');
    }
    this.handleResume();
    return this.ctx;
  }

  playAmbient(genre: Genre = 'mcu'): void {
    const ctx = this.ensureContext();
    this.stopAmbient();

    const config = GENRE_CONFIG[genre];
    const trackGain = ctx.createGain();
    trackGain.gain.value = 0;

    const layers: OscillatorLayer[] = [];

    // Pad layer 1: detuned triangle waves
    for (let i = 0; i < 3; i++) {
      const layer = this.createOscillatorLayer(ctx, {
        type: 'triangle',
        frequency: config.padFreq + (i - 1) * 2,
        detune: (i - 1) * config.detuneSpread,
        filterFreq: config.filterFreq,
        filterType: 'lowpass',
        filterQ: 1,
        gain: 0.12 / 3,
        lfoFreq: config.lfoRate * (1 + i * 0.3),
        lfoDepth: 3 + i,
      });
      layer.oscillator.connect(trackGain);
      layers.push(layer);
    }

    // Pad layer 2: sine sub
    const subLayer = this.createOscillatorLayer(ctx, {
      type: 'sine',
      frequency: config.baseFreq,
      detune: 0,
      filterFreq: config.baseFreq * 2,
      filterType: 'lowpass',
      filterQ: 0.7,
      gain: 0.18,
      lfoFreq: config.lfoRate * 0.5,
      lfoDepth: 1.5,
    });
    subLayer.oscillator.connect(trackGain);
    layers.push(subLayer);

    // Pad layer 3: saw wave with heavy filtering for warmth
    const sawLayer = this.createOscillatorLayer(ctx, {
      type: 'sawtooth',
      frequency: config.baseFreq * 2,
      detune: config.detuneSpread * 0.5,
      filterFreq: config.filterFreq * 0.6,
      filterType: 'lowpass',
      filterQ: 2,
      gain: 0.04,
      lfoFreq: config.lfoRate * 1.5,
      lfoDepth: 5,
    });
    sawLayer.oscillator.connect(trackGain);
    layers.push(sawLayer);

    // Genre-specific extra layers
    if (genre === 'cosmic') {
      // Shimmer: high sine with slow amplitude modulation
      const shimmerLayer = this.createOscillatorLayer(ctx, {
        type: 'sine',
        frequency: config.baseFreq * 8,
        detune: 7,
        filterFreq: 4000,
        filterType: 'bandpass',
        filterQ: 5,
        gain: 0.025,
        lfoFreq: 0.03,
        lfoDepth: 15,
      });
      shimmerLayer.oscillator.connect(trackGain);
      layers.push(shimmerLayer);
    }

    if (genre === 'xmen') {
      // Bell-like FM tones
      const bellLayer = this.createOscillatorLayer(ctx, {
        type: 'sine',
        frequency: config.padFreq * 3,
        detune: 12,
        filterFreq: 2000,
        filterType: 'bandpass',
        filterQ: 8,
        gain: 0.03,
        lfoFreq: 0.06,
        lfoDepth: 8,
      });
      bellLayer.oscillator.connect(trackGain);
      layers.push(bellLayer);
    }

    trackGain?.connect(this.musicGain!);

    // Fade in
    const now = ctx.currentTime;
    trackGain.gain.setValueAtTime(0, now);
    trackGain.gain.linearRampToValueAtTime(1, now + 1.5);

    this.currentAmbient = { genre, layers, masterGain: trackGain, start: now };
  }

  private createOscillatorLayer(
    ctx: AudioContext,
    opts: {
      type: OscillatorType;
      frequency: number;
      detune: number;
      filterFreq: number;
      filterType: BiquadFilterType;
      filterQ: number;
      gain: number;
      lfoFreq: number;
      lfoDepth: number;
    }
  ): OscillatorLayer {
    const osc = ctx.createOscillator();
    osc.type = opts.type;
    osc.frequency.value = opts.frequency;
    osc.detune.value = opts.detune;

    const filter = ctx.createBiquadFilter();
    filter.type = opts.filterType;
    filter.frequency.value = opts.filterFreq;
    filter.Q.value = opts.filterQ;

    const gain = ctx.createGain();
    gain.gain.value = opts.gain;

    let lfo: OscillatorNode | undefined;
    let lfoGain: GainNode | undefined;

    if (opts.lfoDepth > 0 && opts.lfoFreq > 0) {
      lfo = ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = opts.lfoFreq;

      lfoGain = ctx.createGain();
      lfoGain.gain.value = opts.lfoDepth;

      lfo.connect(lfoGain);
      lfoGain.connect(filter.frequency);
      lfo.start();
    }

    osc.connect(filter);
    filter.connect(gain);
    osc.start();

    return { oscillator: osc, gain, filter, lfo, lfoGain };
  }

  stopAmbient(): void {
    if (this.fadeInterval) {
      clearInterval(this.fadeInterval);
      this.fadeInterval = null;
    }

    const track = this.currentAmbient;
    if (!track || !this.ctx) {
      this.currentAmbient = null;
      return;
    }

    const ctx = this.ctx;
    const now = ctx.currentTime;
    const fadeDuration = 1.2;

    track.masterGain.gain.setValueAtTime(track.masterGain.gain.value, now);
    track.masterGain.gain.linearRampToValueAtTime(0, now + fadeDuration);

    const layers = [...track.layers];
    setTimeout(() => {
      for (const layer of layers) {
        try {
          layer.oscillator.stop();
          layer.oscillator.disconnect();
          layer.gain.disconnect();
          layer.filter.disconnect();
          if (layer.lfo) {
            layer.lfo.stop();
            layer.lfo.disconnect();
          }
          if (layer.lfoGain) {
            layer.lfoGain.disconnect();
          }
        } catch {
          // Already stopped
        }
      }
      track.masterGain.disconnect();
    }, (fadeDuration + 0.1) * 1000);

    this.currentAmbient = null;
  }

  playSfx(type: SfxType): void {
    const ctx = this.ensureContext();

    switch (type) {
      case 'whoosh':
        this.sfxWhoosh(ctx);
        break;
      case 'click':
        this.sfxClick(ctx);
        break;
      case 'reveal':
        this.sfxReveal(ctx);
        break;
      case 'achievement':
        this.sfxAchievement(ctx);
        break;
      case 'transition':
        this.sfxTransition(ctx);
        break;
      case 'powerup':
        this.sfxPowerup(ctx);
        break;
    }
  }

  private sfxWhoosh(ctx: AudioContext): void {
    const now = ctx.currentTime;
    const duration = 0.4;
    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const bandpass = ctx.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.setValueAtTime(300, now);
    bandpass.frequency.exponentialRampToValueAtTime(3000, now + duration * 0.3);
    bandpass.frequency.exponentialRampToValueAtTime(200, now + duration);
    bandpass.Q.value = 1.5;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.5, now + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    source.connect(bandpass);
    bandpass.connect(gain);
    gain.connect(this.sfxGain!);
    source.start(now);
    source.stop(now + duration);
  }

  private sfxClick(ctx: AudioContext): void {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, now);
    osc.frequency.exponentialRampToValueAtTime(800, now + 0.06);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    osc.connect(gain);
    gain.connect(this.sfxGain!);
    osc.start(now);
    osc.stop(now + 0.1);
  }

  private sfxReveal(ctx: AudioContext): void {
    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    const noteLength = 0.12;

    for (let i = 0; i < notes.length; i++) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = notes[i];

      const gain = ctx.createGain();
      const start = now + i * noteLength;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.2, start + 0.02);
      gain.gain.setValueAtTime(0.2, start + noteLength * 0.6);
      gain.gain.exponentialRampToValueAtTime(0.001, start + noteLength + 0.15);

      osc.connect(gain);
      gain.connect(this.sfxGain!);
      osc.start(start);
      osc.stop(start + noteLength + 0.2);
    }
  }

  private sfxAchievement(ctx: AudioContext): void {
    const now = ctx.currentTime;
    const chordFreqs = [261.63, 329.63, 392.0, 523.25];

    for (const freq of chordFreqs) {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = freq;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.15, now + 0.05);
      gain.gain.setValueAtTime(0.15, now + 0.3);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);

      osc.connect(gain);
      gain.connect(this.sfxGain!);
      osc.start(now);
      osc.stop(now + 0.85);
    }

    // Shimmering overtone
    const shimmer = ctx.createOscillator();
    shimmer.type = 'sine';
    shimmer.frequency.value = 1568;
    const shimmerGain = ctx.createGain();
    shimmerGain.gain.setValueAtTime(0, now);
    shimmerGain.gain.linearRampToValueAtTime(0.06, now + 0.1);
    shimmerGain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
    shimmer.connect(shimmerGain);
    shimmerGain.connect(this.sfxGain!);
    shimmer.start(now + 0.05);
    shimmer.stop(now + 0.7);
  }

  private sfxTransition(ctx: AudioContext): void {
    const now = ctx.currentTime;
    const duration = 0.5;

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.linearRampToValueAtTime(880, now + duration * 0.5);
    osc.frequency.linearRampToValueAtTime(440, now + duration);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.2, now + 0.05);
    gain.gain.setValueAtTime(0.2, now + duration - 0.1);
    gain.gain.linearRampToValueAtTime(0, now + duration);

    osc.connect(gain);
    gain.connect(this.sfxGain!);
    osc.start(now);
    osc.stop(now + duration + 0.05);
  }

  private sfxPowerup(ctx: AudioContext): void {
    const now = ctx.currentTime;
    const duration = 0.6;

    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(1200, now + duration);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(400, now);
    filter.frequency.exponentialRampToValueAtTime(4000, now + duration);
    filter.Q.value = 5;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.setValueAtTime(0.2, now + duration * 0.7);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain!);
    osc.start(now);
    osc.stop(now + duration + 0.05);
  }

  setVolume(master: number, music?: number, sfx?: number): void {
    const clamp = (v: number) => Math.max(0, Math.min(1, v));
    this.volume.master = clamp(master);
    if (music !== undefined) this.volume.music = clamp(music);
    if (sfx !== undefined) this.volume.sfx = clamp(sfx);

    if (this.masterGain && !this.muted) {
      this.masterGain.gain.setTargetAtTime(this.volume.master, this.ctx?.currentTime ?? 0, 0.05);
    }
    if (this.musicGain) {
      this.musicGain.gain.setTargetAtTime(this.volume.music, this.ctx?.currentTime ?? 0, 0.05);
    }
    if (this.sfxGain) {
      this.sfxGain.gain.setTargetAtTime(this.volume.sfx, this.ctx?.currentTime ?? 0, 0.05);
    }
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (!this.masterGain || !this.ctx) return;
    this.masterGain.gain.setTargetAtTime(
      muted ? 0 : this.volume.master,
      this.ctx.currentTime,
      0.05
    );
  }

  getAnalyserData(): Uint8Array {
    if (!this.analyser) {
      return new Uint8Array(0);
    }
    const data = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(data);
    return data;
  }

  onBeat(callback: BeatCallback): void {
    this.beatDetector.callback = callback;
  }

  private startBeatDetection(): void {
    if (!this.analyser) return;

    const binCount = this.analyser.frequencyBinCount;
    let previousEnergy = 0;

    const detect = (): void => {
      if (!this.analyser) return;

      const data = new Uint8Array(binCount);
      this.analyser.getByteFrequencyData(data);

      // Focus on bass bins (roughly 20-150 Hz)
      const bassEnd = Math.floor((150 / (this.ctx!.sampleRate / 2)) * binCount);
      let sum = 0;
      for (let i = 0; i < bassEnd && i < binCount; i++) {
        sum += data[i];
      }
      const energy = sum / (bassEnd * 255);

      if (
        energy > this.beatDetector.threshold &&
        energy > previousEnergy * 1.15 &&
        !this.beatDetector.cooldown &&
        this.beatDetector.callback
      ) {
        this.beatDetector.cooldown = true;
        this.beatDetector.callback(energy);
        setTimeout(() => {
          this.beatDetector.cooldown = false;
        }, 120);
      }

      previousEnergy = energy;
      this.beatDetector.animFrame = requestAnimationFrame(detect);
    };

    this.beatDetector.animFrame = requestAnimationFrame(detect);
  }

  dispose(): void {
    this.stopAmbient();

    if (this.beatDetector.animFrame) {
      cancelAnimationFrame(this.beatDetector.animFrame);
      this.beatDetector.animFrame = 0;
    }
    this.beatDetector.callback = null;

    if (this.resumeHandler) {
      document.removeEventListener('click', this.resumeHandler);
      document.removeEventListener('touchstart', this.resumeHandler);
      document.removeEventListener('keydown', this.resumeHandler);
      this.resumeHandler = null;
    }

    if (this.masterGain) {
      this.masterGain.disconnect();
      this.masterGain = null;
    }
    if (this.musicGain) {
      this.musicGain.disconnect();
      this.musicGain = null;
    }
    if (this.sfxGain) {
      this.sfxGain.disconnect();
      this.sfxGain = null;
    }
    if (this.compressor) {
      this.compressor.disconnect();
      this.compressor = null;
    }
    if (this.analyser) {
      this.analyser.disconnect();
      this.analyser = null;
    }

    if (this.ctx && this.ctx.state !== 'closed') {
      this.ctx.close().catch(() => {});
    }
    this.ctx = null;
    this.initialized = false;
  }
}
