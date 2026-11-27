import { describe, expect, it } from 'vitest';
import { GAMEPLAY } from '../src/config/gameplay';
import { LEVELS } from '../src/data/levels';
import type { LevelDef } from '../src/data/types';
import { caveColumns, shellPaint, type ShellPaint } from '../src/systems/terrainLogic';
import { readPng } from '../tools/lib/tileset-check.mjs';

// S120: la roca maciza se pinta opaca. Ninguna casilla sólida de Ground, en ningún nivel, puede quedar semitransparente
// o sin dibujar sin el fondo de tierra debajo: se vería el fondo del nivel a través de la roca. Pasaba en las cuevas de
// l1 (la fila tenue de la repisa al 55 % y lo de adentro sin dibujar, sobre la imagen de la cueva: bloques claros con
// forma de escalón). La cuenta es `shellPaint`, la misma que usa LevelScene. Y el arte de la roca maciza (la casilla 15
// y sus variantes, también las del fondo de tierra) es opaco en todos sus píxeles.
const MAPS = import.meta.glob('../public/assets/maps/*.json', { eager: true, import: 'default' }) as Record<string, any>;
/** Las hojas de detalle por nombre (`cerro`, `estero`…): qué casillas son variantes del relleno. */
const MAPS_DETAIL = Object.fromEntries(
  Object.entries(import.meta.glob('../public/assets/tiles/detalle/*.json', { eager: true, import: 'default' }) as Record<string, any>).map(
    ([f, v]) => [f.replace(/^.*\/(\w+)\.json$/, '$1'), v],
  ),
) as Record<string, any>;
const T = 16;
const FILL = 15;
const BREAKABLE = 22;

function mapOf(key: string): any {
  const file = Object.keys(MAPS).find((f) => f.endsWith(`/${key.replace(/^map_/, '')}.json`));
  return file ? MAPS[file] : undefined;
}

interface Grid {
  width: number;
  height: number;
  /** Casilla del tileset (0 a 27) o -1. */
  ground: (x: number, y: number) => number;
  caves: Uint8Array;
}

function gridOf(map: any): Grid {
  const { width, height, tilewidth } = map;
  const data: number[] = map.layers.find((l: any) => l.name === 'Ground').data;
  const firstgid: number = map.tilesets[0].firstgid;
  const objects = map.layers.filter((l: any) => l.type === 'objectgroup').flatMap((l: any) => l.objects);
  const caves = caveColumns(
    objects.filter((o: any) => (o.type || o.class) === 'Cave').map((o: any) => ({ x: o.x, width: o.width ?? tilewidth })),
    width,
    tilewidth,
  );
  return { width, height, ground: (x, y) => (data[y * width + x] === 0 ? -1 : data[y * width + x] - firstgid), caves };
}

/** Lo que pinta LevelScene en el nivel. Sin repisa, Ground va entero. */
function paintOf(level: LevelDef, g: Grid): ShellPaint {
  const solid = (x: number, y: number) => g.ground(x, y) !== -1;
  if (!level.terrainShell) {
    const alpha = new Float32Array(g.width * g.height);
    for (let y = 0; y < g.height; y++) for (let x = 0; x < g.width; x++) if (solid(x, y)) alpha[y * g.width + x] = 1;
    const none = new Uint8Array(g.width * g.height);
    return { depth: none, alpha, earth: none, caveDeep: none };
  }
  return shellPaint(solid, g.width, g.height, level.terrainShell, GAMEPLAY.backdrop.terrainFadeAlpha, {
    keepFloor: level.solidFloor !== false,
    earth: level.earthBackdrop === true,
    caves: g.caves,
  });
}

/** Casillas sólidas por las que se ve el fondo: tenues o sin dibujar, y sin el fondo de tierra debajo. */
function seeThrough(g: Grid, paint: ShellPaint): { x: number; y: number; alpha: number }[] {
  const out: { x: number; y: number; alpha: number }[] = [];
  for (let y = 0; y < g.height; y++)
    for (let x = 0; x < g.width; x++) {
      const i = y * g.width + x;
      if (g.ground(x, y) !== -1 && paint.alpha[i] < 1 && paint.earth[i] !== 1) out.push({ x, y, alpha: paint.alpha[i] });
    }
  return out;
}

