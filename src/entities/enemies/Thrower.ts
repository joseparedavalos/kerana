import Phaser from 'phaser';
import { GAMEPLAY } from '../../config/gameplay';
import type { EnemyDef } from '../../data/enemies';
import { AudioManager } from '../../systems/AudioManager';
import { hash, uploadAtlas } from '../../systems/pixelArt';
import { EnemyBase } from './EnemyBase';
import { fruitFrames, POP_FRAMES, popFrameName, PULP_FRAMES, pulpFrameName, SEED_FRAME, SPIN_FRAMES, spinFrameName } from './kaiFruitArt';
import { floorBelow, landed, seedAlpha, spinFrame, stepSeed, type Seed } from './kaiFruitLogic';
import { arcVelocity, flightTimeFor, ThrowerMotor } from './ThrowerMotor';

/** Altura de la mano desde los pies (fracción del alto). */
const HAND = 0.8;
/** Mitad del cuerpo de Kerana: apunta al pecho, no a los pies. */
const TARGET_LIFT = 20;
const TILE = 16;
const ART = GAMEPLAY.kaiFruit;
const ATLAS = 'kai_fruit_fx';
const PULP_NAMES = Array.from({ length: PULP_FRAMES }, (_, i) => pulpFrameName(i));

interface Fruit {
  img: Phaser.GameObjects.Image;
  vx: number;
  vy: number;
  lifeMs: number;
  /** Desde que salió de la mano (el giro, y si ya pasó el blanco). */
  ageMs: number;
  /** Cuadro con que salió de la mano: el giro sigue desde ahí. */
  spin0: number;
  flightMs: number;
  /** Lo que reventó al pegar o al caer: el reventón y la semilla (uno por fruta, del mismo pool). */
  pop: Phaser.GameObjects.Image;
  popMs: number;
  seed: Seed;
  seedImg: Phaser.GameObjects.Image;
}

