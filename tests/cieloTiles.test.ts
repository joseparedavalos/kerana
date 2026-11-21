import { describe, expect, it } from 'vitest';
import manifestSource from '../src/assets/manifest.ts?raw';
import repoLayout from '../public/assets/tiles/detalle/cielo.json';
import { buildCieloDetail, buildCieloTileset, PALETTE } from '../tools/lib/cielo-art.mjs';
import { readPng } from '../tools/lib/tileset-check.mjs';

// S118: el tileset del cielo (Yvága) sale de tools/make-terrain-tiles.mjs (cielo). Lo que está en el repo es lo que da
// el script; las casillas vecinas empalman en todas las combinaciones del autotile; las variantes no cambian los bordes;
// la nube (16 a 18) tiene la cara de arriba firme y la panza que deja ver el cielo; la quilla empalma en cualquier orden.

type Img = { width: number; height: number; data: Uint8Array };
type Decal = { w: number; h: number; ids: number[]; flip: boolean };
type Layout = {
  columns: number;
  fill: number[];
  edges: Record<string, number[]>;
  decals: Record<string, Decal[]>;
  zones: Record<string, Record<string, number[]>>;
  mover: { left: number; center: number; right: number };
  count: number;
};
const T = 16;
const read = (path: string): Img => readPng(path) as Img;
const same = (a: Uint8Array, b: Uint8Array) => a.length === b.length && a.every((v, i) => v === b[i]);
const cell = (img: Img, i: number, cols: number): number[] => {
  const out: number[] = [];
  const x0 = (i % cols) * T;
  const y0 = Math.floor(i / cols) * T;
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) out.push(...img.data.subarray(((y0 + y) * img.width + x0 + x) * 4, ((y0 + y) * img.width + x0 + x) * 4 + 4));
  return out;
};
const band = (c: number[], side: 'up' | 'down' | 'left' | 'right'): number[] => {
  const out: number[] = [];
  for (let y = 0; y < T; y++) {
    for (let x = 0; x < T; x++) {
      const inBand = side === 'up' ? y < 2 : side === 'down' ? y >= T - 2 : side === 'left' ? x < 2 : x >= T - 2;
      if (inBand) out.push(...c.slice((y * T + x) * 4, (y * T + x) * 4 + 4));
    }
  }
  return out;
};
const alphaAt = (c: number[], x: number, y: number) => c[(y * T + x) * 4 + 3];
const rgbAt = (c: number[], x: number, y: number) => c.slice((y * T + x) * 4, (y * T + x) * 4 + 3);
const hex = (h: string) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const inRamp = (rgb: number[], ramp: string) => (PALETTE.ramps[ramp] as string[]).some((h) => hex(h).every((v, i) => v === rgb[i]));

const UP = 1;
const RIGHT = 2;
const DOWN = 4;
const LEFT = 8;

