import type { LevelDef, LevelId } from './types';

// Los 7 niveles (GDD §6, coordenadas §8.4) más el nivel de prueba.
// Hasta que cada sesión de nivel (S6-S12) genere su propio `tools/levels/l<N>.txt`,
// el nodo usa el mapa de prueba como mapa provisional: así el flujo Mapa → Nivel → Nivel
// completado → Mapa se puede jugar de punta a punta desde ya (criterio de aceptación de S4).
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
  l1: {
    id: 'l1',
    order: 1,
    nameKey: 'level.l1.name',
    subtitleKey: 'level.l1.subtitle',
    mapKey: 'map_test',
    mapSource: 'ascii',
    biome: 'cerro',
    backgrounds: [],
    musicKey: '',
    boss: 'teju_jagua',
    gift: 'charged_slash',
    mapNode: { x: -57.15, y: -25.62 },
  },
  l2: {
    id: 'l2',
    order: 2,
    nameKey: 'level.l2.name',
    subtitleKey: 'level.l2.subtitle',
    mapKey: 'map_l2',
    mapSource: 'ascii',
    biome: 'estero',
    backgrounds: [],
    musicKey: '',
    boss: 'mboi_tui',
    gift: 'heart_up',
    mapNode: { x: -58.3, y: -26.86 },
  },
  l3: {
    id: 'l3',
    order: 3,
    nameKey: 'level.l3.name',
    subtitleKey: 'level.l3.subtitle',
    mapKey: 'map_l3',
    mapSource: 'ascii',
    biome: 'campo',
    backgrounds: [],
    musicKey: '',
    boss: 'monai',
    gift: 'double_jump',
    mapNode: { x: -57.14, y: -26.67 },
  },
  l4: {
    id: 'l4',
    order: 4,
    nameKey: 'level.l4.name',
    subtitleKey: 'level.l4.subtitle',
    mapKey: 'map_l4',
    mapSource: 'ascii',
    biome: 'pueblo',
    backgrounds: [],
    musicKey: '',
    boss: 'jasy_jatere',
    gift: 'dash',
    mapNode: { x: -57.45, y: -25.35 },
  },
  l5: {
    id: 'l5',
    order: 5,
    nameKey: 'level.l5.name',
    subtitleKey: 'level.l5.subtitle',
    mapKey: 'map_l5',
    mapSource: 'ascii',
    biome: 'selva',
    backgrounds: [],
    musicKey: '',
    boss: 'kurupi',
    gift: 'heart_up',
    mapNode: { x: -55.52, y: -24.13 },
  },
  l6: {
    id: 'l6',
    order: 6,
    nameKey: 'level.l6.name',
    subtitleKey: 'level.l6.subtitle',
    mapKey: 'map_l6',
    mapSource: 'ascii',
    biome: 'montana',
    backgrounds: [],
    musicKey: '',
    boss: 'ao_ao',
    gift: 'heart_up',
    mapNode: { x: -56.25, y: -25.85 },
  },
  l7: {
    id: 'l7',
    order: 7,
    nameKey: 'level.l7.name',
    subtitleKey: 'level.l7.subtitle',
    mapKey: 'map_l7',
    mapSource: 'ascii',
    biome: 'ciudad',
    backgrounds: [],
    musicKey: '',
    boss: 'luison',
    gift: null,
    mapNode: { x: -57.63, y: -25.28 },
  },
};

/** Los 7 niveles jugables, en orden (sin el nivel de prueba), para el mapa del mundo. */
export const WORLD_LEVELS: LevelDef[] = Object.values(LEVELS)
  .filter((l): l is LevelDef => l != null && l.order > 0)
  .sort((a, b) => a.order - b.order);

export const DEFAULT_LEVEL: LevelId = 'test';

export function getLevel(id: LevelId): LevelDef {
  const def = LEVELS[id];
  if (def) return def;
  console.warn(`[NIVEL] "${id}" todavía no existe; se usa "${DEFAULT_LEVEL}".`);
  return LEVELS[DEFAULT_LEVEL] as LevelDef;
}
