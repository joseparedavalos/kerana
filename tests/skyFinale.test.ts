import { describe, expect, it } from 'vitest';
import { PLATFORM_TILES } from '../src/assets/manifest';
import { GAMEPLAY } from '../src/config/gameplay';
import { LEVELS } from '../src/data/levels';
import { paintMoverGlow, platformPieces } from '../src/entities/moverLook';
import { paintCrystalStar, starAtlasFrames, twinkleAt } from '../src/entities/bosses/tauStarPaint';
import { paintWisp, wispAtlasFrames } from '../src/entities/hazards/windWispPaint';
import { backdropClimbTop } from '../src/systems/backdropLogic';
import { alphaAt, type Pixels } from '../src/systems/pixelArt';
import { driftAtlasFrames } from '../src/systems/skyDriftPaint';
import { altitudeAt, backdropRowBehind, driftPosition, planDriftClouds, shootingGap, shootingPoseAt } from '../src/systems/skyDriftLogic';

// S118: lo que se mueve en Yvága y su cielo: la losa móvil con su brillo (solo en el cielo), las estrellas de cristal de
// Tau (titilan desfasadas; la encendida, dorada), los jirones del viento, las capas de nubes con parallax (entre el fondo
// y lo jugable, del color de lo que tienen detrás) y las estrellas fugaces (cada 10 a 20 s, solo en la noche).

const lum = (p: Pixels) => {
  let s = 0;
  for (let i = 0; i < p.data.length; i += 4) s += (p.data[i] + p.data[i + 1] + p.data[i + 2]) * (p.data[i + 3] / 255);
  return s;
};

describe('la losa móvil del cielo (S118)', () => {
  it('las piezas vienen de donde diga el bioma; sin aspecto propio, las 16 a 18 de siempre', () => {
    expect(platformPieces(48, 16)).toEqual([PLATFORM_TILES.left, PLATFORM_TILES.center, PLATFORM_TILES.right]);
    expect(platformPieces(48, 16, { left: 113, center: 114, right: 115 })).toEqual([113, 114, 115]);
    expect(platformPieces(16, 16, { left: 113, center: 114, right: 115 })).toEqual([114]);
    expect(Object.keys(GAMEPLAY.mover.looks)).toEqual(['cielo']);
  });

  it('el brillo de abajo: más ancho que la losa, denso arriba al centro y transparente en el borde', () => {
    const look = GAMEPLAY.mover.looks.cielo.glow;
    const p = paintMoverGlow(48, look);
    expect([p.width, p.height]).toEqual([48 + look.pad * 2, look.height]);
    expect(alphaAt(p, p.width >> 1, 1)).toBeGreaterThan(alphaAt(p, p.width >> 1, p.height - 2));
    expect(alphaAt(p, 0, p.height - 1)).toBe(0);
    for (let i = 3; i < p.data.length; i += 4) expect(p.data[i]).toBeLessThanOrEqual(255 * 0.5);
  });
});

describe('las estrellas de cristal de Tau (S118)', () => {
  const L = GAMEPLAY.tau.starLook;

  it('cinco puntas a 2 píxeles por unidad, del tamaño de la estrella de antes; la encendida, mucho más brillante', () => {
    const idle = paintCrystalStar(L.idle);
    const lit = paintCrystalStar(L.lit);
    expect(idle.width).toBe(Math.ceil(L.outer * L.detail * 2) + 3);
    // Contorno oscuro y corazón claro.
    const c = idle.width >> 1;
    expect(alphaAt(idle, c, c)).toBe(255);
    expect(alphaAt(idle, 0, 0)).toBe(0);
    const frames = starAtlasFrames();
    const halo = (n: string) => frames.find((f) => f.name === n)!.px;
    expect(lum(halo('halo_lit'))).toBeGreaterThan(lum(halo('halo_idle')) * 4);
    expect(lum(lit)).toBeGreaterThan(0);
  });

  it('titilan desfasadas: en ningún momento titilan todas juntas, y cada una titila', () => {
    const peaks = Array.from({ length: 7 }, () => 0);
    for (let t = 0; t < 20000; t += 20) {
      const on = Array.from({ length: 7 }, (_, i) => twinkleAt(i, t));
      on.forEach((v, i) => (peaks[i] = Math.max(peaks[i], v)));
      expect(on.filter((v) => v > 0.5).length).toBeLessThan(4);
    }
    for (const p of peaks) expect(p).toBeGreaterThan(0.9);
  });

  it('no cambian dónde están: las siete casillas de siempre', () => {
    expect(GAMEPLAY.tau.starTiles).toHaveLength(7);
    expect(GAMEPLAY.tau.starTiles).toEqual([
      [3, 20],
      [9, 17],
      [15, 14],
      [21, 17],
      [27, 14],
      [31, 17],
      [35, 20],
    ]);
  });
});

