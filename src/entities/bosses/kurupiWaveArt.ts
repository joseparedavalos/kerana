import { bayer, hash, makePixels, mix, put, alphaAt, type AtlasFrame, type Pixels } from '../../systems/pixelArt';

// La onda del pisotón de Kurupi (S114): la tierra que revienta el suelo. La cresta que corre (tierra colorada con la
// hojarasca rota encima, terrones, raíces y hojas), su derrumbe, las grietas que deja y lo que salta (terrones, raíces,
// hojas y polvo). Lógica pura: píxeles en memoria que KurupiWaves sube una sola vez como atlas.

// ── Colores ───────────────────────────────────────────────────────────────
// El piso de selva (S113), medido en la casilla 14 de selva.png y sus 8 variantes de la hoja de detalle: los tonos que
// más se repiten en las filas 0 a 5 (hojarasca y musgo), 6 a 11 (humus) y 12 a 15 (tierra colorada). El más oscuro del
// humus (#0e0a08, el contorno de S113) y el terrón con luz de la tierra (#704131) son de la misma rampa de S113.
const LITTER = [0x2b1b0f, 0x462c16, 0x64401f, 0x83592a, 0xa37437] as const;
const MOSS = [0x1d2a14, 0x2b3d1a, 0x3d5320, 0x536b28, 0x6f8732, 0x8ea343] as const;
const HUMUS = [0x0e0a08, 0x17110c, 0x211811, 0x2c2017] as const;
const EARTH = [0x341b14, 0x3a1f17, 0x40221a, 0x46261c, 0x552f22, 0x704131] as const;
const ROOT = [0x362414, 0x48311c, 0x5c4126, 0x745633] as const;
/** Piedra mojada del suelo del monte (S113, `stone`): una piedrita suelta en la tierra que sube. */
const STONE = [0x252b26, 0x474f46, 0x5d655a, 0x787f72] as const;
/**
 * Las hojas de Kurupi: el musgo y las hojas de su cabeza, la barba y el taparrabos (kurupi.png: H 0,12 a 0,22 y
 * S > 0,55, en sextos de luminancia, y el 3 % más claro).
 */
const LEAF = [0x382e0b, 0x483d11, 0x554913, 0x635616, 0x75651a, 0x917e22, 0xab9427] as const;
/** La niebla de l5 (S113, `fog`): el polvo es la hojarasca y la tierra molidas en ese aire (ocre, no rosado). */
const FOG = 0x94a787;
const DUST = [mix(EARTH[3], FOG, 0.1), mix(LITTER[2], FOG, 0.2), mix(LITTER[3], FOG, 0.28), mix(LITTER[4], FOG, 0.4)] as const;
const OUTLINE = HUMUS[0];

/** Todos los colores que puede tener un píxel de la onda (los tests lo comprueban: nada liso ni inventado). */
export const WAVE_COLORS: readonly number[] = [...LITTER, ...MOSS, ...HUMUS, ...EARTH, ...ROOT, ...STONE, ...LEAF, ...DUST];

// ── Medidas ───────────────────────────────────────────────────────────────
/** Píxeles de arte por unidad de la cresta y de lo que salta: los de Kurupi (igual de nítidos que él). */
export const WAVE_DETAIL = 2;
/** Píxeles de arte por unidad de las grietas: los del tileset, así se leen como parte del piso. */
export const CRACK_DETAIL = 1;
/** Aire a cada lado de la masa de la cresta (px de arte): los labios de hojarasca que levanta y lo que tira adelante. */
const SIDE = 7;
/** Filas del lienzo bajo la línea del suelo: la base que sale de la tierra y los labios rotos. */
const BELOW = 6;
/** Aire sobre la masa para los terrones que salta la cresta. */
const ABOVE = 8;

export interface CrestSize {
  width: number;
  height: number;
  /** Fila del lienzo que va en la línea del suelo. */
  floor: number;
  /** Columnas de la masa, contorno incluido: [left, right]. Miden lo que la hitbox. */
  left: number;
  right: number;
}

/** El lienzo de la cresta para una hitbox de `width` × `height` unidades (GAMEPLAY.kurupi.waveWidth y waveHeight). */
export function crestSize(width: number, height: number): CrestSize {
  const mass = Math.round(width * WAVE_DETAIL);
  const tall = Math.round(height * WAVE_DETAIL);
  return { width: mass + SIDE * 2, height: tall + ABOVE + BELOW, floor: tall + ABOVE, left: SIDE, right: SIDE + mass - 1 };
}

