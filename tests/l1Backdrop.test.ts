import jpeg from 'jpeg-js';
import { describe, expect, it } from 'vitest';
import l1Map from '../public/assets/maps/l1.json';
import { GAMEPLAY } from '../src/config/gameplay';
import { LEVELS } from '../src/data/levels';
import {
  crystalKind,
  dropFall,
  dropFallMs,
  goldPixels,
  paintWisp,
  polylineMax,
  polylineY,
  rangeMax,
  rayAlphaAt,
  shelfPack,
  skylineRows,
  spanAlpha,
  wispFade,
  wispLeft,
  wispTop,
  zigzag,
} from '../src/systems/backdropLogic';

// S108: el atardecer (rayos, bruma, loros) y la cueva con vida (murciélagos, cristales, oro, gotas, polvo) de l1.
const DUSK = GAMEPLAY.backdrop.dusk;
const CAVE = GAMEPLAY.backdrop.caveLife;
const BG = LEVELS.l1!.backgrounds;
const JPGS = import.meta.glob('../public/assets/backgrounds/l1_*.jpg', { eager: true, query: '?inline', import: 'default' }) as Record<string, string>;
const image = (name: string) => {
  const b64 = JPGS[`../public/assets/backgrounds/${name}.jpg`]!.split(',')[1]!;
  return jpeg.decode(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)), { useTArray: true, formatAsRGBA: true });
};
const far = image('l1_far');
const cave = image('l1_cave');
const sky = skylineRows(far.data, far.width, far.height, 460, DUSK.skyRedOverBlue, DUSK.skyMinLum);
const px = (img: typeof far, x: number, y: number) => {
  const i = (y * img.width + x) * 4;
  return [img.data[i]!, img.data[i + 1]!, img.data[i + 2]!] as const;
};

