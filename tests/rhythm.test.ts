import { describe, expect, it } from 'vitest';
import { GAMEPLAY } from '../src/config/gameplay';
import { ENEMIES } from '../src/data/enemies';
import { rhythmFromMovers, rhythmState, type RhythmMover } from '../src/entities/enemies/LurkerMotor';
import { WindCycle } from '../src/entities/hazards/WindCycle';
import { MoverMotor, moverTiming, type MoverSpec } from '../src/entities/MoverMotor';

const T = 16;
const BIG = GAMEPLAY.bigJakare;

describe('jakare guasu: ritmo (S24)', () => {
  it('burbujas antes de salir, afuera exposedMs, abajo el resto; una vez por período', () => {
    const at = (t: number) => rhythmState(t, 6000, 1500, 1000, 1000);
    expect([at(400), at(600), at(1499), at(1500), at(2499), at(2500), at(5999)]).toEqual(['cooldown', 'warn', 'warn', 'exposed', 'exposed', 'cooldown', 'cooldown']);
    expect([at(6600), at(7500), at(8600)]).toEqual(['warn', 'exposed', 'cooldown']);
  });

  it('no se desfasa: sale del reloj, no de un estado que avanza (después de mil vueltas, igual)', () => {
    const P = 6160;
    for (const t of [1280, 1280 + P * 1000, 1280 + P * 1000 + 999]) expect(rhythmState(t, P, 1280, 1000, 1000)).toBe('exposed');
    expect(rhythmState(1280 + P * 1000 + 1000, P, 1280, 1000, 1000)).toBe('cooldown');
  });

  it('el ciclo de una plataforma coincide con lo que hace su motor', () => {
    const spec: MoverSpec = { dx: 64, dy: 0, speed: 50, waitMs: 1800 };
    const t = moverTiming(spec);
    expect([t.periodMs, t.atEndMs, t.atOriginMs]).toEqual([6160, 1280, 4360]);
    const m = new MoverMotor(spec);
    const posAt = (ms: number) => {
      const mm = new MoverMotor(spec);
      for (let left = ms; left > 0; left -= 16) mm.step(Math.min(16, left));
      return mm.pos;
    };
    expect(m.pos).toBe(0);
    // En la otra punta desde atEndMs hasta atEndMs + waitMs; de vuelta en el origen desde atOriginMs.
    expect([posAt(t.atEndMs - 100) < 64, posAt(t.atEndMs + 10), posAt(t.atEndMs + 1700)]).toEqual([true, 64, 64]);
    expect([posAt(t.atOriginMs + 10), posAt(t.periodMs - 10), posAt(t.periodMs + t.atEndMs + 10)]).toEqual([0, 0, 64]);
  });

  it('se sincroniza con la punta de plataforma más cercana; sin una a 2 tiles, no', () => {
    const spec: MoverSpec = { dx: 64, dy: 0, speed: 50, waitMs: 1800 };
    const left: RhythmMover = { x: 0, y: 528, width: 48, spec };
    const right: RhythmMover = { x: 200, y: 528, width: 48, spec: { ...spec, dx: -64 } };
    // Junto al extremo de la de la izquierda (x 64-112): sale cuando llega ahí.
    expect(rhythmFromMovers(120, 528, [left, right], 32)).toEqual({ periodMs: 6160, exposedAtMs: 1280 });
    // Junto al origen de la de la derecha (x 200-248): sale cuando vuelve a él.
    expect(rhythmFromMovers(255, 528, [left, right], 32)).toEqual({ periodMs: 6160, exposedAtMs: 4360 });
    expect(rhythmFromMovers(400, 528, [left, right], 32)).toBeUndefined();
    expect(rhythmFromMovers(120, 528, [{ ...left, spec: { ...spec, mode: 'run' } }], 32)).toBeUndefined();
  });
});

