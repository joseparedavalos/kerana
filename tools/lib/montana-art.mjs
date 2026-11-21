// Detalle del terreno de la montaña (l6, Guairá, S116). El tileset de montana es arte real (5 de noviembre de 2026: los
// materiales de raw/tiles/cerro/ montados con las funciones de tools/lib/tileset-build.mjs y parámetros propios; ASSETS
// §6) y NO se toca: este archivo solo arma la hoja de detalle (public/assets/tiles/detalle/montana.png y .json)
// partiendo de los píxeles de public/assets/tiles/montana.png. No exporta `buildTileset`: así
// tools/make-terrain-tiles.mjs escribe solo la hoja. Todo sale de semillas fijas: siempre los mismos bytes.
//
// Por qué las variantes empalman: las 16 casillas del autotile de montana.png son la tierra de la 15 con dos cosas
// encima, el borde de pasto seco de arriba (filas 0 a 2 de la 14, iguales en todas) donde no hay suelo arriba, y el
// borde oscuro donde no hay suelo al costado o abajo (la columna o fila de afuera × 0,5, la siguiente × 0,75, el menor
// en las esquinas, con `Math.round`): la regla de campo (S111) con 3 filas de borde. `montanaCell` la repite y da
// montana.png byte a byte (lo comprueba tests/montanaTiles.test.ts). Una variante es la misma regla con otra tierra
// cuyo anillo de 2 px es el de la 15: los lados quedan idénticos a los de la casilla que reemplaza.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { buildDetailSheet, DOWN, irange, LEFT, mod, mulberry32, RgbaGrid, RIGHT, RING, T, UP } from './tile-art.mjs';

export const TILESET_URL = new URL('../../public/assets/tiles/montana.png', import.meta.url);
/** El borde oscuro (el mismo de campo: `edge.outer` 0,5 e `inner` 0,75) y el alto del borde de pasto de arriba. */
export const EDGE = { outer: 0.5, inner: 0.75 };
/** Filas del borde de pasto: la 0 y la 1 ralas (2 y 8 de 16 px), la 2 llena. Desde la 3, tierra. */
export const GRASS_ROWS = 3;

/** El md5 de montana.png (el script lo dice al terminar; tests/montanaTiles.test.ts lo compara con el de main). */
export const montanaTilesetMd5 = () => createHash('md5').update(readFileSync(TILESET_URL)).digest('hex');

/** montana.png como { width, height, data } (RGBA). */
export function readMontanaTileset() {
  const png = PNG.sync.read(readFileSync(TILESET_URL));
  return { width: png.width, height: png.height, data: new Uint8Array(png.data) };
}

// ─── Paleta (medida con PIL; ver las notas de S116 en docs/PLAN.md) ────────────────────────────────────────────────
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const ramp = (...list) => list.map(hex);
/** La tierra de montana.png (la 15, cuantiles de luminancia 0 a 1). */
export const DIRT = ramp('#6e391d', '#763e21', '#7a4122', '#804323', '#864a26', '#955430');
/** El borde de pasto seco de montana.png (filas 1 y 2 de la 14). */
export const STRAW = ramp('#af8233', '#b48534', '#ba8646', '#c09342', '#c6964a', '#d1a85a');
/**
 * Arenisca del Ybytyruzú: la tierra lavada hacia los rosados del atardecer de l6_far.jpg (`#966a69`, `#ba8173`,
 * `#cd8f78`): más clara y más rosada que la tierra, nunca blanca (va adelante, bajo la tormenta).
 */
export const SAND = ramp('#5b2d1c', '#764227', '#874f31', '#975c3b', '#a76b47', '#b67b55', '#c48c66');
/** Vetas de hierro (hematita): de casi negro rojizo al óxido claro de las piedras de la tierra. */
export const IRON = ramp('#2c110b', '#43180f', '#5c2215', '#78301c', '#923f23', '#ad5a33');
/** Cuarzo lechoso, apenas frío (la luz más alta del frente de l6_far, `#b9c0ca`, entibiada por la tierra). */
export const QUARTZ = ramp('#5a3a2a', '#7f6656', '#9d8878', '#b8a796', '#cfc2b2', '#e2d9cc');
/**
 * Liquen de la roca: el verde gris del monte de l6_far (`#2b302a`, `#43493b`) levantado para que se lea sobre la tierra
 * colorada, con la costra pálida arriba y puntos ocres (el liquen amarillo de las piedras).
 */
export const LICHEN = ramp('#4a4c36', '#666c50', '#838a6a', '#9ea584', '#b7bc9c', '#cfd2b4');
export const LICHEN_DOT = ramp('#a8742a', '#c8952f');
/** Raíces del pasto seco bajo el borde: el borde de arriba, apagado. */
export const ROOT = ramp('#3a1d10', '#5e3f20', '#83602f', '#a67d40', '#c39a55');

