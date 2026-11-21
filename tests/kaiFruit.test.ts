import { describe, expect, it } from 'vitest';
import { GAMEPLAY } from '../src/config/gameplay';
import { ENEMIES } from '../src/data/enemies';
import { fruitFrames, PALETTE, SKIN, SPIN_FRAMES, spinFrameName } from '../src/entities/enemies/kaiFruitArt';
import { floorBelow, landed, seedAlpha, spinFrame, stepSeed, type Seed } from '../src/entities/enemies/kaiFruitLogic';

const frames = fruitFrames();
const byName = new Map(frames.map((f) => [f.name, f.px]));

describe('fruta del ka\'i (S115): el arte', () => {
  it('los valores del tiro no cambian', () => {
    expect(ENEMIES.kai).toMatchObject({ telegraphMs: 550, cooldownMs: 1900, projectileGravity: 600, flightMsPerPx: 5, projectileRadius: 4, projectilePool: 3 });
  });

  it('da siempre lo mismo, sin alfa a medias y solo con la paleta', () => {
    const again = fruitFrames();
    const palette = new Set(PALETTE);
    frames.forEach((f, i) => {
      expect(Array.from(f.px.data)).toEqual(Array.from(again[i].px.data));
      for (let j = 0; j < f.px.data.length; j += 4) {
        const a = f.px.data[j + 3];
        expect(a === 0 || a === 255).toBe(true);
        if (a) expect(palette.has((f.px.data[j] << 16) | (f.px.data[j + 1] << 8) | f.px.data[j + 2])).toBe(true);
      }
    });
  });

  it('cada giro es un fruto naranja de unas 7 unidades, con 4 tonos o más de la rampa (nada liso)', () => {
    for (let i = 0; i < SPIN_FRAMES; i++) {
      const px = byName.get(spinFrameName(i))!;
      const skin = new Map<number, number>();
      let opaque = 0;
      for (let j = 0; j < px.data.length; j += 4) {
        if (!px.data[j + 3]) continue;
        opaque++;
        const c = (px.data[j] << 16) | (px.data[j + 1] << 8) | px.data[j + 2];
        if ((SKIN as readonly number[]).includes(c)) skin.set(c, (skin.get(c) ?? 0) + 1);
      }
      expect(skin.size).toBeGreaterThanOrEqual(4);
      const orange = [...skin.values()].reduce((a, b) => a + b, 0);
      expect(orange / opaque).toBeGreaterThan(0.45);
      // Área del cuerpo, a 2 px por unidad: entre 6 y 8 unidades de diámetro.
      const units = Math.sqrt((orange / (GAMEPLAY.kaiFruit.detail ** 2)) / Math.PI) * 2;
      expect(units).toBeGreaterThan(5);
      expect(units).toBeLessThan(8.5);
    }
  });
});

describe('fruta del ka\'i (S115): la lógica', () => {
  it('gira hacia donde va y vuelve al principio', () => {
    expect(spinFrame(0, 14, 8, 1)).toBe(0);
    expect(spinFrame(1000 / 14, 14, 8, 1)).toBe(1);
    expect(spinFrame(1000 / 14, 14, 8, -1)).toBe(7);
    expect(spinFrame((8 * 1000) / 14 + 1, 14, 8, 1)).toBe(0);
  });

  it('no revienta en el piso antes de pasar el blanco', () => {
    expect(landed(300, 600, 100, 100, 110, 16, true, false)).toBe(false);
    expect(landed(600, 600, 100, 100, 110, 16, true, false)).toBe(true);
    // Plataforma de un sentido: solo bajando y desde arriba del borde.
    expect(landed(700, 600, 100, 95, 98, 16, false, true)).toBe(true);
    expect(landed(700, 600, 100, 99, 104, 16, false, true)).toBe(false);
    expect(landed(700, 600, -50, 95, 98, 16, false, true)).toBe(false);
  });

  it('busca el piso de abajo', () => {
    const solid = (_x: number, y: number) => y >= 160;
    expect(floorBelow(0, 100, 96, 16, solid)).toBe(160);
    expect(floorBelow(0, 170, 96, 16, solid)).toBe(160);
    expect(floorBelow(0, 0, 96, 16, solid)).toBeUndefined();
  });

  it('la semilla rebota cada vez más bajo, se queda y se apaga', () => {
    const cfg = GAMEPLAY.kaiFruit.seed;
    const s: Seed = { x: 0, y: 100, vx: 30, vy: cfg.launchVy, ageMs: 0, lifeMs: cfg.lifeMs, floorY: 120, bounces: 0 };
    for (let t = 0; t < cfg.lifeMs; t += 4) {
      stepSeed(s, 4, cfg);
      expect(s.y).toBeLessThanOrEqual(120);
    }
    expect(s.bounces).toBeGreaterThanOrEqual(1);
    expect(s.vy).toBe(0);
    expect(s.y).toBe(120);
    expect(seedAlpha(0, cfg.lifeMs, cfg.fadeMs, cfg.fadeSteps)).toBe(1);
    expect(seedAlpha(cfg.lifeMs - cfg.fadeMs / 2, cfg.lifeMs, cfg.fadeMs, cfg.fadeSteps)).toBeLessThan(1);
    expect(seedAlpha(cfg.lifeMs, cfg.lifeMs, cfg.fadeMs, cfg.fadeSteps)).toBe(0);
  });
});
