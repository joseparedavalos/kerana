import { describe, expect, it } from 'vitest';
import { GAMEPLAY } from '../src/config/gameplay';
import { ART_DETAIL } from '../src/assets/manifest';
import { drawBlades, isGrass, paintAshPatch, planBlades, stainGround } from '../src/systems/checkpointBaseLogic';
import { alphaAt, colorAt, makePixels, put } from '../src/systems/pixelArt';
import { readPng } from '../tools/lib/tileset-check.mjs';

// S121: la fogata del checkpoint, hundida en el piso. La ronda baja `sink` bajo el borde del tile, sobre una mancha de
// tierra y ceniza y detrás de una franja del piso del bioma con matas de pasto. Encendida y apagada, la misma base.
const MAPS = import.meta.glob('../public/assets/maps/*.json', { eager: true, import: 'default' }) as Record<string, any>;
const CFG = GAMEPLAY.checkpointFire;
const OFF = readPng('public/assets/props/fire_off.png');
const ON = readPng('public/assets/props/fire_on.png');
const RING_HALF = OFF.width / ART_DETAIL / 2;

const opaqueRow = (img: { width: number; data: Uint8Array }, y: number) => {
  const xs: number[] = [];
  for (let x = 0; x < img.width; x++) if (img.data[(y * img.width + x) * 4 + 3] > 0) xs.push(x);
  return xs;
};

describe('la ronda de la fogata', () => {
  it('apagada y encendida apoyan en el mismo pie y miden lo mismo de ancho', () => {
    expect(ON.width).toBe(OFF.width);
    // La última fila es la base de la ronda en las dos: con el origen (0,5; 1) caen en el mismo lugar.
    expect(opaqueRow(OFF, OFF.height - 1).length).toBeGreaterThan(0);
    expect(opaqueRow(ON, ON.height - 1).length).toBeGreaterThan(0);
    // La parte más ancha de la ronda, a la misma altura sobre el pie.
    const widest = (img: typeof OFF) => {
      let best = 0;
      let at = 0;
      for (let y = 0; y < img.height; y++) {
        const n = opaqueRow(img, y).length;
        if (n > best) [best, at] = [n, img.height - y];
      }
      return { best, at };
    };
    expect(widest(ON).at).toBe(widest(OFF).at);
  });

  it('se hunde, y la franja de delante tapa todo lo hundido', () => {
    expect(CFG.sink).toBeGreaterThan(0);
    expect(CFG.front.below).toBeGreaterThan(CFG.sink);
    expect(CFG.front.halfWidth).toBeGreaterThan(RING_HALF);
  });

  it('la mancha es del ancho de la ronda', () => {
    expect(Math.abs(CFG.patch.halfWidth - RING_HALF)).toBeLessThanOrEqual(2);
    expect(Math.abs(CFG.front.stain.halfWidth - RING_HALF)).toBeLessThanOrEqual(2);
  });
});

describe('la mancha de tierra y ceniza', () => {
  const p = paintAshPatch(CFG.patch, 0);
  it('mide lo de la config y se queda dentro de la elipse', () => {
    expect(p.width).toBe(Math.round(CFG.patch.halfWidth * 2 * CFG.patch.detail));
    expect(p.height).toBe(Math.round(CFG.patch.halfHeight * 2 * CFG.patch.detail));
    for (const [x, y] of [[0, 0], [p.width - 1, 0], [0, p.height - 1], [p.width - 1, p.height - 1]]) expect(alphaAt(p, x, y)).toBe(0);
    expect(alphaAt(p, p.width / 2, p.height / 2)).toBe(255);
  });

  it('lleva tierra, ceniza y carbón, y el borde tramado', () => {
    const c = CFG.patch.colors;
    const seen = new Set<number>();
    for (let y = 0; y < p.height; y++) for (let x = 0; x < p.width; x++) if (alphaAt(p, x, y)) seen.add(colorAt(p, x, y));
    for (const col of [c.soil, c.char]) expect(seen.has(col)).toBe(true);
    expect(seen.has(c.ash) || seen.has(c.ashLight)).toBe(true);
    // En la fila del medio, hacia los costados hay huecos del tramado.
    const mid = Math.floor(p.height / 2);
    const row = Array.from({ length: p.width }, (_, x) => alphaAt(p, x, mid) > 0);
    expect(row.slice(0, 4).some((v) => !v) || row.slice(-4).some((v) => !v)).toBe(true);
  });

  it('cada variante es distinta pero del mismo tamaño', () => {
    const q = paintAshPatch(CFG.patch, 1);
    expect([q.width, q.height]).toEqual([p.width, p.height]);
    expect(Array.from(q.data)).not.toEqual(Array.from(p.data));
  });
});

