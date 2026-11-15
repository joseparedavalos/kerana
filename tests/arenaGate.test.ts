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

  // S92: Yvága sube. La arena (filas 0-23) está arriba y Kerana empieza 250 filas más abajo, en las mismas columnas.
  it('no se cierra con Kerana por debajo de la arena, aunque esté en sus columnas', () => {
    const arena = { left: 64, right: 704, top: 0, bottom: 384 };
    const g = new ArenaGate(arena, MARGIN);
    // En la base (fila 277) y subiendo, justo debajo del piso de la arena (pies en la fila 29).
    expect(g.shouldLock({ left: 336, right: 352, top: 4390, bottom: 4432 })).toBe(false);
    expect(g.shouldLock({ left: 336, right: 352, top: 422, bottom: 464 })).toBe(false);
    // En la antesala (x 1-3), tampoco; adentro, parada en el piso de la arena, sí.
    expect(g.shouldLock({ left: 32, right: 48, top: 326, bottom: 368 })).toBe(false);
    expect(g.shouldLock({ left: 110, right: 126, top: 326, bottom: 368 })).toBe(true);
  });

  it('tras caer contra Tau, estar por debajo de la arena también cuenta como haber salido', () => {
    const arena = { left: 64, right: 704, top: 0, bottom: 384 };
    const g = new ArenaGate(arena, MARGIN);
    const within = { left: 110, right: 126, top: 326, bottom: 368 };
    g.lock();
    g.unlock();
    expect(g.shouldLock(within)).toBe(false);
    expect(g.shouldLock({ left: 336, right: 352, top: 422, bottom: 464 })).toBe(false);
    expect(g.shouldLock(within)).toBe(true);
  });

  it('sin alto (los rectángulos de siempre) se cierra como antes', () => {
    const g = new ArenaGate(ARENA, MARGIN);
    expect(g.shouldLock({ ...inside, top: 5000, bottom: 5042 })).toBe(true);
  });
});
