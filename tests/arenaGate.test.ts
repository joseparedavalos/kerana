import { describe, expect, it } from 'vitest';
import { ArenaGate } from '../src/systems/ArenaGate';

const ARENA = { left: 1000, right: 1640 };
const MARGIN = 32;
const inside = { left: 1100, right: 1116 };
const antesala = { left: 900, right: 916 };

describe('ArenaGate (cierre de la arena del jefe)', () => {
  it('se cierra cuando Kerana entra bien adentro', () => {
    const g = new ArenaGate(ARENA, MARGIN);
    expect(g.shouldLock(antesala)).toBe(false);
    expect(g.shouldLock({ left: 1010, right: 1026 })).toBe(false);
    expect(g.shouldLock(inside)).toBe(true);
  });

  it('tras caer, el rectángulo viejo del mismo frame no la vuelve a cerrar', () => {
    const g = new ArenaGate(ARENA, MARGIN);
    g.lock();
    g.unlock(); // koRespawn → resetBossFight
    expect(g.shouldLock(inside)).toBe(false); // mismo frame, rect viejo
    expect(g.shouldLock(antesala)).toBe(false); // Kerana ya en la antesala
    expect(g.shouldLock(inside)).toBe(true); // vuelve a entrar
  });

  it('cerrada no pide cerrarse otra vez', () => {
    const g = new ArenaGate(ARENA, MARGIN);
    g.lock();
    expect(g.shouldLock(inside)).toBe(false);
  });
});
