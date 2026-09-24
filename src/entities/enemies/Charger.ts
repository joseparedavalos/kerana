import Phaser from 'phaser';
import type { EnemyDef } from '../../data/enemies';
import { ChargerMotor } from './ChargerMotor';
import { EnemyBase } from './EnemyBase';

// Charger (GDD §5.2): detecta a Kerana, avisa y embiste en línea recta.
export class Charger extends EnemyBase {
  private readonly motor: ChargerMotor;

  constructor(scene: Phaser.Scene, x: number, y: number, def: EnemyDef, facing: 1 | -1 = -1) {
    super(scene, x, y, def, facing);
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
    const out = this.motor.step(deltaMs, distance, dir);
    if (out.vx !== 0) this.facing = out.vx > 0 ? 1 : -1;
    this.body.setVelocityX(out.vx);
    if (!this.flashing) {
      if (out.state === 'telegraph') this.setTint(0xf2eee3);
      else this.clearTint();
    }
  }
}
