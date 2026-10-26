// Montaje de un tileset de bioma a partir de materiales sueltos (S56; receta en docs/RECETA-TILESET.md).
// Funciones puras sobre imágenes { width, height, data: RGBA }; el script es tools/build-tileset.mjs.
import { createImage } from './sprite-pipeline.mjs';
import { TILE, TILESET_COLUMNS, TILESET_ROWS, TILES } from './tileset-layout.mjs';

/** Fondo de las imágenes del generador: blanco o el gris claro del damero de «transparencia falsa». */
const BACKDROP_MIN = 190;
const BACKDROP_SPREAD = 28;
/** Parte de un bloque que tiene que ser dibujo para que el píxel reducido sea opaco. */
const COVERAGE = 0.5;
/** Paso al recorrer cada bloque (los JPG vienen a más de 1000 px: no hace falta leer cada píxel). */
const BLOCK_STEP = 2;

const at = (img, x, y) => (y * img.width + x) * 4;

export function isBackdrop(r, g, b) {
  return Math.min(r, g, b) >= BACKDROP_MIN && Math.max(r, g, b) - Math.min(r, g, b) <= BACKDROP_SPREAD;
}

/**
 * Máscara del fondo: los píxeles claros y grises unidos al borde de la imagen (relleno desde afuera).
 * Así el blanco que queda adentro de un dibujo (espuma, flores blancas) no se toca.
 */
export function backdropMask(img) {
  const { width, height, data } = img;
  const mask = new Uint8Array(width * height);
  const stack = [];
  const push = (x, y) => {
    const k = y * width + x;
    if (mask[k]) return;
    const i = k * 4;
    if (!isBackdrop(data[i], data[i + 1], data[i + 2])) return;
    mask[k] = 1;
    stack.push(k);
  };
  for (let x = 0; x < width; x++) {
    push(x, 0);
    push(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    push(0, y);
    push(width - 1, y);
  }
  while (stack.length) {
    const k = stack.pop();
    const x = k % width;
    const y = (k - x) / width;
    if (x > 0) push(x - 1, y);
    if (x < width - 1) push(x + 1, y);
    if (y > 0) push(x, y - 1);
    if (y < height - 1) push(x, y + 1);
  }
  return mask;
}

/** Píxel real más cercano a la mediana de cada canal: no interpola, no inventa colores. */
export function medoid(samples) {
  if (samples.length === 1) return samples[0];
  const med = [0, 1, 2].map((c) => {
    const v = samples.map((s) => s[c]).sort((a, b) => a - b);
    return v[v.length >> 1];
  });
  let best = samples[0];
  let bestD = Infinity;
  for (const s of samples) {
    const d = Math.abs(s[0] - med[0]) + Math.abs(s[1] - med[1]) + Math.abs(s[2] - med[2]);
    if (d < bestD) {
      bestD = d;
      best = s;
    }
  }
  return best;
}

/**
 * Reduce el rectángulo `rect` de `img` a `w` × `h` por bloques: cada píxel nuevo es el medoide de los píxeles
 * de dibujo de su bloque (o transparente si el dibujo no cubre `coverage`). `isInk(x, y)` dice qué es dibujo.
 */
export function reduceBlocks(img, rect, w, h, isInk = () => true, coverage = COVERAGE) {
  const out = createImage(w, h);
  const sx = rect.w / w;
  const sy = rect.h / h;
  for (let oy = 0; oy < h; oy++) {
    for (let ox = 0; ox < w; ox++) {
      const x0 = rect.x + Math.floor(ox * sx);
      const x1 = rect.x + Math.max(Math.floor((ox + 1) * sx), Math.floor(ox * sx) + 1);
      const y0 = rect.y + Math.floor(oy * sy);
      const y1 = rect.y + Math.max(Math.floor((oy + 1) * sy), Math.floor(oy * sy) + 1);
      const ink = [];
      let total = 0;
      for (let y = y0; y < y1; y += BLOCK_STEP) {
        for (let x = x0; x < x1; x += BLOCK_STEP) {
          total++;
          if (!isInk(x, y)) continue;
          const i = at(img, x, y);
          ink.push([img.data[i], img.data[i + 1], img.data[i + 2]]);
        }
      }
      if (ink.length === 0 || ink.length < total * coverage) continue;
      const c = medoid(ink);
      const o = at(out, ox, oy);
      out.data[o] = c[0];
      out.data[o + 1] = c[1];
      out.data[o + 2] = c[2];
      out.data[o + 3] = 255;
    }
  }
  return out;
}

const colorDist = (img, i, j) =>
  Math.abs(img.data[i] - img.data[j]) + Math.abs(img.data[i + 1] - img.data[j + 1]) + Math.abs(img.data[i + 2] - img.data[j + 2]);

/**
 * La ventana de `w` × `h` que mejor empalma consigo misma al repetirse: la que tiene menos diferencia de color
 * entre su última columna y la primera (y entre la última fila y la primera, con `wrapY`). Devuelve { x, y }.
 * La imagen se recorre como si se repitiera, porque los materiales vienen sin costura.
 */
export function seamlessWindow(img, w, h, { wrapY = true, rows, speck, blob } = {}) {
  let best = { x: 0, y: 0 };
  let bestCost = Infinity;
  const ys = wrapY ? img.height : 1;
  const px = (x, y) => at(img, x % img.width, y % img.height);
  // Con `speck`, castiga los píxeles que se alejan mucho del color típico: al repetirse cada 16 px, un granito
  // suelto arma una grilla de puntos que se ve más que una costura.
  // Con `blob`, castiga las manchas: los cuadros de 4 × 4 cuyo color medio se aparta del de la ventana.
  const typical = speck !== undefined || blob ? medoid(Array.from({ length: img.width * img.height }, (_, k) => [...img.data.subarray(k * 4, k * 4 + 3)])) : null;
  const speckCost = (i) => {
    const d = Math.abs(img.data[i] - typical[0]) + Math.abs(img.data[i + 1] - typical[1]) + Math.abs(img.data[i + 2] - typical[2]);
    return d > speck ? (d - speck) * 4 : 0;
  };
  const blobCost = (x, y) => {
    const means = [];
    for (let by = 0; by + 4 <= h; by += 4) {
      for (let bx = 0; bx + 4 <= w; bx += 4) {
        const m = [0, 0, 0];
        for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) for (let c = 0; c < 3; c++) m[c] += img.data[px(x + bx + i, y + by + j) + c] / 16;
        means.push(m);
      }
    }
    const avg = [0, 1, 2].map((c) => means.reduce((a, m) => a + m[c], 0) / means.length);
    return means.reduce((a, m) => a + Math.abs(m[0] - avg[0]) + Math.abs(m[1] - avg[1]) + Math.abs(m[2] - avg[2]), 0);
  };
  for (let y = 0; y < ys; y++) {
    for (let x = 0; x < img.width; x++) {
      let cost = 0;
      const checkRows = rows ?? h;
      for (let r = 0; r < checkRows; r++) cost += colorDist(img, px(x + w - 1, y + r), px(x, y + r));
      if (wrapY) for (let c = 0; c < w; c++) cost += colorDist(img, px(x + c, y + h - 1), px(x + c, y));
      if (speck !== undefined) for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) cost += speckCost(px(x + i, y + j));
      if (blob) cost += blob * blobCost(x, y);
      if (cost < bestCost) {
        bestCost = cost;
        best = { x, y };
      }
    }
  }
  return best;
}

