import { describe, expect, it } from 'vitest';
import { parseAscii } from '../tools/lib/ascii-map.mjs';
import { GAMEPLAY } from '../src/config/gameplay';
import { GuardMotor, type GuardState } from '../src/entities/enemies/GuardMotor';
import { canAim, LaserBrain, muzzleOf, segmentHitsRect, traceBeam, type SolidAt } from '../src/entities/enemies/jaguaruLaser';
import { paintAim, paintBeam, paintFlash, paintGlow, paintHalo, paintRing } from '../src/entities/enemies/jaguaruLaserArt';
import l6Text from '../tools/levels/l6.txt?raw';
import levelSrc from '../src/scenes/LevelScene.ts?raw';
import guardSrc from '../src/entities/enemies/Guard.ts?raw';

// S117: el rayo de los ojos del Jaguarú (reemplaza a la dentellada de S77).
const J = GAMEPLAY.jaguaru;
const S = J.laser;
const KH = GAMEPLAY.player.bodyHeight;
const KW = GAMEPLAY.player.bodyWidth;
const TILE = 16;
const motor = () =>
  new GuardMotor({ detectRadius: 0, detectHeight: 0, telegraphMs: J.telegraphMs, activeMs: J.activeMs, recoverMs: J.recoverMs, restMs: J.restMs, startMs: 0 });

/** El cuerpo de Kerana con los pies en (x, feet). */
const kerana = (x: number, feet: number) => ({ x: x - KW / 2, y: feet - KH, width: KW, height: KH });
const center = (x: number, feet: number): [number, number] => [x, feet - KH / 2];

/** Un pasillo: piso en y 200 (lo de abajo es sólido), pared en x 400 y, si se pide, un muro en `wallX`. */
const corridor = (wallX?: number): SolidAt => (x, y) => y >= 200 || x >= 400 || (wallX !== undefined && x >= wallX && x < wallX + 16);

/** Corre un ciclo entero (con el cerebro mirando a Kerana en cada paso); `where(t)` dice dónde está ella. */
function runCycle(where: (t: number, s: GuardState) => [number, number], solidAt: SolidAt = corridor(), facing: 1 | -1 = 1, x = 100, feet = 200) {
  const m = motor();
  const b = new LaserBrain(S);
  const cycle = J.restMs + J.telegraphMs + J.activeMs + J.recoverMs;
  let hits = 0;
  let aims = 0;
  let fires = 0;
  const aimsAt: [number, number][] = [];
  for (let t = 0; t <= cycle; t += 10) {
    const s = m.step(t === 0 ? 0 : 10, false);
    const [kx, kf] = where(t, s);
    const [cx, cy] = center(kx, kf);
    const ev = b.update(s, x, feet, facing, cx, cy, solidAt);
    if (ev === 'aim') {
      aims++;
      aimsAt.push([b.ax, b.ay]);
    }
    if (ev === 'fire') fires++;
    if (b.hits(s, kerana(kx, kf))) hits++;
  }
  return { hits, aims, fires, brain: b, aimsAt };
}

