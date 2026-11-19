// Tileset del estero (l2) dibujado por código (S110). Lo escribe tools/make-terrain-tiles.mjs (npm run terrain-tiles --
// estero); lo prueba tests/esteroTiles.test.ts. Lo común (azar, grilla, paleta, armado de las hojas) está en tile-art.mjs.
//
// La idea, como en cerro: un barro base de 16 × 16 que se repite sin costura en las dos direcciones (capas casi
// horizontales que ondulan 1 px, con tramos que aparecen y desaparecen, terrones y granos). Cada casilla del autotile
// parte de esa base y solo cambia los lados que dan al aire (pasto mojado y juncos arriba, barro que chorrea a los
// costados, raíces y gotas abajo). Cada tratamiento depende solo de la posición dentro de la casilla y es periódico a lo
// largo de su lado: dos casillas vecinas empalman siempre. Las variantes cambian solo el centro (de 2 a 13).
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

// ─── Paleta (medida en public/assets/backgrounds/l2_far.jpg; ver docs/ASSETS.md §6) ────────────────────────────────
// Barro: la orilla del primer plano (#0f0b0e, #181011, #1f1716, #2f2520, #42342b, #4e4132, #574838), un poco más clara
// en las luces porque el terreno va adelante. Arcilla: el violeta del agua del frente (#453f48, #534a57, #594f52,
// #735a64) apagado, para las capas húmedas. Atardecer: el reflejo del sol en el agua (#c47a5a, #e3874c, #f29e52,
// #fab460, #fccb70), en lo mojado. Pasto: el de la orilla (#2e3024, #3e4131, #494c36, #595c3d), más saturado. Junco y
// totora: los tallos y las espigas de la izquierda. Agua: el agua del frente (#2f282e … #665965) y, arriba, el rosado del
// lago (#866066, #9c7174). Camalote: las hojas (#2e3628 … #545b34) y la flor violeta (#59405c … #a47f9c).
export const RAMPS = {
  mud: ['#1b1214', '#2b1e1c', '#3b2c25', '#4c3a2f', '#614b3a', '#7c624a'],
  clay: ['#2b2229', '#3b3037', '#4c4045', '#5f5053', '#776466'],
  glow: ['#8e5643', '#c47a5a', '#e68e52', '#f8b866', '#fcd486'],
  grass: ['#181b13', '#262d1d', '#364226', '#485a2f', '#5f7539', '#7f9147'],
  reed: ['#2b2b1b', '#424428', '#5c5d33', '#7a793f', '#9e9853'],
  cattail: ['#2e1913', '#4d2a1d', '#6d3f28', '#8e5835'],
  shell: ['#4b3d3f', '#78645f', '#a68d7c', '#cfb69e', '#eedcc3'],
  wood: ['#1d140f', '#34241a', '#4e3624', '#6b4b31', '#8b6641', '#ac8456'],
  root: ['#22160f', '#392617', '#543923', '#714f33', '#8f6a46'],
  water: ['#2a2230', '#362c3f', '#45384f', '#56455e', '#6b556b', '#886777', '#ae8890'],
  leaf: ['#1e271c', '#2d3a26', '#3e4e2d', '#536436', '#6d7f43'],
  violet: ['#3a2a46', '#58405d', '#7b5b7f', '#a27e9d', '#c8a7c3'],
  thorn: ['#1b0f10', '#3d1d1c', '#622c26', '#8d4134'],
  shadow: ['#0b0709'],
};
export const PALETTE = makePalette(RAMPS);
const grid = (w, h) => new Grid(w, h, PALETTE);

// ─── El barro base ────────────────────────────────────────────────────────────────────────────────────────────────
/** Las capas: dos líneas por casilla (filas 4 y 12) que ondulan 1 px, la segunda a contrafase. */
const WAVE = [0, 0, 0, 1, 1, 1, 1, 1, 0, 0, 0, -1, -1, -1, -1, 0];
const LAYER_ROWS = [4, 12];
/** Tramos de cada línea a lo largo de la casilla (on, off, on, off…): suman 16. */
const LAYER_RUNS = [
  [11, 5],
  [2, 5, 9],
];

const lineY = (k, x) => LAYER_ROWS[k] + WAVE[mod(x + k * 8, T)];
function runOn(along, runs) {
  let s = mod(along, T);
  let on = true;
  for (const r of runs) {
    if (s < r) return on;
    s -= r;
    on = !on;
  }
  return on;
}

/**
 * El barro base (casilla 15): fondo en el tono 2; cada capa es una línea de arcilla oscura (tono 1) con un labio de
 * arcilla clara tramado debajo; terrones (un trazo claro arriba y su sombra) y granos de conchilla.
 * `layerOn(k, x, y)` deja a una variante prender o apagar tramos solo en el centro.
 */
// Terrones: alargados, la cara de arriba con luz (y un brillo a la izquierda), la de abajo en sombra. [dx, dy, tono].
const CLODS = [
  [[1, -1, 3], [2, -1, 3], [3, -1, 3], [0, 0, 4], [1, 0, 3], [2, 0, 3], [3, 0, 3], [4, 0, 2], [1, 1, 1], [2, 1, 1], [3, 1, 1], [4, 1, 1]],
  [[1, -1, 3], [0, 0, 4], [1, 0, 3], [2, 0, 2], [1, 1, 1], [2, 1, 1]],
  [[1, -1, 3], [2, -1, 3], [0, 0, 3], [1, 0, 3], [2, 0, 3], [3, 0, 2], [0, 1, 1], [1, 1, 1], [2, 1, 1], [3, 1, 1]],
  [[0, 0, 3], [1, 0, 3], [2, 0, 2], [1, 1, 1], [2, 1, 1]],
  [[1, -1, 3], [2, -1, 3], [0, 0, 4], [1, 0, 3], [2, 0, 3], [3, 0, 2], [1, 1, 1], [2, 1, 1], [3, 1, 1]],
];
// Poros húmedos (oscuros, de 1 o 2 px), granos de conchilla y algún grumo claro: [rampa, tono, largo].
const DOTS = [['mud', 1, 2], ['mud', 1, 1], ['mud', 0, 1], ['shell', 1, 1], ['mud', 3, 1], ['mud', 1, 2]];
const markPixels = (m) => (m.clod ? m.clod.map(([dx, dy, st]) => [dx, dy, 'mud', st]) : Array.from({ length: m.dot[2] }, (_, i) => [i, 0, m.dot[0], m.dot[1]]));
const touchesRing = (m) =>
  markPixels(m).some(([dx, dy]) => {
    const x = mod(m.x + dx, T);
    const y = mod(m.y + dy, T);
    return x < RING || y < RING || x >= T - RING || y >= T - RING;
  });

/** Pone terrones y granos donde haya barro liso y lejos de los otros; `wrap`: pueden cruzar el borde (la base). */
function scatter(g, rng, marks, { wrap }) {
  const placed = [];
  const at = (x, y) => (wrap ? [mod(x, T), mod(y, T)] : [x, y]);
  const free = (x, y) => {
    const [px, py] = at(x, y);
    if (!wrap && (px < RING || py < RING || px >= T - RING || py >= T - RING)) return false;
    return g.ramp(px, py) === 'mud' && g.step(px, py) === 2;
  };
  const near = (x, y) => {
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (!free(x + dx, y + dy) && !(dx === 0 && dy === 0)) return true;
    return false;
  };
  for (const kind of marks) {
    for (let tries = 0; tries < 300; tries++) {
      const m = { x: irange(rng, 0, T - 1), y: irange(rng, 0, T - 1), ...kind };
      const px = markPixels(m);
      if (!px.every(([dx, dy]) => free(m.x + dx, m.y + dy) && !near(m.x + dx, m.y + dy))) continue;
      for (const [dx, dy, ramp, st] of px) g.set(...at(m.x + dx, m.y + dy), ramp, st);
      placed.push(m);
      break;
    }
  }
  return placed;
}