/** Grietas: 16 × 8 px de tileset, con la línea del suelo en la fila 2 (encima, los terrones de hojarasca que levanta). */
export const CRACK = { width: 16, height: 8, floor: 2, seam: 4 } as const;

// ── La cresta ─────────────────────────────────────────────────────────────

/** Cuadros de la cresta en marcha (la tierra que se revuelve) y del derrumbe. */
export const CREST_FRAMES = 4;
export const COLLAPSE_FRAMES = 2;

/** Contorno selectivo: oscuro abajo y a la derecha (la sombra), marrón arriba y a la izquierda (de donde viene la luz). */
const OUTLINE_LIT = EARTH[0];

/**
 * Las placas de tierra que revientan el suelo, de atrás para adelante (la cresta mira a la derecha): columna del pie
 * (desde el borde de la masa), alto y grueso (px) y cuánto se inclinan (radianes; + hacia adelante). Las de atrás caen
 * para atrás, la del medio sube derecha (la cresta) y la de adelante se tira hacia donde corre. Altas en toda la
 * hitbox: lo que daña se ve.
 */
const CHUNKS_AT: readonly (readonly [number, number, number, number])[] = [
  [3, 12, 8, -0.38],
  [10, 15, 9, -0.22],
  [17, 18, 9, -0.06],
  [24, 20, 10, 0.12],
  [31, 17, 8, 0.42],
];
/** Cuánto sube y baja cada placa en la marcha (px, por cuadro): se revuelven a destiempo. */
const CHURN = [0, 1, 1, 0];

interface Chunk {
  bx: number;
  height: number;
  half: number;
  sin: number;
  cos: number;
  seed: number;
}

function crestChunks(s: CrestSize, f: number, squash: number): Chunk[] {
  const top = s.floor - ABOVE;
  return CHUNKS_AT.map(([at, hgt, thick, lean], k) => {
    const churn = squash < 1 ? 0 : CHURN[(f + k) % 4] - (k % 2);
    const a = (lean + (squash < 1 ? lean * 0.8 : 0.04 * CHURN[(f + k + 1) % 4])) * (squash < 1 ? 1.6 : 1);
    return {
      bx: s.left + 1 + at,
      height: Math.min(top, Math.round((hgt + churn) * squash)),
      half: thick / 2,
      sin: Math.sin(a),
      cos: Math.cos(a),
      seed: k * 7 + 3,
    };
  });
}

/**
 * Qué parte de una placa cae en el píxel (x, y), o null: `d` es la distancia al borde de arriba (la hojarasca), `v` la
 * posición a lo ancho (-1 el lado de atrás, con luz; 1 el de adelante, en sombra).
 */
function chunkAt(c: Chunk, x: number, y: number, floor: number): { d: number; v: number } | null {
  const dx = x + 0.5 - c.bx;
  const dy = y + 0.5 - floor;
  const u = dx * c.sin - dy * c.cos;
  const w = dx * c.cos + dy * c.sin;
  if (u < -1 || u > c.height) return null;
  // Se afina un poco hacia arriba y el filo queda quebrado.
  const half = c.half * (1 - (0.3 * Math.max(0, u)) / c.height);
  if (Math.abs(w) > half) return null;
  const jag = Math.round(hash(Math.floor(w + c.half), c.seed) * 3);
  if (u > c.height - jag) return null;
  return { d: c.height - jag - u, v: w / half };
}

