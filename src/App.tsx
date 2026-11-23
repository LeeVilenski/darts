import { lazy, Suspense } from 'react';

// The 3D scene (three.js + R3F) lives in its own chunk so the shell paints immediately.
const Game = lazy(() => import('./game/Game'));

export function App() {
  return (
    <Suspense fallback={<div className="splash">Loading darts…</div>}>
      <Game />
    </Suspense>
  );
}
