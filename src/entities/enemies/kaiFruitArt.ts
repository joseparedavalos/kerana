import { bayer, hash, makePixels, put, type AtlasFrame, type Pixels } from '../../systems/pixelArt';

// Fruto de pindó que tira el ka'i (S115): ovalado, naranja, con el cáliz y el cabito oscuros y una hojita. Se pinta una
// vez, a 2 píxeles por unidad (los del ka'i), en `SPIN_FRAMES` giros: la luz no gira (arriba a la izquierda), el fruto
// sí. Más la pulpa que salpica, el reventón y la semilla. Lógica pura: los tests y los volcados no necesitan Phaser.

/** Rampa del fruto, de la sombra a la luz, y el brillo. */
export const SKIN = [0x6e2a0c, 0xa8461a, 0xd8701f, 0xf39a2b, 0xffc24f] as const;
export const SHINE = 0xfff0b0;
/** Cáliz (los restos de la flor) y cabito. */
export const CALYX = [0x3a2810, 0x5b4220, 0x7c6232] as const;
export const STEM = [0x2a1a0c, 0x4a3118] as const;
/** Hojita (verde de la palmera). */
export const LEAF = [0x2c4714, 0x4c7222, 0x79a238] as const;
/** Semilla: el carozo duro y fibroso. */
export const SEED = [0x2b190c, 0x4a2e16, 0x6e4a26, 0x9a7244] as const;
/** Contornos: casi negro abajo a la derecha, más cálido arriba a la izquierda. */
export const LINE_DARK = 0x260f05;
export const LINE_WARM = 0x6a2a0d;
export const LINE_LEAF = 0x182a0a;

export const PALETTE: readonly number[] = [
  ...SKIN,
  SHINE,
  ...CALYX,
  ...STEM,
  ...LEAF,
  ...SEED,
  LINE_DARK,
  LINE_WARM,
  LINE_LEAF,
];

export const SPIN_FRAMES = 8;
export const PULP_FRAMES = 4;
export const POP_FRAMES = 2;
/** Lado del lienzo de cada giro (px de arte); el centro del fruto va en el medio. */
export const FRUIT_CANVAS = 28;

export const spinFrameName = (i: number): string => `spin_${i}`;
export const pulpFrameName = (i: number): string => `pulp_${i}`;
export const popFrameName = (i: number): string => `pop_${i}`;
export const SEED_FRAME = 'seed';

/** Medidas del fruto en px de arte: medio ancho, medio alto abajo (la punta) y arriba (el cabo). */
const HALF_W = 6;
const HALF_H_BOTTOM = 7.5;
const HALF_H_TOP = 6.8;
/** La luz (x a la derecha, y abajo, z hacia el que mira). */
const LIGHT = normalize(-0.55, -0.7, 0.55);

function normalize(x: number, y: number, z: number): [number, number, number] {
  const l = Math.hypot(x, y, z);
  return [x / l, y / l, z / l];
}

type Material = 0 | 1 | 2 | 3; // nada, fruto (y cáliz), cabito, hoja

interface Canvas {
  px: Pixels;
  mat: Uint8Array;
}

function canvas(w: number, h: number): Canvas {
  return { px: makePixels(w, h), mat: new Uint8Array(w * h) };
}

function paint(c: Canvas, x: number, y: number, color: number, m: Material): void {
  if (x < 0 || y < 0 || x >= c.px.width || y >= c.px.height) return;
  put(c.px, x, y, color);
  c.mat[y * c.px.width + x] = m;
}

/**
 * Contorno selectivo: cada píxel vacío que toca uno pintado toma el color de línea de ese material; los de abajo a la
 * derecha del centro, el oscuro.
 */
