import { GAMEPLAY } from '../../config/gameplay';

// Letras del logo de la portada (S105), diseñadas en una grilla de píxeles: nada de fuente vectorial. Lógica pura.
// La grande (KERANA) se arma con trazos de píxel a píxel (fustes, remates y diagonales de pendiente fija para que
// los escalones salgan parejos); la chica (el subtítulo), dibujada en ASCII. Un píxel de la letra = 1 unidad del mundo.

/** Máscara de una letra: `true` = tinta. */
export interface Glyph {
  width: number;
  height: number;
  ink: boolean[];
}

function blank(width: number, height: number): Glyph {
  return { width, height, ink: new Array<boolean>(width * height).fill(false) };
}

function fill(g: Glyph, x0: number, y0: number, x1: number, y1: number): void {
  for (let y = Math.max(0, y0); y < Math.min(g.height, y1); y++)
    for (let x = Math.max(0, x0); x < Math.min(g.width, x1); x++) g.ink[y * g.width + x] = true;
}

/** Trazo diagonal: en cada fila de [y0, y1) tinta de ancho `w` que empieza en `x0 + floor((y - y0) * slope)`. */
function diagonal(g: Glyph, x0: number, y0: number, y1: number, w: number, slope: number): void {
  for (let y = y0; y < y1; y++) {
    const x = x0 + Math.floor((y - y0) * slope + 1e-9);
    fill(g, x, y, x + w, y + 1);
  }
}

/** Alto de las mayúsculas grandes (píxeles): el tamaño del logo (GAMEPLAY.titleLook.logo.cap). */
export const BIG_CAP: number = GAMEPLAY.titleLook.logo.cap;

/**
 * Las letras grandes, armadas para cualquier alto `H`: las medidas salen del diseño a 32 píxeles (`u`), los fustes y
 * remates se redondean a píxeles enteros y las diagonales guardan su pendiente (1 píxel cada 2 o 3 filas), así los
 * escalones siguen parejos a cualquier tamaño.
 */
