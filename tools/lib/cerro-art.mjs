// Tileset de cerro (l1) dibujado por código (S109). Lo escribe tools/make-terrain-tiles.mjs (npm run cerro-tiles); lo
// prueba tests/cerroTiles.test.ts. Lo común (azar, grilla, paleta, armado de las hojas) está en tile-art.mjs (S110).
// Todo sale de una semilla: correr el script dos veces da los mismos bytes.
//
// La idea: una roca base de 16 × 16 que se repite sin costura en las dos direcciones (capas inclinadas 1:2 cada 8 filas,
// con tramos que aparecen y desaparecen, y grano). Cada casilla del autotile parte de esa base y solo cambia los lados
// que dan al aire (pasto arriba, grietas y gastado a los costados, sombra y muescas abajo). Como cada tratamiento depende
// solo de la posición dentro de la casilla y es periódico a lo largo de su lado, dos casillas vecinas empalman siempre.
// Las variantes del relleno cambian solo el centro (de 2 a 13): el anillo de 2 px es el de la base.

import {
  buildDetailSheet,
  buildTilesetImage,
  DETAIL_COLUMNS,
  DOWN,
  Grid,
  irange,
  LEFT,
  makePalette,
  mod,
  mulberry32,
  RIGHT,
  restoreSolidBands,
  RING,
  T,
  TILESET_COLUMNS,
  TILESET_ROWS,
  UP,
} from './tile-art.mjs';

// ─── Paleta (medida en public/assets/backgrounds/l1_far.jpg y l1_cave.jpg; ver docs/ASSETS.md §6) ────────────────
// Roca: la sombra más honda sale de la roca de la cueva (#1e2530, #151b27) corrida al violeta; los medios y las luces,
// de las caras de las sierras (#6c7191, #7f7e9a, #9c91ae), más oscuros que allá porque esto está adelante.
// Luz cálida: el cielo del atardecer (#e0a5bf, #f1b7c1) mezclado con la roca. Musgo: el bosque cercano (#1b2b27,
// #293b31, #3d4f40, #4f6149, #647450), más saturado. Cristales: los grupos violeta y cian de la cueva. Tierra y raíces:
// el oro apagado de la cueva (#5e4e2c, #71603b) llevado al marrón.
export const RAMPS = {
  rock: ['#1f2230', '#363748', '#4b4b60', '#615f78', '#7b7892', '#9a91ad'],
  glow: ['#8f7f9b', '#b39fb5', '#d4b3c0'],
  moss: ['#1b2b26', '#2a4130', '#3d5b37', '#55753f', '#738f48', '#98ab58'],
  lichen: ['#5f6a48', '#808b56', '#a5a967', '#c9c483'],
  ochre: ['#7c5a3e', '#a07a4d', '#c69d62'],
  soil: ['#22191b', '#3a2a27', '#574034', '#75573f', '#94744f'],
  violet: ['#2a2b53', '#3c3e6b', '#52518a', '#6a65a6', '#8e88cc', '#c2bcf0'],
  cyan: ['#21495c', '#2e6a82', '#4989a1', '#5ea7bc', '#80c7d7', '#c8f0f5'],
  water: ['#24344f', '#2f4a6c', '#41658d', '#5f86ad', '#9bbad6'],
  shadow: ['#10111a'],
};
export const PALETTE = makePalette(RAMPS);
/** Una grilla vacía con la paleta del cerro. */
const grid = (w, h) => new Grid(w, h, PALETTE);

export { T };
const SEAM_PERIOD = 8; // filas entre dos capas (pendiente 1:2: baja 1 cada 2)
const SEAM_OFFSET = 3;
/** Tramos de la capa a lo largo de su línea cerrada de 32 px (on, off, on, off…): suman 32. */
const SEAM_RUNS = [6, 5, 4, 8, 5, 4];

// ─── La roca base ─────────────────────────────────────────────────────────────────────────────────────────────────
/** Fase de la capa en (x, y): 0 sobre la línea de una capa; 1 a 7 entre dos. `copy` dice cuál de las dos líneas. */
export function seamPhase(x, y) {
  const p = mod(y - Math.floor(x / 2) - SEAM_OFFSET, 2 * SEAM_PERIOD);
  return { phase: p % SEAM_PERIOD, along: mod(x, T) + (p >= SEAM_PERIOD ? T : 0) };
}
function seamVisibleAt(along, runs = SEAM_RUNS) {
  let s = mod(along, 32);
  let on = true;
  for (const r of runs) {
    if (s < r) return on;
    s -= r;
    on = !on;
  }
  return on;
}

/**
 * La roca base (casilla 15). Capas: la línea (tono 1), un labio claro debajo (4) y una sombra suave arriba (2, tramada).
 * `seamAt(x, y, along)` permite a una variante prender o apagar tramos solo en el centro.
 */
export function baseRock(seed = 109, seamAt = null) {
  const rng = mulberry32(seed);
  const g = grid(T, T);
  const vis = (x, y, along) => (seamAt ? seamAt(x, y, along) : seamVisibleAt(along));
  for (let y = 0; y < T; y++) {
    for (let x = 0; x < T; x++) {
      const { phase } = seamPhase(x, y);
      let step = 3;
      // La línea de la capa (un tono abajo) y, debajo, un labio claro tramado: un solo escalón de contraste.
      const above = seamPhase(x, y - 1);
      if (phase === 0 && vis(x, y, seamPhase(x, y).along)) step = 2;
      else if (above.phase === 0 && vis(x, mod(y - 1, T), above.along) && x % 2 === 0) step = 4;
      g.set(x, y, 'rock', step);
    }
  }
  // Grano: poros oscuros con su labio claro y granos sueltos, lejos de las capas y entre sí (vuelta incluida).
  const used = [];
  const far = (x, y, d) => used.every(([ux, uy]) => Math.min(mod(ux - x, T), mod(x - ux, T)) + Math.min(mod(uy - y, T), mod(y - uy, T)) >= d);
  let tries = 0;
  while (used.length < 9 && tries++ < 400) {
    const x = irange(rng, 0, T - 1);
    const y = irange(rng, 0, T - 1);
    if (g.step(x, y) !== 3 || g.step(x, mod(y + 1, T)) !== 3 || !far(x, y, 4)) continue;
    used.push([x, y]);
    if (used.length % 3 === 0) {
      g.set(x, y, 'rock', 4);
    } else {
      g.set(x, y, 'rock', 2);
      if (g.step(mod(x + 1, T), mod(y + 1, T)) === 3) g.set(mod(x + 1, T), mod(y + 1, T), 'rock', 4);
    }
  }
  return g;
}

