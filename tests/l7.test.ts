import { describe, expect, it } from 'vitest';
import { GAMEPLAY } from '../src/config/gameplay';
import { MoverMotor, type MoverSpec } from '../src/entities/MoverMotor';
import { SwitchBoard, SwitchMotor } from '../src/entities/SwitchMotor';
import { risePx } from '../src/systems/trapLogic';

// l7 · Asunción (S32): la oscuridad como mecánica. Los faroles son disparadores (con `target`, como un Switch; con
// `ms`, se apagan solos), la ronda del farolero (cinco ascensores que llama un farol temporizado), la piedra de la
// torre (solo la onda, por la ventana), el farol de la capilla (pluma C) y las dos reglas: nunca un salto a ciegas y
// nunca quedarse sin forma de volver a encender la luz.

const T = 16;
type Obj = { type: string; x: number; y: number; width: number; height: number; properties?: { name: string; value: unknown }[] };
type TiledMap = { width: number; height: number; layers: { name: string; type: string; data?: number[]; objects?: Obj[] }[] };
const MAPS = import.meta.glob('../public/assets/maps/*.json', { eager: true, import: 'default' }) as Record<string, TiledMap>;
const map = MAPS['../public/assets/maps/l7.json'];
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
const lanterns = objs.filter((o) => o.type === 'Lantern');
const movers = objs.filter((o) => o.type === 'Mover');
const darkZones = objs.filter((o) => o.type === 'DarkZone');
const byId = (id: unknown) => objs.find((o) => (o.type === 'Mover' || o.type === 'Gate') && String(o.props.id) === String(id));
const spec = (o: (typeof objs)[number]): MoverSpec => ({
  dx: Number(o.props.dx ?? 0) * T,
  dy: Number(o.props.dy ?? 0) * T,
  speed: Number(o.props.speed ?? GAMEPLAY.mover.speed),
  waitMs: Number(o.props.waitMs ?? GAMEPLAY.mover.waitMs),
  mode: (o.props.mode as MoverSpec['mode']) ?? 'loop',
});
const inDark = (px: number, py: number) => darkZones.some((z) => px >= z.x && px <= z.x + z.width && py >= z.y && py <= z.y + z.height);
/** Alcance de la luz de la onda desde el centro de Kerana (px). */
const WAVE_REACH = GAMEPLAY.lightWave.offsetPx + GAMEPLAY.lightWave.rangePx + GAMEPLAY.lightWave.width / 2;
/** Alcance del sable desde el centro de Kerana (px): medio cuerpo y la caja del golpe. */
const SWORD_REACH = GAMEPLAY.player.bodyWidth / 2 + GAMEPLAY.attack.hitboxWidth;

describe('l7: los faroles como disparadores (S32)', () => {
  it('cada farol con target nombra una reja o una plataforma que existe', () => {
    const targeted = lanterns.filter((l) => l.props.target !== undefined);
    expect(targeted.length).toBeGreaterThanOrEqual(10);
    for (const l of targeted) expect([String(l.props.target), !!byId(l.props.target)]).toEqual([String(l.props.target), true]);
  });

  it('nunca sin forma de volver a encender: cada farol temporizado está parado sobre un piso (se lo vuelve a tocar)', () => {
    const timed = lanterns.filter((l) => Number(l.props.ms ?? 0) > 0);
    expect(timed.length).toBe(5);
    for (const l of timed) {
      const tx = Math.floor(l.x / T);
      const ty = l.y / T;
      expect([tx, ty, ground(tx, ty) || platforms(tx, ty)]).toEqual([tx, ty, true]);
    }
  });

  it('un farol temporizado que llama a un ascensor (toggle): baja, espera y al apagarse sube con Kerana', () => {
    const board = new SwitchBoard();
    const lamp = new SwitchMotor({ timerMs: 3600, warnMs: GAMEPLAY.switches.warnMs });
    const lift = new MoverMotor({ dx: 0, dy: 9 * T, speed: 60, waitMs: 0, mode: 'toggle' });
    board.addTarget('ronda', lift);
    board.addSwitch('ronda', lamp);
    const dt = 1000 / 60;
    lamp.hit();
    let downAt = -1;
    let leftAt = -1;
    for (let t = 0; t < 8000; t += dt) {
      lamp.step(dt);
      board.update();
      lift.step(dt);
      if (downAt < 0 && lift.pos >= lift.length) downAt = t;
      if (downAt >= 0 && leftAt < 0 && lift.pos < lift.length) leftAt = t;
    }
    // Llega abajo en 2,4 s y espera hasta que el farol se apaga (3,6 s): ≥ 1 s para subirse.
    expect(downAt).toBeGreaterThan(2300);
    expect(downAt).toBeLessThan(2500);
    expect(leftAt - downAt).toBeGreaterThan(1000);
    expect(lift.pos).toBe(0);
  });
});

