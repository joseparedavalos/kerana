import { describe, expect, it } from 'vitest';
import {
  coverImage,
  createImage,
  detectPixelSize,
  opaqueBounds,
  parseSheetName,
  processCharacter,
  removeBackground,
  resizeImage,
} from '../tools/lib/sprite-pipeline.mjs';

type Img = { width: number; height: number; data: Uint8Array };

function fillRect(img: Img, x: number, y: number, w: number, h: number, rgba: number[]): void {
  for (let yy = y; yy < y + h; yy++) {
    for (let xx = x; xx < x + w; xx++) img.data.set(rgba, (yy * img.width + xx) * 4);
  }
}

/** Hoja sintética de `n` celdas de 100 × 200 con un "personaje" rectangular de `h` px de alto a distintas alturas. */
function syntheticSheet(n: number, h: number, bg: number[] = [0, 0, 0, 0]): Img {
  const img = createImage(n * 100, 200) as Img;
  fillRect(img, 0, 0, img.width, img.height, bg);
  for (let i = 0; i < n; i++) {
    // Los pies bajan un poco en cada frame: el pipeline debe alinearlos igual.
    const bottom = 180 + i * 3;
    fillRect(img, i * 100 + 40, bottom - h, 20, h, [200, 150, 100, 255]);
  }
  return img;
}

/** Fila más baja con algo opaco dentro del frame `i` de la hoja empaquetada. */
function lowestOpaqueRow(image: Img, frameIndex: number, fw: number, fh: number): number {
  const cols = image.width / fw;
  const ox = (frameIndex % cols) * fw;
  const oy = Math.floor(frameIndex / cols) * fh;
  const b = opaqueBounds(image, { x: ox, y: oy, w: fw, h: fh });
  return b ? b.y1 - oy : -1;
}

describe('sprite pipeline', () => {
  it('lee columnas y filas del nombre', () => {
    expect(parseSheetName('idle_8x1.png')).toEqual({ anim: 'idle', cols: 8, rows: 1 });
    expect(parseSheetName('run_5x2.PNG')).toEqual({ anim: 'run', cols: 5, rows: 2 });
    expect(parseSheetName('sprite.json')).toBeNull();
  });

  it('quita el fondo magenta si la hoja no trae transparencia', () => {
    const img = syntheticSheet(2, 100, [255, 0, 255, 255]);
    expect(removeBackground(img)).toBe('magenta');
    expect(img.data[3]).toBe(0);
    expect(opaqueBounds(img, { x: 0, y: 0, w: 100, h: 200 })).toEqual({ x0: 40, y0: 80, x1: 59, y1: 179 });
  });

  it('escala por hoja, alinea los pies y empaqueta las animaciones', () => {
    const small = syntheticSheet(4, 100); // de pie: 100 px
    const big = syntheticSheet(3, 150); // otra escala: 150 px
    const { image, meta } = processCharacter(
      'hero',
      [
        { anim: 'idle', cols: 4, rows: 1, img: small },
        { anim: 'attack', cols: 3, rows: 1, img: big },
      ],
      {
        frame: [32, 32],
        height: 20,
        anims: {
          idle: { frames: [1, 3], fps: 6, loop: true },
          hurt: { source: 'attack', list: [0], fps: 1 },
        },
      },
    );
    const anims = meta.anims as Record<string, { frames: number[]; frameRate: number; repeat: number }>;
    expect(meta.frames).toBe(7);
    expect(meta.frameWidth).toBe(32);
    expect(meta.detail).toBe(1); // por defecto
    expect(image.width % 32).toBe(0);
    expect(anims.hero_idle).toEqual({ frames: [1, 2, 3], frameRate: 6, repeat: -1 });
    expect(anims.hero_hurt.frames).toEqual([4]);
    expect(anims.hero_attack.frames).toEqual([4, 5, 6]);

    // Todas las alturas quedan en 20 px y los pies en la última fila, pese a escalas y alturas distintas.
    for (let i = 0; i < 7; i++) {
      expect(lowestOpaqueRow(image as Img, i, 32, 32)).toBe(31);
      const cols = image.width / 32;
      const b = opaqueBounds(image, { x: (i % cols) * 32, y: Math.floor(i / cols) * 32, w: 32, h: 32 })!;
      expect(b.y1 - b.y0 + 1).toBeGreaterThanOrEqual(19);
      expect(b.y1 - b.y0 + 1).toBeLessThanOrEqual(21);
    }
  });

  it('copia el campo detail de sprite.json al JSON de salida', () => {
    const sheet = { anim: 'idle', cols: 2, rows: 1, img: syntheticSheet(2, 100) };
    const { meta } = processCharacter('x', [sheet], { frame: [32, 32], height: 20, detail: 2 });
    expect(meta.detail).toBe(2);
  });

  it('falla con un frame fuera de la hoja', () => {
    const sheet = { anim: 'idle', cols: 2, rows: 1, img: syntheticSheet(2, 100) };
    expect(() => processCharacter('x', [sheet], { anims: { idle: { frames: [0, 5] } } })).toThrow(/fuera/);
  });

  it('detecta el tamaño aparente de píxel en arte pixel escalado', () => {
    // Tablero de bloques de 6 × 6 con colores alternados.
    const img = createImage(120, 120) as Img;
    for (let y = 0; y < 120; y++) {
      for (let x = 0; x < 120; x++) {
        const on = (Math.floor(x / 6) + Math.floor(y / 6)) % 2 === 0;
        img.data.set(on ? [255, 255, 255, 255] : [30, 30, 30, 255], (y * 120 + x) * 4);
      }
    }
    expect(detectPixelSize(img, { x: 0, y: 0, w: 120, h: 120 })).toBe(6);
  });

  it('escala fondos y recorta retratos', () => {
    const img = syntheticSheet(4, 100, [10, 20, 30, 255]);
    expect(resizeImage(img, 200, 100)).toMatchObject({ width: 200, height: 100 });
    const portrait = coverImage(img, 96, 96);
    expect(portrait.width).toBe(96);
    expect(portrait.height).toBe(96);
  });
});
