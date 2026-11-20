// Tileset de la selva (l5, el monte de Canindeyú) dibujado por código (S113). Lo escribe tools/make-terrain-tiles.mjs
// (npm run terrain-tiles -- selva); lo prueba tests/selvaTiles.test.ts. Lo común (azar, grilla, paleta, armado de las
// hojas) está en tile-art.mjs.
//
// La idea, como en el estero: una tierra colorada base de 16 × 16 que se repite sin costura en las dos direcciones
// (terrones, granos, poros y alguna fibra de raíz que cruzan el borde). Cada casilla del autotile parte de esa base y solo
// cambia los lados que dan al aire: arriba la hojarasca, el musgo y los helechitos sobre una franja de humus oscuro que
// pasa tramada a la tierra; a los costados raíces que asoman y musgo; abajo raicillas que cuelgan. Cada tratamiento
// depende solo de la posición dentro de la casilla y es periódico a lo largo de su lado: dos casillas vecinas empalman
// siempre. Las variantes cambian solo el centro (de 2 a 13).
import {
  buildDetailSheet,
  buildTilesetImage,
  DOWN,
  Grid,
  irange,
  LEFT,
  makePalette,
  mod,
  mulberry32,
  restoreSolidBands,
  RIGHT,
  RING,
  T,
  UP,
} from './tile-art.mjs';

// ─── Paleta (medida en public/assets/backgrounds/l5_far.jpg; ver docs/ASSETS.md §6) ────────────────────────────────
// Musgo: la franja de suelo del frente (#171c12, #212617, #2f351f, #4d552e) y las hojas con luz (#6b7c34), un poco más
// claro porque el terreno va adelante. Helecho: los helechos de los costados (#0f160f, #182112, #253019, #374321,
// #566434). Hoja (las copas): las del frente (#0a130b, #131c10, #222e18, #334120, #485828) y la luz filtrada (#6b7c34,
// #8f9f43). Copa lejana: el árbol del medio (#3a4f3b, #495f44, #60774f, #758c66, #819875, #94a87e). Niebla: el cielo y
// la niebla del medio (#5f7058, #75886f, #879a7d, #94a787, #a5b796). Corteza: los troncos (#11170e, #182112, #252b18,
// #374022), corrida al marrón para las ramas. Piedra: las piedras mojadas del suelo del fondo (gris verdoso). La tierra
// colorada no está en el fondo: es la del monte de Canindeyú, apagada por la sombra verde; el humus, casi negro.
export const RAMPS = {
  earth: ['#1b0f0b', '#28150f', '#341b14', '#40221a', '#4d2a1f', '#5d3426', '#704131'],
  /** Medios tonos de la tierra (entre los pasos 2-3, 3-4 y 4-5): manchas suaves sin dibujar cuadros. */
  earthm: ['#3a1f17', '#46261c', '#552f22'],
  humus: ['#0e0a08', '#17110c', '#211811', '#2c2017', '#3a2b1e', '#4b3826'],
  litter: ['#2b1b0f', '#462c16', '#64401f', '#83592a', '#a37437', '#c3934c'],
  /** Hoja muerta rojiza (las del lapacho y el incienso del monte). */
  leafred: ['#3a1912', '#58281a', '#7a3a24', '#9b5232'],
  moss: ['#131b0f', '#1d2a14', '#2b3d1a', '#3d5320', '#536b28', '#6f8732', '#8ea343'],
  fern: ['#0e180f', '#192a17', '#273f20', '#38562a', '#4d7035', '#688d44'],
  leaf: ['#0a130b', '#131c10', '#1d2a15', '#2a3a1c', '#3a4d22', '#4f652b'],
  light: ['#6b7c34', '#8f9f43', '#b2bf5c', '#d2d985', '#ecefbb'],
  haze: ['#3a4f3b', '#495f44', '#60774f', '#758c66', '#819875', '#94a87e'],
  fog: ['#5f7058', '#75886f', '#879a7d', '#94a787', '#a5b796', '#b9c8a8'],
  root: ['#170e08', '#25180e', '#362414', '#48311c', '#5c4126', '#745633'],
  stone: ['#171b18', '#252b26', '#353c35', '#474f46', '#5d655a', '#787f72', '#969c8c'],
  bark: ['#120d09', '#1f160f', '#2f2216', '#41301f', '#564029', '#6e5335'],
  wood: ['#4a3020', '#6e4a30', '#946a40', '#b88d58'],
  lichen: ['#56604a', '#7b8767', '#a1ab86', '#c4cba6'],
  ochre: ['#5b3415', '#7d4a1d', '#a06327', '#c17f37'],
  fungus: ['#4a2513', '#7a3d1c', '#ad5c2a', '#d88747', '#eeb676', '#f7ddb0'],
  bone: ['#5f5a4b', '#8d8771', '#bbb59b', '#e4ddc2'],
  seed: ['#1c110a', '#382213', '#5a381d', '#82562c', '#ad8045'],
  worm: ['#4d2427', '#763a39', '#9c5852', '#bf7f73'],
  bug: ['#0c0e12', '#1b2130', '#2c3f56', '#5a86a3', '#9cc4d6'],
  thorn: ['#1c0c0d', '#331517', '#4f2124', '#6f302e', '#91463b'],
  spine: ['#7f6f53', '#a99a76', '#cfc29d', '#efe6c3'],
  berry: ['#350c16', '#681a28', '#a32f38', '#d4584b'],
  bromel: ['#46111d', '#741d2b', '#a93138', '#d65646', '#ee8c6c'],
  water: ['#0b120f', '#111c16', '#18281e', '#213628', '#2e4934', '#426146', '#64845e'],
  shadow: ['#050705'],
};
export const PALETTE = makePalette(RAMPS);
const grid = (w, h) => new Grid(w, h, PALETTE);

/** Tramado ordenado (Bayer 4 × 4): umbral de 0 a 1 en cada píxel; sirve para pasar de un material a otro sin cortes. */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
export const bayer = (x, y) => (BAYER[mod(y, 4) * 4 + mod(x, 4)] + 0.5) / 16;

// ─── La tierra base ───────────────────────────────────────────────────────────────────────────────────────────────
/** Tono de la tierra lisa. */
const EARTH = 3;
/**
 * Marcas de la tierra: [dx, dy, rampa, tono]. Terrones (la cara de arriba con luz, la de abajo en sombra), granos de
 * arena clara, poros húmedos, fibras de raíz y nódulos de laterita (ocre).
 */
const CLODS = [
  [[1, -1, 'earthm', 1], [2, -1, 'earthm', 1], [0, 0, 'earthm', 1], [1, 0, 'earth', 4], [2, 0, 'earthm', 1], [3, 0, 'earthm', 1], [0, 1, 'earthm', 0], [1, 1, 'earth', 2], [2, 1, 'earth', 2], [3, 1, 'earthm', 0]],
  [[0, 0, 'earthm', 1], [1, 0, 'earthm', 1], [2, 0, 'earthm', 1], [1, 1, 'earthm', 0], [2, 1, 'earth', 2]],
  [[1, -1, 'earthm', 1], [0, 0, 'earthm', 1], [1, 0, 'earth', 4], [2, 0, 'earthm', 1], [0, 1, 'earthm', 0], [1, 1, 'earth', 2], [2, 1, 'earthm', 0]],
  [[0, 0, 'earthm', 1], [1, 0, 'earthm', 1], [0, 1, 'earth', 2], [1, 1, 'earthm', 0]],
  [[1, -1, 'earthm', 1], [2, -1, 'earth', 4], [3, -1, 'earthm', 1], [0, 0, 'earthm', 1], [1, 0, 'earthm', 1], [2, 0, 'earthm', 1], [3, 0, 'earthm', 1], [4, 0, 'earthm', 0], [1, 1, 'earthm', 0], [2, 1, 'earth', 2], [3, 1, 'earth', 2], [4, 1, 'earthm', 0]],
];
const SPECKS = [
  [[0, 0, 'earthm', 2]],
  [[0, 0, 'earth', 2], [1, 0, 'earth', 2]],
  [[0, 0, 'humus', 3]],
  [[0, 0, 'earth', 2]],
  [[0, 0, 'ochre', 1], [1, 0, 'earthm', 0], [0, 1, 'earth', 2]],
  [[0, 0, 'root', 3], [1, 0, 'root', 3], [2, 1, 'root', 2], [3, 1, 'root', 2]],
];
/** Manchones suaves en medio tono (más claro arriba, más oscuro abajo): dan cuerpo a la tierra sin dibujar cuadros. */
const BLOBS = [
  [[1, 0, 'earthm', 1], [2, 0, 'earthm', 1], [0, 1, 'earthm', 1], [1, 1, 'earthm', 1], [2, 1, 'earthm', 1], [3, 1, 'earthm', 1], [1, 2, 'earthm', 0], [2, 2, 'earthm', 0], [3, 2, 'earthm', 0]],
  [[0, 0, 'earthm', 1], [1, 0, 'earthm', 1], [0, 1, 'earthm', 0], [1, 1, 'earthm', 1], [2, 1, 'earthm', 0]],
  [[1, 0, 'earthm', 0], [2, 0, 'earthm', 0], [0, 1, 'earthm', 0], [1, 1, 'earthm', 0], [2, 1, 'earthm', 0], [3, 1, 'earthm', 0], [1, 2, 'earth', 2], [2, 2, 'earth', 2]],
  [[0, 0, 'earthm', 1], [1, 0, 'earthm', 2], [2, 0, 'earthm', 1], [0, 1, 'earthm', 1], [1, 1, 'earthm', 1], [2, 1, 'earthm', 0]],
];
/** En la base: lo que cruza el borde (suave) y lo del centro (más marcado: lo cambia cada variante). */
const BASE_MARKS = [BLOBS[0], CLODS[1], BLOBS[2], CLODS[3], SPECKS[1], BLOBS[1], SPECKS[3], SPECKS[2], BLOBS[3]];
const CENTER_MARKS = [CLODS[0], SPECKS[0], SPECKS[5]];
const VARIANT_MARKS = [CLODS[0], BLOBS[0], CLODS[3], BLOBS[2], CLODS[4], SPECKS[0], SPECKS[1], BLOBS[3], SPECKS[3], CLODS[2]];

const touchesRing = (m) =>
  m.px.some(([dx, dy]) => {
    const x = mod(m.x + dx, T);
    const y = mod(m.y + dy, T);
    return x < RING || y < RING || x >= T - RING || y >= T - RING;
  });