// ─── Perfiles de los bordes (periódicos a lo largo de su lado) ─────────────────────────────────────────────────────
// Arriba: dónde empieza el musgo (h), dónde termina (b), las puntas de pasto y las matas que cuelgan delante de la roca.
export const GRASS = {
  top: [2, 2, 1, 2, 3, 2, 2, 1, 2, 2, 3, 2, 1, 2, 2, 3],
  bottom: [5, 5, 6, 6, 5, 5, 4, 5, 6, 6, 5, 5, 5, 6, 5, 5],
  blades: [[2, 0], [7, 0], [12, 0], [5, 1], [9, 1], [15, 1], [0, 1]],
  dry: [4, 10, 14],
  drapes: [[3, 8], [4, 7], [9, 9], [13, 7]],
  /** Sobre la ladera, cuánto baja el pasto por el costado en una esquina (columna 0 / 1 desde el aire). */
  side: [9, 6],
};
export const NOTCH = {
  left: [0, 0, 1, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 1, 0],
  right: [0, 1, 0, 0, 0, 1, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0],
  bottom: [0, 1, 1, 0, 0, 0, 1, 0, 0, 0, 1, 1, 0, 0, 0, 0],
};
/** Grietas que entran desde el aire: [posición a lo largo del lado, largo]. */
export const SIDE_CRACKS = { left: [[5, 4], [11, 2]], right: [[3, 3], [9, 4]], bottom: [[4, 3], [12, 2]] };

/**
 * Una casilla del autotile (máscara: vecinos sólidos arriba 1, derecha 2, abajo 4, izquierda 8). `variant` cambia el
 * centro: { base, grass, notch, cracks } (cada uno opcional; lo que toca un borde sólido tiene que ser igual a la base).
 */
export function autotileCell(mask, variant = {}) {
  const g = (variant.base ?? baseRock()).clone();
  const air = { up: !(mask & UP), right: !(mask & RIGHT), down: !(mask & DOWN), left: !(mask & LEFT) };
  const grass = { ...GRASS, ...(variant.grass ?? {}) };
  const notch = { ...NOTCH, ...(variant.notch ?? {}) };
  const cracks = { ...SIDE_CRACKS, ...(variant.cracks ?? {}) };

  // 1. Silueta: muescas en los costados y abajo, esquinas de abajo gastadas.
  if (air.left) for (let y = 0; y < T; y++) for (let x = 0; x < notch.left[y]; x++) g.clear(x, y);
  if (air.right) for (let y = 0; y < T; y++) for (let x = 0; x < notch.right[y]; x++) g.clear(T - 1 - x, y);
  if (air.down) for (let x = 0; x < T; x++) for (let y = 0; y < notch.bottom[x]; y++) g.clear(x, T - 1 - y);
  const chamfer = [3, 2, 1];
  if (air.down && air.left) for (let y = 0; y < 3; y++) for (let x = 0; x < chamfer[y]; x++) g.clear(x, T - 1 - y);
  if (air.down && air.right) for (let y = 0; y < 3; y++) for (let x = 0; x < chamfer[y]; x++) g.clear(T - 1 - x, T - 1 - y);
  if (air.up && air.left) for (const [x, y] of [[0, 0], [1, 0], [0, 1], [0, 2], [2, 0], [1, 1]]) g.clear(x, y);
  if (air.up && air.right) for (const [x, y] of [[15, 0], [14, 0], [15, 1], [15, 2], [13, 0], [14, 1]]) g.clear(x, y);

  // 2. Sombras y luces del borde: oscuro abajo y a la derecha, contorno más suave y un filo claro a la izquierda.
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
      if (dark < 99) shade[y * T + x] = dark; // 0 → contorno, 1, 2 → sombra que se va
      else if (clearAt(x - 2, y)) shade[y * T + x] = 9; // filo claro
    }
  }
  for (let i = 0; i < T * T; i++) {
    const s = shade[i];
    if (s < 0) continue;
    const x = i % T;
    const y = (i - x) / T;
    const cur = g.step(x, y);
    if (s === 9) g.set(x, y, 'rock', Math.max(cur, 4));
    else g.set(x, y, 'rock', Math.min(cur, s));
  }

  // 3. Grietas que entran desde el aire (núcleo 0, labio claro abajo a la derecha).
  const crack = (pts) => {
    for (const [x, y] of pts) {
      if (!g.opaque(x, y)) continue;
      g.set(x, y, 'rock', 0);
    }
    for (const [x, y] of pts) {
      if (g.opaque(x + 1, y + 1) && g.step(x + 1, y + 1) >= 2 && !pts.some(([px, py]) => px === x + 1 && py === y + 1)) g.set(x + 1, y + 1, 'rock', 4);
    }
  };
  if (air.left) for (const [y0, len] of cracks.left) crack(Array.from({ length: len }, (_, k) => [notch.left[y0] + k, y0 + (k >> 1)]));
  if (air.right) for (const [y0, len] of cracks.right) crack(Array.from({ length: len }, (_, k) => [T - 1 - notch.right[y0] - k, y0 + ((k + 1) >> 1)]));
  if (air.down) for (const [x0, len] of cracks.bottom) crack(Array.from({ length: len }, (_, k) => [x0 + (k % 2), T - 1 - notch.bottom[x0] - k]));

  // 4. El pasto y el musgo de arriba, que desbordan el filo y cuelgan delante de la roca.
  if (air.up) paintGrassTop(g, grass, air);
  return g;
}