/** Copia la ventana `w` × `h` desde (x, y), repitiendo la imagen si se pasa del borde. */
export function cropWrapped(img, x, y, w, h) {
  const out = createImage(w, h);
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const s = at(img, (x + i) % img.width, (y + j) % img.height);
      const o = at(out, i, j);
      for (let c = 0; c < 4; c++) out.data[o + c] = img.data[s + c];
    }
  }
  return out;
}

/** Dibujos sueltos de una tira: corridas de columnas con dibujo separadas por columnas vacías. */
export function findDrawings(mask, width, height, minWidth = 20) {
  const cols = new Array(width).fill(0);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (!mask[y * width + x]) cols[x]++;
  // Las manchas tenues del damero dejan columnas con pocos píxeles: no cuentan.
  const minInk = Math.max(4, Math.round(height * 0.02));
  const drawings = [];
  let start = -1;
  for (let x = 0; x <= width; x++) {
    const ink = x < width && cols[x] >= minInk;
    if (ink && start < 0) start = x;
    if (!ink && start >= 0) {
      if (x - start >= minWidth) drawings.push({ x: start, w: x - start });
      start = -1;
    }
  }
  return drawings.map(({ x, w }) => {
    let top = height;
    let bottom = -1;
    for (let y = 0; y < height; y++) {
      let n = 0;
      for (let i = x; i < x + w; i++) if (!mask[y * width + i]) n++;
      if (n >= Math.max(2, w * 0.02)) {
        top = Math.min(top, y);
        bottom = y;
      }
    }
    return { x, y: top, w, h: bottom - top + 1 };
  });
}

/** Tamaño reducido de un dibujo para que entre en `maxW` × `maxH` sin deformarse. */
export function fitSize(rect, maxW, maxH) {
  const s = Math.max(rect.w / maxW, rect.h / maxH);
  return { w: Math.max(1, Math.min(maxW, Math.round(rect.w / s))), h: Math.max(1, Math.min(maxH, Math.round(rect.h / s))) };
}

