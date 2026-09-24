import type { LevelDef, LevelId } from './types';

export const LEVELS: Partial<Record<LevelId, LevelDef>> = {
  test: {
    id: 'test',
    order: 0,
    nameKey: 'level.test.name',
    subtitleKey: 'level.test.name',
    mapKey: 'map_test',
    mapSource: 'ascii',
    biome: 'cerro',
    backgrounds: [],
    musicKey: '',
    boss: null,
    gift: null,
    mapNode: { x: 0, y: 0 },
  },
};

export const DEFAULT_LEVEL: LevelId = 'test';

export function getLevel(id: LevelId): LevelDef {
  const def = LEVELS[id];
  if (def) return def;
  console.warn(`[NIVEL] "${id}" todavía no existe; se usa "${DEFAULT_LEVEL}".`);
  return LEVELS[DEFAULT_LEVEL] as LevelDef;
}
