import { GAMEPLAY } from '../../config/gameplay';
import { type AtlasFrame, bayer, clamp, makePixels, mix, put, type Pixels } from '../../systems/pixelArt';

// Las siete estrellas de la arena de Tau (S118), pintadas una vez: estrellas de cristal en pixel art (cinco puntas, cada
// una con su cara iluminada arriba a la izquierda y la otra en sombra, la arista clara y el corazón que brilla), el halo,
// el destello de cuatro puntas y los rayos de la que la fase 3 enciende. Lógica pura: TauStars.ts sube el atlas.
const LOOK = GAMEPLAY.tau.starLook;

export const STAR_FRAMES = { idle: 'star_idle', lit: 'star_lit', haloIdle: 'halo_idle', haloLit: 'halo_lit', glint: 'glint', rays: 'rays' } as const;

/** Los 10 vértices de una estrella de cinco puntas (la de arriba primero), centrada en (c, c). */
export function starVertices(c: number, outer: number, inner: number): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 === 0 ? outer : inner;
    out.push([c + Math.cos(a) * r, c + Math.sin(a) * r]);
  }
  return out;
}

function inside(poly: [number, number][], x: number, y: number): boolean {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

/**
 * Estrella de cristal (a `LOOK.detail` píxeles por unidad). `pal`: del contorno a la luz (6 tonos). Cada punta tiene dos
 * caras: la que mira a la luz (arriba a la izquierda) clara, la otra en sombra; la arista del centro a la punta, clara;
 * el corazón, el tono más claro.
 */
export function paintCrystalStar(pal: readonly number[]): Pixels {
  const k = LOOK.detail;
  const outer = LOOK.outer * k;
  const inner = LOOK.inner * k;
  const size = Math.ceil(outer * 2) + 3;
  const c = size / 2;
  const poly = starVertices(c, outer, inner);
  const p = makePixels(size, size);
  const light = (-3 * Math.PI) / 4;
  const isIn = (x: number, y: number) => inside(poly, x + 0.5, y + 0.5);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!isIn(x, y)) continue;
      const dx = x + 0.5 - c;
      const dy = y + 0.5 - c;
      const edge = !isIn(x - 1, y) || !isIn(x + 1, y) || !isIn(x, y - 1) || !isIn(x, y + 1);
      if (edge) {
        put(p, x, y, pal[0]);
        continue;
      }
      const a = Math.atan2(dy, dx);
      // La punta más cercana y de qué lado de su arista cae el píxel.
      const sector = (a + Math.PI / 2) / ((2 * Math.PI) / 5);
      const tip = Math.round(sector);
      const tipA = -Math.PI / 2 + (tip * 2 * Math.PI) / 5;
      let off = a - tipA;
      off = Math.atan2(Math.sin(off), Math.cos(off));
      const facet = tipA + Math.sign(off || 1) * (Math.PI / 5) * 0.75;
      const b = Math.cos(facet - light);
      let s = b > 0.55 ? 4 : b > 0.05 ? 3 : b > -0.5 ? 2 : 1;
      const dist = Math.hypot(dx, dy);
      // La arista: cerca de la línea del centro a la punta.
      if (Math.abs(Math.sin(off)) * dist < 0.75 && dist > inner * 0.5) s = Math.min(5, s + 1);
      if (dist < inner * 0.55) s = 5;
      else if (dist < inner * 0.85) s = Math.max(s, 4);
      put(p, x, y, pal[clamp(s, 0, pal.length - 1)]);
    }
  }
  return p;
}

/** Halo redondo de radio `r` píxeles, en escalones de alfa con tramado (pixel art, no un desenfoque). */
export function paintHalo(r: number, colors: readonly number[], alphas: readonly number[]): Pixels {
  const size = r * 2 + 1;
  const p = makePixels(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = 1 - Math.hypot(x - r, y - r) / r;
      if (d <= 0) continue;
      // El tramado, solo en una franja angosta entre escalones (en un área grande se lee como una rejilla).
      const v = d + bayer(x, y) * 0.07;
      const level = v > 0.6 ? 2 : v > 0.3 ? 1 : v > 0.06 ? 0 : -1;
      if (level < 0) continue;
      const t = clamp(d * 1.4, 0, 1);
      put(p, x, y, mix(colors[0], colors[1], t), Math.round(alphas[level] * 255));
    }
  }
  return p;
}

/** Destello de cuatro puntas: brazos finos que se apagan, el centro blanco. */
export function paintGlint(arm: number, color: number): Pixels {
  const size = arm * 2 + 1;
  const p = makePixels(size, size);
  for (let i = 1; i <= arm; i++) {
    const a = Math.round(255 * Math.pow(1 - i / (arm + 1), 1.2));
    for (const [x, y] of [[arm + i, arm], [arm - i, arm], [arm, arm + i], [arm, arm - i]]) put(p, x, y, color, a);
  }
  for (const [x, y, a] of [[arm, arm, 255], [arm - 1, arm - 1, 110], [arm + 1, arm - 1, 110], [arm - 1, arm + 1, 110], [arm + 1, arm + 1, 110]]) {
    put(p, x, y, color, a);
  }
  return p;
}

/** Rayos de la estrella encendida: ocho, largos y cortos alternados, que se afinan y se apagan con tramado. */
export function paintRays(len: number, color: number): Pixels {
  const size = len * 2 + 1;
  const p = makePixels(size, size);
  for (let k = 0; k < 8; k++) {
    const a = (k * Math.PI) / 4 + Math.PI / 8;
    const l = k % 2 === 0 ? len : len * 0.6;
    for (let i = 3; i < l; i++) {
      const t = i / l;
      if (t > 0.5 && bayer(i, k) + 0.5 < (t - 0.5) * 2) continue;
      put(p, Math.round(len + Math.cos(a) * i), Math.round(len + Math.sin(a) * i), color, Math.round(200 * (1 - t)));
    }
  }
  return p;
}

export function starAtlasFrames(): AtlasFrame[] {
  const k = LOOK.detail;
  return [
    { name: STAR_FRAMES.idle, px: paintCrystalStar(LOOK.idle) },
    { name: STAR_FRAMES.lit, px: paintCrystalStar(LOOK.lit) },
    { name: STAR_FRAMES.haloIdle, px: paintHalo(LOOK.haloIdle.radius * k, LOOK.haloIdle.colors, LOOK.haloIdle.alphas) },
    { name: STAR_FRAMES.haloLit, px: paintHalo(LOOK.haloLit.radius * k, LOOK.haloLit.colors, LOOK.haloLit.alphas) },
    { name: STAR_FRAMES.glint, px: paintGlint(LOOK.glint.arm * k, LOOK.glint.color) },
    { name: STAR_FRAMES.rays, px: paintRays(LOOK.rays.length * k, LOOK.rays.color) },
  ];
}

/**
 * El titilar de la estrella `i` a `t` ms (0..1): un destello corto cada `periodMs`, desfasado por estrella (no titilan
 * juntas). 0 la mayor parte del tiempo.
 */
export function twinkleAt(i: number, t: number): number {
  const tw = LOOK.twinkle;
  const period = tw.periodMs[0] + ((i * 0.618) % 1) * (tw.periodMs[1] - tw.periodMs[0]);
  const phase = ((t + i * tw.offsetMs) % period) / period;
  const w = tw.flashMs / period;
  if (phase > w) return 0;
  return Math.sin((phase / w) * Math.PI);
}
