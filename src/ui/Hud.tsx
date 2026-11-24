import { useState } from 'react';
import type { HitResult } from '../engine/board/resolveHit';
import { AI_SKILL } from '../engine/ai/skill';
import { CRICKET_TARGETS, type CricketState } from '../engine/modes/cricket';
import { toDartScore } from '../engine/modes/dart';
import { playsSets, setJustWon } from '../engine/modes/types';
import type { MatchState } from '../engine/modes/match';
import { ASSIST } from '../engine/physics/throwModel';
import {
  currentAi,
  currentAiIntent,
  DARTS_PER_TURN,
  useGameStore,
  type ThrownDart,
} from '../store/useGameStore';
import { MatchOver } from './MatchOver';
import { PowerMeter } from './PowerMeter';
import { Tutorial } from './Tutorial';
import { primaryValue, secondaryValue, turnHint, turnResult, turnTotal } from './modeView';
import { SettingsPanel } from './SettingsPanel';

export const resultLabel = (r: HitResult) =>
  r.kind === 'score'
    ? r.label === 'BULL'
      ? 'Bull'
      : r.label
    : r.kind === 'bounce'
      ? 'Bounce out'
      : r.kind === 'robinHood'
        ? 'Robin Hood!'
        : 'Miss';
const CHIP_LABEL: Record<string, string> = {
  BULL: 'Bull',
  MISS: 'Miss',
  BOUNCE: 'Bounce',
  ROBIN: 'Robin',
};
const chipLabel = (label: string) => CHIP_LABEL[label] ?? label;

/** Second line under the score pop: what the dart hit on the way, or how the weight was. */
function collisionNote(d: ThrownDart): string | null {
  const c = d.collision;
  if (!c) return null;
  if (c.kind === 'robinHood') return 'Buried in the back of a dart · scores nothing';
  if (c.bounce) return 'Knocked out by a dart in the board';
  return c.soft ? 'Brushed the flights' : 'Deflected off a dart';
}
const points = (d: ThrownDart) => (d.result.kind === 'score' ? d.result.points : 0);

export function Hud() {
  const match = useGameStore((s) => s.match);
  const phase = useGameStore((s) => s.phase);
  const bullUp = useGameStore((s) => s.bullUp !== null);
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div className="hud">
      <header className="hud-top">
        <button
          type="button"
          className="icon-btn menu-btn"
          aria-label="Pause menu"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => setMenuOpen(true)}
        >
          ☰
        </button>
        {match ? <Scoreboard match={match} /> : <PracticeCard />}
        {match?.mode === 'cricket' && <CricketGrid match={match} />}
        {bullUp ? <BullUpStrip /> : <TurnStrip />}
      </header>
      <ScorePop />
      <ReplayBadge />
      <footer className="hud-bottom">
        <Tutorial />
        <PowerMeter />
        <Prompt />
        <SkipAi />
      </footer>
      {match?.status === 'matchWon' && phase === 'turnOver' && <MatchOver match={match} />}
      {menuOpen && <PauseSheet onClose={() => setMenuOpen(false)} />}
    </div>
  );
}