const BASE_MARKS = [...CLODS.map((clod) => ({ clod })), ...DOTS.map((dot) => ({ dot }))];
const VARIANT_MARKS = [CLODS[0], CLODS[3], CLODS[1], CLODS[4]].map((clod) => ({ clod })).concat(DOTS.slice(0, 4).map((dot) => ({ dot })));

/** El barro liso con la veta de arcilla (tramos de `layerOn` o los de la base). */
function plainMud(layerOn) {
  const g = grid(T, T);
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) g.set(x, y, 'mud', 2);
  // Una veta de arcilla apenas marcada (1 px, en tramos): las capas grandes las ponen las lentes de la hoja de detalle.
  for (let x = 0; x < T; x++) {
    const y = mod(lineY(0, x), T);
    if (layerOn ? layerOn(0, x, y) : runOn(x, LAYER_RUNS[0])) g.set(x, y, 'clay', 1);
  }
  return g;
}

/** Los terrones y granos de la base: con vuelta, así la textura cruza los bordes de la casilla. */
const baseMarks = () => scatter(plainMud(null), mulberry32(110), BASE_MARKS, { wrap: true });

/**
 * El barro base (casilla 15): barro oscuro con una veta de arcilla tenue, terrones con luz arriba y sombra abajo, poros
 * y granos de conchilla, que cruzan el borde. Con `seed` distinta (una variante): los terrones de la base que tocan el
 * anillo de 2 px van igual, enteros, y los del centro son otros; `layerOn(k, x, y)` cambia los tramos de la veta.
 */
export function baseMud(seed = 110, layerOn = null) {
  const g = plainMud(layerOn);
  const marks = baseMarks();
  const draw = (m) => markPixels(m).forEach(([dx, dy, ramp, st]) => g.set(mod(m.x + dx, T), mod(m.y + dy, T), ramp, st));
  if (seed === 110) {
    marks.forEach(draw);
    return g;
  }
  marks.filter(touchesRing).forEach(draw);
  scatter(g, mulberry32(seed), VARIANT_MARKS, { wrap: false });
  return g;
}

// ─── Perfiles de los bordes (periódicos a lo largo de su lado) ─────────────────────────────────────────────────────
// Arriba: dónde empieza el pasto (top), dónde termina el colchón (bottom), las puntas, los tallos de junco y las matas
// mojadas que cuelgan delante del barro.
export const GRASS = {
  /** Fila donde empieza el colchón y donde termina, por columna. */
  top: [2, 2, 3, 2, 2, 3, 3, 2, 2, 3, 2, 2, 2, 3, 3, 2],
  bottom: [4, 5, 5, 4, 4, 5, 5, 5, 4, 4, 5, 5, 4, 4, 5, 5],
  /** Matas de briznas que suben del colchón: [x de la brizna, fila de la punta, inclinación]. */
  tufts: [[1, 1, 0], [2, 0, -1], [3, 1, 0], [4, 0, 1], [9, 1, -1], [10, 0, 0], [11, 0, 1], [12, 1, 1], [14, 1, 0]],
  /** Tallos de junco que salen del colchón: [x, fila de la punta]. */
  reeds: [[7, 0]],
  /** Luz del atardecer en una punta (columnas). */
  rim: [10],
  drapes: [[3, 8], [6, 7], [11, 9], [14, 7]],
  side: [9, 6],
};
export const NOTCH = {
  left: [0, 1, 1, 0, 0, 0, 1, 0, 0, 0, 0, 1, 1, 0, 0, 0],
  right: [0, 0, 1, 0, 0, 1, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0],
  // Abajo: muescas y gotas de barro (las columnas en 0 entre dos hondas cuelgan como un goterón).
  bottom: [1, 0, 1, 2, 1, 0, 0, 1, 2, 2, 1, 0, 1, 1, 0, 1],
};
/** Chorreaduras que bajan por los costados: [fila donde arrancan, largo]. */
export const SIDE_DRIPS = { left: [[4, 4], [10, 3]], right: [[2, 3], [8, 5]] };
/** Raíces que asoman por abajo (techo): [x, largo]. */
export const CEIL_ROOTS = [[5, 3], [12, 2]];

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
    const cur = g.ramp(x, y) === 'mud' ? g.step(x, y) : 2;
    if (s === 9) g.set(x, y, 'mud', Math.max(cur, 4));
    else g.set(x, y, 'mud', Math.min(cur, s));
  }
}

/**
 * Una casilla del autotile (máscara: vecinos sólidos arriba 1, derecha 2, abajo 4, izquierda 8). `variant` cambia el
 * centro: { base, grass, notch, drips, roots } (lo que toca un borde sólido tiene que ser igual a la base).
 */
export function autotileCell(mask, variant = {}) {
  const g = (variant.base ?? baseMud()).clone();
  const air = { up: !(mask & UP), right: !(mask & RIGHT), down: !(mask & DOWN), left: !(mask & LEFT) };
  const grass = { ...GRASS, ...(variant.grass ?? {}) };
  const notch = { ...NOTCH, ...(variant.notch ?? {}) };
  const drips = { ...SIDE_DRIPS, ...(variant.drips ?? {}) };
  const roots = variant.roots ?? CEIL_ROOTS;

  // 1. Silueta: muescas en los costados, goterones abajo, esquinas gastadas.
  if (air.left) for (let y = 0; y < T; y++) for (let x = 0; x < notch.left[y]; x++) g.clear(x, y);
  if (air.right) for (let y = 0; y < T; y++) for (let x = 0; x < notch.right[y]; x++) g.clear(T - 1 - x, y);
  if (air.down) for (let x = 0; x < T; x++) for (let y = 0; y < notch.bottom[x]; y++) g.clear(x, T - 1 - y);
  const chamfer = [3, 2, 1];
  if (air.down && air.left) for (let y = 0; y < 3; y++) for (let x = 0; x < chamfer[y]; x++) g.clear(x, T - 1 - y);
  if (air.down && air.right) for (let y = 0; y < 3; y++) for (let x = 0; x < chamfer[y]; x++) g.clear(T - 1 - x, T - 1 - y);
  if (air.up && air.left) for (const [x, y] of [[0, 0], [1, 0], [0, 1], [0, 2], [2, 0], [1, 1]]) g.clear(x, y);
  if (air.up && air.right) for (const [x, y] of [[15, 0], [14, 0], [15, 1], [15, 2], [13, 0], [14, 1]]) g.clear(x, y);

  // 2. Contorno, sombra y filo claro.
  shadeEdges(g, air);

  // 3. Chorreaduras de barro mojado por los costados (un hilo oscuro con brillo cálido) y raíces que asoman abajo.
  const drip = (pts) => {
    pts.forEach(([x, y], k) => {
      if (!g.opaque(x, y)) return;
      g.set(x, y, 'mud', k === pts.length - 1 ? 1 : 0);
    });
    const [hx, hy] = pts[0];
    if (g.opaque(hx, hy)) g.set(hx, hy, 'clay', 3);
  };
  if (air.left) for (const [y0, len] of drips.left) drip(Array.from({ length: len }, (_, k) => [notch.left[y0 + k] ?? 0, y0 + k]));
  if (air.right) for (const [y0, len] of drips.right) drip(Array.from({ length: len }, (_, k) => [T - 1 - (notch.right[y0 + k] ?? 0), y0 + k]));
  if (air.down) {
    for (const [x0, len] of roots) {
      for (let k = 0; k < len; k++) {
        const y = T - 1 - notch.bottom[x0] - (len - 1 - k);
        const x = x0 + (k > len / 2 ? 1 : 0);
        if (!g.in(x, y)) continue;
        g.set(x, y, 'root', k === len - 1 ? 0 : 1);
      }
    }
  }

  // 4. El pasto mojado y los juncos de arriba, que desbordan el filo y cuelgan delante del barro (bajo el agua, algas).
  if (air.up) (variant.submerged ? paintWeedTop : paintGrassTop)(g, grass, air);
  return g;
}