function paintGrassTop(g, grass, air) {
  const top = [...grass.top];
  const bottom = [...grass.bottom];
  // En las esquinas el pasto se redondea y baja por el costado.
  if (air.left) {
    top[0] = Math.max(top[0], 3);
    top[1] = Math.max(top[1], 2);
  }
  if (air.right) {
    top[T - 1] = Math.max(top[T - 1], 3);
    top[T - 2] = Math.max(top[T - 2], 2);
  }
  // La roca bajo el musgo: sombra que proyecta el musgo.
  for (let x = 0; x < T; x++) {
    for (let y = 0; y < top[x]; y++) g.clear(x, y);
    const b = bottom[x];
    if (g.opaque(x, b + 1)) g.set(x, b + 1, 'rock', Math.min(g.step(x, b + 1), 1));
    if (g.opaque(x, b + 2) && x % 2 === 0) g.set(x, b + 2, 'rock', Math.min(g.step(x, b + 2), 2));
  }
  for (let x = 0; x < T; x++) {
    const h = top[x];
    const b = bottom[x];
    for (let y = h; y <= b; y++) {
      let step = y === h ? 5 : y === h + 1 ? 4 : y === b ? 1 : 3;
      if (step === 3 && (x * 7 + y * 3) % 5 === 0) step = 2;
      if (step === 4 && (x * 5 + y) % 4 === 0) step = 5;
      g.set(x, y, 'moss', step);
    }
  }
  // Puntas de pasto (una o dos filas arriba) y algunas hojas secas.
  for (const [x, tip] of grass.blades) {
    if ((air.left && x < 2) || (air.right && x > T - 3)) continue;
    for (let y = tip; y < top[x]; y++) g.set(x, y, 'moss', y === tip ? 5 : 4);
  }
  for (const x of grass.dry) {
    if ((air.left && x < 2) || (air.right && x > T - 3)) continue;
    const y = Math.max(0, top[x] - 1);
    g.set(x, y, 'lichen', 3);
    g.set(x, top[x], 'lichen', 2);
  }
  // Matas que cuelgan 2 o 3 píxeles por delante del filo.
  for (const [x, end] of grass.drapes) {
    if ((air.left && x < 2) || (air.right && x > T - 3)) continue;
    for (let y = bottom[x] + 1; y <= end; y++) g.set(x, y, 'moss', y === end ? 1 : y === bottom[x] + 1 ? 3 : 2);
    if (g.opaque(x, end + 1)) g.set(x, end + 1, 'rock', Math.min(g.step(x, end + 1), 1));
  }
  // Por el costado, en las esquinas: el pasto baja por la ladera.
  const side = (x, depth, outer) => {
    for (let y = top[x]; y <= depth; y++) {
      const step = y === depth ? 1 : outer ? (y < top[x] + 2 ? 4 : 2) : 3;
      g.set(x, y, 'moss', step);
    }
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

// ─── Plataforma: laja de piedra con grosor y sombra debajo (la colisión sigue en la fila 0) ─────────────────────────
export const PLATFORM = {
  chips: [0, 0, 1, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 1, 0],
  /** Musgo sobre el filo: [desde, ancho, alto de cada columna (1 o 2)…], con una gota que cuelga. */
  moss: [[3, 7, [1, 2, 2, 2, 1, 2, 1]]],
  drip: [6],
  glow: [12, 13],
  dry: 1,
};

export function platformCell(kind /* 'left' | 'center' | 'right' */, variant = {}) {
  const v = { ...PLATFORM, ...variant };
  const g = grid(T, T);
  const SLAB = 7; // filas 0 a 6: la laja; 7: contorno (con astillas que cuelgan a la 8); 8 y 9: sombra
  const chips = v.chips;
  for (let x = 0; x < T; x++) {
    for (let y = 0; y < SLAB; y++) {
      const { phase, along } = seamPhase(x, y + 5);
      let step = y === 0 ? ((x * 5) % 7 === 0 ? 4 : 5) : y === 1 ? 4 : y === SLAB - 1 ? 1 : y === SLAB - 2 ? 2 : 3;
      if (step === 3 && phase === 0 && seamVisibleAt(along)) step = 2;
      if (step === 3 && (x * 3 + y * 5) % 11 === 0) step = 4;
      g.set(x, y, 'rock', step);
    }
    g.set(x, SLAB, 'rock', 0);
    if (chips[x]) g.set(x, SLAB + 1, 'rock', 0);
    const s0 = SLAB + 1 + chips[x];
    g.set(x, s0, 'shadow', 0, 110);
    g.set(x, s0 + 1, 'shadow', 0, 45);
  }
  // Musgo en un manchón desparejo sobre el filo (no puntitos), con una gota que cae por delante; luz cálida y una hoja seca.
  for (const [x0, w, rows] of v.moss) {
    for (let k = 0; k < w; k++) {
      const x = x0 + k;
      const edge = k === 0 || k === w - 1;
      g.set(x, 0, 'moss', edge ? 3 : 4);
      if (rows[k] > 1) g.set(x, 1, 'moss', edge ? 2 : 3);
    }
  }
  for (const x of v.drip) {
    g.set(x, 2, 'moss', 2);
    g.set(x, 3, 'moss', 1);
  }
  v.glow.forEach((x, k) => g.set(x, 0, 'glow', k ? 2 : 1));
  if (v.dry >= 0) g.set(v.dry, 0, 'lichen', 2);
  // Puntas gastadas: la laja termina redondeada, con su sombra.
  const trim = (x, rows) => rows.forEach((y) => g.clear(x, y));
  if (kind === 'left') {
    trim(0, [0, 5, 6, 7, 8, 9, 10]);
    trim(1, [7, 9, 10]);
    for (const y of [1, 2, 3, 4]) g.set(0, y, 'rock', y === 1 ? 2 : 1);
    g.set(1, 0, 'rock', 4);
    g.set(1, 6, 'rock', 0);
    g.set(1, 8, 'shadow', 0, 60);
  }
  if (kind === 'right') {
    trim(15, [0, 5, 6, 7, 8, 9, 10]);
    trim(14, [7, 9, 10]);
    for (const y of [1, 2, 3, 4]) g.set(15, y, 'rock', 0);
    g.set(14, 6, 'rock', 0);
    g.set(14, 8, 'shadow', 0, 60);
  }
  return g;
}

// ─── Espinas: piedra filosa, lajas partidas en punta con el filo claro ─────────────────────────────────────────────
export function spikesCell() {
  const g = grid(T, T);
  // [x de la base, ancho de la base, alto, inclinación de la punta]: de atrás para adelante.
  const shards = [[9, 6, 14, 1], [0, 6, 9, 1], [3, 6, 13, 0], [7, 5, 10, -1], [12, 4, 8, 0]];
  for (const [bx, bw, h, lean] of shards) {
    const tipX = bx + Math.floor(bw / 2) + lean;
    for (let y = 0; y < h; y++) {
      const t = y / (h - 1); // 0 en la punta, 1 en la base
      const half = (bw / 2) * t;
      const cx = tipX + (bx + bw / 2 - 0.5 - tipX) * t;
      const x0 = Math.round(cx - half);
      const x1 = Math.round(cx + half);
      const ridge = Math.round(cx);
      const py = T - h + y;
      for (let x = x0; x <= x1; x++) {
        // Cara iluminada (izquierda) en el tono medio, la de sombra oscura; el filo, claro; el contorno, el más oscuro.
        let step = x < ridge ? 3 : 1;
        if (x === ridge) step = 4;
        if (x === x0 || x === x1) step = 0;
        g.set(x, py, 'rock', step);
      }
      if (y < 2) g.set(ridge, py, 'glow', y === 0 ? 2 : 1);
      else if (y < h * 0.5) g.set(ridge, py, 'rock', 5);
    }
  }
  // Pie de cascajo.
  const rubble = [1, 2, 1, 1, 2, 2, 1, 2, 1, 1, 2, 1, 2, 2, 1, 1];
  for (let x = 0; x < T; x++) {
    g.set(x, T - 1, 'rock', x % 3 === 0 ? 0 : 1);
    if (rubble[x] === 2) g.set(x, T - 2, 'rock', x % 2 ? 2 : 3);
  }
  return g;
}

// ─── Agua del cerro: azul de la cueva, semitransparente ────────────────────────────────────────────────────────────
export function waterCell(surface, alpha = 200) {
  const g = grid(T, T);
  for (let y = 0; y < T; y++) {
    for (let x = 0; x < T; x++) {
      let step = y < 6 ? 2 : 1;
      if ((x + y * 3) % 11 === 0) step = 3;
      if ((x * 2 + y) % 13 === 0) step = 0;
      g.set(x, y, 'water', step, alpha);
    }
  }
  if (surface) {
    const crest = [0, 0, 1, 1, 1, 0, 0, 0, 1, 2, 1, 1, 0, 0, 0, 1];
    for (let x = 0; x < T; x++) {
      g.set(x, crest[x], 'water', 4, alpha);
      g.set(x, crest[x] + 1, 'water', 3, alpha);
      for (let y = 0; y < crest[x]; y++) g.clear(x, y);
    }
  }
  return g;
}

// ─── Roca que se rompe: la base con grietas marcadas ───────────────────────────────────────────────────────────────
export function crackedCell() {
  const g = baseRock();
  const lines = [
    [[7, 0], [7, 1], [6, 2], [6, 3], [7, 4], [8, 5], [8, 6], [7, 7], [7, 8], [6, 9], [6, 10], [7, 11], [7, 12], [8, 13], [8, 14], [8, 15]],
    [[8, 6], [9, 6], [10, 7], [11, 7], [12, 8], [13, 8], [14, 9], [15, 9]],
    [[7, 8], [6, 8], [5, 9], [4, 9], [3, 10], [2, 10], [1, 11], [0, 11]],
    [[6, 3], [5, 3], [4, 2], [3, 2], [2, 1]],
    [[7, 12], [8, 12], [9, 12], [10, 13], [11, 13]],
  ];
  for (const line of lines) for (const [x, y] of line) g.set(x, y, 'rock', 0);
  for (const line of lines) {
    for (const [x, y] of line) {
      if (g.step(x + 1, y) > 1) g.set(x + 1, y, 'rock', 4);
      if (g.step(x - 1, y) > 1 && g.step(x - 1, y) !== 4) g.set(x - 1, y, 'rock', 2);
    }
  }
  return g;
}

// ─── Decoración del borde (casillas 23 a 25), apoyada abajo ───────────────────────────────────────────────────────
export function grassTuftCell() {
  const g = grid(T, T);
  // [x, alto, inclinación, seco]
  const blades = [[3, 4, -1, false], [4, 6, 0, false], [5, 8, 1, false], [6, 5, 0, true], [7, 9, 0, false], [8, 7, -1, false], [9, 6, 1, true], [10, 8, 1, false], [11, 5, 0, false], [12, 3, 1, false]];
  for (const [x, h, lean, dry] of blades) {
    for (let k = 0; k < h; k++) {
      const px = x + (k > h / 2 ? lean : 0);
      const ramp = dry ? 'lichen' : 'moss';
      const step = dry ? (k === h - 1 ? 3 : 2) : k === h - 1 ? 5 : k > h / 2 ? 4 : k < 2 ? 2 : 3;
      g.set(px, T - 1 - k, ramp, step);
    }
  }
  for (let x = 4; x <= 11; x++) g.set(x, T - 1, 'moss', 1);
  return g;
}

export function flowersCell() {
  const g = grid(T, T);
  const stems = [[4, 5], [8, 7], [11, 4]];
  for (const [x, h] of stems) for (let k = 0; k < h; k++) g.set(x + (k > 3 ? 1 : 0), T - 1 - k, 'moss', k < 2 ? 2 : 3);
  const heads = [[5, T - 6, 'violet'], [9, T - 8, 'glow'], [12, T - 5, 'lichen']];
  for (const [x, y, ramp] of heads) {
    const hi = ramp === 'violet' ? 5 : ramp === 'glow' ? 2 : 3;
    g.set(x, y, ramp, hi);
    g.set(x - 1, y, ramp, hi - 1);
    g.set(x + 1, y, ramp, hi - 1);
    g.set(x, y - 1, ramp, hi - 1);
    g.set(x, y + 1, ramp, Math.max(0, hi - 2));
  }
  for (const [x, y] of [[3, T - 2], [6, T - 2], [10, T - 3], [13, T - 2]]) g.set(x, y, 'moss', 4);
  for (let x = 3; x <= 13; x++) g.set(x, T - 1, 'moss', x % 2 ? 1 : 2);
  return g;
}

export function stonesCell() {
  const g = grid(T, T);
  paintStone(g, 6, T - 4, 3.2, 2.4, 0.2);
  paintStone(g, 11, T - 3, 2.1, 1.6, 0.7);
  paintStone(g, 3, T - 2, 1.4, 1.1, 0.4);
  return g;
}

// ─── Pinceles de la roca (variantes y calcomanías) ─────────────────────────────────────────────────────────────────
/**
 * Piedra incrustada: polígono de 7 a 9 vértices con radios desparejos (partida, no una esfera), el pie aplastado
 * (asienta en la roca), una cara de arriba plana y biseles alrededor con la luz arriba a la izquierda, contorno oscuro
 * abajo y un brillo. `opts.soft`: sin contorno ni brillo, un escalón de cada lado (se funde con la pared).
 */
export function paintStone(g, cx, cy, rx, ry, jitter = 0.3, opts = {}) {
  const warm = opts.warm ?? false;
  const n = 7 + (Math.round(cx * 3 + cy * 5) % 3);
  const rot = (cx * 1.7 + cy * 0.9) % (Math.PI * 2);
  const verts = [];
  for (let i = 0; i < n; i++) {
    const a = rot + (i / n) * Math.PI * 2 + 0.25 * Math.sin(i * 1.7 + cx);
    const r = 1 - jitter * 0.28 * (0.5 + 0.5 * Math.sin(i * 2.9 + cx * 1.3 + cy));
    verts.push([cx + Math.cos(a) * rx * r, Math.min(cy + ry * 0.62, cy + Math.sin(a) * ry * r)]);
  }
  verts.sort((p, q) => Math.atan2(p[1] - cy, p[0] - cx) - Math.atan2(q[1] - cy, q[0] - cx));
  const edges = verts.map((v, i) => {
    const w = verts[(i + 1) % n];
    const len = Math.hypot(w[0] - v[0], w[1] - v[1]) || 1;
    // Normal hacia afuera (los vértices van en sentido horario en pantalla: y crece hacia abajo).
    return { v, w, nx: (w[1] - v[1]) / len, ny: -(w[0] - v[0]) / len };
  });
  const signed = (px, py, e) => (px - e.v[0]) * e.nx + (py - e.v[1]) * e.ny; // > 0: afuera de ese lado
  const inradius = Math.min(rx, ry) * 0.42;
  const pts = [];
  for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++) {
    for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      let near = null;
      let best = Infinity;
      let out = false;
      for (const e of edges) {
        const d = signed(px, py, e);
        if (d > 0) {
          out = true;
          break;
        }
        if (-d < best) {
          best = -d;
          near = e;
        }
      }
      if (out) continue;
      // Cara de arriba plana en el centro; cerca de un lado, el bisel de ese lado.
      const face = best > inradius;
      pts.push([x, y, face ? -0.15 : near.nx, face ? -0.55 : near.ny]);
    }
  }
  const inside = new Set(pts.map(([x, y]) => `${x},${y}`));
  const has = (x, y) => inside.has(`${x},${y}`);
  for (const [x, y, nx, ny] of pts) {
    const l = -0.55 * nx - 0.83 * ny;
    let step = l > 0.62 ? 5 : l > 0.25 ? 4 : l > -0.3 ? 3 : 2;
    const edgeBR = !has(x + 1, y) || !has(x, y + 1);
    if (edgeBR && l < 0.25) step = 1;
    if (opts.soft) step = Math.max(2, Math.min(4, step));
    if (warm && step >= 4) g.set(x, y, 'glow', step - 4);
    else g.set(x, y, 'rock', step);
  }
  // Grieta de asiento: la piedra está metida en la roca.
  for (const [x, y] of pts) {
    if (!has(x, y + 1) && g.in(x, y + 1)) g.set(x, y + 1, 'rock', opts.soft ? 2 : 0);
    if (!opts.soft && !has(x + 1, y) && !has(x + 1, y + 1) && g.in(x + 1, y + 1) && (x + y) % 2 === 0) g.set(x + 1, y + 1, 'rock', 1);
  }
  if (opts.soft || pts.length < 6) return;
  const hx = Math.round(cx - rx * 0.35);
  const hy = Math.round(cy - ry * 0.4);
  if (has(hx, hy)) g.set(hx, hy, warm ? 'glow' : 'rock', warm ? 2 : 5);
}

