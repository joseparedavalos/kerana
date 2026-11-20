// Tileset del pueblo (l4, Capiatá a la hora de la siesta) dibujado por código (S112). Lo escribe
// tools/make-terrain-tiles.mjs (npm run terrain-tiles -- pueblo); lo prueba tests/puebloTiles.test.ts. Lo común (azar,
// grilla, paleta, armado de las hojas) está en tile-art.mjs.
//
// Dos materiales. Las casas (el tileset, las 28 casillas): adobe encalado, con la cal a pincel, manchas de humedad y
// grietas finas, y arriba tejas españolas de terracota que desbordan el filo. La calle (la hoja de detalle, por zonas):
// la masa que llega al borde de abajo es tierra colorada; arriba, empedrado en la línea del piso o ladrillo en los pisos
// elevados y bajo techo; donde una casa se apoya en la calle, su zócalo pintado (ocre o azul gastado) y, debajo, el
// cimiento de piedra. Como en cerro y en el estero, cada material tiene una base de 16 × 16 que se repite sin costura en
// las dos direcciones y cada tratamiento de borde depende solo de la posición en la casilla y es periódico a lo largo de
// su lado. Las variantes cambian solo el centro (de 2 a 13). Nada de ventanas, puertas ni nichos pintados: se leerían
// como huecos.
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

// ─── Paleta (medida en public/assets/backgrounds/l4_far.jpg y en los props de l4; ver docs/ASSETS.md §6) ───────────
// Cal: las paredes del fondo (#939187, #a09c91, #b6aea2, #c9c0b4, #d4cbbd, #ded5c5, #e3dbca), con las sombras más
// hondas y cálidas porque el terreno va adelante, y una luz de siesta arriba. Humedad: el adobe sucio del pie de las
// casas (#514635, #6b5d49, #8b7a62). Adobe: el revoque caído, más colorado (tierra paraguaya). Teja: los techos
// (#4c352b, #5b4338, #6e4a44, #77574a, #895e52, #956a55, #a57964), más saturada y con más contraste adelante. Lapacho:
// la copa (#7d555c … #dfb4b5), los pétalos más encendidos. Tierra: el suelo de la plaza (#4d402f … #ceb08a) corrido a
// la tierra colorada. Piedra: el muro de piedra del fondo (#333029 … #bdab95). Madera: el corredor (#1f1a13 … #665845)
// y los props. Pasto: el de la plaza (#212417 … #686b46), más vivo.
export const RAMPS = {
  cal: ['#4b463e', '#6b655a', '#8b8476', '#a69e8f', '#beb6a5', '#d3cbb9', '#e4dcc9', '#f1ead7'],
  /** Medios tonos de la cal (apenas más oscuro y apenas más claro que la base): las manchas suaves del encalado. */
  calm: ['#cac2b0', '#dcd4c2'],
  damp: ['#5a5040', '#746753', '#90826a', '#a89a7f', '#bdb095'],
  adobe: ['#3d2519', '#5a3725', '#764a31', '#91603f', '#a97651', '#bf8d66'],
  teja: ['#2a150e', '#45221a', '#663224', '#86432c', '#a35535', '#bd6b43', '#d48759', '#e6a576'],
  moss: ['#232b17', '#364221', '#4f5d2b', '#6a7a37', '#879747', '#a6b35d'],
  lichen: ['#7f7a3c', '#a69c4e', '#c8bd74'],
  petal: ['#6e2c4f', '#9a4170', '#c25f91', '#de85b0', '#f2b4d0'],
  earth: ['#24160f', '#3a2418', '#553422', '#6e452c', '#885838', '#a26e48', '#ba875e'],
  /** Medios tonos de la tierra (alrededor de la base). */
  earthm: ['#663f29', '#784e33'],
  sand: ['#6e563d', '#8b7152', '#a98d6a', '#c4aa84'],
  stone: ['#29251f', '#403a33', '#5a534a', '#766e63', '#938a7d', '#b0a798', '#ccc4b5'],
  sandstone: ['#4a3124', '#684634', '#875d45', '#a47658', '#bd9070', '#d2ab8a'],
  brick: ['#3a1c13', '#58291b', '#773824', '#94492f', '#ae5c3d', '#c57551', '#d9946d'],
  wood: ['#1c120c', '#31211a', '#4a3224', '#664530', '#835a3d', '#a07250', '#bb8c66'],
  iron: ['#141419', '#22222a', '#34343f', '#4c4c58', '#6c6c78', '#9696a2', '#c4c4cc'],
  rust: ['#4a2214', '#6c361d', '#904d29', '#b0683a'],
  ochre: ['#4b351b', '#6a4c25', '#8a6531', '#a7803f', '#bf9a55', '#d3b470'],
  blue: ['#25313d', '#344455', '#465c72', '#5d778f', '#7891a8', '#98adc0'],
  water: ['#1e2b2e', '#2a3b3e', '#394d4e', '#4e6463', '#6a7f7b', '#90a39c'],
  shadow: ['#0b0807'],
  white: ['#fbf8ee'],
};
export const PALETTE = makePalette(RAMPS);
const grid = (w = T, h = T) => new Grid(w, h, PALETTE);
const len = (ramp) => RAMPS[ramp].length;
/** Trama ordenada (Bayer 4 × 4, de 0 a 1): bordes suaves sin ruido suelto. */
const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
].map((r) => r.map((v) => (v + 0.5) / 16));
const bayer = (x, y) => BAYER[mod(y, 4)][mod(x, 4)];
/** ¿Es cal (la base o sus medios tonos)? */
const isCal = (g, x, y) => {
  const r = g.ramp(x, y);
  return r === 'cal' || r === 'calm';
};

/** Tono relativo dentro de la rampa del píxel (para bordes y sombras que valen sobre cualquier material). */
function shift(g, x, y, d) {
  let r = g.ramp(x, y);
  if (!r) return;
  let st = g.step(x, y);
  // Los medios tonos se sombrean como la base de su material.
  if (r === 'calm') [r, st] = ['cal', CAL];
  if (r === 'earthm') [r, st] = ['earth', EARTH];
  g.set(x, y, r, Math.max(0, Math.min(len(r) - 1, st + d)));
}

// ─── Marcas: grupos de píxeles que se reparten sobre la base, con vuelta (periódicas) o solo en el centro ─────────
/** Una marca: [dx, dy, rampa, tono][]. Reparte las de `kinds` donde todo es `free` y lejos de las otras. */
function scatter(g, rng, kinds, { wrap, free }) {
  const placed = [];
  const at = (x, y) => (wrap ? [mod(x, T), mod(y, T)] : [x, y]);
  const ok = (x, y) => {
    const [px, py] = at(x, y);
    if (!g.in(px, py)) return false;
    if (!wrap && (px < RING || py < RING || px >= T - RING || py >= T - RING)) return false;
    return free(px, py);
  };
  const taken = new Set();
  const key = (x, y) => at(x, y).join(',');
  for (const pixels of kinds) {
    for (let tries = 0; tries < 200; tries++) {
      const x = irange(rng, 0, T - 1);
      const y = irange(rng, 0, T - 1);
      const fits = pixels.every(([dx, dy]) => {
        if (!ok(x + dx, y + dy)) return false;
        for (let ny = -1; ny <= 1; ny++) for (let nx = -1; nx <= 1; nx++) if (taken.has(key(x + dx + nx, y + dy + ny))) return false;
        return true;
      });
      if (!fits) continue;
      for (const [dx, dy, r, s] of pixels) {
        g.set(...at(x + dx, y + dy), r, s);
      }
      for (const [dx, dy] of pixels) taken.add(key(x + dx, y + dy));
      placed.push({ x, y, pixels });
      break;
    }
  }
  return placed;
}
const touchesRing = (m) =>
  m.pixels.some(([dx, dy]) => {
    const x = mod(m.x + dx, T);
    const y = mod(m.y + dy, T);
    return x < RING || y < RING || x >= T - RING || y >= T - RING;
  });
const drawMark = (g, m) => m.pixels.forEach(([dx, dy, r, s]) => g.set(mod(m.x + dx, T), mod(m.y + dy, T), r, s));

// ─── La cal: base de pincel ────────────────────────────────────────────────────────────────────────────────────────
const CAL = 5;
/** Una nube de píxeles de `tone` (bordes tramados), para manchas suaves de la cal o de la tierra. */
function cloudPixels(rng, ramp, tone, rx, ry, keep = 0.55) {
  const px = [];
  const lobes = Array.from({ length: 5 }, () => 0.75 + rng() * 0.45);
  for (let y = -Math.ceil(ry); y <= Math.ceil(ry); y++) {
    for (let x = -Math.ceil(rx); x <= Math.ceil(rx); x++) {
      const a = Math.atan2(y / ry, x / rx);
      const r = lobes[mod(Math.round((a / (Math.PI * 2)) * 5), 5)];
      const d = Math.hypot(x / rx, y / ry) / r;
      if (d > 1) continue;
      if (d > 0.62 && rng() > keep) continue;
      px.push([x, y, ramp, tone]);
    }
  }
  return px;
}
/** La cal, lo suave (puede cruzar el borde: va en la base y en todas sus variantes): manchas grandes en medio tono. */
function calSoft(rng) {
  const out = [];
  out.push(cloudPixels(rng, 'calm', 1, 3 + rng() * 2, 1.6 + rng() * 1, 0.45));
  out.push(cloudPixels(rng, 'calm', 0, 2.5 + rng() * 2, 1.4 + rng() * 0.8, 0.4));
  return out;
}
/** La cal, lo marcado (solo en el centro, distinto en cada variante): una pasada de pincel o un poro, a veces nada. */
function calMarks(rng) {
  const out = [];
  if (rng() < 0.5) {
    const l = irange(rng, 5, 8);
    out.push(Array.from({ length: l }, (_, i) => [i, 0, i === 0 ? 'cal' : 'calm', i === 0 ? 6 : 1]));
  }
  if (rng() < 0.5) out.push([[0, 0, 'cal', 4]]);
  if (rng() < 0.4) out.push(cloudPixels(rng, 'calm', rng() < 0.5 ? 0 : 1, 2 + rng() * 1.5, 1 + rng() * 0.6, 0.4));
  return out;
}
const plainCal = () => {
  const g = grid();
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) g.set(x, y, 'cal', CAL);
  return g;
};
const calFree = (g) => (x, y) => isCal(g, x, y) && g.step(x, y) === CAL;
const CAL_SEED = 112;
/**
 * La cal base (casilla 15 de las casas): blanca de siesta, con manchas grandes y suaves en medio tono y, a veces, una
 * pasada de pincel o un poro; todo en el centro, así cada variante (otra `seed`) trae las suyas y el anillo de 2 px es
 * la cal lisa en todas (empalman siempre).
 */
export function baseCal(seed = CAL_SEED) {
  const g = plainCal();
  scatter(g, mulberry32(seed), [...calSoft(mulberry32(seed + 1)), ...calMarks(mulberry32(seed + 3))], { wrap: false, free: calFree(g) });
  return g;
}