/** Pone marcas donde haya tierra lisa y lejos de las otras; `wrap`: pueden cruzar el borde (la base). */
function scatter(g, rng, marks, { wrap, lo = RING, hi = T - RING }) {
  const placed = [];
  const at = (x, y) => (wrap ? [mod(x, T), mod(y, T)] : [x, y]);
  const free = (x, y) => {
    const [px, py] = at(x, y);
    if (!wrap && (px < lo || py < lo || px >= hi || py >= hi)) return false;
    return g.ramp(px, py) === 'earth' && g.step(px, py) === EARTH;
  };
  const near = (x, y) => {
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (!(dx === 0 && dy === 0) && !free(x + dx, y + dy)) return true;
    return false;
  };
  for (const px of marks) {
    for (let tries = 0; tries < 300; tries++) {
      const m = { x: irange(rng, 0, T - 1), y: irange(rng, 0, T - 1), px };
      if (!px.every(([dx, dy]) => free(m.x + dx, m.y + dy) && !near(m.x + dx, m.y + dy))) continue;
      for (const [dx, dy, ramp, st] of px) g.set(...at(m.x + dx, m.y + dy), ramp, st);
      placed.push(m);
      break;
    }
  }
  return placed;
}

function plainEarth() {
  const g = grid(T, T);
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) g.set(x, y, 'earth', EARTH);
  return g;
}

const baseMarks = () => scatter(plainEarth(), mulberry32(113), BASE_MARKS, { wrap: true });

/**
 * La tierra base (casilla 15): tierra colorada lisa con terrones, granos, poros, una fibra de raíz y un nódulo de
 * laterita que cruzan el borde. Con `seed` distinta (una variante): las marcas de la base que tocan el anillo de 2 px
 * van igual, enteras, y las del centro son otras.
 */
export function baseEarth(seed = 113) {
  const g = plainEarth();
  const marks = baseMarks();
  const draw = (m) => m.px.forEach(([dx, dy, ramp, st]) => g.set(mod(m.x + dx, T), mod(m.y + dy, T), ramp, st));
  if (seed === 113) {
    marks.forEach(draw);
    scatter(g, mulberry32(1130), CENTER_MARKS, { wrap: false });
    return g;
  }
  marks.filter(touchesRing).forEach(draw);
  scatter(g, mulberry32(seed), VARIANT_MARKS, { wrap: false });
  return g;
}

// ─── Perfiles de los bordes (periódicos a lo largo de su lado) ─────────────────────────────────────────────────────
// Arriba: dónde empieza la hojarasca, dónde empieza el humus y dónde pasa a la tierra colorada; las hojas caídas, los
// cojines de musgo, los helechitos y las matas de musgo que cuelgan delante del humus.
export const TOPSOIL = {
  /** Fila donde empieza la hojarasca (su luz), por columna. */
  top: [2, 1, 2, 2, 3, 2, 2, 2, 1, 2, 2, 3, 2, 2, 2, 2],
  /** Primera fila de humus (debajo de la hojarasca). */
  litter: [5, 4, 5, 5, 6, 5, 5, 5, 4, 5, 5, 6, 5, 5, 5, 5],
  /** Última fila del humus; de ahí pasa tramado a la tierra colorada (dos filas arriba y una abajo). */
  humus: [10, 10, 11, 11, 11, 10, 10, 9, 9, 10, 10, 11, 12, 11, 10, 10],
  /**
   * Hojas caídas: [x, fila, forma, rampa, desplazamiento de tono]. Primero las de atrás (más abajo), después las de
   * arriba; cruzan el borde de la casilla (con vuelta).
   */
  leaves: [
    [0, 4, 2, 'litter', -1],
    [5, 4, 5, 'litter', 0],
    [10, 4, 0, 'leafred', -1],
    [13, 4, 4, 'litter', 0],
    [2, 3, 3, 'leafred', 0],
    [7, 2, 0, 'litter', 1],
    [11, 2, 2, 'litter', 0],
    [15, 2, 4, 'leafred', 1],
    [4, 1, 5, 'litter', 1],
    [9, 1, 3, 'moss', 0],
  ],
  /** Cojines de musgo sobre la hojarasca: [desde, ancho]. */
  moss: [[3, 4], [10, 3], [15, 2]],
  /** Helechitos que se asoman sobre la hojarasca: [x, hacia]. */
  ferns: [[7, 1]],
  /** Raicillas en el humus: [x, fila, largo, hacia]. */
  hairs: [[1, 7, 3, 1], [9, 7, 3, -1], [14, 6, 2, 1]],
  /** En las esquinas, hasta dónde baja el musgo por el costado: [columna de afuera, la de adentro]. */
  side: [9, 6],
};
/** Formas de las hojas caídas: [dx, dy, tono] (la luz arriba, la sombra abajo). */
const LEAF_SHAPES = [
  [[0, 0, 2], [1, 0, 3], [2, 0, 3], [3, 0, 2], [1, 1, 1], [2, 1, 1]],
  [[1, 0, 3], [2, 0, 2], [0, 1, 2], [1, 1, 2], [2, 1, 1]],
  [[1, 0, 3], [2, 0, 4], [3, 0, 3], [0, 1, 2], [1, 1, 2], [2, 1, 2], [3, 1, 1], [4, 1, 1]],
  [[0, 1, 2], [1, 1, 3], [1, 0, 3], [2, 0, 2]],
  [[0, 0, 3], [1, 0, 3], [0, 1, 2], [1, 1, 1]],
  [[0, 0, 2], [1, 0, 3], [2, 0, 3], [3, 0, 3], [4, 0, 2], [5, 0, 1]],
];
export const NOTCH = {
  left: [0, 0, 1, 1, 0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 0, 1],
  right: [0, 1, 0, 0, 0, 1, 1, 0, 0, 0, 0, 1, 0, 0, 1, 1],
  // Abajo: muescas (de donde cuelgan las raicillas).
  bottom: [1, 0, 1, 2, 2, 1, 0, 1, 1, 0, 1, 2, 1, 0, 0, 1],
};
/** Raíces que asoman por los costados: [fila, largo]. */
export const SIDE_ROOTS = { left: [[11, 1]], right: [[4, 1]] };
/** Raicillas que cuelgan por abajo (techo): [x, largo]. */
export const CEIL_ROOTS = [[3, 4], [10, 3], [13, 2]];

/** Contorno y sombra hacia el aire, como en cerro: oscuro abajo y a la derecha, filo claro a la izquierda. */
function shadeEdges(g, air) {
  const clearAt = (x, y) => {
    if (x < 0 && air.left) return true;
    if (x > T - 1 && air.right) return true;
    if (y > T - 1 && air.down) return true;
    if (y < 0 && air.up) return true;
    if (x < 0 || x > T - 1 || y < 0 || y > T - 1) return false;
    return !g.opaque(x, y);
  };
  const shade = new Int8Array(T * T).fill(-1);
  for (let y = 0; y < T; y++) {
    for (let x = 0; x < T; x++) {
      if (!g.opaque(x, y)) continue;
      let dark = 99;
      for (let k = 1; k <= 3; k++) {
        if (clearAt(x, y + k)) dark = Math.min(dark, k - 1);
        if (clearAt(x + k, y)) dark = Math.min(dark, k - 1);
      }
      if (clearAt(x - 1, y + 1) || clearAt(x + 1, y + 1)) dark = Math.min(dark, 0);
      if (clearAt(x - 1, y)) dark = Math.min(dark, 1);
      if (dark < 99) shade[y * T + x] = dark;
      else if (clearAt(x - 2, y)) shade[y * T + x] = 9;
    }
  }
  for (let i = 0; i < T * T; i++) {
    const s = shade[i];
    if (s < 0) continue;
    const x = i % T;
    const y = (i - x) / T;
    const cur = g.ramp(x, y) === 'earth' ? g.step(x, y) : 3;
    if (s === 9) g.set(x, y, 'earth', Math.max(cur, 5));
    else g.set(x, y, 'earth', Math.min(cur, s + 1));
  }
}

/**
 * Una casilla del autotile (máscara: vecinos sólidos arriba 1, derecha 2, abajo 4, izquierda 8). `variant` cambia el
 * centro: { base, topsoil, notch, sideRoots, roots } (lo que toca un borde sólido tiene que ser igual a la base).
 */
export function autotileCell(mask, variant = {}) {
  const g = (variant.base ?? baseEarth()).clone();
  const air = { up: !(mask & UP), right: !(mask & RIGHT), down: !(mask & DOWN), left: !(mask & LEFT) };
  const top = { ...TOPSOIL, ...(variant.topsoil ?? {}) };
  const notch = { ...NOTCH, ...(variant.notch ?? {}) };
  const sideRoots = { ...SIDE_ROOTS, ...(variant.sideRoots ?? {}) };
  const roots = variant.roots ?? CEIL_ROOTS;

  // 1. Silueta: muescas en los costados y abajo, esquinas gastadas.
  if (air.left) for (let y = 0; y < T; y++) for (let x = 0; x < notch.left[y]; x++) g.clear(x, y);
  if (air.right) for (let y = 0; y < T; y++) for (let x = 0; x < notch.right[y]; x++) g.clear(T - 1 - x, y);
  if (air.down) for (let x = 0; x < T; x++) for (let y = 0; y < notch.bottom[x]; y++) g.clear(x, T - 1 - y);
  const chamfer = [3, 2, 1];
  if (air.down && air.left) for (let y = 0; y < 3; y++) for (let x = 0; x < chamfer[y]; x++) g.clear(x, T - 1 - y);
  if (air.down && air.right) for (let y = 0; y < 3; y++) for (let x = 0; x < chamfer[y]; x++) g.clear(T - 1 - x, T - 1 - y);

  // 2. Contorno, sombra y filo claro.
  shadeEdges(g, air);

  // 3. Raíces que asoman por los costados (la punta en el aire de la muesca) y raicillas que cuelgan abajo.
  const poke = (x, y, d, len) => {
    for (let k = 0; k < len + 1; k++) {
      const px = x + d * (k - 1);
      if (!g.in(px, y)) continue;
      g.set(px, y, 'root', k === 0 ? 1 : k === len ? 2 : 3);
      if (g.in(px, y + 1) && !g.opaque(px, y + 1)) g.set(px, y + 1, 'shadow', 0, 80);
    }
  };
  if (air.left) for (const [y, len] of sideRoots.left) poke(notch.left[y], y, -1, len + notch.left[y]);
  if (air.right) for (const [y, len] of sideRoots.right) poke(T - 1 - notch.right[y], y, 1, len + notch.right[y]);
  if (air.down) {
    for (const [x0, len] of roots) {
      const y0 = T - 1 - notch.bottom[x0];
      for (let k = 0; k <= len; k++) {
        const y = y0 + k;
        const x = x0 + (k > 1 && k % 2 === 0 ? 1 : 0);
        if (!g.in(x, y)) continue;
        g.set(x, y, 'root', k === 0 ? 2 : k === len ? 1 : 3);
      }
    }
  }

  // 4. Arriba: hojarasca, musgo y helechitos sobre la franja de humus (desbordan el filo en las esquinas).
  if (air.up) paintTopsoil(g, top, air);
  return g;
}

