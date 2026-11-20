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

/**
 * S113: los colores del dosel, medidos en l5_far.jpg (de lo oscuro a lo claro). `leaf`: las copas del frente (#0a130b …
 * #485828) y la luz filtrada en las hojas de arriba (#6b7c34, #8f9f43); `haze`: el árbol del medio, en la niebla
 * (#3a4f3b … #94a87e); `fog`: la niebla y el cielo de la lluvia (#5f7058 … #a5b796); `bark`: los troncos y las ramas
 * (#11170e … #374022, corridos al marrón); `moss`: el musgo de las ramas; `bromel` y `orchid`: las flores de las
 * bromelias y de las orquídeas (las del prop `l5_altura/orchids`).
 */
export const CANOPY_PALETTE = {
  leaf: [0x070f09, 0x0b150c, 0x111d10, 0x182714, 0x223419, 0x2e421e, 0x3c5223, 0x4f652b, 0x6b7c34, 0x8f9f43],
  haze: [0x3a4f3b, 0x435942, 0x495f44, 0x516848, 0x60774f, 0x758c66, 0x819875, 0x94a87e],
  fog: [0x5f7058, 0x75886f, 0x879a7d, 0x94a787, 0xa5b796, 0xb9c8a8],
  bark: [0x0d0b08, 0x16120c, 0x221a11, 0x2f2417, 0x3d301e, 0x4e3e27],
  moss: [0x1d2a14, 0x2b3d1a, 0x3d5320, 0x536b28, 0x6f8732],
  bromel: [0x46111d, 0x741d2b, 0xa93138, 0xd65646],
  orchid: [0x6e3d6a, 0xa0629a, 0xd39ccb],
} as const;

export interface CanopyLook {
  /** Cuánto es dosel cada columna (`canopyWeights`). */
  weights: readonly number[];
  /** Píxeles de arte por píxel del dosel: el «píxel» del fondo pintado (≈ 3), para que las hojas tengan su tamaño. */
  pixel: number;
  /** Copas lejanas (en la niebla, sobre el claro), del medio y de adelante (a los costados): hasta dónde suben (fracción del alto). */
  farHeight: number;
  midHeight: number;
  nearHeight: number;
  /** El dosel que cuelga del borde de arriba: cuánto baja en lo claro y en lo oscuro (fracciones del alto). */
  fringeMin: number;
  fringeMax: number;
  /** Ramas que salen de los costados (por lado), lianas cada 100 px de arte y bromelias o epífitas por rama. */
  branches: number;
  lianas: number;
  epiphytes: number;
  /** Rayos de luz horneados entre las hojas (tramados): cuántos, ancho (px de arte), inclinación, fuerza (0-1) y color. */
  rays: { count: number; width: number; tiltDeg: number; strength: number; color: number };
  /** Una banda de niebla quieta y tramada entre las copas: centro y alto (fracciones del alto), opacidad y color. */
  haze: { at: number; height: number; alpha: number; color: number };
  /** Alto (px de arte) de la franja de abajo que copia el borde de la imagen y se deshace tramada (sin costura). */
  blend: number;
  seed: number;
}

/** Tramado ordenado (Bayer 4 × 4): umbral de 0 a 1 en cada celda. */
const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
export const bayer4 = (x: number, y: number): number => (BAYER4[(((y % 4) + 4) % 4) * 4 + (((x % 4) + 4) % 4)]! + 0.5) / 16;
/** Ruido suave (0 a 1) en celdas de `cell` píxeles: los bordes tramados salen en grumos, no en damero. */
export function lumpNoise(x: number, y: number, seed: number, cell = 4): number {
  const h = (ix: number, iy: number) => {
    let v = Math.imul(ix, 0x27d4eb2d) ^ Math.imul(iy, 0x165667b1) ^ Math.imul(seed | 0, 0x85ebca6b);
    v ^= v >>> 15;
    v = Math.imul(v, 0x2c1b3c6d);
    v ^= v >>> 13;
    return (v >>> 0) / 4294967296;
  };
  const fx = x / cell;
  const fy = y / cell;
  const ix = Math.floor(fx);
  const iy = Math.floor(fy);
  const tx = smoothstep(0, 1, fx - ix);
  const ty = smoothstep(0, 1, fy - iy);
  const a = h(ix, iy) + (h(ix + 1, iy) - h(ix, iy)) * tx;
  const b = h(ix, iy + 1) + (h(ix + 1, iy + 1) - h(ix, iy + 1)) * tx;
  return a + (b - a) * ty;
}
/** Borde tramado: por dentro (`t` ≥ `solid`) la mezcla entera; en el borde, en grumos de ruido; afuera, nada. */
const edgeMix = (t: number, solid: number, x: number, y: number, seed: number): boolean =>
  t >= solid || (t > 0 && t / solid > 0.35 + 0.65 * lumpNoise(x, y, seed, 2) * (0.6 + 0.4 * bayer4(x, y)));

