import { describe, expect, it } from 'vitest';
import { hivePlacement } from '../src/entities/enemies/hive';

const TILE = 16;
/** Terreno con las filas sólidas dadas (en todo el ancho). */
const rows =
  (...solid: number[]) =>
  (_x: number, y: number) =>
    solid.includes(Math.floor(y / TILE));
const none = rows();
const LIP = 6;

describe('panal (S99)', () => {
  // Enjambre en la fila 20: los pies en y 336.
  const feet = 21 * TILE;
  it('cuelga del techo más cercano dentro de 3 filas, por su borde de abajo', () => {
    expect(hivePlacement(8, feet, TILE, 3, rows(18, 19), none, LIP)).toEqual({
      hang: true,
      y: 20 * TILE,
    });
    expect(hivePlacement(8, feet, TILE, 3, rows(17), none, LIP)).toEqual({
      hang: true,
      y: 18 * TILE,
    });
  });
  it('de una plataforma de un sentido cuelga del borde de su dibujo', () => {
    expect(hivePlacement(8, feet, TILE, 3, none, rows(19), LIP)).toEqual({
      hang: true,
      y: 19 * TILE + LIP,
    });
    // El terreno más cercano manda.
    expect(hivePlacement(8, feet, TILE, 3, rows(18), rows(19), LIP)).toEqual({
      hang: true,
      y: 19 * TILE + LIP,
    });
  });
  it('sin techo a 3 filas o menos, se apoya en el piso', () => {
    expect(hivePlacement(8, feet, TILE, 3, rows(16, 21), none, LIP)).toEqual({
      hang: false,
      y: feet,
    });
    expect(hivePlacement(8, feet, TILE, 3, none, none, LIP)).toEqual({
      hang: false,
      y: feet,
    });
  });
});
