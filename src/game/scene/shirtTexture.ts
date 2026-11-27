import { CanvasTexture, SRGBColorSpace } from 'three';
import type { Appearance } from './appearance';

const W = 512;
const H = 256;

/**
 * A darts shirt wrapped round the torso. The torso is a lathe whose texture
 * u runs round the body with the BACK at u = 0.5 and the front at the seam
 * (u = 0 / 1); the sides are at u = 0.25 (left) and 0.75 (throwing arm). v runs
 * up from the hem. The player's name goes across the upper back, like a pro's.
 */
export function shirtTexture(look: Appearance): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d')!;
  const { shirt, trim } = look;

  ctx.fillStyle = shirt;
  ctx.fillRect(0, 0, W, H);

  // Pattern. Canvas y runs down from the collar (top of the texture).
  ctx.fillStyle = trim;
  ctx.strokeStyle = trim;
  switch (look.pattern) {
    case 'panels': {
      // Contrast side panels, wider toward the hem.
      for (const u of [0.25, 0.75]) {
        ctx.beginPath();
        ctx.moveTo(u * W - 14, 0);
        ctx.lineTo(u * W + 14, 0);
        ctx.lineTo(u * W + 30, H);
        ctx.lineTo(u * W - 30, H);
        ctx.closePath();
        ctx.fill();
      }
      break;
    }
    case 'band': {
      ctx.fillRect(0, H * 0.3, W, H * 0.12);
      ctx.globalAlpha = 0.7;
      ctx.fillRect(0, H * 0.46, W, H * 0.025);
      ctx.globalAlpha = 1;
      break;
    }
    case 'chevron': {
      // Chevrons down the front, which straddles the seam: draw at u = 0 and u = 1.
      for (const cx of [0, W]) {
        for (let k = 0; k < 3; k++) {
          const y = H * (0.22 + k * 0.16);
          ctx.beginPath();
          ctx.moveTo(cx - 90, y);
          ctx.lineTo(cx, y + 34);
          ctx.lineTo(cx + 90, y);
          ctx.lineTo(cx + 90, y + 14);
          ctx.lineTo(cx, y + 48);
          ctx.lineTo(cx - 90, y + 14);
          ctx.closePath();
          ctx.fill();
        }
      }
      break;
    }
    case 'flames': {
      // Flames licking up from the hem all the way round.
      ctx.beginPath();
      ctx.moveTo(0, H);
      for (let x = 0; x <= W; x += 32) {
        const tall = 0.35 + 0.25 * Math.abs(Math.sin(x * 0.07));
        ctx.quadraticCurveTo(x + 6, H * (1 - tall * 0.5), x + 12, H * (1 - tall));
        ctx.quadraticCurveTo(x + 20, H * (1 - tall * 0.4), x + 32, H * 0.92);
      }
      ctx.lineTo(W, H);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'split': {
      // Two-tone: the throwing-arm half in the trim colour.
      ctx.fillRect(W / 2, 0, W / 2, H);
      break;
    }
    case 'pinstripe': {
      ctx.globalAlpha = 0.55;
      for (let x = 0; x < W; x += 16) ctx.fillRect(x, 0, 3, H);
      ctx.globalAlpha = 1;
      break;
    }
  }

  // Collar yoke and hem.
  ctx.fillStyle = trim;
  ctx.fillRect(0, 0, W, 10);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(0, H - 8, W, 8);

  // Name across the upper back, in the trim colour with a dark outline. Sit it on
  // a shirt-coloured plate so it stays readable over any pattern.
  const name = look.backName;
  ctx.font = `bold ${name.length > 9 ? 26 : 34}px "Barlow Condensed", Impact, "Arial Narrow", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const tw = ctx.measureText(name).width;
  ctx.fillStyle = shirt;
  ctx.fillRect(W / 2 - tw / 2 - 10, H * 0.17, tw + 20, 40);
  ctx.lineWidth = 5;
  ctx.strokeStyle = 'rgba(0,0,0,0.55)';
  ctx.strokeText(name, W / 2, H * 0.17 + 21);
  ctx.fillStyle = trim;
  ctx.fillText(name, W / 2, H * 0.17 + 21);

  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
