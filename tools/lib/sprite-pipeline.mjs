// Lógica pura del pipeline de sprites (docs/ASSETS.md §2). Sin dependencias nativas:
// las imágenes son { width, height, data } en RGBA (el mismo formato que pngjs).

/** Umbral de alfa para considerar un píxel opaco. */
const ALPHA_SOLID = 128;
/** Distancia máxima (RGB) al magenta #FF00FF para tratarlo como fondo (Chroma key). */
const MAGENTA_TOLERANCE = 90;
/** Fracción mínima de cobertura opaca de un bloque para que el píxel de salida sea opaco. */
const COVERAGE_MIN = 0.5;
/** Banda de la cintura (fracción de la altura de referencia sobre los pies) para alinear en X. */
const WAIST_BAND = [0.35, 0.5];

export const DEFAULTS = {
  frame: [64, 64],
  /** Altura visible del personaje en el juego (px); GDD §9.2: Kerana ≈ 44 a 48. */
  height: 46,
  /** Píxeles de textura por unidad del mundo: el juego dibuja el sprite a escala 1/detail (GDD §9). */
  detail: 1,
};

/** `idle_8x1.png` → { anim: 'idle', cols: 8, rows: 1 }. */
export function parseSheetName(file) {
  const m = /^(.+)_(\d+)x(\d+)\.png$/i.exec(file);
  if (!m) return null;
  return { anim: m[1], cols: Number(m[2]), rows: Number(m[3]) };
}

export function createImage(width, height) {
  return { width, height, data: new Uint8Array(width * height * 4) };
}

/**
 * Quita el fondo: si la hoja no trae transparencia, borra el magenta (Chroma key). Modifica `img`.
 * `tolerance`: distancia RGB al magenta (los JPG lo dejan desparejo: piden más).
 */
export function removeBackground(img, tolerance = MAGENTA_TOLERANCE) {
  const d = img.data;
  let hasAlpha = false;
  for (let i = 3; i < d.length; i += 4) {
    if (d[i] < 255) {
      hasAlpha = true;
      break;
    }
  }
  if (hasAlpha) return 'alpha';
  for (let i = 0; i < d.length; i += 4) {
    const dr = 255 - d[i];
    const dg = d[i + 1];
    const db = 255 - d[i + 2];
    if (dr * dr + dg * dg + db * db <= tolerance * tolerance) d[i + 3] = 0;
  }
  return 'magenta';
}

/** Cuánto más verde que rojo y azul tiene que ser un píxel del contorno para tratarlo como resto del Chroma key. */
const GREEN_EDGE_MARGIN = 30;
/** Celeste del contorno de los props (verde y azul sobre el rojo). */
const CYAN_EDGE_MARGIN = 25;
/** Rosado del contorno de los íconos en JPG (rojo y azul sobre el verde). */
const MAGENTA_EDGE_MARGIN = 40;

/** Predicados de color del contorno (r, g, b) → es resto del Chroma key. */
export const EDGE_COLORS = {
  green: (r, g, b) => g - r >= GREEN_EDGE_MARGIN && g - b >= GREEN_EDGE_MARGIN,
  cyan: (r, g, b) => g - r >= CYAN_EDGE_MARGIN && b - r >= CYAN_EDGE_MARGIN,
  magenta: (r, g, b) => r - g >= MAGENTA_EDGE_MARGIN && b - g >= MAGENTA_EDGE_MARGIN,
};

/**
 * Borra el borde de color que deja el Chroma key: solo píxeles opacos del contorno (vecinos de un
 * transparente) que cumplen `isEdgeColor`. Repite `passes` veces (el borde puede tener más de un píxel).
 * Modifica `img` y devuelve cuántos píxeles borró.
 */
export function removeColorEdge(img, passes, isEdgeColor) {
  const { width: w, height: h, data: d } = img;
  let removed = 0;
  for (let p = 0; p < passes; p++) {
    const kill = [];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        if (d[i + 3] < ALPHA_SOLID) continue;
        if (!isEdgeColor(d[i], d[i + 1], d[i + 2])) continue;
        const edge =
          x === 0 || y === 0 || x === w - 1 || y === h - 1 ||
          d[i - 4 + 3] < ALPHA_SOLID || d[i + 4 + 3] < ALPHA_SOLID ||
          d[i - w * 4 + 3] < ALPHA_SOLID || d[i + w * 4 + 3] < ALPHA_SOLID;
        if (edge) kill.push(i);
      }
    }
    if (kill.length === 0) break;
    for (const i of kill) d[i + 3] = 0;
    removed += kill.length;
  }
  return removed;
}

