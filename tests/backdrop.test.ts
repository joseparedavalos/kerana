import { describe, expect, it } from 'vitest';
import { backdropPanX, backdropTint, stepFade } from '../src/systems/backdropLogic';

describe('fondo del nivel', () => {
  it('se desplaza de 0 a -margen según el avance, sin pasarse', () => {
    expect(backdropPanX(0, 1000, 80, 1)).toBe(0);
    expect(backdropPanX(500, 1000, 80, 1)).toBe(-40);
    expect(backdropPanX(1000, 1000, 80, 1)).toBe(-80);
    expect(backdropPanX(1500, 1000, 80, 1)).toBe(-80);
    expect(backdropPanX(-10, 1000, 80, 1)).toBe(0);
    expect(backdropPanX(1000, 1000, 80, 0.5)).toBe(-40);
  });

  it('queda quieto si el nivel cabe en la vista', () => {
    expect(backdropPanX(0, 0, 80, 1)).toBe(0);
  });

  it('el brillo oscurece y se multiplica por el ambiente', () => {
    expect(backdropTint(1)).toBe(0xffffff);
    expect(backdropTint(0.5)).toBe(0x808080);
    expect(backdropTint(1, 0x4a4e6e)).toBe(0x4a4e6e);
    expect(backdropTint(2)).toBe(0xffffff);
  });

  it('el fundido avanza hacia el objetivo sin pasarse', () => {
    expect(stepFade(0, 1, 100, 400)).toBeCloseTo(0.25);
    expect(stepFade(0.9, 1, 100, 400)).toBe(1);
    expect(stepFade(1, 0, 200, 400)).toBeCloseTo(0.5);
    expect(stepFade(0, 1, 16, 0)).toBe(1);
  });
});
