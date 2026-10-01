import { BIOMES } from '../data/types';

// Lista única de assets (GDD §11.8). Rutas relativas a public/assets.
export type AssetEntry =
  | { type: 'image'; key: string; path: string; width: number; height: number; codePlaceholder?: boolean }
  | { type: 'spritesheet'; key: string; path: string; frameWidth: number; frameHeight: number; frames: number }
  | { type: 'tilemap'; key: string; path: string }
  | { type: 'json'; key: string; path: string };

export const TILE_SIZE = 16;
/** Tileset placeholder: 4 columnas × 7 filas (ver tools/make-placeholder-tiles.mjs). */
export const TILESET_COLUMNS = 4;
export const TILESET_ROWS = 7;

/** Kerana provisional (se genera en PreloadScene) si falta el sprite real. */
export const PLAYER_PLACEHOLDER_KEY = 'kerana_placeholder';
/** Sprite real de Kerana (`npm run sprites`) y sus animaciones (`kerana_idle`, `kerana_run`…). */
export const PLAYER_KEY = 'kerana';
/** Lado del frame en píxeles de textura (kerana.json: detail 2 → 64 unidades del mundo). */
export const PLAYER_FRAME = 128;
/** Sufijo de la clave del JSON de animaciones que genera el pipeline (`kerana` → `kerana_anims`). */
export const ANIMS_SUFFIX = '_anims';

/**
 * Fondos de los niveles y del final (`raw/backgrounds/<nombre>.jpg` → `backgrounds/<nombre>.jpg`, 1280 × 720).
 * No van en el manifest: cada nivel (y StoryScene) carga solo los suyos (`queueBackgrounds`). Clave de textura: `bg_<nombre>`.
 */
export const BACKGROUND_PREFIX = 'bg_';
export const backgroundPath = (key: string): string => `backgrounds/${key.slice(BACKGROUND_PREFIX.length)}.jpg`;

/** Sprites de los jefes y de Mainumby (`npm run sprites`): clave → frame en píxeles de textura (ver raw/<id>/sprite.json). */
export const CHARACTER_SPRITES: Record<string, [number, number]> = {
  teju_jagua_head: [56, 48],
  mboi_tui: [128, 96],
  monai: [72, 128],
  jasy_jatere: [64, 72],
  kurupi: [64, 96],
  ao_ao: [128, 64],
  luison: [104, 72],
  tau_disguise: [64, 68],
  tau_true: [88, 80],
  mainumby: [40, 28],
};

export const tilesetKey = (biome: string): string => `tiles_${biome}`;

export const MANIFEST: AssetEntry[] = [
  ...BIOMES.map(
    (b): AssetEntry => ({
      type: 'image',
      key: tilesetKey(b),
      path: `tiles/${b}.png`,
      width: TILE_SIZE * TILESET_COLUMNS,
      height: TILE_SIZE * TILESET_ROWS,
    }),
  ),
  { type: 'tilemap', key: 'map_test', path: 'maps/test.json' },
  { type: 'tilemap', key: 'map_l1', path: 'maps/l1.json' },
  { type: 'tilemap', key: 'map_l2', path: 'maps/l2.json' },
  { type: 'tilemap', key: 'map_l3', path: 'maps/l3.json' },
  { type: 'tilemap', key: 'map_l4', path: 'maps/l4.json' },
  { type: 'tilemap', key: 'map_l5', path: 'maps/l5.json' },
  { type: 'tilemap', key: 'map_l6', path: 'maps/l6.json' },
  { type: 'tilemap', key: 'map_l7', path: 'maps/l7.json' },
  { type: 'tilemap', key: 'map_yvaga', path: 'maps/yvaga.json' },

  // Sprites del pipeline: PNG en grilla de frames iguales + JSON con las animaciones.
  { type: 'spritesheet', key: PLAYER_KEY, path: 'sprites/kerana.png', frameWidth: PLAYER_FRAME, frameHeight: PLAYER_FRAME, frames: 1 },
  { type: 'json', key: PLAYER_KEY + ANIMS_SUFFIX, path: 'sprites/kerana.json' },
  ...Object.entries(CHARACTER_SPRITES).flatMap(([key, [frameWidth, frameHeight]]): AssetEntry[] => [
    { type: 'spritesheet', key, path: `sprites/${key}.png`, frameWidth, frameHeight, frames: 1 },
    { type: 'json', key: key + ANIMS_SUFFIX, path: `sprites/${key}.json` },
  ]),

  // Interfaz y props: por ahora sin arte, PreloadScene genera placeholders.
  { type: 'image', key: 'heart_full', path: 'ui/heart_full.png', width: 12, height: 12 },
  { type: 'image', key: 'heart_empty', path: 'ui/heart_empty.png', width: 12, height: 12 },
  { type: 'image', key: 'sign', path: 'sprites/sign.png', width: 16, height: 16 },
  { type: 'spritesheet', key: 'checkpoint', path: 'sprites/checkpoint.png', frameWidth: 16, frameHeight: 24, frames: 8 },
];
