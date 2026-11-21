// Tileset del cielo (Yvága) dibujado por código (S118). Lo escribe tools/make-terrain-tiles.mjs (npm run terrain-tiles --
// cielo); lo prueba tests/cieloTiles.test.ts. Lo común (azar, grilla, paleta, armado de las hojas) está en tile-art.mjs.
// Todo sale de semillas fijas: correr el script dos veces da los mismos bytes.
//
// La idea: las islas son ruinas de piedra clara (sillares en dos hiladas, juntas oscuras) con musgo verde arriba, del
// mismo estilo que las islas del fondo; el verde es lo que se lee contra todos los violetas. Una isla mide una fila (dos
// como mucho): por debajo, la piedra termina en un cascajo en sombra y, en la celda de aire de abajo, una quilla de roca
// con dientes y raíces que cuelgan (calcomanías de la hoja de detalle: la colisión no cambia). Lo de un sentido (16 a
// 18) son bancos de nube: la cara de arriba firme y clara, el cuerpo en lóbulos y la panza tramada que deja ver el cielo.
// La regla: lo que es nube se atraviesa, lo que es piedra no. El piso de la arena es una terraza de piedra antigua (la
// zona `terrace` de la hoja). La mampostería es periódica de 16 px en las dos direcciones y cada tratamiento de borde
// depende solo de la posición dentro de la casilla: dos vecinas empalman siempre.

import {
  buildDetailSheet,
  buildTilesetImage,
  DOWN,
  Grid,
  LEFT,
  makePalette,
  mod,
  mulberry32,
  RIGHT,
  restoreSolidBands,
  T,
  UP,
} from './tile-art.mjs';

// ─── Paleta (medida en public/assets/backgrounds/yvaga_subida.jpg, cuantizando recortes) ─────────────────────────────
// Piedra: las islas con ruinas del fondo (#553d7b, #73538f, #8a639c, #a373a3, #af7db2): el mismo malva, más claro y más
// cálido porque esto está adelante y tiene que leerse contra la noche (#171135 … #322259) y el violeta (#594082 …
// #aa6b9f); la luz, del atardecer del horizonte (#f3a6a8, #fabcac) llevada al marfil. Bajo la isla, la panza del fondo
// (#3b2f68 … #634b85), en sombra. Musgo: un verde saturado, el complemento de los violetas. Nube: el mar de nubes de
// abajo (#464084, #64539b, #8967ab, #b180b9, #cd93bc) aclarado y enfriado hasta casi blanco arriba, para que la cara
// firme se lea más clara que cualquier nube del fondo. Cristal y bruma, a tono con el violeta del medio.
export const RAMPS = {
  stone: ['#261b33', '#41334f', '#61526b', '#85768d', '#a999ab', '#cdbdc6', '#ebdedc'],
  under: ['#150f25', '#211839', '#30254d', '#433663', '#5a4a7b', '#76669a'],
  moss: ['#122a1c', '#1d4527', '#2c6330', '#418539', '#5fa744', '#8cc855', '#c2e47a'],
  root: ['#1f1527', '#352436', '#4f3846', '#6e5258', '#8f7068'],
  bloom: ['#f7f2f6', '#f4d879', '#c89be2', '#e2a1c4'],
  rune: ['#3d8fa3', '#6fc8d2', '#b7f1ef'],
  cloud: ['#4e4385', '#6c5ea5', '#8f81c2', '#b4a7da', '#d9cdee', '#f5eff9', '#fffbfd'],
  crystal: ['#231c47', '#3d3478', '#6656ac', '#988ad8', '#cbc2f4', '#f4f0ff'],
  mist: ['#3a3070', '#55478f', '#7a69b0', '#a998d4', '#d1c6ec'],
  shadow: ['#0c0918'],
};
export const PALETTE = makePalette(RAMPS);
/** Una grilla vacía con la paleta del cielo. */
const grid = (w, h) => new Grid(w, h, PALETTE);

export { T };

// ─── La mampostería base ───────────────────────────────────────────────────────────────────────────────────────────
// Dos hiladas de sillares por casilla: la A (filas 4 a 11, la que se ve en una isla de una fila) y la B (filas 13 a 18,
// es decir 13 a 15 y 0 a 2: cruza la costura de arriba). Juntas horizontales en las filas 3 y 12.
export const COURSE_A = { y0: 4, y1: 11 };
export const COURSE_B = { y0: 13, y1: 18 };
/** Juntas verticales de la base: en la A, dos sillares de 8; en la B, uno de 16 que cruza la costura de los costados. */
export const JOINTS = { a: [5, 13], b: [9] };
/**
 * Tono de cada sillar (por hilada, en el orden de sus juntas): 'plain' liso, 'dark' con la cara tramada un tono abajo,
 * 'warm' con la luz más ancha, 'worn' gastado (poros y el filo comido).
 */
export const TONES = { a: ['plain', 'warm'], b: ['dark'] };
/** Poros y granos de la base (x, y, tono): pocos, de bajo contraste, lejos de las juntas. */
export const GRAIN = [
  [8, 6, 3],
  [10, 9, 5],
  [2, 8, 3],
  [15, 5, 5],
  [11, 14, 3],
  [4, 15, 5],
  [6, 1, 3],
];

/** Hilada (a, b o la junta horizontal) de la fila y (periódica). */
function courseAt(y) {
  const r = mod(y, T);
  if (r === 3 || r === 12) return null;
  return r >= COURSE_A.y0 && r <= COURSE_A.y1 ? 'a' : 'b';
}

/** Posición dentro del sillar en (x, y): distancias a sus cuatro bordes y su índice en la hilada. -1 en una junta. */
function blockAt(x, y, joints) {
  const c = courseAt(y);
  if (!c) return null;
  const js = joints[c];
  const xx = mod(x, T);
  if (js.includes(xx)) return { course: c, joint: true };
  // El sillar va de la junta de la izquierda + 1 a la de la derecha − 1 (con vuelta).
  let left = 0;
  while (!js.includes(mod(xx - left - 1, T)) && left < T) left++;
  let right = 0;
  while (!js.includes(mod(xx + right + 1, T)) && right < T) right++;
  const start = mod(xx - left, T);
  const idx = js.length ? [...js].sort((a, b) => a - b).findIndex((j, i, arr) => mod(start - 1, T) === j) : 0;
  const { y0, y1 } = c === 'a' ? COURSE_A : COURSE_B;
  const ry = c === 'b' && mod(y, T) < y0 ? mod(y, T) + T : mod(y, T);
  return { course: c, joint: false, left, right, top: ry - y0, bottom: y1 - ry, index: Math.max(0, idx) };
}

