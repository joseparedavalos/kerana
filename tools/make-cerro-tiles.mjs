// Tileset de cerro (l1) por código (S109): escribe public/assets/tiles/cerro.png (las 28 casillas de siempre) y
// public/assets/tiles/detalle/cerro.png + cerro.json (variantes del relleno y calcomanías de detalle).
// Uso: npm run cerro-tiles   (o node tools/make-cerro-tiles.mjs [--preview]: deja tmp/tiles/cerro-x8.png y detalle-x8.png)
// No usa raw/tiles/cerro/ (esos materiales son de montana, l6). Todo sale de una semilla: siempre los mismos bytes.
import { mkdirSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { buildCerroDetail, buildCerroTileset } from './lib/cerro-art.mjs';

const toPng = (img) => {
  const png = new PNG({ width: img.width, height: img.height });
  png.data = Buffer.from(img.data);
  return PNG.sync.write(png);
};

const tileset = buildCerroTileset();
const { img: detail, layout } = buildCerroDetail();
writeFileSync('public/assets/tiles/cerro.png', toPng(tileset));
mkdirSync('public/assets/tiles/detalle', { recursive: true });
writeFileSync('public/assets/tiles/detalle/cerro.png', toPng(detail));
writeFileSync('public/assets/tiles/detalle/cerro.json', JSON.stringify(layout, null, 1) + '\n');
console.log(`cerro.png ${tileset.width} × ${tileset.height}; detalle/cerro.png ${detail.width} × ${detail.height} (${layout.count} casillas)`);

if (process.argv.includes('--preview')) {
  mkdirSync('tmp/tiles', { recursive: true });
  for (const [name, img] of [['cerro', tileset], ['detalle', detail]]) {
    const S = 8;
    const big = { width: img.width * S, height: img.height * S, data: new Uint8Array(img.width * S * img.height * S * 4) };
    for (let y = 0; y < big.height; y++) {
      for (let x = 0; x < big.width; x++) {
        const o = (y * big.width + x) * 4;
        const check = ((x >> 4) + (y >> 4)) % 2 ? 70 : 100;
        const i = (Math.floor(y / S) * img.width + Math.floor(x / S)) * 4;
        const a = img.data[i + 3] / 255;
        const edge = x % (16 * S) === 0 || y % (16 * S) === 0;
        for (let c = 0; c < 3; c++) big.data[o + c] = edge ? 255 : Math.round(img.data[i + c] * a + check * (1 - a));
        big.data[o + 3] = 255;
      }
    }
    writeFileSync(`tmp/tiles/${name}-x8.png`, toPng(big));
  }
  console.log('vista previa: tmp/tiles/cerro-x8.png, tmp/tiles/detalle-x8.png');
}
