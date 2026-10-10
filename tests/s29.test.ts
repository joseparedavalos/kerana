import { describe, expect, it } from 'vitest';
import { GAMEPLAY } from '../src/config/gameplay';
import { LEVELS } from '../src/data/levels';
import { averageColor } from '../src/systems/backdropLogic';
import { cowPatrol } from '../src/systems/cowLogic';
import { isFloorTile, terrainAlpha, terrainDepths, terrainFloor } from '../src/systems/terrainLogic';

// S29: el piso del nivel entero hasta abajo, el relleno del fondo y la vaca que deja la vaca embrujada.

const T = 16;
type Obj = { type: string; x: number; y: number; width: number; height: number; properties?: { name: string; value: unknown }[] };
type TiledMap = { width: number; height: number; layers: { name: string; type: string; data?: number[]; objects?: Obj[] }[] };
const MAPS = import.meta.glob('../public/assets/maps/*.json', { eager: true, import: 'default' }) as Record<string, TiledMap>;
const mapOf = (id: string) => MAPS[`../public/assets/maps/${id}.json`];

const grid = (rows: string[]) => (x: number, y: number) => rows[y]?.[x] === '#';

describe('piso del nivel (S29)', () => {
  it('la línea del piso es la fila más común donde empieza el tramo que llega abajo; los pozos no cuentan', () => {
    const rows = ['......', '.#....', '.#....', '##.###', '##.###', '##.###'];
    const f = terrainFloor(grid(rows), 6, rows.length);
    expect(Array.from(f.runTop)).toEqual([3, 1, 6, 3, 3, 3]);
    expect(f.line).toBe(3);
    // La columna alta (una casa sobre el piso) solo se rellena desde la línea; el pozo, nada.
    expect([isFloorTile(f, 1, 1), isFloorTile(f, 1, 3), isFloorTile(f, 2, 5), isFloorTile(f, 0, 5)]).toEqual([false, true, false, true]);
  });

  it('empate: la fila más honda', () => {
    const rows = ['....', '##..', '####'];
    expect(terrainFloor(grid(rows), 4, 3).line).toBe(2);
  });

  it('l2, l3 y l4: la línea es la calle o el suelo base y todo el piso se dibuja hasta el borde de abajo', () => {
    for (const [id, line] of [['l2', 33], ['l3', 33], ['l4', 37]] as const) {
      const map = mapOf(id);
      const ground = map.layers.find((l) => l.name === 'Ground')!.data!;
      const solid = (x: number, y: number) => x >= 0 && y >= 0 && x < map.width && y < map.height && ground[y * map.width + x] > 0;
      const f = terrainFloor(solid, map.width, map.height);
      expect(f.line, id).toBe(line);
      let floorCols = 0;
      for (let x = 0; x < map.width; x++) if (f.runTop[x] <= line) floorCols += isFloorTile(f, x, map.height - 1) ? 1 : 0;
      expect(floorCols, id).toBeGreaterThan(map.width / 3);
    }
  });
});

describe('relleno del fondo (S29)', () => {
  it('color medio de una fila RGBA', () => {
    expect(averageColor([255, 0, 0, 255, 0, 0, 255, 255])).toBe(0x800080);
    expect(averageColor([])).toBe(0);
  });
});

describe('la vaca de la vaca embrujada no camina en el aire (S29)', () => {
  const half = GAMEPLAY.cow.width / 2;
  const D = GAMEPLAY.cow.patrolDistance;
  // La terraza de l4: piso de x 197 a x 206 (los pretiles en 196 y 207 son pared); con el fardo (x 204), de 197 a 203.
  const terrace = (col: number) => col >= 197 && col <= 206;
  const withBale = (col: number) => col >= 197 && col <= 203;
  const inside = (p: { x: number; patrol: number }, l: number, r: number) => p.x - p.patrol - half >= l * T && p.x + p.patrol + half <= (r + 1) * T;

  it('purificada junto al pretil: el centro se corre lo justo y todo el recorrido queda en la terraza', () => {
    const p = cowPatrol(198 * T, half, D, T, terrace);
    expect(p.patrol).toBe(D);
    expect(p.x - D - half).toBe(197 * T);
    expect(inside(p, 197, 206)).toBe(true);
  });

  it('con el fardo en pie el tramo es más corto que la patrulla: al medio y con la patrulla que entra', () => {
    for (const x of [198, 201.5, 203.5]) {
      const p = cowPatrol(x * T, half, D, T, withBale);
      expect(p.patrol).toBeLessThan(D);
      expect(inside(p, 197, 203)).toBe(true);
    }
  });

  it('en el medio de un piso largo no cambia; sin piso debajo, tampoco', () => {
    expect(cowPatrol(201.5 * T, half, D, T, terrace)).toEqual({ x: 201.5 * T, patrol: D });
    expect(cowPatrol(150 * T, half, D, T, terrace)).toEqual({ x: 150 * T, patrol: D });
  });
});

describe('nada flota con el terreno como repisa (S29)', () => {
  it('en l2, l3, l4 y l5 (S30) todo lo que está apoyado en el suelo pisa un tile que se dibuja', () => {
    const shelled = Object.values(LEVELS).filter((d) => d !== undefined && d.terrainShell !== undefined);
    expect(shelled.map((d) => d!.id)).toEqual(['l2', 'l3', 'l4', 'l5']);
    for (const def of shelled.map((d) => d!)) {
      const map = mapOf(def.mapKey.replace(/^map_/, ''));
      expect(map, def.id).toBeDefined();
      const shell = def.terrainShell!;
      const ground = map.layers.find((l) => l.name === 'Ground')!.data!;
      const solid = (x: number, y: number) => x >= 0 && y >= 0 && x < map.width && y < map.height && ground[y * map.width + x] > 0;
      const depth = terrainDepths(solid, map.width, map.height, shell);
      const floor = terrainFloor(solid, map.width, map.height);
      const drawn = (x: number, y: number) =>
        isFloorTile(floor, x, y) || terrainAlpha(depth[y * map.width + x], shell, GAMEPLAY.backdrop.terrainFadeAlpha) > 0;
      const objects = map.layers.find((l) => l.type === 'objectgroup')?.objects ?? [];
      const floating: string[] = [];
      for (const o of objects) {
        // El tile bajo los pies (los objetos de Tiled se anclan abajo): si es sólido, tiene que verse.
        const x = Math.floor((o.x + (o.width || 0) / 2) / T);
        const y = Math.floor(o.y / T);
        if (solid(x, y) && !drawn(x, y)) floating.push(`${def.id} ${o.type} x ${x} fila ${y}`);
      }
      expect(floating).toEqual([]);
    }
  });
});
