import { GAMEPLAY } from '../../config/gameplay';
import { type AtlasFrame, alphaAt, bayer, clamp, hash, makePixels, type Pixels, put, smoothstep } from '../../systems/pixelArt';

// Bruma de la siesta (S103): pintor de las bocanadas y disposición dentro de cada zona `SleepFog`. Lógica pura, sin
// Phaser: SleepFogLook.ts sube el atlas una vez y mueve las bocanadas. Las bocanadas van a 1 píxel por unidad (como
// los tiles); el polvo, a 2 (como los personajes).
const LOOK = GAMEPLAY.sleepFogLook;
export const DUST_K = 2;

export interface Zone {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Nombre del cuadro de la bocanada de tamaño `size` (0 grande) y forma `shape`. */
export const puffFrame = (size: number, shape: number): string => `puff_${size}_${shape}`;
export const DUST_FRAMES = ['dust_deep', 'dust_gold', 'dust_hot', 'dust_star'] as const;

/** Densidad (0..1) de la bocanada: unión suave de óvalos, más baja y chata abajo. */
function puffDensity(size: number, shape: number, w: number, h: number): (x: number, y: number) => number {
  const n = 3 + Math.floor(hash(size * 7 + shape, 1) * 3); // 3 a 5 lóbulos
  const blobs: { x: number; y: number; r: number }[] = [];
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0.5 : i / (n - 1);
    const jx = (hash(size * 13 + shape * 5 + i, 2) - 0.5) * 0.12;
    const mid = 1 - Math.abs(t - 0.5) * 2; // los del medio, más altos y grandes
    blobs.push({
      x: w * (0.22 + 0.56 * t + jx),
      y: h * (0.62 - 0.18 * mid + (hash(i, size + shape) - 0.5) * 0.1),
      r: h * (0.3 + 0.17 * mid + hash(shape, i + size) * 0.06),
    });
  }
  return (x, y) => {
    let d = 0;
    for (const b of blobs) {
      const dx = (x - b.x) / (b.r * 1.25);
      const dy = (y - b.y) / b.r;
      const q = 1 - (dx * dx + dy * dy);
      if (q > 0) d += q * q;
    }
    // La base se aplana: abajo de la línea de los centros la bocanada se corta más rápido.
    const base = smoothstep(h * 0.98, h * 0.72, y);
    return clamp(d, 0, 1) * base;
  };
}

/**
 * Bocanada pintada: tres escalones de alfa con tramado de Bayer en el borde (pixel art, no un blur), luz del sol
 * arriba a la izquierda (el canto de arriba casi crema), el cuerpo lavanda y la panza más honda.
 */
export function paintPuff(size: number, shape: number): Pixels {
  const [w, h] = LOOK.puffSizes[size];
  const p = makePixels(w, h);
  const dens = puffDensity(size, shape, w, h);
  const steps = LOOK.puffSteps;
  const alphas = LOOK.puffAlphas;
  const pal = LOOK.palette;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const d = dens(x + 0.5, y + 0.5);
      if (d < 0.03) continue;
      const v = d + bayer(x, y) * 0.2;
      let level = -1;
      for (let i = 0; i < steps.length; i++) if (v >= steps[i]) level = i;
      if (level < 0) continue;
      // Luz: la densidad crece hacia abajo a la derecha → este píxel mira al sol.
      const toward = dens(x + 2.5, y + 2.5) - dens(x - 1.5, y - 1.5);
      const lit = 0.45 + toward * 0.9 + (0.5 - y / h) * 0.5 + bayer(x + 1, y + 2) * 0.16;
      let color: number;
      if (lit > 0.95 && level <= 1) color = LOOK.rim;
      else color = pal[clamp(Math.floor(lit * pal.length), 0, pal.length - 1)];
      put(p, x, y, color, Math.round(alphas[level] * 255));
    }
  }
  return trim(p);
}

