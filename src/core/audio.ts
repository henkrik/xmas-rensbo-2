import type { GameState } from '../world/gameState';
import type { InputState } from './input';
import { RUDOLPH_INSPECTED_KEY } from '../world/levels/levelOutside';

export type SoundEffectId =
  | 'dialogue_open'
  | 'dialogue_advance'
  | 'achievement'
  | 'footstep_snow'
  | 'footstep_indoor'
  | 'jump'
  | 'dog_bark'
  | 'cat_meow'
  | 'cat_angry'
  | 'door_locked'
  | 'door_open'
  | 'pickup_item'
  | 'pickup_whiskey'
  | 'pickup_armor'
  | 'weapon_switch'
  | 'uzi_fire'
  | 'uzi_reload'
  | 'no_ammo'
  | 'flamethrower_fire'
  | 'fire_ember'
  | 'katana_swing'
  | 'punch_swing'
  | 'bazooka_fire'
  | 'rocket_flight'
  | 'explosion'
  | 'mine_beep'
  | 'wall_crumble'
  | 'c4_plant'
  | 'window_break'
  | 'npc_alert'
  | 'player_hurt'
  | 'npc_hit'
  | 'npc_death'
  | 'snowball_throw'
  | 'electrocution'
  | 'motorcycle_engine'
  | 'motorcycle_crash'
  | 'computer_boot'
  | 'game_over';

export type MusicTrackId = 'peaceful_xmas' | 'action_xmas' | 'victory_xmas';

