// Ambiente pintado en el fondo (S59): lógica pura, sin Phaser (se prueba en tests/ambient.test.ts).
// Como el agua de S47, se separa por código lo que se mueve (las rayas de lluvia, la niebla) del resto del
// dibujo, que queda quieto. Todo trabaja sobre píxeles RGBA de `getImageData`.

/** Mezcla de dos colores 0xRRGGBB: `t` = 0 da `a`, 1 da `b`. */
export function mixColor(a: number, b: number, t: number): number {
  const k = Math.min(1, Math.max(0, t));
  const ch = (shift: number) =>
    Math.round(((a >> shift) & 0xff) * (1 - k) + ((b >> shift) & 0xff) * k);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

/**
 * Color (0xRRGGBB) del borde de arriba de la imagen en `columns` columnas: el promedio de sus `rows` primeras filas
 * en cada tramo, ensanchado `blur` px a cada lado para que el paso de una columna a la otra sea suave.
 */
export function edgeColumns(
  rgba: ArrayLike<number>,
  width: number,
  rows: number,
  columns: number,
  blur: number,
): number[] {
  const out: number[] = [];
  for (let c = 0; c < columns; c++) {
    const x0 = Math.max(0, Math.floor((c * width) / columns) - blur);
    const x1 = Math.min(width, Math.ceil(((c + 1) * width) / columns) + blur);
    let r = 0;
    let g = 0;
    let b = 0;
    let n = 0;
    for (let y = 0; y < rows; y++) {
      for (let x = x0; x < x1; x++) {
        const i = (y * width + x) * 4;
        r += rgba[i]!;
        g += rgba[i + 1]!;
        b += rgba[i + 2]!;
        n++;
      }
    }
    out.push(
      n === 0
        ? 0
        : (Math.round(r / n) << 16) |
            (Math.round(g / n) << 8) |
            Math.round(b / n),
    );
  }
  return out;
}

export interface RainTest {
  /** Cuánto más clara (o más oscura) que sus vecinas a 2 px tiene que ser una raya (0 a 255). */
  contrast: number;
  /** Lo que pueden variar entre sí los píxeles de los costados (a 2, 3 y 4 px): la lluvia cae sobre neblina lisa, no sobre hojas. */
  smooth: number;
  /** De sus cuatro vecinos de arriba y de abajo (a 1 y 2 px), cuántos siguen la raya: la lluvia es vertical. */
  run: number;
}

const lum = (d: ArrayLike<number>, i: number) =>
  (d[i]! + d[i + 1]! + d[i + 2]!) / 3;

/** Máscara de las rayas de lluvia pintadas: 1 en cada píxel de raya, 0 en el resto. */
export function rainMask(
  rgba: ArrayLike<number>,
  width: number,
  height: number,
  test: RainTest,
): Uint8Array {
  // Signo de cada píxel candidato: +1 raya clara, −1 raya oscura, 0 nada.
  const sign = new Int8Array(width * height);
  const sides = [-4, -3, -2, 2, 3, 4];
  for (let y = 0; y < height; y++) {
    for (let x = 4; x < width - 4; x++) {
      const p = y * width + x;
      const l = lum(rgba, p * 4);
      const d = l - (lum(rgba, (p - 2) * 4) + lum(rgba, (p + 2) * 4)) / 2;
      if (Math.abs(d) <= test.contrast) continue;
      let lo = 255;
      let hi = 0;
      for (const s of sides) {
        const v = lum(rgba, (p + s) * 4);
        lo = Math.min(lo, v);
        hi = Math.max(hi, v);
      }
      if (hi - lo < test.smooth) sign[p] = d > 0 ? 1 : -1;
    }
  }
  const mask = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = y * width + x;
      if (!sign[p]) continue;
      let count = 0;
      for (const k of [-2, -1, 1, 2]) {
        const yy = y + k;
        if (yy >= 0 && yy < height && sign[yy * width + x] === sign[p]) count++;
      }
      if (count >= test.run) mask[p] = 1;
    }
  }
  // Las puntas de cada raya tienen menos vecinos: entran si siguen a un píxel de raya a 1 o 2 px, del mismo signo.
  const tips: number[] = [];
  for (let p = 0; p < width * height; p++) {
    if (!sign[p] || mask[p]) continue;
    for (const k of [-2, -1, 1, 2]) {
      const q = p + k * width;
      if (q >= 0 && q < width * height && mask[q] && sign[q] === sign[p]) {
        tips.push(p);
        break;
      }
    }
  }
  for (const p of tips) mask[p] = 1;
  return mask;
}

/**
 * Separa la lluvia del fondo: `clean` es el dibujo sin las rayas (cada raya toma el promedio de sus vecinos a 2 px)
 * y `rain`, solo las rayas con su color, opacas, sobre transparente. Los dos del tamaño de la imagen.
 */
