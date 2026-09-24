import { describe, expect, it } from 'vitest';
import { ChargerMotor, type ChargerConfig } from '../src/entities/enemies/ChargerMotor';

const CFG: ChargerConfig = {
  detectRadius: 80,
  telegraphMs: 400,
  chargeSpeed: 180,
  chargeMaxMs: 2000,
  cooldownMs: 500,
};

describe('ChargerMotor', () => {
  it('se queda quieta hasta detectar a Kerana en su radio', () => {
    const m = new ChargerMotor(CFG);
    expect(m.step(16, 200, 1).state).toBe('idle');
    expect(m.step(16, 200, 1).vx).toBe(0);
  });

  it('idle → telegraph → charge al entrar en el radio', () => {
    const m = new ChargerMotor(CFG);
    m.step(16, 50, 1);
    expect(m.state).toBe('telegraph');
    expect(m.step(16, 50, 1).vx).toBe(0); // quieta durante el aviso
    let out = m.step(CFG.telegraphMs, 50, 1);
    expect(out.state).toBe('charge');
    expect(out.vx).toBe(CFG.chargeSpeed);
  });

  it('carga en la dirección de Kerana en el momento del aviso', () => {
    const m = new ChargerMotor(CFG);
    m.step(16, 50, -1);
    const out = m.step(CFG.telegraphMs, 50, -1);
    expect(out.vx).toBe(-CFG.chargeSpeed);
  });

  it('stopCharge corta la embestida contra una pared y entra en enfriamiento', () => {
    const m = new ChargerMotor(CFG);
    m.step(16, 50, 1);
    m.step(CFG.telegraphMs, 50, 1);
    expect(m.state).toBe('charge');
    m.stopCharge();
    expect(m.state).toBe('cooldown');
    const out = m.step(CFG.cooldownMs, Infinity, 1);
    expect(out.state).toBe('idle');
    expect(out.vx).toBe(0);
  });

  it('corta sola la carga tras chargeMaxMs si no choca antes', () => {
    const m = new ChargerMotor(CFG);
    m.step(16, 50, 1);
    m.step(CFG.telegraphMs, 50, 1);
    m.step(CFG.chargeMaxMs, 50, 1);
    expect(m.state).toBe('cooldown');
  });
});
