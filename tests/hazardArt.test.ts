import { describe, expect, it } from 'vitest';
import { HAZARD_ART, HAZARD_VARIANT_COUNT, TONE, hazardTones, readTilePixels } from '../tools/lib/hazard-art.mjs';
import { HAZARD_TILES, TILE, hazardTileAt } from '../tools/lib/tileset-layout.mjs';

const BIOMES = ['cerro', 'estero', 'campo', 'pueblo', 'selva', 'montana', 'ciudad', 'cielo'];
const tilePixels = (biome: string, index: number): number[] => Array.from(readTilePixels(`public/assets/tiles/${biome}.png`, index));

describe('peligro dibujado por código (S64)', () => {
  it('cada variante tiene contorno, al menos 3 tonos y arranca abajo', () => {
    for (const family of ['mineral', 'karagua']) {
      for (let v = 0; v < HAZARD_VARIANT_COUNT; v++) {
        const tones = Array.from(hazardTones(family, v));
        expect(tones).toContain(TONE.outline);
        const fill = new Set(tones.filter((t) => t > TONE.outline));
        expect(fill.size).toBeGreaterThanOrEqual(3);
        // Apoyado en el suelo: la fila de abajo tiene dibujo.
        expect(tones.slice((TILE - 1) * TILE).some((t) => t > TONE.outline)).toBe(true);
      }
    }
  });

  it('las tres variantes de cada familia tienen otra silueta', () => {
    for (const family of ['mineral', 'karagua']) {
      const shapes = Array.from({ length: HAZARD_VARIANT_COUNT }, (_, v) => Array.from(hazardTones(family, v), (t) => (t ? 1 : 0)).join(''));
      expect(new Set(shapes).size).toBe(HAZARD_VARIANT_COUNT);
    }
  });

  it('cada bioma tiene las tres baldosas del peligro dibujadas y distintas', () => {
    for (const biome of BIOMES) {
      const tiles = HAZARD_TILES.map((i) => tilePixels(biome, i));
      for (const t of tiles) expect(t.filter((_, k) => k % 4 === 3 && t[k] > 0).length).toBeGreaterThan(30);
      expect(new Set(tiles.map((t) => t.join(','))).size).toBe(HAZARD_TILES.length);
    }
  });

  it('las familias: mineral en cerro, montana, ciudad y cielo; karaguatá en estero, selva y pueblo; campo desde raw/', () => {
    expect(Object.entries(HAZARD_ART).map(([b, a]) => `${b}:${a.family}`).sort()).toEqual(
      ['cerro:mineral', 'cielo:mineral', 'ciudad:mineral', 'estero:karagua', 'montana:mineral', 'pueblo:karagua', 'selva:karagua'],
    );
  });

  it('la variante depende solo de x y nunca se repite en la columna de al lado', () => {
    const seen = new Set<number>();
    for (let x = 0; x < 600; x++) {
      const t = hazardTileAt(x);
      expect(HAZARD_TILES).toContain(t);
      expect(hazardTileAt(x)).toBe(t);
      if (x > 0) expect(t).not.toBe(hazardTileAt(x - 1));
      seen.add(t);
    }
    expect(seen.size).toBe(3);
  });
});
