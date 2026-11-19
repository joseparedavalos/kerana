import { describe, expect, it } from 'vitest';
import manifestSource from '../src/assets/manifest.ts?raw';
import repoLayout from '../public/assets/tiles/detalle/cerro.json';
import { buildCerroDetail, buildCerroTileset } from '../tools/lib/cerro-art.mjs';
import { readPng } from '../tools/lib/tileset-check.mjs';

// S109: el tileset de cerro (l1) sale de tools/make-cerro-tiles.mjs. Lo que está en el repo es lo que da el script,
// las casillas vecinas empalman en todas las combinaciones del autotile y las variantes no cambian los bordes.

type Img = { width: number; height: number; data: Uint8Array };
const T = 16;
const read = (path: string): Img => readPng(path) as Img;
const same = (a: Uint8Array, b: Uint8Array) => a.length === b.length && a.every((v, i) => v === b[i]);
/** Los RGBA de la casilla `i` de una hoja de `cols` columnas (16 × 16 × 4). */
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

const UP = 1;
const RIGHT = 2;
const DOWN = 4;
const LEFT = 8;

describe('tileset de cerro por código (S109)', () => {
  const tileset = buildCerroTileset() as Img;
  const { img: detail, layout } = buildCerroDetail() as unknown as { img: Img; layout: { columns: number; fill: number[]; edges: Record<string, number[]>; decals: Record<string, { w: number; h: number; ids: number[]; flip: boolean }[]>; count: number } };

  it('el PNG del repo es el que escribe el script, byte a byte en los píxeles', () => {
    const repo = read('public/assets/tiles/cerro.png');
    expect([repo.width, repo.height]).toEqual([64, 112]);
    expect(same(repo.data, tileset.data)).toBe(true);
    const repoDetail = read('public/assets/tiles/detalle/cerro.png');
    expect([repoDetail.width, repoDetail.height]).toEqual([detail.width, detail.height]);
    expect(same(repoDetail.data, detail.data)).toBe(true);
    expect(repoLayout).toEqual(layout);
  });

  it('da siempre lo mismo (todo sale de una semilla)', () => {
    expect(same((buildCerroTileset() as Img).data, tileset.data)).toBe(true);
  });

  it('el manifest pide la hoja de detalle con su tamaño', () => {
    expect(manifestSource).toContain(`cerro: [${detail.width}, ${detail.height}]`);
  });

  // Dos casillas vecinas empalman si la banda de 2 px que se tocan es la de la casilla de referencia: la que tiene el
  // mismo aire arriba y abajo (o a los costados) y sólido a los dos lados del empalme, que se repite consigo misma.
  const refH = (mask: number) => (mask & (UP | DOWN)) | LEFT | RIGHT;
  const refV = (mask: number) => (mask & (LEFT | RIGHT)) | UP | DOWN;
  const tiles = Array.from({ length: 16 }, (_, m) => cell(tileset, m, 4));

  it('empalma a lo ancho en todas las combinaciones del autotile', () => {
    for (let m = 0; m < 16; m++) {
      if (m & RIGHT) expect(band(tiles[m], 'right'), `casilla ${m}, lado derecho`).toEqual(band(tiles[refH(m)], 'right'));
      if (m & LEFT) expect(band(tiles[m], 'left'), `casilla ${m}, lado izquierdo`).toEqual(band(tiles[refH(m)], 'left'));
    }
  });

  it('empalma a lo alto en todas las combinaciones del autotile', () => {
    for (let m = 0; m < 16; m++) {
      if (m & DOWN) expect(band(tiles[m], 'down'), `casilla ${m}, abajo`).toEqual(band(tiles[refV(m)], 'down'));
      if (m & UP) expect(band(tiles[m], 'up'), `casilla ${m}, arriba`).toEqual(band(tiles[refV(m)], 'up'));
    }
  });

  it('las variantes cambian solo el centro: los lados sólidos son los de la casilla que reemplazan', () => {
    const sides = { up: UP, right: RIGHT, down: DOWN, left: LEFT } as const;
    const check = (id: number, base: number[], mask: number) => {
      const v = cell(detail, id, layout.columns);
      for (const [side, bit] of Object.entries(sides)) {
        if (mask & bit) expect(band(v, side as keyof typeof sides), `variante ${id}, ${side}`).toEqual(band(base, side as keyof typeof sides));
      }
    };
    expect(layout.fill.length).toBeGreaterThanOrEqual(8);
    for (const id of layout.fill) check(id, tiles[15], 15);
    for (const [key, ids] of Object.entries(layout.edges)) {
      const t = Number(key);
      // La laja (17) solo empalma a lo ancho; los bordes del autotile, por sus lados sólidos.
      for (const id of ids) check(id, cell(tileset, t, 4), t === 17 ? LEFT | RIGHT : t);
    }
  });

  it('el relleno y sus variantes son macizos; arriba el pasto deja a lo sumo 3 filas vacías', () => {
    const opaque = (c: number[]) => c.every((v, i) => i % 4 !== 3 || v === 255);
    expect(opaque(tiles[15])).toBe(true);
    for (const id of layout.fill) expect(opaque(cell(detail, id, layout.columns))).toBe(true);
    for (const id of layout.edges['14'] ?? []) {
      const c = cell(detail, id, layout.columns);
      const firstRow = Array.from({ length: T }, (_, y) => y).find((y) => Array.from({ length: T }, (_, x) => c[(y * T + x) * 4 + 3]).some((a) => a > 0));
      expect(firstRow).toBeLessThanOrEqual(3);
    }
  });

  it('la laja (16 a 18) tiene el filo en la fila 0 y su grosor y sombra hacia abajo', () => {
    for (const i of [16, 17, 18]) {
      const c = cell(tileset, i, 4);
      const row = (y: number) => Array.from({ length: T }, (_, x) => c[(y * T + x) * 4 + 3]);
      expect(row(0).filter((a) => a === 255).length, `casilla ${i}, fila 0`).toBeGreaterThanOrEqual(12);
      expect(row(6).filter((a) => a === 255).length, `casilla ${i}, grosor`).toBeGreaterThanOrEqual(12);
      expect(row(9).some((a) => a > 0 && a < 255), `casilla ${i}, sombra`).toBe(true);
      expect(row(14).every((a) => a === 0), `casilla ${i}, debajo`).toBe(true);
    }
  });

  it('las calcomanías: cada una con sus w × h casillas dentro de la hoja; las capas y el pasto de las esquinas no se espejan', () => {
    for (const [kind, list] of Object.entries(layout.decals)) {
      for (const d of list) {
        expect(d.ids).toHaveLength(d.w * d.h);
        for (const id of d.ids) expect(id).toBeLessThan(layout.count);
        expect(d.flip, kind).toBe(!['strata', 'overhangLeft', 'overhangRight'].includes(kind));
      }
    }
    for (const kind of ['pebble', 'stone', 'boulder', 'strata', 'roots', 'rootlet', 'crystal', 'lichen', 'crack', 'overhangLeft', 'overhangRight']) {
      expect(layout.decals[kind]?.length ?? 0, kind).toBeGreaterThan(0);
    }
    // Las calcomanías son transparentes alrededor: no tapan la roca entera.
    for (const d of layout.decals.pebble) {
      const c = cell(detail, d.ids[0], layout.columns);
      expect(c.filter((v, i) => i % 4 === 3 && v === 0).length).toBeGreaterThan(150);
    }
  });
});
