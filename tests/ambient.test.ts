import { describe, expect, it } from "vitest";
import {
  canopyFill,
  canopyWeights,
  edgeColumns,
  isMistPixel,
  mistLayer,
  mistPuffAlpha,
  mixColor,
  rainFrame,
  rainMask,
  rayAlpha,
  rayAnchors,
  scrollOffset,
  seeded,
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

// S60: el dosel de l5. Borde como el de l5: oscuro a los costados, claro al medio.
describe("dosel (S60)", () => {
  const DARK = 0x0f1a0e;
  const LIGHT = 0x708268;
  const TOP = 0xa9bf98;
  const edge = [DARK, DARK, DARK, LIGHT, LIGHT, DARK, DARK, DARK];
  const look = (weights: number[]) => ({
    weights,
    crownColor: 0x1d3320,
    crownAlpha: 0.85,
    crownHeight: 0.5,
    crownVary: 0.6,
    hazeTop: 0.4,
    bottomFade: 0.14,
    fringeMin: 0.03,
    fringeMax: 0.2,
    fringeAlpha: 0.8,
    rMin: 6,
    rMax: 14,
    seed: 5,
  });

  it("el azar con semilla se repite", () => {
    const a = seeded(5);
    const b = seeded(5);
    const xs = Array.from({ length: 5 }, () => a());
    expect(xs).toEqual(Array.from({ length: 5 }, () => b()));
    expect(xs.every((v) => v >= 0 && v < 1)).toBe(true);
  });

  it("los costados oscuros son dosel; el medio claro, no", () => {
    const w = canopyWeights(edge, TOP, 0.45, 0.75);
    expect(w[0]).toBe(1);
    expect(w[3]).toBe(0);
  });

  it("las copas suben sobre los costados, el medio queda abierto, y abajo no hay costura con la imagen", () => {
    const W = 160;
    const H = 80;
    const out = new Uint8ClampedArray(W * H * 4);
    canopyFill(edge, TOP, W, H, look(canopyWeights(edge, TOP, 0.45, 0.75)), out);
    const at = (x: number, y: number) => (out[(y * W + x) * 4]! << 16) | (out[(y * W + x) * 4 + 1]! << 8) | out[(y * W + x) * 4 + 2]!;
    // Sin copas, cerca de abajo el degradado sería mezcla del color de arriba y del borde.
    const plain = mixColor(TOP, DARK, 60 / (H - 1));
    const sideDarker = [4, 10, 16].some((x) => (at(x, 60) & 0xff00) < (plain & 0xff00));
    expect(sideDarker).toBe(true);
    // En el medio, a media altura: el degradado limpio (ni copas ni dosel colgante).
    expect(at(80, 40)).toBe(mixColor(TOP, mixColor(LIGHT, LIGHT, 0), 40 / (H - 1)));
    // La fila de abajo es el color del borde (sigue con el fundido sobre la imagen).
    expect(at(2, H - 1)).toBe(DARK);
    expect(out.every((v, i) => i % 4 !== 3 || v === 255)).toBe(true);
  });

  it("los rayos bajan en lo claro", () => {
    const w = canopyWeights(edge, TOP, 0.45, 0.75);
    const xs = rayAnchors(w, 4, seeded(1));
    expect(xs).toHaveLength(4);
    expect(xs.every((x) => x >= 3 / 8 && x <= 5 / 8)).toBe(true);
    expect(rayAnchors([1, 1], 3, seeded(1))).toEqual([]);
  });

  it("rayo y jirón se apagan en los bordes", () => {
    const ray = rayAlpha(16, 64);
    expect(ray[0]).toBe(0); // arriba asoma
    expect(ray[63 * 16 + 8]).toBe(0); // abajo se apaga
    expect(ray[20 * 16 + 8]!).toBeGreaterThan(ray[20 * 16]!); // más fuerte al medio
    const puff = mistPuffAlpha(64, 16, seeded(2));
    for (let y = 0; y < 16; y++) expect(puff[y * 64]!).toBeLessThan(8);
    expect(Math.max(...puff)).toBeGreaterThan(100);
  });
});
