import { useEffect, useState, type ReactNode } from 'react';
import { AI_SKILL } from '../engine/ai/skill';
import { EVENTS_PER_SEASON, TIERS } from '../engine/career/tiers';
import { ASSIST } from '../engine/physics/throwModel';
import { lifetimeAverage } from '../engine/stats/lifetime';
import { useLifetimeStats } from '../store/lifetimeStats';
import { useCareer } from '../store/useCareer';
import { useGameStore, type GameSetup } from '../store/useGameStore';
import { AccountPanel } from './AccountPanel';
import { CareerSheet } from './CareerSheet';
import { Icon, type IconName } from './icons';
import { MODE_NAMES } from './modeView';
import { PlaySetup, type GameKind } from './PlaySetup';
import { SettingsPanel } from './SettingsPanel';
import { StatsSheet } from './StatsSheet';
import { resetTutorial } from './Tutorial';

type Sheet = 'settings' | 'stats' | 'player' | 'help' | null;

/** Main menu: the home screen of tiles, the Play setup screen, and the sheets they open. */
export function Menu() {
  const [view, setView] = useState<{ screen: 'home' } | { screen: 'play'; kind?: GameKind }>({
    screen: 'home',
  });
  const [sheet, setSheet] = useState<Sheet>(null);
  const careerOpen = useCareer((s) => s.open);
  const close = () => setSheet(null);

  return (
    <div className={`menu ${view.screen === 'home' ? 'menu-home' : ''}`} data-testid="menu">
      {view.screen === 'home' ? (
        <Home onPlay={(kind) => setView({ screen: 'play', kind })} onSheet={setSheet} />
      ) : (
        <PlaySetup initialKind={view.kind} onBack={() => setView({ screen: 'home' })} />
      )}

      {/* Sheets sit outside the cards: a backdrop-filter would otherwise contain the overlay. */}
      {sheet === 'stats' && <StatsSheet onClose={close} />}
      {sheet === 'settings' && (
        <MenuSheet title="Settings" onClose={close}>
          <SettingsPanel />
        </MenuSheet>
      )}
      {sheet === 'player' && <PlayerSheet onClose={close} />}
      {sheet === 'help' && <HelpSheet onClose={close} />}
      {careerOpen && <CareerSheet />}
    </div>
  );
}

/* ---------------------------------------------------------------- home */

function Home({ onPlay, onSheet }: { onPlay(kind?: GameKind): void; onSheet(s: Sheet): void }) {
  const setup = useGameStore((s) => s.setup);
  const startGame = useGameStore((s) => s.startGame);
  const openCareer = useCareer((s) => s.setOpen);
  const careerLine = useCareer((s) => careerSubtitle(s.career));
  const assist = useGameStore((s) => s.assist);

  return (
    <div className="home">
      <div className="brand">
        <h1>DARTS</h1>
        <span className="brand-tag">501 · CRICKET · CAREER</span>
      </div>

      <div className="home-panel">
        <PlayerRow onChange={() => onSheet('player')} />

        <Tile
          color="blue"
          wide
          icon="play"
          title="Quick match"
          subtitle={describeSetup(setup)}
          onClick={() => startGame(setup)}
          testId="quick-match"
        />
        <div className="tile-grid">
          <Tile
            color="orange"
            icon="dart"
            title="Play"
            subtitle="Pick a game"
            onClick={() => onPlay()}
            testId="open-play"
          />
          <Tile
            color="yellow"
            icon="trophy"
            title="Career"
            subtitle={careerLine}
            onClick={() => openCareer(true)}
            testId="open-career"
          />
          <Tile
            color="green"
            icon="target"
            title="Practice"
            subtitle="Free board"
            onClick={() => startGame({ kind: 'practice' })}
            testId="open-practice"
          />
          <Tile
            color="teal"
            icon="drill"
            title="Training"
            subtitle="Bob's 27 · 121"
            onClick={() => onPlay('bobs27')}
          />
          <Tile
            color="purple"
            icon="party"
            title="Party"
            subtitle="Killer & more"
            onClick={() => onPlay('killer')}
          />
          <Tile
            color="red"
            icon="chart"
            title="Stats"
            subtitle="Your records"
            onClick={() => onSheet('stats')}
            testId="open-stats"
          />
        </div>

        <div className="home-buttons">
          <SmallButton icon="user" label="Player" onClick={() => onSheet('player')} />
          <SmallButton icon="help" label="How to play" onClick={() => onSheet('help')} />
          <SmallButton icon="gear" label="Settings" onClick={() => onSheet('settings')} />
        </div>
        <StatusLine assist={assist} />
      </div>
    </div>
  );
}

