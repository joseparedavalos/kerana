// Dibuja el peligro (espinas) de los biomas sin arte propio en las baldosas 19, 26 y 27 de su PNG (S64).
// Parchea solo esas tres: el piso del 16 de octubre (0 a 15) y la decoración (23 a 25) no se tocan.
// Mineral (cerro, montana, ciudad, cielo) o karaguatá (estero, selva, pueblo); el dibujo y las paletas,
// en tools/lib/hazard-art.mjs. Campo tiene el suyo desde raw/ (`npm run tileset -- campo`).
// Uso: node tools/draw-hazard-tiles.mjs [bioma…]
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PNG } from 'pngjs';
import { HAZARD_ART, HAZARD_VARIANT_COUNT, hazardImage } from './lib/hazard-art.mjs';
import { HAZARD_TILES, TILE, TILESET_COLUMNS } from './lib/tileset-layout.mjs';

const wanted = process.argv.slice(2);
const biomes = wanted.length ? wanted : Object.keys(HAZARD_ART);
for (const biome of biomes) {
  if (!HAZARD_ART[biome]) {
    console.error(`${biome}: no tiene peligro dibujado por código (campo sale de raw/: npm run tileset -- campo)`);
    process.exit(1);
  }
  const file = join('public', 'assets', 'tiles', `${biome}.png`);
  const png = PNG.sync.read(readFileSync(file));
  for (let v = 0; v < HAZARD_VARIANT_COUNT; v++) {
    const img = hazardImage(biome, v);
    const index = HAZARD_TILES[v];
    const tx = (index % TILESET_COLUMNS) * TILE;
    const ty = Math.floor(index / TILESET_COLUMNS) * TILE;
    for (let y = 0; y < TILE; y++) {
      for (let x = 0; x < TILE; x++) {
        const o = ((ty + y) * png.width + tx + x) * 4;
        png.data.set(img.data.subarray((y * TILE + x) * 4, (y * TILE + x) * 4 + 4), o);
      }
    }
  }
  writeFileSync(file, PNG.sync.write(png));
  console.log(`+ ${file}: peligro ${HAZARD_ART[biome].family} en ${HAZARD_TILES.join(', ')}`);
}
