import { useState } from 'react';
import { DEFAULT_X01, type X01Options } from '../engine/modes/x01';
import { useGameStore, type GameSetup } from '../store/useGameStore';
import { Segmented } from './Segmented';
import { SettingsPanel } from './SettingsPanel';

type GameKind = 301 | 501 | 701 | 'practice';
const MAX_PLAYERS = 4;

export function Menu() {
  const saved = useGameStore((s) => s.setup);
  const startGame = useGameStore((s) => s.startGame);
  const [kind, setKind] = useState<GameKind>(
    saved.kind === 'x01' ? saved.options.startScore : 'practice',
  );
  const [options, setOptions] = useState<X01Options>(
    saved.kind === 'x01' ? saved.options : DEFAULT_X01,
  );
  const [players, setPlayers] = useState<string[]>(
    saved.kind === 'x01' ? saved.players : ['Player 1'],
  );
  const [showSettings, setShowSettings] = useState(false);

  const patch = (p: Partial<X01Options>) => setOptions((o) => ({ ...o, ...p }));
  const start = () => {
    const setup: GameSetup =
      kind === 'practice'
        ? { kind: 'practice' }
        : {
            kind: 'x01',
            options: { ...options, startScore: kind },
            players: players.map((n, i) => n.trim() || `Player ${i + 1}`),
          };
    startGame(setup);
  };

  return (
    <div className="menu" data-testid="menu">
      <div className="menu-card">
        <h1>Darts</h1>

        <Segmented<GameKind>
          label="Game"
          value={kind}
          options={[
            { value: 501, label: '501' },
            { value: 301, label: '301' },
            { value: 701, label: '701' },
            { value: 'practice', label: 'Practice' },
          ]}
          onChange={setKind}
        />

        {kind !== 'practice' && (
          <>
            <Segmented<number>
              label="Match"
              value={options.legsToWin}
              options={[1, 2, 3, 5].map((n) => ({
                value: n,
                label: n === 1 ? '1 leg' : `First to ${n}`,
              }))}
              onChange={(n) => patch({ legsToWin: n })}
            />
            <Segmented<boolean>
              label="Finish"
              value={options.doubleOut}
              options={[
                { value: true, label: 'Double out' },
                { value: false, label: 'Straight out' },
              ]}
              onChange={(v) => patch({ doubleOut: v })}
            />
            <Segmented<boolean>
              label="Start"
              value={options.doubleIn}
              options={[
                { value: false, label: 'Straight in' },
                { value: true, label: 'Double in' },
              ]}
              onChange={(v) => patch({ doubleIn: v })}
            />

            <div className="field">
              <span className="field-label">Players</span>
              <div className="players">
                {players.map((name, i) => (
                  <div className="player-row" key={i}>
                    <input
                      aria-label={`Player ${i + 1} name`}
                      value={name}
                      maxLength={16}
                      onChange={(e) =>
                        setPlayers((ps) => ps.map((p, j) => (j === i ? e.target.value : p)))
                      }
                    />
                    {players.length > 1 && (
                      <button
                        type="button"
                        className="icon-btn"
                        aria-label={`Remove ${name || `player ${i + 1}`}`}
                        onClick={() => setPlayers((ps) => ps.filter((_, j) => j !== i))}
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
                {players.length < MAX_PLAYERS && (
                  <button
                    type="button"
                    className="ghost-btn"
                    onClick={() => setPlayers((ps) => [...ps, `Player ${ps.length + 1}`])}
                  >
                    + Add player
                  </button>
                )}
              </div>
            </div>
          </>
        )}

        <button type="button" className="primary-btn" onClick={start} data-testid="start">
          {kind === 'practice' ? 'Start practice' : `Start ${kind}`}
        </button>

        <button type="button" className="ghost-btn" onClick={() => setShowSettings((v) => !v)}>
          {showSettings ? 'Hide settings' : 'Settings'}
        </button>
        {showSettings && <SettingsPanel />}
      </div>
    </div>
  );
}