/**
 * Borde verde del Chroma key (Tau, enemigos sin verde propio, la vaca). `margin`: cuánto más verde que rojo y
 * azul tiene que ser (más bajo toma también los verdes oliva que quedan al mezclarse con el contorno).
 */
export function removeGreenEdge(img, passes = 3, margin = GREEN_EDGE_MARGIN) {
  const isEdge = margin === GREEN_EDGE_MARGIN ? EDGE_COLORS.green : (r, g, b) => g - r >= margin && g - b >= margin;
  return removeColorEdge(img, passes, isEdge);
}

/** Celdas de la hoja (rectángulos en píxeles de origen), de izquierda a derecha y de arriba abajo. */
export function sliceCells(img, cols, rows) {
  const cells = [];
  const cw = img.width / cols;
  const ch = img.height / rows;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x0 = Math.floor(c * cw);
      const y0 = Math.floor(r * ch);
      cells.push({ x: x0, y: y0, w: Math.floor((c + 1) * cw) - x0, h: Math.floor((r + 1) * ch) - y0 });
    }
  }
  return cells;
}

const isSolid = (img, x, y) => img.data[(y * img.width + x) * 4 + 3] >= ALPHA_SOLID;

/** Caja de lo opaco dentro de `rect` (coordenadas absolutas, bordes incluidos) o null si está vacía. */
export function opaqueBounds(img, rect) {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -1;
  let y1 = -1;
  for (let y = rect.y; y < rect.y + rect.h; y++) {
    for (let x = rect.x; x < rect.x + rect.w; x++) {
      if (!isSolid(img, x, y)) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  return x1 < 0 ? null : { x0, y0, x1, y1 };
}

/** X media de lo opaco en la banda de la cintura: ancla horizontal estable aunque el sable o la estela se muevan. */
export function waistAnchorX(img, rect, bottom, refHeight) {
  const yTop = Math.max(rect.y, Math.round(bottom - WAIST_BAND[1] * refHeight));
  const yBot = Math.min(rect.y + rect.h, Math.round(bottom - WAIST_BAND[0] * refHeight));
  let sum = 0;
  let n = 0;
  for (let y = yTop; y < yBot; y++) {
    for (let x = rect.x; x < rect.x + rect.w; x++) {
      if (isSolid(img, x, y)) {
        sum += x;
        n++;
      }
    }
  }
  return n > 0 ? sum / n + 0.5 : rect.x + rect.w / 2;
}

/**
 * Tamaño aparente del "píxel" del arte (arte pixel escalado): el divisor entero que mejor explica
 * los largos de las rachas de color en las filas. Devuelve 1 si no hay un patrón claro.
 */
export function detectPixelSize(img, rect, maxSize = 32) {
  const runs = [];
  const d = img.data;
  const step = Math.max(1, Math.floor(rect.h / 64));
  for (let y = rect.y; y < rect.y + rect.h; y += step) {
    let start = rect.x;
    for (let x = rect.x + 1; x <= rect.x + rect.w; x++) {
      const i = (y * img.width + x) * 4;
      const j = (y * img.width + x - 1) * 4;
      const same =
        x < rect.x + rect.w &&
        Math.abs(d[i] - d[j]) + Math.abs(d[i + 1] - d[j + 1]) + Math.abs(d[i + 2] - d[j + 2]) < 24 &&
        d[i + 3] >= ALPHA_SOLID === d[j + 3] >= ALPHA_SOLID;
      if (!same) {
        if (d[j + 3] >= ALPHA_SOLID) runs.push(x - start);
        start = x;
      }
    }
  }
  if (runs.length < 20) return 1;
  let best = 1;
  let bestScore = 0;
  for (let p = 2; p <= maxSize; p++) {
    let fit = 0;
    for (const r of runs) {
      const k = Math.round(r / p);
      if (k >= 1 && Math.abs(r - k * p) <= Math.floor(p * 0.1)) fit++;
    }
    const score = fit / runs.length;
    // Se exige un encaje alto; a igual encaje, gana el tamaño mayor (los divisores también encajan).
    if (score >= 0.8 && score >= bestScore - 0.02) {
      best = p;
      bestScore = Math.max(bestScore, score);
    }
  }
  return best;
}

/**
 * Reduce con "moda": cada píxel de salida toma el color más frecuente de su bloque de origen
 * (colores nítidos, sin mezclas borrosas). `sampleAt(dx, dy)` da el centro del bloque en el origen.
 */
function resampleInto(src, dst, dstX, dstY, w, h, blockSize, sampleAt, clip, coverageMin = COVERAGE_MIN) {
  const half = blockSize / 2;
  const bins = new Map();
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      const [cx, cy] = sampleAt(dx, dy);
      const sx0 = Math.max(clip.x, Math.round(cx - half));
      const sx1 = Math.min(clip.x + clip.w, Math.round(cx + half));
      const sy0 = Math.max(clip.y, Math.round(cy - half));
      const sy1 = Math.min(clip.y + clip.h, Math.round(cy + half));
      if (sx1 <= sx0 || sy1 <= sy0) continue;
      const total = Math.max(1, Math.round(blockSize) ** 2);
      bins.clear();
      let solid = 0;
      for (let y = sy0; y < sy1; y++) {
        for (let x = sx0; x < sx1; x++) {
          const i = (y * src.width + x) * 4;
          if (src.data[i + 3] < ALPHA_SOLID) continue;
          solid++;
          // Colores agrupados a 5 bits por canal; la salida es el promedio del grupo ganador.
          const key = ((src.data[i] >> 3) << 10) | ((src.data[i + 1] >> 3) << 5) | (src.data[i + 2] >> 3);
          let b = bins.get(key);
          if (!b) bins.set(key, (b = [0, 0, 0, 0]));
          b[0]++;
          b[1] += src.data[i];
          b[2] += src.data[i + 1];
          b[3] += src.data[i + 2];
        }
      }
      if (solid / total < coverageMin) continue;
      let win = null;
      for (const b of bins.values()) if (!win || b[0] > win[0]) win = b;
      const o = ((dstY + dy) * dst.width + dstX + dx) * 4;
      dst.data[o] = Math.round(win[1] / win[0]);
      dst.data[o + 1] = Math.round(win[2] / win[0]);
      dst.data[o + 2] = Math.round(win[3] / win[0]);
      dst.data[o + 3] = 255;
    }
  }
}

