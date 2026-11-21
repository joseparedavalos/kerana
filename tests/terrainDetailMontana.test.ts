import { describe, expect, it } from 'vitest';
import layoutJson from '../public/assets/tiles/detalle/montana.json';
import l6Json from '../public/assets/maps/l6.json';
import { GAMEPLAY } from '../src/config/gameplay';
import { LEVELS } from '../src/data/levels';
import { depthTint, detailConfigFor, planTerrainDecals, planTerrainVariants, type DetailLayout, type DetailMap } from '../src/systems/terrainDetailLogic';
import { earthCells, terrainDepths } from '../src/systems/terrainLogic';

// S116: el detalle del terreno de l6 (hoja de montana) sobre su mapa: la configuración propia, las variantes, las
// calcomanías (solo en tierra que se ve, nunca en el aire ni donde va un prop, una chipa o un enemigo) y el volumen.

const LAYOUT = layoutJson as unknown as DetailLayout;
const L6DEF = LEVELS.l6!;
const CFG = detailConfigFor(GAMEPLAY.backdrop.terrainDetail, 'montana');

type MapJson = {
  width: number;
  height: number;
  tilewidth: number;
  layers: { name: string; type: string; data?: number[]; objects?: { type?: string; class?: string; x: number; y: number; width?: number; height?: number }[] }[];
};
const L6 = l6Json as unknown as MapJson;
const { width, height } = L6;
const ground = Int16Array.from(L6.layers.find((l) => l.name === 'Ground')!.data!, (v) => v - 1);
const others = L6.layers.filter((l) => l.type === 'tilelayer' && l.name !== 'Ground').map((l) => l.data!);
const map: DetailMap = {
  width,
  height,
  ground: (x, y) => ground[y * width + x],
  opaque: (x, y) => ground[y * width + x] !== -1,
  caveAir: () => false,
  emptyAir: (x, y) => ground[y * width + x] === -1 && others.every((d) => d[y * width + x] === 0),
};