/** El color de un píxel de placa: hojarasca arriba, humus, y la tierra colorada en terrones con luz atrás. */
function chunkColor(x: number, y: number, d: number, v: number, seed: number): number {
  if (d < 1.2) {
    const n = hash(x * 1.9, seed);
    return v < 0.2 ? (n < 0.4 ? MOSS[5] : LITTER[4]) : n < 0.5 ? MOSS[4] : LITTER[3];
  }
  if (d < 2.2) return hash(x * 1.3, seed) < 0.5 ? (v < 0 ? LITTER[3] : MOSS[4]) : v < 0 ? MOSS[4] : LITTER[2];
  if (d < 3.2) return v < 0 ? LITTER[2] : MOSS[3];
  if (d < 4.2) return hash(x, seed + 1) < 0.5 ? LITTER[1] : HUMUS[3];
  if (d < 5.2) return HUMUS[hash(x * 2.3, y) < 0.5 ? 2 : 3];
  // Tierra: el lado de atrás con luz, el de adelante en sombra; terrones de 2 × 2 y motas sueltas (sin grilla).
  const n = hash(Math.floor(x / 2) * 3.1 + seed, Math.floor((y + (x % 2)) / 2) * 1.7);
  const speck = hash(x * 1.31 + seed, y * 0.77);
  if (v < -0.55) return n < 0.4 ? EARTH[5] : EARTH[4];
  if (v > 0.78) return n < 0.6 ? EARTH[1] : EARTH[0];
  if (speck < 0.07) return HUMUS[1];
  if (speck > 0.92) return EARTH[4];
  return n < 0.45 ? EARTH[2] : n < 0.75 ? EARTH[3] : EARTH[1];
}

function line(p: Pixels, x0: number, y0: number, x1: number, y1: number, color: number): void {
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    put(p, x0, y0, color);
    if (x0 === x1 && y0 === y1) return;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x0 += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y0 += sy;
    }
  }
}

/** Contorno alrededor de lo pintado, solo sobre el suelo (abajo, la base se funde con el piso). */
function outline(p: Pixels, lastRow: number): void {
  const marks: number[] = [];
  for (let y = 0; y <= lastRow; y++) {
    for (let x = 0; x < p.width; x++) {
      if (alphaAt(p, x, y) > 0) continue;
      // Del lado de la luz (lo pintado queda abajo o a la derecha), marrón; del lado de la sombra, casi negro.
      const lit = alphaAt(p, x + 1, y) > 0 || (y + 1 <= lastRow && alphaAt(p, x, y + 1) > 0);
      const shade = alphaAt(p, x - 1, y) > 0 || alphaAt(p, x, y - 1) > 0;
      if (lit || shade) marks.push(x, y, shade ? 1 : 0);
    }
  }
  for (let i = 0; i < marks.length; i += 3) put(p, marks[i], marks[i + 1], marks[i + 2] ? OUTLINE : OUTLINE_LIT);
}

/** Un terrón en el aire, de 2 o 3 px de ancho: luz arriba a la izquierda y la sombra (1 px) abajo y a la derecha. */
function flyingClod(p: Pixels, x: number, y: number, w: number, k: number): void {
  const turf = k % 3 === 0;
  const lit = turf ? MOSS[5] : EARTH[5];
  const body = turf ? LITTER[3] : EARTH[4];
  for (let i = 0; i < w; i++) put(p, x + i, y, i === 0 ? lit : body);
  for (let i = 0; i < w; i++) put(p, x + i, y + 1, i === w - 1 ? EARTH[1] : turf ? LITTER[2] : EARTH[3]);
  for (let i = w === 3 ? 1 : 0; i < w; i++) put(p, x + i, y + 2, HUMUS[0]);
  put(p, x + w, y + 1, HUMUS[0]);
}

/**
 * Un cuadro de la cresta, mirando a la derecha. `f`: cuadro de la marcha (0 a 3) o del derrumbe (`collapse` 1 o 2:
 * la tierra se asienta y no tira terrones). La tierra que sube mide lo que la hitbox; encima, tres placas de
 * hojarasca rota que se levantan y se inclinan (la de adelante se curva sobre el frente), terrones que saltan para
 * atrás y lo que se desmorona adelante; abajo sale de la tierra y levanta dos labios de hojarasca con la boca oscura.
 */
