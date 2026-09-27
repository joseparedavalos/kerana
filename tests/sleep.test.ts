import { describe, expect, it } from 'vitest';
import { StatusEffects, type SleepConfig } from '../src/systems/StatusEffects';

const CFG: SleepConfig = { stillToSleepMs: 2000, yawnAtMs: 1200, sleepMs: 1500, pressCutMs: 250 };

describe('Sueño de siesta (StatusEffects)', () => {
  it('quieta 2 s dentro de la niebla: bosteza y después se duerme', () => {
    const s = new StatusEffects(CFG);
    expect(s.stepSleep(1199, true, true, false)).toBe(null);
    expect(s.stepSleep(1, true, true, false)).toBe('yawn');
    expect(s.drowsy).toBe(true);
    expect(s.stepSleep(799, true, true, false)).toBe(null);
    expect(s.stepSleep(1, true, true, false)).toBe('asleep');
    expect(s.asleep).toBe(true);
  });

  it('moverse o salir de la niebla reinicia la cuenta', () => {
    const s = new StatusEffects(CFG);
    s.stepSleep(1900, true, true, false);
    s.stepSleep(16, true, false, false);
    expect(s.stepSleep(1900, true, true, false)).not.toBe('asleep');
    s.stepSleep(16, false, true, false);
    expect(s.drowsy).toBe(false);
    expect(s.stepSleep(1999, true, true, false)).toBe('yawn');
    expect(s.asleep).toBe(false);
  });

  it('dormida no responde a los controles y se despierta a los 1,5 s', () => {
    const s = new StatusEffects(CFG);
    s.stepSleep(2000, true, true, false);
    const input = { left: true, right: false, jumpPressed: true, jumpHeld: true, attackPressed: true, dashPressed: true };
    s.applyTo(input);
    expect(input).toEqual({ left: false, right: false, jumpPressed: false, jumpHeld: false, attackPressed: false, attackHeld: false, dashPressed: false });
    expect(s.stepSleep(1499, true, true, false)).toBe(null);
    expect(s.stepSleep(1, true, true, false)).toBe('awake');
    expect(s.asleep).toBe(false);
  });

  it('pulsar botones acorta el sueño', () => {
    const s = new StatusEffects(CFG);
    s.stepSleep(2000, true, true, false);
    for (let i = 0; i < 4; i++) s.stepSleep(16, true, false, true);
    // 4 pulsaciones: 4 × (16 + 250) ms ≈ 1064 ms de los 1500.
    expect(s.asleep).toBe(true);
    for (let i = 0; i < 2; i++) s.stepSleep(16, true, false, true);
    expect(s.asleep).toBe(false);
  });

  it('wake y clear la despiertan (daño o reaparición)', () => {
    const s = new StatusEffects(CFG);
    s.stepSleep(2000, true, true, false);
    s.wake();
    expect(s.asleep).toBe(false);
    s.stepSleep(2000, true, true, false);
    s.clear();
    expect(s.asleep).toBe(false);
  });
});