/** Recorta el margen transparente (también se pinta, y cuesta): la caja justa de lo que se ve y dónde empezaba. */
function trimBox(p: Pixels): { px: Pixels; x0: number; y0: number } {
  let x0 = p.width;
  let y0 = p.height;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < p.height; y++) {
    for (let x = 0; x < p.width; x++) {
      if (!alphaAt(p, x, y)) continue;
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
    }
  }
  if (x1 < 0) return { px: p, x0: 0, y0: 0 };
  const out = makePixels(x1 - x0 + 1, y1 - y0 + 1);
  for (let y = 0; y < out.height; y++) out.data.set(p.data.subarray(((y + y0) * p.width + x0) * 4, ((y + y0) * p.width + x1 + 1) * 4), y * out.width * 4);
  return { px: out, x0, y0 };
}

function trim(p: Pixels): Pixels {
  return trimBox(p).px;
}

/** Motas de polvo con sol (a DUST_K px por unidad). */
export function paintDust(frame: (typeof DUST_FRAMES)[number]): Pixels {
  const [deep, gold, hot] = LOOK.dust;
  if (frame === 'dust_star') {
    const p = makePixels(3, 3);
    put(p, 1, 1, hot);
    put(p, 0, 1, gold, 200);
    put(p, 2, 1, gold, 200);
    put(p, 1, 0, gold, 200);
    put(p, 1, 2, gold, 200);
    return p;
  }
  const p = makePixels(2, 2);
  const c = frame === 'dust_deep' ? deep : frame === 'dust_gold' ? gold : hot;
  put(p, 0, 0, c);
  put(p, 1, 0, c, 200);
  put(p, 0, 1, c, 200);
  put(p, 1, 1, c, 120);
  return p;
}

export function fogAtlasFrames(): AtlasFrame[] {
  const frames: AtlasFrame[] = [];
  for (let size = 0; size < LOOK.puffSizes.length; size++) {
    for (let shape = 0; shape < LOOK.shapesPerSize; shape++) frames.push({ name: puffFrame(size, shape), px: paintPuff(size, shape) });
  }
  for (const f of DUST_FRAMES) frames.push({ name: f, px: paintDust(f) });
  return frames;
}

/**
 * Densidad de la bruma (0..1) en (x, y): sube del borde de la zona hacia adentro (de `edgeOut` afuera a `edgeIn`
 * adentro) y el centro suma un poco más. El piso no se desvanece: la bruma se apoya en la calle.
 */
export function fogDensity(zone: Zone, x: number, y: number): number {
  const e = Math.min(x - zone.x, zone.x + zone.width - x, y - zone.y);
  const c = smoothstep(-LOOK.edgeOut, LOOK.edgeIn, e);
  if (c <= 0) return 0;
  const nx = (x - (zone.x + zone.width / 2)) / (zone.width / 2);
  const ny = (y - (zone.y + zone.height / 2)) / (zone.height / 2);
  const center = 1 - Math.min(1, nx * nx + ny * ny);
  return c * (1 - LOOK.centerBoost + LOOK.centerBoost * center);
}