// ─── La tierra colorada (bajo la calle) ────────────────────────────────────────────────────────────────────────────
const EARTH = 3;
/** La tierra, lo suave (cruza el borde): manchas en medio tono, más secas o más húmedas. */
function earthSoft(rng) {
  return [cloudPixels(rng, 'earthm', 1, 3 + rng() * 2, 1.6 + rng(), 0.45), cloudPixels(rng, 'earthm', 0, 2.5 + rng() * 2, 1.4 + rng(), 0.4)];
}
/** La tierra, lo marcado (solo en el centro): un terrón o un poro, a veces nada. */
function earthMarks(rng) {
  const out = [];
  if (rng() < 0.35) {
    const w = irange(rng, 4, 5);
    const clod = [];
    for (let i = 1; i < w - 1; i++) clod.push([i, 0, 'earth', i === 1 ? 5 : 4]);
    for (let i = 0; i < w; i++) clod.push([i, 1, 'earth', i === 0 ? 4 : i === w - 1 ? 2 : 3]);
    for (let i = 1; i < w; i++) clod.push([i, 2, 'earth', 2]);
    out.push(clod);
  }
  if (rng() < 0.5) out.push([[0, 0, 'earth', 4], [0, 1, 'earth', 1], [1, 1, 'earth', 2]]);
  return out;
}
/** Una capa del suelo apisonado (calcomanía): oscura y compacta o arenosa, que ondula y se afina en las puntas. */
function paintLayer(g, x0, x1, y0, tone, seed) {
  const wave = [0, 0, 1, 1, 1, 0, 0, -1, -1, -1, 0, 0, 1, 1, 0, 0];
  for (let x = x0; x <= x1; x++) {
    const end = Math.min(x - x0, x1 - x);
    const t = end >= 4 ? 2 : 1;
    const y = y0 + wave[mod(x + seed, T)];
    for (let d = 0; d < t; d++) if (end >= 2 || bayer(x, y + d) < 0.5) g.set(x, y + d, 'earth', tone);
    if (tone === 2 && end >= 3 && bayer(x, y - 1) < 0.3) g.set(x, y - 1, 'earth', 4);
    if (tone === 4 && end >= 3 && bayer(x, y + t) < 0.4) g.set(x, y + t, 'earth', 2);
  }
}

const plainEarth = () => {
  const g = grid();
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) g.set(x, y, 'earth', EARTH);
  return g;
};
const earthFree = (g) => (x, y) => g.ramp(x, y) === 'earth' && g.step(x, y) === EARTH;
const EARTH_SEED = 1120;
export function baseEarth(seed = EARTH_SEED) {
  const g = plainEarth();
  scatter(g, mulberry32(seed), [...earthSoft(mulberry32(seed + 1)), ...earthMarks(mulberry32(seed + 3))], { wrap: false, free: earthFree(g) });
  return g;
}

// ─── Bordes (contorno y sombra hacia el aire, sobre cualquier material) ─────────────────────────────────────────────
/** Perfil de muescas de los costados (por fila) y de abajo (por columna): la cal gastada de las esquinas. */
export const NOTCH = {
  left: [0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 1, 0],
  right: [0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0],
  bottom: [0, 1, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 1, 0, 0],
};
/** La tierra cortada: más irregular. */
export const EARTH_NOTCH = {
  left: [0, 1, 1, 0, 0, 1, 2, 1, 0, 0, 1, 1, 0, 0, 1, 0],
  right: [1, 0, 0, 1, 1, 0, 0, 0, 1, 2, 1, 0, 0, 1, 0, 0],
  bottom: [1, 0, 1, 2, 1, 0, 0, 1, 1, 0, 1, 2, 1, 0, 0, 1],
};

/**
 * Silueta y sombreado de los lados al aire: `inset` px que se quitan del costado (la pared queda adentro del filo y
 * la teja desborda), las muescas, el filo claro a la izquierda (la luz viene de arriba a la izquierda) y la sombra a la
 * derecha y abajo. `fromRow`: desde qué fila valen los costados (la banda de tejas va hasta el filo).
 */
function edges(g, air, { notch = NOTCH, inset = 1, fromRow = 0, bottomShade = [-3, -2, -1] } = {}) {
  if (air.left) for (let y = fromRow; y < T; y++) for (let x = 0; x < inset + notch.left[y]; x++) g.clear(x, y);
  if (air.right) for (let y = fromRow; y < T; y++) for (let x = 0; x < inset + notch.right[y]; x++) g.clear(T - 1 - x, y);
  if (air.down) for (let x = 0; x < T; x++) for (let y = 0; y < notch.bottom[x]; y++) g.clear(x, T - 1 - y);
  if (air.down && air.left) for (const [x, y] of [[inset, 15], [inset, 14], [inset + 1, 15]]) g.clear(x, y);
  if (air.down && air.right) for (const [x, y] of [[T - 1 - inset, 15], [T - 1 - inset, 14], [T - 2 - inset, 15]]) g.clear(x, y);
  // Sombra y filo: cada píxel según su distancia al aire de cada lado.
  const open = (x, y) => {
    if (x < 0) return air.left;
    if (x > T - 1) return air.right;
    if (y > T - 1) return air.down;
    if (y < 0) return air.up;
    return !g.opaque(x, y);
  };
  const delta = new Int8Array(T * T);
  for (let y = fromRow; y < T; y++) {
    for (let x = 0; x < T; x++) {
      if (!g.opaque(x, y)) continue;
      let d = 0;
      if (open(x - 1, y)) d = Math.max(d, 2);
      else if (open(x - 2, y) && air.left) d = Math.max(d, 1);
      if (open(x + 1, y)) d = Math.min(d, -3);
      else if (open(x + 2, y) && air.right) d = Math.min(d, -1);
      for (let k = 0; k < bottomShade.length; k++) if (open(x, y + 1 + k) && (y + 1 + k > T - 1 || air.down || k === 0)) d = Math.min(d, bottomShade[k]);
      delta[y * T + x] = d;
    }
  }
  for (let y = fromRow; y < T; y++) for (let x = 0; x < T; x++) if (delta[y * T + x]) shift(g, x, y, delta[y * T + x]);
}

// ─── Tejas españolas (el borde de arriba de las casas) ────────────────────────────────────────────────────────────
// Vistas de frente desde la calle: columnas de cobijas (convexas, de 5 px: la luz a la izquierda, el lomo claro, la
// sombra a la derecha) y canales (cóncavos, de 3 px, hondos) entre ellas, en dos hiladas de 4 filas: cada cobija
// termina en su boca (∩, hueca) y la de abajo arranca con el lomo claro. En el alero, el labio de cada canal cuelga un
// píxel más; debajo, la sombra sobre la cal. Período de 8 px.
export const TEJA = {
  period: 8,
  cobija: 5,
  /** Filas de cada hilada (la primera, la de arriba). */
  courses: [0, 4],
  rows: 4,
  /** El labio de los canales (la fila de abajo de la banda). */
  lip: 8,
};
/** Tonos de la cobija por fila de la hilada y columna (luz arriba a la izquierda); la última fila es la boca. */
const COBIJA = [
  [4, 6, 7, 6, 4],
  [3, 5, 6, 5, 3],
  [3, 4, 5, 4, 2],
  [2, 1, 0, 1, 2],
];
/** Tonos del canal por fila de la hilada (la sombra de la cobija de la izquierda, más clara hacia la derecha). */
const CANAL = [
  [1, 2, 3],
  [1, 2, 3],
  [1, 2, 2],
  [0, 1, 1],
];

/**
 * Las tejas de arriba. `v` (lo que cambia una variante, solo en el centro): `shifted` (x de inicio de una cobija de la
 * hilada de abajo corrida 1 px), `broken` (x de inicio de una cobija de abajo rota), `moss` ([x, fila] en los canales),
 * `lichen` ([x, y] sobre los lomos), `tufts` ([x, alto]: yuyos que salen de un canal) y `drips` (chorreaduras bajo el
 * alero, por x).
 */
function paintTejas(g, air, v = {}) {
  const P = TEJA.period;
  const C = TEJA.cobija;
  const shifted = new Set(v.shifted ?? []);
  const broken = new Set(v.broken ?? []);
  const L = TEJA.lip;
  for (let x = 0; x < T; x++) for (let y = 0; y <= L; y++) g.clear(x, y);
  for (let x = 0; x < T; x++) {
    const i = mod(x, P);
    const start = x - i;
    for (const [k, top] of TEJA.courses.entries()) {
      for (let r = 0; r < TEJA.rows; r++) {
        let y = top + r;
        if (i < C) {
          const dy = k === 1 && shifted.has(start) ? 1 : 0;
          y += dy;
          if (y === 0 && (i === 0 || i === C - 1)) continue; // el lomo redondeado
          let s = COBIJA[r][i];
          if (k === 1 && r === 0) s = Math.min(7, s + 0); // la hilada de abajo, igual de clara
          if (k === 1 && broken.has(start) && r >= 2 && i > 0 && i < C - 1) s = r === 2 ? (i === 1 ? 6 : 1) : 0;
          g.set(x, y, 'teja', s);
          if (dy && r === 0) g.set(x, top, 'teja', 0); // el hueco que deja la teja corrida
        } else {
          if (y === 0) continue;
          g.set(x, y, 'teja', CANAL[r][i - C]);
        }
      }
    }
    // El alero: el labio del canal cuelga; bajo las cobijas, la sombra sobre la cal.
    if (i >= C) g.set(x, L, 'teja', [2, 4, 3][i - C]);
    else if (g.ramp(x, L) !== 'teja') g.set(x, L, 'cal', 1);
  }
  // Yuyos, musgo y liquen.
  for (const [x, y] of v.moss ?? []) {
    g.set(x, y, 'moss', 2);
    if (g.ramp(x, y - 1) === 'teja') g.set(x, y - 1, 'moss', 3);
  }
  for (const [x, h] of v.tufts ?? []) for (let k = 0; k < h; k++) g.set(x + (k === h - 1 && h > 2 ? 1 : 0), 2 - k, 'moss', k === h - 1 ? 5 : k ? 4 : 2);
  for (const [x, y] of v.lichen ?? []) if (g.ramp(x, y) === 'teja') g.set(x, y, 'lichen', (x + y) % 3);
  // La sombra del alero sobre la cal y alguna chorreadura bajo los canales.
  for (let x = 0; x < T; x++) {
    const i = mod(x, P);
    if (isCal(g, x, L + 1)) g.set(x, L + 1, 'cal', i >= C ? 2 : 3);
    if (isCal(g, x, L + 2) && (x * 5) % 3 === 0) g.set(x, L + 2, 'cal', 4);
  }
  for (const x of v.drips ?? [6]) {
    for (let y = L + 2; y < L + 5; y++) if (isCal(g, x, y) || g.ramp(x, y) === 'damp') g.set(x, y, y === L + 4 ? 'cal' : 'damp', y === L + 4 ? 4 : 4);
  }
  // Los extremos: la teja llega al filo y desborda la pared (que va 1 px adentro); el corte, oscuro.
  if (air.left) {
    for (let y = 1; y <= L; y++) if (g.opaque(0, y)) g.set(0, y, 'teja', y === 1 || y === 5 ? 3 : 1);
    g.clear(0, 0);
  }
  if (air.right) {
    for (let y = 1; y <= L; y++) if (g.opaque(T - 1, y)) g.set(T - 1, y, 'teja', 0);
    g.clear(T - 1, 0);
  }
}