describe('detalle del terreno de l6 (S116)', () => {
  const seed = L6DEF.terrainDetail!.seed;

  it('l6 usa la hoja de montana con el relleno; la configuración de montana pisa solo lo suyo', () => {
    expect(L6DEF.biome).toBe('montana');
    expect(L6DEF.terrainDetail!.sheet).toBe('montana');
    expect(L6DEF.earthBackdrop).toBe(true);
    const base = GAMEPLAY.backdrop.terrainDetail;
    // Cerro (l1) sigue con la configuración común, sin tocar.
    expect(detailConfigFor(base, 'cerro')).toEqual({ ...base });
    expect(CFG.fillChance).toBe(base.fillChance);
    // Las masas del cerro son hondas: se cuenta más hondo que en el común.
    expect(CFG.maxDepth).toBeGreaterThan(base.maxDepth);
    // Nada sobre el aire: sin el pasto de las esquinas ni raicillas colgando; sin cristales (l6 no tiene cuevas).
    expect(CFG.overhangChance).toBe(0);
    expect(CFG.crystal.chance).toBe(0);
    expect(CFG.hangChance ?? 0).toBe(0);
    for (const b of CFG.bands) for (const kind of Object.keys(b.kinds)) expect(LAYOUT.decals[kind]?.length ?? 0, kind).toBeGreaterThan(0);
  });

  it('variantes: siempre las mismas, solo en las casillas que tienen, cerca del 80 % del relleno y todas usadas', () => {
    const a = planTerrainVariants(width, height, map.ground, LAYOUT, CFG, seed);
    expect(Array.from(planTerrainVariants(width, height, map.ground, LAYOUT, CFG, seed))).toEqual(Array.from(a));
    let fills = 0;
    const used = new Set<number>();
    for (let i = 0; i < a.length; i++) {
      if (a[i] < 0) continue;
      const t = ground[i];
      expect(t === 15 ? LAYOUT.fill : LAYOUT.edges[String(t)], `celda ${i % width},${Math.floor(i / width)}`).toContain(a[i]);
      if (t === 15) fills++;
      used.add(a[i]);
    }
    const total = ground.filter((t) => t === 15).length;
    expect(fills / total).toBeGreaterThan(CFG.fillChance - 0.05);
    expect(fills / total).toBeLessThan(CFG.fillChance + 0.05);
    for (const id of [...LAYOUT.fill, ...LAYOUT.edges['14']]) expect(used.has(id)).toBe(true);
  });

  const plan = planTerrainDecals(map, LAYOUT, CFG, seed);

  it('calcomanías: siempre las mismas, una por celda, solo sobre tierra del autotile (nunca en el aire)', () => {
    expect(planTerrainDecals(map, LAYOUT, CFG, seed).decals).toEqual(plan.decals);
    const cells = new Set(plan.decals.map((d) => `${d.x},${d.y}`));
    expect(cells.size).toBe(plan.decals.length);
    // Las de l1 son 692 y las de l3, 380 (S109, S111). l6 es el nivel más grande (516 × 66, 11 500 celdas de tierra) y
    // tiene lluvia: 803, menos por pantalla que en l1. Más es más relleno que dibujar en el celular.
    expect(plan.decals.length).toBeGreaterThan(400);
    expect(plan.decals.length).toBeLessThan(850);
    for (const d of plan.decals) {
      const t = ground[d.y * width + d.x];
      expect(t >= 0 && t <= 15, `${d.kind} en ${d.x},${d.y}`).toBe(true);
    }
    // Las raíces, bajo el pasto del piso; las de varias casillas, enteras y lejos del borde.
    for (const d of plan.decals.filter((p) => p.kind === 'roots' || p.kind === 'rootlet')) {
      const t = ground[d.y * width + d.x];
      const top = !(t & 1);
      expect(top || (d.kind === 'roots' && ground[(d.y - 1) * width + d.x] === 14)).toBe(true);
    }
    for (const d of plan.decals.filter((p) => ['boulder', 'sandstone', 'seam', 'iron'].includes(p.kind) && layoutJson.decals[p.kind as 'boulder'].some((x) => x.ids.length > 1 && x.ids.includes(p.id)))) {
      expect(plan.depth[d.y * width + d.x]).toBeGreaterThanOrEqual(CFG.multiMinDepth);
    }
    for (const kind of ['sandstone', 'seam', 'block', 'boulder', 'iron', 'quartz', 'pebble', 'lichen', 'roots', 'rootlet']) {
      expect(plan.decals.some((d) => d.kind === kind), kind).toBe(true);
    }
  });

  it('nada tapa un prop, una chipa, un enemigo ni una pieza: donde están, no hay calcomanías', () => {
    const objects = L6.layers.filter((l) => l.type === 'objectgroup').flatMap((l) => l.objects ?? []);
    const decal = new Set(plan.decals.map((d) => `${d.x},${d.y}`));
    let checked = 0;
    for (const o of objects) {
      const kind = o.type ?? o.class ?? '';
      if (!o.width && !o.height) {
        // Un punto (prop, enemigo, chipa, pieza): la celda donde está (los pies, un píxel arriba) va en el aire.
        const cx = Math.floor(o.x / 16);
        const cy = Math.floor((o.y - 1) / 16);
        if (cx < 0 || cy < 0 || cx >= width || cy >= height) continue;
        expect(decal.has(`${cx},${cy}`), `${kind} en ${cx},${cy}`).toBe(false);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(30);
  });

  it('el volumen: la tierra se oscurece hacia adentro en pasos de 3 % o menos, y el relleno va solo en lo sólido', () => {
    const shade = CFG.depthShade;
    expect(depthTint(1, shade)).toBe(0xffffff);
    // El corazón de las masas grandes (la cumbre 1, la de la cascada) llega al tono más hondo.
    expect(shade).toHaveLength(CFG.maxDepth + 1);
    expect(Math.max(...plan.depth)).toBeGreaterThanOrEqual(CFG.maxDepth);
    for (let k = 1; k < shade.length; k++) {
      expect(shade[k - 1] - shade[k]).toBeGreaterThanOrEqual(0);
      expect(shade[k - 1] - shade[k]).toBeLessThanOrEqual(0.03 + 1e-9);
    }
    // El fondo de tierra (earthBackdrop) solo toma celdas sólidas; lleva la misma variante y el mismo tinte que Ground.
    const depth = terrainDepths((x, y) => ground[y * width + x] !== -1, width, height, L6DEF.terrainShell!);
    const earth = earthCells(depth, width, L6DEF.terrainShell!);
    expect(earth.length).toBeGreaterThan(0);
    for (const { x, y } of earth) expect(ground[y * width + x]).not.toBe(-1);
  });
});