function midiToHz(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

// Peaceful N64 Christmas melody ("Jingle Bells" & "We Wish You a Merry Christmas" motif)
// 16th-note steps at ~135 BPM (stepDuration = 0.111s)
const PEACEFUL_LEAD_NOTES: ReadonlyArray<number | null> = [
  // Bar 1: E5 E5 E5 - | E5 E5 E5 - | E5 G5 C5 D5 | E5 - - -
  76, null, 76, null, 76, null, null, null,
  76, null, 76, null, 76, null, null, null,
  76, null, 79, null, 72, null, 74, null,
  76, null, null, null, null, null, null, null,
  // Bar 2: F5 F5 F5 F5 | F5 E5 E5 E5 | E5 D5 D5 E5 | D5 - G5 -
  77, null, 77, null, 77, null, 77, null,
  77, null, 76, null, 76, null, 76, 76,
  76, null, 74, null, 74, null, 76, null,
  74, null, null, null, 79, null, null, null,
  // Bar 3: E5 E5 E5 - | E5 E5 E5 - | E5 G5 C5 D5 | E5 - - -
  76, null, 76, null, 76, null, null, null,
  76, null, 76, null, 76, null, null, null,
  76, null, 79, null, 72, null, 74, null,
  76, null, null, null, null, null, null, null,
  // Bar 4: F5 F5 F5 F5 | F5 E5 E5 E5 | G5 G5 F5 D5 | C5 - - -
  77, null, 77, null, 77, null, 77, null,
  77, null, 76, null, 76, null, 76, 76,
  79, null, 79, null, 77, null, 74, null,
  72, null, null, null, null, null, null, null,
];

const PEACEFUL_BASS_NOTES: ReadonlyArray<number | null> = [
  48, null, null, null, 55, null, null, null,
  48, null, null, null, 55, null, null, null,
  48, null, null, null, 52, null, 55, null,
  48, null, null, null, 55, null, null, null,
  53, null, null, null, 57, null, null, null,
  48, null, null, null, 52, null, null, null,
  50, null, null, null, 54, null, null, null,
  55, null, null, null, 43, null, null, null,
  48, null, null, null, 55, null, null, null,
  48, null, null, null, 55, null, null, null,
  48, null, null, null, 52, null, 55, null,
  48, null, null, null, 55, null, null, null,
  53, null, null, null, 57, null, null, null,
  48, null, null, null, 52, null, null, null,
  55, null, null, null, 43, null, null, null,
  48, null, 55, null, 60, null, null, null,
];

const PEACEFUL_HARMONY_NOTES: ReadonlyArray<number | null> = [
  60, 64, 67, 64, 60, 64, 67, 64,
  60, 64, 67, 64, 60, 64, 67, 64,
  60, 64, 67, 64, 60, 64, 67, 64,
  60, 64, 67, 64, 60, 64, 67, 64,
  65, 69, 72, 69, 65, 69, 72, 69,
  60, 64, 67, 64, 60, 64, 67, 64,
  62, 66, 69, 66, 62, 66, 69, 66,
  67, 71, 74, 71, 67, 71, 74, 71,
  60, 64, 67, 64, 60, 64, 67, 64,
  60, 64, 67, 64, 60, 64, 67, 64,
  60, 64, 67, 64, 60, 64, 67, 64,
  60, 64, 67, 64, 60, 64, 67, 64,
  65, 69, 72, 69, 65, 69, 72, 69,
  60, 64, 67, 64, 60, 64, 67, 64,
  67, 71, 74, 71, 67, 71, 74, 71,
  60, 64, 67, 72, null, null, null, null,
];

// Action N64 Christmas motif ("Carol of the Bells" + "God Rest Ye Merry Gentlemen" in E minor)
const ACTION_OSTINATO_NOTES: ReadonlyArray<number | null> = [
  // G5 - F#5 G5 E5 - repeated driving motif, then Bb5 - A5 Bb5 G5 -
  79, null, 78, 79, 76, null, 79, null, 78, 79, 76, null, 79, null, 78, 79,
  76, null, 79, null, 78, 79, 76, null, 82, null, 81, 82, 79, null, 82, null,
  81, 82, 79, null, 83, null, 82, 83, 79, null, 78, null, 76, null, 75, null,
  76, null, 78, 79, 81, null, 79, 78, 76, null, 75, null, 76, null, null, null,
];

const ACTION_BASS_NOTES: ReadonlyArray<number | null> = [
  40, 40, 52, 40, 43, 43, 55, 43, 45, 45, 57, 45, 47, 47, 59, 47,
  40, 40, 52, 40, 43, 43, 55, 43, 46, 46, 58, 46, 43, 43, 55, 43,
  45, 45, 57, 45, 47, 47, 59, 47, 48, 48, 60, 48, 47, 47, 59, 47,
  40, 43, 47, 52, 50, 47, 45, 43, 40, null, 40, null, 52, null, null, null,
];

const ACTION_COUNTER_NOTES: ReadonlyArray<number | null> = [
  64, null, null, null, 67, null, null, null, 66, null, null, null, 64, null, null, null,
  71, null, null, null, 69, null, null, null, 67, null, null, null, 66, null, null, null,
  64, null, 67, null, 71, null, 74, null, 72, null, 71, null, 69, null, 66, null,
  64, null, null, null, 63, null, null, null, 64, null, null, null, null, null, null, null,
];

const VICTORY_LEAD_NOTES: ReadonlyArray<number | null> = [
  72, null, 76, null, 79, null, 84, null,
  83, null, 84, null, 86, null, 84, null,
  79, null, 84, null, 88, null, 91, null,
  84, null, null, null, 84, null, null, null,
];

class SoundManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private masterFilter: BiquadFilterNode | null = null;
  private delaySend: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  private recentEvents: SoundEffectId[] = [];
  private lastPlayedAt = new Map<SoundEffectId, number>();
  private clockSeconds = 0;

  private currentTrack: MusicTrackId = 'peaceful_xmas';
  private musicStep = 0;
  private musicStepAccum = 0;

  public unlock(): void {
    if (typeof window === 'undefined') return;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioCtx) return;
      try {
        this.ctx = new AudioCtx();
        this.setupMasterChain();
      } catch {
        this.ctx = null;
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  private setupMasterChain(): void {
    const ctx = this.ctx;
    if (!ctx) return;

    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -14;
    compressor.knee.value = 18;
    compressor.ratio.value = 4;
    compressor.attack.value = 0.004;
    compressor.release.value = 0.16;
    compressor.connect(ctx.destination);

    // N64 DAC warm low-pass rolloff
    this.masterFilter = ctx.createBiquadFilter();
    this.masterFilter.type = 'lowpass';
    this.masterFilter.frequency.value = 10500;
    this.masterFilter.Q.value = 0.7;
    this.masterFilter.connect(compressor);

    this.masterGain = ctx.createGain();
    this.masterGain.gain.value = 0.42;
    this.masterGain.connect(this.masterFilter);

    // N64-style stereo/room ambience delay bus
    const delay = ctx.createDelay(0.5);
    delay.delayTime.value = 0.135;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.22;
    const delayFilter = ctx.createBiquadFilter();
    delayFilter.type = 'lowpass';
    delayFilter.frequency.value = 3400;
    const wetGain = ctx.createGain();
    wetGain.gain.value = 0.18;

    this.delaySend = ctx.createGain();
    this.delaySend.gain.value = 1.0;
    this.delaySend.connect(delay);
    delay.connect(delayFilter);
    delayFilter.connect(feedback);
    feedback.connect(delay);
    delayFilter.connect(wetGain);
    wetGain.connect(this.masterFilter);

    // Pre-generate 1.5s white-noise buffer for explosions, fire, footsteps, glass & percussion
    const sampleRate = ctx.sampleRate;
    const length = Math.floor(sampleRate * 1.5);
    this.noiseBuffer = ctx.createBuffer(1, length, sampleRate);
    const data = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
  }

  public getRecentEvents(): readonly SoundEffectId[] {
    return this.recentEvents;
  }

  public clearRecentEvents(): void {
    this.recentEvents.length = 0;
    this.lastPlayedAt.clear();
  }

  public getCurrentMusicTrack(): MusicTrackId {
    return this.currentTrack;
  }

  public setMusicTrack(track: MusicTrackId): void {
    if (this.currentTrack !== track) {
      this.currentTrack = track;
      this.musicStep = 0;
      this.musicStepAccum = 0;
    }
  }

  public stepMusic(dtSeconds: number): void {
    if (dtSeconds <= 0) return;
    this.clockSeconds += dtSeconds;
    const stepDuration =
      this.currentTrack === 'action_xmas'
        ? 0.105
        : this.currentTrack === 'victory_xmas'
          ? 0.115
          : 0.12;
    this.musicStepAccum += dtSeconds;
    let stepsTriggered = 0;
    while (this.musicStepAccum >= stepDuration && stepsTriggered < 4) {
      this.musicStepAccum -= stepDuration;
      this.triggerMusicStep(this.musicStep, stepDuration);
      this.musicStep += 1;
      stepsTriggered += 1;
    }
    if (this.musicStepAccum > stepDuration * 4) {
      this.musicStepAccum = 0;
    }
  }

  private triggerMusicStep(step: number, stepDur: number): void {
    if (!this.ctx || !this.masterGain || this.ctx.state !== 'running') {
      return;
    }

    if (this.currentTrack === 'peaceful_xmas') {
      const idx = step % PEACEFUL_LEAD_NOTES.length;
      const lead = PEACEFUL_LEAD_NOTES[idx];
      const bass = PEACEFUL_BASS_NOTES[idx];
      const harm = PEACEFUL_HARMONY_NOTES[idx];

      if (lead !== null) {
        this.playN64BellNote(midiToHz(lead), stepDur * 1.9, 0.085);
      }
      if (harm !== null) {
        this.playTone({
          type: 'square',
          freq: midiToHz(harm),
          duration: stepDur * 0.9,
          gain: 0.025,
          filterFreq: 1800,
          sendEcho: true,
        });
      }
      if (bass !== null) {
        this.playTone({
          type: 'triangle',
          freq: midiToHz(bass),
          duration: stepDur * 2.6,
          gain: 0.095,
          filterFreq: 900,
        });
      }
      // Sleigh bells on every quarter beat (steps 0, 4, 8, 12) + gentle off-beat shimmer
      if (idx % 4 === 0) {
        this.playSleighBell(0.032);
      } else if (idx % 4 === 2) {
        this.playSleighBell(0.015);
      }
    } else if (this.currentTrack === 'action_xmas') {
      const idx = step % ACTION_OSTINATO_NOTES.length;
      const ost = ACTION_OSTINATO_NOTES[idx];
      const bass = ACTION_BASS_NOTES[idx];
      const counter = ACTION_COUNTER_NOTES[idx];

      if (ost !== null) {
        this.playN64BellNote(midiToHz(ost), stepDur * 1.45, 0.075);
      }
      if (counter !== null) {
        this.playTone({
          type: 'sawtooth',
          freq: midiToHz(counter),
          duration: stepDur * 2.8,
          gain: 0.045,
          filterFreq: 2100,
          sendEcho: true,
        });
      }
      if (bass !== null) {
        this.playTone({
          type: 'sawtooth',
          freq: midiToHz(bass),
          duration: stepDur * 0.85,
          gain: 0.08,
          filterFreq: 680,
        });
      }
      if (idx % 4 === 0) {
        this.playDrumKick(0.11);
      } else if (idx % 4 === 2) {
        this.playDrumSnare(0.055);
      }
      if (idx % 2 === 0) {
        this.playSleighBell(0.018);
      }
    } else {
      const idx = step % VICTORY_LEAD_NOTES.length;
      const lead = VICTORY_LEAD_NOTES[idx];
      if (lead !== null) {
        this.playN64BellNote(midiToHz(lead), stepDur * 1.8, 0.09);
      }
      if (idx % 4 === 0) {
        this.playSleighBell(0.035);
      }
    }
  }

  public play(id: SoundEffectId, minIntervalSeconds = 0.025): void {
    const prev = this.lastPlayedAt.get(id);
    if (
      prev !== undefined &&
      this.clockSeconds - prev >= 0 &&
      this.clockSeconds - prev < minIntervalSeconds
    ) {
      return;
    }
    this.lastPlayedAt.set(id, this.clockSeconds);
    this.recentEvents.push(id);
    if (this.recentEvents.length > 128) {
      this.recentEvents.shift();
    }

    if (!this.ctx || !this.masterGain || this.ctx.state !== 'running') {
      return;
    }

    switch (id) {
      case 'dialogue_open':
        this.playTone({ type: 'square', freq: 659.25, freqEnd: 880, duration: 0.075, gain: 0.12, filterFreq: 2800, sendEcho: true });
        break;
      case 'dialogue_advance':
        this.playTone({ type: 'square', freq: 880, freqEnd: 1174.66, duration: 0.048, gain: 0.11, filterFreq: 3200 });
        break;
      case 'achievement':
        [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
          this.playN64BellNote(freq, 0.28, 0.13, i * 0.075);
        });
        break;
      case 'footstep_snow':
        this.playNoise({ duration: 0.065, gain: 0.085, filterType: 'bandpass', freq: 950, freqEnd: 460, q: 1.6 });
        this.playTone({ type: 'sine', freq: 145, freqEnd: 68, duration: 0.045, gain: 0.05 });
        break;
      case 'footstep_indoor':
        this.playTone({ type: 'triangle', freq: 210, freqEnd: 82, duration: 0.038, gain: 0.065, filterFreq: 800 });
        this.playNoise({ duration: 0.025, gain: 0.035, filterType: 'bandpass', freq: 1100, q: 2.0 });
        break;
      case 'jump':
        this.playTone({ type: 'triangle', freq: 185, freqEnd: 540, duration: 0.16, gain: 0.14, sendEcho: true });
        break;
      case 'dog_bark':
        // Double "arf! arf!" bark
        for (const offset of [0, 0.14]) {
          this.playTone({
            type: 'sawtooth',
            freq: 280,
            freqMid: 520,
            freqEnd: 195,
            duration: 0.1,
            gain: 0.15,
            filterFreq: 1450,
            delaySeconds: offset,
            sendEcho: true,
          });
          this.playNoise({
            duration: 0.075,
            gain: 0.06,
            filterType: 'bandpass',
            freq: 900,
            q: 2.2,
            delaySeconds: offset,
          });
        }
        break;
      case 'cat_meow':
        // Formant-swept "mjau!"
        this.playTone({
          type: 'sawtooth',
          freq: 520,
          freqMid: 960,
          freqEnd: 430,
          duration: 0.28,
          gain: 0.14,
          filterFreq: 2200,
          sendEcho: true,
        });
        this.playTone({
          type: 'triangle',
          freq: 1040,
          freqMid: 1880,
          freqEnd: 860,
          duration: 0.26,
          gain: 0.06,
          filterFreq: 2800,
        });
        break;
      case 'cat_angry':
        // Angry cat hiss + crooked-back yowl
        this.playNoise({ duration: 0.22, gain: 0.14, filterType: 'highpass', freq: 2800, q: 1.2 });
        this.playTone({
          type: 'sawtooth',
          freq: 640,
          freqMid: 1420,
          freqEnd: 510,
          duration: 0.32,
          gain: 0.16,
          filterFreq: 3100,
          delaySeconds: 0.04,
          sendEcho: true,
        });
        break;
      case 'door_locked':
        // Metallic click + handle pull rattle + lock clack
        this.playTone({ type: 'square', freq: 1450, freqEnd: 620, duration: 0.025, gain: 0.14 });
        this.playNoise({ duration: 0.035, gain: 0.11, filterType: 'bandpass', freq: 1800, q: 3.0 });
        this.playTone({ type: 'triangle', freq: 180, freqEnd: 110, duration: 0.055, gain: 0.14, delaySeconds: 0.065 });
        this.playTone({ type: 'square', freq: 1220, freqEnd: 480, duration: 0.03, gain: 0.14, delaySeconds: 0.135 });
        this.playNoise({ duration: 0.04, gain: 0.11, filterType: 'bandpass', freq: 1550, q: 3.0, delaySeconds: 0.135 });
        break;
      case 'door_open':
        this.playTone({ type: 'square', freq: 980, freqEnd: 540, duration: 0.025, gain: 0.1 });
        this.playTone({ type: 'sawtooth', freq: 195, freqMid: 310, freqEnd: 240, duration: 0.22, gain: 0.11, filterFreq: 950, delaySeconds: 0.03 });
        break;
      case 'pickup_item':
        [587.33, 783.99, 1174.66].forEach((freq, i) => {
          this.playN64BellNote(freq, 0.16, 0.13, i * 0.055);
        });
        break;
      case 'pickup_whiskey':
        this.playTone({ type: 'sine', freq: 320, freqEnd: 680, duration: 0.06, gain: 0.15 });
        this.playTone({ type: 'sine', freq: 240, freqMid: 420, freqEnd: 280, duration: 0.09, gain: 0.14, delaySeconds: 0.09 });
        this.playTone({ type: 'sine', freq: 260, freqMid: 460, freqEnd: 300, duration: 0.09, gain: 0.14, delaySeconds: 0.2 });
        break;
      case 'pickup_armor':
        this.playNoise({ duration: 0.11, gain: 0.12, filterType: 'bandpass', freq: 1400, freqEnd: 2600, q: 2.0 });
        this.playTone({ type: 'sawtooth', freq: 220, freqEnd: 440, duration: 0.22, gain: 0.15, filterFreq: 1600, delaySeconds: 0.08, sendEcho: true });
        break;
      case 'weapon_switch':
        this.playTone({ type: 'square', freq: 1320, freqEnd: 660, duration: 0.022, gain: 0.1 });
        this.playNoise({ duration: 0.03, gain: 0.09, filterType: 'highpass', freq: 2200, delaySeconds: 0.025 });
        break;
      case 'uzi_fire':
        this.playTone({ type: 'sawtooth', freq: 210, freqEnd: 58, duration: 0.055, gain: 0.2, filterFreq: 1800 });
        this.playNoise({ duration: 0.05, gain: 0.18, filterType: 'bandpass', freq: 1900, freqEnd: 750, q: 1.1 });
        break;
      case 'uzi_reload':
        // Distinct 4-stage N64 SMG reload sequence across the 1.5s reload animation:
        // 1. Magazine release & slide-out (0.08s)
        this.playTone({ type: 'square', freq: 1680, freqEnd: 720, duration: 0.045, gain: 0.2, delaySeconds: 0.08 });
        this.playTone({ type: 'sawtooth', freq: 580, freqEnd: 210, duration: 0.14, gain: 0.18, filterFreq: 1600, delaySeconds: 0.11 });
        this.playNoise({ duration: 0.13, gain: 0.18, filterType: 'bandpass', freq: 1900, freqEnd: 850, q: 1.8, delaySeconds: 0.11 });
        // 2. Fresh magazine slap & metallic catch lock (0.52s)
        this.playTone({ type: 'triangle', freq: 155, freqEnd: 58, duration: 0.085, gain: 0.26, delaySeconds: 0.52 });
        this.playTone({ type: 'square', freq: 880, freqEnd: 1980, duration: 0.06, gain: 0.22, delaySeconds: 0.57, sendEcho: true });
        this.playNoise({ duration: 0.07, gain: 0.2, filterType: 'bandpass', freq: 2400, q: 2.2, delaySeconds: 0.57 });
        // 3. Bolt rack back & heavy spring slam forward ("CHCHK-CLACK!", 0.96s & 1.12s)
        this.playNoise({ duration: 0.11, gain: 0.22, filterType: 'bandpass', freq: 1500, freqEnd: 2800, q: 1.6, delaySeconds: 0.96 });
        this.playTone({ type: 'sawtooth', freq: 620, freqEnd: 1280, duration: 0.095, gain: 0.18, filterFreq: 2600, delaySeconds: 0.96 });
        this.playNoise({ duration: 0.1, gain: 0.25, filterType: 'bandpass', freq: 2900, freqEnd: 1100, q: 1.5, delaySeconds: 1.12, sendEcho: true });
        this.playTone({ type: 'square', freq: 1420, freqEnd: 340, duration: 0.08, gain: 0.24, delaySeconds: 1.12 });
        // 4. Crisp N64 "magazine ready" metallic lock chime (1.38s)
        this.playN64BellNote(1760, 0.14, 0.15, 1.38);
        break;
      case 'no_ammo':
        this.playTone({ type: 'square', freq: 2400, freqEnd: 1100, duration: 0.02, gain: 0.11 });
        break;
      case 'flamethrower_fire':
        this.playNoise({ duration: 0.16, gain: 0.16, filterType: 'bandpass', freq: 680, freqEnd: 260, q: 0.9 });
        this.playTone({ type: 'sawtooth', freq: 115, freqEnd: 65, duration: 0.14, gain: 0.09, filterFreq: 360 });
        break;
      case 'fire_ember':
        this.playNoise({ duration: 0.14, gain: 0.055, filterType: 'bandpass', freq: 420, q: 1.2 });
        this.playNoise({ duration: 0.022, gain: 0.09, filterType: 'highpass', freq: 3600, delaySeconds: 0.03 });
        break;
      case 'katana_swing':
        this.playNoise({ duration: 0.15, gain: 0.18, filterType: 'bandpass', freq: 2400, freqEnd: 450, q: 1.8 });
        this.playTone({ type: 'sine', freq: 3400, freqEnd: 1400, duration: 0.09, gain: 0.06, sendEcho: true });
        break;
      case 'punch_swing':
        this.playNoise({ duration: 0.09, gain: 0.13, filterType: 'bandpass', freq: 520, freqEnd: 180, q: 1.4 });
        this.playTone({ type: 'triangle', freq: 160, freqEnd: 62, duration: 0.07, gain: 0.14 });
        break;
      case 'bazooka_fire':
        this.playTone({ type: 'sawtooth', freq: 145, freqEnd: 38, duration: 0.24, gain: 0.24, filterFreq: 720, sendEcho: true });
        this.playNoise({ duration: 0.22, gain: 0.2, filterType: 'bandpass', freq: 820, freqEnd: 240, q: 0.9 });
        break;
      case 'rocket_flight':
        this.playNoise({ duration: 0.11, gain: 0.075, filterType: 'bandpass', freq: 1250, freqEnd: 980, q: 2.4 });
        this.playTone({ type: 'sawtooth', freq: 240, freqEnd: 215, duration: 0.1, gain: 0.04, filterFreq: 600 });
        break;
      case 'explosion':
        this.playTone({ type: 'sine', freq: 98, freqEnd: 22, duration: 0.52, gain: 0.32 });
        this.playTone({ type: 'sawtooth', freq: 135, freqEnd: 28, duration: 0.38, gain: 0.22, filterFreq: 380 });
        this.playNoise({ duration: 0.58, gain: 0.28, filterType: 'lowpass', freq: 2400, freqEnd: 130, q: 0.8, sendEcho: true });
        break;
      case 'mine_beep':
        this.playTone({ type: 'square', freq: 2450, duration: 0.045, gain: 0.12, filterFreq: 4000 });
        break;
      case 'wall_crumble':
        this.playNoise({ duration: 0.38, gain: 0.2, filterType: 'lowpass', freq: 620, freqEnd: 140, q: 1.0 });
        this.playTone({ type: 'triangle', freq: 110, freqEnd: 36, duration: 0.32, gain: 0.18 });
        break;
      case 'c4_plant':
        [1850, 1850, 2650].forEach((freq, i) => {
          this.playTone({ type: 'square', freq, duration: 0.055, gain: 0.15, delaySeconds: i * 0.085, sendEcho: true });
        });
        break;
      case 'window_break':
        // Bright shattering glass crash + cascading crystalline shards
        this.playNoise({ duration: 0.28, gain: 0.24, filterType: 'highpass', freq: 2200, q: 1.1, sendEcho: true });
        [3200, 4400, 2750, 5100, 3850, 5800].forEach((freq, i) => {
          this.playTone({
            type: 'triangle',
            freq,
            freqEnd: freq * 0.72,
            duration: 0.075,
            gain: 0.11,
            delaySeconds: 0.02 + i * 0.038,
            sendEcho: true,
          });
        });
        break;
      case 'npc_alert':
        this.playTone({ type: 'sawtooth', freq: 1174.66, freqEnd: 1567.98, duration: 0.14, gain: 0.16, filterFreq: 3800, sendEcho: true });
        break;
      case 'player_hurt':
        this.playTone({ type: 'sawtooth', freq: 240, freqEnd: 92, duration: 0.14, gain: 0.2, filterFreq: 950 });
        this.playNoise({ duration: 0.08, gain: 0.14, filterType: 'lowpass', freq: 680 });
        break;
      case 'npc_hit':
        this.playTone({ type: 'triangle', freq: 310, freqEnd: 115, duration: 0.07, gain: 0.14 });
        this.playNoise({ duration: 0.045, gain: 0.11, filterType: 'bandpass', freq: 1200, q: 1.5 });
        break;
      case 'npc_death':
        this.playTone({ type: 'sawtooth', freq: 380, freqEnd: 88, duration: 0.28, gain: 0.18, filterFreq: 1100, sendEcho: true });
        break;
      case 'snowball_throw':
        this.playNoise({ duration: 0.085, gain: 0.08, filterType: 'bandpass', freq: 780, freqEnd: 320, q: 1.4 });
        break;
      case 'electrocution':
        this.playTone({ type: 'sawtooth', freq: 120, freqMid: 960, freqEnd: 180, duration: 0.1, gain: 0.16, filterFreq: 3200 });
        this.playNoise({ duration: 0.08, gain: 0.14, filterType: 'highpass', freq: 2400 });
        break;
      case 'motorcycle_engine':
        this.playTone({ type: 'sawtooth', freq: 72, freqEnd: 96, duration: 0.11, gain: 0.12, filterFreq: 420 });
        break;
      case 'motorcycle_crash':
        this.playNoise({ duration: 0.32, gain: 0.22, filterType: 'bandpass', freq: 950, freqEnd: 210, q: 0.9, sendEcho: true });
        this.playTone({ type: 'sawtooth', freq: 150, freqEnd: 42, duration: 0.26, gain: 0.2, filterFreq: 600 });
        break;
      case 'computer_boot':
        this.playTone({ type: 'square', freq: 1000, duration: 0.09, gain: 0.12 });
        this.playTone({ type: 'square', freq: 1480, duration: 0.07, gain: 0.11, delaySeconds: 0.12 });
        break;
      case 'game_over':
        [392.0, 349.23, 329.63, 261.63].forEach((freq, i) => {
          this.playTone({
            type: 'sawtooth',
            freq,
            duration: 0.22,
            gain: 0.14,
            filterFreq: 1200,
            delaySeconds: i * 0.16,
            sendEcho: true,
          });
        });
        break;
    }
  }

  private playN64BellNote(
    freq: number,
    duration: number,
    gain: number,
    delaySeconds = 0
  ): void {
    this.playTone({
      type: 'triangle',
      freq,
      duration,
      gain,
      filterFreq: 4200,
      delaySeconds,
      sendEcho: true,
    });
    this.playTone({
      type: 'sine',
      freq: freq * 2,
      duration: duration * 0.55,
      gain: gain * 0.42,
      delaySeconds,
    });
  }

  private playSleighBell(gain: number): void {
    this.playNoise({
      duration: 0.055,
      gain,
      filterType: 'highpass',
      freq: 4800,
      q: 1.8,
    });
    this.playTone({
      type: 'sine',
      freq: 5200,
      freqEnd: 4600,
      duration: 0.04,
      gain: gain * 0.65,
    });
  }

  private playDrumKick(gain: number): void {
    this.playTone({
      type: 'sine',
      freq: 135,
      freqEnd: 42,
      duration: 0.09,
      gain,
    });
  }

  private playDrumSnare(gain: number): void {
    this.playNoise({
      duration: 0.07,
      gain,
      filterType: 'highpass',
      freq: 1400,
    });
    this.playTone({
      type: 'triangle',
      freq: 190,
      freqEnd: 95,
      duration: 0.045,
      gain: gain * 0.7,
    });
  }

  private playTone(opts: {
    type: OscillatorType;
    freq: number;
    freqMid?: number;
    freqEnd?: number;
    duration: number;
    gain: number;
    filterFreq?: number;
    delaySeconds?: number;
    sendEcho?: boolean;
  }): void {
    const ctx = this.ctx;
    const master = this.masterGain;
    if (!ctx || !master) return;

    const start = ctx.currentTime + (opts.delaySeconds ?? 0);
    const end = start + Math.max(0.01, opts.duration);

    const osc = ctx.createOscillator();
    osc.type = opts.type;
    osc.frequency.setValueAtTime(Math.max(16, opts.freq), start);
    if (typeof opts.freqMid === 'number') {
      osc.frequency.exponentialRampToValueAtTime(
        Math.max(16, opts.freqMid),
        start + opts.duration * 0.45
      );
    }
    if (typeof opts.freqEnd === 'number') {
      osc.frequency.exponentialRampToValueAtTime(
        Math.max(16, opts.freqEnd),
        end
      );
    }

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, start);
    env.gain.linearRampToValueAtTime(opts.gain, start + 0.006);
    env.gain.exponentialRampToValueAtTime(0.0001, end);

    if (typeof opts.filterFreq === 'number') {
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(opts.filterFreq, start);
      osc.connect(filter);
      filter.connect(env);
    } else {
      osc.connect(env);
    }

    env.connect(master);
    if (opts.sendEcho && this.delaySend) {
      env.connect(this.delaySend);
    }

    osc.start(start);
    osc.stop(end + 0.01);
  }

  private playNoise(opts: {
    duration: number;
    gain: number;
    filterType: BiquadFilterType;
    freq: number;
    freqEnd?: number;
    q?: number;
    delaySeconds?: number;
    sendEcho?: boolean;
  }): void {
    const ctx = this.ctx;
    const master = this.masterGain;
    const buffer = this.noiseBuffer;
    if (!ctx || !master || !buffer) return;

    const start = ctx.currentTime + (opts.delaySeconds ?? 0);
    const end = start + Math.max(0.01, opts.duration);

    const src = ctx.createBufferSource();
    src.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = opts.filterType;
    filter.frequency.setValueAtTime(Math.max(20, opts.freq), start);
    if (typeof opts.freqEnd === 'number') {
      filter.frequency.exponentialRampToValueAtTime(
        Math.max(20, opts.freqEnd),
        end
      );
    }
    if (typeof opts.q === 'number') {
      filter.Q.setValueAtTime(opts.q, start);
    }

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, start);
    env.gain.linearRampToValueAtTime(opts.gain, start + 0.005);
    env.gain.exponentialRampToValueAtTime(0.0001, end);

    src.connect(filter);
    filter.connect(env);
    env.connect(master);
    if (opts.sendEcho && this.delaySend) {
      env.connect(this.delaySend);
    }

    src.start(start, Math.random() * Math.max(0, 1.4 - opts.duration));
    src.stop(end + 0.01);
  }
}

