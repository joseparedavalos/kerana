import Phaser from 'phaser';
import { GAMEPLAY } from '../config/gameplay';
import { PLAYER_KEY, PLAYER_PLACEHOLDER_KEY } from '../assets/manifest';
import type { InputManager } from '../systems/InputManager';
import { Health } from '../systems/Health';
import { PlayerMotor, type MotorBody, type MoveInput, type PlayerStateName } from './PlayerMotor';

const LUZ_ARASY_COLOR = 0xdcdce6;
const FX = GAMEPLAY.playerFx;

/** Animación de cada estado de la máquina de Kerana (GDD §3.5). */
const STATE_ANIM: Record<PlayerStateName, string> = {
  idle: `${PLAYER_KEY}_idle`,
  run: `${PLAYER_KEY}_run`,
  jump: `${PLAYER_KEY}_jump`,
  fall: `${PLAYER_KEY}_fall`,
  attack: `${PLAYER_KEY}_attack`,
  hurt: `${PLAYER_KEY}_hurt`,
};
const ANIM_BLINK = `${PLAYER_KEY}_blink`;
const ANIM_LAND = `${PLAYER_KEY}_land`;

export interface PlayerOptions {
  /** Modo asistido (GDD §4.7). */
  assist?: boolean;
  /** Corazones máximos del guardado (sube con los dones de corazón). */
  maxHearts?: number;
  /** Don del tajo cargado (GDD §3.7). */
  chargedSlash?: boolean;
  /** `?god=1`: no recibe daño. */
  god?: boolean;
}

// Kerana: sprite con física; el movimiento lo decide PlayerMotor (lógica pura).
export class Player extends Phaser.Physics.Arcade.Sprite {
  readonly motor = new PlayerMotor();
  // Corazones del guardado (4 a 7 con los dones de corazón), +3 con el modo asistido (GDD §4.7).
  readonly health: Health;
  declare body: Phaser.Physics.Arcade.Body;
  private readonly assist: boolean;
  private readonly god: boolean;

  private readonly attackHitbox: Phaser.GameObjects.Zone;
  private readonly attackHitboxBody: Phaser.Physics.Arcade.Body;
  /** Lo que ya golpeó este tajo (enemigos, jefe, rocas): un golpe por tajo. */
  private readonly hitThisSwing = new Set<object>();
  /** Rectángulo del tajo en el mundo (válido mientras `motor.attackHitboxActive`). */
  readonly attackRect = new Phaser.Geom.Rectangle();
  private readonly moveInput: MoveInput = {
    left: false,
    right: false,
    jumpPressed: false,
    jumpHeld: false,
    attackPressed: false,
    attackHeld: false,
  };
  private readonly motorBody: MotorBody = { onGround: false, vx: 0, vy: 0 };

  private glow?: Phaser.Filters.Glow;
  private luzArasyMsLeft = 0;
  private luzArasyDurationMs = 1;
  private blinkMs = 0;
  /** Hay sprite real con animaciones (si no, rectángulo provisional). */
  private readonly animated: boolean;
  private animState?: PlayerStateName;
  private nextEyeBlinkMs = 0;
  private hurtFlashMsLeft = 0;
  private chargeGlow?: Phaser.Filters.Glow;

