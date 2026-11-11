import { describe, expect, it } from 'vitest';
import { GAMEPLAY } from '../src/config/gameplay';
import { LEVELS } from '../src/data/levels';
import { arenaEntry, insideArena } from '../src/systems/arenaGround';

// S91: con la arena trabada, el punto de regreso nunca puede quedar afuera (Kerana caía al agua de un camalote de
// Mbói Tu'i y volvía a x 233, 160 tiles antes, con la cámara y la pared de la pelea del otro lado).
const MAPS = import.meta.glob('../public/assets/maps/*.json', { eager: true, import: 'default' }) as Record<string, any>;
const mapOf = (key: string): any => MAPS[Object.keys(MAPS).find((f) => f.endsWith(`/${key.replace(/^map_/, '')}.json`))!];

describe('arenaEntry', () => {
  const tile = 16;
  // Arena de 10 × 6: suelo en la fila 5, agua en las columnas 3 y 4.
  const ground = (c: number, r: number) => r === 5 && c >= 0 && c < 10 && c !== 3 && c !== 4;
  const box = { left: 0, top: 0, right: 160, bottom: 96 };

  it('elige el primer suelo firme con las dos vecinas firmes y libres', () => {
    expect(arenaEntry(box, tile, { ground, blocked: () => false }, 1)).toEqual({ x: 1.5 * tile, y: 5 * tile });
    // Con un peligro sobre la columna 1, salta hasta después del agua.
    const blocked = (c: number, r: number) => c === 1 && r === 4;
    expect(arenaEntry(box, tile, { ground, blocked }, 1)).toEqual({ x: 6.5 * tile, y: 5 * tile });
  });

  it('sin suelo firme no inventa uno', () => {
    expect(arenaEntry(box, tile, { ground: () => false, blocked: () => false }, 1)).toBeNull();
  });

  it('insideArena deja afuera la pared y lo que queda a la izquierda', () => {
    expect(insideArena(box, tile, 8, 80)).toBe(false);
    expect(insideArena(box, tile, 24, 80)).toBe(true);
    expect(insideArena({ left: 396 * 16, top: 17 * 16, right: 436 * 16, bottom: 40 * 16 }, tile, 3735, 416)).toBe(false);
  });
});

describe('las ocho arenas tienen entrada firme', () => {
  const withBoss = Object.values(LEVELS).filter((l) => l.boss);
  it('son ocho', () => expect(withBoss.length).toBe(8));
  for (const level of withBoss) {
    it(level.id, () => {
      const map = mapOf(level.mapKey);
      const { width, height, tilewidth: tile } = map;
      const layer = (name: string): number[] | undefined => map.layers.find((l: any) => l.name === name)?.data;
      const at = (data: number[] | undefined, c: number, r: number) => !!data && c >= 0 && r >= 0 && c < width && r < height && data[r * width + c] !== 0;
      const groundL = layer('Ground');
      const unsafe = [layer('Hazards'), layer('Water'), groundL];
      const obj = map.layers.filter((l: any) => l.type === 'objectgroup').flatMap((l: any) => l.objects).find((o: any) => (o.type || o.class) === 'BossArena');
      const box = { left: obj.x, top: obj.y, right: obj.x + obj.width, bottom: obj.y + obj.height };
      const entry = arenaEntry(box, tile, { ground: (c, r) => at(groundL, c, r), blocked: (c, r) => unsafe.some((d) => at(d, c, r)) }, GAMEPLAY.boss.arenaEntryTiles);
      expect(entry).not.toBeNull();
      expect(insideArena(box, tile, entry!.x, entry!.y)).toBe(true);
    });
  }
});
