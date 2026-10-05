import Phaser from 'phaser';
import { ANIMS_SUFFIX } from '../assets/manifest';

/** Lo que el sprite copia del placeholder en cada frame (Image, Ellipse…). */
type SkinSource = Phaser.GameObjects.GameObject &
  Phaser.GameObjects.Components.Transform &
  Pick<Phaser.GameObjects.Components.Alpha, 'alpha'> &
  Phaser.GameObjects.Components.Visible &
  Phaser.GameObjects.Components.Depth &
  Partial<Pick<Phaser.GameObjects.Image, 'flipX' | 'tintMode' | 'tintTopLeft'>>;

export interface SkinOptions {
  /** Animación en reposo (por defecto `<key>_idle`). */
  anim?: string;
  /** El placeholder mira a la derecha sin voltear (las hojas miran a la izquierda): invierte flipX. */
  sourceFacesRight?: boolean;
  /** Origen del sprite en fracciones del frame: el punto que coincide con (x, y) del placeholder. */
  origin?: readonly [number, number];
  /** Desplazamiento extra en unidades del mundo (sin voltear: mirando a la izquierda). */
  offset?: readonly [number, number];
  /** Velocidad de la animación quieto (si se mueve, 1). Ao Ao: la carrera, más lenta en reposo. */
  idleTimeScale?: number;
  /** Profundidad propia (si no, la del placeholder). */
  depth?: number;
  /** Lo que queda por debajo de esta y (mundo) no se dibuja (agua de Mbói Tu'i). */
  clipBelowY?: () => number;
  /** Lo que queda por encima de esta y (mundo) no se dibuja (rama de Moñái). */
  clipAboveY?: () => number;
  /** Quieto, muestra el primer cuadro de la animación en vez de correr en el lugar (hojas walk/run de enemigos). */
  stillFrame?: boolean;
  /** Factor extra de escala vertical del dibujo, sin tocar la hitbox (aleteo del mbopi). */
  scaleY?: () => number;
  /** Lo que queda en esta franja horizontal del frame (fracciones, mirando a la izquierda) no se dibuja (bastón de Jasy Jatere). */
  hideColumns?: () => readonly [number, number] | null;
}

/** ¿Hay sprite real (`npm run sprites`) cargado para `key`? */
export function hasSprite(scene: Phaser.Scene, key: string, anim = `${key}_idle`): boolean {
  return scene.textures.exists(key) && scene.anims.exists(anim);
}

/** `detail` del sprite.json (píxeles de textura por unidad del mundo). */
export function spriteDetail(scene: Phaser.Scene, key: string): number {
  const meta = scene.cache.json.get(key + ANIMS_SUFFIX) as { detail?: number } | undefined;
  return meta?.detail ?? 1;
}

/**
 * Sprite real sobre un placeholder (GDD §9, ASSETS §2): el placeholder deja de dibujarse, pero la
 * lógica del jefe lo sigue moviendo, tiñendo y volteando; el sprite copia todo en cada frame.
 * Así la hitbox (calculada con los tamaños de `gameplay.ts`) no cambia; solo se escala el dibujo.
 */
