import { describe, expect, it } from 'vitest';
import { LightWaveMotor } from '../src/entities/LightWaveMotor';
import { SwitchBoard, SwitchMotor, swordStrikes, waveStrikes, type Strikeable } from '../src/entities/SwitchMotor';

const WAVE = { speed: 240, rangePx: 96, fadeFrom: 0.6, bossDamage: 1, width: 14, wallFadeMs: 120 };
const FRAME = 1000 / 60;

function makeSwitch(x: number, y: number, timerMs = 0): Strikeable {
  return { zone: { x, y, width: 16, height: 16 }, motor: new SwitchMotor({ timerMs, warnMs: 1000 }), lastWaveShot: -1 };
}

describe('SwitchMotor', () => {
  it('permanente: queda encendido', () => {
    const m = new SwitchMotor({ timerMs: 0, warnMs: 1000 });
    expect(m.powered).toBe(false);
    expect(m.hit()).toBe(true);
    m.step(60000);
    expect(m.state).toBe('on');
    expect(m.hit()).toBe(false);
  });

  it('temporizado: avisa antes de cerrarse y se apaga solo', () => {
    const m = new SwitchMotor({ timerMs: 3000, warnMs: 1000 });
    m.hit();
    expect(m.state).toBe('on');
    m.step(1999);
    expect(m.state).toBe('on');
    m.step(2);
    expect(m.state).toBe('closing');
    expect(m.powered).toBe(true);
    m.step(999);
    expect(m.state).toBe('off');
    expect(m.powered).toBe(false);
  });

  it('temporizado: otro golpe vuelve a empezar la cuenta', () => {
    const m = new SwitchMotor({ timerMs: 3000, warnMs: 1000 });
    m.hit();
    m.step(2500);
    expect(m.state).toBe('closing');
    m.hit();
    expect(m.state).toBe('on');
    m.step(2500);
    expect(m.state).toBe('closing');
  });
});

describe('activación', () => {
  it('por el sable: enciende lo que toca el tajo, una vez por tajo', () => {
    const near = makeSwitch(32, 0);
    const far = makeSwitch(200, 0);
    const swing = new Set<object>();
    const attack = { x: 20, y: 0, width: 20, height: 16 };
    const hits = swordStrikes([near, far], attack, swing);
    expect(hits).toEqual([near]);
    for (const sw of hits) sw.motor.hit();
    expect(near.motor.powered).toBe(true);
    expect(far.motor.powered).toBe(false);
    // El mismo tajo no lo vuelve a golpear.
    expect(swordStrikes([near, far], attack, swing)).toEqual([]);
  });

  it('por la onda a través de una pared: la onda se apaga en la pared pero su luz llega al Switch', () => {
    // Kerana en x 0 mirando a la derecha; pared (Ground) en x 40–56; Switch detrás, en x 64–80.
    const wall = (x: number) => x >= 40 && x < 56;
    const sw = makeSwitch(64, -8);
    const wave = new LightWaveMotor(WAVE);
    wave.fire(0, 0, 1);
    let litAt = -1;
    let blockedWhenLit = false;
    for (let t = 0; t < 600 && litAt < 0; t += FRAME) {
      wave.step(FRAME, (x) => wall(x));
      if (waveStrikes([sw], wave, 14, 26, true).length > 0) {
        sw.motor.hit();
        litAt = t;
        blockedWhenLit = !wave.canHit;
      }
    }
    expect(litAt).toBeGreaterThan(0);
    expect(blockedWhenLit).toBe(true);
    expect(sw.motor.powered).toBe(true);
  });

  it('sin `waveThroughWalls` la pared corta la luz', () => {
    const sw = makeSwitch(64, -8);
    const wave = new LightWaveMotor(WAVE);
    wave.fire(0, 0, 1);
    let hits = 0;
    for (let t = 0; t < 600; t += FRAME) {
      wave.step(FRAME, (x) => x >= 40 && x < 56);
      hits += waveStrikes([sw], wave, 14, 26, false).length;
    }
    expect(hits).toBe(0);
  });

  it('la luz no pasa del alcance (6 tiles)', () => {
    const sw = makeSwitch(14 + 96 + 30, -8);
    const wave = new LightWaveMotor(WAVE);
    wave.fire(14, 0, 1);
    let hits = 0;
    for (let t = 0; t < 1000; t += FRAME) {
      wave.step(FRAME);
      hits += waveStrikes([sw], wave, 14, 26, true).length;
    }
    expect(hits).toBe(0);
  });

  it('cada onda lo cuenta una sola vez', () => {
    const sw = makeSwitch(30, -8);
    const wave = new LightWaveMotor(WAVE);
    wave.fire(0, 0, 1);
    let hits = 0;
    for (let t = 0; t < 600; t += FRAME) {
      wave.step(FRAME);
      hits += waveStrikes([sw], wave, 14, 26, true).length;
    }
    expect(hits).toBe(1);
  });
});

describe('SwitchBoard', () => {
  it('dos Switch sobre un mismo objetivo: tiene energía si alguno está encendido', () => {
    const calls: boolean[] = [];
    const board = new SwitchBoard();
    board.addTarget('reja', { setPowered: (on) => calls.push(on) });
    const a = new SwitchMotor({ timerMs: 2000, warnMs: 500 });
    const b = new SwitchMotor({ timerMs: 4000, warnMs: 500 });
    board.addSwitch('reja', a);
    board.addSwitch('reja', b);
    board.update();
    expect(calls).toEqual([false]);
    a.hit();
    board.update();
    expect(board.isPowered('reja')).toBe(true);
    b.hit();
    a.step(2000);
    b.step(2000);
    board.update();
    // a se apagó, b sigue: la reja sigue abierta (sin avisos repetidos).
    expect(a.powered).toBe(false);
    expect(calls).toEqual([false, true]);
    b.step(2000);
    board.update();
    expect(calls).toEqual([false, true, false]);
  });

  it('avisa de los objetivos que no existen', () => {
    const board = new SwitchBoard();
    board.addTarget('m1', { setPowered: () => {} });
    board.addSwitch('m1', new SwitchMotor({ timerMs: 0, warnMs: 0 }));
    board.addSwitch('nada', new SwitchMotor({ timerMs: 0, warnMs: 0 }));
    expect(board.missingTargets()).toEqual(['nada']);
  });
});