/** El fondo bajo el agua (S110): limo claro y algas oscuras que ondulan, sin pasto ni juncos. */
function paintWeedTop(g, grass, air) {
  for (let x = 0; x < T; x++) {
    const h = grass.top[x];
    for (let y = 0; y < h; y++) g.clear(x, y);
    g.set(x, h, 'clay', (x * 3) % 5 ? 2 : 3);
    g.set(x, h + 1, 'mud', (x * 7) % 4 ? 2 : 1);
    if (g.opaque(x, h + 2)) g.set(x, h + 2, 'mud', 1);
  }
  for (const [x, tip, lean] of grass.tufts) {
    if ((air.left && x < 2) || (air.right && x > T - 3)) continue;
    for (let y = tip; y < grass.top[x]; y++) {
      const px = x + ((y - tip) % 3 === 1 ? lean : 0);
      g.set(px, y, 'leaf', y === tip ? 2 : 1);
    }
  }
}

function paintGrassTop(g, grass, air) {
  const top = [...grass.top];
  const bottom = [...grass.bottom];
  if (air.left) {
    top[0] = Math.max(top[0], 3);
    top[1] = Math.max(top[1], 2);
  }
  if (air.right) {
    top[T - 1] = Math.max(top[T - 1], 3);
    top[T - 2] = Math.max(top[T - 2], 2);
  }
  for (let x = 0; x < T; x++) {
    for (let y = 0; y < top[x]; y++) g.clear(x, y);
    // El barro bajo el colchón: mojado (más oscuro) y con algún brillo del cielo.
    const b = bottom[x];
    if (g.opaque(x, b + 1)) g.set(x, b + 1, 'mud', Math.min(g.ramp(x, b + 1) === 'mud' ? g.step(x, b + 1) : 1, 1));
    if (g.opaque(x, b + 2) && x % 2 === 1) g.set(x, b + 2, 'mud', 1);
    // Brillo mojado del barro, apenas.
    if (g.opaque(x, b + 3) && (x === 5 || x === 12)) g.set(x, b + 3, 'mud', 4);
  }
  for (let x = 0; x < T; x++) {
    const h = top[x];
    const b = bottom[x];
    for (let y = h; y <= b; y++) {
      // Colchón: la luz arriba, el verde en el medio con briznas más claras, la base húmeda y oscura.
      let step = y === h ? 4 : y === h + 1 ? 3 : y === b ? 1 : 2;
      if (step === 2 && (x * 5 + y * 3) % 7 === 0) step = 3;
      if (step === 2 && (x * 3 + y * 2) % 9 === 0) step = 1;
      if (step === 4 && (x * 3 + y) % 5 === 0) step = 5;
      g.set(x, y, 'grass', step);
    }
  }
  const skip = (x) => (air.left && x < 2) || (air.right && x > T - 3);
  // Las matas: cada brizna sube de la punta del colchón, se inclina en la mitad de arriba; la punta, clara.
  for (const [x, tip, lean] of grass.tufts) {
    if (skip(x)) continue;
    const base = top[x];
    for (let y = tip; y < base; y++) {
      const px = x + (y - tip < (base - tip) / 2 ? lean : 0);
      if (px < 0 || px > T - 1) continue;
      g.set(px, y, 'grass', y === tip ? 5 : 4);
    }
  }
  // Tallos de junco: amarillos, de la punta (clara) al colchón.
  for (const [x, tip] of grass.reeds) {
    if (skip(x)) continue;
    for (let y = tip; y <= top[x] + 1; y++) g.set(x, y, 'reed', y === tip ? 4 : y < tip + 2 ? 3 : 2);
  }
  // Luz del atardecer en una punta.
  for (const x of grass.rim) {
    if (skip(x)) continue;
    const tip = grass.tufts.find(([bx]) => bx === x)?.[1] ?? top[x];
    g.set(x, tip, 'glow', 2);
  }
  // Matas mojadas que cuelgan delante del barro, con su sombra.
  for (const [x, end] of grass.drapes) {
    if (skip(x)) continue;
    for (let y = bottom[x] + 1; y <= end; y++) g.set(x, y, 'grass', y === end ? 1 : y === bottom[x] + 1 ? 3 : 2);
    if (g.opaque(x, end + 1)) g.set(x, end + 1, 'mud', 0);
    if (g.opaque(x + 1, end)) g.set(x + 1, end, 'mud', 1);
  }
  // En las esquinas el pasto baja por el costado.
  const side = (x, depth, outer) => {
    for (let y = top[x]; y <= depth; y++) g.set(x, y, 'grass', y === depth ? 1 : outer ? (y < top[x] + 2 ? 4 : 2) : 3);
  };
  if (air.left) {
    side(0, grass.side[0], true);
    side(1, grass.side[1], false);
  }
  if (air.right) {
    side(T - 1, grass.side[0] - 1, true);
    side(T - 2, grass.side[1] + 1, false);
  }
}

// ─── Plataforma: tablón de palma con grosor y sombra debajo (la colisión sigue en la fila 0) ───────────────────────
// Las balsas (plataformas móviles, S57) toman las 6 filas de arriba y repiten la última en sombra.
export const PLANK = {
  /** Vetas: [fila, desde, hasta] en tono 2. */
  grain: [[2, 1, 6], [3, 9, 14], [4, 3, 8], [2, 11, 13]],
  /** Atadura de fibra de junco (columnas). */
  ties: [4],
  /** Clavo de madera (x, y). */
  pegs: [[11, 3]],
  /** Pasto mojado sobre el canto: [desde, ancho]. */
  grass: [[8, 3]],
  /** Astillas que cuelgan del canto de abajo (1: una fila más). */
  chips: [0, 0, 1, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 1, 0],
  /** Brillo mojado del atardecer en el filo. */
  wet: [13],
};

