import { describe, expect, it } from 'vitest';
import manifestSource from '../src/assets/manifest.ts?raw';
import repoLayout from '../public/assets/tiles/detalle/pueblo.json';
import { buildPuebloDetail, buildPuebloTileset } from '../tools/lib/pueblo-art.mjs';
import { readPng } from '../tools/lib/tileset-check.mjs';

// S112: el tileset del pueblo (l4) sale de tools/make-terrain-tiles.mjs (tools/lib/pueblo-art.mjs). Lo que está en el
// repo es lo que da el script; las casas empalman en todas las combinaciones del autotile; las variantes y las casillas
// de cada zona de la calle no cambian los bordes; las tejas y el empedrado no dejan a Kerana flotando; la cal no tiene
// huecos; el tirante tiene su grosor; el revoque rajado trae la luz de sus grietas.

type Img = { width: number; height: number; data: Uint8Array };
type Layout = {
  columns: number;
  fill: number[];
  edges: Record<string, number[]>;
  decals: Record<string, { w: number; h: number; ids: number[]; flip: boolean }[]>;
  zones: Record<string, Record<string, number[]>>;
  glow: Record<string, number>;
  count: number;
};
const T = 16;
const UP = 1;
const RIGHT = 2;
const DOWN = 4;
const LEFT = 8;
type Side = 'up' | 'down' | 'left' | 'right';
const SIDES: [Side, number][] = [['up', UP], ['right', RIGHT], ['down', DOWN], ['left', LEFT]];
const same = (a: Uint8Array, b: Uint8Array) => a.length === b.length && a.every((v, i) => v === b[i]);
const cell = (img: Img, i: number, cols: number): number[] => {
  const out: number[] = [];
  const x0 = (i % cols) * T;
  const y0 = Math.floor(i / cols) * T;
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) out.push(...img.data.subarray(((y0 + y) * img.width + x0 + x) * 4, ((y0 + y) * img.width + x0 + x) * 4 + 4));
  return out;
};
const band = (c: number[], side: Side): number[] => {
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
const luma = (c: number[], i: number) => 0.299 * c[i * 4] + 0.587 * c[i * 4 + 1] + 0.114 * c[i * 4 + 2];
const opaque = (c: number[]) => c.every((v, i) => i % 4 !== 3 || v === 255);
/** Primera fila con algo en cada columna del medio (de 2 a 13). */
const topRows = (c: number[]) => Array.from({ length: 12 }, (_, k) => Array.from({ length: T }, (_, y) => y).find((y) => alphaAt(c, k + 2, y) > 0) ?? T);

describe('tileset del pueblo por código (S112)', () => {
  const tileset = buildPuebloTileset() as Img;
  const { img: detail, layout: raw } = buildPuebloDetail() as unknown as { img: Img; layout: Layout };
  const layout = raw;
  const tiles = Array.from({ length: 28 }, (_, m) => cell(tileset, m, 4));
  const d = (id: number) => cell(detail, id, layout.columns);
  const zone = (name: string, mask: number) => layout.zones[name][String(mask)].map(d);

  it('el PNG y el JSON del repo son los que escribe el script', () => {
    const repo = readPng('public/assets/tiles/pueblo.png') as Img;
    expect([repo.width, repo.height]).toEqual([64, 112]);
    expect(same(repo.data, tileset.data)).toBe(true);
    const repoDetail = readPng('public/assets/tiles/detalle/pueblo.png') as Img;
    expect([repoDetail.width, repoDetail.height]).toEqual([detail.width, detail.height]);
    expect(same(repoDetail.data, detail.data)).toBe(true);
    expect(repoLayout).toEqual(layout);
  });

  it('da siempre lo mismo y el manifest pide la hoja con su tamaño', () => {
    expect(same((buildPuebloTileset() as Img).data, tileset.data)).toBe(true);
    expect(same((buildPuebloDetail() as unknown as { img: Img }).img.data, detail.data)).toBe(true);
    expect(manifestSource).toContain(`pueblo: [${detail.width}, ${detail.height}]`);
  });

  // Como en cerro y en el estero: la banda de 2 px que se toca es la de la casilla de referencia (mismo aire arriba y
  // abajo, o a los costados, y sólido a los dos lados del empalme).
  const refH = (mask: number) => (mask & (UP | DOWN)) | LEFT | RIGHT;
  const refV = (mask: number) => (mask & (LEFT | RIGHT)) | UP | DOWN;

  it('las casas empalman a lo ancho y a lo alto en todas las combinaciones del autotile', () => {
    for (let m = 0; m < 16; m++) {
      if (m & RIGHT) expect(band(tiles[m], 'right'), `casilla ${m}, derecha`).toEqual(band(tiles[refH(m)], 'right'));
      if (m & LEFT) expect(band(tiles[m], 'left'), `casilla ${m}, izquierda`).toEqual(band(tiles[refH(m)], 'left'));
      if (m & DOWN) expect(band(tiles[m], 'down'), `casilla ${m}, abajo`).toEqual(band(tiles[refV(m)], 'down'));
      if (m & UP) expect(band(tiles[m], 'up'), `casilla ${m}, arriba`).toEqual(band(tiles[refV(m)], 'up'));
    }
  });

  it('las variantes de la cal, de los bordes, del tirante y de cada zona no cambian los lados sólidos', () => {
    const check = (c: number[], ref: number[], mask: number, what: string) => {
      for (const [side, bit] of SIDES) if (mask & bit) expect(band(c, side), `${what}, ${side}`).toEqual(band(ref, side));
    };
    expect(layout.fill.length).toBeGreaterThanOrEqual(12);
    for (const id of layout.fill) check(d(id), tiles[15], 15, `relleno ${id}`);
    for (const mask of [7, 11, 13, 14]) for (const id of layout.edges[String(mask)]) check(d(id), tiles[mask], mask, `borde ${mask}/${id}`);
    for (const id of layout.edges['17']) check(d(id), tiles[17], LEFT | RIGHT, `tirante ${id}`);
    // Cada zona: todas sus variantes de una casilla, con los mismos lados sólidos que la primera.
    for (const [name, group] of Object.entries(layout.zones)) {
      for (const [mask, ids] of Object.entries(group)) for (const id of ids) check(d(id), d(ids[0]), Number(mask), `${name} ${mask}/${id}`);
    }
  });

  it('la calle empalma consigo misma y con las casas: tierra, empedrado, ladrillo, cimiento y zócalo', () => {
    const earth = zone('street.earth', 15)[0];
    // La tierra: el relleno y los costados del corte.
    expect(band(zone('street.earth', 7)[0], 'right')).toEqual(band(earth, 'right'));
    expect(band(zone('street.earth', 13)[0], 'left')).toEqual(band(earth, 'left'));
    // A lo alto, cada costado con el de su mismo lado (el aire igual): el cimiento sobre la tierra, el piso sobre el corte.
    for (const m of [7, 13]) expect(band(zone('street.plinth', m)[0], 'down'), `cimiento ${m}`).toEqual(band(zone('street.earth', m)[0], 'down'));
    for (const [m, below] of [[12, 13], [6, 7]]) {
      for (const z of ['street.cobble', 'street.brick']) expect(band(zone(z, m)[0], 'down'), `${z} ${m}`).toEqual(band(zone('street.earth', below)[0], 'down'));
    }
    // El piso (empedrado o ladrillo) y el cimiento: la tierra de abajo es la del relleno; a los costados, consigo mismos.
    for (const z of ['street.cobble', 'street.brick']) {
      const floor = zone(z, 14)[0];
      expect(band(floor, 'down'), z).toEqual(band(earth, 'down'));
      expect(band(zone(z, 12)[0], 'left'), z).toEqual(band(floor, 'left'));
      expect(band(zone(z, 6)[0], 'right'), z).toEqual(band(floor, 'right'));
    }
    const plinth = zone('street.plinth', 15)[0];
    expect(band(plinth, 'down')).toEqual(band(earth, 'down'));
    expect(band(zone('street.plinth', 7)[0], 'right')).toEqual(band(plinth, 'right'));
    // El zócalo: arriba, la cal de la casa; a los costados, consigo mismo.
    for (const z of ['wall.ochre', 'wall.blue']) {
      const socle = zone(z, 15)[0];
      expect(band(socle, 'up'), z).toEqual(band(tiles[15], 'up'));
      expect(band(zone(z, 7)[0], 'right'), z).toEqual(band(socle, 'right'));
      expect(band(zone(z, 13)[0], 'left'), z).toEqual(band(socle, 'left'));
      expect(band(zone(z, 5)[0], 'up'), z).toEqual(band(tiles[5], 'up'));
    }
    // Los pisos de adentro de las casas: la cal de abajo es la de la casa.
    for (const m of [14, 6, 12]) expect(band(zone('wall.brick', m)[0], 'down'), `wall.brick ${m}`).toEqual(band(tiles[m], 'down'));
  });

  it('nada de huecos: la cal, la tierra y el cimiento son macizos', () => {
    expect(opaque(tiles[15])).toBe(true);
    for (const id of layout.fill) expect(opaque(d(id)), `relleno ${id}`).toBe(true);
    for (const z of ['street.earth', 'street.plinth', 'wall.ochre', 'wall.blue']) for (const c of zone(z, 15)) expect(opaque(c), z).toBe(true);
  });

  it('las tejas, el empedrado y el ladrillo no dejan a Kerana flotando: a lo sumo 2 filas vacías arriba', () => {
    const floors = [tiles[14], ...layout.edges['14'].map(d), ...zone('street.cobble', 14), ...zone('street.brick', 14), ...zone('wall.brick', 14)];
    for (const c of floors) for (const r of topRows(c)) expect(r).toBeLessThanOrEqual(2);
    // Las tejas desbordan el filo: en una esquina de arriba la teja llega a la columna de afuera y la pared no.
    expect(alphaAt(tiles[6], 0, 3)).toBe(255);
    expect(alphaAt(tiles[6], 0, 12)).toBe(0);
    expect(alphaAt(tiles[12], 15, 3)).toBe(255);
    expect(alphaAt(tiles[12], 15, 12)).toBe(0);
  });

  it('el tirante (16 a 18) tiene el filo en la fila 0, 6 de grosor y la sombra hacia abajo', () => {
    for (const c of [tiles[16], tiles[17], tiles[18], ...layout.edges['17'].map(d)]) {
      const row = (y: number) => Array.from({ length: T }, (_, x) => alphaAt(c, x, y));
      expect(row(0).filter((a) => a === 255).length).toBeGreaterThanOrEqual(12);
      expect(row(5).filter((a) => a === 255).length).toBeGreaterThanOrEqual(12);
      expect(row(6).filter((a) => a === 255).length).toBeGreaterThanOrEqual(12);
      expect(row(8).some((a) => a > 0 && a < 255)).toBe(true);
      expect(row(12).every((a) => a === 0)).toBe(true);
    }
  });

  it('las espinas (19) son puntas de reja: oscuras abajo y con el filo claro arriba', () => {
    const c = tiles[19];
    const tips = Array.from({ length: T }, (_, x) => x).filter((x) => alphaAt(c, x, 0) > 0);
    expect(tips.length).toBeGreaterThanOrEqual(2);
    for (const x of tips) expect(luma(c, x)).toBeGreaterThan(150);
  });

  it('el revoque rajado (22) y sus variantes: la luz del tajo cae justo en sus grietas, lo más oscuro de la casilla', () => {
    const cracked = [{ tile: tiles[22], glow: layout.glow['22'] }, ...layout.edges['22'].map((id) => ({ tile: d(id), glow: layout.glow[`d${id}`] }))];
    expect(cracked).toHaveLength(3);
    for (const { tile, glow } of cracked) {
      const g = d(glow);
      const lit = Array.from({ length: T * T }, (_, i) => i).filter((i) => g[i * 4 + 3] > 0);
      expect(lit.length).toBeGreaterThan(30);
      const darkest = Math.min(...Array.from({ length: T * T }, (_, i) => luma(tile, i)));
      for (const i of lit) expect(luma(tile, i)).toBeCloseTo(darkest, 5);
    }
  });

  it('las calcomanías: cada una con sus w × h casillas, transparentes alrededor; las que se alinean no se espejan', () => {
    const fixed = ['rising', 'eaveStain', 'footMoss', 'roofPetals', 'roofTuft', 'streetPetals', 'streetWeed', 'layer'];
    for (const [kind, list] of Object.entries(layout.decals)) {
      for (const dec of list) {
        expect(dec.ids).toHaveLength(dec.w * dec.h);
        for (const id of dec.ids) expect(id).toBeLessThan(layout.count);
        expect(dec.flip, kind).toBe(!fixed.includes(kind));
      }
    }
    for (const kind of ['crack', 'damp', 'adobe', 'iron', 'footMoss', 'roofPetals', 'pebble', 'stone', 'root', 'oldBricks', 'layer']) {
      expect(layout.decals[kind]?.length ?? 0, kind).toBeGreaterThan(0);
    }
    for (const dec of [...layout.decals.crack, ...layout.decals.iron]) expect(d(dec.ids[0]).filter((v, i) => i % 4 === 3 && v === 0).length).toBeGreaterThan(200);
  });
});