export function paintCrest(s: CrestSize, f: number, collapse = 0): Pixels {
  const p = makePixels(s.width, s.height);
  const squash = collapse === 0 ? 1 : collapse === 1 ? 0.55 : 0.3;
  const g = collapse === 0 ? f % 4 : 1;
  const floor = s.floor;
  const L = s.left + 1;
  const list = crestChunks(s, g, squash);
  // Lo alto de lo pintado en cada columna (para apoyar terrones, raíces y hojas).
  const tops: number[] = new Array(s.width).fill(floor);
  // Un montón bajo une los pies de las placas: la tierra revuelta.
  for (let x = L; x <= s.right - 1; x++) {
    const mound = Math.round((3 + hash(Math.floor(x / 2), g + 5) * 3) * Math.max(squash, 0.6));
    for (let up = 0; up < mound; up++) put(p, x, floor - 1 - up, up === mound - 1 ? EARTH[up % 2 === 0 ? 3 : 4] : hash(x, up) < 0.5 ? EARTH[2] : EARTH[1]);
    tops[x] = floor - mound;
  }
  // Las placas, de atrás para adelante (la de adelante tapa a las demás).
  for (const c of list) {
    for (let y = 0; y < floor; y++) {
      for (let x = 0; x < s.width; x++) {
        const at = chunkAt(c, x, y, floor);
        if (!at) continue;
        put(p, x, y, chunkColor(x, y, at.d, at.v, c.seed));
        if (y < tops[x]) tops[x] = y;
      }
    }
  }
  const topY = (x: number): number => tops[Math.max(0, Math.min(s.width - 1, x))];
  // Una piedrita mojada que sube con la tierra.
  if (collapse === 0) {
    const sx = L + 17 + (g % 2);
    const sy = topY(sx) + 7;
    put(p, sx, sy, STONE[3]);
    put(p, sx + 1, sy, STONE[2]);
    put(p, sx, sy + 1, STONE[1]);
    put(p, sx + 1, sy + 1, STONE[1]);
    put(p, sx + 2, sy + 1, STONE[0]);
  }
  outline(p, floor - 1);
  if (collapse === 0) {
    // Los terrones que la cresta tira para atrás (claros: tierra con luz u hojarasca, con su sombra de 1 px).
    for (let k = 0; k < 4; k++) {
      const phase = ((g + k) % 4) / 4;
      const bx = L + 6 + k * 7 + (k % 2) - Math.round(phase * 4);
      const rise = 2 + Math.round(phase * 5) + (k % 2);
      flyingClod(p, bx, Math.max(1, topY(bx) - rise - 3), k % 2 === 0 ? 3 : 2, k + g);
    }
    // Lo que se desmorona por el frente.
    flyingClod(p, s.right + (g % 2), floor - 10 + g, 2, g + 1);
    flyingClod(p, s.right + 3, floor - 5 + ((g + 2) % 4), 2, g + 2);
  } else {
    flyingClod(p, L + 1, floor - 3, 3, 1);
    flyingClod(p, s.right - 4, floor - 2, 2, 3);
  }
  // La base sale de la tierra: humus oscuro que se corta irregular contra la hojarasca del piso.
  const keep = [1, 0.85, 0.45, 0.15];
  for (let x = s.left; x <= s.right; x++) {
    for (let j = 0; j < keep.length; j++) {
      if (hash(x * 0.93, j * 3.7) >= keep[j]) continue;
      put(p, x, floor + j, j === 0 ? HUMUS[1] : hash(x, j) < 0.6 ? HUMUS[2] : EARTH[0]);
    }
  }
  // Los labios: la hojarasca del piso, levantada y rota a los dos lados, con la boca de la grieta debajo.
  const lip = collapse === 2 ? 0 : 1;
  for (let i = 0; i < 5; i++) {
    // Atrás: sube hacia la masa.
    const bx = s.left - 5 + i;
    const by = floor - lip - (i >> 1);
    put(p, bx, by, i % 2 === 0 ? LITTER[4] : MOSS[4]);
    put(p, bx, by + 1, LITTER[2]);
    for (let y = by + 2; y <= floor + 1; y++) put(p, bx, y, HUMUS[0]);
    // Adelante: la cara en sombra; baja alejándose de la masa.
    const fx = s.right + 1 + i;
    const fy = floor - lip - ((4 - i) >> 1);
    put(p, fx, fy, i % 2 === 0 ? LITTER[3] : MOSS[3]);
    put(p, fx, fy + 1, LITTER[1]);
    for (let y = fy + 2; y <= floor + 1; y++) put(p, fx, y, HUMUS[0]);
  }
  if (collapse === 0) {
    // Raíces que la tierra arranca: una asoma bajo la placa del medio hacia atrás, otra cuelga por el frente.
    const wave = g % 2;
    const ax = L + 11;
    const ay = topY(ax) + 2;
    line(p, ax, ay, ax - 4, ay - 4 - wave, ROOT[1]);
    line(p, ax - 4, ay - 4 - wave, ax - 7, ay - 5, ROOT[1]);
    put(p, ax - 4, ay - 5 - wave, ROOT[2]);
    put(p, ax - 7, ay - 5, ROOT[3]);
    const fx = s.right - 6;
    const fy = topY(fx) + 4;
    line(p, fx, fy, s.right + 2, fy - 1 + wave, ROOT[1]);
    put(p, s.right + 3, fy + wave, ROOT[0]);
    put(p, s.right + 2, fy - 2 + wave, ROOT[3]);
    // Dos hojas de Kurupi sobre la placa de adelante (de su barba y su taparrabos: el monte es él).
    const lx = L + 24;
    const ly = topY(lx) - 1;
    put(p, lx, ly, LEAF[5]);
    put(p, lx + 1, ly, LEAF[6]);
    put(p, lx + 2, ly, LEAF[4]);
    put(p, lx + 1, ly - 1, LEAF[3]);
    put(p, L + 6, topY(L + 6) - 1, LEAF[5]);
    put(p, L + 7, topY(L + 6) - 1, LEAF[4]);
  }
  return p;
}