/** `greenEdge` de sprite.json → pasadas: true = 3, un número = esas pasadas, falso = ninguna. */
export function greenEdgePasses(value) {
  if (value === true) return 3;
  return typeof value === 'number' && value > 0 ? Math.floor(value) : 0;
}

/** Borra (alfa 0) las `n` filas de abajo de la celda `rect`. Modifica `img`. */
export function clearBottomRows(img, rect, n) {
  const y0 = Math.max(rect.y, rect.y + rect.h - n);
  for (let y = y0; y < rect.y + rect.h; y++) {
    for (let x = rect.x; x < rect.x + rect.w; x++) img.data[(y * img.width + x) * 4 + 3] = 0;
  }
}

/** Unión de las cajas opacas en coordenadas de celda → centro en X y borde de abajo (exclusivo). */
function cellUnion(cells, bounds) {
  let x0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  bounds.forEach((b, i) => {
    if (!b) return;
    x0 = Math.min(x0, b.x0 - cells[i].x);
    x1 = Math.max(x1, b.x1 - cells[i].x);
    y1 = Math.max(y1, b.y1 - cells[i].y);
  });
  return { cx: (x0 + x1 + 1) / 2, bottom: y1 + 1 };
}

/** Convierte `[desde, hasta]` (índices 0) → lista de índices. */
function rangeToList(range, count) {
  if (!range) return Array.from({ length: count }, (_, i) => i);
  const [a, b = a] = range;
  const out = [];
  for (let i = a; i <= b; i++) out.push(i);
  return out;
}

/**
 * Procesa las hojas de un personaje y devuelve { image, meta, summary }.
 * `sheets`: [{ anim, cols, rows, img }]. `config`: contenido de sprite.json (opcional).
 */
