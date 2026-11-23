import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three';

function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return { c, ctx: c.getContext('2d')! };
}

function finish(c: HTMLCanvasElement, repeatX = 1, repeatY = 1) {
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.wrapS = t.wrapT = RepeatWrapping;
  t.repeat.set(repeatX, repeatY);
  t.anisotropy = 4;
  return t;
}

/** Wooden planks with grain; `vertical` for wall panelling, horizontal for floorboards. */
export function planksTexture(
  base: [number, number, number],
  planks: number,
  vertical: boolean,
  repeat: [number, number],
) {
  const size = 512;
  const { c, ctx } = canvas(size, size);
  const w = size / planks;
  for (let i = 0; i < planks; i++) {
    const shade = 0.85 + Math.random() * 0.25;
    ctx.fillStyle = `rgb(${base.map((v) => Math.min(255, Math.round(v * shade))).join(',')})`;
    if (vertical) ctx.fillRect(i * w, 0, w, size);
    else ctx.fillRect(0, i * w, size, w);
    // grain
    ctx.strokeStyle = 'rgba(0,0,0,0.12)';
    ctx.lineWidth = 1;
    for (let g = 0; g < 9; g++) {
      ctx.beginPath();
      const off = i * w + Math.random() * w;
      for (let k = 0; k <= size; k += 16) {
        const wobble = Math.sin(k / 37 + g) * 2;
        const [x, y] = vertical ? [off + wobble, k] : [k, off + wobble];
        if (k) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      }
      ctx.stroke();
    }
    // seam
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    if (vertical) ctx.fillRect(i * w, 0, 2, size);
    else ctx.fillRect(0, i * w, size, 2);
  }
  return finish(c, ...repeat);
}

/** Pub chalkboard with a scribbled score sheet. */
export function chalkboardTexture() {
  const { c, ctx } = canvas(512, 768);
  ctx.fillStyle = '#1d2321';
  ctx.fillRect(0, 0, 512, 768);
  for (let i = 0; i < 2500; i++) {
    ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.03})`;
    ctx.fillRect(Math.random() * 512, Math.random() * 768, 3, 3);
  }
  ctx.strokeStyle = 'rgba(240,240,230,0.75)';
  ctx.fillStyle = 'rgba(240,240,230,0.85)';
  ctx.lineWidth = 4;
  ctx.font = '700 64px "Comic Sans MS", "Chalkboard SE", cursive';
  ctx.textAlign = 'center';
  ctx.fillText('DARTS', 256, 90);
  ctx.beginPath();
  ctx.moveTo(256, 130);
  ctx.lineTo(256, 720);
  ctx.moveTo(40, 160);
  ctx.lineTo(472, 160);
  ctx.stroke();
  ctx.font = '48px "Comic Sans MS", "Chalkboard SE", cursive';
  const rows = [
    ['501', '501'],
    ['441', '360'],
    ['301', '275'],
    ['181', '140'],
    ['100', '76'],
  ];
  rows.forEach(([a, b], i) => {
    ctx.fillText(a!, 140, 230 + i * 100);
    ctx.fillText(b!, 372, 230 + i * 100);
    if (i < rows.length - 1) {
      ctx.beginPath();
      ctx.moveTo(100, 215 + i * 100);
      ctx.lineTo(180, 205 + i * 100);
      ctx.moveTo(332, 215 + i * 100);
      ctx.lineTo(412, 205 + i * 100);
      ctx.stroke();
    }
  });
  return finish(c);
}

/** A loose abstract "painting" for wall frames. */
export function paintingTexture(hue: number) {
  const { c, ctx } = canvas(256, 320);
  const g = ctx.createLinearGradient(0, 0, 0, 320);
  g.addColorStop(0, `hsl(${hue},35%,55%)`);
  g.addColorStop(1, `hsl(${hue + 30},30%,25%)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 320);
  for (let i = 0; i < 6; i++) {
    ctx.fillStyle = `hsla(${hue + i * 25},40%,${40 + i * 6}%,0.6)`;
    ctx.beginPath();
    ctx.ellipse(
      40 + Math.random() * 176,
      60 + Math.random() * 200,
      20 + Math.random() * 50,
      10 + Math.random() * 30,
      Math.random() * 3,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
  return finish(c);
}
