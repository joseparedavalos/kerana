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
    const wave = new LightWaveMotor({ speed: 100, rangePx: 100, fadeFrom: 0.5, bossDamage: 1, width: 14, wallFadeMs: 100 });
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

  it('choca con el terreno: se detiene, se apaga y no daña lo que está del otro lado', () => {
    const wave = new LightWaveMotor(GAMEPLAY.lightWave);
    // Pared (Ground) de un tile en x 48–63; enemigo y roca agrietada detrás, en x 70.
    const wall = (x: number) => x >= 48 && x < 64;
    const enemyBehind = {};
    wave.fire(10, 50, 1);
    for (let i = 0; i < 200 && wave.active && !wave.blocked; i++) wave.step(16, wall);
    expect(wave.blocked).toBe(true);
    expect(wave.x + GAMEPLAY.lightWave.width / 2).toBeLessThan(64);
    expect(wave.canHit).toBe(false);
    expect(wave.tryHit(enemyBehind)).toBe(false);
    // No sigue avanzando y se apaga en `wallFadeMs`.
    const x = wave.x;
    wave.step(GAMEPLAY.lightWave.wallFadeMs / 2, wall);
    expect(wave.x).toBe(x);
    expect(wave.alpha).toBeLessThan(1);
    wave.step(GAMEPLAY.lightWave.wallFadeMs, wall);
    expect(wave.active).toBe(false);
  });

  it('pegada a una pared se apaga sin salir', () => {
    const wave = new LightWaveMotor(GAMEPLAY.lightWave);
    wave.fire(10, 50, -1);
    wave.step(16, (x) => x < 8);
    expect(wave.blocked).toBe(true);
    expect(wave.traveled).toBe(0);
  });

  it('sin terreno en el camino recorre todo el alcance', () => {
    const wave = new LightWaveMotor(GAMEPLAY.lightWave);
    wave.fire(0, 0, 1);
    for (let i = 0; i < 200 && wave.active; i++) wave.step(16, () => false);
    expect(wave.blocked).toBe(false);
    expect(wave.x).toBeCloseTo(GAMEPLAY.lightWave.rangePx);
  });
});
