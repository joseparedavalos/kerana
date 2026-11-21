import { describe, expect, it } from 'vitest';
import { GAMEPLAY } from '../src/config/gameplay';
import { ENEMIES } from '../src/data/enemies';
import { getLevel, LEVELS } from '../src/data/levels';
import { MoverMotor, moverTiming, type MoverSpec } from '../src/entities/MoverMotor';
import { parseAscii } from '../tools/lib/ascii-map.mjs';
import { YVAGA_MAIN, YVAGA_TRAMOS } from '../tools/lib/pilot-plans.mjs';
import yvagaText from '../tools/levels/yvaga.txt?raw';

// Yvága (S92): la subida, un nivel vertical de siete tramos bajo la arena de Tau. Lo que pidió la sesión y no se ve
// jugando un rato: la arena intacta, sin pozos ni paredes, las redes de borde a borde, los fuegos numerados para
// ?boss=1, cada enemigo en su tramo y ninguno sobre una pieza donde aterriza un salto obligatorio.

const T = 16;
const W = 44;
type Obj = { type: string; x: number; y: number; width: number; height: number; point?: boolean; properties?: { name: string; value: unknown }[] };
type TiledMap = { width: number; height: number; layers: { name: string; type: string; data?: number[]; objects?: Obj[] }[] };
const MAPS = import.meta.glob('../public/assets/maps/yvaga.json', { eager: true, import: 'default' }) as Record<string, TiledMap>;
const map = MAPS['../public/assets/maps/yvaga.json'];
const parsed = parseAscii(yvagaText);
const g: string[] = parsed.grid;
const H = g.length;
const layer = (name: string) => map.layers.find((l) => l.name === name)?.data ?? [];
const ground = layer('Ground');
const platforms = layer('Platforms');
const solidTile = (x: number, y: number) => x >= 0 && x < W && y >= 0 && y < H && ((ground[y * W + x] ?? 0) > 0 || (platforms[y * W + x] ?? 0) > 0);
const objs = (map.layers.find((l) => l.type === 'objectgroup')?.objects ?? []).map((o) => ({
  ...o,
  props: Object.fromEntries((o.properties ?? []).map((q) => [q.name, q.value])) as Record<string, unknown>,
}));
const of = (type: string) => objs.filter((o) => o.type === type);
/** Fila de los pies de un objeto puntual (el punto va en el borde de abajo de su tile). */
const feetRow = (o: { y: number }) => o.y / T;
const col = (o: { x: number }) => Math.floor(o.x / T);

/** Las redes: filas enteras de plataforma de un sentido, de arriba abajo (piso 6 … piso 1). */
const nets = g.flatMap((row, y) => (y > 25 && row === '='.repeat(W) ? [y] : []));
const BASE = H - 2;
/** Fila del piso de cada tramo (1 = la base) y la del de arriba. */
const floorOf = (k: number) => (k === 1 ? BASE : nets[6 - (k - 1)]);
const topOf = (k: number) => (k === 7 ? 23 : nets[6 - k]);
/** Tramo (1-7) de una fila de pies; 0 si es de la arena. */
const tramoOf = (row: number) => [1, 2, 3, 4, 5, 6, 7].find((k) => row <= floorOf(k) && row > topOf(k)) ?? 0;
const enemies = of('Enemy').map((o) => ({ kind: String(o.props.kind), x: o.x / T, row: feetRow(o), tramo: tramoOf(feetRow(o)) }));

// La arena de HEAD antes de S92 (filas 0 a 25). Lo único que cambió: Kerana ya no empieza en la antesala (la P de la
// fila 22) y el piso de la antesala (x 1-3) se abre: de un sentido en la fila 23 y aire en las filas 24 y 25.
const ARENA_BEFORE = [
  ...Array.from({ length: 14 }, () => '.'.repeat(W)),
  '...................===.........===..........',
  '.'.repeat(W),
  '.'.repeat(W),
  '.............===.........===.......===......',
  '.'.repeat(W),
  '.'.repeat(W),
  '.......===.............................===..',
  '.'.repeat(W),
  '.PC.........................................',
  '#'.repeat(W),
  '#'.repeat(W),
  '#'.repeat(W),
];

