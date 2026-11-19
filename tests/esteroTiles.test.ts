import { describe, expect, it } from 'vitest';
import manifestSource from '../src/assets/manifest.ts?raw';
import repoLayout from '../public/assets/tiles/detalle/estero.json';
import { buildEsteroDetail, buildEsteroTileset } from '../tools/lib/estero-art.mjs';
import { readPng } from '../tools/lib/tileset-check.mjs';

// S110: el tileset del estero (l2) sale de tools/make-terrain-tiles.mjs (tools/lib/estero-art.mjs). Lo que está en el
// repo es lo que da el script, las casillas vecinas empalman en todas las combinaciones del autotile, las variantes no
// cambian los bordes, el agua baja de color en tres casillas y el barro seco trae la luz de sus grietas.

type Img = { width: number; height: number; data: Uint8Array };
type Layout = {
  columns: number;
  fill: number[];
  edges: Record<string, number[]>;
  decals: Record<string, { w: number; h: number; ids: number[]; flip: boolean }[]>;
  water: { deep: number[] };
  submerged: Record<string, number[]>;
  glow: Record<string, number>;
  count: number;
};
const T = 16;
const UP = 1;
const RIGHT = 2;
const DOWN = 4;
const LEFT = 8;
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
/** Luminancia media de una fila de la casilla (solo píxeles con color). */
const rowLuma = (c: number[], y: number): number => {
  let sum = 0;
  let n = 0;
  for (let x = 0; x < T; x++) {
    const i = (y * T + x) * 4;
    if (c[i + 3] === 0) continue;
    sum += 0.299 * c[i] + 0.587 * c[i + 1] + 0.114 * c[i + 2];
    n++;
  }
  return n ? sum / n : 0;
};

