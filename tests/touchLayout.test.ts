import { describe, expect, it } from 'vitest';
import { defaultTouchLayout, resolveTouchLayout, stepTouchScale } from '../src/systems/touchLayout';
import { VIEW } from '../src/systems/View';

describe('botones táctiles', () => {
  it('sin guardado usa la fábrica y la pausa queda en la esquina', () => {
    const layout = resolveTouchLayout(undefined);
    expect(layout).toEqual(defaultTouchLayout());
    expect(layout.pause.x).toBeGreaterThan(VIEW.width - 30);
    expect(layout.pause.y).toBeLessThan(30);
    expect(layout.pause.scale).toBe(1);
  });

  it('un botón fuera de la pantalla vuelve adentro, y el tamaño no pasa el tope', () => {
    const layout = resolveTouchLayout({ jump: { x: 9999, y: -40, scale: 9 } });
    expect(layout.jump.x).toBeLessThan(VIEW.width);
    expect(layout.jump.y).toBeGreaterThan(0);
    expect(layout.jump.scale).toBeLessThanOrEqual(1.7);
    expect(stepTouchScale(1.7, 1)).toBe(1.7);
    expect(stepTouchScale(0.7, -1)).toBe(0.7);
  });
});
