import Phaser from 'phaser';
import { GAMEPLAY } from '../config/gameplay';
import { addAoAoRunner } from '../entities/bosses/AoAo';
import type { Refuge } from '../entities/bosses/aoAoLogic';
import { AudioManager } from './AudioManager';
import type { CameraController } from './CameraController';
import { ChaseMotor, type ChaseEvent } from './chaseLogic';
import { fixedOffset, VIEW } from './View';

const CFG = GAMEPLAY.chase;
const TILE = 16;

export interface ChaseDeps {
  camera: Phaser.Cameras.Scene2D.Camera;
  cameraCtl: CameraController;
  /** Superficie (y del borde de arriba del tile) en la columna x desde fromY hacia abajo, o null. */
  surfaceBelow: (x: number, fromY: number) => number | null;
  dust: Phaser.GameObjects.Particles.ParticleEmitter;
  shake: (ms: number, intensity: number) => void;
  mapWidth: number;
}

/**
 * Persecución de Ao Ao (GDD §6.6, S31): la parte visible de `ChaseMotor`. Fija la cámara al borde que avanza, dibuja a
 * Ao Ao corriendo en el borde izquierdo (se adelanta y aúlla en el aviso) y la franja roja del aviso. Lo que cuesta
 * (el corazón, adónde vuelve Kerana) lo resuelve LevelScene con los eventos de `update`.
 */
