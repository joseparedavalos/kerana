import Phaser from 'phaser';
import type { EnemyDef } from '../../data/enemies';
import { EnemyBase } from './EnemyBase';
import { JumperMotor } from './JumperMotor';

// Jumper (GDD §5.2): espera, se agacha y salta hacia Kerana (kuati).
export class Jumper extends EnemyBase {
  private readonly motor: JumperMotor;

  constructor(scene: Phaser.Scene, x: number, y: number, def: EnemyDef, facing: 1 | -1 = -1) {
    super(scene, x, y, def, facing);
    this.motor = new JumperMotor({
      detectRadius: def.detectRadius ?? 110,
      waitMs: def.waitMs ?? 1200,
      crouchMs: def.telegraphMs ?? 350,
      jumpVelocity: def.jumpVelocity ?? -300,
      jumpSpeedX: def.speed ?? 90,
    });
  }

  updateBehavior(deltaMs: number, dx: number, dy: number): void {
    const grounded = this.body.blocked.down || this.body.touching.down;
    const dir: 1 | -1 = dx >= 0 ? 1 : -1;
    // Salta hacia Kerana si está cerca y no muy arriba ni muy abajo.
    const distance = Math.abs(dy) < 96 ? Math.abs(dx) : Infinity;
    const out = this.motor.step(deltaMs, distance, dir, grounded);
    if (out.jump) {
      this.facing = out.jump.vx >= 0 ? 1 : -1;
      this.body.setVelocity(out.jump.vx, out.jump.vy);
    } else if (grounded && out.state !== 'air') {
      this.body.setVelocityX(0);
      if (out.state === 'wait') this.facing = dir;
    }
    this.setScale(1, out.state === 'crouch' ? 0.75 : 1);
  }
}
