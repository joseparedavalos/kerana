// Recorte del arte de las piezas (hongo, reja, interruptor, balsa) a partir de JPG del generador (S58).
// Funciones puras sobre imágenes { width, height, data: RGBA }; el script es tools/build-pieces.mjs.
import { createImage } from './sprite-pipeline.mjs';
import { backdropMask, isBackdrop } from './tileset-build.mjs';

const at = (img, x, y) => (y * img.width + x) * 4;

/**
 * Máscara del fondo (1 = fondo): el damero unido al borde (`backdropMask`) más los huecos cerrados de color de
 * fondo con `minArea` píxeles o más. Entre los barrotes de la reja, el damero queda encerrado por los travesaños:
 * el relleno desde afuera no llega. Los blancos chicos de adentro (brillos, espuma) quedan, porque miden menos.
 */
export function pieceMask(img, minArea = Infinity) {
  const mask = backdropMask(img);
  if (!Number.isFinite(minArea)) return mask;
  const { width, height, data } = img;
  const seen = new Uint8Array(width * height);
  const isBg = (k) => isBackdrop(data[k * 4], data[k * 4 + 1], data[k * 4 + 2]);
  for (let k = 0; k < width * height; k++) {
    if (mask[k] || seen[k] || !isBg(k)) continue;
    const region = [k];
    seen[k] = 1;
    for (let n = 0; n < region.length; n++) {
      const q = region[n];
      const x = q % width;
      const y = (q - x) / width;
      const near = [x > 0 ? q - 1 : -1, x < width - 1 ? q + 1 : -1, y > 0 ? q - width : -1, y < height - 1 ? q + width : -1];
      for (const p of near) {
        if (p < 0 || seen[p] || mask[p] || !isBg(p)) continue;
        seen[p] = 1;
        region.push(p);
      }
    }
    if (region.length >= minArea) for (const q of region) mask[q] = 1;
  }
  return mask;
}

/**
 * Caja del dibujo dentro de `rect`: filas y columnas con al menos `minInk` píxeles de dibujo (las manchas sueltas
 * del damero que quedan pegadas no cuentan).
 */
export function inkBounds(mask, width, rect, minInk = 4) {
  const cols = new Array(rect.w).fill(0);
  const rows = new Array(rect.h).fill(0);
  for (let y = 0; y < rect.h; y++) {
    for (let x = 0; x < rect.w; x++) {
      if (mask[(rect.y + y) * width + rect.x + x]) continue;
      cols[x]++;
      rows[y]++;
    }
  }
  const first = (a) => a.findIndex((v) => v >= minInk);
  const last = (a) => a.length - 1 - [...a].reverse().findIndex((v) => v >= minInk);
  const x0 = first(cols);
  const y0 = first(rows);
  if (x0 < 0 || y0 < 0) return null;
  return { x: rect.x + x0, y: rect.y + y0, w: last(cols) - x0 + 1, h: last(rows) - y0 + 1 };
}

/** Copia de `img` sin las filas [from, from + count): achica el tallo del hongo sin deformar el resto. */
export function dropRows(img, from, count) {
  if (count <= 0) return img;
  const out = createImage(img.width, img.height - count);
  for (let y = 0; y < out.height; y++) {
    const sy = y < from ? y : y + count;
    out.data.set(img.data.subarray(at(img, 0, sy), at(img, 0, sy + 1)), at(out, 0, y));
  }
  return out;
}

/** Filas [y, y + h) de `img`, enteras. */
export function sliceRows(img, y, h) {
  const out = createImage(img.width, h);
  out.data.set(img.data.subarray(at(img, 0, y), at(img, 0, y + h)));
  return out;
}

/** Primera fila con al menos `fraction` del ancho opaco: la superficie de la balsa (las flores asoman por encima). */
export function surfaceRow(img, fraction = 0.5) {
  for (let y = 0; y < img.height; y++) {
    let n = 0;
    for (let x = 0; x < img.width; x++) if (img.data[at(img, x, y) + 3]) n++;
    if (n >= img.width * fraction) return y;
  }
  return -1;
}

/**
 * Corrimiento horizontal entre dos dibujos iguales (el interruptor apagado y el encendido): compara las columnas
 * con dibujo de las filas `rows` (el poste, que no tiene resplandor) y devuelve cuánto hay que correr el primero.
 */
export function alignColumns(mask, width, rowsFrom, rowsTo, a, b) {
  const center = (rect) => {
    let sum = 0;
    let n = 0;
    for (let y = rowsFrom; y < rowsTo; y++) {
      for (let x = rect.x; x < rect.x + rect.w; x++) {
        if (mask[y * width + x]) continue;
        sum += x;
        n++;
      }
    }
    return n ? sum / n : rect.x;
  };
  return Math.round(center(b) - center(a));
}
