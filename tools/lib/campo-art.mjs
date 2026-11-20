// Detalle del terreno del campo (l3, S111). El tileset de campo es arte real (S56: los materiales del generador montados
// con `npm run tileset -- campo`) y NO se toca: este archivo solo arma la hoja de detalle (public/assets/tiles/detalle/
// campo.png y .json) partiendo de los píxeles de public/assets/tiles/campo.png. No exporta `buildTileset`: así
// tools/make-terrain-tiles.mjs escribe solo la hoja. Todo sale de semillas fijas: siempre los mismos bytes.
//
// Cómo se armó el tileset en S56 (tools/lib/tileset-build.mjs) y por qué las variantes empalman: las 16 casillas del
// autotile son la tierra de la 15 con dos cosas encima, el pasto de arriba (filas 0 a 6, igual en todas) donde no hay
// suelo arriba, y el borde oscuro donde no hay suelo al costado o abajo (la columna o fila de afuera × 0,5, la siguiente
// × 0,75, el menor de los dos en las esquinas). `campoCell` hace lo mismo y da campo.png byte a byte (lo comprueba
// tests/campoTiles.test.ts). Una variante es esa misma regla con otra tierra cuyo anillo de 2 px es el de la 15: los
// lados quedan idénticos a los de la casilla original y empalman igual.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { buildDetailSheet, DOWN, irange, LEFT, mod, mulberry32, RgbaGrid, RIGHT, RING, T, UP } from './tile-art.mjs';

export const TILESET_URL = new URL('../../public/assets/tiles/campo.png', import.meta.url);
/** El borde oscuro de S56 (raw/tiles/campo/tileset.json, `edge`) y el alto del pasto de arriba (`grass.rows`). */
export const EDGE = { outer: 0.5, inner: 0.75 };
export const GRASS_ROWS = 7;

/** El md5 de campo.png (el script lo dice al terminar; tests/campoTiles.test.ts lo compara con el de main). */
export const campoTilesetMd5 = () => createHash('md5').update(readFileSync(TILESET_URL)).digest('hex');

/** campo.png como { width, height, data } (RGBA). */
export function readCampoTileset() {
  const png = PNG.sync.read(readFileSync(TILESET_URL));
  return { width: png.width, height: png.height, data: new Uint8Array(png.data) };
}

// ─── Paleta (medida con PIL; ver las notas de S111 en docs/PLAN.md) ────────────────────────────────────────────────
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const ramp = (...list) => list.map(hex);
/** La tierra de campo.png (la 15, cuantiles de luminancia 0 a 1). */
export const DIRT = ramp('#68391d', '#7b4221', '#854722', '#935228', '#9e592e', '#ac6636');
/** El pasto seco de campo.png (la 14, filas 0 a 6). */
export const STRAW = ramp('#595114', '#726620', '#897827', '#9c8531', '#ac9836', '#b9a042', '#c2ae4c', '#d0ba58');
/** La tierra colorada del frente de l3_far.jpg (la franja de abajo) y su horizonte ocre (el tacurú, las piedras). */
export const LATERITE = ramp('#572517', '#643120', '#74341f', '#843820', '#9a4b2c', '#a9502d');
export const OCHRE = ramp('#a25431', '#b26c3e', '#bf7447', '#c88a4e');
/**
 * Itakurú, la piedra de hierro de Misiones: del tacurú grande de l3_far (`#401c13`, `#5a2719`, `#783922`, `#a25431`),
 * más oscura y corrida al violeta abajo (la piedra va adelante), con el óxido claro de las piedras del fondo arriba.
 */
export const ITAKURU = ramp('#1f0d0a', '#33160f', '#4a2015', '#62301c', '#7c3f24', '#9a5230', '#c27342');
/** Cuarzo lechoso, apenas rosado (las luces de las piedras del fondo, `#c38658`, aclaradas), con su sombra. */
export const QUARTZ = ramp('#5e3c2c', '#7e604e', '#9c806a', '#b39882', '#c8b19a', '#dccab4', '#ece0d0');
/** Raíces del pasto seco bajo el borde: el pasto de arriba, apagado. */
export const ROOT = ramp('#3e2212', '#6f5a2a', '#97803f', '#b9a262', '#d2c08a');