/**
 * La mampostería (casilla 15). `opts`: { joints, tones, grain } (cada uno opcional). Cara de cada sillar en el tono 4,
 * filo de arriba y de la izquierda claros (5), el de abajo en sombra (2) y el de la derecha un tono abajo (3); juntas en
 * el 1 con algún hueco más hondo (0).
 */
export function baseStone(opts = {}) {
  const joints = opts.joints ?? JOINTS;
  const tones = opts.tones ?? TONES;
  const grain = opts.grain ?? GRAIN;
  const g = grid(T, T);
  for (let y = 0; y < T; y++) {
    for (let x = 0; x < T; x++) {
      const b = blockAt(x, y, joints);
      if (!b || b.joint) {
        // Junta: oscura, con algún hueco más hondo y algún tramo relleno.
        const deep = (x * 5 + y * 3) % 13 === 0;
        g.set(x, y, 'stone', deep ? 0 : 1);
        continue;
      }
      const tone = tones[b.course][b.index % tones[b.course].length];
      let s = 4;
      if (b.top === 0) s = 5;
      else if (b.bottom === 0) s = 2;
      else if (b.left === 0) s = 5;
      else if (b.right === 0) s = 3;
      else if (tone === 'dark') s = (x * 7 + y * 5) % 9 === 0 ? 4 : 3;
      else if (tone === 'warm' && b.top === 1 && b.right > 1) s = 5;
      else if (tone === 'worn' && (x * 3 + y * 7) % 5 === 0) s = 3;
      // El filo de arriba claro se corta en las esquinas (el sillar está gastado).
      if (b.top === 0 && (b.left === 0 || b.right === 0)) s = 4;
      if (b.bottom === 0 && b.right === 0) s = 1;
      g.set(x, y, 'stone', s);
    }
  }
  for (const [x, y, s] of grain) {
    const b = blockAt(x, y, joints);
    if (b && !b.joint && b.top > 0 && b.bottom > 0 && b.left > 0 && b.right > 0) g.set(x, y, 'stone', s);
  }
  return g;
}

// ─── Perfiles de los bordes (periódicos a lo largo de su lado) ─────────────────────────────────────────────────────
/** Musgo de arriba: primera fila (top) y última (bottom) de cada columna, puntas, matas que cuelgan delante del sillar. */
export const MOSS = {
  top: [1, 1, 0, 1, 2, 1, 1, 0, 1, 1, 2, 1, 1, 0, 1, 1],
  bottom: [3, 3, 4, 3, 3, 3, 4, 4, 3, 3, 3, 3, 4, 3, 3, 3],
  /** Briznas: [x, fila de la punta]. */
  blades: [[2, 0], [7, 0], [13, 0], [10, 1]],
  /** Matas que cuelgan delante del sillar: [x, última fila]. */
  drapes: [[6, 6], [7, 5], [12, 7]],
  /** En una esquina, cuánto baja el musgo por el costado (columna de afuera, la siguiente). */
  side: [7, 5],
};
/** El cascajo de abajo (filas 12 a 15, con aire debajo): dónde se separan los trozos de roca. */
export const UNDER = { breaks: [4, 9, 13], lit: [1, 5, 10, 14] };
/** Muescas de los costados: cuántos píxeles faltan en cada fila (columna de afuera). */
export const NOTCH = {
  left: [0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0],
  right: [0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0],
};
/** Achaflanado de las esquinas de abajo (filas 12 a 15): píxeles que faltan desde afuera. */
const UNDER_CHAMFER = [1, 2, 4];

/**
 * El cascajo bajo la isla (filas 13 a 15): trozos de roca en el violeta de la panza de las islas del fondo, con la luz en
 * el canto izquierdo de cada trozo; sigue igual en la quilla de la celda de abajo (fila 0 en el tono 3).
 */
function paintUnderside(g, under) {
  for (let x = 0; x < T; x++) {
    const brk = under.breaks.includes(x);
    for (let y = 13; y < T; y++) {
      let s = 3;
      if (brk) s = y === 13 ? 1 : 2;
      else if (under.lit.includes(x)) s = y === 15 ? 3 : 4;
      else if (y === 14 && (x * 3) % 5 === 1) s = 2;
      g.set(x, y, 'under', s);
    }
    // La hilada A termina sobre el cascajo: la junta de la fila 12, honda; el filo de abajo del sillar, en sombra.
    g.set(x, 12, 'stone', brk ? 0 : 1);
    if (g.ramp(x, 11) === 'stone' && g.step(x, 11) > 2) g.set(x, 11, 'stone', 2);
  }
}

/** Un extremo de isla: el sillar termina con su cara (filo claro a la izquierda, sombra a la derecha) y muescas. */
function paintEnd(g, side, notch, air) {
  const outer = side === 'left' ? 0 : T - 1;
  const inner = side === 'left' ? 1 : T - 2;
  const dir = side === 'left' ? 1 : -1;
  const nl = side === 'left' ? notch.left : notch.right;
  for (let y = 0; y < T; y++) {
    const n = nl[y];
    for (let k = 0; k < n; k++) g.clear(outer + dir * k, y);
    const xo = outer + dir * n;
    const xi = xo + dir;
    if (!g.opaque(xo, y)) continue;
    if (y >= 13 && air.down) {
      g.set(xo, y, 'under', side === 'left' ? 2 : 0);
      continue;
    }
    const c = courseAt(y);
    if (!c) {
      g.set(xo, y, 'stone', 0);
      continue;
    }
    // Izquierda: contorno en el 2 y filo claro adentro; derecha: contorno en el 0 y sombra adentro.
    g.set(xo, y, 'stone', side === 'left' ? 2 : 0);
    if (g.opaque(xi, y) && g.ramp(xi, y) === 'stone' && g.step(xi, y) > 1) g.set(xi, y, 'stone', side === 'left' ? 5 : 2);
  }
  if (air.down) {
    for (let r = 0; r < 3; r++) for (let k = 0; k < UNDER_CHAMFER[r]; k++) g.clear(outer + dir * k, 13 + r);
    for (let r = 0; r < 3; r++) {
      const x = outer + dir * UNDER_CHAMFER[r];
      if (g.opaque(x, 13 + r)) g.set(x, 13 + r, 'under', side === 'left' ? 4 : 1);
    }
  }
  if (air.up) for (const [dx, y] of [[0, 0], [1, 0], [0, 1]]) g.clear(outer + dir * dx, y);
}