/**
 * Relleno con dosel (S60; dibujado de nuevo en S113): el degradado de S59 (`top` arriba, el color del borde abajo, por
 * columnas) y encima, en píxeles gruesos del tamaño de los del fondo, las copas en cuatro capas con hojas dibujadas
 * (lejanas y comidas por la niebla sobre el claro, del medio, de adelante a los costados y el dosel que cuelga de arriba),
 * una banda de niebla quieta y tramada, rayos de luz tramados entre las hojas, ramas con musgo, bromelias y orquídeas, y
 * lianas que cuelgan. La franja de abajo es el borde de la imagen (`seam`: sus primeras filas, sin la lluvia), espejado
 * hacia arriba y deshecho en tramado: no hay costura. Escribe RGBA en `out` (una sola vez por partida).
 */
export function canopyFill(
  edge: readonly number[],
  top: number,
  width: number,
  height: number,
  look: CanopyLook,
  out: Uint8ClampedArray,
  seam?: { data: ArrayLike<number>; rows: number },
): void {
  const P = Math.max(1, Math.round(look.pixel));
  const w = Math.ceil(width / P);
  const h = Math.ceil(height / P);
  const rand = seeded(look.seed);
  const pal = CANOPY_PALETTE;
  const lr = new Int32Array(w * h);
  // El peso de cada columna, suavizado a lo ancho (±7 % del ancho): las copas no se cortan en vertical donde cambia el borde.
  const raw = Array.from({ length: w }, (_, x) => weightAt(look.weights, (x + 0.5) * P, width));
  const R = Math.max(1, Math.round(w * 0.07));
  const soft = raw.map((_, x) => {
    let sum = 0;
    let n = 0;
    for (let k = -R; k <= R; k++) {
      const v = raw[Math.min(w - 1, Math.max(0, x + k))]!;
      const g = 1 - Math.abs(k) / (R + 1);
      sum += v * g;
      n += g;
    }
    return sum / n;
  });
  const wAt = (x: number) => soft[Math.min(w - 1, Math.max(0, x))]!;
  // 0. El cielo de la lluvia: el degradado de S59.
  for (let y = 0; y < h; y++) {
    const t = h > 1 ? y / (h - 1) : 1;
    for (let x = 0; x < w; x++) lr[y * w + x] = mixColor(top, colorAt(edge, (x + 0.5) * P, width), t);
  }
  const vary = waves(w, rand);
  const vary2 = waves(w, rand);
  const vary3 = waves(w, rand);
  const smooth = (v: number) => smoothstep(0, 1, v);
  // Lo que sube desde abajo (alto sobre el borde de la imagen) y lo que cuelga de arriba, por columna. Copas redondas
  // (envolventes de círculos) de alturas distintas: entre una y otra se ve la capa de atrás.
  const far = scallop(w, (x) => look.farHeight * h * (0.3 + 0.7 * (1 - wAt(Math.round(x)))) * (0.5 + 0.5 * vary(x)), 6, 13, rand);
  const mid = scallop(w, (x) => look.midHeight * h * (0.15 + 0.85 * smooth(wAt(Math.round(x)))) * (0.4 + 0.6 * vary2(x)), 6, 14, rand);
  const near = scallop(w, (x) => look.nearHeight * h * smooth(Math.max(0, wAt(Math.round(x)) * 1.6 - 0.6)) * (0.3 + 0.7 * vary3(x)), 5, 12, rand);
  const fringeBase = (x: number) => (look.fringeMin + (look.fringeMax - look.fringeMin) * smooth(wAt(Math.round(x)))) * h * (0.35 + 0.65 * vary(x + w / 3));
  const fringe = leafyEdge(scallop(w, fringeBase, 4, 10, rand).map((v) => v - 4), rand);
  // Cada fila se corre un poco a lo ancho (ruido suave): los bordes de las masas no quedan en vertical.
  const jit = Array.from({ length: h }, (_, y) => Math.round((lumpNoise(0, y, look.seed + 11, 5) - 0.5) * 16));
  const col = (x: number, y: number) => Math.min(w - 1, Math.max(0, x + jit[y]!));
  const up = (row: Float32Array) => (x: number, y: number) => h - 1 - y < row[col(x, y)]!;
  const down = (row: Float32Array) => (x: number, y: number) => y < row[col(x, y)]!;
  // Copas redondas a los costados (círculos grandes): el claro no queda con paredes rectas sino con copas que asoman.
  const crowns = new Uint8Array(w * h);
  const crownCount = Math.round(w / 9);
  for (let k = 0; k < crownCount; k++) {
    const x = Math.floor(rand() * w);
    if (wAt(x) < 0.45 + 0.3 * rand()) continue;
    const r = h * (0.1 + 0.14 * rand());
    const cy = h * (0.12 + 0.62 * rand());
    for (let y = Math.max(0, Math.floor(cy - r)); y < Math.min(h, Math.ceil(cy + r)); y++) {
      for (let xx = Math.max(0, Math.floor(x - r)); xx < Math.min(w, Math.ceil(x + r)); xx++) {
        if ((xx - x) ** 2 + (y - cy) ** 2 <= r * r) crowns[y * w + xx] = 1;
      }
    }
  }

  // 1. Copas lejanas, comidas por la niebla. 2. La niebla quieta. 3. Copas del medio, más claras que las de adelante.
  foliage(lr, w, h, up(far), pal.haze, 0, 7, { density: 1.1, rMin: 1.4, rMax: 2.8, fog: top, fogMix: 0.42 }, rand);
  hazeBand(lr, w, h, look.haze, rand, look.seed);
  const midUp = up(mid);
  foliage(lr, w, h, (x, y) => midUp(x, y) || crowns[y * w + x] === 1, pal.leaf, 3, 8, { density: 1.2, rMin: 1.3, rMax: 2.6, fog: top, fogMix: 0.22 }, rand);
  // 4. Rayos de luz que bajan por lo claro (detrás de las hojas de adelante): parejos por dentro, tramados en el borde.
  const anchors = rayAnchors(look.weights, look.rays.count, rand);
  const tilt = Math.tan((look.rays.tiltDeg * Math.PI) / 180);
  const half = look.rays.width / P / 2;
  anchors.forEach((at, n) => {
    const cx = at * w;
    const strength = look.rays.strength * (0.7 + 0.6 * rand());
    const reach = 0.55 + 0.4 * rand();
    for (let y = 0; y < h; y++) {
      const t = y / (h - 1);
      if (t > reach) break;
      const fade = smoothstep(0, 0.12, t) * (1 - smoothstep(reach * 0.45, reach, t));
      const c = cx - tilt * y;
      for (let x = Math.max(0, Math.floor(c - half)); x <= Math.min(w - 1, Math.ceil(c + half)); x++) {
        const across = 1 - Math.abs(x + 0.5 - c) / half;
        if (across <= 0) continue;
        const v = Math.min(1, across * 2) * fade;
        if (edgeMix(v, 0.75, x, y, look.seed + 31 * n)) lr[y * w + x] = mixColor(lr[y * w + x]!, look.rays.color, strength * (v >= 0.75 ? 1 : 0.6));
      }
    }
  });
  // 5. Copas de adelante a los costados y el dosel que cuelga de arriba (casi negro, la luz arriba de cada mata).
  foliage(lr, w, h, up(near), pal.leaf, 0, 6, { density: 1.3, rMin: 1.1, rMax: 2.6 }, rand);
  foliage(lr, w, h, down(fringe), pal.leaf, 0, 7, { density: 1.4, rMin: 1, rMax: 2.3, lit: 0.6 }, rand);
  // 6. Ramas que salen de los costados con musgo, bromelias y orquídeas; 7. lianas que cuelgan del dosel y de las ramas.
  const hangFrom: [number, number][] = [];
  for (let side = 0; side < 2; side++) {
    for (let k = 0; k < look.branches; k++) {
      // Una rama grande y una más chica por lado: salen del follaje, suben y se arquean hacia el claro.
      const big = k === 0;
      const len = w * (big ? 0.34 + 0.1 * rand() : 0.2 + 0.08 * rand());
      const y0 = h * (big ? 0.45 + 0.15 * rand() : 0.2 + 0.15 * rand());
      const y1 = y0 - h * (0.1 + 0.12 * rand());
      const bow = h * (0.06 + 0.06 * rand());
      const pts: [number, number][] = [];
      for (let i = 0; i <= len; i++) {
        const t = i / len;
        const x = side === 0 ? i : w - 1 - i;
        pts.push([x, y0 + (y1 - y0) * t - bow * Math.sin(t * Math.PI) + 0.8 * Math.sin(i * 0.4)]);
      }
      branch(lr, w, h, pts, big ? 8 : 5, rand);
      // Matas de adelante que tapan la rama en partes (no queda pegada encima de todo).
      for (let c = 0; c < 4; c++) {
        const [cx, cy] = pts[Math.floor(len * rand() * 0.8)]!;
        const r = 2 + rand() * 3;
        foliage(lr, w, h, (x, y) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r, pal.leaf, 1, 6, { density: 1.5, rMin: 1, rMax: 2 }, rand);
      }
      for (let e = 0; e < look.epiphytes; e++) {
        const [ex, ey] = pts[Math.floor(len * (0.35 + 0.6 * rand()))]!;
        epiphyte(lr, w, h, Math.round(ex), Math.round(ey) - 2, rand);
      }
      for (let l = 0; l < 3; l++) {
        const [lx, ly] = pts[Math.floor(len * (0.2 + 0.75 * rand()))]!;
        hangFrom.push([Math.round(lx), Math.round(ly) + 1]);
      }
    }
  }
  // Las lianas cuelgan del dosel de arriba, más en el borde del claro (donde se ven contra la luz).
  const lianaCount = Math.round((look.lianas * width) / 100);
  for (let i = 0; i < lianaCount; i++) {
    let x = Math.floor(rand() * w);
    if (rand() < 0.5) for (let t = 0; t < 8 && Math.abs(wAt(x) - 0.5) > 0.3; t++) x = Math.floor(rand() * w);
    hangFrom.push([x, Math.max(0, Math.round(fringe[x]!) - 1)]);
  }
  for (const [x, y] of hangFrom) liana(lr, w, h, x, y, Math.round(h * (0.12 + 0.4 * rand())), rand);
  // A píxeles de arte, y abajo el borde de la imagen espejado que se deshace tramado.
  for (let y = 0; y < height; y++) {
    const ly = Math.min(h - 1, Math.floor(y / P));
    const d = height - 1 - y;
    for (let x = 0; x < width; x++) {
      const lx = Math.min(w - 1, Math.floor(x / P));
      const i = (y * width + x) * 4;
      if (seam && d < look.blend && d < seam.rows && 0.15 + 0.85 * lumpNoise(lx, ly, look.seed + 3, 3) >= d / look.blend) {
        const j = (d * width + x) * 4;
        out[i] = seam.data[j]!;
        out[i + 1] = seam.data[j + 1]!;
        out[i + 2] = seam.data[j + 2]!;
      } else {
        const c = lr[ly * w + lx]!;
        out[i] = (c >> 16) & 0xff;
        out[i + 1] = (c >> 8) & 0xff;
        out[i + 2] = c & 0xff;
      }
      out[i + 3] = 255;
    }
  }
}

