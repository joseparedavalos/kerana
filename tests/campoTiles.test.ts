import { describe, expect, it } from 'vitest';
import manifestSource from '../src/assets/manifest.ts?raw';
import repoLayout from '../public/assets/tiles/detalle/campo.json';
import * as campoArt from '../tools/lib/campo-art.mjs';
import makeTerrainTiles from '../tools/make-terrain-tiles.mjs?raw';
import { readPng } from '../tools/lib/tileset-check.mjs';

const { buildCampoDetail, campoCell, campoSource, campoTilesetMd5, GRASS_ROWS } = campoArt;

// S111: el detalle del terreno de campo (l3). El tileset de campo es arte real (S56) y no se toca: este test comprueba
// que campo.png es el de siempre, que la regla de S56 que usa el script lo da byte a byte, que la hoja de detalle del
// repo es la que escribe el script, y que las variantes conservan el anillo de 2 px de la casilla que reemplazan.

type Img = { width: number; height: number; data: Uint8Array };
type Grid = { w: number; h: number; data: Uint8Array };
type Layout = {
  columns: number;
  fill: number[];
  edges: Record<string, number[]>;
  decals: Record<string, { w: number; h: number; ids: number[]; flip: boolean }[]>;
  count: number;
};
const T = 16;
const UP = 1;
const RIGHT = 2;
const DOWN = 4;
const LEFT = 8;
/** El md5 de public/assets/tiles/campo.png en main (S56; sin cambios desde el 26 de octubre). */
const CAMPO_MD5 = '499807c7c09230079ab9479aa501f296';
const same = (a: Uint8Array, b: Uint8Array) => a.length === b.length && a.every((v, i) => v === b[i]);
const cell = (img: Img, i: number, cols: number): Uint8Array => {
  const out = new Uint8Array(T * T * 4);
  const x0 = (i % cols) * T;
  const y0 = Math.floor(i / cols) * T;
  for (let y = 0; y < T; y++) out.set(img.data.subarray(((y0 + y) * img.width + x0) * 4, ((y0 + y) * img.width + x0 + T) * 4), y * T * 4);
  return out;
};
const px = (c: Uint8Array, x: number, y: number) => Array.from(c.subarray((y * T + x) * 4, (y * T + x) * 4 + 4));
/** Los píxeles del anillo de 2 px de una casilla (los cuatro lados), salvo los que `skip` deje afuera. */
const ring = (c: Uint8Array, skip: (x: number, y: number) => boolean = () => false): number[] => {
  const out: number[] = [];
  for (let y = 0; y < T; y++) {
    for (let x = 0; x < T; x++) {
      const inRing = x < 2 || y < 2 || x >= T - 2 || y >= T - 2;
      if (inRing && !skip(x, y)) out.push(...px(c, x, y));
    }
  }
  return out;
};
const luma = (c: Uint8Array) => {
  let s = 0;
  for (let i = 0; i < T * T; i++) s += 0.299 * c[i * 4] + 0.587 * c[i * 4 + 1] + 0.114 * c[i * 4 + 2];
  return s / (T * T);
};

