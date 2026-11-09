import { describe, expect, it } from 'vitest';
import { EICHU_STARS } from '../src/data/story';
import { EICHU_STARS as COVER_STARS, VARIANTS, makeCover } from '../tools/make-cover.mjs';

interface Placement { frame: number; scale: number; x: number; y: number }

describe('portada de itch.io (S84)', () => {
  it('usa las mismas estrellas de Eichu que el juego', () => {
    expect(COVER_STARS).toEqual(EICHU_STARS);
  });

  it('escala los sprites solo por enteros (vecino más cercano)', () => {
    for (const v of Object.values(VARIANTS) as Array<{ kerana: Placement; boss: Placement }>) {
      expect(Number.isInteger(v.kerana.scale)).toBe(true);
      expect(Number.isInteger(v.boss.scale)).toBe(true);
    }
  });

  it('mide 630 × 500 y Kerana ocupa cerca de un quinto del alto', () => {
    for (const v of Object.values(VARIANTS)) {
      const { img, kerana } = makeCover(v);
      expect([img.width, img.height]).toEqual([630, 500]);
      expect(kerana.height / 500).toBeGreaterThan(0.15);
      expect(kerana.height / 500).toBeLessThan(0.25);
    }
  });
});
