import { describe, expect, it } from 'vitest';
import { createImage } from '../tools/lib/sprite-pipeline.mjs';
import { emptyTopRows, topEdgeGaps, TOP_EDGE_TILES } from '../tools/lib/tileset-check.mjs';
import { TILE, TILESET_COLUMNS, TILESET_ROWS } from '../tools/lib/tileset-layout.mjs';

// S88: la colisión está en el borde de arriba del tile. Si el dibujo del piso empieza más abajo,
// Kerana, los carteles, los faroles y los props flotan (ciudad llegó a tener 7 filas vacías).
// Hasta 3 se tolera: un canto irregular (campo tiene 1 y montana 3).
const MAX_EMPTY_TOP_ROWS = 3;

type Gap = { biome: string; tile: number; rows: number };

describe('borde de arriba de los tilesets (S88)', () => {
  it('cuenta las filas vacías al principio de una casilla', () => {
    const img = createImage(TILE * TILESET_COLUMNS, TILE * TILESET_ROWS);
    // Casilla 2: el dibujo empieza en la fila 7.
    for (let y = 7; y < TILE; y++) for (let x = 0; x < TILE; x++) img.data[(y * img.width + 2 * TILE + x) * 4 + 3] = 255;
    // Casilla 4: un solo píxel en la fila 0.
    img.data[(TILE * img.width + 5) * 4 + 3] = 255;
    expect(emptyTopRows(img, 2)).toBe(7);
    expect(emptyTopRows(img, 4)).toBe(0);
    expect(emptyTopRows(img, 6)).toBe(TILE);
  });

  it('las casillas de borde de arriba son las de máscara par', () => {
    expect(TOP_EDGE_TILES).toEqual([0, 2, 4, 6, 8, 10, 12, 14]);
  });

  it('ningún tileset deja más de 3 filas vacías sobre el piso', () => {
    const gaps = topEdgeGaps() as Gap[];
    // Los ocho biomas, ocho casillas cada uno.
    expect(new Set(gaps.map((g) => g.biome)).size).toBeGreaterThanOrEqual(8);
    const floating = gaps
      .filter((g) => g.rows > MAX_EMPTY_TOP_ROWS)
      .map((g) => `bioma ${g.biome}, casilla ${g.tile}: ${g.rows} filas vacías arriba (máximo ${MAX_EMPTY_TOP_ROWS})`);
    expect(floating).toEqual([]);
  });
});