/** El musgo de arriba: colchón con briznas, matas que cuelgan delante del sillar y la sombra que proyecta. */
function paintMossTop(g, moss, air) {
  const top = [...moss.top];
  const bottom = [...moss.bottom];
  if (air.left) {
    top[0] = Math.max(top[0], 2);
    top[1] = Math.max(top[1], 1);
  }
  if (air.right) {
    top[T - 1] = Math.max(top[T - 1], 2);
    top[T - 2] = Math.max(top[T - 2], 1);
  }
  // Bajo el musgo, la hilada A sube hasta el musgo: las filas 0 a 3 pasan a ser la cara del sillar.
  for (let x = 0; x < T; x++) {
    for (let y = 0; y <= 3; y++) {
      if (!g.opaque(x, y)) continue;
      const below = g.get(x, 4);
      if (below < 0) continue;
      const joint = g.ramp(x, 4) === 'stone' && g.step(x, 4) <= 1 && g.step(x, 6) <= 1;
      g.set(x, y, 'stone', joint ? 1 : 4);
    }
  }
  for (let x = 0; x < T; x++) {
    for (let y = 0; y < top[x]; y++) g.clear(x, y);
    const b = bottom[x];
    // Sombra del musgo sobre la piedra.
    if (g.opaque(x, b + 1) && g.ramp(x, b + 1) === 'stone') g.set(x, b + 1, 'stone', Math.min(g.step(x, b + 1), 2));
    if (g.opaque(x, b + 2) && g.ramp(x, b + 2) === 'stone' && x % 2 === 0) g.set(x, b + 2, 'stone', Math.min(g.step(x, b + 2), 3));
  }
  for (let x = 0; x < T; x++) {
    const h = top[x];
    const b = bottom[x];
    for (let y = h; y <= b; y++) {
      let s = y === h ? 5 : y === h + 1 ? 4 : y === b ? 1 : 3;
      if (s === 3 && (x * 7 + y * 3) % 5 === 0) s = 2;
      if (s === 4 && (x * 5 + y) % 4 === 0) s = 5;
      g.set(x, y, 'moss', s);
    }
  }
  for (const [x, tip] of moss.blades) {
    if ((air.left && x < 2) || (air.right && x > T - 3)) continue;
    for (let y = tip; y < top[x]; y++) g.set(x, y, 'moss', y === tip ? 6 : 5);
  }
  for (const [x, end] of moss.drapes) {
    if ((air.left && x < 2) || (air.right && x > T - 3)) continue;
    for (let y = bottom[x] + 1; y <= end; y++) g.set(x, y, 'moss', y === end ? 1 : y === bottom[x] + 1 ? 3 : 2);
    if (g.opaque(x, end + 1) && g.ramp(x, end + 1) === 'stone') g.set(x, end + 1, 'stone', Math.min(g.step(x, end + 1), 2));
  }
  // En las esquinas, el musgo baja por el costado.
  const side = (x, depth, outer) => {
    for (let y = top[x]; y <= depth; y++) {
      if (!g.opaque(x, y) && y > top[x] + 1) break;
      const s = y === depth ? 1 : outer ? (y < top[x] + 2 ? 4 : 2) : 3;
      g.set(x, y, 'moss', s);
    }
  };
  if (air.left) {
    side(0, moss.side[0], true);
    side(1, moss.side[1], false);
  }
  if (air.right) {
    side(T - 1, moss.side[0] - 1, true);
    side(T - 2, moss.side[1] + 1, false);
  }
}

/**
 * Una casilla del autotile (máscara: vecinos sólidos arriba 1, derecha 2, abajo 4, izquierda 8). `v` cambia lo propio:
 * { base, moss, under, notch } (lo que toca un lado sólido tiene que ser igual a la base).
 */
export function autotileCell(mask, v = {}) {
  const g = (v.base ?? baseStone()).clone();
  const air = { up: !(mask & UP), right: !(mask & RIGHT), down: !(mask & DOWN), left: !(mask & LEFT) };
  if (air.down) paintUnderside(g, v.under ?? UNDER);
  const notch = v.notch ?? NOTCH;
  if (air.left) paintEnd(g, 'left', notch, air);
  if (air.right) paintEnd(g, 'right', notch, air);
  if (air.up) paintMossTop(g, { ...MOSS, ...(v.moss ?? {}) }, air);
  return g;
}

// ─── Banco de nube (16 a 18): la cara de arriba firme y clara; abajo, lóbulos y la panza tramada ─────────────────
const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const bayer = (x, y) => (BAYER4[(mod(y, 4) << 2) | mod(x, 4)] + 0.5) / 16;

/** Lóbulos de la panza del medio (x, y, radio): periódicos de 16. */
export const CLOUD = {
  lobes: [[3, 7, 3.6], [9, 8, 4.2], [14, 6.5, 3.2]],
};
/** Filas de la losa de arriba de la nube (la cara firme, maciza, donde se para Kerana). */
const CLOUD_SLAB = 5;

/**
 * Banco de nube. La fila 0 es donde se para Kerana: las filas 0 a 4 son la cara firme (la 0 casi blanca, después el
 * claro que baja de a un tono), maciza; abajo, el cuerpo en lóbulos con su luz arriba a la izquierda, que se va en
 * escalones de alfa tramados (deja ver el cielo: es nube, se atraviesa). Los extremos, redondeados.
 */
export function cloudCell(kind /* 'left' | 'center' | 'right' */, v = {}) {
  const g = grid(T, T);
  const lobes = v.lobes ?? CLOUD.lobes;
  const lobe = (x, y) => {
    let d = 0;
    for (const [lx, ly, r] of lobes) {
      for (const k of [-T, 0, T]) {
        const dx = (x - (lx + k)) / (r * 1.2);
        const dy = (y - ly) / r;
        d = Math.max(d, 1 - (dx * dx + dy * dy));
      }
    }
    return d;
  };
  // Extremos: un óvalo hacia afuera (la cara de arriba también se redondea).
  const inEnd = (x, y) => {
    if (kind === 'center') return true;
    const ox = kind === 'left' ? x : T - 1 - x;
    if (y === 0 && ox < 3) return false;
    if (y === 1 && ox < 1) return false;
    const r = 6.5;
    if (ox >= r) return true;
    const dx = (ox + 0.5 - r) / r;
    const dy = (y + 0.5 - 5) / 6.4;
    return dx * dx + dy * dy <= 1;
  };
  for (let y = 0; y < T; y++) {
    for (let x = 0; x < T; x++) {
      if (!inEnd(x, y)) continue;
      const slab = y < CLOUD_SLAB;
      const d = slab ? 1 : lobe(x + 0.5, y + 0.5);
      const v2 = d + (0.5 - bayer(x, y)) * 0.18;
      if (!slab && v2 < 0.1) continue;
      const alpha = slab || v2 > 0.5 ? 255 : v2 > 0.25 ? 215 : 150;
      let s;
      if (y === 0) s = 6;
      else if (y === 1) s = 5;
      else if (y === 2) s = (x * 5) % 7 === 0 ? 4 : 5;
      else if (y < CLOUD_SLAB) s = 4;
      else {
        // El lóbulo mira a la luz si crece hacia abajo a la derecha.
        const toward = lobe(x + 1.5, y + 1.5) - lobe(x - 0.5, y - 0.5);
        s = toward > 0.12 ? 4 : d < 0.25 ? 1 : y < 9 ? 3 : 2;
      }
      g.set(x, y, 'cloud', s, alpha);
    }
  }
  return g;
}