/** Pega `src` en la casilla `index` del tileset, apoyado abajo y centrado (o en `dx`, `dy`). */
export function placeInTile(sheet, index, src, { dx, dy, alpha } = {}) {
  const tx = (index % TILESET_COLUMNS) * TILE;
  const ty = Math.floor(index / TILESET_COLUMNS) * TILE;
  const ox = dx ?? Math.floor((TILE - src.width) / 2);
  const oy = dy ?? TILE - src.height;
  for (let y = 0; y < src.height; y++) {
    for (let x = 0; x < src.width; x++) {
      const s = at(src, x, y);
      if (src.data[s + 3] === 0) continue;
      const o = at(sheet, tx + ox + x, ty + oy + y);
      sheet.data[o] = src.data[s];
      sheet.data[o + 1] = src.data[s + 1];
      sheet.data[o + 2] = src.data[s + 2];
      sheet.data[o + 3] = alpha ?? src.data[s + 3];
    }
  }
}

const shade = (v, f) => Math.max(0, Math.min(255, Math.round(v * f)));

/**
 * Casilla de autotile para la máscara de vecinos `mask` (arriba 1, derecha 2, abajo 4, izquierda 8 = hay suelo).
 * Todas parten del mismo bloque `dirt` (16 × 16). Si arriba hay aire va la franja `grass` (16 × n; transparente
 * = aire entre las puntas, opaco = pasto); los costados y el fondo que dan al aire se oscurecen: la columna o
 * fila de afuera por `edge.outer` y la siguiente por `edge.inner`. Con los cuatro vecinos, el bloque liso.
 */
export function autotileCell(mask, dirt, grass, edge) {
  const out = createImage(TILE, TILE);
  const up = mask & 1, right = mask & 2, down = mask & 4, left = mask & 8;
  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      const o = at(out, x, y);
      if (!up && y < grass.height) {
        const g = at(grass, x, y);
        if (grass.data[g + 3] === 0) continue; // aire entre las puntas del pasto
        if (grass.data[g + 3] === 255) {
          for (let c = 0; c < 4; c++) out.data[o + c] = grass.data[g + c];
          continue;
        }
        // alfa intermedio: tierra del pasto, se usa la del bloque
      }
      const d = at(dirt, x, y);
      const dist = Math.min(!left ? x : TILE, !right ? TILE - 1 - x : TILE, !down ? TILE - 1 - y : TILE);
      const f = dist === 0 ? edge.outer : dist === 1 ? edge.inner : 1;
      out.data[o] = shade(dirt.data[d], f);
      out.data[o + 1] = shade(dirt.data[d + 1], f);
      out.data[o + 2] = shade(dirt.data[d + 2], f);
      out.data[o + 3] = 255;
    }
  }
  return out;
}

/**
 * Plataforma de un solo sentido (`part`: 'left', 'center', 'right'): una tabla de `rows` px arriba de la casilla,
 * con `grassRows` filas de pasto (filas de la franja tomadas a intervalos) sobre la tierra; la fila de abajo y los
 * extremos, oscurecidos como los bordes del suelo; las dos esquinas de abajo de los extremos, recortadas.
 */
export function platformCell(part, dirt, grass, edge, rows, grassRows) {
  const out = createImage(TILE, TILE);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < TILE; x++) {
      const endDist = part === 'left' ? x : part === 'right' ? TILE - 1 - x : TILE;
      if (endDist === 0 && y === rows - 1) continue;
      const o = at(out, x, y);
      if (y < grassRows) {
        const g = at(grass, x, Math.floor((y * grass.height) / grassRows));
        if (grass.data[g + 3] === 0 && y === 0) continue;
        if (grass.data[g + 3] === 255) {
          for (let c = 0; c < 4; c++) out.data[o + c] = grass.data[g + c];
          continue;
        }
      }
      const d = at(dirt, x, y);
      const dist = Math.min(endDist, rows - 1 - y);
      const f = dist === 0 ? edge.outer : dist === 1 ? edge.inner : 1;
      out.data[o] = shade(dirt.data[d], f);
      out.data[o + 1] = shade(dirt.data[d + 1], f);
      out.data[o + 2] = shade(dirt.data[d + 2], f);
      out.data[o + 3] = 255;
    }
  }
  return out;
}

/** Hoja vacía del tamaño del tileset (64 × 112). */
export function createTileset() {
  return createImage(TILE * TILESET_COLUMNS, TILE * TILESET_ROWS);
}

export { TILES };
