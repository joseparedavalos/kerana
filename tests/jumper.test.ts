import { describe, expect, it } from 'vitest';
import { JumperMotor } from '../src/entities/enemies/JumperMotor';

const CFG = { detectRadius: 120, waitMs: 1000, crouchMs: 300, jumpVelocity: -320, jumpSpeedX: 90 };

describe('JumperMotor (kuati)', () => {
  it('espera, se agacha y salta hacia Kerana', () => {
    const m = new JumperMotor(CFG);
    m.step(999, 50, -1, true);
    expect(m.state).toBe('wait');
    m.step(1, 50, -1, true);
    expect(m.state).toBe('crouch');
    const out = m.step(300, 50, 1, true);
    expect(out.state).toBe('air');
    // La dirección se decide al agacharse (el aviso muestra hacia dónde va a saltar).
    expect(out.jump).toEqual({ vx: -90, vy: -320 });
  });

  it('no salta si Kerana está lejos', () => {
    const m = new JumperMotor(CFG);
    for (let i = 0; i < 50; i++) m.step(100, 500, 1, true);
    expect(m.state).toBe('wait');
  });

  it('vuelve a esperar al aterrizar', () => {
    const m = new JumperMotor(CFG);
    m.step(1000, 50, 1, true);
    m.step(300, 50, 1, true);
    m.step(50, 50, 1, true);
    expect(m.state).toBe('air');
    m.step(100, 50, 1, false);
    expect(m.state).toBe('air');
    m.step(16, 50, 1, true);
    expect(m.state).toBe('wait');
  });
});
