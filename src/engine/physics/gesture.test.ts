import { describe, expect, it } from 'vitest';
import { analyzeFlick, ARM_MS, STEADY_MS, SteadyTracker, type PointerSample } from './gesture';

const H = 800; // viewport height (px)

/** Feed a tracker a pointer path (first sample is the press) and ask about the release. */
function released(path: PointerSample[]) {
  const st = new SteadyTracker();
  const [first, ...rest] = path;
  st.start(first!.x, first!.y, first!.t, H);
  for (const s of rest) st.add(s.x, s.y, s.t);
  const end = path[path.length - 1]!;
  return { armed: st.armed(end.t), flick: analyzeFlick(path, H) };
}

/** Straight-line motion from (x, y) at time t, in px/ms, sampled every 8 ms. */
const move = (x: number, y: number, t: number, vx: number, vy: number, ms: number) =>
  Array.from({ length: Math.round(ms / 8) }, (_, i) => ({
    x: x + vx * (i + 1) * 8,
    y: y + vy * (i + 1) * 8,
    t: t + (i + 1) * 8,
  }));
const hold = (x: number, y: number, t: number, ms: number) => [{ x, y, t: t + ms }];

describe('SteadyTracker: telling aiming from throwing', () => {
  it('press and flick straight away is a throw', () => {
    const path = [{ x: 200, y: 600, t: 0 }, ...move(200, 600, 0, 0, -2, 96)];
    const r = released(path);
    expect(r.flick.isThrow).toBe(true);
    expect(r.armed).toBe(true);
  });

  it('aim, hold still, then flick is a throw', () => {
    const aimDrag = move(200, 600, 0, 0.4, -0.4, 400);
    const p = aimDrag[aimDrag.length - 1]!;
    const still = hold(p.x, p.y, p.t, STEADY_MS + 30);
    const s = still[0]!;
    const path = [
      { x: 200, y: 600, t: 0 },
      ...aimDrag,
      ...still,
      ...move(s.x, s.y, s.t, 0, -2, 96),
    ];
    const r = released(path);
    expect(r.flick.isThrow).toBe(true);
    expect(r.armed).toBe(true);
  });

  it('lifting off part-way through a fast upward aiming drag is NOT a throw', () => {
    // Sliding the aim from the bull up to the treble quickly, and letting go while still moving:
    // fast and upward enough to look like a flick, but there was no steady aim before it.
    const path = [{ x: 200, y: 600, t: 0 }, ...move(200, 600, 0, 0, -1.2, 500)];
    const r = released(path);
    expect(r.flick.isThrow).toBe(true); // the old rule alone would have thrown
    expect(r.armed).toBe(false);
  });

  it('a brief stop shorter than the steady time does not arm a throw', () => {
    const drag = move(200, 600, 0, 0.6, 0, 400);
    const p = drag[drag.length - 1]!;
    const blip = hold(p.x, p.y, p.t, STEADY_MS - 60);
    const b = blip[0]!;
    const path = [{ x: 200, y: 600, t: 0 }, ...drag, ...blip, ...move(b.x, b.y, b.t, 0, -2, 96)];
    expect(released(path).armed).toBe(false);
  });

  it('small jitter while holding still still counts as steady', () => {
    const st = new SteadyTracker();
    st.start(200, 600, 0, H);
    for (let t = 8; t <= 400; t += 8) st.add(200 + ((t / 8) % 3) - 1, 600 + ((t / 8) % 2), t);
    expect(st.steady(400)).toBe(true);
    expect(st.armed(400)).toBe(true);
  });

  it('a slow wind-up after a steady aim disarms once it takes too long', () => {
    const st = new SteadyTracker();
    st.start(200, 600, 0, H);
    st.add(200, 600, STEADY_MS + 50); // steady
    // Start moving again and keep moving for longer than ARM_MS.
    let t = STEADY_MS + 60;
    let y = 600;
    st.add(200, (y -= 20), t);
    expect(st.armed(t)).toBe(true);
    for (; t < STEADY_MS + 60 + ARM_MS + 100; t += 8) st.add(200, (y -= 12), t);
    expect(st.armed(t)).toBe(false);
  });
});
