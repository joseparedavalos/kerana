import { describe, expect, it } from 'vitest';
import { GAMEPLAY } from '../src/config/gameplay';
import { ENEMIES } from '../src/data/enemies';
import { divePathClear, findPerch, type SolidAt } from '../src/entities/enemies/diverLogic';
import { findTraps, trapGridFromMap, trapReach } from '../src/systems/trapLogic';

const T = 16;
/** Grilla de prueba: '#' es sólido. `solidAt` en px, como el de LevelScene. */
const solidOf =
  (rows: string[]): SolidAt =>
  (x, y) =>
    rows[Math.floor(y / T)]?.[Math.floor(x / T)] === '#';

// Ñakurutu (12 × 14) parado sobre un poste de 1 × 3 (x 4, filas 5-7); piso en la fila 8.
const POST = ['..........', '..........', '..........', '..........', '..........', '....#.....', '....#.....', '....#.....', '##########'];
const HW = 6;
const HH = 7;
const FEET_X = 4.5 * T;
const FEET_Y = 5 * T;

/** ¿Pica desde el poste hasta Kerana parada en el piso (pies en la fila 8) con el centro en `kx` tiles? */
function clearTo(rows: string[], kx: number, usePerch = true): boolean {
  const solid = solidOf(rows);
  const perch = usePerch ? findPerch(FEET_X, FEET_Y, HW, T, solid) : undefined;
  const dx = kx * T - FEET_X;
  const dy = 8 * T - FEET_Y;
  return divePathClear(FEET_X, FEET_Y - HH, FEET_X + dx, FEET_Y - HH + dy, HW, HH, solid, perch);
}

describe('picada del Diver con el camino libre (S24)', () => {
  it('la percha es la cara de arriba del poste o la rama; en el aire no hay', () => {
    const solid = solidOf(POST);
    expect(findPerch(FEET_X, FEET_Y, HW, T, solid)).toEqual({ x: 4 * T, y: 5 * T, w: T, h: T });
    expect(findPerch(FEET_X, 3 * T, HW, T, solid)).toBeUndefined();
    // Poste de 2 (como el poste alto de l2): parado en la columna derecha, la percha son las dos.
    const wide = POST.map((r, y) => (y >= 5 && y <= 7 ? '...##.....' : r));
    expect(findPerch(FEET_X, FEET_Y, HW, T, solidOf(wide))).toEqual({ x: 3 * T, y: 5 * T, w: 2 * T, h: T });
  });

  it('con el camino libre pica; la salida cruza su percha, no el resto del poste', () => {
    expect(clearTo(POST, 7.5)).toBe(true);
    // A 3 tiles la picada sale cortando la esquina de la percha: sin contarla como percha quedaría tapada.
    expect(clearTo(POST, 1.5)).toBe(true);
    expect(clearTo(POST, 1.5, false)).toBe(false);
    // Cerca del pie del poste (a 1 o 2 tiles), el camino atraviesa el poste: espera a que se aleje.
    expect(clearTo(POST, 2.5)).toBe(false);
    expect(clearTo(POST, 3.5)).toBe(false);
  });

  it('con un muro en el medio espera; sin el muro, pica', () => {
    const wall = POST.map((r, y) => (y >= 4 && y <= 7 ? r.slice(0, 2) + '#' + r.slice(3) : r));
    expect(clearTo(wall, 0.5)).toBe(false);
    expect(clearTo(POST, 0.5)).toBe(true);
  });

  it('un cuerpo grande no pasa un tile que queda entre sus esquinas (se mira todo el borde)', () => {
    // El guasu (≈ 31 × 36) bajando derecho: un tile justo bajo el medio de su borde de abajo.
    const rows = ['........', '........', '........', '........', '...#....', '........'];
    const cx = 3.5 * T;
    expect(divePathClear(cx, 1 * T, cx, 3 * T + 4, 15.5, 18, solidOf(rows))).toBe(false);
    expect(divePathClear(cx, 1 * T, cx, 2 * T, 15.5, 18, solidOf(rows))).toBe(true);
  });
});