// ─── Espinas, agua, lo que se rompe y la decoración (Yvága no las usa; a tono) ─────────────────────────────────────
/** Espinas (19): astillas de cristal violeta en punta, cara iluminada a la izquierda, filo claro y pie de cascajo. */
export function spikesCell() {
  const g = grid(T, T);
  // [x de la base, ancho, alto, inclinación de la punta], de atrás para adelante.
  const shards = [[9, 5, 13, 1], [1, 5, 9, 0], [4, 6, 14, 0], [11, 4, 9, -1]];
  for (const [bx, bw, h, lean] of shards) {
    const tipX = bx + Math.floor(bw / 2) + lean;
    for (let y = T - h; y < T; y++) {
      const t = (y - (T - h)) / (h - 1);
      const half = Math.max(0, Math.round((bw / 2) * t));
      const cx = Math.round(tipX + (bx + bw / 2 - tipX) * t);
      for (let x = cx - half; x <= cx + half; x++) {
        if (x < 0 || x >= T) continue;
        let s = x < cx ? 3 : x === cx ? 4 : 1;
        if (x === cx - half || x === cx + half) s = x === cx + half ? 0 : 2;
        if (y === T - h) s = 5;
        g.set(x, y, 'crystal', s);
      }
    }
  }
  for (let x = 0; x < T; x++) g.set(x, T - 1, 'under', x % 3 === 0 ? 3 : 1);
  return g;
}

/** Agua (20, 21): bruma de nube quieta, la superficie con su línea de luz; alfa 200. */
export function waterCell(surface, alpha = 200) {
  const g = grid(T, T);
  for (let y = 0; y < T; y++) {
    for (let x = 0; x < T; x++) {
      let s = surface ? (y < 2 ? 4 : y < 5 ? 3 : 2) : y < 8 ? 2 : 1;
      if (surface && y === 0 && (x * 3) % 5 === 1) s = 3;
      if ((x * 7 + y * 5) % 11 === 0) s = Math.max(0, s - 1);
      g.set(x, y, 'mist', s, alpha);
    }
  }
  return g;
}

/** Lo que se rompe (22): la mampostería con las grietas marcadas (núcleo oscuro, labio claro). */
export function crackedCell() {
  const g = baseStone({ tones: { a: ['worn', 'dark'], b: ['worn'] } });
  const cracks = [
    [[7, 0], [7, 1], [6, 2], [6, 3], [6, 4], [7, 5], [7, 6], [8, 7], [8, 8], [7, 9], [7, 10], [8, 11], [8, 12], [9, 13], [9, 14], [9, 15]],
    [[7, 6], [6, 6], [5, 7], [4, 7], [3, 8], [2, 8]],
    [[8, 8], [9, 8], [10, 9], [11, 9], [12, 10]],
    [[9, 13], [10, 13], [11, 14], [12, 14]],
  ];
  for (const pts of cracks) {
    for (const [x, y] of pts) g.set(x, y, 'stone', 0);
    for (const [x, y] of pts) if (g.step(x + 1, y) > 1 && !pts.some(([px, py]) => px === x + 1 && py === y)) g.set(x + 1, y, 'stone', 6);
  }
  return g;
}

/** Mata de musgo (23), apoyada abajo. */
export function mossTuftCell() {
  const g = grid(T, T);
  const cols = [[4, 12], [5, 10], [6, 9], [7, 11], [8, 8], [9, 10], [10, 9], [11, 12]];
  for (const [x, top] of cols) for (let y = top; y < T; y++) g.set(x, y, 'moss', y === top ? 6 : y === T - 1 ? 1 : y < top + 2 ? 4 : 3);
  return g;
}

/** Flores (24): estrellitas blancas y amarillas sobre musgo. */
export function flowersCell() {
  const g = mossTuftCell();
  for (const [x, y, c] of [[5, 9, 0], [9, 8, 1], [11, 10, 0]]) {
    g.set(x, y, 'bloom', c);
    g.set(x - 1, y, 'bloom', c === 1 ? 1 : 3);
    g.set(x + 1, y, 'bloom', c === 1 ? 1 : 3);
    g.set(x, y - 1, 'bloom', c);
    g.set(x, y + 1, 'moss', 2);
  }
  return g;
}

/** Cascotes (25): dos sillares partidos, apoyados abajo. */
export function stonesCell() {
  const g = grid(T, T);
  const rects = [[3, 11, 6, 5], [9, 12, 5, 4]];
  for (const [x0, y0, w, h] of rects) {
    for (let y = y0; y < y0 + h; y++) {
      for (let x = x0; x < x0 + w; x++) {
        const s = y === y0 ? 5 : x === x0 ? 5 : y === y0 + h - 1 ? 1 : x === x0 + w - 1 ? 2 : 4;
        g.set(x, y, 'stone', s);
      }
    }
    g.clear(x0 + w - 1, y0);
  }
  return g;
}

// ─── Variantes ─────────────────────────────────────────────────────────────────────────────────────────────────────
/** Juntas de la hilada A en las variantes (solo en el centro: el anillo de 2 px queda como la base). */
const JOINT_ALTS = [[5, 13], [8], [3, 10], [6, 12], [4, 9, 13], [7, 11], [5, 10], [9, 13]];
const TONE_ALTS = [
  ['plain', 'warm'],
  ['warm', 'dark'],
  ['dark', 'plain', 'worn'],
  ['worn', 'plain'],
  ['plain', 'dark', 'warm'],
  ['warm', 'worn'],
  ['dark', 'warm'],
  ['plain', 'worn'],
];
const MOSS_ALTS = [
  { top: [1, 1, 0, 1, 1, 2, 1, 1, 0, 1, 2, 2, 1, 0, 1, 1], bottom: [3, 3, 4, 4, 3, 3, 3, 4, 3, 3, 3, 3, 3, 4, 3, 3], blades: [[2, 0], [8, 0], [12, 1], [5, 0]], drapes: [[3, 7], [4, 5], [10, 6]] },
  { top: [1, 1, 1, 0, 1, 1, 2, 1, 1, 1, 0, 1, 2, 1, 1, 1], bottom: [3, 3, 3, 3, 4, 3, 3, 3, 3, 3, 4, 4, 3, 3, 3, 3], blades: [[3, 0], [10, 0], [6, 1]], drapes: [[9, 8]] },
  { top: [1, 1, 2, 1, 0, 1, 1, 1, 2, 1, 1, 0, 1, 1, 2, 1], bottom: [3, 3, 3, 4, 3, 3, 3, 3, 3, 4, 3, 3, 3, 3, 4, 3], blades: [[4, 0], [11, 0], [8, 1], [13, 1]], drapes: [[5, 5], [6, 7], [13, 6]] },
  { top: [1, 1, 0, 0, 1, 2, 1, 1, 1, 0, 1, 1, 2, 1, 0, 1], bottom: [3, 3, 3, 3, 4, 3, 3, 3, 4, 4, 3, 3, 3, 3, 3, 3], blades: [[2, 0], [3, 0], [9, 0], [14, 0]], drapes: [[11, 6]] },
];
const UNDER_ALTS = [
  { breaks: [3, 8, 12], lit: [1, 5, 9, 14] },
  { breaks: [5, 10], lit: [2, 7, 12] },
  { breaks: [4, 7, 11], lit: [1, 5, 9, 13] },
];

