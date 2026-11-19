import { describe, expect, it } from 'vitest';
import { backdropClimbHeight, backdropClimbTop, backdropFit, backdropPanX, backdropTint, caveSpan, flockLayout, flockLeadX, flockSpread, glintAlpha, glintRuns, pickGlint, shadowLeft, sunPulse } from '../src/systems/backdropLogic';
import { GAMEPLAY } from '../src/config/gameplay';
import { LEVELS } from '../src/data/levels';

describe('fondo del nivel', () => {
  it('se desplaza de 0 a -margen según el avance, sin pasarse', () => {
    expect(backdropPanX(0, 1000, 80, 1)).toBe(0);
    expect(backdropPanX(500, 1000, 80, 1)).toBe(-40);
    expect(backdropPanX(1000, 1000, 80, 1)).toBe(-80);
    expect(backdropPanX(1500, 1000, 80, 1)).toBe(-80);
    expect(backdropPanX(-10, 1000, 80, 1)).toBe(0);
    expect(backdropPanX(1000, 1000, 80, 0.5)).toBe(-40);
  });

  it('queda quieto si el nivel cabe en la vista', () => {
    expect(backdropPanX(0, 0, 80, 1)).toBe(0);
  });

  it('el brillo oscurece y se multiplica por el ambiente', () => {
    expect(backdropTint(1)).toBe(0xffffff);
    expect(backdropTint(0.5)).toBe(0x808080);
    expect(backdropTint(1, 0x4a4e6e)).toBe(0x4a4e6e);
    expect(backdropTint(2)).toBe(0xffffff);
  });

  it('el ajuste vertical sube la imagen y la agranda si destaparía el borde', () => {
    const centered = backdropFit(360, 1.1, 0);
    expect(centered.scale).toBe(1.1);
    expect(centered.top).toBeCloseTo(-18);
    const up = backdropFit(360, 1.1, 10);
    expect(up.top).toBeCloseTo(-28);
    const far = backdropFit(360, 1.1, 40);
    expect(far.top).toBeCloseTo(-58);
    expect(far.scale).toBeCloseTo(418 / 360);
    // El borde de abajo sigue cubriendo la vista.
    expect(far.top + 360 * far.scale).toBeCloseTo(360);
    // Hacia abajo: el borde de arriba queda pegado a la vista.
    const down = backdropFit(360, 1.1, -40);
    expect(down.top).toBeCloseTo(0);
    expect(down.scale).toBeCloseTo(418 / 360);
  });

  it('la cueva se ve solo en su tramo de la vista', () => {
    const caves = [
      { x: 0, width: 720 },
      { x: 1888, width: 1952 },
    ];
    expect(caveSpan(0, 640, caves)).toEqual({ left: 0, right: 720 });
    expect(caveSpan(400, 640, caves)).toEqual({ left: -400, right: 320 });
    expect(caveSpan(1000, 640, caves)).toBeNull();
    expect(caveSpan(1500, 640, caves)).toEqual({ left: 388, right: 2340 });
  });

  // S92: el fondo de una subida (Yvága) es más alto que la vista y se recorre entero.
  it('una imagen vertical va al ancho de la vista sin deformarse', () => {
    expect(backdropClimbHeight(1280, 2264, 640)).toBe(1132);
    expect(backdropClimbHeight(1280, 720, 640)).toBe(360);
    expect(backdropClimbHeight(0, 720, 640)).toBe(0);
  });

  it('en una subida, abajo del nivel se ve el pie de la imagen y arriba, el tope', () => {
    const travel = 1132 - 360;
    const maxViewY = 270 * 16 - 360;
    // Arriba (la arena): el tope de la imagen pegado al borde de arriba de la vista.
    expect(backdropClimbTop(0, maxViewY, travel)).toBe(0);
    // Abajo (la base): el pie de la imagen pegado al borde de abajo de la vista.
    expect(backdropClimbTop(maxViewY, maxViewY, travel)).toBe(-travel);
    expect(backdropClimbTop(maxViewY, maxViewY, travel) + 1132).toBe(360);
    // A mitad de camino, la mitad; nunca se pasa de las puntas (no destapa ni arriba ni abajo).
    expect(backdropClimbTop(maxViewY / 2, maxViewY, travel)).toBe(-travel / 2);
    expect(backdropClimbTop(-50, maxViewY, travel)).toBe(0);
    expect(backdropClimbTop(maxViewY + 50, maxViewY, travel)).toBe(-travel);
  });

  it('en una subida el fondo siempre cubre la vista y avanza a pasos de un píxel del lienzo', () => {
    const travel = 772;
    const maxViewY = 3960;
    let last = 1;
    for (let viewY = 0; viewY <= maxViewY; viewY += 7) {
      const top = backdropClimbTop(viewY, maxViewY, travel);
      expect(top).toBeLessThanOrEqual(0);
      expect(top + 1132).toBeGreaterThanOrEqual(360);
      expect(Number.isInteger(top * 2)).toBe(true);
      // Subir (viewY baja) nunca hace bajar el cielo: es monótono.
      expect(top).toBeLessThanOrEqual(last);
      last = top;
    }
  });

  it('una imagen que no es más alta que la vista no se desplaza', () => {
    expect(backdropClimbTop(1000, 3960, 0)).toBe(0);
    expect(backdropClimbTop(1000, 3960, -20)).toBe(0);
  });
});

