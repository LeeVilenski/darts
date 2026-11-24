import { useState } from 'react';
import { describePersonality, personalityFor } from '../engine/ai/personality';
import { AI_LEVELS, AI_SKILL, type AiLevel } from '../engine/ai/skill';
import { DEFAULT_ATC, type AtcOptions } from '../engine/modes/aroundTheClock';
import { DEFAULT_CRICKET } from '../engine/modes/cricket';
import { DEFAULT_X01, type X01Options } from '../engine/modes/x01';
import {
  DEFAULT_SETUP,
  useGameStore,
  type GameSetup,
  type PlayerSetup,
} from '../store/useGameStore';
import { AccountPanel } from './AccountPanel';
import { Segmented } from './Segmented';
import { SettingsPanel } from './SettingsPanel';
import { StatsSheet } from './StatsSheet';
import { resetTutorial } from './Tutorial';

type GameKind = GameSetup['kind'];
const DEFAULT_PLAYERS: PlayerSetup[] =
  DEFAULT_SETUP.kind !== 'practice' ? DEFAULT_SETUP.players : [];
const botName = (level: AiLevel) => `${AI_SKILL[level].label} Bot`;
const MAX_PLAYERS = 4;

export function Menu() {
  const saved = useGameStore((s) => s.setup);
  const startGame = useGameStore((s) => s.startGame);
  const [kind, setKind] = useState<GameKind>(saved.kind);
  const [options, setOptions] = useState<X01Options>(
    saved.kind === 'x01' ? saved.options : DEFAULT_X01,
  );
  const [atc, setAtc] = useState<AtcOptions>(saved.kind === 'atc' ? saved.options : DEFAULT_ATC);
  const [legsToWin, setLegsToWin] = useState(
    saved.kind !== 'practice' ? saved.options.legsToWin : 1,
  );
  const [players, setPlayers] = useState<PlayerSetup[]>(
    saved.kind !== 'practice' ? saved.players : DEFAULT_PLAYERS,
  );
  const [showSettings, setShowSettings] = useState(false);
  const [showStats, setShowStats] = useState(false);

  const patch = (p: Partial<X01Options>) => setOptions((o) => ({ ...o, ...p }));
  const update = (i: number, p: Partial<PlayerSetup>) =>
    setPlayers((ps) => ps.map((x, j) => (j === i ? { ...x, ...p } : x)));
  const start = () => {
    const named = players.map((p, i) => ({
      ...p,
      name: p.name.trim() || (p.ai ? botName(p.ai) : `Player ${i + 1}`),
    }));
    const setup: GameSetup =
      kind === 'practice'
        ? { kind: 'practice' }
        : kind === 'x01'
          ? { kind, options: { ...options, legsToWin }, players: named }
          : kind === 'cricket'
            ? { kind, options: { ...DEFAULT_CRICKET, legsToWin }, players: named }
            : { kind, options: { ...atc, legsToWin }, players: named };
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
            { value: 'x01', label: 'x01' },
            { value: 'cricket', label: 'Cricket' },
            { value: 'atc', label: 'Clock' },
            { value: 'practice', label: 'Practice' },
          ]}
          onChange={setKind}
        />

        {kind === 'x01' && (
          <Segmented<X01Options['startScore']>
            label="Start score"
            value={options.startScore}
            options={[501, 301, 701].map((n) => ({
              value: n as X01Options['startScore'],
              label: String(n),
            }))}
            onChange={(n) => patch({ startScore: n })}
          />
        )}
        {kind === 'cricket' && (
          <p className="mode-blurb">
            Close 15–20 and the bull. Extra marks score while your opponent is still open.
          </p>
        )}
        {kind === 'atc' && (
          <>
            <p className="mode-blurb">Hit 1 to 20 in order, then the bull.</p>
            <Segmented<boolean>
              label="Doubles & trebles"
              value={atc.multiplierAdvance}
              options={[
                { value: false, label: 'Count once' },
                { value: true, label: 'Skip ahead' },
              ]}
              onChange={(v) => setAtc((o) => ({ ...o, multiplierAdvance: v }))}
            />
          </>
        )}
        {kind === 'practice' && (
          <p className="mode-blurb">Free throwing with a heatmap of where your darts land.</p>
        )}

        {kind !== 'practice' && (
          <>
            <Segmented<number>
              label="Match"
              value={legsToWin}
              options={[1, 2, 3, 5].map((n) => ({
                value: n,
                label: n === 1 ? '1 leg' : `First to ${n}`,
              }))}
              onChange={setLegsToWin}
            />
            {kind === 'x01' && (
              <>
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
              </>
            )}

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
                    {p.ai && (
                      <div className="personality" data-testid="ai-personality">
                        {describePersonality(personalityFor(p.name || botName(p.ai)))}
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
          {kind === 'practice'
            ? 'Start practice'
            : `Start ${kind === 'x01' ? options.startScore : kind === 'cricket' ? 'Cricket' : 'Around the Clock'}`}
        </button>

        <button type="button" className="ghost-btn" onClick={() => setShowSettings((v) => !v)}>
          {showSettings ? 'Hide settings' : 'Settings'}
        </button>
        {showSettings && <SettingsPanel />}
        <button type="button" className="ghost-btn" onClick={resetTutorial}>
          Replay the tutorial next game
        </button>
        <AccountPanel />
        <button
          type="button"
          className="ghost-btn"
          data-testid="open-stats"
          onClick={() => setShowStats(true)}
        >
          Stats
        </button>
      </div>
      {/* Outside the card: its backdrop-filter would otherwise contain the overlay. */}
      {showStats && <StatsSheet onClose={() => setShowStats(false)} />}
    </div>
  );
}
