/**
 * Each AI opponent has a fixed character, derived from its name so the same
 * bot always behaves the same way: how its nerves hold up, how quickly it
 * throws, and which double it likes to leave itself.
 */
export type Temperament = 'ice' | 'steady' | 'nervy';
export type Tempo = 'quick' | 'measured' | 'deliberate';

export interface AiPersonality {
  temperament: Temperament;
  tempo: Tempo;
  /** Favourite finishing double (the number, e.g. 16 for D16). */
  favouriteDouble: number;
}

export const TEMPERAMENT: Record<Temperament, { label: string; nerve: number }> = {
  ice: { label: 'Ice-cold', nerve: 0.5 },
  steady: { label: 'Steady', nerve: 1 },
  nervy: { label: 'Nervy', nerve: 1.6 },
};

export const TEMPO: Record<Tempo, { label: string; think: number }> = {
  quick: { label: 'Quick', think: 0.65 },
  measured: { label: 'Measured', think: 1 },
  deliberate: { label: 'Deliberate', think: 1.5 },
};

const TEMPERAMENTS: Temperament[] = ['ice', 'steady', 'steady', 'nervy'];
const TEMPOS: Tempo[] = ['quick', 'measured', 'measured', 'deliberate'];
const FAVOURITE_DOUBLES = [20, 16, 16, 8, 18, 10, 12, 4];

export const NEUTRAL_PERSONALITY: AiPersonality = {
  temperament: 'steady',
  tempo: 'measured',
  favouriteDouble: 20,
};

/** FNV-1a: a small, stable string hash. */
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function personalityFor(name: string): AiPersonality {
  const h = hash(name.trim().toLowerCase());
  return {
    temperament: TEMPERAMENTS[h % TEMPERAMENTS.length]!,
    tempo: TEMPOS[(h >>> 8) % TEMPOS.length]!,
    favouriteDouble: FAVOURITE_DOUBLES[(h >>> 16) % FAVOURITE_DOUBLES.length]!,
  };
}

/** e.g. "Nervy · Quick · loves D16" */
export function describePersonality(p: AiPersonality): string {
  return `${TEMPERAMENT[p.temperament].label} · ${TEMPO[p.tempo].label} · loves D${p.favouriteDouble}`;
}
