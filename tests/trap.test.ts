import { describe, expect, it } from 'vitest';
import { buildTiledMap, parseAscii } from '../tools/lib/ascii-map.mjs';
import { GAMEPLAY } from '../src/config/gameplay';
import { findTraps, risePx, trapGridFromMap, trapReach, TrapWatch, type TrapReach, type TrapSpan } from '../src/systems/trapLogic';

type Layer = { name: string; type: string; data?: number[]; objects?: TiledObj[] };
type TiledObj = { type: string; x: number; y: number; width: number; height: number; properties?: { name: string; value: unknown }[] };
type TiledMap = { width: number; height: number; tilewidth: number; layers: Layer[] };

const T = 16;
/** Paso fijo de Arcade (`World.fps`: 60 por defecto, main.ts no lo cambia). */
const STEP_HZ = 60;
const g = GAMEPLAY.gravity;
const p = GAMEPLAY.player;
const PHYSICS = {
  gravity: g,
  stepHz: STEP_HZ,
  tile: T,
  jumpVelocity: p.jumpVelocity,
  bounceVelocity: GAMEPLAY.jungle.bounceVelocity,
  mushroomHeight: GAMEPLAY.jungle.mushroomHeight,
  bodyHeight: p.bodyHeight,
};
/** Alcance de Kerana sin salto doble (l1 a l3) y con él (desde l4), como lo calcula LevelScene. */
const BASE: TrapReach = trapReach(PHYSICS);
const DOUBLE: TrapReach = trapReach({ ...PHYSICS, doubleJumpVelocity: p.doubleJumpVelocity });

type Obj = { cls: string; x: number; y: number; width: number; height: number; props: Record<string, unknown> };

