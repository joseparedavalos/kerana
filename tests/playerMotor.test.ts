import { describe, expect, it } from 'vitest';
import { GAMEPLAY } from '../src/config/gameplay';
import { PlayerMotor, nextMoveState, type MotorBody, type MoveInput } from '../src/entities/PlayerMotor';

const P = GAMEPLAY.player;
const DT = 1000 / 60;

// Simulación mínima: gravedad y suelo en y = 0 (y positiva hacia abajo).
class Sim {
  motor = new PlayerMotor();
  y = 0;
  body: MotorBody = { onGround: true, vx: 0, vy: 0 };
  groundUntilX = Infinity;
  x = 0;

  step(input: Partial<MoveInput> = {}, ms = DT): void {
    const full: MoveInput = { left: false, right: false, jumpPressed: false, jumpHeld: false, ...input };
    const out = this.motor.step(ms, full, this.body);
    this.body.vx = out.vx;
    this.body.vy = Math.min(out.vy + GAMEPLAY.gravity * (ms / 1000), P.maxFallSpeed);
    this.x += this.body.vx * (ms / 1000);
    this.y += this.body.vy * (ms / 1000);
    const hasFloor = this.x <= this.groundUntilX;
    if (hasFloor && this.y >= 0) {
      this.y = 0;
      this.body.vy = 0;
      this.body.onGround = true;
    } else {
      this.body.onGround = false;
    }
  }

  /** Avanza en pasos de 1 ms (el motor limita cada paso a maxStepMs). */
  wait(ms: number, input: Partial<MoveInput> = {}): void {
    for (let t = 0; t < ms; t++) this.step(input, 1);
  }

  /** Deja el suelo sin saltar (camina por un borde). */
  walkOffLedge(): void {
    this.groundUntilX = this.x - 1;
    this.body.onGround = false;
  }
}

describe('nextMoveState', () => {
  it('elige estados según suelo, velocidad y entrada', () => {
    expect(nextMoveState(true, 0, 0, false, 5)).toBe('idle');
    expect(nextMoveState(true, 0, 0, true, 5)).toBe('run');
    expect(nextMoveState(true, 50, 0, false, 5)).toBe('run');
    expect(nextMoveState(false, 0, -100, false, 5)).toBe('jump');
    expect(nextMoveState(false, 0, 0, false, 5)).toBe('fall');
    expect(nextMoveState(false, 0, 200, false, 5)).toBe('fall');
  });
});

describe('PlayerMotor: transiciones', () => {
  it('idle → run → idle según la entrada horizontal', () => {
    const s = new Sim();
    s.step();
    expect(s.motor.state).toBe('idle');
    s.step({ right: true });
    expect(s.motor.state).toBe('run');
    expect(s.motor.facing).toBe(1);
    for (let i = 0; i < 30; i++) s.step();
    expect(s.motor.state).toBe('idle');
    s.step({ left: true });
    expect(s.motor.facing).toBe(-1);
  });

  it('acelera hasta la velocidad máxima sin pasarse', () => {
    const s = new Sim();
    for (let i = 0; i < 60; i++) s.step({ right: true });
    expect(s.body.vx).toBe(P.runSpeed);
  });

  it('idle → jump → fall → idle', () => {
    const s = new Sim();
    s.step();
    s.step({ jumpPressed: true, jumpHeld: true });
    expect(s.motor.state).toBe('jump');
    expect(s.body.vy).toBeLessThan(0);
    let sawFall = false;
    for (let i = 0; i < 120 && !(sawFall && s.body.onGround); i++) {
      s.step({ jumpHeld: true });
      if (s.motor.state === 'fall') sawFall = true;
    }
    expect(sawFall).toBe(true);
    s.step();
    expect(s.motor.state).toBe('idle');
  });

  it('salto variable: soltar corta la subida', () => {
    const high = new Sim();
    const low = new Sim();
    high.step({ jumpPressed: true, jumpHeld: true });
    low.step({ jumpPressed: true, jumpHeld: true });
    let minHigh = 0;
    let minLow = 0;
    for (let i = 0; i < 90; i++) {
      high.step({ jumpHeld: true });
      low.step({ jumpHeld: i < 3 });
      minHigh = Math.min(minHigh, high.y);
      minLow = Math.min(minLow, low.y);
    }
    expect(-minLow).toBeLessThan(-minHigh * 0.6);
    // Altura completa ≈ v² / 2g ≈ 67 px (con margen por la integración discreta).
    expect(-minHigh).toBeGreaterThan(55);
    expect(-minHigh).toBeLessThan(75);
  });

  it('limita la velocidad de caída', () => {
    const s = new Sim();
    s.walkOffLedge();
    for (let i = 0; i < 120; i++) s.step();
    expect(s.body.vy).toBeLessThanOrEqual(P.maxFallSpeed);
    expect(s.motor.state).toBe('fall');
  });
});

describe('PlayerMotor: coyote time', () => {
  it('permite saltar poco después de dejar el borde', () => {
    const s = new Sim();
    s.step();
    s.walkOffLedge();
    s.wait(P.coyoteMs - 20);
    expect(s.body.onGround).toBe(false);
    s.step({ jumpPressed: true, jumpHeld: true }, 1);
    expect(s.motor.state).toBe('jump');
  });

  it('no permite saltar pasado el coyote time', () => {
    const s = new Sim();
    s.step();
    s.walkOffLedge();
    s.wait(P.coyoteMs + 10);
    s.step({ jumpPressed: true, jumpHeld: true }, 1);
    expect(s.motor.state).toBe('fall');
  });

  it('no da un segundo salto con el coyote tras saltar', () => {
    const s = new Sim();
    s.step({ jumpPressed: true, jumpHeld: true });
    s.step({ jumpHeld: true });
    const vy = s.body.vy;
    s.step({ jumpPressed: true, jumpHeld: true });
    expect(s.body.vy).toBeGreaterThan(vy); // sigue frenando, no reinicia el salto
  });
});

describe('PlayerMotor: buffer de salto', () => {
  function fallThenPress(msBeforeLanding: number): Sim {
    const s = new Sim();
    s.y = -200;
    s.body.onGround = false;
    s.body.vy = 0;
    // Simula la caída hasta saber cuánto falta para aterrizar.
    const probe = new Sim();
    probe.y = s.y;
    probe.body.onGround = false;
    let landingMs = 0;
    while (!probe.body.onGround) {
      probe.step({}, 1);
      landingMs += 1;
    }
    const pressAt = landingMs - msBeforeLanding;
    for (let t = 0; t < pressAt; t++) s.step({}, 1);
    s.step({ jumpPressed: true, jumpHeld: true }, 1);
    while (!s.body.onGround) s.step({ jumpHeld: true }, 1);
    s.step({ jumpHeld: true }, 1);
    return s;
  }

  it('salta al aterrizar si se pulsó justo antes', () => {
    const s = fallThenPress(P.jumpBufferMs - 20);
    expect(s.motor.state).toBe('jump');
    expect(s.body.vy).toBeLessThan(0);
  });

  it('no salta si se pulsó demasiado antes', () => {
    const s = fallThenPress(P.jumpBufferMs + 30);
    expect(s.motor.state).toBe('idle');
  });
});
