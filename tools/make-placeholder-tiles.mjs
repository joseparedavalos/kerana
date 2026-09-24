// Genera tilesets placeholder (un color por bioma) en public/assets/tiles/<bioma>.png.
// Distribución (4 columnas, tiles de 16 px; índice = fila * 4 + columna):
//   0–15  suelo con autotile (arriba = 1, derecha = 2, abajo = 4, izquierda = 8; ASSETS §6)
//   16–18 plataforma de un solo sentido (izquierda, centro, derecha)
//   19    peligro (espinas)
//   20–21 agua (superficie, fondo)
//   22    roca agrietada
//   23–25 decoración (pasto, flores, piedras)
// Uso: node tools/make-placeholder-tiles.mjs [--force]
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import { TILE, TILESET_COLUMNS, TILESET_ROWS } from './lib/tileset-layout.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'public', 'assets', 'tiles');

// Colores por bioma (GDD §9.3): suelo, borde superior, plataforma, peligro, agua.
const BIOMES = {
  cerro: { ground: '#5A5F73', top: '#2F5D3A', platform: '#8A6A4A', hazard: '#C9C2D6', water: '#3A6EA5' },
  estero: { ground: '#6B4E32', top: '#4E8C6A', platform: '#9C7A52', hazard: '#B58FD1', water: '#2E7F7A' },
  campo: { ground: '#A8472C', top: '#C9A63A', platform: '#8C5A3A', hazard: '#E0D38A', water: '#4A8FC9' },
  pueblo: { ground: '#D9D2C3', top: '#A5503A', platform: '#8A4A36', hazard: '#6E5A8C', water: '#5A86B0' },
  selva: { ground: '#3E3A2A', top: '#1F5A33', platform: '#6A5236', hazard: '#8CBF5A', water: '#2F5E5A' },
  montana: { ground: '#6A5A4A', top: '#6F7F6A', platform: '#5A4A3A', hazard: '#D9D9D9', water: '#46607A' },
  ciudad: { ground: '#3A4466', top: '#D9DCE6', platform: '#5A5F80', hazard: '#6FD9A5', water: '#23305A' },
};

function hex(c) {
  const n = parseInt(c.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const shade = ([r, g, b], f) => [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v * f))));

function makeTileset(colors) {
  const png = new PNG({ width: TILE * TILESET_COLUMNS, height: TILE * TILESET_ROWS });
  const set = (tx, ty, x, y, rgb, a = 255) => {
    if (x < 0 || y < 0 || x >= TILE || y >= TILE) return;
    const i = ((ty * TILE + y) * png.width + tx * TILE + x) * 4;
    png.data[i] = rgb[0];
    png.data[i + 1] = rgb[1];
    png.data[i + 2] = rgb[2];
    png.data[i + 3] = a;
  };
  const tile = (index, fn) => {
    const tx = index % TILESET_COLUMNS;
    const ty = Math.floor(index / TILESET_COLUMNS);
    for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) fn(x, y, (px, py, rgb, a) => set(tx, ty, px, py, rgb, a));
  };

  const ground = hex(colors.ground);
  const top = hex(colors.top);
  const edge = shade(ground, 0.6);
  const speck = shade(ground, 0.8);

  // Suelo con autotile: los lados sin vecino llevan borde.
  for (let mask = 0; mask < 16; mask++) {
    const up = mask & 1, right = mask & 2, down = mask & 4, left = mask & 8;
    tile(mask, (x, y, put) => {
      let c = (x * 7 + y * 13) % 11 === 0 ? speck : ground;
      if (!left && x === 0) c = edge;
      if (!right && x === TILE - 1) c = edge;
      if (!down && y === TILE - 1) c = edge;
      if (!up && y < 3) c = top;
      put(x, y, c);
    });
  }

  // Plataformas: tabla con borde; extremos redondeados.
  const plat = hex(colors.platform);
  for (let k = 0; k < 3; k++) {
    tile(16 + k, (x, y, put) => {
      if (y > 5) return;
      if (k === 0 && x < 2 && y > 3) return;
      if (k === 2 && x > 13 && y > 3) return;
      put(x, y, y === 0 ? shade(plat, 1.25) : y === 5 ? shade(plat, 0.6) : plat);
    });
  }

  // Espinas: triángulos en la mitad inferior.
  const spike = hex(colors.hazard);
  tile(19, (x, y, put) => {
    if (y < 7) return;
    const local = x % 4;
    const h = y - 7;
    if (Math.abs(local - 1.5) <= h / 5) put(x, y, h < 3 ? shade(spike, 1.2) : spike);
  });

  // Agua: superficie con ola y fondo.
  const water = hex(colors.water);
  tile(20, (x, y, put) => {
    if (y < 2) return;
    put(x, y, y < 4 && (x + y) % 5 < 2 ? shade(water, 1.4) : water, 200);
  });
  tile(21, (x, y, put) => put(x, y, (x * 3 + y * 5) % 17 === 0 ? shade(water, 1.2) : shade(water, 0.85), 210));

  // Roca agrietada.
  tile(22, (x, y, put) => {
    const crack = (x === 7 + (y % 3 === 0 ? 1 : 0) && y > 2) || (y === 8 && x > 3 && x < 8) || (y === 11 && x > 8 && x < 13);
    put(x, y, crack ? shade(ground, 0.4) : x === 0 || y === 0 || x === 15 || y === 15 ? edge : speck);
  });

  // Decoración: pasto, flores, piedras.
  tile(23, (x, y, put) => {
    if (y > 10 && (x % 3 === 0 || (x + y) % 5 === 0)) put(x, y, shade(top, 1.2));
  });
  tile(24, (x, y, put) => {
    if (y > 11 && x % 4 === 1) put(x, y, shade(top, 1.1));
    if (y === 11 && x % 4 === 1) put(x, y, hex('#F2C14E'));
  });
  tile(25, (x, y, put) => {
    const dx = x - 8, dy = y - 13;
    if (dx * dx + dy * dy * 3 < 20) put(x, y, shade(ground, 1.2));
  });

  return PNG.sync.write(png);
}

const force = process.argv.includes('--force');
mkdirSync(OUT_DIR, { recursive: true });
for (const [biome, colors] of Object.entries(BIOMES)) {
  const file = join(OUT_DIR, `${biome}.png`);
  if (existsSync(file) && !force) {
    console.log(`= ${biome}.png ya existe (usá --force para reemplazarlo)`);
    continue;
  }
  writeFileSync(file, makeTileset(colors));
  console.log(`+ ${biome}.png`);
}