/** Grieta: camino de un píxel (tono 0) con su labio claro; puede ramificarse. */
export function paintCrack(g, pts, branch = [], core = 0) {
  const all = [...pts, ...branch];
  for (const [x, y] of all) g.set(x, y, 'rock', core);
  const isCrack = (x, y) => all.some(([px, py]) => px === x && py === y);
  // En una calcomanía (fondo transparente) el labio y la sombra se dibujan igual: van encima de la roca.
  for (const [x, y] of all) {
    if (!isCrack(x + 1, y + 1)) g.set(x + 1, y + 1, 'rock', 4);
    if (!isCrack(x - 1, y) && (x + y) % 2 && g.step(x - 1, y) !== 4) g.set(x - 1, y, 'rock', 2);
  }
}

/** Camino de grieta desde (x, y) con `n` pasos en la dirección (dx, dy), con quiebres. */
export function crackPath(rng, x, y, n, dx, dy) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    pts.push([x, y]);
    if (rng() < 0.6) x += dx;
    if (rng() < 0.6 || dx === 0) y += dy;
    if (rng() < 0.18) x -= dx;
  }
  return pts;
}

/** Veta de cuarzo: línea clara de un píxel con el borde suave. */
export function paintVein(g, pts) {
  pts.forEach(([x, y], k) => g.set(x, y, 'rock', k % 3 === 1 ? 5 : 4));
}

