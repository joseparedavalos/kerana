import { GAMEPLAY } from '../../config/gameplay';
import { type AtlasFrame, alphaAt, bayer, makePixels, type Pixels, put } from '../../systems/pixelArt';

// Pintor de las estrellas de siesta de Jasy Jatere (S103): lógica pura, sin Phaser. Cada función devuelve píxeles
// RGBA a PAINT_K píxeles por unidad (el detalle de los jefes); jasyFx.ts los sube como un solo atlas, una vez.
const LOOK = GAMEPLAY.jasyJatereLook;
const STAR = LOOK.star;
const R = GAMEPLAY.jasyJatere.sparkRadius;
/** Píxeles de arte por unidad del mundo (el `detail` de los jefes). */
export const PAINT_K = 2;
const [GOLD_SHADOW, GOLD_DARK, GOLD_MID, GOLD, CREAM] = LOOK.gold;

/** Lado (px) del cuadro de una estrella: entra la estrella destellando. */
export function starFrameSize(): number {
  return 2 * Math.ceil(STAR.flareSpike * R * PAINT_K) + 1;
}

/**
 * Estrella de cuatro puntas girada `deg` grados: núcleo blanco caliente, cuerpo crema, puntas doradas y el canto de
 * las puntas en oro medio (se lee sobre el cielo claro y sobre el lapacho). `flare`: las puntas se estiran y se
 * afinan y el núcleo crece (el destello al pasar por los ejes).
 */
export function paintStar(deg: number, flare: boolean): Pixels {
  const K = PAINT_K;
  const size = starFrameSize();
  const c = (size - 1) / 2;
  const p = makePixels(size, size);
  const theta = (deg * Math.PI) / 180;
  const spike = (flare ? STAR.flareSpike : STAR.spike) * R * K;
  const body = STAR.body * R * K * (flare ? 1.15 : 1);
  const core = STAR.core * R * K * (flare ? 1.4 : 1);
  // Astroide (lados cóncavos, puntas que se afinan) girado `theta`, con el cuerpo redondo encima. `level`: 0 en el
  // centro, 1 en el borde (en la medida del astroide): de ahí sale el color, del núcleo blanco a las puntas.
  const q = STAR.sharpness * (flare ? 0.82 : 1);
  const astroid = (dx: number, dy: number, len: number, rot: number): number => {
    const u = Math.abs(dx * Math.cos(rot) + dy * Math.sin(rot)) / len;
    const v = Math.abs(-dx * Math.sin(rot) + dy * Math.cos(rot)) / len;
    return Math.pow(u, q) + Math.pow(v, q);
  };
  const level = (x: number, y: number): number => {
    const dx = x - c;
    const dy = y - c;
    let l = astroid(dx, dy, spike, theta);
    const r = Math.hypot(dx, dy);
    if (r <= body) l = Math.min(l, (r / body) * 0.55);
    return l;
  };
  const inside = (x: number, y: number): boolean => level(x, y) <= 1;
  const coreL = (core / body) * 0.55;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const l = level(x, y);
      if (l > 1) continue;
      const edge = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1);
      const r = Math.hypot(x - c, y - c);
      let color: number;
      if (l <= coreL) color = LOOK.core;
      else if (l <= coreL * (flare ? 2.1 : 1.7)) color = CREAM;
      else if (r >= spike * 0.8) color = GOLD_MID; // las puntas se apagan
      else if (edge) color = r > body * 1.3 ? GOLD_MID : GOLD;
      else color = GOLD;
      put(p, x, y, color);
    }
  }
  // Cada punta, cerrada con una línea hasta casi la punta: girada no se corta en píxeles sueltos.
  for (let k = 0; k < 4; k++) {
    const a = theta + (k * Math.PI) / 2;
    for (let t = body; t <= spike * 0.94; t += 0.5) {
      const x = Math.round(c + Math.cos(a) * t);
      const y = Math.round(c + Math.sin(a) * t);
      if (!alphaAt(p, x, y)) put(p, x, y, t < spike * 0.6 ? GOLD : GOLD_MID);
    }
  }
  return p;
}