describe('la franja del piso delante de la base', () => {
  const GROUND = 3;
  const strip = (color: number) => {
    const s = makePixels(24, 7);
    for (let y = GROUND; y < 7; y++) for (let x = 0; x < 24; x++) put(s, x, y, color);
    return s;
  };

  it('el pasto es verde; el adoquín, la nube y la tierra no', () => {
    expect(isGrass(0x6a9a3a)).toBe(true);
    expect(isGrass(0x7a7a80)).toBe(false);
    expect(isGrass(0xf2eefa)).toBe(false);
    expect(isGrass(0x8a5a32)).toBe(false);
  });

  it('las matas nacen solo del pasto, cerca de la ronda y no más altas que `max`', () => {
    const grass = strip(0x6a9a3a);
    const blades = planBlades(grass, GROUND, CFG.front.blades, 1, 7);
    expect(blades.length).toBeGreaterThan(0);
    for (const b of blades) {
      expect(Math.abs(b.x + 0.5 - 12)).toBeLessThanOrEqual(CFG.front.blades.halfWidth);
      expect(b.height).toBeLessThanOrEqual(CFG.front.blades.max);
      expect(b.top).toBe(GROUND);
    }
    drawBlades(grass, blades, CFG.front.blades.tipLighten);
    expect(alphaAt(grass, blades[0].x, GROUND - blades[0].height)).toBe(255);
    expect(planBlades(strip(0x7a7a80), GROUND, CFG.front.blades, 1, 7)).toEqual([]);
  });

  it('la mancha del borde oscurece el piso bajo la ronda sin agregar píxeles', () => {
    const s = strip(0x6a9a3a);
    const before = Uint8ClampedArray.from(s.data);
    const n = stainGround(s, GROUND, CFG.front.stain, CFG.patch, 1, 3);
    expect(n).toBeGreaterThan(0);
    for (let y = 0; y < s.height; y++) {
      for (let x = 0; x < s.width; x++) {
        const i = (y * s.width + x) * 4;
        expect(s.data[i + 3]).toBe(before[i + 3]);
        if (y < GROUND) expect(s.data[i]).toBe(before[i]);
      }
    }
    // El centro del borde, más oscuro; las puntas de la franja, igual.
    const lum = (c: number) => ((c >> 16) & 255) + ((c >> 8) & 255) + (c & 255);
    expect(lum(colorAt(s, 12, GROUND))).toBeLessThan(lum(0x6a9a3a));
    expect(colorAt(s, 0, GROUND)).toBe(0x6a9a3a);
  });
});

describe('las fogatas de los mapas', () => {
  // Hundida, la ronda solo se ve bien con piso entero debajo en todo su ancho: si una quedara al filo de una cornisa,
  // lo hundido colgaría en el aire.
  for (const [file, map] of Object.entries(MAPS)) {
    const id = file.replace(/^.*\/(\w+)\.json$/, '$1');
    const layer = (n: string) => map.layers.find((l: any) => l.name === n);
    const objects = (layer('Objects')?.objects ?? []).filter((o: any) => (o.type || o.class) === 'Checkpoint');
    if (objects.length === 0) continue;
    it(`${id}: cada fogata apoya en piso en todo el ancho de la ronda`, () => {
      const solid = (tx: number, ty: number) =>
        ['Ground', 'Platforms'].some((n) => (layer(n)?.data[ty * map.width + tx] ?? 0) !== 0);
      for (const o of objects) {
        const ty = Math.round(o.y / map.tileheight);
        for (let tx = Math.floor((o.x - RING_HALF) / map.tilewidth); tx <= Math.floor((o.x + RING_HALF - 1) / map.tilewidth); tx++) {
          expect(solid(tx, ty), `${id}: fogata en x ${o.x}, y ${o.y}: la casilla ${tx}, ${ty}`).toBe(true);
          expect(solid(tx, ty - 1), `${id}: fogata en x ${o.x}, y ${o.y}: sólido sobre el piso en ${tx}`).toBe(false);
        }
      }
    });
  }
});