// ─── Empedrado (la calle en la línea del piso) ─────────────────────────────────────────────────────────────────────
// Piedras de basalto gris y de arenisca rosada asentadas en arena: lomo redondeado con luz arriba a la izquierda, la
// sombra abajo a la derecha, juntas oscuras con tierra; debajo, la cama de arena y la tierra.
/** Las piedras de la hilada: [desde, ancho, rampa, alto, fila de arriba]. Periódico de 16 (pueden cruzar el borde). */
export const COBBLES = [
  [0, 5, 'stone', 6, 0],
  [6, 4, 'sandstone', 5, 1],
  [11, 4, 'stone', 5, 1],
];
/**
 * Una piedra: las esquinas comidas (las de abajo también si `round`), el lomo con un brillo arriba a la izquierda, la
 * cara en un tono medio con algún poro, la sombra a la derecha y la panza oscura.
 */
function paintStone(g, x0, w, ramp, h, top, wrap = true, round = true) {
  const n = RAMPS[ramp].length;
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const corner = (i === 0 || i === w - 1) && (j === 0 || (round && j === h - 1));
      if (corner && w > 2 && h > 2) continue;
      let s;
      if (j === 0) s = i === 1 ? n - 1 : n - 2;
      else if (j === h - 1) s = 1;
      else if (i === 0) s = n - 3;
      else if (i === w - 1) s = 2;
      else s = j === 1 ? n - 3 : n - 4;
      if (j > 1 && j < h - 1 && i > 0 && i < w - 1 && (i * 5 + j * 3 + x0) % 7 === 0) s = 2; // un poro
      const x = wrap ? mod(x0 + i, T) : x0 + i;
      g.set(x, top + j, ramp, s);
    }
  }
}
function paintStoneRow(g, stones, { wrap = true, joint = ['earth', 1], fromRow = 0, toRow = 5, round = true } = {}) {
  for (let x = 0; x < T; x++) for (let y = fromRow; y <= toRow; y++) g.set(x, y, joint[0], joint[1]);
  for (const [x0, w, ramp, h, top] of stones) paintStone(g, x0, w, ramp, h, top, wrap, round);
}
function paintCobbles(g, air, v = {}) {
  const stones = v.stones ?? COBBLES;
  // La cama de arena bajo las piedras y la tierra.
  for (let x = 0; x < T; x++) {
    g.set(x, 6, 'earth', 1);
    g.set(x, 7, 'sand', bayer(x, 7) < 0.6 ? 2 : 1);
    g.set(x, 8, 'sand', bayer(x, 8) < 0.3 ? 1 : 0);
  }
  paintStoneRow(g, stones, { toRow: 6 });
  // El aire sobre las juntas y sobre las piedras más bajas (la silueta de la calle).
  for (let x = 0; x < T; x++) for (let y = 0; y < 2; y++) if (g.ramp(x, y) === 'earth') g.clear(x, y);
  for (const [x, h] of v.weeds ?? []) for (let k = 0; k < h; k++) g.set(x + (k === h - 1 ? 1 : 0), 1 - k, 'moss', k === h - 1 ? 4 : 2);
  for (const [x, y] of v.petals ?? []) {
    g.set(x, y, 'petal', 3);
    g.set(x + 1, y, 'petal', 2);
  }
  if (air.left) for (let y = 0; y < 3; y++) g.clear(0, y);
  if (air.right) for (let y = 0; y < 3; y++) g.clear(T - 1, y);
}

// ─── Ladrillo (los pisos elevados y los de adentro: el patio, la terraza, la galería, el zaguán) ───────────────────
// Dos hiladas de ladrillo a soga, trabadas (la de abajo corrida 4 px), con las juntas de mortero gris y el canto de
// arriba gastado; debajo, la cama de cal y arena.
export const BRICK = {
  /** Largo de cada ladrillo (con su junta) y corrimiento de la segunda hilada. */
  length: 8,
  offset: 4,
  /** Tono de cada ladrillo (por número de ladrillo en la hilada): unos más cocidos que otros. */
  tones: [[0, -1], [1, 0]],
};
function paintBricks(g, air, v = {}) {
  const tones = v.tones ?? BRICK.tones;
  for (let x = 0; x < T; x++) for (let y = 0; y < 8; y++) g.clear(x, y);
  for (let row = 0; row < 2; row++) {
    const top = row * 4;
    for (let x = 0; x < T; x++) {
      const along = mod(x + (row ? BRICK.offset : 0), T);
      const n = Math.floor(along / BRICK.length);
      const i = along % BRICK.length;
      if (i === BRICK.length - 1) {
        for (let y = top; y < top + 3; y++) g.set(x, y, 'cal', 2);
        continue;
      }
      const t = tones[row][n] ?? 0;
      for (let y = top; y < top + 3; y++) {
        let s = y === top ? 5 : y === top + 2 ? 2 : 4;
        if (i === 0 && y > top) s -= 1;
        if (i === BRICK.length - 2) s -= 1;
        g.set(x, y, 'brick', Math.max(0, Math.min(6, s + t)));
      }
    }
    for (let x = 0; x < T; x++) g.set(x, top + 3, 'cal', row ? 1 : 2);
  }
  // El canto de arriba gastado (alguna esquina comida) y la cama de cal y arena.
  for (const x of v.chips ?? [0, 6, 7]) g.clear(x, 0);
  for (let x = 0; x < T; x++) if (g.ramp(x, 8) !== null) g.set(x, 8, (x * 5) % 3 ? 'sand' : 'cal', (x * 5) % 3 ? 1 : 2);
  for (const [x, y] of v.moss ?? []) g.set(x, y, 'moss', 3);
  for (const [x, y] of v.petals ?? []) g.set(x, y, 'petal', 3);
  if (air.left) {
    for (let y = 0; y < 8; y++) if (g.opaque(0, y)) shift(g, 0, y, y % 4 === 3 ? 0 : 1);
    g.clear(0, 0);
  }
  if (air.right) {
    for (let y = 0; y < 8; y++) if (g.opaque(T - 1, y)) shift(g, T - 1, y, -2);
    g.clear(T - 1, 0);
  }
}

// ─── La parte de abajo de una casa al aire: la cal sucia y comida ─────────────────────────────────────────────────
function paintUnderside(g, air) {
  for (let x = 0; x < T; x++) {
    for (let k = 1; k <= 4; k++) {
      const y = T - k;
      if (g.ramp(x, y) !== 'cal') continue;
      // La mugre del borde de abajo, en medio tono y tramada.
      if (k === 3 && bayer(x, y) < 0.5) g.set(x, y, 'calm', 0);
      if (k === 4 && bayer(x, y) < 0.2) g.set(x, y, 'calm', 0);
    }
  }
  void air;
}

// ─── Zócalo pintado (el pie de una casa que da a la calle) ─────────────────────────────────────────────────────────
/** Fila donde empieza la pintura (ondula 1 px: está pintado a mano). */
const SOCLE_TOP = [7, 7, 7, 6, 6, 7, 7, 7, 7, 7, 8, 8, 7, 7, 7, 7];
function paintSocle(g, ramp, v = {}) {
  const rng = mulberry32(v.seed ?? 1121);
  const top = v.top ?? SOCLE_TOP;
  const base = 3;
  for (let x = 0; x < T; x++) {
    const t = top[x];
    // La humedad que sube por la cal sobre el zócalo.
    for (let y = t - 4; y < t; y++) if (y >= RING && isCal(g, x, y) && (t - y) / 4.5 < 1 - bayer(x, y)) g.set(x, y, t - y === 1 ? 'damp' : 'calm', t - y === 1 ? 4 : 0);
    g.set(x, t, ramp, 1); // el filete
    for (let y = t + 1; y < T; y++) {
      let s = base;
      if (y === t + 1) s = 4;
      if (y >= T - 3) s = base - 1;
      g.set(x, y, ramp, s);
    }
    // El barro que salpica abajo.
    g.set(x, T - 1, (x * 5) % 3 ? 'earth' : ramp, (x * 5) % 3 ? 3 : 1);
    if ((x * 7) % 4 === 1) g.set(x, T - 2, 'earth', 4);
  }
  // Pinceladas de la pintura y la pintura gastada que deja ver la cal (en tramos que cruzan el borde).
  for (const [x0, y, l, s] of v.strokes ?? [[1, 9, 4, 4], [9, 11, 5, 2], [12, 9, 6, 4], [4, 12, 3, 2]]) for (let i = 0; i < l; i++) if (g.ramp(mod(x0 + i, T), y) === ramp) g.set(mod(x0 + i, T), y, ramp, s);
  for (const [x, y] of v.worn ?? [[5, 10], [6, 10], [14, 12]]) g.set(x, y, 'cal', 4);
  for (const [x, y] of v.adobe ?? []) g.set(x, y, 'adobe', 3);
  void rng;
}

// ─── Cimiento de piedra (lo que queda bajo una casa, en la línea de la calle) ──────────────────────────────────────
/** Piedras del cimiento: más grandes y chatas que las del empedrado, con mortero de cal: [desde, ancho, rampa, alto, fila]. */
export const FOUNDATION = [
  [0, 7, 'stone', 5, 1],
  [8, 7, 'sandstone', 5, 1],
];
function paintFoundation(g, v = {}) {
  paintStoneRow(g, v.stones ?? FOUNDATION, { joint: ['cal', 2], toRow: 6, round: false });
  // La sombra del pie de la pared sobre el cimiento, y la cama de mortero.
  for (let x = 0; x < T; x++) {
    g.set(x, 0, 'cal', 1);
    if (g.opaque(x, 1) && g.ramp(x, 1) !== 'cal') shift(g, x, 1, -1);
    g.set(x, 6, 'cal', bayer(x, 6) < 0.5 ? 2 : 1);
    g.set(x, 7, 'earth', bayer(x, 7) < 0.4 ? 1 : 2);
  }
}

// ─── Las casillas ──────────────────────────────────────────────────────────────────────────────────────────────────
const airOf = (mask) => ({ up: !(mask & UP), right: !(mask & RIGHT), down: !(mask & DOWN), left: !(mask & LEFT) });

/** Una casilla de las casas (máscara: vecinos sólidos arriba 1, derecha 2, abajo 4, izquierda 8). */
/** La cal de los bordes sin variante: lisa, con una sola mancha clara y suave (lo que se repite en una fila larga). */
const edgeCal = () => {
  const g = plainCal();
  scatter(g, mulberry32(CAL_SEED + 7), [cloudPixels(mulberry32(CAL_SEED + 8), 'calm', 1, 4, 2, 0.45)], { wrap: false, free: calFree(g) });
  return g;
};