// ─── Colores ───────────────────────────────────────────────────────────────────────────────────────────────────────
const clamp = (v) => Math.max(0, Math.min(255, v));
const mix = (a, b, t) => [0, 1, 2].map((i) => a[i] + (b[i] - a[i]) * t);
const scale = (p, f) => [clamp(p[0] * f[0]), clamp(p[1] * f[1]), clamp(p[2] * f[2])];
const opaque = (c, a = 255) => [c[0], c[1], c[2], a];

// ─── La regla del autotile de S56 ──────────────────────────────────────────────────────────────────────────────────
/** Factor del borde oscuro en (x, y) para la máscara (1 lejos del aire). */
function edgeFactor(mask, x, y) {
  let f = 1;
  if (!(mask & LEFT) && x < 2) f = Math.min(f, x === 0 ? EDGE.outer : EDGE.inner);
  if (!(mask & RIGHT) && x >= T - 2) f = Math.min(f, x === T - 1 ? EDGE.outer : EDGE.inner);
  if (!(mask & DOWN) && y >= T - 2) f = Math.min(f, y === T - 1 ? EDGE.outer : EDGE.inner);
  return f;
}

/** La casilla `mask` del autotile con la tierra `dirt` y el pasto `grass` (filas 0 a 6), como la armó S56. */
export function campoCell(mask, dirt, grass) {
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

/** La tierra (la 15) y el pasto (las filas de arriba de la 14) de campo.png. */
export function campoSource(img = readCampoTileset()) {
  return { img, dirt: RgbaGrid.fromImage(img, 15, 4), grass: RgbaGrid.fromImage(img, 14, 4) };
}

const inCenter = (x, y) => x >= RING && y >= RING && x < T - RING && y < T - RING;

// ─── Otra tierra con el mismo anillo ───────────────────────────────────────────────────────────────────────────────
/**
 * La tierra de la 15 corrida (dx, dy), espejada o traspuesta, solo en el centro (2 a 13): el grano es el de campo.png
 * (los mismos píxeles en otro orden) y el anillo de 2 px queda el de la 15. En la primera y la última fila y columna
 * del centro se mezclan las dos al azar, para que no se lea un cuadro.
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
function cloud(rng, lo, hi, fn) {
  const x0 = irange(rng, lo + 2, hi - 2);
  const y0 = irange(rng, lo + 2, hi - 2);
  const rx = 2.4 + rng() * 2.2;
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
  const tone = (f) => (x, y) => {
    const p = g.get(x, y);
    g.set(x, y, opaque(scale(p, f)));
  };
  switch (kind) {
    case 'damp':
      cloud(rng, lo, hi, tone([0.87, 0.86, 0.87]));
      break;
    case 'dry':
      cloud(rng, lo, hi, tone([1.1, 1.1, 1.08]));
      break;
    case 'red':
      // Moteado de la laterita: hematita (más roja) …
      cloud(rng, lo, hi, tone([1.06, 0.84, 0.78]));
      break;
    case 'ochre':
      // … y goethita (más amarilla).
      cloud(rng, lo, hi, tone([1.08, 1.16, 1.06]));
      break;
    case 'pores':
      // Poros: el agujero oscuro y su labio de abajo, con luz.
      for (let k = 0; k < 3; k++) {
        const x = c();
        const y = c();
        g.set(x, y, opaque(scale(g.get(x, y), [0.66, 0.64, 0.66])));
        g.set(x, y + 1, opaque(scale(g.get(x, y + 1), [1.08, 1.08, 1.06])));
      }
      break;
    case 'grit':
      // Granitos de cuarzo, apenas más claros que la tierra.
      for (let k = 0; k < 3; k++) {
        const x = c();
        const y = c();
        g.set(x, y, opaque(mix(g.get(x, y), QUARTZ[4], 0.4)));
      }
      break;
    case 'iron':
      // Motas de hierro: un punto oscuro y rojizo con su brillo.
      for (let k = 0; k < 3; k++) {
        const x = c();
        const y = c();
        g.set(x, y, opaque(mix(g.get(x, y), ITAKURU[2], 0.6)));
        if (rng() < 0.6) g.set(x - 1, y - 1, opaque(mix(g.get(x - 1, y - 1), ITAKURU[5], 0.35)));
      }
      break;
    case 'trace': {
      // La huella de una raicilla vieja: una línea fina y tenue que serpentea.
      let x = irange(rng, lo, hi - 5);
      let y = c();
      const n = irange(rng, 4, 7);
      for (let k = 0; k < n; k++) {
        g.set(x, y, opaque(scale(g.get(x, y), [0.84, 0.82, 0.84])));
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
  ['ochre'],
  ['pores'],
  ['grit', 'dry'],
  ['iron'],
  ['red', 'pores'],
  ['trace'],
  ['damp', 'grit'],
  ['ochre', 'iron'],
];

/** Otra tierra para una variante: el grano corrido y sus rasgos, con el anillo de la 15. */
function variantDirt(base, rng, features) {
  const g = shiftedDirt(base, rng);
  for (const f of features) paintDirtFeature(g, f, rng);
  return g;
}

/** Otro pasto para una variante del piso: el centro (columnas 2 a 13) corrido a lo ancho; los costados, los de la 14. */
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

/** Las 12 variantes del relleno (casilla 15). */
export function fillVariants(src = campoSource(), seed = 1111) {
  const rng = mulberry32(seed);
  return FILL_FEATURES.map((features) => variantDirt(src.dirt, rng, features));
}

/** Variantes del piso (14), del techo (11) y de las paredes (7 y 13): la misma regla de S56 con otra tierra. */
export function edgeVariants(src = campoSource(), seed = 1112) {
  const rng = mulberry32(seed);
  const out = {};
  out[14] = [
    { features: ['dry'], shift: 5, flip: false },
    { features: ['pores'], shift: 9, flip: true },
    { features: ['red'], shift: 12, flip: false },
  ].map((v) => campoCell(14, variantDirt(src.dirt, rng, v.features), variantGrass(src.grass, v.shift, v.flip)));
  const features = { 11: [['damp'], ['iron']], 7: [['grit'], ['ochre']], 13: [['trace'], ['damp']] };
  for (const mask of [11, 7, 13]) out[mask] = features[mask].map((f) => campoCell(mask, variantDirt(src.dirt, rng, f), src.grass));
  return out;
}

// ─── Pinceles de las calcomanías ───────────────────────────────────────────────────────────────────────────────────
const blank = (w = T, h = T) => new RgbaGrid(w, h);
/** Pone un color con alfa encima de lo que haya en la calcomanía (mezcla "sobre"). */
function over(g, x, y, c, a) {
  if (!g.in(x, y) || a <= 0) return;
  const p = g.get(x, y);
  const pa = p[3] / 255;
  const na = a / 255;
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
 * Una piedra: polígono convexo con contorno y la luz de arriba (S109: por sectores salen muescas; como elipse, esferas).
 * `tones` de lo oscuro a lo claro: 0 el contorno, 1 a 5 el cuerpo (la cara de arriba en 5 y 4, el medio en 3, abajo
 * 2), 6 el brillo. El costado de la derecha va un tono más oscuro. `pits`: poros (la piedra de hierro es porosa), el
 * hueco en 1 y la luz en su labio de abajo. Abajo, la tierra la tapa un poco (`buried`) y le hace sombra: se lee
 * enterrada, no pegada encima.
 */
function paintStone(g, poly, tones, rng, { pits = 0, glints = 1, buried = 0.4 } = {}) {
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
  const body = [];
  for (const [x, y] of px) {
    const [top, bottom] = col.get(x);
    const [left, right] = row.get(y);
    const edgeBelow = !has(x, y + 1);
    if (!has(x, y - 1) || edgeBelow || !has(x - 1, y) || !has(x + 1, y)) {
      // Contorno: el de abajo, a veces tapado por la tierra; el de arriba, un tono más suave.
      if (edgeBelow && rng() < buried) over(g, x, y, DIRT[rng() < 0.5 ? 2 : 3], 215);
      else g.set(x, y, opaque(tones[!has(x, y - 1) && has(x, y + 1) ? 1 : 0]));
      continue;
    }
    const v = (y - top) / Math.max(1, bottom - top);
    const u = (x - left) / Math.max(1, right - left);
    let s = v < 0.3 ? 5 : v < 0.52 ? 4 : v < 0.78 ? 3 : 2;
    if (u > 0.8) s -= 1;
    if (rng() < 0.16) s += rng() < 0.5 ? -1 : 1;
    s = Math.max(2, Math.min(5, s));
    g.set(x, y, opaque(tones[s]));
    body.push([x, y, v, u]);
  }
  // Brillo arriba a la izquierda.
  const lit = body.filter(([, , v, u]) => v < 0.3 && u < 0.5);
  for (let k = 0; k < glints && lit.length; k++) {
    const [x, y] = lit[Math.floor(rng() * lit.length)];
    g.set(x, y, opaque(tones[6] ?? tones[5]));
  }
  // Poros: el hueco y la luz en su labio de abajo.
  const porous = body.filter(([x, y, v]) => v > 0.25 && has(x, y + 1) && has(x, y + 2));
  for (let k = 0; k < pits && porous.length; k++) {
    const [x, y] = porous.splice(Math.floor(rng() * porous.length), 1)[0];
    g.set(x, y, opaque(tones[1]));
    g.set(x, y + 1, opaque(tones[4]));
  }
  // La sombra que hace encima de la tierra: debajo y a la derecha, abajo.
  const yMax = Math.max(...row.keys());
  for (const [x, [, bottom]] of col) {
    over(g, x, bottom + 1, DIRT[0], 150);
    if (rng() < 0.5) over(g, x, bottom + 2, DIRT[0], 70);
  }
  for (const [y, [, right]] of row) if (y > yMax - 3) over(g, right + 1, y, DIRT[0], 110);
}

/** Itakurú: piedras de hierro sueltas (1 × 1), de 8 a 12 px. */
function itakuruStones(rng) {
  const shapes = [
    [[4, 7], [7, 5], [11, 5], [13, 7], [13, 11], [11, 13], [4, 13], [2, 11]],
    [[5, 8], [8, 6], [11, 7], [12, 10], [10, 13], [5, 13], [4, 11]],
    [[2, 9], [5, 6], [11, 6], [14, 8], [14, 11], [12, 13], [3, 13]],
  ];
  return shapes.map((poly, k) => {
    const g = blank();
    paintStone(g, poly, ITAKURU, rng, { pits: 2 + k, glints: 1 });
    return g;
  });
}

/** Concreciones grandes de itakurú (2 × 2): una piedra ancha con otra chica recostada. */
function ironstoneBoulders(rng) {
  const groups = [
    [
      [[5, 18], [10, 13], [19, 12], [25, 15], [26, 22], [23, 27], [7, 27], [4, 23]],
      [[23, 23], [26, 21], [29, 22], [30, 26], [28, 28], [23, 28]],
    ],
    [
      [[7, 17], [13, 13], [22, 13], [27, 17], [27, 24], [24, 28], [9, 28], [6, 24]],
      [[2, 24], [4, 22], [8, 22], [9, 25], [8, 28], [3, 28]],
    ],
  ];
  return groups.map((polys) => {
    const g = blank(2 * T, 2 * T);
    paintStone(g, polys[0], ITAKURU, rng, { pits: 7, glints: 2, buried: 0.5 });
    paintStone(g, polys[1], ITAKURU, rng, { pits: 1, glints: 1, buried: 0.5 });
    return g;
  });
}

/** Grava de itakurú: nódulos de 2 a 4 px con su luz y su sombra. */
function ironPebbles(rng) {
  const sets = [
    [[[3, 7], [5, 5], [8, 6], [8, 9], [4, 9]], [[9, 10], [12, 9], [13, 11], [12, 13], [9, 13]]],
    [[[4, 9], [6, 8], [9, 8], [10, 11], [5, 12]], [[10, 5], [12, 5], [13, 7], [11, 8]]],
    [[[6, 6], [9, 5], [11, 7], [10, 9], [6, 9]], [[3, 11], [5, 10], [7, 11], [6, 13], [3, 13]]],
  ];
  return sets.map((polys) => {
    const g = blank();
    for (const poly of polys) paintStone(g, poly, ITAKURU, rng, { pits: 1, glints: 1, buried: 0.3 });
    return g;
  });
}

/** Cantitos de cuarzo claro: astillas angulosas de 5 a 8 px (nunca un punto suelto: se lee como un destello). */
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
 * Capas de laterita (2 × 1 y 3 × 1): un horizonte de tierra más roja, de 4 a 7 px de alto, que ondula con los bordes
 * tramados (sin línea dura: con filo se lee como un palito), el moteado ocre de la goethita abajo y algún nódulo de
 * hierro. Va con alfa: es la tierra teñida y se ve el grano debajo, no una tira pegada. Las puntas se desvanecen.
 */
function lateriteLayers(rng) {
  const out = [];
  for (const [cols, thick] of [[3, 5], [2, 4], [3, 4], [2, 5], [3, 6]]) {
    const w = cols * T;
    const g = blank(w, T);
    const y0 = irange(rng, 4, 6);
    const phase = rng() * Math.PI * 2;
    const freq = 1.2 + rng() * 0.8;
    const top = Array.from({ length: w }, (_, x) => y0 + Math.round(Math.sin(phase + (x / w) * Math.PI * freq) * 1.3));
    for (let x = 1; x < w - 1; x++) {
      const end = Math.min(x - 1, w - 2 - x);
      const fade = end < 9 ? end / 9 : 1;
      const t = Math.max(2, Math.round(thick * (0.55 + 0.45 * fade)) + (rng() < 0.3 ? 1 : 0));
      for (let k = 0; k < t; k++) {
        const y = top[x] + k;
        const rim = k === 0 || k === t - 1;
        if (rim && rng() < 0.5) continue;
        if (rng() > 0.25 + 0.75 * fade) continue;
        over(g, x, y, LATERITE[k < t / 2 ? 1 : 2], Math.round((rim ? 85 : 145) * fade));
      }
      // El moteado ocre, abajo y alguno adentro.
      if (rng() < 0.5 * fade) over(g, x, top[x] + t + irange(rng, 0, 1), OCHRE[3], 110);
      if (rng() < 0.12 * fade) over(g, x, top[x] + irange(rng, 1, t - 1), OCHRE[3], 80);
      if (fade === 1 && rng() < 0.06) {
        const y = top[x] + irange(rng, 1, t - 2);
        g.set(x, y, opaque(ITAKURU[4]));
        g.set(x, y + 1, opaque(ITAKURU[2]));
      }
    }
    out.push(g);
  }
  return out;
}

/**
 * Galerías de hormigas, como en un corte del suelo: cámaras chatas (el techo en sombra, el hueco, el piso con luz)
 * unidas por túneles de 1 px casi verticales que se pierden en la tierra por las puntas.
 */
const ANT_NESTS = [
  { w: 1, chambers: [[6, 6], [9, 11]], tunnels: [[[7, 1], [6, 3], [7, 5]], [[8, 7], [9, 8], [9, 10]], [[11, 12], [12, 14], [12, 15]]] },
  { w: 1, chambers: [[9, 5], [5, 10]], tunnels: [[[10, 0], [9, 2], [10, 4]], [[8, 6], [7, 8], [6, 9]], [[3, 11], [2, 13], [2, 15]]] },
  {
    w: 2,
    chambers: [[7, 7], [17, 11], [25, 6]],
    tunnels: [[[8, 1], [7, 4], [8, 6]], [[9, 8], [12, 9], [15, 10]], [[19, 10], [21, 8], [23, 7]], [[26, 7], [28, 10], [29, 14]]],
  },
  {
    w: 2,
    chambers: [[8, 11], [14, 6], [24, 9]],
    tunnels: [[[3, 4], [6, 7], [7, 10]], [[9, 10], [11, 8], [13, 7]], [[16, 6], [19, 7], [22, 8]], [[24, 3], [25, 1], [25, 0]]],
  },
];

function antGalleries() {
  return ANT_NESTS.map(({ w: cols, chambers, tunnels }) => {
    const g = blank(cols * T, T);
    for (const path of tunnels) {
      const pts = [];
      for (let i = 0; i + 1 < path.length; i++) {
        const [ax, ay] = path[i];
        const [bx, by] = path[i + 1];
        const len = Math.max(Math.abs(bx - ax), Math.abs(by - ay), 1);
        for (let k = i ? 1 : 0; k <= len; k++) pts.push([Math.round(ax + ((bx - ax) * k) / len), Math.round(ay + ((by - ay) * k) / len)]);
      }
      pts.forEach(([x, y], k) => {
        const a = Math.min(1, 0.4 + Math.min(k, pts.length - 1 - k) / 3);
        over(g, x, y, ITAKURU[1], Math.round(165 * a));
        over(g, x + 1, y, OCHRE[3], Math.round(70 * a));
      });
    }
    for (const [x, y] of chambers) {
      for (let dx = -2; dx <= 3; dx++) {
        const rim = dx === -2 || dx === 3;
        if (!rim) over(g, x + dx, y - 1, ITAKURU[1], 130);
        over(g, x + dx, y, ITAKURU[0], rim ? 120 : 200);
        over(g, x + dx, y + 1, OCHRE[3], rim ? 70 : 125);
      }
    }
    return g;
  });
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
    if (k) paintRoot(g, 14 - 1, GRASS_ROWS, 4, rng, 0);
    return g;
  });
  const rootlets = [0, 1].map((k) => {
    const g = blank();
    paintRoot(g, k ? 11 : 4, GRASS_ROWS, 5, rng, 1);
    paintRoot(g, k ? 6 : 9, GRASS_ROWS, 3, rng, 0);
    return g;
  });
  return { roots, rootlets };
}

/** Las calcomanías del campo de Misiones. */
export function decals(seed = 1113) {
  const rng = mulberry32(seed);
  const { roots, rootlets } = grassRoots(rng);
  return {
    itakuru: itakuruStones(rng),
    ironstone: ironstoneBoulders(rng),
    pebble: ironPebbles(rng),
    quartz: quartzChips(rng),
    laterite: lateriteLayers(rng),
    ants: antGalleries(),
    roots,
    rootlet: rootlets,
  };
}

// ─── La hoja ───────────────────────────────────────────────────────────────────────────────────────────────────────
/**
 * public/assets/tiles/detalle/campo.png y su .json (S111): variantes del relleno, del piso, del techo y de las paredes,
 * y calcomanías. El tileset (campo.png) no se escribe.
 */
export function buildCampoDetail(src = campoSource()) {
  return buildDetailSheet({ fill: fillVariants(src), edges: edgeVariants(src), decals: decals() });
}

export const buildDetail = buildCampoDetail;
export const tilesetMd5 = campoTilesetMd5;
