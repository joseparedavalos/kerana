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

  it('numera las plumas en orden de aparición en el texto (fila por fila, de izquierda a derecha)', () => {
    const map = buildTiledMap(parseAscii('size 6x3\n---\n...F..\nPF..F.\n######\n')) as { layers: { name: string; objects?: Obj[] }[] };
    const feathers = map.layers
      .find((l) => l.name === 'Objects')!
      .objects!.filter((o) => o.type === 'Pickup' && props(o).kind === 'pluma')
      .map((o) => [o.x, props(o).index]);
    expect(feathers).toEqual([
      [56, 0],
      [24, 1],
      [72, 2],
    ]);
  });

  it('agrupa los camalotes "S" seguidos en un solo objeto Sinking sobre agua', () => {
    const map = buildTiledMap(parseAscii('size 6x2\n---\nP.SSS.\n######\n')) as { layers: { name: string; data?: number[]; objects?: Obj[] }[] };
    const objs = map.layers.find((l) => l.name === 'Objects')!.objects!.filter((o) => o.type === 'Sinking');
    expect(objs).toHaveLength(1);
    expect([objs[0].x, objs[0].width]).toEqual([32, 48]);
    const water = map.layers.find((l) => l.name === 'Water')!.data!;
    expect(water.slice(2, 5)).toEqual([TILES.waterSurface + 1, TILES.waterSurface + 1, TILES.waterSurface + 1]);
  });

  it('agrupa hongos "M" y ramas "R" seguidos en objetos Bouncer y Crumble, sin tiles', () => {
    const map = buildTiledMap(parseAscii('size 8x2\n---\nPMM.RRR.\n########\n')) as { layers: { name: string; data?: number[]; objects?: Obj[] }[] };
    const objects = map.layers.find((l) => l.name === 'Objects')!.objects!;
    const bouncers = objects.filter((o) => o.type === 'Bouncer');
    const crumbles = objects.filter((o) => o.type === 'Crumble');
    expect(bouncers.map((o) => [o.x, o.y, o.width, o.height])).toEqual([[16, 0, 32, 16]]);
    expect(crumbles.map((o) => [o.x, o.y, o.width, o.height])).toEqual([[64, 0, 48, 16]]);
    for (const name of ['Ground', 'Platforms']) expect(map.layers.find((l) => l.name === name)!.data!.slice(0, 8).every((v) => v === 0)).toBe(true);
  });

  it('town: baldosa en el llano y alero donde el techo se corta', () => {
    const map = buildTiledMap(parseAscii('size 8x2\ntown\n---\nP......#\n####...#\n')) as {
      layers: { name: string; data?: number[] }[];
    };
    const bg = map.layers.find((l) => l.name === 'Background')!.data!;
    const baldosa = TILES.grass + 1;
    const alero = TILES.flowers + 1;
    // x=1 es piso seguido: la baldosa va en el tile de arriba.
    expect(bg[1]).toBe(baldosa);
    // x=3 linda con el aire: el alero va al lado, no arriba.
    expect(bg[8 + 4]).toBe(alero);
    expect(bg.every((g) => g === 0 || g === baldosa || g === alero)).toBe(true);
  });

  it('reeds: pasto o junco en el borde, junco junto al agua, nunca la piedra', () => {
    const map = buildTiledMap(parseAscii('size 8x2\nreeds\n---\nP.......\n####~~~#\n')) as {
      layers: { name: string; data?: number[] }[];
    };
    const bg = map.layers.find((l) => l.name === 'Background')!.data!;
    const grass = TILES.grass + 1;
    const reed = TILES.flowers + 1;
    const stone = TILES.stones + 1;
    const used = bg.filter((g) => g > 0);
    expect(used.length).toBeGreaterThan(0);
    expect(used.every((g) => g === grass || g === reed)).toBe(true);
    expect(used).not.toContain(stone);
    // El suelo de x=3 linda con el agua: ahí va un junco, en el tile de arriba.
    expect(bg[3]).toBe(reed);
  });

  it('"H" va a la capa Foreground (sin colisión)', () => {
    const map = buildTiledMap(parseAscii('size 3x2\n---\nPH.\n###\n'));
    const layer = (name: string) => map.layers.find((l: { name: string }) => l.name === name) as { data: number[] };
    expect(layer('Foreground').data[1]).toBe(TILES.groundBase + 15 + 1);
    expect(layer('Ground').data[1]).toBe(0);
  });

  it('valida el mapa', () => {
    expect(() => buildTiledMap(parseAscii('size 2x1\n---\n##\n'))).toThrow(/P/);
    expect(() => buildTiledMap(parseAscii('size 2x1\n---\nPx\n'))).toThrow(/enemy/);
    expect(() => buildTiledMap(parseAscii('size 2x1\n---\nP?\n'))).toThrow(/desconocido/);
  });
});

