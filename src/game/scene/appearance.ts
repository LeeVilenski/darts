/**
 * How a player looks at the oche: shirt, hair, skin, build and so on. Like
 * their playing personality, it's derived from their name, so the same
 * opponent always looks the same (career regulars keep their look all season).
 */

export type HairStyle =
  'short' | 'buzz' | 'quiff' | 'curly' | 'long' | 'ponytail' | 'balding' | 'bald';
export type FacialHair = 'none' | 'stubble' | 'beard' | 'moustache' | 'goatee';
export type ShirtPattern = 'panels' | 'band' | 'chevron' | 'flames' | 'split' | 'pinstripe';

export interface Appearance {
  skin: string;
  hair: string;
  hairStyle: HairStyle;
  facialHair: FacialHair;
  glasses: boolean;
  shirt: string;
  /** Contrast colour for panels, collar and pattern. */
  trim: string;
  pattern: ShirtPattern;
  trousers: string;
  shoes: string;
  /** Overall height and width multipliers (around 1). */
  height: number;
  girth: number;
  /** Extra round at the middle (0 = none). */
  belly: number;
  /** Printed across the back of the shirt, darts-style: nickname if they have one, else surname. */
  backName: string;
}

export const SKIN_TONES = ['#f1c6a8', '#e0ac8a', '#c98e6a', '#a86f4e', '#8a5537', '#5f3a24'];
export const HAIR_COLOURS = [
  '#1b1410',
  '#3a2518',
  '#5a3a22',
  '#8a5a32',
  '#b98b4e',
  '#d9c08a',
  '#8c8c8c',
  '#a33d1e',
];
/** Loud, saturated darts-shirt colours, each with a trim that stands out on it. */
export const SHIRTS: [shirt: string, trim: string][] = [
  ['#1f4fb8', '#f2c230'],
  ['#c2261d', '#111111'],
  ['#1d8a4a', '#f4f4f4'],
  ['#6a2fa3', '#3fd0c9'],
  ['#111111', '#e94b1b'],
  ['#f2c230', '#1b1b1b'],
  ['#0f8fa8', '#ffffff'],
  ['#e7457d', '#1a1a1a'],
  ['#f4f4f4', '#1f4fb8'],
  ['#2b2f6b', '#e33a2f'],
  ['#ff7a1a', '#14213d'],
  ['#4a7a1e', '#f2e14b'],
];
const TROUSERS = ['#16171d', '#1c1d24', '#23262f', '#2a2a2a', '#1d2433'];
const SHOES = ['#0d0d0f', '#1a120c', '#f2f2f2'];
const HAIR_STYLES: HairStyle[] = [
  'short',
  'short',
  'buzz',
  'quiff',
  'curly',
  'long',
  'ponytail',
  'balding',
  'bald',
];
const FACIAL_HAIR: FacialHair[] = [
  'none',
  'none',
  'none',
  'stubble',
  'beard',
  'moustache',
  'goatee',
];
const PATTERNS: ShirtPattern[] = ['panels', 'band', 'chevron', 'flames', 'split', 'pinstripe'];

/** FNV-1a string hash, then a few rounds of mixing to spread the bits. */
function seedOf(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
function picker(seed: number) {
  let x = seed || 1;
  const next = () => {
    // xorshift32
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return (x >>> 0) / 0x100000000;
  };
  return {
    next,
    pick: <T>(xs: readonly T[]): T => xs[Math.floor(next() * xs.length)]!,
    range: (lo: number, hi: number) => lo + next() * (hi - lo),
  };
}

/** `Gus "The Hammer" Marlow` → `THE HAMMER`; `Lena Varley` → `VARLEY`; `Player 1` → `PLAYER 1`. */
export function backNameFor(name: string): string {
  const nick = /"([^"]+)"/.exec(name)?.[1];
  if (nick) return nick.toUpperCase();
  const words = name.trim().split(/\s+/);
  const last = words[words.length - 1] ?? '';
  // "Player 2", "Club Bot": keep both words so it reads sensibly.
  const pick = /^\d+$/.test(last) || /^bot$/i.test(last) ? words.slice(-2).join(' ') : last;
  return pick.toUpperCase().slice(0, 14);
}

export function appearanceFor(name: string): Appearance {
  const r = picker(seedOf(`look:${name.trim().toLowerCase()}`));
  const [shirt, trim] = r.pick(SHIRTS);
  const hairStyle = r.pick(HAIR_STYLES);
  const greying = r.next() < 0.18;
  const girth = r.range(0.92, 1.22);
  return {
    skin: r.pick(SKIN_TONES),
    hair: greying ? r.pick(['#8c8c8c', '#b5b5b5']) : r.pick(HAIR_COLOURS),
    hairStyle,
    facialHair: r.pick(FACIAL_HAIR),
    glasses: r.next() < 0.22,
    shirt,
    trim,
    pattern: r.pick(PATTERNS),
    trousers: r.pick(TROUSERS),
    shoes: r.pick(SHOES),
    height: r.range(0.95, 1.05),
    girth,
    belly: girth > 1.1 ? r.range(0.01, 0.045) : r.range(0, 0.012),
    backName: backNameFor(name),
  };
}
