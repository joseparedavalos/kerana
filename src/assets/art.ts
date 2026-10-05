import type Phaser from 'phaser';
import { ensurePlaceholder } from '../utils/placeholder';
import { ART_DETAIL, type ArtKey } from './manifest';

/** Textura y escala para dibujar un prop o ícono. */
export interface ArtLook {
  key: string;
  scale: number;
}

/** El arte cargó (`npm run sprites`). */
export function hasArt(scene: Phaser.Scene, key: ArtKey): boolean {
  return scene.textures.exists(key);
}

/**
 * Arte de props e interfaz a escala 1/ART_DETAIL o, si falta, el placeholder `fallbackKey` (w × h, a escala 1).
 * El juego nunca se rompe por un asset ausente (CLAUDE.md).
 */
export function artOrPlaceholder(scene: Phaser.Scene, key: ArtKey, fallbackKey: string, w: number, h: number, frames = 1): ArtLook {
  if (hasArt(scene, key)) return { key, scale: 1 / ART_DETAIL };
  ensurePlaceholder(scene, fallbackKey, w, h, frames);
  return { key: fallbackKey, scale: 1 };
}