/** Hoja caída en (x, y) con vuelta a lo ancho: `ramp` y el tono de cada píxel corrido `shift`. */
function paintLeaf(g, x, y, shape, ramp, shift, clip) {
  const r = RAMPS[ramp].length;
  for (const [dx, dy, s] of LEAF_SHAPES[shape]) {
    const px = mod(x + dx, T);
    const py = y + dy;
    if (clip && !clip(px, py)) continue;
    g.set(px, py, ramp, Math.max(0, Math.min(r - 1, s + shift)));
  }
}

function paintTopsoil(g, top, air) {
  const t = [...top.top];
  if (air.left) {
    t[0] = Math.max(t[0], 3);
    t[1] = Math.max(t[1], 2);
  }
  if (air.right) {
    t[T - 1] = Math.max(t[T - 1], 3);
    t[T - 2] = Math.max(t[T - 2], 2);
  }
  const skip = (x) => (air.left && x < 2) || (air.right && x > T - 3);
  for (let x = 0; x < T; x++) {
    for (let y = 0; y < t[x]; y++) g.clear(x, y);
    // El humus: casi negro bajo las hojas y más pardo abajo, con la tierra colorada que entra tramada por abajo.
    const lit = top.litter[x];
    const hb = top.humus[x];
    for (let y = lit; y <= hb + 1; y++) {
      if (!g.opaque(x, y)) continue;
      const keep = y <= hb - 2 ? 1 : y === hb - 1 ? 0.78 : y === hb ? 0.48 : 0.16;
      if (bayer(x, y) >= keep) continue;
      const s = y === lit ? 1 : y > hb - 2 ? 3 : (x * 3 + y * 5) % 7 === 0 ? 3 : 2;
      g.set(x, y, 'humus', s);
    }
    // La hojarasca: el fondo oscuro entre las hojas.
    for (let y = t[x]; y < lit; y++) g.set(x, y, 'litter', y === t[x] ? 2 : 0);
  }
  // Las hojas caídas, de atrás para adelante, sin pasar el aire ni la franja del humus.
  const clip = (x, y) => y >= t[x] && y <= top.litter[x] && !skip(x);
  for (const [x, y, shape, ramp, shift] of top.leaves) paintLeaf(g, x, y, shape, ramp, shift, clip);
  // La luz del filo: la primera fila de cada columna, más clara.
  for (let x = 0; x < T; x++) {
    const y = t[x];
    const r = g.ramp(x, y);
    if (r === 'litter' || r === 'leafred') g.set(x, y, r, Math.min(RAMPS[r].length - 1, g.step(x, y) + 1));
  }
  // Cojines de musgo: la luz arriba, el verde medio y la base oscura sobre la hojarasca.
  for (const [x0, w] of top.moss) {
    for (let k = 0; k < w; k++) {
      const x = mod(x0 + k, T);
      if (skip(x)) continue;
      const y0 = Math.max(0, t[x] - (k === 1 ? 1 : 0));
      g.set(x, y0, 'moss', k === 1 ? 6 : 5);
      g.set(x, y0 + 1, 'moss', k === 1 ? 4 : 3);
      if (y0 + 2 < top.litter[x]) g.set(x, y0 + 2, 'moss', 1);
    }
  }
  // Helechitos: una fronda chica que se arquea sobre la hojarasca, con la punta clara.
  for (const [x, d] of top.ferns) {
    if (skip(x) || skip(x + 2 * d)) continue;
    const y = t[x];
    for (const [dx, dy, s] of [[0, 0, 2], [0, -1, 3], [d, -1, 3], [d, -2, 4], [2 * d, -2, 5], [-d, -1, 2], [2 * d, -1, 3]]) {
      if (y + dy >= 0) g.set(x + dx, y + dy, 'fern', s);
    }
  }
  // Raicillas en el humus, apenas más claras.
  for (const [x0, y0, len, d] of top.hairs) {
    for (let k = 0; k < len; k++) {
      const x = mod(x0 + (k > 0 ? d * Math.ceil(k / 2) : 0), T);
      const y = y0 + k;
      if (skip(x) || g.ramp(x, y) !== 'humus') continue;
      g.set(x, y, 'root', k === 0 ? 3 : 2);
    }
  }
  // En las esquinas el musgo y la hojarasca bajan por el costado (desbordan el filo).
  const side = (x, depth, outer) => {
    for (let y = t[x]; y <= depth; y++) g.set(x, y, 'moss', y === depth ? 1 : outer ? (y < t[x] + 2 ? 5 : 3) : y < t[x] + 2 ? 4 : 2);
  };
  if (air.left) {
    side(0, top.side[0], true);
    side(1, top.side[1], false);
    g.set(2, t[2], 'litter', 4);
  }
  if (air.right) {
    side(T - 1, top.side[0] - 1, true);
    side(T - 2, top.side[1] + 1, false);
    g.set(T - 3, t[T - 3], 'litter', 4);
  }
}

// ─── Plataforma: rama gruesa con musgo, grosor y sombra debajo (la colisión sigue en la fila 0) ─────────────────────
// Las balsas (plataformas móviles, S57: en l5 las ramas que van y vienen) toman las 6 filas de arriba.
export const BRANCH = {
  /** Grietas de la corteza (a lo largo): [fila, desde, hasta]. */
  furrows: [[3, 1, 5], [4, 8, 13], [5, 2, 6], [2, 10, 14], [5, 11, 14]],
  /** Manchas de liquen: [x, fila]. */
  lichen: [[7, 3], [14, 4]],
  /** Nudo de la rama: [x, fila] o nada. */
  knot: [[9, 3]],
  /** El musgo de arriba: tramos [desde, ancho] (lo demás es corteza con luz). */
  moss: [[0, 6], [9, 5]],
  /** Hebras de musgo que cuelgan del canto de abajo (1: una fila más). */
  strands: [0, 0, 1, 0, 0, 0, 0, 2, 0, 0, 0, 1, 0, 0, 0, 0],
};

export function branchCell(kind /* 'left' | 'center' | 'right' */, variant = {}) {
  const v = { ...BRANCH, ...variant };
  const g = grid(T, T);
  const SLAB = 7; // filas 0 a 6: la rama (redonda: luz arriba, sombra abajo); 7: el canto; 8 y 9: sombra
  const tone = [5, 4, 4, 3, 3, 2, 1];
  for (let x = 0; x < T; x++) {
    for (let y = 0; y < SLAB; y++) g.set(x, y, 'bark', tone[y]);
    g.set(x, SLAB, 'bark', 0);
    for (let k = 1; k <= v.strands[x]; k++) g.set(x, SLAB + k, 'moss', k === v.strands[x] ? 1 : 2);
    const s0 = SLAB + 1 + v.strands[x];
    g.set(x, s0, 'shadow', 0, 120);
    g.set(x, s0 + 1, 'shadow', 0, 50);
  }
  // Grietas de la corteza, con su labio claro arriba.
  for (const [y, x0, x1] of v.furrows) {
    for (let x = x0; x <= x1; x++) {
      g.set(x, y, 'bark', Math.max(0, tone[y] - 2));
      if (y > 1 && (x + y) % 3 !== 0) g.set(x, y - 1, 'bark', Math.min(5, tone[y - 1] + 1));
    }
  }
  for (const [x, y] of v.lichen) {
    g.set(x, y, 'lichen', 2);
    g.set(x + 1, y, 'lichen', 1);
    g.set(x, y + 1, 'lichen', 0);
  }
  for (const [x, y] of v.knot) {
    g.set(x, y, 'bark', 0);
    g.set(x + 1, y, 'bark', 1);
    g.set(x, y - 1, 'bark', 5);
    g.set(x + 1, y + 1, 'bark', 4);
    g.set(x - 1, y, 'bark', 2);
  }
  // El musgo de arriba: la luz en la fila 0, el verde en la 1 y la base oscura en la 2.
  for (const [x0, w] of v.moss) {
    for (let k = 0; k < w; k++) {
      const x = x0 + k;
      const edge = k === 0 || k === w - 1;
      g.set(x, 0, 'moss', edge ? 4 : (x * 3) % 5 === 0 ? 6 : 5);
      g.set(x, 1, 'moss', edge ? 2 : 3);
      if (!edge && (x * 7) % 3 === 0) g.set(x, 2, 'moss', 1);
    }
  }
  // Los extremos: la rama quebrada, con la madera clara del corte.
  if (kind === 'left') {
    for (const y of [0, 6, 7, 8, 9, 10]) g.clear(0, y);
    for (const y of [8, 9, 10]) g.clear(1, y);
    g.set(1, 7, 'bark', 0);
    for (let y = 1; y < 6; y++) g.set(0, y, 'wood', y === 1 ? 2 : 1);
    for (let y = 1; y < 6; y++) g.set(1, y, 'wood', y === 3 ? 1 : 3);
    g.set(2, 3, 'wood', 2);
    g.set(1, 0, 'moss', 4);
    g.set(1, 8, 'shadow', 0, 60);
  }
  if (kind === 'right') {
    for (const y of [0, 6, 7, 8, 9, 10]) g.clear(15, y);
    for (const y of [8, 9, 10]) g.clear(14, y);
    g.set(14, 7, 'bark', 0);
    for (let y = 1; y < 6; y++) g.set(15, y, 'wood', 0);
    for (let y = 1; y < 6; y++) g.set(14, y, 'wood', y === 3 ? 0 : 2);
    g.set(13, 3, 'wood', 1);
    g.set(14, 8, 'shadow', 0, 60);
  }
  return g;
}

