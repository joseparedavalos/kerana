import { describe, expect, it } from 'vitest';
import { terrainAlpha, terrainDepths } from '../src/systems/terrainLogic';

// Mapa de prueba: '#' sólido, '.' aire.
function depths(rows: string[], max: number): number[][] {
  const w = rows[0].length;
  const d = terrainDepths((x, y) => rows[y][x] === '#', w, rows.length, max);
  return rows.map((_, y) => Array.from(d.slice(y * w, (y + 1) * w)));
}

describe('terreno como repisa (S28)', () => {
  it('cuenta la distancia al aire en las 8 direcciones; fuera del mapa es sólido', () => {
    const d = depths(['......', '######', '######', '######', '######'], 9);
    expect(d[0]).toEqual([0, 0, 0, 0, 0, 0]);
    expect(d[1]).toEqual([1, 1, 1, 1, 1, 1]);
    expect(d[4]).toEqual([4, 4, 4, 4, 4, 4]);
  });

  it('un bloque se ve como cáscara: las paredes que se tocan tienen su espesor y el centro queda hondo', () => {
    const d = depths(['.......', '.#####.', '.#####.', '.#####.', '.#####.', '.#####.', '.......'], 9);
    expect(d[1].slice(1, 6)).toEqual([1, 1, 1, 1, 1]);
    expect(d[3].slice(1, 6)).toEqual([1, 2, 3, 2, 1]);
  });

  it('se corta en max + 1', () => {
    const d = depths(['.', '#', '#', '#', '#', '#', '#'], 2);
    expect(d.map((r) => r[0])).toEqual([0, 1, 2, 3, 3, 3, 3]);
  });

  it('alfa: entero hasta tiles - 1, tenue en tiles, oculto más hondo', () => {
    expect([1, 2, 3, 4, 5].map((d) => terrainAlpha(d, 3, 0.5))).toEqual([1, 1, 0.5, 0, 0]);
  });
});