// ── Las grietas ───────────────────────────────────────────────────────────

/**
 * Por dónde corre la grieta en cada variante (filas bajo `CRACK.seam`, la primera fila llena del piso): entra y sale en
 * la misma fila, así se empalman; nunca sube a las filas ralas del borde (flotaría sobre el fondo).
 */
const SEAMS: readonly (readonly number[])[] = [
  [0, 0, 0, 1, 1, 1, 2, 2, 1, 1, 1, 0, 0, 0, 0, 0],
  [0, 0, 1, 1, 2, 1, 1, 0, 0, 1, 1, 2, 1, 0, 0, 0],
  [0, 0, 0, 0, 1, 1, 1, 2, 2, 2, 1, 1, 0, 0, 0, 0],
];
/** Ramas que bajan de la grieta: [columna, hacia dónde, largo]. */
const BRANCHES: readonly (readonly [number, number, number])[][] = [
  [
    [3, 1, 2],
    [10, -1, 2],
  ],
  [
    [5, -1, 2],
    [12, 1, 1],
  ],
  [
    [2, 1, 2],
    [9, 1, 1],
  ],
];
/** Terrones de hojarasca que levanta (columna y ancho), sobre el suelo. */
const CHUNKS: readonly (readonly [number, number])[][] = [
  [
    [2, 2],
    [11, 2],
  ],
  [
    [4, 3],
    [12, 1],
  ],
  [
    [1, 1],
    [7, 3],
  ],
];
export const CRACK_VARIANTS = SEAMS.length;
export const CRACK_STAGES = 3;

/**
 * Una grieta del piso (a la escala del tileset, `CRACK_DETAIL`). `stage` 0: abierta, la boca honda y oscura con la
 * tierra colorada a la vista debajo, los labios de hojarasca rota con luz, ramas y terrones levantados; 1: se cierra
 * (una línea, menos tierra, los terrones caídos); 2: quedan unos pocos píxeles. Lo oscuro va desde la primera fila
 * llena del piso (la 2 de la casilla): en las de arriba, ralas, flotaría sobre el fondo.
 */
export function paintCrack(variant: number, stage: number): Pixels {
  const p = makePixels(CRACK.width, CRACK.height);
  const seam = SEAMS[variant % SEAMS.length];
  const gape = (x: number): boolean => stage === 0 && x >= 4 && x <= 11;
  for (let x = 0; x < CRACK.width; x++) {
    const y = CRACK.seam + seam[x];
    if (stage === 2) {
      if (hash(x * 1.3, variant + 4) < 0.5) put(p, x, y, HUMUS[1]);
      continue;
    }
    put(p, x, y, HUMUS[0]);
    // El escalón entre dos columnas: la grieta sigue sin cortarse.
    const next = x + 1 < CRACK.width ? CRACK.seam + seam[x + 1] : y;
    if (next > y) put(p, x, y + 1, HUMUS[0]);
    // El labio de arriba: la hojarasca rota, con luz.
    if (hash(x, variant * 3 + stage) < (stage === 0 ? 0.75 : 0.35)) put(p, x, y - 1, x % 3 === 0 ? MOSS[5] : LITTER[4]);
    // La tierra colorada a la vista: en la boca, honda (humus y la tierra con luz debajo); en el resto, a trechos.
    if (gape(x)) {
      put(p, x, y + 1, HUMUS[1]);
      put(p, x, y + 2, x % 2 === 0 ? EARTH[5] : EARTH[4]);
    } else if (hash(x * 0.7, variant + stage) < (stage === 0 ? 0.6 : 0.35)) put(p, x, y + 1, EARTH[stage === 0 ? 5 : 4]);
  }
  if (stage === 0) {
    for (const [bx, dir, len] of BRANCHES[variant % BRANCHES.length]) {
      for (let i = 1; i <= len; i++) put(p, bx + dir * i, CRACK.seam + seam[bx] + (gape(bx) ? 2 : 1) + i, HUMUS[1]);
    }
    for (const [cx, w] of CHUNKS[variant % CHUNKS.length]) {
      for (let i = 0; i < w; i++) {
        put(p, cx + i, CRACK.floor - 1, i === 0 ? MOSS[5] : LITTER[4]);
        put(p, cx + i, CRACK.floor, LITTER[2]);
        put(p, cx + i, CRACK.floor + 1, LITTER[0]);
      }
    }
  } else if (stage === 1) {
    for (const [cx] of CHUNKS[variant % CHUNKS.length]) put(p, cx, CRACK.floor + 1, EARTH[4]);
  }
  return p;
}