describe('Yvága: la arena de Tau no cambió (S92)', () => {
  it('las filas 0 a 25 son las de antes, salvo el inicio y el piso abierto de la antesala', () => {
    const expected = ARENA_BEFORE.map((row, y) => {
      const cells = [...row];
      if (y === 22) cells[1] = '.';
      if (y === 23) for (const x of [1, 2, 3]) cells[x] = '=';
      if (y === 24 || y === 25) for (const x of [1, 2, 3]) cells[x] = '.';
      return cells.join('');
    });
    expect(g.slice(0, 26)).toEqual(expected);
  });

  it('el piso de la arena (x 4-43) sigue sólido y el rectángulo de la pelea es el mismo', () => {
    for (const y of [23, 24, 25]) expect(g[y].slice(4)).toBe('#'.repeat(40));
    const [arena] = of('BossArena');
    expect([arena.x / T, arena.y / T, arena.width / T, arena.height / T, arena.props.boss]).toEqual([4, 0, 40, 24, 'tau']);
  });

  it('las siete estrellas de GAMEPLAY.tau.starTiles coinciden con las plataformas del mapa', () => {
    const cfg = GAMEPLAY.tau;
    for (const [x, row] of cfg.starTiles) {
      expect(g[row].slice(4 + x, 4 + x + cfg.starWidthTiles), `estrella en x ${x}, fila ${row}`).toBe('='.repeat(cfg.starWidthTiles));
    }
    const stars = g.slice(0, 23).join('').split('').filter((c) => c === '=').length;
    expect(stars).toBe(cfg.starTiles.length * cfg.starWidthTiles);
  });
});

describe('Yvága: la forma de la subida (S92)', () => {
  it('mide 44 de ancho y crece hacia abajo: la arena arriba, la base al fondo', () => {
    expect([map.width, parsed.width]).toEqual([W, W]);
    expect(map.height).toBe(H);
    expect(H).toBeGreaterThanOrEqual(250);
    expect(H).toBeLessThanOrEqual(290);
  });

  it('no hay pozo: la base va de lado a lado, con dos filas de espesor, y Kerana empieza al centro con un fuego', () => {
    expect(g[BASE]).toBe('#'.repeat(W));
    expect(g[BASE + 1]).toBe('#'.repeat(W));
    const [spawn] = of('PlayerSpawn');
    expect(feetRow(spawn)).toBe(BASE);
    expect(Math.abs(spawn.x / T - W / 2)).toBeLessThanOrEqual(1);
    const fire = of('Checkpoint').find((c) => feetRow(c) === BASE)!;
    expect(Math.abs(col(fire) - col(spawn))).toBeLessThanOrEqual(3);
  });

  it('seis redes de borde a borde: siete tramos de 30 a 45 filas, la caída más larga es un tramo', () => {
    expect(nets).toHaveLength(6);
    const heights = [1, 2, 3, 4, 5, 6, 7].map((k) => floorOf(k) - topOf(k));
    for (const h of heights) {
      expect(h).toBeGreaterThanOrEqual(30);
      expect(h).toBeLessThanOrEqual(45);
    }
    // Las redes son de un sentido (capa Platforms), no suelo: se atraviesan subiendo.
    for (const y of nets) for (let x = 0; x < W; x++) expect(platforms[y * W + x]).toBeGreaterThan(0);
  });

  it('sin paredes: debajo de la arena, ninguna pieza sólida tiene más de 2 filas de espesor', () => {
    const thick: string[] = [];
    for (let x = 0; x < W; x++) {
      let run = 0;
      for (let y = 26; y < H; y++) {
        run = g[y][x] === '#' ? run + 1 : 0;
        if (run > 2) thick.push(`x ${x}, fila ${y}`);
      }
    }
    expect(thick).toEqual([]);
  });

  it('a la antesala se entra por debajo: escalón en la fila 26 y repisa en la 29, a un salto simple cada uno', () => {
    expect(g[23].slice(1, 4)).toBe('===');
    expect(g[26].slice(1, 4)).toBe('===');
    expect(g[29].slice(0, 10)).toBe('==========');
    // Bajo el piso sólido de la arena (x 4-43) no hay nada hasta la repisa: 3 filas libres para caminar por ella.
    for (const y of [26, 27, 28]) expect(g[y].slice(4)).toBe('.'.repeat(40));
  });

  it('solo las piezas permitidas: sin espinas, agua, hongos, ramas, fardos, camalotes, rejas, piedras, faroles, chipas ni props', () => {
    expect(layer('Hazards').some((v) => v > 0)).toBe(false);
    expect(layer('Water').some((v) => v > 0)).toBe(false);
    expect(layer('Foreground').some((v) => v > 0)).toBe(false);
    const types = [...new Set(objs.map((o) => o.type))].sort();
    expect(types).toEqual(['BossArena', 'CameraFloor', 'Checkpoint', 'Enemy', 'Mover', 'Pickup', 'PlayerSpawn', 'WindZone']);
    expect(of('Pickup').map((p) => p.props.kind).sort().filter((k, i, a) => a.indexOf(k) === i)).toEqual(['guavira', 'luz_arasy']);
    expect(of('Mover').filter((m) => m.props.solid === true)).toEqual([]);
  });

  it('el fondo es el cielo vertical y se recorre con la subida; ningún otro nivel usa la opción', () => {
    const yvaga = getLevel('yvaga');
    // S118: el mismo fondo y el mismo recorrido; encima, el cielo vivo (capas de nubes y estrellas fugaces).
    expect(yvaga.backgrounds).toEqual({ far: 'bg_yvaga_subida', climb: true, skyDrift: true });
    expect(yvaga.cameraLookUp).toBeGreaterThan(0);
    for (const l of Object.values(LEVELS)) {
      if (!l || l.id === 'yvaga') continue;
      expect([l.id, l.backgrounds.climb, l.cameraLookUp]).toEqual([l.id, undefined, undefined]);
    }
  });

  it('en la antesala la vista sube a encuadrar la arena (piso de cámara en la fila 26, como el mapa de antes)', () => {
    const [floor] = of('CameraFloor');
    expect([floor.x, floor.y, floor.width / T, floor.height / T, floor.props.floor]).toEqual([0, 0, W, 24, 26]);
  });
});

