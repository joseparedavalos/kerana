import Phaser from 'phaser';
import type { EnemyDef } from '../../data/enemies';
import { AudioManager } from '../../systems/AudioManager';
import { ChargerMotor } from './ChargerMotor';
import { EnemyBase } from './EnemyBase';

const EYE_COLOR = 0xf2e24e;
const EYE_DIM = 0.45;

// Charger (GDD §5.2): detecta a Kerana, avisa y embiste en línea recta.
export class Charger extends EnemyBase {
  private readonly motor: ChargerMotor;
  /** Ojos brillantes (jagua hũ): tenues al acecho, encendidos en el aviso. */
  private readonly eyes?: Phaser.GameObjects.Rectangle;

  constructor(scene: Phaser.Scene, x: number, y: number, def: EnemyDef, facing: 1 | -1 = -1) {
    super(scene, x, y, def, facing);
    if (def.glowEyes) {
      this.eyes = scene.add.rectangle(x, y, 6, 2, EYE_COLOR, EYE_DIM).setDepth(6);
      this.glowParts.push(this.eyes);
      this.once(Phaser.GameObjects.Events.DESTROY, () => this.eyes?.destroy());
    }
    this.motor = new ChargerMotor({
      detectRadius: def.detectRadius ?? 90,
      telegraphMs: def.telegraphMs ?? 400,
      chargeSpeed: def.chargeSpeed ?? 180,
      chargeMaxMs: def.chargeMaxMs ?? 2000,
      cooldownMs: def.cooldownMs ?? 600,
    });
  }

  updateBehavior(deltaMs: number, dx: number, dy: number): void {
    if (this.motor.state === 'charge' && (this.body.blocked.left || this.body.blocked.right)) {
      this.motor.stopCharge();
    }
    const sameFloor = Math.abs(dy) < this.def.height * 1.5;
    const distance = sameFloor ? Math.abs(dx) : Infinity;
    const dir: 1 | -1 = dx >= 0 ? 1 : -1;
    const before = this.motor.state;
    const out = this.motor.step(deltaMs, distance, dir);
    if (out.state === 'telegraph' && before !== 'telegraph' && this.def.warnSfx) AudioManager.play(this.def.warnSfx);
    if (out.vx !== 0) this.facing = out.vx > 0 ? 1 : -1;
    this.body.setVelocityX(out.vx);
    if (!this.flashing) {
      if (out.state === 'telegraph') this.setTint(0xf2eee3);
      else this.clearTint();
    }
    if (this.eyes) {
      const h = this.def.height;
      this.eyes.setPosition(this.x + this.facing * (this.def.width / 2 - 4), this.y - h + 4);
      this.eyes.setAlpha(out.state === 'telegraph' || out.state === 'charge' ? 1 : EYE_DIM);
    }
  }

  override purify(): void {
    this.eyes?.setVisible(false);
    super.purify();
  }
}