function Scoreboard({ match }: { match: MatchState }) {
  const setup = useGameStore((s) => s.setup);
  const multiLeg = match.options.legsToWin > 1;
  const sets = playsSets(match.options);
  return (
    <div className="scoreboard" data-testid="scoreboard">
      {match.players.map((p, i) => (
        <div key={i} className={`player-card${i === match.current ? ' active' : ''}`}>
          <div className="name">
            {setup.kind !== 'practice' && setup.players[i]?.ai && <span className="tag">AI</span>}
            {p.name}
          </div>
          <div className="remaining" data-testid={`remaining-${i}`}>
            {primaryValue(match, i)}
          </div>
          <div className="meta">
            {sets ? (
              <span aria-label={`${p.setsWon} sets, ${p.legsWon} legs`}>
                S{p.setsWon} L{p.legsWon}
              </span>
            ) : (
              multiLeg && <span>Legs {p.legsWon}</span>
            )}
            <span>{secondaryValue(match, i)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

const MARK_SYMBOL = ['', '/', '✕', 'Ⓧ'];

/** Cricket marks table: one row per player, one column per number. */
function CricketGrid({ match }: { match: CricketState }) {
  return (
    <table className="cricket-grid" data-testid="cricket-grid">
      <thead>
        <tr>
          <th />
          {CRICKET_TARGETS.map((t) => (
            <th
              key={t}
              scope="col"
              className={match.players.every((p) => p.marks[t] >= 3) ? 'dead' : ''}
            >
              {t === 25 ? 'B' : t}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {match.players.map((p, i) => (
          <tr key={i} className={i === match.current ? 'active' : ''}>
            <th scope="row">{p.name}</th>
            {CRICKET_TARGETS.map((t) => (
              <td key={t} aria-label={`${p.marks[t]} marks on ${t === 25 ? 'bull' : t}`}>
                {MARK_SYMBOL[p.marks[t]]}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function PracticeCard() {
  const practice = useGameStore((s) => s.practice);
  const reset = useGameStore((s) => s.resetPractice);
  const avg = practice.darts ? ((practice.points / practice.darts) * 3).toFixed(1) : '–';
  return (
    <div className="scoreboard">
      <div className="player-card active">
        <div className="name">Practice</div>
        <div className="remaining">{practice.points}</div>
        <div className="meta">
          <span>{practice.darts} darts</span>
          <span>Avg {avg}</span>
        </div>
      </div>
      {practice.hits.length > 0 && (
        <button
          type="button"
          className="ghost-btn clear-btn"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={reset}
        >
          Clear heatmap
        </button>
      )}
    </div>
  );
}

/** During the bull-up: each thrower's distance from the bull. */
function BullUpStrip() {
  const bullUp = useGameStore((s) => s.bullUp);
  const match = useGameStore((s) => s.match);
  if (!bullUp || !match) return null;
  return (
    <div className="turn-strip" data-testid="bull-up">
      <div className="chips">
        {bullUp.throwers.map((i) => {
          const d = bullUp.distances[i];
          return (
            <span key={i} className={`chip wide${d !== undefined ? ' filled' : ''}`}>
              {match.players[i]!.name}{' '}
              {d === undefined ? '' : Number.isFinite(d) ? `${Math.round(d)} mm` : 'off'}
            </span>
          );
        })}
      </div>
      <div className="checkout">
        Bull-up{bullUp.round > 1 ? ` (throw ${bullUp.round})` : ''} · closest to the bull throws
        first
      </div>
    </div>
  );
}

function TurnStrip() {
  const match = useGameStore((s) => s.match);
  const darts = useGameStore((s) => s.darts);
  const landed = darts.filter((d) => d.landed);
  const labels = match
    ? match.turn.darts.map((d) => d.label)
    : landed.map((d) => toDartScore(d.result).label);
  const total = match ? turnTotal(match) : String(landed.reduce((s, d) => s + points(d), 0));
  const hint = match ? turnHint(match) : null;

  return (
    <div className="turn-strip">
      <div className="chips">
        {Array.from({ length: DARTS_PER_TURN }, (_, i) => (
          <span key={i} className={`chip${labels[i] ? ' filled' : ''}`}>
            {labels[i] ? chipLabel(labels[i]) : ''}
          </span>
        ))}
        <span className="turn-total">
          = <b data-testid="turn-total">{total}</b>
        </span>
      </div>
      {hint && (
        <div className="checkout" data-testid="checkout">
          {hint}
        </div>
      )}
    </div>
  );
}

/** Big transient label for the dart that just landed. */
function ScorePop() {
  const darts = useGameStore((s) => s.darts);
  const assist = useGameStore((s) => s.assist);
  const last = [...darts].reverse().find((d) => d.landed);
  if (!last) return null;
  const err = last.launch.power - 1;
  const weight =
    Math.abs(err) <= ASSIST[assist].powerDeadZone
      ? 'Good weight'
      : err > 0
        ? 'Too hard'
        : 'Too soft';
  return (
    <div className="score-pop" key={last.id} aria-live="polite">
      <div className="label" data-testid="last-score">
        {resultLabel(last.result)}
      </div>
      <div className="weight">{collisionNote(last) ?? weight}</div>
    </div>
  );
}

function Prompt() {
  const phase = useGameStore((s) => s.phase);
  const match = useGameStore((s) => s.match);
  const darts = useGameStore((s) => s.darts);
  const ai = useGameStore(currentAi);
  const meter = useGameStore((s) => s.throwControl === 'meter');
  const aiPressure = useGameStore((s) => currentAiIntent(s)?.pressure ?? 0);
  const bullUp = useGameStore((s) => s.bullUp);
  const name = match?.players[match.current]?.name;
  const multi = (match?.players.length ?? 1) > 1;

  let text: string | null = null;
  const winnerName = match ? match.players[match.legWinner ?? match.current]?.name : undefined;
  if (bullUp && match) {
    if (phase === 'turnOver') {
      text =
        bullUp.winner !== null
          ? `${match.players[bullUp.winner]!.name} throws first · tap to start`
          : 'A tie! Throw again · tap to collect';
    } else if (phase === 'aiming') {
      text = ai ? `${name} is going for the bull…` : `${name}: throw at the bull`;
    }
  } else if (ai && phase !== 'turnOver') {
    text = aiPressure >= 0.6 ? `${name} needs this one…` : `${name} is throwing…`;
  } else if (phase === 'aiming') {
    const how = meter ? 'drag to aim, hold Throw' : 'drag to aim, flick up';
    text = multi ? `${name} to throw · ${how}` : how[0]!.toUpperCase() + how.slice(1);
  } else if (phase === 'turnOver') {
    if (!match) {
      text = `Turn total ${darts.reduce((s, d) => s + points(d), 0)} · tap to collect`;
    } else if (match.mode === 'x01' && match.status === 'bust') {
      text = `Bust! ${name} stays on ${match.players[match.current]!.remaining} · tap to continue`;
    } else if (match.status === 'legWon') {
      text = setJustWon(match)
        ? `${winnerName} wins the set! · tap for set ${(match.set ?? 1) + 1}`
        : `${winnerName} wins leg ${match.leg}! · tap for the next leg`;
    } else if (match.status === 'complete') {
      text = `${turnResult(match, name ?? '')} · tap to collect`;
    }
  }
  if (!text) return null;
  return (
    <div className={`prompt${phase === 'turnOver' ? ' strong' : ''}`} data-testid="prompt">
      {text}
    </div>
  );
}

const REPLAY_TITLE = {
  '180': 'One hundred and eighty!',
  checkout: 'Game shot',
  bounce: 'Bounce out',
  robinHood: 'Robin Hood!',
} as const;

function ReplayBadge() {
  const replay = useGameStore((s) => (s.phase === 'replay' ? s.replay : null));
  if (!replay) return null;
  return (
    <div className="replay-badge" data-testid="replay">
      <span className="rec">● REPLAY</span> {REPLAY_TITLE[replay.reason]} · tap to skip
    </div>
  );
}

/** Fast-forward button shown while an AI opponent is throwing. */
function SkipAi() {
  const ai = useGameStore(currentAi);
  const fast = useGameStore((s) => s.aiFast);
  const matchWon = useGameStore((s) => s.match?.status === 'matchWon');
  const setAiFast = useGameStore((s) => s.setAiFast);
  if (!ai || fast || matchWon) return null;
  return (
    <button
      type="button"
      className="ghost-btn skip-btn"
      data-testid="skip-ai"
      aria-label={`Skip ${AI_SKILL[ai].label} opponent's turn animation`}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={() => setAiFast(true)}
    >
      Skip ▸▸
    </button>
  );
}

function PauseSheet({ onClose }: { onClose(): void }) {
  const quit = useGameStore((s) => s.quitToMenu);
  return (
    <div className="sheet-backdrop" onPointerDown={(e) => e.stopPropagation()}>
      <div className="sheet" role="dialog" aria-label="Paused">
        <h2>Paused</h2>
        <SettingsPanel />
        <button type="button" className="primary-btn" onClick={onClose}>
          Resume
        </button>
        <button
          type="button"
          className="ghost-btn"
          onClick={() => {
            onClose();
            quit();
          }}
        >
          Quit to menu
        </button>
      </div>
    </div>
  );
}