describe('el sol de l2 (S96)', () => {
  const sun = GAMEPLAY.backdrop.sun;

  it('el halo respira: mínimo al empezar, máximo a mitad del ciclo, y vuelve', () => {
    expect(sunPulse(0, 5000)).toBeCloseTo(0);
    expect(sunPulse(2500, 5000)).toBeCloseTo(1);
    expect(sunPulse(5000, 5000)).toBeCloseTo(0);
    expect(sunPulse(1250, 5000)).toBeCloseTo(0.5);
    expect(sun.periodMs).toBeGreaterThanOrEqual(4000);
    expect(sun.periodMs).toBeLessThanOrEqual(6000);
  });

  it('un destello sube y baja, y está apagado fuera de su vida', () => {
    expect(glintAlpha(-0.1)).toBe(0);
    expect(glintAlpha(0)).toBe(0);
    expect(glintAlpha(0.5)).toBeCloseTo(1);
    expect(glintAlpha(1)).toBe(0);
  });

  it('las tiras doradas salen de los píxeles del reflejo, dentro de la región', () => {
    // 10 × 3: fila 1 con oro en x 2-5 y en x 8 (solo, no alcanza), fila 2 con oro en x 0-9 (afuera de la región en x 7+).
    const w = 10;
    const data = new Uint8ClampedArray(w * 3 * 4);
    const gold = (x: number, y: number) => data.set([250, 200, 120, 255], (y * w + x) * 4);
    for (let x = 2; x <= 5; x++) gold(x, 1);
    gold(8, 1);
    for (let x = 0; x < 10; x++) gold(x, 2);
    const runs = glintRuns(data, w, [1, 1, 7, 3], 235, 170, 2);
    expect(runs).toEqual([2, 1, 4, 1, 2, 6]);
  });

  it('un destello cae entero sobre una tira y mide de 2 a 6 px', () => {
    const runs = [10, 5, 3, 20, 6, 12];
    const out = { x: 0, y: 0, width: 0 };
    for (let i = 0; i < 200; i++) {
      const r = (k: number) => ((i * 37 + k * 101) % 97) / 97;
      expect(pickGlint(runs, sun.glints.widthMin, sun.glints.widthMax, r(1), r(2), r(3), out)).toBe(true);
      const k = runs.findIndex((_, j) => j % 3 === 1 && runs[j] === out.y) - 1;
      expect(out.width).toBeGreaterThanOrEqual(Math.min(2, runs[k + 2]!));
      expect(out.width).toBeLessThanOrEqual(6);
      expect(out.x).toBeGreaterThanOrEqual(runs[k]!);
      expect(out.x + out.width).toBeLessThanOrEqual(runs[k]! + runs[k + 2]!);
    }
    expect(pickGlint([], 2, 6, 0.5, 0.5, 0.5, out)).toBe(false);
  });

  it('solo l2 tiene sol, y el reflejo queda debajo del sol', () => {
    const withSun = Object.values(LEVELS).filter((l) => l.backgrounds.sun);
    expect(withSun.map((l) => l.id)).toEqual(['l2']);
    const s = withSun[0]!.backgrounds.sun!;
    const [x0, y0, x1, y1] = s.reflection;
    expect(x0).toBeLessThan(s.at[0]);
    expect(x1).toBeGreaterThan(s.at[0]);
    expect(y0).toBeGreaterThan(s.at[1]);
    expect(y1).toBeGreaterThan(y0);
    expect(sun.glints.widthMin).toBe(2);
    expect(sun.glints.widthMax).toBe(6);
  });
});