describe('Yvága: fuegos, guavirá y la Luz de Arasy (S92)', () => {
  const fires = of('Checkpoint').map((c) => ({ id: Number(c.props.id), row: feetRow(c), x: col(c) }));

  it('cinco fuegos: la base, los pisos 2, 4 y 6 y la antesala', () => {
    expect(fires.map((f) => f.row).sort((a, b) => b - a)).toEqual([BASE, floorOf(3), floorOf(5), floorOf(7), 23]);
  });

  it('van numerados en el orden de la subida: ?boss=1 empieza en el de número más alto, el de la antesala', () => {
    const byRoute = [...fires].sort((a, b) => b.row - a.row);
    expect(byRoute.map((f) => f.id)).toEqual([0, 1, 2, 3, 4]);
    const last = fires.reduce((a, b) => (b.id > a.id ? b : a));
    expect([last.x, last.row]).toEqual([2, 23]);
  });

  it('una guavirá en cada piso (1 a 6) y la Luz de Arasy en el piso 3, antes del tramo 4', () => {
    const pickups = of('Pickup').map((p) => ({ kind: String(p.props.kind), row: feetRow(p) }));
    const guavira = pickups.filter((p) => p.kind === 'guavira').map((p) => p.row);
    expect(guavira.sort((a, b) => b - a)).toEqual([2, 3, 4, 5, 6, 7].map((k) => floorOf(k)));
    expect(pickups.filter((p) => p.kind === 'luz_arasy').map((p) => p.row)).toEqual([floorOf(4)]);
  });
});

