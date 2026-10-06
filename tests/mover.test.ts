import { describe, expect, it } from 'vitest';
import { isRiding, MoverMotor, type MoverSpec } from '../src/entities/MoverMotor';

const FRAME = 1000 / 60;
const GRAVITY = 1200;

describe('MoverMotor', () => {
  it('va hasta el otro extremo, espera y vuelve (horizontal)', () => {
    const m = new MoverMotor({ dx: 64, dy: 0, speed: 64, waitMs: 500 });
    m.step(1000);
    expect(m.offsetX).toBeCloseTo(64);
    expect(m.dir).toBe(-1);
    // Espera en el extremo.
    m.step(400);
    expect(m.offsetX).toBeCloseTo(64);
    m.step(100 + 500);
    expect(m.offsetX).toBeCloseTo(32);
    m.step(500);
    expect(m.offsetX).toBeCloseTo(0);
  });

  it('espera en los dos extremos antes de salir', () => {
    const m = new MoverMotor({ dx: 0, dy: -32, speed: 32, waitMs: 300 });
    m.step(1000);
    expect(m.offsetY).toBeCloseTo(-32);
    expect(m.moving).toBe(false);
    m.step(299);
    expect(m.offsetY).toBeCloseTo(-32);
    m.step(1 + 1000);
    expect(m.offsetY).toBeCloseTo(0);
    m.step(299);
    expect(m.offsetY).toBeCloseTo(0);
    m.step(101);
    expect(m.offsetY).toBeCloseTo(-3.2);
  });

  it('sin espera sigue con el tiempo que sobra al llegar a un extremo', () => {
    const m = new MoverMotor({ dx: 10, dy: 0, speed: 100, waitMs: 0 });
    const d = m.step(150);
    expect(m.offsetX).toBeCloseTo(5);
    expect(d.dx).toBeCloseTo(5);
  });

  it('mode=run: quieta hasta tener energía; sin energía vuelve al origen', () => {
    const m = new MoverMotor({ dx: 32, dy: 0, speed: 32, waitMs: 0, mode: 'run' });
    m.step(1000);
    expect(m.offsetX).toBe(0);
    m.setPowered(true);
    m.step(500);
    expect(m.offsetX).toBeCloseTo(16);
    m.setPowered(false);
    m.step(1000);
    expect(m.offsetX).toBe(0);
    m.step(1000);
    expect(m.offsetX).toBe(0);
  });

  it('mode=toggle: con energía va al otro extremo y se queda; sin energía vuelve', () => {
    const m = new MoverMotor({ dx: 0, dy: 48, speed: 48, waitMs: 200, mode: 'toggle' });
    m.setPowered(true);
    m.step(3000);
    expect(m.offsetY).toBeCloseTo(48);
    m.setPowered(false);
    m.step(3000);
    expect(m.offsetY).toBe(0);
  });

  it('reinicia en su origen (al reentrar al nivel)', () => {
    const m = new MoverMotor({ dx: 80, dy: 0, speed: 40, waitMs: 0, mode: 'run' });
    m.setPowered(true);
    m.step(1500);
    expect(m.offsetX).toBeGreaterThan(0);
    m.reset();
    expect([m.offsetX, m.offsetY, m.dir, m.powered]).toEqual([0, 0, 1, false]);
    // Recién creada, otra igual arranca en el mismo lugar.
    expect(new MoverMotor({ dx: 80, dy: 0, speed: 40, waitMs: 0 }).offsetX).toBe(0);
  });

  it('la vaca: empieza en el medio y en el sentido en que mira', () => {
    const m = new MoverMotor({ dx: 112, dy: 0, speed: 14, waitMs: 1200, startPos: 56, startDir: -1 });
    expect(m.offsetX).toBe(56);
    m.step(1000);
    expect(m.offsetX).toBeCloseTo(42);
  });
});

