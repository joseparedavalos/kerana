import { describe, expect, it } from 'vitest';
import { GAMEPLAY } from '../src/config/gameplay';
import { LEVELS } from '../src/data/levels';
import { earthCells, terrainAlpha, terrainDepths } from '../src/systems/terrainLogic';

// Bloque macizo de 12 × 12 con aire alrededor (un tile de margen).
function block(size = 12): { solid: (x: number, y: number) => boolean; w: number; h: number } {
  const w = size + 2;
  return { solid: (x, y) => x > 0 && y > 0 && x <= size && y <= size, w, h: w };
}

describe('fondo de tierra (S68, S69, S71)', () => {
  it('nunca hay tierra en el aire ni en las filas que la repisa dibuja enteras; sí en la tenue y más adentro', () => {
    const { solid, w, h } = block();
    const depth = terrainDepths(solid, w, h, 3);
    const cells = earthCells(depth, w, 3);
    const has = new Set(cells.map((c) => c.y * w + c.x));
    for (let i = 0; i < depth.length; i++) {
      expect(has.has(i)).toBe(depth[i] >= 3);
      // Donde hay tierra, la repisa encima es la fila tenue o no se dibuja: nunca un tile entero.
      if (has.has(i)) expect(terrainAlpha(depth[i], 3, GAMEPLAY.backdrop.terrainFadeAlpha)).toBeLessThan(1);
    }
  });

  it('el relleno es la casilla 15 del autotile (suelo en los cuatro lados), la misma que la tierra honda de Ground', () => {
    expect(GAMEPLAY.backdrop.earth.fillTile).toBe(15);
    // Sin sombra ni orientación: S71 sacó el oscurecido (se leía como una caja hundida).
    expect(Object.keys(GAMEPLAY.backdrop.earth).sort()).toEqual(['depth', 'fillTile']);
  });

  it('lo que se dibuja entero igual (el piso) no lleva tierra', () => {
    const { solid, w, h } = block();
    const depth = terrainDepths(solid, w, h, 3);
    expect(earthCells(depth, w, 3, () => true)).toEqual([]);
  });

  it('l3 y l4 (S75) lo tienen encendido; l1 sigue con su fondo de cueva y todo el que lo tenga usa la repisa', () => {
    const on = Object.values(LEVELS).filter((l) => l?.earthBackdrop);
    expect(on.map((l) => l!.id)).toEqual(['l3', 'l4']);
    for (const l of on) expect(l!.terrainShell).toBeGreaterThanOrEqual(2);
    expect(LEVELS.l1?.earthBackdrop).toBeUndefined();
    expect(LEVELS.l1?.backgrounds.cave).toBe('bg_l1_cave');
  });
});
