/**
 * Small Web Audio engine. Every effect is synthesised (no audio files), which
 * keeps downloads at zero and lets pitch/volume vary per hit. The context is
 * created lazily and resumed on the first user gesture (mobile autoplay rules).
 */

let ctx: AudioContext | null = null;
let master: GainNode;
let sfxBus: GainNode;
let ambienceBus: GainNode;
let voiceBus: GainNode;
let noiseBuffer: AudioBuffer;
let ambienceSource: AudioBufferSourceNode | null = null;

const state = { sound: true, ambience: true };

function init(): AudioContext | null {
  if (ctx) return ctx;
  const AC =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = state.sound ? 0.9 : 0;
  master.connect(ctx.destination);
  sfxBus = bus(1);
  ambienceBus = bus(0.18);
  voiceBus = bus(1);
  // Two seconds of white noise, reused by every noisy effect.
  noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return ctx;
}

function bus(gain: number): GainNode {
  const g = ctx!.createGain();
  g.gain.value = gain;
  g.connect(master);
  return g;
}

/** Call from a user gesture: creates/resumes the context and starts ambience. */
export function unlockAudio() {
  const c = init();
  if (!c) return;
  if (c.state === 'suspended') void c.resume();
  syncAmbience();
}

export function setSoundEnabled(on: boolean) {
  state.sound = on;
  if (ctx) master.gain.setTargetAtTime(on ? 0.9 : 0, ctx.currentTime, 0.05);
  syncAmbience();
}

export function setAmbienceEnabled(on: boolean) {
  state.ambience = on;
  syncAmbience();
}

export const audioContext = () => ctx;
export const voiceOutput = () => (ctx ? voiceBus : null);
export const soundEnabled = () => state.sound;

function ready(): AudioContext | null {
  return ctx && state.sound && ctx.state === 'running' ? ctx : null;
}

function noise(c: AudioContext, start: number, duration: number): AudioBufferSourceNode {
  const src = c.createBufferSource();
  src.buffer = noiseBuffer;
  src.start(start, Math.random() * 1.5, duration);
  return src;
}

function envelope(
  c: AudioContext,
  start: number,
  peak: number,
  attack: number,
  decay: number,
): GainNode {
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(peak, start + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, start + attack + decay);
  return g;
}

const jitter = (v: number, pct = 0.08) => v * (1 + (Math.random() * 2 - 1) * pct);

/** Air rush as the dart leaves the hand. */
export function playWhoosh(power = 1) {
  const c = ready();
  if (!c) return;
  const t = c.currentTime;
  const src = noise(c, t, 0.35);
  const bp = c.createBiquadFilter();
  bp.type = 'bandpass';
  bp.Q.value = 1.2;
  bp.frequency.setValueAtTime(jitter(500), t);
  bp.frequency.exponentialRampToValueAtTime(jitter(2200 * Math.min(1.4, power)), t + 0.25);
  src
    .connect(bp)
    .connect(envelope(c, t, 0.22, 0.06, 0.26))
    .connect(sfxBus);
}

export type ImpactSurface = 'board' | 'wire' | 'surround' | 'floor';

/** Dart hitting something: a thump, with a metallic ring for wire contact. */
export function playImpact(surface: ImpactSurface) {
  const c = ready();
  if (!c) return;
  const t = c.currentTime;
  const body = { board: 140, wire: 160, surround: 90, floor: 220 }[surface];
  const osc = c.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(jitter(body * 1.6), t);
  osc.frequency.exponentialRampToValueAtTime(jitter(body), t + 0.05);
  osc
    .connect(
      envelope(
        c,
        t,
        surface === 'floor' ? 0.25 : 0.55,
        0.003,
        surface === 'surround' ? 0.08 : 0.12,
      ),
    )
    .connect(sfxBus);
  osc.start(t);
  osc.stop(t + 0.2);

  // Sisal "thock": short filtered click.
  const click = noise(c, t, 0.05);
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = surface === 'floor' ? 900 : 2400;
  click
    .connect(lp)
    .connect(envelope(c, t, 0.35, 0.001, 0.04))
    .connect(sfxBus);

  if (surface === 'wire') {
    for (const f of [3150, 4720, 6210]) {
      const ping = c.createOscillator();
      ping.type = 'triangle';
      ping.frequency.value = jitter(f, 0.03);
      ping.connect(envelope(c, t, 0.06, 0.002, 0.35)).connect(sfxBus);
      ping.start(t);
      ping.stop(t + 0.4);
    }
  }
}

/** A bounce-out: wire clink, then the dart clattering on the floor. */
export function playBounceOut() {
  playImpact('wire');
  const c = ready();
  if (!c) return;
  window.setTimeout(() => playImpact('floor'), 520);
  window.setTimeout(() => playImpact('floor'), 640);
}

/** Crowd reaction; intensity 0–1 (180s and big checkouts are 1). */
export function playCheer(intensity = 1) {
  const c = ready();
  if (!c) return;
  const t = c.currentTime;
  const dur = 1.2 + intensity * 1.3;
  for (const f of [700, 1300, 2400]) {
    const src = noise(c, t, dur + 0.2);
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = jitter(f, 0.2);
    bp.Q.value = 0.8;
    // Slow random tremolo makes noise read as many voices.
    const trem = c.createGain();
    const lfo = c.createOscillator();
    const lfoGain = c.createGain();
    lfo.frequency.value = 5 + Math.random() * 4;
    lfoGain.gain.value = 0.3;
    lfo.connect(lfoGain).connect(trem.gain);
    lfo.start(t);
    lfo.stop(t + dur + 0.2);
    src
      .connect(bp)
      .connect(trem)
      .connect(envelope(c, t, 0.12 * (0.4 + intensity), 0.35, dur))
      .connect(sfxBus);
  }
}

/** Low pub murmur loop under everything. */
function syncAmbience() {
  if (!ctx) return;
  const want = state.sound && state.ambience;
  if (want && !ambienceSource) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    src.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 420;
    const bp = ctx.createBiquadFilter();
    bp.type = 'peaking';
    bp.frequency.value = 300;
    bp.gain.value = 6;
    src.connect(lp).connect(bp).connect(ambienceBus);
    src.start();
    ambienceSource = src;
  } else if (!want && ambienceSource) {
    ambienceSource.stop();
    ambienceSource.disconnect();
    ambienceSource = null;
  }
}
