import { describe, expect, it } from 'vitest';
import { backdropFit, backdropPanX, backdropTint, caveSpan } from '../src/systems/backdropLogic';

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

  it('el ajuste vertical sube la imagen y la agranda si destaparía el borde', () => {
    const centered = backdropFit(360, 1.1, 0);
    expect(centered.scale).toBe(1.1);
    expect(centered.top).toBeCloseTo(-18);
    const up = backdropFit(360, 1.1, 10);
    expect(up.top).toBeCloseTo(-28);
    const far = backdropFit(360, 1.1, 40);
    expect(far.top).toBeCloseTo(-58);
    expect(far.scale).toBeCloseTo(418 / 360);
    // El borde de abajo sigue cubriendo la vista.
    expect(far.top + 360 * far.scale).toBeCloseTo(360);
    // Hacia abajo: el borde de arriba queda pegado a la vista.
    const down = backdropFit(360, 1.1, -40);
    expect(down.top).toBeCloseTo(0);
    expect(down.scale).toBeCloseTo(418 / 360);
  });

  it('la cueva se ve solo en su tramo de la vista', () => {
    const caves = [
      { x: 0, width: 720 },
      { x: 1888, width: 1952 },
    ];
    expect(caveSpan(0, 640, caves)).toEqual({ left: 0, right: 720 });
    expect(caveSpan(400, 640, caves)).toEqual({ left: -400, right: 320 });
    expect(caveSpan(1000, 640, caves)).toBeNull();
    expect(caveSpan(1500, 640, caves)).toEqual({ left: 388, right: 2340 });
  });
});
