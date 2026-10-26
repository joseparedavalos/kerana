import { describe, expect, it } from 'vitest';
import { ART_IMAGES } from '../src/assets/manifest';
import { createImage } from '../tools/lib/sprite-pipeline.mjs';
import { alignColumns, dropRows, inkBounds, pieceMask, sliceRows, surfaceRow } from '../tools/lib/pieces-build.mjs';

type Img = { width: number; height: number; data: Uint8Array };
const WHITE = [250, 250, 250, 255];
const WOOD = [90, 50, 20, 255];
const set = (img: Img, x: number, y: number, rgba: number[]) => img.data.set(rgba, (y * img.width + x) * 4);
const rect = (img: Img, x0: number, y0: number, w: number, h: number, rgba: number[]) => {
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) set(img, x, y, rgba);
};

// Un marco de madera de 10 × 10 sobre blanco: adentro, un hueco blanco de 6 × 6 y, en él, un brillo de 1 píxel.
function frame(): Img {
  const img = createImage(14, 14);
  rect(img, 0, 0, 14, 14, WHITE);
  rect(img, 2, 2, 10, 10, WOOD);
  rect(img, 4, 4, 6, 6, WHITE);
  return img;
}

const PIECES = import.meta.glob('../public/assets/pieces/*.png', { eager: true, query: '?inline', import: 'default' }) as Record<string, string>;

describe('pieces-build (S58)', () => {
  it('quita el fondo unido al borde y deja los huecos cerrados, salvo que midan minArea o más', () => {
    const img = frame();
    const outside = pieceMask(img);
    expect(outside[0]).toBe(1);
    expect(outside[5 * 14 + 5]).toBe(0);
    const holes = pieceMask(img, 20);
    expect(holes[5 * 14 + 5]).toBe(1);
    expect(holes[3 * 14 + 3]).toBe(0);
    // Un hueco más chico que minArea (el brillo de la espuma o del interruptor) queda.
    expect(pieceMask(img, 37)[5 * 14 + 5]).toBe(0);
  });

  it('la caja del dibujo, la superficie, cortar filas y alinear dos dibujos', () => {
    const img = frame();
    const mask = pieceMask(img, 20);
    expect(inkBounds(mask, 14, { x: 0, y: 0, w: 14, h: 14 }, 1)).toEqual({ x: 2, y: 2, w: 10, h: 10 });
    const strip = createImage(4, 3);
    set(strip, 1, 0, WOOD);
    rect(strip, 0, 1, 4, 2, WOOD);
    expect(surfaceRow(strip)).toBe(1);
    const cut = dropRows(strip, 1, 1);
    expect(cut.height).toBe(2);
    expect(Array.from(cut.data.subarray(4, 8))).toEqual(WOOD);
    expect(sliceRows(strip, 1, 2).height).toBe(2);
    const pair = createImage(20, 4);
    rect(pair, 0, 0, 20, 4, WHITE);
    rect(pair, 3, 0, 2, 4, WOOD);
    rect(pair, 13, 0, 2, 4, WOOD);
    const m = pieceMask(pair);
    expect(alignColumns(m, 20, 0, 4, { x: 0, y: 0, w: 10, h: 4 }, { x: 10, y: 0, w: 10, h: 4 })).toBe(10);
  });

  it('las piezas de public/assets/pieces miden lo que espera el juego', () => {
    const size = (key: keyof typeof ART_IMAGES) => {
      const uri = PIECES[`../public/assets/${ART_IMAGES[key]}`];
      // Ancho y alto del PNG: bytes 16 a 23 (el encabezado IHDR).
      const bytes = Uint8Array.from(atob(uri.split(',')[1]).slice(0, 24), (c) => c.charCodeAt(0));
      const view = new DataView(bytes.buffer);
      return [view.getUint32(16), view.getUint32(20)];
    };
    // Hongo: un tile de ancho (15 unidades) y `mushroomHeight` (10) de alto, a detail 2.
    expect(size('piece_mushroom')).toEqual([30, 20]);
    for (const k of ['piece_gate_top', 'piece_gate_mid', 'piece_gate_bottom'] as const) expect(size(k)[0]).toBe(32);
    expect(size('piece_switch_off')).toEqual(size('piece_switch_on'));
    expect(size('piece_raft_32')[0]).toBe(64);
    expect(size('piece_raft_48')[0]).toBe(96);
  });
});