describe('objetos de motor (S18)', () => {
  const build = (header: string, grid: string) => {
    const parsed = parseAscii(`${header}\n---\n${grid}`);
    const map = buildTiledMap(parsed);
    const objects = (map.layers.at(-1) as unknown as { objects: Obj[] }).objects;
    return { parsed, objects, of: (cls: string) => objects.filter((o) => o.type === cls) };
  };

  it('Mover: los "-" seguidos y su recorrido de ":" (derecha, izquierda, abajo, arriba)', () => {
    const { of } = build(
      'size 12x8',
      ['P...........', '---:::......', '......::+++.', '.-..........', '.:..........', '.:.......:..', '.........-..', '############'].join('\n'),
    );
    const movers = of('Mover');
    expect(movers.map((m) => [m.x / 16, m.y / 16, m.width / 16, props(m)])).toEqual([
      [0, 1, 3, { dx: 3, dy: 0 }],
      [8, 2, 3, { dx: -2, dy: 0, solid: true }],
      [1, 3, 1, { dx: 0, dy: 2 }],
      [9, 6, 1, { dx: 0, dy: -1 }],
    ]);
  });

  it('Mover sin recorrido o con ":" en dos lados: error', () => {
    expect(() => build('size 4x2', 'P---\n####')).toThrow(/sin recorrido/);
    expect(() => build('size 6x3', 'P.....\n:--:..\n######')).toThrow(/más de un lado/);
  });

  it('reja (|), Switch (*) y propiedades con "at"', () => {
    const { of, parsed } = build(
      ['size 8x4', 'at 5,0 id=reja', 'at 2,2 target=reja ms=4000', 'at 3,2 kind=once', 'at 0,1 id=m1 speed=60 mode=run'].join('\n'),
      ['.....|..', '--::.|..', 'P.*M.|..', '########'].join('\n'),
    );
    const [gate] = of('Gate');
    expect([gate.x / 16, gate.y / 16, gate.width / 16, gate.height / 16, props(gate)]).toEqual([5, 0, 1, 3, { id: 'reja' }]);
    expect(props(of('Switch')[0])).toEqual({ target: 'reja', ms: 4000 });
    expect(props(of('Bouncer')[0])).toEqual({ kind: 'once' });
    expect(props(of('Mover')[0])).toEqual({ dx: 2, dy: 0, id: 'm1', speed: 60, mode: 'run' });
    expect(parsed.warnings).toEqual([]);
  });

  it('el Switch tiene que nombrar un objetivo que exista', () => {
    expect(() => build('size 4x2', 'P*..\n####')).toThrow(/sin "target"/);
    expect(() => build('size 4x2\nat 1,0 target=nada', 'P*..\n####')).toThrow(/id "nada"/);
    expect(() => build('size 4x2\nat 3,0 x=1', 'P...\n####')).toThrow(/ningún objeto/);
  });

  it('S22: "%" es un bloque frágil (Breakable kind=brittle) y "B" la roca agrietada', () => {
    const { of } = build('size 4x3', ['P.%B', '..%B', '####'].join('\n'));
    const kinds = of('Breakable').map((b) => [b.x / 16, b.y / 16, props(b).kind ?? 'rock']);
    expect(kinds).toEqual([
      [2, 0, 'brittle'],
      [3, 0, 'rock'],
      [2, 1, 'brittle'],
      [3, 1, 'rock'],
    ]);
  });

  it('S22: una balsa sobre el agua deja la superficie dibujada debajo, y el agua de abajo es honda', () => {
    const parsed = parseAscii(['size 6x3', '---', 'P.--::', '..~~~~', '######'].join('\n'));
    const water = buildTiledMap(parsed).layers.find((l) => l.name === 'Water') as unknown as { data: number[] };
    const at = (x: number, y: number) => water.data[y * 6 + x] - 1;
    expect([at(2, 0), at(3, 0), at(4, 0), at(5, 0)]).toEqual(Array(4).fill(TILES.waterSurface));
    expect(at(1, 0)).toBe(-1);
    expect([at(2, 1), at(5, 1)]).toEqual([TILES.waterDeep, TILES.waterDeep]);
  });

  it('una reja sin Switch avisa', () => {
    const { parsed } = build('size 4x2', 'P.|.\n####');
    expect(parsed.warnings.some((w: string) => /sin ningún Switch/.test(w))).toBe(true);
  });
});

