import { describe, expect, it } from 'vitest';
import { GAMEPLAY } from '../src/config/gameplay';
import { ChargeFxMotor, findBlade, isBladePixel, pointOnLine, strandEveryMs, strandShape, type StrandShape } from '../src/entities/chargeFxLogic';

// S80: cómo se ve la carga del tajo cargado (solo dibujo; la jugabilidad está en playerMotor.test.ts).
const CFG = GAMEPLAY.chargeFx.strands;
const RULE = GAMEPLAY.chargeFx.bladeMask;
const STEP = 1000 / 60;

/** Cuántas hebras nacen en `ms` con la carga fija en `fraction`. */
function spawnsDuring(motor: ChargeFxMotor, fraction: number, ms: number): number {
  let born = 0;
  for (let t = 0; t < ms; t += STEP) {
    const before = motor.strands.map((s) => s.active && s.ageMs);
    motor.step(STEP, fraction);
    motor.strands.forEach((s, i) => {
      if (s.active && s.ageMs === 0 && before[i] !== 0) born++;
    });
  }
  return born;
}

describe('hebras de la carga', () => {
  it('nacen cada vez más seguido a medida que carga', () => {
    expect(strandEveryMs(0, CFG)).toBe(CFG.everyStartMs);
    expect(strandEveryMs(1, CFG)).toBe(CFG.everyEndMs);
    expect(strandEveryMs(0.5, CFG)).toBeLessThan(CFG.everyStartMs);
    const early = spawnsDuring(new ChargeFxMotor(CFG, () => 0.5), 0.1, 500);
    const late = spawnsDuring(new ChargeFxMotor(CFG, () => 0.5), 0.9, 500);
    expect(late).toBeGreaterThan(early);
  });

  it('son pocas: nunca más que el pool', () => {
    const motor = new ChargeFxMotor(CFG, () => 0.5);
    for (let t = 0; t < 2000; t += STEP) {
      motor.step(STEP, 0.95);
      expect(motor.activeCount).toBeLessThanOrEqual(CFG.max);
    }
  });

  it('entran hacia el filo y se acortan al acercarse, hasta 0', () => {
    const out: StrandShape = { head: 0, length: 0, progress: 0 };
    let prevHead = Infinity;
    let prevLen = Infinity;
    for (let ms = 0; ms <= CFG.travelMs; ms += 10) {
      const { head, length } = strandShape(ms, CFG, out);
      expect(head).toBeLessThanOrEqual(prevHead);
      expect(length).toBeLessThanOrEqual(prevLen);
      prevHead = head;
      prevLen = length;
    }
    expect(strandShape(0, CFG, out).head).toBe(CFG.fromDistance);
    expect(strandShape(0, CFG, out).length).toBe(CFG.length);
    expect(strandShape(CFG.travelMs, CFG, out).head).toBe(0);
    expect(strandShape(CFG.travelMs, CFG, out).length).toBe(0);
  });

  it('no entran desde atrás, a través del cuerpo', () => {
    expect(CFG.arcFromDeg).toBeGreaterThan(-180);
    expect(CFG.arcToDeg).toBeLessThan(180);
    for (const r of [0, 0.5, 0.999]) {
      const motor = new ChargeFxMotor(CFG, () => r);
      motor.step(STEP, 0.5);
      const s = motor.strands.find((st) => st.active)!;
      expect(Math.cos(s.angle)).toBeGreaterThan(Math.cos(Math.PI * 0.9));
      expect(s.along).toBeGreaterThanOrEqual(CFG.bladeFrom);
    }
  });
});

