import { describe, expect, it } from 'vitest';
import { layoutShowcase, parsePropId } from '../src/assets/propLayout';

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
