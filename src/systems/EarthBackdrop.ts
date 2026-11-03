import Phaser from "phaser";
import { GAMEPLAY } from "../config/gameplay";
import { earthCells } from "./terrainLogic";

const CFG = GAMEPLAY.backdrop.earth;

/**
 * Fondo de tierra (S68, S69, S71): lo que asoma detrás de la repisa de S28 dentro de la tierra maciza, en vez del
 * cielo. Es una capa del mismo mapa (misma grilla de 16 px que Ground) con la baldosa del suelo rodeado por los cuatro
 * lados (`fillTile`, la casilla 15 del autotile) en cada celda: sin tinte, sin giro ni espejo y sin degradado, así no
 * se distingue del terreno de alrededor (S71: el oscurecido de S69 se leía como una caja hundida). Justo encima del
 * fondo lejano y detrás de todo lo demás; la capa descarta sola lo que queda fuera de la vista.
 * No es el fondo de cueva de l1 (`LevelBackdrop`): ese recorta una imagen fija a la cámara en tramos que ocupan
 * toda la altura; la tierra sigue la forma de cada bloque.
 */
export function addEarthBackdrop(
  map: Phaser.Tilemaps.Tilemap,
  tileset: Phaser.Tilemaps.Tileset,
  depth: Uint8Array,
  tiles: number,
  covered?: (i: number) => boolean,
): Phaser.Tilemaps.TilemapLayer | null {
  const cells = earthCells(depth, map.width, tiles, covered);
  if (cells.length === 0) return null;
  const layer = map.createBlankLayer("EarthBackdrop", tileset);
  if (!layer) return null;
  const fill = tileset.firstgid + CFG.fillTile;
  for (const c of cells) layer.putTileAt(fill, c.x, c.y, false);
  return layer.setDepth(CFG.depth);
}
