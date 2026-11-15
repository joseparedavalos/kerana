import { describe, expect, it } from 'vitest';
import { GAMEPLAY } from '../src/config/gameplay';
import { parseLevelParam } from '../src/config/debug';
import { getBossDef, TAU_HP } from '../src/data/bosses';
import { getLevel, WORLD_LEVELS } from '../src/data/levels';
import { ENDING_SLIDES, endingSlides, FEATHERS_SLIDE, TAU_ARRIVAL_SLIDES } from '../src/data/story';
import { BossBrain, phaseIndexFor } from '../src/entities/bosses/BossBrain';
import {
  echoOf,
  echoRockXs,
  farSide,
  floatsOutOfReach,
  formForPhase,
  floatBottom,
  pickLitStar,
  pullSpot,
  smokeHurts,
  TAU_ECHOES,
  type StarBox,
} from '../src/entities/bosses/tauLogic';

const def = getBossDef('tau');

describe('Tau: fases (GDD §7)', () => {
  it('21 de vida en 3 fases de 7', () => {
    expect(def.hp).toBe(TAU_HP);
    expect(def.phases).toHaveLength(3);
    expect(phaseIndexFor(21, 21, def.phases)).toBe(0);
    expect(phaseIndexFor(15, 21, def.phases)).toBe(0);
    expect(phaseIndexFor(14, 21, def.phases)).toBe(1);
    expect(phaseIndexFor(8, 21, def.phases)).toBe(1);
    expect(phaseIndexFor(7, 21, def.phases)).toBe(2);
    expect(phaseIndexFor(1, 21, def.phases)).toBe(2);
  });

  it('cada fase es una forma: disfraz, ecos y forma real', () => {
    expect([0, 1, 2].map(formForPhase)).toEqual(['disguise', 'echoes', 'true']);
    expect(formForPhase(5)).toBe('true');
  });

  it('el cerebro pasa de fase con el daño y queda vencido al llegar a 0', () => {
    const brain = new BossBrain(def, { rng: () => 0 });
    brain.start();
    expect(brain.damage(7)).toEqual({ phaseChanged: true, defeated: false });
    expect(brain.phase).toBe(1);
    expect(brain.damage(7)).toEqual({ phaseChanged: true, defeated: false });
    expect(brain.phase).toBe(2);
    expect(brain.damage(7).defeated).toBe(true);
  });

  it('fase 1: notas y melodía; fase 2: tres ecos; fase 3: humo y rayos', () => {
    expect(def.phases[0].attacks.map((a) => a.id).sort()).toEqual(['melody', 'notes']);
    expect(def.phases[1].attacks.every((a) => echoOf(a.id) !== null)).toBe(true);
    expect(def.phases[2].attacks.map((a) => a.id).sort()).toEqual(['bolts', 'smoke']);
  });

  it('los ecos son de tres hijos distintos, jefes que ya existen', () => {
    const kids = def.phases[1].attacks.map((a) => echoOf(a.id));
    expect(new Set(kids).size).toBe(3);
    for (const kid of kids) expect(getBossDef(kid!)).toBeDefined();
    expect(Object.keys(TAU_ECHOES)).toHaveLength(3);
    expect(echoOf('notes')).toBeNull();
  });

  it('cada fase tiene al menos una ventana para golpearlo', () => {
    for (const phase of def.phases) expect(phase.attacks.some((a) => a.punishable ?? true)).toBe(true);
  });

  it('en la fase 3, la ventana llega después del humo (lo baja la estrella)', () => {
    const brain = new BossBrain(def, { rng: () => 0 });
    brain.start();
    brain.damage(14);
    let t = brain.step(brain.msLeft);
    expect(t?.state).toBe('telegraph');
    expect(t?.attack?.id).toBe('smoke');
    t = brain.step(t!.attack!.telegraphMs);
    expect(t?.state).toBe('active');
    expect(brain.vulnerable).toBe(false);
    t = brain.step(brain.attack!.activeMs);
    expect(t?.state).toBe('recover');
    expect(brain.vulnerable).toBe(true);
  });

  it('flota fuera del alcance en las fases 2 y 3, salvo en la ventana', () => {
    expect(floatsOutOfReach('disguise', 'telegraph')).toBe(false);
    expect(floatsOutOfReach('echoes', 'active')).toBe(true);
    expect(floatsOutOfReach('echoes', 'recover')).toBe(false);
    expect(floatsOutOfReach('true', 'idle')).toBe(true);
  });
});