function outline(c: Canvas, cx: number, cy: number): void {
  const { width: w, height: h } = c.px;
  const src = c.mat.slice();
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (src[y * w + x]) continue;
      let m = 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        m = Math.max(m, src[ny * w + nx]);
      }
      if (!m) continue;
      const lowerRight = x + 0.5 - cx + (y + 0.5 - cy) > 0;
      const color = m === 3 ? LINE_LEAF : m === 2 || lowerRight ? LINE_DARK : LINE_WARM;
      paint(c, x, y, color, 0);
    }
  }
}

/** Un giro del fruto: `angle` en radianes (0 = el cabo arriba). */
export function paintFruit(angle: number): Pixels {
  const c = canvas(FRUIT_CANVAS, FRUIT_CANVAS);
  const cx = FRUIT_CANVAS / 2;
  const cy = FRUIT_CANVAS / 2;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  for (let y = 0; y < FRUIT_CANVAS; y++) {
    for (let x = 0; x < FRUIT_CANVAS; x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      // Al espacio del fruto (el cabo hacia v negativa).
      const u = dx * cos + dy * sin;
      const v = -dx * sin + dy * cos;
      // La hojita: un óvalo inclinado que sale del cabito hacia un costado.
      const lu0 = u - 3.4;
      const lv0 = v + HALF_H_TOP + 3.2;
      const la = -0.55;
      const lu = lu0 * Math.cos(la) + lv0 * Math.sin(la);
      const lv = -lu0 * Math.sin(la) + lv0 * Math.cos(la);
      if ((lu / 3.8) ** 2 + (lv / 1.6) ** 2 <= 1) {
        const tone = Math.abs(lv) < 0.45 ? 2 : lv < 0 ? 1 : 0;
        paint(c, x, y, LEAF[tone], 3);
        continue;
      }
      // Cuerpo: ovalado, más angosto hacia el cabo; la punta de abajo, un pico chiquito.
      const top = v < 0;
      const hh = top ? HALF_H_TOP : HALF_H_BOTTOM;
      const hw = HALF_W * (top ? 1 - 0.14 * (-v / hh) : 1 - 0.05 * (v / hh));
      const beak = !top && Math.abs(u) < 0.9 && v < hh + 1.2;
      const r2 = (u / hw) ** 2 + (v / hh) ** 2;
      if (r2 <= 1 || beak) {
        // Normal de la superficie, de vuelta al mundo: la luz no gira con el fruto.
        const nu = u / hw;
        const nv = v / hh;
        const nz = Math.sqrt(Math.max(0, 1 - nu * nu - nv * nv));
        const nx = nu * cos - nv * sin;
        const ny = nu * sin + nv * cos;
        const d = nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2];
        // Cáliz: el casquete del cabo, con el borde dentado.
        const calyxEdge = -hh * 0.6 + (hash(Math.round(u * 1.3), 7) - 0.5) * 1.6;
        if (v < calyxEdge) {
          const t = Math.min(2, Math.max(0, Math.floor((d + 0.6) * 1.9)));
          paint(c, x, y, CALYX[t], 1);
          continue;
        }
        if (beak && r2 > 1) {
          paint(c, x, y, SKIN[1], 1);
          continue;
        }
        // Rampa en bandas, con un tramado chico en los bordes de cada banda (nada liso).
        const t = (d + 0.3) * 3.6 + bayer(x, y) * 0.55;
        let tone = Math.max(0, Math.min(SKIN.length - 1, Math.floor(t)));
        // Pecas fijas en el fruto (se leen al girar).
        const fu = Math.round(u);
        const fv = Math.round(v);
        if ((fu === 2 && fv === 2) || (fu === -3 && fv === 0) || (fu === 0 && fv === 4) || (fu === 3 && fv === -2)) {
          tone = Math.max(0, tone - 1);
        }
        // Línea de sombra suave del lado de abajo: la panza un tono más oscura cerca del borde.
        if (r2 > 0.82 && d < 0.1) tone = Math.max(0, tone - 1);
        paint(c, x, y, d > 0.9 ? SHINE : SKIN[tone], 1);
        continue;
      }
      // Cabito: corto y oscuro, del cáliz hacia afuera.
      if (Math.abs(u) <= 0.75 && v < -hh + 0.8 && v > -hh - 3.6) {
        paint(c, x, y, u < 0 ? STEM[1] : STEM[0], 2);
      }
    }
  }
  outline(c, cx, cy);
  return c.px;
}

