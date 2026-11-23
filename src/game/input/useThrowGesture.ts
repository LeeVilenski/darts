import { useEffect, type RefObject } from 'react';
import { analyzeFlick, type PointerSample } from '../../engine/physics/gesture';
import { currentAi, useGameStore } from '../../store/useGameStore';
import { visibleHalfHeight } from '../scene/camera';

/** Aim moves slower than the finger for fine control (fraction of 1:1 on-screen mapping). */
const AIM_SENSITIVITY = 0.5;
const HISTORY_MS = 1000;

/**
 * Aim-then-flick input on a DOM element layered over the canvas.
 * Drag to move the aim (relative), flick upward and release to throw.
 * A slow release only finishes aiming.
 */
export function useThrowGesture(el: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const node = el.current;
    if (!node) return;
    let pointerId: number | null = null;
    let last: { x: number; y: number } | null = null;
    let trail: PointerSample[] = [];
    let aimTrail: { t: number; x: number; y: number }[] = [];

    const mmPerPx = () => {
      const h = node.clientHeight || window.innerHeight;
      const aspect = (node.clientWidth || window.innerWidth) / h;
      return ((2 * visibleHalfHeight(aspect) * 1000) / h) * AIM_SENSITIVITY;
    };

    const record = (x: number, y: number, t: number) => {
      const store = useGameStore.getState();
      if (last) {
        const k = mmPerPx();
        store.setAim({ x: store.aim.x + (x - last.x) * k, y: store.aim.y - (y - last.y) * k });
      }
      last = { x, y };
      trail.push({ x, y, t });
      const aim = useGameStore.getState().aim;
      aimTrail.push({ t, x: aim.x, y: aim.y });
      const cutoff = t - HISTORY_MS;
      if (trail[0] && trail[0].t < cutoff) trail = trail.filter((s) => s.t >= cutoff);
      if (aimTrail[0] && aimTrail[0].t < cutoff) aimTrail = aimTrail.filter((s) => s.t >= cutoff);
    };

    const down = (e: PointerEvent) => {
      let store = useGameStore.getState();
      if (store.screen !== 'game') return;
      if (store.phase === 'replay') {
        store.finishReplay();
        return;
      }
      if (store.phase === 'turnOver') {
        store.collectDarts();
        return;
      }
      // The AI throws its own darts; tapping can still collect them (above).
      if (currentAi(store)) return;
      // Touching during the impact close-up skips it and starts aiming straight away.
      if (store.phase === 'impact') store.finishImpact();
      store = useGameStore.getState();
      if (store.phase !== 'aiming' || pointerId !== null) return;
      pointerId = e.pointerId;
      try {
        node.setPointerCapture(e.pointerId);
      } catch {
        /* synthetic or already-released pointer: capture is best-effort */
      }
      last = null;
      trail = [];
      aimTrail = [];
      record(e.clientX, e.clientY, e.timeStamp);
      e.preventDefault();
    };

    const move = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) return;
      const events = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : [];
      for (const ce of events.length ? events : [e]) record(ce.clientX, ce.clientY, ce.timeStamp);
    };

    const up = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) return;
      pointerId = null;
      record(e.clientX, e.clientY, e.timeStamp);
      const flick = analyzeFlick(trail, node.clientHeight || window.innerHeight);
      const store = useGameStore.getState();
      // In power-meter mode dragging only aims; the Throw button throws.
      if (!flick.isThrow || store.throwControl === 'meter') return;
      // Use the aim from just before the flick began, so the flick itself doesn't drag the aim.
      let aim = aimTrail[0] ?? { ...store.aim, t: 0 };
      for (const a of aimTrail) if (a.t < flick.flickStart) aim = a;
      store.setAim({ x: aim.x, y: aim.y });
      store.throwDart(useGameStore.getState().aim, flick);
    };

    const cancel = (e: PointerEvent) => {
      if (e.pointerId === pointerId) pointerId = null;
    };

    node.addEventListener('pointerdown', down);
    node.addEventListener('pointermove', move);
    node.addEventListener('pointerup', up);
    node.addEventListener('pointercancel', cancel);
    return () => {
      node.removeEventListener('pointerdown', down);
      node.removeEventListener('pointermove', move);
      node.removeEventListener('pointerup', up);
      node.removeEventListener('pointercancel', cancel);
    };
  }, [el]);
}