export const soundManager = new SoundManager();

export function playSound(
  id: SoundEffectId,
  minIntervalSeconds?: number
): void {
  soundManager.play(id, minIntervalSeconds);
}

export function attachAudioUnlockListeners(target: Window): void {
  const unlock = () => {
    soundManager.unlock();
  };
  target.addEventListener('pointerdown', unlock, { passive: true });
  target.addEventListener('keydown', unlock, { passive: true });
  target.addEventListener('touchstart', unlock, { passive: true });
}

interface AudioObserverSnapshot {
  initialized: boolean;
  dialogueRef: GameState['activeDialogue'];
  dialogueIndex: number;
  footprintCount: number;
  lastFootprintRef: unknown;
  indoorStepTimer: number;
  prevJumpVelocity: number;
  dogMode: string;
  dogBarkTimer: number;
  catMode: string;
  catHealth: number;
  catSoundTimer: number;
  basementOpenedDoors: number;
  upstairsOpenedDoors: number;
  equippedItem: string;
  playerHealth: number;
  unlockedUzi: boolean;
  unlockedFlamethrower: boolean;
  unlockedKatana: boolean;
  unlockedBazooka: boolean;
  hasLadder: boolean;
  ladderPlaced: boolean;
  seenProjectiles: WeakSet<object>;
  snowballCount: number;
  uziReloadActive: boolean;
  katanaSwingActive: boolean;
  punchActive: boolean;
  rocketFlightTimer: number;
  explosionCount: number;
  mineState: string;
  mineBeepTimer: number;
  destroyingWallCount: number;
  destroyingDoorCount: number;
  emberTimer: number;
  rosannaPhase: string | null;
  electrocutionTimer: number;
  motorcycleStatus: string;
  motorcycleTimer: number;
  npcHealthMap: Map<string, { health: number; mode: string; alerting: boolean; reloading: boolean }>;
}