/** Agrupa las celdas en tramos de columnas seguidas, para un mensaje legible. */
function runsOf(cells: { x: number; y: number }[]): string {
  const cols = new Map<number, number[]>();
  for (const c of cells) cols.set(c.x, [...(cols.get(c.x) ?? []), c.y]);
  const runs: string[] = [];
  let run: { x0: number; x1: number; y0: number; y1: number } | null = null;
  for (const x of [...cols.keys()].sort((a, b) => a - b)) {
    const ys = cols.get(x)!;
    const y0 = Math.min(...ys);
    const y1 = Math.max(...ys);
    if (run && x === run.x1 + 1) Object.assign(run, { x1: x, y0: Math.min(run.y0, y0), y1: Math.max(run.y1, y1) });
    else {
      if (run) runs.push(`x ${run.x0}-${run.x1}, filas ${run.y0}-${run.y1}`);
      run = { x0: x, x1: x, y0, y1 };
    }
  }
  if (run) runs.push(`x ${run.x0}-${run.x1}, filas ${run.y0}-${run.y1}`);
  return runs.join('; ');
}

const levels = Object.values(LEVELS).filter((l): l is LevelDef => !!l && !!mapOf(l.mapKey));

describe('roca maciza opaca: ninguna casilla sólida se pinta con transparencia ni deja ver el fondo (S120)', () => {
  it('hay mapas para revisar', () => expect(levels.length).toBeGreaterThanOrEqual(9));

  for (const l of levels) {
    it(`${l.id}: toda casilla sólida va entera o con el fondo de tierra debajo`, () => {
      const g = gridOf(mapOf(l.mapKey));
      const cells = seeThrough(g, paintOf(l, g));
      const faint = cells.filter((c) => c.alpha > 0).length;
      expect(
        cells.length,
        `${l.id}: ${cells.length} casillas sólidas dejan ver el fondo (${faint} semitransparentes y ${cells.length - faint} sin ` +
          `dibujar) en ${runsOf(cells)}. La roca maciza va opaca: tierra debajo (earthBackdrop) o la casilla entera.`,
      ).toBe(0);
    });
  }

  const l1 = LEVELS.l1!;
  const g1 = gridOf(mapOf(l1.mapKey));
  const p1 = paintOf(l1, g1);

  it('l1: los dos casos del informe van enteros (x 229-231, filas 13-17, y el techo de la entrada, x 232-251, filas 0-7)', () => {
    for (const [x0, x1, y0, y1] of [
      [229, 231, 13, 17],
      [232, 251, 0, 7],
    ]) {
      for (let y = y0; y <= y1; y++)
        for (let x = x0; x <= x1; x++) {
          if (g1.ground(x, y) === -1) continue;
          expect(p1.alpha[y * g1.width + x], `l1 (${x}, ${y})`).toBe(1);
        }
    }
  });

  it('l1: en las columnas de cueva toda la roca va entera y sin fondo de tierra (detrás está la imagen de la cueva)', () => {
    let rock = 0;
    let deep = 0;
    for (let y = 0; y < g1.height; y++)
      for (let x = 0; x < g1.width; x++) {
        const i = y * g1.width + x;
        if (g1.caves[x] !== 1 || g1.ground(x, y) === -1) continue;
        rock++;
        deep += p1.caveDeep[i];
        expect(p1.alpha[i]).toBe(1);
        expect(p1.earth[i]).toBe(0);
      }
    // La roca honda de las cuevas (la que antes no se veía entera) existe y se marca para dejarla sin calcomanías.
    expect(rock).toBeGreaterThan(3000);
    expect(deep).toBeGreaterThan(1000);
    expect(deep).toBeLessThan(rock);
  });

  it('l1: fuera de las cuevas la repisa y el fondo de tierra siguen como antes', () => {
    let earth = 0;
    let faint = 0;
    for (let y = 0; y < g1.height; y++)
      for (let x = 0; x < g1.width; x++) {
        const i = y * g1.width + x;
        if (g1.caves[x] === 1 || g1.ground(x, y) === -1) continue;
        earth += p1.earth[i];
        if (p1.alpha[i] > 0 && p1.alpha[i] < 1) faint++;
        expect(p1.caveDeep[i]).toBe(0);
      }
    expect(earth).toBeGreaterThan(2000);
    expect(faint).toBeGreaterThan(0);
  });

  it('el test detecta la roca transparente: con la cuenta de antes de S120, l1 deja ver la cueva y nombra las casillas', () => {
    // Antes: la repisa también en las columnas de cueva, y ahí sin fondo de tierra (S87).
    const solid = (x: number, y: number) => g1.ground(x, y) !== -1;
    const old = shellPaint(solid, g1.width, g1.height, l1.terrainShell!, GAMEPLAY.backdrop.terrainFadeAlpha, {
      keepFloor: l1.solidFloor !== false,
      earth: true,
    });
    for (let i = 0; i < old.earth.length; i++) if (g1.caves[i % g1.width] === 1) old.earth[i] = 0;
    const cells = seeThrough(g1, old);
    expect(cells.length).toBeGreaterThan(1000);
    expect(cells.every((c) => g1.caves[c.x] === 1)).toBe(true);
    expect(cells.some((c) => c.alpha > 0)).toBe(true);
    expect(cells.some((c) => c.x === 229 && c.y === 13)).toBe(true);
    expect(runsOf(cells)).toMatch(/^x 0-44, filas \d+-\d+; x 229-353, filas \d+-\d+$/);
  });
});