describe('Tau: estrellas, humo y ecos', () => {
  const stars = [100, 200, 300];

  it('se enciende la estrella más cercana a Kerana, sin repetir', () => {
    expect(pickLitStar(stars, 190)).toBe(1);
    expect(pickLitStar(stars, 190, 1)).not.toBe(1);
    expect(pickLitStar([50], 400, 0)).toBe(0);
  });

  it('el humo daña en las nubes, no sobre las estrellas', () => {
    expect(smokeHurts(368, 336)).toBe(true);
    expect(smokeHurts(320, 336)).toBe(false);
  });

  it('las rocas del eco de Teju Jagua caen alrededor de Kerana, dentro de la arena', () => {
    const xs = echoRockXs(100, 4, 48, 80, 600);
    expect(xs).toHaveLength(4);
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(80);
    expect(xs[3] - xs[2]).toBe(48);
  });

  it('en la fase 1 cambia al lado más lejano de Kerana', () => {
    expect(farSide(100, 50, 500)).toBe(500);
    expect(farSide(450, 50, 500)).toBe(50);
  });

  it('las siete estrellas caben en la arena y ninguna pide saltar más de 3 tiles', () => {
    const cfg = GAMEPLAY.tau;
    expect(cfg.starTiles).toHaveLength(7);
    const floorRow = 23;
    let prevRow = floorRow;
    for (const [x, row] of cfg.starTiles) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x + cfg.starWidthTiles).toBeLessThanOrEqual(40);
      expect(row).toBeLessThan(floorRow - cfg.smokeTiles);
      expect(Math.abs(prevRow - row)).toBeLessThanOrEqual(3);
      prevRow = row;
    }
  });
});

describe('Flujo y final (GDD §2.6, §6.8, §7)', () => {
  it('Yvága (la subida y la arena final) queda fuera del mapa del mundo', () => {
    const yvaga = getLevel('yvaga');
    expect(yvaga.boss).toBe('tau');
    expect(yvaga.finale).toBe(true);
    expect(WORLD_LEVELS.map((l) => l.id)).not.toContain('yvaga');
    expect(WORLD_LEVELS).toHaveLength(7);
    expect(parseLevelParam('yvaga')).toBe('yvaga');
    expect(parseLevelParam('8')).toBe('yvaga');
  });

  it('al liberar a Luisón, Eichu y Mainumby anuncian a Tau', () => {
    expect(TAU_ARRIVAL_SLIDES.map((s) => s.textKey)).toContain('story.tau.mainumby');
  });

  it('sin las 21 plumas, el final verdadero sin la diapositiva extra', () => {
    const slides = endingSlides(20, 21);
    expect(slides).toHaveLength(ENDING_SLIDES.length);
    expect(slides.map((s) => s.textKey)).toContain('story.final.sealed');
    expect(slides.map((s) => s.textKey)).toContain('story.final.spring');
  });

  it('con las 21 plumas, una diapositiva extra de Kerana y Mainumby', () => {
    const slides = endingSlides(21, 21);
    expect(slides).toHaveLength(ENDING_SLIDES.length + 1);
    expect(slides[slides.length - 1]).toBe(FEATHERS_SLIDE);
  });
});

