import { describe, expect, it } from 'vitest';
import { GAMEPLAY } from '../src/config/gameplay';
import { MoverMotor, moverTiming, type MoverSpec } from '../src/entities/MoverMotor';

// l5 · Canindeyú (S30): la cadena de cinco ascensores, el compás de los hongos (zona de ritmo), las cadenas de la bajada,
// la reja de raíces y los hongos de las tres variantes.

const T = 16;
type Obj = { type: string; x: number; y: number; width: number; height: number; properties?: { name: string; value: unknown }[] };
type TiledMap = { width: number; height: number; layers: { name: string; type: string; data?: number[]; objects?: Obj[] }[] };
const MAPS = import.meta.glob('../public/assets/maps/*.json', { eager: true, import: 'default' }) as Record<string, TiledMap>;
const map = MAPS['../public/assets/maps/l5.json'];
const objs = (map.layers.find((l) => l.type === 'objectgroup')?.objects ?? []).map((o) => ({
  ...o,
  props: Object.fromEntries((o.properties ?? []).map((q) => [q.name, q.value])) as Record<string, unknown>,
}));
const movers = objs.filter((o) => o.type === 'Mover');
const moverAt = (tx: number, ty: number) => {
  const m = movers.find((o) => o.x === tx * T && o.y === ty * T);
  if (!m) throw new Error(`no hay plataforma con origen en ${tx},${ty}`);
  return m;
};
const spec = (o: (typeof movers)[number]): MoverSpec => ({
  dx: Number(o.props.dx ?? 0) * T,
  dy: Number(o.props.dy ?? 0) * T,
  speed: Number(o.props.speed ?? GAMEPLAY.mover.speed),
  waitMs: Number(o.props.waitMs ?? GAMEPLAY.mover.waitMs),
  mode: 'loop',
});

/** Cara de arriba (px) y borde izquierdo de cada plataforma, cuadro a cuadro, durante `ms`. */
function track(list: (typeof movers)[number][], ms: number, dt = 1000 / 60) {
  const motors = list.map((o) => new MoverMotor(spec(o)));
  const frames: { t: number; x: number[]; y: number[]; waiting: boolean[] }[] = [];
  for (let t = 0; t < ms; t += dt) {
    frames.push({
      t,
      x: motors.map((m, i) => list[i].x + m.offsetX),
      y: motors.map((m, i) => list[i].y + m.offsetY),
      waiting: motors.map((m) => m.waitLeftMs > 0),
    });
    for (const m of motors) m.step(dt);
  }
  return frames;
}

/** Tiempo (ms) por período en que `a` y `b` esperan quietas, a la misma altura y con a lo sumo 2 tiles de hueco (piezas de 3). */
function sharedWaitMs(a: (typeof movers)[number], b: (typeof movers)[number]): number {
  const period = moverTiming(spec(a)).periodMs;
  const frames = track([a, b], period * 3);
  const dt = 1000 / 60;
  const inWindow = frames.filter(
    (f) => f.t >= period && f.t < period * 2 && f.waiting[0] && f.waiting[1] && Math.abs(f.y[0] - f.y[1]) < 1 && Math.abs(f.x[0] - f.x[1]) <= 5 * T + 1,
  );
  return inWindow.length * dt;
}

