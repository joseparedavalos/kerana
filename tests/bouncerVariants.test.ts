import { describe, expect, it } from 'vitest';
import { BouncerMotor, parseBouncerKind } from '../src/entities/hazards/BouncerMotor';

describe('variantes del hongo', () => {
  it('normal: rebota siempre', () => {
    const m = new BouncerMotor('normal', 3000);
    m.bounced();
    expect(m.canBounce).toBe(true);
  });

  it('de un solo uso: se desinfla al rebotar y vuelve a los 3 s', () => {
    const m = new BouncerMotor('once', 3000);
    expect(m.canBounce).toBe(true);
    m.bounced();
    expect(m.state).toBe('deflated');
    expect(m.canBounce).toBe(false);
    m.step(2999);
    expect(m.canBounce).toBe(false);
    m.step(1);
    expect(m.state).toBe('ready');
    expect(m.canBounce).toBe(true);
  });

  it('dormido: no rebota hasta un tajo cargado y después queda activo', () => {
    const m = new BouncerMotor('sleep', 3000);
    expect(m.canBounce).toBe(false);
    expect(m.struck(false)).toBe(false);
    expect(m.state).toBe('asleep');
    expect(m.struck(true)).toBe(true);
    expect(m.canBounce).toBe(true);
    m.bounced();
    m.step(10000);
    expect(m.canBounce).toBe(true);
    // Ya despierto, otro tajo no cambia nada; al reentrar al nivel vuelve a dormir.
    expect(m.struck(true)).toBe(false);
    m.reset();
    expect(m.state).toBe('asleep');
  });

  it('lee la propiedad `kind` del mapa', () => {
    expect(parseBouncerKind('once')).toBe('once');
    expect(parseBouncerKind('sleep')).toBe('sleep');
    expect(parseBouncerKind(undefined)).toBe('normal');
    expect(parseBouncerKind('raro')).toBe('normal');
  });
});
