import { describe, expect, it } from 'vitest';
import layoutJson from '../public/assets/tiles/detalle/selva.json';
import cerroJson from '../public/assets/tiles/detalle/cerro.json';
import l5Json from '../public/assets/maps/l5.json';
import { GAMEPLAY } from '../src/config/gameplay';
import { LEVELS } from '../src/data/levels';
import {
  depthTint,
  detailConfigFor,
  glowTileFor,
  HANG_CLEAR,
  planTerrainDecals,
  planTerrainVariants,
  type DetailLayout,
  type DetailMap,
} from '../src/systems/terrainDetailLogic';
import { earthCells, terrainDepths } from '../src/systems/terrainLogic';

// S113: el detalle del terreno de l5 (hoja de la selva) sobre su mapa: la configuración propia, las variantes, las
// calcomanías (con las raicillas que cuelgan bajo las salientes, nunca en un pasaje bajo como el túnel de raíces), la
// luz de la piedra que se rompe y el volumen.

const LAYOUT = layoutJson as unknown as DetailLayout;
const L5DEF = LEVELS.l5!;
const CFG = detailConfigFor(GAMEPLAY.backdrop.terrainDetail, 'selva');

type MapJson = { width: number; height: number; layers: { name: string; type: string; data?: number[] }[] };
const L5 = l5Json as unknown as MapJson;
const { width, height } = L5;
const ground = Int16Array.from(L5.layers.find((l) => l.name === 'Ground')!.data!, (v) => v - 1);
const others = L5.layers.filter((l) => l.type === 'tilelayer' && l.name !== 'Ground').map((l) => l.data!);
const map: DetailMap = {
  width,
  height,
  ground: (x, y) => ground[y * width + x],
  opaque: (x, y) => ground[y * width + x] !== -1,
  caveAir: () => false,
  emptyAir: (x, y) => ground[y * width + x] === -1 && others.every((d) => d[y * width + x] === 0),
};

describe('detalle del terreno de l5 (S113)', () => {
  const seed = L5DEF.terrainDetail!.seed;

  it('l5 usa la hoja de la selva y el relleno; la configuración de la selva pisa solo lo suyo', () => {
    expect(L5DEF.terrainDetail!.sheet).toBe('selva');
    expect(L5DEF.earthBackdrop).toBe(true);
    const base = GAMEPLAY.backdrop.terrainDetail;
    expect(detailConfigFor(base, 'cerro')).toEqual({ ...base });
    expect(CFG.fillChance).toBe(base.fillChance);
    expect(CFG.hangChance).toBeGreaterThan(0);
    // Ninguna otra hoja cuelga raicillas.
    for (const sheet of ['cerro', 'estero', 'campo', 'pueblo']) expect(detailConfigFor(base, sheet).hangChance ?? 0, sheet).toBe(0);
    for (const b of CFG.bands) for (const kind of Object.keys(b.kinds)) expect(LAYOUT.decals[kind]?.length ?? 0, kind).toBeGreaterThan(0);
    expect(LAYOUT.decals.crystal).toBeUndefined();
    expect(Object.keys((cerroJson as unknown as DetailLayout).decals)).toContain('crystal');
  });

  it('variantes: cerca del 80 % del relleno, todas de su casilla, y casi todas se usan', () => {
    const v = planTerrainVariants(width, height, map.ground, LAYOUT, CFG, seed);
    expect(Array.from(planTerrainVariants(width, height, map.ground, LAYOUT, CFG, seed))).toEqual(Array.from(v));
    let fills = 0;
    let fillCells = 0;
    const used = new Set<number>();
    for (let i = 0; i < v.length; i++) {
      const t = ground[i];
      if (t === 15) fillCells++;
      if (v[i] < 0) continue;
      const allowed = t === 15 ? LAYOUT.fill : LAYOUT.edges[String(t)];
      expect(allowed, `celda ${i % width},${Math.floor(i / width)}`).toContain(v[i]);
      if (t === 15) fills++;
      used.add(v[i]);
    }
    expect(fills / fillCells).toBeGreaterThan(0.75);
    expect(fills / fillCells).toBeLessThan(0.85);
    for (const id of LAYOUT.fill) expect(used.has(id), `variante ${id}`).toBe(true);
  });

  it('calcomanías: siempre iguales, una por celda, en la tierra o (las esquinas y las raicillas) en el aire vacío de al lado', () => {
    const a = planTerrainDecals(map, LAYOUT, CFG, seed);
    expect(planTerrainDecals(map, LAYOUT, CFG, seed).decals).toEqual(a.decals);
    const cells = new Set<number>();
    const kinds = new Map<string, number>();
    for (const d of a.decals) {
      const i = d.y * width + d.x;
      expect(cells.has(i)).toBe(false);
      cells.add(i);
      kinds.set(d.kind, (kinds.get(d.kind) ?? 0) + 1);
      const air = ['hang', 'overhangLeft', 'overhangRight'].includes(d.kind);
      if (!air) {
        expect(ground[i], `${d.kind} en ${d.x}, ${d.y}`).toBeGreaterThanOrEqual(0);
        expect(ground[i]).toBeLessThanOrEqual(15);
        continue;
      }
      expect(map.emptyAir(d.x, d.y), `${d.kind} en ${d.x}, ${d.y}`).toBe(true);
      if (d.kind !== 'hang') continue;
      // Debajo de una saliente, con aire de sobra abajo: nunca en el túnel de raíces (x 16 a 25, filas 89 a 91).
      expect(ground[(d.y - 1) * width + d.x]).toBeGreaterThanOrEqual(0);
      for (let k = 0; k < HANG_CLEAR; k++) expect(ground[(d.y + k) * width + d.x], `${d.x}, ${d.y + k}`).toBe(-1);
      expect(d.x >= 16 && d.x <= 25 && d.y >= 89 && d.y <= 91, `raicilla en el túnel (${d.x}, ${d.y})`).toBe(false);
    }
    // La densidad de S112: cientos de calcomanías, de todos los tipos.
    expect(a.decals.length).toBeGreaterThan(400);
    for (const kind of ['root', 'stone', 'leaf', 'seed', 'bug', 'laterite', 'pebble', 'patch', 'log', 'roots', 'rootlet', 'hang', 'overhangLeft', 'overhangRight']) {
      expect(kinds.get(kind) ?? 0, kind).toBeGreaterThan(0);
    }
    expect(kinds.get('hang')!).toBeGreaterThan(40);
  });

  it('la piedra que se rompe tiene su luz en las grietas, con o sin variante', () => {
    expect(glowTileFor(LAYOUT, 22)).toBeGreaterThanOrEqual(0);
    for (const id of LAYOUT.edges['22']) expect(glowTileFor(LAYOUT, -1, id)).toBeGreaterThanOrEqual(0);
    expect(glowTileFor(LAYOUT, 15)).toBe(-1);
  });

  it('el volumen: la tierra se oscurece hacia adentro en pasos de 3 % o menos, y el relleno nunca va en el aire', () => {
    const shade = CFG.depthShade;
    for (let i = 1; i < shade.length; i++) expect(shade[i - 1] - shade[i]).toBeLessThanOrEqual(0.031);
    expect(depthTint(0, shade)).toBe(0xffffff);
    const depth = terrainDepths((x, y) => ground[y * width + x] !== -1, width, height, Math.max(CFG.maxDepth, L5DEF.terrainShell!));
    for (const c of earthCells(depth, width, L5DEF.terrainShell!)) expect(ground[c.y * width + c.x]).not.toBe(-1);
  });
});
