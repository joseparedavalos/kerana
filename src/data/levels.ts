import type { LevelDef, LevelId } from './types';

// Los 7 niveles (GDD §6, coordenadas §8.4) más el nivel de prueba.
// Hasta que cada sesión de nivel (S6-S12) genere su propio `tools/levels/l<N>.txt`,
// el nodo apunta a su `map_lN` futuro (l1 ya tiene el suyo desde S6). El flujo Mapa → Nivel → Nivel
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
    backgrounds: {},
    musicKey: '',
    boss: null,
    gift: null,
    mapNode: { x: 0, y: 0 },
  },
  // Vitrina de las piezas de motor (S18): fuera de la campaña y del mapa (order 0). ?debug=1&level=vitrina&gifts=all
  vitrina: {
    id: 'vitrina',
    order: 0,
    nameKey: 'level.vitrina.name',
    subtitleKey: 'level.vitrina.name',
    mapKey: 'map_vitrina',
    mapSource: 'ascii',
    biome: 'selva',
    backgrounds: {},
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
    mapKey: 'map_l1',
    mapSource: 'ascii',
    biome: 'cerro',
    // Subido: con el suelo tan arriba de la vista, centrado quedaban tapados los cerros.
    backgrounds: { far: 'bg_l1_far', cave: 'bg_l1_cave', shiftY: 110 },
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
    backgrounds: { far: 'bg_l2_far' },
    terrainShell: 3,
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
    backgrounds: { far: 'bg_l3_far' },
    terrainShell: 3,
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
    // Fondo lejano (cerros, campanario, lapacho). La calle es el tileset, como en l3.
    backgrounds: { far: 'bg_l4_far', shiftY: 0 },
    terrainShell: 3,
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
    backgrounds: { far: 'bg_l5_far' },
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
    backgrounds: { far: 'bg_l6_far' },
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
    backgrounds: { far: 'bg_l7_far' },
    musicKey: '',
    boss: 'luison',
    gift: null,
    dark: true,
    mapNode: { x: -57.63, y: -25.28 },
  },
  // Yvága, el cielo (GDD §7): solo la arena de Tau, sin nivel previo. Se llega al liberar a Luisón.
  yvaga: {
    id: 'yvaga',
    order: 8,
    nameKey: 'level.yvaga.name',
    subtitleKey: 'level.yvaga.subtitle',
    mapKey: 'map_yvaga',
    mapSource: 'ascii',
    biome: 'cielo',
    backgrounds: { far: 'bg_yvaga_far' },
    musicKey: '',
    boss: 'tau',
    gift: null,
    finale: true,
    mapNode: { x: -57.63, y: -25.28 },
  },
};

/** Los 7 niveles jugables, en orden (sin el nivel de prueba ni Yvága), para el mapa del mundo. */
export const WORLD_LEVELS: LevelDef[] = Object.values(LEVELS)
  .filter((l): l is LevelDef => l != null && l.order > 0 && !l.finale)
  .sort((a, b) => a.order - b.order);

export const DEFAULT_LEVEL: LevelId = 'test';

export function getLevel(id: LevelId): LevelDef {
  const def = LEVELS[id];
  if (def) return def;
  console.warn(`[NIVEL] "${id}" todavía no existe; se usa "${DEFAULT_LEVEL}".`);
  return LEVELS[DEFAULT_LEVEL] as LevelDef;
}