const snapshots = new WeakMap<GameState, AudioObserverSnapshot>();

function getOrCreateSnapshot(state: GameState): AudioObserverSnapshot {
  let snap = snapshots.get(state);
  if (!snap) {
    snap = {
      initialized: false,
      dialogueRef: state.activeDialogue,
      dialogueIndex: state.activeDialogue?.currentIndex ?? -1,
      footprintCount: state.footprints.length,
      lastFootprintRef: state.footprints[state.footprints.length - 1],
      indoorStepTimer: 0,
      prevJumpVelocity: state.player.jumpVelocity ?? 0,
      dogMode: state.dog.mode,
      dogBarkTimer: 0,
      catMode: state.levels['level-upstairs'].cat.mode,
      catHealth: state.levels['level-upstairs'].cat.health,
      catSoundTimer: 0,
      basementOpenedDoors: state.levels['level-basement'].openedDoors.length,
      upstairsOpenedDoors: state.levels['level-upstairs'].openedDoors.length,
      equippedItem: state.player.equippedItem,
      playerHealth: state.player.health,
      unlockedUzi: state.player.unlockedUzi,
      unlockedFlamethrower: state.player.unlockedFlamethrower,
      unlockedKatana: state.player.unlockedKatana,
      unlockedBazooka: state.player.unlockedBazooka,
      hasLadder: state.hasLadder,
      ladderPlaced: state.ladderPlaced,
      seenProjectiles: new WeakSet<object>(),
      snowballCount: state.snowballs.length,
      uziReloadActive: state.player.uziReloadTimer > 0,
      katanaSwingActive: state.player.katanaSwingTimer > 0,
      punchActive: state.player.punchTimer > 0,
      rocketFlightTimer: 0,
      explosionCount: state.explosions.length,
      mineState: state.levels['level-basement'].mineState,
      mineBeepTimer: 0,
      destroyingWallCount: state.destroyingWalls.length,
      destroyingDoorCount: state.destroyingDoors.length,
      emberTimer: 0,
      rosannaPhase: state.levels['level-upstairs'].rosannaCutscene?.phase ?? null,
      electrocutionTimer: 0,
      motorcycleStatus: state.motorcycle.status,
      motorcycleTimer: 0,
      npcHealthMap: new Map(),
    };
    for (const p of state.projectiles) {
      snap.seenProjectiles.add(p);
    }
    const allNpcs = [
      ...state.levels['level-basement'].getArmedNpcs(),
      ...state.levels['level-upstairs'].getArmedNpcs(),
    ];
    for (const { state: npc } of allNpcs) {
      snap.npcHealthMap.set(npc.key, {
        health: npc.health,
        mode: npc.mode,
        alerting: npc.hostileAlertTimer > 0,
        reloading: npc.reloadTimer > 0,
      });
    }
    snap.initialized = true;
    snapshots.set(state, snap);
  }
  return snap;
}

