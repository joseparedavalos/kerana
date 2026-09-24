import { BIOMES } from '../data/types';

// Lista única de assets (GDD §11.8). Rutas relativas a public/assets.
export type AssetEntry =
  | { type: 'image'; key: string; path: string; width: number; height: number }
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
export const PLAYER_FRAME = 64;
/** Sufijo de la clave del JSON de animaciones que genera el pipeline (`kerana` → `kerana_anims`). */
export const ANIMS_SUFFIX = '_anims';

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

  // Sprites del pipeline: PNG en grilla de frames iguales + JSON con las animaciones.
  { type: 'spritesheet', key: PLAYER_KEY, path: 'sprites/kerana.png', frameWidth: PLAYER_FRAME, frameHeight: PLAYER_FRAME, frames: 1 },
  { type: 'json', key: PLAYER_KEY + ANIMS_SUFFIX, path: 'sprites/kerana.json' },

  // Interfaz y props: por ahora sin arte, PreloadScene genera placeholders.
  { type: 'image', key: 'heart_full', path: 'ui/heart_full.png', width: 12, height: 12 },
  { type: 'image', key: 'heart_empty', path: 'ui/heart_empty.png', width: 12, height: 12 },
  { type: 'image', key: 'sign', path: 'sprites/sign.png', width: 16, height: 16 },
  { type: 'spritesheet', key: 'checkpoint', path: 'sprites/checkpoint.png', frameWidth: 16, frameHeight: 24, frames: 8 },
];
