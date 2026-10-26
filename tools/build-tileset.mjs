// Monta public/assets/tiles/<bioma>.png (64 × 112) con los materiales de raw/tiles/<bioma>/ (S56).
// Receta, qué pedirle al generador y qué revisar: docs/RECETA-TILESET.md. Ajustes: raw/tiles/<bioma>/tileset.json.
// Uso: node tools/build-tileset.mjs <bioma> [--preview]   (--preview deja tmp/tiles/<bioma>-x8.png)
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import jpeg from 'jpeg-js';
import { PNG } from 'pngjs';
import {
  TILES,
  autotileCell,
  backdropMask,
  createTileset,
  cropWrapped,
  findDrawings,
  fitSize,
  placeInTile,
  platformCell,
  reduceBlocks,
  seamlessWindow,
} from './lib/tileset-build.mjs';
import { TILE } from './lib/tileset-layout.mjs';
import { createImage } from './lib/sprite-pipeline.mjs';

const biome = process.argv[2];
if (!biome || biome.startsWith('-')) {
  console.error('Uso: node tools/build-tileset.mjs <bioma> [--preview]');
  process.exit(1);
}
const RAW = join('raw', 'tiles', biome);
const configFile = join(RAW, 'tileset.json');
if (!existsSync(configFile)) {
  console.error(`Falta ${configFile} (ver docs/RECETA-TILESET.md)`);
  process.exit(1);
}
const config = JSON.parse(readFileSync(configFile, 'utf8'));

function load(file) {
  const path = join(RAW, file);
  const buf = readFileSync(path);
  if (/\.png$/i.test(file)) {
    const png = PNG.sync.read(buf);
    return { width: png.width, height: png.height, data: png.data };
  }
  return jpeg.decode(buf, { useTArray: true, formatAsRGBA: true, maxMemoryUsageInMB: 512 });
}

const whole = (img) => ({ x: 0, y: 0, w: img.width, h: img.height });

// 1. Tierra: textura sin costura reducida a su escala; de ahí, el bloque de 16 × 16 que mejor se repite.
const dirtSrc = load(config.dirt.file);
const dirtSmall = reduceBlocks(
  dirtSrc,
  whole(dirtSrc),
  Math.round(dirtSrc.width / config.dirt.scale),
  Math.round(dirtSrc.height / config.dirt.scale),
);
const dirtAt = seamlessWindow(dirtSmall, TILE, TILE, { speck: config.dirt.speck, blob: config.dirt.blob });
const dirt = cropWrapped(dirtSmall, dirtAt.x, dirtAt.y, TILE, TILE);

// 2. Pasto: la franja de arriba de pasto.jpg, `rows` filas desde la punta más alta. Cada píxel: aire (alfa 0),
// pasto (255) o tierra (128: ahí va la tierra del bloque, para que la franja empalme con el resto).
const grassSrc = load(config.grass.file);
const grassBg = backdropMask(grassSrc);
// Escala distinta a lo ancho y a lo alto: las hojas son finas y, con la misma escala, la punta sale lisa.
const sx = config.grass.scaleX;
const sy = config.grass.scaleY;
let top = 0;
for (; top < grassSrc.height; top++) {
  let ink = 0;
  for (let x = 0; x < grassSrc.width; x++) if (!grassBg[top * grassSrc.width + x]) ink++;
  if (ink > grassSrc.width * 0.1) break;
}
const bandRect = { x: 0, y: top, w: grassSrc.width, h: config.grass.rows * sy };
const bandW = Math.round(grassSrc.width / sx);
// El fleco claro que deja el JPG alrededor de las puntas tampoco es pasto.
const notBg = (x, y) => {
  if (grassBg[y * grassSrc.width + x]) return false;
  const i = (y * grassSrc.width + x) * 4;
  return grassSrc.data[i] + grassSrc.data[i + 1] + grassSrc.data[i + 2] < (config.grass.fringe ?? 600);
};
const isGrass = (x, y) => {
  if (!notBg(x, y)) return false;
  const i = (y * grassSrc.width + x) * 4;
  // El pasto seco es amarillo oliva (verde ≈ rojo); la tierra es rojiza (verde mucho menor que rojo).
  return grassSrc.data[i + 1] >= grassSrc.data[i] * (config.grass.hueRatio ?? 0.68);
};
const inkBand = reduceBlocks(grassSrc, bandRect, bandW, config.grass.rows, notBg);
const grassBand = reduceBlocks(grassSrc, bandRect, bandW, config.grass.rows, isGrass);
for (let i = 0; i < inkBand.data.length; i += 4) {
  if (grassBand.data[i + 3] === 0 && inkBand.data[i + 3] === 255) grassBand.data[i + 3] = 128;
}
const grassAt = seamlessWindow(grassBand, TILE, config.grass.rows, { wrapY: false });
const grass = cropWrapped(grassBand, grassAt.x, 0, TILE, config.grass.rows);

const sheet = createTileset();
// 3. Autotile 0–15: mismo bloque, bordes según los vecinos.
for (let mask = 0; mask < 16; mask++) placeInTile(sheet, TILES.groundBase + mask, autotileCell(mask, dirt, grass, config.edge), { dx: 0, dy: 0 });

