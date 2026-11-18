import { describe, expect, it } from 'vitest';
import { GAMEPLAY } from '../src/config/gameplay';
import {
  MOTE_KINDS,
  PAINT_K,
  paintHalo,
  paintMote,
  paintStaff,
  paintStar,
  starAtlasFrames,
  starFrameSize,
  trailMoteKind,
} from '../src/entities/bosses/jasyPaint';
import { alphaAt, colorAt } from '../src/systems/pixelArt';

// S103: las estrellas de siesta de Jasy Jatere (solo el dibujo; el daño de las chispas no cambia).
const LOOK = GAMEPLAY.jasyJatereLook;
const R = GAMEPLAY.jasyJatere.sparkRadius;
const PALETTE = new Set<number>([...LOOK.gold, LOOK.core]);

describe('estrellas de siesta (pintor)', () => {
  it('núcleo blanco caliente en el centro y solo colores del oro del bastón', () => {
    for (const flare of [false, true]) {
      const p = paintStar(0, flare);
      const c = (p.width - 1) / 2;
      expect(colorAt(p, c, c)).toBe(LOOK.core);
      for (let y = 0; y < p.height; y++) {
        for (let x = 0; x < p.width; x++) if (alphaAt(p, x, y)) expect(PALETTE.has(colorAt(p, x, y))).toBe(true);
      }
    }
  });

  it('cuatro puntas sobre los ejes girados, no en las diagonales', () => {
    const size = starFrameSize();
    const c = (size - 1) / 2;
    const reach = LOOK.star.spike * R * PAINT_K * 0.8;
    for (const deg of [0, 22.5, 45]) {
      const p = paintStar(deg, false);
      const a = (deg * Math.PI) / 180;
      for (let k = 0; k < 4; k++) {
        const t = a + (k * Math.PI) / 2;
        expect(alphaAt(p, Math.round(c + Math.cos(t) * reach), Math.round(c + Math.sin(t) * reach))).toBe(255);
        const d = t + Math.PI / 4;
        expect(alphaAt(p, Math.round(c + Math.cos(d) * reach), Math.round(c + Math.sin(d) * reach))).toBe(0);
      }
    }
  });

  it('al destellar las puntas llegan más lejos', () => {
    const count = (deg: number, flare: boolean) => {
      const p = paintStar(deg, flare);
      let n = 0;
      for (let i = 3; i < p.data.length; i += 4) if (p.data[i]) n++;
      return n;
    };
    const size = starFrameSize();
    const c = (size - 1) / 2;
    const far = Math.round(c + LOOK.star.spike * R * PAINT_K * 1.15);
    expect(alphaAt(paintStar(0, false), far, c)).toBe(0);
    expect(alphaAt(paintStar(0, true), far, c)).toBe(255);
    expect(count(0, true)).toBeGreaterThan(count(0, false));
  });

  it('el atlas trae los cuadros de giro, normal y destellando, todos del mismo tamaño', () => {
    const frames = starAtlasFrames();
    const stars = frames.filter((f) => f.name.startsWith('star_'));
    expect(stars).toHaveLength(LOOK.star.frames * 2);
    for (const f of stars) expect([f.px.width, f.px.height]).toEqual([starFrameSize(), starFrameSize()]);
    expect(new Set(frames.map((f) => f.name)).size).toBe(frames.length);
  });

  it('el halo se apaga hacia afuera en escalones', () => {
    const p = paintHalo(LOOK.star.haloRadius);
    const c = (p.width - 1) / 2;
    expect(alphaAt(p, c, c)).toBeGreaterThan(alphaAt(p, c + Math.round(c * 0.6), c));
    expect(alphaAt(p, 0, 0)).toBe(0);
    const levels = new Set<number>();
    for (let i = 3; i < p.data.length; i += 4) levels.add(p.data[i]);
    expect(levels.size).toBeLessThanOrEqual(5);
  });

  it('las motas de la estela se enfrían al apagarse', () => {
    expect(trailMoteKind(1, true)).toBe('big');
    expect(trailMoteKind(0.9, false)).toBe('hot');
    expect(trailMoteKind(0.5, false)).toBe('gold');
    expect(trailMoteKind(0.1, true)).toBe('deep');
    for (const k of MOTE_KINDS) expect(alphaAt(paintMote(k), 0, 0) + alphaAt(paintMote(k), 2, 2)).toBeGreaterThan(0);
  });

  it('el bastón mide su caja y lleva la cabeza de oro arriba y la madera abajo', () => {
    const p = paintStaff();
    expect([p.width, p.height]).toEqual([GAMEPLAY.jasyJatere.staffWidth * PAINT_K, GAMEPLAY.jasyJatere.staffHeight * PAINT_K]);
    const gold = new Set<number>([...LOOK.gold, LOOK.core]);
    const wood = new Set<number>(LOOK.wood);
    const cx = Math.floor(p.width / 2) - 1;
    expect(gold.has(colorAt(p, cx, Math.round(p.height * 0.12)))).toBe(true);
    expect(wood.has(colorAt(p, cx, p.height - 3))).toBe(true);
  });
});
