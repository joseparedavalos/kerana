import type Phaser from 'phaser';
import { GAMEPLAY } from '../config/gameplay';
import { ensurePlaceholder } from '../utils/placeholder';
import { ART_DETAIL, propAtlasKey } from './manifest';
import { parsePropId, placeTuft, type PropTuft } from './propLayout';
import { flowFrame, waterMask, type FlowSpec } from './waterFlow';

/** Lo que trae el frame del atlas desde `sheets.<nombre>` del sprite.json (tools/lib/sprite-pipeline.mjs). */
interface PropFrameData {
  hang?: boolean;
  /** S47: unidades que se hunde bajo la línea del suelo (los dibujados de arriba parecen flotar). */
  sink?: number;
  /** S47: solo va sobre agua (camalote, irupé). */
  waterOnly?: boolean;
  flow?: FlowSpec;
  /** S47: [x0, x1, y] en fracciones del dibujo: donde el agua golpea y saltan gotas. */
  splash?: readonly [number, number, number];
  mist?: boolean;
  /** S48: matas de pasto (otros props) que se colocan solas al pie del árbol. */
  tufts?: readonly PropTuft[];
}

/** Textura, frame y escala de un prop. `hang`: cuelga del techo (origen arriba) en vez de apoyarse en el piso. */
export interface PropLook {
  key: string;
  frame?: string;
  scale: number;
  hang: boolean;
  /** Unidades bajo la línea del suelo, a escala 1 (0 si no se hunde o si cuelga). */
  sink: number;
  waterOnly: boolean;
  data: PropFrameData;
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
    const data = (frame.customData ?? {}) as PropFrameData;
    const hang = data.hang === true;
    return { key, frame: parsed.name, scale: 1 / atlasDetail(scene, key), hang, sink: hang ? 0 : (data.sink ?? 0), waterOnly: data.waterOnly === true, data };
  }
  console.warn(`[ASSET FALTANTE] prop ${id}`);
  const size = GAMEPLAY.props.placeholderSize;
  ensurePlaceholder(scene, 'prop_missing', size, size);
  return { key: 'prop_missing', scale: 1, hang: false, sink: 0, waterOnly: false, data: {} };
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
  /** Partículas para las gotas de los props con `splash` (S47: las salpicaduras de LevelScene). */
  drops?: Phaser.GameObjects.Particles.ParticleEmitter;
  /** Unidades bajo la línea del suelo, a escala 1: reemplaza el `sink` del frame (S48: las matas de `tufts`). */
  sink?: number;
  /** S50: es la mata de otro prop: no lleva matas propias (helechos y hojarasca se usan uno al pie del otro). */
  asTuft?: boolean;
}

/**
 * Dibuja un prop sin choque. (x, y) es el pie del tile donde se colocó: los que se apoyan quedan con la base ahí
 * (o `sink` unidades más abajo, detrás del piso: S47); los que cuelgan, con el borde de arriba en el techo de ese
 * tile (`tile` unidades más arriba). El agua de l6_agua se anima sola (S47): `flow`, `splash` y `mist`. Los árboles
 * con `tufts` (S48) llevan matas de pasto al pie, dibujadas después del árbol (delante de él).
 */
export function addProp(
  scene: Phaser.Scene,
  x: number,
  y: number,
  id: string,
  tile: number,
  opts: PropOptions = {},
): Phaser.GameObjects.Image | Phaser.GameObjects.Sprite {
  const look = propLook(scene, id);
  const scale = look.scale * (opts.scale ?? 1);
  const sink = look.hang ? 0 : (opts.sink ?? look.sink) * (opts.scale ?? 1);
  const flow = look.frame !== undefined && look.data.flow ? flowAnim(scene, look.key, look.frame, look.data.flow) : null;
  const image = flow ? scene.add.sprite(0, 0, flow.texture, flow.first).play(flow.anim) : scene.add.image(0, 0, look.key, look.frame);
  image
    .setPosition(x, look.hang ? y - tile : y + sink)
    .setOrigin(0.5, look.hang ? 0 : 1)
    .setScale(scale)
    .setFlipX(opts.flip === true)
    .setDepth(opts.front ? GAMEPLAY.props.frontDepth : sink > 0 ? GAMEPLAY.props.sunkDepth : GAMEPLAY.props.depth);
  if (look.data.mist) addMist(scene, image);
  if (look.data.splash && opts.drops) addDrops(scene, image, look.data.splash, opts.drops);
  for (const tuft of opts.asTuft ? [] : (look.data.tufts ?? [])) {
    const at = placeTuft(tuft, image.displayWidth, opts.scale ?? 1, opts.flip === true);
    addProp(scene, x + at.dx, y, tuft.prop, tile, { scale: at.scale, flip: at.flip, front: opts.front, sink: at.sink, asTuft: true });
  }
  return image;
}

