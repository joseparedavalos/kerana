// Lo común de los tilesets dibujados por código (S109 para cerro, S110 generalizado): el azar con semilla, la grilla de
// materiales con su paleta, el paso a RGBA, las bandas que no cambian en una variante y el armado de las dos hojas
// (las 28 casillas del bioma y la hoja de detalle con su JSON). Cada bioma pone su arte en tools/lib/<bioma>-art.mjs y
// tools/make-terrain-tiles.mjs los escribe. Todo sale de semillas fijas: correr el script dos veces da los mismos bytes.

export const T = 16;
export const UP = 1;
export const RIGHT = 2;
export const DOWN = 4;
export const LEFT = 8;
/** Ancho (px) de las bandas de los lados que una variante no toca: lo que toca a un vecino es igual a la base. */
export const RING = 2;

// ─── Azar con semilla ─────────────────────────────────────────────────────────────────────────────────────────────
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const pick = (rng, list) => list[Math.floor(rng() * list.length)];
export const irange = (rng, a, b) => a + Math.floor(rng() * (b - a + 1));
export const mod = (a, n) => ((a % n) + n) % n;

// ─── Paleta: rampas de tonos con nombre ───────────────────────────────────────────────────────────────────────────
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

/** `ramps`: { nombre: ['#rrggbb', …] } (hasta 16 tonos cada una, de lo oscuro a lo claro). */
export function makePalette(ramps) {
  const ids = Object.keys(ramps);
  return {
    ramps,
    ids,
    rid: Object.fromEntries(ids.map((k, i) => [k, i])),
    rgb: ids.map((k) => ramps[k].map(hex)),
  };
}

// ─── Grilla de materiales: cada píxel es (rampa, tono) o transparente; `alpha` para sombras ────────────────────────
export class Grid {
  constructor(w, h, palette) {
    this.w = w;
    this.h = h;
    this.palette = palette;
    this.code = new Int16Array(w * h).fill(-1);
    this.alpha = new Uint8Array(w * h).fill(255);
  }
  clone() {
    const g = new Grid(this.w, this.h, this.palette);
    g.code.set(this.code);
    g.alpha.set(this.alpha);
    return g;
  }
  in(x, y) {
    return x >= 0 && y >= 0 && x < this.w && y < this.h;
  }
  get(x, y) {
    return this.in(x, y) ? this.code[y * this.w + x] : -1;
  }
  ramp(x, y) {
    const c = this.get(x, y);
    return c < 0 ? null : this.palette.ids[c >> 4];
  }
  step(x, y) {
    const c = this.get(x, y);
    return c < 0 ? -1 : c & 15;
  }
  set(x, y, ramp, step, alpha = 255) {
    if (!this.in(x, y)) return;
    const r = this.palette.ramps[ramp];
    const s = Math.max(0, Math.min(r.length - 1, step));
    this.code[y * this.w + x] = (this.palette.rid[ramp] << 4) | s;
    this.alpha[y * this.w + x] = alpha;
  }
  clear(x, y) {
    if (!this.in(x, y)) return;
    this.code[y * this.w + x] = -1;
    this.alpha[y * this.w + x] = 255;
  }
  opaque(x, y) {
    return this.get(x, y) >= 0;
  }
  /** Copia `src` encima en (ox, oy): solo los píxeles no transparentes. */
  stamp(src, ox, oy) {
    for (let y = 0; y < src.h; y++) {
      for (let x = 0; x < src.w; x++) {
        const c = src.code[y * src.w + x];
        if (c < 0 || !this.in(ox + x, oy + y)) continue;
        this.code[(oy + y) * this.w + ox + x] = c;
        this.alpha[(oy + y) * this.w + ox + x] = src.alpha[y * src.w + x];
      }
    }
  }
  sub(ox, oy, w, h) {
    const g = new Grid(w, h, this.palette);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        g.code[y * w + x] = this.get(ox + x, oy + y);
        if (this.in(ox + x, oy + y)) g.alpha[y * w + x] = this.alpha[(oy + y) * this.w + ox + x];
      }
    }
    return g;
  }
}

