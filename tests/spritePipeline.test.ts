import { describe, expect, it } from 'vitest';
import {
  coverImage,
  createImage,
  cropToContent,
  clearGrass,
  despillGreen,
  feetAnchorX,
  detectPixelSize,
  greenEdgePasses,
  opaqueBounds,
  propFrameData,
  packAtlas,
  parseSheetName,
  processCharacter,
  processIcon,
  propName,
  removeBackground,
  removeColorEdge,
  EDGE_COLORS,
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

  it('ignore deja afuera una hoja; sus animaciones salen de otra con source', () => {
    const run = { anim: 'run', cols: 2, rows: 1, img: syntheticSheet(2, 100) };
    const bad = { anim: 'idle', cols: 2, rows: 1, img: syntheticSheet(2, 100, [200, 200, 200, 255]) };
    const { meta } = processCharacter('x', [bad, run], {
      frame: [32, 32],
      height: 20,
      sheets: { idle: { ignore: true } },
      anims: { idle: { source: 'run', list: [0] } },
    });
    expect(meta.frames).toBe(2);
    expect((meta.anims as Record<string, { frames: number[] }>).x_idle.frames).toEqual([0]);
    expect((meta.anims as Record<string, { frames: number[] }>).x_run.frames).toEqual([0, 1]);
  });

  it('despill baja el verde al mayor de rojo y azul, sin tocar los demás colores (S70)', () => {
    const img = createImage(4, 1) as Img;
    img.data.set([40, 110, 35, 255, 200, 150, 100, 255, 60, 90, 180, 255, 30, 200, 30, 0]);
    expect(despillGreen(img)).toBe(1);
    expect([...img.data.slice(0, 3)]).toEqual([40, 40, 35]); // halo → gris oscuro
    expect([...img.data.slice(4, 7)]).toEqual([200, 150, 100]); // piel
    expect([...img.data.slice(8, 11)]).toEqual([60, 90, 180]); // pantalón azul
    expect(img.data[13]).toBe(200); // transparente: no se toca
    // En processCharacter, por hoja o para todo el personaje.
    const sheetImg = syntheticSheet(1, 100);
    fillRect(sheetImg, 45, 120, 5, 5, [20, 160, 20, 255]);
    const { summary } = processCharacter('x', [{ anim: 'idle', cols: 1, rows: 1, img: sheetImg }], { frame: [32, 32], height: 20, despill: true });
    expect(summary[0]).toMatch(/despill 25px/);
  });

  it('grassRows borra el pasto pintado al pie, sin tocar las patas ni lo de más arriba (S76)', () => {
    const img = createImage(10, 10) as Img;
    fillRect(img, 0, 0, 10, 10, [200, 150, 100, 255]); // pelaje
    fillRect(img, 0, 8, 10, 2, [30, 120, 25, 255]); // pasto en las dos filas de abajo
    fillRect(img, 4, 8, 2, 2, [25, 20, 15, 255]); // uñas oscuras sobre el pasto
    fillRect(img, 0, 2, 2, 2, [30, 120, 25, 255]); // verde arriba: fuera de la franja, no se toca
    expect(clearGrass(img, { x: 0, y: 0, w: 10, h: 10 }, 3)).toBe(16);
    expect(img.data[(9 * 10 + 0) * 4 + 3]).toBe(0);
    expect(img.data[(9 * 10 + 4) * 4 + 3]).toBe(255);
    expect(img.data[(7 * 10 + 0) * 4 + 3]).toBe(255);
    expect(img.data[(2 * 10 + 0) * 4 + 3]).toBe(255);
    // En processCharacter, por hoja: el pasto no cuenta para medir los pies.
    const sheetImg = syntheticSheet(1, 100);
    fillRect(sheetImg, 10, 180, 80, 6, [40, 140, 30, 255]);
    const { summary } = processCharacter('x', [{ anim: 'attack', cols: 1, rows: 1, img: sheetImg }], {
      frame: [32, 32],
      height: 20,
      sheets: { attack: { grassRows: 30 } },
    });
    expect(summary[0]).toMatch(/pasto −480px/);
    expect(summary[0]).toMatch(/ref 100px/);
  });

  it('refHeight fija la escala de una hoja y anchorX ancla una x de la celda (S70)', () => {
    // Dos hojas a la misma escala; la segunda, sin cuadro de pie del mismo alto.
    const idle = { anim: 'idle', cols: 2, rows: 1, img: syntheticSheet(2, 100) };
    const attack = { anim: 'attack', cols: 2, rows: 1, img: syntheticSheet(2, 140) };
    const { summary, image } = processCharacter('x', [idle, attack], {
      frame: [32, 32],
      height: 20,
      sheets: { attack: { refHeight: 100, anchorX: 30 } },
    });
    expect(summary.find((l: string) => l.includes('attack'))).toMatch(/ref 100px/);
    // anchorX 30: el cuerpo (x 40-59 de la celda) queda 10 a 29 px de origen a la derecha del centro del frame.
    // Cuatro cuadros en una grilla de 2 × 2: el primero del ataque es el de abajo a la izquierda.
    const b = opaqueBounds(image as Img, { x: 0, y: 32, w: 32, h: 32 });
    expect(b?.x0).toBe(18);
  });

  it("anchor 'feet' clava las patas aunque el bicho se corra en la celda (S77)", () => {
    // Dos patas de 10 px separadas 40, y una uña de 3 px más adelante que no cuenta.
    const img = createImage(100, 50) as Img;
    fillRect(img, 30, 10, 60, 30, [20, 20, 30, 255]);
    fillRect(img, 30, 40, 10, 10, [20, 20, 30, 255]);
    fillRect(img, 70, 40, 10, 10, [20, 20, 30, 255]);
    fillRect(img, 22, 46, 3, 4, [200, 200, 190, 255]);
    expect(feetAnchorX(img, { x: 0, y: 0, w: 100, h: 50 }, 50, 8, 5)).toBe(55);
    // En processCharacter: dos cuadros con el bicho corrido 20 px salen con las patas en el mismo lugar.
    const sheetImg = createImage(200, 50) as Img;
    for (const [cx, shift] of [[0, 0], [100, 20]]) {
      fillRect(sheetImg, cx + 10 + shift, 10, 50, 30, [20, 20, 30, 255]);
      fillRect(sheetImg, cx + 10 + shift, 40, 8, 10, [20, 20, 30, 255]);
      fillRect(sheetImg, cx + 52 + shift, 40, 8, 10, [20, 20, 30, 255]);
    }
    const { image } = processCharacter('x', [{ anim: 'attack', cols: 2, rows: 1, img: sheetImg }], {
      frame: [64, 50],
      height: 40,
      sheets: { attack: { anchor: 'feet', feetRows: 6, feetMinRun: 5 } },
    });
    const a = opaqueBounds(image as Img, { x: 0, y: 0, w: 64, h: 50 });
    const b = opaqueBounds(image as Img, { x: 64, y: 0, w: 64, h: 50 });
    expect(a?.x0).toBe((b?.x0 ?? 0) - 64);
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

  it('greenEdgeMargin más bajo toma los verdes oliva del contorno', () => {
    const make = () => {
      const img = createImage(10, 10) as Img;
      fillRect(img, 2, 2, 6, 6, [60, 80, 20, 255]); // oliva: verde apenas sobre el rojo
      fillRect(img, 3, 3, 4, 4, [200, 150, 90, 255]);
      return img;
    };
    expect(removeGreenEdge(make())).toBe(0);
    expect(removeGreenEdge(make(), 3, 12)).toBe(20);
  });

  it('quita el borde celeste de los props y el rosado de los JPG', () => {
    const img = createImage(8, 8) as Img;
    fillRect(img, 1, 1, 6, 6, [20, 60, 60, 255]); // contorno celeste oscuro
    fillRect(img, 2, 2, 4, 4, [140, 90, 40, 255]); // madera
    expect(removeColorEdge(img, 2, EDGE_COLORS.cyan)).toBe(20);
    expect(EDGE_COLORS.magenta(200, 20, 150)).toBe(true);
    expect(EDGE_COLORS.magenta(160, 5, 15)).toBe(false); // rojo oscuro del corazón
  });

  it('processIcon recorta al dibujo y escala a size × detail', () => {
    const img = createImage(100, 100) as Img;
    fillRect(img, 0, 0, 100, 100, [240, 5, 220, 255]); // magenta desparejo de un JPG
    fillRect(img, 30, 20, 40, 60, [200, 30, 30, 255]);
    const crop = cropToContent(createImage(4, 4) as Img);
    expect(crop).toBeNull();
    const out = processIcon(img, { size: { height: 12 }, detail: 2, tolerance: 140, edge: 'magenta', edgePasses: 2 });
    expect(out?.image).toMatchObject({ width: 16, height: 24 });
    expect(out?.background).toMatch(/magenta/);
    const wide = processIcon(createImage(1, 1) as Img, { size: { width: 20 } });
    expect(wide).toBeNull();
  });

  it('propName quita el prefijo prop_ y el sufijo _transparent (S46)', () => {
    expect(propName('prop_termite_mound.png')).toBe('termite_mound');
    expect(propName('prop_ferns_transparent.png')).toBe('ferns');
    expect(propName('sign.png')).toBe('sign');
  });

  it('chroma borra el magenta puro y no el rosa del lapacho ni el violeta de los cristales (S46)', () => {
    expect(EDGE_COLORS.chroma(240, 0, 160)).toBe(true);
    expect(EDGE_COLORS.chroma(255, 150, 195)).toBe(false);
    expect(EDGE_COLORS.chroma(110, 50, 200)).toBe(false);
  });

  it('white borra el fleco blanco y gris neutro, no la madera encalada, el crema de los hongos ni el agua (S50)', () => {
    expect(EDGE_COLORS.white(235, 235, 235)).toBe(true);
    expect(EDGE_COLORS.white(170, 172, 168)).toBe(true);
    expect(EDGE_COLORS.white(230, 215, 190)).toBe(false);
    expect(EDGE_COLORS.white(220, 190, 150)).toBe(false);
    expect(EDGE_COLORS.white(170, 205, 240)).toBe(false);
    expect(EDGE_COLORS.white(60, 60, 60)).toBe(false);
  });

  it('processIcon acepta una lista de bordes y los borra en orden (S50)', () => {
    const img = createImage(6, 6) as Img;
    fillRect(img, 1, 1, 4, 4, [240, 0, 160, 255]);
    fillRect(img, 2, 2, 2, 2, [240, 240, 240, 255]);
    expect(processIcon(img, { edge: ['chroma', 'white'], edgePasses: 2 })).toBeNull();
    const keep = createImage(6, 6) as Img;
    fillRect(keep, 1, 1, 4, 4, [240, 0, 160, 255]);
    fillRect(keep, 2, 2, 2, 2, [40, 120, 40, 255]);
    expect(processIcon(keep, { edge: ['chroma', 'white'], edgePasses: 2 })?.image.width).toBe(2);
  });

  it('packAtlas acomoda sin solapar, deja aire y respeta el ancho máximo (S46)', () => {
    const solid = (w: number, h: number, v: number): Img => {
      const img = createImage(w, h) as Img;
      fillRect(img, 0, 0, w, h, [v, v, v, 255]);
      return img;
    };
    const entries = [
      { name: 'b', image: solid(30, 10, 10) },
      { name: 'a', image: solid(40, 20, 20) },
      { name: 'c', image: solid(30, 5, 30) },
    ];
    const { image, frames } = packAtlas(entries, 80, 2);
    expect(Object.keys(frames)).toEqual(['b', 'a', 'c']);
    expect(image.width).toBeLessThanOrEqual(80);
    const rects = Object.values(frames) as { x: number; y: number; w: number; h: number }[];
    for (const r of rects) expect(r.x + r.w).toBeLessThanOrEqual(image.width);
    for (let i = 0; i < rects.length; i++)
      for (let j = i + 1; j < rects.length; j++) {
        const [p, q] = [rects[i], rects[j]];
        const apart = p.x + p.w + 2 <= q.x || q.x + q.w + 2 <= p.x || p.y + p.h + 2 <= q.y || q.y + q.h + 2 <= p.y;
        expect(apart).toBe(true);
      }
    // Cada imagen queda copiada en su lugar.
    const at = (x: number, y: number) => image.data[(y * image.width + x) * 4];
    expect(at(frames.a.x, frames.a.y)).toBe(20);
    expect(at(frames.c.x + 29, frames.c.y + 4)).toBe(30);
    expect(() => packAtlas([{ name: 'big', image: solid(100, 1, 1) }], 80)).toThrow(/big/);
  });
});

describe('propFrameData (S47)', () => {
  it('pasa al frame del atlas solo lo que el juego usa, sin notas ni ignore', () => {
    const sheet = { note: 'x', ignore: false, sink: 6, waterOnly: true, hang: false, flow: { dir: 'down', region: [0, 0, 1, 1] } };
    expect(propFrameData(sheet)).toEqual({ sink: 6, waterOnly: true, flow: { dir: 'down', region: [0, 0, 1, 1] } });
    expect(propFrameData({ hang: true, mist: true, splash: [0.3, 0.7, 0.95] })).toEqual({ hang: true, mist: true, splash: [0.3, 0.7, 0.95] });
    expect(propFrameData()).toEqual({});
    // S48: las matas de pasto al pie de los árboles.
    const tufts = [{ prop: 'l3_pastizal/grass_tuft_bent', x: 0.3, scale: 0.45, sink: 2 }];
    expect(propFrameData({ note: 'x', sink: 3, tufts })).toEqual({ sink: 3, tufts });
  });
});