function Tile(props: {
  color: 'blue' | 'orange' | 'yellow' | 'green' | 'teal' | 'purple' | 'red';
  icon: IconName;
  title: string;
  subtitle: string;
  wide?: boolean;
  onClick(): void;
  testId?: string;
}) {
  return (
    <button
      type="button"
      className={`tile tile-${props.color}${props.wide ? ' tile-wide' : ''}`}
      onClick={props.onClick}
      data-testid={props.testId}
    >
      <span className="tile-icon">
        <Icon name={props.icon} />
      </span>
      <span className="tile-text">
        <span className="tile-title">{props.title}</span>
        <span className="tile-sub">{props.subtitle}</span>
      </span>
    </button>
  );
}

function SmallButton({ icon, label, onClick }: { icon: IconName; label: string; onClick(): void }) {
  return (
    <button type="button" className="small-btn" onClick={onClick}>
      <Icon name={icon} />
      <span>{label}</span>
    </button>
  );
}

/** You: initial, name and a one-line record, with a shortcut to change your name. */
function PlayerRow({ onChange }: { onChange(): void }) {
  const name = useGameStore((s) => homePlayerName(s.setup));
  const record = useLifetimeStats((s) => s.stats[name]);
  const line = !record
    ? 'No matches yet'
    : [
        `${record.matches} match${record.matches === 1 ? '' : 'es'}`,
        `${record.wins} won`,
        record.x01.darts ? `avg ${lifetimeAverage(record).toFixed(1)}` : null,
      ]
        .filter(Boolean)
        .join(' · ');
  return (
    <button type="button" className="player-row-card" onClick={onChange} data-testid="player-row">
      <span className="avatar">{name.trim()[0]?.toUpperCase() ?? '?'}</span>
      <span className="tile-text">
        <span className="player-name">{name}</span>
        <span className="tile-sub">{line}</span>
      </span>
      <span className="change">
        Change <Icon name="chevron" />
      </span>
    </button>
  );
}

function StatusLine({ assist }: { assist: keyof typeof ASSIST }) {
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    // Ready offline once the service worker controls the page.
    const check = () => setOffline(!!navigator.serviceWorker?.controller);
    check();
    navigator.serviceWorker?.addEventListener('controllerchange', check);
    return () => navigator.serviceWorker?.removeEventListener('controllerchange', check);
  }, []);
  return (
    <div className="status-line">
      {offline && (
        <span>
          <i className="dot" /> Available offline
        </span>
      )}
      <span>Aim assist: {assist[0]!.toUpperCase() + assist.slice(1)}</span>
    </div>
  );
}

/* ---------------------------------------------------------------- sheets */

function MenuSheet(props: { title: string; onClose(): void; children: ReactNode }) {
  return (
    <div
      className="sheet-backdrop"
      onPointerDown={(e) => {
        e.stopPropagation();
        if (e.target === e.currentTarget) props.onClose();
      }}
    >
      <div className="sheet" role="dialog" aria-label={props.title}>
        <h2>{props.title}</h2>
        {props.children}
        <button type="button" className="ghost-btn" onClick={props.onClose}>
          Done
        </button>
      </div>
    </div>
  );
}

