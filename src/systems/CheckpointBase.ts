import Phaser from 'phaser';
import { GAMEPLAY } from '../config/gameplay';
import { drawBlades, paintAshPatch, planBlades, stainGround } from './checkpointBaseLogic';
import { makePixels, type Pixels } from './pixelArt';

// Base de la fogata del checkpoint (S121): la mancha de tierra y ceniza detrás de la ronda y, delante, la franja del
// piso del bioma (las mismas casillas que hay debajo, con su tinte) con matas de pasto. Así la ronda hundida
// (`GAMEPLAY.checkpointFire.sink`) queda metida en el suelo. Solo dibujo: no choca.

const PATCH_VARIANTS = 4;

/** Píxeles de cada textura de tileset, leídos una sola vez. */
const sourcePixels = new WeakMap<object, ImageData>();

function pixelsOf(texture: Phaser.Textures.Texture): ImageData | null {
  const src = texture.getSourceImage() as HTMLImageElement | HTMLCanvasElement;
  const cached = sourcePixels.get(src);
  if (cached) return cached;
  const canvas = document.createElement('canvas');
  canvas.width = src.width;
  canvas.height = src.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(src, 0, 0);
  const data = ctx.getImageData(0, 0, src.width, src.height);
  sourcePixels.set(src, data);
  return data;
}

function upload(scene: Phaser.Scene, key: string, px: Pixels): void {
  const tex = scene.textures.createCanvas(key, px.width, px.height);
  if (!tex) return;
  const img = tex.context.createImageData(px.width, px.height);
  img.data.set(px.data);
  tex.context.putImageData(img, 0, 0);
  tex.refresh();
}

/** Copia sobre `strip` (origen en el mundo: ox, oy) las casillas de `layer` que lo tocan, con espejo, tinte y alfa. */
function stampLayer(strip: Pixels, ox: number, oy: number, layer: Phaser.Tilemaps.TilemapLayer): void {
  const tw = layer.tilemap.tileWidth;
  const th = layer.tilemap.tileHeight;
  for (let cy = Math.floor(oy / th); cy <= Math.floor((oy + strip.height - 1) / th); cy++) {
    for (let cx = Math.floor(ox / tw); cx <= Math.floor((ox + strip.width - 1) / tw); cx++) {
      const tile = layer.getTileAt(cx, cy);
      if (!tile || tile.index < 0 || !tile.visible) continue;
      const tileset = tile.tileset;
      const at = tileset?.getTileTextureCoordinates(tile.index) as { x: number; y: number } | null;
      if (!tileset?.image || !at) continue;
      const src = pixelsOf(tileset.image);
      if (!src) continue;
      const tint = tile.tint;
      const tr = ((tint >> 16) & 255) / 255;
      const tg = ((tint >> 8) & 255) / 255;
      const tb = (tint & 255) / 255;
      const alpha = tile.alpha * layer.alpha;
      for (let j = 0; j < th; j++) {
        const y = cy * th + j - oy;
        if (y < 0 || y >= strip.height) continue;
        for (let i = 0; i < tw; i++) {
          const x = cx * tw + i - ox;
          if (x < 0 || x >= strip.width) continue;
          const si = ((at.y + j) * src.width + at.x + (tile.flipX ? tw - 1 - i : i)) * 4;
          const a = (src.data[si + 3] / 255) * alpha;
          if (a <= 0) continue;
          const di = (y * strip.width + x) * 4;
          const da = strip.data[di + 3] / 255;
          const oa = a + da * (1 - a);
          const blend = (s: number, d: number) => (s * a + d * da * (1 - a)) / oa;
          strip.data[di] = blend(src.data[si] * tr, strip.data[di]);
          strip.data[di + 1] = blend(src.data[si + 1] * tg, strip.data[di + 1]);
          strip.data[di + 2] = blend(src.data[si + 2] * tb, strip.data[di + 2]);
          strip.data[di + 3] = oa * 255;
        }
      }
    }
  }
}

/**
 * La mancha va antes que la ronda y la franja después: llamar a `addPatch`, crear la ronda y después `addFront`.
 * (x, y) son los pies de la fogata en el mapa (el borde del tile), no la ronda hundida.
 */
export const CheckpointBase = {
  addPatch(scene: Phaser.Scene, x: number, y: number): Phaser.GameObjects.Image {
    const cfg = GAMEPLAY.checkpointFire.patch;
    const variant = Math.abs(Math.round(x / 16)) % PATCH_VARIANTS;
    const key = `checkpoint_patch_${variant}`;
    if (!scene.textures.exists(key)) upload(scene, key, paintAshPatch(cfg, variant));
    return scene.add.image(x, y + cfg.centerY, key).setScale(1 / cfg.detail);
  },

  /**
   * `key` único por nivel y fogata; `layers`, las capas de piso en el orden en que se dibujan. La imagen se crea ya
   * (para quedar delante de la ronda) y la textura se pinta con `paint`, cuando el piso tiene todos sus tintes (las
   * zonas de cueva tiñen Ground después de los checkpoints). `stain` false: sin la mancha en el borde (las nubes).
   */
  addFront(
    scene: Phaser.Scene,
    x: number,
    y: number,
    key: string,
    layers: readonly (Phaser.Tilemaps.TilemapLayer | null | undefined)[],
    stain = true,
  ): { image: Phaser.GameObjects.Image; paint: () => void } {
    const cfg = GAMEPLAY.checkpointFire.front;
    const ox = Math.round(x - cfg.halfWidth);
    const oy = Math.round(y - cfg.above);
    const fresh = !scene.textures.exists(key);
    const tex = fresh ? scene.textures.createCanvas(key, cfg.halfWidth * 2, cfg.above + cfg.below) : null;
    const image = scene.add.image(ox, oy, key).setOrigin(0, 0);
    const paint = () => {
      if (!tex) return;
      const strip = makePixels(cfg.halfWidth * 2, cfg.above + cfg.below);
      for (const layer of layers) if (layer) stampLayer(strip, ox, oy, layer);
      const seed = Math.round(x / 16);
      const blades = planBlades(strip, cfg.above, cfg.blades, 1, seed);
      if (stain) stainGround(strip, cfg.above, cfg.stain, GAMEPLAY.checkpointFire.patch, 1, seed);
      drawBlades(strip, blades, cfg.blades.tipLighten);
      const img = tex.context.createImageData(strip.width, strip.height);
      img.data.set(strip.data);
      tex.context.putImageData(img, 0, 0);
      tex.refresh();
    };
    return { image, paint };
  },
};