// ─── Espinas: zarza espinosa del monte ─────────────────────────────────────────────────────────────────────────────
// Tallos de zarza oscuros y rojizos que se arquean, con espinas claras y curvas que apuntan afuera, dos hojas dentadas
// y una mora roja. Un tallo sube derecho y sale por arriba y por abajo: apiladas (las paredes con espinas de l5) siguen.
export function spikesCell() {
  const g = grid(T, T);
  const thorns = [];
  // Cada tallo: 2 px (la luz a la izquierda, la sombra a la derecha) que se afina a 1 px en la punta.
  const stem = (pts, every = 2) => {
    pts.forEach(([x, y], k) => {
      const tip = k > pts.length - 4;
      g.set(x, y, 'thorn', tip ? 4 : 3);
      if (!tip) g.set(x + 1, y, 'thorn', 1);
      if (k % every === 1) thorns.push([x, y, (k >> 1) % 2 ? 1 : -1, tip]);
    });
  };
  // El tallo derecho (sale por arriba y por abajo en la columna 8: apiladas, sigue).
  stem(Array.from({ length: T }, (_, k) => [8 + (k > 4 && k < 11 ? -1 : 0), T - 1 - k]));
  // Un tallo que se arquea de costado a costado (sale en la fila 10 por los dos lados: en fila, la zarza sigue).
  stem(Array.from({ length: T }, (_, x) => [x, 10 - Math.round(4 * Math.sin((Math.PI * x) / (T - 1)))]), 3);
  // Dos tallos que nacen abajo y salen por los costados en la fila 6 (el de la izquierda sigue en el de la derecha).
  stem([[4, 15], [3, 14], [3, 13], [2, 12], [2, 11], [1, 10], [1, 9], [1, 8], [0, 7], [0, 6]]);
  stem([[11, 15], [12, 14], [12, 13], [13, 12], [13, 11], [14, 10], [14, 9], [14, 8], [15, 7], [15, 6]]);
  // Espinas: ganchos claros de 2 px que miran afuera y arriba, con la punta casi blanca y la sombra debajo.
  for (const [x, y, d] of thorns) {
    const ox = d > 0 ? x + 2 : x - 1;
    for (const [px, py, s] of [[ox, y, 1], [ox + d, y - 1, 3]]) {
      if (!g.in(px, py) || g.opaque(px, py)) continue;
      g.set(px, py, 'spine', s);
      if (g.in(px, py + 1) && !g.opaque(px, py + 1)) g.set(px, py + 1, 'thorn', 0);
    }
  }
  // Las puntas de arriba: espinas que miran al cielo.
  for (const [x, y] of [[4, 4], [11, 4], [7, 0]]) if (g.in(x, y) && !g.opaque(x, y)) g.set(x, y, 'spine', 3);
  // Hojas dentadas de la zarza (verde oscuro con su nervio claro) y dos moras.
  for (const [x, y, d] of [[3, 2, 1], [12, 12, -1]]) {
    const leaf = [[0, 0, 3], [d, 0, 4], [2 * d, 0, 3], [3 * d, -1, 4], [0, 1, 2], [d, 1, 3], [2 * d, 1, 2], [3 * d, 0, 2], [d, 2, 1], [2 * d, 2, 1]];
    for (const [dx, dy, s] of leaf) if (!g.opaque(x + dx, y + dy)) g.set(x + dx, y + dy, 'fern', s);
  }
  for (const [bx, by] of [[5, 12], [10, 3]]) {
    for (const [dx, dy, s] of [[0, 0, 2], [1, 0, 3], [0, 1, 1], [1, 1, 2]]) if (!g.opaque(bx + dx, by + dy)) g.set(bx + dx, by + dy, 'berry', s);
  }
  // El pie: hojarasca oscura donde nacen los tallos.
  for (let x = 1; x < T - 1; x++) if (!g.opaque(x, T - 1)) g.set(x, T - 1, 'litter', x % 3 === 0 ? 2 : 1);
  return g;
}

// ─── Agua de arroyo del monte (l5 no tiene; a tono): agua negra, color té, con el reflejo verde de las copas ────────
export const WATER_ALPHA = { surface: 232, body: 240, deep: 248 };
const CREST = [1, 1, 0, 0, 1, 1, 1, 0, 1, 1, 1, 1, 0, 0, 1, 1];

export function waterCell(kind /* 'surface' | 'body' | 'deep' */, seed = 1130) {
  const rng = mulberry32(seed);
  const g = grid(T, T);
  const a = WATER_ALPHA[kind];
  const bands = { surface: [[0, 4], [8, 3]], body: [[0, 3], [6, 2], [12, 1]], deep: [[0, 1]] }[kind];
  const toneAt = (y) => bands.filter(([from]) => y >= from).at(-1)[1];
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) g.set(x, y, 'water', toneAt(y), a);
  for (const [from] of bands) {
    if (from === 0) continue;
    for (let x = 0; x < T; x++) if (rng() < 0.35) g.set(x, from, 'water', toneAt(from - 1), a);
  }
  if (kind === 'surface') {
    for (let x = 0; x < T; x++) {
      const c = CREST[x];
      for (let y = 0; y < c; y++) g.clear(x, y);
      g.set(x, c, 'fog', (x * 5) % 7 === 0 ? 4 : 2, 255);
      g.set(x, c + 1, 'water', 5, a);
    }
    // Reflejo de las copas: rayas verdes cortas.
    for (const [x, y, len] of [[2, 4, 3], [9, 6, 4], [5, 10, 2]]) for (let k = 0; k < len; k++) g.set(mod(x + k, T), y, 'leaf', 4, a);
  } else if (kind === 'body') {
    for (const [x, y, len] of [[4, 4, 3], [11, 9, 2]]) for (let k = 0; k < len; k++) g.set(mod(x + k, T), y, 'water', 4, a);
  } else {
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) if (rng() < 0.05) g.set(x, y, 'water', 0, a);
  }
  return g;
}

// ─── Piedra con musgo que se rompe: gris verdosa y mojada, partida por grietas hondas ─────────────────────────────
/** Las grietas (polilíneas de píxeles); la luz del tajo las recorre (hoja de detalle, `glow`). */
// Salen por arriba y por abajo en las columnas 5 y 11, y por los costados en la fila 6: apiladas o de a dos (el tronco de
// roca de l5 es de 2 × 4) las grietas siguen de una celda a la otra.
const STONE_CRACKS = [
  [[5, 0], [5, 1], [6, 2], [6, 3], [6, 4], [7, 5], [7, 6]],
  [[0, 6], [1, 6], [2, 7], [3, 7], [4, 7], [5, 6], [6, 6], [7, 6]],
  [[7, 6], [8, 6], [9, 7], [10, 7], [11, 6], [12, 6], [13, 5], [14, 6], [15, 6]],
  [[11, 0], [11, 1], [10, 2], [11, 3], [11, 4], [11, 5], [11, 6]],
  [[9, 7], [9, 8], [8, 9], [8, 10], [7, 11], [6, 12], [6, 13], [5, 14], [5, 15]],
  [[11, 6], [12, 8], [12, 9], [11, 10], [11, 11], [12, 12], [11, 13], [11, 14], [11, 15]],
];
/** El musgo de arriba de la piedra: hasta qué fila baja, por columna. */
const STONE_MOSS = [-1, -1, 1, 2, 2, 1, -1, -1, -1, -1, -1, -1, 1, 3, 2, -1];

export function stoneCell(cracks = STONE_CRACKS, seed = 1131, moss = STONE_MOSS) {
  const rng = mulberry32(seed);
  const g = grid(T, T);
  const isCrack = new Set(cracks.flat().map(([x, y]) => `${x},${y}`));
  // La piedra: gris verdoso, con lajas un poco más claras y moteado del agua.
  for (let y = 0; y < T; y++) {
    for (let x = 0; x < T; x++) {
      let s = 3;
      if ((x * 5 + y * 3) % 13 === 0) s = 4;
      if ((x * 3 + y * 7) % 11 === 0) s = 2;
      if (rng() < 0.05) s = 5;
      g.set(x, y, 'stone', s);
    }
  }
  // Las grietas: honda (tono 0), con el labio claro arriba a la izquierda y la sombra abajo a la derecha.
  for (const line of cracks) for (const [x, y] of line) g.set(x, y, 'stone', 0);
  for (const line of cracks) {
    for (const [x, y] of line) {
      if (g.in(x - 1, y - 1) && !isCrack.has(`${x - 1},${y - 1}`)) g.set(x - 1, y - 1, 'stone', 5);
      if (g.in(x + 1, y) && !isCrack.has(`${x + 1},${y}`)) g.set(x + 1, y, 'stone', 2);
      if (g.in(x, y + 1) && !isCrack.has(`${x},${y + 1}`)) g.set(x, y + 1, 'stone', 1);
    }
  }
  // Brillo de lo mojado.
  for (const [x, y] of [[3, 5], [12, 8], [8, 12]]) if (!isCrack.has(`${x},${y}`)) g.set(x, y, 'stone', 6);
  // El musgo de arriba, con la luz en la primera fila y el borde de abajo tramado.
  for (let x = 0; x < T; x++) {
    for (let y = 0; y <= moss[x]; y++) {
      if (isCrack.has(`${x},${y}`)) continue;
      if (y === moss[x] && bayer(x, y) > 0.5) continue;
      g.set(x, y, 'moss', y === 0 ? 5 : y === moss[x] ? 2 : 3 + ((x + y) % 3 === 0 ? 1 : 0));
    }
  }
  return g;
}

/** La luz que corre por las grietas de la piedra (solo esos píxeles, blancos: el juego le pone el color). */
export function stoneGlow(cracks = STONE_CRACKS) {
  const g = grid(T, T);
  for (const line of cracks) for (const [x, y] of line) g.set(x, y, 'bone', 3);
  return g;
}

// ─── Decoración del borde (casillas 23 a 25), apoyada abajo ───────────────────────────────────────────────────────
/** Helecho de dos frondas que se arquean, con la hojarasca al pie (23: la «mata»). */
export function fernCell() {
  const g = grid(T, T);
  const frond = (x0, h, d) => {
    for (let k = 0; k < h; k++) {
      const t = k / (h - 1);
      const x = Math.round(x0 + d * (t * t * 4));
      const y = T - 2 - k;
      g.set(x, y, 'fern', k === h - 1 ? 5 : k > h * 0.6 ? 4 : 2);
      // Foliolos a los dos lados, más cortos hacia la punta.
      if (k > 1 && k < h - 1 && k % 2 === 0) {
        const len = Math.max(1, Math.round((1 - t) * 3));
        for (let j = 1; j <= len; j++) {
          g.set(x - j, y + (j > 1 ? 1 : 0), 'fern', j === len ? 2 : 3);
          g.set(x + j, y + (j > 1 ? 1 : 0), 'fern', j === len ? 3 : 4);
        }
      }
    }
  };
  frond(5, 11, -1);
  frond(9, 13, 1);
  frond(7, 7, 0);
  for (let x = 2; x <= 13; x++) g.set(x, T - 1, x % 4 === 1 ? 'leafred' : 'litter', x % 3 === 0 ? 3 : 2);
  g.set(4, T - 2, 'litter', 4);
  g.set(11, T - 2, 'leafred', 3);
  return g;
}

/** Karaguatá chico (bromelia): hojas duras y dentadas en roseta, con el corazón rojo, y un hongo al pie (24). */
export function bromeliadCell() {
  const g = grid(T, T);
  // [dx de la punta, alto]: las hojas salen del centro (x 8, fila 14) y se abren.
  for (const [dx, h, s] of [[-6, 6, 2], [6, 6, 2], [-4, 9, 3], [4, 9, 3], [-2, 11, 4], [2, 10, 4], [0, 12, 3]]) {
    for (let k = 0; k <= h; k++) {
      const t = k / h;
      const x = Math.round(8 + dx * t);
      const y = 14 - Math.round(k * (1 - 0.25 * t * Math.abs(dx) / 6));
      g.set(x, y, 'moss', k === h ? s + 2 : s);
      if (k > 2 && k % 3 === 0 && Math.abs(dx) > 1) g.set(x + Math.sign(dx), y, 'moss', s + 1);
    }
  }
  // El corazón rojo de la roseta.
  for (const [x, y, s] of [[7, 12, 2], [8, 12, 3], [9, 12, 2], [8, 11, 4], [7, 13, 1], [8, 13, 2], [9, 13, 1]]) g.set(x, y, 'bromel', s);
  // Un hongo naranja al pie.
  for (const [x, y, s] of [[12, 13, 3], [13, 13, 4], [14, 13, 3], [12, 14, 1], [13, 14, 0]]) g.set(x, y, 'fungus', s);
  g.set(13, 15, 'bone', 1);
  for (let x = 4; x <= 12; x++) g.set(x, T - 1, 'litter', x % 2 ? 2 : 1);
  return g;
}

