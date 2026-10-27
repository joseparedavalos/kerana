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

// S60: el dosel de l5. El relleno de arriba de la imagen lleva siluetas de copas (sobre los árboles de los costados y
// colgando del borde de arriba), y por encima cruzan bandas de niebla y bajan rayos de luz entre las copas.

/** Generador con semilla (mulberry32): las copas, los rayos y la niebla salen iguales en cada partida. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Luminancia aproximada (0-255) de un color 0xRRGGBB. */
export function luminance(c: number): number {
  return 0.299 * ((c >> 16) & 0xff) + 0.587 * ((c >> 8) & 0xff) + 0.114 * (c & 0xff);
}

const smoothstep = (lo: number, hi: number, v: number) => {
  const k = Math.min(1, Math.max(0, (v - lo) / (hi - lo)));
  return k * k * (3 - 2 * k);
};

/**
 * Cuánto es dosel cada columna del borde (0 = claro, 1 = copa oscura): qué tan oscura es frente a `top`, el color de
 * arriba del degradado, entre `lo` y `hi`.
 */
export function canopyWeights(edge: readonly number[], top: number, lo: number, hi: number): number[] {
  const lt = Math.max(1, luminance(top));
  return edge.map((c) => smoothstep(lo, hi, 1 - luminance(c) / lt));
}

/** Valor de una lista de columnas en `x` (0 a `width`), interpolado entre los centros de las columnas. */
function columnAt(values: readonly number[], x: number, width: number): [number, number, number] {
  const f = Math.min(values.length - 1, Math.max(0, (x / width) * values.length - 0.5));
  const i = Math.floor(f);
  const j = Math.min(values.length - 1, i + 1);
  return [i, j, f - i];
}

function colorAt(colors: readonly number[], x: number, width: number): number {
  const [i, j, t] = columnAt(colors, x, width);
  return mixColor(colors[i]!, colors[j]!, t);
}

function weightAt(weights: readonly number[], x: number, width: number): number {
  const [i, j, t] = columnAt(weights, x, width);
  return weights[i]! * (1 - t) + weights[j]! * t;
}

/**
 * Borde festoneado: la envolvente de arriba de círculos puestos uno al lado del otro. `base(x)` da a qué distancia
 * del borde (px) va el centro de cada copa; el radio sale entre `rMin` y `rMax`. Devuelve, por columna, hasta dónde
 * llega la silueta medida desde el borde (≤ 0: nada).
 */
export function scallop(width: number, base: (x: number) => number, rMin: number, rMax: number, rand: () => number): Float32Array {
  const out = new Float32Array(width).fill(-1);
  let x = -rMax;
  while (x < width + rMax) {
    const r = rMin + (rMax - rMin) * rand();
    const cx = x + r;
    const cy = base(Math.min(width - 1, Math.max(0, cx))) - r * (0.3 + 0.5 * rand());
    for (let px = Math.max(0, Math.floor(cx - r)); px < Math.min(width, Math.ceil(cx + r)); px++) {
      const dx = px + 0.5 - cx;
      if (Math.abs(dx) < r) out[px] = Math.max(out[px]!, cy + Math.sqrt(r * r - dx * dx));
    }
    x += r * (1 + 0.5 * rand());
  }
  return out;
}

export interface CanopyLook {
  /** Cuánto es dosel cada columna (`canopyWeights`). */
  weights: readonly number[];
  /** Color (0xRRGGBB) y opacidad de las copas. */
  crownColor: number;
  crownAlpha: number;
  /** Lo más que suben las copas de los costados sobre el borde de la imagen (fracción del alto del relleno). */
  crownHeight: number;
  /** Cuánto varía ese alto de un árbol a otro (0 = todas iguales, 1 = de nada a todo). */
  crownVary: number;
  /** Opacidad relativa de las copas arriba del todo (la neblina se come las lejanas; abajo, 1). */
  hazeTop: number;
  /** Fracción de abajo del relleno donde las copas se funden con el borde de la imagen (sin costura). */
  bottomFade: number;
  /** El dosel que cuelga del borde de arriba: cuánto baja en lo claro y en lo oscuro (fracciones del alto) y su opacidad. */
  fringeMin: number;
  fringeMax: number;
  fringeAlpha: number;
  /** Radio de cada copa (px de la textura). */
  rMin: number;
  rMax: number;
  seed: number;
}

/**
 * Relleno con dosel (S60): el degradado de S59 (`top` arriba, el color del borde abajo, por columnas) con las
 * siluetas de las copas encima, horneadas en la misma textura (no cuesta dibujar nada más). Escribe RGBA en `out`.
 */
