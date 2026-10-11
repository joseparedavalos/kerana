import { describe, expect, it } from 'vitest';
import { GAMEPLAY } from '../src/config/gameplay';
import { ChaseMotor, type ChaseSpec } from '../src/systems/chaseLogic';
import { refugeUnder, type Refuge } from '../src/entities/bosses/aoAoLogic';

const DT = 1000 / 60;
const C = GAMEPLAY.chase;
const spec = (over: Partial<ChaseSpec> = {}): ChaseSpec => ({
  startX: 1000,
  endX: 3000,
  speed: C.speed,
  viewWidth: 640,
  aheadFrac: C.aheadFrac,
  warnPx: C.warnPx,
  catchPx: C.catchPx,
  restartLeadPx: C.restartLeadPx,
  maxEdgeX: 4000,
  ...over,
});
const HALF = 8;

/** Corre `ms` con Kerana a `vx` px/s desde `x` (centro). Devuelve el primer evento distinto de null y dónde quedó. */
function run(m: ChaseMotor, x: number, vx: number, ms: number, refugeX: number | null = null) {
  const events: string[] = [];
  for (let t = 0; t < ms; t += DT) {
    x += (vx * DT) / 1000;
    const e = m.step(DT, 700, x - HALF, x, refugeX);
    if (e) events.push(e);
    if (e === 'caught' || e === 'ended') break;
  }
  return { x, events };
}

describe('persecución de Ao Ao: el borde que avanza (S31)', () => {
  it('larga al cruzar la línea, con el borde donde estaba la cámara (no salta)', () => {
    const m = new ChaseMotor(spec());
    expect(m.step(DT, 700, 980, 990, null)).toBeNull();
    expect(m.phase).toBe('idle');
    expect(m.step(DT, 700, 992, 1000, null)).toBe('started');
    expect(m.phase).toBe('running');
    expect(m.edgeX).toBe(700);
  });

  it('el borde avanza a la velocidad configurada', () => {
    const m = new ChaseMotor(spec());
    m.step(DT, 700, 992, 1000, null);
    run(m, 1000, 0, 1000);
    expect(m.edgeX).toBeCloseTo(700 + C.speed, -1);
  });

  it('quieta, primero avisa y recién después la alcanza: el aviso dura lo que tarda el borde en cruzar la franja', () => {
    const m = new ChaseMotor(spec());
    m.step(DT, 700, 992, 1000, null);
    let warnAt = -1;
    let caughtAt = -1;
    const x = 1100;
    for (let t = 0; t < 20000 && caughtAt < 0; t += DT) {
      const e = m.step(DT, 700, x - HALF, x, null);
      if (m.warn && warnAt < 0) warnAt = t;
      if (e === 'caught') caughtAt = t;
    }
    expect(warnAt).toBeGreaterThan(0);
    const warnMs = caughtAt - warnAt;
    expect(warnMs).toBeCloseTo((C.warnPx - C.catchPx) / C.speed * 1000, -2);
    // Más de un segundo de aviso, siempre.
    expect(warnMs).toBeGreaterThan(1000);
  });

  it('corriendo a la par del borde (o más rápido) no la alcanza nunca', () => {
    const m = new ChaseMotor(spec());
    m.step(DT, 700, 992, 1000, null);
    const r = run(m, 1000, C.speed, 40000);
    expect(r.events).toEqual(['ended']);
  });

  it('si se adelanta, el borde la sigue: nunca ve menos de (1 − aheadFrac) de la vista por delante', () => {
    const m = new ChaseMotor(spec());
    m.step(DT, 700, 992, 1000, null);
    const r = run(m, 1000, GAMEPLAY.player.runSpeed, 5000);
    const ahead = m.edgeX + 640 - r.x;
    expect(ahead).toBeGreaterThanOrEqual(640 * (1 - C.aheadFrac) - 1);
    expect(r.events).toEqual([]);
  });

  it('en un pindó el borde se detiene y no la alcanza; al bajarse sigue', () => {
    const m = new ChaseMotor(spec());
    m.step(DT, 700, 992, 1000, null);
    run(m, 1500, 0, 500);
    const edge = m.edgeX;
    const r = run(m, 1500, 0, 30000, 1500);
    expect(r.events).toEqual([]);
    expect(m.phase).toBe('refuge');
    expect(m.edgeX).toBe(edge);
    expect(m.lastRefugeX).toBe(1500);
    run(m, 1500, 0, 1000);
    expect(m.phase).toBe('running');
    expect(m.edgeX).toBeGreaterThan(edge);
  });

  it('alcanzada después de un pindó: vuelve a él, con el borde restartLeadPx detrás, en refugio', () => {
    const m = new ChaseMotor(spec());
    m.step(DT, 700, 992, 1000, null);
    run(m, 1500, 0, 200, 1500);
    const r = run(m, 1700, 0, 20000);
    expect(r.events).toEqual(['caught']);
    expect(m.restart()).toBe(1500);
    expect(m.phase).toBe('refuge');
    expect(m.edgeX).toBe(1500 - C.restartLeadPx);
  });

  it('alcanzada antes del primer pindó: la persecución se reinicia entera (vuelve a largar al cruzar la línea)', () => {
    const m = new ChaseMotor(spec());
    m.step(DT, 700, 992, 1000, null);
    expect(run(m, 1100, 0, 20000).events).toEqual(['caught']);
    expect(m.restart()).toBeNull();
    expect(m.phase).toBe('idle');
    expect(m.step(DT, 600, 960, 968, null)).toBeNull();
    expect(m.step(DT, 600, 1000, 1008, null)).toBe('started');
  });

  it('termina al cruzar la llegada y no vuelve a largar; reset (0 corazones) solo la reinicia si no terminó', () => {
    const m = new ChaseMotor(spec());
    m.step(DT, 700, 992, 1000, null);
    expect(m.step(DT, 700, 2992, 3000, null)).toBe('ended');
    expect(m.phase).toBe('done');
    m.reset();
    expect(m.phase).toBe('done');
    expect(m.step(DT, 700, 1092, 1100, null)).toBeNull();
    const n = new ChaseMotor(spec());
    n.step(DT, 700, 992, 1000, null);
    n.reset();
    expect(n.phase).toBe('idle');
    expect(n.active).toBe(false);
  });

  it('el borde no pasa del final del mapa', () => {
    const m = new ChaseMotor(spec({ maxEdgeX: 900 }));
    m.step(DT, 700, 992, 1000, null);
    run(m, 1400, C.speed, 10000);
    expect(m.edgeX).toBeLessThanOrEqual(900);
  });
});

describe('refugeUnder: en qué pindó está parada (S31)', () => {
  const refuges: Refuge[] = [
    { left: 100, right: 148, top: 200 },
    { left: 400, right: 448, top: 160 },
  ];
  it('devuelve la copa que pisa, con los pies a la altura y en el suelo', () => {
    expect(refugeUnder(420, 160, true, refuges, 3)).toBe(refuges[1]);
    expect(refugeUnder(420, 160, false, refuges, 3)).toBeNull();
    expect(refugeUnder(420, 170, true, refuges, 3)).toBeNull();
    expect(refugeUnder(300, 160, true, refuges, 3)).toBeNull();
  });
});
