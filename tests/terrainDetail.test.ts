import { describe, expect, it } from 'vitest';
import layoutJson from '../public/assets/tiles/detalle/cerro.json';
import l1Json from '../public/assets/maps/l1.json';
import { GAMEPLAY } from '../src/config/gameplay';
import { LEVELS } from '../src/data/levels';
import {
  caveDistance,
  cellHash,
  depthTint,
  planTerrainDecals,
  planTerrainVariants,
  type DetailLayout,
  type DetailMap,
} from '../src/systems/terrainDetailLogic';

// S109: variantes del relleno y calcomanías del terreno de l1, elegidas por celda con la semilla del nivel.

const LAYOUT = layoutJson as unknown as DetailLayout;
const CFG = GAMEPLAY.backdrop.terrainDetail;

type MapJson = { width: number; height: number; layers: { name: string; type: string; data?: number[]; objects?: { type?: string; class?: string; x: number; y: number; width: number; height: number }[] }[] };
const L1 = l1Json as unknown as MapJson;

/** l1 como lo ve el plan: Ground (casilla del tileset), las zonas `Cave` y lo opaco (sin la repisa: todo sólido se ve). */
function l1Map(): DetailMap & { base: Int16Array } {
  const { width, height } = L1;
  const ground = L1.layers.find((l) => l.name === 'Ground')!.data!;
  const others = L1.layers.filter((l) => l.type === 'tilelayer' && l.name !== 'Ground').map((l) => l.data!);
  const caves = L1.layers
    .filter((l) => l.type === 'objectgroup')
    .flatMap((l) => l.objects ?? [])
    .filter((o) => (o.type ?? o.class) === 'Cave');
  const base = Int16Array.from(ground, (v) => v - 1);
  const inCave = (x: number, y: number) => caves.some((c) => (x + 0.5) * 16 >= c.x && (x + 0.5) * 16 < c.x + c.width && (y + 0.5) * 16 >= c.y && (y + 0.5) * 16 < c.y + c.height);
  return {
    width,
    height,
    base,
    ground: (x, y) => base[y * width + x],
    opaque: (x, y) => base[y * width + x] !== -1,
    caveAir: (x, y) => base[y * width + x] === -1 && inCave(x, y),
    emptyAir: (x, y) => base[y * width + x] === -1 && others.every((d) => d[y * width + x] === 0),
  };
}