describe('el momento de «listo»', () => {
  it('se marca una sola vez y las hebras paran de golpe', () => {
    const motor = new ChargeFxMotor(CFG, () => 0.5);
    for (let t = 0; t < 400; t += STEP) motor.step(STEP, 0.8);
    expect(motor.activeCount).toBeGreaterThan(0);
    motor.step(STEP, 1);
    expect(motor.justReady).toBe(true);
    expect(motor.phase).toBe('ready');
    expect(motor.activeCount).toBe(0);
    for (let t = 0; t < 500; t += STEP) {
      motor.step(STEP, 1);
      expect(motor.justReady).toBe(false);
      expect(motor.activeCount).toBe(0);
    }
  });

  it('al soltar (o recibir un golpe) se apaga todo', () => {
    const motor = new ChargeFxMotor(CFG, () => 0.5);
    for (let t = 0; t < 300; t += STEP) motor.step(STEP, 0.6);
    motor.step(STEP, 0);
    expect(motor.phase).toBe('off');
    expect(motor.activeCount).toBe(0);
    // Otra carga vuelve a destellar al completarse.
    motor.step(STEP, 0.5);
    motor.step(STEP, 1);
    expect(motor.justReady).toBe(true);
  });
});

describe('el sable en el dibujo', () => {
  type Rgba = [number, number, number, number];
  const GOLD: Rgba = [250, 180, 20, 255];
  const SHINE: Rgba = [250, 240, 150, 255];
  const SKIN: Rgba = [220, 140, 80, 255];
  const DRESS: Rgba = [250, 235, 200, 255];

  it('el dorado y su brillo son sable; la piel y el vestido, no', () => {
    expect(isBladePixel(...GOLD, RULE)).toBe(true);
    expect(isBladePixel(...SHINE, RULE)).toBe(true);
    expect(isBladePixel(...SKIN, RULE)).toBe(false);
    expect(isBladePixel(...DRESS, RULE)).toBe(false);
    expect(isBladePixel(250, 180, 20, 40, RULE)).toBe(false);
  });

  /** Cuadro de 32 × 32 dentro de una imagen de 64 de ancho (el segundo cuadro de la fila). */
  function frame(): { data: Uint8Array; stride: number } {
    const stride = 64;
    const data = new Uint8Array(stride * 32 * 4);
    const put = (x: number, y: number, c: Rgba): void => data.set(c, (y * stride + 32 + x) * 4);
    // Sable en diagonal del mango (8, 26) a la punta (26, 4), con brillo en el medio.
    for (let i = 0; i <= 18; i++) {
      const x = 8 + i;
      const y = Math.round(26 - (i * 22) / 18);
      put(x, y, i % 4 === 2 ? SHINE : GOLD);
      put(x, y + 1, GOLD);
    }
    // Una pulsera dorada suelta y la piel de un pie: no son el sable.
    for (let x = 2; x < 5; x++) for (let y = 14; y < 16; y++) put(x, y, GOLD);
    for (let x = 12; x < 20; x++) for (let y = 29; y < 32; y++) put(x, y, SKIN);
    return { data, stride };
  }

  it('se queda con la mancha más grande, encuentra la punta lejos del pecho y sigue la hoja', () => {
    const { data, stride } = frame();
    const blade = findBlade(data, stride, 32, 0, 32, 32, { ...RULE, minPixels: 10 }, 16, 20, 5)!;
    expect(blade).not.toBeNull();
    // Ni la pulsera ni el pie.
    expect(blade.mask[14 * 32 + 3]).toBe(0);
    expect(blade.mask[30 * 32 + 15]).toBe(0);
    const tip = pointOnLine(blade.line, 1, { x: 0, y: 0 });
    const base = pointOnLine(blade.line, 0, { x: 0, y: 0 });
    expect(tip.x).toBeGreaterThan(24);
    expect(tip.y).toBeLessThan(7);
    expect(base.x).toBeLessThan(10);
    expect(base.y).toBeGreaterThan(24);
    // El medio de la línea cae sobre la hoja.
    const mid = pointOnLine(blade.line, 0.5, { x: 0, y: 0 });
    const onBlade = blade.mask[Math.floor(mid.y) * 32 + Math.floor(mid.x)] || blade.mask[Math.floor(mid.y + 1) * 32 + Math.floor(mid.x)];
    expect(onBlade).toBe(1);
  });

  it('sin una mancha dorada suficiente, el cuadro no tiene sable', () => {
    const stride = 32;
    const data = new Uint8Array(stride * 32 * 4);
    data.set(GOLD, (10 * stride + 10) * 4);
    expect(findBlade(data, stride, 0, 0, 32, 32, RULE, 16, 20, 5)).toBeNull();
  });
});