describe('Jaguarú, el rayo: cuándo dispara', () => {
  const [mx, my] = [100 + S.muzzle.forward, 200 - S.muzzle.up];

  it('los ojos van delante del cuerpo y a la altura de la cara; mirando a la izquierda, el espejo', () => {
    expect(muzzleOf(100, 200, 1, S)).toEqual({ x: mx, y: my });
    expect(muzzleOf(100, 200, -1, S)).toEqual({ x: 100 - S.muzzle.forward, y: my });
  });

  it('adelante, a la vista y en el alcance: fija la mira', () => {
    expect(canAim(mx, my, 1, mx + 80, 179, S, corridor())).toBe(true);
    expect(canAim(mx, my, 1, mx + S.range - 1, my, S, corridor())).toBe(true);
  });

  it('no dispara fuera del alcance (10 tiles)', () => {
    expect(S.range).toBe(160);
    expect(canAim(mx, my, 1, mx + S.range + 1, my, S, corridor())).toBe(false);
    // También en diagonal: cuenta la distancia, no solo la horizontal.
    expect(canAim(mx, my, 1, mx + 120, my - 120, S, () => false)).toBe(false);
    const r = runCycle(() => [mx + S.range + 20, 200]);
    expect(r).toMatchObject({ aims: 0, fires: 0, hits: 0 });
  });

  it('no dispara sin vista: un muro o un fardo en el medio la tapan', () => {
    expect(canAim(mx, my, 1, mx + 100, 179, S, corridor(mx + 50))).toBe(false);
    const r = runCycle(() => [mx + 100, 200], corridor(mx + 50));
    expect(r).toMatchObject({ aims: 0, fires: 0, hits: 0 });
  });

  it('no gira: detrás de los ojos (o debajo de la cabeza) no dispara', () => {
    expect(canAim(mx, my, 1, mx - 1, 179, S, corridor())).toBe(false);
    expect(canAim(mx, my, -1, mx + 50, 179, S, corridor())).toBe(false);
    const r = runCycle(() => [60, 200]);
    expect(r).toMatchObject({ aims: 0, fires: 0, hits: 0 });
  });

  it('sin mira abre y cierra los ojos igual, sin lastimar aunque ella se ponga delante en el golpe', () => {
    const r = runCycle((_t, s) => (s === 'active' ? [mx + 60, 200] : [mx + 400, 200]));
    expect(r).toMatchObject({ aims: 0, fires: 0, hits: 0 });
  });
});

describe('Jaguarú, el rayo: la mira fija y el daño', () => {
  const [mx] = [100 + S.muzzle.forward];

  it('la mira queda fija donde estaba Kerana al abrir los ojos, aunque ella se mueva', () => {
    const r = runCycle((t) => [mx + 40 + t * 0.02, 200]);
    expect(r.aims).toBe(1);
    expect(r.aimsAt[0][1]).toBe(200 - KH / 2);
    // Al abrir los ojos (a los restMs) estaba en mx + 40 + restMs × 0,02; después siguió caminando.
    expect(r.aimsAt[0][0]).toBeCloseTo(mx + 40 + J.restMs * 0.02, 6);
    expect(r.brain.ax).toBeCloseTo(mx + 40 + J.restMs * 0.02, 6);
  });

  it('quieta: le da una sola vez por ciclo, con daño 2', () => {
    expect(S.damage).toBe(2);
    const r = runCycle(() => [mx + 80, 200]);
    expect(r).toMatchObject({ aims: 1, fires: 1, hits: 1 });
  });

  it('se corrió en el aviso (hacia atrás de él o en el aire durante el golpe): no le da', () => {
    // Pasó detrás de los ojos durante el aviso.
    const past = runCycle((t) => (t <= J.restMs ? [mx + 60, 200] : [mx - 30, 200]));
    expect(past).toMatchObject({ aims: 1, fires: 1, hits: 0 });
    // Saltó (con el salto doble) y estaba en el aire, más arriba que el rayo, todo el golpe.
    const jump = runCycle((_t, s) => (s === 'active' ? [mx + 80, 200 - 40] : [mx + 80, 200]));
    expect(jump).toMatchObject({ aims: 1, fires: 1, hits: 0 });
  });

  it('dos ciclos seguidos: dos golpes (uno por ciclo)', () => {
    const m = motor();
    const b = new LaserBrain(S);
    const cycle = J.restMs + J.telegraphMs + J.activeMs + J.recoverMs;
    let hits = 0;
    const [cx, cy] = center(mx + 60, 200);
    for (let t = 0; t <= cycle * 2; t += 10) {
      const s = m.step(10, false);
      b.update(s, 100, 200, 1, cx, cy, corridor());
      if (b.hits(s, kerana(mx + 60, 200))) hits++;
    }
    expect(hits).toBe(2);
  });

  it('el ciclo dura lo mismo que antes (S77): 2 s cerrados, 0,8 de aviso, 0,5 de rayo, 0,7 al cerrar; con o sin mira', () => {
    expect([J.restMs, J.telegraphMs, J.activeMs, J.recoverMs]).toEqual([2000, 800, 500, 700]);
    for (const near of [true, false]) {
      const m = motor();
      const b = new LaserBrain(S);
      const seen: GuardState[] = [];
      for (let t = 0; t < 4000 * 2; t += 10) {
        const s = m.step(10, false);
        b.update(s, 100, 200, 1, ...(near ? center(mx + 60, 200) : center(mx - 60, 200)), corridor());
        if (seen.at(-1) !== s) seen.push(s);
      }
      expect(seen.slice(0, 5).join()).toBe('idle,telegraph,active,recover,idle');
      expect(m.state).toBe('idle');
    }
  });

  it('el daño 2 pasa por el mismo camino que el de 1 (hurtPlayer: inmunidad, god y retroceso)', () => {
    expect(levelSrc).toContain('if (enemy.projectileHits(this.playerRect)) this.hurtPlayer(enemy.x, enemy.projectileDamage);');
    expect(guardSrc).toContain('return this.laser ? JAGUARU.laser.damage : super.projectileDamage;');
  });
});