/** Piedra con musgo y dos hongos chicos (25). */
export function mossStoneCell() {
  const g = grid(T, T);
  const h = [0, 0, 2, 3, 4, 5, 5, 5, 5, 4, 4, 3, 2, 0, 0, 0];
  for (let x = 0; x < T; x++) {
    for (let k = 0; k < h[x]; k++) {
      const y = T - 1 - k;
      const top = k === h[x] - 1;
      g.set(x, y, top ? 'moss' : 'stone', top ? 4 : k === 0 ? 1 : x < 6 ? 4 : 3);
    }
  }
  for (const [x, y, s] of [[11, 10, 4], [12, 10, 3], [11, 11, 1], [3, 11, 3], [3, 12, 1]]) g.set(x, y, 'fungus', s);
  return g;
}

// ─── Pinceles (variantes y calcomanías) ────────────────────────────────────────────────────────────────────────────
/**
 * Raíz gruesa por los puntos `pts` (polilínea, de izquierda a derecha), de hasta `wmax` px de alto: se afina hacia las
 * puntas (`taper`: qué fracción del largo tarda en engrosar en cada extremo), con la luz arriba, la sombra abajo, la
 * corteza con rayitas y algún bulto, y la tierra oscura debajo. Sin puntas cuadradas.
 */
export function paintThickRoot(g, pts, wmax, rng, taper = [0.3, 0.3]) {
  const n = pts.length;
  const bumps = new Set(Array.from({ length: Math.floor(n / 9) }, () => irange(rng, 3, n - 4)));
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const a = Math.max(0, Math.min(1, t / taper[0], (1 - t) / taper[1]));
    const w = Math.max(1, Math.round(wmax * (0.3 + 0.7 * Math.sqrt(a))) + (bumps.has(i) ? 1 : 0));
    const [x, yc] = pts[i];
    const y = yc - Math.floor(w / 2);
    for (let d = 0; d < w; d++) {
      let s = w === 1 ? 2 : d === 0 ? 4 : d === w - 1 ? 1 : 3;
      if (w > 2 && d > 0 && d < w - 1 && (i * 7 + d * 3) % 8 === 0) s = 2;
      if (w > 3 && d === 1 && (i * 5) % 11 === 0) s = 5;
      g.set(x, y + d, 'root', s);
    }
    if (g.ramp(x, y + w) !== 'root') g.set(x, y + w, 'earth', 1);
    if (w > 2 && !g.opaque(x, y - 1)) g.set(x, y - 1, 'earth', 2);
  }
}

/** Raicilla que baja desde (x, y): fina, clara arriba, con alguna ramita. */
export function paintRootlet(g, x, y, len, rng, thick = false) {
  for (let k = 0; k < len; k++) {
    const w = thick && k < len * 0.45 ? 2 : 1;
    g.set(x, y, 'root', k === len - 1 ? 1 : w === 2 ? 4 : 3);
    if (w === 2) g.set(x + 1, y, 'root', 2);
    y++;
    const r = rng();
    if (r < 0.2) x--;
    else if (r > 0.8) x++;
    if (k > 2 && rng() < 0.16) {
      const d = rng() < 0.5 ? -1 : 1;
      for (let j = 1; j <= 3; j++) g.set(x + d * j, y + (j >> 1), 'root', j === 3 ? 1 : 2);
    }
  }
}

/** Piedra redondeada y mojada con su gorro de musgo: centro (cx, cy), radios (rx, ry). */
export function paintMossStone(g, cx, cy, rx, ry, mossy = true) {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = (x + 0.5 - cx) / rx;
      const dy = (y + 0.5 - cy) / ry;
      const d = dx * dx + dy * dy;
      if (d > 1) continue;
      // Luz arriba a la izquierda, sombra abajo a la derecha, contorno oscuro.
      const lit = -dx * 0.6 - dy * 0.9;
      let s = d > 0.78 ? 1 : lit > 0.55 ? 5 : lit > 0.1 ? 4 : lit > -0.4 ? 3 : 2;
      g.set(x, y, 'stone', s);
      if (mossy && dy < -0.25 - 0.25 * Math.abs(dx) && d <= 0.95) g.set(x, y, 'moss', dy < -0.7 ? 5 : d > 0.7 ? 2 : 3 + ((x + y) % 3 === 0 ? 1 : 0));
    }
  }
  // Brillo mojado y la sombra en la tierra debajo.
  g.set(Math.round(cx - rx * 0.35), Math.round(cy + ry * 0.05), 'stone', 6);
  for (let x = Math.ceil(cx - rx * 0.6); x <= Math.floor(cx + rx * 0.8); x++) {
    const y = Math.round(cy + ry) + 1;
    if (!g.opaque(x, y) || g.ramp(x, y) === 'earth') g.set(x, y, 'earth', 1);
  }
}

/** Hoja enterrada: una silueta oscura (humus) con su nervio, apretada en la tierra; `d`: hacia dónde apunta. */
export function paintBuriedLeaf(g, x, y, len, d = 1, ramp = 'humus') {
  for (let k = 0; k < len; k++) {
    const t = k / (len - 1);
    const half = Math.round(Math.sin(Math.PI * t) * 1.6);
    const px = x + d * k;
    const py = y + Math.round(t * 1.5);
    for (let j = -half; j <= half; j++) g.set(px, py + j, ramp, j === 0 ? 4 : j < 0 ? 3 : 2);
    g.set(px, py, ramp, 5);
  }
  g.set(x - d, y, ramp, 3); // el pecíolo
}

/** Semilla grande (de pindó): ovalada, fibrosa, con la luz arriba; `sprout`: con la raicilla y el brote. */
export function paintSeed(g, x, y, sprout = false) {
  const px = [[1, 0, 3], [2, 0, 3], [0, 1, 3], [1, 1, 4], [2, 1, 3], [3, 1, 2], [0, 2, 2], [1, 2, 3], [2, 2, 2], [3, 2, 1], [1, 3, 1], [2, 3, 1]];
  for (const [dx, dy, s] of px) g.set(x + dx, y + dy, 'seed', s);
  g.set(x + 1, y + 1, 'seed', 4);
  if (sprout) {
    // La raicilla blanca hacia abajo y el brote pálido hacia arriba.
    for (const [dx, dy] of [[2, 4], [2, 5], [3, 6], [3, 7]]) g.set(x + dx, y + dy, 'bone', 2);
    for (const [dx, dy, s] of [[1, -1, 2], [1, -2, 3], [0, -3, 3], [2, -3, 2]]) g.set(x + dx, y + dy, 'moss', s + 2);
  }
}

/** Lombriz en su galería: el túnel oscuro y el cuerpo rosado con anillos; `pts`, el recorrido. */
export function paintWorm(g, pts) {
  for (const [x, y] of pts) {
    for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) if (!g.opaque(x + dx, y + dy) || g.ramp(x + dx, y + dy) === 'earth') g.set(x + dx, y + dy, 'earth', 1);
  }
  for (const [x, y] of pts) if (g.ramp(x, y + 2) !== 'worm') g.set(x, y + 2, 'earth', 0);
  pts.forEach(([x, y], k) => g.set(x, y, 'worm', k === 0 ? 3 : k % 2 === 0 ? 1 : 2));
}

/** Escarabajo en su cámara: el hueco oscuro y el bicho negro azulado con su brillo y las patas. */
export function paintBeetle(g, x, y) {
  for (let yy = y - 2; yy <= y + 3; yy++) for (let xx = x - 3; xx <= x + 5; xx++) {
    const d = ((xx - x - 1) / 4.2) ** 2 + ((yy - y - 0.5) / 2.6) ** 2;
    if (d < 1) g.set(xx, yy, 'earth', d < 0.6 ? 0 : 1);
  }
  for (const [dx, dy, s] of [[0, 0, 2], [1, 0, 3], [2, 0, 2], [0, 1, 1], [1, 1, 2], [2, 1, 1], [3, 0, 1], [3, 1, 1]]) g.set(x + dx, y + dy, 'bug', s);
  g.set(1 + x, y, 'bug', 4);
  for (const [dx, dy] of [[0, 2], [2, 2], [-1, 1], [3, 2]]) g.set(x + dx, y + dy, 'bug', 0);
}

/** Galería de hormigas: el túnel, una cámara y tres hormigas (dos puntos rojizos cada una). */
export function paintAnts(g, pts) {
  for (const [x, y] of pts) g.set(x, y, 'earth', 0);
  for (const [x, y] of pts) if (g.opaque(x, y - 1) && g.ramp(x, y - 1) === 'earth' && g.step(x, y - 1) > 1) g.set(x, y - 1, 'earth', 4);
  for (const i of [2, Math.floor(pts.length / 2), pts.length - 3]) {
    const [x, y] = pts[i];
    g.set(x, y, 'ochre', 2);
    g.set(x + 1, y, 'ochre', 1);
  }
}

/** Grava de laterita: nódulos ocres redondeados (2 × 2, con la luz arriba y el contorno oscuro) a lo largo de una capa que ondula. */
export function paintLaterite(g, x0, x1, y0, thick, rng) {
  let x = x0;
  while (x <= x1 - 1) {
    const end = Math.min(x - x0, x1 - x);
    const wave = Math.round(Math.sin((x / 11) * Math.PI) * 1.5);
    const y = y0 + wave + irange(rng, -thick + 1, thick - 1);
    if (end < 3 && rng() < 0.5) {
      x += 2;
      continue;
    }
    const big = rng() < 0.45;
    const px = big
      ? [[0, 0, 3], [1, 0, 2], [-1, 1, 2], [0, 1, 2], [1, 1, 1], [2, 1, 0], [0, 2, 1], [1, 2, 0]]
      : [[0, 0, 3], [1, 0, 1], [0, 1, 1], [1, 1, 0]];
    for (const [dx, dy, st] of px) g.set(x + dx, y + dy, 'ochre', st);
    g.set(x + (big ? 2 : 1), y + (big ? 2 : 1) + 1, 'earth', 1);
    x += big ? irange(rng, 3, 5) : irange(rng, 2, 4);
  }
}