export function wallCell(mask, variant = {}) {
  const g = (variant.base ?? (mask === 15 ? baseCal() : edgeCal())).clone();
  const air = airOf(mask);
  if (variant.socle) paintSocle(g, variant.socle, variant.socleVariant);
  edges(g, air, { notch: { ...NOTCH, ...(variant.notch ?? {}) }, fromRow: air.up ? (variant.top === 'brick' ? 8 : TEJA.lip + 1) : 0 });
  if (air.down) paintUnderside(g, air);
  if (air.up) (variant.top === 'brick' ? paintBricks : paintTejas)(g, air, variant.tejas ?? variant.bricks ?? {});
  return g;
}

/** Una casilla de la calle: tierra con el empedrado o el ladrillo arriba, o el cimiento bajo una casa. */
export function streetCell(mask, variant = {}) {
  const g = (variant.base ?? baseEarth()).clone();
  const air = airOf(mask);
  if (variant.plinth) paintFoundation(g, variant.foundation);
  edges(g, air, { notch: { ...EARTH_NOTCH, ...(variant.notch ?? {}) }, inset: 0, fromRow: air.up ? 8 : 0, bottomShade: [-2, -1] });
  if (air.up) (variant.top === 'brick' ? paintBricks : paintCobbles)(g, air, variant.cobbles ?? variant.bricks ?? {});
  return g;
}

// ─── Plataforma: tirante de madera con grosor y sombra (la colisión sigue en la fila 0) ───────────────────────────
// Las plataformas móviles (S57) toman las 6 filas de arriba y repiten la última en sombra; el panal cuelga de la fila 6.
export const BEAM = {
  /** Vetas: [fila, desde, hasta]. */
  grain: [[2, 1, 6], [3, 9, 14], [4, 2, 5], [2, 11, 13]],
  /** Nudos (x, y). */
  knots: [[8, 3]],
  /** Clavos de hierro forjado (x, y). */
  nails: [[3, 1], [12, 4]],
  /** Astillas del canto de abajo. */
  chips: [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0],
};
export function beamCell(kind /* 'left' | 'center' | 'right' */, variant = {}) {
  const v = { ...BEAM, ...variant };
  const g = grid();
  const SLAB = 6; // filas 0 a 5: el tirante; 6: el canto oscuro; 7 y 8: sombra
  for (let x = 0; x < T; x++) {
    for (let y = 0; y < SLAB; y++) g.set(x, y, 'wood', y === 0 ? 6 : y === 1 ? 5 : y === SLAB - 1 ? 2 : (x * 3 + y) % 7 === 0 ? 3 : 4);
    g.set(x, SLAB, 'wood', 0);
    // La sombra debajo, pareja (una astilla suelta no la corre).
    g.set(x, SLAB + 1, v.chips[x] ? 'wood' : 'shadow', v.chips[x] ? 1 : 0, v.chips[x] ? 255 : 100);
    g.set(x, SLAB + 2, 'shadow', 0, 40);
  }
  for (const [y, x0, x1] of v.grain) for (let x = x0; x <= x1; x++) g.set(x, y, 'wood', (x + y) % 4 === 0 ? 2 : 3);
  for (const [x, y] of v.knots) {
    g.set(x, y, 'wood', 1);
    g.set(x + 1, y, 'wood', 2);
    g.set(x, y - 1, 'wood', 5);
  }
  for (const [x, y] of v.nails) {
    g.set(x, y, 'iron', 4);
    g.set(x + 1, y, 'iron', 2);
    g.set(x, y + 1, 'rust', 1);
  }
  if (kind === 'left') {
    for (const y of [0, 6, 7, 8]) g.clear(0, y);
    for (let y = 1; y < 6; y++) g.set(0, y, 'wood', y === 1 ? 4 : 2);
    for (let y = 1; y < 6; y++) g.set(1, y, 'wood', y === 3 ? 3 : 5);
    g.set(1, 0, 'wood', 5);
  }
  if (kind === 'right') {
    for (const y of [0, 6, 7, 8]) g.clear(15, y);
    for (let y = 1; y < 6; y++) g.set(15, y, 'wood', 1);
    for (let y = 1; y < 6; y++) g.set(14, y, 'wood', y === 3 ? 2 : 3);
  }
  return g;
}

// ─── Espinas: puntas de reja de hierro forjado ─────────────────────────────────────────────────────────────────────
// Barrotes cada 4 px rematados en punta de lanza (5 de ancho, con el filo claro y el contorno oscuro para que se lea
// contra el cielo), con su anillo debajo, dos travesaños con óxido y un umbral de ladrillo. Se repite sin costura.
export function spikesCell() {
  const g = grid();
  // La punta de lanza: [dx, fila, tono] (el centro del barrote en dx 0), con contorno oscuro.
  const head = [
    [0, 0, 6],
    [-1, 1, 1], [0, 1, 6], [1, 1, 2],
    [-1, 2, 5], [0, 2, 5], [1, 2, 2],
    [-2, 3, 1], [-1, 3, 5], [0, 3, 4], [1, 3, 3], [2, 3, 0],
    [-2, 4, 0], [-1, 4, 4], [0, 4, 3], [1, 4, 2], [2, 4, 0],
    [-1, 5, 0], [0, 5, 3], [1, 5, 0],
  ];
  // Dos lanzas altas por casilla y, entre ellas, barrotes más bajos con una punta chica.
  for (const bx of [3, 11]) {
    for (const [dx, y, t] of head) g.set(bx + dx, y, 'iron', t);
    for (const dx of [-1, 0, 1]) g.set(bx + dx, 6, 'iron', dx < 0 ? 4 : dx === 0 ? 3 : 1);
    for (let y = 7; y < 14; y++) {
      g.set(bx, y, 'iron', 4);
      g.set(bx + 1, y, 'iron', 2);
    }
  }
  for (const bx of [7, 15]) {
    g.set(bx, 3, 'iron', 6);
    g.set(bx, 4, 'iron', 5);
    g.set(mod(bx + 1, T), 4, 'iron', 1);
    for (let y = 5; y < 14; y++) {
      g.set(bx, y, 'iron', 4);
      g.set(mod(bx + 1, T), y, 'iron', 2);
    }
  }
  for (const y of [8, 12]) {
    for (let x = 0; x < T; x++) {
      if (g.ramp(x, y) === 'iron' && g.step(x, y) === 4) continue;
      g.set(x, y, 'iron', 3);
      g.set(x, y + 1, 'iron', 1);
    }
  }
  for (const [x, y, t] of [[4, 9, 2], [12, 10, 1], [8, 13, 1], [0, 9, 2]]) g.set(x, y, 'rust', t);
  // El umbral: una hilada de ladrillo.
  for (let x = 0; x < T; x++) {
    g.set(x, 14, 'brick', x % 8 === 7 ? 1 : 5);
    g.set(x, 15, 'brick', x % 8 === 7 ? 1 : 2);
  }
  return g;
}

// ─── Agua (l4 no tiene; a tono por si un mapa la usa): agua quieta de aljibe ─────────────────────────────────────────
export function waterCell(kind) {
  const g = grid();
  const a = kind === 'surface' ? 230 : 242;
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) g.set(x, y, 'water', kind === 'surface' ? (y < 6 ? 4 : 3) : y < 8 ? 2 : 1, a);
  if (kind === 'surface') {
    for (let x = 0; x < T; x++) {
      g.clear(x, 0);
      g.set(x, 1, 'water', 5, 255);
      if ((x * 5) % 7 < 2) g.set(x, 3, 'water', 5, a);
    }
  } else for (let x = 0; x < T; x++) if ((x * 3) % 5 === 0) g.set(x, 6, 'water', 3, a);
  return g;
}

// ─── Revoque rajado (la roca que se rompe con el tajo cargado) ─────────────────────────────────────────────────────
// Un bloque de adobe revocado, con sus propios bordes, partido por grietas hondas; un pedazo de revoque caído deja ver
// el adobe. La luz del tajo (hoja de detalle, `glow`) recorre las grietas.
const PLASTER_CRACKS = [
  [[2, 0], [3, 1], [3, 2], [4, 3], [5, 4], [5, 5], [6, 6], [7, 7]],
  [[7, 7], [8, 7], [9, 8], [10, 8], [11, 9], [12, 9], [13, 10], [14, 10], [15, 11]],
  [[7, 7], [7, 8], [6, 9], [6, 10], [5, 11], [5, 12], [4, 13], [4, 14], [3, 15]],
  [[10, 8], [10, 7], [11, 6], [11, 5], [12, 4], [13, 3], [13, 2], [14, 1]],
  [[5, 11], [6, 12], [7, 12], [8, 13], [9, 13], [10, 14], [11, 15]],
  [[3, 2], [2, 3], [1, 4], [0, 4]],
];
const PLASTER_CRACKS_ALT = [
  [
    [[0, 6], [1, 6], [2, 7], [3, 7], [4, 8], [5, 8], [6, 8], [7, 9]],
    [[7, 9], [8, 8], [9, 7], [9, 6], [10, 5], [10, 4], [11, 3], [11, 2], [12, 1], [12, 0]],
    [[7, 9], [7, 10], [8, 11], [8, 12], [9, 13], [9, 14], [10, 15]],
    [[9, 6], [10, 6], [11, 7], [12, 7], [13, 8], [14, 8], [15, 9]],
    [[4, 8], [4, 9], [3, 10], [3, 11], [2, 12], [2, 13], [1, 14]],
  ],
  [
    [[4, 0], [4, 1], [5, 2], [5, 3], [6, 4], [6, 5], [7, 6], [8, 7]],
    [[8, 7], [9, 8], [10, 9], [11, 9], [12, 10], [13, 11], [14, 11], [15, 12]],
    [[8, 7], [8, 8], [7, 9], [7, 10], [6, 11], [6, 12], [6, 13], [5, 14], [5, 15]],
    [[6, 4], [5, 4], [4, 5], [3, 5], [2, 6], [1, 6], [0, 7]],
    [[12, 10], [12, 11], [11, 12], [11, 13], [12, 14], [12, 15]],
  ],
];
/** Los pedazos de revoque caído de cada casilla del revoque rajado (la base y sus dos variantes). */
const PLASTER_FALLEN = [
  [[10, 12], [11, 12], [12, 12], [10, 13], [11, 13], [12, 13], [13, 13], [11, 14], [12, 14]],
  [[11, 2], [12, 2], [11, 3], [12, 3], [13, 3], [12, 4]],
  [[3, 3], [4, 3], [5, 3], [3, 4], [4, 4], [2, 4]],
];
export function crackedCell(cracks = PLASTER_CRACKS, seed = 1122, fallen = PLASTER_FALLEN[0]) {
  const g = baseCal(seed);
  const isCrack = new Set(cracks.flat().map(([x, y]) => `${x},${y}`));
  // El pedazo caído: adobe con su junta, el canto del revoque en sombra arriba y claro abajo.
  const hole = new Set(fallen.map(([x, y]) => `${x},${y}`));
  for (const [x, y] of fallen) g.set(x, y, 'adobe', (y === 13 && x === 13) || (x + y) % 5 === 0 ? 2 : 4);
  for (const [x, y] of fallen) {
    if (!hole.has(`${x},${y - 1}`)) g.set(x, y - 1, 'cal', 1);
    if (!hole.has(`${x},${y + 1}`) && isCal(g, x, y + 1)) g.set(x, y + 1, 'cal', 7);
  }
  for (const line of cracks) for (const [x, y] of line) if (!hole.has(`${x},${y}`)) g.set(x, y, 'cal', 0);
  for (const line of cracks) {
    for (const [x, y] of line) {
      if (g.in(x - 1, y - 1) && !isCrack.has(`${x - 1},${y - 1}`) && isCal(g, x - 1, y - 1)) g.set(x - 1, y - 1, 'cal', 7);
      if (g.in(x + 1, y) && !isCrack.has(`${x + 1},${y}`) && isCal(g, x + 1, y)) g.set(x + 1, y, 'cal', 3);
      if (g.in(x, y + 1) && !isCrack.has(`${x},${y + 1}`) && isCal(g, x, y + 1)) g.set(x, y + 1, 'cal', 4);
    }
  }
  // Un bloque suelto: contorno propio (claro arriba y a la izquierda, oscuro abajo y a la derecha).
  const free = (x, y) => !isCrack.has(`${x},${y}`) || hole.has(`${x},${y}`);
  for (let i = 0; i < T; i++) {
    if (isCal(g, i, 0) && free(i, 0)) g.set(i, 0, 'cal', 7);
    if (isCal(g, 0, i) && free(0, i)) g.set(0, i, 'cal', 6);
    if (free(i, T - 1)) g.set(i, T - 1, 'cal', 1);
    if (free(T - 1, i)) g.set(T - 1, i, 'cal', 2);
  }
  return g;
}
/** La luz que corre por las grietas (solo esos píxeles, blancos: el juego le pone el color). */
export function crackedGlow(cracks = PLASTER_CRACKS, fallen = PLASTER_FALLEN[0]) {
  const g = grid();
  const hole = new Set(fallen.map(([x, y]) => `${x},${y}`));
  for (const line of cracks) for (const [x, y] of line) if (!hole.has(`${x},${y}`)) g.set(x, y, 'white', 0);
  return g;
}