/** Ruido de valor suave (0..1) con celdas de `cell` unidades: jirones de la masa. */
function valueNoise(x: number, y: number, cell: number, seed: number): number {
  const gx = x / cell;
  const gy = y / cell;
  const ix = Math.floor(gx);
  const iy = Math.floor(gy);
  const fx = gx - ix;
  const fy = gy - iy;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const a = hash(ix + seed, iy);
  const b = hash(ix + 1 + seed, iy);
  const c = hash(ix + seed, iy + 1);
  const d = hash(ix + 1 + seed, iy + 1);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

/** Margen (unidades) de la masa alrededor de la zona: hasta donde llega la densidad (`edgeOut`) y un poco más. */
export const MASS_PAD = 6;

/**
 * Masa de la bruma de una zona, pintada una vez: la densidad de la zona (densa al centro, el borde tramado, apoyada
 * en el piso) cortada en jirones por un ruido estirado en horizontal, con la luz del sol arriba a la izquierda. Es la
 * capa continua: las bocanadas que se mueven van encima. Se pinta sobre la zona más `MASS_PAD` a los lados y arriba y
 * se recorta a lo que se ve; `x` e `y`: dónde queda su esquina de arriba a la izquierda, en el mundo.
 */
export function paintMass(zone: Zone): { px: Pixels; x: number; y: number } {
  const w = Math.ceil(zone.width + MASS_PAD * 2);
  const h = Math.ceil(zone.height + MASS_PAD);
  const p = makePixels(w, h);
  const seed = zoneSeed(zone) * 10;
  const steps = LOOK.puffSteps;
  const alphas = LOOK.puffAlphas;
  const pal = LOOK.palette;
  const right = zone.x + zone.width;
  const dens = (x: number, y: number): number => {
    const wx = zone.x - MASS_PAD + x;
    const wy = zone.y - MASS_PAD + y;
    // Silueta: la cresta ondula y baja hacia los costados (un montículo); los costados se deshilachan.
    const side = Math.min(wx - zone.x, right - wx);
    const crest = zone.y + 3 + (valueNoise(wx, 0, 17, seed + 3) - 0.5) * 12 + (1 - smoothstep(0, zone.width * 0.45, side)) * 9;
    const vert = smoothstep(crest - 3, crest + 9, wy);
    const hor = smoothstep(-LOOK.edgeOut, LOOK.edgeIn, side + (valueNoise(0, wy, 9, seed + 7) - 0.5) * 9);
    // Jirones adentro: dos octavas de ruido, un poco estiradas en horizontal.
    const n = 0.6 * valueNoise(wx, wy * 1.7, LOOK.massCell, seed) + 0.4 * valueNoise(wx, wy * 1.7, LOOK.massCell / 2.3, seed + 31);
    return vert * hor * (1 - LOOK.massWisps + LOOK.massWisps * n * 1.5);
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const d = dens(x + 0.5, y + 0.5) * LOOK.massDensity;
      if (d < 0.03) continue; // sin densidad no hay tramado (si no, un punteado cubre todo el rectángulo)
      const v = d + bayer(x, y) * 0.22;
      let level = -1;
      for (let i = 0; i < steps.length; i++) if (v >= steps[i]) level = i;
      if (level < 0) continue;
      const toward = dens(x + 2.5, y + 2.5) - dens(x - 1.5, y - 1.5);
      const lit = 0.55 + toward * 1.2 + (0.5 - y / h) * 0.25 + bayer(x + 1, y + 2) * 0.16;
      const color = lit > 0.98 && level <= 1 ? LOOK.rim : pal[clamp(Math.floor(lit * pal.length), 0, pal.length - 1)];
      put(p, x, y, color, Math.round(alphas[level] * 255));
    }
  }
  const t = trimBox(p);
  return { px: t.px, x: zone.x - MASS_PAD + t.x0, y: zone.y - MASS_PAD + t.y0 };
}

export interface FogPuff {
  /** Centro en reposo (unidades del mundo). */
  x: number;
  y: number;
  size: number;
  shape: number;
  front: boolean;
  alpha: number;
  swirlR: number;
  swirlMs: number;
  /** +1 o -1: el sentido del remolino. */
  dir: number;
  phase: number;
  breathPhase: number;
  flipX: boolean;
}

export interface FogDust {
  x: number;
  rise: number;
  phase: number;
  twinkleMs: number;
  swayMs: number;
}

/** Semilla estable por zona (dos zonas iguales no se ven calcadas). */
const zoneSeed = (z: Zone): number => z.x * 0.013 + z.y * 0.071;