describe('tileset del cielo por código (S118)', () => {
  const tileset = buildCieloTileset() as Img;
  const { img: detail, layout } = buildCieloDetail() as unknown as { img: Img; layout: Layout };
  const tiles = Array.from({ length: 28 }, (_, m) => cell(tileset, m, 4));
  const sheet = (id: number) => cell(detail, id, layout.columns);

  it('el PNG y el JSON del repo son los que escribe el script', () => {
    const repo = read('public/assets/tiles/cielo.png');
    expect([repo.width, repo.height]).toEqual([64, 112]);
    expect(same(repo.data, tileset.data)).toBe(true);
    const repoDetail = read('public/assets/tiles/detalle/cielo.png');
    expect([repoDetail.width, repoDetail.height]).toEqual([detail.width, detail.height]);
    expect(same(repoDetail.data, detail.data)).toBe(true);
    expect(repoLayout).toEqual(layout);
  });

  it('da siempre lo mismo y el manifest pide la hoja con su tamaño', () => {
    expect(same((buildCieloTileset() as Img).data, tileset.data)).toBe(true);
    expect(same((buildCieloDetail() as unknown as { img: Img }).img.data, detail.data)).toBe(true);
    expect(manifestSource).toContain(`cielo: [${detail.width}, ${detail.height}]`);
  });

  const refH = (mask: number) => (mask & (UP | DOWN)) | LEFT | RIGHT;
  const refV = (mask: number) => (mask & (LEFT | RIGHT)) | UP | DOWN;

  it('empalma a lo ancho y a lo alto en todas las combinaciones del autotile', () => {
    for (let m = 0; m < 16; m++) {
      if (m & RIGHT) expect(band(tiles[m], 'right'), `casilla ${m}, derecha`).toEqual(band(tiles[refH(m)], 'right'));
      if (m & LEFT) expect(band(tiles[m], 'left'), `casilla ${m}, izquierda`).toEqual(band(tiles[refH(m)], 'left'));
      if (m & DOWN) expect(band(tiles[m], 'down'), `casilla ${m}, abajo`).toEqual(band(tiles[refV(m)], 'down'));
      if (m & UP) expect(band(tiles[m], 'up'), `casilla ${m}, arriba`).toEqual(band(tiles[refV(m)], 'up'));
    }
  });

  it('las variantes (y las de la terraza) cambian solo el centro: los lados sólidos son los de la casilla que reemplazan', () => {
    const sides = { up: UP, right: RIGHT, down: DOWN, left: LEFT } as const;
    const check = (id: number, base: number[], mask: number) => {
      const v = sheet(id);
      for (const [side, bit] of Object.entries(sides)) {
        if (mask & bit) expect(band(v, side as keyof typeof sides), `variante ${id}, ${side}`).toEqual(band(base, side as keyof typeof sides));
      }
    };
    expect(layout.fill.length).toBeGreaterThanOrEqual(8);
    for (const id of layout.fill) check(id, tiles[15], 15);
    // La isla de una fila (10) es casi todo el nivel: tiene que tener muchas.
    expect(layout.edges['10'].length).toBeGreaterThanOrEqual(6);
    for (const [key, ids] of Object.entries(layout.edges)) {
      const t = Number(key);
      for (const id of ids) check(id, tiles[t], t === 17 ? LEFT | RIGHT : t);
    }
    // La terraza empalma consigo misma a lo ancho y con el relleno hacia abajo y hacia arriba.
    const terrace = layout.zones.terrace;
    expect(Object.keys(terrace).sort()).toEqual(['11', '14', '15']);
    for (const id of terrace['15']) check(id, tiles[15], 15);
    for (const id of terrace['11']) check(id, tiles[11], 11);
    const top = terrace['14'];
    for (const id of top) {
      expect(band(sheet(id), 'down')).toEqual(band(tiles[15], 'down'));
      expect(band(sheet(id), 'left')).toEqual(band(sheet(top[0]), 'left'));
      expect(band(sheet(id), 'right')).toEqual(band(sheet(top[0]), 'right'));
    }
  });

  it('la isla de una fila: musgo verde arriba, piedra clara en el medio y el cascajo en sombra abajo', () => {
    const t = tiles[10];
    // Musgo en las primeras filas de casi todas las columnas; piedra en la fila 7; la panza en la 14.
    const mossCols = Array.from({ length: T }, (_, x) => [0, 1, 2, 3].some((y) => alphaAt(t, x, y) > 0 && inRamp(rgbAt(t, x, y), 'moss')));
    expect(mossCols.filter(Boolean).length).toBeGreaterThanOrEqual(14);
    for (let x = 0; x < T; x++) {
      expect(inRamp(rgbAt(t, x, 8), 'stone') || inRamp(rgbAt(t, x, 8), 'moss'), `piedra en x ${x}`).toBe(true);
      expect(inRamp(rgbAt(t, x, 14), 'under'), `cascajo en x ${x}`).toBe(true);
      expect(alphaAt(t, x, 15)).toBe(255);
    }
    // La piedra es clara: en la fila 8, la mayoría en los tonos 3 a 6 de su rampa.
    const stone = PALETTE.ramps.stone as string[];
    const light = Array.from({ length: T }, (_, x) => stone.slice(3).some((h) => hex(h).every((v, i) => v === rgbAt(t, x, 8)[i])));
    expect(light.filter(Boolean).length).toBeGreaterThanOrEqual(10);
  });

  it('la nube (16 a 18): la cara de arriba firme y maciza, la panza tramada que deja ver el cielo y nada más abajo', () => {
    for (const i of [16, 17, 18]) {
      const c = tiles[i];
      const row = (y: number) => Array.from({ length: T }, (_, x) => alphaAt(c, x, y));
      expect(row(0).filter((a) => a === 255).length, `casilla ${i}, fila 0`).toBeGreaterThanOrEqual(13);
      expect(row(3).filter((a) => a === 255).length, `casilla ${i}, cara`).toBeGreaterThanOrEqual(12);
      const belly = [8, 9, 10, 11].flatMap((y) => row(y));
      expect(belly.some((a) => a > 0 && a < 255), `casilla ${i}, panza semitransparente`).toBe(true);
      expect(row(15).every((a) => a === 0), `casilla ${i}, debajo`).toBe(true);
      // La fila 0 es la más clara de la nube: se lee como el borde donde pararse.
      const lum = (y: number) => {
        const xs = Array.from({ length: T }, (_, x) => x).filter((x) => alphaAt(c, x, y) > 0);
        return xs.reduce((s, x) => s + rgbAt(c, x, y).reduce((a, v) => a + v, 0), 0) / xs.length;
      };
      expect(lum(0)).toBeGreaterThan(lum(6));
      for (let x = 0; x < T; x++) if (alphaAt(c, x, 0) > 0) expect(inRamp(rgbAt(c, x, 0), 'cloud')).toBe(true);
    }
    // Lo que es nube no lleva piedra ni musgo; lo que es isla no lleva nube.
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) if (alphaAt(tiles[17], x, y) > 0) expect(inRamp(rgbAt(tiles[17], x, y), 'cloud')).toBe(true);
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) if (alphaAt(tiles[10], x, y) > 0) expect(inRamp(rgbAt(tiles[10], x, y), 'cloud')).toBe(false);
  });

  it('la quilla: las piezas del medio empalman en cualquier orden (mismo alto en los bordes) y los extremos se afinan', () => {
    const depthAt = (c: number[], x: number, h = T) => {
      let d = -1;
      for (let y = 0; y < h; y++) if (alphaAt(c, x, y) > 0 && inRamp(rgbAt(c, x, y), 'under')) d = y;
      return d;
    };
    const mids = [...layout.decals.keelMid, ...layout.decals.keelShortMid].map((d) => sheet(d.ids[0]));
    for (const c of mids) {
      expect(depthAt(c, 0)).toBe(3);
      expect(depthAt(c, 15)).toBe(3);
      for (let x = 0; x < T; x++) expect(alphaAt(c, x, 0), 'la fila 0 sigue el cascajo de arriba').toBe(255);
    }
    for (const d of layout.decals.keelDeep) {
      expect([d.w, d.h]).toEqual([1, 2]);
      const top = sheet(d.ids[0]);
      expect(depthAt(top, 0)).toBe(3);
      expect(depthAt(top, 15)).toBe(3);
      // Baja a la segunda celda.
      expect(sheet(d.ids[1]).some((v, i) => i % 4 === 3 && v > 0)).toBe(true);
    }
    for (const d of layout.decals.keelLeft) {
      const c = sheet(d.ids[0]);
      expect([0, 1, 2].every((x) => depthAt(c, x) === -1)).toBe(true);
      expect(depthAt(c, 15)).toBe(3);
    }
    for (const d of layout.decals.keelRight) {
      const c = sheet(d.ids[0]);
      expect([13, 14, 15].every((x) => depthAt(c, x) === -1)).toBe(true);
      expect(depthAt(c, 0)).toBe(3);
    }
    // La luz viene de la izquierda: ninguna pieza de la quilla se espeja.
    for (const kind of Object.keys(layout.decals).filter((k) => k.startsWith('keel'))) for (const d of layout.decals[kind]) expect(d.flip, kind).toBe(false);
  });

  it('las calcomanías de la cara y la losa móvil están en la hoja', () => {
    for (const kind of ['rune', 'carved', 'crack', 'chip', 'mossFace', 'vine', 'bloom', 'fern', 'terraceMoss', 'terraceCrack']) {
      expect(layout.decals[kind]?.length ?? 0, kind).toBeGreaterThan(0);
      for (const d of layout.decals[kind]) for (const id of d.ids) expect(id).toBeLessThan(layout.count);
    }
    // La losa: la cara de piedra (filas 0 a 7, maciza en el medio) y el cascajo debajo, a lo sumo 12 filas.
    const { left, center, right } = layout.mover;
    for (const id of [left, center, right]) {
      const c = sheet(id);
      for (let y = 0; y < 8; y++) expect(alphaAt(c, 8, y), `losa ${id}, fila ${y}`).toBe(255);
      for (let y = 12; y < T; y++) for (let x = 0; x < T; x++) expect(alphaAt(c, x, y)).toBe(0);
      expect(inRamp(rgbAt(c, 8, 3), 'stone')).toBe(true);
    }
  });
});
