import Phaser from "phaser";
import { GAMEPLAY } from "../config/gameplay";
import { earthCells } from "./terrainLogic";

const CFG = GAMEPLAY.backdrop.earth;

/**
 * Fondo de tierra (S68, S69): lo que asoma detrás de la repisa de S28 dentro de la tierra maciza, en vez del cielo.
 * Desde S69 es una capa de tiles con la misma baldosa del suelo (la de esa celda de Ground), tintada en sombra, con
 * giro y espejo por celda para que no se lea como papel tapiz. Sin degradado: la transición la hace la fila tenue de
 * la repisa (`terrainFadeAlpha`), que se dibuja encima. Justo encima del fondo lejano y detrás de todo lo demás; la
 * capa descarta sola lo que queda fuera de la vista.
 * No es el fondo de cueva de l1 (`LevelBackdrop`): ese recorta una imagen fija a la cámara en tramos que ocupan
 * toda la altura; la tierra sigue la forma de cada bloque.
 */
export function addEarthBackdrop(
  map: Phaser.Tilemaps.Tilemap,
  tileset: Phaser.Tilemaps.Tileset,
  ground: Phaser.Tilemaps.TilemapLayer,
  depth: Uint8Array,
  tiles: number,
  covered?: (i: number) => boolean,
): Phaser.Tilemaps.TilemapLayer | null {
  const cells = earthCells(depth, map.width, tiles, CFG, covered);
  if (cells.length === 0) return null;
  const layer = map.createBlankLayer("EarthBackdrop", tileset);
  if (!layer) return null;
  for (const c of cells) {
    const source = ground.getTileAt(c.x, c.y, true);
    if (!source || source.index === -1) continue;
    const tile = layer.putTileAt(source.index, c.x, c.y, false);
    tile.tint = (c.gray << 16) | (c.gray << 8) | c.gray;
    tile.rotation = (c.turn * Math.PI) / 2;
    tile.flipX = c.flip;
  }
  return layer.setDepth(CFG.depth);
}