describe('l7: cada farol se ve natural (S33)', () => {
  const mountOf = (l: (typeof lanterns)[number]) => String(l.props.mount ?? 'post');
  const cell = (l: (typeof lanterns)[number]) => [Math.floor(l.x / T), l.y / T - 1] as const;

  it('el de pie está en la calle: suelo debajo y aire en su tile y el de arriba (el poste no se mete en un muro)', () => {
    for (const l of lanterns.filter((o) => mountOf(o) === 'post')) {
      const [tx, ty] = cell(l);
      const ok = (ground(tx, ty + 1) || platforms(tx, ty + 1)) && !ground(tx, ty) && !ground(tx, ty - 1);
      expect([tx, ty, ok]).toEqual([tx, ty, true]);
    }
  });

  it('el aplique cuelga de un muro que está a su lado; el nicho, dentro de un muro', () => {
    const walls = lanterns.filter((o) => mountOf(o) === 'wall');
    const niches = lanterns.filter((o) => mountOf(o) === 'niche');
    expect([walls.length, niches.length]).toEqual([2, 1]);
    for (const l of walls) {
      const [tx, ty] = cell(l);
      const side = l.props.wall === 'left' ? -1 : 1;
      // El brazo va a la altura del poste (2 tiles), o un poco más arriba sobre una reja.
      const ok = [ty - 1, ty - 2, ty - 3].some((y) => ground(tx, y) || ground(tx + side, y));
      expect([tx, ty, ok]).toEqual([tx, ty, true]);
    }
    for (const l of niches) {
      const [tx, ty] = cell(l);
      expect([tx, ty, ground(tx, ty) && ground(tx, ty - 1)]).toEqual([tx, ty, true]);
    }
  });
});

describe('l7: la ronda del farolero (zona de ritmo, S32)', () => {
  const ronda = [1, 2, 3, 4, 5].map((k) => {
    const lamp = lanterns.find((l) => l.props.target === `ronda${k}`)!;
    const lift = byId(`ronda${k}`)!;
    return { lamp, lift };
  });

  it('cinco ascensores toggle de 9 filas: cada farol da ≥ 1 s para subirse después de que el ascensor llega', () => {
    for (const { lamp, lift } of ronda) {
      const s = spec(lift);
      expect(s.mode).toBe('toggle');
      expect(s.dy).toBe(9 * T);
      const travelMs = (s.dy / s.speed) * 1000;
      expect(Number(lamp.props.ms) - travelMs).toBeGreaterThanOrEqual(1000);
      // El farol está en el rellano de abajo del ascensor (donde se lo espera).
      expect(lamp.y).toBe(lift.y + s.dy);
    }
  });

  it('no se saltea: entre rellanos hay 9 filas y el salto doble sube menos de 8', () => {
    const P = GAMEPLAY.player;
    const rise = risePx([P.jumpVelocity, P.doubleJumpVelocity], GAMEPLAY.gravity, 60);
    expect(rise / T).toBeLessThan(7);
    // Rellanos x 178-186: filas 51, 42, 33 y 24 (y el campanario, 15).
    for (const row of [51, 42, 33, 24]) expect([row, platforms(182, row), platforms(182, row - 1)]).toEqual([row, true, false]);
  });

  it('toda la ronda está a oscuras', () => {
    for (const { lamp } of ronda) expect(inDark(lamp.x, lamp.y - T)).toBe(true);
  });
});

