import { describe, expect, it } from 'vitest';
import { layoutShowcase, parsePropId, placeTuft, type PropTuft } from '../src/assets/propLayout';

describe('props por bioma (S46)', () => {
  it('parsePropId separa carpeta y nombre', () => {
    expect(parsePropId('l3_pastizal/termite_mound_large')).toEqual({ folder: 'l3_pastizal', name: 'termite_mound_large' });
    expect(parsePropId('tacuru')).toBeNull();
    expect(parsePropId('a/b/c')).toBeNull();
  });

  it('layoutShowcase pone los props en fila, con aire entre ellos y más aire entre carpetas', () => {
    const item = (id: string, width: number, hang = false) => ({ id, width, height: 10, hang });
    const out = layoutShowcase(
      [
        { folder: 'a', items: [item('a/x', 20), item('a/y', 10, true)] },
        { folder: 'vacia', items: [] },
        { folder: 'b', items: [item('b/z', 30)] },
      ],
      100,
      5,
      40,
    );
    expect(out.items.map((i) => [i.id, i.x, i.group])).toEqual([
      ['a/x', 110, 0],
      ['a/y', 130, 0],
      ['b/z', 190, 2],
    ]);
    expect(out.groups).toEqual([
      { folder: 'a', x: 100 },
      { folder: 'b', x: 175 },
    ]);
    expect(out.right).toBe(205);
  });
});

describe('matas al pie de los árboles (S48)', () => {
  it('placeTuft ubica la mata desde el centro del árbol y la pasa al otro lado si el árbol va espejado', () => {
    const tuft = { prop: 'l3_pastizal/grass_tuft_bent', x: 0.25, scale: 0.5, sink: 2 };
    expect(placeTuft(tuft, 100, 1, false)).toEqual({ dx: -25, scale: 0.5, flip: false, sink: 2 });
    expect(placeTuft(tuft, 100, 2, true)).toEqual({ dx: 25, scale: 1, flip: true, sink: 2 });
    expect(placeTuft({ prop: 'a/b', x: 0.5, flip: true }, 80, 1, true)).toEqual({ dx: 0, scale: 1, flip: false, sink: 0 });
  });

  it('cada mata de los atlas apunta a un prop que existe', () => {
    type Atlas = { frames: Record<string, { tufts?: PropTuft[] }> };
    const files = import.meta.glob('../public/assets/props/*.json', { eager: true, import: 'default' }) as Record<string, Atlas>;
    const atlases = new Map(Object.entries(files).map(([path, atlas]) => [path.split('/').pop()!.replace('.json', ''), atlas]));
    let count = 0;
    for (const atlas of atlases.values()) {
      for (const frame of Object.values(atlas.frames)) {
        for (const tuft of frame.tufts ?? []) {
          const id = parsePropId(tuft.prop);
          expect(id, tuft.prop).not.toBeNull();
          expect(atlases.get(id!.folder)?.frames[id!.name], tuft.prop).toBeDefined();
          count++;
        }
      }
    }
    expect(count).toBeGreaterThan(0);
  });
});