type Obj = { type: string; x: number; y: number; width: number; height: number; properties?: { name: string; value: unknown }[] };
type TiledMap = { layers: { type: string; objects?: Obj[] }[] };
const MAPS = import.meta.glob('../public/assets/maps/*.json', { eager: true, import: 'default' }) as Record<string, TiledMap>;

describe('l2: la zona de ritmo (S24)', () => {
  const objs = (MAPS['../public/assets/maps/l2.json'].layers.find((l) => l.type === 'objectgroup')?.objects ?? []).map((o) => ({
    ...o,
    props: Object.fromEntries((o.properties ?? []).map((q) => [q.name, q.value])) as Record<string, unknown>,
  }));
  const movers: RhythmMover[] = objs
    .filter((o) => o.type === 'Mover')
    .map((o) => ({
      x: o.x,
      y: o.y,
      width: o.width,
      spec: { dx: Number(o.props.dx ?? 0) * T, dy: Number(o.props.dy ?? 0) * T, speed: Number(o.props.speed), waitMs: Number(o.props.waitMs), mode: (o.props.mode as MoverSpec['mode']) ?? 'loop' },
    }));
  const crocs = objs.filter((o) => o.type === 'Enemy' && o.props.kind === 'jakare_guasu');
  const def = ENEMIES.jakare_guasu;
  const halfW = (def.width * (def.scale ?? 1)) / 2;
  /** Dónde está la plataforma (px de su borde izquierdo) a los `ms` de juego. */
  const xAt = (m: RhythmMover, ms: number) => {
    const mm = new MoverMotor(m.spec);
    for (let left = ms; left > 0; left -= 16) mm.step(Math.min(16, left));
    return m.x + mm.offsetX;
  };

  it('cuatro jakare guasu, más grandes que el común y cada uno sincronizado con una balsa', () => {
    expect(crocs.length).toBe(4);
    expect([def.scale, def.hp > ENEMIES.jakare.hp, BIG.emergeHeight > (ENEMIES.jakare.emergeHeight ?? 0)]).toEqual([BIG.scale, true, true]);
    expect(def.scale).toBeGreaterThan(1);
    for (const c of crocs) expect(rhythmFromMovers(c.x, c.y, movers, 2 * T)).toBeDefined();
  });

  it('cada uno sale cuando se juntan dos balsas (2 tiles de hueco), muerde el hueco y la primera baldosa de la de llegada, nunca la de salida, y se hunde antes de que se separen', () => {
    for (const c of crocs) {
      const r = rhythmFromMovers(c.x, c.y, movers, 2 * T)!;
      // Al salir y justo antes de hundirse: las dos balsas del encuentro, a cada lado del hueco.
      const meeting: RhythmMover[] = [];
      for (const t of [r.exposedAtMs + 50, r.exposedAtMs + BIG.exposedMs - 50]) {
        const pos = movers.filter((m) => m.y === c.y).map((m) => ({ m, left: xAt(m, t), right: xAt(m, t) + m.width }));
        const from = pos.filter((p) => p.right <= c.x).sort((a, b) => b.right - a.right)[0];
        const to = pos.filter((p) => p.left >= c.x).sort((a, b) => a.left - b.left)[0];
        expect([c.x / T, (to.left - from.right) / T]).toEqual([c.x / T, 2]);
        // La caja del jakare: desde 1 px pasando la balsa de salida hasta adentro de la primera baldosa de la de llegada.
        expect(c.x - halfW - from.right).toBeGreaterThanOrEqual(1);
        expect(c.x + halfW - to.left).toBeGreaterThan(T / 2);
        expect(c.x + halfW - to.left).toBeLessThan(T);
        meeting.push(from.m, to.m);
      }
      // Con el jakare abajo, las dos balsas siguen juntas un rato: la ventana para saltar.
      expect(Math.min(...meeting.map((m) => m.spec.waitMs)) - BIG.exposedMs).toBeGreaterThanOrEqual(700);
    }
  });

  it('todas las balsas de la zona tienen el mismo ciclo (si no, los encuentros se desfasan)', () => {
    const zone = movers.filter((m) => m.x >= 319 * T && m.x <= 371 * T);
    expect(zone.length).toBe(6);
    expect(new Set(zone.map((m) => moverTiming(m.spec).periodMs)).size).toBe(1);
  });
});