export function splitRain(
  rgba: ArrayLike<number>,
  width: number,
  height: number,
  mask: Uint8Array,
  clean: Uint8ClampedArray,
  rain: Uint8ClampedArray,
): void {
  for (let i = 0; i < width * height * 4; i++) {
    clean[i] = rgba[i]!;
    rain[i] = 0;
  }
  for (let p = 0; p < width * height; p++) {
    if (!mask[p]) continue;
    const x = p % width;
    const left = (x >= 2 ? p - 2 : p) * 4;
    const right = (x < width - 2 ? p + 2 : p) * 4;
    for (let c = 0; c < 3; c++) {
      clean[p * 4 + c] = (rgba[left + c]! + rgba[right + c]!) / 2;
      rain[p * 4 + c] = rgba[p * 4 + c]!;
    }
    rain[p * 4 + 3] = 255;
  }
}

/**
 * Un fotograma de la lluvia que cae (`phase` de 0 a 1), como el agua de S47: las rayas de `rain` bajan
 * `phase × period` px sobre el dibujo limpio (y se repiten de abajo hacia arriba). Para que el ciclo no salte, se
 * mezclan con las mismas rayas un período más arriba, con peso `phase`: cada raya se apaga mientras baja y la de
 * arriba se enciende. `alpha` es la opacidad de las rayas.
 */
export function rainFrame(
  clean: ArrayLike<number>,
  rain: ArrayLike<number>,
  width: number,
  height: number,
  period: number,
  phase: number,
  alpha: number,
  out: Uint8ClampedArray,
): Uint8ClampedArray {
  for (let i = 0; i < width * height * 4; i++) out[i] = clean[i]!;
  const near = Math.round(phase * period);
  const layers: Array<[number, number]> = [
    [near, alpha * (1 - phase)],
    [near - period, alpha * phase],
  ];
  for (let p = 0; p < width * height; p++) {
    if (!rain[p * 4 + 3]) continue;
    const x = p % width;
    const y = (p - x) / width;
    for (const [shift, weight] of layers) {
      if (weight <= 0) continue;
      const t = ((((y + shift) % height) + height) % height) * width + x;
      for (let c = 0; c < 3; c++)
        out[t * 4 + c] =
          out[t * 4 + c]! * (1 - weight) + rain[p * 4 + c]! * weight;
    }
  }
  return out;
}

export interface MistTest {
  /** Canal más claro mínimo (0 a 255): los arbustos y las sombras son más oscuros. */
  minBright: number;
  /** Cuánto más azul que roja tiene que ser: la niebla de l7 es azulada; la piedra y el ladrillo, no. */
  minBlue: number;
}

/** ¿El píxel es niebla? Claro y azulado. */
export function isMistPixel(
  r: number,
  g: number,
  b: number,
  test: MistTest,
): boolean {
  return Math.max(r, g, b) >= test.minBright && b - r >= test.minBlue;
}

/**
 * Capa de niebla: la franja `region` (fracciones x0, y0, x1, y1 de la imagen) con solo los píxeles de niebla, y su
 * opacidad bajando a 0 en las `feather` filas de arriba y de abajo para que no se vea el borde de la franja.
 */
export function mistLayer(
  rgba: ArrayLike<number>,
  width: number,
  height: number,
  region: readonly [number, number, number, number],
  test: MistTest,
  feather: number,
): {
  x: number;
  y: number;
  width: number;
  height: number;
  data: Uint8ClampedArray;
} {
  const x0 = Math.max(0, Math.floor(region[0] * width));
  const y0 = Math.max(0, Math.floor(region[1] * height));
  const w = Math.min(width, Math.ceil(region[2] * width)) - x0;
  const h = Math.min(height, Math.ceil(region[3] * height)) - y0;
  const data = new Uint8ClampedArray(Math.max(0, w * h * 4));
  for (let y = 0; y < h; y++) {
    const edge = Math.min(y + 1, h - y);
    const alpha = feather > 0 ? Math.min(1, edge / feather) : 1;
    for (let x = 0; x < w; x++) {
      const i = ((y + y0) * width + x + x0) * 4;
      if (!isMistPixel(rgba[i]!, rgba[i + 1]!, rgba[i + 2]!, test)) continue;
      const o = (y * w + x) * 4;
      data[o] = rgba[i]!;
      data[o + 1] = rgba[i + 1]!;
      data[o + 2] = rgba[i + 2]!;
      data[o + 3] = Math.round(255 * alpha);
    }
  }
  return { x: x0, y: y0, width: w, height: h, data };
}

/** Desplazamiento de una capa que corre en bucle: `speed` px por segundo, a los `ms` de juego, dentro de `period` px. */
export function scrollOffset(
  ms: number,
  speed: number,
  period: number,
): number {
  if (period <= 0) return 0;
  return ((((ms / 1000) * speed) % period) + period) % period;
}