describe('l7: lo que solo enciende la onda (S32)', () => {
  it('la piedra de la torre: desde el andamio el sable no llega; desde el tablón, la onda sí', () => {
    const stone = objs.find((o) => o.type === 'Switch')!;
    expect(String(stone.props.target)).toBe('reja_torre');
    // El andamio llega hasta la pared (x 172): el centro de Kerana, como mucho a medio cuerpo de ella.
    const maxCenter = 172 * T - GAMEPLAY.player.bodyWidth / 2;
    expect(maxCenter + SWORD_REACH).toBeLessThan(stone.x);
    // Parada en el tablón (x 166-168), del lado de la torre.
    expect(168.5 * T + WAVE_REACH).toBeGreaterThan(stone.x);
  });

  it('el farol de la capilla (pluma C): desde el ascensor del ángel, solo la onda', () => {
    const lamp = lanterns.find((l) => l.props.target === 'angel')!;
    const angel = byId('angel')!;
    const zoneLeft = lamp.x - GAMEPLAY.lantern.touchWidth / 2;
    const right = angel.x + angel.width - GAMEPLAY.player.bodyWidth / 2;
    expect(right + SWORD_REACH).toBeLessThan(zoneLeft);
    expect(angel.x + T + WAVE_REACH).toBeGreaterThan(zoneLeft);
    // Está dentro de la capilla (suelo): no se toca.
    expect(ground(Math.floor(lamp.x / T), lamp.y / T - 1)).toBe(true);
  });

  it('el farol del otro lado del pozo: la onda lo enciende desde el borde', () => {
    // Pozo x 350-354; el farol en x 355, a ras del borde de llegada.
    const lamp = lanterns.find((l) => Math.floor(l.x / T) === 355)!;
    expect(349.5 * T + WAVE_REACH).toBeGreaterThan(lamp.x - GAMEPLAY.lantern.touchWidth / 2);
    for (let x = 350; x <= 354; x++) expect(ground(x, 60)).toBe(false);
  });
});

describe('l7: nunca un salto a ciegas (S32)', () => {
  it('en la oscuridad, todo pozo de más de 4 tiles tiene una plataforma que lo cruza o un farol que alumbra la llegada', () => {
    const halo = GAMEPLAY.darkness.haloRadius / T;
    const reach = GAMEPLAY.lantern.radius;
    const bad: string[] = [];
    for (let y = 1; y < map.height; y++) {
      for (let x = 1; x < map.width - 1; x++) {
        // Borde de despegue: piso en (x, y) y nada debajo de (x + 1, y) hasta el fondo.
        if (!ground(x, y) || ground(x, y - 1) || ground(x + 1, y) || !inDark(x * T + T / 2, (y - 1) * T)) continue;
        const pit = (cx: number) => {
          for (let yy = y; yy < map.height; yy++) if (ground(cx, yy) || platforms(cx, yy)) return false;
          return true;
        };
        if (!pit(x + 1)) continue;
        let end = x + 1;
        while (end < map.width && pit(end)) end++;
        const width = end - x - 1;
        if (width <= halo - 0.5 || !ground(end, y)) continue;
        // Las plataformas de esa fila cubren el pozo, con huecos de hasta 3 tiles entre una y otra.
        const covered = new Set<number>();
        for (const m of movers.filter((mm) => mm.y / T === y)) {
          const s = spec(m);
          for (let cx = m.x / T + Math.min(0, s.dx / T); cx < m.x / T + m.width / T + Math.max(0, s.dx / T); cx++) covered.add(cx);
        }
        let run = 0;
        let crossed = covered.size > 0;
        for (let cx = x + 1; cx < end && crossed; cx++) {
          run = covered.has(cx) ? 0 : run + 1;
          if (run > 3) crossed = false;
        }
        const lit = lanterns.some((l) => Math.hypot(l.x - (end + 0.5) * T, l.y - T * 2 - y * T) <= reach);
        if (!crossed && !lit) bad.push(`x ${x + 1}-${end - 1} fila ${y}`);
      }
    }
    expect(bad).toEqual([]);
  });
});
