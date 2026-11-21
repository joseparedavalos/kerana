import { describe, expect, it } from 'vitest';
import l6Json from '../public/assets/maps/l6.json';
import { GAMEPLAY } from '../src/config/gameplay';
import {
  lipCrest,
  paintBackSheet,
  paintFoam,
  paintFrontSheet,
  paintLip,
  paintPool,
  paintPuff,
  paintRipple,
  waterfallLedges,
  type RgbaImage,
} from '../src/entities/waterfallArt';

// S116: el dibujo de la cascada (la del secreto de l6). Texturas fijas, en la rampa de agua, translúcidas, que se
// repiten hacia abajo sin costura; la cresta en arco desde la esquina de la roca; dónde el chorro cruza la cornisa.

const ART = GAMEPLAY.waterfall.art;
type MapJson = {
  width: number;
  height: number;
  tilewidth: number;
  layers: { name: string; type: string; data?: number[]; objects?: { type?: string; class?: string; x: number; y: number; width?: number; height?: number }[] }[];
};
const L6 = l6Json as unknown as MapJson;
const zoneObj = L6.layers.filter((l) => l.type === 'objectgroup').flatMap((l) => l.objects ?? []).find((o) => (o.type ?? o.class) === 'Waterfall')!;
const zone = { x: zoneObj.x, y: zoneObj.y, width: zoneObj.width!, height: zoneObj.height! };
const W = zone.width;

const pixels = (img: RgbaImage) => Array.from({ length: img.width * img.height }, (_, i) => Array.from(img.data.subarray(i * 4, i * 4 + 4)));
const rgbOf = (c: number) => [(c >> 16) & 0xff, (c >> 8) & 0xff, c & 0xff].join(',');
const RAMP = new Set(ART.ramp.map(rgbOf));
const row = (img: RgbaImage, y: number) => img.data.subarray(y * img.width * 4, (y + 1) * img.width * 4);

describe('la cascada (S116)', () => {
  it('es la del secreto de l6: misma posición y tamaño que antes', () => {
    expect([zone.x / 16, zone.y / 16, zone.width / 16, zone.height / 16]).toEqual([166, 15, 3, 51]);
  });

  it('las texturas siempre salen iguales y solo con los colores de la rampa de agua (seis tonos y el brillo)', () => {
    expect(ART.ramp).toHaveLength(7);
    const all = [paintBackSheet(W, ART), paintFrontSheet(W, ART), paintLip(W, ART), paintFoam(7, 4, ART), paintPuff(20, 12, ART), paintRipple(22, 5, ART), paintPool(W + 28, 12, W, ART)];
    const again = [paintBackSheet(W, ART), paintFrontSheet(W, ART), paintLip(W, ART), paintFoam(7, 4, ART), paintPuff(20, 12, ART), paintRipple(22, 5, ART), paintPool(W + 28, 12, W, ART)];
    all.forEach((img, i) => expect(Array.from(img.data)).toEqual(Array.from(again[i]!.data)));
    for (const img of all) for (const p of pixels(img)) if (p[3]! > 0) expect(RAMP.has(p.slice(0, 3).join(','))).toBe(true);
  });

  it('la lámina de atrás es agua translúcida, no una cortina: se ve detrás, con rendijas, y no es blanca', () => {
    const back = paintBackSheet(W, ART);
    const ps = pixels(back).filter((p) => p[3]! > 0);
    const alphas = ps.map((p) => p[3]! / 255);
    const mean = alphas.reduce((a, b) => a + b, 0) / alphas.length;
    expect(mean).toBeGreaterThan(0.35);
    expect(mean).toBeLessThan(0.65);
    expect(Math.max(...alphas)).toBeLessThanOrEqual(0.8);
    // Rendijas casi transparentes: por ahí se adivinan la cornisa y la gruta.
    expect(alphas.filter((a) => a <= ART.slitAlpha + 0.01).length).toBeGreaterThan(40);
    // Varios tonos (no un color plano) y casi nada del brillo en el cuerpo.
    const tones = new Set(ps.map((p) => p.slice(0, 3).join(',')));
    expect(tones.size).toBeGreaterThanOrEqual(5);
    expect(ps.filter((p) => p.slice(0, 3).join(',') === rgbOf(ART.ramp[6]!)).length).toBe(0);
  });

  it('las láminas se repiten hacia abajo sin costura: la última fila empalma con la primera como cualquier par de filas', () => {
    for (const img of [paintBackSheet(W, ART), paintFrontSheet(W, ART)]) {
      expect(img.height).toBe(ART.period);
      const diff = (a: Uint8ClampedArray, b: Uint8ClampedArray) => a.reduce((s, v, i) => s + Math.abs(v - b[i]!), 0);
      let worst = 0;
      for (let y = 0; y + 1 < img.height; y++) worst = Math.max(worst, diff(row(img, y), row(img, y + 1)));
      expect(diff(row(img, img.height - 1), row(img, 0))).toBeLessThanOrEqual(worst);
    }
  });

  it('la cresta: el agua sale de la esquina de la roca (arriba de todo) y baja en arco hacia la derecha', () => {
    const crest = lipCrest(W, ART);
    const lip = paintLip(W, ART);
    expect(crest).toHaveLength(lip.width);
    expect(lip.width).toBe(W + ART.lipLead + 2);
    const corner = crest[ART.lipLead]!;
    expect(corner).toBeLessThan(ART.lipRise);
    expect(crest[crest.length - 1]!).toBeGreaterThan(corner + 2);
    // Sobre la roca, la lámina fina apoyada en la línea del suelo (no la tapa).
    for (let x = 0; x < ART.lipLead; x++) {
      const col = Array.from({ length: lip.height }, (_, y) => lip.data[(y * lip.width + x) * 4 + 3]!);
      expect(col.slice(ART.lipRise).every((a) => a === 0)).toBe(true);
      expect(col.slice(ART.lipRise - 2, ART.lipRise).some((a) => a > 0)).toBe(true);
    }
    // El filo lleva el brillo; abajo se funde (las últimas filas, más transparentes que las del medio).
    const at = (x: number, y: number) => Array.from(lip.data.subarray((y * lip.width + x) * 4, (y * lip.width + x) * 4 + 4));
    const mid = ART.lipLead + Math.floor(W / 2);
    expect(at(mid, crest[mid]!).slice(0, 3).join(',')).toBe(rgbOf(ART.ramp[6]!));
    expect(at(mid, lip.height - 1)[3]!).toBeLessThan(at(mid, crest[mid]! + 4)[3]!);
  });

  it('dónde el chorro cruza un piso: en l6, solo la cornisa del secreto (fila 26, las tres columnas)', () => {
    const ground = L6.layers.find((l) => l.name === 'Ground')!.data!;
    const solid = (cx: number, cy: number) => cx >= 0 && cy >= 0 && cx < L6.width && cy < L6.height && ground[cy * L6.width + cx]! !== 0;
    expect(waterfallLedges(zone, 16, solid)).toEqual([{ y: 26 * 16, x0: 166 * 16, x1: 169 * 16 }]);
    // Sin piso dentro del chorro, nada; la primera fila (de donde sale el agua) no cuenta.
    expect(waterfallLedges(zone, 16, () => false)).toEqual([]);
    expect(waterfallLedges(zone, 16, (_cx, cy) => cy === 15)).toEqual([]);
  });
});