describe('los jirones del viento (S118)', () => {
  it('tiras de nube más gruesas al frente, semitransparentes, de los tamaños de la configuración', () => {
    const W = GAMEPLAY.wind.wisps;
    expect(wispAtlasFrames()).toHaveLength(W.sizes.length);
    for (let i = 0; i < W.sizes.length; i++) {
      const p = paintWisp(i);
      expect([p.width, p.height]).toEqual([...W.sizes[i]]);
      const col = (x: number) => Array.from({ length: p.height }, (_, y) => alphaAt(p, x, y)).filter((a) => a > 0).length;
      expect(col(Math.round(p.width * 0.75))).toBeGreaterThanOrEqual(col(Math.round(p.width * 0.1)));
      for (let k = 3; k < p.data.length; k += 4) expect(p.data[k]).toBeLessThan(255);
    }
  });
});

describe('el cielo vivo de Yvága (S118)', () => {
  const D = GAMEPLAY.backdrop.skyDrift;
  // El mapa de Yvága: 278 filas; la vista, 360 de alto; el fondo recorre 772.
  const travel = 278 * 16 - 360;
  const climb = 772;
  const clouds = planDriftClouds(D, travel, climb, 640, 360, D.seed);

  it('solo Yvága lo usa; siempre las mismas nubes', () => {
    const using = Object.values(LEVELS).filter((l) => l?.backgrounds.skyDrift);
    expect(using.map((l) => l!.id)).toEqual(['yvaga']);
    expect(planDriftClouds(D, travel, climb, 640, 360, D.seed)).toEqual(clouds);
    expect(clouds.length).toBeGreaterThan(30);
  });

  it('cada capa baja con la subida más rápido que el fondo y más despacio que el mundo', () => {
    const bg = climb / travel;
    D.layers.forEach((layer, li) => {
      expect(layer.parallax).toBeGreaterThan(bg);
      expect(layer.parallax).toBeLessThan(1);
      const c = clouds.find((q) => q.layer === li)!;
      const a = driftPosition(c, layer, 100, 0, 2000, travel, 640, 0);
      const b = driftPosition(c, layer, 100, 0, 1900, travel, 640, 0);
      expect(b.y - a.y).toBeCloseTo(100 * layer.parallax, 5);
      // Corre de costado con el tiempo y da la vuelta sin salir del lazo.
      for (let t = 0; t < 200000; t += 7919) {
        const p = driftPosition(c, layer, 100, 0, 2000, travel, 640, t);
        expect(p.x).toBeGreaterThanOrEqual(-120);
        expect(p.x).toBeLessThanOrEqual(660);
      }
    });
  });

  it('cada nube es del color de lo que tiene detrás: abajo el mar de nubes, arriba la noche (y menos)', () => {
    for (const c of clouds) {
      const row = backdropRowBehind(c.y, D.layers[c.layer].parallax, travel, climb, 360);
      expect(c.altitude).toBe(altitudeAt(row, D.bands));
    }
    const count = (alt: string) => clouds.filter((c) => c.altitude === alt).length;
    expect(count('low')).toBeGreaterThan(count('high'));
    expect(count('high')).toBeGreaterThan(0);
    // Con la cámara en la base, detrás del medio de la vista está el mar de nubes; en la arena, la noche.
    expect(altitudeAt(180 - backdropClimbTop(travel, travel, climb, 0), D.bands)).toBe('low');
    expect(altitudeAt(180 - backdropClimbTop(0, travel, climb, 0), D.bands)).toBe('high');
    // Un cuadro por altura y forma, más la estrella fugaz.
    const frames = driftAtlasFrames();
    expect(frames).toHaveLength(Object.values(D.sizes).reduce((s, l) => s + l.length, 0) + 1);
    for (const f of frames.slice(0, -1)) {
      // Las puntas se afinan: la primera y la última columna, vacías.
      for (let y = 0; y < f.px.height; y++) {
        expect(alphaAt(f.px, 0, y)).toBe(0);
        expect(alphaAt(f.px, f.px.width - 1, y)).toBe(0);
      }
    }
  });

  it('estrellas fugaces: cada 10 a 20 s, solo con noche a la vista, adentro de la franja', () => {
    const S = D.shooting;
    for (let n = 0; n < 50; n++) {
      const gap = shootingGap(S, n, D.seed);
      expect(gap).toBeGreaterThanOrEqual(10000);
      expect(gap).toBeLessThanOrEqual(20000);
    }
    expect(shootingPoseAt(S, 3, 100, 0, 40, 640, D.seed)).toBeNull();
    expect(shootingPoseAt(S, 3, -1, 0, 360, 640, D.seed)).toBeNull();
    expect(shootingPoseAt(S, 3, S.durationMs, 0, 360, 640, D.seed)).toBeNull();
    for (let n = 0; n < 20; n++) {
      const p = shootingPoseAt(S, n, 1, 20, 220, 640, D.seed)!;
      expect(p.y).toBeGreaterThanOrEqual(20);
      expect(p.y).toBeLessThan(220);
      expect(p.x).toBeGreaterThan(0);
      expect(p.x).toBeLessThan(640);
    }
  });
});
