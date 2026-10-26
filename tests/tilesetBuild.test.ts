import { describe, expect, it } from 'vitest';
import { createImage } from '../tools/lib/sprite-pipeline.mjs';
import {
  autotileCell,
  backdropMask,
  findDrawings,
  medoid,
  reduceBlocks,
  seamlessWindow,
} from '../tools/lib/tileset-build.mjs';
import { TILE, TILESET_COLUMNS, TILESET_ROWS } from '../tools/lib/tileset-layout.mjs';

type Img = { width: number; height: number; data: Uint8Array };
const fill = (img: Img, rgba: number[]) => {
  for (let i = 0; i < img.data.length; i += 4) for (let c = 0; c < 4; c++) img.data[i + c] = rgba[c];
  return img;
};
const px = (img: Img, x: number, y: number) => Array.from(img.data.subarray((y * img.width + x) * 4, (y * img.width + x) * 4 + 4));

const DIRT = [150, 80, 40, 255];
const dirt = fill(createImage(TILE, TILE), DIRT);
// Franja de pasto de 3 filas: la de arriba con aire en las columnas pares, después pasto, después «tierra» (128).
const grass = createImage(TILE, 3);
for (let x = 0; x < TILE; x++) {
  grass.data.set(x % 2 ? [200, 180, 60, 255] : [0, 0, 0, 0], x * 4);
  grass.data.set([200, 180, 60, 255], (TILE + x) * 4);
  grass.data.set([1, 2, 3, 128], (2 * TILE + x) * 4);
}
const EDGE = { outer: 0.5, inner: 0.75 };

describe('autotile del tileset (S56)', () => {
  it('la casilla 15 es el bloque liso, sin bordes', () => {
    const cell = autotileCell(15, dirt, grass, EDGE);
    for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) expect(px(cell, x, y)).toEqual(DIRT);
  });

  it('con aire arriba (14) va el pasto y nada más', () => {
    const cell = autotileCell(14, dirt, grass, EDGE);
    expect(px(cell, 0, 0)[3]).toBe(0); // aire entre las puntas
    expect(px(cell, 1, 0)).toEqual([200, 180, 60, 255]);
    expect(px(cell, 0, 1)).toEqual([200, 180, 60, 255]);
    expect(px(cell, 5, 2)).toEqual(DIRT); // la tierra de la franja es la del bloque
    expect(px(cell, 0, 8)).toEqual(DIRT);
    expect(px(cell, 15, 15)).toEqual(DIRT);
  });

  it('los costados y el fondo que dan al aire se oscurecen; arriba no', () => {
    const wallRight = autotileCell(1 + 4 + 8, dirt, grass, EDGE); // 13: aire a la derecha
    expect(px(wallRight, 15, 8)).toEqual([75, 40, 20, 255]);
    expect(px(wallRight, 14, 8)).toEqual([113, 60, 30, 255]);
    expect(px(wallRight, 0, 8)).toEqual(DIRT);
    expect(px(wallRight, 8, 0)).toEqual(DIRT);
    const ceiling = autotileCell(1 + 2 + 8, dirt, grass, EDGE); // 11: aire abajo
    expect(px(ceiling, 8, 15)).toEqual([75, 40, 20, 255]);
    expect(px(ceiling, 8, 0)).toEqual(DIRT);
    const alone = autotileCell(0, dirt, grass, EDGE);
    expect(px(alone, 0, 8)).toEqual([75, 40, 20, 255]);
    expect(px(alone, 1, 1)).toEqual([200, 180, 60, 255]); // el pasto tapa el borde del costado
  });
});

describe('materiales del generador (S56)', () => {
  it('el fondo se quita desde afuera: el blanco encerrado en un dibujo queda', () => {
    const img = fill(createImage(9, 9), [255, 255, 255, 255]);
    for (let y = 2; y <= 6; y++) for (let x = 2; x <= 6; x++) img.data.set([30, 90, 200, 255], (y * 9 + x) * 4);
    img.data.set([255, 255, 255, 255], (4 * 9 + 4) * 4); // espuma en el medio
    img.data.set([230, 230, 230, 255], 0); // gris del damero
    const mask = backdropMask(img);
    expect(mask[0]).toBe(1);
    expect(mask[4 * 9 + 4]).toBe(0);
    expect(mask[2 * 9 + 2]).toBe(0);
    expect(findDrawings(mask, 9, 9, 1)).toEqual([{ x: 2, y: 2, w: 5, h: 5 }]);
  });

  it('la reducción no interpola: cada color sale de la imagen', () => {
    const img = createImage(8, 8);
    for (let i = 0; i < 64; i++) img.data.set(i % 3 ? [200, 10, 10, 255] : [10, 10, 200, 255], i * 4);
    const small = reduceBlocks(img, { x: 0, y: 0, w: 8, h: 8 }, 2, 2);
    for (let i = 0; i < 4; i++) {
      const c = Array.from(small.data.subarray(i * 4, i * 4 + 3)).join();
      expect(['200,10,10', '10,10,200']).toContain(c);
    }
    expect(medoid([[0, 0, 0], [10, 10, 10], [200, 200, 200]])).toEqual([10, 10, 10]);
  });

  it('la ventana elegida es la que empalma consigo misma', () => {
    // Rampa horizontal de 32 px con un tramo plano en x 8-23: solo ahí la columna 15 iguala a la 0.
    const img = createImage(32, 1);
    for (let x = 0; x < 32; x++) {
      const v = x >= 8 && x < 24 ? 100 : x * 7;
      img.data.set([v, v, v, 255], x * 4);
    }
    expect(seamlessWindow(img, 16, 1, { wrapY: false }).x).toBe(8);
  });
});

// Nada más detecta un tileset mal hecho: con otro ancho, todos los índices se corren (S55).
const TILESETS = import.meta.glob('../public/assets/tiles/*.png', { eager: true, query: '?inline', import: 'default' }) as Record<string, string>;

describe('tilesets en public/assets/tiles', () => {
  it('están los ocho', () => expect(Object.keys(TILESETS)).toHaveLength(8));
  for (const [file, uri] of Object.entries(TILESETS)) {
    it(`${file} mide ${TILE * TILESET_COLUMNS} × ${TILE * TILESET_ROWS}`, () => {
      // Ancho y alto del PNG: bytes 16 a 23 (el encabezado IHDR).
      const bytes = Uint8Array.from(atob(uri.split(',')[1]).slice(0, 24), (c) => c.charCodeAt(0));
      const view = new DataView(bytes.buffer);
      expect([view.getUint32(16), view.getUint32(20)]).toEqual([TILE * TILESET_COLUMNS, TILE * TILESET_ROWS]);
    });
  }
});