// ─── Decoración del borde (23 a 25) ────────────────────────────────────────────────────────────────────────────────
/** 23: yuyos al pie (en la calle y entre las tejas), con una florcita y dos pétalos de lapacho caídos. */
export function weedsCell() {
  const g = grid();
  const blades = [[3, 5, -1], [4, 7, 0], [6, 4, 1], [8, 8, 0], [9, 5, 1], [11, 6, -1], [12, 4, 0]];
  for (const [x, h, lean] of blades) {
    for (let k = 0; k < h; k++) g.set(x + (k > h / 2 ? lean : 0), T - 1 - k, 'moss', k === h - 1 ? 5 : k > h / 2 ? 4 : k < 2 ? 1 : 3);
  }
  // Florcita de manzanilla: el centro amarillo y los pétalos blancos.
  g.set(8, T - 9, 'lichen', 2);
  g.set(7, T - 9, 'white', 0);
  g.set(9, T - 9, 'white', 0);
  g.set(8, T - 10, 'white', 0);
  for (let x = 3; x <= 12; x++) g.set(x, T - 1, 'moss', 1);
  for (const [x, y] of [[1, 15], [14, 14]]) {
    g.set(x, y, 'petal', 3);
    g.set(x + 1, y, 'petal', 2);
  }
  return g;
}
/** 24: el alero donde se corta el techo: la teja sigue un tramo en el aire, con dos canecillos de madera debajo. */
export function eaveCell() {
  const g = grid();
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) g.set(x, y, 'cal', CAL);
  paintTejas(g, { up: true, left: false, right: false, down: true }, { drips: [] });
  for (let y = TEJA.lip + 1; y < T; y++) for (let x = 0; x < T; x++) g.clear(x, y);
  for (let x = 0; x < T; x++) if (isCal(g, x, TEJA.lip)) g.clear(x, TEJA.lip);
  // Los canecillos (las puntas de los tirantes del techo) bajo el alero.
  for (const cx of [2, 10]) {
    for (let y = TEJA.lip; y <= TEJA.lip + 2; y++) {
      g.set(cx, y, 'wood', y === TEJA.lip ? 1 : 4);
      g.set(cx + 1, y, 'wood', y === TEJA.lip ? 0 : 2);
    }
    g.set(cx, TEJA.lip + 3, 'wood', 2);
    g.set(cx + 1, TEJA.lip + 3, 'wood', 1);
  }
  g.clear(0, 0);
  g.clear(T - 1, 0);
  return g;
}
/** 25: un pedazo de teja y un ladrillo sueltos, con yuyos. */
export function rubbleCell() {
  const g = grid();
  for (let x = 2; x <= 7; x++) {
    g.set(x, 13, 'teja', x === 2 ? 3 : x === 7 ? 2 : 5);
    g.set(x, 14, 'teja', x === 2 || x === 7 ? 1 : 3);
  }
  g.set(3, 12, 'teja', 6);
  g.set(4, 12, 'teja', 5);
  for (let x = 8; x <= 13; x++) {
    g.set(x, 13, 'brick', x === 8 ? 4 : 5);
    g.set(x, 14, 'brick', 3);
    g.set(x, 15, 'brick', 1);
  }
  for (const [x, h] of [[1, 3], [14, 4], [9, 2]]) for (let k = 0; k < h; k++) g.set(x, T - 1 - k - (x === 9 ? 3 : 0), 'moss', k === h - 1 ? 4 : 2);
  for (let x = 1; x <= 14; x++) if (!g.opaque(x, 15)) g.set(x, 15, 'moss', 1);
  return g;
}

// ─── Rasgos de las variantes (solo en el centro) ───────────────────────────────────────────────────────────────────
/** Mancha en forma de nube: celdas (x, y) con su distancia normalizada al centro (< 1). */
function cloud(rng, lo, hi, rx0 = 2.5, ry0 = 1.6) {
  const x0 = irange(rng, lo + 2, hi - 2);
  const y0 = irange(rng, lo + 2, hi - 2);
  const rx = rx0 + rng() * 2;
  const ry = ry0 + rng() * 1.2;
  const lobes = Array.from({ length: 5 }, () => 0.7 + rng() * 0.5);
  const out = [];
  for (let y = Math.floor(y0 - ry - 1); y <= Math.ceil(y0 + ry + 1); y++) {
    for (let x = Math.floor(x0 - rx - 1); x <= Math.ceil(x0 + rx + 1); x++) {
      if (x < lo || y < lo || x > hi || y > hi) continue;
      const a = Math.atan2((y - y0) / ry, (x - x0) / rx);
      const r = lobes[mod(Math.round((a / (Math.PI * 2)) * 5), 5)];
      const d = Math.hypot((x - x0) / rx, (y - y0) / ry) / r;
      if (d <= 1) out.push([x, y, d]);
    }
  }
  return out;
}
/** Grieta fina: polilínea con quiebres desde (x, y). */
function crackPath(rng, x, y, n, dx, dy) {
  // Mayormente hacia abajo, con un quiebre de lado de vez en cuando (sin volver: no dibuja letras).
  const pts = [];
  for (let i = 0; i < n; i++) {
    pts.push([x, y]);
    y += dy;
    if (rng() < 0.35) x += dx;
  }
  return pts;
}
function paintCrack(g, pts) {
  pts.forEach(([x, y], k) => isCal(g, x, y) && g.set(x, y, 'cal', k < 2 || k > pts.length - 3 ? 3 : 2));
  for (const [x, y] of pts) {
    if (isCal(g, x - 1, y) && g.step(x - 1, y) > 3 && !pts.some(([a, b]) => a === x - 1 && b === y)) g.set(x - 1, y, 'cal', 6);
  }
}
/** Ladrillos de adobe dentro de `cells` (aparejo trabado de 5 × 2 con juntas oscuras), con paja en la cara. */
function paintAdobe(g, cells, ox = 0, oy = 0) {
  for (const [x, y] of cells) {
    const row = Math.floor((y + oy) / 3);
    const along = mod(x + ox + (row % 2 ? 3 : 0), 6);
    const inRow = mod(y + oy, 3);
    let s = inRow === 2 || along === 5 ? 1 : inRow === 0 ? 4 : 3;
    if (s > 1 && (x * 7 + y * 5) % 11 === 0) s = 5; // la paja
    g.set(x, y, 'adobe', s);
  }
}
/** El revoque caído: un hueco irregular con adobe adentro, el canto en sombra arriba a la izquierda y claro abajo. */
function paintPlasterLoss(g, cells) {
  const inside = new Set(cells.map(([x, y]) => `${x},${y}`));
  paintAdobe(g, cells);
  for (const [x, y] of cells) {
    if (!inside.has(`${x},${y - 1}`) && isCal(g, x, y - 1)) g.set(x, y - 1, 'cal', 2);
    if (!inside.has(`${x - 1},${y}`) && isCal(g, x - 1, y)) g.set(x - 1, y, 'cal', 3);
    if (!inside.has(`${x},${y + 1}`) && isCal(g, x, y + 1)) g.set(x, y + 1, 'cal', 7);
    if (!inside.has(`${x + 1},${y}`) && isCal(g, x + 1, y)) g.set(x + 1, y, 'cal', 6);
    // La sombra que hace el revoque adentro del hueco, en la fila de arriba.
    if (!inside.has(`${x},${y - 1}`)) g.set(x, y, 'adobe', 0);
  }
}

