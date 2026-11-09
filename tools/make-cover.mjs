// Portada de itch.io (S84): 630 × 500 compuesta con arte del repo, sin dibujar nada nuevo.
// Fondo de Ñeembucú (l2) a sangre, Kerana abajo a la izquierda sobre la barranca, Ao Ao arriba a la derecha y Eichu.
// TODO el escalado es vecino más cercano: ninguna capa se interpola. Salida: marketing/itch/cover_{a,b,c}.png.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import jpeg from 'jpeg-js';
import { PNG } from 'pngjs';

const OUT = 'marketing/itch';
const WIDTH = 630;
const HEIGHT = 500;
const BACKGROUND = 'public/assets/backgrounds/l2_far.jpg';
const SPRITES = 'public/assets/sprites';

/**
 * Eichu como en `addEichu` (src/systems/Backdrops.ts) con `EICHU_STARS` (src/data/story.ts): halo de 3 radios con
 * opacidad 0,3 en 0xcfe3f2 y el núcleo blanco; radio = 1 + (5,5 - magnitud) · 0,5. Se copian aquí porque el
 * script es Node puro y no compila TypeScript; `tests/cover.test.ts` comprueba que no se desincronicen.
 */
export const EICHU_STARS = [
  { x: -0.5, y: 0.16, mag: 3.6 }, // Atlas
  { x: -0.12, y: 0.11, mag: 2.9 }, // Alcyone
  { x: 0.15, y: 0.26, mag: 4.2 }, // Merope
  { x: 0.26, y: -0.16, mag: 3.9 }, // Maia
  { x: 0.4, y: -0.26, mag: 4.3 }, // Taygeta
  { x: 0.48, y: 0.09, mag: 3.7 }, // Electra
  { x: 0.49, y: -0.07, mag: 5.4 }, // Celaeno
];
const GLOW_COLOR = [0xcf, 0xe3, 0xf2];
const EICHU_GLOW = 3;
const EICHU_GLOW_ALPHA = 0.3;
const eichuRadius = (mag) => 1 + (5.5 - mag) * 0.5;

/**
 * Las tres variantes. `bg.zoom` multiplica la escala mínima que cubre el lienzo (1 = el alto entero del fondo);
 * `bg.focusX/focusY` (0..1) dicen qué parte del fondo queda al centro. Sprites: cuadro de la hoja, escala entera,
 * pies (abajo del contenido) en `x, y` del lienzo. `eichu`: centro y ancho del cúmulo en píxeles de la portada,
 * `scale` agranda los radios del juego (que son en unidades del mundo de 640 × 360).
 */
export const VARIANTS = {
  // A: el estero entero, Kerana atacando en la barranca y Ao Ao enorme sobre el horizonte.
  a: {
    bg: { zoom: 1, focusX: 0.36, focusY: 0.5 },
    kerana: { frame: 5, scale: 1, x: 120, y: 482 },
    boss: { frame: 5, scale: 3, x: 452, y: 268 },
    eichu: { x: 190, y: 74, size: 150, scale: 2 },
  },
  // B: más cerca del agua; Ao Ao más chico, parado en el horizonte, Kerana en reposo con el sable en alto.
  b: {
    bg: { zoom: 1.2, focusX: 0.3, focusY: 0.62 },
    kerana: { frame: 11, scale: 1, x: 104, y: 478 },
    boss: { frame: 3, scale: 2, x: 468, y: 200 },
    eichu: { x: 230, y: 70, size: 170, scale: 2 },
  },
  // C: el atardecer al centro, Ao Ao gigante que se sale por la derecha y Kerana estirando el tajo hacia él.
  c: {
    bg: { zoom: 1.08, focusX: 0.45, focusY: 0.55 },
    kerana: { frame: 7, scale: 1, x: 96, y: 486 },
    boss: { frame: 2, scale: 4, x: 470, y: 300 },
    eichu: { x: 150, y: 62, size: 140, scale: 2 },
  },
};

function readPng(path) {
  return PNG.sync.read(readFileSync(path));
}

function blank(w, h) {
  return { width: w, height: h, data: Buffer.alloc(w * h * 4) };
}

/** Fondo a sangre: escala uniforme que cubre el lienzo (sin deformar), vecino más cercano. */
function drawBackground(dst, { zoom, focusX, focusY }) {
  const src = jpeg.decode(readFileSync(BACKGROUND), { useTArray: true });
  const scale = Math.max(dst.width / src.width, dst.height / src.height) * zoom;
  const left = Math.min(Math.max(focusX * src.width * scale - dst.width / 2, 0), src.width * scale - dst.width);
  const top = Math.min(Math.max(focusY * src.height * scale - dst.height / 2, 0), src.height * scale - dst.height);
  for (let y = 0; y < dst.height; y++) {
    const sy = Math.min(src.height - 1, Math.floor((y + top) / scale));
    for (let x = 0; x < dst.width; x++) {
      const sx = Math.min(src.width - 1, Math.floor((x + left) / scale));
      const s = (sy * src.width + sx) * 4;
      const d = (y * dst.width + x) * 4;
      dst.data[d] = src.data[s];
      dst.data[d + 1] = src.data[s + 1];
      dst.data[d + 2] = src.data[s + 2];
      dst.data[d + 3] = 255;
    }
  }
}