// ─── Colores ───────────────────────────────────────────────────────────────────────────────────────────────────────
const clamp = (v) => Math.max(0, Math.min(255, v));
const mix = (a, b, t) => [0, 1, 2].map((i) => a[i] + (b[i] - a[i]) * t);
const scale = (p, f) => [clamp(p[0] * f[0]), clamp(p[1] * f[1]), clamp(p[2] * f[2])];
const opaque = (c, a = 255) => [c[0], c[1], c[2], a];

// ─── La regla del autotile (la de campo, con 3 filas de borde) ─────────────────────────────────────────────────────
/** Factor del borde oscuro en (x, y) para la máscara (1 lejos del aire). */
function edgeFactor(mask, x, y) {
  let f = 1;
  if (!(mask & LEFT) && x < 2) f = Math.min(f, x === 0 ? EDGE.outer : EDGE.inner);
  if (!(mask & RIGHT) && x >= T - 2) f = Math.min(f, x === T - 1 ? EDGE.outer : EDGE.inner);
  if (!(mask & DOWN) && y >= T - 2) f = Math.min(f, y === T - 1 ? EDGE.outer : EDGE.inner);
  return f;
}

/** La casilla `mask` del autotile con la tierra `dirt` y el borde de pasto `grass` (filas 0 a 2), como montana.png. */
export function montanaCell(mask, dirt, grass) {
  const g = new RgbaGrid(T, T);
  for (let y = 0; y < T; y++) {
    for (let x = 0; x < T; x++) {
      if (!(mask & UP) && y < GRASS_ROWS) {
        g.set(x, y, grass.get(x, y));
        continue;
      }
      const f = edgeFactor(mask, x, y);
      const p = dirt.get(x, y);
      g.set(x, y, [Math.round(p[0] * f), Math.round(p[1] * f), Math.round(p[2] * f), p[3]]);
    }
  }
  return g;
}

/** La tierra (la 15) y el borde de pasto (las filas de arriba de la 14) de montana.png. */
export function montanaSource(img = readMontanaTileset()) {
  return { img, dirt: RgbaGrid.fromImage(img, 15, 4), grass: RgbaGrid.fromImage(img, 14, 4) };
}

// ─── Otra tierra con el mismo anillo ───────────────────────────────────────────────────────────────────────────────
/**
 * La tierra de la 15 corrida (dx, dy), espejada o traspuesta, solo en el centro (2 a 13): el grano es el de montana.png
 * y el anillo de 2 px queda el de la 15. En la primera y la última fila y columna del centro se mezclan las dos al
 * azar, para que no se lea un cuadro.
 */
function shiftedDirt(base, rng) {
  const dx = irange(rng, 3, 13);
  const dy = irange(rng, 3, 13);
  const fx = rng() < 0.5;
  const fy = rng() < 0.5;
  const swap = rng() < 0.5;
  const g = base.clone();
  for (let y = RING; y < T - RING; y++) {
    for (let x = RING; x < T - RING; x++) {
      const edge = x === RING || y === RING || x === T - RING - 1 || y === T - RING - 1;
      if (edge && rng() < 0.5) continue;
      let sx = fx ? T - 1 - x : x;
      let sy = fy ? T - 1 - y : y;
      if (swap) [sx, sy] = [sy, sx];
      g.set(x, y, base.get(mod(sx + dx, T), mod(sy + dy, T)));
    }
  }
  return g;
}

/** Una mancha en forma de nube (centro, radios, lóbulos): `fn(x, y, d)` en cada píxel, con `d` de 0 (centro) a 1 (borde). */
function cloud(rng, lo, hi, fn, wide = 1) {
  const x0 = irange(rng, lo + 2, hi - 2);
  const y0 = irange(rng, lo + 2, hi - 2);
  const rx = (2.4 + rng() * 2.2) * wide;
  const ry = 1.6 + rng() * 1.2;
  const lobes = Array.from({ length: 5 }, () => 0.7 + rng() * 0.5);
  for (let y = Math.floor(y0 - ry - 1); y <= Math.ceil(y0 + ry + 1); y++) {
    for (let x = Math.floor(x0 - rx - 1); x <= Math.ceil(x0 + rx + 1); x++) {
      if (x < lo || y < lo || x > hi || y > hi) continue;
      const a = Math.atan2((y - y0) / ry, (x - x0) / rx);
      const r = lobes[mod(Math.round((a / (Math.PI * 2)) * 5), 5)];
      const d = Math.hypot((x - x0) / rx, (y - y0) / ry) / r;
      if (d <= 1 && (d < 0.6 || rng() < 0.45)) fn(x, y, d);
    }
  }
}

