import { describe, expect, it } from 'vitest';
import { dorsalSides, innerHalf, Spine } from '../src/entities/bosses/monaiSpine';
import { bodyRadius, paintSkin, patternCenters, skinSize } from '../src/entities/bosses/monaiPaint';
import { GAMEPLAY } from '../src/config/gameplay';

// S102: el cuerpo de Moñái dibujado como tira. Solo el dibujo: la cuerda de segmentos de la pelea no cambia.
const LOOK = GAMEPLAY.monaiLook;

describe('Spine', () => {
  it('remuestrea a igual distancia y pasa por los extremos', () => {
    const sp = new Spine(20, 8);
    sp.build([0, 10, 20, 30], [0, 0, 0, 0], 4);
    expect(sp.ok).toBe(true);
    expect(sp.length).toBeCloseTo(30, 3);
    expect(sp.x[0]).toBeCloseTo(0, 3);
    expect(sp.x[19]).toBeCloseTo(30, 3);
    for (let i = 1; i < 20; i++) expect(sp.s[i] - sp.s[i - 1]).toBeCloseTo(30 / 19, 3);
    // Recta hacia la derecha: la normal (-ty, tx) apunta hacia abajo y no hay curvatura.
    expect(sp.ny[5]).toBeCloseTo(1, 5);
    expect(Math.abs(sp.k[5])).toBeLessThan(1e-4);
  });

  it('saltea los puntos repetidos y no se rompe si todos coinciden', () => {
    const sp = new Spine(10, 6);
    sp.build([5, 5, 5, 5], [7, 7, 7, 7], 4);
    expect(sp.ok).toBe(false);
    expect(sp.x[9]).toBe(5);
    sp.build([0, 0, 10, 10], [0, 0, 0, 0], 4);
    expect(sp.ok).toBe(true);
    expect(sp.length).toBeCloseTo(10, 3);
  });

  it('una vuelta cerrada no se pasa de largo (centrípeta) y tiene curvatura', () => {
    const sp = new Spine(40, 8);
    sp.build([0, 10, 12, 10, 0], [0, 0, 5, 10, 10], 5);
    let maxX = -1e9;
    for (let i = 0; i < 40; i++) maxX = Math.max(maxX, sp.x[i]);
    expect(maxX).toBeLessThan(13.5);
    expect(Math.abs(sp.k[20])).toBeGreaterThan(0.1);
  });

  it('el desplazamiento por la normal mueve la columna', () => {
    const sp = new Spine(5, 4);
    sp.build([0, 10], [0, 0], 2);
    const off = new Float32Array(5).fill(2);
    sp.offset(off);
    expect(sp.y[2]).toBeCloseTo(2, 4);
  });
});

describe('lomo arriba', () => {
  it('empieza del lado de la nuca y se da vuelta cuando apuntaría abajo', () => {
    // ny de una curva que va a la derecha (ny = 1) y después a la izquierda (ny = -1).
    const ny = [1, 1, 0.2, -0.2, -1, -1];
    const out = new Int8Array(6);
    dorsalSides(ny, 6, -1, 0.35, out);
    // Lado -1 con ny 1: el lomo mira arriba. Al doblar (ny -1) se da vuelta.
    expect(Array.from(out)).toEqual([-1, -1, -1, -1, 1, 1]);
  });

  it('colgando derecho no cambia de lado', () => {
    const out = new Int8Array(4);
    dorsalSides([0, 0.1, -0.1, 0], 4, 1, 0.35, out);
    expect(Array.from(out)).toEqual([1, 1, 1, 1]);
  });

  it('el lado de adentro de una curva cerrada se aprieta', () => {
    expect(innerHalf(8, 0, 0.85)).toBe(8);
    expect(innerHalf(8, 0.5, 0.85)).toBeCloseTo(1.7, 5);
    expect(innerHalf(8, 5, 0.85)).toBe(1);
  });
});

describe('piel pintada', () => {
  it('el cuerpo se afina de la nuca a una punta', () => {
    expect(bodyRadius(0)).toBeCloseTo(LOOK.body.profile[0][1], 5);
    expect(bodyRadius(0.24)).toBeCloseTo(7, 5);
    expect(bodyRadius(0.95)).toBeLessThan(bodyRadius(0.8));
    expect(bodyRadius(1)).toBe(0);
    // Nunca más grueso que la tira.
    for (let f = 0; f <= 1; f += 0.01) expect(bodyRadius(f)).toBeLessThan(LOOK.body.halfHeight);
  });

  it('las cuatro variantes miden lo mismo (comparten los UV de la tira)', () => {
    const { width, height } = skinSize();
    for (const v of ['front', 'back', 'glow', 'mask'] as const) {
      const px = paintSkin(v);
      expect(px.width).toBe(width);
      expect(px.height).toBe(height);
    }
  });

  it('la piel usa solo colores de las rampas y es opaca dentro de la silueta', () => {
    const allowed = new Set<number>([LOOK.palette.outline, ...LOOK.palette.skin, ...LOOK.palette.cream]);
    const px = paintSkin('front');
    const mask = paintSkin('mask');
    let opaque = 0;
    for (let i = 0; i < px.data.length; i += 4) {
      expect(px.data[i + 3] === 0 || px.data[i + 3] === 255).toBe(true);
      expect(px.data[i + 3]).toBe(mask.data[i + 3]);
      if (!px.data[i + 3]) continue;
      opaque++;
      expect(allowed.has((px.data[i] << 16) | (px.data[i + 1] << 8) | px.data[i + 2])).toBe(true);
    }
    expect(opaque).toBeGreaterThan(1000);
  });

  it('los rombos del lomo se achican y se juntan hacia la cola', () => {
    const c = patternCenters();
    expect(c.length).toBeGreaterThan(6);
    expect(c[1] - c[0]).toBeGreaterThan(c[c.length - 1] - c[c.length - 2]);
  });
});