function variantStone(rng, k) {
  const a = JOINT_ALTS[k % JOINT_ALTS.length];
  const tones = TONE_ALTS[(k * 3 + 1) % TONE_ALTS.length];
  // Granos propios: la semilla de cada variante, solo en el centro.
  const grain = [];
  for (let i = 0; i < 6; i++) grain.push([2 + Math.floor(rng() * 12), 2 + Math.floor(rng() * 12), rng() < 0.5 ? 3 : 5]);
  return baseStone({ joints: { a, b: JOINTS.b }, tones: { a: tones, b: TONES.b }, grain });
}

/** Rasgos chicos de las variantes: un sillar desportillado, una grieta fina, una mancha de liquen-musgo. */
function paintChip(g, x0, y0, w, h) {
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) if (g.ramp(x, y) === 'stone' && g.step(x, y) > 1) g.set(x, y, 'stone', y === y0 + h - 1 ? 5 : x === x0 ? 1 : 2);
}
function paintHairline(g, pts) {
  for (const [x, y] of pts) if (g.ramp(x, y) === 'stone') g.set(x, y, 'stone', 1);
  for (const [x, y] of pts) if (g.ramp(x + 1, y) === 'stone' && g.step(x + 1, y) >= 3 && !pts.some(([px, py]) => px === x + 1 && py === y)) g.set(x + 1, y, 'stone', 5);
}

/** Variantes del relleno (15): otras juntas y tonos en el centro, un desportillado o una grieta. */
export function fillVariants(seed = 1181) {
  const rng = mulberry32(seed);
  const ref = baseStone();
  const out = [];
  for (let k = 0; k < 10; k++) {
    const g = variantStone(rng, k);
    if (k % 3 === 0) paintChip(g, 3 + (k % 5), 5, 3, 2);
    if (k % 3 === 1) paintHairline(g, [[6 + (k % 4), 4], [6 + (k % 4), 5], [7 + (k % 4), 6], [7 + (k % 4), 7]]);
    out.push(restoreSolidBands(g, ref, 15));
  }
  return out;
}

/** Variantes de los bordes de Yvága: 10 (la isla de una fila, casi todo el nivel), 14, 11, 2, 8, 0 y el medio de la nube. */
export function edgeVariants(seed = 1182) {
  const rng = mulberry32(seed);
  const out = {};
  const ref10 = autotileCell(10);
  out[10] = Array.from({ length: 8 }, (_, k) => {
    const base = variantStone(rng, k + 1);
    const g = autotileCell(10, { base, moss: MOSS_ALTS[k % MOSS_ALTS.length], under: UNDER_ALTS[k % UNDER_ALTS.length] });
    if (k % 4 === 1) paintChip(g, 4 + (k % 5), 7, 3, 2);
    if (k % 4 === 3) paintHairline(g, [[8, 5], [8, 6], [9, 7], [9, 8], [9, 9]]);
    return restoreSolidBands(g, ref10, 10);
  });
  for (const [mask, n] of [[14, 3], [11, 2], [2, 2], [8, 2], [0, 1]]) {
    const ref = autotileCell(mask);
    out[mask] = Array.from({ length: n }, (_, k) => {
      const base = variantStone(rng, k + 3);
      const g = autotileCell(mask, { base, moss: MOSS_ALTS[(k + 1) % MOSS_ALTS.length], under: UNDER_ALTS[(k + 1) % UNDER_ALTS.length] });
      return restoreSolidBands(g, ref, mask);
    });
  }
  const cloudAlts = [
    { lobes: [[4, 8, 4], [10, 6.5, 3.4], [14, 7.5, 3]] },
    { lobes: [[2, 6.5, 3.2], [7, 8.5, 4.4], [13, 7, 3.6]] },
    { lobes: [[5, 7, 3.6], [11, 9, 4.6]] },
  ];
  out[17] = cloudAlts.map((v) => restoreSolidBands(cloudCell('center', v), cloudCell('center'), LEFT | RIGHT));
  return out;
}

// ─── La terraza de la arena (zona `terrace`): losas arriba, un friso tallado y sillares grandes ──────────────────
/** Friso de rombos (filas 5 a 9): cada 8 px un rombo con su punto, unidos por la línea del medio. */
function paintFrieze(g, worn = []) {
  const rh = [[2, 5], [1, 6], [0, 7], [1, 8], [2, 9]]; // [medio ancho desde el centro, fila]
  for (const c of [3, 11]) {
    for (const [hw, y] of rh) {
      const half = 2 - hw;
      for (const x of [c - half, c + half]) if (!worn.includes(`${x},${y}`)) g.set(x, y, 'stone', 1);
      if (!worn.includes(`${c - half + 1},${y}`) && half > 0) g.set(c - half + 1, y, 'stone', 5);
    }
    g.set(c, 7, 'stone', worn.includes(`${c},7`) ? 3 : 6);
  }
  // La línea que une los rombos.
  for (const x of [6, 7, 8, 14, 15, 0]) if (!worn.includes(`${x},7`)) g.set(x, 7, 'stone', 2);
  // Filetes de arriba y abajo del friso.
  for (let x = 0; x < T; x++) {
    g.set(x, 4, 'stone', 5);
    g.set(x, 10, 'stone', 2);
  }
}

