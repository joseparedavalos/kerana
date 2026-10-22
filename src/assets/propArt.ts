import type Phaser from 'phaser';
import { GAMEPLAY } from '../config/gameplay';
import { ensurePlaceholder } from '../utils/placeholder';
import { ART_DETAIL, propAtlasKey } from './manifest';
import { parsePropId } from './propLayout';

/** Textura, frame y escala de un prop. `hang`: cuelga del techo (origen arriba) en vez de apoyarse en el piso. */
export interface PropLook {
  key: string;
  frame?: string;
  scale: number;
  hang: boolean;
}

/** Píxeles de arte por unidad del atlas (`meta.detail` de `npm run sprites`). */
function atlasDetail(scene: Phaser.Scene, key: string): number {
  const meta = (scene.textures.get(key).customData as { meta?: { detail?: number } } | undefined)?.meta;
  return meta?.detail ?? ART_DETAIL;
}

/** Arte del prop o, si falta su atlas o su frame, un placeholder (el juego nunca se rompe por un asset ausente). */
export function propLook(scene: Phaser.Scene, id: string): PropLook {
  const parsed = parsePropId(id);
  const key = parsed ? propAtlasKey(parsed.folder) : '';
  if (parsed && scene.textures.exists(key) && scene.textures.get(key).has(parsed.name)) {
    const frame = scene.textures.getFrame(key, parsed.name);
    const hang = (frame.customData as { hang?: boolean } | undefined)?.hang === true;
    return { key, frame: parsed.name, scale: 1 / atlasDetail(scene, key), hang };
  }
  console.warn(`[ASSET FALTANTE] prop ${id}`);
  const size = GAMEPLAY.props.placeholderSize;
  ensurePlaceholder(scene, 'prop_missing', size, size);
  return { key: 'prop_missing', scale: 1, hang: false };
}

/** Nombres de los props de una carpeta, en el orden del atlas (alfabético). Vacío si el atlas no cargó. */
export function propNames(scene: Phaser.Scene, folder: string): string[] {
  const key = propAtlasKey(folder);
  if (!scene.textures.exists(key)) return [];
  return scene.textures.get(key).getFrameNames(false);
}

export interface PropOptions {
  /** Multiplica el tamaño de sprite.json (1 por defecto). */
  scale?: number;
  flip?: boolean;
  /** Delante de Kerana (`GAMEPLAY.props.frontDepth`). */
  front?: boolean;
}

/**
 * Dibuja un prop sin choque. (x, y) es el pie del tile donde se colocó: los que se apoyan quedan con la base ahí;
 * los que cuelgan, con el borde de arriba en el techo de ese tile (`tile` unidades más arriba).
 */
export function addProp(scene: Phaser.Scene, x: number, y: number, id: string, tile: number, opts: PropOptions = {}): Phaser.GameObjects.Image {
  const look = propLook(scene, id);
  const image = scene.add
    .image(x, look.hang ? y - tile : y, look.key, look.frame)
    .setOrigin(0.5, look.hang ? 0 : 1)
    .setScale(look.scale * (opts.scale ?? 1))
    .setFlipX(opts.flip === true)
    .setDepth(opts.front ? GAMEPLAY.props.frontDepth : GAMEPLAY.props.depth);
  return image;
}
