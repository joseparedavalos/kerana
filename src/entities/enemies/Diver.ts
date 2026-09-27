import Phaser from 'phaser';
import type { EnemyDef } from '../../data/enemies';
import { EnemyBase } from './EnemyBase';

const DIVE_OVERSHOOT_MS = 150;

type DiverState = 'perch' | 'telegraph' | 'dive' | 'return';

// Diver (GDD §5.2): espera en lo alto (un poste) y se lanza en picada hacia donde estaba
// Kerana al terminar el aviso; después vuelve despacio a su lugar.
export class Diver extends EnemyBase {
  private diveState: DiverState = 'perch';
  private msLeft = 0;
  private readonly dir = new Phaser.Math.Vector2();

  constructor(scene: Phaser.Scene, x: number, y: number, def: EnemyDef, facing: 1 | -1 = -1) {
    super(scene, x, y, def, facing);
    this.body.setAllowGravity(false);
    this.collidesWithGround = false;
  }

  updateBehavior(deltaMs: number, dx: number, dy: number): void {
    const def = this.def;
    this.msLeft -= deltaMs;
    switch (this.diveState) {
      case 'perch':
        this.body.setVelocity(0, 0);
        // Solo se lanza si Kerana está abajo y a su alcance.
        if (this.msLeft <= 0 && dy > 0 && Math.hypot(dx, dy) <= (def.detectRadius ?? 96)) {
          this.facing = dx >= 0 ? 1 : -1;
          this.enter('telegraph', def.telegraphMs ?? 500);
          if (!this.flashing) this.setTint(0xf2eee3);
        }
        break;
      case 'telegraph':
        if (this.msLeft <= 0) {
          // Apunta a los pies de Kerana en este momento.
          const speed = def.diveSpeed ?? 230;
          const dist = Math.hypot(dx, dy);
          this.dir.set(dx, dy).normalize();
          this.facing = dx >= 0 ? 1 : -1;
          this.body.setVelocity(this.dir.x * speed, this.dir.y * speed);
          // Llega un poco más allá de donde estaba Kerana; solo choca con el suelo en la picada.
          this.enter('dive', Math.min(def.chargeMaxMs ?? 1200, (dist / speed) * 1000 + DIVE_OVERSHOOT_MS));
          this.collidesWithGround = true;
          if (!this.flashing) this.clearTint();
        }
        break;
      case 'dive':
        if (this.msLeft <= 0 || this.body.blocked.down || this.body.blocked.left || this.body.blocked.right) {
          this.collidesWithGround = false;
          this.enter('return', 0);
        }
        break;
      case 'return': {
        const tx = this.spawnX - this.x;
        const ty = this.spawnY - this.y;
        const dist = Math.hypot(tx, ty);
        if (dist < 3) {
          this.body.reset(this.spawnX, this.spawnY);
          this.enter('perch', def.cooldownMs ?? 900);
          break;
        }
        const speed = def.returnSpeed ?? 70;
        this.facing = tx >= 0 ? 1 : -1;
        this.body.setVelocity((tx / dist) * speed, (ty / dist) * speed);
        break;
      }
    }
  }

  private enter(state: DiverState, ms: number): void {
    this.diveState = state;
    this.msLeft = ms;
  }
}
