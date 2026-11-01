// El peligro (espinas) dibujado por código a 16 px (S64): baldosas 19, 26 y 27 de cada bioma.
// Dos familias: mineral (puntas de piedra o cristal astillado) y karaguatá (roseta de hojas rígidas con púas).
// Cada píxel es un tono de la paleta del bioma: contorno oscuro, sombra, medio, luz, brillo y el acento.
// La IA de imagen no sirve acá: entrega lienzos de 1408 px y a 16 px se pierde todo (ASSETS §6).
import { readFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { TILE, TILESET_COLUMNS } from './tileset-layout.mjs';

/** Tonos de la grilla. 0 es aire. */
export const TONE = { air: 0, outline: 1, dark: 2, mid: 3, light: 4, shine: 5, accent: 6 };

/**
 * Paleta por bioma: [contorno, sombra, medio, luz, brillo, acento]. El acento es el corazón rojo del karaguatá
 * o la chispa del cristal. Elegidas para leerse contra el suelo y el fondo de cada bioma (capturas de S64).
 * Campo no está: su karaguatá sale de raw/tiles/campo/espinas.jpg (S56).
 */
export const HAZARD_ART = {
  // l1: cueva de piedra gris oscura y ladera con musgo. Cuarzo claro con contorno casi negro.
  cerro: { family: 'mineral', palette: ['#17131F', '#6A5F86', '#A397C4', '#D6CEEE', '#FFFFFF', '#F2C14E'] },
  // l6: laja marrón y cielo de tormenta. Piedra pálida, un poco cálida, para no fundirse con las nubes.
  montana: { family: 'mineral', palette: ['#1C1612', '#7C7066', '#B9AEA2', '#E4DCD0', '#FFFFFF', '#E08A4A'] },
  // l7: adoquín azul de noche. Vidrio verde de botella astillado, claro: la noche lo oscurece.
  ciudad: { family: 'mineral', palette: ['#06140F', '#3AA878', '#78E6B0', '#C2FFE0', '#FFFFFF', '#FFFFFF'] },
  // Yvága: nubes lavanda. Cristal violeta oscuro de Tau.
  cielo: { family: 'mineral', palette: ['#14061F', '#3A1356', '#6A2E8F', '#A65CCC', '#EBC2FF', '#FFE6FF'] },
  // l2: barro y pasto verde. Karaguatá cobrizo, quemado por el sol, para no confundirse con el pasto.
  estero: { family: 'karagua', palette: ['#220C07', '#7A2E1C', '#B5532D', '#E2914E', '#FFD592', '#E8402E'] },
  // l5: suelo oscuro y pasto verde oscuro. Verde amarillento claro con puntas rojas.
  selva: { family: 'karagua', palette: ['#0F1A08', '#4C7A20', '#8CBF4A', '#C8E672', '#F4FFC0', '#E0442E'] },
  // l4: revoque claro. Verde grisáceo oscuro, como el agave de los patios, con el corazón rojo.
  pueblo: { family: 'karagua', palette: ['#141A18', '#2C4A44', '#4C7466', '#86AA8C', '#D2E6C2', '#D2402C'] },
};

// Mineral: cada punta es { x: centro de la base, w: medio ancho de la base, tx, ty: la punta }, de atrás hacia adelante.
// Karaguatá: cada hoja es { x, y: arranque, tx, ty: la punta, w: medio ancho en el arranque }, de atrás hacia adelante.
// Las tres variantes de cada familia tienen otra silueta, para que una fila de ^ no se vea estampada.
const SHAPES = {
  mineral: [
    [
      { x: 3.5, w: 2.6, tx: 2.5, ty: 7 },
      { x: 12, w: 2.8, tx: 13, ty: 5 },
      { x: 7.5, w: 3.4, tx: 7, ty: 1 },
    ],
    [
      { x: 11.5, w: 3, tx: 12, ty: 3 },
      { x: 2.5, w: 2.2, tx: 1.5, ty: 9 },
      { x: 6, w: 3.2, tx: 5, ty: 2 },
      { x: 14, w: 1.6, tx: 14.5, ty: 10 },
    ],
    [
      { x: 4.5, w: 3, tx: 4, ty: 4 },
      { x: 9.5, w: 2.4, tx: 10.5, ty: 6 },
      { x: 13, w: 2.2, tx: 13.5, ty: 9 },
      { x: 1.5, w: 1.6, tx: 0.8, ty: 11 },
    ],
  ],
  karagua: [
    [
      { x: 7.5, y: 15, tx: 0.5, ty: 9, w: 1.15 },
      { x: 8, y: 15, tx: 15, ty: 8, w: 1.15 },
      { x: 7.5, y: 15, tx: 3, ty: 3, w: 1.22 },
      { x: 8, y: 15, tx: 12.5, ty: 2, w: 1.22 },
      { x: 7.5, y: 15, tx: 7.5, ty: 0.5, w: 1.3 },
    ],
    [
      { x: 7, y: 15, tx: 0.5, ty: 12, w: 1.08 },
      { x: 8.5, y: 15, tx: 15, ty: 11, w: 1.08 },
      { x: 7.5, y: 15, tx: 1.5, ty: 5, w: 1.22 },
      { x: 8.5, y: 15, tx: 14, ty: 4, w: 1.22 },
      { x: 7.5, y: 15, tx: 9.5, ty: 1, w: 1.3 },
      { x: 8, y: 15, tx: 5, ty: 2, w: 1.15 },
    ],
    [
      { x: 7.5, y: 15, tx: 15, ty: 10, w: 1.08 },
      { x: 7.5, y: 15, tx: 1, ty: 7, w: 1.15 },
      { x: 8, y: 15, tx: 11, ty: 1.5, w: 1.3 },
      { x: 7, y: 15, tx: 4.5, ty: 2.5, w: 1.22 },
    ],
  ],
};

const PEBBLES = [[0, 15], [9], [7, 15]];

/** Cuántas variantes tiene cada familia (las baldosas 19, 26 y 27). */
export const HAZARD_VARIANT_COUNT = 3;

const blank = () => new Uint8Array(TILE * TILE);

/** Una punta de cristal: cara izquierda con luz, derecha en sombra, brillo arriba a la izquierda. */
function shardMask(s) {
  const tone = blank();
  const base = TILE - 1;
  for (let y = Math.floor(s.ty); y <= base; y++) {
    const t = (y + 0.5 - s.ty) / (base + 1 - s.ty);
    if (t <= 0) continue;
    const cx = s.tx + (s.x - s.tx) * t;
    const hw = Math.max(0.5, s.w * t);
    for (let x = 0; x < TILE; x++) {
      const d = x + 0.5 - cx;
      if (Math.abs(d) > hw) continue;
      let c = d < -0.25 ? TONE.light : d > 0.6 ? TONE.dark : TONE.mid;
      // Brillo en el filo de la izquierda, en la parte alta.
      if (t < 0.45 && d < 0 && d <= -hw + 1) c = TONE.shine;
      if (t < 0.15) c = TONE.shine;
      tone[y * TILE + x] = c;
    }
  }
  return tone;
}

/** Una hoja de karaguatá: angosta, se afina hasta la púa; el lado de arriba con luz, la base en sombra. */
function leafMask(l) {
  const tone = blank();
  const vx = l.tx - l.x;
  const vy = l.ty - l.y;
  const len2 = vx * vx + vy * vy;
  const len = Math.sqrt(len2);
  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      const px = x + 0.5 - l.x;
      const py = y + 0.5 - l.y;
      const s = (px * vx + py * vy) / len2;
      if (s < -0.02 || s > 1) continue;
      const cross = (px * vy - py * vx) / len;
      const half = l.w * (1 - s) + 0.3;
      if (Math.abs(cross) > half) continue;
      // El lado que mira hacia arriba recibe la luz.
      const up = vx >= 0 ? cross > 0 : cross < 0;
      let c = up ? TONE.light : TONE.mid;
      if (Math.abs(cross) < 0.45 && s > 0.2) c = TONE.light;
      if (s > 0.86) c = TONE.shine;
      tone[y * TILE + x] = c;
    }
  }
  return tone;
}

