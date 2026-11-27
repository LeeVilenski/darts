import { useState } from 'react';
import { describePersonality, personalityFor } from '../../engine/ai/personality';
import { AI_SKILL } from '../../engine/ai/skill';
import {
  nameOf,
  nextMatch,
  promotionRace,
  seasonSchedule,
  standings,
  YOU,
  type BracketMatch,
  type CareerState,
} from '../../engine/career/career';
import { careerAverage, emptyCareerStats, form, winRate } from '../../engine/career/stats';
import {
  describeFormat,
  EVENTS_PER_SEASON,
  PRIZE_SHARE,
  PROMOTION_PLACES,
  ROUND_NAMES,
  TIERS,
  type Reached,
} from '../../engine/career/tiers';
import { appearanceFor } from '../../game/scene/appearance';
import { useCareer } from '../../store/useCareer';
import { Icon } from '../icons';
import { AttributePanel, RatingsLine, TrainingCard } from './Attributes';

type Tab = 'home' | 'calendar' | 'rankings' | 'profile';
const TABS: { id: Tab; label: string }[] = [
  { id: 'home', label: 'Home' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'rankings', label: 'Rankings' },
  { id: 'profile', label: 'Profile' },
];

export const REACHED: Record<Reached, string> = {
  QF: 'Quarter-finals',
  SF: 'Semi-finals',
  F: 'Runner-up',
  W: 'Winner',
};
const SHORT: Record<Reached, string> = { QF: 'QF', SF: 'SF', F: 'Final', W: 'Won' };
/** Visual theme per tier: chalk and wood at the pub up to broadcast gold on tour. */
const THEMES = ['pub', 'county', 'challenge', 'tour'] as const;

export const money = (n: number) => `£${n.toLocaleString('en-GB')}`;
export const ordinal = (n: number) => {
  const t = n % 100;
  const s = t >= 11 && t <= 13 ? 'th' : (['th', 'st', 'nd', 'rd'][n % 10] ?? 'th');
  return `${n}${s}`;
};
const pct = (x: number) => `${Math.round(x * 100)}%`;