/** Liquen: mancha irregular verde pálido con puntos ocres. */
export function paintLichen(g, cx, cy, size, rng) {
  // Mancha chata y despareja (más ancha que alta), casi toda en el tono medio: costra, no destello.
  const cells = [];
  const rx = size + 1.5;
  const ry = Math.max(1, size * 0.6);
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
      if (d <= 0.75 + rng() * 0.5) cells.push([x, y, d]);
    }
  }
  for (const [x, y, d] of cells) {
    const step = d < 0.25 && rng() < 0.5 ? 2 : d > 0.8 ? 0 : 1;
    g.set(x, y, 'lichen', step);
  }
  for (let k = 0; k < Math.max(1, size - 1); k++) {
    const [x, y] = cells[Math.floor(rng() * cells.length)];
    g.set(x, y, 'ochre', k % 2 ? 1 : 0);
  }
  for (let k = 0; k < 3; k++) {
    const x = cx + irange(rng, -size - 2, size + 2);
    const y = cy + irange(rng, -size - 1, size + 1);
    g.set(x, y, 'lichen', 0);
  }
}

/** Cristal: prisma angosto con la cara clara a la izquierda, la oscura a la derecha y la punta que brilla. */
export function paintCrystal(g, bx, by, len, dir, ramp) {
  // dir: -1 apunta arriba a la izquierda, 0 arriba, 1 arriba a la derecha
  for (let k = 0; k < len; k++) {
    const x = bx + Math.round(dir * k * 0.5);
    const y = by - k;
    const tip = k === len - 1;
    g.set(x, y, ramp, tip ? 5 : k > len - 3 ? 4 : 3);
    if (!tip) g.set(x + 1, y, ramp, k < 2 ? 1 : 2);
    if (k < len - 2 && k > 0) g.set(x - 1, y, ramp, 2);
  }
  g.set(bx, by + 1, 'rock', 0);
  g.set(bx + 1, by + 1, 'rock', 0);
}

