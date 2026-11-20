import { describe, expect, it } from 'vitest';
import layoutJson from '../public/assets/tiles/detalle/estero.json';
import cerroJson from '../public/assets/tiles/detalle/cerro.json';
import l2Json from '../public/assets/maps/l2.json';
import { GAMEPLAY } from '../src/config/gameplay';
import { LEVELS } from '../src/data/levels';
import {
  depthTint,
  detailConfigFor,
  glowTileFor,
  planTerrainDecals,
  planTerrainVariants,
  planWaterTiles,
  type DetailLayout,
  type DetailMap,
} from '../src/systems/terrainDetailLogic';
import { earthCells, terrainDepths } from '../src/systems/terrainLogic';

// S110: el detalle del terreno de l2 (hoja del estero): la configuración propia, las variantes (con el fondo bajo el
// agua), las calcomanías, el agua en tres tonos, la luz del barro seco y el relleno, que nunca tapa el aire ni el agua.

const LAYOUT = layoutJson as unknown as DetailLayout;
const L2DEF = LEVELS.l2!;
const CFG = detailConfigFor(GAMEPLAY.backdrop.terrainDetail, 'estero');

type MapJson = { width: number; height: number; layers: { name: string; type: string; data?: number[] }[] };
const L2 = l2Json as unknown as MapJson;
const { width, height } = L2;
const layer = (name: string) => L2.layers.find((l) => l.name === name)?.data ?? new Array(width * height).fill(0);
const ground = Int16Array.from(layer('Ground'), (v) => v - 1);
const water = Int16Array.from(layer('Water'), (v) => v - 1);
const others = L2.layers.filter((l) => l.type === 'tilelayer' && l.name !== 'Ground').map((l) => l.data!);
const map: DetailMap = {
  width,
  height,
  ground: (x, y) => ground[y * width + x],
  opaque: (x, y) => ground[y * width + x] !== -1,
  caveAir: () => false,
  emptyAir: (x, y) => ground[y * width + x] === -1 && others.every((d) => d[y * width + x] === 0),
};
const underWater = (x: number, y: number) => y > 0 && water[(y - 1) * width + x] !== -1;

