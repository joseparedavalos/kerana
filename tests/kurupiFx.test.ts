import { describe, expect, it } from 'vitest';
import { GAMEPLAY } from '../src/config/gameplay';
import { debrisFrames, FAST_RUNS, isFastRun, KickMeter, kickHasLeaf } from '../src/entities/bosses/kurupiFxLogic';
import { colorAt, alphaAt } from '../src/systems/pixelArt';

const CFG = GAMEPLAY.kurupiTrail;

describe('Kurupi: cuándo deja estela (S104)', () => {
  it('solo en el active de la embestida y de la carrera al revés', () => {
    expect(isFastRun('active', 'charge')).toBe(true);
    expect(isFastRun('active', 'reverse_run')).toBe(true);
    for (const state of ['idle', 'telegraph', 'recover', 'waiting', 'defeated']) {
      expect(isFastRun(state, 'charge')).toBe(false);
      expect(isFastRun(state, 'reverse_run')).toBe(false);
    }
    for (const id of ['call', 'stomp', 'decoy']) expect(isFastRun('active', id)).toBe(false);
    expect(isFastRun('active', undefined)).toBe(false);
    expect(FAST_RUNS).toEqual(['charge', 'reverse_run']);
  });

  it('la pila alcanza: ninguna silueta viva se reusa antes de apagarse', () => {
    expect(Math.ceil(CFG.fadeMs / CFG.everyMs)).toBeLessThanOrEqual(CFG.maxGhosts);
  });

  it('su color no es el celeste del dash: el musgo arriba y el pelaje abajo', () => {
    expect(CFG.tint).not.toContain(GAMEPLAY.dashFx.tint);
    expect(CFG.tint).toEqual([0x8c7c1d, 0x7c4a24]);
  });
});

describe('Kurupi: las patadas de tierra y hojas (S104)', () => {
  const cfg = { everyPx: 16, minSpeed: 140, maxPerFrame: 2 };
  const dt = 1000 / 60;

  it('despacio no levanta nada', () => {
    const k = new KickMeter(cfg);
    // 2 px por cuadro a 60 FPS = 120 px/s.
    for (let i = 0; i < 60; i++) expect(k.step(2, dt)).toBe(0);
    expect(k.count).toBe(0);
  });

  it('rápido, una patada cada everyPx, hacia cualquier lado', () => {
    const k = new KickMeter(cfg);
    let total = 0;
    // 8 px por cuadro = 480 px/s; 160 px en 20 cuadros.
    for (let i = 0; i < 20; i++) total += k.step(-8, dt);
    expect(total).toBe(10);
    expect(k.count).toBe(10);
  });

  it('por distancia: sale lo mismo a 30 que a 60 FPS', () => {
    const a = new KickMeter(cfg);
    const b = new KickMeter(cfg);
    let na = 0;
    let nb = 0;
    for (let i = 0; i < 60; i++) na += a.step(8, 1000 / 60);
    for (let i = 0; i < 30; i++) nb += b.step(16, 1000 / 30);
    expect(na).toBe(nb);
  });

  it('un cuadro muy largo no larga una ráfaga ni guarda patadas', () => {
    const k = new KickMeter(cfg);
    expect(k.step(200, 100)).toBe(cfg.maxPerFrame);
    // Queda a lo sumo el resto de una patada: el cuadro siguiente no suelta las que no salieron.
    expect(k.step(8, dt)).toBeLessThanOrEqual(1);
  });

  it('reset vuelve a cero', () => {
    const k = new KickMeter(cfg);
    k.step(40, 50);
    k.reset();
    expect(k.count).toBe(0);
    expect(k.step(8, dt)).toBe(0);
  });

  it('una hoja cada leafEvery patadas', () => {
    const leaves = [1, 2, 3, 4, 5, 6].filter((i) => kickHasLeaf(i, 2));
    expect(leaves).toEqual([2, 4, 6]);
    expect(kickHasLeaf(3, 0)).toBe(false);
  });
});

describe('Kurupi: el dibujo de las hojas y los terrones (S104)', () => {
  const frames = debrisFrames();

  it('cuadros con nombre único y algo pintado', () => {
    const names = frames.map((f) => f.name);
    expect(new Set(names).size).toBe(names.length);
    expect(names.filter((n) => n.startsWith('leaf_')).length).toBe(8);
    expect(names.filter((n) => n.startsWith('clod_')).length).toBe(3);
    for (const f of frames) {
      let painted = 0;
      for (let y = 0; y < f.px.height; y++) for (let x = 0; x < f.px.width; x++) if (alphaAt(f.px, x, y) > 0) painted++;
      expect(painted, f.name).toBeGreaterThan(2);
    }
  });

  it('chicos: a detail 2, ninguna hoja pasa de 4 unidades ni un terrón de 2', () => {
    for (const f of frames) {
      const units = Math.max(f.px.width, f.px.height) / CFG.detail;
      expect(units, f.name).toBeLessThanOrEqual(f.name.startsWith('leaf_') ? 4 : 2);
    }
  });

  it('en grises: el color lo pone el tinte de la arena', () => {
    for (const f of frames) {
      for (let y = 0; y < f.px.height; y++) {
        for (let x = 0; x < f.px.width; x++) {
          if (alphaAt(f.px, x, y) === 0) continue;
          const c = colorAt(f.px, x, y);
          const r = (c >> 16) & 255;
          expect((c >> 8) & 255).toBe(r);
          expect(c & 255).toBe(r);
        }
      }
    }
  });
});