/**
 * Compone las piezas de atrás hacia adelante. Cada pieza nueva deja un contorno sobre lo que tapa,
 * para que las puntas se separen; las de atrás van un tono más oscuras. Al final, el contorno de afuera
 * (no abajo: la baldosa se apoya en el suelo) y la sombra en la base.
 */
function compose(masks, before = () => {}) {
  const out = blank();
  const n = masks.length;
  masks.forEach((m, k) => {
    const back = k < n - 2;
    for (let i = 0; i < m.length; i++) {
      if (!m[i]) continue;
      const x = i % TILE;
      const y = (i - x) / TILE;
      // Contorno sobre lo de atrás, a los costados de la pieza nueva.
      for (const nx of [x - 1, x + 1]) {
        if (nx < 0 || nx >= TILE) continue;
        const j = y * TILE + nx;
        if (!m[j] && out[j] > TONE.outline) out[j] = TONE.outline;
      }
      out[i] = back && m[i] > TONE.dark && m[i] !== TONE.shine ? m[i] - 1 : m[i];
    }
  });
  // Sombra en la base: las dos filas de abajo, un tono menos.
  for (let y = TILE - 2; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      const i = y * TILE + x;
      if (out[i] > TONE.dark && out[i] !== TONE.accent) out[i] = y === TILE - 1 ? TONE.dark : out[i] - 1;
    }
  }
  before(out);
  // Contorno de afuera (arriba y a los costados).
  const filled = out.map((v) => (v ? 1 : 0));
  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      const i = y * TILE + x;
      if (filled[i]) continue;
      const near = (x > 0 && filled[i - 1]) || (x < TILE - 1 && filled[i + 1]) || (y > 0 && filled[i - TILE]) || (y < TILE - 1 && filled[i + TILE]);
      if (near) out[i] = TONE.outline;
    }
  }
  return out;
}

