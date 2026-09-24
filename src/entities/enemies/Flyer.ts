import Phaser from 'phaser';
import type { EnemyDef } from '../../data/enemies';
import { EnemyBase } from './EnemyBase';

// Flyer (GDD §5.2): vuela en onda, ignora la gravedad.
export class Flyer extends EnemyBase {
  private waveMs = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, def: EnemyDef, facing: 1 | -1 = -1) {
    super(scene, x, y, def, facing);
    this.body.setAllowGravity(false);
  }

  updateBehavior(deltaMs: number): void {
    const def = this.def;
    const speed = def.speed ?? 30;
    const range = def.patrolDistance ?? 56;
    const amplitude = def.amplitude ?? 14;
    const frequencyHz = def.frequencyHz ?? 1.2;

    if (this.x <= this.spawnX - range) this.facing = 1;
    else if (this.x >= this.spawnX + range) this.facing = -1;
    this.body.setVelocityX(this.facing * speed);

    this.waveMs += deltaMs;
    const y = this.spawnY + Math.sin((this.waveMs / 1000) * frequencyHz * Math.PI * 2) * amplitude;
    this.setY(y);
  }
}