/** Rasgos de bajo contraste de la tierra (van en ≈ 7 % de las celdas cada uno: nada que se reconozca al repetirse). */
function paintDirtFeature(g, kind, rng, lo = 3, hi = 12) {
  const c = () => irange(rng, lo + 1, hi - 1);
  const tone = (f) => (x, y) => g.set(x, y, opaque(scale(g.get(x, y), f)));
  switch (kind) {
    case 'damp':
      cloud(rng, lo, hi, tone([0.88, 0.87, 0.88]));
      break;
    case 'dry':
      cloud(rng, lo, hi, tone([1.09, 1.08, 1.06]));
      break;
    case 'red':
      // El moteado del hierro: la tierra más roja …
      cloud(rng, lo, hi, tone([1.03, 0.93, 0.9]));
      break;
    case 'pale':
      // … y la arenisca lavada, más rosada y clara.
      cloud(rng, lo, hi, tone([1.08, 1.07, 1.12]), 1.4);
      break;
    case 'bed': {
      // Una capa de la arenisca apenas marcada: una franja chata y despareja, un tono más clara, con su sombra abajo.
      const y0 = c();
      const x0 = irange(rng, lo, lo + 2);
      const x1 = irange(rng, hi - 2, hi);
      for (let x = x0; x <= x1; x++) {
        if (rng() < 0.2) continue;
        const y = y0 + (x % 5 === 0 && rng() < 0.5 ? 1 : 0);
        g.set(x, y, opaque(scale(g.get(x, y), [1.07, 1.06, 1.06])));
        if (rng() < 0.6) g.set(x, y + 1, opaque(scale(g.get(x, y + 1), [0.92, 0.91, 0.92])));
      }
      break;
    }
    case 'pores':
      // Poros: el hueco oscuro y su labio de abajo, con luz.
      for (let k = 0; k < 3; k++) {
        const x = c();
        const y = c();
        g.set(x, y, opaque(scale(g.get(x, y), [0.8, 0.78, 0.8])));
        g.set(x, y + 1, opaque(scale(g.get(x, y + 1), [1.05, 1.05, 1.04])));
      }
      break;
    case 'grit':
      // Granos de cuarzo de la arenisca, apenas más claros que la tierra.
      for (let k = 0; k < 3; k++) {
        const x = c();
        const y = c();
        g.set(x, y, opaque(mix(g.get(x, y), QUARTZ[3], 0.22)));
      }
      break;
    case 'iron':
      // Motas de hierro: un punto oscuro y rojizo con su brillo.
      for (let k = 0; k < 3; k++) {
        const x = c();
        const y = c();
        g.set(x, y, opaque(mix(g.get(x, y), IRON[2], 0.38)));
        if (rng() < 0.6) g.set(x - 1, y - 1, opaque(mix(g.get(x - 1, y - 1), IRON[5], 0.22)));
      }
      break;
    case 'trace': {
      // La huella de una raicilla vieja: una línea fina y tenue que serpentea.
      let x = irange(rng, lo, hi - 5);
      let y = c();
      const n = irange(rng, 4, 7);
      for (let k = 0; k < n; k++) {
        g.set(x, y, opaque(scale(g.get(x, y), [0.9, 0.89, 0.9])));
        x += 1;
        if (rng() < 0.4) y = Math.max(lo, Math.min(hi, y + (rng() < 0.5 ? -1 : 1)));
      }
      break;
    }
  }
}

const FILL_FEATURES = [
  [],
  ['damp'],
  ['dry'],
  ['red'],
  ['pale'],
  ['pores'],
  ['grit', 'dry'],
  ['iron'],
  ['bed'],
  ['red', 'pores'],
  ['trace'],
  ['damp', 'grit'],
  ['pale', 'iron'],
  ['bed', 'grit'],
  ['dry', 'iron'],
  ['damp', 'trace'],
];

/** Otra tierra para una variante: el grano corrido y sus rasgos, con el anillo de la 15. */
function variantDirt(base, rng, features) {
  const g = shiftedDirt(base, rng);
  for (const f of features) paintDirtFeature(g, f, rng);
  return g;
}

/** Otro borde de pasto para una variante del piso: el centro (columnas 2 a 13) corrido a lo ancho; los costados, los de la 14. */
function variantGrass(grass, shift, flip) {
  const g = grass.clone();
  for (let y = 0; y < GRASS_ROWS; y++) {
    for (let x = RING; x < T - RING; x++) {
      const sx = mod((flip ? T - 1 - x : x) + shift, T);
      g.set(x, y, grass.get(sx, y));
    }
  }
  return g;
}

