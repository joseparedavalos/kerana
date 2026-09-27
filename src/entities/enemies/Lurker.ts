import Phaser from 'phaser';
import type { EnemyDef } from '../../data/enemies';
import { EnemyBase } from './EnemyBase';
import { LurkerMotor } from './LurkerMotor';

const BUBBLE_EVERY_MS = 140;

// Lurker (GDD §5.2): oculto bajo el agua; burbujas como aviso, emerge cuando Kerana se acerca
// y solo es vulnerable afuera. El punto del mapa es la superficie del agua.
export class Lurker extends EnemyBase {
  private readonly motor: LurkerMotor;
  private readonly bubbles: Phaser.GameObjects.Particles.ParticleEmitter;
  private bubbleMs = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, def: EnemyDef, facing: 1 | -1 = -1) {
    super(scene, x, y, def, facing);
    this.motor = new LurkerMotor({
      detectRadius: def.detectRadius ?? 64,
      warnMs: def.warnMs ?? 900,
      exposedMs: def.exposedMs ?? 1800,
      cooldownMs: def.cooldownMs ?? 1400,
    });
    this.body.setAllowGravity(false);
    this.collidesWithGround = false;
    this.bubbles = scene.add
      .particles(0, 0, 'fx_particle', {
        speedY: { min: -30, max: -12 },
        speedX: { min: -6, max: 6 },
        lifespan: 450,
        alpha: { start: 0.9, end: 0 },
        tint: 0xd8f0f0,
        emitting: false,
      })
      .setDepth(6);
    this.submerge(true);
  }

  updateBehavior(deltaMs: number, dx: number, dy: number): void {
    const before = this.motor.state;
    // No se desliza con el retroceso del golpe: está anclado en el agua.
    this.body.setVelocity(0, 0);
    const near = Math.abs(dy) < 64 ? Math.abs(dx) : Infinity;
    const state = this.motor.step(deltaMs, near);
    if (state === 'warn') {
      this.bubbleMs -= deltaMs;
      if (this.bubbleMs <= 0) {
        this.bubbleMs = BUBBLE_EVERY_MS;
        this.bubbles.emitParticleAt(this.x + Phaser.Math.Between(-8, 8), this.spawnY, 1);
      }
    }
    if (state === before) return;
    if (state === 'exposed') {
      // Mira hacia Kerana al salir.
      this.facing = dx >= 0 ? 1 : -1;
      this.emerge();
    } else if (state === 'cooldown') {
      this.submerge(false);
    }
  }

  private emerge(): void {
    this.body.enable = true;
    this.setVisible(true);
    this.scene.tweens.killTweensOf(this);
    this.scene.tweens.add({ targets: this, y: this.spawnY + this.def.height - (this.def.emergeHeight ?? 8), duration: 160, ease: 'Back.easeOut' });
  }

  /** Bajo el agua no toca ni se puede golpear. */
  private submerge(instant: boolean): void {
    this.body.enable = false;
    const hiddenY = this.spawnY + this.def.height + 2;
    this.scene.tweens.killTweensOf(this);
    if (instant) {
      this.setY(hiddenY).setVisible(false);
      return;
    }
    this.scene.tweens.add({ targets: this, y: hiddenY, duration: 220, onComplete: () => this.setVisible(false) });
  }

  override purify(): void {
    this.scene.tweens.killTweensOf(this);
    super.purify();
  }

  override destroy(fromScene?: boolean): void {
    this.bubbles.destroy();
    super.destroy(fromScene);
  }
}
