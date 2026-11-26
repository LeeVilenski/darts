import { useState } from 'react';
import { describePersonality, personalityFor } from '../engine/ai/personality';
import { AI_SKILL } from '../engine/ai/skill';
import { nameOf, nextMatch, standings, YOU, type CareerState } from '../engine/career/career';
import {
  describeFormat,
  EVENTS_PER_SEASON,
  PROMOTION_PLACES,
  ROUND_NAMES,
  TIERS,
  type Reached,
} from '../engine/career/tiers';
import { useCareer } from '../store/useCareer';

const REACHED: Record<Reached, string> = {
  QF: 'Quarter-finals',
  SF: 'Semi-finals',
  F: 'Runner-up',
  W: 'Winner',
};
const money = (n: number) => `£${n.toLocaleString('en-GB')}`;
const ordinal = (n: number) =>
  `${n}${n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th'}`;

/** Career mode: your tour, your next match, the order of merit and your trophies. */
export function CareerSheet() {
  const career = useCareer((s) => s.career);
  const setOpen = useCareer((s) => s.setOpen);
  return (
    <div className="sheet-backdrop" onPointerDown={(e) => e.stopPropagation()}>
      <div className="sheet career" role="dialog" aria-label="Career" data-testid="career">
        {career ? <CareerView career={career} /> : <NewCareer />}
        <button type="button" className="ghost-btn" onClick={() => setOpen(false)}>
          Back to menu
        </button>
      </div>
    </div>
  );
}

function NewCareer() {
  const start = useCareer((s) => s.start);
  const [name, setName] = useState('');
  return (
    <>
      <h2>Career</h2>
      <p className="muted">
        Start in the Pub League and work your way up to the Pro Tour. Each season has{' '}
        {EVENTS_PER_SEASON} knockout events; finish in the top {PROMOTION_PLACES} of the order of
        merit to move up a tier.
      </p>
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
    </>
  );
}

function CareerView({ career: c }: { career: CareerState }) {
  const play = useCareer((s) => s.play);
  const retire = useCareer((s) => s.retire);
  const dismiss = useCareer((s) => s.dismissSeason);
  const [confirmRetire, setConfirmRetire] = useState(false);
  const tier = TIERS[c.tier]!;
  const next = nextMatch(c);
  const table = standings(c);
  const last = c.results.at(-1);

  return (
    <>
      <h2>{c.you}</h2>
      <p className="muted">
        {tier.name} · Season {c.season} · Event {c.eventIndex + 1} of {EVENTS_PER_SEASON} · Earnings{' '}
        {money(c.earnings)}
      </p>

      {c.lastSeason && (
        <div className="career-banner" data-testid="season-summary">
          <b>
            Season {c.lastSeason.season}: {ordinal(c.lastSeason.position)} in the{' '}
            {TIERS[c.lastSeason.tier]!.name}.
          </b>{' '}
          {c.lastSeason.promoted
            ? `Promoted to the ${TIERS[c.tier]!.name}!`
            : c.lastSeason.tier === TIERS.length - 1
              ? 'Another season on the Pro Tour.'
              : `Top ${PROMOTION_PLACES} go up; another go at the ${tier.name}.`}
          <button type="button" className="ghost-btn small" onClick={dismiss}>
            OK
          </button>
        </div>
      )}
      {last && !c.lastSeason && (
        <p className="career-last">
          Last time: {last.name}, {REACHED[last.reached].toLowerCase()} (+{last.points} pts,{' '}
          {money(last.prize)})
        </p>
      )}

      <h3>{c.event.name}</h3>
      {next ? (
        <div className="next-match" data-testid="next-match">
          <div className="muted">{ROUND_NAMES[next.round]}</div>
          <div className="versus">
            {c.you} <span className="muted">v</span> {next.opponent.name}
          </div>
          <div className="muted">
            {AI_SKILL[next.opponent.level].label} ·{' '}
            {describePersonality(personalityFor(next.opponent.name))}
          </div>
          <div className="muted">501 · {describeFormat(next.format)} · bull-up to throw first</div>
          <button type="button" className="primary-btn" onClick={play} data-testid="career-play">
            Play {ROUND_NAMES[next.round]!.toLowerCase()}
          </button>
        </div>
      ) : null}
      <Bracket c={c} />

      <h3>Order of merit</h3>
      <table className="stats merit">
        <tbody>
          {table.map((row, i) => (
            <tr key={row.id} className={row.id === YOU ? 'you' : ''}>
              <td>{i + 1}</td>
              <th scope="row">{row.name}</th>
              <td>{row.points}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3>Trophy cabinet</h3>
      {c.trophies.length ? (
        <ul className="trophies">
          {c.trophies.map((t, i) => (
            <li key={i}>
              🏆 {t.name} <span className="muted">· season {t.season}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">Empty for now.</p>
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

function Bracket({ c }: { c: CareerState }) {
  return (
    <div className="bracket">
      {c.event.rounds.map((round, r) => (
        <div key={r} className="bracket-round">
          <div className="field-label">{ROUND_NAMES[r]}</div>
          {round.map((m, k) => (
            <div key={k} className="bracket-match">
              {[m.a, m.b].map((id, j) => (
                <div
                  key={id}
                  className={`${m.winner === id ? 'won' : ''}${id === YOU ? ' you' : ''}`}
                >
                  <span>{nameOf(c, id)}</span>
                  <b>{m.score ? m.score[j] : ''}</b>
                </div>
              ))}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
