import { useEffect, useMemo } from 'react';
import { CanvasTexture, SRGBColorSpace } from 'three';
import { useGameStore } from '../../store/useGameStore';
import { chalkSheet, updateChalk, type ChalkLog, type ChalkSheet } from './chalkScore';

const W = 512;
const H = 1024;
/** The game's bundled display font, so the board looks the same on every device (and offline). */
const FONT = '"Barlow Condensed", "Arial Narrow", sans-serif';
const CHALK = '240,240,230';

/** Small deterministic jitter so chalk looks hand-drawn but doesn't shimmer between redraws. */
function jitter(seed: number) {
  let x = (seed * 2654435761) >>> 0 || 1;
  return () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return ((x >>> 0) / 0x100000000) * 2 - 1;
  };
}
const hashOf = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
};

function board(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = '#1d2321';
  ctx.fillRect(0, 0, W, H);
  // Old chalk dust and smudges from games gone by.
  const r = jitter(7);
  for (let i = 0; i < 3000; i++) {
    ctx.fillStyle = `rgba(255,255,255,${(r() + 1) * 0.016})`;
    ctx.fillRect((r() + 1) * W * 0.5, (r() + 1) * H * 0.5, 3, 3);
  }
  for (let i = 0; i < 6; i++) {
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 120);
    g.addColorStop(0, 'rgba(255,255,255,0.05)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.save();
    ctx.translate((r() + 1) * W * 0.5, (r() + 1) * H * 0.5);
    ctx.scale(1.6, 0.7);
    ctx.fillStyle = g;
    ctx.fillRect(-120, -120, 240, 240);
    ctx.restore();
  }
}

