import { describe, expect, it } from 'vitest';
import { GAMEPLAY } from '../src/config/gameplay';
import { ENEMIES } from '../src/data/enemies';
import { angleDelta, createPaye, isHoming, launchPaye, lineClear, payeTouches, stepPaye } from '../src/entities/enemies/payeLogic';

const CFG = { speed: 60, homingMs: 1000, turnRateDeg: 90, lifeMs: 4000 };
// Pasos de 10 ms: los tiempos de la prueba quedan exactos.
const DT = 10;

/** Avanza `ms` con Kerana fija en (tx, ty). */
function run(p: ReturnType<typeof createPaye>, ms: number, tx: number, ty: number): void {
  for (let t = 0; t < ms - 1e-6; t += DT) stepPaye(p, Math.min(DT, ms - t), tx, ty, CFG);
}

describe('payé (S62)', () => {
  it('sale apuntando a Kerana y a velocidad constante', () => {
    const p = createPaye();
    launchPaye(p, 0, 0, 100, 0);
    expect(p.heading).toBeCloseTo(0);
    run(p, 500, 100, 0);
    expect(p.x).toBeCloseTo(30, 0);
    expect(p.y).toBeCloseTo(0);
  });

  it('corrige el rumbo durante la ventana, como mucho turnRateDeg por segundo', () => {
    const p = createPaye();
    launchPaye(p, 0, 0, 100, 0);
    // Kerana salta arriba de golpe: el giro queda acotado.
    run(p, 500, 0, -1000);
    expect(isHoming(p, CFG)).toBe(true);
    expect(Math.abs(p.heading) * (180 / Math.PI)).toBeCloseTo(45, 0);
  });

  it('después de la ventana sigue recto aunque Kerana se mueva', () => {
    const p = createPaye();
    launchPaye(p, 0, 0, 100, 0);
    run(p, CFG.homingMs, 100, 0);
    expect(isHoming(p, CFG)).toBe(false);
    const heading = p.heading;
    const { x, y } = p;
    run(p, 1000, 0, -1000);
    expect(p.heading).toBe(heading);
    expect(p.x - x).toBeCloseTo(60, 0);
    expect(p.y - y).toBeCloseTo(0, 5);
  });

  it('el giro se corta justo al cerrar la ventana aunque el paso la cruce', () => {
    const p = createPaye();
    launchPaye(p, 0, 0, 100, 0);
    run(p, CFG.homingMs - 100, 100, 0);
    // Un paso de 400 ms: solo 100 ms caen en la ventana → como mucho 9°.
    stepPaye(p, 400, 0, -1000, CFG);
    expect(Math.abs(p.heading) * (180 / Math.PI)).toBeCloseTo(9, 1);
  });

  it('gira por el lado corto', () => {
    expect(angleDelta(Math.PI * 0.9, -Math.PI * 0.9)).toBeCloseTo(Math.PI * 0.2);
    expect(angleDelta(0, -Math.PI / 2)).toBeCloseTo(-Math.PI / 2);
  });

  it('caduca al cumplir lifeMs', () => {
    const p = createPaye();
    launchPaye(p, 0, 0, 100, 0);
    run(p, CFG.lifeMs - 50, 100, 0);
    expect(p.alive).toBe(true);
    run(p, 100, 100, 0);
    expect(p.alive).toBe(false);
    const x = p.x;
    stepPaye(p, 100, 100, 0, CFG);
    expect(p.x).toBe(x);
  });

  it('el tajo lo corta si lo toca, con un radio más generoso que el que lastima', () => {
    const p = createPaye();
    launchPaye(p, 0, 0, 100, 0);
    const sword = { x: 4, y: -9, width: 26, height: 18 };
    expect(payeTouches(p, GAMEPLAY.payesero.paye.cutRadius, sword)).toBe(true);
    const near = { x: 5, y: -2, width: 10, height: 10 };
    expect(payeTouches(p, GAMEPLAY.payesero.paye.cutRadius, near)).toBe(true);
    expect(payeTouches(p, GAMEPLAY.payesero.paye.hitRadius, near)).toBe(false);
    expect(payeTouches(p, GAMEPLAY.payesero.paye.cutRadius, { x: 40, y: 0, width: 10, height: 10 })).toBe(false);
    p.alive = false;
    expect(payeTouches(p, GAMEPLAY.payesero.paye.cutRadius, sword)).toBe(false);
  });

  it('con los valores del juego: es lento, corrige solo un rato y caduca', () => {
    const cfg = GAMEPLAY.payesero.paye;
    expect(cfg.speed).toBeLessThan(GAMEPLAY.player.runSpeed / 2);
    expect(cfg.homingMs).toBeLessThan(cfg.lifeMs);
    expect(cfg.cutRadius).toBeGreaterThan(cfg.hitRadius);
  });

  it('el payesero es un caster humano con el cuerpo más alto que Kerana', () => {
    const def = ENEMIES.payesero;
    expect(def.archetype).toBe('caster');
    expect(def.human).toBe(true);
    expect(def.height).toBeGreaterThan(GAMEPLAY.player.bodyHeight);
  });
});

describe('línea de vista del payesero (S62)', () => {
  // Un muro de un tile en x 64-80.
  const wall = (x: number) => x >= 64 && x < 80;
  it('sin roca de por medio, carga', () => {
    expect(lineClear(0, 0, 60, 0, 8, (x) => wall(x))).toBe(true);
  });
  it('con roca de por medio, no', () => {
    expect(lineClear(0, 0, 160, 0, 8, (x) => wall(x))).toBe(false);
  });
});
