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

/** Your four attributes with XP bars, the tier cap, and skill points to spend. */
export function AttributePanel({ c }: { c: CareerState }) {
  const spend = useCareer((s) => s.spendPoint);
  const a = c.attributes;
  if (!a) return null;
  const cap = TIER_CAPS[c.tier]!;
  return (
    <div className="hub-card attrs" data-testid="attributes">
      <div className="attrs-head">
        <div>
          <div className="eyebrow">Level {a.level}</div>
          <div className="progress thin" aria-label="XP to next level">
            <span style={{ width: pct(a.xp / levelCost(a.level)) }} />
          </div>
        </div>
        {a.points > 0 && (
          <span className="chip gold" data-testid="skill-points">
            {a.points} skill point{a.points === 1 ? '' : 's'}
          </span>
        )}
      </div>
      {ATTRS.map((attr) => {
        const r = a.ratings[attr];
        const capped = r >= cap;
        return (
          <div key={attr} className="attr">
            <div className="attr-top">
              <b>{ATTR_INFO[attr].label}</b>
              <span className="attr-val">{r}</span>
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
            <div className="attr-bar" aria-hidden="true">
              <span className="fill" style={{ width: pct(r / 99) }} />
              <span
                className="next"
                style={{ left: pct(r / 99), width: pct(a.progress[attr] / attrCost(r) / 99) }}
              />
              <span className="cap" style={{ left: pct(cap / 99) }} />
            </div>
            <div className="muted small">
              {capped
                ? `At your ceiling of ${cap}. Move up a tier to go further.`
                : `${ATTR_INFO[attr].blurb} Trained by: ${ATTR_INFO[attr].trainedBy.toLowerCase()}.`}
            </div>
          </div>
        );
      })}
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
      <div className="eyebrow">Training</div>
      <p>
        {ready
          ? 'One session before your next match. Pick a drill: it works one attribute hardest.'
          : 'Trained for this event. You can train again before the next one.'}
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