/**
 * Follaje en píxeles gruesos (S113): primero el hueco oscuro de la mata y encima muchas matitas (círculos chicos) con la
 * luz arriba a la izquierda y la sombra abajo a la derecha, más claras cuanto más arriba (la luz llega de arriba). Así
 * se ve como las copas del fondo: hojas, no una mancha. `lo`..`hi`: tonos de `ramp`; `fog`, mezcla con la niebla.
 */
function foliage(
  lr: Int32Array,
  w: number,
  h: number,
  inside: (x: number, y: number) => boolean,
  ramp: readonly number[],
  lo: number,
  hi: number,
  opt: { density: number; rMin: number; rMax: number; fog?: number; fogMix?: number; lit?: number },
  rand: () => number,
): void {
  const cells: number[] = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (inside(x, y)) cells.push(y * w + x);
  if (cells.length === 0) return;
  const paint = (x: number, y: number, tone: number) => {
    let c = ramp[Math.max(lo, Math.min(hi, tone))]!;
    if (opt.fog !== undefined && opt.fogMix) c = mixColor(c, opt.fog, opt.fogMix);
    lr[y * w + x] = c;
  };
  for (const i of cells) paint(i % w, Math.floor(i / w), lo);
  const r2 = (opt.rMin + opt.rMax) / 2;
  const count = Math.round((cells.length * opt.density) / (Math.PI * r2 * r2 * 0.8));
  const blobs: [number, number, number][] = [];
  for (let k = 0; k < count; k++) {
    const i = cells[Math.floor(rand() * cells.length)]!;
    blobs.push([i % w, Math.floor(i / w), opt.rMin + (opt.rMax - opt.rMin) * rand()]);
  }
  blobs.sort((a, b) => a[1] - b[1]);
  // La luz: arriba de cada mata (y de toda la masa, si `lit`), con un poco de azar.
  let minY = h;
  let maxY = 0;
  for (const i of cells) {
    const y = Math.floor(i / w);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  const span = Math.max(1, maxY - minY);
  for (const [bx, by, r] of blobs) {
    const height01 = 1 - (by - minY) / span;
    const base = lo + 1 + Math.round((hi - lo - 2) * (opt.lit !== undefined ? opt.lit * (1 - height01) + (1 - opt.lit) * rand() : 0.25 + 0.55 * height01 * rand() + 0.2 * rand()));
    const R = Math.ceil(r);
    for (let dy = -R; dy <= R; dy++) {
      for (let dx = -R; dx <= R; dx++) {
        const x = bx + dx;
        const y = by + dy;
        if (x < 0 || y < 0 || x >= w || y >= h || dx * dx + dy * dy > r * r || !inside(x, y)) continue;
        const side = (dx + dy) / r;
        paint(x, y, base + (side < -0.55 ? 1 : side > 0.6 ? -1 : 0));
      }
    }
    // Un brillo de luz filtrada en las matas de más arriba.
    if (height01 > 0.6 && rand() < 0.25 && inside(bx - 1, by - 1)) paint(bx - 1, by - 1, hi + 1);
  }
}

/** Banda de niebla quieta (S113): jirones a lo ancho de una campana a lo alto, parejos por dentro y tramados en el borde. */
function hazeBand(lr: Int32Array, w: number, h: number, haze: CanopyLook['haze'], rand: () => number, seed: number): void {
  const cy = haze.at * h;
  const hh = Math.max(1, haze.height * h);
  const ph = [rand(), rand(), rand()].map((v) => v * Math.PI * 2);
  for (let y = Math.max(0, Math.floor(cy - hh)); y < Math.min(h, Math.ceil(cy + hh)); y++) {
    const v = (y - cy) / hh;
    const bell = Math.max(0, 1 - v * v);
    for (let x = 0; x < w; x++) {
      const cloud = 0.55 + 0.45 * Math.sin((x / w) * Math.PI * 6 + ph[0]! + v * 1.5) * Math.sin((x / w) * Math.PI * 2.3 + ph[1]!) + 0.12 * Math.sin((x / w) * Math.PI * 17 + ph[2]!);
      const t = bell * Math.max(0, Math.min(1, cloud));
      if (edgeMix(t, 0.5, x, y, seed + 7)) lr[y * w + x] = mixColor(lr[y * w + x]!, haze.color, haze.alpha * (t >= 0.5 ? 1 : 0.55));
    }
  }
}

/** Rama gruesa por `pts` (de afuera hacia adentro, se afina): corteza con la luz arriba y la sombra abajo, musgo encima. */
function branch(lr: Int32Array, w: number, h: number, pts: [number, number][], thick: number, rand: () => number): void {
  const pal = CANOPY_PALETTE;
  const set = (x: number, y: number, c: number) => {
    if (x >= 0 && y >= 0 && x < w && y < h) lr[y * w + x] = c;
  };
  pts.forEach(([px, py], i) => {
    const t = i / Math.max(1, pts.length - 1);
    const th = Math.max(1, Math.round(thick * (1 - 0.7 * t)));
    const x = Math.round(px);
    const y0 = Math.round(py - th / 2);
    for (let d = 0; d < th; d++) {
      const tone = th === 1 ? 2 : d === 0 ? 4 : d === 1 ? 3 : d === th - 1 ? 0 : (x + d) % 4 === 0 ? 1 : 2;
      set(x, y0 + d, pal.bark[tone]!);
    }
    // Musgo sobre la rama, en matas.
    if (lumpNoise(x, 0, 17, 3) > 0.45) set(x, y0 - 1, pal.moss[lumpNoise(x, 1, 19, 2) > 0.6 ? 3 : 1 + Math.floor(rand() * 2)]!);
  });
}

/** Borde de abajo del dosel que cuelga: matitas de hojas que bajan de a una o dos celdas (no una línea pareja). */
function leafyEdge(edge: Float32Array, rand: () => number): Float32Array {
  return edge.map((v) => (v > 0 && rand() < 0.35 ? v + 1 + Math.floor(rand() * 2) : v));
}

/** Una epífita sobre una rama: una bromelia (roseta con el corazón rojo), un helechito o una orquídea. */
function epiphyte(lr: Int32Array, w: number, h: number, x: number, y: number, rand: () => number): void {
  const pal = CANOPY_PALETTE;
  const set = (dx: number, dy: number, c: number) => {
    if (x + dx >= 0 && y + dy >= 0 && x + dx < w && y + dy < h) lr[(y + dy) * w + x + dx] = c;
  };
  const r = rand();
  if (r < 0.5) {
    // Bromelia: hojas duras que se abren y el corazón rojo.
    for (const [dx, dy, s] of [[-2, 0, 2], [2, 0, 2], [-1, -1, 3], [1, -1, 3], [-2, -1, 1], [2, -1, 1], [0, -2, 3], [-1, 0, 2], [1, 0, 2]] as const) set(dx, dy, pal.moss[s]!);
    set(0, 0, pal.bromel[2]!);
    set(0, -1, pal.bromel[3]!);
  } else if (r < 0.8) {
    // Helechito: frondas que cuelgan a los dos lados.
    for (const [dx, dy, s] of [[0, 0, 2], [-1, 0, 3], [1, 0, 3], [-2, 1, 2], [2, 1, 2], [-3, 2, 1], [3, 2, 1], [0, -1, 4]] as const) set(dx, dy, pal.moss[s]!);
  } else {
    // Orquídea: hojas chicas y dos flores claras.
    for (const [dx, dy, s] of [[0, 0, 1], [-1, 0, 2], [1, 0, 2]] as const) set(dx, dy, pal.moss[s]!);
    set(-1, -1, pal.orchid[2]!);
    set(1, -2, pal.orchid[1]!);
    set(0, -1, pal.orchid[0]!);
  }
}

/** Liana que cuelga desde (x, y): un hilo oscuro que se mece apenas, con la luz de un lado y alguna hoja. */
function liana(lr: Int32Array, w: number, h: number, x0: number, y0: number, len: number, rand: () => number): void {
  const pal = CANOPY_PALETTE;
  const sway = (rand() - 0.5) * 3;
  const phase = rand() * Math.PI * 2;
  for (let k = 0; k < len; k++) {
    const y = y0 + k;
    if (y < 0 || y >= h) break;
    const x = Math.round(x0 + sway * Math.sin((k / Math.max(1, len)) * Math.PI) + 0.6 * Math.sin(k * 0.35 + phase));
    if (x < 0 || x >= w) continue;
    lr[y * w + x] = k % 7 === 3 ? pal.bark[3]! : pal.leaf[k % 3 === 0 ? 4 : 3]!;
    if (k % 9 === 5 && x + 1 < w) lr[y * w + x + 1] = pal.leaf[5]!;
    if (k === len - 1 && rand() < 0.6 && x - 1 >= 0) lr[y * w + x - 1] = pal.leaf[4]!;
  }
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

/** S113: un jirón de niebla tramado (alfa 0-255 en tres escalones): el de S60 sin el borde borroso. */
export function mistPuffDither(width: number, height: number, rand: () => number, alpha = 255): Uint8ClampedArray {
  const soft = mistPuffAlpha(width, height, rand);
  const out = new Uint8ClampedArray(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const v = soft[y * width + x]! / 255;
      out[y * width + x] = Math.round(alpha * Math.min(3, Math.floor(v * 3 + bayer4(x, y) * 0.999)) / 3);
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
