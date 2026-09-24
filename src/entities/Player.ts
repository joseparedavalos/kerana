import Phaser from 'phaser';
import { GAMEPLAY } from '../config/gameplay';
import { PLAYER_PLACEHOLDER_KEY } from '../assets/manifest';
import type { InputManager } from '../systems/InputManager';
import { Health } from '../systems/Health';
import { PlayerMotor, type MotorBody, type MoveInput } from './PlayerMotor';
import type { EnemyBase } from './enemies/EnemyBase';

const LUZ_ARASY_COLOR = 0xdcdce6;

// Kerana: sprite con física; el movimiento lo decide PlayerMotor (lógica pura).
export class Player extends Phaser.Physics.Arcade.Sprite {
  readonly motor = new PlayerMotor();
  // El máximo real (GAMEPLAY.hearts.max = 7) se alcanza con los dones de corazón (S7/S10/S11); acá empieza en 4.
  readonly health = new Health(GAMEPLAY.hearts.start, GAMEPLAY.hearts.start);
  declare body: Phaser.Physics.Arcade.Body;

  private readonly attackHitbox: Phaser.GameObjects.Zone;
  private readonly attackHitboxBody: Phaser.Physics.Arcade.Body;
  private readonly hitEnemiesThisSwing = new Set<EnemyBase>();
  private readonly moveInput: MoveInput = { left: false, right: false, jumpPressed: false, jumpHeld: false, attackPressed: false };
  private readonly motorBody: MotorBody = { onGround: false, vx: 0, vy: 0 };

  private glow?: Phaser.Filters.Glow;
  private luzArasyMsLeft = 0;
  private luzArasyDurationMs = 1;
  private blinkMs = 0;

  constructor(scene: Phaser.Scene, x: number, feetY: number) {
    super(scene, x, feetY, PLAYER_PLACEHOLDER_KEY);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    // Origen en los pies: x, y = centro inferior.
    this.setOrigin(0.5, 1);
    this.body.setSize(GAMEPLAY.player.bodyWidth, GAMEPLAY.player.bodyHeight);
    this.body.setMaxVelocityY(GAMEPLAY.player.maxFallSpeed);
    this.setCollideWorldBounds(true);
    this.body.reset(x, feetY);

    this.attackHitbox = scene.add.zone(x, feetY, 1, 1);
    scene.physics.add.existing(this.attackHitbox);
    this.attackHitboxBody = this.attackHitbox.body as Phaser.Physics.Arcade.Body;
    this.attackHitboxBody.setAllowGravity(false);
    this.attackHitboxBody.enable = false;
  }

  /** Zona de colisión del tajo; solo está activa (`body.enable`) en su ventana. */
  getAttackHitbox(): Phaser.GameObjects.Zone {
    return this.attackHitbox;
  }

  /** True mientras dura la Luz de Arasy: inmune y purifica a los enemigos comunes al tocarlos. */
  get isImmune(): boolean {
    return this.luzArasyMsLeft > 0;
  }

  /** Fracción de la Luz de Arasy que queda (1 → 0), para la barra del HUD. */
  get luzArasyFraction(): number {
    return this.luzArasyMsLeft / this.luzArasyDurationMs;
  }

  hasHitThisSwing(enemy: EnemyBase): boolean {
    return this.hitEnemiesThisSwing.has(enemy);
  }

  markHitThisSwing(enemy: EnemyBase): void {
    this.hitEnemiesThisSwing.add(enemy);
  }

  tick(deltaMs: number, input: InputManager): void {
    const mi = this.moveInput;
    mi.left = input.isDown('left');
    mi.right = input.isDown('right');
    mi.jumpPressed = input.justPressed('jump');
    mi.jumpHeld = input.isDown('jump');
    mi.attackPressed = input.justPressed('attack');

    const b = this.motorBody;
    b.onGround = this.body.blocked.down || this.body.touching.down;
    b.vx = this.body.velocity.x;
    b.vy = this.body.velocity.y;

    const out = this.motor.step(deltaMs, mi, b);
    this.body.setVelocity(out.vx, out.vy);
    this.setFlipX(this.motor.facing < 0);

    this.health.tick(deltaMs);
    this.updateAttackHitbox();
    this.updateLuzArasy(deltaMs);
    this.updateBlink(deltaMs);
  }

