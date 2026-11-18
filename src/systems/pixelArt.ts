import type Phaser from 'phaser';

// Pintura por software (S103): píxeles RGBA en memoria que se suben como textura una sola vez. Lógica pura salvo
// `uploadAtlas`, para que los tests y los volcados a PNG no necesiten Phaser. (Moñái tiene su propio pintor, S102.)

export interface Pixels {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

export function makePixels(width: number, height: number): Pixels {
  return { width, height, data: new Uint8ClampedArray(width * height * 4) };
}

export function put(p: Pixels, x: number, y: number, color: number, alpha = 255): void {
  if (x < 0 || y < 0 || x >= p.width || y >= p.height) return;
  const i = (y * p.width + x) * 4;
  p.data[i] = (color >> 16) & 255;
  p.data[i + 1] = (color >> 8) & 255;
  p.data[i + 2] = color & 255;
  p.data[i + 3] = alpha;
}

/** Alfa (0..255) del píxel; 0 fuera del lienzo. */
export function alphaAt(p: Pixels, x: number, y: number): number {
  if (x < 0 || y < 0 || x >= p.width || y >= p.height) return 0;
  return p.data[(y * p.width + x) * 4 + 3];
}

/** Color 0xrrggbb del píxel. */
export function colorAt(p: Pixels, x: number, y: number): number {
  const i = (y * p.width + x) * 4;
  return (p.data[i] << 16) | (p.data[i + 1] << 8) | p.data[i + 2];
}

export const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);
export const smoothstep = (a: number, b: number, v: number): number => {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

/** Tramado ordenado 4 × 4 (Bayer), en [-0,5; 0,5). */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
export const bayer = (i: number, j: number): number => (BAYER[((j & 3) << 2) | (i & 3)] + 0.5) / 16 - 0.5;

/** Mezcla de dos colores (0 = a, 1 = b). */
export function mix(a: number, b: number, t: number): number {
  const r = Math.round(((a >> 16) & 255) * (1 - t) + ((b >> 16) & 255) * t);
  const g = Math.round(((a >> 8) & 255) * (1 - t) + ((b >> 8) & 255) * t);
  const bl = Math.round((a & 255) * (1 - t) + (b & 255) * t);
  return (r << 16) | (g << 8) | bl;
}

/** Ruido estable (0..1) para variar sin Math.random (el azar del juego no se toca). */
export function hash(a: number, b = 0): number {
  const v = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return v - Math.floor(v);
}

/** Copia `src` dentro de `dst` en (x, y). */
export function blit(dst: Pixels, src: Pixels, x: number, y: number): void {
  for (let j = 0; j < src.height; j++) {
    const row = (y + j) * dst.width;
    dst.data.set(src.data.subarray(j * src.width * 4, (j + 1) * src.width * 4), (row + x) * 4);
  }
}

export interface AtlasFrame {
  name: string;
  px: Pixels;
}

/**
 * Arma un atlas (filas de cuadros, un píxel de separación) y lo sube como una textura con un cuadro por nombre:
 * todo lo que lo usa va en el mismo lote. Devuelve false si la textura ya existía.
 */
export function uploadAtlas(scene: Phaser.Scene, key: string, frames: readonly AtlasFrame[], maxWidth = 512): boolean {
  if (scene.textures.exists(key)) return false;
  const pos: { x: number; y: number }[] = [];
  let x = 0;
  let y = 0;
  let rowH = 0;
  let width = 0;
  for (const f of frames) {
    if (x > 0 && x + f.px.width > maxWidth) {
      x = 0;
      y += rowH + 1;
      rowH = 0;
    }
    pos.push({ x, y });
    x += f.px.width + 1;
    rowH = Math.max(rowH, f.px.height);
    width = Math.max(width, x);
  }
  const atlas = makePixels(Math.max(1, width), Math.max(1, y + rowH));
  frames.forEach((f, i) => blit(atlas, f.px, pos[i].x, pos[i].y));
  const tex = scene.textures.createCanvas(key, atlas.width, atlas.height);
  if (!tex) return false;
  const img = tex.context.createImageData(atlas.width, atlas.height);
  img.data.set(atlas.data);
  tex.context.putImageData(img, 0, 0);
  frames.forEach((f, i) => tex.add(f.name, 0, pos[i].x, pos[i].y, f.px.width, f.px.height));
  tex.refresh();
  return true;
}
