import { describe, expect, it } from 'vitest';
import { parseAscii } from '../tools/lib/ascii-map.mjs';
import { GAMEPLAY } from '../src/config/gameplay';
import { ENEMIES } from '../src/data/enemies';
import { guardFrame, GuardMotor, strikeZone } from '../src/entities/enemies/GuardMotor';
import l6Text from '../tools/levels/l6.txt?raw';
import sheet from '../raw/jaguaru/sprite.json';

// Jaguarú (S77): el Señor de las cavernas. Quieto, con su propio reloj: ojos cerrados → los abre → dentellada → los cierra.
const J = GAMEPLAY.jaguaru;
const motor = (startMs = 0) =>
  new GuardMotor({ detectRadius: 0, detectHeight: 0, telegraphMs: J.telegraphMs, activeMs: J.activeMs, recoverMs: J.recoverMs, restMs: J.restMs, startMs });

describe('Jaguarú: el guardián del tiempo', () => {
  it('es un guardián con reloj, no humano, que no camina', () => {
    const def = ENEMIES.jaguaru;
    expect(def.archetype).toBe('guard');
    expect(def.clock).toBe(true);
    expect(def.human).toBeFalsy();
    expect(def.speed).toBeUndefined();
    expect(def.patrolDistance).toBeUndefined();
  });

  it('late solo, esté o no Kerana cerca: cerrados → abre → muerde → cierra → cerrados', () => {
    for (const near of [false, true]) {
      const m = motor();
      expect(m.clocked).toBe(true);
      expect(m.step(J.restMs - 1, near)).toBe('idle');
      expect(m.step(1, near)).toBe('telegraph');
      expect(m.step(J.telegraphMs, near)).toBe('active');
      expect(m.step(J.activeMs, near)).toBe('recover');
      expect(m.step(J.recoverMs, near)).toBe('idle');
      expect(m.step(J.restMs, !near)).toBe('telegraph');
    }
  });

  it('el ritmo no se corre con los fps: el tiempo que sobra pasa al estado siguiente, también al volver a cerrar', () => {
    const coarse = motor();
    const fine = motor();
    const cycle = J.restMs + J.telegraphMs + J.activeMs + J.recoverMs;
    for (let t = 0; t < cycle * 3; t += 50) coarse.step(50, false);
    for (let t = 0; t < cycle * 3; t += 1) fine.step(1, false);
    expect(coarse.state).toBe(fine.state);
    expect(coarse.elapsedMs).toBeCloseTo(fine.elapsedMs, 6);
  });

  it('unos 2 s con los ojos cerrados y otros 2 abiertos; la dentellada es la parte corta', () => {
    expect(J.restMs).toBe(2000);
    expect(J.telegraphMs + J.activeMs + J.recoverMs).toBe(2000);
    expect(J.activeMs).toBeLessThan(J.telegraphMs);
  });

  it('startMs desfasa el ciclo', () => {
    const m = motor(J.restMs - 100);
    expect(m.step(99, false)).toBe('idle');
    expect(m.step(1, false)).toBe('telegraph');
  });

  it('abre los ojos con 0-3, muerde con 4-5 y los cierra con 3-0; cerrados, la hoja idle', () => {
    expect(guardFrame('idle', 0, J.frames)).toBeNull();
    expect(guardFrame('telegraph', 0, J.frames)).toBe(0);
    expect(guardFrame('telegraph', 0.99, J.frames)).toBe(3);
    expect(guardFrame('active', 0, J.frames)).toBe(4);
    expect(guardFrame('active', 1, J.frames)).toBe(5);
    expect(guardFrame('recover', 0, J.frames)).toBe(3);
    expect(guardFrame('recover', 0.5, J.frames)).toBe(1);
    expect(guardFrame('recover', 1, J.frames)).toBe(0);
    expect(Object.keys(sheet.sheets).sort()).toEqual(['attack', 'idle']);
  });

  it('la dentellada va delante del cuerpo, hacia donde mira', () => {
    const half = ENEMIES.jaguaru.width / 2;
    const left = strikeZone(100, 200, -1, half, J.strike);
    expect(left.x + left.width).toBe(100 - half);
    expect(left.width).toBe(J.strike.reach);
    expect(left.y).toBe(200 - J.strike.height);
  });
});

