import { describe, expect, it } from 'vitest';
import { GAMEPLAY } from '../src/config/gameplay';
import { LightWaveMotor } from '../src/entities/LightWaveMotor';

describe('Onda de luz del tajo cargado', () => {
  it('avanza unos 6 tiles hacia adelante y se apaga', () => {
    const wave = new LightWaveMotor(GAMEPLAY.lightWave);
    expect(GAMEPLAY.lightWave.rangePx).toBeGreaterThanOrEqual(5 * 16);
    expect(GAMEPLAY.lightWave.rangePx).toBeLessThanOrEqual(7 * 16);
    expect(wave.fire(100, 50, -1)).toBe(true);
    for (let i = 0; i < 200 && wave.active; i++) wave.step(16);
    expect(wave.active).toBe(false);
    expect(wave.x).toBeCloseTo(100 - GAMEPLAY.lightWave.rangePx);
  });

  it('solo una en pantalla', () => {
    const wave = new LightWaveMotor(GAMEPLAY.lightWave);
    expect(wave.fire(0, 0, 1)).toBe(true);
    wave.step(50);
    expect(wave.fire(0, 0, 1)).toBe(false);
    for (let i = 0; i < 200 && wave.active; i++) wave.step(16);
    expect(wave.fire(0, 0, 1)).toBe(true);
  });

  it('se desvanece al final del recorrido', () => {
    const wave = new LightWaveMotor({ speed: 100, rangePx: 100, fadeFrom: 0.5, bossDamage: 1 });
    wave.fire(0, 0, 1);
    wave.step(400);
    expect(wave.alpha).toBe(1);
    wave.step(350);
    expect(wave.alpha).toBeCloseTo(0.5);
  });

  it('toca cada objetivo una sola vez', () => {
    const wave = new LightWaveMotor(GAMEPLAY.lightWave);
    const enemy = {};
    wave.fire(0, 0, 1);
    expect(wave.tryHit(enemy)).toBe(true);
    expect(wave.tryHit(enemy)).toBe(false);
  });

  it('a los jefes les hace 1 solo en la ventana vulnerable', () => {
    const wave = new LightWaveMotor(GAMEPLAY.lightWave);
    expect(wave.bossDamage(true)).toBe(1);
    expect(wave.bossDamage(false)).toBe(0);
    expect(GAMEPLAY.chargedSlash.damage).toBe(3);
  });
});
