import Phaser from 'phaser';
import existingAssets from 'virtual:kerana-assets';
import { backgroundPath } from './manifest';

// Carga por escena de los fondos (ASSETS §6-7): cada nivel pide los suyos en `preload` y StoryScene los del final.
// Si falta el archivo, avisa una vez y la escena queda con su color o su fondo por código.
const existing = new Set(existingAssets);
const warned = new Set<string>();

export function queueBackgrounds(scene: Phaser.Scene, keys: ReadonlyArray<string | undefined>): void {
  for (const key of keys) {
    if (!key || scene.textures.exists(key)) continue;
    const path = backgroundPath(key);
    if (existing.has(path)) scene.load.image(key, `assets/${path}`);
    else if (!warned.has(key)) {
      warned.add(key);
      console.warn(`[ASSET FALTANTE] ${key}`);
    }
  }
}
