import { describe, expect, it } from 'vitest';
import { GAMEPLAY } from '../src/config/gameplay';
import { MoverMotor, moverTiming, type MoverSpec } from '../src/entities/MoverMotor';
import { findTraps, TrapCell, trapGridFromMap, trapReach, type TrapReach } from '../src/systems/trapLogic';

// l4 · Capiatá (S27): la galería de las tejas (zona de ritmo), el potrero de la vaca guasu (lugar secreto) y la regla de
// las rejas que se cierran solas (en todos los mapas): el test de encierros no ve las rejas.

const T = 16;
type Obj = { type: string; x: number; y: number; width: number; height: number; properties?: { name: string; value: unknown }[] };
type TiledMap = { width: number; height: number; layers: { name: string; type: string; data?: number[]; objects?: Obj[] }[] };
const MAPS = import.meta.glob('../public/assets/maps/*.json', { eager: true, import: 'default' }) as Record<string, TiledMap>;
const mapOf = (id: string) => MAPS[`../public/assets/maps/${id}.json`];
const objectsOf = (id: string) =>
  (mapOf(id).layers.find((l) => l.type === 'objectgroup')?.objects ?? []).map((o) => ({
    ...o,
    props: Object.fromEntries((o.properties ?? []).map((q) => [q.name, q.value])) as Record<string, unknown>,
  }));
const moverSpec = (o: { props: Record<string, unknown> }): MoverSpec => ({
  dx: Number(o.props.dx ?? 0) * T,
  dy: Number(o.props.dy ?? 0) * T,
  speed: Number(o.props.speed ?? GAMEPLAY.mover.speed),
  waitMs: Number(o.props.waitMs ?? GAMEPLAY.mover.waitMs),
  mode: (o.props.mode as MoverSpec['mode']) ?? 'loop',
});

describe('l4: plataformas y verticales (S27)', () => {
  const movers = objectsOf('l4').filter((o) => o.type === 'Mover');

  it('20 plataformas móviles, todas de un solo sentido; 4 verticales', () => {
    expect(movers.length).toBe(20);
    expect(movers.filter((m) => m.props.solid === true).length).toBe(0);
    expect(movers.filter((m) => Number(m.props.dy ?? 0) !== 0).length).toBe(4);
  });

  it('la cadena de bajada (balsa, ascensor, balsa, ascensor, balsa) comparte el ciclo: cada salto cae en una espera de las dos', () => {
    const chain = movers.filter((m) => m.x >= 320 * T && m.x <= 348 * T);
    expect(chain.length).toBe(5);
    expect(new Set(chain.map((m) => moverTiming(moverSpec(m)).periodMs)).size).toBe(1);
  });
});