describe('el atardecer de l1 (S108)', () => {
  it('solo l1 tiene atardecer y cueva con vida', () => {
    const levels = Object.values(LEVELS);
    expect(levels.filter((l) => l.backgrounds.dusk).map((l) => l.id)).toEqual(['l1']);
    expect(levels.filter((l) => l.backgrounds.caveLife).map((l) => l.id)).toEqual(['l1']);
    expect(BG.skyLife?.flock).toBe('parrots');
  });

  it('la línea del cielo sale de los píxeles: arriba, cielo; abajo, sierra', () => {
    // Imagen sintética: cielo rosado hasta la fila 20, sierra violeta abajo.
    const w = 8;
    const h = 40;
    const data = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) data.set(y < 20 ? [240, 190, 195, 255] : [150, 140, 180, 255], (y * w + x) * 4);
    expect([...skylineRows(data, w, h, 39, 18, 175)]).toEqual(new Array(w).fill(20));
    // En l1_far.jpg la cima más alta (x 478) llega a y ≈ 307 y la sierra nunca baja de y 300 ni pasa de y 375.
    expect(sky[478]).toBeGreaterThanOrEqual(302);
    expect(sky[478]).toBeLessThanOrEqual(312);
    for (let x = 0; x < far.width; x++) {
      expect(sky[x]).toBeGreaterThan(295);
      expect(sky[x]).toBeLessThan(375);
    }
  });

  it('los rayos salen de detrás de la cima más alta', () => {
    const [fx, fy] = BG.dusk!.rays;
    // La fuente queda debajo de la sierra (tapada) y la cima es lo más alto a 60 px a cada lado.
    expect(fy).toBeGreaterThan(sky[fx]! + 25);
    let top = Infinity;
    for (let x = 0; x < far.width; x++) top = Math.min(top, sky[x]!);
    expect(Math.min(...Array.from(sky.slice(fx - 60, fx + 61)))).toBe(top);
    // Lo que tapa la base llega a la fuente: el rayo nunca se ve debajo de la sierra.
    expect(DUSK.rays.coverBelow).toBeGreaterThan(0);
    expect(DUSK.rays.list.length).toBeGreaterThanOrEqual(3);
    expect(DUSK.rays.list.length).toBeLessThanOrEqual(5);
    for (const r of DUSK.rays.list) {
      expect(r.periodMs).toBeGreaterThanOrEqual(6000);
      expect(r.periodMs).toBeLessThanOrEqual(10000);
      // Abierto hacia arriba: la base, a la vista apenas sobre la sierra, queda adentro de lo que tapa.
      const sx = fx + Math.sin((r.angle * Math.PI) / 180) * (fy - sky[fx]!);
      expect(Math.abs(sx - fx)).toBeLessThan(DUSK.rays.coverHalfWidth);
    }
    // Sutiles: con el máximo, el cielo sube a lo sumo un sexto.
    expect(DUSK.rays.alphaMax).toBeLessThanOrEqual(0.17);
    expect(new Set(DUSK.rays.list.map((r) => r.phase)).size).toBe(DUSK.rays.list.length);
  });

  it('el rayo: angosto abajo, abierto arriba, más fuerte cerca de la fuente y nada afuera de la cuña', () => {
    const [w, h] = [32, 128];
    const at = (x: number, y: number) => rayAlphaAt(x, y, w, h, DUSK.rays.base, DUSK.rays.peakAt);
    const width = (y: number) => [...Array(w).keys()].filter((x) => at(x, y) > 0).length;
    expect(width(h - 2)).toBeLessThan(width(8));
    expect(at(0, h - 2)).toBe(0);
    const peak = Math.round((1 - DUSK.rays.peakAt) * h);
    expect(at(w / 2, peak)).toBeGreaterThan(at(w / 2, 4));
    expect(at(w / 2, peak)).toBeGreaterThan(at(w / 2, h - 1));
    expect(at(w / 2, peak)).toBeLessThanOrEqual(1);
  });

  it('cada valle sigue una cresta de verdad: arriba, más lejos (claro y violáceo); abajo, la loma de adelante', () => {
    // «Lejanía»: violeta sobre verde y brillo; la loma de adelante es más verde y más oscura.
    const farness = (x: number, y: number) => {
      const [r, g, b] = px(far, x, y);
      return (r + b) / 2 - g + 0.5 * (0.299 * r + 0.587 * g + 0.114 * b);
    };
    for (const v of BG.dusk!.valleys) {
      const line = v.line;
      expect(DUSK.mist.layers[v.layer]).toBeDefined();
      for (let i = 2; i < line.length; i += 2) expect(line[i]!).toBeGreaterThan(line[i - 2]!);
      expect(line[0]!).toBeGreaterThanOrEqual(0);
      expect(line[line.length - 2]!).toBeLessThan(far.width);
      let diff = 0;
      let n = 0;
      for (let x = line[0]!; x <= line[line.length - 2]!; x += 4) {
        const y = Math.round(polylineY(line, x));
        let up = 0;
        let down = 0;
        for (let d = 2; d <= 6; d++) {
          up += farness(x, y - d);
          down += farness(x, y + d);
        }
        diff += up - down;
        n++;
        // Ninguna cresta toca el cielo: hay lugar para la bruma.
        expect(y - sky[x]!).toBeGreaterThan(DUSK.mist.skyMargin + 4);
      }
      expect(diff / n / 5).toBeGreaterThan(6);
    }
  });

  it('la bruma nunca sube al cielo y se apoya en la cresta', () => {
    const mc = DUSK.mist;
    for (const v of BG.dusk!.valleys) {
      const layer = mc.layers[v.layer]!;
      const x0 = v.line[0]!;
      const x1 = v.line[v.line.length - 2]!;
      for (let left = x0 - layer.width; left <= x1; left += 7) {
        const top = wispTop(v.line, sky, left, layer.width, layer.height, mc.pad, mc.skyMargin);
        expect(top).toBeGreaterThanOrEqual(rangeMax(sky, left, left + layer.width) + mc.skyMargin);
        // El pie del jirón llega a lo más bajo de la cresta de abajo (o más abajo, tapado).
        const low = polylineMax(v.line, left, left + layer.width);
        if (!Number.isNaN(low)) expect(top + layer.height).toBeGreaterThanOrEqual(Math.round(low));
      }
    }
  });

  it('los jirones se deslizan despacio, entran y salen enteros por las puntas y se funden ahí', () => {
    const w = 120;
    expect(wispLeft(0, 2, 100, 500, w, 0)).toBe(100 - w);
    expect(wispLeft(1000, 2, 100, 500, w, 0)).toBeCloseTo(100 - w + 2);
    // Una vuelta: el valle más el jirón.
    expect(wispLeft(((400 + w) / 2) * 1000, 2, 100, 500, w, 0)).toBeCloseTo(100 - w);
    expect(wispFade(100 - w, w, 100, 500, 48)).toBe(0);
    expect(wispFade(300 - w / 2, w, 100, 500, 48)).toBe(1);
    expect(wispFade(500 - w / 2, w, 100, 500, 48)).toBe(0);
    for (const l of DUSK.mist.layers) expect(l.speed).toBeLessThanOrEqual(5);
  });

  it('un jirón: tramado con los escalones de opacidad, denso abajo, ralo arriba y vacío en las puntas', () => {
    let seed = 7;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const w = 48;
    const h = 12;
    const out = new Uint8ClampedArray(w * h);
    paintWisp(w, h, rand, DUSK.mist, out);
    const levels = new Set([0, ...DUSK.mist.alphas.map((a) => Math.round(a * 255))]);
    for (const a of out) expect(levels.has(a)).toBe(true);
    const row = (y: number) => [...Array(w).keys()].reduce((s, x) => s + out[y * w + x]!, 0);
    expect(row(h - 1)).toBeGreaterThan(row(0));
    const col = (x: number) => [...Array(h).keys()].reduce((s, y) => s + out[y * w + x]!, 0);
    expect(col(0) + col(w - 1)).toBeLessThan(col(w / 2));
  });

  it('las piezas de textura no se pisan', () => {
    const sizes: [number, number][] = [
      [120, 12],
      [56, 14],
      [140, 9],
      [30, 30],
      [200, 4],
    ];
    const pack = shelfPack(sizes, 256);
    sizes.forEach(([w, h], i) => {
      const a = pack.at[i]!;
      expect(a.x + w).toBeLessThanOrEqual(pack.width);
      expect(a.y + h).toBeLessThanOrEqual(pack.height);
      sizes.forEach(([w2, h2], j) => {
        if (j <= i) return;
        const b = pack.at[j]!;
        expect(a.x + w <= b.x || b.x + w2 <= a.x || a.y + h <= b.y || b.y + h2 <= a.y).toBe(true);
      });
    });
  });
});