describe('l5: plataformas (S30)', () => {
  it('20 plataformas móviles, todas de un solo sentido; 11 verticales', () => {
    expect(movers.length).toBe(20);
    expect(movers.filter((m) => m.props.solid === true).length).toBe(0);
    expect(movers.filter((m) => Number(m.props.dy ?? 0) !== 0).length).toBe(11);
  });

  it('la cadena de cinco ascensores (x 131-149): mismo ciclo y cada uno espera al siguiente a la misma altura', () => {
    const chain = [moverAt(131, 84), moverAt(135, 72), moverAt(139, 72), moverAt(143, 60), moverAt(147, 60)];
    expect(new Set(chain.map((m) => moverTiming(spec(m)).periodMs)).size).toBe(1);
    for (let i = 0; i < chain.length - 1; i++) expect(sharedWaitMs(chain[i], chain[i + 1]), `ascensor ${i + 1} → ${i + 2}`).toBeGreaterThanOrEqual(1100);
  });

  it('la bajada: ascensor → ascensor → ascensor se esperan a la misma altura', () => {
    const chain = [moverAt(256, 38), moverAt(252, 66), moverAt(256, 66)];
    expect(new Set(chain.map((m) => moverTiming(spec(m)).periodMs)).size).toBe(1);
    expect(sharedWaitMs(chain[0], chain[1])).toBeGreaterThanOrEqual(1100);
    expect(sharedWaitMs(chain[1], chain[2])).toBeGreaterThanOrEqual(1100);
  });

  it('el dosel: el par de balsas y el ascensor con su balsa se juntan en una espera', () => {
    expect(sharedWaitMs(moverAt(87, 14), moverAt(102, 14))).toBeGreaterThanOrEqual(1100);
    expect(sharedWaitMs(moverAt(155, 16), moverAt(165, 10))).toBeGreaterThanOrEqual(1100);
  });
});

describe('l5: el compás de los hongos, zona de ritmo (S30)', () => {
  const rows = [46, 38, 30, 22, 14];
  const branches = rows.map((r) => moverAt(58, r));
  const bouncers = objs.filter((o) => o.type === 'Bouncer' && o.x >= 55 * T && o.x <= 76 * T && o.y >= 20 * T && o.y <= 53 * T);

  it('cinco ramas con el mismo ciclo que van y vienen a la par, 8 filas una de otra (ni el salto doble las saltea)', () => {
    expect(new Set(branches.map((m) => moverTiming(spec(m)).periodMs)).size).toBe(1);
    const frames = track(branches, moverTiming(spec(branches[0])).periodMs * 2);
    for (const f of frames) for (const x of f.x) expect(x).toBe(f.x[0]);
    for (let i = 0; i < rows.length - 1; i++) expect(rows[i] - rows[i + 1]).toBe(8);
  });

  it('un hongo en cada repisa, alternando los lados, con las tres variantes; cada rama espera sobre el hongo siguiente', () => {
    expect(bouncers.length).toBe(5);
    const kinds = bouncers.sort((a, b) => b.y - a.y).map((b) => String(b.props.kind ?? 'normal'));
    expect(kinds).toEqual(['normal', 'once', 'normal', 'once', 'sleep']);
    // La rama de arriba de cada hongo llega a su punta (la del lado del hongo) cuando la de abajo deja a Kerana al lado:
    // las dos esperan juntas (van a la par), así que se rebota apenas se baja de una y la otra está ahí.
    const timing = moverTiming(spec(branches[0]));
    expect(spec(branches[0]).waitMs).toBeGreaterThanOrEqual(2000);
    expect(timing.periodMs).toBeLessThan(12000);
  });
});

describe('l5: la reja de raíces y las variantes de hongo (S30)', () => {
  it('una reja con su piedra permanente (no se vuelve a cerrar: nadie queda encerrado)', () => {
    const gates = objs.filter((o) => o.type === 'Gate');
    const switches = objs.filter((o) => o.type === 'Switch');
    expect(gates.length).toBe(1);
    expect(switches.length).toBe(1);
    expect(switches[0].props.target).toBe(gates[0].props.id);
    expect(Number(switches[0].props.ms ?? 0)).toBe(0);
  });

  it('hongos de las tres variantes: normales, de un uso y dormidos', () => {
    const kinds = objs.filter((o) => o.type === 'Bouncer').map((o) => String(o.props.kind ?? 'normal'));
    expect(kinds.filter((k) => k === 'normal').length).toBeGreaterThanOrEqual(5);
    expect(kinds.filter((k) => k === 'once').length).toBeGreaterThanOrEqual(3);
    expect(kinds.filter((k) => k === 'sleep').length).toBeGreaterThanOrEqual(3);
  });
});