describe('l4: la galería de las tejas, zona de ritmo (S27)', () => {
  const objs = objectsOf('l4');
  const rafts = objs.filter((o) => o.type === 'Mover' && o.y === 33 * T && o.x >= 378 * T);
  const tejas = objs.filter((o) => o.type === 'FallingHazard' && o.props.kind === 'teja' && o.x >= 378 * T);
  const FH = GAMEPLAY.fallingHazard;

  it('ocho balsas con el mismo ciclo: se juntan de a dos con 3 tiles de hueco', () => {
    expect(rafts.length).toBe(8);
    expect(new Set(rafts.map((m) => moverTiming(moverSpec(m)).periodMs)).size).toBe(1);
  });

  // Kerana viaja en la balsa que llega al muelle de la teja, parada a `offset` px de su borde izquierdo. Devuelve cuándo
  // (ms desde que la balsa toca la punta) empieza el aviso, cuándo la toca una teja y cuándo se separan las balsas.
  function ride(dock: number, offset: number) {
    const pair = tejas.filter((t) => Math.abs(t.x - dock) <= T);
    // La balsa cuya punta (origen o fin) deja su baldosa delantera bajo la teja de más a la derecha.
    const front = Math.max(...pair.map((t) => t.x));
    let found: { raft: (typeof rafts)[number]; atEnd: boolean } | undefined;
    for (const r of rafts) {
      const s = moverSpec(r);
      for (const atEnd of [false, true]) {
        const left = r.x + (atEnd ? s.dx : 0);
        if (Math.abs(left + r.width - T / 2 - front) < 1) found = { raft: r, atEnd };
      }
    }
    if (!found) throw new Error(`ninguna balsa llega bajo la teja de x ${front / T}`);
    const spec = moverSpec(found.raft);
    const tm = moverTiming(spec);
    const arrive = found.atEnd ? tm.atEndMs + tm.periodMs : tm.atOriginMs + tm.periodMs;
    const travel = (Math.hypot(spec.dx, spec.dy) / spec.speed) * 1000;
    const mm = new MoverMotor(spec);
    const state = pair.map(() => ({ phase: 'hanging' as 'hanging' | 'warning' | 'falling' | 'done', ms: 0, y: 0, vy: 0 }));
    let warn: number | null = null;
    let hit: number | null = null;
    let leave: number | null = null;
    const dt = 1000 / 60;
    for (let t = 0; t < arrive + spec.waitMs + 500; t += dt) {
      mm.step(dt);
      const rafting = t >= arrive - travel - 100;
      const px = found.raft.x + mm.offsetX + offset;
      const feet = found.raft.y;
      if (leave === null && t > arrive + 50 && (found.atEnd ? mm.pos < mm.length - 0.5 : mm.pos > 0.5)) leave = t - arrive;
      if (!rafting) continue;
      pair.forEach((teja, i) => {
        const st = state[i];
        if (st.phase === 'hanging' && Math.abs(px - teja.x) <= FH.triggerRangeX) {
          st.phase = 'warning';
          st.ms = Number(teja.props.delayMs ?? FH.warnMs);
          if (warn === null) warn = t - arrive;
        } else if (st.phase === 'warning') {
          st.ms -= dt;
          if (st.ms <= 0) {
            st.phase = 'falling';
            st.y = teja.y - T;
          }
        } else if (st.phase === 'falling') {
          st.vy = Math.min(FH.maxFallSpeed, st.vy + FH.gravity * (dt / 1000));
          st.y += st.vy * (dt / 1000);
          const tl = teja.x - FH.tejaWidth / 2;
          const over = px - 8 < tl + FH.tejaWidth && px + 8 > tl && feet - GAMEPLAY.player.bodyHeight < st.y + FH.tejaHeight && feet > st.y;
          if (over && hit === null) hit = t - arrive;
          if (st.y > feet + 64) st.phase = 'done';
        }
      });
    }
    return { warn, hit, leave };
  }

  it('dos tejas flojas sobre cada muelle donde se espera para saltar (seis muelles), sobre la punta y el medio de la balsa', () => {
    expect(tejas.length).toBe(12);
    const docks = [...new Set(tejas.map((t) => Math.round(t.x / T / 2)))];
    expect(docks.length).toBe(6);
  });

  it('parada adelante, la teja cruje antes de llegar y la toca con las balsas juntas (≥ 0,6 s para saltar); atrás no la toca', () => {
    const docks = [...new Set(tejas.map((t) => Math.max(...tejas.filter((q) => Math.abs(q.x - t.x) <= T).map((q) => q.x))))];
    expect(docks.length).toBe(6);
    for (const dock of docks) {
      const front = ride(dock, 3 * T - T / 2);
      const back = ride(dock, T / 2);
      expect([dock / T, front.warn! < 0, front.hit! >= 600, front.hit! < front.leave!]).toEqual([dock / T, true, true, true]);
      expect([dock / T, back.hit === null || back.hit > back.leave!]).toEqual([dock / T, true]);
    }
  });
});

describe('l4: el potrero de la vaca guasu, lugar secreto (S27)', () => {
  const objs = objectsOf('l4');
  const cow = objs.find((o) => o.type === 'Enemy' && o.props.kind === 'vaca_guasu')!;
  const BIG = GAMEPLAY.bigCow;
  const COW = GAMEPLAY.cow;
  const half = (COW.width * BIG.scale) / 2;

  it('es la vaca común en grande, con sus propios valores; la común no cambia', () => {
    expect([COW.width, COW.height, COW.speed, COW.patrolDistance, COW.turnPauseMs]).toEqual([30, 24, 14, 56, 1200]);
    expect(BIG.scale).toBeGreaterThan(2);
    // El lomo (alto del cuerpo, height − 4, escalado) queda justo 3 filas sobre los pies.
    expect((COW.height - 4) * BIG.scale).toBe(3 * T);
  });

  it('cruza el potrero de espinas (14 tiles: ni con salto doble) del henil a la repisa del premio, al ras de la repisa', () => {
    expect(cow).toBeDefined();
    const left = cow.x - BIG.patrolDistance - half;
    const right = cow.x + BIG.patrolDistance + half;
    // Henil hasta x 234 (fila 30); repisa del premio desde x 249 (fila 34, a la altura del lomo).
    expect(left - 235 * T).toBeGreaterThanOrEqual(0);
    expect(left - 235 * T).toBeLessThanOrEqual(T);
    expect(right).toBe(249 * T);
    expect(cow.y - (COW.height - 4) * BIG.scale).toBe(34 * T);
    // Henil en la fila 30 y bloque de la pluma B en la fila 30: 4 filas sobre el lomo (de vuelta y al premio, salto doble).
    const map = mapOf('l4');
    const ground = map.layers.find((l) => l.name === 'Ground')!.data!;
    const solid = (x: number, y: number) => ground[y * map.width + x] > 0;
    expect([solid(234, 30), solid(234, 29), solid(251, 30), solid(251, 29), solid(249, 34), solid(249, 33)]).toEqual([true, false, true, false, true, false]);
  });
});

