import { useState } from 'react';
import { AI_LEVELS, AI_SKILL, type AiLevel } from '../engine/ai/skill';
import { DEFAULT_X01, type X01Options } from '../engine/modes/x01';
import {
  DEFAULT_SETUP,
  useGameStore,
  type GameSetup,
  type PlayerSetup,
} from '../store/useGameStore';
import { Segmented } from './Segmented';
import { SettingsPanel } from './SettingsPanel';

type GameKind = 301 | 501 | 701 | 'practice';
const DEFAULT_PLAYERS: PlayerSetup[] = DEFAULT_SETUP.kind === 'x01' ? DEFAULT_SETUP.players : [];
const botName = (level: AiLevel) => `${AI_SKILL[level].label} Bot`;
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
  const [players, setPlayers] = useState<PlayerSetup[]>(
    saved.kind === 'x01' ? saved.players : DEFAULT_PLAYERS,
  );
  const [showSettings, setShowSettings] = useState(false);

  const patch = (p: Partial<X01Options>) => setOptions((o) => ({ ...o, ...p }));
  const update = (i: number, p: Partial<PlayerSetup>) =>
    setPlayers((ps) => ps.map((x, j) => (j === i ? { ...x, ...p } : x)));
  const start = () => {
    const setup: GameSetup =
      kind === 'practice'
        ? { kind: 'practice' }
        : {
            kind: 'x01',
            options: { ...options, startScore: kind },
            players: players.map((p, i) => ({
              ...p,
              name: p.name.trim() || (p.ai ? botName(p.ai) : `Player ${i + 1}`),
            })),
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
                {players.map((p, i) => (
                  <div className="player-slot" key={i}>
                    <div className="player-row">
                      {p.ai && <span className="tag">AI</span>}
                      <input
                        aria-label={`Player ${i + 1} name`}
                        value={p.name}
                        maxLength={16}
                        onChange={(e) => update(i, { name: e.target.value })}
                      />
                      {players.length > 1 && (
                        <button
                          type="button"
                          className="icon-btn"
                          aria-label={`Remove ${p.name || `player ${i + 1}`}`}
                          onClick={() => setPlayers((ps) => ps.filter((_, j) => j !== i))}
                        >
                          ×
                        </button>
                      )}
                    </div>
                    {p.ai && (
                      <div
                        className="segmented small"
                        role="radiogroup"
                        aria-label={`${p.name} level`}
                      >
                        {AI_LEVELS.map((level) => (
                          <button
                            key={level}
                            type="button"
                            role="radio"
                            aria-checked={p.ai === level}
                            className={p.ai === level ? 'on' : ''}
                            onClick={() =>
                              // Keep auto-generated names in step with the level.
                              update(i, {
                                ai: level,
                                name: p.name === botName(p.ai!) ? botName(level) : p.name,
                              })
                            }
                          >
                            {AI_SKILL[level].label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                {players.length < MAX_PLAYERS && (
                  <div className="add-row">
                    <button
                      type="button"
                      className="ghost-btn"
                      onClick={() =>
                        setPlayers((ps) => [
                          ...ps,
                          { name: `Player ${ps.filter((x) => !x.ai).length + 1}` },
                        ])
                      }
                    >
                      + Player
                    </button>
                    <button
                      type="button"
                      className="ghost-btn"
                      data-testid="add-ai"
                      onClick={() =>
                        setPlayers((ps) => [...ps, { name: botName('club'), ai: 'club' }])
                      }
                    >
                      + AI opponent
                    </button>
                  </div>
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