/** Piso de la terraza (la 14 de la zona): la losa de arriba (filas 0 a 2), una junta, el friso y la hilada B. */
export function terraceTopCell(v = {}) {
  const g = baseStone({ joints: { a: [], b: JOINTS.b }, tones: { a: ['plain'], b: TONES.b } });
  const paverJoints = v.pavers ?? [7];
  for (let x = 0; x < T; x++) {
    g.set(x, 0, 'stone', 6);
    g.set(x, 1, 'stone', 5);
    g.set(x, 2, 'stone', paverJoints.includes(x) ? 1 : 3);
    g.set(x, 3, 'stone', 0);
    if (paverJoints.includes(x)) {
      g.set(x, 0, 'stone', 3);
      g.set(x, 1, 'stone', 1);
    }
  }
  for (let y = 5; y <= 9; y++) for (let x = 0; x < T; x++) g.set(x, y, 'stone', (x + y) % 2 ? 4 : 3);
  paintFrieze(g, v.worn ?? []);
  for (const [x, y] of v.moss ?? []) {
    g.set(x, y, 'moss', 4);
    g.set(x, y + 1, 'moss', 2);
  }
  return g;
}

/** Variantes de la zona `terrace`: el piso (14), el relleno (15) y el techo con quilla (11). */
export function terraceCells(seed = 1183) {
  const rng = mulberry32(seed);
  const ref14 = terraceTopCell();
  const tops = [
    {},
    { worn: ['3,5', '4,6', '11,9', '12,8'], moss: [[7, 2]] },
    { worn: ['10,6', '11,5', '0,7'], pavers: [7], moss: [[13, 2], [14, 2]] },
    { worn: ['2,8', '3,9', '4,8', '8,7'], moss: [[6, 2]] },
  ].map((v) => restoreSolidBands(terraceTopCell(v), ref14, LEFT | RIGHT | DOWN));
  const ref15 = baseStone();
  const fills = [0, 1, 2].map((k) => {
    const g = variantStone(rng, k + 5);
    if (k === 1) paintChip(g, 6, 6, 3, 2);
    return restoreSolidBands(g, ref15, 15);
  });
  const ref11 = autotileCell(11);
  const bottoms = [0, 1].map((k) => restoreSolidBands(autotileCell(11, { base: variantStone(rng, k + 2), under: UNDER_ALTS[k] }), ref11, 11));
  return { 14: tops, 15: fills, 11: bottoms };
}

// ─── Calcomanías ───────────────────────────────────────────────────────────────────────────────────────────────────
/**
 * Quilla bajo la isla (en la celda de aire de abajo; `g.h` 16 o 32): `b[x]` dice hasta qué fila baja la roca en cada
 * columna (-1: nada). Roca en el violeta de la panza (tono 3, como el cascajo de arriba, así empalma), el canto izquierdo
 * de cada diente con luz (4), el derecho en sombra (2), el contorno de abajo en el 1 y lo más hondo un tono abajo.
 * `roots`: [x, desde, largo, desvío de la punta]; `stone`: [x, y] de una piedra que cuelga de una raíz.
 */
function paintKeel(g, b, roots = [], stone = null, y0 = 0) {
  const H = g.h - y0;
  for (let x = 0; x < T; x++) {
    const bx = b[x];
    if (bx < 0) continue;
    for (let y = 0; y <= Math.min(bx, H - 1); y++) {
      const leftAir = x > 0 && b[x - 1] < y;
      const rightAir = x < T - 1 && b[x + 1] < y;
      let s = 3;
      if (y === bx) s = leftAir ? 2 : 1;
      else if (leftAir) s = 4;
      else if (rightAir) s = 2;
      else if (y > 4 && (x * 7 + y * 3) % 11 === 0) s = 4;
      else if (y > 6 && (x * 5 + y * 2) % 9 === 0) s = 2;
      if (s === 3 && y > 12) s = 2;
      if (s === 4 && y > 16) s = 3;
      g.set(x, y0 + y, 'under', s);
    }
  }
  for (const [x, y0, len, curl] of roots) {
    for (let k = 0; k < len; k++) {
      const y = y0 + k;
      if (y >= H) break;
      const xx = x + (curl && k > len - 3 ? curl : 0);
      if (g.ramp(xx, y) === 'under' && y <= b[xx]) continue;
      g.set(xx, y, 'root', k === len - 1 ? 3 : 2);
      if (k === 0 || g.ramp(xx - 1, y) === 'under') continue;
    }
  }
  if (stone) {
    const [sx, sy] = stone;
    for (const [dx, dy, t] of [[0, 0, 4], [1, 0, 3], [-1, 1, 4], [0, 1, 3], [1, 1, 2], [0, 2, 1], [-1, 2, 2], [1, 2, 1]]) g.set(sx + dx, sy + dy, 'under', t);
  }
}

/** Contorno de una quilla: lomos bajos (`lumps`, 16 valores con los extremos en 0) más conos [centro, hondo, medio ancho]. */
function keelContour(lumps, cones = []) {
  const b = lumps.map((l) => 3 + l);
  for (const [cx, depth, half] of cones) {
    for (let x = 0; x < T; x++) {
      const t = 1 - Math.abs(x + 0.5 - cx) / half;
      if (t <= 0) continue;
      b[x] = Math.max(b[x], Math.round(3 + (depth - 3) * Math.pow(t, 1.35)));
    }
  }
  return b;
}
/** Afina una quilla hacia afuera: `side` 'left' (la punta de la isla a la izquierda), 'right' o 'both'. */
function taper(b, side) {
  const lim = [-1, -1, -1, 1, 2, 3];
  return b.map((v, x) => {
    const ox = side === 'left' ? x : side === 'right' ? T - 1 - x : Math.min(x, T - 1 - x);
    return ox < lim.length ? Math.min(v, lim[ox]) : v;
  });
}