describe('rejas que se cierran solas: nadie queda encerrado (S27)', () => {
  // El test de encierros no ve las rejas. Una reja con alguna piedra temporizada se cierra sola: se la cierra (como
  // suelo) y se buscan los pisos que quedan encerrados por ella; en cada uno tiene que haber, al alcance, una piedra que
  // la vuelva a abrir (receta §11.4 y §12). Las rejas de piedra permanente no se vuelven a cerrar.
  const P = GAMEPLAY.player;
  const physics = {
    gravity: GAMEPLAY.gravity,
    stepHz: 60,
    tile: T,
    jumpVelocity: P.jumpVelocity,
    bounceVelocity: GAMEPLAY.jungle.bounceVelocity,
    mushroomHeight: GAMEPLAY.jungle.mushroomHeight,
    bodyHeight: P.bodyHeight,
  };
  const BASE = trapReach(physics);
  const DOUBLE = trapReach({ ...physics, doubleJumpVelocity: P.doubleJumpVelocity });
  const lockedIn = (id: string, reach: TrapReach) => {
    const map = mapOf(id);
    const layer = (name: string) => {
      const data = map.layers.find((l) => l.name === name)?.data ?? [];
      return (x: number, y: number) => (data[y * map.width + x] ?? 0) > 0;
    };
    const objs = objectsOf(id);
    const grid = trapGridFromMap({
      width: map.width,
      height: map.height,
      tile: T,
      ground: layer('Ground'),
      platforms: layer('Platforms'),
      hazards: layer('Hazards'),
      water: layer('Water'),
      objects: objs.map((o) => ({ cls: o.type, x: o.x, y: o.y, width: o.width, height: o.height, props: o.props })),
      cowReachPx: GAMEPLAY.cow.patrolDistance + 2 * T,
    });
    // Los encierros que ya estaban sin cerrar ninguna reja (el pozo F de la vitrina, a propósito) no cuentan.
    const key = (sp: { y: number; x0: number; x1: number }) => `${sp.y}:${sp.x0}-${sp.x1}`;
    const open = findTraps(grid, reach);
    const before = new Set(open.trappedSpans.map((n) => key(open.spans[n])));
    const out: string[] = [];
    for (const gate of objs.filter((o) => o.type === 'Gate')) {
      const sw = objs.filter((o) => o.type === 'Switch' && String(o.props.target) === String(gate.props.id));
      if (!sw.some((s) => Number(s.props.ms ?? 0) > 0)) continue;
      const closed = { ...grid, cells: grid.cells.slice() };
      for (let y = gate.y / T; y < (gate.y + gate.height) / T; y++) closed.cells[y * map.width + gate.x / T] = TrapCell.Solid;
      const r = findTraps(closed, reach);
      for (const n of r.trappedSpans) {
        const sp = r.spans[n];
        if (before.has(key(sp))) continue;
        // Una piedra de esta reja sobre ese piso (de los pies hasta 3 filas arriba).
        const ok = sw.some((s) => s.x / T >= sp.x0 - 1 && s.x / T <= sp.x1 + 1 && s.y / T >= sp.y - 3 && s.y / T <= sp.y);
        if (!ok) out.push(`${String(gate.props.id)}: x ${sp.x0}-${sp.x1} fila ${sp.y + 1}`);
      }
    }
    return out;
  };

  it('l3, l4 y la vitrina: si una reja temporizada encierra a Kerana, adentro hay una piedra que la abre', () => {
    expect(lockedIn('l3', BASE)).toEqual([]);
    expect(lockedIn('l4', DOUBLE)).toEqual([]);
    expect(lockedIn('vitrina', DOUBLE)).toEqual([]);
  });

  it('l1: el nicho de la pluma A (reja x 38) tiene su piedra adentro y no encierra a Kerana (S28)', () => {
    // Encontrado en S27 y confirmado en el juego: con Kerana en el nicho, al apagarse la piedra de afuera la reja se
    // cerraba y no se salía (la red no lo ve: da las rejas por abiertas). S28 puso una segunda piedra adentro (x 39).
    expect(lockedIn('l1', BASE)).toEqual([]);
    for (const id of ['l2', 'l5', 'l6', 'l7', 'yvaga']) expect([id, lockedIn(id, DOUBLE)]).toEqual([id, []]);
  });
});