  constructor(scene: Phaser.Scene, x: number, feetY: number, opts: PlayerOptions = {}) {
    const animated = scene.anims.exists(STATE_ANIM.idle);
    super(scene, x, feetY, animated ? PLAYER_KEY : PLAYER_PLACEHOLDER_KEY);
    this.animated = animated;
    const assist = opts.assist ?? false;
    this.assist = assist;
    this.god = opts.god ?? false;
    this.motor.chargeEnabled = opts.chargedSlash ?? false;
    const baseHearts = Phaser.Math.Clamp(opts.maxHearts ?? GAMEPLAY.hearts.start, GAMEPLAY.hearts.start, GAMEPLAY.hearts.max);
    const startHearts = baseHearts + (assist ? GAMEPLAY.hearts.assistBonus : 0);
    this.health = new Health(startHearts, startHearts);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    // Origen en los pies: x, y = centro inferior.
    this.setOrigin(0.5, 1);
    // Hitbox del cuerpo, centrada en X y apoyada en el borde inferior del frame (donde están los pies).
    const bw = GAMEPLAY.player.bodyWidth;
    const bh = GAMEPLAY.player.bodyHeight;
    this.body.setSize(bw, bh, false);
    this.body.setOffset((this.width - bw) / 2, this.height - bh);
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

  hasHitThisSwing(target: object): boolean {
    return this.hitThisSwing.has(target);
  }

  markHitThisSwing(target: object): void {
    this.hitThisSwing.add(target);
  }

  tick(deltaMs: number, input: InputManager): void {
    const mi = this.moveInput;
    mi.left = input.isDown('left');
    mi.right = input.isDown('right');
    mi.jumpPressed = input.justPressed('jump');
    mi.jumpHeld = input.isDown('jump');
    mi.attackPressed = input.justPressed('attack');
    mi.attackHeld = input.isDown('attack');

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
    this.updateAnimation(deltaMs);
    this.updateHurtFlash(deltaMs);
    this.setChargeGlow(this.motor.chargeFraction);
  }

  /** Daño del tajo en curso (el cargado pega más, GDD §3.7). */
  get attackDamage(): number {
    return this.motor.chargedSwing ? GAMEPLAY.chargedSlash.damage : GAMEPLAY.attack.damage;
  }

  /** Brillo de carga del tajo cargado (0 = apagado, 1 = carga completa). */
  setChargeGlow(fraction: number): void {
    if (fraction <= 0) {
      if (this.chargeGlow?.active) this.chargeGlow.setActive(false);
      return;
    }
    if (!this.chargeGlow) {
      this.enableFilters();
      this.chargeGlow = this.filters!.internal.addGlow(FX.chargeGlowColor, 0, 0, 1);
    }
    this.chargeGlow.setActive(true);
    this.chargeGlow.outerStrength = FX.chargeGlowStrength * Math.min(1, fraction);
  }

  /** Kerana recibe daño; `knockbackFromX` es de dónde vino el golpe. Devuelve si se aplicó. */
  takeDamage(amount: number, knockbackFromX: number = this.x): boolean {
    if (this.isImmune || this.god) return false;
    const invulnerableMs = this.assist ? GAMEPLAY.hurt.invulnerableAssistMs : GAMEPLAY.hurt.invulnerableMs;
    const applied = this.health.damage(amount, invulnerableMs);
    if (!applied) return false;
    const dir = this.x < knockbackFromX ? -1 : 1;
    this.body.setVelocity(dir * GAMEPLAY.hurt.knockbackX, GAMEPLAY.hurt.knockbackY);
    this.motor.triggerHurt(GAMEPLAY.hurt.reducedControlMs);
    this.hurtFlashMsLeft = FX.hurtFlashMs;
    return true;
  }

  /** Guavirá o fuego encendido por primera vez: cura corazones. */
  heal(amount: number): number {
    return this.health.heal(amount);
  }

  /** Luz de Arasy: inmunidad con brillo plateado (filtro Glow de Phaser 4, GDD §4.3). Más larga con el modo asistido. */
  activateLuzArasy(ms: number = this.assist ? GAMEPLAY.luzArasy.durationAssistMs : GAMEPLAY.luzArasy.durationMs): void {
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
      const charged = this.motor.chargedSwing;
      const w = charged ? GAMEPLAY.chargedSlash.hitboxWidth : GAMEPLAY.attack.hitboxWidth;
      const h = charged ? GAMEPLAY.chargedSlash.hitboxHeight : GAMEPLAY.attack.hitboxHeight;
      const cx = this.x + this.motor.facing * (this.body.width / 2 + w / 2);
      const cy = this.y - this.body.height / 2;
      this.attackHitbox.setPosition(cx, cy);
      this.attackRect.setTo(cx - w / 2, cy - h / 2, w, h);
      this.attackHitboxBody.setSize(w, h);
      this.attackHitboxBody.enable = true;
    } else {
      this.attackHitboxBody.enable = false;
      this.hitThisSwing.clear();
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

  /** Cambia la animación solo cuando cambia el estado; en idle, parpadeo de ojos ocasional. */
  private updateAnimation(deltaMs: number): void {
    if (!this.animated) return;
    const state = this.motor.state;
    if (state !== this.animState) {
      const prev = this.animState;
      this.animState = state;
      if (state === 'idle' && prev === 'fall' && this.scene.anims.exists(ANIM_LAND)) {
        this.play(ANIM_LAND);
        this.chain(STATE_ANIM.idle);
      } else {
        this.play(STATE_ANIM[state]);
      }
      this.nextEyeBlinkMs = Phaser.Math.Between(FX.blinkMinMs, FX.blinkMaxMs);
      return;
    }
    if (state !== 'idle' || !this.scene.anims.exists(ANIM_BLINK)) return;
    this.nextEyeBlinkMs -= deltaMs;
    if (this.nextEyeBlinkMs <= 0) {
      this.nextEyeBlinkMs = Phaser.Math.Between(FX.blinkMinMs, FX.blinkMaxMs);
      this.play(ANIM_BLINK);
      this.chain(STATE_ANIM.idle);
    }
  }

  /** Destello rojo/blanco al recibir daño (tinte en modo FILL); luego vuelve el tinte normal. */
  private updateHurtFlash(deltaMs: number): void {
    if (this.hurtFlashMsLeft <= 0) return;
    this.hurtFlashMsLeft = Math.max(0, this.hurtFlashMsLeft - deltaMs);
    if (this.hurtFlashMsLeft <= 0) {
      this.setTintMode(Phaser.TintModes.MULTIPLY);
      if (this.isImmune) this.setTint(LUZ_ARASY_COLOR);
      else this.clearTint();
      return;
    }
    const phase = Math.floor(this.hurtFlashMsLeft / FX.hurtFlashPeriodMs) % 2;
    this.setTint(phase === 0 ? FX.hurtFlashWhite : FX.hurtFlashRed).setTintMode(Phaser.TintModes.FILL);
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