  /** Kerana recibe daño; `knockbackFromX` es de dónde vino el golpe. Devuelve si se aplicó. */
  takeDamage(amount: number, knockbackFromX: number = this.x): boolean {
    if (this.isImmune) return false;
    const applied = this.health.damage(amount, GAMEPLAY.hurt.invulnerableMs);
    if (!applied) return false;
    const dir = this.x < knockbackFromX ? -1 : 1;
    this.body.setVelocity(dir * GAMEPLAY.hurt.knockbackX, GAMEPLAY.hurt.knockbackY);
    this.motor.triggerHurt(GAMEPLAY.hurt.reducedControlMs);
    return true;
  }

  /** Guavirá o fuego encendido por primera vez: cura corazones. */
  heal(amount: number): number {
    return this.health.heal(amount);
  }

  /** Luz de Arasy: inmunidad con brillo plateado (filtro Glow de Phaser 4, GDD §4.3). */
  activateLuzArasy(ms: number = GAMEPLAY.luzArasy.durationMs): void {
    this.luzArasyMsLeft = ms;
    this.luzArasyDurationMs = ms;
    if (!this.glow) {
      this.enableFilters();
      this.glow = this.filters!.internal.addGlow(0xc8c8e6, 3, 0, 1);
    } else {
      this.glow.setActive(true);
    }
    this.setTint(LUZ_ARASY_COLOR);
  }

  /** Reaparece con los pies en (x, feetY), quieta. */
  respawnAt(x: number, feetY: number): void {
    this.body.reset(x, feetY);
    this.body.setVelocity(0, 0);
    this.motor.reset();
    this.scene.tweens.add({
      targets: this,
      alpha: 0.2,
      duration: GAMEPLAY.respawn.flashMs / 4,
      yoyo: true,
      repeat: 1,
      onComplete: () => this.setAlpha(1),
    });
  }

  /** Reaparición tras 0 corazones (GDD §3.6): vida completa y sin buffs. */
  koRespawn(x: number, feetY: number): void {
    this.health.reset();
    this.luzArasyMsLeft = 0;
    this.glow?.setActive(false);
    this.clearTint();
    this.respawnAt(x, feetY);
  }

  private updateAttackHitbox(): void {
    if (this.motor.attackHitboxActive) {
      const w = GAMEPLAY.attack.hitboxWidth;
      const h = GAMEPLAY.attack.hitboxHeight;
      const cx = this.x + this.motor.facing * (this.body.width / 2 + w / 2);
      const cy = this.y - this.body.height / 2;
      this.attackHitbox.setPosition(cx, cy);
      this.attackHitboxBody.setSize(w, h);
      this.attackHitboxBody.enable = true;
    } else {
      this.attackHitboxBody.enable = false;
      this.hitEnemiesThisSwing.clear();
    }
  }

  private updateLuzArasy(deltaMs: number): void {
    if (this.luzArasyMsLeft <= 0) return;
    this.luzArasyMsLeft = Math.max(0, this.luzArasyMsLeft - deltaMs);
    if (this.luzArasyMsLeft <= 0) {
      this.glow?.setActive(false);
      this.clearTint();
    }
  }

  private updateBlink(deltaMs: number): void {
    this.blinkMs += deltaMs;
    const luzBlinking = this.isImmune && this.luzArasyMsLeft <= GAMEPLAY.luzArasy.blinkLastMs;
    if (!this.health.isInvulnerable && !luzBlinking) {
      this.setAlpha(1);
      return;
    }
    const periodMs = 1000 / GAMEPLAY.hurt.blinkHz;
    this.setAlpha(this.blinkMs % periodMs < periodMs / 2 ? 1 : 0.35);
  }
}
