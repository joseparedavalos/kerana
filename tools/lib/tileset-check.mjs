// Chequeo de los tilesets ya armados (S88): filas vacías arriba de las casillas de borde.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import { TILE, TILES, TILESET_COLUMNS } from './tileset-layout.mjs';

export const TILESETS_DIR = fileURLToPath(new URL('../../public/assets/tiles/', import.meta.url));
const UP = 1; // bit «vecino arriba» de la máscara del autotile

/** Filas completamente transparentes al principio de la casilla `index` de una imagen RGBA. */
export function emptyTopRows(img, index) {
  const x0 = (index % TILESET_COLUMNS) * TILE;
  const y0 = Math.floor(index / TILESET_COLUMNS) * TILE;
  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) if (img.data[((y0 + y) * img.width + x0 + x) * 4 + 3] !== 0) return y;
  }
  return TILE;
}

/** Casillas de piso sin vecino arriba (máscaras pares de 0 a 15): son las que se pisan. */
export const TOP_EDGE_TILES = Array.from({ length: 16 }, (_, mask) => mask)
  .filter((mask) => !(mask & UP))
  .map((mask) => TILES.groundBase + mask);

/** Por cada tileset de `dir`: [{ biome, tile, rows }] para cada casilla de borde de arriba. */
export function topEdgeGaps(dir = TILESETS_DIR) {
  const out = [];
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.png')).sort()) {
    const img = PNG.sync.read(readFileSync(join(dir, file)));
    for (const tile of TOP_EDGE_TILES) out.push({ biome: file.replace(/\.png$/, ''), tile, rows: emptyTopRows(img, tile) });
  }
  return out;
}
