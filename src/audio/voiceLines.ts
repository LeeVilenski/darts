/**
 * Every line the caller can say, keyed by the file name a voice pack uses.
 * Self-contained (no imports) so scripts/build-voice-pack.ts can import it with Node.
 *
 * Keys:
 *   score_0 … score_180   turn totals ("one hundred and eighty!")
 *   num_2 … num_170       numbers used after "you require"
 *   you_require, no_score, game_shot, game_shot_match, bust
 */

const ONES = [
  'zero',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
  'thirteen',
  'fourteen',
  'fifteen',
  'sixteen',
  'seventeen',
  'eighteen',
  'nineteen',
];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

/** British-style number words for 0–999: 140 -> "one hundred and forty". */
export function numberWords(n: number): string {
  if (n < 20) return ONES[n]!;
  if (n < 100) return TENS[Math.floor(n / 10)]! + (n % 10 ? `-${ONES[n % 10]}` : '');
  const rest = n % 100;
  return `${ONES[Math.floor(n / 100)]} hundred${rest ? ` and ${numberWords(rest)}` : ''}`;
}

export function voiceLines(): Record<string, string> {
  const lines: Record<string, string> = {
    you_require: 'You require',
    no_score: 'No score!',
    bust: 'Bust!',
    game_shot: 'Game shot!',
    game_shot_match: 'Game shot, and the match!',
  };
  for (let n = 1; n <= 180; n++) lines[`score_${n}`] = numberWords(n);
  lines.score_0 = 'No score!';
  lines.score_180 = 'One hundred and eighty!';
  for (let n = 2; n <= 170; n++) lines[`num_${n}`] = numberWords(n);
  return lines;
}
