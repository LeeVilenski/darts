import { useState } from 'react';
import { describePersonality, personalityFor } from '../../engine/ai/personality';
import { AI_SKILL } from '../../engine/ai/skill';
import {
  describeReached,
  eligibility,
  eventById,
  holdsCard,
  nameOf,
  nextMatch,
  ordinal,
  playerById,
  resultFor,
  standings,
  tourPosition,
  weekEvents,
  YOU,
  type BracketMatch,
  type CalEvent,
  type CareerState,
  type LiveEvent,
} from '../../engine/career/career';
import {
  CIRCUIT_INFO,
  CIRCUITS,
  describeFormat,
  prizeShare,
  roundNames,
  TOUR_CARD_KEEP,
  WEEKS_PER_SEASON,
  type CircuitId,
} from '../../engine/career/circuits';
import { goals } from '../../engine/career/goals';
import { careerAverage, form, winRate } from '../../engine/career/stats';
import { appearanceFor } from '../../game/scene/appearance';
import { useCareer } from '../../store/useCareer';
import { Icon } from '../icons';
import { Segmented } from '../Segmented';
import { AttributePanel, RatingsLine, TrainingCard } from './Attributes';

type Tab = 'home' | 'calendar' | 'rankings' | 'profile';
const TABS: { id: Tab; label: string }[] = [
  { id: 'home', label: 'Home' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'rankings', label: 'Rankings' },
  { id: 'profile', label: 'Profile' },
];

/** Visual theme per stage: chalk and wood at the pub up to broadcast gold on tour. */
const THEMES = ['pub', 'county', 'challenge', 'tour'] as const;
export const STAGE_NAMES = CIRCUITS.map((c) => CIRCUIT_INFO[c].name);
const VENUES = { pub: 'The pub', hall: 'County hall', floor: 'Floor event', stage: 'TV stage' };

export const money = (n: number) => `£${n.toLocaleString('en-GB')}`;
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;
const pct = (x: number) => `${Math.round(Math.min(1, Math.max(0, x)) * 100)}%`;

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
              {STAGE_NAMES[career.tier]} · Season {career.season} · Week {career.week}
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
          Every pro started down the pub. Begin at your local and work your way up: a County card,
          the Challenge Tour, Q-School, and a <b>Tour Card</b>.
        </p>
        <p className="muted">
          A season is {WEEKS_PER_SEASON} weeks. Each week, pick an event you&apos;re eligible for
          (or rest) and squeeze in a training session. Your throwing starts rough: play and train to
          improve it.
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
  const dismiss = useCareer((s) => s.dismissSeason);
  const next = nextMatch(c);
  const live = c.event ?? c.lastEvent;
  const liveEvent = live ? eventById(c, live.id) : null;

  return (
    <>
      {c.lastSeason && (
        <div className="hub-card season-review" data-testid="season-summary">
          <div className="eyebrow">Season {c.lastSeason.season} review</div>
          {c.lastSeason.places.map((p) => (
            <div key={p.circuit} className="big">
              {ordinal(p.position)} of {p.of} · {CIRCUIT_INFO[p.circuit].name}
            </div>
          ))}
          <p>
            {c.lastSeason.changes.length
              ? c.lastSeason.changes.join('. ') + '.'
              : `Another season as a ${STAGE_NAMES[c.tier]} player.`}
          </p>
          <button type="button" className="primary-btn small" onClick={dismiss}>
            Start season {c.season}
          </button>
        </div>
      )}

      {next ? <Fixture c={c} /> : <ThisWeek c={c} />}
      <TrainingCard c={c} />

      <div className="hub-row">
        <div className="hub-card stat-card">
          <div className="eyebrow">Form</div>
          <FormStrip results={form(c.stats, 5)} />
        </div>
        <button type="button" className="hub-card stat-card link" onClick={() => onTab('rankings')}>
          <MyStanding c={c} />
        </button>
      </div>

      {goals(c).map((g) => (
        <div key={g.title} className="hub-card goal">
          <div className="eyebrow">Goal</div>
          <b>{g.title}</b>
          <p className="muted">{g.detail}</p>
          {g.progress !== null && (
            <div className="progress" aria-hidden="true">
              <span style={{ width: pct(g.progress) }} />
            </div>
          )}
        </div>
      ))}

      {live && liveEvent && (
        <>
          <h3>
            {c.event ? '' : 'Last time: '}
            {liveEvent.name}
          </h3>
          <Bracket c={c} live={live} field={liveEvent.field} />
        </>
      )}
    </>
  );
}