describe('Yvága: los enemigos de cada tramo (S92)', () => {
  const kindsOf = (k: number) => [...new Set(enemies.filter((e) => e.tramo === k).map((e) => e.kind))].sort();
  const count = (k: number, kind: string) => enemies.filter((e) => e.tramo === k && e.kind === kind).length;

  it('uno por hijo liberado, de abajo arriba', () => {
    expect(kindsOf(1)).toEqual(['mbopi', 'teju_i']);
    expect(kindsOf(2)).toEqual(['nakurutu', 'payesero']);
    expect(kindsOf(3)).toEqual(['karakara']);
    expect(kindsOf(4)).toEqual(['abejas']);
    expect(kindsOf(5)).toEqual(['kai', 'mboi_colgante']);
    expect(kindsOf(6)).toEqual(['taitetu', 'yaguarete_ava']);
    expect(kindsOf(7)).toEqual(['jagua_hu', 'mbopi', 'payesero']);
    expect(enemies.every((e) => e.tramo >= 1)).toBe(true);
  });

  it('un payesero en el tramo 2 y dos en el 7; el póra no va (depende de la oscuridad)', () => {
    expect(count(2, 'payesero')).toBe(1);
    expect(count(7, 'payesero')).toBe(2);
    expect(enemies.some((e) => e.kind === 'pora')).toBe(false);
  });

  it('termina en calma: ningún enemigo en las últimas 6 filas antes de la antesala (24 a 29), ni asomando', () => {
    for (const e of enemies) {
      const def = ENEMIES[e.kind];
      // Lo más alto que llega su cuerpo: los pies, el alto y, en un volador, la onda.
      const top = e.row * T - def.height * (def.scale ?? 1) - (def.archetype === 'flyer' ? (def.amplitude ?? 0) : 0);
      expect([e.kind, e.x, top >= 30 * T]).toEqual([e.kind, e.x, true]);
    }
  });

  it('los que caminan o esperan de pie tienen suelo bajo los pies; los que embisten, un labio en cada punta', () => {
    for (const e of enemies) {
      const a = ENEMIES[e.kind].archetype;
      if (a === 'walker' || a === 'charger' || a === 'caster' || a === 'thrower') {
        expect([e.kind, e.x, solidTile(Math.floor(e.x), e.row)]).toEqual([e.kind, e.x, true]);
      }
      // Un Charger sin borde (taitetu, jagua hũ) corre hasta una pared: sin labio se cae de la isla.
      if (a === 'charger' && !ENEMIES[e.kind].pounces) {
        let x0 = Math.floor(e.x);
        let x1 = x0;
        while (g[e.row][x0 - 1] === '#') x0--;
        while (g[e.row][x1 + 1] === '#') x1++;
        expect([e.kind, e.x, g[e.row - 1][x0], g[e.row - 1][x1]]).toEqual([e.kind, e.x, '#', '#']);
        expect(x1 - x0 + 1).toBeGreaterThanOrEqual(12);
      }
      // El teju'i patrulla ± patrolDistance sin girar en los bordes: la isla lo contiene.
      if (a === 'walker') {
        const reach = Math.ceil(((ENEMIES[e.kind].patrolDistance ?? 48) + ENEMIES[e.kind].width / 2) / T);
        for (let dx = -reach; dx <= reach; dx++) expect([e.x, dx, solidTile(Math.floor(e.x) + dx, e.row)]).toEqual([e.x, dx, true]);
      }
    }
  });

  it('el yaguareté avá espera en suelo firme (Ground), a un hueco de 4 tiles o menos de una isla larga a su altura', () => {
    const cats = enemies.filter((e) => e.kind === 'yaguarete_ava');
    expect(cats.length).toBe(2);
    for (const e of cats) {
      let x1 = Math.floor(e.x);
      while (g[e.row][x1 + 1] === '#') x1++;
      let gap = 0;
      while (g[e.row][x1 + 1 + gap] !== '#' && gap < 10) gap++;
      expect(gap).toBeGreaterThanOrEqual(2);
      expect(gap * T).toBeLessThanOrEqual(GAMEPLAY.yaguareteAva.maxGapPx);
      let far = x1 + 1 + gap;
      while (g[e.row][far + 1] === '#') far++;
      // La isla larga: lugar para esquivar (más que dos veces el margen del borde).
      expect((far - (x1 + gap)) * T).toBeGreaterThan(2 * GAMEPLAY.yaguareteAva.ledgeGuardPx);
    }
  });

  it('cada mbói colgante cuelga bajo una isla sólida, sobre un pasillo de 3 filas', () => {
    const snakes = enemies.filter((e) => e.kind === 'mboi_colgante');
    expect(snakes.length).toBe(2);
    for (const e of snakes) {
      const x = Math.floor(e.x);
      expect(g[e.row - 2][x]).toBe('#');
      expect([g[e.row - 1][x], g[e.row][x], g[e.row + 1][x]].join('')).toBe('s..');
      expect(g[e.row + 2][x]).toBe('#');
    }
  });

  it('cada panal cuelga de una plataforma y cada ñakurutu espera en su percha', () => {
    for (const e of enemies.filter((k) => k.kind === 'abejas')) expect(solidTile(Math.floor(e.x), e.row - 2)).toBe(true);
    for (const e of enemies.filter((k) => k.kind === 'nakurutu')) expect(solidTile(Math.floor(e.x), e.row)).toBe(true);
  });
});