/** Gotas de pulpa: chiquitas, con un píxel de luz. */
function paintPulp(i: number): Pixels {
  const shapes = [
    ['ab', 'bc'],
    ['abb', 'bcc'],
    ['ab', 'bc', 'cc'],
    ['a'],
  ];
  const rows = shapes[i];
  const p = makePixels(rows[0].length, rows.length);
  const tone: Record<string, number> = { a: SKIN[4], b: SKIN[3], c: SKIN[2] };
  rows.forEach((row, y) => [...row].forEach((ch, x) => put(p, x, y, tone[ch])));
  return p;
}

/** El reventón: una mancha de pulpa con rayos que salen; el segundo cuadro, más abierta y rota. */
function paintPop(i: number): Pixels {
  const size = 22;
  const c = canvas(size, size);
  const cx = size / 2;
  const cy = size / 2;
  const core = i === 0 ? 3.4 : 2.2;
  const rays = 7;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      const r = Math.hypot(dx, dy);
      if (i === 0 && r <= core) {
        paint(c, x, y, r < 1.6 ? SKIN[4] : dx + dy > 1 ? SKIN[2] : SKIN[3], 1);
      }
    }
  }
  for (let k = 0; k < rays; k++) {
    const a = (k / rays) * Math.PI * 2 + hash(k, 3) * 0.6;
    const from = i === 0 ? core : 4 + hash(k, 5) * 2;
    const len = (i === 0 ? 4 : 3) + Math.floor(hash(k, 9) * 3);
    for (let s = 0; s < len; s++) {
      // El segundo cuadro deja huecos: la salpicadura se corta en gotas.
      if (i === 1 && s % 2 === 1) continue;
      const rr = from + s + 0.5;
      const x = Math.floor(cx + Math.cos(a) * rr);
      const y = Math.floor(cy + Math.sin(a) * rr);
      const tone = s === 0 ? 4 : s < len - 1 ? 3 : 2;
      paint(c, x, y, SKIN[tone], 1);
    }
  }
  outline(c, cx, cy);
  return c.px;
}

/** La semilla: un carozo ovalado, con fibras y un brillo chiquito. */
function paintSeed(): Pixels {
  const w = 7;
  const h = 8;
  const c = canvas(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const u = (x + 0.5 - w / 2) / 2.9;
      const v = (y + 0.5 - h / 2) / 3.4;
      if (u * u + v * v > 1) continue;
      let tone = u + v < -0.5 ? 2 : u + v > 0.6 ? 0 : 1;
      // Fibras: dos líneas oscuras a lo largo.
      if ((x === 2 || x === 4) && y > 1 && y < h - 2 && tone > 0) tone -= 1;
      paint(c, x, y, SEED[tone], 1);
    }
  }
  paint(c, 2, 1, SEED[3], 1);
  outline(c, w / 2, h / 2);
  return c.px;
}

/** Todos los cuadros del atlas de la fruta. */
export function fruitFrames(): AtlasFrame[] {
  const frames: AtlasFrame[] = [];
  for (let i = 0; i < SPIN_FRAMES; i++) frames.push({ name: spinFrameName(i), px: paintFruit((i / SPIN_FRAMES) * Math.PI * 2) });
  for (let i = 0; i < PULP_FRAMES; i++) frames.push({ name: pulpFrameName(i), px: paintPulp(i) });
  for (let i = 0; i < POP_FRAMES; i++) frames.push({ name: popFrameName(i), px: paintPop(i) });
  frames.push({ name: SEED_FRAME, px: paintSeed() });
  return frames;
}