function MyStanding({ c }: { c: CareerState }) {
  if (holdsCard(c, 'tour')) {
    const pos = tourPosition(c);
    return (
      <>
        <div className="eyebrow">Tour ranking</div>
        <div className="big">{pos ? ordinal(pos) : '–'}</div>
      </>
    );
  }
  const circuit: CircuitId = c.cards.challenge ? 'challenge' : c.cards.county ? 'county' : 'pub';
  const table = standings(c, circuit);
  const pos = table.findIndex((s) => s.id === YOU) + 1;
  return (
    <>
      <div className="eyebrow">{CIRCUIT_INFO[circuit].short} merit</div>
      <div className="big">
        {ordinal(pos)}{' '}
        <span className="muted small">· {plural(c.merit[circuit][YOU] ?? 0, 'pt')}</span>
      </div>
    </>
  );
}

/** No event entered yet: this week's events, with Enter or why you can't. */
function ThisWeek({ c }: { c: CareerState }) {
  const enter = useCareer((s) => s.enter);
  const skip = useCareer((s) => s.skipWeek);
  const events = weekEvents(c).filter((e) => relevant(c, e) || eligibility(c, e).ok);
  const open = events.filter((e) => eligibility(c, e).ok);
  return (
    <div className="hub-card fixture" data-testid="this-week">
      <div className="eyebrow">
        Week {c.week} of {WEEKS_PER_SEASON}
      </div>
      <b>{open.length ? 'Pick your event this week' : 'Nothing for you this week'}</b>
      <ul className="week-events">
        {events.map((e) => {
          const ok = eligibility(c, e);
          return (
            <li key={e.id} className={ok.ok ? '' : 'locked'}>
              <div className="cal-main">
                <span>
                  <CircuitTag circuit={e.circuit} />
                </span>
                <b>{e.name}</b>
                <span className="muted small">
                  {e.field} players · {VENUES[e.venue]}
                  {e.prize ? ` · ${money(e.prize)} to the winner` : ''}
                </span>
                {!ok.ok && <span className="lock-reason">🔒 {ok.reason}</span>}
                {ok.ok && ok.via === 'invite' && (
                  <span className="gold small">You have a place</span>
                )}
              </div>
              {ok.ok && (
                <button
                  type="button"
                  className="primary-btn small"
                  onClick={() => enter(e.id)}
                  data-testid={`enter-${e.slug}`}
                >
                  {ok.via === 'fee' ? `Enter (${money(e.fee ?? 0)})` : 'Enter'}
                </button>
              )}
            </li>
          );
        })}
      </ul>
      <button type="button" className="ghost-btn" onClick={skip} data-testid="skip-week">
        {open.length ? 'Skip this week' : 'Rest and move on'}
      </button>
    </div>
  );
}

function Fixture({ c }: { c: CareerState }) {
  const play = useCareer((s) => s.play);
  const next = nextMatch(c)!;
  const e = next.event;
  return (
    <div className="hub-card fixture" data-testid="next-match">
      <div className="eyebrow">
        {e.name} · {next.roundName} · {VENUES[e.venue]}
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
        <div>
          <dt>Your game</dt>
          <dd>
            <RatingsLine a={c.attributes} />
          </dd>
        </div>
        <div>
          <dt>Head to head</dt>
          <dd>{h2hLine(c.stats.h2h[next.opponent.id])}</dd>
        </div>
        <div>
          <dt>Format</dt>
          <dd>501 · {describeFormat(next.format)} · bull-up to throw first</dd>
        </div>
        <div>
          <dt>At stake</dt>
          <dd>{stakeLine(e, next.round)}</dd>
        </div>
      </dl>
      <button type="button" className="primary-btn" onClick={play} data-testid="career-play">
        Play {next.roundName.toLowerCase()}
      </button>
    </div>
  );
}

