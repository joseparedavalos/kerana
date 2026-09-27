import { describe, expect, it } from 'vitest';
import { HeartThief, pulseBlocked, type Trunk } from '../src/entities/bosses/monaiLogic';
import { Health } from '../src/systems/Health';
import { StatusEffects } from '../src/systems/StatusEffects';

describe('Hipnosis (StatusEffects)', () => {
  it('invierte izquierda y derecha mientras dura y después vuelve a la normalidad', () => {
    const s = new StatusEffects();
    expect(s.applyHypnosis(3000)).toBe(true);
    const input = { left: true, right: false };
    s.applyTo(input);
    expect(input).toEqual({ left: false, right: true });
    s.step(2999);
    expect(s.hypnotized).toBe(true);
    s.step(1);
    expect(s.hypnotized).toBe(false);
    const after = { left: true, right: false };
    s.applyTo(after);
    expect(after).toEqual({ left: true, right: false });
  });

  it('un segundo pulso renueva la duración sin acumularla', () => {
    const s = new StatusEffects();
    s.applyHypnosis(3000);
    s.step(2000);
    expect(s.applyHypnosis(3000)).toBe(false);
    s.step(2999);
    expect(s.hypnotized).toBe(true);
    s.step(1);
    expect(s.hypnotized).toBe(false);
  });

  it('clear la quita (al reaparecer)', () => {
    const s = new StatusEffects();
    s.applyHypnosis(3000);
    s.clear();
    expect(s.hypnotized).toBe(false);
  });
});

describe('Troncos que bloquean el pulso', () => {
  const trunks: Trunk[] = [{ x: 100, halfWidth: 6, topY: 200 }];

  it('bloquea si el tronco está entre Moñái y Kerana y ella está debajo de la copa', () => {
    expect(pulseBlocked(50, 150, 250, trunks)).toBe(true);
    expect(pulseBlocked(150, 50, 250, trunks)).toBe(true);
  });

  it('no bloquea si no hay tronco en medio o si Kerana está sobre la copa', () => {
    expect(pulseBlocked(120, 180, 250, trunks)).toBe(false);
    expect(pulseBlocked(50, 150, 200, trunks)).toBe(false);
  });
});

describe('Robo del corazón (HeartThief)', () => {
  it('la embestida se lleva un corazón y golpear la cola lo devuelve', () => {
    const h = new Health(4, 4);
    const thief = new HeartThief();
    expect(thief.steal(() => h.damage(1, 0) && !h.isDead)).toBe(true);
    expect(h.current).toBe(3);
    expect(thief.holding).toBe(true);
    expect(thief.recover((n) => h.heal(n))).toBe(true);
    expect(h.current).toBe(4);
    expect(thief.holding).toBe(false);
    expect(thief.recover((n) => h.heal(n))).toBe(false);
  });

  it('guarda uno a la vez: un segundo acierto es daño común', () => {
    const h = new Health(4, 4);
    const thief = new HeartThief();
    thief.steal(() => h.damage(1, 0));
    expect(thief.steal(() => h.damage(1, 0))).toBe(false);
    expect(h.current).toBe(2);
    thief.recover((n) => h.heal(n));
    expect(h.current).toBe(3);
  });

  it('no roba si el golpe no se aplicó (invulnerable) ni si Kerana cayó', () => {
    const h = new Health(1, 4);
    const thief = new HeartThief();
    expect(thief.steal(() => false)).toBe(false);
    expect(thief.steal(() => h.damage(1, 0) && !h.isDead)).toBe(false);
    expect(thief.holding).toBe(false);
  });

  it('reset pierde el corazón guardado', () => {
    const thief = new HeartThief();
    thief.steal(() => true);
    thief.reset();
    expect(thief.holding).toBe(false);
  });
});
