import { describe, expect, it } from 'vitest';
import { GAMEPLAY } from '../src/config/gameplay';
import { MoverMotor, moverTiming, type MoverSpec } from '../src/entities/MoverMotor';
import { risePx } from '../src/systems/trapLogic';

// l6 · Guairá (S31): las dos escaleras de lajas, las cadenas, el pozo de la piedra, los hongos de las tres variantes,
// la persecución de Ao Ao y la gruta tras la cascada. Alcances medidos en el juego (receta §0, S24/S28/S30): salto 3 filas
// contra una pared y 4 a una plataforma de un solo sentido; salto doble 6 y 7; hongo 8,5; hongo de un uso 6,7.

const T = 16;
type Obj = { type: string; x: number; y: number; width: number; height: number; properties?: { name: string; value: unknown }[] };
type TiledMap = { width: number; height: number; layers: { name: string; type: string; data?: number[]; objects?: Obj[] }[] };
const MAPS = import.meta.glob('../public/assets/maps/*.json', { eager: true, import: 'default' }) as Record<string, TiledMap>;
const map = MAPS['../public/assets/maps/l6.json'];
const objs = (map.layers.find((l) => l.type === 'objectgroup')?.objects ?? []).map((o) => ({
  ...o,
  props: Object.fromEntries((o.properties ?? []).map((q) => [q.name, q.value])) as Record<string, unknown>,
}));
const layer = (name: string) => {
  const data = map.layers.find((l) => l.name === name)?.data ?? [];
  return (x: number, y: number) => (data[y * map.width + x] ?? 0) > 0;
};
const ground = layer('Ground');
const platforms = layer('Platforms');
const hazards = layer('Hazards');
const of = (type: string) => objs.filter((o) => o.type === type);
const movers = of('Mover');
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

/**
 * Tiempo (ms) por período en que `a` y `b` esperan quietas a la vez, con a lo sumo `gapTiles` de hueco entre una punta y
 * la otra y `b` exactamente `riseRows` filas más arriba (0: a la misma altura).
 */
function meetMs(a: (typeof movers)[number], b: (typeof movers)[number], riseRows = 0, gapTiles = 2): number {
  const period = moverTiming(spec(a)).periodMs;
  const ma = new MoverMotor(spec(a));
  const mb = new MoverMotor(spec(b));
  const dt = 1000 / 60;
  let ms = 0;
  for (let t = 0; t < period * 2; t += dt) {
    if (t >= period) {
      const ax = a.x + ma.offsetX;
      const bx = b.x + mb.offsetX;
      const ay = a.y + ma.offsetY;
      const by = b.y + mb.offsetY;
      const gap = Math.max(bx - (ax + a.width), ax - (bx + b.width));
      if (ma.waitLeftMs > 0 && mb.waitLeftMs > 0 && Math.abs(ay - by - riseRows * T) < 1 && gap <= gapTiles * T + 1) ms += dt;
    }
    ma.step(dt);
    mb.step(dt);
  }
  return ms;
}

describe('l6: plataformas y cadenas (S31)', () => {
  it('24 plataformas móviles, todas de un solo sentido; 4 verticales', () => {
    expect(movers.length).toBe(24);
    expect(movers.filter((m) => m.props.solid === true).length).toBe(0);
    expect(movers.filter((m) => Number(m.props.dy ?? 0) !== 0).length).toBe(4);
  });

  it('la escalera de lajas (A2): cuatro lajas con el mismo ciclo; cada una espera a la siguiente 3 filas más arriba', () => {
    const chain = [moverAt(34, 57), moverAt(48, 54), moverAt(52, 51), moverAt(66, 48)];
    expect(new Set(chain.map((m) => moverTiming(spec(m)).periodMs)).size).toBe(1);
    for (let i = 0; i < chain.length - 1; i++) expect(meetMs(chain[i], chain[i + 1], 3, 1), `laja ${i + 1} → ${i + 2}`).toBeGreaterThanOrEqual(1100);
  });

  it('la segunda escalera (B1, hacia la izquierda): lajas 5 a 8 igual', () => {
    const chain = [moverAt(93, 35), moverAt(79, 32), moverAt(75, 29), moverAt(61, 26)];
    expect(new Set(chain.map((m) => moverTiming(spec(m)).periodMs)).size).toBe(1);
    for (let i = 0; i < chain.length - 1; i++) expect(meetMs(chain[i], chain[i + 1], 3, 1), `laja ${i + 5} → ${i + 6}`).toBeGreaterThanOrEqual(1100);
  });

  it('las cadenas de las cumbres y de la bajada se juntan en una espera de las dos', () => {
    // Par de balsas del filo; balsas A y B sobre la cascada; ascensor → balsa → balsa a la cumbre 3; par al fuego 2.
    expect(meetMs(moverAt(128, 17), moverAt(139, 17))).toBeGreaterThanOrEqual(1100);
    expect(meetMs(moverAt(157, 7), moverAt(180, 7))).toBeGreaterThanOrEqual(1100);
    expect(meetMs(moverAt(208, 9), moverAt(217, 14))).toBeGreaterThanOrEqual(1100);
    expect(meetMs(moverAt(217, 14), moverAt(221, 14))).toBeGreaterThanOrEqual(1100);
    expect(meetMs(moverAt(241, 14), moverAt(254, 14))).toBeGreaterThanOrEqual(1100);
    // La cadena de bajada: ascensor, balsa, ascensor, balsa (el mismo ciclo).
    const down = [moverAt(401, 30), moverAt(410, 35), moverAt(414, 35), moverAt(423, 40)];
    expect(new Set(down.map((m) => moverTiming(spec(m)).periodMs)).size).toBe(1);
    for (let i = 0; i < down.length - 1; i++) expect(meetMs(down[i], down[i + 1]), `bajada ${i + 1} → ${i + 2}`).toBeGreaterThanOrEqual(1100);
    // El último par, antes de la antesala.
    expect(meetMs(moverAt(432, 40), moverAt(442, 40))).toBeGreaterThanOrEqual(1100);
  });
});