export function processCharacter(name, sheets, config = {}) {
  const [fw, fh] = config.frame ?? DEFAULTS.frame;
  const targetHeight = config.height ?? DEFAULTS.height;
  const frames = [];
  const sheetInfo = {};

  for (const sheet of sheets) {
    const opts = config.sheets?.[sheet.anim] ?? {};
    let bg = removeBackground(sheet.img);
    const passes = greenEdgePasses(opts.greenEdge ?? config.greenEdge);
    const margin = opts.greenEdgeMargin ?? config.greenEdgeMargin;
    if (passes > 0) bg += ` · borde verde −${removeGreenEdge(sheet.img, passes, margin)}px`;
    const cells = sliceCells(sheet.img, sheet.cols, sheet.rows);
    if (opts.cropBottom > 0) for (const c of cells) clearBottomRows(sheet.img, c, opts.cropBottom);
    const bounds = cells.map((c) => opaqueBounds(sheet.img, c));
    // align 'cell': una sola ancla para toda la hoja (centro de abajo de la unión de las cajas, relativa a la celda).
    const union = opts.align === 'cell' ? cellUnion(cells, bounds) : null;
    // Escala por hoja (no por frame): la altura del frame de pie (`ref`) pasa a `height`.
    const refIndex = opts.ref ?? 0;
    const ref = bounds[refIndex] ?? bounds.find(Boolean);
    if (!ref) throw new Error(`${name}/${sheet.anim}: la hoja está vacía`);
    const refHeight = ref.y1 - ref.y0 + 1;
    let scale = targetHeight / refHeight;
    const pixelSize = detectPixelSize(sheet.img, cells[refIndex] ?? cells[0]);
    if (config.snapPixel && pixelSize > 1) scale = 1 / pixelSize;
    const blockSize = 1 / scale;

    const first = frames.length;
    cells.forEach((cell, i) => {
      const img = createImage(fw, fh);
      const b = bounds[i];
      if (b) {
        let sampleAt;
        if (union) {
          // Conserva la posición del dibujo en su celda: misma ancla para todos los cuadros.
          const anchorX = cell.x + union.cx;
          const bottom = cell.y + union.bottom;
          sampleAt = (dx, dy) => [anchorX + (dx + 0.5 - fw / 2) * blockSize, bottom + (dy + 0.5 - fh) * blockSize];
        } else {
          // Pies (borde inferior de lo opaco) en la última fila, o lo más alto en la primera (align 'top');
          // cintura centrada en X.
          const bottom = b.y1 + 1;
          const anchorX =
            opts.anchor === 'cell' ? cell.x + cell.w / 2 : waistAnchorX(sheet.img, cell, bottom, refHeight);
          sampleAt =
            opts.align === 'top'
              ? (dx, dy) => [anchorX + (dx + 0.5 - fw / 2) * blockSize, b.y0 + (dy + 0.5) * blockSize]
              : (dx, dy) => [anchorX + (dx + 0.5 - fw / 2) * blockSize, bottom + (dy + 0.5 - fh) * blockSize];
        }
        resampleInto(sheet.img, img, 0, 0, fw, fh, blockSize, sampleAt, cell);
      }
      frames.push(img);
    });
    sheetInfo[sheet.anim] = { first, count: cells.length, scale, pixelSize, background: bg, refHeight };
  }

  // Empaquetado en una grilla casi cuadrada de frames iguales (cargable como spritesheet de Phaser).
  const cols = Math.max(1, Math.ceil(Math.sqrt(frames.length)));
  const rows = Math.max(1, Math.ceil(frames.length / cols));
  const image = createImage(cols * fw, rows * fh);
  frames.forEach((f, i) => {
    const ox = (i % cols) * fw;
    const oy = Math.floor(i / cols) * fh;
    for (let y = 0; y < fh; y++) {
      image.data.set(f.data.subarray(y * fw * 4, (y + 1) * fw * 4), ((oy + y) * image.width + ox) * 4);
    }
  });

  // Animaciones: por defecto una por hoja; sprite.json puede recortar (`frames`) o sacar de otra hoja (`source`).
  const animDefs = config.anims ?? {};
  const animNames = new Set([...Object.keys(sheetInfo).filter((a) => !animDefs[a]?.skip), ...Object.keys(animDefs)]);
  const anims = {};
  for (const anim of animNames) {
    const def = animDefs[anim] ?? {};
    if (def.skip) continue;
    const src = sheetInfo[def.source ?? anim];
    if (!src) throw new Error(`${name}: la animación "${anim}" no tiene hoja (${def.source ?? anim})`);
    const list = def.list ?? rangeToList(def.frames, src.count);
    for (const i of list) {
      if (i < 0 || i >= src.count) throw new Error(`${name}/${anim}: frame ${i} fuera de la hoja (0..${src.count - 1})`);
    }
    anims[`${name}_${anim}`] = {
      frames: list.map((i) => src.first + i),
      frameRate: def.fps ?? 10,
      repeat: def.loop ? -1 : 0,
    };
  }

  const detail = config.detail ?? DEFAULTS.detail;
  const meta = { key: name, frameWidth: fw, frameHeight: fh, frames: frames.length, detail, anims };
  const summary = Object.entries(sheetInfo).map(
    ([anim, s]) =>
      `  ${anim}: ${s.count} frames · escala ${s.scale.toFixed(4)} (ref ${s.refHeight}px → ${targetHeight}px) · píxel aparente ${s.pixelSize} · fondo ${s.background}`,
  );
  summary.push(`  → ${image.width}×${image.height} (${frames.length} frames de ${fw}×${fh}, detail ${detail}); animaciones: ${Object.keys(anims).join(', ')}`);
  return { image, meta, summary };
}