describe('detalle del terreno de campo (S111)', () => {
  const tileset = readPng('public/assets/tiles/campo.png') as Img;
  const { img: detail, layout } = buildCampoDetail() as unknown as { img: Img; layout: Layout };
  const tiles = Array.from({ length: 28 }, (_, m) => cell(tileset, m, 4));
  const d = (id: number) => cell(detail, id, layout.columns);

  it('campo.png es el de main, byte a byte: el script no lo escribe', () => {
    expect(campoTilesetMd5()).toBe(CAMPO_MD5);
    expect([tileset.width, tileset.height]).toEqual([64, 112]);
    // Campo está en la lista del script, pero sin `buildTileset`: de ese bioma solo sale la hoja de detalle.
    expect(makeTerrainTiles).toContain("campo: () => import('./lib/campo-art.mjs')");
    expect('buildTileset' in campoArt).toBe(false);
  });

  it('la regla de S56 (la tierra de la 15, el pasto de arriba y el borde oscuro) da las 16 casillas del autotile', () => {
    const src = campoSource();
    for (let m = 0; m < 16; m++) {
      const g = campoCell(m, src.dirt, src.grass) as Grid;
      expect(same(g.data, tiles[m]), `casilla ${m}`).toBe(true);
    }
  });

  it('la hoja y el JSON del repo son los que escribe el script, siempre iguales, y el manifest la pide', () => {
    const repo = readPng('public/assets/tiles/detalle/campo.png') as Img;
    expect([repo.width, repo.height]).toEqual([detail.width, detail.height]);
    expect(same(repo.data, detail.data)).toBe(true);
    expect(repoLayout).toEqual(layout);
    expect(same((buildCampoDetail() as unknown as { img: Img }).img.data, detail.data)).toBe(true);
    expect(manifestSource).toContain(`campo: [${detail.width}, ${detail.height}]`);
  });

  it('las variantes conservan el anillo de 2 px de la casilla que reemplazan (el pasto del piso, solo en el centro)', () => {
    expect(layout.fill).toHaveLength(12);
    for (const id of layout.fill) expect(ring(d(id)), `relleno ${id}`).toEqual(ring(tiles[15]));
    expect(Object.keys(layout.edges).sort()).toEqual(['11', '13', '14', '7']);
    for (const mask of [11, 7, 13]) for (const id of layout.edges[String(mask)]) expect(ring(d(id)), `${mask}: ${id}`).toEqual(ring(tiles[mask]));
    // El piso: los costados enteros (con el pasto) y abajo, iguales; el pasto de arriba cambia entre las columnas 2 y 13.
    const grassCenter = (x: number, y: number) => y < GRASS_ROWS && x >= 2 && x < T - 2;
    for (const id of layout.edges['14']) expect(ring(d(id), grassCenter), `piso ${id}`).toEqual(ring(tiles[14], grassCenter));
    // Los lados sólidos de cada máscara, como en cerro y el estero.
    const sides = [
      [UP, (_x: number, y: number) => y < 2],
      [DOWN, (_x: number, y: number) => y >= T - 2],
      [LEFT, (x: number) => x < 2],
      [RIGHT, (x: number) => x >= T - 2],
    ] as const;
    for (const mask of [14, 11, 7, 13]) {
      for (const id of layout.edges[String(mask)]) {
        for (const [bit, inSide] of sides) {
          if (!(mask & bit)) continue;
          expect(ring(d(id), (x, y) => !inSide(x, y)), `${mask}: ${id}`).toEqual(ring(tiles[mask], (x, y) => !inSide(x, y)));
        }
      }
    }
  });

  it('las variantes son de bajo contraste: macizas, distintas de la base y con la misma luz media', () => {
    const base = luma(tiles[15]);
    const all = [...layout.fill, ...Object.values(layout.edges).flat()];
    for (const id of layout.fill) {
      const c = d(id);
      expect(c.every((v, i) => i % 4 !== 3 || v === 255)).toBe(true);
      expect(Math.abs(luma(c) - base) / base, `relleno ${id}`).toBeLessThan(0.04);
    }
    // Ninguna es la base, ni dos son iguales.
    const keys = new Set(all.map((id) => d(id).join(',')));
    expect(keys.size).toBe(all.length);
    for (const id of layout.fill) expect(same(d(id), tiles[15])).toBe(false);
  });

  it('las calcomanías: las del campo de Misiones, con sus w × h casillas y nada sobre el aire ni sobre el pasto', () => {
    for (const kind of ['itakuru', 'ironstone', 'pebble', 'quartz', 'laterite', 'ants', 'roots', 'rootlet']) {
      expect(layout.decals[kind]?.length ?? 0, kind).toBeGreaterThan(0);
    }
    // Sin cristales (no hay cuevas) ni el pasto que sale por las esquinas hacia el aire.
    for (const kind of ['crystal', 'overhangLeft', 'overhangRight']) expect(layout.decals[kind]).toBeUndefined();
    for (const [kind, list] of Object.entries(layout.decals)) {
      for (const dec of list) {
        expect(dec.ids, kind).toHaveLength(dec.w * dec.h);
        for (const id of dec.ids) expect(id).toBeLessThan(layout.count);
      }
    }
    // Las raíces salen de debajo del pasto: las filas del pasto (0 a 6) de su primera casilla quedan transparentes.
    for (const dec of [...layout.decals.roots, ...layout.decals.rootlet]) {
      const c = d(dec.ids[0]);
      for (let y = 0; y < GRASS_ROWS; y++) for (let x = 0; x < T; x++) expect(px(c, x, y)[3], `${dec.ids[0]} en ${x},${y}`).toBe(0);
    }
    // Cada calcomanía de una casilla deja ver la tierra alrededor (no es un parche).
    for (const kind of ['itakuru', 'pebble', 'quartz', 'ants', 'rootlet']) {
      for (const dec of layout.decals[kind]) {
        for (const id of dec.ids) expect(d(id).filter((v, i) => i % 4 === 3 && v === 0).length, `${kind} ${id}`).toBeGreaterThan(150);
      }
    }
  });
});