/** Raíz que cuelga: núcleo marrón, cara clara a la izquierda, sombra sobre la roca a la derecha. */
export function paintRoot(g, x, y, len, rng, thick = true) {
  for (let k = 0; k < len; k++) {
    const w = thick && k < len * 0.45 ? 2 : 1;
    g.set(x, y, 'soil', k === len - 1 ? 1 : w === 2 ? 3 : 2);
    if (w === 2) g.set(x + 1, y, 'soil', 2);
    if (!g.opaque(x + w, y + 1)) g.set(x + w, y + 1, 'shadow', 0, 90);
    y++;
    const r = rng();
    if (r < 0.22) x--;
    else if (r > 0.78) x++;
    if (k > 2 && rng() < 0.12) {
      // Raicilla
      const d = rng() < 0.5 ? -1 : 1;
      for (let j = 1; j <= 3; j++) g.set(x + d * j, y + (j >> 1), 'soil', j === 3 ? 1 : 2);
    }
  }
}

// ─── Variantes y calcomanías ───────────────────────────────────────────────────────────────────────────────────────
/** Una base distinta: los tramos de las capas cambian solo en el centro (de 2 a 13). */
function variantBase(rng) {
  const runs = [];
  let left = 32;
  while (left > 0) {
    const r = Math.min(left, runs.length % 2 ? irange(rng, 4, 11) : irange(rng, 2, 7));
    runs.push(r);
    left -= r;
  }
  const shift = irange(rng, 0, 31);
  return baseRock(109, (x, y, along) => {
    const inner = x >= RING && x < T - RING && y >= RING && y < T - RING;
    return inner ? seamVisibleAt(along + shift, runs) : seamVisibleAt(along);
  });
}

// Rasgos de bajo contraste: se repiten en muchas celdas, así que nada que se reconozca como «el mismo objeto».
const FILL_FEATURES = [
  [],
  ['light'],
  ['dark'],
  ['flatstone'],
  ['faint'],
  ['vein'],
  ['dark', 'pits'],
  ['light', 'faint'],
  ['pits'],
  ['light', 'flatstone'],
  ['dark', 'vein'],
  ['speck'],
];

function paintFeature(g, kind, rng, lo = 3, hi = 12) {
  const cx = () => irange(rng, lo + 1, hi - 1);
  switch (kind) {
    case 'stone':
      paintStone(g, cx(), cx(), 2.4 + rng() * 1.2, 1.8 + rng() * 0.8, 0.3, { warm: rng() < 0.3 });
      break;
    case 'bigstone':
      paintStone(g, 8, 8, 4.2, 3.2, 0.4, { warm: rng() < 0.5 });
      break;
    case 'flatstone':
      paintStone(g, cx(), cx(), 3 + rng() * 1.5, 2 + rng(), 0.5, { soft: true });
      break;
    case 'faint':
      paintCrack(g, crackPath(rng, irange(rng, lo, hi - 5), lo + 1, irange(rng, 5, 7), rng() < 0.5 ? -1 : 1, 1), [], 1);
      break;
    case 'speck':
      for (let k = 0; k < 4; k++) g.set(cx(), cx(), 'lichen', k % 2);
      break;
    case 'pebbles':
      for (let k = 0; k < 2; k++) paintStone(g, cx(), cx(), 1.3 + rng() * 0.6, 1 + rng() * 0.4, 0.2);
      break;
    case 'crack': {
      const x = irange(rng, lo, hi - 4);
      paintCrack(g, crackPath(rng, x, lo, irange(rng, 6, 9), 1, 1));
      break;
    }
    case 'crack2': {
      const main = crackPath(rng, irange(rng, lo + 2, hi - 2), lo, 9, rng() < 0.5 ? -1 : 1, 1);
      const [bx, by] = main[4];
      paintCrack(g, main, crackPath(rng, bx, by, 4, 1, 0));
      break;
    }
    case 'vein': {
      const x0 = irange(rng, lo, lo + 3);
      const y0 = irange(rng, hi - 3, hi);
      paintVein(g, Array.from({ length: irange(rng, 5, 8) }, (_, k) => [x0 + k, y0 - Math.round(k * 0.8)]));
      break;
    }
    case 'lichen':
      paintLichen(g, cx(), cx(), irange(rng, 1, 2), rng);
      break;
    case 'light':
    case 'dark': {
      // Mancha tramada, más clara (gastada) o más oscura (húmeda): da variación grande sin bordes.
      // Forma de nube (radio con ruido), núcleo lleno y borde salpicado al azar: nada de damero ni rombo.
      const x0 = irange(rng, lo + 2, hi - 2);
      const y0 = irange(rng, lo + 2, hi - 2);
      const rx = 2.5 + rng() * 2;
      const ry = 1.6 + rng() * 1.2;
      const lobes = Array.from({ length: 5 }, () => 0.7 + rng() * 0.5);
      for (let y = Math.floor(y0 - ry - 1); y <= Math.ceil(y0 + ry + 1); y++) {
        for (let x = Math.floor(x0 - rx - 1); x <= Math.ceil(x0 + rx + 1); x++) {
          const a = Math.atan2((y - y0) / ry, (x - x0) / rx);
          const r = lobes[mod(Math.round((a / (Math.PI * 2)) * 5), 5)];
          const d = Math.hypot((x - x0) / rx, (y - y0) / ry) / r;
          if (d > 1 || g.step(x, y) !== 3) continue;
          if (d < 0.6 || rng() < 0.4) g.set(x, y, 'rock', kind === 'light' ? 4 : 2);
        }
      }
      break;
    }
    case 'pits':
      for (let k = 0; k < 3; k++) {
        const x = cx();
        const y = cx();
        g.set(x, y, 'rock', 1);
        g.set(x + 1, y + 1, 'rock', 4);
      }
      break;
  }
}

/** Las 12 variantes del relleno (casilla 15): base con otros tramos de capa y un rasgo en el centro. */
export function fillVariants(seed = 1091) {
  const rng = mulberry32(seed);
  const ref = baseRock();
  return FILL_FEATURES.map((features) => {
    const g = variantBase(rng);
    for (const f of features) paintFeature(g, f, rng);
    return restoreSolidBands(g, ref, 15);
  });
}

