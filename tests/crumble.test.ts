import { describe, expect, it } from 'vitest';
import { GAMEPLAY } from '../src/config/gameplay';
import { CrumbleMotor } from '../src/entities/hazards/CrumbleMotor';

const CFG = GAMEPLAY.jungle;

describe('CrumbleMotor (rama que se quiebra)', () => {
  it('sostiene mientras nadie la pisa', () => {
    const m = new CrumbleMotor(CFG);
    for (let i = 0; i < 100; i++) m.step(100, false);
    expect(m.state).toBe('solid');
    expect(m.solid).toBe(true);
  });

  it('cruje al pisarla y se quiebra 0,6 s después, aunque Kerana salte', () => {
    const m = new CrumbleMotor({ crumbleDelayMs: 600, crumbleRespawnMs: 3000 });
    expect(m.step(16, true)).toBe('cracking');
    expect(m.solid).toBe(true);
    m.step(500, false);
    expect(m.state).toBe('cracking');
    m.step(100, false);
    expect(m.state).toBe('fallen');
    expect(m.solid).toBe(false);
  });

  it('vuelve a crecer después del tiempo de reaparición', () => {
    const m = new CrumbleMotor(CFG);
    m.step(16, true);
    m.step(CFG.crumbleDelayMs, false);
    expect(m.state).toBe('fallen');
    m.step(CFG.crumbleRespawnMs - 10, true);
    expect(m.state).toBe('fallen');
    m.step(10, false);
    expect(m.state).toBe('solid');
  });

  it('reset la deja entera', () => {
    const m = new CrumbleMotor(CFG);
    m.step(16, true);
    m.reset();
    expect(m.state).toBe('solid');
    expect(m.solid).toBe(true);
  });
});