export function plankCell(kind /* 'left' | 'center' | 'right' */, variant = {}) {
  const v = { ...PLANK, ...variant };
  const g = grid(T, T);
  const SLAB = 7; // filas 0 a 6: el tablón; 7: el canto (con astillas a la 8); 8 y 9: sombra
  for (let x = 0; x < T; x++) {
    for (let y = 0; y < SLAB; y++) {
      const step = y === 0 ? 5 : y === 1 ? 4 : y === SLAB - 1 ? 1 : y === SLAB - 2 ? 2 : 3;
      g.set(x, y, 'wood', step);
    }
    g.set(x, SLAB, 'wood', 0);
    if (v.chips[x]) g.set(x, SLAB + 1, 'wood', 0);
    const s0 = SLAB + 1 + v.chips[x];
    g.set(x, s0, 'shadow', 0, 120);
    g.set(x, s0 + 1, 'shadow', 0, 50);
  }
  // Vetas de la madera, con un nudo.
  for (const [y, x0, x1] of v.grain) for (let x = x0; x <= x1; x++) g.set(x, y, 'wood', (x + y) % 5 === 0 ? 3 : 2);
  // Atadura: tres vueltas de fibra que abrazan el tablón (clara arriba, sombra al costado).
  for (const x of v.ties) {
    for (let y = 0; y < SLAB; y++) {
      g.set(x, y, 'reed', y === 0 ? 4 : y % 2 ? 2 : 3);
      g.set(x + 1, y, 'reed', y === 0 ? 3 : y % 2 ? 1 : 2);
    }
    g.set(x + 2, 1, 'wood', 1);
    g.set(x + 2, 3, 'wood', 1);
  }
  for (const [x, y] of v.pegs) {
    g.set(x, y, 'wood', 0);
    g.set(x + 1, y, 'wood', 4);
  }
  for (const [x0, w] of v.grass) {
    for (let k = 0; k < w; k++) {
      g.set(x0 + k, 0, 'grass', k === 1 ? 4 : 3);
      if (k !== 1) g.set(x0 + k, 1, 'grass', 2);
    }
    g.set(x0 + 1, 2, 'grass', 1);
  }
  for (const x of v.wet) g.set(x, 0, 'glow', 3);
  // Los extremos: el corte de la madera con sus anillos.
  if (kind === 'left') {
    for (const y of [0, 6, 7, 8, 9, 10]) g.clear(0, y);
    for (const y of [8, 9, 10]) g.clear(1, y);
    g.set(1, 7, 'wood', 0);
    for (let y = 1; y < 6; y++) g.set(0, y, 'wood', y === 1 ? 2 : 1);
    for (let y = 1; y < 6; y++) g.set(1, y, 'wood', y === 3 ? 2 : 4);
    g.set(2, 3, 'wood', 1);
    g.set(1, 0, 'wood', 4);
    g.set(1, 8, 'shadow', 0, 60);
  }
  if (kind === 'right') {
    for (const y of [0, 6, 7, 8, 9, 10]) g.clear(15, y);
    for (const y of [8, 9, 10]) g.clear(14, y);
    g.set(14, 7, 'wood', 0);
    for (let y = 1; y < 6; y++) g.set(15, y, 'wood', 0);
    for (let y = 1; y < 6; y++) g.set(14, y, 'wood', y === 3 ? 1 : 2);
    g.set(13, 3, 'wood', 1);
    g.set(14, 8, 'shadow', 0, 60);
  }
  return g;
}

// ─── Espinas: ramas de espinillo con espinas largas y claras ───────────────────────────────────────────────────────
// El espinillo (aromita) del estero tiene espinas blancas de a pares: ramas oscuras que suben de una mata de barro, con
// espinas largas que apuntan arriba y afuera; las puntas, casi blancas y con la luz del atardecer.
export function spikesCell() {
  const g = grid(T, T);
  // [x de la base, x de la punta, alto]: de atrás para adelante.
  const stems = [[4, 2, 12], [11, 13, 11], [8, 8, 14]];
  const thorns = [];
  for (const [bx, tx, h] of stems) {
    for (let k = 0; k < h; k++) {
      const t = k / (h - 1);
      const x = Math.round(bx + (tx - bx) * t * t);
      const y = T - 2 - k;
      g.set(x, y, 'thorn', k === h - 1 ? 3 : k > h * 0.6 ? 2 : 1);
      if (k < h * 0.5) g.set(x + 1, y, 'thorn', 0);
      if (k === 3 || k === 7) thorns.push([x, y, -1, 4], [x + (k < h * 0.5 ? 1 : 0), y, 1, 4]);
    }
    thorns.push([tx, T - 1 - h, 0, 2]);
  }
  for (const [x, y, d, len] of thorns) {
    const pts = d === 0 ? Array.from({ length: len }, (_, i) => [x, y - i]) : Array.from({ length: len }, (_, i) => [x + d * (i + 1), y - Math.floor((i + 1) * 0.75)]);
    pts.forEach(([px, py], i) => {
      if (!g.in(px, py)) return;
      const tip = i === pts.length - 1;
      g.set(px, py, tip ? 'shell' : 'shell', tip ? 4 : i === 0 ? 1 : 3);
    });
    // La sombra debajo de cada espina la despega de la rama.
    for (const [px, py] of pts.slice(0, -1)) if (g.in(px, py + 1) && !g.opaque(px, py + 1)) g.set(px, py + 1, 'thorn', 0);
    const [ex, ey] = pts[pts.length - 1];
    if (d !== 0 && g.in(ex + d, ey - 1)) g.set(ex + d, ey - 1, 'glow', 3);
  }
  // Mata de barro en el pie.
  for (let x = 0; x < T; x++) {
    g.set(x, T - 1, 'mud', x % 3 === 0 ? 1 : 2);
    if ((x * 7) % 5 < 3) g.set(x, T - 2, 'mud', x % 2 ? 3 : 2);
  }
  return g;
}

// ─── Agua del estero: violeta del frente con el reflejo del atardecer, más honda hacia abajo ────────────────────────
// El color baja en tres casillas: la superficie (20, con la línea de luz), el cuerpo (21) y el fondo (en la hoja de
// detalle), que se repite sola hacia abajo. Las rayas cálidas son el cielo reflejado: muchas arriba, pocas abajo.
export const WATER_ALPHA = { surface: 232, body: 240, deep: 248 };
/** Ondas de la superficie: fila de la línea de luz por columna (0 o 1). */
const CREST = [1, 1, 0, 0, 1, 1, 1, 0, 1, 1, 1, 1, 0, 0, 1, 1];

function streaks(g, rng, rows, count, ramp, steps, alpha, avoid = [], minLen = 2, maxLen = 4) {
  for (let n = 0, tries = 0; n < count && tries < 200; tries++) {
    const y = rows[Math.floor(rng() * rows.length)];
    const len = irange(rng, minLen, maxLen);
    const x0 = irange(rng, 0, T - 1);
    if (avoid.some(([ay, ax]) => ay === y && Math.abs(mod(ax - x0, T)) < 6)) continue;
    avoid.push([y, x0]);
    n++;
    for (let k = 0; k < len; k++) g.set(mod(x0 + k, T), y, ramp, steps[Math.min(steps.length - 1, k === 0 || k === len - 1 ? 0 : 1)], alpha);
  }
}