export function decals() {
  const out = {};
  const one = (fn, h = T) => {
    const g = grid(T, h);
    fn(g);
    return g;
  };
  const LUMPS = [
    [0, 0, 1, 1, 0, 0, 1, 2, 2, 1, 0, 0, 1, 1, 0, 0],
    [0, 1, 1, 0, 0, 1, 1, 1, 0, 0, 1, 2, 1, 0, 0, 0],
    [0, 0, 0, 1, 2, 2, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0],
    [0, 1, 2, 1, 0, 0, 0, 1, 1, 0, 0, 0, 1, 2, 1, 0],
  ];
  // El medio de una isla: lomos, uno o dos conos, raíces; los bordes en la fila 3 (empalman en cualquier orden).
  out.keelMid = [
    one((g) => paintKeel(g, keelContour(LUMPS[0]), [[5, 3, 6, 0], [12, 4, 4, 1]])),
    one((g) => paintKeel(g, keelContour(LUMPS[1], [[8, 10, 5]]), [[3, 3, 7, 1]])),
    one((g) => paintKeel(g, keelContour(LUMPS[2], [[5, 7, 3.5], [11.5, 12, 4]]), [[8, 3, 5, 0]])),
    one((g) => paintKeel(g, keelContour(LUMPS[3]), [[9, 3, 9, -1]])),
    one((g) => paintKeel(g, keelContour(LUMPS[0], [[6.5, 13, 4.5]]), [[12, 4, 6, 0]], null)),
  ];
  // El corazón de una isla ancha: un cono de dos celdas (como las islas del fondo), a veces con una piedra que cuelga.
  out.keelDeep = [
    one((g) => paintKeel(g, keelContour(LUMPS[1], [[8, 25, 7.5], [3, 7, 2.5]]), [[12, 6, 12, 0]]), 2 * T),
    one((g) => paintKeel(g, keelContour(LUMPS[2], [[7.5, 20, 6.5]]), [[11, 8, 13, 0]], [11, 21]), 2 * T),
    one((g) => paintKeel(g, keelContour(LUMPS[3], [[9, 28, 6], [4, 12, 3]]), [[4, 10, 8, 1]]), 2 * T),
  ];
  // Los extremos: la quilla se afina hacia afuera, siguiendo el achaflanado del cascajo de arriba.
  out.keelLeft = [
    one((g) => paintKeel(g, taper(keelContour(LUMPS[0], [[11, 8, 4]]), 'left'), [[13, 4, 5, 0]])),
    one((g) => paintKeel(g, taper(keelContour(LUMPS[2], [[12, 5, 3]]), 'left'), [[8, 3, 6, 1]])),
  ];
  out.keelRight = [
    one((g) => paintKeel(g, taper(keelContour(LUMPS[1], [[5, 8, 4]]), 'right'), [[2, 4, 5, 0]])),
    one((g) => paintKeel(g, taper(keelContour(LUMPS[3], [[4, 5, 3]]), 'right'), [[7, 3, 6, -1]])),
  ];
  out.keelSolo = [one((g) => paintKeel(g, taper(keelContour(LUMPS[0], [[8, 10, 4.5]]), 'both'), [[10, 3, 5, 0]]))];
  // En un pasaje bajo (menos de 4 filas de aire): solo los lomos.
  out.keelShortMid = [one((g) => paintKeel(g, keelContour(LUMPS[0]))), one((g) => paintKeel(g, keelContour(LUMPS[3])))];
  out.keelShortLeft = [one((g) => paintKeel(g, taper(keelContour(LUMPS[1]), 'left')))];
  out.keelShortRight = [one((g) => paintKeel(g, taper(keelContour(LUMPS[2]), 'right')))];
  out.keelShortSolo = [one((g) => paintKeel(g, taper(keelContour(LUMPS[0]), 'both')))];

  // Runas gastadas en la cara del sillar (filas 5 a 9): grabadas (surco oscuro, labio claro abajo a la derecha).
  const carve = (g, pts, glow = false) => {
    for (const [x, y] of pts) g.set(x, y, glow ? 'rune' : 'stone', glow ? 1 : 1);
    for (const [x, y] of pts) if (!pts.some(([px, py]) => px === x + 1 && py === y + 1)) g.set(x + 1, y + 1, glow ? 'rune' : 'stone', glow ? 0 : 5);
  };
  out.rune = [
    // Rombo con su punto (el motivo del friso), con un pedazo comido.
    one((g) => carve(g, [[7, 5], [6, 6], [8, 6], [5, 7], [9, 7], [6, 8], [7, 9], [7, 7]])),
    // Zigzag (una guarda).
    one((g) => carve(g, [[4, 8], [5, 7], [6, 6], [7, 7], [8, 8], [9, 7], [10, 6], [11, 7]])),
    // Tres puntos y una raya: la marca de un hijo.
    one((g) => carve(g, [[5, 6], [8, 6], [11, 6], [5, 8], [6, 8], [7, 8], [8, 8], [9, 8], [10, 8]])),
    // Un rombo con luz que se apaga (el único que brilla, apenas).
    one((g) => carve(g, [[8, 5], [7, 6], [9, 6], [6, 7], [10, 7], [7, 8], [9, 8], [8, 9]], true)),
  ];
  // Grietas finas que bajan del musgo por el sillar, con un quiebre de lado.
  const crackDecal = (pts) =>
    one((g) => {
      for (const [x, y] of pts) g.set(x, y, 'stone', 0);
      for (const [x, y] of pts) if (!pts.some(([px, py]) => px === x + 1 && py === y)) g.set(x + 1, y, 'stone', 4);
    });
  out.crack = [
    crackDecal([[6, 5], [6, 6], [7, 7], [7, 8], [7, 9], [8, 10]]),
    crackDecal([[10, 4], [10, 5], [9, 6], [9, 7], [10, 8], [10, 9]]),
    crackDecal([[4, 6], [5, 7], [5, 8], [6, 9], [6, 10]]),
  ];
  // Desportillado: falta la esquina de un sillar y se ve lo de adentro, más oscuro.
  const chipDecal = (x0, y0, w, h) =>
    one((g) => {
      for (let y = y0; y < y0 + h; y++) {
        for (let x = x0; x < x0 + w - (y - y0 > 0 ? 1 : 0); x++) {
          const s = y === y0 + h - 1 ? 4 : x === x0 ? 1 : 2;
          g.set(x, y, 'stone', s);
        }
      }
    });
  out.chip = [chipDecal(9, 5, 4, 3), chipDecal(3, 7, 3, 3), chipDecal(11, 8, 3, 2)];
  // Musgo que baja por la cara desde arriba (rompe la línea pareja del borde).
  const mossFace = (cols) =>
    one((g) => {
      for (const [x, y0, y1] of cols) for (let y = y0; y <= y1; y++) g.set(x, y, 'moss', y === y1 ? 1 : y === y0 ? 4 : (x + y) % 3 === 0 ? 3 : 2);
    });
  out.mossFace = [
    mossFace([[4, 4, 6], [5, 4, 8], [6, 4, 7], [7, 5, 6]]),
    mossFace([[9, 4, 7], [10, 4, 9], [11, 4, 8], [12, 5, 6], [8, 5, 5]]),
    mossFace([[2, 4, 5], [3, 4, 7], [4, 5, 6], [12, 4, 6], [13, 4, 5]]),
  ];
  // Enredadera que cuelga por la cara hasta el cascajo, con hojitas.
  const vine = (x, len, leaves) =>
    one((g) => {
      for (let y = 4; y < 4 + len; y++) g.set(x + ((y >> 2) % 2), y, 'moss', y === 3 + len ? 2 : 1);
      for (const [lx, ly] of leaves) {
        g.set(lx, ly, 'moss', 4);
        g.set(lx + 1, ly, 'moss', 3);
      }
    });
  out.vine = [vine(6, 10, [[7, 7], [5, 10], [7, 12]]), vine(11, 9, [[12, 6], [10, 9], [12, 11]])];
  // Flores en el musgo de arriba: estrellitas (cuatro pétalos) blancas, amarillas y lilas.
  const bloom = (list) =>
    one((g) => {
      for (const [x, y, c] of list) {
        g.set(x, y, 'bloom', c === 1 ? 1 : 0);
        for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1]]) g.set(x + dx, y + dy, 'bloom', c);
        g.set(x, y + 1, 'moss', 2);
      }
    });
  out.bloom = [bloom([[4, 2, 0], [10, 1, 1]]), bloom([[7, 1, 2], [12, 2, 0]]), bloom([[3, 1, 1], [8, 2, 3], [13, 1, 0]])];
  // Helechito que asoma del musgo.
  const fern = (x0, dir) =>
    one((g) => {
      const pts = [[0, 3], [0, 2], [dir, 1], [dir * 2, 0], [dir * 3, 0]];
      for (const [dx, y] of pts) g.set(x0 + dx, y, 'moss', 5);
      for (const [dx, y] of [[-dir, 2], [dir, 2], [0, 1], [dir * 2, 1]]) g.set(x0 + dx, y, 'moss', 3);
    });
  out.fern = [fern(5, 1), fern(11, -1)];
  // La terraza: musgo en las juntas de las losas y una grieta que cruza la losa.
  out.terraceMoss = [
    one((g) => {
      for (const [x, y, s] of [[6, 2, 3], [7, 2, 4], [8, 2, 3], [7, 3, 2], [8, 1, 5]]) g.set(x, y, 'moss', s);
    }),
    one((g) => {
      for (const [x, y, s] of [[12, 2, 4], [13, 2, 3], [11, 2, 2], [12, 1, 5], [13, 3, 1]]) g.set(x, y, 'moss', s);
    }),
  ];
  out.terraceCrack = [crackDecal([[4, 0], [4, 1], [5, 2]]), crackDecal([[12, 0], [11, 1], [11, 2]])];
  return out;
}

