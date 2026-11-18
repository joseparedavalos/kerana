import { describe, expect, it } from 'vitest';
import { GAMEPLAY } from '../src/config/gameplay';
import { fogAtlasFrames, fogDensity, fogDust, fogPuffs, paintPuff, type Zone } from '../src/entities/hazards/sleepFogPaint';
import { alphaAt, colorAt } from '../src/systems/pixelArt';

// S103: la bruma de la siesta (solo el dibujo de las zonas SleepFog; la zona y el sueño no cambian).
const LOOK = GAMEPLAY.sleepFogLook;
const T = 16;
/** Las cuatro zonas de l4 (tools/levels/l4.txt), en unidades. */
const L4: Zone[] = [
  { x: 59 * T, y: 32 * T, width: 11 * T, height: 5 * T },
  { x: 231 * T, y: 19 * T, width: 14 * T, height: 4 * T },
  { x: 490 * T, y: 33 * T, width: 4 * T, height: 4 * T },
  { x: 509 * T, y: 33 * T, width: 4 * T, height: 4 * T },
];

describe('bruma de la siesta', () => {
  it('más densa al centro que en el borde, nada lejos afuera, y apoyada en el piso', () => {
    for (const z of L4) {
      const cx = z.x + z.width / 2;
      const cy = z.y + z.height / 2;
      const center = fogDensity(z, cx, cy);
      expect(center).toBeGreaterThan(0.9);
      expect(fogDensity(z, z.x + 2, cy)).toBeLessThan(center * 0.6);
      expect(fogDensity(z, z.x - LOOK.edgeOut - 1, cy)).toBe(0);
      expect(fogDensity(z, cx, z.y - LOOK.edgeOut - 1)).toBe(0);
      // Del borde al centro, nunca baja.
      let last = 0;
      for (let x = z.x - LOOK.edgeOut; x <= cx; x += 2) {
        const d = fogDensity(z, x, cy);
        expect(d).toBeGreaterThanOrEqual(last - 1e-9);
        last = d;
      }
      // El piso no se desvanece.
      expect(fogDensity(z, cx, z.y + z.height - 1)).toBeGreaterThan(0.6);
    }
  });

  it('las bocanadas son siempre las mismas, dentro de su margen y con el velo más tenue', () => {
    for (const z of L4) {
      const a = fogPuffs(z);
      expect(fogPuffs(z)).toEqual(a);
      expect(a.some((p) => p.front)).toBe(true);
      expect(a.some((p) => !p.front)).toBe(true);
      const pad = LOOK.edgeOut + LOOK.jitter * 3;
      for (const p of a) {
        expect(p.x).toBeGreaterThan(z.x - pad);
        expect(p.x).toBeLessThan(z.x + z.width + pad);
        expect(p.y).toBeGreaterThan(z.y - pad);
        // La capa de atrás no baja de la fila del piso (la tierra honda está detrás).
        expect(p.y).toBeLessThanOrEqual(z.y + z.height - 2);
        expect(p.alpha).toBeLessThanOrEqual(p.front ? LOOK.frontAlpha : LOOK.backAlpha);
      }
    }
  });

  it('al centro de la zona las bocanadas pesan más que en el borde', () => {
    const z = L4[0];
    const puffs = fogPuffs(z).filter((p) => !p.front);
    const mid = puffs.filter((p) => Math.abs(p.x - (z.x + z.width / 2)) < z.width / 4);
    const edge = puffs.filter((p) => p.x < z.x + 6 || p.x > z.x + z.width - 6);
    const mean = (list: typeof puffs) => list.reduce((s, p) => s + p.alpha, 0) / list.length;
    expect(mid.length).toBeGreaterThan(0);
    expect(edge.length).toBeGreaterThan(0);
    expect(mean(mid)).toBeGreaterThan(mean(edge) * 1.5);
  });

  it('cada bocanada es pixel art: escalones de alfa tramados y la paleta lavanda', () => {
    const colors = new Set<number>([...LOOK.palette, LOOK.rim]);
    const alphas = new Set(LOOK.puffAlphas.map((a) => Math.round(a * 255)));
    for (let size = 0; size < LOOK.puffSizes.length; size++) {
      const p = paintPuff(size, 0);
      const seen = new Set<number>();
      for (let y = 0; y < p.height; y++) {
        for (let x = 0; x < p.width; x++) {
          const a = alphaAt(p, x, y);
          if (!a) continue;
          seen.add(a);
          expect(alphas.has(a)).toBe(true);
          expect(colors.has(colorAt(p, x, y))).toBe(true);
        }
      }
      expect(seen.size).toBe(LOOK.puffAlphas.length);
      // El borde no es un óvalo liso: tiene píxeles sueltos del tramado.
      expect(alphaAt(p, 0, 0)).toBe(0);
    }
    expect(fogAtlasFrames().length).toBe(LOOK.puffSizes.length * LOOK.shapesPerSize + 4);
  });

  it('polvo dorado en cada zona, entre el mínimo y el máximo', () => {
    for (const z of L4) {
      const d = fogDust(z);
      expect(d.length).toBeGreaterThanOrEqual(LOOK.dustMin);
      expect(d.length).toBeLessThanOrEqual(LOOK.dustMax);
      for (const m of d) {
        expect(m.x).toBeGreaterThanOrEqual(z.x);
        expect(m.x).toBeLessThanOrEqual(z.x + z.width);
      }
    }
  });
});
