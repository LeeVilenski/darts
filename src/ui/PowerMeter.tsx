import { ASSIST } from '../engine/physics/throwModel';
import {
  METER_HALF_PERIOD_MS,
  releaseCharge,
  startCharge,
  sweetBand,
  useCharge,
  cancelCharge,
} from '../game/input/powerMeter';
import { currentAi, useGameStore } from '../store/useGameStore';

/** Power bar while charging, and (in meter mode) a hold-to-throw button. */
export function PowerMeter() {
  const charging = useCharge((s) => s.start !== null);
  const meterMode = useGameStore((s) => s.throwControl === 'meter');
  const assist = useGameStore((s) => s.assist);
  const canThrow = useGameStore(
    (s) => (s.phase === 'aiming' || s.phase === 'impact') && !currentAi(s),
  );
  const [lo, hi] = sweetBand(ASSIST[assist].powerDeadZone);

  return (
    <div className="power">
      {charging && (
        <div className="meter" role="meter" aria-label="Throw power" data-testid="power-meter">
          <div className="sweet" style={{ left: `${lo * 100}%`, width: `${(hi - lo) * 100}%` }} />
          <div className="fill" style={{ animationDuration: `${METER_HALF_PERIOD_MS}ms` }} />
        </div>
      )}
      {meterMode && canThrow && (
        <button
          type="button"
          className="primary-btn throw-btn"
          data-testid="throw-btn"
          onPointerDown={(e) => {
            e.stopPropagation();
            const s = useGameStore.getState();
            if (s.phase === 'impact') s.finishImpact();
            startCharge();
          }}
          onPointerUp={(e) => {
            e.stopPropagation();
            releaseCharge();
          }}
          onPointerCancel={cancelCharge}
          onContextMenu={(e) => e.preventDefault()}
        >
          Hold to throw
        </button>
      )}
    </div>
  );
}