/**
 * Fotogramas del agua que corre (S47), una vez por prop y por partida: una textura de lienzo con `frames`
 * fotogramas en fila (waterFlow.ts) y una animación en bucle. La velocidad sale de GAMEPLAY.props.water.
 */
function flowAnim(scene: Phaser.Scene, key: string, frameName: string, flow: FlowSpec): { texture: string; first: string; anim: string } | null {
  const cfg = GAMEPLAY.props.water;
  const texture = `${key}__flow_${frameName}`;
  const anim = texture;
  const first = `${frameName}_0`;
  if (!scene.textures.exists(texture)) {
    const frame = scene.textures.getFrame(key, frameName);
    const w = frame.cutWidth;
    const h = frame.cutHeight;
    const canvas = scene.textures.createCanvas(texture, w * cfg.frames, h);
    if (!canvas) return null;
    const ctx = canvas.context;
    ctx.drawImage(frame.source.image as CanvasImageSource, frame.cutX, frame.cutY, w, h, 0, 0, w, h);
    const src = ctx.getImageData(0, 0, w, h);
    const mask = waterMask(src.data, w, h, flow.region, cfg);
    const out = ctx.createImageData(w, h);
    for (let k = 0; k < cfg.frames; k++) {
      flowFrame(src.data, w, h, mask, flow.dir, cfg.period, k / cfg.frames, out.data);
      ctx.putImageData(out, k * w, 0);
      canvas.add(`${frameName}_${k}`, 0, k * w, 0, w, h);
    }
    canvas.refresh();
  }
  if (!scene.anims.exists(anim)) {
    // Un ciclo corre `period` px de arte: a `speed` unidades/s y `detail` px por unidad dura period / (speed × detail) s.
    const speed = flow.dir === 'down' ? cfg.fallSpeed : cfg.sheetSpeed;
    const cycleSec = cfg.period / (speed * atlasDetail(scene, key));
    scene.anims.create({
      key: anim,
      frames: Array.from({ length: cfg.frames }, (_, k) => ({ key: texture, frame: `${frameName}_${k}` })),
      frameRate: cfg.frames / cycleSec,
      repeat: -1,
    });
  }
  return { texture, first, anim };
}

/** Rocío que sube despacio y cambia de opacidad (S47): vuelve abajo cuando está más transparente. */
function addMist(scene: Phaser.Scene, image: Phaser.GameObjects.Image | Phaser.GameObjects.Sprite): void {
  const cfg = GAMEPLAY.props.water;
  const baseY = image.y;
  scene.tweens.addCounter({
    from: 0,
    to: 1,
    duration: cfg.mistCycleMs,
    repeat: -1,
    onUpdate: (tween) => {
      const p = tween.getValue() ?? 0;
      image.y = baseY - cfg.mistRise * p;
      image.alpha = cfg.mistAlphaMin + (cfg.mistAlphaMax - cfg.mistAlphaMin) * Math.sin(Math.PI * p);
    },
  });
}

/** Gotas que saltan donde el agua golpea abajo (S47), con las partículas de salpicadura que ya tiene el nivel. */
function addDrops(
  scene: Phaser.Scene,
  image: Phaser.GameObjects.Image | Phaser.GameObjects.Sprite,
  splash: readonly [number, number, number],
  drops: Phaser.GameObjects.Particles.ParticleEmitter,
): void {
  const cfg = GAMEPLAY.props.water;
  const [x0, x1, fy] = splash;
  scene.time.addEvent({
    delay: cfg.dropsEveryMs,
    loop: true,
    callback: () => {
      const left = image.x - image.displayWidth / 2;
      const fx = x0 + Math.random() * (x1 - x0);
      const x = image.flipX ? left + (1 - fx) * image.displayWidth : left + fx * image.displayWidth;
      drops.emitParticleAt(x, image.y - image.displayHeight * (1 - fy), cfg.dropsPerBurst);
    },
  });
}
