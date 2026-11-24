import { useState } from 'react';
import { describePersonality, personalityFor } from '../engine/ai/personality';
import { AI_LEVELS, AI_SKILL, type AiLevel } from '../engine/ai/skill';
import { MIN_PLAYERS, MODE_DEFAULTS, type ModeId, type ModeOptions } from '../engine/modes/match';
import {
  DEFAULT_SETUP,
  useGameStore,
  type GameSetup,
  type PlayerSetup,
} from '../store/useGameStore';
import { MODE_NAMES } from './modeView';
import { AccountPanel } from './AccountPanel';
import { Segmented } from './Segmented';
import { SettingsPanel } from './SettingsPanel';
import { StatsSheet } from './StatsSheet';
import { resetTutorial } from './Tutorial';

type GameKind = GameSetup['kind'];
type AllOptions = { [M in ModeId]: ModeOptions<M> };
const DEFAULT_PLAYERS: PlayerSetup[] =
  DEFAULT_SETUP.kind !== 'practice' ? DEFAULT_SETUP.players : [];
const botName = (level: AiLevel) => `${AI_SKILL[level].label} Bot`;
const MAX_PLAYERS = 4;

const GAMES: { kind: GameKind; label: string }[] = [
  { kind: 'x01', label: 'x01' },
  { kind: 'cricket', label: 'Cricket' },
  { kind: 'atc', label: 'Clock' },
  { kind: 'shanghai', label: 'Shanghai' },
  { kind: 'killer', label: 'Killer' },
  { kind: 'halveit', label: 'Halve-It' },
  { kind: 'bobs27', label: "Bob's 27" },
  { kind: 'ladder', label: '121' },
  { kind: 'practice', label: 'Practice' },
];

const BLURB: Partial<Record<GameKind, string>> = {
  cricket: 'Close 15–20 and the bull. Extra marks score while an opponent is still open.',
  atc: 'Hit 1 to 20 in order, then the bull.',
  shanghai:
    'Round N is played on number N. Single, double and treble in one turn is a Shanghai and wins outright.',
  killer:
    'Hit your own double to become a killer, then take lives with opponents’ doubles. Last one standing wins.',
  halveit:
    '15, 16, any double, 17, 18, any treble, 19, 20, bull. Miss a round completely and your score is halved.',
  bobs27:
    'Start on 27 and work round the doubles. Hits add, a blank round subtracts. Hit zero and you’re out.',
  ladder: 'Check out 121 in nine darts. Make it and go up one, miss and drop one.',
  practice: 'Free throwing with a heatmap of where your darts land.',
};

