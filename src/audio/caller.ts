import { audioContext, soundEnabled, voiceOutput } from './engine';
import { voiceLines } from './voiceLines';

/**
 * The match caller. Plays lines from a voice pack (public/voice/<pack>/manifest.json)
 * when one is installed; otherwise falls back to the browser's speech synthesis.
 * Lines are queued so calls never talk over each other.
 */

export interface VoicePackManifest {
  name: string;
  /** Line key -> file path relative to the manifest. */
  lines: Record<string, string>;
}

const PACK_URL = '/voice/default/manifest.json';
const TEXT = voiceLines();

let enabled = true;
let manifest: VoicePackManifest | null | undefined; // undefined = not loaded yet
const buffers = new Map<string, Promise<AudioBuffer | null>>();
let queue: Promise<void> = Promise.resolve();

export function setCallerEnabled(on: boolean) {
  enabled = on;
  if (!on) window.speechSynthesis?.cancel();
}

async function loadManifest(): Promise<VoicePackManifest | null> {
  if (manifest !== undefined) return manifest;
  try {
    const res = await fetch(PACK_URL);
    manifest = res.ok ? ((await res.json()) as VoicePackManifest) : null;
  } catch {
    manifest = null;
  }
  return manifest;
}

/** Which voice the caller is using right now. */
export async function callerSource(): Promise<'pack' | 'browser' | 'none'> {
  if (await loadManifest()) return 'pack';
  return 'speechSynthesis' in window ? 'browser' : 'none';
}

function loadLine(key: string): Promise<AudioBuffer | null> {
  const cached = buffers.get(key);
  if (cached) return cached;
  const p = (async () => {
    const m = await loadManifest();
    const ctx = audioContext();
    const file = m?.lines[key];
    if (!m || !ctx || !file) return null;
    try {
      const res = await fetch(new URL(file, new URL(PACK_URL, window.location.href)));
      return await ctx.decodeAudioData(await res.arrayBuffer());
    } catch {
      return null;
    }
  })();
  buffers.set(key, p);
  return p;
}

function playBuffer(buf: AudioBuffer): Promise<void> {
  const ctx = audioContext();
  const out = voiceOutput();
  if (!ctx || !out) return Promise.resolve();
  return new Promise((resolve) => {
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(out);
    src.onended = () => resolve();
    src.start();
  });
}

function speak(text: string): Promise<void> {
  const synth = window.speechSynthesis;
  if (!synth) return Promise.resolve();
  return new Promise((resolve) => {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-GB';
    u.rate = 0.95;
    u.pitch = 0.9;
    u.onend = () => resolve();
    u.onerror = () => resolve();
    synth.speak(u);
    window.setTimeout(resolve, 4000); // never block the queue on a stuck engine
  });
}

/** Say a sequence of line keys, e.g. ["you_require", "num_40"]. */
export function call(keys: string[]) {
  if (!enabled || !soundEnabled() || !keys.length) return;
  queue = queue.then(async () => {
    if (await loadManifest()) {
      const bufs = await Promise.all(keys.map(loadLine));
      for (const b of bufs) if (b) await playBuffer(b);
    } else {
      await speak(keys.map((k) => TEXT[k] ?? '').join(' '));
    }
  });
}

/** Warm the cache for lines likely to be needed soon. */
export function preloadLines(keys: string[]) {
  void loadManifest().then((m) => m && keys.forEach((k) => void loadLine(k)));
}