// 4. Plataforma de un solo sentido 16–18: solo la franja de arriba.
const { rows: platRows, grassRows } = config.platform;
for (const [part, index] of [['left', TILES.platformLeft], ['center', TILES.platformCenter], ['right', TILES.platformRight]]) {
  placeInTile(sheet, index, platformCell(part, dirt, grass, config.edge, platRows, grassRows), { dx: 0, dy: 0 });
}

// 5. Especiales: cinco dibujos en fila sobre el damero.
const spSrc = load(config.specials.file);
const spBg = backdropMask(spSrc);
const drawings = findDrawings(spBg, spSrc.width, spSrc.height);
if (drawings.length !== config.specials.order.length) {
  console.error(`${config.specials.file}: se esperaban ${config.specials.order.length} dibujos y hay ${drawings.length}`, drawings);
  process.exit(1);
}
const rectOf = Object.fromEntries(config.specials.order.map((name, i) => [name, drawings[i]]));
const spInk = (x, y) => !spBg[y * spSrc.width + x];

// Agua: textura; se reduce a 24 px de ancho y se elige la ventana de 16 que mejor se repite a lo ancho.
// En la superficie, todo lo que está debajo de la primera tinta de cada columna es agua (la espuma blanca
// de la cresta toca el damero y el relleno desde afuera se la comería).
const WATER_W = 24;
function waterTile(rect, surface) {
  const firstInk = new Map();
  if (surface) {
    for (let x = rect.x; x < rect.x + rect.w; x++) {
      let y = rect.y;
      while (y < rect.y + rect.h && !spInk(x, y)) y++;
      firstInk.set(x, y);
    }
  }
  const isWater = surface ? (x, y) => y >= firstInk.get(x) : spInk;
  const h = Math.round((rect.h * WATER_W) / rect.w);
  const small = reduceBlocks(spSrc, rect, WATER_W, h, isWater);
  const at = seamlessWindow(small, TILE, Math.min(TILE, h), { wrapY: !surface, rows: surface ? Math.min(TILE, h) : undefined });
  const tile = cropWrapped(small, at.x, surface ? 0 : at.y, TILE, TILE);
  for (let i = 3; i < tile.data.length; i += 4) if (tile.data[i]) tile.data[i] = config.waterAlpha;
  return tile;
}
placeInTile(sheet, TILES.waterSurface, waterTile(rectOf.waterSurface, true), { dx: 0, dy: 0 });
placeInTile(sheet, TILES.waterDeep, waterTile(rectOf.waterDeep, false), { dx: 0, dy: 0 });

// Decoración 23–25: reducida sin deformar, apoyada abajo y centrada, con el fondo transparente.
function sprite(src, ink, rect, maxW, maxH) {
  const { w, h } = fitSize(rect, maxW, maxH);
  return reduceBlocks(src, rect, w, h, ink);
}
const decor = config.decor;
placeInTile(sheet, TILES.grass, sprite(spSrc, spInk, rectOf.grass, decor.grass.maxWidth, decor.grass.maxHeight));
placeInTile(sheet, TILES.flowers, sprite(spSrc, spInk, rectOf.flowers, decor.flowers.maxWidth, decor.flowers.maxHeight));
placeInTile(sheet, TILES.stones, sprite(spSrc, spInk, rectOf.stones, decor.stones.maxWidth, decor.stones.maxHeight));

// 6. Espinas (19): la planta sola, apoyada abajo.
const hzSrc = load(config.hazard.file);
const hzBg = backdropMask(hzSrc);
const [hzRect] = findDrawings(hzBg, hzSrc.width, hzSrc.height);
placeInTile(sheet, TILES.hazard, sprite(hzSrc, (x, y) => !hzBg[y * hzSrc.width + x], hzRect, config.hazard.maxWidth, config.hazard.maxHeight));

// 22 (roca agrietada) queda vacía: la tapa BreakableLook. 26 y 27, sin uso.

const out = join('public', 'assets', 'tiles', `${biome}.png`);
const png = new PNG({ width: sheet.width, height: sheet.height });
sheet.data.forEach((v, i) => (png.data[i] = v));
writeFileSync(out, PNG.sync.write(png));
console.log(`+ ${out} (${sheet.width} × ${sheet.height}); tierra desde (${dirtAt.x}, ${dirtAt.y}), pasto desde x ${grassAt.x}`);
console.log(`  dibujos: ${drawings.map((d) => `${d.w}×${d.h}@${d.x},${d.y}`).join(' · ')} · espinas ${hzRect.w}×${hzRect.h}`);

if (process.argv.includes('--preview')) {
  const k = 8;
  const big = createImage(sheet.width * k, sheet.height * k);
  for (let y = 0; y < big.height; y++) {
    for (let x = 0; x < big.width; x++) {
      const s = ((Math.floor(y / k) * sheet.width + Math.floor(x / k)) * 4);
      const o = (y * big.width + x) * 4;
      // damero detrás, para ver la transparencia
      const bg = ((x >> 4) + (y >> 4)) % 2 ? 200 : 235;
      const a = sheet.data[s + 3] / 255;
      for (let c = 0; c < 3; c++) big.data[o + c] = Math.round(sheet.data[s + c] * a + bg * (1 - a));
      big.data[o + 3] = 255;
    }
  }
  mkdirSync(join('tmp', 'tiles'), { recursive: true });
  const p = new PNG({ width: big.width, height: big.height });
  big.data.forEach((v, i) => (p.data[i] = v));
  writeFileSync(join('tmp', 'tiles', `${biome}-x8.png`), PNG.sync.write(p));
}
