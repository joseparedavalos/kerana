import { describe, expect, it } from 'vitest';
import { buildTiledMap, parseAscii } from '../tools/lib/ascii-map.mjs';
import { GAMEPLAY } from '../src/config/gameplay';
import { findTraps, riseRows, trapGridFromMap, type TrapReach, type TrapSpan } from '../src/systems/trapLogic';

type Layer = { name: string; type: string; data?: number[]; objects?: TiledObj[] };
type TiledObj = { type: string; x: number; y: number; width: number; height: number; properties?: { name: string; value: unknown }[] };
type TiledMap = { width: number; height: number; tilewidth: number; layers: Layer[] };

const T = 16;
const g = GAMEPLAY.gravity;
const p = GAMEPLAY.player;
/** Alcance de Kerana sin salto doble (l2) y con él (desde l3), como lo calcula LevelScene. */
const BASE: TrapReach = {
  jumpRows: riseRows([p.jumpVelocity], g, T, 'floor'),
  bounceRows: riseRows([GAMEPLAY.jungle.bounceVelocity], g, T, 'ceil'),
  bodyRows: Math.ceil(p.bodyHeight / T),
};
const DOUBLE: TrapReach = {
  ...BASE,
  jumpRows: riseRows([p.jumpVelocity, p.doubleJumpVelocity], g, T, 'floor'),
  bounceRows: riseRows([GAMEPLAY.jungle.bounceVelocity, p.doubleJumpVelocity], g, T, 'ceil'),
};

function analyze(map: TiledMap, reach = BASE) {
  const layer = (name: string) => {
    const data = map.layers.find((l) => l.name === name)?.data ?? [];
    return (x: number, y: number) => (data[y * map.width + x] ?? 0) > 0;
  };
  const objects = (map.layers.find((l) => l.type === 'objectgroup')?.objects ?? []).map((o) => ({
    cls: o.type,
    x: o.x,
    y: o.y,
    width: o.width,
    height: o.height,
    props: Object.fromEntries((o.properties ?? []).map((q) => [q.name, q.value])),
  }));
  const grid = trapGridFromMap({
    width: map.width,
    height: map.height,
    tile: map.tilewidth,
    ground: layer('Ground'),
    platforms: layer('Platforms'),
    hazards: layer('Hazards'),
    water: layer('Water'),
    objects,
    cowReachPx: GAMEPLAY.cow.patrolDistance + 2 * T,
  });
  const r = findTraps(grid, reach);
  return r.trappedSpans.map((n) => r.spans[n]);
}

const fromAscii = (rows: string[], reach = BASE) =>
  analyze(buildTiledMap(parseAscii(`size ${rows[0].length}x${rows.length}\nbiome estero\n---\n${rows.join('\n')}\n`)) as TiledMap, reach);
// Los mapas que carga el juego (el JSON generado por `npm run maps`, o el editado en Tiled).
const MAPS = import.meta.glob('../public/assets/maps/*.json', { eager: true, import: 'default' }) as Record<string, TiledMap>;
const fromLevel = (id: string, reach = BASE) => analyze(MAPS[`../public/assets/maps/${id}.json`], reach);
const show = (spans: TrapSpan[]) => spans.map((s) => `x ${s.x0}-${s.x1} fila ${s.y + 1}`);

// Un pozo de 6 de ancho cuyas paredes miden `wall` filas, con agua a la derecha (la salida del nivel).
function pocket(wall: number, inside: string[] = []): string[] {
  const rows: string[] = [];
  for (let y = 0; y < 14; y++) rows.push('#' + '.'.repeat(30) + '#');
  const floor = 12;
  const set = (x: number, y: number, c: string) => (rows[y] = rows[y].slice(0, x) + c + rows[y].slice(x + 1));
  for (let x = 0; x < 32; x++) set(x, 13, '#');
  // Meseta en la fila floor - wall + 1 salvo el pozo (x 10-15); agua al final.
  for (let x = 1; x < 31; x++) for (let y = floor - wall + 1; y <= floor; y++) if (x < 10 || x > 15) set(x, y, '#');
  for (let x = 26; x < 31; x++) set(x, floor - wall + 1, '~');
  set(3, floor - wall, 'P');
  for (const line of inside) {
    const [c, x, y] = line.split(',');
    set(Number(x), Number(y), c);
  }
  return rows;
}

describe('red de seguridad: encierros (S23)', () => {
  it('alcances: 4 filas de salto, 7 con salto doble, 8 con el hongo y 3 de cuerpo', () => {
    expect([BASE.jumpRows, DOUBLE.jumpRows, BASE.bounceRows, BASE.bodyRows]).toEqual([4, 7, 8, 3]);
  });

  it('un pozo de 5 filas encierra; uno de 4 se sale saltando', () => {
    expect(show(fromAscii(pocket(5)))).toEqual(['x 10-15 fila 13']);
    expect(fromAscii(pocket(4))).toEqual([]);
  });

  it('con salto doble, el mismo pozo de 5 (y uno de 7) no encierra; uno de 8 sí', () => {
    expect(fromAscii(pocket(5), DOUBLE)).toEqual([]);
    expect(fromAscii(pocket(7), DOUBLE)).toEqual([]);
    expect(show(fromAscii(pocket(8), DOUBLE))).toEqual(['x 10-15 fila 13']);
  });

  it('se sale si adentro hay un hongo, una penca o una plataforma móvil, o si una pared es rompible', () => {
    expect(fromAscii(pocket(7, ['M,12,12']))).toEqual([]);
    expect(fromAscii(pocket(7, ['=,12,9']))).toEqual([]);
    expect(fromAscii(pocket(7, ['-,12,12', ':,12,11', ':,12,10', ':,12,9', ':,12,8', ':,12,7', ':,12,6']))).toEqual([]);
    // Las 3 filas de arriba de la pared izquierda son roca agrietada: rota, quedan 4.
    expect(fromAscii(pocket(7, ['B,9,6', 'B,9,7', 'B,9,8']))).toEqual([]);
  });

  it('agua honda o espinas adentro ya devuelven a tierra firme: no es encierro', () => {
    expect(fromAscii(pocket(7, ['~,12,13']))).toEqual([]);
    expect(fromAscii(pocket(7, ['^,12,12']))).toEqual([]);
  });

  it('el piso alto desde el que se cae al pozo no queda marcado', () => {
    // Solo el fondo: la meseta llega al agua.
    expect(show(fromAscii(pocket(7)))).toEqual(['x 10-15 fila 13']);
  });

  it('l2 sin salto doble: el único encierro es el hueco del premio, al pie del ascenso 2', () => {
    expect(show(fromLevel('l2'))).toEqual(['x 234-238 fila 33']);
    // Con el salto doble (rejugar), ninguno.
    expect(fromLevel('l2', DOUBLE)).toEqual([]);
  });

  it('ningún otro nivel tiene encierros con los dones que se traen', () => {
    // El salto doble se gana al final de l3: l1 y l3 sin él, l4 en adelante con él.
    for (const id of ['l1', 'l3']) expect([id, show(fromLevel(id))]).toEqual([id, []]);
    for (const id of ['l4', 'l5', 'l6', 'l7', 'yvaga']) expect([id, show(fromLevel(id, DOUBLE))]).toEqual([id, []]);
  });
});
