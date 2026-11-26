import { useMemo } from 'react';
import { aiTuning } from '../../engine/ai/skill';
import type { StuckDart } from '../../engine/board/collision';
import { resolveDart, stuckDartOf } from '../../engine/physics/resolveDart';
import { computeLaunch, PERFECT_FLICK } from '../../engine/physics/throwModel';
import { createRng } from '../../engine/rng';
import type { ThrownDart } from '../../store/useGameStore';
import { FlyingDart } from './Dart';

/** Where the menu's three darts sit: a tidy treble-20 group (board mm). */
const GROUP = [
  { x: -5, y: 104 },
  { x: 6, y: 101 },
  { x: 1, y: 112 },
];

/** Three darts already in the treble 20, as a backdrop for the menu. */
export function MenuDarts() {
  const darts = useMemo(() => {
    const out: ThrownDart[] = [];
    const stuck: StuckDart[] = [];
    GROUP.forEach((aim, i) => {
      const launch = computeLaunch(aim, PERFECT_FLICK, aiTuning(0), createRng(i + 1));
      const d = resolveDart(launch, stuck, createRng(i + 1), 'off');
      const left = stuckDartOf(d);
      if (left) stuck.push(left);
      out.push({ id: -100 - i, launch, ...d, landed: true });
    });
    return out;
  }, []);
  return (
    <>
      {darts.map((d) => (
        <FlyingDart key={d.id} dart={d} onLanded={() => {}} trackerId={d.id} />
      ))}
    </>
  );
}