function PlayerSheet({ onClose }: { onClose(): void }) {
  const setup = useGameStore((s) => s.setup);
  const saveSetup = useGameStore((s) => s.saveSetup);
  const [name, setName] = useState(homePlayerName(setup));
  const save = () => {
    const trimmed = name.trim();
    if (trimmed && setup.kind !== 'practice') {
      const i = setup.players.findIndex((p) => !p.ai);
      const players =
        i < 0
          ? [{ name: trimmed }, ...setup.players]
          : setup.players.map((p, j) => (j === i ? { ...p, name: trimmed } : p));
      saveSetup({ ...setup, players });
    }
    onClose();
  };
  return (
    <MenuSheet title="Player" onClose={save}>
      <div className="field">
        <span className="field-label">Your name</span>
        <input
          aria-label="Your name"
          value={name}
          maxLength={16}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && save()}
        />
      </div>
      <p className="muted">Stats are kept per name on this device.</p>
      <AccountPanel />
    </MenuSheet>
  );
}

function HelpSheet({ onClose }: { onClose(): void }) {
  const [queued, setQueued] = useState(false);
  return (
    <MenuSheet title="How to play" onClose={onClose}>
      <ul className="help-list">
        <li>
          <b>Aim:</b> drag anywhere to move the marker (arrow keys on a keyboard, Shift for fine).
        </li>
        <li>
          <b>Throw:</b> flick up and release. Flick speed is the weight: too hard lands high, too
          soft low. Prefer a power bar? Settings → Throwing → Power meter (or hold Space).
        </li>
        <li>
          <b>x01:</b> score down from 501 (or 301 / 701) to exactly zero, finishing on a double.
          Going below zero, or to one, is a bust.
        </li>
        <li>
          <b>Darts in the board get in the way:</b> a tight group can deflect the next dart, or even
          catch it in the back of another — a Robin Hood.
        </li>
        <li>
          <b>Career:</b> win events to climb the order of merit; the top two each season move up a
          tier, from the Pub League to the Pro Tour.
        </li>
      </ul>
      <button
        type="button"
        className="ghost-btn"
        disabled={queued}
        onClick={() => {
          resetTutorial();
          setQueued(true);
        }}
      >
        {queued ? 'The tutorial will run next game' : 'Replay the tutorial next game'}
      </button>
    </MenuSheet>
  );
}

/* ---------------------------------------------------------------- text */

/** The first human player in the saved setup, i.e. "you". */
function homePlayerName(setup: GameSetup): string {
  if (setup.kind === 'practice') return 'Player 1';
  return setup.players.find((p) => !p.ai)?.name ?? 'Player 1';
}

/** "501 · vs Club Bot · first to 3" */
export function describeSetup(setup: GameSetup): string {
  if (setup.kind === 'practice') return 'Practice · free board';
  const game = setup.kind === 'x01' ? String(setup.options.startScore) : MODE_NAMES[setup.kind];
  const ais = setup.players.filter((p) => p.ai);
  const humans = setup.players.length - ais.length;
  const who =
    setup.players.length === 1
      ? 'solo'
      : ais.length === 1 && humans === 1
        ? `vs ${AI_SKILL[ais[0]!.ai!].label} AI`
        : `${setup.players.length} players`;
  const o = setup.options;
  const format =
    setup.kind === 'ladder'
      ? null
      : o.setsToWin
        ? `first to ${o.setsToWin} sets`
        : o.legsToWin > 1
          ? `first to ${o.legsToWin}`
          : null;
  return [game, who, format].filter(Boolean).join(' · ');
}

function careerSubtitle(c: ReturnType<typeof useCareer.getState>['career']): string {
  if (!c) return 'Pub to Pro Tour';
  return `${TIERS[c.tier]!.name} · ${c.eventIndex + 1}/${EVENTS_PER_SEASON}`;
}
