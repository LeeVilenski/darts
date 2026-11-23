import type { BounceSetting, HitResult } from '../engine/board/resolveHit';
import { ASSIST, type AssistLevel } from '../engine/physics/throwModel';
import { DARTS_PER_TURN, useGameStore, type ThrownDart } from '../store/useGameStore';

const resultLabel = (r: HitResult) =>
  r.kind === 'score'
    ? r.label === 'BULL'
      ? 'Bull'
      : r.label
    : r.kind === 'bounce'
      ? 'Bounce out'
      : 'Miss';

const points = (d: ThrownDart) => (d.result.kind === 'score' ? d.result.points : 0);

function powerFeedback(d: ThrownDart, assist: AssistLevel): string {
  const err = d.launch.power - 1;
  const dz = ASSIST[assist].powerDeadZone;
  if (Math.abs(err) <= dz) return 'Good weight';
  return err > 0 ? 'Too hard' : 'Too soft';
}

export function Hud() {
  const darts = useGameStore((s) => s.darts);
  const phase = useGameStore((s) => s.phase);
  const session = useGameStore((s) => s.session);
  const assist = useGameStore((s) => s.assist);
  const bounce = useGameStore((s) => s.bounce);
  const setAssist = useGameStore((s) => s.setAssist);
  const setBounce = useGameStore((s) => s.setBounce);

  const landed = darts.filter((d) => d.landed);
  const last = landed[landed.length - 1];
  const turnTotal = landed.reduce((s, d) => s + points(d), 0);
  const avg = session.darts ? ((session.points / session.darts) * 3).toFixed(1) : '–';

  return (
    <div className="hud">
      <header className="hud-top">
        <div className="score-card" aria-live="polite">
          <div className="last" data-testid="last-score">
            {last ? resultLabel(last.result) : '—'}
            {last && last.result.kind === 'score' && (
              <span className="pts">{last.result.points}</span>
            )}
          </div>
          <div className="turn">
            <span className="dots" aria-label={`${DARTS_PER_TURN - darts.length} darts left`}>
              {Array.from({ length: DARTS_PER_TURN }, (_, i) => (
                <i key={i} className={i < darts.length ? 'used' : ''} />
              ))}
            </span>
            <span>
              Turn <b data-testid="turn-total">{turnTotal}</b>
            </span>
            <span className="muted">3-dart avg {avg}</span>
          </div>
          {last && <div className="feedback muted">{powerFeedback(last, assist)}</div>}
        </div>
      </header>

      <footer className="hud-bottom">
        {phase === 'turnOver' ? (
          <div className="banner">
            Turn total <b>{turnTotal}</b> · tap to collect darts
          </div>
        ) : (
          <div className="hint">Drag to aim · flick up to throw</div>
        )}
        <div className="settings" onPointerDown={(e) => e.stopPropagation()}>
          <Segmented
            label="Assist"
            value={assist}
            options={['casual', 'standard', 'pro'] as const}
            onChange={setAssist}
          />
          <Segmented
            label="Bounce-outs"
            value={bounce}
            options={['realistic', 'low', 'off'] as const}
            onChange={(b: BounceSetting) => setBounce(b)}
          />
        </div>
      </footer>
    </div>
  );
}

function Segmented<T extends string>(props: {
  label: string;
  value: T;
  options: readonly T[];
  onChange(v: T): void;
}) {
  return (
    <div className="segmented" role="radiogroup" aria-label={props.label}>
      <span className="seg-label">{props.label}</span>
      {props.options.map((o) => (
        <button
          key={o}
          role="radio"
          aria-checked={props.value === o}
          className={props.value === o ? 'on' : ''}
          onClick={() => props.onChange(o)}
        >
          {o}
        </button>
      ))}
    </div>
  );
}