export function waterCell(kind /* 'surface' | 'body' | 'deep' */, seed = 1100) {
  const rng = mulberry32(seed);
  const g = grid(T, T);
  const a = WATER_ALPHA[kind];
  // El color baja en franjas que se mezclan en sus bordes con píxeles sueltos (sin damero), también entre casillas:
  // superficie 5 → 4, cuerpo 4 → 3 → 2, fondo 2 (con poros del 1). Fila → tono, y la mezcla con el de arriba.
  const bands = { surface: [[0, 5], [8, 4]], body: [[0, 4], [5, 3], [11, 2]], deep: [[0, 2]] }[kind];
  const toneAt = (y) => bands.filter(([from]) => y >= from).at(-1)[1];
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) g.set(x, y, 'water', toneAt(y), a);
  const mix = (y, tone, p) => {
    for (let x = 0; x < T; x++) if (rng() < p) g.set(x, y, 'water', tone, a);
  };
  for (const [from, tone] of bands) {
    if (from === 0) continue;
    const prev = toneAt(from - 1);
    mix(from, prev, 0.35);
    mix(from + 1, prev, 0.12);
    mix(from - 1, tone, 0.25);
  }
  // El borde con la casilla de arriba (el cuerpo bajo la superficie; el fondo bajo el cuerpo o bajo otro fondo).
  if (kind === 'body') {
    mix(0, 5, 0.12);
  }
  if (kind === 'surface') {
    mix(14, 3, 0.1);
    mix(15, 3, 0.25);
    // La línea de luz sobre la ondulación, con tramos dorados al azar; arriba, el aire.
    let gold = rng() < 0.5 ? irange(rng, 1, 3) : 0;
    for (let x = 0; x < T; x++) {
      const c = CREST[x];
      for (let y = 0; y < c; y++) g.clear(x, y);
      if (gold === 0 && rng() < 0.1) gold = irange(rng, 1, 3);
      g.set(x, c, gold > 0 ? 'glow' : 'water', gold > 0 ? 3 : 6, 255);
      g.set(x, c + 1, gold > 0 ? 'glow' : 'water', gold > 0 ? 1 : 5, a);
      if (gold > 0) gold--;
    }
    streaks(g, rng, [4, 6, 9, 11], 1, 'glow', [0, 0], a, [], 3, 6);
  } else if (kind === 'body') {
    mix(15, 1, 0.15);
    streaks(g, rng, [3, 7, 12], 1, 'water', [4, 4], a, [], 3, 5);
  } else {
    mix(0, 3, 0.05);
    for (let y = 0; y < T; y++) mix(y, 1, 0.05);
    streaks(g, rng, [3, 8, 13], 1, 'water', [3, 3], a, [], 2, 4);
  }
  return g;
}

// ─── Barro seco que se rompe: más claro, partido en polígonos por grietas hondas ──────────────────────────────────
/** Las grietas (polilíneas de píxeles) del barro seco; la luz del tajo las recorre (hoja de detalle, `glow`). */
const DRY_CRACKS = [
  [[0, 5], [1, 5], [2, 6], [3, 6], [4, 6], [5, 5], [6, 5], [7, 4], [8, 4]],
  [[8, 4], [8, 3], [9, 2], [9, 1], [9, 0]],
  [[8, 4], [9, 5], [10, 6], [11, 6], [12, 7], [13, 7], [14, 7], [15, 6]],
  [[4, 6], [4, 7], [4, 8], [5, 9], [5, 10], [6, 11], [6, 12], [7, 13], [7, 14], [7, 15]],
  [[12, 7], [12, 8], [12, 9], [11, 10], [11, 11], [12, 12], [13, 13], [14, 13], [15, 13]],
  [[5, 10], [4, 11], [3, 11], [2, 12], [1, 12], [0, 12]],
  [[7, 14], [8, 14], [9, 13], [10, 13], [11, 12]],
];

export function dryMudCell(cracks = DRY_CRACKS, seed = 1101) {
  const rng = mulberry32(seed);
  const g = grid(T, T);
  // Placas de barro seco: claro y apagado, un poco más claro en el centro de cada placa (curvadas al secarse).
  const isCrack = new Set(cracks.flat().map(([x, y]) => `${x},${y}`));
  for (let y = 0; y < T; y++) {
    for (let x = 0; x < T; x++) {
      let step = 4;
      if ((x * 7 + y * 3) % 11 === 0) step = 3;
      if (rng() < 0.06) step = 5;
      g.set(x, y, 'mud', step);
    }
  }
  // Las grietas: honda (tono 0), con el labio claro arriba a la izquierda y la sombra abajo a la derecha.
  for (const line of cracks) for (const [x, y] of line) g.set(x, y, 'mud', 0);
  for (const line of cracks) {
    for (const [x, y] of line) {
      if (g.in(x - 1, y - 1) && !isCrack.has(`${x - 1},${y - 1}`)) g.set(x - 1, y - 1, 'mud', 5);
      if (g.in(x + 1, y) && !isCrack.has(`${x + 1},${y}`)) g.set(x + 1, y, 'mud', 2);
      if (g.in(x, y + 1) && !isCrack.has(`${x},${y + 1}`)) g.set(x, y + 1, 'mud', 3);
    }
  }
  return g;
}

/** La luz que corre por las grietas del barro seco (solo esos píxeles, blancos: el juego le pone el color). */
export function dryMudGlow(cracks = DRY_CRACKS) {
  const g = grid(T, T);
  for (const line of cracks) for (const [x, y] of line) g.set(x, y, 'shell', 4);
  return g;
}

// ─── Decoración del borde (casillas 23 a 25), apoyada abajo ───────────────────────────────────────────────────────
export function grassTuftCell() {
  const g = grid(T, T);
  // [x, alto, inclinación] — pasto mojado de la orilla, con la luz en las puntas.
  const blades = [[2, 5, -1], [4, 8, 0], [5, 6, 1], [7, 10, 0], [8, 7, -1], [10, 9, 1], [11, 5, 0], [13, 6, 1]];
  for (const [x, h, lean] of blades) {
    for (let k = 0; k < h; k++) {
      const px = x + (k > h / 2 ? lean : 0) + (k > h * 0.8 ? lean : 0);
      g.set(px, T - 1 - k, 'grass', k === h - 1 ? 5 : k > h / 2 ? 4 : k < 2 ? 2 : 3);
    }
    if (h === 10) g.set(x + lean * 2, T - h, 'glow', 1);
  }
  for (let x = 3; x <= 12; x++) g.set(x, T - 1, 'grass', 1);
  return g;
}

/** Junco con espiga de totora: tallos amarillos, hojas finas y dos espigas marrones (junto al agua). */
export function reedsCell() {
  const g = grid(T, T);
  const stems = [[5, 15, 0], [10, 13, 1], [8, 9, -1]];
  for (const [x, h, lean] of stems) {
    for (let k = 0; k < h; k++) {
      const px = x + (k > h * 0.6 ? lean : 0);
      g.set(px, T - 1 - k, 'reed', k === h - 1 ? 4 : k < 3 ? 1 : 2);
    }
  }
  // Espigas: 2 × 4 px, con la luz a la izquierda.
  for (const [x, y] of [[5, 2], [11, 4]]) {
    for (let k = 0; k < 4; k++) {
      g.set(x - 1, y + k, 'cattail', k === 0 ? 2 : 1);
      g.set(x, y + k, 'cattail', k === 0 ? 3 : 2);
    }
    g.set(x - 1, y, 'glow', 1);
  }
  // Hojas finas que se arquean.
  for (const [x0, len, d] of [[4, 7, -1], [9, 6, 1], [6, 5, 1]]) {
    for (let k = 0; k < len; k++) g.set(x0 + Math.round((d * k * k) / 10), T - 2 - k, 'grass', k === len - 1 ? 4 : 3);
  }
  for (let x = 4; x <= 11; x++) g.set(x, T - 1, 'grass', 1);
  return g;
}

/** Montoncito de barro con un caracol. */
export function moundCell() {
  const g = grid(T, T);
  const h = [0, 0, 1, 2, 3, 3, 4, 4, 4, 3, 3, 2, 2, 1, 0, 0];
  for (let x = 0; x < T; x++) {
    for (let k = 0; k < h[x]; k++) g.set(x, T - 1 - k, 'mud', k === h[x] - 1 ? 4 : k === 0 ? 1 : 3);
  }
  paintShell(g, 9, 10, false);
  return g;
}

