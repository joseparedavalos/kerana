import { GAMEPLAY, type PlayerConfig } from '../config/gameplay';

// Lógica pura del movimiento de Kerana (sin Phaser) para poder probarla con tiempos simulados.

export type PlayerStateName = 'idle' | 'run' | 'jump' | 'fall' | 'attack' | 'hurt';

export interface MoveInput {
  left: boolean;
  right: boolean;
  /** Saltar se pulsó en este frame. */
  jumpPressed: boolean;
  /** Saltar está mantenido. */
  jumpHeld: boolean;
  /** Atacar se pulsó en este frame. */
  attackPressed: boolean;
  /** Atacar está mantenido (tajo cargado, don 1). */
  attackHeld?: boolean;
}

export interface MotorBody {
  onGround: boolean;
  vx: number;
  vy: number;
}

export interface MotorOutput {
  vx: number;
  vy: number;
}

export interface AttackConfig {
  activeFromFrame: number;
  activeMs: number;
  totalMs: number;
}

export interface ChargeConfig {
  holdMs: number;
  glowFromMs: number;
}

/** Duración de un frame a 60 fps (GDD §3.4 da los tiempos de ataque en frames). */
const FRAME_MS = 1000 / 60;

/** Transiciones de la máquina de estados de movimiento (GDD §3.5). */
export function nextMoveState(
  grounded: boolean,
  vx: number,
  vy: number,
  hasInput: boolean,
  idleThreshold: number,
): PlayerStateName {
  if (!grounded) return vy < 0 ? 'jump' : 'fall';
  if (hasInput || Math.abs(vx) > idleThreshold) return 'run';
  return 'idle';
}

function approach(value: number, target: number, maxDelta: number): number {
  if (value < target) return Math.min(value + maxDelta, target);
  if (value > target) return Math.max(value - maxDelta, target);
  return value;
}

export class PlayerMotor {
  state: PlayerStateName = 'idle';
  prevState: PlayerStateName = 'idle';
  /** Tiempo en el estado actual (ms). */
  stateMs = 0;
  facing: 1 | -1 = 1;
  /** La hitbox del sable está activa este frame (GDD §3.4). */
  attackHitboxActive = false;
  /** El tajo en curso es el cargado (más grande, 3 de daño, rompe rocas agrietadas). */
  chargedSwing = false;
  /** Don del tajo cargado desbloqueado (GDD §3.7). */
  chargeEnabled = false;
  /** Tiempo manteniendo atacar (ms). */
  chargeMs = 0;

  private coyoteLeftMs = 0;
  private bufferLeftMs = 0;
  /** Salto en curso que todavía se puede cortar al soltar. */
  private jumpCuttable = false;
  private attackMsLeft = 0;
  private hurtMsLeft = 0;
  private readonly out: MotorOutput = { vx: 0, vy: 0 };

  constructor(
    private readonly cfg: PlayerConfig = GAMEPLAY.player,
    private readonly attackCfg: AttackConfig = GAMEPLAY.attack,
    private readonly chargeCfg: ChargeConfig = GAMEPLAY.chargedSlash,
  ) {}

  /** Carga del tajo para el brillo (0 = nada, 1 = lista para soltar). */
  get chargeFraction(): number {
    const { holdMs, glowFromMs } = this.chargeCfg;
    if (this.chargeMs <= glowFromMs) return 0;
    return Math.min(1, (this.chargeMs - glowFromMs) / Math.max(1, holdMs - glowFromMs));
  }