function bigGlyph(ch: string, H: number): Glyph | null {
  const k = H / 32;
  const u = (v: number): number => Math.round(v * k);
  /** Fuste grueso y fino, losa de los brazos, alto del remate y cuánto sobresale. */
  const S = Math.round(H * 0.22);
  const T = Math.max(4, Math.round(H * 0.16));
  const B = Math.round(H * 0.155);
  const sh = Math.max(3, Math.round(H * 0.1));
  const se = Math.max(3, Math.round(H * 0.1));
  const serifBottom = (g: Glyph, x0: number, x1: number): void => {
    fill(g, x0 - se, H - sh, x1 + se, H);
    fill(g, x0 - 1, H - sh - 1, x1 + 1, H - sh);
  };
  const serifTop = (g: Glyph, x0: number, x1: number): void => {
    fill(g, x0 - se, 0, x1 + se, sh);
    fill(g, x0 - 1, sh, x1 + 1, sh + 1);
  };
  switch (ch) {
    case 'K': {
      const j = Math.round(H * 0.6);
      const armTop = se + S + Math.floor(j / 2);
      const r0 = Math.round(H * 0.4);
      const x0 = se + S + 2;
      const xb = x0 + Math.floor((H - 1 - r0) / 2);
      const g = blank(Math.max(armTop + S + 3, xb + S + 2 + se - 2), H);
      fill(g, se, 0, se + S, H);
      serifTop(g, se, se + S);
      serifBottom(g, se, se + S);
      // Brazo: sube a la derecha desde el medio del fuste (un píxel cada dos filas).
      for (let y = 0; y <= j; y++) {
        const x = se + S + Math.floor((j - y) / 2);
        fill(g, x - 1, y, x + S - 1, y + 1);
      }
      fill(g, armTop - 2, 0, armTop + S + 2, sh);
      fill(g, armTop - 1, sh, armTop + S, sh + 1);
      // Pierna: baja a la derecha desde el brazo, más gruesa.
      diagonal(g, x0, r0, H, S + 1, 0.5);
      fill(g, xb - se, H - sh, xb + S + 1 + se - 2, H);
      fill(g, xb - 1, H - sh - 1, xb + S + 1, H - sh);
      return g;
    }
    case 'E': {
      const l = se + 1;
      const r = l + S;
      const w = r + u(15);
      const g = blank(w, H);
      fill(g, l, 0, r, H);
      // Brazos con remate vertical en la punta.
      fill(g, 1, 0, w - 2, B);
      fill(g, w - 6, B, w - 2, B + u(4));
      fill(g, w - 5, B + u(4), w - 2, B + u(4) + 1);
      const m = Math.round(H * 0.41);
      fill(g, r, m, r + u(8), m + B);
      fill(g, r + u(8) - 3, m - u(3), r + u(8), m + B + u(3));
      fill(g, 1, H - B, w - 1, H);
      fill(g, w - 5, H - B - u(5), w - 1, H - B);
      fill(g, w - 4, H - B - u(5) - 1, w - 1, H - B - u(5));
      // Uniones del fuste con los brazos.
      fill(g, l - 1, B, l, B + 1);
      fill(g, l - 1, H - B - 1, l, H - B);
      fill(g, r, B, r + 1, B + 1);
      fill(g, r, H - B - 1, r + 1, H - B);
      return g;
    }
    case 'R': {
      const l = se;
      const r = l + S;
      const hb = Math.round(H * 0.53);
      const reach = u(16);
      const x0 = r + 3;
      const xb = x0 + Math.floor((H - hb) / 2);
      const g = blank(Math.max(r + reach + 1, xb + S + 2), H);
      fill(g, l, 0, r, H);
      fill(g, 0, 0, r, sh);
      fill(g, l - 1, sh, r, sh + 1);
      serifBottom(g, l, r);
      // Panza: losa arriba y abajo, el lado derecho redondeado a escalones (superelipse).
      for (let y = 0; y < hb; y++) {
        const t = ((y + 0.5) / hb) * 2 - 1;
        const ex = Math.pow(1 - Math.pow(Math.abs(t), 2.4), 1 / 2.4);
        const right = Math.round(r + u(9) + (reach - u(9)) * ex);
        fill(g, r, y, right, y + 1);
        if (y >= B && y < hb - B) for (let x = r; x < right - S; x++) g.ink[y * g.width + x] = false;
      }
      // Pierna en diagonal con su remate.
      diagonal(g, x0, hb - 1, H, S + 1, 0.5);
      fill(g, xb - 2, H - sh, xb + S + 2, H);
      fill(g, xb, H - sh - 1, xb + S + 1, H - sh);
      return g;
    }
    case 'A': {
      // Vértice plano, la pierna izquierda fina y la derecha gruesa (un píxel cada tres filas).
      const top = se + Math.floor((H - 1) / 3);
      const lx = (y: number): number => top - Math.floor(y / 3);
      const rx = (y: number): number => top + T + 2 + Math.floor(y / 3);
      const w = rx(H - 1) + 1;
      const g = blank(w, H);
      for (let y = 0; y < H; y++) {
        fill(g, lx(y), y, lx(y) + T, y + 1);
        fill(g, rx(y) - S, y, rx(y), y + 1);
      }
      const rc = Math.round(H * 0.66);
      for (let y = rc; y < rc + Math.max(4, B - 1); y++) fill(g, lx(y), y, rx(y) - 2, y + 1);
      // Remate arriba a la izquierda del vértice y los pies.
      fill(g, lx(0) - 3, 0, lx(0), 2);
      const lb = lx(H - 1);
      const rb = rx(H - 1);
      fill(g, lb - se, H - sh, lb + T + 2, H);
      fill(g, lb - 1, H - sh - 1, lb + T + 1, H - sh);
      fill(g, rb - S - 3, H - sh, rb + 1, H);
      fill(g, rb - S - 1, H - sh - 1, rb, H - sh);
      return g;
    }
    case 'N': {
      // Fustes finos y la diagonal gruesa.
      const xb = se + Math.floor((H - 1) / 2);
      const rs = xb + S + 2 - T;
      const g = blank(rs + T + se, H);
      fill(g, se, 0, se + T, H);
      fill(g, rs, 0, rs + T, H);
      diagonal(g, se, 0, H, S + 1, 0.5);
      fill(g, 0, 0, se + T + 2, sh);
      fill(g, se - 1, sh, se + T + 1, sh + 1);
      fill(g, rs - se, 0, rs + T + se, sh);
      fill(g, rs - 1, sh, rs + T + 1, sh + 1);
      serifBottom(g, se, se + T);
      return g;
    }
    case ' ':
      return blank(u(12), H);
    default:
      return null;
  }
}

