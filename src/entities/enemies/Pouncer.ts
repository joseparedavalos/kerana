import Phaser from 'phaser';
import { GAMEPLAY } from '../../config/gameplay';
import type { EnemyDef } from '../../data/enemies';
import { AudioManager } from '../../systems/AudioManager';
import { EnemyBase } from './EnemyBase';
import { ledgeBehind, PounceMotor, scanAhead, type PounceState } from './PounceMotor';

const CFG = GAMEPLAY.yaguareteAva;

// Yaguareté avá (S76): un Charger que salta un hueco. Espera en su copa; cuando Kerana entra en su radio se agazapa,
// corre y, si ella está del otro lado de un hueco, se planta en el borde, salta una vez y cae expuesto. El dibujo
// sigue al estado: `idle` quieto, `run` en el aviso (los cuadros de la cabeza baja) y en la carrera, y `attack` en el
// borde, en el aire y al caer.
export class Pouncer extends EnemyBase {
  /** Suelo firme (la capa Ground: no las plataformas que se mueven). La escena lo conecta. */
  groundAt?: (x: number, y: number) => boolean;
  /** Kerana es un blanco: no va sobre una plataforma que se mueve. La escena lo conecta (sin escena, siempre). */
  targetValid?: () => boolean;
  private readonly motor: PounceMotor;
  /** Lo que se ve: el nombre de la animación, o el cuadro de `attack`. */
  private shown: string | null = null;

  constructor(scene: Phaser.Scene, x: number, y: number, def: EnemyDef, facing: 1 | -1 = -1) {
    super(scene, x, y, def, facing);
    this.motor = new PounceMotor({
      detectRadius: def.detectRadius ?? CFG.detectRadius,
      telegraphMs: def.telegraphMs ?? CFG.telegraphMs,
      chargeSpeed: def.chargeSpeed ?? CFG.runSpeed,
      chargeMaxMs: def.chargeMaxMs ?? CFG.runMaxMs,
      cooldownMs: def.cooldownMs ?? CFG.cooldownMs,
      gatherMs: CFG.gatherMs,
      leapVelocity: CFG.leapVelocity,
      gravity: GAMEPLAY.gravity,
      maxGapPx: CFG.maxGapPx,
      landMarginPx: CFG.landMarginPx,
      leapMaxSpeed: CFG.leapMaxSpeed,
      halfWidth: def.width / 2,
      recoverMs: CFG.recoverMs,
    });
  }

  /** Estado actual (el smoke, el piloto y las capturas lo miran). */
  get pounceState(): PounceState {
    return this.motor.state;
  }

  /** Expuesto al caer: tocarlo no lastima (la ventana para pegarle o pasarlo). */
  override get touchHurts(): boolean {
    return this.motor.state !== 'recover';
  }

  updateBehavior(deltaMs: number, dx: number, dy: number): void {
    const state0 = this.motor.state;
    if (state0 === 'charge' && (this.body.blocked.left || this.body.blocked.right)) this.motor.stopRun();
    const grounded = this.body.blocked.down || this.body.touching.down;
    const dir: 1 | -1 = dx >= 0 ? 1 : -1;
    const seen = Math.abs(dy) <= CFG.detectHeight && (this.targetValid?.() ?? true);
    // No la empuja hacia un borde sin dónde caer: con eso detrás de ella, no la ataca (y si corría, frena).
    const cornered = seen && this.groundAt !== undefined && ledgeBehind(this.x + dx, this.body.bottom, dir, CFG.ledgeGuardPx, CFG.maxGapPx, CFG.scanStep, this.groundAt);
    const valid = seen && !cornered;
    const distance = valid ? Math.abs(dx) : Infinity;
    // El borde y el hueco, en la dirección en que corre: también en el cuadro en que pasa del aviso a la carrera.
    const runDir = this.facing;
    const ahead =
      (state0 === 'charge' || state0 === 'telegraph') && this.groundAt
        ? scanAhead(this.x + runDir * (this.def.width / 2), this.body.bottom, runDir, CFG.lookPx, CFG.maxGapPx, CFG.scanStep, this.groundAt)
        : undefined;
    const out = this.motor.step(deltaMs, distance, dir, ahead, grounded);
    if (out.state === 'telegraph' && state0 !== 'telegraph' && this.def.warnSfx) AudioManager.play(this.def.warnSfx);
    if (out.jump) {
      this.body.setVelocity(out.jump.vx, out.jump.vy);
      if (this.def.castSfx) AudioManager.play(this.def.castSfx);
    } else if (out.vx !== null) {
      // Quieto o corriendo: nunca se desliza con el retroceso del golpe (no lo tira de la copa).
      this.body.setVelocityX(out.vx);
    }
    if (out.vx) this.facing = out.vx > 0 ? 1 : -1;
    else if ((out.state === 'idle' || out.state === 'telegraph') && valid && Math.abs(dx) <= CFG.watchRadius && dx !== 0) this.facing = dir;
    this.warning = out.state === 'telegraph' || out.state === 'gather';
    this.showPose(out.state);
  }

  /** El dibujo de cada tiempo. */
  private showPose(state: PounceState): void {
    const f = CFG.frames;
    const progress = this.motor.progress;
    switch (state) {
      case 'telegraph': {
        const [a, b] = f.telegraph;
        this.setPose('run', a + Math.min(b - a, Math.floor(progress * (b - a + 1))));
        return;
      }
      case 'charge':
        this.setPose('run');
        return;
      case 'gather':
        this.setPose('attack', f.gather);
        return;
      case 'leap':
        this.setPose('attack', this.body.velocity.y < 0 ? f.rise : f.fall);
        return;
      case 'recover': {
        const [a, b] = f.recover;
        this.setPose('attack', a + Math.min(b - a, Math.floor(progress * (b - a + 1))));
        return;
      }
      default:
        this.setPose('idle');
    }
  }

  /** Juega la animación `sheet` o pone uno de sus cuadros quieto. */
  private setPose(sheet: 'idle' | 'run' | 'attack', frame?: number): void {
    const sprite = this.skin?.sprite;
    if (!sprite) return;
    const look = this.def.look ?? this.def.id;
    const id = frame === undefined ? sheet : `${sheet}:${frame}`;
    if (id === this.shown) return;
    this.shown = id;
    const anim = this.scene.anims.get(`${look}_${sheet}`);
    if (!anim) return;
    if (frame === undefined) {
      sprite.play(anim);
      return;
    }
    const at = anim.frames[Math.min(frame, anim.frames.length - 1)];
    if (!at) return;
    sprite.anims.stop();
    sprite.setFrame(at.frame.name);
  }
}
