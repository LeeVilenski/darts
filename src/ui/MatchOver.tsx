import { threeDartAverage, type X01State } from '../engine/modes/x01';
import { useGameStore } from '../store/useGameStore';

export function MatchOver({ match }: { match: X01State }) {
  const setup = useGameStore((s) => s.setup);
  const startGame = useGameStore((s) => s.startGame);
  const quit = useGameStore((s) => s.quitToMenu);
  const winner = match.players[match.winner ?? 0]!;
  const solo = match.players.length === 1;
  const rows: [string, (i: number) => string | number][] = [
    ['3-dart avg', (i) => threeDartAverage(match.players[i]!.stats).toFixed(1)],
    ['Darts', (i) => match.players[i]!.stats.darts],
    ['180s', (i) => match.players[i]!.stats.oneEighties],
    ['140+', (i) => match.players[i]!.stats.ton40s],
    ['100+', (i) => match.players[i]!.stats.tons],
    ['Best checkout', (i) => match.players[i]!.stats.bestCheckout || '–'],
  ];
  if (match.options.legsToWin > 1) rows.unshift(['Legs', (i) => match.players[i]!.legsWon]);

  return (
    <div className="sheet-backdrop" onPointerDown={(e) => e.stopPropagation()}>
      <div className="sheet" role="dialog" aria-label="Match over" data-testid="match-over">
        <h2>{solo ? `Checked out in ${winner.stats.darts} darts!` : `${winner.name} wins!`}</h2>
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
