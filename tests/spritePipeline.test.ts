import { describe, expect, it } from 'vitest';
import {
  coverImage,
  createImage,
  detectPixelSize,
  greenEdgePasses,
  opaqueBounds,
  parseSheetName,
  processCharacter,
  removeBackground,
  removeGreenEdge,
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

  it('quita el borde verde del contorno, pero no el verde del interior', () => {
    const img = createImage(10, 10) as Img;
    fillRect(img, 2, 2, 6, 6, [30, 200, 30, 255]); // borde verde (1 px) …
    fillRect(img, 3, 3, 4, 4, [120, 60, 160, 255]); // … alrededor de un cuerpo violeta
    fillRect(img, 4, 4, 2, 2, [30, 200, 30, 255]); // verde de verdad, adentro
    const removed = removeGreenEdge(img);
    expect(removed).toBe(20);
    expect(img.data[(2 * 10 + 2) * 4 + 3]).toBe(0);
    expect(img.data[(3 * 10 + 3) * 4 + 3]).toBe(255);
    expect(img.data[(4 * 10 + 4) * 4 + 3]).toBe(255);
  });

  it('greenEdge acepta un número de pasadas (true = 3)', () => {
    expect(greenEdgePasses(true)).toBe(3);
    expect(greenEdgePasses(5)).toBe(5);
    expect(greenEdgePasses(undefined)).toBe(0);
    expect(greenEdgePasses(false)).toBe(0);
    // Borde verde de 4 px: 3 pasadas dejan uno, 5 lo borran entero.
    const make = () => {
      const img = createImage(20, 20) as Img;
      fillRect(img, 2, 2, 16, 16, [30, 200, 30, 255]);
      fillRect(img, 6, 6, 8, 8, [120, 60, 160, 255]);
      return img;
    };
    const three = make();
    removeGreenEdge(three, greenEdgePasses(true));
    expect(three.data[(5 * 20 + 10) * 4 + 3]).toBe(255);
    const five = make();
    removeGreenEdge(five, greenEdgePasses(5));
    expect(five.data[(5 * 20 + 10) * 4 + 3]).toBe(0);
  });

  /** Fila más alta con algo opaco dentro del frame `i`. */
  const highestOpaqueRow = (image: Img, i: number, fw: number, fh: number): number => {
    const cols = image.width / fw;
    const b = opaqueBounds(image, { x: (i % cols) * fw, y: Math.floor(i / cols) * fh, w: fw, h: fh });
    return b ? b.y0 - Math.floor(i / cols) * fh : -1;
  };

  it("align 'top' lleva lo más alto del dibujo a la primera fila", () => {
    const sheet = { anim: 'hang', cols: 3, rows: 1, img: syntheticSheet(3, 100) };
    const { image } = processCharacter('x', [sheet], { frame: [32, 48], height: 20, sheets: { hang: { align: 'top' } } });
    for (let i = 0; i < 3; i++) expect(highestOpaqueRow(image as Img, i, 32, 48)).toBe(0);
  });

  it("align 'cell' conserva la posición del dibujo en su celda", () => {
    // Pies a 140, 160 y 180: con una sola ancla, el dibujo sube y baja igual que en la hoja.
    const img = createImage(300, 200) as Img;
    for (let i = 0; i < 3; i++) fillRect(img, i * 100 + 40, 40 + i * 20, 20, 100, [200, 150, 100, 255]);
    const sheet = { anim: 'fly', cols: 3, rows: 1, img };
    const { image } = processCharacter('x', [sheet], { frame: [32, 32], height: 20, sheets: { fly: { align: 'cell' } } });
    const rows = [0, 1, 2].map((i) => lowestOpaqueRow(image as Img, i, 32, 32));
    expect(rows[2]).toBe(31); // el más bajo toca el borde
    expect(rows[0]).toBeLessThan(rows[1]);
    expect(rows[1]).toBeLessThan(rows[2]);
  });

  it('cropBottom borra las filas de abajo de cada celda antes de medir', () => {
    // Una "rama" de 10 px pegada al borde de abajo de cada celda: sin ella, la escala sale del cuerpo.
    const img = syntheticSheet(2, 100);
    for (let i = 0; i < 2; i++) fillRect(img, i * 100, 190, 100, 10, [90, 60, 30, 255]);
    const { summary } = processCharacter('x', [{ anim: 'idle', cols: 2, rows: 1, img }], {
      frame: [32, 32],
      height: 20,
      sheets: { idle: { cropBottom: 10 } },
    });
    expect(summary[0]).toMatch(/ref 100px/);
    expect(img.data[(195 * 200 + 50) * 4 + 3]).toBe(0);
  });
});