/** Bocanadas de una zona: la capa de atrás (densa) y el velo (tenue), más densas al centro que en el borde. */
export function fogPuffs(zone: Zone): FogPuff[] {
  const out: FogPuff[] = [];
  const seed = zoneSeed(zone);
  const bottom = zone.y + zone.height;
  const layer = (front: boolean): void => {
    const [gx, gy] = front ? LOOK.frontGap : LOOK.backGap;
    const maxA = front ? LOOK.frontAlpha : LOOK.backAlpha;
    const x0 = zone.x - LOOK.edgeOut + gx / 2;
    const x1 = zone.x + zone.width + LOOK.edgeOut;
    let row = 0;
    // Desde el piso: la capa de atrás baja hasta la fila del piso, que la tapa (la tierra honda está detrás, a -19).
    for (let y = bottom - (front ? gy * 0.6 : 3); y > zone.y - LOOK.edgeOut; y -= gy, row++) {
      const shift = row % 2 ? gx / 2 : 0;
      for (let x = x0 + shift - gx / 2; x <= x1; x += gx) {
        const k = out.length + (front ? 1000 : 0);
        const jx = (hash(seed + k, 3) - 0.5) * 2 * LOOK.jitter;
        // Arriba la bruma se deshilacha: más sacudón vertical, así la cresta no queda recta.
        const crest = 1 - smoothstep(zone.y - LOOK.edgeOut, zone.y + LOOK.edgeIn * 1.5, y);
        const jy = (hash(seed + k, 4) - 0.5) * 2 * LOOK.jitter * (1 + 1.6 * crest);
        const px = x + jx;
        // El velo no baja sobre la calle (va delante de los tiles); la capa de atrás sí, la tapa el piso.
        const py = Math.min(y + jy, front ? bottom - LOOK.puffSizes[0][1] * 0.35 : bottom - 2);
        const d = fogDensity(zone, px, py);
        if (d < (front ? 0.04 : LOOK.backMinDensity)) continue;
        // Encima de la masa alcanzan bocanadas medianas y chicas (las grandes pintaban mucho y se separaban).
        const size = front || d > 0.7 ? 0 : 1;
        out.push({
          x: px,
          y: py,
          size,
          shape: Math.floor(hash(seed + k, 6) * LOOK.shapesPerSize),
          front,
          alpha: LOOK.edgeAlpha + (maxA - LOOK.edgeAlpha) * d,
          swirlR: LOOK.swirlRadius[0] + (LOOK.swirlRadius[1] - LOOK.swirlRadius[0]) * hash(seed + k, 7),
          swirlMs: LOOK.swirlMs[0] + (LOOK.swirlMs[1] - LOOK.swirlMs[0]) * hash(seed + k, 8),
          dir: hash(seed + k, 9) < 0.5 ? -1 : 1,
          phase: hash(seed + k, 10) * Math.PI * 2,
          breathPhase: (px - zone.x) * 0.05 + hash(seed + k, 11) * 0.8,
          flipX: hash(seed + k, 12) < 0.5,
        });
      }
    }
  };
  layer(false);
  layer(true);
  return out;
}

/** Polvo dorado de una zona: uno cada `dustPerArea` unidades², entre `dustMin` y `dustMax`. */
export function fogDust(zone: Zone): FogDust[] {
  const seed = zoneSeed(zone) + 5;
  const n = clamp(Math.round((zone.width * zone.height) / LOOK.dustPerArea), LOOK.dustMin, LOOK.dustMax);
  const out: FogDust[] = [];
  for (let i = 0; i < n; i++) {
    out.push({
      x: zone.x + zone.width * ((i + 0.5 + (hash(seed + i, 1) - 0.5) * 0.8) / n),
      rise: LOOK.dustRise[0] + (LOOK.dustRise[1] - LOOK.dustRise[0]) * hash(seed + i, 2),
      phase: hash(seed + i, 3),
      twinkleMs: LOOK.dustTwinkleMs[0] + (LOOK.dustTwinkleMs[1] - LOOK.dustTwinkleMs[0]) * hash(seed + i, 4),
      swayMs: 2500 + 2500 * hash(seed + i, 5),
    });
  }
  return out;
}
