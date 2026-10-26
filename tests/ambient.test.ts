import { describe, expect, it } from "vitest";
import {
  edgeColumns,
  isMistPixel,
  mistLayer,
  mixColor,
  rainFrame,
  rainMask,
  scrollOffset,
  splitRain,
} from "../src/systems/ambientLogic";

// Imagen RGBA de `w` × `h` de un gris liso, con `paint(x, y)` para cambiar píxeles.
function image(
  w: number,
  h: number,
  gray: number,
  paint?: (x: number, y: number) => number | undefined,
): Uint8ClampedArray {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const v = paint?.(x, y) ?? gray;
      data.set([v, v, v, 255], (y * w + x) * 4);
    }
  }
  return data;
}

const TEST = { contrast: 6, smooth: 20, run: 3 };

describe("relleno por columnas (S59)", () => {
  it("mezcla dos colores", () => {
    expect(mixColor(0x000000, 0xffffff, 0)).toBe(0x000000);
    expect(mixColor(0x000000, 0xffffff, 1)).toBe(0xffffff);
    expect(mixColor(0x000000, 0x0000ff, 0.5)).toBe(0x000080);
  });

  it("toma el color del borde por tramos: oscuro a los costados y claro al medio", () => {
    const data = image(12, 4, 0, (x) => (x >= 4 && x < 8 ? 200 : 20));
    expect(edgeColumns(data, 12, 2, 3, 0)).toEqual([
      0x141414, 0xc8c8c8, 0x141414,
    ]);
    // Con suavizado, el tramo del medio se mezcla con sus vecinos.
    const blurred = edgeColumns(data, 12, 2, 3, 2);
    expect(blurred[1]! & 0xff).toBeLessThan(200);
    expect(blurred[1]! & 0xff).toBeGreaterThan(20);
  });
});

describe("lluvia pintada (S59)", () => {
  // Raya clara vertical de 5 px en x = 10, sobre gris liso.
  const W = 20;
  const H = 12;
  const streak = (x: number, y: number) =>
    x === 10 && y >= 3 && y <= 7 ? 140 : undefined;

  it("encuentra una raya vertical sobre fondo liso", () => {
    const mask = rainMask(image(W, H, 100, streak), W, H, TEST);
    expect(mask[5 * W + 10]).toBe(1);
    expect(mask[5 * W + 9]).toBe(0);
    expect(mask[1 * W + 10]).toBe(0);
  });

  it("un punto suelto o una raya sobre hojas (fondo no liso) no es lluvia", () => {
    const dot = image(W, H, 100, (x, y) =>
      x === 10 && y === 5 ? 140 : undefined,
    );
    expect(rainMask(dot, W, H, TEST).some((v) => v === 1)).toBe(false);
    const leaves = image(
      W,
      H,
      100,
      (x, y) => streak(x, y) ?? (x % 2 === 0 ? 60 : 130),
    );
    expect(rainMask(leaves, W, H, TEST)[5 * W + 10]).toBe(0);
  });

  it("separa la raya: el dibujo limpio queda liso y la capa de lluvia solo tiene la raya", () => {
    const src = image(W, H, 100, streak);
    const mask = rainMask(src, W, H, TEST);
    const clean = new Uint8ClampedArray(src.length);
    const rain = new Uint8ClampedArray(src.length);
    splitRain(src, W, H, mask, clean, rain);
    const at = (x: number, y: number) => (y * W + x) * 4;
    expect(clean[at(10, 5)]).toBe(100);
    expect(rain[at(10, 5)]).toBe(140);
    expect(rain[at(10, 5) + 3]).toBe(255);
    expect(rain[at(4, 5) + 3]).toBe(0);
  });

  it("el fotograma baja la raya y el ciclo no salta", () => {
    const src = image(W, H, 100, streak);
    const mask = rainMask(src, W, H, TEST);
    const clean = new Uint8ClampedArray(src.length);
    const rain = new Uint8ClampedArray(src.length);
    splitRain(src, W, H, mask, clean, rain);
    const out = new Uint8ClampedArray(src.length);
    const at = (x: number, y: number) => (y * W + x) * 4;
    // Fase 0: la raya donde está pintada.
    rainFrame(clean, rain, W, H, 4, 0, 1, out);
    expect(out[at(10, 3)]).toBe(140);
    // Fase 1/2, período 4: baja 2 px a media opacidad, y la copia de 4 px más arriba asoma a media opacidad.
    rainFrame(clean, rain, W, H, 4, 0.5, 1, out);
    expect(out[at(10, 9)]).toBe(120);
    expect(out[at(10, 1)]).toBe(120);
    expect(out[at(4, 9)]).toBe(100);
    // Fase 1 (fin del ciclo) = fase 0.
    const end = rainFrame(
      clean,
      rain,
      W,
      H,
      4,
      1,
      1,
      new Uint8ClampedArray(src.length),
    );
    expect(end[at(10, 3)]).toBe(140);
    expect(end[at(10, 9)]).toBe(100);
  });

  it("la opacidad aclara las rayas", () => {
    const src = image(W, H, 100, streak);
    const mask = rainMask(src, W, H, TEST);
    const clean = new Uint8ClampedArray(src.length);
    const rain = new Uint8ClampedArray(src.length);
    splitRain(src, W, H, mask, clean, rain);
    const out = rainFrame(
      clean,
      rain,
      W,
      H,
      4,
      0,
      0.5,
      new Uint8ClampedArray(src.length),
    );
    expect(out[(5 * W + 10) * 4]).toBe(120);
  });
});

describe("niebla pintada (S59)", () => {
  it("la niebla es clara y azulada; la piedra gris y los arbustos oscuros, no", () => {
    const test = { minBright: 60, minBlue: 16 };
    expect(isMistPixel(48, 60, 80, test)).toBe(true);
    expect(isMistPixel(70, 70, 72, test)).toBe(false);
    expect(isMistPixel(10, 15, 30, test)).toBe(false);
  });

  it("recorta la franja con solo la niebla y la desvanece en los bordes", () => {
    const w = 4;
    const h = 10;
    const data = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < w * h; i++)
      data.set(i % w === 0 ? [70, 70, 72, 255] : [48, 60, 80, 255], i * 4);
    const layer = mistLayer(
      data,
      w,
      h,
      [0, 0.2, 1, 0.8],
      { minBright: 60, minBlue: 16 },
      2,
    );
    expect(layer).toMatchObject({ x: 0, y: 2, width: 4, height: 6 });
    const alpha = (x: number, y: number) => layer.data[(y * 4 + x) * 4 + 3];
    expect(alpha(0, 3)).toBe(0);
    expect(alpha(1, 0)).toBe(128);
    expect(alpha(1, 3)).toBe(255);
    expect(alpha(1, 5)).toBe(128);
  });

  it("el desplazamiento da la vuelta dentro del período", () => {
    expect(scrollOffset(0, 10, 50)).toBe(0);
    expect(scrollOffset(2000, 10, 50)).toBe(20);
    expect(scrollOffset(6000, 10, 50)).toBe(10);
    expect(scrollOffset(1000, -10, 50)).toBe(40);
    expect(scrollOffset(1000, 10, 0)).toBe(0);
  });
});
