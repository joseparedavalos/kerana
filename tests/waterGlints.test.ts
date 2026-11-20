import { describe, expect, it } from 'vitest';
import { GAMEPLAY } from '../src/config/gameplay';
import { glintEnvelope, pickSurface, surfaceRuns } from '../src/systems/waterGlintLogic';

// S110: el brillo que corre por la superficie del agua de l2: los tramos de superficie y dónde cae cada destello.

describe('brillo del agua (S110)', () => {
  // Dos charcos en la fila 5 (x 2-5 y x 10-11) y uno en la 9 (x 0-2).
  const surface = (x: number, y: number) => (y === 5 && ((x >= 2 && x <= 5) || (x >= 10 && x <= 11))) || (y === 9 && x <= 2);
  const runs = surfaceRuns(14, 12, surface);

  it('los tramos de superficie, fila por fila', () => {
    expect(runs).toEqual([2, 6, 5, 10, 12, 5, 0, 3, 9]);
  });

  it('cada destello cae sobre agua a la vista; sin agua a la vista, ninguno', () => {
    const out = { x: 0, y: 0 };
    for (let i = 0; i < 200; i++) {
      expect(pickSurface(runs, 4, 11, (i * 0.37) % 1, (i * 0.61) % 1, out)).toBe(true);
      expect(out.x).toBeGreaterThanOrEqual(4);
      expect(out.x).toBeLessThan(11);
      const tx = Math.floor(out.x);
      expect(surface(tx, out.y), `${out.x},${out.y}`).toBe(true);
    }
    expect(pickSurface(runs, 6, 10, 0.5, 0.5, out)).toBe(false);
  });

  it('sube y baja suave; liviano: un pool chico y opacidad menor que 1', () => {
    expect(glintEnvelope(0)).toBe(0);
    expect(glintEnvelope(1)).toBe(0);
    expect(glintEnvelope(0.5)).toBeCloseTo(1);
    expect(glintEnvelope(0.25)).toBeLessThan(glintEnvelope(0.5));
    const c = GAMEPLAY.backdrop.waterGlints;
    expect(c.count).toBeLessThanOrEqual(20);
    expect(c.alpha).toBeLessThanOrEqual(1);
    expect(c.widthMin).toBeLessThanOrEqual(c.widthMax);
    expect(c.lifeMinMs).toBeLessThanOrEqual(c.lifeMaxMs);
  });
});
