import { describe, expect, it } from 'vitest';
import { GAMEPLAY } from '../src/config/gameplay';
import { ENEMIES } from '../src/data/enemies';
import { airTime, leapSpeed, ledgeBehind, PounceMotor, scanAhead, type PounceConfig } from '../src/entities/enemies/PounceMotor';

// Yaguareté avá (S76): el Charger que salta un hueco.
const Y = GAMEPLAY.yaguareteAva;
const CFG: PounceConfig = {
  detectRadius: Y.detectRadius,
  telegraphMs: Y.telegraphMs,
  chargeSpeed: Y.runSpeed,
  chargeMaxMs: Y.runMaxMs,
  cooldownMs: Y.cooldownMs,
  gatherMs: Y.gatherMs,
  leapVelocity: Y.leapVelocity,
  gravity: GAMEPLAY.gravity,
  maxGapPx: Y.maxGapPx,
  landMarginPx: Y.landMarginPx,
  leapMaxSpeed: Y.leapMaxSpeed,
  halfWidth: ENEMIES.yaguarete_ava.width / 2,
  recoverMs: Y.recoverMs,
};
const DT = 16;
const FAR = { edgePx: Infinity, gapPx: null };

/** Lleva el motor del reposo a la carrera (Kerana a `distance`, a la izquierda). */
function running(distance = 150): PounceMotor {
  const m = new PounceMotor(CFG);
  m.step(DT, distance, -1);
  for (let t = 0; t <= CFG.telegraphMs; t += DT) m.step(DT, distance, -1);
  expect(m.state).toBe('charge');
  return m;
}

describe('yaguareté avá: el motor (S76)', () => {
  it('reposo → aviso (agazapado) → carrera, como el Charger', () => {
    const m = new PounceMotor(CFG);
    expect(m.step(DT, Y.detectRadius + 1, -1).state).toBe('idle');
    expect(m.step(DT, Y.detectRadius, -1).state).toBe('telegraph');
    expect(m.step(DT, 100, -1).vx).toBe(0);
    for (let t = 0; t < CFG.telegraphMs; t += DT) m.step(DT, 100, -1);
    const out = m.step(DT, 100, -1, FAR);
    expect(out.state).toBe('charge');
    expect(out.vx).toBe(-CFG.chargeSpeed);
  });

  it('en el borde, con Kerana del otro lado de un hueco que alcanza: se planta, salta una vez y cae expuesto', () => {
    const m = running();
    const gap = { edgePx: 1, gapPx: 48 };
    expect(m.step(DT, 120, -1, gap).state).toBe('gather');
    let jumps = 0;
    let out = m.step(DT, 120, -1, gap);
    for (let t = 0; t < CFG.gatherMs && !out.jump; t += DT) out = m.step(DT, 120, -1, gap);
    expect(out.jump).not.toBeNull();
    expect(out.jump!.vx).toBeLessThan(0);
    expect(out.jump!.vy).toBe(CFG.leapVelocity);
    jumps++;
    // En el aire no toca la velocidad; aterriza y queda expuesto.
    for (let t = 0; t < 400; t += DT) {
      out = m.step(DT, 120, -1, gap, false);
      if (out.jump) jumps++;
      expect(out.vx).toBeNull();
    }
    out = m.step(DT, 120, -1, gap, true);
    expect(out.state).toBe('recover');
    expect(out.vx).toBe(0);
    // Expuesto: no vuelve a saltar ni a correr hasta que pasa la ventana y el enfriamiento.
    for (let t = 0; t < CFG.recoverMs; t += DT) {
      out = m.step(DT, 30, -1, gap, true);
      if (out.jump) jumps++;
      expect(out.vx === 0 || out.state === 'cooldown').toBe(true);
    }
    expect(jumps).toBe(1);
    expect(m.state).toBe('cooldown');
    for (let t = 0; t <= CFG.cooldownMs; t += DT) m.step(DT, 500, -1, FAR, true);
    expect(m.state).toBe('idle');
  });

  it('frena en el borde si el hueco es muy ancho o no tiene suelo enfrente (nunca baja de su copa)', () => {
    const wide = running();
    expect(wide.step(DT, 300, -1, { edgePx: 0, gapPx: null }).state).toBe('cooldown');
    expect(wide.step(DT, 300, -1, FAR).vx).toBe(0);
  });

  it('frena en el borde si Kerana está de este lado del hueco', () => {
    const m = running(40);
    const out = m.step(DT, 30, -1, { edgePx: 2, gapPx: 48 });
    expect(out.state).toBe('cooldown');
    expect(out.vx).toBe(0);
  });

  it('no persigue a Kerana sobre una plataforma que se mueve: no arranca, y si corría, frena', () => {
    const m = new PounceMotor(CFG);
    for (let t = 0; t < 2000; t += DT) expect(m.step(DT, Infinity, -1).state).toBe('idle');
    const r = running();
    const out = r.step(DT, Infinity, -1, FAR);
    expect(out.state).toBe('cooldown');
    expect(out.vx).toBe(0);
  });

  it('el salto pasa el hueco con el cuerpo entero y no llega al salto largo del dosel', () => {
    const t = airTime(CFG.leapVelocity, CFG.gravity);
    // Hueco del ascensor del claro (3 tiles): cae con el cuerpo entero del otro lado.
    const travel = leapSpeed(48, CFG) * t;
    expect(travel).toBeGreaterThanOrEqual(48 + 2 * CFG.halfWidth);
    // Con el hueco más ancho que salta (4 tiles), la velocidad no pasa el tope.
    expect(leapSpeed(CFG.maxGapPx, CFG)).toBeLessThanOrEqual(CFG.leapMaxSpeed);
    expect(leapSpeed(CFG.maxGapPx, CFG) * t).toBeGreaterThanOrEqual(CFG.maxGapPx + 2 * CFG.halfWidth);
    // El salto largo (12 tiles) no entra en `maxGapPx`.
    expect(12 * 16).toBeGreaterThan(CFG.maxGapPx);
  });
});

