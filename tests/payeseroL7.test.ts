import { describe, expect, it } from 'vitest';
import { parseAscii } from '../tools/lib/ascii-map.mjs';
import { GAMEPLAY } from '../src/config/gameplay';
import l7Text from '../tools/levels/l7.txt?raw';

// S79: el payesero de l7, en el patio del andamio 1, mirando a la subida. La lección de S64: el payé vuela más que el
// alcance (la mano ± lo que recorre en su vida) y el golpe frena a Kerana en el aire; nada de lo que alcanza puede ser
// un pozo sin fondo.
const T = 16;
const P = GAMEPLAY.payesero;
const map = parseAscii(l7Text);
const g: string[] = map.grid;
const charOf = (kind: string) => Object.entries(map.enemies).find(([, k]) => k === kind)?.[0];
const cells = (pred: (c: string) => boolean) => g.flatMap((row, y) => [...row].flatMap((c, x) => (pred(c) ? [{ x, y, c }] : [])));

describe('el payesero de l7 (S79)', () => {
  const ch = charOf('payesero')!;
  const casters = cells((c) => c === ch);

  it('hay uno solo, en el patio (x 47, fila 59), mirando al andamio', () => {
    expect(casters).toEqual([{ x: 47, y: 59, c: ch }]);
    expect((map.enemyFacing as Record<string, string>)[ch]).toBe('right');
  });

  it('está en tierra firme, con dos tiles de piso a cada lado', () => {
    const { x, y } = casters[0];
    for (let dx = -2; dx <= 2; dx++) {
      expect(g[y + 1][x + dx]).toBe('#');
      if (dx !== 0) expect(g[y][x + dx]).toBe('.');
    }
  });

  it('todo lo que alcanza el payé tiene piso debajo: ningún pozo sin fondo', () => {
    const { x, y } = casters[0];
    const reach = P.hand.forward + (P.paye.speed * P.paye.lifeMs) / 1000; // la mano + lo que vuela el payé
    const cx = x * T + T / 2;
    const x0 = Math.floor((cx - reach) / T);
    const x1 = Math.floor((cx + reach) / T);
    const top = Math.max(0, y - Math.ceil(reach / T));
    for (let col = x0; col <= x1; col++) {
      // Desde lo más alto que alcanza hasta el fondo del mapa, la columna tiene roca en algún lado.
      const solid = g.slice(top).some((row) => row[col] === '#');
      expect(solid, `columna ${col} sin fondo`).toBe(true);
    }
    // El pozo de 5 de los tejados (x 81) queda afuera.
    expect(x1).toBeLessThan(81);
  });

  it('lejos del inicio, de los fuegos y de otros enemigos (reaparecer a su alcance es un golpe gratis)', () => {
    const { x, y } = casters[0];
    const far = (c: { x: number; y: number }) => Math.hypot((c.x - x) * T, (c.y - y) * T);
    for (const c of cells((c) => c === 'C' || c === 'P')) expect(far(c)).toBeGreaterThan(P.paye.speed * (P.paye.lifeMs / 1000));
    const others = cells((c) => /[a-z]/.test(c) && c !== ch);
    for (const c of others) expect(far(c), `${c.c} en (${c.x}, ${c.y})`).toBeGreaterThan(P.watchRadius);
  });
});
