import { describe, expect, it } from 'vitest';
import { buildTiledMap, groundMask, parseAscii, parseValue } from '../tools/lib/ascii-map.mjs';
import { TILES } from '../tools/lib/tileset-layout.mjs';

const SAMPLE = `# muestra
size 8x5
biome estero
enemy t=teju_i
sign 1=hint.test.move
rect WindZone x=1 y=0 w=3 h=2 forceX=-40 periodMs=1500
point FallingHazard x=6 y=0 delayMs=800
---
........
.P.1..t.
..===...
###~~#^.
########
`;

type Obj = { type: string; x: number; y: number; width: number; height: number; point?: boolean; properties?: { name: string; value: unknown }[] };
const props = (o: Obj) => Object.fromEntries((o.properties ?? []).map((p) => [p.name, p.value]));

describe('parseAscii', () => {
  it('lee la cabecera', () => {
    const p = parseAscii(SAMPLE);
    expect(p.name).toBe('muestra');
    expect([p.width, p.height]).toEqual([8, 5]);
    expect(p.biome).toBe('estero');
    expect(p.enemies).toEqual({ t: 'teju_i' });
    expect(p.signs).toEqual({ '1': 'hint.test.move' });
    expect(p.rects).toEqual([{ cls: 'WindZone', x: 1, y: 0, w: 3, h: 2, props: { forceX: -40, periodMs: 1500 } }]);
    expect(p.points).toEqual([{ cls: 'FallingHazard', x: 6, y: 0, props: { delayMs: 800 } }]);
    expect(p.warnings).toEqual([]);
  });

  it('ajusta filas cortas y avisa', () => {
    const p = parseAscii('size 4x2\n---\n##\n####\n');
    expect(p.grid).toEqual(['##..', '####']);
    expect(p.warnings.length).toBe(1);
  });

  it('falla sin separador o con cabecera desconocida', () => {
    expect(() => parseAscii('size 2x2\n##')).toThrow();
    expect(() => parseAscii('foo 1\n---\n#')).toThrow();
  });

  it('interpreta valores', () => {
    expect(parseValue('12')).toBe(12);
    expect(parseValue('-1.5')).toBe(-1.5);
    expect(parseValue('true')).toBe(true);
    expect(parseValue('teju_jagua')).toBe('teju_jagua');
  });
});

describe('groundMask', () => {
  it('suma vecinos: arriba 1, derecha 2, abajo 4, izquierda 8', () => {
    const grid = ['...', '###', '###'];
    expect(groundMask(grid, 1, 1)).toBe(2 + 4 + 8);
    expect(groundMask(grid, 1, 2)).toBe(1 + 2 + 4 + 8); // fuera del mapa cuenta como suelo
    expect(groundMask(['.#.', '...', '...'], 1, 0)).toBe(1); // solo el borde superior del mapa
  });
});

describe('buildTiledMap', () => {
  type Layer = { name: string; data: number[]; objects: Obj[] };
  const map = buildTiledMap(parseAscii(SAMPLE)) as unknown as { layers: Layer[]; tilesets: { image: string; firstgid: number }[] };
  const layer = (name: string) => map.layers.find((l) => l.name === name) as Layer;
  const at = (name: string, x: number, y: number) => layer(name).data[y * 8 + x];

  it('genera capas con los nombres exactos y tileset incrustado', () => {
    expect(map.layers.map((l) => l.name)).toEqual([
      'Background', 'Ground', 'Platforms', 'Hazards', 'Water', 'Foreground', 'Objects',
    ]);
    expect(map.tilesets[0]!.image).toBe('../tiles/estero.png');
    expect(map.tilesets[0]!.firstgid).toBe(1);
    expect(layer('Ground').data.length).toBe(40);
  });

  it('aplica autotile al suelo', () => {
    // (0,3): sin vecino arriba; con derecha, abajo e izquierda (borde del mapa).
    expect(at('Ground', 0, 3)).toBe(TILES.groundBase + (2 + 4 + 8) + 1);
    // (5,3): agua a la izquierda, espinas a la derecha.
    expect(at('Ground', 5, 3)).toBe(TILES.groundBase + 4 + 1);
  });

  it('coloca plataformas, peligros y agua', () => {
    expect([at('Platforms', 2, 2), at('Platforms', 3, 2), at('Platforms', 4, 2)]).toEqual([
      TILES.platformLeft + 1, TILES.platformCenter + 1, TILES.platformRight + 1,
    ]);
    expect(at('Hazards', 6, 3)).toBe(TILES.hazard + 1);
    expect(at('Water', 3, 3)).toBe(TILES.waterSurface + 1);
  });

  it('crea objetos desde caracteres y cabeceras rect/point', () => {
    const objs = layer('Objects').objects;
    const byType = (t: string) => objs.filter((o) => o.type === t);
    const spawn = byType('PlayerSpawn')[0]!;
    expect([spawn.x, spawn.y, spawn.point]).toEqual([24, 32, true]);
    expect(props(byType('Sign')[0]!)).toEqual({ textKey: 'hint.test.move' });
    expect(props(byType('Enemy')[0]!)).toMatchObject({ kind: 'teju_i' });
    const wind = byType('WindZone')[0]!;
    expect([wind.x, wind.y, wind.width, wind.height]).toEqual([16, 0, 48, 32]);
    expect(props(wind)).toEqual({ forceX: -40, periodMs: 1500 });
    expect(props(byType('FallingHazard')[0]!)).toEqual({ delayMs: 800 });
    expect(new Set(objs.map((o: Obj & { id?: number }) => o.id)).size).toBe(objs.length);
  });

  it('valida el mapa', () => {
    expect(() => buildTiledMap(parseAscii('size 2x1\n---\n##\n'))).toThrow(/P/);
    expect(() => buildTiledMap(parseAscii('size 2x1\n---\nPx\n'))).toThrow(/enemy/);
    expect(() => buildTiledMap(parseAscii('size 2x1\n---\nP?\n'))).toThrow(/desconocido/);
  });
});