/** Las 16 variantes del relleno (casilla 15). */
export function fillVariants(src = montanaSource(), seed = 1161) {
  const rng = mulberry32(seed);
  return FILL_FEATURES.map((features) => variantDirt(src.dirt, rng, features));
}

/** Variantes del piso (14), del techo (11) y de las paredes (7 y 13): la misma regla con otra tierra. */
export function edgeVariants(src = montanaSource(), seed = 1162) {
  const rng = mulberry32(seed);
  const out = {};
  out[14] = [
    { features: ['dry'], shift: 5, flip: false },
    { features: ['pores'], shift: 9, flip: true },
    { features: ['red'], shift: 12, flip: false },
    { features: ['pale'], shift: 3, flip: true },
    { features: ['grit'], shift: 7, flip: false },
  ].map((v) => montanaCell(14, variantDirt(src.dirt, rng, v.features), variantGrass(src.grass, v.shift, v.flip)));
  const features = { 11: [['damp'], ['iron']], 7: [['grit'], ['bed']], 13: [['trace'], ['damp']] };
  for (const mask of [11, 7, 13]) out[mask] = features[mask].map((f) => montanaCell(mask, variantDirt(src.dirt, rng, f), src.grass));
  return out;
}

// ─── Pinceles de las calcomanías ───────────────────────────────────────────────────────────────────────────────────
const blank = (w = T, h = T) => new RgbaGrid(w, h);
/** Pone un color con alfa encima de lo que haya en la calcomanía (mezcla "sobre"). */
function over(g, x, y, c, a) {
  if (!g.in(x, y) || a <= 0) return;
  const p = g.get(x, y);
  const pa = p[3] / 255;
  const na = Math.min(255, a) / 255;
  const oa = na + pa * (1 - na);
  if (oa <= 0) return;
  const rgb = [0, 1, 2].map((i) => (c[i] * na + p[i] * pa * (1 - na)) / oa);
  g.set(x, y, [...rgb, oa * 255]);
}

/** Píxeles de un polígono convexo (vértices en orden, en px). */
function polygonPixels(poly) {
  const xs = poly.map((p) => p[0]);
  const ys = poly.map((p) => p[1]);
  const out = [];
  for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y++) {
    for (let x = Math.floor(Math.min(...xs)); x <= Math.ceil(Math.max(...xs)); x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      let sign = 0;
      let inside = true;
      for (let i = 0; i < poly.length && inside; i++) {
        const [ax, ay] = poly[i];
        const [bx, by] = poly[(i + 1) % poly.length];
        const s = Math.sign((bx - ax) * (py - ay) - (by - ay) * (px - ax));
        if (s === 0) continue;
        if (sign === 0) sign = s;
        else if (s !== sign) inside = false;
      }
      if (inside) out.push([x, y]);
    }
  }
  return out;
}

/**
 * Una piedra: polígono convexo con contorno y la luz de arriba (S109, S111). `tones` de lo oscuro a lo claro: 0 el
 * contorno, 1 a 5 el cuerpo (la cara de arriba en 5 y 4, el medio en 3, abajo 2), 6 el brillo. El costado de la
 * derecha va un tono más oscuro. `beds`: las capas de la arenisca, líneas horizontales un tono más oscuras a esas
 * alturas (0 a 1) del cuerpo. Abajo, la tierra la tapa un poco (`buried`) y le hace sombra: se lee enterrada.
 */