describe('la cueva de l1 con vida (S108)', () => {
  const life = BG.caveLife!;

  it('cada rectángulo de cristal tiene cristal de verdad en l1_cave.jpg (violeta o cian)', () => {
    for (const [x0, y0, x1, y1] of life.crystals) {
      let n = 0;
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (crystalKind(...px(cave, x, y), CAVE.crystals) > 0) n++;
      expect(n).toBeGreaterThanOrEqual(12);
    }
    expect(crystalKind(109, 106, 173, CAVE.crystals)).toBe(1);
    expect(crystalKind(80, 200, 220, CAVE.crystals)).toBe(2);
    // La roca azul grisácea no es cristal.
    expect(crystalKind(60, 70, 95, CAVE.crystals)).toBe(0);
  });

  it('el oro está donde se lo midió y las chispas caen sobre él', () => {
    const gold = goldPixels(cave.data, cave.width, life.gold, CAVE.gold.minYellow);
    expect(gold.length / 2).toBeGreaterThanOrEqual(60);
    for (let i = 0; i < gold.length; i += 2) {
      expect(gold[i]!).toBeGreaterThanOrEqual(life.gold[0]);
      expect(gold[i + 1]!).toBeLessThanOrEqual(life.gold[3]);
    }
  });

  it('las gotas salen de puntas a la vista y caen hacia abajo', () => {
    const lum = (x: number, y: number) => {
      const [r, g, b] = px(cave, x, y);
      return 0.299 * r + 0.587 * g + 0.114 * b;
    };
    for (const [x, tip, land] of life.drops) {
      // La punta se ve con la vista arriba del nivel (la imagen empieza a verse en y ≈ 155).
      expect(tip).toBeGreaterThanOrEqual(155);
      expect(land - tip).toBeGreaterThan(80);
      // La punta es más clara que el fondo que tiene debajo.
      expect(lum(x, tip)).toBeGreaterThan(lum(x, tip + 6) + 8);
    }
    const g = CAVE.drops.gravity;
    expect(dropFall(dropFallMs(200, g), g)).toBeCloseTo(200);
    expect(dropFall(0, g)).toBe(0);
  });

  it('los murciélagos zigzaguean y lo chico se funde en el borde de la cueva', () => {
    expect(zigzag(0)).toBeCloseTo(0);
    expect(zigzag(0.25)).toBeCloseTo(1);
    expect(zigzag(0.75)).toBeCloseTo(-1);
    expect(zigzag(1.25)).toBeCloseTo(1);
    expect(spanAlpha(50, 0, 100, 10)).toBe(1);
    expect(spanAlpha(5, 0, 100, 10)).toBeCloseTo(0.5);
    expect(spanAlpha(-1, 0, 100, 10)).toBe(0);
    expect(spanAlpha(101, 0, 100, 10)).toBe(0);
    const [y0, y1] = life.bats;
    expect(y1 - y0).toBeGreaterThan(2 * (CAVE.bats.spreadY / 2 + CAVE.bats.zigAmp));
    expect(CAVE.bats.gapMinMs).toBeGreaterThanOrEqual(15000);
    expect(CAVE.bats.gapMaxMs).toBeLessThanOrEqual(30000);
    expect(CAVE.bats.countMin).toBeGreaterThanOrEqual(3);
    expect(CAVE.bats.countMax).toBeLessThanOrEqual(6);
  });
});

