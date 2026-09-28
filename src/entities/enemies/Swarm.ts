import Phaser from 'phaser';
import { GAMEPLAY } from '../../config/gameplay';
import type { EnemyDef } from '../../data/enemies';
import { EnemyBase } from './EnemyBase';
import { SwarmMotor } from './SwarmMotor';

const CFG = GAMEPLAY.swarm;
const BEE_TEXTURE = 'fx_bee';
const HIVE_COLOR = 0xb07a2a;
/** Altura del pecho de Kerana sobre sus pies (px): ahí apunta el enjambre. */
const TARGET_RISE = 20;

function ensureBeeTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists(BEE_TEXTURE)) return;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  g.fillStyle(0xf2c14e).fillRect(0, 0, 3, 2);
  g.fillStyle(0x1b1a2e).fillRect(1, 0, 1, 2);
  g.generateTexture(BEE_TEXTURE, 3, 2);
  g.destroy();
}

// Swarm (GDD §5.2): enjambre de abejas hecho con partículas, sin sprite propio (§5.3).
// El cuerpo es invisible; las partículas lo siguen.
export class Swarm extends EnemyBase {
  private readonly motor: SwarmMotor;
  private readonly bees: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly hive?: Phaser.GameObjects.Ellipse;
  private wobbleMs = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, def: EnemyDef, facing: 1 | -1 = -1, oneShot = false) {
    super(scene, x, y, def, facing);
    ensureBeeTexture(scene);
    this.setAlpha(0);
    this.body.setAllowGravity(false);
    this.collidesWithGround = false;
    this.motor = new SwarmMotor(
      {
        detectRadius: def.detectRadius ?? 80,
        chaseMs: def.chaseMs ?? 3000,
        disperseMs: def.disperseMs ?? 900,
        cooldownMs: def.cooldownMs ?? 2500,
      },
      oneShot,
    );
    // Panal (solo los enjambres del nivel; los del jefe salen de la nada).
    if (!oneShot) this.hive = scene.add.ellipse(x, y - def.height - 4, 10, 14, HIVE_COLOR).setDepth(2);
    this.bees = scene.add.particles(0, 0, BEE_TEXTURE, {
      x: { min: -CFG.spreadPx, max: CFG.spreadPx },
      y: { min: -CFG.spreadPx, max: CFG.spreadPx },
      speed: { min: 6, max: 24 },
      lifespan: CFG.particleLifeMs,
      frequency: CFG.particleEveryMs,
      alpha: { start: 1, end: 0.2 },
    });
    this.bees.setDepth(8).startFollow(this, 0, -def.height / 2);
  }

  /** Solo pica mientras persigue. */
  override get touchHurts(): boolean {
    return this.motor.harmful;
  }

  /** Terminó (enjambre del jefe que ya se dispersó). */
  get gone(): boolean {
    return this.motor.state === 'gone';
  }

  updateBehavior(deltaMs: number, dx: number, dy: number): void {
    const ty = dy - TARGET_RISE + this.def.height / 2;
    const state = this.motor.step(deltaMs, Math.sqrt(dx * dx + ty * ty));
    const speed = this.def.speed ?? 60;
    this.wobbleMs += deltaMs;
    const wobble = Math.sin((this.wobbleMs / 1000) * CFG.wobbleHz * Math.PI * 2) * CFG.wobblePx;
    switch (state) {
      case 'chase': {
        const d = Math.max(1, Math.sqrt(dx * dx + ty * ty));
        this.body.setVelocity((dx / d) * speed, (ty / d) * speed + wobble);
        this.bees.setAlpha(1);
        break;
      }
      case 'disperse':
        this.body.setVelocity(this.body.velocity.x * 0.95, this.body.velocity.y * 0.95);
        this.bees.setAlpha(0.4);
        break;
      case 'gone':
        this.vanish();
        return;
      default: {
        // Vuelve al panal y zumba alrededor.
        const hx = this.spawnX - this.x;
        const hy = this.spawnY - this.y;
        this.body.setVelocity(Phaser.Math.Clamp(hx * 2, -speed, speed), Phaser.Math.Clamp(hy * 2, -speed, speed) + wobble);
        this.bees.setAlpha(state === 'cooldown' ? 0.5 : 0.8);
        break;
      }
    }
    if (this.body.velocity.x !== 0) this.facing = this.body.velocity.x > 0 ? 1 : -1;
  }

  override purify(): void {
    if (this.purified) return;
    this.bees.stop();
    this.scene.time.delayedCall(CFG.particleLifeMs, () => this.bees.destroy());
    super.purify();
  }

  /** Se va sin purificarse (el enjambre del jefe se dispersó). */
  vanish(): void {
    if (this.purified) return;
    this.purified = true;
    this.body.enable = false;
    this.bees.stop();
    this.scene.time.delayedCall(CFG.particleLifeMs, () => this.bees.destroy());
    this.destroy();
  }

  override destroy(fromScene?: boolean): void {
    this.hive?.destroy();
    super.destroy(fromScene);
  }
}