/** Pasa una grilla a RGBA dentro de `img` (formato { width, height, data }) en (ox, oy). */
export function blit(img, grid, ox, oy) {
  const rgb = grid.palette.rgb;
  for (let y = 0; y < grid.h; y++) {
    for (let x = 0; x < grid.w; x++) {
      const c = grid.code[y * grid.w + x];
      const i = ((oy + y) * img.width + ox + x) * 4;
      if (c < 0) {
        img.data[i + 3] = 0;
        continue;
      }
      const [r, g, b] = rgb[c >> 4][c & 15];
      img.data[i] = r;
      img.data[i + 1] = g;
      img.data[i + 2] = b;
      img.data[i + 3] = grid.alpha[y * grid.w + x];
    }
  }
}

/** Copia de `ref` las bandas de 2 px de los lados sólidos de `mask` (lo que toca a un vecino queda igual a la base). */
export function restoreSolidBands(tile, ref, mask) {
  for (let y = 0; y < T; y++) {
    for (let x = 0; x < T; x++) {
      const band =
        (mask & UP && y < RING) || (mask & DOWN && y >= T - RING) || (mask & LEFT && x < RING) || (mask & RIGHT && x >= T - RING);
      if (!band) continue;
      tile.code[y * T + x] = ref.code[y * T + x];
      tile.alpha[y * T + x] = ref.alpha[y * T + x];
    }
  }
  return tile;
}

// ─── Las dos hojas ─────────────────────────────────────────────────────────────────────────────────────────────────
export const TILESET_COLUMNS = 4;
export const TILESET_ROWS = 7;
export const DETAIL_COLUMNS = 8;
export const newImage = (w, h) => ({ width: w, height: h, data: new Uint8Array(w * h * 4) });

/** El tileset del bioma (64 × 112): `cells[i]` es la grilla de la casilla i (0 a 27; las que faltan, transparentes). */
export function buildTilesetImage(cells) {
  const img = newImage(T * TILESET_COLUMNS, T * TILESET_ROWS);
  cells.forEach((g, i) => {
    if (g) blit(img, g, (i % TILESET_COLUMNS) * T, Math.floor(i / TILESET_COLUMNS) * T);
  });
  return img;
}

/**
 * La hoja de detalle (`public/assets/tiles/detalle/<hoja>.png`) y su JSON: `fill` (variantes de la 15), `edges` (casilla
 * → variantes), `decals` (tipo → [{ w, h, ids, flip }], ids en filas de w; `flip`: se puede espejar a lo ancho) y lo
 * que el bioma agregue en `extra` (tipo → { clave: grilla o lista de grillas }: en el JSON, la casilla o las casillas).
 * Las calcomanías de `fixed` no se espejan.
 */
export function buildDetailSheet({ fill, edges, decals, fixed = [], extra = {} }) {
  const cells = [];
  const add = (g) => {
    cells.push(g);
    return cells.length - 1;
  };
  const layout = { tile: T, columns: DETAIL_COLUMNS, fill: [], edges: {}, decals: {} };
  for (const g of fill) layout.fill.push(add(g));
  for (const [mask, list] of Object.entries(edges)) layout.edges[mask] = list.map(add);
  const still = new Set(fixed);
  for (const [kind, list] of Object.entries(decals)) {
    layout.decals[kind] = list.map((g) => {
      const w = g.w / T;
      const h = g.h / T;
      const ids = [];
      for (let ty = 0; ty < h; ty++) for (let tx = 0; tx < w; tx++) ids.push(add(g.sub(tx * T, ty * T, T, T)));
      return { w, h, ids, flip: !still.has(kind) };
    });
  }
  for (const [name, group] of Object.entries(extra)) {
    layout[name] = Object.fromEntries(Object.entries(group).map(([k, v]) => [k, Array.isArray(v) ? v.map(add) : add(v)]));
  }
  const rows = Math.ceil(cells.length / DETAIL_COLUMNS);
  const img = newImage(T * DETAIL_COLUMNS, T * rows);
  cells.forEach((g, i) => blit(img, g, (i % DETAIL_COLUMNS) * T, Math.floor(i / DETAIL_COLUMNS) * T));
  layout.count = cells.length;
  return { img, layout };
}