describe('Tau crece en cada fase (S94)', () => {
  const cfg = GAMEPLAY.tau;
  const TILE = 16;
  // Arena de tools/levels/yvaga.txt, relativa a su esquina: 40 tiles de ancho y el piso en la fila 23. Peleando, la
  // cámara va de y 0 a 384 (CameraFloor) con una vista de 360: lo más bajo que llega el borde de arriba es y 24.
  const ARENA_W = 40 * TILE;
  const FLOOR_Y = 23 * TILE;
  const VIEW_TOP = 384 - 360;
  // Sprites (public/assets/sprites/*.json): disfraz 64 × 68 y forma real 88 × 80, detail 2.
  const DISGUISE_H = 68 / 2;
  const [ox, oy] = GAMEPLAY.sprites.tauTrue.origin;
  const k3 = cfg.phaseScale[2];
  const ext = {
    halfW: Math.max(cfg.trueWidth / 2, (Math.max(ox, 1 - ox) * 88) / 2) * k3,
    above: Math.max(cfg.trueHeight / 2, (oy * 80) / 2) * k3,
    below: Math.max(cfg.trueHeight / 2, ((1 - oy) * 80) / 2) * k3,
  };
  const stars: StarBox[] = cfg.starTiles.map(([x, row]) => ({ left: x * TILE, right: (x + cfg.starWidthTiles) * TILE, top: row * TILE }));
  /** ¿El rectángulo tapa una estrella o el lugar de Kerana parada sobre ella? */
  const coversStar = (left: number, right: number, bottom: number) =>
    stars.some((s) => s.left < right && s.right > left && bottom > s.top - cfg.trueClearPx);

  it('fase 1 igual, la 2 al doble y la 3 al triple: solo enteros', () => {
    expect(cfg.phaseScale).toEqual([1, 2, 3]);
    for (const k of cfg.phaseScale) expect(Number.isInteger(k)).toBe(true);
  });

  it('fase 2: flotando no tapa las estrellas ni la corta el borde de arriba', () => {
    const feet = FLOOR_Y - cfg.floatTiles * TILE;
    const top = feet - DISGUISE_H * cfg.phaseScale[1];
    expect(top).toBeGreaterThanOrEqual(VIEW_TOP);
    // La estrella se dibuja 7 px alrededor de su punto, 1 px sobre la plataforma.
    expect(feet).toBeLessThan(Math.min(...stars.map((s) => s.top)) - 8);
  });

  it('fase 3: flotando queda entero en la vista y por encima de las siete estrellas', () => {
    const bottom = floatBottom(stars, cfg.trueClearPx);
    const center = bottom - ext.below;
    expect(center - ext.above).toBeGreaterThanOrEqual(VIEW_TOP);
    // Pasa sobre cualquier lugar de las nubes (GAMEPLAY.tau.floorTiles) sin tapar ninguna.
    for (let x = cfg.floorTiles[0] * TILE; x <= cfg.floorTiles[1] * TILE; x += 4) {
      expect(coversStar(x - ext.halfW, x + ext.halfW, bottom)).toBe(false);
      expect(x - ext.halfW).toBeGreaterThanOrEqual(0);
      expect(x + ext.halfW).toBeLessThanOrEqual(ARENA_W);
    }
  });

  it('fase 3: el rayo de cada estrella lo baja sobre ella, sin tapar ninguna y al alcance de un salto', () => {
    const jumpReach = 115; // salto y salto doble: 400² / 2400 + 340² / 2400 ≈ 115 px (GAMEPLAY.player)
    stars.forEach((star, i) => {
      const { x, y } = pullSpot(stars, i, ext, cfg.trueClearPx, 0, ARENA_W, cfg.pullOverlapPx);
      const left = x - ext.halfW;
      const right = x + ext.halfW;
      const bottom = y + ext.below;
      expect(left).toBeGreaterThanOrEqual(0);
      expect(right).toBeLessThanOrEqual(ARENA_W);
      expect(y - ext.above).toBeGreaterThanOrEqual(VIEW_TOP);
      expect(coversStar(left, right, bottom)).toBe(false);
      // Montado sobre la encendida, y Kerana parada en ella le llega saltando con el tajo (18 px de alto).
      expect(Math.min(right, star.right) - Math.max(left, star.left)).toBeGreaterThanOrEqual(cfg.pullOverlapPx);
      expect(star.top - bottom).toBeLessThan(jumpReach + 18);
      // Más bajo que flotando, salvo en las más altas, donde ya está lo más bajo posible.
      expect(bottom).toBeGreaterThanOrEqual(floatBottom(stars, cfg.trueClearPx));
    });
  });
});