// ─── Pinceles (variantes y calcomanías) ────────────────────────────────────────────────────────────────────────────
/** Caracol (ampularia): espiral de 3 o 4 px, clara, con la boca oscura; `small`, una conchita de 2 px. */
export function paintShell(g, x, y, flip = false, small = false) {
  const d = flip ? -1 : 1;
  if (small) {
    g.set(x, y, 'shell', 3);
    g.set(x + d, y, 'shell', 2);
    g.set(x, y + 1, 'shell', 1);
    g.set(x + d, y + 1, 'mud', 0);
    return;
  }
  const px = [
    [0, 0, 3], [1, 0, 4], [2, 0, 3],
    [-1, 1, 2], [0, 1, 4], [1, 1, 2], [2, 1, 3],
    [-1, 2, 2], [0, 2, 3], [1, 2, 1], [2, 2, 2],
    [0, 3, 1], [1, 3, 2],
  ];
  for (const [dx, dy, s] of px) g.set(x + dx * d, y + dy, 'shell', s);
  g.set(x + 1 * d, y + 2, 'mud', 0); // la boca
  g.set(x + 2 * d, y + 3, 'mud', 1);
  g.set(x - 1 * d, y + 3, 'mud', 1);
}

/** Palito enterrado: línea de madera de 1 px con su luz arriba y su sombra abajo. */
export function paintTwig(g, pts) {
  pts.forEach(([x, y], k) => g.set(x, y, 'wood', k % 4 === 1 ? 3 : 2));
  for (const [x, y] of pts) {
    if (!pts.some(([px, py]) => px === x && py === y + 1)) g.set(x, y + 1, 'mud', 0);
  }
  const [ex, ey] = pts[pts.length - 1];
  g.set(ex, ey, 'wood', 1);
}

/** Camino con quiebres desde (x, y), `n` pasos hacia (dx, dy). */
function path(rng, x, y, n, dx, dy) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    pts.push([x, y]);
    if (rng() < 0.75) x += dx;
    if (rng() < 0.4 || dx === 0) y += dy;
  }
  return pts;
}

/** Raíz que baja: núcleo marrón con luz a la izquierda y sombra a la derecha, con raicillas. */
export function paintRoot(g, x, y, len, rng, thick = true) {
  for (let k = 0; k < len; k++) {
    const w = thick && k < len * 0.45 ? 2 : 1;
    g.set(x, y, 'root', k === len - 1 ? 1 : w === 2 ? 3 : 2);
    if (w === 2) g.set(x + 1, y, 'root', 1);
    if (!g.opaque(x + w, y + 1)) g.set(x + w, y + 1, 'shadow', 0, 90);
    y++;
    const r = rng();
    if (r < 0.2) x--;
    else if (r > 0.8) x++;
    if (k > 2 && rng() < 0.14) {
      const d = rng() < 0.5 ? -1 : 1;
      for (let j = 1; j <= 3; j++) g.set(x + d * j, y + (j >> 1), 'root', j === 3 ? 1 : 2);
    }
  }
}

/** Lente de arcilla húmeda: una capa violácea que se afina en las puntas, con el labio claro arriba. */
export function paintClayLens(g, x0, x1, y0, thick, rng, warm = false) {
  for (let x = x0; x <= x1; x++) {
    const end = Math.min(x - x0, x1 - x);
    const t = end >= 6 ? thick : Math.max(1, Math.round((thick * (end + 1)) / 7));
    const wave = WAVE[mod(x, T)];
    for (let d = 0; d < t; d++) {
      const y = y0 + wave + d - Math.floor(t / 2);
      if (end < 3 && rng() < 0.35) continue;
      const step = d === 0 ? 3 : d === t - 1 ? 1 : (x + y) % 3 ? 2 : 1;
      g.set(x, y, 'clay', step);
    }
    if (warm && (x * 7) % 9 === 0) g.set(x, y0 + wave - Math.floor(t / 2), 'glow', 0);
    g.set(x, y0 + wave - Math.floor(t / 2) + t, 'mud', 1);
  }
}

// ─── Variantes y calcomanías ───────────────────────────────────────────────────────────────────────────────────────
/** Una base distinta: los tramos de las capas cambian solo en el centro (de 2 a 13). */
function variantBase(rng) {
  const runs = [0].map(() => {
    const r = [];
    let left = T;
    while (left > 0) {
      const n = Math.min(left, r.length % 2 ? irange(rng, 2, 6) : irange(rng, 2, 7));
      r.push(n);
      left -= n;
    }
    return r;
  });
  const shift = [irange(rng, 0, 15)];
  return baseMud(irange(rng, 1, 1 << 30), (k, x, y) => {
    const inner = x >= RING && x < T - RING && y >= RING && y < T - RING;
    return inner ? runOn(x + shift[k], runs[k]) : runOn(x, LAYER_RUNS[k]);
  });
}

const FILL_FEATURES = [
  [],
  ['wet'],
  ['dry'],
  ['lens'],
  ['grit'],
  ['bubbles', 'lens'],
  ['wet', 'twigbit'],
  ['dry', 'lens'],
  ['shellbit'],
  ['lens', 'bubbles'],
  ['wet', 'lens'],
  ['twigbit', 'grit'],
];

function paintFeature(g, kind, rng, lo = 3, hi = 12) {
  const c = () => irange(rng, lo + 1, hi - 1);
  switch (kind) {
    case 'wet':
    case 'dry': {
      // Mancha más húmeda (oscura) o más seca (clara), en forma de nube, solo sobre el barro del fondo.
      const x0 = irange(rng, lo + 2, hi - 2);
      const y0 = irange(rng, lo + 2, hi - 2);
      const rx = 2.5 + rng() * 2.2;
      const ry = 1.5 + rng();
      const lobes = Array.from({ length: 5 }, () => 0.7 + rng() * 0.5);
      for (let y = Math.floor(y0 - ry - 1); y <= Math.ceil(y0 + ry + 1); y++) {
        for (let x = Math.floor(x0 - rx - 1); x <= Math.ceil(x0 + rx + 1); x++) {
          const a = Math.atan2((y - y0) / ry, (x - x0) / rx);
          const r = lobes[mod(Math.round((a / (Math.PI * 2)) * 5), 5)];
          const d = Math.hypot((x - x0) / rx, (y - y0) / ry) / r;
          if (d > 1 || g.ramp(x, y) !== 'mud' || g.step(x, y) !== 2) continue;
          if (d < 0.6 || rng() < 0.4) g.set(x, y, 'mud', kind === 'dry' ? 3 : 1);
        }
      }
      if (kind === 'wet') g.set(x0, y0 - 1, 'glow', 0);
      break;
    }
    case 'lens':
      paintClayLens(g, irange(rng, lo - 1, lo + 1), irange(rng, hi - 1, hi + 1), c(), 2, rng);
      break;
    case 'grit':
      for (let k = 0; k < 4; k++) g.set(c(), c(), k % 2 ? 'shell' : 'clay', k % 2 ? 1 : 3);
      break;
    case 'bubbles':
      // Agujeritos del gas del barro: un poro oscuro con su labio claro.
      for (let k = 0; k < 3; k++) {
        const x = c();
        const y = c();
        g.set(x, y, 'mud', 0);
        g.set(x, y - 1, 'mud', 3);
      }
      break;
    case 'twigbit': {
      const x = irange(rng, lo, hi - 4);
      const y = c();
      paintTwig(g, Array.from({ length: irange(rng, 3, 5) }, (_, k) => [x + k, y + (k > 2 ? 1 : 0)]));
      break;
    }
    case 'shellbit':
      paintShell(g, c(), c(), rng() < 0.5, true);
      break;
  }
}

