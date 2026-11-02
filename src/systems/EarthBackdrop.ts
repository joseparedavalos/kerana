import Phaser from "phaser";
import { GAMEPLAY } from "../config/gameplay";
import { averageColor } from "./backdropLogic";
import { earthChunks, earthPixels } from "./terrainLogic";

const CFG = GAMEPLAY.backdrop.earth;

/** Un trozo del fondo de tierra y su caja en el mundo (para no dibujarlo fuera de la vista). */
export interface EarthChunk {
  img: Phaser.GameObjects.Image;
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/**
 * Fondo de tierra (S68): lo que asoma detrás de la repisa de S28 dentro de la tierra maciza, en vez del cielo.
 * Una textura de un píxel por tile (518 × 40 en l3, ≈ 83 KB) estirada al tamaño del mapa con filtro lineal: el
 * borde pasa en degradado, sin escalones. Va en el mundo (no fija a la cámara), justo encima del fondo lejano y
 * detrás de todo lo demás. El color es el medio de la casilla de relleno del tileset, oscurecido.
 * No es el fondo de cueva de l1 (`LevelBackdrop`): ese recorta una imagen fija a la cámara en tramos que ocupan
 * toda la altura; la tierra sigue la forma de cada bloque.
 */
export function addEarthBackdrop(
  scene: Phaser.Scene,
  key: string,
  tilesetKey: string,
  depth: Uint8Array,
  width: number,
  height: number,
  tileSize: number,
  tiles: number,
  covered?: (i: number) => boolean,
): EarthChunk[] {
  const color = fillColor(scene, tilesetKey, tileSize);
  if (color === undefined) return [];
  const textureKey = `earth_${key}`;
  if (scene.textures.exists(textureKey)) scene.textures.remove(textureKey);
  const tex = scene.textures.createCanvas(textureKey, width, height);
  if (!tex) return [];
  const pixels = earthPixels(depth, tiles, color, CFG, covered);
  const ctx = tex.getContext();
  const img = ctx.createImageData(width, height);
  img.data.set(pixels);
  ctx.putImageData(img, 0, 0);
  tex.refresh();
  tex.setFilter(Phaser.Textures.FilterMode.LINEAR);
  // Un trozo por tramo de columnas, recortado a donde hay tierra: lo transparente no se dibuja (con el render por
  // software, una imagen del alto del mapa costaba ≈ 8 FPS aunque casi toda fuera transparente).
  return earthChunks(pixels, width, height, CFG.chunkTiles).map((c) => ({
    img: scene.add.image(0, 0, textureKey).setOrigin(0).setScale(tileSize).setCrop(c.x, c.y, c.width, c.height).setDepth(CFG.depth),
    left: c.x * tileSize,
    top: c.y * tileSize,
    right: (c.x + c.width) * tileSize,
    bottom: (c.y + c.height) * tileSize,
  }));
}

/** Solo se dibujan los trozos que tocan la vista (las imágenes no se descartan solas fuera de cámara). */
export function cullEarth(chunks: readonly EarthChunk[], view: Phaser.Geom.Rectangle): void {
  for (const c of chunks) c.img.setVisible(c.left < view.right && c.right > view.x && c.top < view.bottom && c.bottom > view.y);
}

/** Color medio de la casilla de relleno del tileset (`CFG.fillTile`: rodeada de suelo por los cuatro lados). */
function fillColor(
  scene: Phaser.Scene,
  tilesetKey: string,
  tileSize: number,
): number | undefined {
  if (!scene.textures.exists(tilesetKey)) return undefined;
  const src = scene.textures
    .get(tilesetKey)
    .getSourceImage() as CanvasImageSource & { width: number; height: number };
  const cols = Math.floor(src.width / tileSize);
  if (cols === 0) return undefined;
  const probe = document.createElement("canvas");
  probe.width = tileSize;
  probe.height = tileSize;
  const ctx = probe.getContext("2d", { willReadFrequently: true });
  if (!ctx) return undefined;
  const sx = (CFG.fillTile % cols) * tileSize;
  const sy = Math.floor(CFG.fillTile / cols) * tileSize;
  ctx.drawImage(src, sx, sy, tileSize, tileSize, 0, 0, tileSize, tileSize);
  return averageColor(ctx.getImageData(0, 0, tileSize, tileSize).data);
}