/** Variantes de las casillas de borde más comunes de l1: 14 (piso), 11 (techo), 7 y 13 (paredes). */
export function edgeVariants(seed = 1092) {
  const rng = mulberry32(seed);
  const out = {};
  const grassAlt = [
    { top: [2, 2, 1, 2, 2, 1, 2, 3, 2, 1, 2, 2, 1, 2, 2, 3], bottom: [5, 5, 6, 5, 4, 5, 6, 6, 5, 5, 4, 5, 6, 6, 5, 5], blades: [[2, 0], [4, 0], [10, 0], [6, 1], [15, 1], [0, 1]], drapes: [[5, 8], [10, 7], [11, 9]], dry: [7, 12] },
    { top: [2, 2, 1, 3, 2, 1, 1, 2, 3, 2, 2, 1, 2, 2, 2, 3], bottom: [5, 5, 6, 6, 6, 5, 5, 4, 5, 6, 6, 5, 5, 6, 5, 5], blades: [[2, 0], [6, 0], [11, 0], [8, 1], [13, 1], [0, 1]], drapes: [[3, 9], [7, 7], [12, 8]], dry: [5, 9] },
    { top: [2, 2, 1, 2, 2, 3, 2, 1, 2, 2, 1, 2, 3, 2, 2, 3], bottom: [5, 5, 6, 5, 5, 6, 6, 5, 4, 5, 6, 6, 5, 6, 5, 5], blades: [[2, 0], [7, 0], [10, 0], [4, 1], [12, 1], [0, 1]], drapes: [[4, 7], [6, 9], [11, 8], [12, 7]], dry: [3, 9, 13] },
  ];
  // El medio de la laja (17): el musgo y las astillas en otro lugar; los extremos, como la base.
  const slabAlt = [
    { moss: [[8, 5, [2, 2, 1, 2, 1]]], drip: [10], glow: [3, 4], dry: 14, chips: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 1, 0, 0, 1, 0] },
    { moss: [[2, 3, [1, 2, 1]], [11, 3, [2, 2, 1]]], drip: [12], glow: [6, 7], dry: -1, chips: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 1, 0] },
    { moss: [], drip: [], glow: [5, 6, 10], dry: 8, chips: [0, 0, 1, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0] },
  ];
  out[17] = slabAlt.map((variant) => restoreSolidBands(platformCell('center', variant), platformCell('center'), LEFT | RIGHT));
  out[14] = grassAlt.map((grass, k) => {
    const base = variantBase(rng);
    paintFeature(base, ['pebbles', 'crack', 'stone'][k], rng, 4, 12);
    return restoreSolidBands(autotileCell(14, { base, grass }), autotileCell(14), 14);
  });
  const notches = {
    11: [{ bottom: [0, 1, 1, 0, 1, 2, 1, 0, 0, 1, 0, 0, 1, 1, 0, 0] }, { bottom: [0, 1, 1, 0, 0, 0, 0, 1, 2, 2, 1, 0, 0, 1, 0, 0] }],
    7: [{ left: [0, 0, 1, 0, 1, 1, 2, 1, 0, 0, 0, 1, 0, 1, 1, 0] }, { left: [0, 0, 1, 1, 0, 0, 1, 0, 0, 1, 2, 1, 0, 1, 1, 0] }],
    13: [{ right: [0, 1, 0, 1, 2, 1, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0] }, { right: [0, 1, 0, 0, 0, 0, 1, 1, 2, 1, 0, 0, 1, 0, 0, 0] }],
  };
  const cracks = {
    11: [{ bottom: [[6, 4], [10, 2]] }, { bottom: [[3, 2], [8, 4]] }],
    7: [{ left: [[3, 3], [9, 4]] }, { left: [[7, 5], [12, 2]] }],
    13: [{ right: [[6, 4], [11, 2]] }, { right: [[4, 2], [8, 5]] }],
  };
  for (const mask of [11, 7, 13]) {
    out[mask] = notches[mask].map((notch, k) => {
      const base = variantBase(rng);
      paintFeature(base, ['lichen', 'pits'][k], rng, 4, 11);
      return restoreSolidBands(autotileCell(mask, { base, notch, cracks: cracks[mask][k] }), autotileCell(mask), mask);
    });
  }
  return out;
}