describe('detalle del terreno (S109)', () => {
  const map = l1Map();
  const seed = LEVELS.l1!.terrainDetail!.seed;

  it('solo l1 lo usa, con la hoja de cerro', () => {
    const using = Object.values(LEVELS).filter((l) => l?.terrainDetail);
    expect(using.map((l) => l!.id)).toEqual(['l1']);
    expect(LEVELS.l1!.terrainDetail!.sheet).toBe('cerro');
  });

  it('el azar de cada celda es fijo y distinto entre celdas', () => {
    expect(cellHash(10, 20, 109, 3)).toBe(cellHash(10, 20, 109, 3));
    const values = new Set(Array.from({ length: 200 }, (_, i) => cellHash(i % 20, Math.floor(i / 20), 109)));
    expect(values.size).toBe(200);
    for (const v of values) expect(v >= 0 && v < 1).toBe(true);
  });

  it('variantes: siempre las mismas, solo en el relleno y en las casillas que tienen, y no todas iguales', () => {
    const a = planTerrainVariants(map.width, map.height, map.ground, LAYOUT, CFG, seed);
    const b = planTerrainVariants(map.width, map.height, map.ground, LAYOUT, CFG, seed);
    expect(Array.from(a)).toEqual(Array.from(b));
    let fills = 0;
    const used = new Set<number>();
    for (let i = 0; i < a.length; i++) {
      if (a[i] < 0) continue;
      const t = map.base[i];
      const allowed = t === 15 ? LAYOUT.fill : LAYOUT.edges[String(t)];
      expect(allowed, `celda ${i % map.width},${Math.floor(i / map.width)}`).toContain(a[i]);
      if (t === 15) fills++;
      used.add(a[i]);
    }
    const total = map.base.filter((t) => t === 15).length;
    // Cerca de `fillChance` del relleno lleva variante, y se usan todas.
    expect(fills / total).toBeGreaterThan(CFG.fillChance - 0.05);
    expect(fills / total).toBeLessThan(CFG.fillChance + 0.05);
    for (const id of LAYOUT.fill) expect(used.has(id)).toBe(true);
    // Otra semilla, otro dibujo.
    const c = planTerrainVariants(map.width, map.height, map.ground, LAYOUT, CFG, seed + 7);
    expect(Array.from(c)).not.toEqual(Array.from(a));
  });

  const plan = planTerrainDecals(map, LAYOUT, CFG, seed);
  const at = new Map(plan.decals.map((d) => [`${d.x},${d.y}`, d]));

  it('calcomanías: siempre las mismas y una por celda como mucho', () => {
    expect(planTerrainDecals(map, LAYOUT, CFG, seed).decals).toEqual(plan.decals);
    expect(at.size).toBe(plan.decals.length);
    expect(plan.decals.length).toBeGreaterThan(100);
  });

  it('solo sobre roca del autotile que se ve; el pasto de las esquinas, en aire vacío junto a una esquina de arriba', () => {
    for (const d of plan.decals) {
      const t = map.ground(d.x, d.y);
      if (d.kind === 'overhangLeft' || d.kind === 'overhangRight') {
        expect(map.emptyAir(d.x, d.y)).toBe(true);
        const cx = d.kind === 'overhangLeft' ? d.x + 1 : d.x - 1;
        const m = map.ground(cx, d.y);
        expect(m >= 0 && m <= 15 && !(m & 1) && !(m & (d.kind === 'overhangLeft' ? 8 : 2))).toBe(true);
        continue;
      }
      expect(t >= 0 && t <= 15, `${d.kind} en ${d.x},${d.y}`).toBe(true);
      expect(map.opaque(d.x, d.y)).toBe(true);
    }
    // Las raíces largas, bajo el pasto del llano (14) y en la celda de abajo.
    for (const d of plan.decals.filter((p) => p.kind === 'roots')) {
      const top = map.ground(d.x, d.y) === 14;
      const below = at.get(`${d.x},${d.y + 1}`);
      const above = at.get(`${d.x},${d.y - 1}`);
      expect(top ? below?.kind : above?.kind).toBe('roots');
    }
  });

  it('las de varias casillas van enteras, lejos del borde; los cristales, cerca del aire de las cuevas', () => {
    const near = caveDistance(map, CFG.crystal.reach);
    for (const d of plan.decals) {
      const depth = plan.depth[d.y * map.width + d.x];
      if (d.kind === 'boulder' || d.kind === 'strata') expect(depth).toBeGreaterThanOrEqual(CFG.multiMinDepth);
      if (d.kind === 'crystal') {
        expect(near[d.y * map.width + d.x]).toBeLessThanOrEqual(CFG.crystal.reach);
        expect(depth).toBeGreaterThanOrEqual(CFG.crystal.minDepth);
      }
    }
    // Cada canto rodado: sus 4 casillas, en cuadrado, y con las ids de una misma calcomanía (o espejada).
    const boulders = plan.decals.filter((d) => d.kind === 'boulder');
    expect(boulders.length % 4).toBe(0);
    const sets = LAYOUT.decals.boulder.map((b) => new Set(b.ids));
    for (const d of boulders) expect(sets.some((s) => s.has(d.id))).toBe(true);
    expect(plan.decals.some((d) => d.kind === 'crystal')).toBe(true);
    expect(plan.decals.some((d) => d.kind === 'strata')).toBe(true);
    // Las capas no se espejan (siguen la pendiente de la base).
    for (const d of plan.decals.filter((p) => p.kind === 'strata')) expect(d.flip).toBe(false);
  });

  it('el volumen: la roca se oscurece en pasos chicos con la profundidad', () => {
    expect(depthTint(1, CFG.depthShade)).toBe(0xffffff);
    expect(depthTint(99, CFG.depthShade)).toBe(depthTint(CFG.depthShade.length - 1, CFG.depthShade));
    for (let d = 1; d < CFG.depthShade.length; d++) {
      const step = CFG.depthShade[d - 1] - CFG.depthShade[d];
      expect(step).toBeGreaterThanOrEqual(0);
      // Más de un 3 % entre dos filas se lee como una caja (los bloques de 16 px se ven).
      expect(step).toBeLessThanOrEqual(0.03);
    }
  });
});