/**
 * Escala una imagen entera a `w`×`h` con muestreo por moda (fondos, retratos, íconos).
 * `coverageMin`: cobertura opaca mínima de un bloque (más baja conserva contornos finos en diagonal).
 */
export function resizeImage(src, w, h, coverageMin = COVERAGE_MIN) {
  const dst = createImage(w, h);
  const bx = src.width / w;
  const by = src.height / h;
  resampleInto(src, dst, 0, 0, w, h, Math.max(bx, by), (dx, dy) => [(dx + 0.5) * bx, (dy + 0.5) * by], {
    x: 0,
    y: 0,
    w: src.width,
    h: src.height,
  }, coverageMin);
  return dst;
}

/** Recorte central al aspecto `w`:`h` y escala (retratos 96×96). */
export function coverImage(src, w, h) {
  const aspect = w / h;
  let cw = src.width;
  let ch = Math.round(cw / aspect);
  if (ch > src.height) {
    ch = src.height;
    cw = Math.round(ch * aspect);
  }
  const crop = createImage(cw, ch);
  const ox = Math.floor((src.width - cw) / 2);
  const oy = Math.floor((src.height - ch) / 2);
  for (let y = 0; y < ch; y++) {
    crop.data.set(src.data.subarray(((oy + y) * src.width + ox) * 4, ((oy + y) * src.width + ox + cw) * 4), y * cw * 4);
  }
  return resizeImage(crop, w, h);
}

/** Recorta la imagen a la caja de sus píxeles opacos (null si está vacía). */
export function cropToContent(src) {
  const b = opaqueBounds(src, { x: 0, y: 0, w: src.width, h: src.height });
  if (!b) return null;
  const w = b.x1 - b.x0 + 1;
  const h = b.y1 - b.y0 + 1;
  const out = createImage(w, h);
  for (let y = 0; y < h; y++) {
    out.data.set(src.data.subarray(((b.y0 + y) * src.width + b.x0) * 4, ((b.y0 + y) * src.width + b.x1 + 1) * 4), y * w * 4);
  }
  return out;
}

/**
 * Props e íconos de la interfaz (raw/props, raw/hud): quita el fondo y el borde de color, recorta al dibujo y lo
 * escala con muestreo por moda. `size` en unidades del mundo ({ height } o { width }); la salida mide `size × detail` px.
 * `coverage`: cobertura mínima de cada bloque (0,5 por defecto; más baja conserva contornos finos).
 * Modifica `img`. Devuelve { image, background } o null si el dibujo está vacío.
 */
export function processIcon(img, { size, detail = 1, edge, edgePasses = 0, tolerance, coverage } = {}) {
  let background = removeBackground(img, tolerance);
  if (edge && edgePasses > 0) background += ` · borde ${edge} −${removeColorEdge(img, edgePasses, EDGE_COLORS[edge])}px`;
  const crop = cropToContent(img);
  if (!crop) return null;
  let w;
  let h;
  if (size?.width) {
    w = Math.round(size.width * detail);
    h = Math.max(1, Math.round((crop.height * w) / crop.width));
  } else {
    h = Math.round((size?.height ?? crop.height) * detail);
    w = Math.max(1, Math.round((crop.width * h) / crop.height));
  }
  return { image: resizeImage(crop, w, h, coverage ?? COVERAGE_MIN), background };
}