describe('l3: la zona de ritmo con viento (S25)', () => {
  const objs = (MAPS['../public/assets/maps/l3.json'].layers.find((l) => l.type === 'objectgroup')?.objects ?? []).map((o) => ({
    ...o,
    props: Object.fromEntries((o.properties ?? []).map((q) => [q.name, q.value])) as Record<string, unknown>,
  }));
  const movers = objs
    .filter((o) => o.type === 'Mover')
    .map((o) => ({ x: o.x, y: o.y, width: o.width, spec: { dx: Number(o.props.dx ?? 0) * T, dy: Number(o.props.dy ?? 0) * T, speed: Number(o.props.speed), waitMs: Number(o.props.waitMs) } as MoverSpec }));
  const winds = objs.filter((o) => o.type === 'WindZone');
  const zone = movers.filter((m) => m.y === 33 * T && m.x >= 362 * T);
  const gusts = winds.filter((w) => w.y === 27 * T);
  const WIND = GAMEPLAY.wind;
  const windPeriod = WIND.calmMs + WIND.warnMs + WIND.gustMs;

  it('19 plataformas (3 verticales); las ocho balsas de la zona y la cadena de seis con el mismo ciclo que el viento', () => {
    expect(movers.length).toBe(19);
    expect(movers.filter((m) => m.spec.dy !== 0).length).toBe(3);
    expect(zone.length).toBe(8);
    const chain = movers.filter((m) => m.x >= 281 * T && m.x <= 329 * T);
    expect(chain.length).toBe(6);
    for (const m of [...zone, ...chain]) expect(moverTiming(m.spec).periodMs).toBe(windPeriod);
  });

  it('en cada encuentro (3 tiles de hueco) sopla en contra mientras llegan y amaina con las balsas juntas al menos 0,7 s; sin desfase en 20 vueltas', () => {
    expect(gusts.length).toBe(6);
    const motors = zone.map((m) => ({ m, mm: new MoverMotor(m.spec) }));
    const cycles = gusts.map((w) => new WindCycle(WIND, Number(w.props.offsetMs ?? 0)));
    const meetings = gusts.map(() => [] as { startPhase: string; calmMs: number }[]);
    const open = gusts.map(() => null as null | { startPhase: string; calmMs: number });
    const step = 10;
    for (let t = 0; t < windPeriod * 20; t += step) {
      for (const { mm } of motors) mm.step(step);
      for (const c of cycles) c.step(step);
      gusts.forEach((w, i) => {
        const pos = motors.map(({ m, mm }) => ({ left: m.x + mm.offsetX, right: m.x + mm.offsetX + m.width }));
        const from = pos.filter((p) => p.right <= w.x + 1).sort((a, b) => b.right - a.right)[0];
        const to = pos.filter((p) => p.left >= w.x + w.width - 1).sort((a, b) => a.left - b.left)[0];
        const together = to.left - from.right <= 3 * T + 0.5;
        if (together && !open[i]) open[i] = { startPhase: cycles[i].phase, calmMs: 0 };
        if (together && cycles[i].phase === 'calm') open[i]!.calmMs += step;
        if (!together && open[i]) {
          meetings[i].push(open[i]!);
          open[i] = null;
        }
      });
    }
    gusts.forEach((w, i) => {
      // La primera vuelta el viento arranca en calma larga (offsetMs): se cuentan desde la segunda.
      const later = meetings[i].slice(1);
      expect([w.x / T, later.length >= 18]).toEqual([w.x / T, true]);
      for (const m of later) expect([w.x / T, m.startPhase, m.calmMs >= 700]).toEqual([w.x / T, 'gust', true]);
    });
  });
});