function paintCalFeature(g, kind, rng, lo = 3, hi = 12) {
  switch (kind) {
    case 'damp': {
      // Humedad: una mancha suave, apenas tostada en el centro y en medio tono alrededor, de borde tramado.
      for (const [x, y, d] of cloud(rng, lo, hi, 3.5, 2.2)) {
        if (!isCal(g, x, y)) continue;
        if (d < 0.45) g.set(x, y, 'damp', 4);
        else if (d < 0.75 || (1 - d) / 0.25 > bayer(x, y)) g.set(x, y, 'calm', 0);
      }
      break;
    }
    case 'fresh':
      // Una mano de cal más nueva: más blanca, con el canto de la pincelada arriba.
      for (const [x, y, d] of cloud(rng, lo, hi, 3.5, 2)) if (isCal(g, x, y) && (d < 0.65 || (1 - d) / 0.35 > bayer(x, y))) g.set(x, y, d < 0.65 ? 'cal' : 'calm', d < 0.65 ? 6 : 1);
      break;
    case 'crack': {
      const x = irange(rng, lo + 1, hi - 3);
      paintCrack(g, crackPath(rng, x, lo, irange(rng, 7, 9), rng() < 0.5 ? 1 : -1, 1));
      break;
    }
    case 'hairline': {
      const x = irange(rng, lo + 2, hi - 2);
      paintCrack(g, crackPath(rng, x, lo, irange(rng, 5, 8), rng() < 0.5 ? 1 : -1, 1));
      break;
    }
    case 'peel': {
      // Una cáscara de cal que se levanta: canto claro arriba, sombra abajo.
      const x = irange(rng, lo, hi - 4);
      const y = irange(rng, lo + 1, hi - 1);
      const w = irange(rng, 3, 4);
      for (let i = 0; i < w; i++) {
        g.set(x + i, y, 'cal', 7);
        g.set(x + i, y + 1, 'cal', i === 0 ? 4 : 2);
      }
      g.set(x + w, y + 1, 'cal', 3);
      break;
    }
    case 'adobe': {
      // Se cayó el revoque: asoman dos o tres ladrillos de adobe.
      const x0 = irange(rng, lo + 1, hi - 5);
      const y0 = irange(rng, lo + 2, hi - 3);
      const cells = [];
      const w = irange(rng, 4, 5);
      for (let y = 0; y < 3; y++) for (let x = 0; x < w; x++) if (!((y === 0 && x === w - 1) || (y === 2 && x === 0))) cells.push([x0 + x, y0 + y]);
      paintPlasterLoss(g, cells);
      break;
    }
    case 'soot':
      // Polvo pegado: una mancha suave, apenas más oscura.
      for (const [x, y, d] of cloud(rng, lo, hi, 3.5, 2)) if (isCal(g, x, y) && (d < 0.6 || (1 - d) / 0.4 > bayer(x, y))) g.set(x, y, 'calm', 0);
      break;
    case 'stroke': {
      // Una pincelada larga.
      const x = irange(rng, lo - 1, lo + 1);
      const y = irange(rng, lo + 1, hi - 1);
      const l = irange(rng, 7, 10);
      for (let i = 0; i < l; i++) {
        if (isCal(g, x + i, y)) g.set(x + i, y, 'cal', i < 2 ? 7 : 6);
        if (i > 1 && i < l - 1 && isCal(g, x + i, y + 1) && rng() < 0.6) g.set(x + i, y + 1, 'cal', 4);
      }
      break;
    }
  }
}

function paintEarthFeature(g, kind, rng, lo = 3, hi = 12) {
  switch (kind) {
    case 'wet':
    case 'dry':
      for (const [x, y, d] of cloud(rng, lo, hi)) if ((g.ramp(x, y) === 'earthm' || (g.ramp(x, y) === 'earth' && g.step(x, y) === EARTH)) && (d < 0.6 || rng() < 0.45)) g.set(x, y, 'earth', kind === 'dry' ? 4 : 2);
      break;
    case 'pebble': {
      // Una piedrita: 3 × 2, con luz arriba a la izquierda y su sombra.
      const x = irange(rng, lo, hi - 3);
      const y = irange(rng, lo, hi - 2);
      for (const [dx, dy, t] of [[1, 0, 5], [2, 0, 4], [0, 1, 4], [1, 1, 3], [2, 1, 2]]) g.set(x + dx, y + dy, 'stone', t);
      g.set(x + 1, y + 2, 'earth', 1);
      g.set(x + 2, y + 2, 'earth', 1);
      break;
    }
    case 'shard': {
      // Un cascote de teja: curvo, con su canto claro.
      const x = irange(rng, lo, hi - 4);
      const y = irange(rng, lo, hi - 2);
      for (let i = 0; i < 4; i++) {
        g.set(x + i, y + (i === 0 || i === 3 ? 1 : 0), 'teja', i === 1 ? 6 : 5);
        g.set(x + i, y + 1 + (i === 0 || i === 3 ? 1 : 0), 'teja', 3);
      }
      g.set(x + 1, y + 2, 'earth', 1);
      break;
    }
    case 'sand':
      for (let k = 0; k < 6; k++) g.set(irange(rng, lo, hi), irange(rng, lo, hi), 'sand', irange(rng, 1, 3));
      break;
    case 'pores':
      for (let k = 0; k < 4; k++) {
        const x = irange(rng, lo, hi);
        const y = irange(rng, lo + 1, hi);
        g.set(x, y, 'earth', 0);
        g.set(x, y - 1, 'earth', 4);
      }
      break;
    case 'rootlet': {
      let x = irange(rng, lo + 2, hi - 2);
      for (let y = lo; y < hi; y++) {
        g.set(x, y, 'wood', 3);
        if (rng() < 0.3) x += rng() < 0.5 ? -1 : 1;
      }
      break;
    }
  }
}

// ─── Variantes ─────────────────────────────────────────────────────────────────────────────────────────────────────
const CAL_FEATURES = [
  [],
  [],
  ['damp'],
  ['fresh'],
  [],
  ['soot'],
  ['fresh'],
  ['crack'],
  [],
  ['damp'],
  ['soot'],
  ['fresh'],
  [],
  ['fresh', 'soot'],
  ['hairline'],
  [],
];
/** Las variantes de la cal (casilla 15 de las casas). */
export function fillVariants(seed = 1123) {
  const rng = mulberry32(seed);
  const ref = baseCal();
  return CAL_FEATURES.map((features) => {
    const g = baseCal(irange(rng, 1, 1 << 30));
    for (const f of features) paintCalFeature(g, f, rng);
    return restoreSolidBands(g, ref, 15);
  });
}

const EARTH_FEATURES = [[], ['wet'], ['dry'], ['pebble'], [], ['shard'], ['wet'], ['dry'], ['rootlet'], [], ['pebble'], ['wet', 'dry']];
function earthVariant(rng, features) {
  const g = baseEarth(irange(rng, 1, 1 << 30));
  for (const f of features) paintEarthFeature(g, f, rng);
  return g;
}

