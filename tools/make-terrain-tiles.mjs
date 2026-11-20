// Tilesets dibujados por código, por bioma (S109 para cerro; S110 generalizado y estero). Por cada bioma escribe
// public/assets/tiles/<bioma>.png (las 28 casillas de siempre) y public/assets/tiles/detalle/<bioma>.png + .json
// (variantes y calcomanías). El arte de cada uno está en tools/lib/<bioma>-art.mjs; lo común, en tools/lib/tile-art.mjs.
// S111: un bioma cuyo tileset es arte real (campo, montado en S56 con `npm run tileset`) no exporta `buildTileset`: de
// ese solo se escribe la hoja de detalle, y su PNG de las 28 casillas queda como está.
// Uso: npm run terrain-tiles [-- <bioma>…] (sin bioma: todos) · npm run cerro-tiles · --preview deja tmp/tiles/<bioma>-x8.png
// y <bioma>-detalle-x8.png. Todo sale de semillas fijas: siempre los mismos bytes. No usa raw/ ni npm run tileset.
import { mkdirSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';

export const BIOMES = {
  cerro: () => import('./lib/cerro-art.mjs'),
  estero: () => import('./lib/estero-art.mjs'),
  campo: () => import('./lib/campo-art.mjs'),
  pueblo: () => import('./lib/pueblo-art.mjs'),
};

const toPng = (img) => {
  const png = new PNG({ width: img.width, height: img.height });
  png.data = Buffer.from(img.data);
  return PNG.sync.write(png);
};

/** La hoja ampliada × 8 sobre un damero, con la grilla de 16 px marcada. */
function preview(img, S = 8) {
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
  return big;
}

const args = process.argv.slice(2);
const wanted = args.filter((a) => !a.startsWith('--'));
for (const name of wanted) if (!BIOMES[name]) throw new Error(`bioma sin arte por código: ${name} (hay: ${Object.keys(BIOMES).join(', ')})`);
for (const name of wanted.length ? wanted : Object.keys(BIOMES)) {
  const art = await BIOMES[name]();
  const tileset = art.buildTileset ? art.buildTileset() : null;
  const { img: detail, layout } = art.buildDetail();
  if (tileset) writeFileSync(`public/assets/tiles/${name}.png`, toPng(tileset));
  mkdirSync('public/assets/tiles/detalle', { recursive: true });
  writeFileSync(`public/assets/tiles/detalle/${name}.png`, toPng(detail));
  writeFileSync(`public/assets/tiles/detalle/${name}.json`, JSON.stringify(layout, null, 1) + '\n');
  const what = tileset ? `${name}.png ${tileset.width} × ${tileset.height}` : `${name}.png sin tocar (arte real${art.tilesetMd5 ? `, md5 ${art.tilesetMd5()}` : ''})`;
  console.log(`${what}; detalle/${name}.png ${detail.width} × ${detail.height} (${layout.count} casillas)`);
  if (args.includes('--preview')) {
    mkdirSync('tmp/tiles', { recursive: true });
    if (tileset) writeFileSync(`tmp/tiles/${name}-x8.png`, toPng(preview(tileset)));
    writeFileSync(`tmp/tiles/${name}-detalle-x8.png`, toPng(preview(detail)));
    console.log(`vista previa: ${tileset ? `tmp/tiles/${name}-x8.png, ` : ''}tmp/tiles/${name}-detalle-x8.png`);
  }
}
