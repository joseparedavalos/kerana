// Fondos de los niveles (docs/ASSETS.md §6): raw/backgrounds/*.jpg → public/assets/backgrounds/*.png a 1280 × 720
// (se dibujan a escala 0,5: doble detalle, como Kerana). Los .png de raw/backgrounds los sigue procesando `npm run sprites`.
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import jpeg from 'jpeg-js';
import { PNG } from 'pngjs';
import { resizeImage } from './lib/sprite-pipeline.mjs';

const RAW = 'raw/backgrounds';
const OUT = 'public/assets/backgrounds';
const WIDTH = 1280;
const HEIGHT = 720;

/** Retoques sobre el original (coordenadas del .jpg): discos que se tapan con el cielo de alrededor. */
const PATCHES = {
  // Yvága: sobra una estrella (la más chica) con su brillo.
  yvaga_far: [{ x: 895, y: 425, r: 40 }],
};
/** Margen del borde que se muestrea para rellenar el disco (px). */
const PATCH_RING = 4;

/**
 * Tapa un disco interpolando, fila por fila, entre el cielo de la izquierda y el de la derecha del borde:
 * así respeta el degradé vertical y horizontal.
 */
function patchDisc(img, cx, cy, r) {
  const { width, data } = img;
  const sample = (x0, x1, y) => {
    const acc = [0, 0, 0];
    let n = 0;
    for (let x = Math.max(0, x0); x <= Math.min(width - 1, x1); x++) {
      const i = (y * width + x) * 4;
      for (let c = 0; c < 3; c++) acc[c] += data[i + c];
      n++;
    }
    return acc.map((v) => v / Math.max(1, n));
  };
  for (let dy = -r; dy <= r; dy++) {
    const y = cy + dy;
    if (y < 0 || y >= img.height) continue;
    const half = Math.round(Math.sqrt(r * r - dy * dy));
    const left = sample(cx - half - PATCH_RING, cx - half - 1, y);
    const right = sample(cx + half + 1, cx + half + PATCH_RING, y);
    for (let dx = -half; dx <= half; dx++) {
      const t = half === 0 ? 0.5 : (dx + half) / (2 * half);
      const i = (y * width + cx + dx) * 4;
      for (let c = 0; c < 3; c++) data[i + c] = Math.round(left[c] + (right[c] - left[c]) * t);
    }
  }
}

if (!existsSync(RAW)) {
  console.log('No hay raw/backgrounds/: nada que procesar.');
  process.exit(0);
}
mkdirSync(OUT, { recursive: true });
for (const file of readdirSync(RAW).filter((f) => /\.jpe?g$/i.test(f))) {
  const name = basename(file).replace(/\.jpe?g$/i, '');
  const src = jpeg.decode(readFileSync(join(RAW, file)), { useTArray: true, formatAsRGBA: true, maxMemoryUsageInMB: 256 });
  const img = { width: src.width, height: src.height, data: new Uint8Array(src.data) };
  for (const p of PATCHES[name] ?? []) patchDisc(img, p.x, p.y, p.r);
  const out = resizeImage(img, WIDTH, HEIGHT);
  const png = new PNG({ width: out.width, height: out.height });
  png.data = Buffer.from(out.data.buffer, out.data.byteOffset, out.data.length);
  writeFileSync(join(OUT, `${name}.png`), PNG.sync.write(png));
  console.log(`backgrounds/${name}.png: ${src.width}×${src.height} → ${out.width}×${out.height}`);
}
