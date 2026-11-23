import { lifetimeAverage, lifetimeMpr, type PlayerLifetime } from '../engine/stats/lifetime';
import { useLifetimeStats } from '../store/lifetimeStats';

const rows: [string, (p: PlayerLifetime) => string | number][] = [
  ['Matches', (p) => p.matches],
  ['Wins', (p) => p.wins],
  ['x01 average', (p) => (p.x01.darts ? lifetimeAverage(p).toFixed(1) : '–')],
  ['Best x01 match avg', (p) => (p.x01.matches ? p.x01.bestAverage.toFixed(1) : '–')],
  ['Best checkout', (p) => p.x01.bestCheckout || '–'],
  ['180s', (p) => p.x01.oneEighties],
  ['100+ turns', (p) => p.x01.tons],
  ['Cricket MPR', (p) => (p.cricket.darts ? lifetimeMpr(p).toFixed(2) : '–')],
  ['Best Clock (darts)', (p) => p.atc.bestDarts ?? '–'],
];

/** Lifetime stats for every human player who has finished a match on this device. */
export function StatsSheet({ onClose }: { onClose(): void }) {
  const stats = useLifetimeStats((s) => s.stats);
  const reset = useLifetimeStats((s) => s.reset);
  const names = Object.keys(stats).sort((a, b) => stats[b]!.matches - stats[a]!.matches);

  return (
    <div className="sheet-backdrop" onPointerDown={(e) => e.stopPropagation()}>
      <div className="sheet" role="dialog" aria-label="Stats" data-testid="stats-sheet">
        <h2>Stats</h2>
        {names.length === 0 ? (
          <p className="muted">Finish a match to start recording stats.</p>
        ) : (
          <div className="table-scroll">
            <table className="stats">
              <thead>
                <tr>
                  <th />
                  {names.map((n) => (
                    <th key={n}>{n}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(([label, get]) => (
                  <tr key={label}>
                    <th scope="row">{label}</th>
                    {names.map((n) => (
                      <td key={n}>{get(stats[n]!)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <button type="button" className="primary-btn" onClick={onClose}>
          Done
        </button>
        {names.length > 0 && (
          <button
            type="button"
            className="ghost-btn"
            onClick={() => {
              if (window.confirm('Delete all stats on this device?')) reset();
            }}
          >
            Reset stats
          </button>
        )}
      </div>
    </div>
  );
}