function analyze(map: TiledMap, reach = BASE, keep: (o: Obj) => boolean = () => true) {
  const layer = (name: string) => {
    const data = map.layers.find((l) => l.name === name)?.data ?? [];
    return (x: number, y: number) => (data[y * map.width + x] ?? 0) > 0;
  };
  const objects = (map.layers.find((l) => l.type === 'objectgroup')?.objects ?? [])
    .map((o) => ({
      cls: o.type,
      x: o.x,
      y: o.y,
      width: o.width,
      height: o.height,
      props: Object.fromEntries((o.properties ?? []).map((q) => [q.name, q.value])),
    }))
    .filter(keep);
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
const fromLevel = (id: string, reach = BASE, keep?: (o: Obj) => boolean) => analyze(MAPS[`../public/assets/maps/${id}.json`], reach, keep);
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

describe('red de seguridad: alcance con la física del juego (S24)', () => {
  it('3 filas de salto, 6 con salto doble, 8 con el hongo, 11 con hongo y salto doble, 3 de cuerpo', () => {
    expect([BASE.jumpRows, DOUBLE.jumpRows, BASE.bounceRows, DOUBLE.bounceRows, BASE.bodyRows]).toEqual([3, 6, 8, 11, 3]);
    // Lo medido en el juego a 60 Hz, avanzando cuadro a cuadro (S24): 63,33 px y 108,67 px.
    expect(risePx([p.jumpVelocity], g, STEP_HZ)).toBeCloseTo(63.33, 1);
    expect(risePx([p.jumpVelocity, p.doubleJumpVelocity], g, STEP_HZ)).toBeCloseTo(108.67, 1);
  });

  it('el modelo nunca pasa de lo que deja la física: simulación aparte, paso a paso como Arcade', () => {
    // Arcade (World.computeVelocity y Body.update): primero la velocidad, después la posición, a paso fijo.
    const apex = (v0: number) => {
      let y = 0;
      let top = 0;
      for (let v = v0; v <= 0; ) {
        v += g / STEP_HZ;
        y += v / STEP_HZ;
        top = Math.min(top, y);
      }
      return -top;
    };
    const jump = apex(p.jumpVelocity);
    const double = jump + apex(p.doubleJumpVelocity);
    for (const [rows, px] of [
      [BASE.jumpRows, jump],
      [DOUBLE.jumpRows, double],
    ]) {
      expect(rows * T).toBeLessThanOrEqual(px);
      expect((rows + 1) * T).toBeGreaterThan(px);
    }
    // La fórmula continua de S23 (v²/2g) daba una fila de más: justo la de las paredes de 4 (y 7) que no se trepan.
    expect(Math.floor(p.jumpVelocity ** 2 / (2 * g) / T)).toBe(4);
  });
});

describe('red de seguridad: encierros (S23, alcances de S24)', () => {
  it('un pozo de 4 filas encierra (el salto sube 63,3 px y la pared pide 64); uno de 3 se sale saltando', () => {
    expect(show(fromAscii(pocket(4)))).toEqual(['x 10-15 fila 13']);
    expect(show(fromAscii(pocket(5)))).toEqual(['x 10-15 fila 13']);
    expect(fromAscii(pocket(3))).toEqual([]);
  });

  it('con salto doble, uno de 6 no encierra; uno de 7 sí (108,7 px contra 112: el hueco de l2 con gifts=all)', () => {
    expect(fromAscii(pocket(6), DOUBLE)).toEqual([]);
    expect(show(fromAscii(pocket(7), DOUBLE))).toEqual(['x 10-15 fila 13']);
    // Con el alcance de S23 (7 filas) no se veía.
    expect(fromAscii(pocket(7), { ...DOUBLE, jumpRows: 7 })).toEqual([]);
  });

  it('se sale si adentro hay un hongo, pencas, una plataforma móvil, o si una pared es rompible', () => {
    expect(fromAscii(pocket(7, ['M,12,12']))).toEqual([]);
    // Pencas cada 3 filas (con 4, la primera ya no se alcanza).
    expect(fromAscii(pocket(7, ['=,12,10', '=,11,7']))).toEqual([]);
    expect(show(fromAscii(pocket(7, ['=,12,9'])))).toEqual(['x 10-15 fila 13']);
    expect(fromAscii(pocket(7, ['-,12,12', ':,12,11', ':,12,10', ':,12,9', ':,12,8', ':,12,7', ':,12,6']))).toEqual([]);
    // Roca agrietada en las 4 filas de arriba de la pared izquierda y en la esquina de la meseta: rotas, quedan
    // dos escalones de 3. Sin la esquina, el segundo escalón mide 4 y no se sube.
    expect(fromAscii(pocket(7, ['B,9,6', 'B,9,7', 'B,9,8', 'B,9,9', 'B,8,6']))).toEqual([]);
    expect(fromAscii(pocket(7, ['B,9,6', 'B,9,7', 'B,9,8', 'B,9,9']))).not.toEqual([]);
  });

  it('agua honda o espinas adentro ya devuelven a tierra firme: no es encierro', () => {
    expect(fromAscii(pocket(7, ['~,12,13']))).toEqual([]);
    expect(fromAscii(pocket(7, ['^,12,12']))).toEqual([]);
  });

  it('el piso alto desde el que se cae al pozo no queda marcado', () => {
    // Solo el fondo: la meseta llega al agua.
    expect(show(fromAscii(pocket(7)))).toEqual(['x 10-15 fila 13']);
  });

  it('l2: el hueco del premio es un encierro, también con salto doble (con el alcance de S23 no se veía)', () => {
    expect(show(fromLevel('l2'))).toEqual(['x 234-238 fila 33']);
    expect(show(fromLevel('l2', DOUBLE))).toEqual(['x 234-238 fila 33']);
    expect(fromLevel('l2', { ...DOUBLE, jumpRows: 7 })).toEqual([]);
  });

  it('ningún otro nivel tiene encierros con los dones que se traen', () => {
    // El salto doble se gana al final de l3: l1 y l3 sin él, l4 en adelante con él.
    for (const id of ['l1', 'l3']) expect([id, show(fromLevel(id))]).toEqual([id, []]);
    for (const id of ['l4', 'l5', 'l6', 'l7', 'yvaga']) expect([id, show(fromLevel(id, DOUBLE))]).toEqual([id, []]);
  });

  it('la vitrina tiene un encierro a propósito: el pozo F, pared de 7 con salto doble (lo usa el smoke)', () => {
    expect(show(fromLevel('vitrina', DOUBLE))).toEqual(['x 87-89 fila 27']);
    expect(fromLevel('vitrina', { ...DOUBLE, jumpRows: 7 })).toEqual([]);
  });
});

describe('reloj de la red (S24): moverse, saltar o atacar adentro no lo reinicia', () => {
  const WAIT = GAMEPLAY.trap.waitMs;
  const DT = 1000 / 60;
  /** Corre `ms` de juego; `standing(f)` dice si pisa suelo en el cuadro f. Devuelve el ms en que la red actuó. */
  const run = (watch: TrapWatch, ms: number, standing: (f: number) => boolean, trapped = true): number | null => {
    for (let f = 0, t = DT; t <= ms; f++, t += DT) if (watch.step(DT, standing(f), trapped, WAIT)) return t;
    return null;
  };

  it('quieta, caminando o atacando (pisa siempre el piso encerrado): actúa a los waitMs', () => {
    expect(run(new TrapWatch(), WAIT + 500, () => true)).toBeCloseTo(WAIT, -2);
  });

  it('saltando sin parar: el tiempo en el aire cuenta', () => {
    // Pisa un cuadro de cada 41 (un salto completo dura ≈ 0,67 s), o casi nunca (salto doble y caídas).
    expect(run(new TrapWatch(), WAIT + 500, (f) => f % 41 === 0)).toBeCloseTo(WAIT, -2);
    expect(run(new TrapWatch(), WAIT + 500, (f) => f % 90 === 0)).toBeCloseTo(WAIT, -2);
  });

  it('pisar un piso libre lo corta; estar en el aire sin haber pisado el encierro no lo arranca', () => {
    const w = new TrapWatch();
    run(w, WAIT / 2, () => true);
    expect(w.active).toBe(true);
    expect(w.step(DT, true, false, WAIT)).toBe(false);
    expect([w.active, w.elapsedMs]).toEqual([false, 0]);
    expect(run(w, WAIT * 2, () => false)).toBeNull();
  });

  it('después de actuar vuelve a cero y espera a que pise otra vez el encierro', () => {
    const w = new TrapWatch();
    expect(run(w, WAIT + 100, () => true)).not.toBeNull();
    expect([w.active, w.elapsedMs]).toEqual([false, 0]);
    expect(run(w, WAIT * 2, () => false)).toBeNull();
  });
});