describe('Jaguarú, el rayo: por dónde va', () => {
  const [mx, my] = [100 + S.muzzle.forward, 200 - S.muzzle.up];

  it('sigue más allá de la mira y se corta contra la pared', () => {
    const end = traceBeam(mx, my, mx + 50, my, S, corridor());
    expect(end.cut).toBe(true);
    expect(end.x).toBeGreaterThan(400 - 1);
    expect(end.x).toBeLessThanOrEqual(400);
    expect(end.y).toBeCloseTo(my, 6);
  });

  it('bajando, se corta contra el piso', () => {
    const end = traceBeam(mx, my, mx + 40, my + 10, S, corridor());
    expect(end.cut).toBe(true);
    expect(end.y).toBeGreaterThan(199);
    expect(end.y).toBeLessThanOrEqual(200);
  });

  it('sin nada sólido llega a su largo máximo, en el aire', () => {
    const end = traceBeam(mx, my, mx + 50, my, S, () => false);
    expect(end.cut).toBe(false);
    expect(Math.hypot(end.x - mx, end.y - my)).toBeCloseTo(S.maxLength, 6);
  });

  it('el choque con el cuerpo de Kerana: el segmento contra el rectángulo, con el medio grosor del rayo', () => {
    const r = { x: 50, y: 50, width: 10, height: 10 };
    expect(segmentHitsRect(0, 55, 100, 55, r)).toBe(true);
    expect(segmentHitsRect(0, 48.5, 100, 48.5, r)).toBe(false);
    expect(segmentHitsRect(0, 48.5, 100, 48.5, r, 2)).toBe(true);
    expect(segmentHitsRect(0, 55, 40, 55, r)).toBe(false);
    expect(segmentHitsRect(0, 0, 100, 100, r)).toBe(true);
  });
});

