import { describe, expect, it } from 'vitest';
import { GAMEPLAY } from '../src/config/gameplay';
import { DashTrailClock, dustAngles, ghostAlpha, pickSlot } from '../src/entities/dashTrailLogic';

const CFG = GAMEPLAY.dashFx;

describe('estela del dash (S83)', () => {
  it('la copia nace con la opacidad de la config y se apaga en fadeMs', () => {
    expect(ghostAlpha(0, CFG)).toBeCloseTo(CFG.alpha);
    expect(ghostAlpha(CFG.fadeMs / 2, CFG)).toBeCloseTo(CFG.alpha / 2);
    expect(ghostAlpha(CFG.fadeMs, CFG)).toBe(0);
    expect(ghostAlpha(CFG.fadeMs + 50, CFG)).toBe(0);
  });

  it('la más vieja es la más tenue', () => {
    expect(ghostAlpha(120, CFG)).toBeLessThan(ghostAlpha(40, CFG));
  });

  it('una copia al arrancar y después una cada everyMs', () => {
    const clock = new DashTrailClock(CFG.everyMs);
    const frame = 1000 / 60;
    let spawns = 0;
    for (let t = 0; t < GAMEPLAY.dash.durationMs; t += frame) if (clock.step(true, frame)) spawns++;
    expect(spawns).toBe(1 + Math.floor((GAMEPLAY.dash.durationMs - frame) / CFG.everyMs));
    expect(clock.step(false, frame)).toBe(false);
    // Un dash nuevo arranca con copia otra vez.
    expect(clock.step(true, frame)).toBe(true);
  });

  it('con las copias vivas que pide un dash entero, no hace falta más pila que maxGhosts', () => {
    // A mitad del dash, las vivas son las nacidas en los últimos fadeMs.
    expect(Math.ceil(CFG.fadeMs / CFG.everyMs)).toBeGreaterThanOrEqual(CFG.maxGhosts);
    expect(CFG.maxGhosts).toBe(4);
  });

  it('reusa un lugar libre, o si no el más viejo', () => {
    expect(pickSlot([10, 0, 30], [true, false, true])).toBe(1);
    expect(pickSlot([10, 50, 30], [true, true, true])).toBe(1);
  });

  it('el polvo sale hacia el lado contrario al del dash, levantándose', () => {
    const right = dustAngles(1, 25, 15);
    const left = dustAngles(-1, 25, 15);
    const mid = (a: { min: number; max: number }) => toRad((a.min + a.max) / 2);
    expect(Math.cos(mid(right))).toBeLessThan(0);
    expect(Math.cos(mid(left))).toBeGreaterThan(0);
    // Hacia arriba es y negativa.
    expect(Math.sin(mid(right))).toBeLessThan(0);
    expect(Math.sin(mid(left))).toBeLessThan(0);
  });
});

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}