function paintStone(g, poly, tones, rng, { pits = 0, glints = 1, buried = 0.4, beds = [] } = {}) {
  const px = polygonPixels(poly);
  const key = (x, y) => `${x},${y}`;
  const inside = new Set(px.map(([x, y]) => key(x, y)));
  const has = (x, y) => inside.has(key(x, y));
  const col = new Map();
  const row = new Map();
  for (const [x, y] of px) {
    const c = col.get(x) ?? [99, -99];
    col.set(x, [Math.min(c[0], y), Math.max(c[1], y)]);
    const r = row.get(y) ?? [99, -99];
    row.set(y, [Math.min(r[0], x), Math.max(r[1], x)]);
  }
  const yTop = Math.min(...row.keys());
  const yBot = Math.max(...row.keys());
  const bedRows = new Set(beds.map((b) => Math.round(yTop + (yBot - yTop) * b)));
  const body = [];
  for (const [x, y] of px) {
    const [top, bottom] = col.get(x);
    const [left, right] = row.get(y);
    const edgeBelow = !has(x, y + 1);
    if (!has(x, y - 1) || edgeBelow || !has(x - 1, y) || !has(x + 1, y)) {
      if (edgeBelow && rng() < buried) over(g, x, y, DIRT[rng() < 0.5 ? 2 : 3], 215);
      else g.set(x, y, opaque(tones[!has(x, y - 1) && has(x, y + 1) ? 1 : 0]));
      continue;
    }
    const v = (y - top) / Math.max(1, bottom - top);
    const u = (x - left) / Math.max(1, right - left);
    let s = v < 0.3 ? 5 : v < 0.52 ? 4 : v < 0.78 ? 3 : 2;
    if (u > 0.8) s -= 1;
    if (rng() < 0.16) s += rng() < 0.5 ? -1 : 1;
    if (bedRows.has(y) && rng() < 0.8) s -= 1;
    s = Math.max(1, Math.min(5, s));
    g.set(x, y, opaque(tones[s]));
    body.push([x, y, v, u]);
  }
  const lit = body.filter(([, , v, u]) => v < 0.3 && u < 0.5);
  for (let k = 0; k < glints && lit.length; k++) {
    const [x, y] = lit[Math.floor(rng() * lit.length)];
    g.set(x, y, opaque(tones[6] ?? tones[5]));
  }
  const porous = body.filter(([x, y, v]) => v > 0.25 && has(x, y + 1) && has(x, y + 2));
  for (let k = 0; k < pits && porous.length; k++) {
    const [x, y] = porous.splice(Math.floor(rng() * porous.length), 1)[0];
    g.set(x, y, opaque(tones[1]));
    g.set(x, y + 1, opaque(tones[4]));
  }
  for (const [x, [, bottom]] of col) {
    over(g, x, bottom + 1, DIRT[0], 150);
    if (rng() < 0.5) over(g, x, bottom + 2, DIRT[0], 70);
  }
  for (const [y, [, right]] of row) if (y > yBot - 3) over(g, right + 1, y, DIRT[0], 110);
}

/** Los tonos de un bloque de arenisca para `paintStone`: el contorno en la sombra honda, la cara de arriba rosada. */
const SAND_STONE = [SAND[0], SAND[1], SAND[1], SAND[2], SAND[2], SAND[3], SAND[4]];

/** Bloques de arenisca sueltos (1 × 1), de 9 a 12 px: la arenisca se parte en bloques, casi rectos, con sus capas. */
function sandstoneBlocks(rng) {
  const shapes = [
    [[3, 9], [5, 7], [12, 7], [13, 9], [13, 12], [12, 13], [3, 13], [2, 12]],
    [[4, 10], [5, 8], [11, 7], [12, 9], [12, 12], [10, 13], [5, 13], [4, 12]],
    [[2, 10], [3, 9], [9, 8], [14, 9], [14, 12], [13, 13], [3, 13], [2, 12]],
  ];
  return shapes.map((poly) => {
    const g = blank();
    paintStone(g, poly, SAND_STONE, rng, { pits: 0, glints: 1, beds: [0.55] });
    return g;
  });
}

/** Bloques grandes de arenisca (2 × 2): uno ancho con otro chico recostado, con dos capas cada uno. */
function sandstoneBoulders(rng) {
  const groups = [
    [
      [[4, 17], [8, 13], [21, 12], [26, 15], [26, 24], [23, 27], [6, 27], [3, 24]],
      [[23, 23], [25, 21], [29, 21], [30, 25], [29, 28], [23, 28]],
    ],
    [
      [[7, 16], [11, 13], [23, 13], [27, 16], [27, 25], [24, 28], [9, 28], [6, 25]],
      [[2, 23], [4, 21], [8, 21], [9, 24], [8, 28], [3, 28]],
    ],
    [
      [[3, 20], [6, 16], [14, 14], [20, 15], [24, 19], [24, 26], [21, 28], [5, 28], [2, 25]],
      [[20, 25], [23, 22], [27, 22], [29, 24], [29, 28], [21, 28]],
    ],
  ];
  return groups.map((polys) => {
    const g = blank(2 * T, 2 * T);
    paintStone(g, polys[0], SAND_STONE, rng, { glints: 2, buried: 0.5, beds: [0.38, 0.7] });
    paintStone(g, polys[1], SAND_STONE, rng, { glints: 1, buried: 0.5, beds: [0.5] });
    return g;
  });
}

/**
 * Capas de arenisca (2 × 1 y 3 × 1): una franja de 4 a 6 px, más clara y rosada que la tierra, que ondula con los bordes
 * tramados, con la estratificación cruzada adentro (laminillas en diagonal un tono más oscuras, todas con la misma
 * inclinación en cada capa). Las «que sobresalen» llevan un labio claro arriba y la sombra que hacen debajo: dan el
 * volumen del cerro escalonado. Va con alfa: es la tierra teñida, se ve el grano debajo. Las puntas se desvanecen.
 */
