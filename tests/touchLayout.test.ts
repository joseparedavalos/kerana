import { describe, expect, it } from 'vitest';
import { GAMEPLAY } from '../src/config/gameplay';
import { defaultTouchLayout, inMoveZone, moveArrowOffset, moveDirection, resolveTouchLayout, stepTouchScale, touchButtonSize } from '../src/systems/touchLayout';
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

describe('zona de moverse (S90)', () => {
  const move = defaultTouchLayout().move;
  const dead = GAMEPLAY.touch.moveDeadZone;

  it('de fábrica las flechas quedan donde estaban los dos botones (x 36 y x 90)', () => {
    expect(move.x - moveArrowOffset(1)).toBe(36);
    expect(move.x + moveArrowOffset(1)).toBe(90);
  });

  it('el lado lo decide el medio entre las flechas, con una zona muerta chica', () => {
    expect(moveDirection(move, move.x - 30)).toBe(-1);
    expect(moveDirection(move, move.x + 30)).toBe(1);
    expect(moveDirection(move, move.x)).toBe(0);
    expect(moveDirection(move, move.x + dead - 0.5)).toBe(0);
    expect(moveDirection(move, move.x - dead - 0.5)).toBe(-1);
    expect(moveDirection(move, move.x + dead + 0.5)).toBe(1);
    // Con la zona agrandada, la zona muerta crece igual.
    expect(moveDirection({ ...move, scale: 1.7 }, move.x + dead + 0.5)).toBe(0);
  });

  it('las dos mitades no se pisan: ningún punto mueve a los dos lados', () => {
    for (let x = 0; x <= 160; x++) {
      const dir = moveDirection(move, x);
      expect(dir === -1 || dir === 0 || dir === 1).toBe(true);
    }
  });

  it('la zona es una cápsula alrededor de las dos flechas', () => {
    expect(inMoveZone(move, move.x, move.y)).toBe(true);
    expect(inMoveZone(move, move.x - moveArrowOffset(1), move.y - 30)).toBe(true);
    expect(inMoveZone(move, move.x + moveArrowOffset(1) + 39, move.y)).toBe(true);
    expect(inMoveZone(move, move.x + moveArrowOffset(1) + 41, move.y)).toBe(false);
    expect(inMoveZone(move, move.x, move.y - 60)).toBe(false);
  });

  it('un guardado viejo con left y right separados se migra al medio, sin perder la posición', () => {
    const old = { left: { x: 100, y: 200, scale: 1.3 }, right: { x: 170.2, y: 200, scale: 1.3 }, jump: { x: 500, y: 300, scale: 1 } };
    const layout = resolveTouchLayout(old);
    expect(layout.move.x).toBeCloseTo(135.1);
    expect(layout.move.y).toBe(200);
    expect(layout.move.scale).toBeCloseTo(1.3);
    expect(layout.jump).toEqual({ x: 500, y: 300, scale: 1 });
    expect(Object.keys(layout).sort()).toEqual(['attack', 'dash', 'jump', 'move', 'pause']);
    // Un guardado ya migrado no se vuelve a tocar.
    expect(resolveTouchLayout(layout)).toEqual(layout);
    // Con uno solo movido, la zona lo sigue.
    const onlyLeft = resolveTouchLayout({ left: { x: 200, y: 100, scale: 1 } });
    expect(onlyLeft.move.x - moveArrowOffset(1)).toBe(200);
    expect(onlyLeft.move.y).toBe(100);
  });

  it('la zona entera queda dentro de la pantalla', () => {
    const layout = resolveTouchLayout({ move: { x: -50, y: 9999, scale: 1.7 } });
    const r = (touchButtonSize('move') * 1.7) / 2;
    expect(layout.move.x - moveArrowOffset(1.7) - r).toBeGreaterThanOrEqual(0);
    expect(layout.move.y + r).toBeLessThanOrEqual(VIEW.height);
  });
});