/**
 * Simula a Kerana parada sobre una plataforma de un solo sentido, como lo hace LevelScene:
 * 1) ¿viaja encima? (antes de mover), 2) la plataforma avanza, 3) la lleva el mismo desplazamiento,
 * 4) física: gravedad y choque con la cara de arriba. Devuelve la mayor separación pies–plataforma
 * y cuánto se corrió respecto de la plataforma.
 */
function ride(spec: MoverSpec, ms: number, carry = true): { maxGap: number; drift: number; airborneFrames: number } {
  const m = new MoverMotor(spec);
  const platX = 0;
  const platY = 200;
  const rider = { x: 24, bottom: platY, vy: 0, grounded: true };
  let maxGap = 0;
  let airborneFrames = 0;
  for (let t = 0; t < ms; t += FRAME) {
    const top = platY + m.offsetY;
    const left = platX + m.offsetX;
    const riding = isRiding({ left: rider.x - 6, right: rider.x + 6, bottom: rider.bottom, vy: rider.vy, grounded: rider.grounded }, top, left, left + 48, 3);
    const d = m.step(FRAME);
    if (carry && riding) {
      rider.x += d.dx;
      rider.bottom += d.dy;
    }
    rider.vy += (GRAVITY * FRAME) / 1000;
    rider.bottom += (rider.vy * FRAME) / 1000;
    const newTop = platY + m.offsetY;
    // Un solo sentido: solo frena si llega desde arriba (con el margen de solapamiento de Arcade).
    if (rider.vy >= 0 && rider.bottom >= newTop && rider.bottom - newTop <= 4) {
      rider.bottom = newTop;
      rider.vy = 0;
      rider.grounded = true;
    } else {
      rider.grounded = false;
      airborneFrames++;
    }
    maxGap = Math.max(maxGap, Math.abs(rider.bottom - newTop));
  }
  return { maxGap, drift: rider.x - (platX + m.offsetX) - 24, airborneFrames };
}

describe('acarreo', () => {
  it('horizontal: Kerana se mueve con la plataforma', () => {
    const r = ride({ dx: 96, dy: 0, speed: 60, waitMs: 300 }, 5000);
    expect(r.drift).toBeCloseTo(0);
    expect(r.maxGap).toBe(0);
    expect(r.airborneFrames).toBe(0);
  });

  it('vertical hacia arriba: no la atraviesa ni se hunde', () => {
    // Subida completa (96 px a 60 px/s = 1,6 s) y la espera arriba.
    const up = ride({ dx: 0, dy: -96, speed: 60, waitMs: 400 }, 2000);
    expect(up.maxGap).toBe(0);
    expect(up.airborneFrames).toBe(0);
  });

  it('vertical hacia abajo: se queda pegada (sin acarreo se despegaría)', () => {
    const down = ride({ dx: 0, dy: 96, speed: 60, waitMs: 400 }, 1600);
    expect(down.maxGap).toBe(0);
    expect(down.airborneFrames).toBe(0);
    const loose = ride({ dx: 0, dy: 96, speed: 60, waitMs: 400 }, 1600, false);
    expect(loose.airborneFrames).toBeGreaterThan(0);
  });

  it('ida y vuelta vertical completa, varias veces', () => {
    const r = ride({ dx: 0, dy: -80, speed: 50, waitMs: 250 }, 10000);
    expect(r.maxGap).toBe(0);
    expect(r.airborneFrames).toBe(0);
  });

  it('isRiding: no cuenta si salta, si no está apoyada o si está al costado', () => {
    const base = { left: 10, right: 22, bottom: 100, vy: 0, grounded: true };
    expect(isRiding(base, 100, 0, 48, 3)).toBe(true);
    expect(isRiding({ ...base, vy: -200 }, 100, 0, 48, 3)).toBe(false);
    expect(isRiding({ ...base, grounded: false }, 100, 0, 48, 3)).toBe(false);
    expect(isRiding({ ...base, left: 50, right: 62 }, 100, 0, 48, 3)).toBe(false);
    expect(isRiding({ ...base, bottom: 90 }, 100, 0, 48, 3)).toBe(false);
  });
});
