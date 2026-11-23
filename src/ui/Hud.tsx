import { useState } from 'react';
import type { HitResult } from '../engine/board/resolveHit';
import { suggestCheckout } from '../engine/modes/checkouts';
import { threeDartAverage, type X01State } from '../engine/modes/x01';
import { ASSIST } from '../engine/physics/throwModel';
import { DARTS_PER_TURN, useGameStore, type ThrownDart } from '../store/useGameStore';
import { MatchOver } from './MatchOver';
import { SettingsPanel } from './SettingsPanel';

export const resultLabel = (r: HitResult) =>
  r.kind === 'score'
    ? r.label === 'BULL'
      ? 'Bull'
      : r.label
    : r.kind === 'bounce'
      ? 'Bounce out'
      : 'Miss';
const chipLabel = (label: string) =>
  label === 'BULL' ? 'Bull' : label === 'MISS' ? 'Miss' : label === 'BOUNCE' ? 'Bounce' : label;
const points = (d: ThrownDart) => (d.result.kind === 'score' ? d.result.points : 0);

export function Hud() {
  const match = useGameStore((s) => s.match);
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
        <TurnStrip />
      </header>
      <ScorePop />
      <footer className="hud-bottom">
        <Prompt />
      </footer>
      {match?.status === 'matchWon' && <MatchOver match={match} />}
      {menuOpen && <PauseSheet onClose={() => setMenuOpen(false)} />}
    </div>
  );
}

function Scoreboard({ match }: { match: X01State }) {
  const multiLeg = match.options.legsToWin > 1;
  return (
    <div className="scoreboard" data-testid="scoreboard">
      {match.players.map((p, i) => (
        <div key={i} className={`player-card${i === match.current ? ' active' : ''}`}>
          <div className="name">{p.name}</div>
          <div className="remaining" data-testid={`remaining-${i}`}>
            {p.remaining}
          </div>
          <div className="meta">
            {multiLeg && <span>Legs {p.legsWon}</span>}
            <span>Avg {threeDartAverage(p.stats).toFixed(1)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function PracticeCard() {
  const practice = useGameStore((s) => s.practice);
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
    </div>
  );
}

function TurnStrip() {
  const match = useGameStore((s) => s.match);
  const darts = useGameStore((s) => s.darts);
  const landed = darts.filter((d) => d.landed);
  const labels = match
    ? match.turn.darts.map((d) => d.label)
    : landed.map((d) => (d.result.kind === 'score' ? d.result.label : d.result.kind.toUpperCase()));
  const total = match ? match.turn.points : landed.reduce((s, d) => s + points(d), 0);

  let checkout: string[] | null = null;
  if (match && match.status === 'open' && match.options.doubleOut) {
    const p = match.players[match.current]!;
    if (p.opened) checkout = suggestCheckout(p.remaining, DARTS_PER_TURN - match.turn.darts.length);
  }

  return (
    <div className="turn-strip">
      <div className="chips">
        {Array.from({ length: DARTS_PER_TURN }, (_, i) => (
          <span key={i} className={`chip${labels[i] ? ' filled' : ''}`}>
            {labels[i] ? chipLabel(labels[i]) : ''}
          </span>
        ))}
        <span className="turn-total">
          = <b data-testid="turn-total">{match?.status === 'bust' ? 'Bust' : total}</b>
        </span>
      </div>
      {checkout && (
        <div className="checkout" data-testid="checkout">
          Checkout: {checkout.map(chipLabel).join(' · ')}
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
      <div className="weight">{weight}</div>
    </div>
  );
}

function Prompt() {
  const phase = useGameStore((s) => s.phase);
  const match = useGameStore((s) => s.match);
  const darts = useGameStore((s) => s.darts);
  const name = match?.players[match.current]?.name;
  const multi = (match?.players.length ?? 1) > 1;

  let text: string | null = null;
  if (phase === 'aiming') {
    text = multi ? `${name} to throw · drag to aim, flick up` : 'Drag to aim · flick up to throw';
  } else if (phase === 'turnOver') {
    if (!match) {
      text = `Turn total ${darts.reduce((s, d) => s + points(d), 0)} · tap to collect`;
    } else if (match.status === 'bust') {
      text = `Bust! ${name} stays on ${match.players[match.current]!.remaining} · tap to continue`;
    } else if (match.status === 'legWon') {
      text = `${name} wins leg ${match.leg}! · tap for the next leg`;
    } else if (match.status === 'complete') {
      text = `${name} scored ${match.turn.points} · tap to collect`;
    }
  }
  if (!text) return null;
  return (
    <div className={`prompt${phase === 'turnOver' ? ' strong' : ''}`} data-testid="prompt">
      {text}
    </div>
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
