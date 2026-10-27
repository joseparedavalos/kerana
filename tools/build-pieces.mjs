// Arte de las piezas (S58): raw/piezas/*.jpg → public/assets/pieces/*.png, a detail 2 (2 px de arte por unidad).
// Quita el damero pintado (relleno desde los bordes, como el tileset de S56), reduce sin interpolar (medoide de
// cada bloque) y corta cada pieza como la usa el juego. Ajustes: raw/piezas/piezas.json. Detalle: docs/ASSETS.md §6.2.
// Uso: node tools/build-pieces.mjs [--preview]   (--preview deja tmp/pieces/<pieza>-x6.png sobre gris)
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import jpeg from 'jpeg-js';
import { PNG } from 'pngjs';
import { createImage } from './lib/sprite-pipeline.mjs';
import { reduceBlocks } from './lib/tileset-build.mjs';
import { alignColumns, dropRows, inkBounds, pieceMask, sliceRows, surfaceRow } from './lib/pieces-build.mjs';

const RAW = join('raw', 'piezas');
const OUT = join('public', 'assets', 'pieces');
const config = JSON.parse(readFileSync(join(RAW, 'piezas.json'), 'utf8'));
const preview = process.argv.includes('--preview');
mkdirSync(OUT, { recursive: true });

function load(file) {
  return jpeg.decode(readFileSync(join(RAW, file)), { useTArray: true, formatAsRGBA: true, maxMemoryUsageInMB: 512 });
}

function save(name, img) {
  const png = new PNG({ width: img.width, height: img.height });
  png.data.set(img.data);
  writeFileSync(join(OUT, `${name}.png`), PNG.sync.write(png));
  console.log(`+ ${OUT}/${name}.png (${img.width} × ${img.height})`);
  if (!preview) return;
  const k = 6;
  const big = createImage(img.width * k, img.height * k);
  for (let y = 0; y < big.height; y++) {
    for (let x = 0; x < big.width; x++) {
      const s = (Math.floor(y / k) * img.width + Math.floor(x / k)) * 4;
      const o = (y * big.width + x) * 4;
      const a = img.data[s + 3] / 255;
      for (let c = 0; c < 3; c++) big.data[o + c] = Math.round(img.data[s + c] * a + 96 * (1 - a));
      big.data[o + 3] = 255;
    }
  }
  mkdirSync(join('tmp', 'pieces'), { recursive: true });
  const p = new PNG({ width: big.width, height: big.height });
  p.data.set(big.data);
  writeFileSync(join('tmp', 'pieces', `${name}-x6.png`), PNG.sync.write(p));
}

const inkOf = (mask, width, dx = 0) => (x, y) => !mask[y * width + x - dx];
const opaqueWidth = (img, y) => {
  let n = 0;
  for (let x = 0; x < img.width; x++) if (img.data[(y * img.width + x) * 4 + 3]) n++;
  return n;
};
const minInk = (img) => Math.round(Math.min(img.width, img.height) * 0.01);

// Hongo: el dibujo entero a `width` px; el tallo se acorta a `stemRows` filas (sale de su mitad, el borde queda).
{
  const cfg = config.mushroom;
  const img = load(cfg.file);
  const mask = pieceMask(img);
  const box = inkBounds(mask, img.width, { x: 0, y: 0, w: img.width, h: img.height }, minInk(img));
  const small = reduceBlocks(img, box, cfg.width, Math.round((box.h * cfg.width) / box.w), inkOf(mask, img.width));
  let widest = 0;
  for (let y = 0; y < small.height; y++) if (opaqueWidth(small, y) > opaqueWidth(small, widest)) widest = y;
  let stemTop = widest;
  while (stemTop < small.height && opaqueWidth(small, stemTop) > opaqueWidth(small, widest) * 0.6) stemTop++;
  const stem = small.height - stemTop;
  const cut = Math.max(0, stem - cfg.stemRows);
  save('mushroom', dropRows(small, stemTop + Math.floor((stem - cut) / 2), cut));
  console.log(`  sombrero ${stemTop} filas, tallo ${stem} → ${stem - cut}`);
}

