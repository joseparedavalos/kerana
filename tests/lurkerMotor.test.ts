import { describe, expect, it } from 'vitest';
import { LurkerMotor, type LurkerConfig } from '../src/entities/enemies/LurkerMotor';

const CFG: LurkerConfig = { detectRadius: 64, warnMs: 900, exposedMs: 1800, cooldownMs: 1400 };

describe('LurkerMotor (jakare)', () => {
  it('queda oculto (e invulnerable) mientras Kerana está lejos', () => {
    const m = new LurkerMotor(CFG);
    m.step(1000, 200);
    expect(m.state).toBe('hidden');
    expect(m.exposed).toBe(false);
  });

  it('avisa con burbujas antes de emerger', () => {
    const m = new LurkerMotor(CFG);
    expect(m.step(16, 40)).toBe('warn');
    expect(m.exposed).toBe(false);
    m.step(CFG.warnMs, 40);
    expect(m.state).toBe('exposed');
    expect(m.exposed).toBe(true);
  });

  it('se sumerge al terminar el tiempo afuera y espera antes de volver', () => {
    const m = new LurkerMotor(CFG);
    m.step(16, 40);
    m.step(CFG.warnMs, 40);
    m.step(CFG.exposedMs, 40);
    expect(m.state).toBe('cooldown');
    expect(m.exposed).toBe(false);
    m.step(CFG.cooldownMs - 1, 40);
    expect(m.state).toBe('cooldown');
    m.step(1, 40);
    expect(m.state).toBe('hidden');
    expect(m.step(16, 40)).toBe('warn');
  });

  it('una vez que avisa, emerge aunque Kerana se aleje', () => {
    const m = new LurkerMotor(CFG);
    m.step(16, 40);
    m.step(CFG.warnMs, Infinity);
    expect(m.state).toBe('exposed');
  });
});
