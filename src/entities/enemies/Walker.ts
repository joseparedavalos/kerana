import Phaser from 'phaser';
import type { EnemyDef } from '../../data/enemies';
import { EnemyBase } from './EnemyBase';

// Walker (GDD §5.2): patrulla entre dos puntos y gira en bordes y paredes.
export class Walker extends EnemyBase {
  constructor(scene: Phaser.Scene, x: number, y: number, def: EnemyDef, facing: 1 | -1 = -1) {
    super(scene, x, y, def, facing);
  }

  updateBehavior(): void {
    const def = this.def;
    const speed = def.speed ?? 40;
    const range = def.patrolDistance ?? 48;
    if (this.body.blocked.left || this.x <= this.spawnX - range) this.facing = 1;
    else if (this.body.blocked.right || this.x >= this.spawnX + range) this.facing = -1;
    this.body.setVelocityX(this.facing * speed);
  }
}