export function canopyFill(
  edge: readonly number[],
  top: number,
  width: number,
  height: number,
  look: CanopyLook,
  out: Uint8ClampedArray,
): void {
  const rand = seeded(look.seed);
  const w = (x: number) => weightAt(look.weights, x, width);
  const vary = waves(width, rand);
  const tall = (x: number, k: number) => w(x) * look.crownHeight * height * k * (1 - look.crownVary + look.crownVary * vary(x));
  // Dos filas de copas: atrás, más altas y comidas por la neblina; adelante, más bajas y oscuras.
  const rows = [
    { edge: leafy(scallop(width, (x) => tall(x, 1), look.rMin, look.rMax, rand), look.rMin, rand), alpha: 0.45 },
    { edge: leafy(scallop(width, (x) => tall(x, 0.6), look.rMin * 0.8, look.rMax * 0.8, rand), look.rMin, rand), alpha: 1 },
  ];
  const varyTop = waves(width, rand);
  const fringeAt = (x: number) => (look.fringeMin + (look.fringeMax - look.fringeMin) * w(x)) * height * (0.4 + 0.6 * varyTop(x));
  const fringe = leafy(scallop(width, fringeAt, look.rMin * 0.6, look.rMax * 0.8, rand), look.rMin, rand);
  for (let x = 0; x < width; x++) {
    const ec = colorAt(edge, x, width);
    for (let y = 0; y < height; y++) {
      const t = height > 1 ? y / (height - 1) : 1;
      let c = mixColor(top, ec, t);
      // Copas que suben desde el borde de la imagen (borde suave de 1 px).
      const up = height - 1 - y;
      const haze = look.hazeTop + (1 - look.hazeTop) * t;
      const fade = smoothstep(1, 1 - look.bottomFade, t);
      for (const row of rows) {
        const inCrown = Math.min(1, Math.max(0, row.edge[x]! - up + 0.5));
        if (inCrown > 0) c = mixColor(c, look.crownColor, inCrown * row.alpha * look.crownAlpha * haze * fade);
      }
      const inFringe = Math.min(1, Math.max(0, fringe[x]! - y + 0.5));
      if (inFringe > 0) c = mixColor(c, look.crownColor, inFringe * look.fringeAlpha);
      const i = (y * width + x) * 4;
      out[i] = (c >> 16) & 0xff;
      out[i + 1] = (c >> 8) & 0xff;
      out[i + 2] = c & 0xff;
      out[i + 3] = 255;
    }
  }
}

/** Borde de hojas: copitas chicas sobre el borde de las grandes (como el dibujo del fondo, no círculos lisos). */
function leafy(edge: Float32Array, rMin: number, rand: () => number): Float32Array {
  const small = scallop(edge.length, (x) => edge[Math.round(x)]!, rMin * 0.25, rMin * 0.5, rand);
  return edge.map((v, x) => (v > 0 ? Math.max(v, small[x]!) : v));
}

/** Ondas suaves a lo ancho (0 a 1): de un árbol a otro las copas no miden lo mismo. */
function waves(width: number, rand: () => number): (x: number) => number {
  const parts = [2, 3, 7].map((k) => ({ k, phase: rand() * Math.PI * 2 }));
  return (x) => 0.5 + parts.reduce((s, p) => s + Math.sin((2 * Math.PI * p.k * x) / width + p.phase), 0) / (2 * parts.length);
}

/** Dónde bajan los rayos (fracciones del ancho): repartidos en lo claro del dosel (peso < 0,5), con un poco de azar. */
export function rayAnchors(weights: readonly number[], count: number, rand: () => number): number[] {
  const open = weights.map((v, i) => [v, i] as const).filter(([v]) => v < 0.5).map(([, i]) => i);
  if (open.length === 0 || count <= 0) return [];
  const from = open[0]! / weights.length;
  const to = (open[open.length - 1]! + 1) / weights.length;
  const step = (to - from) / count;
  return Array.from({ length: count }, (_, k) => from + step * (k + 0.25 + 0.5 * rand()));
}

/** Textura de un rayo (alfa 0-255): suave a los costados, asoma arriba y se apaga hacia abajo. */
export function rayAlpha(width: number, height: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(width * height);
  for (let y = 0; y < height; y++) {
    const t = y / Math.max(1, height - 1);
    const v = smoothstep(0, 0.12, t) * Math.pow(1 - t, 1.3);
    for (let x = 0; x < width; x++) {
      const d = (x + 0.5) / width - 0.5;
      out[y * width + x] = Math.round(255 * v * Math.exp(-(d * d) / 0.035));
    }
  }
  return out;
}

/** Jirón de niebla (alfa 0-255): un trozo de banda que se apaga hacia los dos extremos. */
export function mistPuffAlpha(width: number, height: number, rand: () => number): Uint8ClampedArray {
  const out = mistBandAlpha(width, height, rand);
  for (let x = 0; x < width; x++) {
    const ends = Math.pow(Math.sin((Math.PI * (x + 0.5)) / width), 2);
    for (let y = 0; y < height; y++) out[y * width + x] = Math.round(out[y * width + x]! * ends);
  }
  return out;
}

/**
 * Banda de niebla (alfa 0-255) que se repite de costado sin costura: ondas de frecuencia entera a lo ancho, que se
 * corren un poco con la altura, dentro de una campana vertical.
 */
export function mistBandAlpha(width: number, height: number, rand: () => number): Uint8ClampedArray {
  const waves = [1, 2, 3, 5, 8].map((k) => ({ k, a: 1 / Math.sqrt(k), phase: rand() * Math.PI * 2, tilt: (rand() - 0.5) * 2 }));
  const total = waves.reduce((s, wv) => s + wv.a, 0);
  const out = new Uint8ClampedArray(width * height);
  for (let y = 0; y < height; y++) {
    const v = y / Math.max(1, height - 1);
    const bell = Math.pow(Math.sin(Math.PI * v), 2);
    for (let x = 0; x < width; x++) {
      let n = 0;
      for (const wv of waves) n += wv.a * Math.sin((2 * Math.PI * wv.k * x) / width + wv.phase + wv.tilt * v * Math.PI);
      const cloud = 0.4 + 0.6 * smoothstep(-0.6, 0.8, n / total);
      out[y * width + x] = Math.round(255 * bell * cloud);
    }
  }
  return out;
}
