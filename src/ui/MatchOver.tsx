import { marksPerRound } from '../engine/modes/cricket';
import type { MatchState } from '../engine/modes/match';
import { threeDartAverage } from '../engine/modes/x01';
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
  }
}

function headline(m: MatchState): string {
  const winner = m.players[m.winner ?? 0]!;
  if (m.players.length > 1) return `${winner.name} wins!`;
  switch (m.mode) {
    case 'x01':
      return `Checked out in ${winner.stats.darts} darts!`;
    case 'cricket':
      return `Board closed in ${winner.stats.darts} darts!`;
    case 'atc':
      return `Round the clock in ${winner.stats.darts} darts!`;
  }
}

export function MatchOver({ match }: { match: MatchState }) {
  const setup = useGameStore((s) => s.setup);
  const startGame = useGameStore((s) => s.startGame);
  const quit = useGameStore((s) => s.quitToMenu);
  const solo = match.players.length === 1;
  const rows = statRows(match);
  if (match.options.legsToWin > 1) rows.unshift(['Legs', (i) => match.players[i]!.legsWon]);

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
        <button type="button" className="primary-btn" onClick={() => startGame(setup)}>
          Rematch
        </button>
        <button type="button" className="ghost-btn" onClick={quit}>
          Main menu
        </button>
      </div>
    </div>
  );
}
