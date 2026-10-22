import { describe, expect, it } from 'vitest';
import { GAMEPLAY } from '../src/config/gameplay';
import { flowFrame, isWaterPixel, waterMask } from '../src/assets/waterFlow';

const TEST = GAMEPLAY.props.water;
const ROCK = [60, 66, 78, 255];
const MOSS = [120, 170, 40, 255];

/** Columna de 1 × n: roca arriba, agua de tonos distintos abajo (el valor del rojo marca la fila). */
function column(n: number): Uint8ClampedArray {
  const data = new Uint8ClampedArray(n * 4);
  for (let y = 0; y < n; y++) data.set(y < 2 ? ROCK : [150 + y, 200, 240, 255], y * 4);
  return data;
}

describe('agua animada de los props (S47)', () => {
  it('el agua y la espuma son agua; la roca, el musgo y lo transparente no', () => {
    expect(isWaterPixel(252, 252, 252, 255, TEST)).toBe(true);
    expect(isWaterPixel(124, 146, 171, 255, TEST)).toBe(true);
    expect(isWaterPixel(ROCK[0]!, ROCK[1]!, ROCK[2]!, 255, TEST)).toBe(false);
    expect(isWaterPixel(MOSS[0]!, MOSS[1]!, MOSS[2]!, 255, TEST)).toBe(false);
    expect(isWaterPixel(255, 255, 255, 0, TEST)).toBe(false);
  });

  it('la máscara solo toma agua dentro de la región', () => {
    const data = column(10);
    const mask = waterMask(data, 1, 10, [0, 0.5, 1, 1], TEST);
    expect(Array.from(mask)).toEqual([0, 0, 0, 0, 0, 1, 1, 1, 1, 1]);
  });

  it('el agua baja, la roca no se mueve y el ciclo empieza y termina en el dibujo original', () => {
    const n = 20;
    const data = column(n);
    const mask = waterMask(data, 1, n, [0, 0, 1, 1], TEST);
    const out = new Uint8ClampedArray(n * 4);
    expect(Array.from(flowFrame(data, 1, n, mask, 'down', 8, 0, out))).toEqual(Array.from(data));
    flowFrame(data, 1, n, mask, 'down', 8, 0.25, out);
    // La roca de arriba queda igual.
    expect(Array.from(out.slice(0, 8))).toEqual(Array.from(data.slice(0, 8)));
    // En la fila 12, 3/4 del color viene de 2 filas más arriba y 1/4 de 6 filas más abajo.
    expect(out[12 * 4]).toBe(Math.round((150 + 10) * 0.75 + (150 + 18) * 0.25));
    // El canal alfa nunca cambia.
    for (let y = 0; y < n; y++) expect(out[y * 4 + 3]).toBe(255);
  });

  it('la velocidad y los fotogramas están en gameplay.ts y el paso es entero', () => {
    expect(TEST.fallSpeed).toBeGreaterThan(TEST.sheetSpeed);
    expect(TEST.period % TEST.frames).toBe(0);
  });
});