describe('prop por bioma (S46)', () => {
  const GRID = 'P.....\n######';
  const objectsOf = (header: string, catalog?: Set<string>) => {
    const map = buildTiledMap(parseAscii(`size 6x2\n${header}\n---\n${GRID}`), { propCatalog: catalog });
    return (map.layers.at(-1) as unknown as { objects: Obj[] }).objects.filter((o) => o.type === 'Prop');
  };

  it('"prop X,Y carpeta/nombre" pone un Prop en el pie del tile con escala, espejo y frente', () => {
    const [plain, opts] = objectsOf('prop 2,0 l3_pastizal/termite_mound_large\nprop 4,0 l2_tierra/pindo_palm scale=1.5 flip front');
    expect([plain!.x, plain!.y, plain!.point]).toEqual([40, 16, true]);
    expect(props(plain!)).toEqual({ art: 'l3_pastizal/termite_mound_large' });
    expect(props(opts!)).toEqual({ art: 'l2_tierra/pindo_palm', scale: 1.5, flip: true, front: true });
  });

  it('da error con sintaxis mala, opción desconocida, fuera del mapa o prop que no está en el catálogo', () => {
    expect(() => objectsOf('prop 2 l3_pastizal/x')).toThrow(/prop/);
    expect(() => objectsOf('prop 2,0 tacuru')).toThrow(/carpeta\/nombre/);
    expect(() => objectsOf('prop 2,0 a/b big')).toThrow(/desconocida/);
    expect(() => objectsOf('prop 2,0 a/b scale=0')).toThrow(/scale/);
    expect(() => objectsOf('prop 9,0 a/b')).toThrow(/fuera del mapa/);
    expect(() => objectsOf('prop 2,0 a/c', new Set(['a/b']))).toThrow(/desconocido "a\/c"/);
    expect(objectsOf('prop 2,0 a/b', new Set(['a/b']))).toHaveLength(1);
  });

  it('S54: X e Y con decimales, y "prop X1-X2,Y" centra el prop entre los dos tiles con span (sin scale)', () => {
    const [half, span] = objectsOf('prop 2.5,0 l7_calle/wooden_door_studs\nprop 1-4,0 l7_calle/clothesline_balconies flip');
    expect([half!.x, half!.y]).toEqual([48, 16]);
    expect([span!.x, span!.y]).toEqual([48, 16]);
    expect(props(span!)).toEqual({ art: 'l7_calle/clothesline_balconies', span: 4, flip: true });
    expect(() => objectsOf('prop 1-4,0 a/b scale=2')).toThrow(/sin scale/);
    expect(() => objectsOf('prop 4-2,0 a/b')).toThrow(/tramo/);
    expect(() => objectsOf('prop 3-6,0 a/b')).toThrow(/fuera del mapa/);
  });
});