function sandstoneLayers(rng) {
  const out = [];
  for (const [cols, thick, ledge] of [[3, 5, true], [2, 4, true], [4, 6, true], [3, 4, false], [4, 5, true]]) {
    const w = cols * T;
    const g = blank(w, T);
    const y0 = irange(rng, 4, 6);
    const phase = rng() * Math.PI * 2;
    const freq = 1 + rng() * 0.8;
    const slope = rng() < 0.5 ? 1 : -1;
    const period = irange(rng, 5, 7);
    const top = Array.from({ length: w }, (_, x) => y0 + Math.round(Math.sin(phase + (x / w) * Math.PI * freq) * 1.2));
    for (let x = 1; x < w - 1; x++) {
      const end = Math.min(x - 1, w - 2 - x);
      const fade = end < 9 ? end / 9 : 1;
      const t = Math.max(2, Math.round(thick * (0.55 + 0.45 * fade)));
      for (let k = 0; k < t; k++) {
        const y = top[x] + k;
        const rim = k === 0 || k === t - 1;
        if (rim && rng() < 0.45) continue;
        if (rng() > 0.25 + 0.75 * fade) continue;
        // Estratificación cruzada: laminillas en diagonal (3 px a lo ancho por cada fila).
        const lamina = mod(x * 1 + slope * k * 3, period * 3) < 2;
        const c = lamina ? SAND[2] : SAND[k < t / 2 ? 4 : 3];
        over(g, x, y, c, Math.round((rim ? 110 : lamina ? 185 : 170) * fade));
      }
      if (ledge && fade > 0.4) {
        // El labio de arriba con luz y la sombra que hace la capa sobre la tierra de abajo.
        if (rng() < 0.6) over(g, x, top[x] - 1, SAND[5], Math.round(85 * fade));
        over(g, x, top[x] + t, DIRT[0], Math.round(150 * fade));
        if (rng() < 0.55) over(g, x, top[x] + t + 1, DIRT[0], Math.round(70 * fade));
      } else if (rng() < 0.35 * fade) {
        over(g, x, top[x] + t, DIRT[0], 60);
      }
    }
    out.push(g);
  }
  return out;
}

/**
 * Vetas de hierro (1 × 1 y 2 × 1): una línea de 1 px de hematita que cruza la tierra en diagonal y se quiebra, con el
 * halo rojizo de un lado y el óxido claro del otro, alguna rama y uno o dos nudos (concreciones) en el camino.
 */
function ironVeins(rng) {
  const out = [];
  for (const cols of [1, 1, 1, 2, 2]) {
    const w = cols * T;
    const g = blank(w, T);
    let x = irange(rng, 1, 3);
    let y = irange(rng, 3, 11);
    const len = w - irange(rng, 3, 5) - x;
    let dir = rng() < 0.5 ? 1 : -1;
    const pts = [];
    for (let k = 0; k < len; k++) {
      pts.push([x, y]);
      x += 1;
      if (rng() < 0.3) y += dir;
      if (y < 2 || y > 13 || rng() < 0.06) dir = -dir;
      y = Math.max(2, Math.min(13, y));
    }
    const knots = new Set([irange(rng, 3, len - 4), ...(cols > 1 ? [irange(rng, len / 2, len - 3)] : [])].map(Math.round));
    pts.forEach(([px, py], k) => {
      const a = Math.min(1, 0.35 + Math.min(k, pts.length - 1 - k) / 4);
      over(g, px, py, IRON[k % 4 === 1 ? 1 : 2], Math.round(235 * a));
      over(g, px, py + 1, IRON[3], Math.round(120 * a));
      if (rng() < 0.4) over(g, px, py - 1, IRON[5], Math.round(80 * a));
      if (knots.has(k)) {
        // Un nudo: 3 × 2 de hierro con el brillo arriba a la izquierda.
        for (const [dx, dy, tone] of [[0, 0, 1], [1, 0, 2], [0, 1, 3], [1, 1, 3], [0, -1, 5]]) {
          over(g, px + dx, py + dy, IRON[tone], 235 * a);
        }
      }
      if (k > 3 && k < pts.length - 3 && rng() < 0.1) {
        const bd = rng() < 0.5 ? -1 : 1;
        for (let j = 1; j <= irange(rng, 2, 3); j++) over(g, px + j, py + bd * j, IRON[2], Math.round(150 * a * (1 - j / 4)));
      }
    });
    out.push(g);
  }
  return out;
}