/** Resplandor tramado en blanco (se tiñe con `halo` y se suma): cuatro escalones de alfa, radio `r` unidades. */
export function paintHalo(r: number): Pixels {
  const K = PAINT_K;
  const size = 2 * Math.ceil(r * K) + 1;
  const c = (size - 1) / 2;
  const p = makePixels(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x - c, y - c) / (c + 0.5);
      if (d >= 1) continue;
      // Anillos limpios (el tramado solo en la juntura): sumado al fondo, un tramado ancho se ve como ruido.
      const v = Math.pow(1 - d, 1.5) + bayer(x, y) * 0.07;
      const a = v > 0.6 ? 220 : v > 0.36 ? 140 : v > 0.16 ? 75 : v > 0.05 ? 30 : 0;
      if (a) put(p, x, y, 0xffffff, a);
    }
  }
  return p;
}

/** Motas de la estela, del estallido y del aviso: grande (cruz), caliente, dorada, honda y diminuta. */
export type MoteKind = 'big' | 'hot' | 'gold' | 'deep' | 'tiny';
export const MOTE_KINDS: readonly MoteKind[] = ['big', 'hot', 'gold', 'deep', 'tiny'];

export function paintMote(kind: MoteKind): Pixels {
  if (kind === 'big') {
    const p = makePixels(5, 5);
    for (let y = 0; y < 5; y++) {
      for (let x = 0; x < 5; x++) {
        const d = Math.abs(x - 2) + Math.abs(y - 2);
        const arm = x === 2 || y === 2;
        if (d === 0) put(p, x, y, LOOK.core);
        else if (d === 1) put(p, x, y, CREAM);
        else if (arm) put(p, x, y, GOLD);
      }
    }
    return p;
  }
  if (kind === 'tiny') {
    const p = makePixels(1, 1);
    put(p, 0, 0, CREAM);
    return p;
  }
  const p = makePixels(2, 2);
  const color = kind === 'hot' ? CREAM : kind === 'gold' ? GOLD : GOLD_MID;
  for (let i = 0; i < 4; i++) put(p, i & 1, i >> 1, color);
  // Una esquina más oscura: la mota no es un cuadrado plano.
  put(p, 1, 1, kind === 'hot' ? GOLD : kind === 'gold' ? GOLD_MID : GOLD_DARK);
  return p;
}

/** Destello del estallido: ocho rayos (cuatro largos, cuatro cortos) con el núcleo blanco; `r` unidades. */
export function paintFlash(r: number): Pixels {
  const K = PAINT_K;
  const size = 2 * Math.ceil(r * K) + 1;
  const c = (size - 1) / 2;
  const p = makePixels(size, size);
  const core = r * K * 0.22;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = Math.abs(x - c);
      const dy = Math.abs(y - c);
      const d = Math.hypot(dx, dy);
      const axis = (dx <= 0.5 && dy <= c) || (dy <= 0.5 && dx <= c);
      const axisWide = (dx <= 1.5 && dy <= c * 0.45) || (dy <= 1.5 && dx <= c * 0.45);
      const diagRay = Math.abs(dx - dy) <= 0.5 && d <= c * 0.62;
      if (d <= core) put(p, x, y, LOOK.core);
      else if (d <= core * 1.7 + bayer(x, y)) put(p, x, y, CREAM);
      else if (axisWide) put(p, x, y, d < c * 0.3 ? CREAM : GOLD);
      else if (axis) put(p, x, y, d < c * 0.7 ? GOLD : GOLD_MID);
      else if (diagRay) put(p, x, y, d < c * 0.35 ? CREAM : GOLD_MID);
    }
  }
  return p;
}

/**
 * Bastón (en alto y suelto) a PAINT_K px por unidad, del tamaño de su caja (`staffWidth` × `staffHeight`): vara de
 * madera con la enredadera verde de la hoja, un collar y la cabeza de oro con su cristal. Mirando arriba.
 */