// ── Lo que salta ──────────────────────────────────────────────────────────

/** Dibujos a mano: cada letra, un color (`.` vacío). */
function fromRows(rows: readonly string[], colors: Readonly<Record<string, number>>): Pixels {
  const w = Math.max(...rows.map((r) => r.length));
  const p = makePixels(w, rows.length);
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const c = colors[row[x]];
      if (c !== undefined) put(p, x, y, c);
    }
  });
  return p;
}

const CLOD_COLORS = { o: OUTLINE, d: EARTH[1], e: EARTH[2], m: EARTH[3], l: EARTH[4], h: EARTH[5], t: LITTER[3], g: MOSS[4], n: HUMUS[2] };
/** Terrones de 1,5 a 2,5 unidades con su contorno: de tierra colorada, uno con hojarasca encima y uno de humus. */
export const CLODS: readonly (readonly string[])[] = [
  ['.oo.', 'olmo', 'omdo', '.oo.'],
  ['.o.', 'olo', '.o.'],
  ['.ooo.', 'ogtgo', 'olmdo', '.ooo.'],
  ['ooo.', 'ohmo', 'omdo', '.ooo'],
  ['.oo', 'ono', 'oo.'],
];

const ROOT_COLORS = { d: ROOT[0], r: ROOT[1], h: ROOT[2], t: ROOT[3] };
/** Raicillas arrancadas: de 1 px, oscuras (se leen contra el verde del monte), con la punta rota más clara. */
export const ROOTS: readonly (readonly string[])[] = [
  ['..ht', '.r..', 'r...'],
  ['dr..', '..rt'],
  ['t...', '.r..', '.r..', '..h.'],
  ['...t.', '..r.r', 'rh...'],
];

/**
 * Hojas que aletean, a 2 píxeles por unidad: de frente, de canto, del revés y de canto (el aleteo se ve cambiando de
 * cuadro, sin girar la textura). `b` la hoja, `l` su luz, `s` su sombra y el revés, `o` el contorno.
 */
const LEAF_SHAPES: Readonly<Record<string, readonly (readonly string[])[]>> = {
  h: [
    ['..oooo..', '.obbllo.', 'obbbbsso', '.oossoo.'],
    ['..oooo..', 'obbbbsso', '.oooo...'],
    ['..oooo..', '.ossbbo.', 'osssssso', '.oooooo.'],
    ['..oooo..', 'osssssso', '.oooo...'],
  ],
  d: [
    ['...ooo', '..oblo', '.obbso', 'obbso.', 'osso..', 'oo....'],
    ['....oo', '...obo', '..obo.', '.oso..', 'oo....'],
    ['...ooo', '..osso', '.osbso', 'osbso.', 'osso..', 'oo....'],
    ['....oo', '...oso', '..oso.', '.oso..', 'oo....'],
  ],
};
/** Dos clases de hoja: las de Kurupi (oliva) y las de la hojarasca del piso (ocre). */
const LEAF_KINDS: Readonly<Record<string, Readonly<Record<string, number>>>> = {
  k: { o: LEAF[0], b: LEAF[4], l: LEAF[6], s: LEAF[2] },
  t: { o: LITTER[0], b: LITTER[3], l: LITTER[4], s: LITTER[1] },
};
export const LEAF_FLUTTERS: readonly string[] = Object.keys(LEAF_KINDS).flatMap((k) => Object.keys(LEAF_SHAPES).map((s) => `${k}${s}`));
export const LEAF_FLUTTER_FRAMES = 4;