/** Las 12 variantes del relleno (casilla 15). */
export function fillVariants(seed = 1102) {
  const rng = mulberry32(seed);
  const ref = baseMud();
  return FILL_FEATURES.map((features) => {
    const g = variantBase(rng);
    for (const f of features) paintFeature(g, f, rng);
    return restoreSolidBands(g, ref, 15);
  });
}

/** Variantes de las casillas de borde más comunes de l2: 14 (piso), 11 (techo), 7 y 13 (paredes), y el tablón (17). */
export function edgeVariants(seed = 1103) {
  const rng = mulberry32(seed);
  const out = {};
  const grassAlt = [
    { top: [2, 3, 2, 2, 3, 2, 2, 3, 3, 2, 2, 3, 2, 2, 2, 3], bottom: [5, 5, 4, 4, 5, 5, 5, 4, 4, 5, 5, 5, 4, 4, 5, 5], tufts: [[0, 1, 0], [5, 1, -1], [6, 0, 0], [7, 1, 1], [12, 0, -1], [13, 1, 0], [15, 1, 1]], reeds: [[3, 0], [10, 0]], rim: [6], drapes: [[2, 8], [8, 9], [12, 7]] },
    { top: [3, 2, 2, 2, 3, 3, 2, 2, 2, 3, 3, 2, 2, 2, 3, 3], bottom: [5, 4, 4, 5, 5, 5, 4, 4, 5, 5, 4, 4, 5, 5, 5, 4], tufts: [[1, 1, -1], [2, 0, 0], [3, 1, 1], [7, 0, 0], [8, 1, 1], [11, 1, -1], [12, 0, 0]], reeds: [[5, 0], [14, 0]], rim: [2], drapes: [[4, 9], [9, 7], [13, 9]] },
    { top: [2, 2, 2, 3, 3, 2, 2, 2, 3, 2, 2, 2, 3, 3, 2, 2], bottom: [4, 4, 5, 5, 5, 4, 4, 5, 5, 5, 4, 4, 5, 5, 5, 4], tufts: [[0, 0, 1], [1, 1, 0], [5, 1, 0], [6, 0, 1], [9, 1, -1], [10, 0, 0], [15, 1, 0]], reeds: [[12, 0]], rim: [10], drapes: [[3, 7], [7, 9], [13, 8]] },
  ];
  // El tablón (17): otra veta, la atadura y el pasto en otro lugar; los extremos, como la base.
  const plankAlt = [
    { grain: [[2, 2, 7], [4, 9, 13], [3, 12, 15]], ties: [10], pegs: [[3, 3]], grass: [], chips: [0, 1, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 1, 0, 0, 0], wet: [] },
    { grain: [[3, 0, 4], [2, 6, 10], [4, 11, 15]], ties: [], pegs: [[7, 2], [12, 4]], grass: [[2, 4]], chips: [0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 1], wet: [9] },
    { grain: [[4, 1, 5], [2, 7, 12]], ties: [12], pegs: [], grass: [[5, 3]], chips: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0], wet: [3] },
  ];
  out[17] = plankAlt.map((v) => restoreSolidBands(plankCell('center', v), plankCell('center'), LEFT | RIGHT));
  out[14] = grassAlt.map((grass, k) => {
    const base = variantBase(rng);
    paintFeature(base, ['shellbit', 'twigbit', 'bubbles'][k], rng, 6, 12);
    return restoreSolidBands(autotileCell(14, { base, grass }), autotileCell(14), 14);
  });
  const notches = {
    11: [{ bottom: [1, 1, 0, 1, 2, 2, 1, 0, 1, 1, 0, 1, 2, 1, 0, 1] }, { bottom: [1, 0, 1, 1, 0, 1, 2, 2, 1, 0, 0, 1, 1, 2, 1, 1] }],
    7: [{ left: [0, 1, 1, 0, 1, 1, 2, 1, 0, 0, 0, 1, 0, 1, 1, 0] }, { left: [0, 1, 0, 0, 0, 1, 1, 0, 1, 2, 1, 1, 0, 0, 1, 0] }],
    13: [{ right: [0, 0, 1, 1, 2, 1, 0, 0, 1, 0, 0, 1, 1, 0, 1, 0] }, { right: [0, 0, 1, 0, 0, 0, 1, 1, 2, 1, 0, 0, 1, 0, 1, 0] }],
  };
  const extras = {
    11: [{ roots: [[3, 3], [9, 5]] }, { roots: [[7, 4]] }],
    7: [{ drips: { left: [[3, 5], [11, 2]] } }, { drips: { left: [[6, 3], [9, 4]] } }],
    13: [{ drips: { right: [[5, 4], [11, 3]] } }, { drips: { right: [[3, 2], [9, 5]] } }],
  };
  for (const mask of [11, 7, 13]) {
    out[mask] = notches[mask].map((notch, k) => {
      const base = variantBase(rng);
      paintFeature(base, ['grit', 'lens'][k], rng, 4, 11);
      return restoreSolidBands(autotileCell(mask, { base, notch, ...extras[mask][k] }), autotileCell(mask), mask);
    });
  }
  // El fondo bajo el agua: el piso (14) con limo y algas en vez de pasto (`submerged` en el JSON).
  out.submerged = [
    { top: [3, 3, 3, 4, 4, 3, 3, 3, 4, 4, 3, 3, 3, 3, 4, 4], tufts: [[2, 0, 1], [3, 1, 1], [9, 1, -1], [10, 0, -1], [13, 2, 1]] },
    { top: [3, 4, 4, 3, 3, 3, 4, 4, 3, 3, 3, 4, 4, 3, 3, 3], tufts: [[5, 1, -1], [6, 0, 1], [12, 0, 1], [14, 2, -1]] },
    { top: [4, 3, 3, 3, 4, 4, 3, 3, 3, 4, 4, 3, 3, 4, 4, 3], tufts: [[1, 1, 1], [7, 0, -1], [8, 1, -1], [11, 2, 1]] },
  ].map((grass) => autotileCell(14, { base: variantBase(rng), grass: { ...GRASS, ...grass }, submerged: true }));
  // El barro seco (22): otras grietas (la luz del tajo las sigue: `glow` en el JSON).
  out[22] = DRY_VARIANTS.map((cracks, k) => dryMudCell(cracks, 1104 + k));
  // El agua: la superficie (20) y el cuerpo (21) con otras rayas.
  out[20] = [1, 2].map((k) => waterCell('surface', 1110 + k));
  out[21] = [1, 2].map((k) => waterCell('body', 1120 + k));
  return out;
}

const DRY_VARIANTS = [
  [
    [[0, 9], [1, 9], [2, 8], [3, 8], [4, 7], [5, 7], [6, 7], [7, 8], [8, 8]],
    [[6, 7], [6, 6], [5, 5], [5, 4], [6, 3], [6, 2], [7, 1], [7, 0]],
    [[8, 8], [9, 9], [10, 9], [11, 10], [12, 10], [13, 9], [14, 9], [15, 9]],
    [[11, 10], [11, 11], [10, 12], [10, 13], [9, 14], [9, 15]],
    [[5, 4], [4, 3], [3, 3], [2, 2], [1, 2], [0, 2]],
    [[13, 9], [13, 8], [12, 7], [12, 6], [13, 5], [14, 4], [15, 4]],
  ],
  [
    [[0, 4], [1, 4], [2, 5], [3, 5], [4, 5], [5, 6], [6, 6], [7, 6]],
    [[7, 6], [8, 5], [9, 5], [10, 4], [11, 4], [12, 3], [13, 3], [14, 2], [15, 2]],
    [[7, 6], [7, 7], [7, 8], [6, 9], [6, 10], [5, 11], [5, 12], [5, 13], [4, 14], [4, 15]],
    [[10, 4], [10, 3], [11, 2], [11, 1], [11, 0]],
    [[6, 10], [7, 11], [8, 11], [9, 12], [10, 12], [11, 12], [12, 13], [13, 13], [14, 14], [15, 14]],
  ],
];

