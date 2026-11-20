import { describe, expect, it } from 'vitest';
import layoutJson from '../public/assets/tiles/detalle/pueblo.json';
import l4Json from '../public/assets/maps/l4.json';
import { GAMEPLAY } from '../src/config/gameplay';
import { LEVELS } from '../src/data/levels';
import {
  depthTint,
  detailConfigFor,
  planTerrainDecals,
  planTerrainVariants,
  TOWN_ZONES,
  townZones,
  type DetailLayout,
  type DetailMap,
} from '../src/systems/terrainDetailLogic';
import { earthCells, terrainDepths } from '../src/systems/terrainLogic';

// S112: el detalle del terreno de l4 (hoja del pueblo) sobre su mapa: el reparto en calle y casas (medido en el mapa),
// que cada celda de una zona tenga su casilla, las calcomanías de cada zona y el volumen.

const LAYOUT = layoutJson as unknown as DetailLayout;
const L4DEF = LEVELS.l4!;
const CFG = detailConfigFor(GAMEPLAY.backdrop.terrainDetail, 'pueblo');

type MapJson = {
  width: number;
  height: number;
  tilewidth: number;
  layers: { name: string; type: string; data?: number[]; objects?: { type?: string; class?: string; x: number; y: number; width?: number; height?: number }[] }[];
};
const L4 = l4Json as unknown as MapJson;
const { width, height, tilewidth } = L4;
const ground = Int16Array.from(L4.layers.find((l) => l.name === 'Ground')!.data!, (v) => v - 1);
const others = L4.layers.filter((l) => l.type === 'tilelayer' && l.name !== 'Ground').map((l) => l.data!);
const map: DetailMap = {
  width,
  height,
  ground: (x, y) => ground[y * width + x],
  opaque: (x, y) => ground[y * width + x] !== -1,
  caveAir: () => false,
  emptyAir: (x, y) => ground[y * width + x] === -1 && others.every((d) => d[y * width + x] === 0),
};
const seed = L4DEF.terrainDetail!.seed;
const zones = townZones(width, height, map.ground, CFG.town!, seed);
const zoneAt = (x: number, y: number) => zones[y * width + x];
const at = (x: number, y: number) => zones[y * width + x];