describe('Yvága: viento y piezas móviles (S92)', () => {
  const movers = of('Mover').map((m) => ({ ...m, tramo: tramoOf(m.y / T) }));
  const spec = (o: (typeof movers)[number]): MoverSpec => ({
    dx: Number(o.props.dx ?? 0) * T,
    dy: Number(o.props.dy ?? 0) * T,
    speed: Number(o.props.speed ?? GAMEPLAY.mover.speed),
    waitMs: Number(o.props.waitMs ?? GAMEPLAY.mover.waitMs),
    mode: 'loop',
  });
  /** Tiempo (ms) por período en que `a` y `b` esperan quietas, a la misma altura y a un tile de hueco. */
  const sharedWaitMs = (a: (typeof movers)[number], b: (typeof movers)[number]): number => {
    const period = moverTiming(spec(a)).periodMs;
    const ma = new MoverMotor(spec(a));
    const mb = new MoverMotor(spec(b));
    const dt = 1000 / 60;
    let ms = 0;
    for (let t = 0; t < period * 2; t += dt) {
      const near = Math.abs(a.y + ma.offsetY - (b.y + mb.offsetY)) < 1 && Math.abs(a.x + ma.offsetX - (b.x + mb.offsetX)) <= 4 * T + 1;
      if (t >= period && ma.waitLeftMs > 0 && mb.waitLeftMs > 0 && near) ms += dt;
      ma.step(dt);
      mb.step(dt);
    }
    return ms;
  };

  it('el tramo 1 no tiene piezas móviles; el 2, cuatro balsas; el 4, cuatro ascensores; el 7, tres móviles rápidos', () => {
    const inTramo = (k: number) => movers.filter((m) => m.tramo === k);
    expect(inTramo(1)).toHaveLength(0);
    expect(inTramo(2).map((m) => [Number(m.props.dy), Math.abs(Number(m.props.dx))])).toEqual([[0, 11], [0, 11], [0, 11], [0, 11]]);
    expect(inTramo(4).map((m) => [Number(m.props.dx), Math.abs(Number(m.props.dy))])).toEqual([[0, 8], [0, 8], [0, 8], [0, 8]]);
    expect(inTramo(7)).toHaveLength(3);
    for (const m of inTramo(7)) expect(Number(m.props.speed)).toBeGreaterThanOrEqual(80);
    expect(movers).toHaveLength(11);
  });

  it('las balsas de cada par se esperan al medio y los ascensores, de a dos, a la misma altura (más de 1 s)', () => {
    const rafts = movers.filter((m) => m.tramo === 2).sort((a, b) => b.y - a.y || a.x - b.x);
    expect(sharedWaitMs(rafts[0], rafts[1])).toBeGreaterThanOrEqual(1000);
    expect(sharedWaitMs(rafts[2], rafts[3])).toBeGreaterThanOrEqual(1000);
    // La cadena, en el orden en que se sube (de derecha a izquierda: el tramo va en espejo).
    const chain = movers.filter((m) => m.tramo === 4).sort((a, b) => b.x - a.x);
    for (let i = 0; i < chain.length - 1; i++) expect(sharedWaitMs(chain[i], chain[i + 1]), `ascensor ${i + 1} → ${i + 2}`).toBeGreaterThanOrEqual(1000);
  });

  it('dos zonas de viento en el tramo 3, una para cada lado, sin pasto y solo sobre el hueco', () => {
    const zones = of('WindZone');
    expect(zones).toHaveLength(2);
    expect(zones.map((z) => Number(z.props.dir)).sort()).toEqual([-1, 1]);
    for (const z of zones) {
      expect(z.props.grass).toBe(false);
      expect(tramoOf(z.y / T + z.height / T)).toBe(3);
      // La zona termina a la altura de las islas: en sus columnas no hay piso (empujar parada tiraría a Kerana).
      const row = (z.y + z.height) / T;
      const x0 = z.x / T;
      const x1 = x0 + z.width / T - 1;
      for (let x = x0; x <= x1; x++) expect(solidTile(x, row)).toBe(false);
      expect([g[row][x0 - 1], g[row][x1 + 1]]).toEqual(['#', '#']);
      expect(z.width / T).toBeLessThanOrEqual(4);
    }
  });
});