describe('detalle del terreno de l2 (S110)', () => {
  const seed = L2DEF.terrainDetail!.seed;

  it('l2 usa la hoja del estero, el relleno y el brillo del agua; la configuración del estero pisa solo lo suyo', () => {
    expect(L2DEF.terrainDetail!.sheet).toBe('estero');
    expect(L2DEF.earthBackdrop).toBe(true);
    expect(L2DEF.waterGlints).toBe(true);
    const base = GAMEPLAY.backdrop.terrainDetail;
    // Cerro (l1) queda con la configuración de S109, sin tocar.
    expect(detailConfigFor(base, 'cerro')).toEqual({ ...base });
    expect(CFG.fillChance).toBe(base.fillChance);
    expect(CFG.bands).not.toEqual(base.bands);
    // Cada tipo que piden las franjas está en la hoja del estero (los de cerro, como el cristal, no).
    for (const b of CFG.bands) for (const kind of Object.keys(b.kinds)) expect(LAYOUT.decals[kind]?.length ?? 0, kind).toBeGreaterThan(0);
    expect(LAYOUT.decals.crystal).toBeUndefined();
    expect(Object.keys((cerroJson as unknown as DetailLayout).decals)).toContain('crystal');
  });

  it('variantes: cerca del 80 % del relleno, todas se usan, y bajo el agua el piso siempre es el sumergido', () => {
    const v = planTerrainVariants(width, height, map.ground, LAYOUT, CFG, seed, underWater);
    expect(Array.from(planTerrainVariants(width, height, map.ground, LAYOUT, CFG, seed, underWater))).toEqual(Array.from(v));
    let fills = 0;
    const used = new Set<number>();
    let wet = 0;
    for (let i = 0; i < v.length; i++) {
      const t = ground[i];
      const x = i % width;
      const y = (i - x) / width;
      if (underWater(x, y) && t >= 0) {
        expect(LAYOUT.submerged?.[String(t)] ?? [v[i]], `fondo ${x},${y}`).toContain(v[i]);
        if (LAYOUT.submerged?.[String(t)]) wet++;
        continue;
      }
      if (v[i] < 0) continue;
      const allowed = t === 15 ? LAYOUT.fill : LAYOUT.edges[String(t)];
      expect(allowed, `celda ${x},${y}`).toContain(v[i]);
      if (t === 15) fills++;
      used.add(v[i]);
    }
    expect(wet).toBeGreaterThan(50);
    const total = Array.from(ground).filter((t) => t === 15).length;
    expect(fills / total).toBeGreaterThan(CFG.fillChance - 0.05);
    expect(fills / total).toBeLessThan(CFG.fillChance + 0.05);
    for (const id of LAYOUT.fill) expect(used.has(id)).toBe(true);
  });

  const plan = planTerrainDecals(map, LAYOUT, CFG, seed);

  it('calcomanías: siempre las mismas, una por celda, solo sobre barro del autotile; las de varias casillas, enteras y hondas', () => {
    expect(planTerrainDecals(map, LAYOUT, CFG, seed).decals).toEqual(plan.decals);
    const at = new Set(plan.decals.map((d) => `${d.x},${d.y}`));
    expect(at.size).toBe(plan.decals.length);
    expect(plan.decals.length).toBeGreaterThan(150);
    const kinds = new Set(plan.decals.map((d) => d.kind));
    for (const k of ['shell', 'twig', 'clay', 'root', 'rootlet']) expect(kinds.has(k), k).toBe(true);
    for (const d of plan.decals) {
      if (d.kind.startsWith('overhang')) {
        expect(map.emptyAir(d.x, d.y)).toBe(true);
        continue;
      }
      const t = map.ground(d.x, d.y);
      expect(t >= 0 && t <= 15, `${d.kind} en ${d.x},${d.y}`).toBe(true);
      if (d.kind === 'clay' || d.kind === 'root') expect(plan.depth[d.y * width + d.x]).toBeGreaterThanOrEqual(CFG.multiMinDepth);
    }
  });

  it('el volumen: el barro se oscurece hacia adentro más que la roca, en pasos de 3 % o menos', () => {
    const shade = CFG.depthShade;
    expect(shade.at(-1)!).toBeLessThan(GAMEPLAY.backdrop.terrainDetail.depthShade.at(-1)!);
    for (let i = 1; i < shade.length; i++) {
      expect(shade[i - 1] - shade[i]).toBeGreaterThanOrEqual(0);
      expect(shade[i - 1] - shade[i]).toBeLessThanOrEqual(0.03 + 1e-9);
    }
    expect(depthTint(1, shade)).toBe(0xffffff);
  });

  it('el agua: debajo del cuerpo, el fondo; la superficie y el cuerpo con variantes de la hoja; siempre igual', () => {
    const w = (x: number, y: number) => (x < 0 || y < 0 || x >= width || y >= height ? -1 : water[y * width + x]);
    const plan = planWaterTiles(width, height, w, LAYOUT, CFG.waterChance, seed + 2);
    expect(Array.from(planWaterTiles(width, height, w, LAYOUT, CFG.waterChance, seed + 2))).toEqual(Array.from(plan));
    let deep = 0;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const t = w(x, y);
        const v = plan[y * width + x];
        if (t === 21 && w(x, y - 1) === 21) {
          expect(LAYOUT.water!.deep).toContain(v);
          deep++;
        } else if (t === 20 || t === 21) {
          if (v >= 0) expect(LAYOUT.edges[String(t)]).toContain(v);
        } else {
          expect(v).toBe(-1);
        }
      }
    }
    expect(deep).toBeGreaterThan(200);
  });

  it('la luz del barro seco: la 22 y cada una de sus variantes tienen la suya; las demás casillas, no', () => {
    expect(glowTileFor(LAYOUT, 22)).toBeGreaterThanOrEqual(0);
    for (const v of LAYOUT.edges['22']) expect(glowTileFor(LAYOUT, -1, v)).toBeGreaterThanOrEqual(0);
    expect(glowTileFor(LAYOUT, 15)).toBe(-1);
    expect(glowTileFor(LAYOUT, -1, LAYOUT.fill[0])).toBe(-1);
    // l1 no tiene luz en su hoja: su roca sigue con el dibujo de BreakableLook.
    expect(glowTileFor(cerroJson as unknown as DetailLayout, 22)).toBe(-1);
  });

  it('el relleno de l2 nunca tapa el aire ni el agua', () => {
    const shell = L2DEF.terrainShell!;
    const depth = terrainDepths((x, y) => ground[y * width + x] !== -1, width, height, shell);
    const cells = earthCells(depth, width, shell);
    expect(cells.length).toBeGreaterThan(0);
    for (const c of cells) {
      expect(ground[c.y * width + c.x], `${c.x},${c.y}`).not.toBe(-1);
      expect(water[c.y * width + c.x], `${c.x},${c.y}`).toBe(-1);
    }
  });
});