// Reja: `bars` barrotes del medio (de borde a borde), a `width` px; sale en tres partes (arriba con el travesaño,
// los barrotes solos, abajo con el travesaño) para que el juego estire solo la del medio a la altura de cada reja.
{
  const cfg = config.gate;
  const img = load(cfg.file);
  const mask = pieceMask(img, cfg.holes);
  const box = inkBounds(mask, img.width, { x: 0, y: 0, w: img.width, h: img.height }, minInk(img));
  // Barrotes: corridas de columnas con dibujo en la franja del medio (sin travesaños).
  const bandY = box.y + Math.round(box.h * 0.4);
  const bandH = Math.round(box.h * 0.2);
  const bars = [];
  let start = -1;
  for (let x = box.x; x <= box.x + box.w; x++) {
    let n = 0;
    if (x < box.x + box.w) for (let y = bandY; y < bandY + bandH; y++) if (!mask[y * img.width + x]) n++;
    const ink = n >= bandH * 0.8;
    if (ink && start < 0) start = x;
    if (!ink && start >= 0) {
      if (x - start > 10) bars.push({ x: start, w: x - start });
      start = -1;
    }
  }
  const first = Math.floor((bars.length - cfg.bars) / 2);
  const a = bars[first];
  const b = bars[first + cfg.bars - 1];
  const rect = { x: a.x, y: box.y, w: b.x + b.w - a.x, h: box.h };
  const small = reduceBlocks(img, rect, cfg.width, Math.round((rect.h * cfg.width) / rect.w), inkOf(mask, img.width));
  // Travesaños: filas casi llenas. Cada parte de los extremos lleva su travesaño y `ropeRows` filas de la cuerda.
  const full = [];
  for (let y = 0; y < small.height; y++) if (opaqueWidth(small, y) >= small.width * 0.9) full.push(y);
  const topCross = full.find((y, i) => full[i + 1] !== y + 1);
  const bottomCross = [...full].reverse().find((y, i, r) => r[i + 1] !== y - 1);
  const topEnd = topCross + 1 + cfg.ropeRows;
  const bottomStart = bottomCross - cfg.ropeRows;
  save('gate_top', sliceRows(small, 0, topEnd));
  save('gate_mid', sliceRows(small, topEnd, bottomStart - topEnd));
  save('gate_bottom', sliceRows(small, bottomStart, small.height - bottomStart));
  console.log(`  ${bars.length} barrotes en el arte, se usan ${cfg.bars}; ${small.width} × ${small.height}`);
}

// Interruptor: la mitad izquierda apagada, la derecha encendida, a `height` px. El encendido trae un resplandor
// pintado sobre el damero: se recorta con la silueta del apagado (corrida hasta su lugar); el halo lo pone el juego.
{
  const cfg = config.switch;
  const img = load(cfg.file);
  const mask = pieceMask(img);
  const half = Math.floor(img.width / 2);
  const offBox = inkBounds(mask, img.width, { x: 0, y: 0, w: half, h: img.height }, minInk(img));
  const onHalf = { x: half, y: 0, w: img.width - half, h: img.height };
  const postFrom = offBox.y + Math.round(offBox.h * 0.8);
  const dx = alignColumns(mask, img.width, postFrom, offBox.y + offBox.h, offBox, onHalf);
  const w = Math.round((offBox.w * cfg.height) / offBox.h);
  save('switch_off', reduceBlocks(img, offBox, w, cfg.height, inkOf(mask, img.width)));
  save('switch_on', reduceBlocks(img, { ...offBox, x: offBox.x + dx }, w, cfg.height, inkOf(mask, img.width, dx)));
  console.log(`  encendido corrido ${dx} px`);
}

// Balsa: el dibujo entero a cada ancho de `widths` (las balsas de los mapas miden 32 y 48 unidades).
{
  const cfg = config.raft;
  const img = load(cfg.file);
  const mask = pieceMask(img, cfg.holes);
  const box = inkBounds(mask, img.width, { x: 0, y: 0, w: img.width, h: img.height }, minInk(img));
  for (const width of cfg.widths) {
    const small = reduceBlocks(img, box, width, Math.round((box.h * width) / box.w), inkOf(mask, img.width));
    save(`raft_${width / config.detail}`, small);
    console.log(`  superficie en la fila ${surfaceRow(small)}`);
  }
}

// Payé (S62): el proyectil del payesero, un cometa con la cabeza a la izquierda. El JPG está en raw/payesero/ (es
// de ese enemigo) y trae el mismo damero; las motas violetas sueltas de la estela son parte del dibujo.
{
  const cfg = config.paye;
  const img = load(cfg.file);
  const mask = pieceMask(img);
  const box = inkBounds(mask, img.width, { x: 0, y: 0, w: img.width, h: img.height }, minInk(img));
  save('paye', reduceBlocks(img, box, cfg.width, Math.round((box.h * cfg.width) / box.w), inkOf(mask, img.width)));
  console.log(`  dibujo ${box.w} × ${box.h} px en el JPG`);
}
