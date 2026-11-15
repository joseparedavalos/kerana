// Fondos de los niveles y del final (docs/ASSETS.md §6-7): raw/backgrounds/*.jpg|png → public/assets/backgrounds/*.jpg
// a 1280 × 720 (se dibujan a escala 0,5: doble detalle, como Kerana). Se guardan en JPEG para que pesen poco.
// S92: un fondo vertical (TALL) no se aplasta a 720: se le recorta el borde y sale a 1280 de ancho en su proporción.
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import jpeg from 'jpeg-js';
import { PNG } from 'pngjs';
import { resizeImage } from './lib/sprite-pipeline.mjs';

const RAW = 'raw/backgrounds';
const OUT = 'public/assets/backgrounds';
const WIDTH = 1280;
const HEIGHT = 720;
/** Calidad del JPEG de salida (0-100). */
const QUALITY = 85;

/** Retoques sobre el original (coordenadas del .jpg): discos que se tapan con el cielo de alrededor. */
const PATCHES = {
  // Yvága: sobra una estrella (la más chica) con su brillo.
  yvaga_far: [{ x: 895, y: 425, r: 40 }],
};
/**
 * Fondos verticales (S92): el nivel los recorre de abajo arriba (`climb` en levels.ts), así que conservan su proporción.
 * `crop`: filas del original que se descartan arriba y abajo (el borde que trae la exportación).
 */
const TALL = {
  // La subida a Yvága, 1008 × 1792: del mar de nubes (abajo) a la noche con estrellas (arriba).
  yvaga_subida: { crop: { top: 3, bottom: 6 } },
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
/** Lee un .jpg o .png como RGBA. */
function readImage(file) {
  if (/\.png$/i.test(file)) {
    const png = PNG.sync.read(readFileSync(file));
    return { width: png.width, height: png.height, data: new Uint8Array(png.data) };
  }
  const src = jpeg.decode(readFileSync(file), { useTArray: true, formatAsRGBA: true, maxMemoryUsageInMB: 256 });
  return { width: src.width, height: src.height, data: new Uint8Array(src.data) };
}

/** La imagen sin sus primeras `top` filas ni sus últimas `bottom`. */
function cropRows(img, top, bottom) {
  const height = img.height - top - bottom;
  const row = img.width * 4;
  return { width: img.width, height, data: img.data.slice(top * row, (top + height) * row) };
}

/** Escala por vecino más cercano (para agrandar: cada píxel de salida copia el del original que le toca). */
function scaleNearest(img, width, height) {
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    const sy = Math.min(img.height - 1, Math.floor(((y + 0.5) * img.height) / height));
    for (let x = 0; x < width; x++) {
      const sx = Math.min(img.width - 1, Math.floor(((x + 0.5) * img.width) / width));
      const i = (sy * img.width + sx) * 4;
      data.set(img.data.subarray(i, i + 4), (y * width + x) * 4);
    }
  }
  return { width, height, data };
}

for (const file of readdirSync(RAW).filter((f) => /\.(jpe?g|png)$/i.test(f))) {
  const name = basename(file).replace(/\.(jpe?g|png)$/i, '');
  const img = readImage(join(RAW, file));
  for (const p of PATCHES[name] ?? []) patchDisc(img, p.x, p.y, p.r);
  const tall = TALL[name];
  const src = tall ? cropRows(img, tall.crop.top, tall.crop.bottom) : img;
  // El muestreo por moda de `resizeImage` es para achicar: agrandando deja píxeles vacíos (una rejilla negra).
  const out = tall ? scaleNearest(src, WIDTH, Math.round((src.height * WIDTH) / src.width)) : resizeImage(src, WIDTH, HEIGHT);
  const data = Buffer.from(out.data.buffer, out.data.byteOffset, out.data.length);
  const jpg = jpeg.encode({ width: out.width, height: out.height, data }, QUALITY);
  writeFileSync(join(OUT, `${name}.jpg`), jpg.data);
  console.log(`backgrounds/${name}.jpg: ${img.width}×${img.height} → ${out.width}×${out.height} (${Math.round(jpg.data.length / 1024)} KB)`);
}