describe('pájaros y sombras de nubes de l3 (S98)', () => {
  const life = GAMEPLAY.backdrop.skyLife;
  const b = life.birds;

  it('la V: el guía adelante, las alas alternando arriba y abajo, cada fila más atrás', () => {
    const out = Array.from({ length: 7 }, () => ({ back: 0, dy: 0, phase: 0 }));
    flockLayout(7, 8, 3, 0, () => 0.5, out);
    expect(out[0]).toMatchObject({ back: 0, dy: 0 });
    expect(out.map((s) => s.back)).toEqual([0, 8, 8, 16, 16, 24, 24]);
    expect(out.map((s) => s.dy)).toEqual([0, -3, 3, -6, 6, -9, 9]);
  });

  it('la bandada entera cabe en la franja del cielo, arriba de las sierras', () => {
    const sky = LEVELS.l3!.backgrounds.skyLife!.birds;
    const spread = flockSpread(b.countMax, b.spacingY, b.jitter, b.bob) + 2;
    expect(sky[1] - sky[0]).toBeGreaterThanOrEqual(2 * spread);
    // Sierras desde y 349 (medido en l3_far.jpg).
    expect(sky[1]).toBeLessThan(349);
    expect(b.countMin).toBeGreaterThanOrEqual(3);
    expect(b.countMax).toBeLessThanOrEqual(7);
    expect(b.sizeMin).toBeGreaterThanOrEqual(3);
    expect(b.sizeMax).toBeLessThanOrEqual(5);
  });

  it('el guía cruza de afuera de un borde a afuera del otro, en los dos sentidos', () => {
    expect(flockLeadX(0, 1, 1280, 40)).toBe(-40);
    expect(flockLeadX(1, 1, 1280, 40)).toBe(1320);
    expect(flockLeadX(0, -1, 1280, 40)).toBe(1320);
    expect(flockLeadX(1, -1, 1280, 40)).toBe(-40);
    expect(flockLeadX(0.5, 1, 1280, 40)).toBe(640);
    // La cola (la última fila de la V) también queda afuera al empezar.
    expect(b.margin).toBeGreaterThanOrEqual(Math.ceil((b.countMax - 1) / 2) * (b.spacingX + b.jitter) + b.sizeMax);
  });

  it('una sombra cruza entera y vuelve a entrar por la izquierda', () => {
    expect(shadowLeft(0, 10, 1280, 300, 0)).toBe(-300);
    expect(shadowLeft(1000, 10, 1280, 300, 0)).toBe(-290);
    // Una vuelta: 1580 px a 10 px/s.
    expect(shadowLeft(158000, 10, 1280, 300, 0)).toBeCloseTo(-300);
    expect(shadowLeft(157000, 10, 1280, 300, 0)).toBeCloseTo(1270);
  });

  it('las sombras quedan dentro de la llanura, y solo l3 y l6 las tienen', () => {
    // l6 las sumó en deb730b (nubes sobre su franja de nubes); lo de abajo mide la llanura de l3.
    // S108: l1 tiene bandadas (loros) pero no sombras.
    const withLife = Object.values(LEVELS).filter((l) => l.backgrounds.skyLife?.shadows);
    expect(withLife.map((l) => l.id)).toEqual(['l3', 'l6']);
    const [y0, y1] = LEVELS.l3!.backgrounds.skyLife!.shadows!;
    // Llanura de l3_far.jpg: de y 378 a 480.
    expect(y0).toBeGreaterThanOrEqual(378);
    expect(y1).toBeLessThanOrEqual(480);
    expect(life.shadows.length).toBeGreaterThanOrEqual(2);
    expect(life.shadows.length).toBeLessThanOrEqual(3);
    for (const s of life.shadows) {
      const c = y0 + s.at * (y1 - y0);
      expect(c - s.height / 2).toBeGreaterThanOrEqual(y0);
      expect(c + s.height / 2).toBeLessThanOrEqual(y1);
      expect(s.speed).toBeGreaterThan(0);
    }
    expect(life.shadowAlpha).toBeLessThanOrEqual(0.2);
  });
});