/** Grilla de tonos (16 × 16) de la variante `v` de una familia. */
export function hazardTones(family, v) {
  const shapes = SHAPES[family]?.[v];
  if (!shapes) throw new Error(`peligro: no hay ${family}/${v}`);
  if (family === 'mineral') {
    // Cascotes al pie, en sombra.
    return compose(shapes.map(shardMask), (out) => {
      for (const x of PEBBLES[v]) if (!out[(TILE - 1) * TILE + x]) out[(TILE - 1) * TILE + x] = TONE.dark;
    });
  }
  const out = compose(shapes.map(leafMask));
  // El corazón rojo de la roseta, al pie.
  const cx = Math.round(shapes.reduce((a, l) => a + l.x, 0) / shapes.length - 0.5);
  for (const [dx, dy] of [[0, 1], [1, 1], [0, 2], [1, 2], [-1, 1], [2, 1]]) {
    const i = (TILE - dy) * TILE + cx + dx;
    if (out[i]) out[i] = TONE.accent;
  }
  return out;
}

const hex = (c) => {
  const n = parseInt(c.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

/** RGBA de 16 × 16 de la variante `v` del peligro de un bioma (o null si el bioma tiene arte propio). */
export function hazardImage(biome, v) {
  const art = HAZARD_ART[biome];
  if (!art) return null;
  const tones = hazardTones(art.family, v);
  const pal = art.palette.map(hex);
  const data = new Uint8Array(TILE * TILE * 4);
  tones.forEach((t, i) => {
    if (!t) return;
    data.set([...pal[t - 1], 255], i * 4);
  });
  return { width: TILE, height: TILE, data };
}

/** Los píxeles RGBA (16 × 16 × 4) de la baldosa `index` de un PNG de tileset. */
export function readTilePixels(file, index) {
  const png = PNG.sync.read(readFileSync(file));
  const tx = (index % TILESET_COLUMNS) * TILE;
  const ty = Math.floor(index / TILESET_COLUMNS) * TILE;
  const out = new Uint8Array(TILE * TILE * 4);
  for (let y = 0; y < TILE; y++) out.set(png.data.subarray(((ty + y) * png.width + tx) * 4, ((ty + y) * png.width + tx + TILE) * 4), y * TILE * 4);
  return out;
}