describe('detalle del terreno de l4 (S112)', () => {
  it('l4 usa la hoja del pueblo con el relleno y el reparto en calle y casas; la configuración del pueblo pisa solo lo suyo', () => {
    expect(L4DEF.biome).toBe('pueblo');
    expect(L4DEF.terrainDetail!.sheet).toBe('pueblo');
    expect(L4DEF.earthBackdrop).toBe(true);
    const base = GAMEPLAY.backdrop.terrainDetail;
    expect(detailConfigFor(base, 'cerro')).toEqual({ ...base });
    expect(CFG.town).toBeDefined();
    expect(CFG.overhangChance).toBe(0);
    expect(CFG.crystal.chance).toBe(0);
    // Cada calcomanía que nombra la configuración está en la hoja.
    for (const zd of Object.values(CFG.zoneDecals!)) {
      for (const kind of Object.keys(zd.floor)) expect(LAYOUT.decals[kind]?.length ?? 0, kind).toBeGreaterThan(0);
      for (const b of zd.bands) for (const kind of Object.keys(b.kinds)) expect(LAYOUT.decals[kind]?.length ?? 0, kind).toBeGreaterThan(0);
    }
  });

  it('el reparto, medido en el mapa: la calle desde la fila 37, el patio y la galería con piso de ladrillo, tejas en los techos', () => {
    // Siempre el mismo y solo en las casillas del autotile.
    expect(townZones(width, height, map.ground, CFG.town!, seed)).toEqual(zones);
    for (let i = 0; i < zones.length; i++) expect(zones[i] !== null, `celda ${i}`).toBe(ground[i] >= 0 && ground[i] <= 15);
    // La calle: el empedrado de la fila 37 al aire libre, y la tierra debajo hasta el fondo.
    expect(at(5, 37)).toBe(TOWN_ZONES.cobble);
    expect(at(500, 37)).toBe(TOWN_ZONES.cobble);
    expect(at(5, 43)).toBe(TOWN_ZONES.earth);
    // El zaguán, bajo el museo: ladrillo.
    expect(at(48, 37)).toBe(TOWN_ZONES.brick);
    // El patio del jagua (fila 35) y la galería (fila 33): pisos elevados de ladrillo, con su zócalo al pie.
    expect(at(90, 35)).toBe(TOWN_ZONES.wallBrick);
    expect(at(370, 33)).toBe(TOWN_ZONES.wallBrick);
    expect(at(90, 36)).toMatch(/^wall/);
    expect(at(90, 37)).toBe(TOWN_ZONES.plinth);
    // Los techos (el del ascenso 1, el del galpón, el campanario) y los pretiles de una casilla: tejas.
    for (const [x, y] of [[105, 23], [240, 23], [310, 2], [82, 34], [196, 34]]) expect(at(x, y), `${x},${y}`).toBe(TOWN_ZONES.wall);
    // El henil, adentro del galpón: ladrillo.
    expect(at(230, 30)).toBe(TOWN_ZONES.wallBrick);
    // Una casa que se apoya en la calle: el zócalo arriba de la fila 37 y el cimiento en la 37.
    expect(at(13, 36)).toMatch(/^wall\.(ochre|blue)$|^wall$/);
    expect(at(13, 37)).toBe(TOWN_ZONES.plinth);
    // Un zócalo por casa: todas las celdas de zócalo de una casa, iguales.
    for (let x = 102; x <= 113; x++) expect(at(x, 36)).toBe(at(102, 36));
  });

  it('cada celda de una zona con casillas propias tiene la suya, y la calle nunca queda con la cal de las casas', () => {
    const missing: string[] = [];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const z = at(x, y);
        if (!z || z === TOWN_ZONES.wall) continue;
        if (!LAYOUT.zones?.[z]?.[String(ground[y * width + x])]?.length) missing.push(`${z} ${ground[y * width + x]} (${x}, ${y})`);
      }
    }
    expect(missing).toEqual([]);
    const v = planTerrainVariants(width, height, map.ground, LAYOUT, CFG, seed, undefined, zoneAt);
    for (let i = 0; i < v.length; i++) {
      const z = zones[i];
      if (z && z !== TOWN_ZONES.wall) expect(LAYOUT.zones![z][String(ground[i])], `celda ${i}`).toContain(v[i]);
    }
    // Las casas llevan variantes de la cal como en los otros biomas (cerca del 80 % del relleno).
    let fills = 0;
    let fillVar = 0;
    for (let i = 0; i < v.length; i++) {
      if (zones[i] !== TOWN_ZONES.wall || ground[i] !== 15) continue;
      fills++;
      if (v[i] >= 0) fillVar++;
    }
    expect(fillVar / fills).toBeGreaterThan(0.7);
    expect(fillVar / fills).toBeLessThan(0.9);
  });

  it('calcomanías: siempre iguales, una por celda, cada una de su zona, solo en casillas del autotile y nunca en la celda de un objeto', () => {
    const a = planTerrainDecals(map, LAYOUT, CFG, seed, zoneAt);
    expect(planTerrainDecals(map, LAYOUT, CFG, seed, zoneAt).decals).toEqual(a.decals);
    const cells = new Set<number>();
    const objects = L4.layers.find((l) => l.name === 'Objects')!.objects!;
    const taken = new Set<number>();
    for (const o of objects) {
      if (o.width && o.height) continue;
      taken.add(Math.floor((o.y - 1) / tilewidth) * width + Math.floor(o.x / tilewidth));
    }
    const allowed = new Map<string, Set<string>>();
    for (const [zone, zd] of Object.entries(CFG.zoneDecals!)) allowed.set(zone, new Set([...Object.keys(zd.floor), ...zd.bands.flatMap((b) => Object.keys(b.kinds))]));
    for (const d of a.decals) {
      const i = d.y * width + d.x;
      expect(cells.has(i)).toBe(false);
      cells.add(i);
      expect(ground[i]).toBeGreaterThanOrEqual(0);
      expect(ground[i]).toBeLessThanOrEqual(15);
      expect(allowed.get(zones[i]!)?.has(d.kind), `${d.kind} en ${zones[i]}`).toBe(true);
      expect(taken.has(i), `${d.kind} en ${d.x}, ${d.y}`).toBe(false);
    }
    expect(a.decals.length).toBeGreaterThan(300);
  });

  it('el volumen: la cal y la tierra se oscurecen hacia adentro en pasos de 3 % o menos, y el relleno lleva la misma casilla que Ground', () => {
    const shade = CFG.depthShade;
    for (let i = 1; i < shade.length; i++) expect(shade[i - 1] - shade[i]).toBeLessThanOrEqual(0.031);
    expect(depthTint(0, shade)).toBe(0xffffff);
    const depth = terrainDepths((x, y) => ground[y * width + x] !== -1, width, height, Math.max(CFG.maxDepth, L4DEF.terrainShell!));
    for (const c of earthCells(depth, width, L4DEF.terrainShell!)) expect(ground[c.y * width + c.x]).not.toBe(-1);
  });
});
