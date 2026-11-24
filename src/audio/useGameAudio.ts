import { useEffect } from 'react';
import { BOARD, WORLD } from '../engine/board/geometry';
import { distanceToWire } from '../engine/board/resolveHit';
import { worldToBoardMm } from '../engine/physics/ballistics';
import { currentAi, useGameStore, type ThrownDart } from '../store/useGameStore';
import { STICK_RADIUS } from '../game/scene/Board';
import { callForTurnEnd, callForTurnStart } from './calls';
import { call, preloadLines, setCallerEnabled } from './caller';
import {
  playBounceOut,
  playCheer,
  playImpact,
  playWhoosh,
  setAmbienceEnabled,
  setSoundEnabled,
  unlockAudio,
} from './engine';

function impactSound(d: ThrownDart) {
  const c = d.collision;
  if (c?.kind === 'robinHood') {
    playImpact('wire');
    return playCheer(0.7);
  }
  // Steel on steel (or a flick of the flights) as it meets a dart already in the board.
  if (c && !c.soft) playImpact('wire');
  if (d.result.kind === 'bounce') return playBounceOut();
  const imp = d.flight.impact;
  if (!imp || Math.hypot(imp.x, imp.y - WORLD.bullHeight) > STICK_RADIUS) {
    // Missed everything: it drops to the floor a moment later.
    window.setTimeout(() => playImpact('floor'), 450);
    return;
  }
  if (d.result.kind === 'miss') return playImpact('surround');
  const mm = worldToBoardMm(imp);
  playImpact(distanceToWire(mm.x, mm.y) < BOARD.wireContact * 1.5 ? 'wire' : 'board');
}

/** Connects game events to sound effects and the caller. Mount once. */
export function useGameAudio() {
  const sound = useGameStore((s) => s.sound);
  const caller = useGameStore((s) => s.caller);
  const ambience = useGameStore((s) => s.ambience);

  useEffect(() => setSoundEnabled(sound), [sound]);
  useEffect(() => setCallerEnabled(caller), [caller]);
  useEffect(() => setAmbienceEnabled(ambience), [ambience]);

  // Browsers only allow audio after a gesture.
  useEffect(() => {
    const unlock = () => unlockAudio();
    window.addEventListener('pointerdown', unlock, { capture: true });
    window.addEventListener('keydown', unlock, { capture: true });
    return () => {
      window.removeEventListener('pointerdown', unlock, { capture: true });
      window.removeEventListener('keydown', unlock, { capture: true });
    };
  }, []);

  useEffect(() => {
    preloadLines([
      'no_score',
      'game_shot',
      'game_shot_match',
      'you_require',
      'score_180',
      'score_100',
      'score_60',
    ]);
    return useGameStore.subscribe((s, prev) => {
      if (s.screen !== 'game') return;
      const launched = s.darts.length > prev.darts.length ? s.darts[s.darts.length - 1] : null;
      if (launched) playWhoosh(launched.launch.power);

      const landed = s.darts.find(
        (d) => d.landed && !prev.darts.find((p) => p.id === d.id)?.landed,
      );
      if (landed) impactSound(landed);

      // The bull-up isn't scored, so the caller stays quiet until the match starts.
      if (s.phase === 'turnOver' && prev.phase !== 'turnOver' && !s.bullUp) {
        if (s.match) {
          const { keys, cheer } = callForTurnEnd(s.match);
          if (cheer) playCheer(cheer);
          call(keys);
        } else {
          const total = s.darts.reduce(
            (t, d) => t + (d.result.kind === 'score' ? d.result.points : 0),
            0,
          );
          call([`score_${total}`]);
          if (total === 180) playCheer(1);
        }
      }

      const turnStarted =
        s.match &&
        s.match !== prev.match &&
        s.match.turn.darts.length === 0 &&
        s.phase === 'aiming' &&
        (prev.phase === 'turnOver' || prev.screen !== 'game' || prev.match === null);
      if (turnStarted && s.match && !s.bullUp && !currentAi(s)) call(callForTurnStart(s.match));
    });
  }, []);
}
