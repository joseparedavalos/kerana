// Agua animada de los props (S47): lógica pura, sin Phaser (se prueba en tests/waterFlow.test.ts).

/** `flow` de un prop en su sprite.json: hacia dónde corre el agua y en qué parte del dibujo está (fracciones). */
export interface FlowSpec {
  dir: 'down' | 'side';
  region: readonly [number, number, number, number];
}

export interface WaterTest {
  /** Canal más claro mínimo (0 a 255): la roca es oscura, el agua y la espuma, claras. */
  minBright: number;
  /** El azul puede quedar hasta esto por debajo del rojo o del verde (el musgo es verde: no pasa). */
  blueSlack: number;
}

/** ¿El píxel (RGBA) es agua? Claro y azulado o blanco; la roca (oscura) y el musgo (verde) no. */
export function isWaterPixel(r: number, g: number, b: number, a: number, test: WaterTest): boolean {
  if (a === 0) return false;
  return Math.max(r, g, b) >= test.minBright && b + test.blueSlack >= r && b + test.blueSlack >= g;
}

/** Máscara de agua de una imagen RGBA: 1 donde hay agua dentro de la región, 0 en el resto. */
export function waterMask(data: ArrayLike<number>, width: number, height: number, region: FlowSpec['region'], test: WaterTest): Uint8Array {
  const mask = new Uint8Array(width * height);
  const x0 = Math.floor(region[0] * width);
  const x1 = Math.ceil(region[2] * width);
  const y0 = Math.floor(region[1] * height);
  const y1 = Math.ceil(region[3] * height);
  for (let y = Math.max(0, y0); y < Math.min(height, y1); y++) {
    for (let x = Math.max(0, x0); x < Math.min(width, x1); x++) {
      const i = (y * width + x) * 4;
      if (isWaterPixel(data[i]!, data[i + 1]!, data[i + 2]!, data[i + 3]!, test)) mask[y * width + x] = 1;
    }
  }
  return mask;
}

/**
 * Un fotograma del agua que corre (`phase` de 0 a 1). Cada píxel de agua toma el color del agua que está
 * `phase × period` px más arriba (o a la izquierda, si `dir` es side); como eso no se repite solo, se mezcla con
 * la misma imagen corrida un período entero hacia atrás, con peso `phase`: en 0 y en 1 el fotograma es el dibujo
 * original y el ciclo no salta. Lo que no es agua (roca, musgo) queda igual.
 */
export function flowFrame(
  data: ArrayLike<number>,
  width: number,
  height: number,
  mask: Uint8Array,
  dir: FlowSpec['dir'],
  period: number,
  phase: number,
  out: Uint8ClampedArray,
): Uint8ClampedArray {
  for (let i = 0; i < width * height * 4; i++) out[i] = data[i]!;
  const [dx, dy] = dir === 'down' ? [0, 1] : [1, 0];
  const near = Math.round(phase * period);
  const far = near - period;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = y * width + x;
      if (!mask[p]) continue;
      const a = sampleWater(mask, width, height, x - dx * near, y - dy * near, p);
      const b = sampleWater(mask, width, height, x - dx * far, y - dy * far, p);
      for (let c = 0; c < 3; c++) out[p * 4 + c] = data[a * 4 + c]! * (1 - phase) + data[b * 4 + c]! * phase;
    }
  }
  return out;
}

/** Índice del píxel de agua en (x, y); si cae afuera o en roca, el propio píxel (`self`). */
function sampleWater(mask: Uint8Array, width: number, height: number, x: number, y: number, self: number): number {
  if (x < 0 || y < 0 || x >= width || y >= height) return self;
  const p = y * width + x;
  return mask[p] ? p : self;
}