describe('Jaguarú, el rayo: el dibujo', () => {
  const A = S.art;
  const colors = new Set([...A.ramp, 0xffffff]);
  const opaque = (img: { width: number; height: number; data: Uint8ClampedArray }) => {
    const out: number[] = [];
    for (let i = 0; i < img.width * img.height; i++) if (img.data[i * 4 + 3] > 0) out.push((img.data[i * 4] << 16) | (img.data[i * 4 + 1] << 8) | img.data[i * 4 + 2]);
    return out;
  };

  it('la rampa: siete tonos de los ojos de hondo a claro y el núcleo casi blanco', () => {
    expect(A.ramp).toHaveLength(8);
    const lum = (c: number) => 0.299 * (c >> 16) + 0.587 * ((c >> 8) & 0xff) + 0.114 * (c & 0xff);
    for (let i = 1; i < A.ramp.length; i++) expect(lum(A.ramp[i])).toBeGreaterThan(lum(A.ramp[i - 1]));
    expect(lum(A.ramp[7])).toBeGreaterThan(240);
  });

  it('el cuerpo del rayo: solo la rampa, núcleo blanco al centro, y las variantes cambian el borde', () => {
    const imgs = Array.from({ length: A.beamVariants }, (_, i) => paintBeam(A, i));
    for (const img of imgs) {
      expect(img.width).toBe(A.beamLength);
      expect(img.height).toBe(A.beamHeight);
      for (const c of opaque(img)) expect(colors.has(c)).toBe(true);
      const mid = (img.height - 1) / 2;
      for (let x = 0; x < img.width; x++) {
        const i = (mid * img.width + x) * 4;
        expect((img.data[i] << 16) | (img.data[i + 1] << 8) | img.data[i + 2]).toBe(A.ramp[7]);
        expect(img.data[i + 3]).toBe(255);
      }
    }
    const edge = (img: (typeof imgs)[number]) => Array.from({ length: img.width }, (_, x) => img.data[x * 4 + 3] + img.data[(img.height - 1) * img.width * 4 + x * 4 + 3]).join();
    expect(new Set(imgs.map(edge)).size).toBe(A.beamVariants);
  });

  it('la mira, el halo, el brillo de los ojos, el destello y el anillo: solo la rampa', () => {
    for (const img of [paintAim(A), paintHalo(A), paintGlow(A), paintFlash(A), paintRing(A)]) {
      const px = opaque(img);
      expect(px.length).toBeGreaterThan(0);
      for (const c of px) expect(colors.has(c)).toBe(true);
    }
  });

  it('los ojos medidos: seis cuadros de attack, dentro del cuadro y en la cabeza', () => {
    expect(A.eyes).toHaveLength(6);
    expect(A.faceEyes).toHaveLength(6);
    A.eyes.forEach((list, f) => {
      expect(A.faceEyes[f]).toBeLessThanOrEqual(list.length);
      for (const [x, y] of list) {
        expect(x).toBeGreaterThan(0);
        expect(x).toBeLessThan(A.frame[0] * 0.4);
        expect(y).toBeGreaterThan(0);
        expect(y).toBeLessThan(A.frame[1] * 0.6);
      }
    });
    // El punto de donde sale el rayo es el centro de los ojos de la cara en el golpe (cuadros 4 y 5).
    const face = [4, 5].flatMap((f) => A.eyes[f].slice(0, A.faceEyes[f]));
    const cx = face.reduce((s, [x]) => s + x, 0) / face.length;
    const cy = face.reduce((s, [, y]) => s + y, 0) / face.length;
    expect((A.frame[0] / 2 - cx) / A.detail).toBeCloseTo(S.muzzle.forward, 0);
    expect((A.frame[1] - cy) / A.detail).toBeCloseTo(S.muzzle.up, 0);
  });
});

describe('Jaguarú, el rayo: los tres de l6', () => {
  const map = parseAscii(l6Text);
  const g: string[] = map.grid;
  const legend = map.enemies as Record<string, string>;
  const facingOf = (map.enemyFacing ?? {}) as Record<string, string>;
  const chars = Object.entries(legend).filter(([, kind]) => kind === 'jaguaru').map(([c]) => c);
  const solidAt: SolidAt = (x, y) => {
    const c = g[Math.floor(y / TILE)]?.[Math.floor(x / TILE)] ?? '#';
    return c === '#' || c === 'B' || c === '%';
  };
  const spots: { x: number; y: number; dir: 1 | -1 }[] = [];
  g.forEach((row, y) => [...row].forEach((c, x) => chars.includes(c) && spots.push({ x, y, dir: facingOf[c] === 'right' ? 1 : -1 })));

  for (const s of spots) {
    const px = (s.x + 0.5) * TILE;
    const feet = (s.y + 1) * TILE;
    const m = muzzleOf(px, feet, s.dir, S);

    it(`x ${s.x}: a Kerana parada delante, en su piso, la ve; el rayo sigue detrás de ella`, () => {
      const kx = m.x + s.dir * 2 * TILE;
      const [cx, cy] = center(kx, feet);
      expect(canAim(m.x, m.y, s.dir, cx, cy, S, solidAt)).toBe(true);
      const end = traceBeam(m.x, m.y, cx, cy, S, solidAt);
      expect((end.x - kx) * s.dir).toBeGreaterThan(TILE);
      // Se corta contra lo sólido (la columna de roca de la peña, el piso de la quebrada y de la cornisa).
      expect(end.cut).toBe(true);
    });

    it(`x ${s.x}: detrás de los ojos, a salvo (se lo pasa con los ojos cerrados y del otro lado no dispara)`, () => {
      const [cx, cy] = center(m.x - s.dir * TILE, feet);
      expect(canAim(m.x, m.y, s.dir, cx, cy, S, solidAt)).toBe(false);
    });
  }
});
