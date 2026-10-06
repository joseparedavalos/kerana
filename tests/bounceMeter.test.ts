import { describe, expect, it } from 'vitest';
import { BounceMeter } from '../src/entities/hazards/BounceMeter';

describe('BounceMeter', () => {
  it('mide la altura máxima del rebote paso a paso', () => {
    const meter = new BounceMeter();
    const dt = 1 / 60;
    let y = 600;
    let vy = 0;
    meter.start(y);
    // Primer paso: todavía sin la velocidad del rebote aplicada.
    meter.sample(y, vy);
    vy = -540;
    let top = y;
    for (let i = 0; i < 120 && meter.count === 0; i++) {
      y += vy * dt;
      vy += 1200 * dt;
      top = Math.min(top, y);
      meter.sample(y, vy);
    }
    expect(meter.count).toBe(1);
    expect(meter.lastHeight).toBeCloseTo(600 - top, 5);
    expect(meter.lastHeight).toBeGreaterThan(115);
  });
});
