import { describe, expect, it } from 'vitest';
import { ENEMIES } from '../src/data/enemies';
import { arcVelocity, flightTimeFor, ThrowerMotor } from '../src/entities/enemies/ThrowerMotor';

const CFG = { detectRadius: 150, windupMs: 500, cooldownMs: 1800 };

describe('ThrowerMotor (ka\'i)', () => {
  it('no lanza si Kerana está lejos', () => {
    const m = new ThrowerMotor(CFG);
    for (let i = 0; i < 100; i++) expect(m.step(50, 400)).toBe(false);
    expect(m.state).toBe('idle');
  });

  it('avisa y lanza una sola vez al terminar el aviso', () => {
    const m = new ThrowerMotor(CFG);
    expect(m.step(16, 100)).toBe(false);
    expect(m.state).toBe('windup');
    expect(m.step(480, 100)).toBe(false);
    expect(m.step(20, 100)).toBe(true);
    expect(m.state).toBe('cooldown');
    expect(m.step(16, 100)).toBe(false);
  });

  it('respeta la cadencia entre tiros', () => {
    const m = new ThrowerMotor(CFG);
    let throws = 0;
    // 10 s con Kerana cerca: el primero a los 0,5 s y después uno cada ≈ 2,3 s (aviso + espera).
    for (let t = 0; t < 10000; t += 10) if (m.step(10, 100)) throws++;
    expect(throws).toBe(1 + Math.floor((10000 - CFG.windupMs) / (CFG.windupMs + CFG.cooldownMs)));
  });

  it('el arco llega al blanco en el tiempo de vuelo', () => {
    const g = ENEMIES.kai.projectileGravity ?? 600;
    const cases = [
      [120, 80],
      [-90, 40],
      [60, -30],
    ];
    for (const [dx, dy] of cases) {
      const ms = flightTimeFor(Math.hypot(dx, dy), 5, 450, 1100);
      const v = arcVelocity(dx, dy, ms, g, { vx: 0, vy: 0 });
      // Simulación con pasos de 1 ms (como la integración del Thrower).
      let x = 0;
      let y = 0;
      let vy = v.vy;
      for (let t = 0; t < ms; t++) {
        vy += g / 1000;
        x += v.vx / 1000;
        y += vy / 1000;
      }
      expect(Math.abs(x - dx)).toBeLessThan(2);
      expect(Math.abs(y - dy)).toBeLessThan(2);
    }
  });

  it('el tiempo de vuelo crece con la distancia y está acotado', () => {
    expect(flightTimeFor(10, 5, 450, 1100)).toBe(450);
    expect(flightTimeFor(150, 5, 450, 1100)).toBe(750);
    expect(flightTimeFor(1000, 5, 450, 1100)).toBe(1100);
  });
});