/** Filas del subtítulo: 0-2 libres, 3-4 la virgulilla, 2-12 las altas (P, k), 6-12 las bajas. */
export const SMALL_ROWS = 13;
/** Primera fila de las minúsculas (altura x). */
export const SMALL_X_TOP = 6;
const SMALL: Record<string, string[]> = {
  P: ['######..', '.##..##.', '.##...##', '.##...##', '.##..##.', '.#####..', '.##.....', '.##.....', '.##.....', '.##.....', '####....'],
  k: ['###....', '.##....', '.##....', '.##....', '.##.###', '.##.##.', '.####..', '.###...', '.####..', '.##.##.', '###.###'],
  o: ['.####.', '##..##', '##..##', '##..##', '##..##', '##..##', '.####.'],
  e: ['.####.', '##..##', '##..##', '######', '##....', '##...#', '.####.'],
  a: ['.####..', '#...##.', '....##.', '.#####.', '##..##.', '##..##.', '.###.##'],
  i: ['.##.', '.##.', '....', '###.', '.##.', '.##.', '.##.', '.##.', '.##.', '####'],
  m: ['###.##..##.', '.###.###.##', '.##..##..##', '.##..##..##', '.##..##..##', '.##..##..##', '###.###.###'],
  n: ['###.##..', '.###.##.', '.##..##.', '.##..##.', '.##..##.', '.##..##.', '###.###.'],
  r: ['###.###', '.###...', '.##....', '.##....', '.##....', '.##....', '####...'],
  ' ': ['....'],
};
/** Virgulilla de õ y ñ (sobre la letra base, centrada). */
const TILDE = ['.##..#', '#..##.'];
const SMALL_TILDE_TOP = 3;

function smallGlyph(ch: string): Glyph | null {
  const base = ch === 'õ' ? 'o' : ch === 'ñ' ? 'n' : ch;
  const rows = SMALL[base];
  if (!rows) return null;
  const width = Math.max(...rows.map((r) => r.length));
  const g = blank(width, SMALL_ROWS);
  // Las altas (11 filas) y la i (10, con su punto) se apoyan en la base como las bajas (7).
  const top = SMALL_ROWS - rows.length;
  rows.forEach((row, j) => {
    for (let x = 0; x < row.length; x++) if (row[x] === '#') g.ink[(top + j) * width + x] = true;
  });
  if (base !== ch) {
    const off = Math.floor((width - TILDE[0].length) / 2);
    TILDE.forEach((row, j) => {
      for (let x = 0; x < row.length; x++) if (row[x] === '#') g.ink[(SMALL_TILDE_TOP + j) * width + off + x] = true;
    });
  }
  return g;
}

export type FontSize = 'big' | 'small';

export function glyphFor(ch: string, size: FontSize): Glyph | null {
  if (size === 'big') return bigGlyph(ch.toUpperCase(), BIG_CAP);
  return smallGlyph(ch);
}

/** Letras de `text` que la fuente no tiene. */
export function missingGlyphs(text: string, size: FontSize): string[] {
  return [...new Set([...text].filter((ch) => !glyphFor(ch, size)))];
}

/** Separación entre letras (píxeles): con el contorno de 1 píxel, las letras quedan unidas por él. */
export const LETTER_GAP: Record<FontSize, number> = { big: 2, small: 1 };

/** Compone `text` en una sola máscara (las letras que faltan se saltean). */
export function setText(text: string, size: FontSize): Glyph {
  const glyphs = [...text].map((ch) => glyphFor(ch, size)).filter((g): g is Glyph => g !== null);
  const gap = LETTER_GAP[size];
  const height = size === 'big' ? BIG_CAP : SMALL_ROWS;
  const width = Math.max(1, glyphs.reduce((w, g) => w + g.width, 0) + gap * Math.max(0, glyphs.length - 1));
  const out = blank(width, height);
  let x0 = 0;
  for (const g of glyphs) {
    for (let y = 0; y < g.height; y++) for (let x = 0; x < g.width; x++) if (g.ink[y * g.width + x]) out.ink[y * width + x0 + x] = true;
    x0 += g.width + gap;
  }
  return out;
}