describe('tileset del estero por código (S110)', () => {
  const tileset = buildEsteroTileset() as Img;
  const { img: detail, layout: raw } = buildEsteroDetail() as unknown as { img: Img; layout: Layout };
  const layout = raw;
  const tiles = Array.from({ length: 28 }, (_, m) => cell(tileset, m, 4));
  const d = (id: number) => cell(detail, id, layout.columns);

  it('el PNG y el JSON del repo son los que escribe el script', () => {
    const repo = readPng('public/assets/tiles/estero.png') as Img;
    expect([repo.width, repo.height]).toEqual([64, 112]);
    expect(same(repo.data, tileset.data)).toBe(true);
    const repoDetail = readPng('public/assets/tiles/detalle/estero.png') as Img;
    expect([repoDetail.width, repoDetail.height]).toEqual([detail.width, detail.height]);
    expect(same(repoDetail.data, detail.data)).toBe(true);
    expect(repoLayout).toEqual(layout);
  });

  it('da siempre lo mismo y el manifest pide la hoja con su tamaño', () => {
    expect(same((buildEsteroTileset() as Img).data, tileset.data)).toBe(true);
    expect(same((buildEsteroDetail() as unknown as { img: Img }).img.data, detail.data)).toBe(true);
    expect(manifestSource).toContain(`estero: [${detail.width}, ${detail.height}]`);
  });

  // Como en cerro: la banda de 2 px que se toca es la de la casilla de referencia (mismo aire arriba y abajo, o a los
  // costados, y sólido a los dos lados del empalme).
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

  it('las variantes del barro cambian solo el centro: los lados sólidos son los de la casilla que reemplazan', () => {
    const sides = { up: UP, right: RIGHT, down: DOWN, left: LEFT } as const;
    const check = (id: number, base: number[], mask: number) => {
      for (const [side, bit] of Object.entries(sides)) {
        if (mask & bit) expect(band(d(id), side as keyof typeof sides), `variante ${id}, ${side}`).toEqual(band(base, side as keyof typeof sides));
      }
    };
    expect(layout.fill.length).toBeGreaterThanOrEqual(8);
    for (const id of layout.fill) check(id, tiles[15], 15);
    for (const mask of [7, 11, 13, 14]) for (const id of layout.edges[String(mask)]) check(id, tiles[mask], mask);
    for (const id of layout.edges['17']) check(id, tiles[17], LEFT | RIGHT);
    // El fondo bajo el agua: el mismo barro abajo (lo que toca al piso de abajo); sin pasto verde claro arriba.
    for (const id of layout.submerged['14']) expect(band(d(id), 'down')).toEqual(band(tiles[14], 'down'));
  });

  it('el relleno y sus variantes son macizos; arriba el pasto deja a lo sumo 3 filas vacías', () => {
    const opaque = (c: number[]) => c.every((v, i) => i % 4 !== 3 || v === 255);
    expect(opaque(tiles[15])).toBe(true);
    for (const id of layout.fill) expect(opaque(d(id))).toBe(true);
    for (const id of [14, ...layout.edges['14'].map((v) => -1 - v)]) {
      const c = id >= 0 ? tiles[id] : d(-1 - id);
      const firstRow = Array.from({ length: T }, (_, y) => y).find((y) => Array.from({ length: T }, (_, x) => c[(y * T + x) * 4 + 3]).some((a) => a > 0));
      expect(firstRow).toBeLessThanOrEqual(3);
    }
  });

  it('el tablón (16 a 18) tiene el filo en la fila 0 y su grosor y sombra hacia abajo', () => {
    for (const c of [tiles[16], tiles[17], tiles[18], ...layout.edges['17'].map(d)]) {
      const row = (y: number) => Array.from({ length: T }, (_, x) => c[(y * T + x) * 4 + 3]);
      expect(row(0).filter((a) => a === 255).length).toBeGreaterThanOrEqual(12);
      expect(row(6).filter((a) => a === 255).length).toBeGreaterThanOrEqual(12);
      expect(row(9).some((a) => a > 0 && a < 255)).toBe(true);
      expect(row(14).every((a) => a === 0)).toBe(true);
    }
  });

  it('el agua baja de color: superficie (con la línea de luz), cuerpo y fondo, sin saltos entre casillas', () => {
    const surface = [tiles[20], ...layout.edges['20'].map(d)];
    const body = [tiles[21], ...layout.edges['21'].map(d)];
    const deep = layout.water.deep.map(d);
    expect(deep.length).toBeGreaterThanOrEqual(2);
    const mean = (list: number[][], y: number) => list.reduce((s, c) => s + rowLuma(c, y), 0) / list.length;
    // Cada casilla es más oscura que la de arriba, y arriba de la superficie hay una línea más clara que el agua.
    expect(mean(surface, 8)).toBeGreaterThan(mean(body, 8));
    expect(mean(body, 8)).toBeGreaterThan(mean(deep, 8));
    const lineRow = (c: number[]) => Math.max(...[0, 1, 2].map((y) => rowLuma(c, y)));
    for (const c of surface) expect(lineRow(c)).toBeGreaterThan(rowLuma(c, 8) + 20);
    // Sin escalón en el empalme vertical: la última fila de una y la primera de la siguiente se parecen.
    expect(Math.abs(mean(surface, 15) - mean(body, 0))).toBeLessThan(12);
    expect(Math.abs(mean(body, 15) - mean(deep, 0))).toBeLessThan(12);
    expect(Math.abs(mean(deep, 15) - mean(deep, 0))).toBeLessThan(6);
    // Casi opaca (no se ve el cielo a través) y más honda, más opaca.
    const alpha = (c: number[]) => c[(10 * T + 5) * 4 + 3];
    expect(alpha(surface[0])).toBeGreaterThanOrEqual(220);
    expect(alpha(deep[0])).toBeGreaterThanOrEqual(alpha(body[0]));
  });

  it('el barro seco (22) y sus variantes, partidos en placas: la luz del tajo cae justo en sus grietas', () => {
    const cracked = [{ tile: tiles[22], glow: layout.glow['22'] }, ...layout.edges['22'].map((id) => ({ tile: d(id), glow: layout.glow[`d${id}`] }))];
    expect(cracked).toHaveLength(3);
    for (const { tile, glow } of cracked) {
      expect(glow).toBeGreaterThanOrEqual(0);
      const g = d(glow);
      const lit = [];
      for (let i = 0; i < T * T; i++) if (g[i * 4 + 3] > 0) lit.push(i);
      expect(lit.length).toBeGreaterThan(30);
      // Cada píxel de luz es grieta: el más oscuro de la casilla.
      const darkest = Math.min(...Array.from({ length: T * T }, (_, i) => rowLumaPx(tile, i)));
      for (const i of lit) expect(rowLumaPx(tile, i)).toBe(darkest);
    }
  });

  it('las calcomanías: cada una con sus w × h casillas, transparentes alrededor; el pasto de las esquinas no se espeja', () => {
    for (const [kind, list] of Object.entries(layout.decals)) {
      for (const dec of list) {
        expect(dec.ids).toHaveLength(dec.w * dec.h);
        for (const id of dec.ids) expect(id).toBeLessThan(layout.count);
        expect(dec.flip, kind).toBe(!['overhangLeft', 'overhangRight'].includes(kind));
      }
    }
    for (const kind of ['shell', 'twig', 'root', 'clay', 'pebble', 'roots', 'rootlet', 'overhangLeft', 'overhangRight']) {
      expect(layout.decals[kind]?.length ?? 0, kind).toBeGreaterThan(0);
    }
    for (const dec of [...layout.decals.shell, ...layout.decals.twig]) {
      expect(d(dec.ids[0]).filter((v, i) => i % 4 === 3 && v === 0).length).toBeGreaterThan(180);
    }
  });
});

function rowLumaPx(c: number[], i: number): number {
  return Math.round(0.299 * c[i * 4] + 0.587 * c[i * 4 + 1] + 0.114 * c[i * 4 + 2]);
}