describe('el arte de la roca maciza es opaco (S120)', () => {
  type Img = { width: number; height: number; data: Uint8Array };
  /** Píxeles con alfa por debajo de 255 en la casilla `i` de una hoja de `cols` columnas. */
  const clear = (img: Img, i: number, cols: number): number => {
    let n = 0;
    const x0 = (i % cols) * T;
    const y0 = Math.floor(i / cols) * T;
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) if (img.data[((y0 + y) * img.width + x0 + x) * 4 + 3] < 255) n++;
    return n;
  };

  it('el fondo de tierra usa la casilla de relleno', () => expect(GAMEPLAY.backdrop.earth.fillTile).toBe(FILL));

  for (const l of levels) {
    it(`${l.id}: la roca rodeada de roca usa la casilla 15 (sin contar la que está junto a la roca que se rompe)`, () => {
      const g = gridOf(mapOf(l.mapKey));
      const at = (x: number, y: number) => (x < 0 || y < 0 || x >= g.width || y >= g.height ? FILL : g.ground(x, y));
      const wrong: { x: number; y: number; tile: number }[] = [];
      for (let y = 0; y < g.height; y++)
        for (let x = 0; x < g.width; x++) {
          const t = g.ground(x, y);
          if (t === -1 || t === BREAKABLE) continue;
          let mass = true;
          // La roca que se rompe tiene su borde propio en el autotile (docs/PENDIENTES.md, la línea de fondo al pie).
          for (let dy = -1; dy <= 1 && mass; dy++)
            for (let dx = -1; dx <= 1 && mass; dx++) {
              const n = at(x + dx, y + dy);
              if (n === -1 || n === BREAKABLE) mass = false;
            }
          if (mass && t !== FILL) wrong.push({ x, y, tile: t });
        }
      expect(wrong, `${l.id}: roca maciza con una casilla de borde (${JSON.stringify(wrong.slice(0, 5))})`).toEqual([]);
    });
  }

  const biomes = [...new Set(levels.map((l) => l.biome))];
  for (const biome of biomes) {
    it(`${biome}: la casilla 15 del tileset y todas sus variantes de la hoja de detalle son opacas`, () => {
      const tileset = readPng(`public/assets/tiles/${biome}.png`) as Img;
      expect(clear(tileset, FILL, tileset.width / T), `${biome}: casilla 15`).toBe(0);
      const sheet = levels.find((l) => l.biome === biome && l.terrainDetail)?.terrainDetail?.sheet;
      if (!sheet) return;
      const layout = MAPS_DETAIL[sheet];
      expect(layout, `falta public/assets/tiles/detalle/${sheet}.json`).toBeDefined();
      const ids = new Set<number>([
        ...layout.fill,
        ...Object.values((layout.zones ?? {}) as Record<string, Record<string, number[]>>).flatMap((z) => z[String(FILL)] ?? []),
        ...((layout.submerged?.[String(FILL)] ?? []) as number[]),
      ]);
      expect(ids.size).toBeGreaterThan(0);
      const img = readPng(`public/assets/tiles/detalle/${sheet}.png`) as Img;
      const holey = [...ids].filter((id) => clear(img, id, layout.columns) > 0);
      expect(holey, `${sheet}: variantes del relleno con píxeles transparentes`).toEqual([]);
    });
  }
});