export function primeGameAudioSnapshot(state: GameState): void {
  getOrCreateSnapshot(state);
}

export function updateGameAudio(
  state: GameState,
  input: InputState,
  dtSeconds: number
): void {
  const snap = getOrCreateSnapshot(state);

  // 1. Adaptive N64 Chiptune Christmas Music Track Selection & Stepping
  const desiredTrack: MusicTrackId = state.houseExploding
    ? 'victory_xmas'
    : state.currentLevelId !== 'level-outside' ||
        state.player.unlockedUzi ||
        Boolean(state.player.states.get(RUDOLPH_INSPECTED_KEY))
      ? 'action_xmas'
      : 'peaceful_xmas';
  soundManager.setMusicTrack(desiredTrack);
  soundManager.stepMusic(dtSeconds);

  // 2. Dialogue open / advance / locked-door / item-specific sound cues
  if (state.activeDialogue !== snap.dialogueRef) {
    if (state.activeDialogue) {
      const firstLine = state.activeDialogue.lines[0] ?? '';
      if (state.activeDialogue.variant === 'achievement') {
        playSound('achievement', 0.01);
      } else if (state.activeDialogue.variant === 'gameover') {
        playSound('game_over', 0.01);
      } else {
        if (firstLine.toLowerCase().includes("it's locked")) {
          playSound('door_locked', 0.01);
        } else if (firstLine.includes('whiskey')) {
          playSound('pickup_whiskey', 0.01);
        } else if (firstLine.includes('body armor')) {
          playSound('pickup_armor', 0.01);
        } else if (firstLine.includes('pretends to work')) {
          playSound('computer_boot', 0.01);
        } else if (firstLine.startsWith('KABOOM!')) {
          playSound('c4_plant', 0.01);
        }
        playSound('dialogue_open', 0.01);
      }
      snap.dialogueIndex = state.activeDialogue.currentIndex;
    } else if (snap.dialogueRef) {
      playSound('dialogue_advance', 0.01);
      snap.dialogueIndex = -1;
    }
    snap.dialogueRef = state.activeDialogue;
  } else if (
    state.activeDialogue &&
    state.activeDialogue.currentIndex !== snap.dialogueIndex
  ) {
    playSound('dialogue_advance', 0.01);
    snap.dialogueIndex = state.activeDialogue.currentIndex;
  }

  // 3. Snow footprints & indoor footsteps & jump
  const lastFp = state.footprints[state.footprints.length - 1];
  if (
    state.footprints.length > snap.footprintCount ||
    (lastFp && lastFp !== snap.lastFootprintRef)
  ) {
    playSound('footstep_snow', 0.06);
  }
  snap.footprintCount = state.footprints.length;
  snap.lastFootprintRef = lastFp;

  if (
    state.currentLevelId !== 'level-outside' &&
    state.player.isMoving &&
    !state.activeDialogue
  ) {
    snap.indoorStepTimer += dtSeconds;
    if (snap.indoorStepTimer >= 0.24) {
      snap.indoorStepTimer = 0;
      playSound('footstep_indoor', 0.08);
    }
  } else {
    snap.indoorStepTimer = 0.18;
  }

  const jv = state.player.jumpVelocity ?? 0;
  if (jv > 0 && snap.prevJumpVelocity <= 0) {
    playSound('jump', 0.05);
  }
  snap.prevJumpVelocity = jv;

  // 4. Dog barking while chasing Santa
  if (
    state.currentLevelId === 'level-outside' &&
    state.dog.mode === 'chasing'
  ) {
    if (snap.dogMode !== 'chasing') {
      playSound('dog_bark', 0.05);
      snap.dogBarkTimer = 0;
    } else {
      snap.dogBarkTimer += dtSeconds;
      if (snap.dogBarkTimer >= 0.65) {
        snap.dogBarkTimer -= 0.65;
        playSound('dog_bark', 0.1);
      }
    }
  } else {
    snap.dogBarkTimer = 0;
  }
  snap.dogMode = state.dog.mode;

  // 5. Cat meowing & angry hiss/yowl
  const cat = state.levels['level-upstairs'].cat;
  if (state.currentLevelId === 'level-upstairs') {
    if (cat.mode !== snap.catMode) {
      if (cat.mode === 'hostile' || cat.mode === 'latched') {
        playSound('cat_angry', 0.02);
        playSound('cat_meow', 0.02);
      } else if (cat.mode === 'flee') {
        playSound('cat_meow', 0.02);
      } else if (cat.mode === 'dead') {
        playSound('npc_death', 0.02);
      }
      snap.catSoundTimer = 0;
    } else if (cat.health < snap.catHealth) {
      playSound('cat_angry', 0.05);
    } else if (
      cat.mode === 'flee' ||
      cat.mode === 'hostile' ||
      cat.mode === 'latched'
    ) {
      snap.catSoundTimer += dtSeconds;
      const interval = cat.mode === 'flee' ? 1.6 : 1.1;
      if (snap.catSoundTimer >= interval) {
        snap.catSoundTimer -= interval;
        playSound(cat.mode === 'flee' ? 'cat_meow' : 'cat_angry', 0.1);
      }
    }
  }
  snap.catMode = cat.mode;
  snap.catHealth = cat.health;

  // 6. Unlocked doors opening
  const baseOpened = state.levels['level-basement'].openedDoors.length;
  const upOpened = state.levels['level-upstairs'].openedDoors.length;
  if (
    baseOpened > snap.basementOpenedDoors ||
    upOpened > snap.upstairsOpenedDoors
  ) {
    playSound('door_open', 0.02);
  }
  snap.basementOpenedDoors = baseOpened;
  snap.upstairsOpenedDoors = upOpened;

  // 7. Equipment switching, item pickups, player hurt
  if (state.player.equippedItem !== snap.equippedItem) {
    playSound('weapon_switch', 0.01);
    snap.equippedItem = state.player.equippedItem;
  }

  if (state.player.health < snap.playerHealth) {
    playSound('player_hurt', 0.02);
  } else if (state.player.health > snap.playerHealth) {
    playSound('pickup_item', 0.02);
  }
  snap.playerHealth = state.player.health;

  if (
    (state.player.unlockedUzi && !snap.unlockedUzi) ||
    (state.player.unlockedFlamethrower && !snap.unlockedFlamethrower) ||
    (state.player.unlockedKatana && !snap.unlockedKatana) ||
    (state.player.unlockedBazooka && !snap.unlockedBazooka) ||
    (state.hasLadder && !snap.hasLadder) ||
    (state.ladderPlaced && !snap.ladderPlaced)
  ) {
    playSound('pickup_item', 0.02);
  }
  snap.unlockedUzi = state.player.unlockedUzi;
  snap.unlockedFlamethrower = state.player.unlockedFlamethrower;
  snap.unlockedKatana = state.player.unlockedKatana;
  snap.unlockedBazooka = state.player.unlockedBazooka;
  snap.hasLadder = state.hasLadder;
  snap.ladderPlaced = state.ladderPlaced;

  // 8. Projectiles fired (Uzi, Flamethrower, Bazooka, Snowballs) & Rocket in-flight thruster
  let hasRocketInFlight = false;
  let hasFireballInFlight = false;
  for (const p of state.projectiles) {
    if (p.kind === 'rocket') hasRocketInFlight = true;
    if (p.kind === 'fireball') hasFireballInFlight = true;
    if (!snap.seenProjectiles.has(p)) {
      snap.seenProjectiles.add(p);
      if (p.kind === 'rocket') {
        playSound('bazooka_fire', 0.02);
      } else if (p.kind === 'fireball') {
        playSound('flamethrower_fire', 0.03);
      } else {
        playSound('uzi_fire', 0.025);
      }
    }
  }

  if (state.snowballs.length > snap.snowballCount) {
    playSound('snowball_throw', 0.05);
  }
  snap.snowballCount = state.snowballs.length;

  if (hasRocketInFlight) {
    snap.rocketFlightTimer += dtSeconds;
    if (snap.rocketFlightTimer >= 0.11) {
      snap.rocketFlightTimer -= 0.11;
      playSound('rocket_flight', 0.05);
    }
  } else {
    snap.rocketFlightTimer = 0.11;
  }

  // 9. Reloading, Katana swoosh, Unarmed punch, and Empty Flamethrower trigger click
  const uziReloadNow = state.player.uziReloadTimer > 0;
  if (uziReloadNow && !snap.uziReloadActive) {
    playSound('uzi_reload', 0.02);
  }
  snap.uziReloadActive = uziReloadNow;

  const katanaSwingNow = state.player.katanaSwingTimer > 0;
  if (katanaSwingNow && !snap.katanaSwingActive) {
    playSound('katana_swing', 0.02);
  }
  snap.katanaSwingActive = katanaSwingNow;

  const punchNow = state.player.punchTimer > 0;
  if (punchNow && !snap.punchActive) {
    playSound('punch_swing', 0.02);
  }
  snap.punchActive = punchNow;

  if (
    state.player.equippedItem === 'flamethrower' &&
    state.player.flamethrowerAmmo <= 0 &&
    !state.activeDialogue &&
    (input.action || input.attack)
  ) {
    playSound('no_ammo', 0.22);
  }

  // 10. Explosions (Mine, Bazooka, C4), Mine countdown beep, & Wall/Door destruction
  const basement = state.levels['level-basement'];
  if (
    state.explosions.length > snap.explosionCount ||
    (basement.mineState === 'exploded' && snap.mineState !== 'exploded')
  ) {
    playSound('explosion', 0.02);
  }
  snap.explosionCount = state.explosions.length;

  if (
    state.currentLevelId === 'level-basement' &&
    basement.mineState === 'blinking'
  ) {
    snap.mineBeepTimer += dtSeconds;
    if (snap.mineBeepTimer >= 0.25) {
      snap.mineBeepTimer -= 0.25;
      playSound('mine_beep', 0.08);
    }
  } else {
    snap.mineBeepTimer = 0.25;
  }
  snap.mineState = basement.mineState;

  if (
    state.destroyingWalls.length > snap.destroyingWallCount ||
    state.destroyingDoors.length > snap.destroyingDoorCount
  ) {
    playSound('wall_crumble', 0.04);
  }
  snap.destroyingWallCount = state.destroyingWalls.length;
  snap.destroyingDoorCount = state.destroyingDoors.length;

  // 11. Fire & Embers sound when wood tiles, NPCs, or fireballs are burning
  const woodBurning =
    state.currentLevelId === 'level-basement' &&
    basement.stairsWoodTiles.some((t) => t.burning && !t.burned);
  const anyOnFire =
    woodBurning || state.burningNpcs.size > 0 || hasFireballInFlight;
  if (anyOnFire) {
    snap.emberTimer += dtSeconds;
    if (snap.emberTimer >= 0.18) {
      snap.emberTimer -= 0.18;
      playSound('fire_ember', 0.08);
    }
  } else {
    snap.emberTimer = 0.18;
  }

  // 12. Rosanna jumping through the kitchen window ("window breaking" sound)
  const upstairs = state.levels['level-upstairs'];
  const rosannaPhase = upstairs.rosannaCutscene?.phase ?? null;
  if (rosannaPhase === 'jumping' && snap.rosannaPhase !== 'jumping') {
    playSound('window_break', 0.01);
  }
  snap.rosannaPhase = rosannaPhase;

  // 13. NPC alert ("!"), NPC reload, NPC katana swing, NPC hit & death
  const activeNpcs =
    state.currentLevelId === 'level-basement'
      ? basement.getArmedNpcs()
      : state.currentLevelId === 'level-upstairs'
        ? upstairs.getArmedNpcs()
        : [];
  for (const { state: npc } of activeNpcs) {
    const prev = snap.npcHealthMap.get(npc.key);
    const isAlerting = npc.hostileAlertTimer > 0;
    const isReloading = npc.reloadTimer > 0;
    if (prev) {
      if (isAlerting && !prev.alerting) {
        playSound('npc_alert', 0.04);
      }
      if (isReloading && !prev.reloading) {
        playSound('uzi_reload', 0.04);
      }
      if (npc.health < prev.health) {
        if (npc.health <= 0 || npc.mode === 'dead') {
          playSound('npc_death', 0.02);
        } else {
          playSound('npc_hit', 0.03);
        }
      }
    }
    snap.npcHealthMap.set(npc.key, {
      health: npc.health,
      mode: npc.mode,
      alerting: isAlerting,
      reloading: isReloading,
    });
  }

  // 14. Electrocution & Motorcycle engine/crash
  if (state.electrocutionTimer > 0) {
    snap.electrocutionTimer += dtSeconds;
    if (snap.electrocutionTimer >= 0.12) {
      snap.electrocutionTimer -= 0.12;
      playSound('electrocution', 0.05);
    }
  } else {
    snap.electrocutionTimer = 0.12;
  }

  if (state.motorcycle.status === 'driving') {
    snap.motorcycleTimer += dtSeconds;
    if (snap.motorcycleTimer >= 0.11) {
      snap.motorcycleTimer -= 0.11;
      playSound('motorcycle_engine', 0.05);
    }
  } else if (
    state.motorcycle.status === 'crashed' &&
    snap.motorcycleStatus === 'driving'
  ) {
    playSound('motorcycle_crash', 0.02);
  }
  snap.motorcycleStatus = state.motorcycle.status;
}