export class Chase {
  readonly motor: ChaseMotor;
  /** Pindó del tramo (refugios): los demás (la arena) no cuentan. */
  readonly refuges: Refuge[];
  private readonly aoAo: Phaser.GameObjects.Image;
  private readonly band: Phaser.GameObjects.Graphics;
  private howlMs = 0;
  private wasWarn = false;
  private leaving = false;
  private aoAoY = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    readonly zone: Phaser.Geom.Rectangle,
    speed: number,
    allRefuges: readonly Refuge[],
    private readonly deps: ChaseDeps,
  ) {
    this.motor = new ChaseMotor({
      startX: zone.left,
      endX: zone.right,
      speed,
      viewWidth: VIEW.width,
      aheadFrac: CFG.aheadFrac,
      warnPx: CFG.warnPx,
      catchPx: CFG.catchPx,
      restartLeadPx: CFG.restartLeadPx,
      maxEdgeX: deps.mapWidth - VIEW.width,
    });
    this.refuges = allRefuges.filter((r) => r.left >= zone.left && r.right <= zone.right);
    this.aoAo = addAoAoRunner(scene, zone.left, zone.bottom).setVisible(false).setDepth(9);
    const hud = fixedOffset(deps.camera);
    this.band = scene.add.graphics().setScrollFactor(0).setDepth(90).setPosition(hud.x, hud.y).setVisible(false);
    this.band.fillGradientStyle(CFG.warnColor, CFG.warnColor, CFG.warnColor, CFG.warnColor, 1, 0, 1, 0);
    this.band.fillRect(0, 0, CFG.warnBandPx, VIEW.height);
  }

  get active(): boolean {
    return this.motor.active;
  }

  /** Un paso: mueve el borde, la cámara y a Ao Ao. Devuelve 'caught' cuando la alcanza (LevelScene la hace volver). */
  update(dtMs: number, body: Phaser.Physics.Arcade.Body, refuge: Refuge | null): ChaseEvent {
    const inZone = refuge && this.refuges.includes(refuge) ? (refuge.left + refuge.right) / 2 : null;
    const event = this.motor.step(dtMs, this.deps.camera.worldView.x, body.left, body.center.x, inZone);
    if (event === 'started') this.onStart(body);
    else if (event === 'ended') this.onEnd();
    if (this.motor.active) {
      this.deps.cameraCtl.lockScrollX(this.motor.edgeX);
      this.updateAoAo(dtMs, body);
    }
    this.updateBand();
    return event;
  }

  /** Después de una caída o de que la alcanza: vuelve al último pindó (x) o a la largada (null, la persecución reinicia). */
  restart(): number | null {
    const x = this.motor.restart();
    if (x === null) this.release();
    else this.placeAoAo(this.motor.edgeX + CFG.aoAoOffsetPx, null);
    return x;
  }

  /** 0 corazones o vuelta al fuego: si no terminó, todo como antes de largar. */
  reset(): void {
    if (this.motor.phase === 'done') return;
    this.motor.reset();
    this.release();
  }

  private onStart(body: Phaser.Physics.Arcade.Body): void {
    this.leaving = false;
    this.wasWarn = false;
    this.howlMs = CFG.howlEveryMs;
    this.aoAo.setAlpha(1).setVisible(true).setFlipX(false);
    this.aoAoY = body.bottom;
    this.placeAoAo(this.motor.edgeX + CFG.aoAoOffsetPx, body.bottom);
    AudioManager.play('howl');
    this.deps.shake(CFG.startShakeMs, CFG.startShakeIntensity);
  }

  private onEnd(): void {
    this.deps.cameraCtl.lockScrollX(null);
    // Ao Ao se frena, aúlla y se vuelve por donde vino.
    AudioManager.play('howl');
    this.leaving = true;
    this.aoAo.setFlipX(true);
    const dx = CFG.leaveSpeed * (CFG.leaveFadeMs / 1000);
    this.scene.tweens.add({
      targets: this.aoAo,
      x: this.aoAo.x - dx,
      alpha: 0,
      duration: CFG.leaveFadeMs,
      onComplete: () => this.aoAo.setVisible(false),
    });
  }

  private release(): void {
    this.deps.cameraCtl.lockScrollX(null);
    this.aoAo.setVisible(false);
    this.wasWarn = false;
  }

  private updateAoAo(dtMs: number, body: Phaser.Physics.Arcade.Body): void {
    if (this.leaving) return;
    const m = this.motor;
    const refuge = m.phase === 'refuge';
    // En el refugio va y viene en el borde, aullando; en el aviso se adelanta.
    const pace = refuge ? Math.sin(this.scene.time.now / CFG.aoAoPaceMs) * CFG.aoAoPacePx : 0;
    const target = m.edgeX + (m.warn ? CFG.aoAoLungePx : CFG.aoAoOffsetPx) + pace;
    const x = this.aoAo.x + (target - this.aoAo.x) * CFG.aoAoLerp;
    this.placeAoAo(x, body.bottom);
    if (refuge) this.aoAo.setFlipX(pace < 0);
    else this.aoAo.setFlipX(false);
    if (Math.random() < dtMs / CFG.aoAoDustEveryMs) this.deps.dust.emitParticleAt(x - GAMEPLAY.aoAo.width / 4, this.aoAo.y - 2, 1);
    // Aúlla al entrar al aviso y cada tanto mientras dura (o mientras Kerana está en el pindó).
    this.howlMs += dtMs;
    if ((m.warn && !this.wasWarn) || ((m.warn || refuge) && this.howlMs >= CFG.howlEveryMs)) {
      AudioManager.play('howl');
      this.howlMs = 0;
    }
    this.wasWarn = m.warn;
  }

  /** Ao Ao en x, sobre el terreno de esa columna (busca desde 8 filas sobre los pies de Kerana); sobre un hueco, salta. */
  private placeAoAo(x: number, keranaFeet: number | null): void {
    const from = (keranaFeet ?? this.aoAoY) - 8 * TILE;
    const ground = this.deps.surfaceBelow(x, from);
    if (ground !== null && ground < from + 16 * TILE) this.aoAoY += (ground - this.aoAoY) * CFG.aoAoYLerp;
    this.aoAo.setPosition(x, this.aoAoY);
  }

  private updateBand(): void {
    const m = this.motor;
    if (!m.active || !m.warn) {
      this.band.setVisible(false);
      return;
    }
    // Más fuerte cuanto más cerca del borde, y late.
    const near = Phaser.Math.Clamp(1 - m.gapPx / CFG.warnPx, 0, 1);
    const pulse = 0.7 + 0.3 * Math.abs(Math.sin(this.scene.time.now / CFG.warnPulseMs));
    this.band.setVisible(true).setAlpha(CFG.warnAlpha * (0.35 + 0.65 * near) * pulse);
  }
}
