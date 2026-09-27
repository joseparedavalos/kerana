import { describe, expect, it } from 'vitest';
import { WindCycle } from '../src/entities/hazards/WindCycle';

const CFG = { calmMs: 2000, warnMs: 1000, gustMs: 1500 };

describe('WindCycle (ráfagas)', () => {
  it('avisa 1 s antes de soplar y vuelve a la calma', () => {
    const w = new WindCycle(CFG);
    expect(w.step(1999)).toBeNull();
    expect(w.step(1)).toBe('warn');
    expect(w.blowing).toBe(false);
    expect(w.step(1000)).toBe('gust');
    expect(w.blowing).toBe(true);
    expect(w.step(1500)).toBe('calm');
  });

  it('el desfase retrasa el primer aviso', () => {
    const w = new WindCycle(CFG, 500);
    expect(w.step(2000)).toBeNull();
    expect(w.step(500)).toBe('warn');
  });
});