/** Manchón tramado (S113): tierra más húmeda (oscura) o más arcillosa (clara) en grumos, que deja ver la textura de abajo. */
export function paintPatch(g, cx, cy, rx, ry, light, seed) {
  for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++) {
    for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
      const d = Math.hypot((x - cx) / rx, (y - cy) / ry);
      const n = lump(x, y, seed);
      if (d > 0.75 + 0.35 * n) continue;
      if (bayer(x, y) > (d < 0.5 ? 0.62 : 0.32)) continue;
      g.set(x, y, 'earthm', light ? 2 : 0);
    }
  }
}
/** Ruido en grumos (0 a 1), para bordes que no salen en damero. */
function lump(x, y, seed) {
  const h = (ix, iy) => {
    let v = Math.imul(ix, 0x27d4eb2d) ^ Math.imul(iy, 0x165667b1) ^ Math.imul(seed, 0x85ebca6b);
    v ^= v >>> 15;
    v = Math.imul(v, 0x2c1b3c6d);
    v ^= v >>> 13;
    return (v >>> 0) / 4294967296;
  };
  const fx = x / 3;
  const fy = y / 3;
  const ix = Math.floor(fx);
  const iy = Math.floor(fy);
  const tx = fx - ix;
  const ty = fy - iy;
  const a = h(ix, iy) + (h(ix + 1, iy) - h(ix, iy)) * tx;
  const b = h(ix, iy + 1) + (h(ix + 1, iy + 1) - h(ix, iy + 1)) * tx;
  return a + (b - a) * ty;
}

/** Tronco enterrado (S113): un pedazo de rama vieja con la corteza, las vetas, el corte con sus anillos y un hongo. */
export function paintLog(g, x0, x1, y0, h) {
  for (let x = x0; x <= x1; x++) {
    for (let d = 0; d < h; d++) {
      const s = d === 0 ? 4 : d === h - 1 ? 0 : d === 1 ? 3 : (x * 3 + d) % 7 === 0 ? 1 : 2;
      g.set(x, y0 + d, 'bark', s);
    }
    g.set(x, y0 + h, 'earth', 1);
    if ((x * 5) % 9 === 0) g.set(x, y0 + 2, 'bark', 1);
  }
  // El corte (anillos claros) de la punta derecha y la corteza rota de la izquierda.
  for (let d = 1; d < h - 1; d++) {
    g.set(x1, y0 + d, 'wood', d === Math.floor(h / 2) ? 0 : 1);
    g.set(x1 - 1, y0 + d, 'wood', 2);
  }
  g.set(x0, y0, 'earth', 2);
  g.set(x0, y0 + h - 1, 'earth', 2);
  // Un hongo blanco que creció en la madera podrida.
  for (const [dx, dy, s] of [[0, 0, 2], [1, 0, 3], [2, 0, 2], [1, 1, 1]]) g.set(x0 + 5 + dx, y0 - 2 + dy, 'bone', s);
}

/** Micelio: hilos blancos finos que se abren, con dos cabecitas de hongo. */
export function paintMycelium(g, x, y, rng) {
  const tip = [];
  for (let b = 0; b < 4; b++) {
    let px = x;
    let py = y;
    const dx = b % 2 ? 1 : -1;
    const dy = b < 2 ? -1 : 1;
    for (let k = 0; k < 4 + Math.floor(rng() * 3); k++) {
      g.set(px, py, 'bone', k === 0 ? 2 : 1);
      if (rng() < 0.6) px += dx;
      if (rng() < 0.5) py += dy;
    }
    tip.push([px, py]);
  }
  for (const [px, py] of tip.slice(0, 2)) g.set(px, py, 'bone', 3);
}

// ─── Variantes ─────────────────────────────────────────────────────────────────────────────────────────────────────
const FILL_FEATURES = [
  [],
  [],
  [],
  [],
  ['damp'],
  ['dry'],
  ['pebbles'],
  ['fiber'],
  ['iron'],
  ['damp', 'fiber'],
  ['seedlet'],
  ['dry', 'pebbles'],
  ['leafbit'],
  ['charcoal'],
  ['damp', 'seedlet'],
  ['iron', 'pebbles'],
];

function paintFeature(g, kind, rng, lo = 3, hi = 12) {
  const c = () => irange(rng, lo + 1, hi - 1);
  switch (kind) {
    case 'damp':
    case 'dry': {
      // Mancha más húmeda (oscura) o más seca (clara), con el borde tramado: en medio tono, sin dibujar un cuadro.
      const x0 = irange(rng, lo + 2, hi - 2);
      const y0 = irange(rng, lo + 2, hi - 2);
      const rx = 2.5 + rng() * 2;
      const ry = 1.6 + rng();
      for (let y = Math.floor(y0 - ry - 1); y <= Math.ceil(y0 + ry + 1); y++) {
        for (let x = Math.floor(x0 - rx - 1); x <= Math.ceil(x0 + rx + 1); x++) {
          const d = Math.hypot((x - x0) / rx, (y - y0) / ry);
          if (d > 1 || g.ramp(x, y) !== 'earth' || g.step(x, y) !== EARTH) continue;
          if (d < 0.55 || bayer(x, y) > d) g.set(x, y, 'earthm', kind === 'dry' ? 1 : 0);
        }
      }
      break;
    }
    case 'pebbles':
      for (let k = 0; k < 3; k++) {
        const x = c();
        const y = c();
        g.set(x, y, 'stone', 3);
        g.set(x + 1, y, 'stone', 2);
        g.set(x, y + 1, 'stone', 1);
        g.set(x + 1, y + 1, 'earth', 1);
      }
      break;
    case 'fiber': {
      const x = irange(rng, lo, hi - 5);
      const y = c();
      for (let k = 0; k < 5; k++) g.set(x + k, y + (k > 1 ? 1 : 0) + (k > 3 ? 1 : 0), 'root', k === 0 || k === 4 ? 1 : 2);
      break;
    }
    case 'iron':
      for (const [dx, dy, s] of [[0, 0, 3], [1, 0, 2], [0, 1, 2], [1, 1, 1], [2, 1, 0]]) g.set(lo + 3 + dx + Math.floor(rng() * 4), lo + 3 + dy + Math.floor(rng() * 3), 'ochre', s);
      break;
    case 'seedlet': {
      const x = c();
      const y = c();
      for (const [dx, dy, s] of [[0, 0, 3], [1, 0, 2], [0, 1, 2], [1, 1, 1]]) g.set(x + dx, y + dy, 'seed', s);
      break;
    }
    case 'leafbit':
      paintBuriedLeaf(g, irange(rng, lo + 1, lo + 3), c(), 5, 1);
      break;
    case 'charcoal':
      for (const [dx, dy] of [[0, 0], [1, 0], [2, 1], [0, 1], [4, 2]]) g.set(lo + 4 + dx, lo + 4 + dy, 'humus', dx === 1 ? 2 : 0);
      break;
    case 'mycelium':
      paintMycelium(g, c(), c(), rng);
      break;
  }
}

/** Las 16 variantes del relleno (casilla 15). */
export function fillVariants(seed = 1132) {
  const rng = mulberry32(seed);
  const ref = baseEarth();
  return FILL_FEATURES.map((features) => {
    const g = baseEarth(irange(rng, 1, 1 << 30));
    for (const f of features) paintFeature(g, f, rng);
    return restoreSolidBands(g, ref, 15);
  });
}

/** Variantes de las casillas de borde de l5: 14 (piso), 11 (techo), 7 y 13 (paredes), la rama (17) y la piedra (22). */
export function edgeVariants(seed = 1133) {
  const rng = mulberry32(seed);
  const out = {};
  const vbase = () => baseEarth(irange(rng, 1, 1 << 30));
  // El piso: otra hojarasca, otros helechitos y musgo; algunas con un hongo, una semilla o una flor caída.
  const props = [null, 'mushroom', 'seed', null, 'flower', 'mushroom2', null, 'seed'];
  out[14] = props.map((prop) => {
    const topsoil = randomTopsoil(rng);
    const g = autotileCell(14, { base: vbase(), topsoil });
    paintFloorProp(g, prop, topsoil);
    return restoreSolidBands(g, autotileCell(14), 14);
  });
  // El techo: otras raicillas que cuelgan y otras muescas.
  const ceil = [
    { notch: { bottom: [1, 1, 0, 1, 2, 2, 1, 0, 1, 2, 2, 1, 0, 1, 1, 0] }, roots: [[1, 3], [5, 4], [9, 2], [14, 3]] },
    { notch: { bottom: [0, 1, 2, 1, 0, 1, 1, 2, 2, 1, 0, 1, 1, 0, 1, 1] }, roots: [[2, 4], [8, 3], [12, 4]] },
    { notch: { bottom: [1, 2, 1, 0, 1, 1, 0, 1, 2, 1, 1, 0, 1, 2, 1, 0] }, roots: [[6, 3], [11, 2]] },
  ];
  out[11] = ceil.map((v, k) => {
    const base = vbase();
    paintFeature(base, ['fiber', 'pebbles', 'damp'][k], rng, 4, 11);
    return restoreSolidBands(autotileCell(11, { base, ...v }), autotileCell(11), 11);
  });
  // Las paredes: otras muescas y raíces; una con un hongo de repisa pegado, otra con musgo.
  const walls = {
    7: [{ notch: { left: [0, 1, 1, 0, 1, 1, 2, 1, 0, 0, 0, 1, 0, 1, 1, 0] }, sideRoots: { left: [[3, 2], [9, 1]] } }, { notch: { left: [0, 0, 1, 0, 0, 1, 1, 0, 1, 2, 1, 1, 0, 0, 1, 0] }, sideRoots: { left: [[7, 2]] } }, { notch: { left: [0, 1, 0, 0, 1, 1, 0, 0, 0, 1, 1, 0, 0, 1, 0, 0] }, sideRoots: { left: [[11, 2]] } }],
    13: [{ notch: { right: [0, 0, 1, 1, 2, 1, 0, 0, 1, 0, 0, 1, 1, 0, 1, 0] }, sideRoots: { right: [[6, 2], [12, 1]] } }, { notch: { right: [0, 0, 1, 0, 0, 0, 1, 1, 2, 1, 0, 0, 1, 0, 1, 0] }, sideRoots: { right: [[2, 1]] } }, { notch: { right: [0, 1, 1, 0, 0, 1, 0, 0, 1, 1, 0, 0, 0, 1, 1, 0] }, sideRoots: { right: [[10, 2]] } }],
  };
  for (const mask of [7, 13]) {
    out[mask] = walls[mask].map((v, k) => {
      const base = vbase();
      paintFeature(base, ['pebbles', 'fiber', 'damp'][k], rng, 4, 11);
      const g = autotileCell(mask, { base, ...v });
      if (k === 0) paintBracket(g, mask === 7 ? 'left' : 'right', 7);
      if (k >= 1) paintWallMoss(g, mask === 7 ? 'left' : 'right', k === 1 ? 2 : 6);
      return restoreSolidBands(g, autotileCell(mask), mask);
    });
  }
  // La rama (17): otras grietas, el musgo en otro lugar; una con una bromelia, otra con liquen.
  const branchAlt = [
    { furrows: [[3, 0, 4], [4, 7, 12], [5, 3, 8], [2, 11, 15]], lichen: [[3, 4]], knot: [[12, 4]], moss: [[3, 8]], strands: [0, 1, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 1, 0, 0, 0] },
    { furrows: [[4, 1, 6], [3, 9, 14], [5, 8, 12]], lichen: [[10, 3], [2, 5]], knot: [], moss: [[0, 4], [7, 9]], strands: [0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 2, 0] },
    { furrows: [[2, 2, 6], [4, 4, 10], [5, 12, 15], [3, 11, 14]], lichen: [], knot: [[6, 4]], moss: [[0, 16]], strands: [1, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0] },
  ];
  out[17] = branchAlt.map((v) => restoreSolidBands(branchCell('center', v), branchCell('center'), LEFT | RIGHT));
  // La piedra que se rompe (22): otras grietas y otro musgo (la luz del tajo las sigue: `glow` en el JSON).
  out[22] = STONE_VARIANTS.map((cracks, k) => stoneCell(cracks, 1134 + k, STONE_MOSS_VARIANTS[k]));
  // El agua (l5 no tiene): otras rayas.
  out[20] = [1, 2].map((k) => waterCell('surface', 1140 + k));
  out[21] = [1, 2].map((k) => waterCell('body', 1150 + k));
  return out;
}

