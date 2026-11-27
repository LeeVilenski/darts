import type { CSSProperties } from 'react';
import {
  ATTR_INFO,
  ATTRS,
  attrCost,
  levelCost,
  TIER_CAPS,
  type PlayerAttributes,
} from '../../engine/career/attributes';
import { canTrain, DRILLS, type CareerState, type GainReport } from '../../engine/career/career';
import { useCareer } from '../../store/useCareer';

const pct = (x: number) => `${Math.round(Math.min(1, Math.max(0, x)) * 100)}%`;

/** Your four attributes as gauges, with XP to the next point, the tier cap and skill points. */
export function AttributePanel({ c }: { c: CareerState }) {
  const spend = useCareer((s) => s.spendPoint);
  const a = c.attributes;
  if (!a) return null;
  const cap = TIER_CAPS[c.tier]!;
  return (
    <div className="hub-card attrs" data-testid="attributes">
      <div className="attrs-head">
        <div className="level-badge">
          <small>Level</small>
          {a.level}
        </div>
        <div className="level-bar">
          <span className="muted small">
            {a.xp} / {levelCost(a.level)} XP · ceiling {cap}
          </span>
          <div className="progress thin" aria-label="XP to next level">
            <span style={{ width: pct(a.xp / levelCost(a.level)) }} />
          </div>
        </div>
        {a.points > 0 && (
          <span className="chip gold" data-testid="skill-points">
            {a.points} point{a.points === 1 ? '' : 's'}
          </span>
        )}
      </div>
      <div className="gauge-grid">
        {ATTRS.map((attr) => {
          const r = a.ratings[attr];
          const capped = r >= cap;
          const style = {
            '--val': `${(r / 99) * 360}deg`,
            '--cap': `${(cap / 99) * 360}deg`,
          } as CSSProperties;
          return (
            <div key={attr} className={`gauge-tile ${capped ? 'capped' : ''}`}>
              <div className="gauge" style={style}>
                <span className="gauge-val">{r}</span>
              </div>
              <div className="gauge-info">
                <b>{ATTR_INFO[attr].label}</b>
                <div className="progress thin" aria-label="XP to the next point">
                  <span style={{ width: pct(capped ? 1 : a.progress[attr] / attrCost(r)) }} />
                </div>
                <span className="muted small">
                  {capped ? 'At your ceiling' : ATTR_INFO[attr].trainedBy}
                </span>
              </div>
              {a.points > 0 && (
                <button
                  type="button"
                  className="plus"
                  disabled={capped}
                  onClick={() => spend(attr)}
                  aria-label={`Spend a point on ${ATTR_INFO[attr].label}`}
                >
                  +
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Compact ratings for the fixture card. */
export function RatingsLine({ a }: { a: PlayerAttributes }) {
  return (
    <span className="ratings-line">
      {ATTRS.map((attr) => (
        <span key={attr}>
          {ATTR_INFO[attr].label.slice(0, 3).toUpperCase()} <b>{a.ratings[attr]}</b>
        </span>
      ))}
    </span>
  );
}

/** One training session before each event. */
export function TrainingCard({ c }: { c: CareerState }) {
  const train = useCareer((s) => s.train);
  const ready = canTrain(c);
  return (
    <div className="hub-card training" data-testid="training">
      <div className="section-row">
        <div className="eyebrow">Training</div>
        <span className={`chip ${ready ? 'gold' : ''}`}>
          {ready ? '1 session left' : 'Done this week'}
        </span>
      </div>
      <p className="muted small">
        {ready ? 'Pick a drill: it works one attribute hardest.' : 'You can train again next week.'}
      </p>
      <div className="drill-grid">
        {ATTRS.map((attr) => (
          <button
            key={attr}
            type="button"
            className="drill"
            disabled={!ready}
            onClick={() => train(attr)}
            data-testid={`train-${attr}`}
          >
            <span className="drill-val">{c.attributes.ratings[attr]}</span>
            <b>{ATTR_INFO[attr].label}</b>
            <span className="muted small">{DRILLS[attr].name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/** XP gained and attributes raised, after a match or session. */
export function GainStrip({ g }: { g: GainReport }) {
  const best = ATTRS.filter((a) => g.attrs[a] > 0).sort((x, y) => g.attrs[y] - g.attrs[x]);
  return (
    <div className="gain-strip" data-testid="xp-gain">
      <div>
        <b>+{g.player} XP</b>
        {best.length > 0 && (
          <span className="muted">
            {' '}
            · {best.map((a) => `${ATTR_INFO[a].label} +${g.attrs[a]}`).join(' · ')}
          </span>
        )}
      </div>
      {g.raised.map((r) => (
        <div key={r.attr} className="raised">
          ▲ {ATTR_INFO[r.attr].label} {r.from} → {r.to}
        </div>
      ))}
      {g.levelsGained > 0 && (
        <div className="raised gold">
          Level up! +{g.levelsGained * 2} skill points to spend in your profile
        </div>
      )}
    </div>
  );
}