/** Variantes de los bordes de las casas: el techo (14), la parte de abajo (11), las paredes (7, 13), el tirante (17). */
function wallEdgeVariants(rng) {
  const out = {};
  const tejas = [
    { shifted: [8], moss: [[6, 3]], lichen: [[10, 1], [3, 5]], tufts: [[6, 3]], drips: [5] },
    { broken: [8], moss: [[13, 6]], lichen: [[4, 2]], drips: [13] },
    { shifted: [8], lichen: [[2, 5], [9, 1], [11, 6]], drips: [3] },
    { moss: [[5, 2], [13, 2]], tufts: [[13, 2]], drips: [10] },
    { lichen: [[3, 1], [10, 5]], tufts: [[6, 2]], drips: [6, 12] },
    { broken: [8], moss: [[6, 6]], lichen: [[2, 2]], drips: [9] },
  ];
  out[14] = tejas.map((t, k) => {
    const base = baseCal(irange(rng, 1, 1 << 30));
    paintCalFeature(base, ['damp', 'hairline', 'stroke', 'soot', 'crack', 'peel'][k], rng, 10, 12);
    return restoreSolidBands(wallCell(14, { base, tejas: t }), wallCell(14), 14);
  });
  const notches = {
    11: [
      { bottom: [0, 0, 1, 1, 0, 0, 0, 0, 1, 0, 0, 0, 1, 1, 0, 0] },
      { bottom: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 1, 0, 0, 0, 1] },
      { bottom: [0, 1, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 1, 0] },
      { bottom: [0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0] },
    ],
    7: [{ left: [0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0] }, { left: [0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0] }],
    13: [{ right: [0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0] }, { right: [0, 0, 1, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0] }],
  };
  for (const mask of [11, 7, 13]) {
    out[mask] = notches[mask].map((notch, k) => {
      const base = baseCal(irange(rng, 1, 1 << 30));
      paintCalFeature(base, mask === 11 ? ['damp', 'soot', 'fresh', 'hairline'][k] : [['crack'], ['stroke']][k][0], rng, 4, 10);
      return restoreSolidBands(wallCell(mask, { base, notch }), wallCell(mask), mask);
    });
  }
  const beams = [
    { grain: [[2, 2, 7], [4, 9, 13], [3, 12, 15]], knots: [[5, 3]], nails: [[10, 2]], chips: [0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
    { grain: [[3, 0, 4], [2, 6, 10], [4, 11, 15]], knots: [[12, 2]], nails: [[4, 3]], chips: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0] },
    { grain: [[4, 1, 5], [2, 7, 12]], knots: [], nails: [[7, 1], [13, 3]], chips: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  ];
  out[17] = beams.map((v) => restoreSolidBands(beamCell('center', v), beamCell('center'), LEFT | RIGHT));
  out[22] = PLASTER_CRACKS_ALT.map((c, k) => crackedCell(c, 1124 + k, PLASTER_FALLEN[k + 1]));
  return out;
}

/**
 * Las zonas de la calle (S112): por zona, casilla del autotile → variantes. La celda de una zona lleva siempre una de
 * las suyas (`townZones` en src/systems/terrainDetailLogic.ts dice qué zona es cada celda del mapa).
 */
function zoneTiles(rng) {
  const z = {};
  const ref = (mask, opts = {}) => streetCell(mask, opts);
  // La tierra (el cuerpo de la calle): el relleno y los costados del corte (las zanjas y los pozos).
  z['street.earth'] = {
    15: EARTH_FEATURES.map((f) => restoreSolidBands(earthVariant(rng, f), baseEarth(), 15)),
    7: [['pebbles'], ['shards']].map((f) => restoreSolidBands(streetCell(7, { base: earthVariant(rng, f) }), ref(7), 7)),
    13: [['dry'], ['pebbles']].map((f) => restoreSolidBands(streetCell(13, { base: earthVariant(rng, f) }), ref(13), 13)),
  };
  // El empedrado: las piedras cambian de lugar, de tamaño y de color (y algún yuyo o pétalo en las juntas).
  const cobbles = [
    { stones: [[0, 5, 'stone', 6, 0], [6, 4, 'sandstone', 4, 2], [11, 4, 'stone', 6, 0]] },
    { stones: [[0, 5, 'stone', 6, 0], [6, 3, 'stone', 5, 1], [10, 5, 'sandstone', 5, 1]], weeds: [[9, 2]] },
    { stones: [[0, 5, 'stone', 6, 0], [6, 4, 'stone', 6, 0], [11, 4, 'stone', 6, 0]], petals: [[8, 1]] },
    { stones: [[0, 5, 'stone', 6, 0], [6, 2, 'sandstone', 3, 3], [9, 2, 'stone', 5, 1], [12, 3, 'sandstone', 5, 1]], weeds: [[11, 2]] },
    { stones: [[0, 5, 'stone', 6, 0], [6, 5, 'sandstone', 6, 0], [12, 3, 'stone', 4, 2]] },
    { stones: [[0, 5, 'stone', 6, 0], [6, 4, 'sandstone', 5, 1], [11, 4, 'sandstone', 6, 0]], petals: [[5, 1]], weeds: [[10, 3]] },
    { stones: [[0, 5, 'stone', 6, 0], [6, 3, 'sandstone', 6, 0], [10, 2, 'stone', 3, 3], [13, 2, 'sandstone', 5, 1]] },
    { stones: [[0, 5, 'stone', 6, 0], [6, 6, 'stone', 5, 1], [13, 2, 'sandstone', 4, 2]], weeds: [[12, 2]] },
  ];
  const cobbleRef = ref(14);
  z['street.cobble'] = {
    14: cobbles.map((c, k) => restoreSolidBands(streetCell(14, { base: earthVariant(rng, EARTH_FEATURES[k]), cobbles: c }), cobbleRef, 14)),
    12: [ref(12)],
    6: [ref(6)],
  };
  // El ladrillo de los pisos elevados y de adentro.
  const bricks = [
    {},
    { tones: [[1, -1], [0, 1]], chips: [6, 7, 14], moss: [[7, 3]] },
    { tones: [[-1, 0], [1, -1]], chips: [0, 7], petals: [[3, 0], [11, 4]] },
    { tones: [[0, 1], [-1, 0]], chips: [5, 6, 7], moss: [[3, 7], [11, 3]] },
  ];
  const brickRef = ref(14, { top: 'brick' });
  z['street.brick'] = {
    14: bricks.map((b, k) => restoreSolidBands(streetCell(14, { top: 'brick', bricks: b, base: earthVariant(rng, EARTH_FEATURES[k + 3]) }), brickRef, 14)),
    12: [ref(12, { top: 'brick' })],
    6: [ref(6, { top: 'brick' })],
  };
  // El cimiento bajo una casa.
  const found = [
    { stones: [[0, 7, 'stone', 5, 1], [8, 7, 'sandstone', 5, 1]] },
    { stones: [[0, 7, 'stone', 5, 1], [8, 3, 'stone', 4, 2], [12, 3, 'sandstone', 5, 1]] },
    { stones: [[0, 7, 'stone', 5, 1], [8, 4, 'sandstone', 5, 1], [13, 2, 'stone', 3, 3]] },
  ];
  const plinthRef = ref(15, { plinth: true });
  z['street.plinth'] = {
    15: found.map((f) => restoreSolidBands(streetCell(15, { plinth: true, foundation: f, base: earthVariant(rng, ['pebbles']) }), plinthRef, 15)),
    7: [ref(7, { plinth: true })],
    13: [ref(13, { plinth: true })],
  };
  // Los pisos de adentro de las casas (el henil, el campanario): ladrillo sobre la cal.
  z['wall.brick'] = Object.fromEntries([14, 4, 6, 8, 10, 12].map((m) => [m, [wallCell(m, { top: 'brick' })]]));
  z['wall.brick'][14].push(restoreSolidBands(wallCell(14, { top: 'brick', bricks: bricks[2] }), wallCell(14, { top: 'brick' }), 14));
  // Los zócalos: ocre y azul gastado, cada uno con sus variantes.
  const socleVariants = [
    {},
    { worn: [[4, 11], [5, 11], [11, 9], [12, 13]], adobe: [[8, 13], [9, 13], [9, 12]] },
    { worn: [[7, 10], [10, 12], [11, 12]], strokes: [[1, 9, 4, 4], [9, 11, 5, 2], [12, 9, 6, 4], [5, 10, 4, 4]] },
  ];
  for (const color of ['ochre', 'blue']) {
    const key = `wall.${color}`;
    const r15 = wallCell(15, { socle: color });
    z[key] = {
      15: socleVariants.map((sv, k) => {
        const base = baseCal(irange(rng, 1, 1 << 30));
        if (k) paintCalFeature(base, ['damp', 'hairline'][k - 1], rng, 2, 6);
        return restoreSolidBands(wallCell(15, { base, socle: color, socleVariant: sv }), r15, 15);
      }),
      5: [wallCell(5, { socle: color })],
      7: [wallCell(7, { socle: color })],
      13: [wallCell(13, { socle: color })],
    };
  }
  return z;
}

// ─── Calcomanías ───────────────────────────────────────────────────────────────────────────────────────────────────
/** Calcomanías: grillas transparentes de w × h casillas que se dibujan encima de la cal o de la tierra. */
export function decals(seed = 1125) {
  const rng = mulberry32(seed);
  const out = {};
  const one = (fn, w = 1, h = 1) => {
    const g = grid(w * T, h * T);
    fn(g);
    return g;
  };
  // Sobre la cal ──────────────────────────────────────
  // Grietas finas con su labio claro (sobre la cal blanca: se pintan en tonos de cal).
  const crackDecal = (pts) => (g) => {
    pts.forEach(([x, y], k) => g.set(x, y, 'cal', k < 2 || k > pts.length - 3 ? 3 : 2));
    for (const [x, y] of pts) if (!pts.some(([a, b]) => a === x - 1 && b === y)) g.set(x - 1, y, 'cal', 6);
  };
  out.crack = [
    one(crackDecal([[4, 3], [5, 4], [5, 5], [6, 6], [7, 7], [7, 8], [8, 9], [9, 9], [10, 10], [10, 11]])),
    one(crackDecal([[11, 2], [11, 3], [10, 4], [10, 5], [9, 6], [9, 7], [8, 8], [7, 8], [6, 9], [6, 10], [5, 11], [5, 12]])),
    one(crackDecal([[3, 8], [4, 8], [5, 7], [6, 7], [7, 8], [8, 8], [9, 7], [10, 7], [11, 8], [12, 8]])),
  ];
  // Grieta larga que baja de un tirón (2 casillas de alto).
  out.longCrack = [
    one(crackDecal([[8, 2], [8, 3], [9, 4], [9, 5], [9, 6], [10, 7], [10, 8], [10, 9], [9, 10], [9, 11], [9, 12], [8, 13], [8, 14], [8, 15], [8, 16], [7, 17], [7, 18], [7, 19], [8, 20], [8, 21], [9, 22], [9, 23]]), 1, 2),
  ];
  // Humedad: mancha gris amarillenta, de bordes tramados, con la marca de marea donde se secó.
  const dampDecal = (cx, cy, rx, ry, s) => (g) => {
    const lobes = Array.from({ length: 6 }, (_, k) => 0.8 + 0.25 * Math.sin(k * 2.1 + s));
    for (let y = 0; y < g.h; y++) {
      for (let x = 0; x < g.w; x++) {
        const a = Math.atan2((y - cy) / ry, (x - cx) / rx);
        const r = lobes[mod(Math.round((a / (Math.PI * 2)) * 6), 6)];
        const d = Math.hypot((x - cx) / rx, (y - cy) / ry) / r;
        if (d > 1) continue;
        const edge = d > 0.65 ? (1 - d) / 0.35 : 1;
        if (edge < bayer(x, y)) continue;
        g.set(x, y, 'damp', d > 0.86 ? 3 : 4);
      }
    }
  };
  out.damp = [one(dampDecal(8, 8, 6, 4, 1)), one(dampDecal(8, 9, 5, 5, 2)), one(dampDecal(16, 8, 12, 4.5, 3), 2, 1)];
  // La humedad que sube del pie (más alta en el medio, la marca de marea ondulada, se aclara hacia arriba).
  out.rising = [
    one((g) => {
      for (let x = 0; x < 32; x++) {
        const h = 5 + 4 * Math.sin((x / 31) * Math.PI) + 1.2 * Math.sin(x * 0.9);
        for (let y = 0; y < T; y++) {
          const up = T - y;
          if (up > h) continue;
          const fade = Math.min(1, (h - up + 1) / 3);
          if (fade < bayer(x, y)) continue;
          g.set(x, y, 'damp', up > h - 1 ? 3 : 4);
        }
      }
    }, 2, 1),
  ];
  // Revoque caído: asoman los ladrillos de adobe (1 × 1, 2 × 1 y 2 × 2).
  const loss = (cells) => (g) => {
    const inside = new Set(cells.map(([x, y]) => `${x},${y}`));
    paintAdobe(g, cells);
    for (const [x, y] of cells) {
      if (!inside.has(`${x},${y - 1}`)) {
        g.set(x, y - 1, 'cal', 2);
        g.set(x, y, 'adobe', 0);
      }
      if (!inside.has(`${x - 1},${y}`)) g.set(x - 1, y, 'cal', 3);
      if (!inside.has(`${x},${y + 1}`)) g.set(x, y + 1, 'cal', 7);
      if (!inside.has(`${x + 1},${y}`)) g.set(x + 1, y, 'cal', 6);
    }
  };
  const blob = (w, h, cx, cy, rx, ry, s) => {
    const r2 = mulberry32(s);
    const cells = [];
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const wob = 0.8 + 0.4 * r2();
        if (Math.hypot((x - cx) / rx, (y - cy) / ry) < wob) cells.push([x, y]);
      }
    }
    return cells;
  };
  out.adobe = [
    one(loss(blob(T, T, 8, 8, 4.5, 3.2, 11))),
    one(loss(blob(T, T, 7, 9, 3.6, 3.8, 12))),
    one(loss(blob(2 * T, T, 15, 8, 9, 3.4, 13)), 2, 1),
    one(loss(blob(2 * T, 2 * T, 15, 15, 9, 8, 14)), 2, 2),
  ];
  // Ladrillos cocidos de un remiendo (naranjas, con su mortero).
  out.patch = [
    one((g) => {
      for (const [x0, y0] of [[4, 6], [10, 6], [7, 9]]) {
        for (let x = 0; x < 5; x++) for (let y = 0; y < 2; y++) g.set(x0 + x, y0 + y, 'brick', y === 0 ? (x === 0 ? 5 : 4) : 3);
        for (let x = -1; x <= 5; x++) g.set(x0 + x, y0 + 2, 'cal', 2);
        g.set(x0 - 1, y0, 'cal', 2);
        g.set(x0 - 1, y0 + 1, 'cal', 2);
      }
    }),
  ];
  // Hierro: un clavo con su chorrete de óxido, una argolla de atar caballos, un gancho.
  out.iron = [
    one((g) => {
      g.set(8, 6, 'iron', 4);
      g.set(9, 6, 'iron', 2);
      g.set(8, 7, 'iron', 1);
      for (let y = 8; y < 12; y++) g.set(8 + (y > 10 ? 1 : 0), y, 'rust', y < 10 ? 2 : 1);
    }),
    one((g) => {
      // La argolla de atar caballos: la placa clavada y el aro de 6 px que cuelga, con su chorrete de óxido.
      for (const [x, y] of [[7, 2], [8, 2], [9, 2], [7, 3], [9, 3]]) g.set(x, y, 'iron', 2);
      g.set(8, 3, 'iron', 5);
      const ring = [[8, 4, 4], [7, 5, 5], [6, 6, 5], [6, 7, 4], [6, 8, 3], [7, 9, 2], [8, 9, 2], [9, 9, 1], [10, 8, 1], [10, 7, 2], [10, 6, 3], [9, 5, 3]];
      for (const [x, y, t] of ring) g.set(x, y, 'iron', t);
      for (const [x, y] of [[8, 10], [8, 11], [8, 12], [9, 13]]) g.set(x, y, 'rust', 1);
      g.set(7, 10, 'rust', 2);
    }),
    one((g) => {
      for (const [x, y, s] of [[6, 5, 4], [6, 6, 3], [6, 7, 3], [6, 8, 2], [7, 9, 3], [8, 9, 3], [9, 8, 4], [9, 7, 2]]) g.set(x, y, 'iron', s);
      g.set(7, 5, 'iron', 1);
      for (let y = 10; y < 13; y++) g.set(6, y, 'rust', 1);
    }),
  ];
  // Una mano de cal más nueva (un retoque): más blanca, de bordes tramados.
  out.retouch = [
    one((g) => {
      for (let y = 3; y < 13; y++) {
        for (let x = 2; x < 14; x++) {
          const d = Math.hypot((x - 8) / 6, (y - 8) / 4.5);
          if (d > 1 || (d > 0.6 && (1 - d) / 0.4 < bayer(x, y))) continue;
          g.set(x, y, 'cal', 6);
        }
      }
    }),
  ];
  // Musgo al pie de la pared (sobre el zócalo).
  out.footMoss = [0, 1, 2].map((k) =>
    one((g) => {
      const xs = [[2, 3, 4, 5, 8, 9], [6, 7, 8, 11, 12, 13], [1, 2, 9, 10, 11, 14]][k];
      for (const x of xs) {
        const h = 1 + ((x * 7 + k) % 3);
        for (let y = T - h; y < T; y++) g.set(x, y, 'moss', y === T - h ? 4 : 2);
        g.set(x, T - 1, 'moss', 1);
      }
      if (k === 1) g.set(12, T - 4, 'moss', 5);
    }),
  );
  // Sobre las tejas (el piso de las casas) ───────────
  // Pétalos de lapacho caídos sobre el techo, en los canales y sobre los lomos.
  const petals = (pts) => (g) => {
    for (const [x, y, s] of pts) {
      g.set(x, y, 'petal', s);
      if (s > 2) g.set(x + 1, y, 'petal', s - 1);
    }
  };
  out.roofPetals = [
    one(petals([[2, 1, 4], [6, 4, 3], [11, 2, 4], [13, 5, 2], [8, 0, 3]])),
    one(petals([[4, 2, 3], [9, 1, 4], [12, 4, 3], [0, 5, 2]])),
    one(petals([[1, 4, 3], [5, 1, 4], [7, 5, 2], [10, 3, 3], [14, 1, 3]])),
  ];
  // Un yuyo que creció entre las tejas.
  out.roofTuft = [
    one((g) => {
      for (const [x, h, lean] of [[4, 4, -1], [5, 6, 0], [6, 3, 1], [7, 5, 1]]) for (let k = 0; k < h; k++) g.set(x + (k > h / 2 ? lean : 0), 3 - k + 1, 'moss', k === h - 1 ? 5 : 3);
      g.set(5, 3, 'moss', 1);
      g.set(6, 4, 'moss', 1);
    }),
    one((g) => {
      for (const [x, h, lean] of [[10, 3, -1], [11, 5, 0], [12, 4, 1]]) for (let k = 0; k < h; k++) g.set(x + (k > h / 2 ? lean : 0), 3 - k + 1, 'moss', k === h - 1 ? 5 : 3);
      g.set(11, 4, 'moss', 1);
      g.set(13, 0, 'petal', 3);
    }),
  ];
  // Musgo que baja del alero (una chorreadura verde y oscura por la cal: 1 × 2).
  out.eaveStain = [0, 1].map((k) =>
    one((g) => {
      const x0 = k ? 10 : 5;
      for (let y = 8; y < 8 + (k ? 14 : 18); y++) {
        const x = x0 + (y > 14 ? 1 : 0);
        g.set(x, y, y < 11 ? 'moss' : 'damp', y < 10 ? 2 : y < 11 ? 1 : 3);
        if (y < 16 && (y * 3) % 4 === 0) g.set(x + 1, y, 'damp', 4);
      }
      g.set(x0, 7, 'moss', 3);
    }, 1, 2),
  );
  // Sobre la calle ────────────────────────────────────
  out.streetPetals = [
    one(petals([[3, 0, 3], [9, 1, 4], [13, 0, 3]])),
    one(petals([[5, 1, 4], [10, 0, 3]])),
  ];
  out.streetWeed = [
    one((g) => {
      for (const [x, h] of [[6, 2], [7, 3], [8, 2]]) for (let k = 0; k < h; k++) g.set(x, 1 - k + 1, 'moss', k === h - 1 ? 4 : 2);
    }),
  ];
  // En la tierra ───────────────────────────────────────
  const pebble = (x, y, w, h, r = 'stone') => (g) => {
    const n = RAMPS[r].length;
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        if ((i === 0 || i === w - 1) && (j === 0 || j === h - 1) && w > 2) continue;
        g.set(x + i, y + j, r, j === 0 ? n - 2 : j === h - 1 ? 1 : i === 0 ? n - 3 : 3);
      }
    }
    for (let i = 1; i < w; i++) g.set(x + i, y + h, 'earth', 1);
  };
  out.pebble = [one(pebble(6, 7, 3, 2)), one(pebble(9, 9, 4, 3, 'sandstone')), one((g) => [pebble(4, 6, 3, 2), pebble(10, 10, 2, 2, 'sandstone')].forEach((f) => f(g)))];
  out.stone = [one(pebble(4, 5, 7, 5)), one(pebble(5, 6, 6, 4, 'sandstone'))];
  out.shard = [
    one((g) => {
      for (let x = 5; x <= 10; x++) {
        g.set(x, 7 + (x > 8 ? 1 : 0), 'teja', x === 5 ? 6 : 5);
        g.set(x, 8 + (x > 8 ? 1 : 0), 'teja', 3);
      }
      g.set(11, 9, 'earth', 1);
    }),
    one((g) => {
      for (let x = 4; x <= 9; x++) for (let y = 8; y <= 10; y++) g.set(x, y, 'brick', y === 8 ? 5 : y === 10 ? 2 : 4);
      g.set(9, 8, 'brick', 3);
      for (let x = 5; x <= 10; x++) g.set(x, 11, 'earth', 1);
    }),
  ];
  // Raíces del lapacho (2 × 1): gruesas, que cruzan la tierra.
  out.root = [0, 1].map((k) =>
    one((g) => {
      let y = k ? 5 : 9;
      for (let x = 2; x < 2 * T - 2; x++) {
        g.set(x, y, 'wood', x % 5 === 0 ? 4 : 3);
        g.set(x, y + 1, 'wood', 1);
        if ((x * (k ? 5 : 3)) % 7 === 0) y += k ? 1 : -1;
        if (x % 9 === 4) for (let j = 1; j <= 3; j++) g.set(x + (j >> 1), y + 1 + j, 'wood', j === 3 ? 1 : 2);
      }
    }, 2, 1),
  );
  // Ladrillos viejos enterrados (un cimiento de antes, 2 × 1).
  out.oldBricks = [
    one((g) => {
      for (const [x0, y0] of [[4, 7], [12, 7], [8, 10], [16, 10]]) {
        for (let x = 0; x < 7; x++) for (let y = 0; y < 2; y++) g.set(x0 + x, y0 + y, 'brick', y === 0 ? (x === 0 ? 4 : 3) : 2);
        g.set(x0 + 7, y0, 'earth', 1);
        g.set(x0 + 7, y0 + 1, 'earth', 1);
      }
    }, 2, 1),
  ];
  // El relleno de la calle (2 × 1): cascotes de teja y de ladrillo y piedritas, apisonados bajo el empedrado.
  out.rubble = [0, 1].map((k) =>
    one((g) => {
      const r2 = mulberry32(1127 + k);
      for (let n = 0; n < 7; n++) {
        const x = 2 + Math.floor(r2() * 26);
        const y = 3 + Math.floor(r2() * 9);
        const kind = n % 3;
        if (kind === 0) for (const [dx, dy, t] of [[0, 0, 5], [1, 0, 4], [2, 0, 3], [1, 1, 2]]) g.set(x + dx, y + dy, dy ? 'earth' : 'teja', dy ? 1 : t);
        else if (kind === 1) for (const [dx, dy, t] of [[0, 0, 4], [1, 0, 3], [0, 1, 3], [1, 1, 2]]) g.set(x + dx, y + dy, 'brick', t);
        else for (const [dx, dy, t] of [[1, 0, 5], [0, 1, 4], [1, 1, 3], [2, 1, 2]]) g.set(x + dx, y + dy, 'stone', t);
      }
    }, 2, 1),
  );
  // Capas del suelo (3 × 1 y 2 × 1): una oscura y compacta, otra arenosa.
  out.layer = [
    one((g) => paintLayer(g, 2, 45, 7, 2, 0), 3, 1),
    one((g) => paintLayer(g, 2, 29, 9, 4, 5), 2, 1),
    one((g) => paintLayer(g, 3, 44, 10, 4, 3), 3, 1),
    one((g) => paintLayer(g, 2, 28, 6, 2, 9), 2, 1),
  ];
  void rng;
  return out;
}

