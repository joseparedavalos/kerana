import { describe, expect, it } from 'vitest';
import { GAMEPLAY } from '../src/config/gameplay';
import { LEVELS } from '../src/data/levels';
import { earthChunks, earthPixels, terrainAlpha, terrainDepths } from '../src/systems/terrainLogic';

const LOOK = { fadeAlpha: 0.6, shade: 0.8, deepShade: 0.6, deepTiles: 2 };

// Bloque macizo de 12 × 12 con aire alrededor (un tile de margen).
function block(size = 12): { solid: (x: number, y: number) => boolean; w: number; h: number } {
  const w = size + 2;
  return { solid: (x, y) => x > 0 && y > 0 && x <= size && y <= size, w, h: w };
}

describe('fondo de tierra (S68)', () => {
  it('nunca hay tierra en el aire ni al lado del aire; la fila tenue lleva fadeAlpha y más adentro es opaca', () => {
    const { solid, w, h } = block();
    const depth = terrainDepths(solid, w, h, 3 + LOOK.deepTiles);
    const px = earthPixels(depth, 3, 0x864925, LOOK);
    for (let i = 0; i < depth.length; i++) {
      const a = px[i * 4 + 3];
      const d = depth[i];
      if (d <= 1) expect(a).toBe(0);
      if (d === 3) expect(a).toBe(Math.round(LOOK.fadeAlpha * 255));
      if (d > 3) expect(a).toBe(255);
      // Donde la repisa dibuja entero (y no es la fila tenue), la tierra solo puede estar tapada.
      if (a > 0 && d < 3) expect(terrainAlpha(d, 3, GAMEPLAY.backdrop.terrainFadeAlpha)).toBe(1);
    }
  });

  it('se oscurece hacia adentro, del shade al deepShade, con el color del relleno', () => {
    const { solid, w, h } = block();
    const depth = terrainDepths(solid, w, h, 3 + LOOK.deepTiles);
    const px = earthPixels(depth, 3, 0x864925, LOOK);
    const red = (d: number) => px[depth.findIndex((v) => v === d) * 4];
    expect(red(3)).toBe(Math.round(0x86 * 0.8));
    expect(red(5)).toBe(Math.round(0x86 * 0.6));
    expect(red(4)).toBeLessThan(red(3));
    expect(red(4)).toBeGreaterThan(red(5));
  });

  it('lo que se dibuja entero igual (el piso) no lleva tierra', () => {
    const { solid, w, h } = block();
    const depth = terrainDepths(solid, w, h, 5);
    const px = earthPixels(depth, 3, 0x864925, LOOK, () => true);
    expect(px.filter((_, i) => i % 4 === 3 && px[i] > 0).length).toBe(0);
  });

  it('los trozos cubren toda la tierra, con margen vacío, y saltean los tramos sin tierra', () => {
    const w = 40;
    const h = 14;
    // Un bloque en x 1-12 y otro en x 25-38: el tramo del medio no tiene tierra.
    const solid = (x: number, y: number) => y > 0 && y < 13 && ((x >= 1 && x <= 12) || (x >= 25 && x <= 38));
    const depth = terrainDepths(solid, w, h, 5);
    const px = earthPixels(depth, 3, 0x864925, LOOK);
    const chunks = earthChunks(px, w, h, 8);
    const inside = (x: number, y: number) => chunks.some((c) => x >= c.x && x < c.x + c.width && y >= c.y && y < c.y + c.height);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (px[(y * w + x) * 4 + 3] > 0) expect(inside(x, y)).toBe(true);
    expect(chunks.some((c) => c.x >= 16 && c.x + c.width <= 24)).toBe(false);
    for (const c of chunks) expect(c.x % 8 === 0 || px[(c.y * w + c.x) * 4 + 3] === 0).toBe(true);
  });

  it('solo l3 lo tiene encendido; l1 sigue con su fondo de cueva y todo el que lo tenga usa la repisa', () => {
    const on = Object.values(LEVELS).filter((l) => l?.earthBackdrop);
    expect(on.map((l) => l!.id)).toEqual(['l3']);
    for (const l of on) expect(l!.terrainShell).toBeGreaterThanOrEqual(2);
    expect(LEVELS.l1?.earthBackdrop).toBeUndefined();
    expect(LEVELS.l1?.backgrounds.cave).toBe('bg_l1_cave');
  });
});