describe('Jaguarú en l6: tres, cada uno en un paso que hay que cruzar', () => {
  const map = parseAscii(l6Text);
  const g: string[] = map.grid;
  const at = (x: number, y: number) => g[y]?.[x] ?? '#';
  const legend = map.enemies as Record<string, string>;
  const facingOf = (map.enemyFacing ?? {}) as Record<string, string>;
  const chars = Object.entries(legend).filter(([, kind]) => kind === 'jaguaru').map(([c]) => c);
  const spots: { x: number; y: number; dir: 1 | -1 }[] = [];
  g.forEach((row, y) =>
    [...row].forEach((c, x) => chars.includes(c) && spots.push({ x, y, dir: facingOf[c] === 'right' ? 1 : -1 })),
  );
  const spot = (x: number) => spots.find((s) => s.x === x)!;

  it('tres (S77 el paso bajo la peña; S78 el fondo de la quebrada y la gruta tras la cascada)', () => {
    expect(spots.map((s) => [s.x, s.y, s.dir])).toEqual([
      [157, 25, 1],
      [88, 44, -1],
      [63, 61, -1],
    ]);
  });

  it('el paso bajo la peña: entre la columna de roca y el pozo de la piedra (paso obligado)', () => {
    const { x } = spot(88);
    expect(g.slice(41, 45).every((row) => row.slice(80, 83) === 'BBB')).toBe(true);
    expect(x).toBeGreaterThan(82);
    expect(at(92, 45)).toBe('.');
  });

  it('el fondo de la quebrada: la columna de la chipa A queda detrás de él', () => {
    const { x } = spot(63);
    expect([58, 59, 60, 61].every((r) => at(69, r) === 'B')).toBe(true);
    expect(at(71, 61)).toBe('F');
    expect(x).toBeLessThan(69 - 4);
  });

  it('la gruta tras la cascada: el fardo de la chipa B queda detrás de él; la cornisa, delante', () => {
    const { x, y } = spot(157);
    expect(at(154, 21)).toBe('F');
    expect([22, 23, 24, 25].every((r) => at(154, r) === '%' && at(155, r) === '%')).toBe(true);
    expect(x).toBeGreaterThan(155 + 1);
    // Techo a 5 filas, como el de la peña.
    expect(at(x, y - 5)).toBe('#');
  });

  for (const s of [157, 88, 63]) {
    it(`x ${s}: piso firme desde el alcance del empujón hasta dos tiles detrás`, () => {
      const { x, y, dir } = spot(s);
      // La dentellada y el empujón (≈ 4 tiles) van hacia donde mira, sobre piso firme; nunca a un pozo.
      for (let k = -2; k <= 8; k++) expect(at(x + dir * k, y + 1), `piso en (${x + dir * k}, ${y + 1})`).toBe('#');
      expect([0, 1, 2].every((r) => at(x, y - r) !== '#')).toBe(true);
    });

    it(`x ${s}: lejos de los fuegos, de las espinas y de los otros enemigos`, () => {
      const { x, y } = spot(s);
      const others = new Set(Object.keys(legend).filter((c) => !chars.includes(c)));
      for (let yy = y - 4; yy <= y + 4; yy++) {
        for (let xx = x - 10; xx <= x + 10; xx++) {
          const c = at(xx, yy);
          expect(c, `fuego en (${xx}, ${yy})`).not.toBe('C');
          expect(c, `espina en (${xx}, ${yy})`).not.toBe('^');
          expect(others.has(c), `enemigo "${c}" en (${xx}, ${yy})`).toBe(false);
        }
      }
    });
  }

  it('el paso bajo la peña: techo a 5 filas, no se lo salta', () => {
    const { x, y } = spot(88);
    expect([0, 1, 2, 3, 4].every((r) => at(x, y - r) !== '#')).toBe(true);
    expect(at(x, y - 5)).toBe('#');
  });
});
