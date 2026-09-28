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
  pickLitStar,
  smokeHurts,
  TAU_ECHOES,
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
  it('Yvága es solo la arena final, fuera del mapa del mundo', () => {
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
