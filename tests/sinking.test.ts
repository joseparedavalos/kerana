import { describe, expect, it } from 'vitest';
import { SinkingMotor, type SinkingConfig } from '../src/entities/hazards/SinkingMotor';

const CFG: SinkingConfig = { sinkDelayMs: 1200, respawnMs: 3000, cycleFloatMs: 2000 };

describe('SinkingMotor (camalote)', () => {
  it('flota mientras nadie lo pisa', () => {
    const m = new SinkingMotor(CFG);
    for (let i = 0; i < 100; i++) m.step(100, false);
    expect(m.state).toBe('floating');
    expect(m.solid).toBe(true);
  });

  it('se hunde 1,2 s después de pisarlo, aunque Kerana salte', () => {
    const m = new SinkingMotor(CFG);
    expect(m.step(16, true)).toBe('sinking');
    m.step(1100, false);
    expect(m.state).toBe('sinking');
    expect(m.solid).toBe(true);
    m.step(100, false);
    expect(m.state).toBe('sunk');
    expect(m.solid).toBe(false);
  });

  it('reaparece a los 3 s de hundirse', () => {
    const m = new SinkingMotor(CFG);
    m.step(16, true);
    m.step(CFG.sinkDelayMs, false);
    m.step(2900, false);
    expect(m.state).toBe('sunk');
    m.step(100, false);
    expect(m.state).toBe('floating');
  });

  it('con el ciclo automático se hunde solo y vuelve (fase 3 de Mbói Tu\'i)', () => {
    const m = new SinkingMotor(CFG);
    m.setAutoCycle(true);
    m.step(1900, false);
    expect(m.state).toBe('floating');
    m.step(100, false);
    expect(m.state).toBe('sinking');
    m.reset();
    expect(m.state).toBe('floating');
    expect(m.autoCycle).toBe(false);
  });
});
