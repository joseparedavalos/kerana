import Phaser from 'phaser';
import { DashTrailClock, ghostAlpha, pickSlot, type DashTrailConfig } from './dashTrailLogic';

// Estela de siluetas (S83, generalizada en S104): copias del cuadro del dueño que se apagan detrás de él.
// Pila fija de imágenes (nada se crea ni se destruye por cuadro) y sin Glow. La usan el dash de Kerana y Kurupi.

/** Lo que se copia del dueño de la estela: su textura, cuadro, origen, posición, escala y volteo. */
export type GhostSource = Phaser.GameObjects.Sprite | Phaser.GameObjects.Image;

export interface GhostTrailConfig extends DashTrailConfig {
  /** Tinte de las copias: un color, o [arriba, abajo] para un degradé vertical. */
  tint: number | readonly [number, number];
  /** La copia es una silueta plana del tinte (si no, el tinte multiplica el dibujo). */
  tintFill: boolean;
  /**
   * Distancia mínima (px) a la copia anterior: si el dueño todavía no se movió tanto, esa copia no sale (Kurupi
   * arranca despacio y las primeras se amontonaban). Sin este valor, una copia cada `everyMs` siempre (el dash).
   */
  minGapPx?: number;
}

export class GhostTrail {
  private readonly ghosts: Phaser.GameObjects.Image[] = [];
  private readonly ages: number[] = [];
  private readonly alive: boolean[] = [];
  private readonly clock: DashTrailClock;
  private lastX = 0;
  private lastY = 0;
  private wasOn = false;

  constructor(
    scene: Phaser.Scene,
    private readonly source: GhostSource,
    private readonly cfg: GhostTrailConfig,
  ) {
    this.clock = new DashTrailClock(cfg.everyMs);
    const tint = cfg.tint;
    for (let i = 0; i < cfg.maxGhosts; i++) {
      const ghost = scene.add.image(source.x, source.y, source.texture.key).setVisible(false).setActive(false);
      if (typeof tint === 'number') ghost.setTint(tint);
      else ghost.setTint(tint[0], tint[0], tint[1], tint[1]);
      if (cfg.tintFill) ghost.setTintMode(Phaser.TintModes.FILL);
      // Justo debajo del dueño: su misma profundidad y antes que él en la lista, así nunca lo tapa.
      ghost.setDepth(source.depth);
      scene.children.moveBelow(ghost, source);
      this.ghosts.push(ghost);
      this.ages.push(0);
      this.alive.push(false);
    }
  }

  /** Apaga las copias viejas y, si `on`, deja una nueva al ritmo de `everyMs` (la primera, al encenderse). */
  update(deltaMs: number, on: boolean): void {
    for (let i = 0; i < this.ghosts.length; i++) {
      if (!this.alive[i]) continue;
      this.ages[i] += deltaMs;
      const alpha = ghostAlpha(this.ages[i], this.cfg);
      if (alpha <= 0) this.hide(i);
      else this.ghosts[i].setAlpha(alpha);
    }
    const starting = on && !this.wasOn;
    this.wasOn = on;
    if (this.clock.step(on, deltaMs) && (starting || this.farEnough())) this.spawn();
  }

  private farEnough(): boolean {
    const gap = this.cfg.minGapPx;
    if (gap === undefined) return true;
    return Math.abs(this.source.x - this.lastX) + Math.abs(this.source.y - this.lastY) >= gap;
  }

  /** Apaga todas las copias (al reaparecer, al reiniciar la pelea o al cortar el nivel). */
  clear(): void {
    for (let i = 0; i < this.ghosts.length; i++) this.hide(i);
  }

  private spawn(): void {
    const i = pickSlot(this.ages, this.alive);
    const src = this.source;
    this.ghosts[i]
      .setTexture(src.texture.key, src.frame.name)
      .setOrigin(src.originX, src.originY)
      .setPosition(src.x, src.y)
      .setScale(src.scaleX, src.scaleY)
      .setFlipX(src.flipX)
      .setAlpha(this.cfg.alpha)
      .setVisible(true)
      .setActive(true);
    this.ages[i] = 0;
    this.alive[i] = true;
    this.lastX = src.x;
    this.lastY = src.y;
  }

  private hide(i: number): void {
    this.alive[i] = false;
    this.ghosts[i].setVisible(false).setActive(false);
  }
}