export function Menu() {
  const saved = useGameStore((s) => s.setup);
  const startGame = useGameStore((s) => s.startGame);
  const [kind, setKind] = useState<GameKind>(saved.kind);
  const [all, setAll] = useState<AllOptions>(() =>
    saved.kind === 'practice' ? MODE_DEFAULTS : { ...MODE_DEFAULTS, [saved.kind]: saved.options },
  );
  const [legsToWin, setLegsToWin] = useState(
    saved.kind !== 'practice' ? saved.options.legsToWin : 1,
  );
  const [setsToWin, setSetsToWin] = useState(
    saved.kind === 'x01' ? (saved.options.setsToWin ?? 0) : 0,
  );
  const [bullUp, setBullUp] = useState(saved.kind !== 'practice' && !!saved.bullUp);
  const [players, setPlayers] = useState<PlayerSetup[]>(
    saved.kind !== 'practice' ? saved.players : DEFAULT_PLAYERS,
  );
  const [showSettings, setShowSettings] = useState(false);
  const [showStats, setShowStats] = useState(false);

  const patch = <M extends ModeId>(mode: M, p: Partial<ModeOptions<M>>) =>
    setAll((a) => ({ ...a, [mode]: { ...a[mode], ...p } }));
  const update = (i: number, p: Partial<PlayerSetup>) =>
    setPlayers((ps) => ps.map((x, j) => (j === i ? { ...x, ...p } : x)));
  const minPlayers = kind === 'practice' ? 1 : (MIN_PLAYERS[kind] ?? 1);
  const canStart = kind === 'practice' || players.length >= minPlayers;
  const start = () => {
    if (!canStart) return;
    if (kind === 'practice') return startGame({ kind: 'practice' });
    const named = players.map((p, i) => ({
      ...p,
      name: p.name.trim() || (p.ai ? botName(p.ai) : `Player ${i + 1}`),
    }));
    const format =
      kind === 'ladder'
        ? {}
        : kind === 'x01'
          ? { legsToWin, setsToWin }
          : { legsToWin, setsToWin: 0 };
    startGame({
      kind,
      options: { ...all[kind], ...format },
      players: named,
      bullUp: bullUp && named.length > 1,
    } as GameSetup);
  };
  const x01 = all.x01;

  return (
    <div className="menu" data-testid="menu">
      <div className="menu-card">
        <h1>Darts</h1>

        <div className="field">
          <span className="field-label">Game</span>
          <div className="segmented mode-grid" role="radiogroup" aria-label="Game">
            {GAMES.map((g) => (
              <button
                key={g.kind}
                type="button"
                role="radio"
                aria-checked={kind === g.kind}
                className={kind === g.kind ? 'on' : ''}
                onClick={() => setKind(g.kind)}
              >
                {g.label}
              </button>
            ))}
          </div>
        </div>

        {BLURB[kind] && <p className="mode-blurb">{BLURB[kind]}</p>}

        {kind === 'x01' && (
          <Segmented<ModeOptions<'x01'>['startScore']>
            label="Start score"
            value={x01.startScore}
            options={([501, 301, 701] as const).map((n) => ({ value: n, label: String(n) }))}
            onChange={(n) => patch('x01', { startScore: n })}
          />
        )}
        {kind === 'cricket' && (
          <Segmented<boolean>
            label="Variant"
            value={!!all.cricket.cutThroat}
            options={[
              { value: false, label: 'Standard' },
              { value: true, label: 'Cut-throat' },
            ]}
            onChange={(v) => patch('cricket', { cutThroat: v })}
          />
        )}
        {kind === 'atc' && (
          <Segmented<boolean>
            label="Doubles & trebles"
            value={all.atc.multiplierAdvance}
            options={[
              { value: false, label: 'Count once' },
              { value: true, label: 'Skip ahead' },
            ]}
            onChange={(v) => patch('atc', { multiplierAdvance: v })}
          />
        )}
        {kind === 'shanghai' && (
          <Segmented<ModeOptions<'shanghai'>['rounds']>
            label="Rounds"
            value={all.shanghai.rounds}
            options={[
              { value: 7, label: '1 – 7' },
              { value: 20, label: '1 – 20' },
            ]}
            onChange={(v) => patch('shanghai', { rounds: v })}
          />
        )}
        {kind === 'killer' && (
          <Segmented<ModeOptions<'killer'>['lives']>
            label="Lives"
            value={all.killer.lives}
            options={[
              { value: 3, label: '3 lives' },
              { value: 5, label: '5 lives' },
            ]}
            onChange={(v) => patch('killer', { lives: v })}
          />
        )}
        {kind === 'ladder' && (
          <Segmented<ModeOptions<'ladder'>['attempts']>
            label="Attempts"
            value={all.ladder.attempts}
            options={[
              { value: 5, label: '5 attempts' },
              { value: 10, label: '10 attempts' },
            ]}
            onChange={(v) => patch('ladder', { attempts: v })}
          />
        )}

        {kind !== 'practice' && (
          <>
            {kind === 'x01' && (
              <Segmented<number>
                label="Sets"
                value={setsToWin}
                options={[0, 2, 3, 4].map((n) => ({
                  value: n,
                  label: n === 0 ? 'Legs only' : `First to ${n}`,
                }))}
                onChange={(n) => {
                  setSetsToWin(n);
                  if (n && legsToWin === 1) setLegsToWin(3);
                }}
              />
            )}
            {kind !== 'ladder' && (
              <Segmented<number>
                label={kind === 'x01' && setsToWin ? 'Legs per set' : 'Match'}
                value={legsToWin}
                options={(kind === 'x01' && setsToWin ? [2, 3] : [1, 2, 3, 5]).map((n) => ({
                  value: n,
                  label:
                    kind === 'x01' && setsToWin
                      ? `Best of ${n * 2 - 1}`
                      : n === 1
                        ? '1 leg'
                        : `First to ${n}`,
                }))}
                onChange={setLegsToWin}
              />
            )}
            {kind === 'x01' && (
              <>
                <Segmented<boolean>
                  label="Finish"
                  value={x01.doubleOut}
                  options={[
                    { value: true, label: 'Double out' },
                    { value: false, label: 'Straight out' },
                  ]}
                  onChange={(v) => patch('x01', { doubleOut: v })}
                />
                <Segmented<boolean>
                  label="Start"
                  value={x01.doubleIn}
                  options={[
                    { value: false, label: 'Straight in' },
                    { value: true, label: 'Double in' },
                  ]}
                  onChange={(v) => patch('x01', { doubleIn: v })}
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

        {kind !== 'practice' && players.length > 1 && (
          <Segmented<boolean>
            label="Throw first"
            value={bullUp}
            options={[
              { value: true, label: 'Bull-up' },
              { value: false, label: 'In player order' },
            ]}
            onChange={setBullUp}
          />
        )}
        {!canStart && (
          <p className="mode-blurb">
            {MODE_NAMES[kind as ModeId]} needs at least {minPlayers} players.
          </p>
        )}
        <button
          type="button"
          className="primary-btn"
          onClick={start}
          disabled={!canStart}
          data-testid="start"
        >
          {kind === 'practice'
            ? 'Start practice'
            : `Start ${kind === 'x01' ? x01.startScore : MODE_NAMES[kind]}`}
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