// ─── Las dos hojas ─────────────────────────────────────────────────────────────────────────────────────────────────
/** public/assets/tiles/pueblo.png: las 28 casillas de siempre (ASSETS §6): las casas. */
export function buildPuebloTileset() {
  const cells = [];
  for (let mask = 0; mask < 16; mask++) cells[mask] = mask === 15 ? baseCal() : wallCell(mask);
  cells[16] = beamCell('left');
  cells[17] = beamCell('center');
  cells[18] = beamCell('right');
  cells[19] = spikesCell();
  cells[20] = waterCell('surface');
  cells[21] = waterCell('body');
  cells[22] = crackedCell();
  cells[23] = weedsCell();
  cells[24] = eaveCell();
  cells[25] = rubbleCell();
  return buildTilesetImage(cells);
}

/** Zonas que no se espejan (las de varias casillas que se alinean con algo, y la humedad del pie). */
const FIXED = ['rising', 'eaveStain', 'footMoss', 'roofPetals', 'roofTuft', 'streetPetals', 'streetWeed', 'layer'];

/**
 * public/assets/tiles/detalle/pueblo.png y su .json (S112): las variantes de la cal, de los bordes de las casas, del
 * tirante y del revoque rajado; las zonas de la calle (`zones`: zona → casilla → variantes) y las calcomanías. Como en
 * el estero, `glow`: la luz de las grietas del revoque rajado para el tajo cargado.
 */
export function buildPuebloDetail() {
  const rng = mulberry32(1126);
  const edges = wallEdgeVariants(rng);
  const zones = zoneTiles(rng);
  const glows = { 22: crackedGlow(), ...Object.fromEntries(PLASTER_CRACKS_ALT.map((c, k) => [`v${k}`, crackedGlow(c, PLASTER_FALLEN[k + 1])])) };
  const extra = { glowTiles: glows };
  for (const [name, group] of Object.entries(zones)) extra[`zone:${name}`] = group;
  const sheet = buildDetailSheet({ fill: fillVariants(), edges, decals: decals(), fixed: FIXED, extra });
  const { layout } = sheet;
  layout.zones = {};
  for (const name of Object.keys(zones)) {
    layout.zones[name] = layout[`zone:${name}`];
    delete layout[`zone:${name}`];
  }
  const glow = { 22: layout.glowTiles[22] };
  layout.edges['22'].forEach((id, k) => (glow[`d${id}`] = layout.glowTiles[`v${k}`]));
  delete layout.glowTiles;
  layout.glow = glow;
  return sheet;
}

export const buildTileset = buildPuebloTileset;
export const buildDetail = buildPuebloDetail;