  /** Avanza la lógica un paso. Devuelve la velocidad deseada (objeto reutilizado). */
  step(dtMs: number, input: MoveInput, body: MotorBody): MotorOutput {
    const cfg = this.cfg;
    const dt = Math.min(dtMs, cfg.maxStepMs);
    const dtS = dt / 1000;
    let vx = body.vx;
    let vy = body.vy;
    // En el suelo solo si no está subiendo (evita recargar el coyote al despegar).
    const grounded = body.onGround && vy >= 0;

    this.hurtMsLeft = Math.max(0, this.hurtMsLeft - dt);
    const hurt = this.hurtMsLeft > 0;

    // Horizontal (control reducido mientras está aturdida por el daño).
    const dir = hurt ? 0 : (input.right ? 1 : 0) - (input.left ? 1 : 0);
    if (dir !== 0) this.facing = dir as 1 | -1;
    const control = grounded ? 1 : cfg.airControl;
    const target = dir * cfg.runSpeed;
    const braking = dir === 0 || (vx !== 0 && Math.sign(vx) !== dir);
    const rate = (braking ? cfg.groundDecel : cfg.groundAccel) * control;
    vx = approach(vx, target, rate * dtS);

    // Coyote y buffer
    if (grounded) {
      this.coyoteLeftMs = cfg.coyoteMs;
      this.jumpCuttable = false;
    } else {
      this.coyoteLeftMs = Math.max(0, this.coyoteLeftMs - dt);
    }
    if (input.jumpPressed) this.bufferLeftMs = cfg.jumpBufferMs;
    else this.bufferLeftMs = Math.max(0, this.bufferLeftMs - dt);

    let justJumped = false;
    if (this.bufferLeftMs > 0 && (grounded || this.coyoteLeftMs > 0)) {
      vy = cfg.jumpVelocity;
      this.bufferLeftMs = 0;
      this.coyoteLeftMs = 0;
      this.jumpCuttable = true;
      justJumped = true;
    } else {
      // Salto variable: soltar corta la subida una sola vez.
      if (this.jumpCuttable && !input.jumpHeld && vy < 0) {
        vy *= cfg.jumpCutMultiplier;
        this.jumpCuttable = false;
      }
      if (vy >= 0) this.jumpCuttable = false;
    }

    // Caída limitada
    if (vy > cfg.maxFallSpeed) vy = cfg.maxFallSpeed;

    // Tajo cargado: mantener atacar y soltar (el primer tajo normal sale igual al pulsar).
    if (this.chargeEnabled && !hurt && input.attackHeld) {
      this.chargeMs += dt;
    } else if (this.chargeMs > 0) {
      const ready = !hurt && this.chargeMs >= this.chargeCfg.holdMs;
      this.chargeMs = 0;
      if (ready) {
        this.attackMsLeft = this.attackCfg.totalMs;
        this.chargedSwing = true;
      }
    }

    // Ataque: se puede iniciar en el suelo o en el aire, en cualquier estado móvil, salvo aturdida.
    if (!hurt && input.attackPressed && this.attackMsLeft <= 0) {
      this.attackMsLeft = this.attackCfg.totalMs;
      this.chargedSwing = false;
    }
    if (this.attackMsLeft > 0) {
      this.attackMsLeft = Math.max(0, this.attackMsLeft - dt);
      const elapsed = this.attackCfg.totalMs - this.attackMsLeft;
      const activeFromMs = this.attackCfg.activeFromFrame * FRAME_MS;
      this.attackHitboxActive = elapsed >= activeFromMs && elapsed < activeFromMs + this.attackCfg.activeMs;
    } else {
      this.attackHitboxActive = false;
      this.chargedSwing = false;
    }

    if (hurt) this.setState('hurt');
    else if (this.attackMsLeft > 0) this.setState('attack');
    else if (justJumped) this.setState('jump');
    else this.setState(nextMoveState(grounded, vx, vy, dir !== 0, cfg.idleSpeedThreshold));

    this.stateMs += dt;
    this.out.vx = vx;
    this.out.vy = vy;
    return this.out;
  }

  /** Kerana recibe daño: control reducido durante `ms` (el retroceso lo aplica quien la llama). */
  triggerHurt(ms: number): void {
    this.hurtMsLeft = ms;
    this.attackMsLeft = 0;
    this.attackHitboxActive = false;
    this.chargedSwing = false;
    this.chargeMs = 0;
  }

  /** Reinicia tiempos y estado (al reaparecer). */
  reset(): void {
    this.coyoteLeftMs = 0;
    this.bufferLeftMs = 0;
    this.jumpCuttable = false;
    this.attackMsLeft = 0;
    this.hurtMsLeft = 0;
    this.attackHitboxActive = false;
    this.chargedSwing = false;
    this.chargeMs = 0;
    this.setState('idle');
  }

  private setState(next: PlayerStateName): void {
    if (next === this.state) return;
    this.prevState = this.state;
    this.state = next;
    this.stateMs = 0;
  }
}