describe('Yvága: el plan del piloto y dónde aterriza cada salto (S92)', () => {
  type Step = { jumpTo?: [number, number]; mover?: [number, number]; double?: boolean; dash?: boolean; floor?: number; fallBack?: number };
  const steps = YVAGA_MAIN.steps as Step[];
  const tramos = YVAGA_TRAMOS as Record<number, number>;
  const tramoOfStep = (i: number) => [7, 6, 5, 4, 3, 2, 1].find((k) => i >= tramos[k])!;
  /** Pieza donde aterriza un salto: las celdas seguidas con piso en esa fila. Una red entera es un piso, no una isla: ahí cuenta el lugar (± 4 tiles). */
  const piece = (x: number, row: number) => {
    let x0 = Math.floor(x);
    let x1 = x0;
    while (solidTile(x0 - 1, row)) x0--;
    while (solidTile(x1 + 1, row)) x1++;
    return x1 - x0 + 1 === W ? { x0: Math.floor(x) - 4, x1: Math.floor(x) + 4, row } : { x0, x1, row };
  };

  it('cada salto del plan cae en una pieza del mapa y cada paso de plataforma nombra una que existe', () => {
    for (const s of steps) {
      if (s.jumpTo) expect([s.jumpTo, solidTile(Math.floor(s.jumpTo[0]), s.jumpTo[1])]).toEqual([s.jumpTo, true]);
      if (s.mover) {
        const [x, y] = s.mover;
        const hit = of('Mover').some((m) => x >= m.x / T && x < (m.x + m.width) / T && y === m.y / T);
        expect([s.mover, hit]).toEqual([s.mover, true]);
      }
    }
  });

  it('ningún enemigo está sobre la pieza donde aterriza un salto obligatorio: ni parado en ella ni a menos de 4 filas por encima', () => {
    const bad: string[] = [];
    for (const s of steps) {
      if (!s.jumpTo) continue;
      const p = piece(s.jumpTo[0], s.jumpTo[1]);
      for (const e of enemies) {
        const def = ENEMIES[e.kind];
        // Un volador se mueve: cuenta todo lo que recorre.
        const reach = def.archetype === 'flyer' ? (def.patrolDistance ?? 0) / T : 0;
        const over = e.x + reach >= p.x0 && e.x - reach <= p.x1 + 1;
        const above = p.row - e.row;
        if (over && above >= 0 && above < 4) bad.push(`${e.kind} (x ${e.x}, fila ${e.row}) sobre la pieza x ${p.x0}-${p.x1}, fila ${p.row}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('el dash recién se pide desde el tramo 5, y el salto doble nunca antes', () => {
    const withDash = steps.flatMap((s, i) => (s.dash ? [tramoOfStep(i)] : []));
    expect(withDash.length).toBeGreaterThanOrEqual(1);
    expect(Math.min(...withDash)).toBe(5);
    for (const [i, s] of steps.entries()) if (s.double) expect(tramoOfStep(i)).toBeGreaterThanOrEqual(5);
  });

  it('el primer salto con dash cruza 12 tiles de aire a la misma altura: el salto doble solo llega a unos 10', () => {
    const i = steps.findIndex((s) => s.dash);
    const [x, row] = steps[i].jumpTo!;
    const landing = piece(x, row);
    // Desde la pieza de llegada hacia donde viene Kerana (el tramo va en espejo: llega desde la derecha).
    let air = 0;
    while (!solidTile(landing.x1 + 1 + air, row) && air < 20) air++;
    expect(air).toBe(12);
  });

  it('cada tramo empieza bajando a su piso y cada paso vuelve ahí si Kerana cae', () => {
    for (const k of [1, 2, 3, 4, 5, 6, 7]) expect(steps[tramos[k]].floor).toBe(floorOf(k));
    for (const [i, s] of steps.entries()) {
      if (s.floor !== undefined) continue;
      expect([i, s.fallBack]).toEqual([i, tramos[tramoOfStep(i)]]);
    }
  });

  it('los parciales del plan son los seis pisos y la antesala', () => {
    expect(YVAGA_MAIN.splits.map((s) => s[2])).toEqual([...[2, 3, 4, 5, 6, 7].map((k) => floorOf(k)), 23]);
  });
});