/** Calcomanías: grillas transparentes de w × h casillas que se dibujan encima de la roca. */
export function decals(seed = 1093) {
  const rng = mulberry32(seed);
  const out = {};
  const one = (fn) => {
    const g = grid(T, T);
    fn(g);
    return g;
  };
  // Piedritas: grupos de tamaños distintos, alguna medio hundida (suave), alguna cálida.
  out.pebble = [
    [[6, 9, 1.9, 1.3, {}], [10, 11, 1.1, 0.9, { soft: true }]],
    [[5, 7, 1.3, 1, { warm: true }], [9, 10, 2.3, 1.5, { soft: true }], [12, 7, 1, 0.8, {}]],
    [[8, 8, 2.6, 1.6, { soft: true }]],
    [[4, 10, 1.2, 0.9, {}], [7, 11, 1.6, 1.1, {}], [11, 9, 1.1, 0.8, { warm: true }]],
  ].map((list) => one((g) => list.forEach(([x, y, rx, ry, o]) => paintStone(g, x, y, rx, ry, 0.3, o))));
  // Piedras: una acostada a lo largo de las capas, una redonda cálida, una partida en dos.
  out.stone = [
    one((g) => paintStone(g, 8, 8, 4.6, 2.2, 0.6)),
    one((g) => paintStone(g, 8, 8, 3.4, 2.8, 0.4, { warm: true })),
    one((g) => {
      paintStone(g, 6, 8, 3, 2.4, 0.5);
      paintStone(g, 11, 9, 2.4, 2, 0.5, { soft: true });
    }),
  ];
  // Cantos rodados: cuatro formas (ancho, alto, cálido, partido), con o sin liquen.
  out.boulder = [
    [15.5, 18, 12, 9, false, true, true],
    [16, 17, 10.5, 11, true, false, true],
    [15, 19, 13, 8, false, true, false],
    [16.5, 17.5, 9.5, 10, false, false, true],
  ].map(([cx, cy, rx, ry, warm, lichen, crack], k) => {
    const g = grid(2 * T, 2 * T);
    paintStone(g, cx, cy, rx, ry, 0.9, { warm });
    if (crack) paintCrack(g, crackPath(rng, Math.round(cx) - 3 + k, Math.round(cy - ry * 0.6), 7, k % 2 ? -1 : 1, 1));
    if (lichen) paintLichen(g, Math.round(cx - rx * 0.4 + k * 3), Math.round(cy - ry * 0.55), 2, rng);
    for (let i = 0; i < 4; i++) {
      const x = irange(rng, 9, 22);
      const y = irange(rng, 14, 22);
      if (g.step(x, y) >= 3) {
        g.set(x, y, 'rock', 2);
        g.set(x + 1, y + 1, 'rock', 4);
      }
    }
    return g;
  });
  out.strata = [0, 1, 0, 1].map((k, n) => {
    const cols = n < 2 ? 3 : 2;
    const g = grid(cols * T, 2 * T);
    const x0 = 3;
    const x1 = cols * T - 4;
    // Un estrato entre dos capas de la base: grosor parejo (6), puntas que se afinan en 5 px y se deshilachan; cuerpo
    // tramado a un tono de la roca (más claro o más oscuro), sin brillo: es otra capa, no un objeto.
    const ragged = Array.from({ length: x1 + 1 }, () => rng());
    for (let x = x0; x <= x1; x++) {
      // Puntas que se desvanecen tramadas (no en punta de lápiz): en los últimos 9 px cada vez menos píxeles.
      const end = Math.min(x - x0, x1 - x);
      const thick = 5;
      const keep = end >= 9 ? 1 : (end + 1) / 10;
      // Las cortas van una capa más abajo (entran igual en 2 × 2 casillas: 32 px de ancho bajan 16).
      const top = Math.floor(x / 2) + SEAM_OFFSET + (cols === 2 ? SEAM_PERIOD : 0); // línea de la capa de arriba
      const pad = Math.floor((7 - thick) / 2);
      // k 0: una capa que sobresale (filo claro arriba, cara, sombra debajo). k 1: una capa hundida (sombra arriba,
      // fondo oscuro, labio claro abajo).
      for (let d = 1 + pad; d < 1 + pad + thick; d++) {
        const y = top + d;
        const first = d === 1 + pad;
        const last = d === pad + thick;
        const on = (x + y) % 2 === 0 || rng() < 0.3;
        if (rng() > keep) continue;
        let step;
        if (k === 0) step = first ? (ragged[x] > 0.25 ? 5 : 4) : last ? 1 : d === pad + thick - 1 ? 2 : on ? 4 : 3;
        else step = first ? 1 : last ? (ragged[x] > 0.3 ? 4 : 3) : on ? 2 : 3;
        g.set(x, y, 'rock', step);
      }
    }
    return g;
  });
  out.roots = [0, 1].map((k) => {
    const g = grid(T, 2 * T);
    paintRoot(g, k ? 10 : 6, 7, k ? 18 : 22, rng);
    paintRoot(g, k ? 4 : 12, 7, k ? 9 : 11, rng, false);
    if (k) paintRoot(g, 14, 7, 5, rng, false);
    return g;
  });
  out.rootlet = [0, 1].map((k) =>
    one((g) => {
      paintRoot(g, k ? 11 : 5, 7, 6, rng, false);
      paintRoot(g, k ? 6 : 10, 7, 4, rng, false);
    }),
  );
  out.crystal = ['violet', 'cyan', 'mixed'].map((kind) =>
    one((g) => {
      paintCrack(g, [[3, 12], [4, 11], [5, 11], [6, 10], [7, 9], [8, 9], [9, 8], [10, 7], [11, 7], [12, 6]]);
      const r1 = kind === 'mixed' ? 'violet' : kind;
      const r2 = kind === 'mixed' ? 'cyan' : kind;
      paintCrystal(g, 5, 10, 5, -1, r1);
      paintCrystal(g, 8, 8, 6, 0, r2);
      paintCrystal(g, 11, 6, 4, 1, r1);
    }),
  );
  out.lichen = [0, 1, 2].map((k) => one((g) => paintLichen(g, 7 + k, 7 + (k % 2) * 2, 2 + (k === 1 ? 1 : 0), rng)));
  out.crack = [0, 1, 2].map((k) =>
    one((g) => {
      const main = crackPath(rng, 4 + k * 3, 2, 11, k === 1 ? -1 : 1, 1);
      paintCrack(g, main, k === 2 ? [] : crackPath(rng, main[5][0], main[5][1], 4, k ? 1 : -1, 0));
    }),
  );
  // El pasto de una esquina de arriba que sale 3 px por encima del aire y cae.
  const overhang = (g, flip) => {
    const cols = [[15, 3, 8], [14, 4, 7], [13, 5, 6]];
    for (const [cx, y0, y1] of cols) {
      const x = flip ? T - 1 - cx : cx;
      for (let y = y0; y <= y1; y++) g.set(x, y, 'moss', y === y1 ? 1 : y === y0 ? 4 : y < y0 + 2 ? 3 : 2);
    }
    g.set(flip ? 1 : 14, 2, 'moss', 5);
    g.set(flip ? 0 : 15, 2, 'moss', 4);
  };
  out.overhangLeft = [one((g) => overhang(g, false))];
  out.overhangRight = [one((g) => overhang(g, true))];
  return out;
}

// ─── Las dos hojas ─────────────────────────────────────────────────────────────────────────────────────────────────
export { TILESET_COLUMNS, TILESET_ROWS, DETAIL_COLUMNS };

/** public/assets/tiles/cerro.png: las 28 casillas de siempre (ASSETS §6). */
export function buildCerroTileset() {
  const cells = [];
  for (let mask = 0; mask < 16; mask++) cells[mask] = mask === 15 ? baseRock() : autotileCell(mask);
  cells[16] = platformCell('left');
  cells[17] = platformCell('center');
  cells[18] = platformCell('right');
  cells[19] = spikesCell();
  cells[20] = waterCell(true);
  cells[21] = waterCell(false);
  cells[22] = crackedCell();
  cells[23] = grassTuftCell();
  cells[24] = flowersCell();
  cells[25] = stonesCell();
  return buildTilesetImage(cells);
}

/**
 * public/assets/tiles/detalle/cerro.png y su .json (S109): variantes del relleno y de los bordes, y calcomanías.
 * El JSON dice qué casilla es qué: `fill` (variantes de la 15), `edges` (máscara → variantes) y `decals`
 * (tipo → [{ w, h, ids, flip }], ids en filas de w; `flip`: se puede espejar a lo ancho).
 */
export function buildCerroDetail() {
  // Las capas siguen la pendiente de la base y el pasto de las esquinas mira a un lado: esas no se espejan.
  return buildDetailSheet({ fill: fillVariants(), edges: edgeVariants(), decals: decals(), fixed: ['strata', 'overhangLeft', 'overhangRight'] });
}

/** Lo que usa tools/make-terrain-tiles.mjs. */
export const buildTileset = buildCerroTileset;
export const buildDetail = buildCerroDetail;