export class SpriteSkin {
  readonly sprite: Phaser.GameObjects.Sprite;
  private readonly detail: number;
  private lastX: number;
  private lastY: number;
  private released = false;
  /** Desplazamiento horizontal pasajero en unidades del mundo (temblor del aviso de los enemigos). */
  shakeX = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly source: SkinSource,
    key: string,
    private readonly opts: SkinOptions = {},
  ) {
    this.detail = spriteDetail(scene, key);
    this.sprite = scene.add.sprite(source.x, source.y, key);
    this.sprite.play(opts.anim ?? `${key}_idle`);
    // Cada copia arranca en otro frame: siete cabezas (o tres Kurupí) no se mueven al unísono.
    this.sprite.anims.setProgress(Math.random());
    source.removeFromDisplayList();
    this.lastX = source.x;
    this.lastY = source.y;
    scene.events.on(Phaser.Scenes.Events.POST_UPDATE, this.sync, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
    // Si el placeholder se destruye (enemigo purificado), el sprite se va con él.
    source.once(Phaser.GameObjects.Events.DESTROY, this.release, this);
    // Sacarlo de la lista de dibujo también lo saca de la de actualización: un Sprite necesita su preUpdate.
    if ('preUpdate' in source) scene.sys.updateList.add(source);
    this.sync();
  }

  private sync(): void {
    const src = this.source;
    const s = this.sprite;
    const faceRight = (src.flipX ?? false) !== (this.opts.sourceFacesRight ?? false);
    const [dx, dy] = this.opts.offset ?? [0, 0];
    s.setPosition(src.x + (faceRight ? -dx : dx) + this.shakeX, src.y + dy);
    // flipX refleja la textura dentro del cuadro, no el origen: el origen se refleja a mano.
    const [ox, oy] = this.opts.origin ?? [0.5, 1];
    s.setFlipX(faceRight).setOrigin(faceRight ? 1 - ox : ox, oy);
    s.setScale(src.scaleX / this.detail, (src.scaleY / this.detail) * (this.opts.scaleY?.() ?? 1));
    s.setAngle(src.angle);
    s.setAlpha(src.alpha);
    s.setVisible(src.visible);
    s.setDepth(this.opts.depth ?? src.depth);
    if (src.tintMode !== undefined && src.tintTopLeft !== undefined) {
      s.setTintMode(src.tintMode);
      s.setTint(src.tintTopLeft);
    }
    const moving = Math.abs(src.x - this.lastX) + Math.abs(src.y - this.lastY) > 0.05;
    if (this.opts.idleTimeScale !== undefined) s.anims.timeScale = moving ? 1 : this.opts.idleTimeScale;
    if (this.opts.stillFrame) {
      if (!moving && !s.anims.isPaused) s.anims.pause(s.anims.currentAnim?.frames[0]);
      else if (moving && s.anims.isPaused) s.anims.resume();
    }
    this.lastX = src.x;
    this.lastY = src.y;
    this.applyCrop();
  }

  /** Recorta el frame (en píxeles de textura) según el agua, la rama o el bastón. */
  private applyCrop(): void {
    const { clipBelowY, clipAboveY, hideColumns } = this.opts;
    if (!clipBelowY && !clipAboveY && !hideColumns) return;
    const s = this.sprite;
    const fw = s.frame.width;
    const fh = s.frame.height;
    // Sin giro: el frame va de top a top + fh * escala en el mundo.
    const scaleY = Math.abs(s.scaleY) || 1;
    const top = s.y - s.originY * fh * scaleY;
    let y0 = 0;
    let y1 = fh;
    if (clipAboveY) y0 = Phaser.Math.Clamp((clipAboveY() - top) / scaleY, 0, fh);
    if (clipBelowY) y1 = Phaser.Math.Clamp((clipBelowY() - top) / scaleY, 0, fh);
    let x0 = 0;
    let x1 = fw;
    // La franja va en coordenadas del frame (mirando a la izquierda); setCrop también, y Phaser la refleja con flipX.
    // setCrop deja un solo rectángulo: se conserva el lado más ancho.
    const cols = hideColumns?.();
    if (cols) {
      if (cols[0] <= 1 - cols[1]) x0 = cols[1] * fw;
      else x1 = cols[0] * fw;
    }
    s.setCrop(x0, y0, Math.max(0, x1 - x0), Math.max(0, y1 - y0));
  }

  /** Suelta el sprite (sin tocar el placeholder: puede estar destruyéndose ya). */
  private release(): void {
    if (this.released) return;
    this.released = true;
    this.scene.events.off(Phaser.Scenes.Events.POST_UPDATE, this.sync, this);
    this.scene.events.off(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
    this.sprite.destroy();
  }

  destroy(): void {
    if (this.released) return;
    this.release();
    this.source.off(Phaser.GameObjects.Events.DESTROY, this.release, this);
    this.source.destroy();
  }
}

/** Pone el sprite `key` sobre `source` si existe; si no, el placeholder sigue como está. */
export function skinIfAvailable(scene: Phaser.Scene, source: SkinSource, key: string, opts: SkinOptions = {}): SpriteSkin | undefined {
  const anim = opts.anim ?? `${key}_idle`;
  return hasSprite(scene, key, anim) ? new SpriteSkin(scene, source, key, { ...opts, anim }) : undefined;
}
