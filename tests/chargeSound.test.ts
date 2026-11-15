import { describe, expect, it } from 'vitest';
import { GAMEPLAY } from '../src/config/gameplay';
import { ChargeSound, chargeRiseSec, type ChargeSoundSink } from '../src/entities/chargeSoundLogic';
import { PlayerMotor, type MotorBody, type MoveInput } from '../src/entities/PlayerMotor';
import { SFX_PRESETS, type SfxKey } from '../src/systems/sfxPresets';

// S95: cómo suena la carga del tajo, con el motor de Kerana de verdad y un audio que anota.
const C = GAMEPLAY.chargedSlash;
const DT = 1000 / 60;

class Recorder implements ChargeSoundSink {
  readonly log: string[] = [];
  /** Lo que está sonando con `start` (lo que se puede cortar). */
  readonly sounding = new Set<SfxKey>();
  offsets: number[] = [];
  play(key: SfxKey): void {
    this.log.push(key);
  }
  start(key: SfxKey, offsetSec: number): void {
    // Una voz por clave, como AudioManager.
    if (this.sounding.has(key)) this.log.push(`stop:${key}`);
    this.sounding.add(key);
    this.offsets.push(offsetSec);
    this.log.push(`start:${key}`);
  }
  stop(key: SfxKey): void {
    if (!this.sounding.delete(key)) return;
    this.log.push(`stop:${key}`);
  }
  count(entry: string): number {
    return this.log.filter((e) => e === entry).length;
  }
}

class Rig {
  readonly motor = new PlayerMotor();
  readonly audio = new Recorder();
  readonly sound = new ChargeSound(this.audio);
  private readonly body: MotorBody = { onGround: true, vx: 0, vy: 0 };
  private held = false;

  constructor() {
    this.motor.chargeEnabled = true;
  }

  /** Un cuadro, como LevelScene: el motor y después el sonido. */
  frame(attackHeld: boolean): void {
    const input: MoveInput = {
      left: false,
      right: false,
      jumpPressed: false,
      jumpHeld: false,
      attackPressed: attackHeld && !this.held,
      attackHeld,
    };
    this.held = attackHeld;
    this.motor.step(DT, input, this.body);
    this.sound.step(this.motor.chargeFraction, this.motor.chargedSwing && this.motor.state === 'attack');
  }

  hold(ms: number): void {
    for (let t = 0; t < ms; t += DT) this.frame(true);
  }

  release(ms = 400): void {
    for (let t = 0; t < ms; t += DT) this.frame(false);
  }
}

describe('sonido de la carga del tajo', () => {
  it('el zumbido dura lo que va del brillo a la carga lista', () => {
    const p = SFX_PRESETS.chargeUp;
    expect(p[3] + p[4] + p[5]).toBeCloseTo(chargeRiseSec(), 5);
    expect(chargeRiseSec()).toBeCloseTo((C.holdMs - C.glowFromMs) / 1000, 5);
    // Sube de tono.
    expect(p[8]).toBeGreaterThan(0);
  });

  it('el tajo cargado no es el común: más grave, más largo y con brillo encima', () => {
    const len = (p: number[]) => p[3] + p[4] + p[5];
    expect(SFX_PRESETS.chargedSlash[2]).toBeLessThan(SFX_PRESETS.slash[2]);
    expect(len(SFX_PRESETS.chargedSlash)).toBeGreaterThan(len(SFX_PRESETS.slash));
  });

  it('antes del brillo no suena nada (un tajo común no zumba)', () => {
    const r = new Rig();
    r.hold(C.glowFromMs - DT * 2);
    r.release();
    expect(r.audio.log).toEqual([]);
  });

  it('soltar a medias corta el zumbido sin «ting» ni tajo cargado', () => {
    const r = new Rig();
    r.hold((C.glowFromMs + C.holdMs) / 2);
    expect(r.audio.log).toEqual(['start:chargeUp']);
    expect(r.sound.phase).toBe('rising');
    r.frame(false);
    expect(r.audio.log).toEqual(['start:chargeUp', 'stop:chargeUp']);
    r.release();
    expect(r.audio.count('chargeReady')).toBe(0);
    expect(r.audio.count('chargedSlash')).toBe(0);
    expect(r.audio.sounding.size).toBe(0);
  });

  it('cargar completo: zumbido, un «ting» aunque siga apretando, y el tajo cargado al soltar', () => {
    const r = new Rig();
    r.hold(C.holdMs + 1500);
    expect(r.audio.log).toEqual(['start:chargeUp', 'stop:chargeUp', 'chargeReady']);
    r.release();
    expect(r.audio.log).toEqual(['start:chargeUp', 'stop:chargeUp', 'chargeReady', 'chargedSlash']);
    expect(r.audio.sounding.size).toBe(0);
  });

  it('recibir daño cargando corta el zumbido', () => {
    const r = new Rig();
    r.hold((C.glowFromMs + C.holdMs) / 2);
    r.motor.triggerHurt(GAMEPLAY.hurt.reducedControlMs);
    r.frame(true);
    expect(r.audio.log).toEqual(['start:chargeUp', 'stop:chargeUp']);
    expect(r.audio.sounding.size).toBe(0);
    expect(r.audio.count('chargeReady')).toBe(0);
  });

  it('reaparecer cargando también lo corta', () => {
    const r = new Rig();
    r.hold((C.glowFromMs + C.holdMs) / 2);
    r.motor.reset();
    r.sound.step(r.motor.chargeFraction, false);
    expect(r.audio.sounding.size).toBe(0);
  });

  it('diez cargas seguidas no dejan zumbidos colgados ni superpuestos', () => {
    const r = new Rig();
    for (let i = 0; i < 10; i++) {
      r.hold(i % 2 ? C.holdMs + 200 : (C.glowFromMs + C.holdMs) / 2);
      r.release();
    }
    expect(r.audio.sounding.size).toBe(0);
    expect(r.audio.count('start:chargeUp')).toBe(10);
    expect(r.audio.count('stop:chargeUp')).toBe(10);
    expect(r.audio.count('chargeReady')).toBe(5);
    expect(r.audio.count('chargedSlash')).toBe(5);
    // Nunca arranca uno con otro sonando.
    let on = 0;
    for (const e of r.audio.log) {
      if (e === 'start:chargeUp') expect(++on).toBe(1);
      if (e === 'stop:chargeUp') on--;
    }
  });

  it('la pausa corta el zumbido y al volver sigue en el tono que iba, sin repetir el «ting»', () => {
    const r = new Rig();
    r.hold(C.glowFromMs + 100);
    r.sound.interrupt();
    r.sound.interrupt();
    expect(r.audio.log).toEqual(['start:chargeUp', 'stop:chargeUp']);
    r.frame(true);
    expect(r.audio.log).toEqual(['start:chargeUp', 'stop:chargeUp', 'start:chargeUp']);
    expect(r.audio.offsets[1]).toBeGreaterThan(r.audio.offsets[0]);
    expect(r.audio.offsets[1]).toBeLessThan(chargeRiseSec());
    r.hold(C.holdMs);
    r.sound.interrupt();
    r.hold(500);
    expect(r.audio.count('chargeReady')).toBe(1);
  });
});