/**
 * Juntas de estratificación (3 × 1 y 4 × 1): la línea fina entre dos capas de arenisca, que cruza varias celdas con
 * una pendiente muy suave: 1 px de sombra (la junta) con la arenisca más clara justo debajo (el canto de la capa de
 * abajo), cortada en tramos. Sin grosor: es lo que da el «cerro en capas» a las masas hondas sin tapar la tierra.
 */
function beddingSeams(rng) {
  const out = [];
  for (const cols of [3, 4, 4]) {
    const w = cols * T;
    const g = blank(w, T);
    let y = irange(rng, 6, 9);
    const rise = rng() < 0.5 ? 1 : -1;
    const every = irange(rng, 18, 26);
    let gap = 0;
    for (let x = 1; x < w - 1; x++) {
      const end = Math.min(x - 1, w - 2 - x);
      const fade = end < 10 ? end / 10 : 1;
      if (x % every === 0) y = Math.max(3, Math.min(12, y + rise));
      if (gap > 0) {
        gap--;
        continue;
      }
      if (rng() < 0.05) gap = irange(rng, 2, 4);
      over(g, x, y, DIRT[0], Math.round(150 * fade));
      if (rng() < 0.75) over(g, x, y + 1, SAND[4], Math.round(95 * fade));
      if (rng() < 0.2) over(g, x, y - 1, DIRT[1], Math.round(70 * fade));
    }
    out.push(g);
  }
  return out;
}

/** Cantitos de cuarzo claro: astillas angulosas de 5 a 7 px (nunca un punto suelto: se lee como un destello). */
function quartzChips(rng) {
  const sets = [
    [[[4, 9], [7, 7], [11, 8], [12, 11], [9, 13], [5, 12]]],
    [[[3, 10], [5, 8], [8, 9], [8, 12], [4, 13]], [[10, 6], [13, 6], [14, 9], [11, 10]]],
    [[[5, 8], [10, 7], [13, 9], [11, 12], [6, 12]]],
  ];
  return sets.map((polys) => {
    const g = blank();
    for (const poly of polys) paintStone(g, poly, QUARTZ, rng, { pits: 0, glints: 0, buried: 0.35 });
    return g;
  });
}

/**
 * Grava: nódulos de 3 a 5 px dibujados a mano (con contorno, uno tan chico se lee como un anillo): hierro (0 a 5) y
 * arenisca (a a e) mezclados, la sombra en la tierra (s) y la tierra que los tapa (x).
 */
const PEBBLES = [
  [[4, 6, ['.54.', '5432', '2210', 'xss.']], [10, 9, ['edc', 'cba', 'ss.']], [6, 12, ['45', '10', 'ss']]],
  [[3, 9, ['dc.', 'cba', 'xss']], [8, 6, ['.554.', '54332', '32211', 'x000x', '.sss.']], [12, 11, ['ed', 'ba', 'ss']]],
  [[5, 5, ['54.', '432', '1x0', '.s.']], [9, 9, ['.ed.', 'edcb', 'bbaa', '.ss.']], [4, 11, ['45', '21', 'ss']]],
];
const PEBBLE_LEGEND = {
  0: [IRON[0], 255],
  1: [IRON[1], 255],
  2: [IRON[2], 255],
  3: [IRON[3], 255],
  4: [IRON[4], 255],
  5: [IRON[5], 255],
  a: [SAND[1], 255],
  b: [SAND[2], 255],
  c: [SAND[3], 255],
  d: [SAND[5], 255],
  e: [SAND[6], 255],
  s: [DIRT[0], 140],
  x: [DIRT[2], 215],
};

function pebbles() {
  return PEBBLES.map((set) => {
    const g = blank();
    for (const [ox, oy, rows] of set) {
      rows.forEach((row, y) => [...row].forEach((ch, x) => {
        const entry = PEBBLE_LEGEND[ch];
        if (!entry) return;
        if (entry[1] >= 255) g.set(ox + x, oy + y, opaque(entry[0]));
        else over(g, ox + x, oy + y, entry[0], entry[1]);
      }));
    }
    return g;
  });
}

/**
 * Liquen de la roca: una costra chata y despareja (más ancha que alta), hecha de dos o tres manchas que se tocan, casi
 * toda en los tonos medios, con el borde un tono más oscuro y tramado, motas pálidas adentro y uno o dos puntos ocres
 * (el liquen amarillo). Sin brillo en el centro: con un punto claro se leía como un destello (S109).
 */