describe('las luciérnagas del primer tramo (S108)', () => {
  const map = l1Map as unknown as {
    layers: { type: string; objects?: { type?: string; class?: string; x: number; y: number; width: number; height: number; properties?: { name: string; value: unknown }[] }[] }[];
  };
  const objects = map.layers.flatMap((l) => l.objects ?? []);
  const kind = (o: (typeof objects)[number]) => o.type || o.class;
  const zones = objects.filter((o) => kind(o) === 'Fireflies');
  const caves = objects.filter((o) => kind(o) === 'Cave');

  it('hay tres zonas nuevas en el primer tramo al aire libre, fuera de la cueva', () => {
    const fresh = zones.filter((z) => z.x / 16 < 100);
    expect(fresh.length).toBe(3);
    for (const z of fresh) {
      expect(z.x / 16).toBeGreaterThanOrEqual(45);
      for (const c of caves) expect(z.x + z.width <= c.x || z.x >= c.x + c.width).toBe(true);
    }
  });

  it('lejos de las chipas y de las piedras de luz (al menos 4 tiles)', () => {
    const items = objects.filter((o) => {
      const k = kind(o);
      const pickup = o.properties?.find((p) => p.name === 'kind')?.value;
      return k === 'Switch' || (k === 'Pickup' && (pickup === 'pluma' || pickup === 'luz_arasy'));
    });
    expect(items.length).toBeGreaterThan(0);
    for (const z of zones.filter((q) => q.x / 16 < 100)) {
      for (const it of items) {
        const dx = Math.max(z.x - it.x, it.x - (z.x + z.width), 0);
        const dy = Math.max(z.y - it.y, it.y - (z.y + z.height), 0);
        expect(Math.hypot(dx, dy) / 16).toBeGreaterThanOrEqual(4);
      }
    }
  });
});