type Layer = { name: string; type: string; data?: number[]; objects?: { type: string; x: number; y: number; width: number; height: number; properties?: { name: string; value: unknown }[] }[] };
type TiledMap = { width: number; height: number; tilewidth: number; layers: Layer[] };
const MAPS = import.meta.glob('../public/assets/maps/*.json', { eager: true, import: 'default' }) as Record<string, TiledMap>;

/** Para cada Diver del mapa: lugares donde Kerana puede estar parada dentro de su zona de ataque y cuántos tienen camino libre. */
function diverReach(id: string) {
  const map = MAPS[`../public/assets/maps/${id}.json`];
  const data = (name: string) => map.layers.find((l) => l.name === name)?.data ?? [];
  const has = (d: number[]) => (x: number, y: number) => (d[y * map.width + x] ?? 0) > 0;
  const ground = data('Ground');
  const platforms = data('Platforms');
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
    tile: T,
    ground: has(ground),
    platforms: has(platforms),
    hazards: has(data('Hazards')),
    water: has(data('Water')),
    objects,
    cowReachPx: GAMEPLAY.cow.patrolDistance + 2 * T,
  });
  const p = GAMEPLAY.player;
  const { spans } = findTraps(grid, trapReach({ gravity: GAMEPLAY.gravity, stepHz: 60, tile: T, jumpVelocity: p.jumpVelocity, bounceVelocity: GAMEPLAY.jungle.bounceVelocity, mushroomHeight: GAMEPLAY.jungle.mushroomHeight, bodyHeight: p.bodyHeight }));
  const solid: SolidAt = (x, y) => {
    const i = Math.floor(y / T) * map.width + Math.floor(x / T);
    return x >= 0 && y >= 0 && x < map.width * T && y < map.height * T && ((ground[i] ?? 0) > 0 || (platforms[i] ?? 0) > 0);
  };
  return objects
    .filter((o) => o.cls === 'Enemy' && ENEMIES[String(o.props.kind)]?.archetype === 'diver')
    .map((o) => {
      const def = ENEMIES[String(o.props.kind)];
      const hw = (def.width * (def.scale ?? 1)) / 2;
      const hh = (def.height * (def.scale ?? 1)) / 2;
      const perch = findPerch(o.x, o.y, hw, T, solid);
      let zone = 0;
      let clear = 0;
      for (const sp of spans) {
        for (let cx = sp.x0; cx <= sp.x1; cx++) {
          // Pies de Kerana parada en esa celda, respecto de los del Diver (como en Diver.updateBehavior).
          const dx = (cx + 0.5) * T - o.x;
          const dy = (sp.y + 1) * T - o.y;
          if (dy <= 0 || Math.hypot(dx, dy) > (def.detectRadius ?? 96)) continue;
          zone++;
          if (divePathClear(o.x, o.y - hh, o.x + dx, o.y - hh + dy, hw, hh, solid, perch)) clear++;
        }
      }
      return { id, kind: def.id, x: o.x / T, zone, clear };
    });
}

describe('los Diver de los niveles tienen camino libre hasta donde pasa Kerana (S24)', () => {
  it('cada ñakurutu y karakara llega libre a la mayoría de los lugares de su zona de ataque', () => {
    for (const id of ['l1', 'l2', 'l3', 'l4', 'l5', 'l6', 'l7', 'yvaga']) {
      for (const d of diverReach(id)) expect([d, d.clear * 2 >= d.zone]).toEqual([d, true]);
    }
  });

  it('l2: los cuatro (el guasu, el de la ruta alta, el del poste de C1 y el del poste alto) con camino libre', () => {
    const l2 = diverReach('l2');
    expect(l2.map((d) => d.kind).sort()).toEqual(['nakurutu', 'nakurutu', 'nakurutu', 'nakurutu_guasu']);
    for (const d of l2) expect(d.clear).toBeGreaterThan(0);
  });
});
