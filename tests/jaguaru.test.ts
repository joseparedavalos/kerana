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

describe('Jaguarú en l6: uno, en el paso bajo la peña', () => {
  const map = parseAscii(l6Text);
  const g: string[] = map.grid;
  const at = (x: number, y: number) => g[y]?.[x] ?? '#';
  const legend = map.enemies as Record<string, string>;
  const chars = Object.entries(legend).filter(([, kind]) => kind === 'jaguaru').map(([c]) => c);
  const spots: [number, number][] = [];
  g.forEach((row, y) => [...row].forEach((c, x) => chars.includes(c) && spots.push([x, y])));

  it('hay uno solo, como prototipo, entre la columna de roca y el pozo de la piedra', () => {
    expect(spots).toHaveLength(1);
    const [x, y] = spots[0];
    expect(y).toBe(44);
    // La columna (rompible) queda al oeste y el pozo al este: es paso obligado.
    expect(g.slice(41, 45).every((row) => row.slice(80, 83) === 'BBB')).toBe(true);
    expect(x).toBeGreaterThan(82);
    expect(at(92, 45)).toBe('.');
  });

  it('piso firme desde el alcance del empujón hasta dos tiles detrás, y techo bajo: no se lo salta', () => {
    const [x, y] = spots[0];
    // Mira al oeste: la dentellada y el empujón (≈ 4 tiles) van hacia la columna, sobre piso firme; nunca al pozo.
    for (let dx = -8; dx <= 2; dx++) expect(at(x + dx, y + 1), `piso en (${x + dx}, ${y + 1})`).toBe('#');
    // Lugar para su alto y techo a 5 filas: con 40 de alto, Kerana (2,6 tiles) no pasa por encima de un salto.
    const free = [0, 1, 2, 3, 4].every((r) => at(x, y - r) !== '#');
    expect(free).toBe(true);
    expect(at(x, y - 5)).toBe('#');
  });

  it('lejos de los fuegos, de las espinas y de los otros enemigos', () => {
    const [x, y] = spots[0];
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
});