/** Polvo: un puñado tramado que crece y se ralea (sin alfa: cada píxel está o no está). */
export const DUST_FRAMES = 5;
const DUST_SIZE = { width: 13, height: 11 } as const;
const DUST_RADIUS = [2.2, 3.2, 4.2, 5, 5.7];
const DUST_DENSITY = [1, 1, 0.9, 0.62, 0.32];

export function paintDust(i: number): Pixels {
  const p = makePixels(DUST_SIZE.width, DUST_SIZE.height);
  const cx = (DUST_SIZE.width - 1) / 2;
  const cy = DUST_SIZE.height - 1 - DUST_RADIUS[DUST_RADIUS.length - 1];
  const r = DUST_RADIUS[i];
  for (let y = 0; y < DUST_SIZE.height; y++) {
    for (let x = 0; x < DUST_SIZE.width; x++) {
      // Un poco más ancho que alto: el puñado se aplasta contra el suelo.
      const dx = (x - cx) / 1.15;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > r) continue;
      // Se deshace en grumos de 2 × 2 (no en damero): cada grumo se va cuando su ruido pasa la densidad del cuadro.
      const fill = DUST_DENSITY[i] * (1 - (0.3 * dist) / r);
      const lump = hash(Math.floor((x + (y % 2)) / 2) * 2.7, Math.floor(y / 2) * 1.9);
      if (0.6 * lump + 0.4 * (bayer(x, y) + 0.5) >= fill) continue;
      // Luz arriba a la izquierda, sombra abajo a la derecha, el corazón más claro.
      const lit = dx + dy < -r * 0.3 ? 1 : dx + dy > r * 0.5 ? -1 : 0;
      const core = dist < r * 0.45 ? 1 : 0;
      put(p, x, y, DUST[Math.max(0, Math.min(DUST.length - 1, 1 + lit + core))]);
    }
  }
  return p;
}

// ── El atlas ──────────────────────────────────────────────────────────────

export const crestFrameName = (i: number): string => `crest_${i}`;
export const collapseFrameName = (i: number): string => `collapse_${i}`;
export const crackFrameName = (variant: number, stage: number): string => `crack_${variant}_${stage}`;
export const clodFrameName = (i: number): string => `clod_${i}`;
export const rootFrameName = (i: number): string => `root_${i}`;
export const leafFrameName = (flutter: string, i: number): string => `leaf_${flutter}_${i}`;
export const dustFrameName = (i: number): string => `dust_${i}`;

/** Todos los cuadros de la onda, para una hitbox de `width` × `height` unidades. */
export function waveFrames(width: number, height: number): AtlasFrame[] {
  const s = crestSize(width, height);
  const frames: AtlasFrame[] = [];
  for (let i = 0; i < CREST_FRAMES; i++) frames.push({ name: crestFrameName(i), px: paintCrest(s, i) });
  for (let i = 0; i < COLLAPSE_FRAMES; i++) frames.push({ name: collapseFrameName(i), px: paintCrest(s, 0, i + 1) });
  for (let v = 0; v < CRACK_VARIANTS; v++) for (let st = 0; st < CRACK_STAGES; st++) frames.push({ name: crackFrameName(v, st), px: paintCrack(v, st) });
  CLODS.forEach((r, i) => frames.push({ name: clodFrameName(i), px: fromRows(r, CLOD_COLORS) }));
  ROOTS.forEach((r, i) => frames.push({ name: rootFrameName(i), px: fromRows(r, ROOT_COLORS) }));
  for (const [kind, colors] of Object.entries(LEAF_KINDS)) {
    for (const [shape, rows] of Object.entries(LEAF_SHAPES)) rows.forEach((r, i) => frames.push({ name: leafFrameName(`${kind}${shape}`, i), px: fromRows(r, colors) }));
  }
  for (let i = 0; i < DUST_FRAMES; i++) frames.push({ name: dustFrameName(i), px: paintDust(i) });
  return frames;
}
