import { describe, expect, it } from 'vitest';
import { GAMEPLAY } from '../src/config/gameplay';
import { LEVELS } from '../src/data/levels';
import { earthCells, terrainAlpha, terrainDepths } from '../src/systems/terrainLogic';

const LOOK = { shade: 0.5, deepShade: 0.4, deepTiles: 2, jitter: 0 };

// Bloque macizo de 12 × 12 con aire alrededor (un tile de margen).
function block(size = 12): { solid: (x: number, y: number) => boolean; w: number; h: number } {
  const w = size + 2;
  return { solid: (x, y) => x > 0 && y > 0 && x <= size && y <= size, w, h: w };
}

describe('fondo de tierra (S68, S69)', () => {
  it('nunca hay tierra en el aire ni en las filas que la repisa dibuja enteras; sí en la tenue y más adentro', () => {
    const { solid, w, h } = block();
    const depth = terrainDepths(solid, w, h, 3 + LOOK.deepTiles);
    const cells = earthCells(depth, w, 3, LOOK);
    const has = new Set(cells.map((c) => c.y * w + c.x));
    for (let i = 0; i < depth.length; i++) {
      expect(has.has(i)).toBe(depth[i] >= 3);
      // Donde hay tierra, la repisa encima es la fila tenue o no se dibuja: nunca un tile entero.
      if (has.has(i)) expect(terrainAlpha(depth[i], 3, GAMEPLAY.backdrop.terrainFadeAlpha)).toBeLessThan(1);
    }
  });

  it('se oscurece hacia adentro, de shade a deepShade, sin pasar de ahí', () => {
    const { solid, w, h } = block();
    const depth = terrainDepths(solid, w, h, 3 + LOOK.deepTiles);
    const cells = earthCells(depth, w, 3, LOOK);
    const gray = (d: number) => cells.find((c) => depth[c.y * w + c.x] === d)!.gray;
    expect(gray(3)).toBe(Math.round(255 * 0.5));
    expect(gray(5)).toBe(Math.round(255 * 0.4));
    expect(gray(4)).toBeLessThan(gray(3));
    expect(gray(4)).toBeGreaterThan(gray(5));
  });

  it('el tinte del juego es sombra (más oscuro que la mitad) y el jitter no lo saca de rango', () => {
    const look = GAMEPLAY.backdrop.earth;
    expect(look.shade).toBeLessThanOrEqual(0.6);
    expect(look.deepShade).toBeLessThanOrEqual(look.shade);
    const { solid, w, h } = block(40);
    const depth = terrainDepths(solid, w, h, 3 + look.deepTiles);
    const cells = earthCells(depth, w, 3, look);
    const max = Math.round(255 * look.shade * (1 + look.jitter));
    for (const c of cells) expect(c.gray).toBeLessThanOrEqual(max);
  });

  it('no es papel tapiz: las ocho orientaciones aparecen y dos vecinas casi nunca coinciden', () => {
    const { solid, w, h } = block(40);
    const depth = terrainDepths(solid, w, h, 5);
    const cells = earthCells(depth, w, 3, LOOK);
    const key = (c: { turn: number; flip: boolean }) => c.turn + (c.flip ? 4 : 0);
    const seen = new Set(cells.map(key));
    expect(seen.size).toBe(8);
    const at = new Map(cells.map((c) => [c.y * w + c.x, key(c)]));
    let same = 0;
    let pairs = 0;
    for (const c of cells) {
      const right = at.get(c.y * w + c.x + 1);
      if (right === undefined) continue;
      pairs++;
      if (right === key(c)) same++;
    }
    expect(same / pairs).toBeLessThan(0.25);
    // Determinista: la misma tierra en cada partida.
    expect(earthCells(depth, w, 3, LOOK)).toEqual(cells);
  });

  it('lo que se dibuja entero igual (el piso) no lleva tierra', () => {
    const { solid, w, h } = block();
    const depth = terrainDepths(solid, w, h, 5);
    expect(earthCells(depth, w, 3, LOOK, () => true)).toEqual([]);
  });

  it('solo l3 lo tiene encendido; l1 sigue con su fondo de cueva y todo el que lo tenga usa la repisa', () => {
    const on = Object.values(LEVELS).filter((l) => l?.earthBackdrop);
    expect(on.map((l) => l!.id)).toEqual(['l3']);
    for (const l of on) expect(l!.terrainShell).toBeGreaterThanOrEqual(2);
    expect(LEVELS.l1?.earthBackdrop).toBeUndefined();
    expect(LEVELS.l1?.backgrounds.cave).toBe('bg_l1_cave');
  });
});