describe('yaguareté avá: mirar el borde (S76)', () => {
  // Suelo de x 0 a 99 y de 148 a 299 (hueco de 48), con la cara de arriba en y 100; una pared en x 400.
  const ground = (x: number, y: number) => (y >= 100 && ((x >= 0 && x < 100) || (x >= 148 && x < 300) || x >= 400)) || (x >= 400 && y >= 0);

  it('encuentra el borde y el hueco hasta suelo a la misma altura', () => {
    const a = scanAhead(90, 99, 1, 24, 64, 4, ground);
    expect(a.edgePx).toBe(12);
    expect(a.gapPx).toBe(48);
  });

  it('sin borde cerca, no hay hueco', () => {
    expect(scanAhead(20, 99, 1, 24, 64, 4, ground)).toEqual({ edgePx: Infinity, gapPx: null });
  });

  it('un hueco más ancho que el tope, o una pared enfrente, no se salta', () => {
    expect(scanAhead(290, 99, 1, 24, 64, 4, ground).gapPx).toBeNull(); // de 300 a 400: 100 px
    const wall = (x: number, y: number) => (y >= 100 && x < 100) || (x >= 130 && y >= 50);
    expect(scanAhead(90, 99, 1, 24, 64, 4, wall).gapPx).toBeNull();
  });

  it('mira hacia la izquierda igual', () => {
    const a = scanAhead(160, 99, -1, 24, 64, 4, ground);
    expect(a.edgePx).toBe(16);
    expect(a.gapPx).toBe(48);
  });

  it('no la empuja hacia un borde sin dónde caer; un hueco que se salta sí cuenta como salida (S76)', () => {
    // Kerana en x 280, cerca del borde de x 300 (después, 100 px de vacío): acorralada hacia la derecha.
    expect(ledgeBehind(280, 99, 1, 72, 64, 4, ground)).toBe(true);
    // Hacia la izquierda, a 80 px de su borde: tiene lugar.
    expect(ledgeBehind(180, 99, -1, 72, 64, 4, ground)).toBe(false);
    // Junto al hueco de 48 (se salta): no está acorralada.
    expect(ledgeBehind(150, 99, -1, 72, 64, 4, ground)).toBe(false);
  });
});