/** Chalk text: a few faint, slightly offset passes. */
function chalkText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  size: number,
  alpha = 1,
) {
  const r = jitter(hashOf(text) + Math.round(x) * 31 + Math.round(y));
  ctx.font = `700 ${size}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = `rgba(${CHALK},${0.36 * alpha})`;
    ctx.fillText(text, x + r() * 1.6, y + r() * 1.6);
  }
}

/** A chalk stroke from (x1, y1) to (x2, y2). */
function chalkLine(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  width = 4,
  alpha = 0.8,
) {
  const r = jitter(Math.round(x1 * 7 + y1 * 13 + x2 * 17 + y2 * 19));
  ctx.lineCap = 'round';
  for (let i = 0; i < 2; i++) {
    ctx.strokeStyle = `rgba(${CHALK},${alpha * 0.55})`;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(x1 + r() * 1.5, y1 + r() * 1.5);
    ctx.lineTo(x2 + r() * 1.5, y2 + r() * 1.5);
    ctx.stroke();
  }
}

/** Legs won as tally marks (four strokes and a slash). */
function tally(ctx: CanvasRenderingContext2D, n: number, cx: number, y: number) {
  const marks = Math.min(n, 10);
  const width = marks * 9 + Math.floor(marks / 5) * 10;
  let x = cx - width / 2;
  for (let i = 0; i < marks; i++) {
    if (i % 5 === 4) {
      chalkLine(ctx, x - 44, y + 12, x + 2, y - 12, 3);
      x += 18;
    } else {
      chalkLine(ctx, x, y - 13, x + 1, y + 13, 3);
      x += 9;
    }
  }
}

/** Header: title, a line, player names with tallies, and dividers between columns. */
function header(
  ctx: CanvasRenderingContext2D,
  sheet: Exclude<ChalkSheet, { kind: 'idle' }>,
  colX: number[],
  colW: number,
) {
  chalkText(ctx, sheet.title, W / 2, 70, 64);
  chalkLine(ctx, 40, 120, W - 40, 116, 5);
  const size = sheet.names.length > 2 ? 30 : 40;
  sheet.names.forEach((n, i) => {
    chalkText(ctx, n, colX[i]!, 160, size);
    // Whoever is throwing gets underlined.
    if (i === sheet.current)
      chalkLine(ctx, colX[i]! - colW * 0.36, 186, colX[i]! + colW * 0.36, 184, 3, 0.7);
    if (sheet.legs[i]) tally(ctx, sheet.legs[i]!, colX[i]!, 216);
  });
  for (let i = 1; i < colX.length; i++) {
    const x = (colX[i - 1]! + colX[i]!) / 2;
    chalkLine(ctx, x, 140, x + 2, H - 40, 4);
  }
}

export function drawChalk(ctx: CanvasRenderingContext2D, sheet: ChalkSheet) {
  board(ctx);
  if (sheet.kind === 'idle') {
    // Between games: last night's scribbles.
    chalkText(ctx, 'DARTS', W / 2, 90, 72);
    chalkLine(ctx, 40, 150, W - 40, 146, 5);
    chalkLine(ctx, W / 2, 160, W / 2 + 2, H - 80, 4);
    const rows = [
      ['501', '501'],
      ['441', '360'],
      ['301', '275'],
      ['181', '140'],
      ['100', '76'],
    ];
    rows.forEach(([a, b], i) => {
      const y = 240 + i * 120;
      chalkText(ctx, a!, W * 0.27, y, 56);
      chalkText(ctx, b!, W * 0.73, y, 56);
      if (i < rows.length - 1) {
        chalkLine(ctx, W * 0.27 - 55, y + 8, W * 0.27 + 55, y - 10, 4);
        chalkLine(ctx, W * 0.73 - 55, y + 8, W * 0.73 + 55, y - 10, 4);
      }
    });
    return;
  }

  const n = sheet.names.length;
  const colW = (W - 40) / n;
  const colX = sheet.names.map((_, i) => 20 + colW * (i + 0.5));

  if (sheet.kind === 'x01') {
    header(ctx, sheet, colX, colW);
    const size = n > 2 ? 46 : 58;
    const rowH = 82;
    sheet.columns.forEach((col, i) => {
      col.scores.forEach((score, k) => {
        const y = 290 + k * rowH;
        const last = k === col.scores.length - 1;
        chalkText(ctx, String(score), colX[i]!, y, size, last ? 1 : 0.8);
        // Scores gone by are struck through.
        if (!last)
          chalkLine(ctx, colX[i]! - colW * 0.3, y + 10, colX[i]! + colW * 0.3, y - 10, 4, 0.75);
      });
    });
    return;
  }

  if (sheet.kind === 'cricket') {
    // Numbers down the middle with each player's marks beside them (two players),
    // or as their own column with marks in each player's column (more players).
    const twoUp = n === 2;
    const numX = twoUp ? W / 2 : 50;
    const markX = twoUp
      ? [W * 0.22, W * 0.78]
      : sheet.names.map((_, i) => 110 + ((W - 130) / n) * (i + 0.5));
    chalkText(ctx, sheet.title, W / 2, 70, 58);
    chalkLine(ctx, 40, 120, W - 40, 116, 5);
    sheet.names.forEach((nm, i) => {
      chalkText(ctx, nm, markX[i]!, 160, n > 2 ? 26 : 38);
      if (i === sheet.current) chalkLine(ctx, markX[i]! - 50, 186, markX[i]! + 50, 184, 3, 0.7);
      if (sheet.legs[i]) tally(ctx, sheet.legs[i]!, markX[i]!, 214);
    });
    sheet.targets.forEach((t, row) => {
      const y = 280 + row * 92;
      chalkText(ctx, t, numX, y, 50);
      sheet.marks.forEach((m, i) => {
        const x = markX[i]!;
        const k = m[row]!;
        const s = 22;
        if (k >= 1) chalkLine(ctx, x - s, y + s, x + s, y - s, 5);
        if (k >= 2) chalkLine(ctx, x - s, y - s, x + s, y + s, 5);
        if (k >= 3) {
          ctx.strokeStyle = `rgba(${CHALK},0.6)`;
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.arc(x, y, s * 1.45, 0, Math.PI * 2);
          ctx.stroke();
        }
      });
    });
    const yPts = 280 + sheet.targets.length * 92 + 10;
    chalkLine(ctx, 40, yPts - 40, W - 40, yPts - 44, 4);
    sheet.points.forEach((p, i) => chalkText(ctx, String(p), markX[i]!, yPts + 10, 48));
    return;
  }

  // Other games: each player's score.
  header(ctx, sheet, colX, colW);
  sheet.values.forEach((v, i) => chalkText(ctx, v, colX[i]!, 360, n > 2 ? 52 : 72));
}

/**
 * The chalk scoreboard on the inside of the cabinet door, kept up to date with
 * the match being played.
 */
export function ChalkBoard({ width, height }: { width: number; height: number }) {
  const { tex, ctx } = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const t = new CanvasTexture(c);
    t.colorSpace = SRGBColorSpace;
    t.anisotropy = 4;
    return { tex: t, ctx: c.getContext('2d')! };
  }, []);

  useEffect(() => {
    let log: ChalkLog | null = null;
    let last = '';
    const redraw = () => {
      const s = useGameStore.getState();
      let sheet: ChalkSheet;
      if (s.screen === 'game' && s.match) {
        log = updateChalk(log, s.match);
        sheet = chalkSheet(s.match, log);
      } else if (s.screen === 'game' && s.setup.kind === 'practice') {
        sheet = {
          kind: 'scores',
          title: 'PRACTICE',
          names: ['DARTS', 'POINTS'],
          legs: [0, 0],
          values: [String(s.practice.darts), String(s.practice.points)],
          current: -1,
        };
      } else {
        log = null;
        sheet = chalkSheet(null, null);
      }
      const sig = JSON.stringify(sheet);
      if (sig === last) return;
      last = sig;
      drawChalk(ctx, sheet);
      tex.needsUpdate = true;
    };
    redraw();
    // The font may arrive after the first draw: load it, then draw again.
    void document.fonts?.load(`700 48px ${FONT}`).then(() => {
      last = '';
      redraw();
    });
    const unsub = useGameStore.subscribe(redraw);
    return () => {
      unsub();
      tex.dispose();
    };
  }, [ctx, tex]);

  return (
    <mesh>
      <planeGeometry args={[width, height]} />
      <meshStandardMaterial map={tex} roughness={0.95} />
    </mesh>
  );
}
