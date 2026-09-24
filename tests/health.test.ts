import { describe, expect, it } from 'vitest';
import { Health } from '../src/systems/Health';

describe('Health', () => {
  it('quita corazones y activa la invulnerabilidad', () => {
    const h = new Health(4, 4);
    expect(h.damage(1, 1000)).toBe(true);
    expect(h.current).toBe(3);
    expect(h.isInvulnerable).toBe(true);
  });

  it('ignora el daño mientras es invulnerable', () => {
    const h = new Health(4, 4);
    h.damage(1, 1000);
    expect(h.damage(1, 1000)).toBe(false);
    expect(h.current).toBe(3);
  });

  it('la invulnerabilidad termina al avanzar el tiempo', () => {
    const h = new Health(4, 4);
    h.damage(1, 100);
    h.tick(99);
    expect(h.isInvulnerable).toBe(true);
    h.tick(1);
    expect(h.isInvulnerable).toBe(false);
    expect(h.damage(1, 100)).toBe(true);
    expect(h.current).toBe(2);
  });

  it('no baja de 0 ni permite dañar cuando ya está muerta', () => {
    const h = new Health(1, 4);
    h.damage(5, 0);
    expect(h.current).toBe(0);
    expect(h.isDead).toBe(true);
    expect(h.damage(1, 100)).toBe(false);
  });

  it('cura sin pasarse del máximo y devuelve lo curado de verdad', () => {
    const h = new Health(3, 4);
    expect(h.heal(1)).toBe(1);
    expect(h.current).toBe(4);
    expect(h.heal(2)).toBe(0);
    expect(h.current).toBe(4);
  });

  it('reset vuelve a vida completa sin invulnerabilidad', () => {
    const h = new Health(4, 4);
    h.damage(3, 1000);
    h.reset();
    expect(h.current).toBe(4);
    expect(h.isInvulnerable).toBe(false);
  });
});
