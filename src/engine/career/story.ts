/**
 * The career's story: reputation, the people who notice you, and the
 * milestones that open doors (wildcards, invitations, cards, Q-School places).
 * Rules are data, evaluated after every change; each fires once.
 */

export interface Message {
  id: string;
  season: number;
  week: number;
  from: Sender;
  subject: string;
  body: string;
  read: boolean;
  /** An offer to accept or decline: a place in an event. */
  offer?: { eventId: string; state: 'open' | 'accepted' | 'declined' };
  /** A choice to make (e.g. a nickname). */
  choice?: { kind: 'nickname'; options: string[]; picked: string | null };
}

/** Nicknames the press might give you (none clash with the roster's). */
export const YOUR_NICKNAMES = [
  'The Natural',
  'Hotshot',
  'The Sniper',
  'Iceman',
  'The Machine',
  'Doublestar',
  'The Kid',
  'Silk',
  'The Surgeon',
  'Wildcard',
];

/** Kit you can buy with your winnings: shirts (index into the shirt palette) and patterns. */
export const KIT_PRICES = { shirt: 150, pattern: 400 } as const;
export const KIT_PATTERNS = ['panels', 'band', 'chevron', 'flames', 'split', 'pinstripe'] as const;
export type KitPattern = (typeof KIT_PATTERNS)[number];
export interface Kit {
  shirt: number | null;
  pattern: KitPattern | null;
  /** Items bought: "shirt:3", "pattern:flames". */
  owned: string[];
}
export const emptyKit = (): Kit => ({ shirt: null, pattern: null, owned: [] });

export type Sender = 'landlord' | 'secretary' | 'reporter' | 'challenge' | 'tour' | 'coach';

export const SENDERS: Record<Sender, { name: string; role: string }> = {
  landlord: { name: 'Bev Hartley', role: 'Landlady, the Red Lion' },
  secretary: { name: 'Dave Corrigan', role: 'Secretary, Northfield County Darts' },
  reporter: { name: 'Gazette Darts Desk', role: 'Northfield Gazette' },
  challenge: { name: 'Challenge Tour Office', role: 'Tournament administration' },
  tour: { name: 'Pro Tour Media', role: 'Press office' },
  coach: { name: 'Mo Feeney', role: 'County coach' },
};

/** Reputation bands, from nobody to legend. */
export const REP_BANDS: [number, string][] = [
  [0, 'Unknown'],
  [40, 'Known locally'],
  [120, 'Pub legend'],
  [250, 'County name'],
  [500, 'Rising star'],
  [900, 'Tour regular'],
  [1500, 'Star'],
  [2500, 'Legend'],
];

export function repBand(rep: number): { name: string; floor: number; next: number | null } {
  let i = 0;
  while (i + 1 < REP_BANDS.length && rep >= REP_BANDS[i + 1]![0]) i++;
  return { name: REP_BANDS[i]![1], floor: REP_BANDS[i]![0], next: REP_BANDS[i + 1]?.[0] ?? null };
}

/** Reputation for a match. */
export function matchRep(o: {
  won: boolean;
  stage: number;
  upset: boolean;
  average: number;
  oneEighties: number;
  bestCheckout: number;
}): number {
  let rep = o.won ? 2 * (o.stage + 1) : 0;
  if (o.won && o.upset) rep += 5;
  rep += o.oneEighties * 3;
  if (o.bestCheckout >= 100) rep += 5;
  if (o.average >= 90) rep += 6;
  else if (o.average >= 70) rep += 3;
  return rep;
}

/** Reputation for how far you got in an event (fromEnd: 0 winner, 1 runner-up, 2 SF...). */
export function eventRep(fromEnd: number, stage: number, major: boolean): number {
  const base = [15, 8, 4, 1][fromEnd] ?? 0;
  return Math.round(base * (stage + 1) * (major ? 2 : 1));
}