describe('l6: el pozo de la piedra y los hongos (S31)', () => {
  const rows = (px: number) => px / T;
  const jump = rows(risePx([GAMEPLAY.player.jumpVelocity], GAMEPLAY.gravity, 60));
  const double = rows(risePx([GAMEPLAY.player.jumpVelocity, GAMEPLAY.player.doubleJumpVelocity], GAMEPLAY.gravity, 60));

  it('la reja del paso tiene su piedra permanente en la cámara del pozo, y roca encima (no se salta)', () => {
    const gates = of('Gate');
    const switches = of('Switch');
    expect(gates.length).toBe(1);
    expect(switches.length).toBe(1);
    expect(switches[0].props.target).toBe(gates[0].props.id);
    expect(switches[0].props.ms ?? 0).toBe(0);
    const gx = gates[0].x / T;
    const gy = gates[0].y / T;
    expect(ground(gx, gy - 1)).toBe(true);
    // La piedra está abajo (en la cámara, 10 filas bajo el paso).
    expect(switches[0].y / T - gy).toBeGreaterThanOrEqual(10);
  });

  it('del pozo se sale con el hongo y el salto doble: 10 filas, más que el rebote (8,5) y menos que rebote + doble (11,3)', () => {
    const cap = of('Bouncer').find((b) => b.x === 95 * T)!;
    expect(cap.props.kind ?? 'normal').toBe('normal');
    const rim = 45;
    const capTop = cap.y / T;
    expect(capTop - rim).toBeGreaterThan(8.5);
    expect(capTop - rim).toBeLessThan(11.3);
    expect(ground(96, rim)).toBe(true);
  });

  it('el hongo de un uso del patio: el puente a 8 filas del sombrero (un empujón no llega, con el salto doble sí) y a 9 del piso', () => {
    const cap = of('Bouncer').find((b) => b.props.kind === 'once')!;
    const capTop = cap.y / T;
    const bridge = 36;
    expect(platforms(cap.x / T, bridge)).toBe(true);
    expect(capTop - bridge).toBeGreaterThan(107 / T);
    expect(capTop - bridge).toBeLessThan((107 + 48) / T);
    // Desde el piso del patio, el salto doble llega a 7 filas de una plataforma de un solo sentido: el puente está a 9.
    expect(capTop + 1 - bridge).toBeGreaterThan(double + 1);
  });

  it('el hongo dormido de la cumbre 1 lanza a la balsa A, 8 filas arriba (el salto doble no llega a 8)', () => {
    const cap = of('Bouncer').find((b) => b.props.kind === 'sleep')!;
    const floor = cap.y / T + 1;
    const balsa = moverAt(157, 7);
    expect(floor - balsa.y / T).toBe(8);
    expect(double + 1).toBeLessThan(8);
    expect(cap.x).toBeGreaterThanOrEqual(balsa.x);
    expect(cap.x).toBeLessThan(balsa.x + balsa.width + Number(balsa.props.dx) * T);
  });

  it('a la cumbre 2 solo se llega en las balsas: desde el ascensor de la cascada, salto + doble + dash no alcanza', () => {
    // Lo más lejos que avanza Kerana (px) con los pies a `rise` px o más sobre donde saltó: carrera a toda velocidad, salto
    // doble en el ápice y dash en el ápice del segundo (vy = 0 mientras dura). Euler semi-implícito a 60 Hz, como Arcade.
    const reach = (rise: number) => {
      const p = GAMEPLAY.player;
      const dt = 1 / 60;
      let vy: number = p.jumpVelocity;
      let y = 0;
      let x = 0;
      let doubled = false;
      let dashMs = -1;
      let best = 0;
      for (let t = 0; t < 3; t += dt) {
        let vx: number = p.runSpeed;
        if (dashMs >= 0 && dashMs < GAMEPLAY.dash.durationMs) {
          vx = GAMEPLAY.dash.speed;
          vy = 0;
          dashMs += dt * 1000;
        } else {
          vy = Math.min(vy + GAMEPLAY.gravity * dt, p.maxFallSpeed);
        }
        if (!doubled && vy >= 0) {
          doubled = true;
          vy = p.doubleJumpVelocity;
        } else if (doubled && dashMs < 0 && vy >= 0) dashMs = 0;
        y += vy * dt;
        x += vx * dt;
        if (-y >= rise) best = x;
        if (-y < rise && x > best && vy > 0) break;
      }
      return best;
    };
    const elevator = moverAt(171, 26);
    const top = elevator.y / T + Number(elevator.props.dy);
    const summit = 187;
    expect(ground(summit, 9)).toBe(true);
    expect(ground(summit - 1, 9)).toBe(false);
    // De la punta de la plataforma (el cuerpo sobresale 7 px) al primer px de la cumbre (el cuerpo la pisa con 1 px).
    const gap = summit * T - 7 - ((elevator.x + elevator.width) + 7);
    expect(reach((top - 9) * T)).toBeLessThan(gap);
  });

  it('alcances que usa el diseño (con la física del juego, 60 Hz): salto 3 filas y salto doble 6 contra una pared', () => {
    expect(Math.floor(jump)).toBe(3);
    expect(Math.floor(double)).toBe(6);
  });
});