export function paintStaff(): Pixels {
  const K = PAINT_K;
  const w = GAMEPLAY.jasyJatere.staffWidth * K;
  const h = GAMEPLAY.jasyJatere.staffHeight * K;
  const p = makePixels(w, h);
  const [woodShadow, woodDark, wood, woodLight] = LOOK.wood;
  const [vineDark, vine] = LOOK.vine;
  const cx = Math.floor(w / 2) - 1; // la vara ocupa cx y cx + 1
  const headBottom = Math.round(h * 0.27);
  // Vara.
  for (let y = headBottom + 2; y < h; y++) {
    put(p, cx, y, y % 5 === 0 ? woodLight : wood);
    put(p, cx + 1, y, woodDark);
    if (y === h - 1) put(p, cx + 1, y, woodShadow);
  }
  // Enredadera en espiral: un brote a cada lado, alternado.
  for (let y = headBottom + 4; y < h - 2; y += 6) {
    const left = ((y / 6) | 0) % 2 === 0;
    const x = left ? cx - 1 : cx + 2;
    put(p, x, y, vine);
    put(p, x, y + 1, vineDark);
    put(p, left ? cx : cx + 1, y + 2, vineDark);
  }
  // Collar.
  for (let x = cx - 1; x <= cx + 2; x++) {
    put(p, x, headBottom, x === cx - 1 ? GOLD : GOLD_MID);
    put(p, x, headBottom + 1, GOLD_DARK);
  }
  // Cabeza: dos hojas de oro que abrazan un cristal en gota, con luz arriba a la izquierda.
  const top = 1;
  for (let y = top; y < headBottom; y++) {
    const t = (y - top) / (headBottom - top); // 0 arriba, 1 en el collar
    const half = 0.8 + Math.sin(Math.min(1, t * 1.15) * Math.PI) * (w * 0.32);
    for (let x = 0; x < w; x++) {
      const dx = x + 0.5 - (cx + 1);
      if (Math.abs(dx) > half) continue;
      const crystal = Math.abs(dx) <= half - 1.6 && t > 0.08 && t < 0.86;
      let color: number;
      if (crystal) color = dx < 0 && t < 0.5 ? LOOK.core : t < 0.6 ? CREAM : GOLD;
      else color = Math.abs(dx) > half - 0.9 ? (dx < 0 ? GOLD_MID : GOLD_DARK) : GOLD;
      put(p, x, y, color);
    }
  }
  put(p, cx, 0, GOLD_MID);
  put(p, cx + 1, 0, GOLD_DARK);
  // Canto oscuro abajo de las hojas, donde tocan el collar.
  for (let x = 0; x < w; x++) if (alphaAt(p, x, headBottom - 1) && !alphaAt(p, x, headBottom)) put(p, x, headBottom - 1, GOLD_SHADOW);
  return p;
}

/** Nombre del cuadro de la estrella `i` (0 alineada con los ejes), normal o destellando. */
export const starFrame = (i: number, flare: boolean): string => `star_${flare ? 'f' : 'n'}${i}`;
export const moteFrame = (kind: MoteKind): string => `mote_${kind}`;
export const HALO_FRAME = 'halo';
export const FLASH_FRAME = 'flash';
export const STAFF_FRAME = 'staff';

/** Todos los cuadros del atlas de las estrellas, en orden. */
export function starAtlasFrames(): AtlasFrame[] {
  const frames: AtlasFrame[] = [];
  for (let i = 0; i < STAR.frames; i++) {
    const deg = (i * 90) / STAR.frames;
    frames.push({ name: starFrame(i, false), px: paintStar(deg, false) });
    frames.push({ name: starFrame(i, true), px: paintStar(deg, true) });
  }
  frames.push({ name: HALO_FRAME, px: paintHalo(STAR.haloRadius) });
  frames.push({ name: FLASH_FRAME, px: paintFlash(R * STAR.flareSpike) });
  for (const kind of MOTE_KINDS) frames.push({ name: moteFrame(kind), px: paintMote(kind) });
  frames.push({ name: STAFF_FRAME, px: paintStaff() });
  return frames;
}

/** Color de la mota de la estela según lo que le queda de vida (1 recién nacida, 0 apagada): se enfría. */
export function trailMoteKind(lifeLeft: number, big: boolean): MoteKind {
  if (lifeLeft > 0.62) return big ? 'big' : 'hot';
  return lifeLeft > 0.3 ? 'gold' : 'deep';
}
