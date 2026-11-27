import { marksPerRound } from '../engine/modes/cricket';
import type { MatchState } from '../engine/modes/match';
import { playsSets } from '../engine/modes/types';
import { threeDartAverage } from '../engine/modes/x01';
import { describeReached, nextMatch } from '../engine/career/career';
import { useCareer } from '../store/useCareer';
import { GainStrip } from './career/Attributes';
import { unread } from '../engine/career/milestones';
import { useGameStore } from '../store/useGameStore';

type Row = [string, (i: number) => string | number];

function statRows(m: MatchState): Row[] {
  switch (m.mode) {
    case 'x01':
      return [
        ['3-dart avg', (i) => threeDartAverage(m.players[i]!.stats).toFixed(1)],
        ['Darts', (i) => m.players[i]!.stats.darts],
        ['180s', (i) => m.players[i]!.stats.oneEighties],
        ['140+', (i) => m.players[i]!.stats.ton40s],
        ['100+', (i) => m.players[i]!.stats.tons],
        ['Best checkout', (i) => m.players[i]!.stats.bestCheckout || '–'],
      ];
    case 'cricket':
      return [
        ['Points', (i) => m.players[i]!.points],
        ['Marks per round', (i) => marksPerRound(m.players[i]!).toFixed(2)],
        ['Marks', (i) => m.players[i]!.stats.marks],
        ['Darts', (i) => m.players[i]!.stats.darts],
      ];
    case 'atc':
      return [
        ['Darts', (i) => m.players[i]!.stats.darts],
        [
          'Hit rate',
          (i) => {
            const s = m.players[i]!.stats;
            return `${s.darts ? Math.round((s.hits / s.darts) * 100) : 0}%`;
          },
        ],
      ];
    case 'shanghai':
      return [
        ['Score', (i) => m.players[i]!.score],
        ['Hits', (i) => m.players[i]!.stats.hits],
        ['Shanghais', (i) => m.players[i]!.stats.shanghais],
      ];
    case 'bobs27':
      return [
        [
          'Score',
          (i) => (m.players[i]!.out ? `Out (${m.players[i]!.score})` : m.players[i]!.score),
        ],
        ['Doubles hit', (i) => m.players[i]!.stats.hits],
        [
          'Hit rate',
          (i) => {
            const s = m.players[i]!.stats;
            return `${s.darts ? Math.round((s.hits / s.darts) * 100) : 0}%`;
          },
        ],
      ];
    case 'halveit':
      return [
        ['Score', (i) => m.players[i]!.score],
        ['Hits', (i) => m.players[i]!.stats.hits],
        ['Halved', (i) => m.players[i]!.stats.halved],
      ];
    case 'killer':
      return [
        ['Number', (i) => m.players[i]!.number],
        ['Lives left', (i) => m.players[i]!.lives],
        ['Knock-outs', (i) => m.players[i]!.stats.kills],
      ];
    case 'ladder':
      return [
        ['Highest checkout', (i) => m.players[i]!.best || '–'],
        ['Checkouts', (i) => `${m.players[i]!.checkouts}/${m.options.attempts}`],
        ['Darts', (i) => m.players[i]!.stats.darts],
      ];
  }
}

function headline(m: MatchState): string {
  const winner = m.players[m.winner ?? 0]!;
  if (m.players.length > 1)
    return m.mode === 'shanghai' && m.turn.shanghai
      ? `Shanghai! ${winner.name} wins`
      : `${winner.name} wins!`;
  switch (m.mode) {
    case 'x01':
      return `Checked out in ${winner.stats.darts} darts!`;
    case 'cricket':
      return `Board closed in ${winner.stats.darts} darts!`;
    case 'atc':
      return `Round the clock in ${winner.stats.darts} darts!`;
    case 'shanghai':
      return m.turn.shanghai ? 'Shanghai!' : `${m.players[0]!.score} points`;
    case 'bobs27': {
      const p = m.players[0]!;
      return p.out ? `Out on round ${m.round}` : `Bob's 27 finished on ${p.score}!`;
    }
    case 'halveit':
      return `${m.players[0]!.score} points`;
    case 'killer':
      return `${winner.name} wins!`;
    case 'ladder': {
      const p = m.players[0]!;
      return p.best ? `Highest checkout ${p.best}` : 'No checkouts this time';
    }
  }
}

export function MatchOver({ match }: { match: MatchState }) {
  const setup = useGameStore((s) => s.setup);
  const startGame = useGameStore((s) => s.startGame);
  const quit = useGameStore((s) => s.quitToMenu);
  const solo = match.players.length === 1;
  const training = setup.kind !== 'practice' && !!setup.training;
  const career = setup.kind !== 'practice' && (!!setup.career || training);
  const gain = useCareer((s) => (career ? (s.career?.lastGain ?? null) : null));
  const openCareer = useCareer((s) => s.setOpen);
  const newMail = useCareer((s) => (career && s.career ? unread(s.career) : 0));
  const careerNote = useCareer((s) => {
    if (!career || !s.career) return null;
    if (training) return 'Training session done.';
    const next = nextMatch(s.career);
    if (next) return `Next: ${next.roundName.toLowerCase()} against ${next.opponent.name}`;
    const last = s.career.results.at(-1);
    if (!last) return null;
    const reached = describeReached(last);
    return `${last.name}: ${reached === 'Winner' ? 'champion!' : reached.toLowerCase()} (${
      last.points ? `+${last.points} pts, ` : ''
    }£${last.prize.toLocaleString('en-GB')})`;
  });
  const rows = statRows(match);
  if (playsSets(match.options)) rows.unshift(['Sets', (i) => match.players[i]!.setsWon]);
  else if (match.options.legsToWin > 1) rows.unshift(['Legs', (i) => match.players[i]!.legsWon]);

  return (
    <div className="sheet-backdrop" onPointerDown={(e) => e.stopPropagation()}>
      <div className="sheet" role="dialog" aria-label="Match over" data-testid="match-over">
        <h2>{headline(match)}</h2>
        <table className="stats">
          {!solo && (
            <thead>
              <tr>
                <th />
                {match.players.map((p, i) => (
                  <th key={i}>{p.name}</th>
                ))}
              </tr>
            </thead>
          )}
          <tbody>
            {rows.map(([label, get]) => (
              <tr key={label}>
                <th scope="row">{label}</th>
                {match.players.map((_, i) => (
                  <td key={i}>{get(i)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {career ? (
          <>
            {gain && <GainStrip g={gain} />}
            {careerNote && <p className="career-last">{careerNote}</p>}
            {newMail > 0 && (
              <p className="career-last gold" data-testid="new-mail">
                📬 {newMail} new message{newMail === 1 ? '' : 's'} in your career inbox
              </p>
            )}
            <button
              type="button"
              className="primary-btn"
              onClick={() => {
                quit();
                openCareer(true);
              }}
            >
              Back to career
            </button>
          </>
        ) : (
          <>
            <button type="button" className="primary-btn" onClick={() => startGame(setup)}>
              Rematch
            </button>
            <button type="button" className="ghost-btn" onClick={quit}>
              Main menu
            </button>
          </>
        )}
      </div>
    </div>
  );
}