// Thrower (GDD §5.2): lanza frutas en arco desde un punto fijo (ka'i en las copas).
export class Thrower extends EnemyBase {
  private readonly motor: ThrowerMotor;
  private readonly fruits: Fruit[] = [];
  private readonly vel = { vx: 0, vy: 0 };
  private lastDx = 0;
  private lastDy = 0;
  /** El piso, para que la fruta reviente al caer y la semilla rebote (lo pone el nivel; sin él, no hay piso). */
  groundAt?: (x: number, y: number) => boolean;
  platformAt?: (x: number, y: number) => boolean;
  tileSize = TILE;
  /** En el aviso, la fruta en la mano (S115). */
  private readonly held: Phaser.GameObjects.Image;
  private windupMs = 0;
  private readonly pulp: Phaser.GameObjects.Particles.ParticleEmitter;
  private bursts = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, def: EnemyDef, facing: 1 | -1 = -1) {
    super(scene, x, y, def, facing);
    this.motor = new ThrowerMotor({
      detectRadius: def.detectRadius ?? 160,
      windupMs: def.telegraphMs ?? 500,
      cooldownMs: def.cooldownMs ?? 1800,
    });
    uploadAtlas(scene, ATLAS, fruitFrames());
    const scale = 1 / ART.detail;
    const image = (frame: string, depth: number) =>
      scene.add.image(0, 0, ATLAS, frame).setScale(scale).setDepth(depth).setVisible(false);
    for (let i = 0; i < (def.projectilePool ?? 3); i++) {
      this.fruits.push({
        img: image(spinFrameName(0), ART.depth),
        vx: 0,
        vy: 0,
        lifeMs: 0,
        ageMs: 0,
        spin0: 0,
        flightMs: 0,
        pop: image(popFrameName(0), ART.depth + 0.2),
        popMs: -1,
        seed: { x: 0, y: 0, vx: 0, vy: 0, ageMs: 0, lifeMs: 0, floorY: Infinity, bounces: 0 },
        seedImg: image(SEED_FRAME, ART.depth + 0.1),
      });
    }
    this.held = image(spinFrameName(0), ART.depth);
    const p = ART.pulp;
    this.pulp = scene.add
      .particles(0, 0, ATLAS, {
        frame: PULP_NAMES,
        emitting: false,
        speed: { min: p.speedMin, max: p.speedMax },
        angle: { min: 195, max: 345 },
        gravityY: p.gravity,
        lifespan: { min: p.lifeMin, max: p.lifeMax },
        scale,
        maxParticles: p.max,
      })
      .setDepth(ART.depth + 0.1);
  }

  updateBehavior(deltaMs: number, dx: number, dy: number): void {
    this.body.setVelocityX(0);
    this.lastDx = dx;
    this.lastDy = dy;
    this.facing = dx >= 0 ? 1 : -1;
    if (this.motor.step(deltaMs, Math.hypot(dx, dy))) this.throwFruit();
    // Aviso: levanta la fruta (se estira y se aclara).
    const windup = this.motor.state === 'windup';
    this.windupMs = windup ? this.windupMs + deltaMs : 0;
    this.setScale(1, windup ? 1.15 : 1);
    this.warning = windup;
    if (!this.flashing) {
      if (windup) this.setTint(0xf2eee3);
      else this.clearTint();
    }
  }

  override preUpdate(time: number, delta: number): void {
    super.preUpdate(time, delta);
    this.updateHeld();
    // Las frutas siguen volando aunque el ka'i ya no actualice su comportamiento.
    const g = this.def.projectileGravity ?? 600;
    const dt = delta / 1000;
    for (const f of this.fruits) {
      this.updateBurst(f, delta);
      if (f.lifeMs <= 0) continue;
      f.lifeMs -= delta;
      f.ageMs += delta;
      f.vy += g * dt;
      const prevY = f.img.y;
      f.img.x += f.vx * dt;
      f.img.y += f.vy * dt;
      f.img.setFrame(spinFrameName((f.spin0 + spinFrame(f.ageMs, ART.spinFps, SPIN_FRAMES, f.vx >= 0 ? 1 : -1)) % SPIN_FRAMES));
      const ground = this.groundAt?.(f.img.x, f.img.y) ?? false;
      const platform = !ground && (this.platformAt?.(f.img.x, f.img.y) ?? false);
      if (landed(f.ageMs, f.flightMs, f.vy, prevY, f.img.y, this.tileSize, ground, platform)) {
        // Cayó: revienta sobre el borde del tile.
        f.img.y = Math.floor(f.img.y / this.tileSize) * this.tileSize;
        this.burst(f);
      } else if (f.lifeMs <= 0) this.burst(f);
    }
  }

  /** En el aviso, la fruta en la mano del ka'i: sube un poco y tiembla con él; al tirar, sale de ahí la que vuela. */
  private updateHeld(): void {
    const show = this.motor.state === 'windup' && !this.purified;
    this.held.setVisible(show);
    if (!show) return;
    const telegraph = this.def.telegraphMs ?? 500;
    const lift = ART.windupLift * Math.min(1, this.windupMs / telegraph);
    const shake = this.skin?.shakeX ?? 0;
    this.held
      .setFrame(spinFrameName(this.heldFrame()))
      .setPosition(this.x + this.facing * ART.hand.forward + shake, this.y - ART.hand.rise * this.scaleY - lift)
      .setDepth(this.depth + 0.5);
  }

  /** El cuadro de la fruta en la mano: el cabito hacia donde mira el ka'i. */
  private heldFrame(): number {
    return this.facing > 0 ? ART.heldFrame : (SPIN_FRAMES - ART.heldFrame) % SPIN_FRAMES;
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
    fruit.ageMs = 0;
    fruit.flightMs = flight;
    fruit.spin0 = this.heldFrame();
    fruit.img.setPosition(sx, sy).setFrame(spinFrameName(fruit.spin0)).setVisible(true);
    AudioManager.play('throw');
  }

  /** Revienta: pulpa que salpica, el reventón y la semilla que cae, rebota y se apaga. */
  private burst(f: Fruit): void {
    const x = f.img.x;
    const y = f.img.y;
    f.lifeMs = 0;
    f.img.setVisible(false);
    this.bursts++;
    this.pulp.explode(ART.pulp.count, x, y);
    f.pop.setPosition(x, y).setFrame(popFrameName(0)).setVisible(true);
    f.popMs = 0;
    const s = f.seed;
    const cfg = ART.seed;
    const dir = f.vx >= 0 ? 1 : -1;
    s.x = x;
    s.y = y;
    s.vx = dir * cfg.launchVx * (0.6 + 0.8 * hash(this.bursts, this.spawnX));
    s.vy = cfg.launchVy;
    s.ageMs = 0;
    s.lifeMs = cfg.lifeMs;
    s.bounces = 0;
    s.floorY = floorBelow(x, y, cfg.maxDropPx, this.tileSize, this.solidAt) ?? Infinity;
    f.seedImg.setPosition(x, y).setAlpha(1).setFlipX(false).setVisible(true);
  }

  private readonly solidAt = (x: number, y: number): boolean =>
    (this.groundAt?.(x, y) ?? false) || (this.platformAt?.(x, y) ?? false);

  private updateBurst(f: Fruit, delta: number): void {
    if (f.popMs >= 0) {
      f.popMs += delta;
      const i = Math.floor(f.popMs / ART.popFrameMs);
      if (i >= POP_FRAMES) {
        f.popMs = -1;
        f.pop.setVisible(false);
      } else f.pop.setFrame(popFrameName(i));
    }
    const s = f.seed;
    if (s.lifeMs <= 0) return;
    // Si rodó fuera del borde (de la rama), ya no tiene piso: lo busca de nuevo más abajo, o cae.
    if (Number.isFinite(s.floorY) && !this.solidAt(s.x, s.floorY + this.tileSize / 2)) {
      s.floorY = floorBelow(s.x, s.floorY + 1, ART.seed.maxDropPx, this.tileSize, this.solidAt) ?? Infinity;
    }
    if (stepSeed(s, delta, ART.seed)) f.seedImg.setFlipX(!f.seedImg.flipX);
    const a = seedAlpha(s.ageMs, s.lifeMs, ART.seed.fadeMs, ART.seed.fadeSteps);
    // Apoyada en el piso: los pies del dibujo en el borde (el centro, medio alto más arriba).
    f.seedImg.setPosition(s.x, s.y - f.seedImg.displayHeight / 2).setAlpha(a);
    if (a <= 0) {
      s.lifeMs = 0;
      f.seedImg.setVisible(false);
    }
  }

  override projectileHits(rect: Phaser.Geom.Rectangle): boolean {
    for (const f of this.fruits) {
      if (f.lifeMs <= 0 || !rect.contains(f.img.x, f.img.y)) continue;
      this.burst(f);
      return true;
    }
    return false;
  }

  override purify(): void {
    for (const f of this.fruits) {
      f.lifeMs = 0;
      f.img.setVisible(false);
    }
    this.held.setVisible(false);
    super.purify();
  }

  override destroy(fromScene?: boolean): void {
    for (const f of this.fruits) {
      f.img.destroy();
      f.pop.destroy();
      f.seedImg.destroy();
    }
    this.fruits.length = 0;
    this.held.destroy();
    this.pulp.destroy();
    super.destroy(fromScene);
  }
}
