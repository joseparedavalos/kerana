import Phaser from 'phaser';
import { GAMEPLAY } from '../config/gameplay';
import { DashTrailClock, dustAngles, ghostAlpha, pickSlot } from './dashTrailLogic';

// Estela del dash (S83): copias del cuadro de Kerana que se apagan detrás de ella, y el polvo de salida.
// Pila fija de sprites (nada se crea ni se destruye por dash) y sin Glow: brilla solo el tajo cargado.

const CFG = GAMEPLAY.dashFx;

/** Lo que la estela necesita de Kerana: el sprite y si está en dash. */
export interface DashTrailTarget {
  sprite: Phaser.GameObjects.Sprite;
  dashing: () => boolean;
  facing: () => number;
  /** Pies (centro de abajo del cuerpo), en unidades del mundo. */
  feet: () => { x: number; y: number };
}

export class DashTrail {
  private readonly ghosts: Phaser.GameObjects.Image[] = [];
  private readonly ages: number[] = [];
  private readonly alive: boolean[] = [];
  private readonly clock = new DashTrailClock(CFG.everyMs);
  private readonly dustAngleLeft = dustAngles(-1, CFG.dust.spreadDeg, CFG.dust.liftDeg);
  private readonly dustAngleRight = dustAngles(1, CFG.dust.spreadDeg, CFG.dust.liftDeg);
  private readonly dust: Phaser.GameObjects.Particles.ParticleEmitter;
  private wasDashing = false;

  constructor(scene: Phaser.Scene, private readonly target: DashTrailTarget, particleKey: string) {
    const kerana = target.sprite;
    for (let i = 0; i < CFG.maxGhosts; i++) {
      const ghost = scene.add.image(kerana.x, kerana.y, kerana.texture.key).setVisible(false).setActive(false);
      ghost.setTint(CFG.tint);
      if (CFG.tintFill) ghost.setTintMode(Phaser.TintModes.FILL);
      // Justo debajo de Kerana: su misma profundidad y antes que ella en la lista, así nunca la tapa.
      ghost.setDepth(kerana.depth);
      scene.children.moveBelow(ghost, kerana);
      this.ghosts.push(ghost);
      this.ages.push(0);
      this.alive.push(false);
    }
    const d = CFG.dust;
    this.dust = scene.add
      .particles(0, 0, particleKey, {
        speed: { min: d.speedMin, max: d.speedMax },
        lifespan: d.lifespanMs,
        scale: { start: d.scale, end: 0 },
        alpha: { start: d.alpha, end: 0 },
        tint: CFG.tint,
        emitting: false,
      })
      .setDepth(kerana.depth);
    scene.children.moveBelow(this.dust, kerana);
  }

  update(deltaMs: number): void {
    for (let i = 0; i < this.ghosts.length; i++) {
      if (!this.alive[i]) continue;
      this.ages[i] += deltaMs;
      const alpha = ghostAlpha(this.ages[i], CFG);
      if (alpha <= 0) this.hide(i);
      else this.ghosts[i].setAlpha(alpha);
    }
    const dashing = this.target.dashing();
    const starting = dashing && !this.wasDashing;
    this.wasDashing = dashing;
    if (starting) this.burst();
    if (this.clock.step(dashing, deltaMs)) this.spawn();
  }

  /** Apaga todas las copias (al reaparecer o al cortar el nivel). */
  clear(): void {
    for (let i = 0; i < this.ghosts.length; i++) this.hide(i);
  }

  private spawn(): void {
    const i = pickSlot(this.ages, this.alive);
    const kerana = this.target.sprite;
    const ghost = this.ghosts[i];
    ghost
      .setTexture(kerana.texture.key, kerana.frame.name)
      .setOrigin(kerana.originX, kerana.originY)
      .setPosition(kerana.x, kerana.y)
      .setScale(kerana.scaleX, kerana.scaleY)
      .setFlipX(kerana.flipX)
      .setAlpha(CFG.alpha)
      .setVisible(true)
      .setActive(true);
    this.ages[i] = 0;
    this.alive[i] = true;
  }

  private burst(): void {
    const feet = this.target.feet();
    this.dust.setEmitterAngle(this.target.facing() >= 0 ? this.dustAngleRight : this.dustAngleLeft);
    this.dust.emitParticleAt(feet.x, feet.y, CFG.dust.count);
  }

  private hide(i: number): void {
    this.alive[i] = false;
    this.ghosts[i].setVisible(false).setActive(false);
  }
}