function lichens(rng) {
  const out = [];
  for (let k = 0; k < 4; k++) {
    const g = blank();
    const cx = irange(rng, 6, 9) + 0.5;
    const cy = irange(rng, 6, 9) + 0.5;
    const rx = 4.2 + rng() * 1.8;
    const ry = 2.6 + rng() * 1.2;
    // Dos o tres lóbulos: la costra crece en manchas que se juntan.
    const lobes = Array.from({ length: 2 + (k % 2) }, () => [cx + (rng() - 0.5) * rx, cy + (rng() - 0.5) * ry, 0.6 + rng() * 0.4]);
    for (let y = 1; y < T - 1; y++) {
      for (let x = 1; x < T - 1; x++) {
        let d = Math.hypot((x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry);
        for (const [lx, ly, lr] of lobes) d = Math.min(d, Math.hypot((x + 0.5 - lx) / (rx * lr), (y + 0.5 - ly) / (ry * lr)));
        if (d > 1) continue;
        // Moteada: tupida al centro, rala hacia el borde.
        if (rng() > 0.92 - d * 0.55) continue;
        const s = d < 0.4 ? (rng() < 0.5 ? 4 : 3) : d < 0.75 ? (rng() < 0.6 ? 3 : 2) : rng() < 0.5 ? 2 : 1;
        over(g, x, y, LICHEN[s], d < 0.75 ? 225 : 180);
      }
    }
    // El borde oscuro de algunas rosetas y los puntos ocres del liquen amarillo.
    for (let j = 0; j < 4; j++) {
      const a = rng() * Math.PI * 2;
      over(g, Math.round(cx + Math.cos(a) * rx * 0.95), Math.round(cy + Math.sin(a) * ry * 0.95), LICHEN[0], 170);
    }
    for (let j = 0; j < 2 + (k % 2); j++) {
      over(g, Math.round(cx + (rng() - 0.5) * rx), Math.round(cy + (rng() - 0.5) * ry), LICHEN_DOT[j % 2], 235);
    }
    out.push(g);
  }
  return out;
}

/** Una raíz de pasto seco: baja serpenteando desde (x, y), con su sombra a la derecha, cada vez más fina y tenue. */
function paintRoot(g, x, y, len, rng, branches = 1) {
  let cx = x;
  for (let k = 0; k < len; k++) {
    const fade = 1 - k / (len + 2);
    over(g, cx, y + k, ROOT[k < 4 ? 3 : 2], Math.round(255 * fade));
    over(g, cx + 1, y + k, ROOT[0], Math.round(130 * fade));
    if (rng() < 0.3) cx += rng() < 0.5 ? -1 : 1;
    if (branches > 0 && k > 2 && rng() < 0.18) {
      branches--;
      const dir = rng() < 0.5 ? -1 : 1;
      for (let j = 1; j <= irange(rng, 2, 4); j++) over(g, cx + dir * j, y + k + j, ROOT[1], Math.round(170 * fade));
    }
  }
}

function grassRoots(rng) {
  const roots = [0, 1].map((k) => {
    const g = blank(T, 2 * T);
    paintRoot(g, k ? 10 : 5, GRASS_ROWS, k ? 15 : 19, rng, 2);
    paintRoot(g, k ? 4 : 12, GRASS_ROWS, k ? 7 : 9, rng, 1);
    if (k) paintRoot(g, 13, GRASS_ROWS, 4, rng, 0);
    return g;
  });
  const rootlets = [0, 1].map((k) => {
    const g = blank();
    paintRoot(g, k ? 11 : 4, GRASS_ROWS, 6, rng, 1);
    paintRoot(g, k ? 6 : 9, GRASS_ROWS, 4, rng, 0);
    return g;
  });
  return { roots, rootlets };
}

/** Las calcomanías del cerro guaireño. */
export function decals(seed = 1163) {
  const rng = mulberry32(seed);
  const { roots, rootlets } = grassRoots(rng);
  return {
    sandstone: sandstoneLayers(rng),
    seam: beddingSeams(rng),
    block: sandstoneBlocks(rng),
    boulder: sandstoneBoulders(rng),
    iron: ironVeins(rng),
    quartz: quartzChips(rng),
    pebble: pebbles(),
    lichen: lichens(rng),
    roots,
    rootlet: rootlets,
  };
}

// ─── La hoja ───────────────────────────────────────────────────────────────────────────────────────────────────────
/**
 * public/assets/tiles/detalle/montana.png y su .json (S116): variantes del relleno, del piso, del techo y de las
 * paredes, y calcomanías. El tileset (montana.png) no se escribe.
 */
export function buildMontanaDetail(src = montanaSource()) {
  return buildDetailSheet({ fill: fillVariants(src), edges: edgeVariants(src), decals: decals() });
}

export const buildDetail = buildMontanaDetail;
export const tilesetMd5 = montanaTilesetMd5;
