import Phaser from 'phaser';
import type { EnemyDef } from '../../data/enemies';
import { AudioManager } from '../../systems/AudioManager';
import { EnemyBase } from './EnemyBase';
import { arcVelocity, flightTimeFor, ThrowerMotor } from './ThrowerMotor';

const FRUIT_COLOR = 0xe0a030;
/** Altura de la mano desde los pies (fracción del alto). */
const HAND = 0.8;
/** Mitad del cuerpo de Kerana: apunta al pecho, no a los pies. */
const TARGET_LIFT = 20;

interface Fruit {
  arc: Phaser.GameObjects.Arc;
  vx: number;
  vy: number;
  lifeMs: number;
}

// Thrower (GDD §5.2): lanza frutas en arco desde un punto fijo (ka'i en las copas).
export class Thrower extends EnemyBase {
  private readonly motor: ThrowerMotor;
  private readonly fruits: Fruit[] = [];
  private readonly vel = { vx: 0, vy: 0 };
  private lastDx = 0;
  private lastDy = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, def: EnemyDef, facing: 1 | -1 = -1) {
    super(scene, x, y, def, facing);
    this.motor = new ThrowerMotor({
      detectRadius: def.detectRadius ?? 160,
      windupMs: def.telegraphMs ?? 500,
      cooldownMs: def.cooldownMs ?? 1800,
    });
    const radius = def.projectileRadius ?? 4;
    for (let i = 0; i < (def.projectilePool ?? 3); i++) {
      const arc = scene.add.circle(0, 0, radius, FRUIT_COLOR).setDepth(7).setVisible(false);
      this.fruits.push({ arc, vx: 0, vy: 0, lifeMs: 0 });
    }
  }

  updateBehavior(deltaMs: number, dx: number, dy: number): void {
    this.body.setVelocityX(0);
    this.lastDx = dx;
    this.lastDy = dy;
    this.facing = dx >= 0 ? 1 : -1;
    if (this.motor.step(deltaMs, Math.hypot(dx, dy))) this.throwFruit();
    // Aviso: levanta la fruta (se estira y se aclara).
    const windup = this.motor.state === 'windup';
    this.setScale(1, windup ? 1.15 : 1);
    if (!this.flashing) {
      if (windup) this.setTint(0xf2eee3);
      else this.clearTint();
    }
  }

  override preUpdate(time: number, delta: number): void {
    super.preUpdate(time, delta);
    // Las frutas siguen volando aunque el ka'i ya no actualice su comportamiento.
    const g = this.def.projectileGravity ?? 600;
    const dt = delta / 1000;
    for (const f of this.fruits) {
      if (f.lifeMs <= 0) continue;
      f.lifeMs -= delta;
      f.vy += g * dt;
      f.arc.x += f.vx * dt;
      f.arc.y += f.vy * dt;
      if (f.lifeMs <= 0) f.arc.setVisible(false);
    }
  }

  private throwFruit(): void {
    const fruit = this.fruits.find((f) => f.lifeMs <= 0);
    if (!fruit) return;
    const sx = this.x + this.facing * (this.def.width / 2);
    const sy = this.y - this.def.height * HAND;
    const tx = this.x + this.lastDx - sx;
    const ty = this.y + this.lastDy - TARGET_LIFT - sy;
    const flight = flightTimeFor(Math.hypot(tx, ty), this.def.flightMsPerPx ?? 5, 450, 1100);
    arcVelocity(tx, ty, flight, this.def.projectileGravity ?? 600, this.vel);
    fruit.vx = this.vel.vx;
    fruit.vy = this.vel.vy;
    // Sigue de largo después del blanco: si Kerana se movió, la fruta pasa y cae.
    fruit.lifeMs = flight * 2;
    fruit.arc.setPosition(sx, sy).setVisible(true);
    AudioManager.play('throw');
  }

  override projectileHits(rect: Phaser.Geom.Rectangle): boolean {
    for (const f of this.fruits) {
      if (f.lifeMs <= 0 || !rect.contains(f.arc.x, f.arc.y)) continue;
      f.lifeMs = 0;
      f.arc.setVisible(false);
      return true;
    }
    return false;
  }

  override purify(): void {
    for (const f of this.fruits) {
      f.lifeMs = 0;
      f.arc.setVisible(false);
    }
    super.purify();
  }

  override destroy(fromScene?: boolean): void {
    for (const f of this.fruits) f.arc.destroy();
    this.fruits.length = 0;
    super.destroy(fromScene);
  }
}
