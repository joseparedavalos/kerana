import { describe, expect, it } from 'vitest';
import manifestSource from '../src/assets/manifest.ts?raw';
import repoLayout from '../public/assets/tiles/detalle/selva.json';
import { buildSelvaDetail, buildSelvaTileset } from '../tools/lib/selva-art.mjs';
import { readPng } from '../tools/lib/tileset-check.mjs';

// S113: el tileset de la selva (l5, el monte de Canindeyú) sale de tools/make-terrain-tiles.mjs (tools/lib/selva-art.mjs).
// Lo que está en el repo es lo que da el script, las casillas vecinas empalman en todas las combinaciones del autotile,
// las variantes no cambian los bordes, arriba el humus es oscuro sobre la tierra colorada, la rama tiene grosor y
// sombra, la zarza sigue de una casilla a la otra y la piedra que se rompe trae la luz de sus grietas.

type Img = { width: number; height: number; data: Uint8Array };
type Layout = {
  columns: number;
  fill: number[];
  edges: Record<string, number[]>;
  decals: Record<string, { w: number; h: number; ids: number[]; flip: boolean }[]>;
  water: { deep: number[] };
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
const luma = (c: number[], i: number) => 0.299 * c[i * 4] + 0.587 * c[i * 4 + 1] + 0.114 * c[i * 4 + 2];
/** Luminancia media de unas filas de la casilla (solo píxeles con color). */
const rowsLuma = (c: number[], ys: number[]): number => {
  let sum = 0;
  let n = 0;
  for (const y of ys) {
    for (let x = 0; x < T; x++) {
      if (c[(y * T + x) * 4 + 3] === 0) continue;
      sum += luma(c, y * T + x);
      n++;
    }
  }
  return n ? sum / n : 0;
};
const alphaAt = (c: number[], x: number, y: number) => c[(y * T + x) * 4 + 3];

describe('tileset de la selva por código (S113)', () => {
  const tileset = buildSelvaTileset() as Img;
  const { img: detail, layout } = buildSelvaDetail() as unknown as { img: Img; layout: Layout };
  const tiles = Array.from({ length: 28 }, (_, m) => cell(tileset, m, 4));
  const d = (id: number) => cell(detail, id, layout.columns);

  it('el PNG y el JSON del repo son los que escribe el script', () => {
    const repo = readPng('public/assets/tiles/selva.png') as Img;
    expect([repo.width, repo.height]).toEqual([64, 112]);
    expect(same(repo.data, tileset.data)).toBe(true);
    const repoDetail = readPng('public/assets/tiles/detalle/selva.png') as Img;
    expect([repoDetail.width, repoDetail.height]).toEqual([detail.width, detail.height]);
    expect(same(repoDetail.data, detail.data)).toBe(true);
    expect(repoLayout).toEqual(layout);
  });

  it('da siempre lo mismo y el manifest pide la hoja con su tamaño', () => {
    expect(same((buildSelvaTileset() as Img).data, tileset.data)).toBe(true);
    expect(same((buildSelvaDetail() as unknown as { img: Img }).img.data, detail.data)).toBe(true);
    expect(manifestSource).toContain(`selva: [${detail.width}, ${detail.height}]`);
  });

  // Como en cerro y el estero: la banda de 2 px que se toca es la de la casilla de referencia (mismo aire arriba y abajo,
  // o a los costados, y sólido a los dos lados del empalme).
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

  it('las variantes cambian solo el centro: los lados sólidos son los de la casilla que reemplazan', () => {
    const sides = { up: UP, right: RIGHT, down: DOWN, left: LEFT } as const;
    const check = (id: number, base: number[], mask: number) => {
      for (const [side, bit] of Object.entries(sides)) {
        if (mask & bit) expect(band(d(id), side as keyof typeof sides), `variante ${id}, ${side}`).toEqual(band(base, side as keyof typeof sides));
      }
    };
    expect(layout.fill.length).toBeGreaterThanOrEqual(16);
    expect(layout.edges['14'].length).toBeGreaterThanOrEqual(6);
    for (const id of layout.fill) check(id, tiles[15], 15);
    for (const mask of [7, 11, 13, 14]) for (const id of layout.edges[String(mask)]) check(id, tiles[mask], mask);
    for (const id of layout.edges['17']) check(id, tiles[17], LEFT | RIGHT);
  });

  it('la tierra es maciza; arriba la hojarasca deja a lo sumo 3 filas vacías y el humus oscuro va sobre la tierra colorada', () => {
    const opaque = (c: number[]) => c.every((v, i) => i % 4 !== 3 || v === 255);
    expect(opaque(tiles[15])).toBe(true);
    for (const id of layout.fill) expect(opaque(d(id))).toBe(true);
    // La tierra es colorada: más roja que verde y que azul.
    const red = (c: number[]) => {
      let r = 0;
      let g = 0;
      for (let i = 0; i < T * T; i++) {
        r += c[i * 4];
        g += c[i * 4 + 1];
      }
      return r / g;
    };
    expect(red(tiles[15])).toBeGreaterThan(1.4);
    for (const c of [tiles[14], ...layout.edges['14'].map(d)]) {
      const firstRow = Array.from({ length: T }, (_, y) => y).find((y) => Array.from({ length: T }, (_, x) => alphaAt(c, x, y)).some((a) => a > 0));
      expect(firstRow).toBeLessThanOrEqual(3);
      // Bajo la hojarasca, el humus (filas 6 a 8) es más oscuro que la tierra de abajo (filas 13 a 15).
      expect(rowsLuma(c, [6, 7, 8])).toBeLessThan(rowsLuma(c, [13, 14, 15]) - 6);
    }
  });

  it('la rama (16 a 18) tiene el filo en la fila 0, su grosor y la sombra hacia abajo', () => {
    for (const c of [tiles[16], tiles[17], tiles[18], ...layout.edges['17'].map(d)]) {
      const row = (y: number) => Array.from({ length: T }, (_, x) => alphaAt(c, x, y));
      expect(row(0).filter((a) => a === 255).length).toBeGreaterThanOrEqual(12);
      expect(row(6).filter((a) => a === 255).length).toBeGreaterThanOrEqual(12);
      expect(row(9).some((a) => a > 0 && a < 255)).toBe(true);
      expect(row(14).every((a) => a === 0)).toBe(true);
      // Redonda: más clara arriba que abajo.
      expect(rowsLuma(c, [1, 2])).toBeGreaterThan(rowsLuma(c, [5, 6]));
    }
  });

  it('la zarza (19) se lee como peligro y sigue de una casilla a la otra', () => {
    const c = tiles[19];
    // Espinas casi blancas sobre tallos oscuros.
    const lumas = Array.from({ length: T * T }, (_, i) => (c[i * 4 + 3] ? luma(c, i) : -1)).filter((v) => v >= 0);
    expect(lumas.filter((v) => v > 180).length).toBeGreaterThanOrEqual(10);
    expect(lumas.filter((v) => v < 50).length).toBeGreaterThanOrEqual(20);
    // Sale por los dos costados a la misma altura (en fila, sigue) y por arriba y por abajo en la misma columna.
    for (const y of [6, 10]) {
      expect(alphaAt(c, 0, y), `izquierda, fila ${y}`).toBe(255);
      expect(alphaAt(c, 15, y), `derecha, fila ${y}`).toBe(255);
    }
    expect(alphaAt(c, 8, 0)).toBe(255);
    expect(alphaAt(c, 8, 15)).toBe(255);
  });

  it('la piedra que se rompe (22): la luz del tajo cae justo en sus grietas, y las grietas siguen de una celda a la otra', () => {
    const cracked = [{ tile: tiles[22], glow: layout.glow['22'] }, ...layout.edges['22'].map((id) => ({ tile: d(id), glow: layout.glow[`d${id}`] }))];
    expect(cracked).toHaveLength(3);
    for (const { tile, glow } of cracked) {
      expect(glow).toBeGreaterThanOrEqual(0);
      const g = d(glow);
      const lit: number[] = [];
      for (let i = 0; i < T * T; i++) if (g[i * 4 + 3] > 0) lit.push(i);
      expect(lit.length).toBeGreaterThan(30);
      const darkest = Math.min(...Array.from({ length: T * T }, (_, i) => Math.round(luma(tile, i))));
      for (const i of lit) expect(Math.round(luma(tile, i))).toBe(darkest);
      // El tronco de roca de l5 es de 2 × 4: arriba y abajo, y a los dos costados, la grieta en el mismo lugar.
      const at = (x: number, y: number) => g[(y * T + x) * 4 + 3] > 0;
      for (const x of [5, 11]) expect(at(x, 0) && at(x, 15), `columna ${x}`).toBe(true);
      expect(at(0, 6) && at(15, 6)).toBe(true);
    }
  });

  it('las calcomanías del monte: cada una con sus w × h casillas, transparentes alrededor; las de las esquinas no se espejan', () => {
    for (const [kind, list] of Object.entries(layout.decals)) {
      for (const dec of list) {
        expect(dec.ids).toHaveLength(dec.w * dec.h);
        for (const id of dec.ids) expect(id).toBeLessThan(layout.count);
        expect(dec.flip, kind).toBe(!['overhangLeft', 'overhangRight'].includes(kind));
      }
    }
    for (const kind of ['root', 'stone', 'leaf', 'seed', 'bug', 'laterite', 'pebble', 'patch', 'log', 'roots', 'rootlet', 'hang', 'overhangLeft', 'overhangRight']) {
      expect(layout.decals[kind]?.length ?? 0, kind).toBeGreaterThan(0);
    }
    // Raíces gruesas que cruzan varias celdas.
    expect(layout.decals.root.some((dec) => dec.w >= 3)).toBe(true);
    for (const dec of [...layout.decals.seed, ...layout.decals.bug, ...layout.decals.leaf]) {
      expect(d(dec.ids[0]).filter((v, i) => i % 4 === 3 && v === 0).length).toBeGreaterThan(150);
    }
    // Las raicillas que cuelgan bajo una saliente arrancan en la fila 0 (pegadas al techo).
    for (const dec of layout.decals.hang) expect(Array.from({ length: T }, (_, x) => alphaAt(d(dec.ids[0]), x, 0)).some((a) => a > 0)).toBe(true);
  });
});