// ─── La losa que se mueve (S118): piedra flotante para Mover (la toma moverLook desde la hoja) ───────────────────
/** Una pieza de la losa móvil: la cara de piedra (filas 0 a 7) con musgo ralo arriba y un cascajo que se afina debajo. */
export function slabCell(kind /* 'left' | 'center' | 'right' */) {
  const g = grid(T, T);
  for (let x = 0; x < T; x++) {
    const joint = kind === 'center' ? x === 9 : kind === 'left' ? x === 12 : x === 4;
    for (let y = 0; y < 8; y++) {
      let s = y === 0 ? 6 : y === 1 ? 5 : y === 6 ? 2 : y === 7 ? 1 : 4;
      if (joint && y > 0 && y < 7) s = 1;
      if (!joint && y > 1 && y < 6 && (x * 5 + y * 3) % 11 === 0) s = 3;
      g.set(x, y, 'stone', s);
    }
  }
  // La panza: lomos de cascajo como la quilla de las islas (sin peine), afinados en las puntas.
  const lumps = { left: [-1, -1, 0, 1, 1, 2, 2, 1, 1, 2, 3, 2, 1, 1, 2, 2], center: [2, 2, 1, 1, 2, 3, 3, 2, 1, 1, 2, 2, 1, 2, 3, 2], right: [2, 1, 1, 2, 3, 2, 1, 1, 2, 2, 1, 1, 0, -1, -1, -1] }[kind];
  paintKeel(g, lumps, [], null, 8);
  // Musgo ralo en el filo.
  for (const [x, w] of kind === 'center' ? [[2, 4], [12, 2]] : kind === 'left' ? [[5, 5]] : [[3, 4]]) {
    for (let k = 0; k < w; k++) {
      g.set(x + k, 0, 'moss', k === 0 || k === w - 1 ? 4 : 5);
      if (k > 0 && k < w - 1) g.set(x + k, 1, 'moss', 3);
    }
  }
  // Los extremos, redondeados.
  const trim = (x, rows) => rows.forEach((y) => g.clear(x, y));
  if (kind === 'left') {
    trim(0, [0, 6, 7, 8, 9, 10, 11]);
    trim(1, [8, 9, 10, 11]);
    trim(2, [10, 11]);
    for (const y of [1, 2, 3, 4, 5]) g.set(0, y, 'stone', y === 1 ? 4 : 2);
    for (const y of [1, 2, 3, 4, 5, 6]) g.set(1, y, 'stone', y === 6 ? 1 : 5);
  }
  if (kind === 'right') {
    trim(15, [0, 6, 7, 8, 9, 10, 11]);
    trim(14, [8, 9, 10, 11]);
    trim(13, [10, 11]);
    for (const y of [1, 2, 3, 4, 5]) g.set(15, y, 'stone', 0);
    for (const y of [1, 2, 3, 4, 5, 6]) g.set(14, y, 'stone', y === 6 ? 0 : 2);
  }
  return g;
}

// ─── Las dos hojas ─────────────────────────────────────────────────────────────────────────────────────────────────
/** public/assets/tiles/cielo.png: las 28 casillas de siempre (ASSETS §6). */
export function buildCieloTileset() {
  const cells = [];
  for (let mask = 0; mask < 16; mask++) cells[mask] = mask === 15 ? baseStone() : autotileCell(mask);
  cells[16] = cloudCell('left');
  cells[17] = cloudCell('center');
  cells[18] = cloudCell('right');
  cells[19] = spikesCell();
  cells[20] = waterCell(true);
  cells[21] = waterCell(false);
  cells[22] = crackedCell();
  cells[23] = mossTuftCell();
  cells[24] = flowersCell();
  cells[25] = stonesCell();
  return buildTilesetImage(cells);
}

/**
 * public/assets/tiles/detalle/cielo.png y su .json (S118): variantes, la zona `terrace` (el piso de la arena), las
 * calcomanías (la quilla bajo las islas, runas, grietas, musgo, flores) y la losa móvil (`mover`: left, center, right).
 */
export function buildCieloDetail() {
  const sheet = buildDetailSheet({
    fill: fillVariants(),
    edges: edgeVariants(),
    decals: decals(),
    // La quilla y lo que se apoya arriba miran a un lado (la luz viene de la izquierda): no se espejan.
    fixed: ['keelMid', 'keelDeep', 'keelLeft', 'keelRight', 'keelSolo', 'keelShortMid', 'keelShortLeft', 'keelShortRight', 'keelShortSolo', 'rune', 'terraceMoss', 'terraceCrack'],
    extra: {
      'zone:terrace': terraceCells(),
      mover: { left: slabCell('left'), center: slabCell('center'), right: slabCell('right') },
    },
  });
  // Como en el pueblo (S112): zona → casilla del autotile → variantes.
  const { layout } = sheet;
  layout.zones = { terrace: layout['zone:terrace'] };
  delete layout['zone:terrace'];
  return sheet;
}

/** Lo que usa tools/make-terrain-tiles.mjs. */
export const buildTileset = buildCieloTileset;
export const buildDetail = buildCieloDetail;