/** Mezcla un color sobre el lienzo (alfa 0..1). */
function blend(dst, x, y, r, g, b, a) {
  if (x < 0 || y < 0 || x >= dst.width || y >= dst.height || a <= 0) return;
  const d = (y * dst.width + x) * 4;
  dst.data[d] = Math.round(dst.data[d] * (1 - a) + r * a);
  dst.data[d + 1] = Math.round(dst.data[d + 1] * (1 - a) + g * a);
  dst.data[d + 2] = Math.round(dst.data[d + 2] * (1 - a) + b * a);
}

/** Recuadro del contenido (alfa > 0) de un cuadro de la hoja. */
function contentBox(sheet, fx, fy, fw, fh) {
  let x0 = fw, y0 = fh, x1 = -1, y1 = -1;
  for (let y = 0; y < fh; y++) {
    for (let x = 0; x < fw; x++) {
      if (sheet.data[((fy + y) * sheet.width + fx + x) * 4 + 3] === 0) continue;
      x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
    }
  }
  return { x0, y0, x1, y1 };
}

/**
 * Pega un cuadro de una hoja de `public/assets/sprites` a escala entera, vecino más cercano: cada píxel de arte
 * es un bloque de `scale × scale`. El centro del contenido queda en `x` y su borde de abajo en `y`.
 */
function drawSprite(dst, key, { frame, scale, x, y }) {
  if (!Number.isInteger(scale) || scale < 1) throw new Error(`escala no entera para ${key}: ${scale}`);
  const meta = JSON.parse(readFileSync(join(SPRITES, `${key}.json`), 'utf8'));
  const sheet = readPng(join(SPRITES, `${key}.png`));
  const cols = Math.floor(sheet.width / meta.frameWidth);
  const fx = (frame % cols) * meta.frameWidth;
  const fy = Math.floor(frame / cols) * meta.frameHeight;
  const box = contentBox(sheet, fx, fy, meta.frameWidth, meta.frameHeight);
  const ox = Math.round(x - ((box.x0 + box.x1 + 1) / 2) * scale);
  const oy = Math.round(y - (box.y1 + 1) * scale);
  for (let sy = box.y0; sy <= box.y1; sy++) {
    for (let sx = box.x0; sx <= box.x1; sx++) {
      const s = ((fy + sy) * sheet.width + fx + sx) * 4;
      const a = sheet.data[s + 3] / 255;
      if (a === 0) continue;
      for (let dy = 0; dy < scale; dy++) {
        for (let dx = 0; dx < scale; dx++) {
          blend(dst, ox + sx * scale + dx, oy + sy * scale + dy, sheet.data[s], sheet.data[s + 1], sheet.data[s + 2], a);
        }
      }
    }
  }
  return { left: ox + box.x0 * scale, top: oy + box.y0 * scale, height: (box.y1 - box.y0 + 1) * scale };
}

/** Disco de borde duro (sin antialias): un píxel entra si su centro cae dentro del radio. */
function disc(dst, cx, cy, r, color, alpha) {
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
      if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r) blend(dst, x, y, color[0], color[1], color[2], alpha);
    }
  }
}

/** Las siete estrellas con el dibujo de `addEichu` (todas encendidas, el halo en su brillo máximo). */
function drawEichu(dst, { x, y, size, scale }) {
  for (const star of EICHU_STARS) {
    const cx = x + star.x * size;
    const cy = y + star.y * size;
    const r = eichuRadius(star.mag) * scale;
    disc(dst, cx, cy, r * EICHU_GLOW, GLOW_COLOR, EICHU_GLOW_ALPHA);
    disc(dst, cx, cy, r, [255, 255, 255], 1);
  }
}

export function makeCover(variant) {
  const img = blank(WIDTH, HEIGHT);
  drawBackground(img, variant.bg);
  drawEichu(img, variant.eichu);
  const boss = drawSprite(img, 'ao_ao', variant.boss);
  const kerana = drawSprite(img, 'kerana', variant.kerana);
  return { img, kerana, boss };
}

function main() {
  mkdirSync(OUT, { recursive: true });
  for (const [id, variant] of Object.entries(VARIANTS)) {
    const { img, kerana, boss } = makeCover(variant);
    const png = new PNG({ width: WIDTH, height: HEIGHT });
    img.data.copy(png.data);
    const file = join(OUT, `cover_${id}.png`);
    writeFileSync(file, PNG.sync.write(png));
    const pct = (h) => `${Math.round((h / HEIGHT) * 100)} %`;
    console.log(`${file}: Kerana ${kerana.height} px (${pct(kerana.height)} del alto), Ao Ao ${boss.height} px (${pct(boss.height)})`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) main();