/** Calcomanías: grillas transparentes de w × h casillas que se dibujan encima del barro. */
export function decals(seed = 1105) {
  const rng = mulberry32(seed);
  const out = {};
  const one = (fn) => {
    const g = grid(T, T);
    fn(g);
    return g;
  };
  // Caracoles enterrados: uno grande, de a dos, conchitas sueltas.
  out.shell = [
    one((g) => paintShell(g, 7, 7)),
    one((g) => {
      paintShell(g, 5, 6);
      paintShell(g, 11, 10, true, true);
    }),
    one((g) => {
      paintShell(g, 4, 9, false, true);
      paintShell(g, 8, 6, true, true);
      paintShell(g, 11, 10, false, true);
    }),
    one((g) => {
      paintShell(g, 9, 8, true);
      g.set(4, 11, 'shell', 2);
      g.set(5, 11, 'shell', 1);
    }),
  ];
  // Palitos enterrados, inclinados, alguno partido.
  out.twig = [
    one((g) => paintTwig(g, [[3, 10], [4, 10], [5, 9], [6, 9], [7, 8], [8, 8], [9, 8], [10, 7], [11, 7], [12, 6]])),
    one((g) => {
      paintTwig(g, [[4, 6], [5, 6], [6, 6], [7, 7], [8, 7], [9, 7]]);
      paintTwig(g, [[8, 11], [9, 11], [10, 11], [11, 10], [12, 10]]);
    }),
    one((g) => paintTwig(g, [[2, 8], [3, 8], [4, 8], [5, 8], [6, 9], [7, 9], [8, 9], [9, 9], [10, 10], [11, 10], [12, 10], [13, 10]])),
  ];
  // Raíces gruesas que cruzan el barro de lado a lado (2 × 1).
  out.root = [0, 1].map((k) => {
    const g = grid(2 * T, T);
    const pts = [];
    let y = k ? 5 : 9;
    for (let x = 3; x < 2 * T - 3; x++) {
      pts.push([x, y]);
      if ((x * (k ? 5 : 3)) % 7 === 0) y += k ? 1 : -1;
    }
    for (const [x, py] of pts) {
      g.set(x, py, 'root', x % 5 === 0 ? 3 : 2);
      g.set(x, py + 1, 'root', 1);
      g.set(x, py + 2, 'mud', 0);
    }
    // Raicillas que salen.
    for (const i of [6, 14, 21]) {
      const [x, py] = pts[i];
      paintRoot(g, x, py + 2, irange(rng, 3, 5), rng, false);
    }
    return g;
  });
  // Lentes de arcilla (3 × 1 y 2 × 1): otra capa más larga que las de la base.
  out.clay = [3, 2, 3, 2].map((cols, k) => {
    const g = grid(cols * T, T);
    paintClayLens(g, 2, cols * T - 3, 8 + (k % 2 ? -1 : 1), k < 2 ? 3 : 2, rng, k === 2);
    return g;
  });
  // Piedritas y grava (poca: el estero es barro).
  out.pebble = [0, 1].map((k) =>
    one((g) => {
      for (const [x, y, s] of k ? [[5, 9, 3], [6, 9, 2], [9, 7, 3], [11, 10, 2]] : [[7, 8, 3], [8, 8, 2], [7, 9, 1], [11, 9, 3]]) g.set(x, y, 'clay', s);
    }),
  );
  // Raíces del pasto del piso: largas (dos casillas hacia abajo) y raicillas.
  out.roots = [0, 1].map((k) => {
    const g = grid(T, 2 * T);
    paintRoot(g, k ? 10 : 5, 8, k ? 17 : 20, rng);
    paintRoot(g, k ? 4 : 12, 8, k ? 8 : 10, rng, false);
    if (k) paintRoot(g, 14, 8, 5, rng, false);
    return g;
  });
  out.rootlet = [0, 1].map((k) =>
    one((g) => {
      paintRoot(g, k ? 11 : 4, 8, 6, rng, false);
      paintRoot(g, k ? 6 : 9, 8, 4, rng, false);
    }),
  );
  // El pasto mojado y un junco que salen por las esquinas de arriba hacia el aire de al lado.
  const overhang = (g, flip) => {
    const fx = (x) => (flip ? T - 1 - x : x);
    for (const [cx, y0, y1] of [[15, 3, 9], [14, 4, 7], [13, 5, 6]]) {
      for (let y = y0; y <= y1; y++) g.set(fx(cx), y, 'grass', y === y1 ? 1 : y === y0 ? 4 : y < y0 + 2 ? 3 : 2);
    }
    for (let y = 0; y <= 4; y++) g.set(fx(15 - (y < 2 ? 1 : 0)), y, 'reed', y === 0 ? 4 : 3);
    g.set(fx(14), 2, 'grass', 5);
    g.set(fx(14), 0, 'glow', 3);
  };
  out.overhangLeft = [one((g) => overhang(g, false))];
  out.overhangRight = [one((g) => overhang(g, true))];
  return out;
}

// ─── Las dos hojas ─────────────────────────────────────────────────────────────────────────────────────────────────
/** public/assets/tiles/estero.png: las 28 casillas de siempre (ASSETS §6). */
export function buildEsteroTileset() {
  const cells = [];
  for (let mask = 0; mask < 16; mask++) cells[mask] = mask === 15 ? baseMud() : autotileCell(mask);
  cells[16] = plankCell('left');
  cells[17] = plankCell('center');
  cells[18] = plankCell('right');
  cells[19] = spikesCell();
  cells[20] = waterCell('surface');
  cells[21] = waterCell('body');
  cells[22] = dryMudCell();
  cells[23] = grassTuftCell();
  cells[24] = reedsCell();
  cells[25] = moundCell();
  return buildTilesetImage(cells);
}

/**
 * public/assets/tiles/detalle/estero.png y su .json (S110): variantes del relleno, de los bordes, del tablón, del barro
 * seco y del agua, y calcomanías. Además de lo de cerro, el JSON trae `water.deep` (el agua honda, debajo del cuerpo) y
 * `glow` (casilla del barro seco → la luz de sus grietas, para el brillo del tajo cargado).
 */
export function buildEsteroDetail() {
  const { submerged, ...edges } = edgeVariants();
  const deep = [0, 1, 2].map((k) => waterCell('deep', 1130 + k));
  const glows = { 22: dryMudGlow(), ...Object.fromEntries(DRY_VARIANTS.map((c, k) => [`v${k}`, dryMudGlow(c)])) };
  const sheet = buildDetailSheet({
    fill: fillVariants(),
    edges,
    decals: decals(),
    fixed: ['overhangLeft', 'overhangRight'],
    extra: { water: { deep }, submerged: { 14: submerged }, glowTiles: glows },
  });
  // `glow`: casilla (del tileset, o `first + id` de la hoja) → casilla de la hoja con la luz de sus grietas.
  const { layout } = sheet;
  const glow = { 22: layout.glowTiles[22] };
  layout.edges['22'].forEach((id, k) => (glow[`d${id}`] = layout.glowTiles[`v${k}`]));
  delete layout.glowTiles;
  layout.glow = glow;
  layout.count = sheet.layout.count;
  return sheet;
}

export const buildTileset = buildEsteroTileset;
export const buildDetail = buildEsteroDetail;