const inRing = (x) => x < RING || x >= T - RING;
/**
 * Una hojarasca distinta para una variante del piso: en el anillo de 2 px, la de la base (y enteras las hojas y el musgo
 * de la base que lo tocan); en el centro, otro filo, otro humus, otras hojas, otro musgo y otros helechitos.
 */
function randomTopsoil(rng) {
  const top = TOPSOIL.top.map((v, x) => (inRing(x) ? v : irange(rng, 1, 3)));
  for (let x = 1; x < T; x++) if (!inRing(x)) top[x] = Math.max(top[x - 1] - 1, Math.min(top[x - 1] + 1, top[x]));
  const litter = TOPSOIL.litter.map((v, x) => (inRing(x) ? v : top[x] + 3 + (rng() < 0.3 ? 1 : 0)));
  const phase = rng() * Math.PI * 2;
  const amp = 0.8 + rng() * 1.2;
  const humus = TOPSOIL.humus.map((v, x) => (inRing(x) ? v : Math.round(10.4 + amp * Math.sin(phase + x * 0.75))));
  const width = (shape) => Math.max(...LEAF_SHAPES[shape].map(([dx]) => dx)) + 1;
  const touches = (x, w) => Array.from({ length: w }, (_, k) => inRing(mod(x + k, T))).some(Boolean);
  const leaves = TOPSOIL.leaves.filter(([x, , shape]) => touches(x, width(shape)));
  const ramps = ['litter', 'litter', 'litter', 'leafred', 'moss', 'moss'];
  for (let k = 0; k < 8; k++) {
    const shape = irange(rng, 0, LEAF_SHAPES.length - 1);
    const x = irange(rng, RING, T - RING - width(shape));
    leaves.push([x, irange(rng, 1, 4), shape, ramps[Math.floor(rng() * ramps.length)], irange(rng, -1, 1)]);
  }
  leaves.sort((p, q) => q[1] - p[1]);
  const moss = TOPSOIL.moss.filter(([x, w]) => touches(x, w));
  for (let k = irange(rng, 1, 3); k > 0; k--) {
    const w = irange(rng, 2, 4);
    moss.push([irange(rng, RING, T - RING - w), w]);
  }
  const ferns = rng() < 0.6 ? [[irange(rng, 4, 11), rng() < 0.5 ? 1 : -1]] : [];
  const hairs = Array.from({ length: irange(rng, 1, 3) }, () => [irange(rng, RING, T - RING - 2), irange(rng, 6, 8), irange(rng, 2, 3), rng() < 0.5 ? 1 : -1]);
  return { ...TOPSOIL, top, litter, humus, leaves, moss, ferns, hairs };
}

/** Algo sobre la hojarasca de una variante del piso: un hongo, una semilla de pindó caída o una flor de lapacho. */
function paintFloorProp(g, kind, topsoil) {
  if (!kind) return;
  const tops = topsoil.top;
  if (kind === 'mushroom' || kind === 'mushroom2') {
    const x = kind === 'mushroom' ? 9 : 4;
    const y = tops[x] - 1;
    const cap = kind === 'mushroom' ? 'fungus' : 'bone';
    // El sombrero (2 × 3 px) con la luz arriba y el pie claro; en la fila 0 o 1, sobre el filo.
    for (const [dx, dy, s] of [[-1, 0, 2], [0, 0, 4], [1, 0, 3], [-1, 1, 1], [0, 1, 2], [1, 1, 1]]) g.set(x + dx, Math.max(0, y - 1 + dy), cap, s);
    g.set(x, Math.max(0, y - 1) + 2, 'bone', 2);
    if (kind === 'mushroom') {
      g.set(x + 3, tops[x + 3], 'fungus', 3);
      g.set(x + 3, tops[x + 3] + 1, 'bone', 1);
    }
  } else if (kind === 'seed') {
    const x = 6;
    const y = tops[x];
    for (const [dx, dy, s] of [[0, 0, 3], [1, 0, 4], [2, 0, 3], [0, 1, 2], [1, 1, 2], [2, 1, 1]]) g.set(x + dx, y + dy, 'seed', s);
  } else if (kind === 'flower') {
    // Una flor de lapacho caída: cuatro pétalos rosados y el centro amarillo.
    const x = 10;
    const y = tops[x];
    for (const [dx, dy, s] of [[0, 0, 3], [2, 0, 3], [1, -1, 4], [1, 1, 2]]) g.set(x + dx, Math.max(0, y + dy), 'bromel', s);
    g.set(x + 1, y, 'light', 3);
  }
}

/** Hongo de repisa (yesquero) pegado a la pared, de `side` (el aire), a la altura `y`. */
function paintBracket(g, side, y) {
  const fx = (x) => (side === 'left' ? x : T - 1 - x);
  for (const [x, dy, s] of [[0, 0, 4], [1, 0, 5], [2, 0, 4], [3, 0, 3], [0, 1, 2], [1, 1, 3], [2, 1, 2], [0, 2, 1], [1, 2, 1]]) g.set(fx(x), y + dy, 'fungus', s);
  g.set(fx(4), y + 1, 'earth', 1);
}

/** Musgo pegado a la pared: un manchón que baja, con la luz afuera. */
function paintWallMoss(g, side, y0) {
  const fx = (x) => (side === 'left' ? x : T - 1 - x);
  const w = [2, 3, 3, 2, 2, 1, 1];
  w.forEach((n, k) => {
    for (let x = 0; x < n; x++) {
      const px = fx(x + (g.opaque(fx(0), y0 + k) ? 0 : 1));
      if (g.opaque(px, y0 + k)) g.set(px, y0 + k, 'moss', x === 0 ? 4 : x === n - 1 ? 2 : 3);
    }
  });
}

const STONE_VARIANTS = [
  [
    [[5, 0], [4, 1], [4, 2], [5, 3], [5, 4], [4, 5], [4, 6]],
    [[0, 6], [1, 6], [2, 5], [3, 5], [4, 6], [5, 7], [6, 7], [7, 8], [8, 8]],
    [[8, 8], [9, 7], [10, 7], [11, 6], [12, 6], [13, 7], [14, 7], [15, 6]],
    [[11, 0], [12, 1], [12, 2], [11, 3], [11, 4], [11, 5], [11, 6]],
    [[7, 8], [6, 9], [6, 10], [5, 11], [5, 12], [5, 13], [5, 14], [5, 15]],
    [[13, 7], [13, 8], [12, 9], [12, 10], [11, 11], [11, 12], [11, 13], [11, 14], [11, 15]],
  ],
  [
    [[5, 0], [5, 1], [5, 2], [6, 3], [7, 4], [7, 5], [6, 6]],
    [[0, 6], [1, 7], [2, 7], [3, 7], [4, 6], [5, 6], [6, 6]],
    [[6, 6], [7, 7], [8, 7], [9, 6], [10, 6], [11, 5], [12, 5], [13, 6], [14, 6], [15, 6]],
    [[11, 0], [10, 1], [10, 2], [10, 3], [11, 4], [11, 5]],
    [[8, 7], [8, 8], [7, 9], [7, 10], [6, 11], [6, 12], [5, 13], [5, 14], [5, 15]],
    [[12, 5], [12, 6], [12, 7], [12, 8], [11, 9], [11, 10], [12, 11], [12, 12], [11, 13], [11, 14], [11, 15]],
  ],
];
const STONE_MOSS_VARIANTS = [
  [-1, 1, 2, 2, 1, -1, -1, -1, -1, 1, 1, -1, -1, -1, -1, -1],
  [-1, -1, -1, -1, -1, -1, 1, 2, 3, 2, 1, -1, -1, 1, 1, -1],
];