describe('l6: la persecución de Ao Ao (S31)', () => {
  const zones = of('ChaseZone');
  const zone = zones[0];
  const zx0 = zone.x / T;
  const zx1 = (zone.x + zone.width) / T;

  it('un solo tramo de 121 tiles entre el fuego 2 y el fuego 3, con la velocidad por defecto', () => {
    expect(zones.length).toBe(1);
    expect(zx1 - zx0).toBe(121);
    expect(zone.props.speed).toBeUndefined();
    const fires = of('Checkpoint').map((c) => c.x / T).sort((a, b) => a - b);
    expect(fires.filter((x) => x < zx0).length).toBe(2);
    expect(fires.filter((x) => x > zx1).length).toBe(2);
    // El fuego de antes queda a menos de 5 tiles de la largada: la vuelta tras 0 corazones no repite medio nivel.
    expect(zx0 - Math.max(...fires.filter((x) => x < zx0))).toBeLessThan(5);
  });

  it('dos pindó adentro, con la copa (un solo sentido) 3 filas sobre el piso: se sube con un salto', () => {
    const pindos = of('Pindo').filter((p) => p.x >= zone.x && p.x + p.width <= zone.x + zone.width);
    expect(pindos.length).toBe(2);
    for (const p of pindos) {
      const tx = p.x / T;
      const top = p.y / T;
      for (let x = tx; x < tx + 3; x++) expect(platforms(x, top), `copa x ${x}`).toBe(true);
      expect(ground(tx + 1, top + 3)).toBe(true);
    }
  });

  it('el aviso dura más de un segundo y quien corre a la mitad de la velocidad de Kerana no queda atrás', () => {
    const c = GAMEPLAY.chase;
    expect(((c.warnPx - c.catchPx) / c.speed) * 1000).toBeGreaterThan(1000);
    expect(c.speed).toBeLessThanOrEqual(GAMEPLAY.player.runSpeed / 2);
    // Siempre se ven por delante al menos 14 tiles (el camino se lee antes de llegar).
    expect((640 * (1 - c.aheadFrac)) / T).toBeGreaterThanOrEqual(14);
  });

  it('la ruta alta de la pluma C: cornisa con techo a 3 filas (no se salta adentro) y una espina antes de la pluma', () => {
    const feather = of('Pickup').find((p) => p.props.kind === 'pluma' && p.x > zone.x && p.x < zone.x + zone.width)!;
    const fx = Math.floor(feather.x / T);
    const fy = feather.y / T - 1;
    expect(platforms(fx, fy + 1)).toBe(true);
    expect(ground(fx, fy - 3)).toBe(true);
    expect(ground(fx, fy - 2)).toBe(false);
    let spikes = 0;
    for (let x = 306; x < fx; x++) if (hazards(x, fy)) spikes++;
    expect(spikes).toBe(1);
    // A la cornisa se llega desde la copa del pindó 1 (6 filas: salto doble), no desde la ruta baja (9 filas).
    expect(22 - 13).toBeGreaterThan(7);
    expect(19 - 13).toBeLessThanOrEqual(7);
  });
});

describe('l6: la gruta tras la cascada, lugar secreto (S31)', () => {
  it('la cascada cae del borde de la cumbre 1 delante de la cornisa; la pluma B está sobre una columna de fardo bajo el techo', () => {
    const falls = of('Waterfall');
    expect(falls.length).toBe(1);
    const w = falls[0];
    const wx = w.x / T;
    expect(ground(wx - 1, w.y / T)).toBe(true);
    expect(ground(wx, 26)).toBe(true);
    const feather = of('Pickup').find((p) => p.props.kind === 'pluma' && p.x > 150 * T && p.x < 160 * T)!;
    const fx = Math.floor(feather.x / T);
    const fy = feather.y / T - 1;
    const column = of('Breakable').filter((b) => b.x === fx * T || b.x === (fx + 1) * T);
    expect(column.length).toBe(8);
    expect(column.every((b) => b.props.kind === 'brittle')).toBe(true);
    // El techo justo encima de la pluma: sobre la columna no hay lugar para pararse.
    expect(ground(fx, fy - 1)).toBe(true);
  });
});