/** Career mode: a full-screen hub over the menu. */
export function CareerHub() {
  const career = useCareer((s) => s.career);
  const setOpen = useCareer((s) => s.setOpen);
  const [tab, setTab] = useState<Tab>('home');
  const theme = career ? THEMES[career.tier] : 'pub';

  return (
    <div className="menu-card career-hub" data-theme={theme} data-testid="career">
      <header className="screen-head">
        <button type="button" className="back-btn" onClick={() => setOpen(false)} aria-label="Back">
          <Icon name="back" />
        </button>
        <div className="hub-title">
          <h2>{career ? career.you : 'Career'}</h2>
          {career && (
            <span className="hub-sub">
              {TIERS[career.tier]!.name} · Season {career.season}
            </span>
          )}
        </div>
        {career && <span className="hub-money">{money(career.earnings)}</span>}
      </header>

      {career ? (
        <>
          <nav className="hub-tabs" role="tablist" aria-label="Career">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                className={tab === t.id ? 'on' : ''}
                onClick={() => setTab(t.id)}
                data-testid={`career-tab-${t.id}`}
              >
                {t.label}
              </button>
            ))}
          </nav>
          <div className="hub-body" role="tabpanel">
            {tab === 'home' && <HomeTab c={career} onTab={setTab} />}
            {tab === 'calendar' && <CalendarTab c={career} />}
            {tab === 'rankings' && <RankingsTab c={career} />}
            {tab === 'profile' && <ProfileTab c={career} />}
          </div>
        </>
      ) : (
        <NewCareer />
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- new career */

function NewCareer() {
  const start = useCareer((s) => s.start);
  const [name, setName] = useState('');
  return (
    <div className="hub-body">
      <div className="hub-card hero">
        <p>
          Every pro started down the pub. Begin at your local in the <b>Pub League</b> and work your
          way up through the County Circuit and the Challenge Tour to the <b>Pro Tour</b>.
        </p>
        <p className="muted">
          Each season has {EVENTS_PER_SEASON} knockout events. Finish in the top {PROMOTION_PLACES}{' '}
          of the order of merit to move up a tier.
        </p>
      </div>
      <div className="field">
        <span className="field-label">Your name</span>
        <input
          aria-label="Your name"
          value={name}
          maxLength={16}
          placeholder="Player 1"
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <button
        type="button"
        className="primary-btn"
        data-testid="career-start"
        onClick={() => start(name)}
      >
        Start career
      </button>
    </div>
  );
}

/* ---------------------------------------------------------------- home */

function HomeTab({ c, onTab }: { c: CareerState; onTab(t: Tab): void }) {
  const play = useCareer((s) => s.play);
  const dismiss = useCareer((s) => s.dismissSeason);
  const next = nextMatch(c);
  const stats = c.stats ?? emptyCareerStats();
  const last = c.results.at(-1);
  const race = promotionRace(c);
  const tier = TIERS[c.tier]!;

  return (
    <>
      {c.lastSeason && (
        <div className="hub-card season-review" data-testid="season-summary">
          <div className="eyebrow">Season {c.lastSeason.season} review</div>
          <div className="big">
            {ordinal(c.lastSeason.position)} in the {TIERS[c.lastSeason.tier]!.name}
          </div>
          <p>
            {c.lastSeason.promoted
              ? `Promoted! Next season you play on the ${tier.name}.`
              : c.lastSeason.tier === TIERS.length - 1
                ? 'Another season on the Pro Tour. Defend your place.'
                : `Top ${PROMOTION_PLACES} go up. Another crack at the ${tier.name}.`}
          </p>
          <button type="button" className="primary-btn small" onClick={dismiss}>
            Start season {c.season}
          </button>
        </div>
      )}

      {next && (
        <div className="hub-card fixture" data-testid="next-match">
          <div className="eyebrow">
            {c.event.name} · {ROUND_NAMES[next.round]} · Event {c.eventIndex + 1} of{' '}
            {EVENTS_PER_SEASON}
          </div>
          <div className="fixture-vs">
            <PlayerBadge name={c.you} />
            <span className="vs">v</span>
            <PlayerBadge name={next.opponent.name} />
          </div>
          <div className="fixture-names">
            <span className="you">{c.you}</span>
            <span>{next.opponent.name}</span>
          </div>
          <dl className="fixture-facts">
            <div>
              <dt>Opponent</dt>
              <dd>
                {AI_SKILL[next.opponent.level].label} level ·{' '}
                {describePersonality(personalityFor(next.opponent.name))}
              </dd>
            </div>
            {c.attributes && (
              <div>
                <dt>Your game</dt>
                <dd>
                  <RatingsLine a={c.attributes} />
                </dd>
              </div>
            )}
            <div>
              <dt>Head to head</dt>
              <dd>{h2hLine(stats.h2h[next.opponent.id])}</dd>
            </div>
            <div>
              <dt>Format</dt>
              <dd>501 · {describeFormat(next.format)} · bull-up to throw first</dd>
            </div>
            <div>
              <dt>At stake</dt>
              <dd>{stakeLine(c, next.round)}</dd>
            </div>
          </dl>
          <button type="button" className="primary-btn" onClick={play} data-testid="career-play">
            Play {ROUND_NAMES[next.round]!.toLowerCase()}
          </button>
        </div>
      )}

      {next && <TrainingCard c={c} />}

      <div className="hub-row">
        <div className="hub-card stat-card">
          <div className="eyebrow">Form</div>
          <FormStrip results={form(stats, 5)} />
        </div>
        <button type="button" className="hub-card stat-card link" onClick={() => onTab('rankings')}>
          <div className="eyebrow">Order of merit</div>
          <div className="big">
            {ordinal(race.position)} <span className="muted small">· {race.points} pts</span>
          </div>
        </button>
      </div>

      <div className="hub-card goal">
        <div className="eyebrow">Next goal</div>
        <GoalLine c={c} />
      </div>

      {last && !c.lastSeason && (
        <p className="career-last">
          Last event: {last.name}, {REACHED[last.reached].toLowerCase()} (+{last.points} pts,{' '}
          {money(last.prize)})
        </p>
      )}

      <h3>{c.event.name} draw</h3>
      <Bracket c={c} />
    </>
  );
}

function h2hLine(r: [number, number] | undefined) {
  if (!r || r[0] + r[1] === 0) return 'First meeting';
  const [w, l] = r;
  return `${w}–${l}${w > l ? ' to you' : w < l ? ' to them' : ''}`;
}

function stakeLine(c: CareerState, round: number) {
  const tier = TIERS[c.tier]!;
  if (round === 2) return `The title, ${tier.points.W} merit points and ${money(tier.prize)}`;
  const reach: Reached = round === 0 ? 'SF' : 'F';
  return `A place in the ${ROUND_NAMES[round + 1]!.toLowerCase()}: ${tier.points[reach]} pts and ${money(
    Math.round(tier.prize * PRIZE_SHARE[reach]),
  )} guaranteed`;
}

function GoalLine({ c }: { c: CareerState }) {
  const race = promotionRace(c);
  const nextTier = TIERS[c.tier + 1];
  if (race.top || !nextTier) {
    return (
      <p>
        Top of the tree. Win the order of merit: you&apos;re {ordinal(race.position)} with{' '}
        {race.eventsLeft} event{race.eventsLeft === 1 ? '' : 's'} to go.
      </p>
    );
  }
  const inPlace = race.position <= PROMOTION_PLACES;
  const progress = inPlace ? 1 : race.points / Math.max(1, race.points + race.gap);
  return (
    <>
      <p>
        Finish top {PROMOTION_PLACES} to reach the <b>{nextTier.name}</b>.{' '}
        {inPlace
          ? `You're in a promotion place. Hold on with ${race.eventsLeft} event${race.eventsLeft === 1 ? '' : 's'} left.`
          : race.gap > race.maxToCome
            ? 'Out of reach this season. Bank points for next time.'
            : `${race.gap} pts behind ${ordinal(PROMOTION_PLACES)} with ${race.eventsLeft} event${race.eventsLeft === 1 ? '' : 's'} left.`}
      </p>
      <div className="progress" aria-hidden="true">
        <span style={{ width: pct(progress) }} />
      </div>
    </>
  );
}

function FormStrip({ results }: { results: string[] }) {
  if (!results.length) return <div className="muted small">No matches yet</div>;
  return (
    <div className="form-strip" aria-label={`Form: ${results.join(' ')}`}>
      {results.map((r, i) => (
        <span key={i} className={r === 'W' ? 'w' : 'l'}>
          {r}
        </span>
      ))}
    </div>
  );
}

/** A round badge in the player's shirt colours with their initials. */
export function PlayerBadge({ name, size = 56 }: { name: string; size?: number }) {
  const look = appearanceFor(name);
  const initials = name
    .replace(/"[^"]*"/g, '')
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  return (
    <span
      className="player-badge"
      style={{
        background: look.shirt,
        borderColor: look.trim,
        color: look.trim,
        width: size,
        height: size,
      }}
      aria-hidden="true"
    >
      {initials}
    </span>
  );
}

/* ---------------------------------------------------------------- calendar */

function CalendarTab({ c }: { c: CareerState }) {
  const tier = TIERS[c.tier]!;
  const next = nextMatch(c);
  const nextTier = TIERS[c.tier + 1];
  return (
    <>
      <h3>
        Season {c.season} · {tier.name}
      </h3>
      <ol className="calendar">
        {seasonSchedule(c).map((e) => (
          <li key={e.index} className={`cal-event ${e.status}`} data-testid="calendar-event">
            <span className="cal-num">{e.index + 1}</span>
            <div className="cal-main">
              <b>{e.name}</b>
              <span className="muted small">
                {e.index === EVENTS_PER_SEASON - 1 ? 'Season finale · ' : ''}8-player knockout ·
                final {describeFormat(tier.formats[2]).toLowerCase()} · {money(tier.prize)} to the
                winner
              </span>
            </div>
            <span className={`chip ${e.result?.reached === 'W' ? 'gold' : ''}`}>
              {e.status === 'done' && e.result
                ? `${SHORT[e.result.reached]} · +${e.result.points}`
                : e.status === 'current'
                  ? next
                    ? `Now: ${ROUND_NAMES[next.round]}`
                    : 'Now'
                  : 'Upcoming'}
            </span>
          </li>
        ))}
      </ol>

      {nextTier && (
        <>
          <h3>Next tier: {nextTier.name}</h3>
          <ol className="calendar locked">
            {nextTier.events.map((name, i) => (
              <li key={i} className="cal-event upcoming">
                <span className="cal-num" aria-label="Locked">
                  🔒
                </span>
                <div className="cal-main">
                  <b>{name}</b>
                  <span className="muted small">{money(nextTier.prize)} to the winner</span>
                </div>
              </li>
            ))}
          </ol>
          <p className="muted small">
            Finish top {PROMOTION_PLACES} on the order of merit to unlock.
          </p>
        </>
      )}

      <h3>Points</h3>
      <table className="stats points-table">
        <thead>
          <tr>
            <th />
            {(['QF', 'SF', 'F', 'W'] as Reached[]).map((r) => (
              <th key={r}>{SHORT[r]}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">Merit pts</th>
            {(['QF', 'SF', 'F', 'W'] as Reached[]).map((r) => (
              <td key={r}>{tier.points[r]}</td>
            ))}
          </tr>
        </tbody>
      </table>
    </>
  );
}

/* ---------------------------------------------------------------- rankings */

function RankingsTab({ c }: { c: CareerState }) {
  const table = standings(c);
  const top = c.tier === TIERS.length - 1;
  return (
    <>
      <h3>{TIERS[c.tier]!.name} order of merit</h3>
      <p className="muted small">
        After {c.eventIndex} of {EVENTS_PER_SEASON} events.{' '}
        {top
          ? 'The top of the table wins the order of merit.'
          : `Top ${PROMOTION_PLACES} are promoted.`}
      </p>
      <table className="stats merit" data-testid="merit">
        <tbody>
          {table.map((row, i) => (
            <tr
              key={row.id}
              className={`${row.id === YOU ? 'you' : ''}${!top && i === PROMOTION_PLACES - 1 ? ' cut' : ''}`}
            >
              <td>{i + 1}</td>
              <th scope="row">{row.name}</th>
              <td className="muted small">
                {row.id === YOU ? '' : AI_SKILL[c.roster.find((p) => p.id === row.id)!.level].label}
              </td>
              <td>{row.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

/* ---------------------------------------------------------------- profile */

function ProfileTab({ c }: { c: CareerState }) {
  const retire = useCareer((s) => s.retire);
  const [confirmRetire, setConfirmRetire] = useState(false);
  const s = c.stats ?? emptyCareerStats();
  const tiles: [string, string][] = [
    ['Matches', String(s.matches)],
    ['Win rate', s.matches ? pct(winRate(s)) : '–'],
    ['Average', s.darts ? careerAverage(s).toFixed(1) : '–'],
    ['Best avg', s.bestAverage ? s.bestAverage.toFixed(1) : '–'],
    ['180s', String(s.oneEighties)],
    ['100+', String(s.tons)],
    ['High out', s.highestCheckout ? String(s.highestCheckout) : '–'],
    ['Legs', `${s.legsWon}–${s.legsLost}`],
  ];
  const seasons = [...new Set(c.results.map((r) => r.season))].sort((a, b) => b - a);

  return (
    <>
      <div className="hub-card profile-head">
        <PlayerBadge name={c.you} size={64} />
        <div>
          <div className="big">{c.you}</div>
          <div className="muted small">
            {TIERS[c.tier]!.name} · season {c.season} · {money(c.earnings)} won
          </div>
        </div>
      </div>

      <AttributePanel c={c} />

      <h3>Career stats</h3>
      <div className="stat-grid">
        {tiles.map(([k, v]) => (
          <div key={k} className="stat-tile">
            <span className="v">{v}</span>
            <span className="k">{k}</span>
          </div>
        ))}
      </div>

      <h3>Trophy cabinet</h3>
      {c.trophies.length ? (
        <div className="trophy-shelf">
          {c.trophies.map((t, i) => (
            <div key={i} className={`trophy t${t.tier}`} title={`${t.name}, season ${t.season}`}>
              <span className="cup" aria-hidden="true">
                🏆
              </span>
              <span className="name">{t.name}</span>
              <span className="muted small">S{t.season}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="muted">Empty for now. Your first title is out there.</p>
      )}

      <h3>Career history</h3>
      {seasons.length ? (
        seasons.map((season) => (
          <div key={season} className="history-season">
            <div className="eyebrow">Season {season}</div>
            <ul className="history">
              {c.results
                .filter((r) => r.season === season)
                .map((r, i) => (
                  <li key={i}>
                    <span>{r.name}</span>
                    <span className={r.reached === 'W' ? 'gold' : 'muted'}>
                      {REACHED[r.reached]} · {money(r.prize)}
                    </span>
                  </li>
                ))}
            </ul>
          </div>
        ))
      ) : (
        <p className="muted">No events finished yet.</p>
      )}

      <h3>Recent matches</h3>
      {s.log.length ? (
        <ul className="history">
          {s.log
            .slice(-8)
            .reverse()
            .map((m, i) => (
              <li key={i}>
                <span>
                  <b className={m.won ? 'good' : 'bad'}>{m.won ? 'W' : 'L'}</b> {m.score[0]}–
                  {m.score[1]} v {nameOf(c, m.opponent)}
                </span>
                <span className="muted">
                  {ROUND_NAMES[m.round]} · avg {m.average.toFixed(1)}
                </span>
              </li>
            ))}
        </ul>
      ) : (
        <p className="muted">No matches yet.</p>
      )}

      {confirmRetire ? (
        <button type="button" className="ghost-btn danger" onClick={retire}>
          Really retire? This deletes the career
        </button>
      ) : (
        <button type="button" className="ghost-btn" onClick={() => setConfirmRetire(true)}>
          Retire
        </button>
      )}
    </>
  );
}

/* ---------------------------------------------------------------- bracket */

export function Bracket({ c }: { c: CareerState }) {
  const rounds: (BracketMatch | null)[][] = [...c.event.rounds];
  // Show the whole draw: empty slots for rounds not yet drawn.
  while (rounds.length < 3) rounds.push(Array(4 >> rounds.length).fill(null));
  return (
    <div className="bracket">
      {rounds.map((round, r) => (
        <div key={r} className="bracket-round">
          <div className="field-label">{ROUND_NAMES[r]}</div>
          <div className="bracket-col">
            {round.map((m, k) => (
              <div key={k} className="bracket-match">
                {m ? (
                  [m.a, m.b].map((id, j) => (
                    <div
                      key={id}
                      className={`${m.winner === id ? 'won' : ''}${id === YOU ? ' you' : ''}`}
                    >
                      <span>{nameOf(c, id)}</span>
                      <b>{m.score ? m.score[j] : ''}</b>
                    </div>
                  ))
                ) : (
                  <>
                    <div className="tbd">
                      <span>–</span>
                    </div>
                    <div className="tbd">
                      <span>–</span>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
