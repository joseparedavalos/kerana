import { describe, expect, it } from 'vitest';
import layoutJson from '../public/assets/tiles/detalle/cielo.json';
import yvagaJson from '../public/assets/maps/yvaga.json';
import { GAMEPLAY } from '../src/config/gameplay';
import { LEVELS } from '../src/data/levels';
import {
  detailConfigFor,
  planTerrainDecals,
  planTerrainVariants,
  regionZones,
  type DetailLayout,
  type DetailMap,
} from '../src/systems/terrainDetailLogic';

// S118: el detalle del terreno de Yvága (hoja del cielo): la terraza de la arena por zona, la quilla bajo cada isla
// (corta en los pasajes, de dos celdas en el corazón de las islas anchas, nunca sobre una plataforma), el detalle de la
// cara del sillar y que la configuración del cielo no toca la de las otras hojas.

const LAYOUT = layoutJson as unknown as DetailLayout;
const DEF = LEVELS.yvaga!;
const CFG = detailConfigFor(GAMEPLAY.backdrop.terrainDetail, 'cielo');

type MapJson = { width: number; height: number; layers: { name: string; type: string; data?: number[] }[] };
const MAP = yvagaJson as unknown as MapJson;
const { width, height } = MAP;
const layer = (name: string) => MAP.layers.find((l) => l.name === name)?.data ?? new Array(width * height).fill(0);
const ground = Int16Array.from(layer('Ground'), (v) => v - 1);
const others = MAP.layers.filter((l) => l.type === 'tilelayer' && l.name !== 'Ground').map((l) => l.data!);
const map: DetailMap = {
  width,
  height,
  ground: (x, y) => ground[y * width + x],
  opaque: (x, y) => ground[y * width + x] !== -1,
  caveAir: () => false,
  emptyAir: (x, y) => ground[y * width + x] === -1 && others.every((d) => d[y * width + x] === 0),
};
const g = (x: number, y: number) => (x < 0 || y < 0 || x >= width || y >= height ? -1 : ground[y * width + x]);

describe('detalle del terreno de Yvága (S118)', () => {
  const seed = DEF.terrainDetail!.seed;
  const zones = regionZones(width, height, map.ground, CFG.regions!);
  const zoneAt = (x: number, y: number) => zones[y * width + x];
  const plan = planTerrainDecals(map, LAYOUT, CFG, seed, zoneAt);

  it('Yvága usa la hoja del cielo; su configuración pisa solo lo suyo (cerro sigue con la de S109)', () => {
    expect(DEF.biome).toBe('cielo');
    expect(DEF.terrainDetail!.sheet).toBe('cielo');
    const base = GAMEPLAY.backdrop.terrainDetail;
    expect(detailConfigFor(base, 'cerro')).toEqual({ ...base });
    expect((base as { keel?: unknown }).keel).toBeUndefined();
    expect(CFG.keel).toBeDefined();
    // Cada tipo que piden las zonas está en la hoja.
    for (const zd of Object.values(CFG.zoneDecals!)) {
      for (const kind of [...Object.keys(zd.floor), ...zd.bands.flatMap((b) => Object.keys(b.kinds))]) expect(LAYOUT.decals[kind]?.length ?? 0, kind).toBeGreaterThan(0);
    }
  });

  it('el piso de la arena es la terraza; todo lo demás del autotile, isla; el aire, ninguna', () => {
    for (let x = 4; x < 44; x++) expect(zoneAt(x, 23), `x ${x}`).toBe('terrace');
    for (let y = 26; y < height; y++) for (let x = 0; x < width; x++) if (g(x, y) >= 0 && g(x, y) <= 15) expect(zoneAt(x, y)).toBe('island');
    for (let i = 0; i < width * height; i++) if (ground[i] === -1) expect(zones[i]).toBeNull();
    // La terraza lleva siempre su casilla (14, 15 y 11 de la zona).
    const v = planTerrainVariants(width, height, map.ground, LAYOUT, CFG, seed, undefined, zoneAt);
    const top = Array.from({ length: 40 }, (_, k) => k + 4).filter((x) => g(x, 23) === 14);
    expect(top.length).toBeGreaterThanOrEqual(38);
    for (const x of top) expect(LAYOUT.zones!.terrace['14']).toContain(v[23 * width + x]);
  });

  it('la quilla: una por celda de aire bajo cada isla, con la forma de la isla, nunca sobre una plataforma', () => {
    const keels = plan.decals.filter((d) => d.kind.startsWith('keel'));
    const at = new Map(keels.map((d) => [d.y * width + d.x, d]));
    let bottoms = 0;
    for (let y = 1; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const above = g(x, y - 1);
        if (above < 0 || above > 15 || g(x, y) !== -1 || !map.emptyAir(x, y)) continue;
        bottoms++;
        const d = at.get(y * width + x);
        expect(d, `quilla en ${x},${y}`).toBeDefined();
        const shape = above & 2 && above & 8 ? 'Mid' : above & 2 ? 'Left' : above & 8 ? 'Right' : 'Solo';
        if (d!.kind !== 'keelDeep') expect(d!.kind.endsWith(shape), `${d!.kind} en ${x},${y}`).toBe(true);
      }
    }
    expect(bottoms).toBeGreaterThan(400);
    for (const d of keels) expect(map.emptyAir(d.x, d.y), `quilla en el aire libre ${d.x},${d.y}`).toBe(true);
  });

  it('en un pasaje (menos de 4 filas de aire) la quilla es la corta; la de dos celdas, solo en el corazón de una isla ancha', () => {
    const clearBelow = (x: number, y: number) => {
      let n = 0;
      while (y + n < height && g(x, y + n) === -1 && map.emptyAir(x, y + n)) n++;
      return n;
    };
    // Los pasajes del tramo 5: bajo las islas de las filas 114 y 131 hay 3 filas.
    for (const [x, y] of [[23, 115], [28, 132]]) {
      const d = plan.decals.find((q) => q.x === x && q.y === y);
      expect(d?.kind, `${x},${y}`).toMatch(/^keelShort/);
    }
    const deep = plan.decals.filter((d) => d.kind === 'keelDeep');
    expect(deep.length).toBeGreaterThan(20);
    for (let i = 0; i < deep.length; i += 2) {
      const d = deep[i];
      expect(clearBelow(d.x, d.y)).toBeGreaterThanOrEqual(CFG.keel!.deep!.clear);
      for (let k = 1; k <= 3; k++) {
        expect(g(d.x - k, d.y - 1)).not.toBe(-1);
        expect(g(d.x + k, d.y - 1)).not.toBe(-1);
      }
      expect(deep[i + 1]).toMatchObject({ x: d.x, y: d.y + 1 });
    }
    for (const d of plan.decals) if (d.kind.startsWith('keel') && clearBelow(d.x, d.y) < 4 && d.kind !== 'keelDeep') expect(d.kind).toMatch(/^keelShort/);
  });

  it('el detalle de la cara: siempre el mismo, una por celda, y no más de lo que pesa l1', () => {
    const again = planTerrainDecals(map, LAYOUT, CFG, seed, zoneAt);
    expect(again.decals).toEqual(plan.decals);
    const cells = new Set(plan.decals.map((d) => d.y * width + d.x));
    expect(cells.size).toBe(plan.decals.length);
    const face = plan.decals.filter((d) => !d.kind.startsWith('keel'));
    expect(face.length).toBeGreaterThan(80);
    expect(plan.decals.length).toBeLessThan(900);
    for (const d of face) expect(g(d.x, d.y)).not.toBe(-1);
  });
});
