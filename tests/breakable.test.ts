import { describe, expect, it } from 'vitest';
import { breakableGroups, restsOn, type BreakableBox } from '../src/systems/breakableLogic';

const tile = (x: number, y: number, kind = 'rock'): BreakableBox => ({ x: x * 16, y: y * 16, width: 16, height: 16, kind });

describe('rompibles (S22)', () => {
  it('los tiles de la misma clase que se tocan forman un bloque', () => {
    // Pared de roca de 2 × 2, un fardo suelto y otra roca lejos.
    const boxes = [tile(4, 1), tile(5, 1), tile(4, 2), tile(5, 2), tile(8, 2, 'brittle'), tile(12, 2)];
    expect(breakableGroups(boxes)).toEqual([0, 0, 0, 0, 1, 2]);
  });

  it('una roca y un fardo pegados no se mezclan; las esquinas no unen', () => {
    expect(breakableGroups([tile(0, 0), tile(1, 0, 'brittle')])).toEqual([0, 1]);
    expect(breakableGroups([tile(0, 0), tile(1, 1)])).toEqual([0, 1]);
  });

  it('une cadenas largas aunque aparezcan desordenadas', () => {
    const boxes = [tile(0, 3), tile(0, 0), tile(0, 2), tile(0, 1)];
    expect(breakableGroups(boxes)).toEqual([0, 0, 0, 0]);
  });

  it('lo apoyado sobre la cara de arriba cae al romperse', () => {
    const nest = { x: 32, y: 64, width: 32, height: 16, kind: 'brittle' };
    expect(restsOn(40, 64, nest, 4)).toBe(true);
    expect(restsOn(40, 58, nest, 4)).toBe(false);
    expect(restsOn(70, 64, nest, 4)).toBe(false);
  });
});
