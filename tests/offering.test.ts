import { describe, expect, it } from 'vitest';
import { GAMEPLAY } from '../src/config/gameplay';
import { canReturnForChipas, chipaReturnTarget, OfferingMotor, offeringLineKey, offeringStartsOpen } from '../src/systems/offeringLogic';
import { findTraps, trapGridFromMap, trapReach, TrapCell, type TrapObject } from '../src/systems/trapLogic';

// El paso de la ofrenda (S36): la entrada a la antesala se abre con las tres chipas del nivel.
const NEED = GAMEPLAY.hud.featherMax;
const OFFER_MS = GAMEPLAY.offering.offerMs;
const DT = 1000 / 60;

describe('paso de la ofrenda: lógica', () => {
  it('sin las tres, avisa una vez al llegar y no se abre', () => {
    const m = new OfferingMotor(false);
    expect(m.step(DT, false, 2, NEED, OFFER_MS)).toBe('none');
    expect(m.reached).toBe(false);
    expect(m.step(DT, true, 2, NEED, OFFER_MS)).toBe('reached');
    expect(m.step(DT, true, 2, NEED, OFFER_MS)).toBe('none');
    for (let i = 0; i < 600; i++) m.step(DT, true, 2, NEED, OFFER_MS);
    expect([m.state, m.blocks, m.reached]).toEqual(['closed', true, true]);
  });

  it('con las tres: ofrenda, y se abre recién al terminar', () => {
    const m = new OfferingMotor(false);
    expect(m.step(DT, true, 3, NEED, OFFER_MS)).toBe('offer');
    expect([m.state, m.blocks]).toEqual(['offering', true]);
    let opened = -1;
    for (let t = DT; t < OFFER_MS * 2 && opened < 0; t += DT) if (m.step(DT, false, 3, NEED, OFFER_MS) === 'opened') opened = t;
    expect(opened).toBeGreaterThanOrEqual(OFFER_MS - DT);
    expect([m.state, m.blocks]).toEqual(['open', false]);
    expect(m.step(DT, true, 3, NEED, OFFER_MS)).toBe('none');
  });

  it('volver a la puerta con las que faltaban también la abre', () => {
    const m = new OfferingMotor(false);
    m.step(DT, true, 1, NEED, OFFER_MS);
    expect(m.step(DT, false, 3, NEED, OFFER_MS)).toBe('none');
    expect(m.step(DT, true, 3, NEED, OFFER_MS)).toBe('offer');
  });

  it('abierta de entrada si el hijo del nivel ya está libre (partidas de antes de S36)', () => {
    expect(offeringStartsOpen('teju_jagua', ['teju_jagua'])).toBe(true);
    expect(offeringStartsOpen('mboi_tui', ['teju_jagua'])).toBe(false);
    expect(offeringStartsOpen(null, ['teju_jagua'])).toBe(false);
    const m = new OfferingMotor(true);
    expect([m.state, m.blocks, m.step(DT, true, 0, NEED, OFFER_MS)]).toEqual(['open', false, 'none']);
  });

  it('la vuelta va a la primera chipa que falta en el orden del recorrido (el de la lista)', () => {
    const points = [
      { chipa: 2, x: 1, y: 1 },
      { chipa: 1, x: 2, y: 2 },
      { chipa: 0, x: 3, y: 3 },
    ];
    expect(chipaReturnTarget(points, [false, false, false])?.x).toBe(1);
    expect(chipaReturnTarget(points, [false, false, true])?.x).toBe(2);
    expect(chipaReturnTarget(points, [false, true, true])?.x).toBe(3);
    expect(chipaReturnTarget(points, [true, true, true])).toBeNull();
  });

  it('la pausa ofrece volver con la puerta cerrada y alguna chipa por buscar, aunque no haya llegado a la puerta (S39)', () => {
    const target = { chipa: 0, x: 0, y: 0 };
    const m = new OfferingMotor(false);
    expect(m.reached).toBe(false);
    expect(canReturnForChipas(m, target)).toBe(true);
    m.step(DT, true, 1, NEED, OFFER_MS);
    expect(canReturnForChipas(m, target)).toBe(true);
    expect(canReturnForChipas(m, null)).toBe(false);
    m.step(DT, true, 3, NEED, OFFER_MS);
    expect(canReturnForChipas(m, target)).toBe(false);
    // Abierta desde el principio (el hijo ya estaba libre): no se ofrece.
    expect(canReturnForChipas(new OfferingMotor(true), target)).toBe(false);
  });

  it('el texto de Mainumby: cuántas lleva (ninguna aparte) o la ofrenda', () => {
    expect(offeringLineKey('closed', 0)).toBe('offering.closed_none');
    expect(offeringLineKey('closed', 2)).toBe('offering.closed');
    expect(offeringLineKey('offering', 3)).toBe('offering.open');
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Los mapas: dónde está la puerta y qué deja hacer cerrada.

type Layer = { name: string; type: string; data?: number[]; objects?: TiledObj[] };
type TiledObj = { type: string; x: number; y: number; width: number; height: number; properties?: { name: string; value: unknown }[] };
type TiledMap = { width: number; height: number; tilewidth: number; layers: Layer[] };
const MAPS = import.meta.glob('../public/assets/maps/*.json', { eager: true, import: 'default' }) as Record<string, TiledMap>;
const T = 16;
const LEVELS = ['l1', 'l2', 'l3', 'l4', 'l5', 'l6', 'l7'];
const g = GAMEPLAY.gravity;
const p = GAMEPLAY.player;
/** Con los tres dones (desde el primer nivel): salta 6 filas con el salto doble y 11 con hongo y salto doble. */
const REACH = trapReach({
  gravity: g,
  stepHz: 60,
  tile: T,
  jumpVelocity: p.jumpVelocity,
  doubleJumpVelocity: p.doubleJumpVelocity,
  bounceVelocity: GAMEPLAY.jungle.bounceVelocity,
  mushroomHeight: GAMEPLAY.jungle.mushroomHeight,
  bodyHeight: p.bodyHeight,
});

function load(id: string) {
  const map = MAPS[`../public/assets/maps/${id}.json`];
  const layer = (name: string) => {
    const data = map.layers.find((l) => l.name === name)?.data ?? [];
    return (x: number, y: number) => (data[y * map.width + x] ?? 0) > 0;
  };
  const objects: TrapObject[] = (map.layers.find((l) => l.type === 'objectgroup')?.objects ?? []).map((o) => ({
    cls: o.type,
    x: o.x,
    y: o.y,
    width: o.width,
    height: o.height,
    props: Object.fromEntries((o.properties ?? []).map((q) => [q.name, q.value])),
  }));
  return { map, layer, objects };
}
/** Celda de los pies de un objeto puntual (va al pie de su tile). */
const feet = (o: TrapObject) => [Math.floor(o.x / T), o.y / T - 1] as const;
const doorOf = (objects: TrapObject[]) => objects.filter((o) => o.cls === 'Offering');
const cols = (o: TrapObject) => ({ x: o.x / T, y0: o.y / T, y1: (o.y + o.height) / T - 1 });

/**
 * Alcance optimista (el modelo de la red de seguridad, con los tres dones): desde una celda de pie, todo lo que se
 * toca. Los rompibles están rotos, las rejas abiertas, las plataformas móviles son piso en todo su recorrido (y las
 * verticales también bajan); las espinas se cruzan (el dash es intangible) y el agua honda no. Es una condición necesaria: lo que acá no se alcanza, no se alcanza.
 */
function reachable(id: string, closeDoor: boolean, from: readonly [number, number]): Uint8Array {
  const { map, layer, objects } = load(id);
  const grid = trapGridFromMap({
    width: map.width,
    height: map.height,
    tile: T,
    ground: layer('Ground'),
    platforms: layer('Platforms'),
    hazards: () => false,
    water: () => false,
    // S39: el inicio y los fuegos también son salidas del test de encierros; acá no (se mide hasta dónde se camina).
    objects: objects.filter((o) => !['WindZone', 'BossArena', 'ChaseZone', 'Enemy', 'PlayerSpawn', 'Checkpoint'].includes(o.cls)),
    cowReachPx: 0,
    // Rompibles rotos y hongos despiertos (Kerana puede abrirlos); la puerta la pone `closeDoor`.
    opened: (o) => o.cls !== 'Offering',
  });
  const { width: w, height: h, cells } = grid;
  const water = layer('Water');
  if (closeDoor) for (const d of doorOf(objects)) for (let y = cols(d).y0; y <= cols(d).y1; y++) cells[y * w + cols(d).x] = TrapCell.Solid;
  const at = (x: number, y: number) => (x < 0 || x >= w || y >= h ? TrapCell.Solid : y < 0 ? TrapCell.Air : cells[y * w + x]);
  const clear = (x: number, y: number) => {
    if (x < 0 || x >= w || y < 0 || y >= h || water(x, y)) return false;
    for (let k = 0; k < REACH.bodyRows; k++) if (at(x, y - k) === TrapCell.Solid) return false;
    return true;
  };
  const supports = (c: number) => c === TrapCell.Solid || c === TrapCell.Floor || c === TrapCell.Bounce;
  // Una plataforma vertical también baja: en su recorrido se puede descender (viajando en ella).
  const ride = new Uint8Array(w * h);
  for (const o of objects) {
    const dy = Number(o.props.dy ?? 0);
    if (o.cls !== 'Mover' || dy === 0) continue;
    const top = o.y / T + Math.min(0, dy);
    for (let y = top; y <= top + Math.abs(dy); y++) for (let x = o.x / T; x < (o.x + o.width) / T; x++) ride[y * w + x] = 1;
  }
  // Nodos: tramos de piso (saltan `jumpRows`) y celdas sobre un hongo (rebotan `bounceRows`), como en la red.
  const okCell = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) okCell[y * w + x] = clear(x, y) ? 1 : 0;
  const standing = (x: number, y: number) => okCell[y * w + x] === 1 && supports(at(x, y + 1));
  const spanAt = new Int32Array(w * h).fill(-1);
  const nodes: { cells: number[]; top: number }[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!standing(x, y)) continue;
      const i = y * w + x;
      if (at(x, y + 1) === TrapCell.Bounce) {
        spanAt[i] = nodes.length;
        nodes.push({ cells: [i], top: y - REACH.bounceRows });
        continue;
      }
      const prev = x > 0 ? spanAt[i - 1] : -1;
      if (prev >= 0 && nodes[prev].top === y - REACH.jumpRows) {
        spanAt[i] = prev;
        nodes[prev].cells.push(i);
      } else {
        spanAt[i] = nodes.length;
        nodes.push({ cells: [i], top: y - REACH.jumpRows });
      }
    }
  }
  const seen = new Uint8Array(w * h);
  const stamp = new Int32Array(w * h).fill(-1);
  const queue = new Int32Array(w * h);
  const done = new Uint8Array(nodes.length);
  const start = spanAt[from[1] * w + from[0]];
  const todo = start >= 0 ? [start] : [];
  if (start >= 0) done[start] = 1;
  while (todo.length) {
    const n = todo.pop()!;
    const { cells: seeds, top } = nodes[n];
    let head = 0;
    let tail = 0;
    const push = (i: number) => {
      if (stamp[i] === n || !okCell[i]) return;
      stamp[i] = n;
      queue[tail++] = i;
    };
    for (const i of seeds) push(i);
    while (head < tail) {
      const i = queue[head++];
      const x = i % w;
      const y = (i - x) / w;
      seen[i] = 1;
      const s = spanAt[i];
      if (s >= 0 && !done[s]) {
        done[s] = 1;
        todo.push(s);
      }
      const below = at(x, y + 1);
      if (x > 0) push(i - 1);
      if (x + 1 < w) push(i + 1);
      if (y - 1 >= Math.max(top, 0)) push(i - w);
      if (y + 1 < h && (!supports(below) || ride[i + w])) push(i + w);
    }
  }
  return seen;
}
/** ¿El cuerpo (3 filas sobre los pies) toca la celda? */
const touches = (seen: Uint8Array, w: number, x: number, y: number) => [0, 1, 2].some((k) => seen[(y + k) * w + x] === 1);

describe('paso de la ofrenda: en los siete niveles', () => {
  it('una puerta por nivel, de techo a piso, antes del fuego de la antesala y de la arena; ninguna fuera de la campaña', () => {
    for (const id of LEVELS) {
      const { map, layer, objects } = load(id);
      const doors = doorOf(objects);
      expect([id, doors.length]).toEqual([id, 1]);
      const d = cols(doors[0]);
      // Arriba: el techo o el borde del mapa. Abajo: el piso.
      expect([id, d.y0 === 0 || layer('Ground')(d.x, d.y0 - 1)]).toEqual([id, true]);
      expect([id, layer('Ground')(d.x, d.y1 + 1)]).toEqual([id, true]);
      for (let y = d.y0; y <= d.y1; y++) expect([id, y, layer('Ground')(d.x, y)]).toEqual([id, y, false]);
      const arena = objects.find((o) => o.cls === 'BossArena')!;
      expect(doors[0].x + doors[0].width).toBeLessThanOrEqual(arena.x);
      // El último fuego (el de la antesala, donde empieza boss=1) queda del lado de la arena.
      const lastFire = objects.filter((o) => o.cls === 'Checkpoint').reduce((a, b) => (b.x > a.x ? b : a));
      expect([id, lastFire.x > doors[0].x + doors[0].width]).toEqual([id, true]);
      expect(map.width).toBeGreaterThan(d.x);
    }
    for (const id of ['test', 'vitrina', 'yvaga']) expect([id, doorOf(load(id).objects).length]).toEqual([id, 0]);
  });

  it('una vuelta por chipa, en el inicio o en un fuego', () => {
    for (const id of LEVELS) {
      const { objects } = load(id);
      const returns = objects.filter((o) => o.cls === 'ChipaReturn');
      expect([id, returns.map((r) => r.props.chipa).sort()]).toEqual([id, [0, 1, 2]]);
      const spots = objects.filter((o) => o.cls === 'Checkpoint' || o.cls === 'PlayerSpawn').map((o) => `${o.x},${o.y}`);
      for (const r of returns) expect([id, spots.includes(`${r.x},${r.y}`)]).toEqual([id, true]);
      const chipas = objects.filter((o) => o.cls === 'Pickup' && o.props.kind === 'pluma').map((o) => o.props.index).sort();
      expect([id, chipas]).toEqual([id, [0, 1, 2]]);
    }
  });

  it('con la puerta cerrada: desde el inicio y desde cada vuelta se llega a su chipa y de nuevo a la puerta', () => {
    for (const id of LEVELS) {
      const { map, objects } = load(id);
      const w = map.width;
      const door = doorOf(objects)[0];
      const front = door.props.front === undefined ? cols(door).y1 : Number(door.props.front);
      const chipa = (i: number) => feet(objects.find((o) => o.cls === 'Pickup' && o.props.kind === 'pluma' && o.props.index === i)!);
      const spawn = feet(objects.find((o) => o.cls === 'PlayerSpawn')!);
      const fromSpawn = reachable(id, true, spawn);
      for (const i of [0, 1, 2]) expect([id, 'inicio', i, touches(fromSpawn, w, ...chipa(i))]).toEqual([id, 'inicio', i, true]);
      expect([id, 'inicio → puerta', fromSpawn[front * w + cols(door).x - 1]]).toEqual([id, 'inicio → puerta', 1]);
      for (const r of objects.filter((o) => o.cls === 'ChipaReturn')) {
        const seen = reachable(id, true, feet(r));
        const c = Number(r.props.chipa);
        expect([id, 'vuelta', c, touches(seen, w, ...chipa(c))]).toEqual([id, 'vuelta', c, true]);
        expect([id, 'vuelta → puerta', c, seen[front * w + cols(door).x - 1]]).toEqual([id, 'vuelta → puerta', c, 1]);
      }
    }
  });

  it('cerrada no deja encierros nuevos (test de encierros con la puerta como pared)', () => {
    for (const id of LEVELS) {
      const { map, layer, objects } = load(id);
      const doors = doorOf(objects);
      const grid = (close: boolean) => {
        const gr = trapGridFromMap({
          width: map.width,
          height: map.height,
          tile: T,
          ground: (x, y) => layer('Ground')(x, y) || (close && doors.some((d) => cols(d).x === x && y >= cols(d).y0 && y <= cols(d).y1)),
          platforms: layer('Platforms'),
          hazards: layer('Hazards'),
          water: layer('Water'),
          objects,
          cowReachPx: GAMEPLAY.cow.patrolDistance + 2 * T,
          // Como el modelo de S36: todo abierto salvo la puerta, que la pone `close`.
          opened: (o) => o.cls !== 'Offering',
        });
        const r = findTraps(gr, REACH);
        return r.trappedSpans.map((n) => r.spans[n]);
      };
      expect([id, grid(true)]).toEqual([id, grid(false)]);
      expect([id, grid(true)]).toEqual([id, []]);
    }
  });
});