function h2hLine(r: [number, number] | undefined) {
  if (!r || r[0] + r[1] === 0) return 'First meeting';
  const [w, l] = r;
  return `${w}–${l}${w > l ? ' to you' : w < l ? ' to them' : ''}`;
}

function stakeLine(e: CalEvent, round: number) {
  const rounds = roundNames(e.field).length;
  const pts = CIRCUIT_INFO[e.circuit].points(e.field);
  if (e.kind === 'qschool')
    return round >= rounds - 3
      ? 'Win this for a Tour Card'
      : round === rounds - 4
        ? 'Win for a Challenge Tour card, and a shot at a Tour Card'
        : 'Keep going: the last 4 win Tour Cards';
  if (e.kind === 'qualifier')
    return round >= rounds - 2
      ? 'Reach the final for a place in the major'
      : 'A step closer to the major';
  const tour = e.circuit === 'tour';
  if (round === rounds - 1)
    return `The title${tour ? '' : `, ${pts[rounds]} pts`} and ${money(e.prize)}`;
  const prize = Math.round(e.prize * prizeShare(rounds, round + 1));
  const next = roundNames(e.field)[round + 1]!.toLowerCase();
  return `A place in the ${next}${tour ? '' : `: ${pts[round + 1]} pts`} and ${money(prize)} guaranteed`;
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

function CircuitTag({ circuit }: { circuit: CircuitId }) {
  return <span className={`circuit-tag ${circuit}`}>{CIRCUIT_INFO[circuit].short}</span>;
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
  const [filter, setFilter] = useState<'mine' | 'all'>('mine');
  const weeks = Array.from({ length: WEEKS_PER_SEASON }, (_, i) => i + 1);
  return (
    <>
      <Segmented<'mine' | 'all'>
        label={`Season ${c.season}`}
        value={filter}
        options={[
          { value: 'mine', label: 'My circuits' },
          { value: 'all', label: 'Everything' },
        ]}
        onChange={setFilter}
      />
      <ol className="calendar weeks">
        {weeks.map((w) => {
          const events = weekEvents(c, w).filter(
            (e) => filter === 'all' || relevant(c, e) || resultFor(c, e.id),
          );
          return (
            <li key={w} className={`week ${w === c.week ? 'current' : w < c.week ? 'done' : ''}`}>
              <span className="cal-num">{w}</span>
              <div className="week-list">
                {events.length === 0 && (
                  <span className="muted small">Nothing on your circuits</span>
                )}
                {events.map((e) => (
                  <CalendarEvent key={e.id} c={c} e={e} />
                ))}
              </div>
            </li>
          );
        })}
      </ol>
    </>
  );
}

/** Events on your circuits, or one step up (so you can see what's next). */
function relevant(c: CareerState, e: CalEvent): boolean {
  if (e.kind === 'qschool') return c.tier >= 1 && c.tier < 3;
  if (c.tier >= 2 && e.circuit === 'pub') return false;
  return CIRCUIT_INFO[e.circuit].stage <= c.tier + 1;
}

function CalendarEvent({ c, e }: { c: CareerState; e: CalEvent }) {
  const mine = resultFor(c, e.id);
  const ok = eligibility(c, e);
  const entered = c.event?.id === e.id;
  const locked = !ok.ok && !mine && !e.result;
  const chip = mine
    ? describeReached(mine)
    : entered
      ? 'Playing'
      : e.result
        ? `Won by ${nameOf(c, e.result.winner).split(' ').at(-1)}`
        : ok.ok
          ? 'Open to you'
          : '🔒';
  return (
    <div
      className={`cal-event ${mine ? 'done' : ''} ${locked ? 'locked' : ''}`}
      data-testid="calendar-event"
    >
      <div className="cal-main">
        <span>
          <CircuitTag circuit={e.circuit} />
        </span>
        <b>{e.name}</b>
        <span className="muted small">
          {e.field} players · final {describeFormat(e.formats.at(-1)!).toLowerCase()}
          {e.prize ? ` · ${money(e.prize)}` : ''}
        </span>
        {locked && !ok.ok && <span className="lock-reason">{ok.reason}</span>}
      </div>
      <span
        className={`chip ${mine && mine.round === roundNames(mine.field).length ? 'gold' : ''}`}
      >
        {chip}
      </span>
    </div>
  );
}

/* ---------------------------------------------------------------- rankings */

const CUTS: Record<CircuitId, [number, string][]> = {
  pub: [
    [2, 'County card'],
    [8, 'Finals Night'],
  ],
  county: [
    [2, 'Challenge card'],
    [16, 'County Championship'],
  ],
  challenge: [
    [2, 'Tour Card'],
    [16, 'Challenge Finals'],
  ],
  tour: [
    [14, 'Majors'],
    [TOUR_CARD_KEEP, 'Keeps card'],
  ],
};

function RankingsTab({ c }: { c: CareerState }) {
  const start: CircuitId = holdsCard(c, 'tour')
    ? 'tour'
    : c.cards.challenge
      ? 'challenge'
      : c.cards.county
        ? 'county'
        : 'pub';
  const [circuit, setCircuit] = useState<CircuitId>(start);
  const table = standings(c, circuit);
  const tour = circuit === 'tour';
  const cutAt = new Map(CUTS[circuit]);
  return (
    <>
      <Segmented<CircuitId>
        label="Table"
        value={circuit}
        options={CIRCUITS.map((x) => ({ value: x, label: CIRCUIT_INFO[x].short }))}
        onChange={setCircuit}
      />
      <p className="muted small">
        {tour
          ? 'Prize money over the last two seasons.'
          : `Order of merit after week ${c.week - 1}.`}{' '}
        {CUTS[circuit].map(([n, what]) => `Top ${n}: ${what}`).join(' · ')}
      </p>
      <table className="stats merit" data-testid="merit">
        <tbody>
          {table.map((row, i) => (
            <tr
              key={row.id}
              className={`${row.id === YOU ? 'you' : ''}${cutAt.has(i + 1) ? ' cut' : ''}`}
            >
              <td>{i + 1}</td>
              <th scope="row">{row.name}</th>
              <td className="muted small">
                {row.id === YOU ? '' : AI_SKILL[playerById(c, row.id)!.level].label}
              </td>
              <td>{tour ? money(row.points) : row.points}</td>
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
  const s = c.stats;
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
  const cards = [
    c.cards.county && 'County card',
    c.cards.challenge && 'Challenge Tour card',
    holdsCard(c, 'tour') && `Tour Card (to season ${c.cards.tour})`,
  ].filter(Boolean) as string[];

  return (
    <>
      <div className="hub-card profile-head">
        <PlayerBadge name={c.you} size={64} />
        <div>
          <div className="big">{c.you}</div>
          <div className="muted small">
            {STAGE_NAMES[c.tier]} · season {c.season} · {money(c.earnings)} won
          </div>
          <div className="card-badges">
            {cards.length ? (
              cards.map((x) => (
                <span key={x} className="chip gold">
                  {x}
                </span>
              ))
            ) : (
              <span className="chip">Amateur</span>
            )}
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
                    <span className={r.round === roundNames(r.field).length ? 'gold' : 'muted'}>
                      {describeReached(r)} · {money(r.prize)}
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
                  {m.score[1]} v {m.opponentName ?? nameOf(c, m.opponent)}
                </span>
                <span className="muted">
                  {m.roundName ?? m.event} · avg {m.average.toFixed(1)}
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

export function Bracket({ c, live, field }: { c: CareerState; live: LiveEvent; field: number }) {
  const names = roundNames(field);
  const rounds: (BracketMatch | null)[][] = [...live.rounds];
  // Show the whole draw: empty slots for rounds not yet drawn.
  while (rounds.length < names.length) rounds.push(Array(field >> (rounds.length + 1)).fill(null));
  return (
    <div className="bracket">
      {rounds.map((round, r) => (
        <div key={r} className="bracket-round">
          <div className="field-label">{names[r]}</div>
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