// ─── Calcomanías ───────────────────────────────────────────────────────────────────────────────────────────────────
/** Calcomanías: grillas transparentes de w × h casillas que se dibujan encima de la tierra. */
export function decals(seed = 1135) {
  const rng = mulberry32(seed);
  const out = {};
  const one = (fn, w = 1, h = 1) => {
    const g = grid(w * T, h * T);
    fn(g);
    return g;
  };
  const curve = (x0, x1, y0, amp, k) => Array.from({ length: x1 - x0 + 1 }, (_, i) => [x0 + i, y0 + Math.round(Math.sin(((i + k) / (x1 - x0)) * Math.PI * 1.3) * amp)]);
  // Raíces gruesas que cruzan la tierra: de tres y de dos casillas, una en diagonal de 2 × 2, con sus raicillas.
  out.root = [
    one((g) => {
      const pts = curve(1, 46, 7, 2, 0);
      paintThickRoot(g, pts, 4, rng);
      for (const i of [9, 22, 37]) paintRootlet(g, pts[i][0], pts[i][1] + 4, irange(rng, 4, 6), rng);
      paintRootlet(g, pts[30][0], pts[30][1] - 1, 3, rng);
    }, 3, 1),
    one((g) => {
      const pts = curve(1, 46, 8, 2, 7);
      paintThickRoot(g, pts, 3, rng);
      for (const i of [6, 18, 33, 41]) paintRootlet(g, pts[i][0], pts[i][1] + 3, irange(rng, 3, 5), rng);
    }, 3, 1),
    one((g) => {
      const pts = curve(1, 30, 7, 1, 3);
      paintThickRoot(g, pts, 3, rng);
      for (const i of [8, 21]) paintRootlet(g, pts[i][0], pts[i][1] + 3, irange(rng, 4, 6), rng);
    }, 2, 1),
    one((g) => {
      const pts = curve(1, 30, 8, 2, 11);
      paintThickRoot(g, pts, 4, rng);
      paintRootlet(g, pts[14][0], pts[14][1] + 4, 5, rng, true);
    }, 2, 1),
    one((g) => {
      // Una raíz que se abre en dos (2 × 2).
      const a = Array.from({ length: 30 }, (_, i) => [i + 1, 8 + Math.round(Math.sin(i / 6) * 1.5)]);
      paintThickRoot(g, a, 5, rng, [0.1, 0.4]);
      const b = Array.from({ length: 18 }, (_, i) => [12 + i, 9 + Math.round(i * 0.9 + Math.sin(i / 3))]);
      paintThickRoot(g, b, 3, rng, [0.05, 0.5]);
      for (const i of [5, 14]) paintRootlet(g, b[i][0], b[i][1] + 2, irange(rng, 3, 5), rng);
      paintRootlet(g, a[24][0], a[24][1] + 3, 4, rng);
    }, 2, 2),
    one((g) => {
      // En diagonal: baja de arriba a la izquierda a abajo a la derecha.
      const pts = Array.from({ length: 29 }, (_, i) => [i + 2, 3 + Math.round(i * 0.85 + Math.sin(i / 4) * 1.5)]);
      paintThickRoot(g, pts, 3, rng);
      for (const i of [7, 19]) paintRootlet(g, pts[i][0], pts[i][1] + 3, irange(rng, 3, 5), rng);
    }, 2, 2),
  ];
  // Piedras mojadas con musgo: sueltas, de a dos y una grande.
  out.stone = [
    one((g) => paintMossStone(g, 8, 8, 4.2, 3.2)),
    one((g) => {
      paintMossStone(g, 6, 7, 3.2, 2.6);
      paintMossStone(g, 11.5, 10.5, 2.2, 1.7, false);
    }),
    one((g) => paintMossStone(g, 8, 9, 5.4, 3.6)),
    one((g) => {
      paintMossStone(g, 12, 8, 6.5, 4.2);
      paintMossStone(g, 20, 10, 3.2, 2.4);
    }, 2, 1),
    one((g) => {
      paintMossStone(g, 15, 15, 10, 7.5);
      paintMossStone(g, 6, 24, 3.4, 2.6);
      paintMossStone(g, 25, 23, 2.4, 1.8, false);
    }, 2, 2),
  ];
  // Manchones tramados: tierra más húmeda o más arcillosa, grandes (cortan lo liso de las masas anchas).
  out.patch = [
    one((g) => paintPatch(g, 16, 16, 12, 9, false, 1), 2, 2),
    one((g) => paintPatch(g, 16, 8, 12, 5, true, 2), 2, 1),
    one((g) => paintPatch(g, 8, 8, 6, 4.5, false, 3)),
    one((g) => paintPatch(g, 15, 17, 11, 10, true, 4), 2, 2),
  ];
  // Un tronco viejo enterrado.
  out.log = [one((g) => paintLog(g, 3, 28, 8, 5), 2, 1), one((g) => paintLog(g, 2, 21, 6, 4), 2, 1)];
  // Hojas enterradas: sueltas y de a dos (oscuras, apretadas en la tierra).
  out.leaf = [
    one((g) => paintBuriedLeaf(g, 4, 6, 8, 1)),
    one((g) => {
      paintBuriedLeaf(g, 12, 5, 7, -1);
      paintBuriedLeaf(g, 5, 10, 6, 1, 'litter');
    }),
    one((g) => paintBuriedLeaf(g, 3, 8, 10, 1, 'leafred')),
  ];
  // Semillas: una de pindó, una que brota, unas chiquitas negras.
  out.seed = [
    one((g) => paintSeed(g, 6, 6)),
    one((g) => paintSeed(g, 6, 5, true)),
    one((g) => {
      for (const [x, y] of [[4, 8], [7, 6], [9, 9], [12, 7]]) {
        g.set(x, y, 'seed', 2);
        g.set(x + 1, y, 'seed', 1);
        g.set(x, y - 1, 'seed', 4);
      }
    }),
  ];
  // Bichos: lombrices en sus galerías, un escarabajo en su cámara y una galería de hormigas (2 × 1).
  out.bug = [
    one((g) => paintWorm(g, [[4, 6], [5, 6], [6, 7], [7, 7], [8, 8], [9, 8], [10, 8], [11, 7]])),
    one((g) => paintWorm(g, [[5, 10], [5, 9], [6, 8], [7, 7], [8, 7], [9, 6], [10, 6]])),
    one((g) => paintBeetle(g, 6, 7)),
    one((g) => paintAnts(g, [[2, 6], [3, 6], [4, 7], [5, 7], [6, 7], [7, 8], [8, 8], [9, 8], [10, 8], [11, 9], [12, 9], [13, 9], [14, 9], [15, 8], [16, 8], [17, 8], [18, 8], [19, 7], [20, 7], [21, 7], [22, 8], [23, 8], [24, 9], [25, 9], [26, 9], [27, 9], [28, 10], [29, 10]]), 2, 1),
  ];
  // Grava de laterita: capas ocres (3 × 1 y 2 × 1).
  out.laterite = [3, 2, 2].map((cols, k) => one((g) => paintLaterite(g, 2, cols * T - 3, 7 + k, k ? 2 : 3, rng), cols, 1));
  // Piedritas.
  out.pebble = [
    one((g) => {
      paintMossStone(g, 6, 8, 2.2, 1.6, false);
      paintMossStone(g, 10, 9.5, 1.5, 1.2, false);
      paintMossStone(g, 4, 11, 1.2, 1, false);
    }),
    one((g) => {
      paintMossStone(g, 9, 7, 1.8, 1.4, false);
      paintMossStone(g, 5.5, 10, 1.4, 1.1, false);
    }),
    one((g) => {
      paintMossStone(g, 7, 9, 2.6, 1.8, true);
      paintMossStone(g, 11.5, 7.5, 1.3, 1, false);
    }),
  ];
  // Raíces que bajan del humus del piso: largas (dos casillas hacia abajo) y raicillas.
  out.roots = [0, 1].map((k) =>
    one((g) => {
      paintRootlet(g, k ? 10 : 5, 10, k ? 18 : 20, rng, true);
      paintRootlet(g, k ? 4 : 12, 10, k ? 8 : 10, rng);
      if (k) paintRootlet(g, 14, 10, 5, rng);
    }, 1, 2),
  );
  out.rootlet = [0, 1].map((k) =>
    one((g) => {
      paintRootlet(g, k ? 11 : 4, 10, 6, rng);
      paintRootlet(g, k ? 6 : 9, 10, 4, rng);
    }),
  );
  // Raicillas que cuelgan en el aire debajo de una saliente (S113): arriba en la fila 0, finas, con la punta clara.
  const hang = (g, list) => {
    for (const [x, len, d] of list) {
      let px = x;
      for (let y = 0; y < len; y++) {
        g.set(px, y, 'root', y === len - 1 ? 4 : y < 2 ? 2 : 3);
        if (y > 2 && (y + x) % 4 === 0) px += d;
      }
    }
  };
  out.hang = [
    one((g) => hang(g, [[3, 9, 1], [8, 5, -1], [12, 11, -1]])),
    one((g) => hang(g, [[5, 12, 1], [10, 6, 1]])),
    one((g) => {
      hang(g, [[2, 6, 1], [7, 10, -1], [13, 7, 1]]);
      // Una hebra de musgo entre las raicillas.
      for (let y = 0; y < 5; y++) g.set(10, y, 'moss', y === 4 ? 1 : 3 - (y >> 1));
    }),
  ];
  // El musgo y un helechito que salen por las esquinas de arriba hacia el aire de al lado.
  const overhang = (g, flip) => {
    const fx = (x) => (flip ? T - 1 - x : x);
    for (const [cx, y0, y1] of [[15, 2, 9], [14, 3, 6], [13, 3, 4]]) {
      for (let y = y0; y <= y1; y++) g.set(fx(cx), y, 'moss', y === y1 ? 1 : y === y0 ? 5 : y < y0 + 2 ? 4 : 2);
    }
    // El helechito que se asoma, con la punta clara.
    for (const [x, y, s] of [[14, 2, 3], [13, 1, 4], [12, 1, 3], [12, 0, 5], [14, 1, 2]]) g.set(fx(x), y, 'fern', s);
    g.set(fx(15), 11, 'root', 3);
    g.set(fx(15), 12, 'root', 4);
  };
  out.overhangLeft = [one((g) => overhang(g, false))];
  out.overhangRight = [one((g) => overhang(g, true))];
  return out;
}

// ─── Las dos hojas ─────────────────────────────────────────────────────────────────────────────────────────────────
/** public/assets/tiles/selva.png: las 28 casillas de siempre (ASSETS §6). */
export function buildSelvaTileset() {
  const cells = [];
  for (let mask = 0; mask < 16; mask++) cells[mask] = mask === 15 ? baseEarth() : autotileCell(mask);
  cells[16] = branchCell('left');
  cells[17] = branchCell('center');
  cells[18] = branchCell('right');
  cells[19] = spikesCell();
  cells[20] = waterCell('surface');
  cells[21] = waterCell('body');
  cells[22] = stoneCell();
  cells[23] = fernCell();
  cells[24] = bromeliadCell();
  cells[25] = mossStoneCell();
  return buildTilesetImage(cells);
}

/**
 * public/assets/tiles/detalle/selva.png y su .json (S113): variantes del relleno, de los bordes, de la rama, de la piedra
 * y del agua, y calcomanías. Como el estero, el JSON trae `water.deep` y `glow` (casilla de la piedra → la luz de sus
 * grietas, para el brillo del tajo cargado).
 */
export function buildSelvaDetail() {
  const edges = edgeVariants();
  const deep = [0, 1, 2].map((k) => waterCell('deep', 1160 + k));
  const glows = { 22: stoneGlow(), ...Object.fromEntries(STONE_VARIANTS.map((c, k) => [`v${k}`, stoneGlow(c)])) };
  const sheet = buildDetailSheet({
    fill: fillVariants(),
    edges,
    decals: decals(),
    fixed: ['overhangLeft', 'overhangRight'],
    extra: { water: { deep }, glowTiles: glows },
  });
  const { layout } = sheet;
  const glow = { 22: layout.glowTiles[22] };
  layout.edges['22'].forEach((id, k) => (glow[`d${id}`] = layout.glowTiles[`v${k}`]));
  delete layout.glowTiles;
  layout.glow = glow;
  return sheet;
}

export const buildTileset = buildSelvaTileset;
export const buildDetail = buildSelvaDetail;
