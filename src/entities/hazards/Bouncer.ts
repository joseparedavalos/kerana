import Phaser from 'phaser';
import { GAMEPLAY } from '../../config/gameplay';
import { BouncerMotor, type BouncerKind, type BouncerState } from './BouncerMotor';

const CFG = GAMEPLAY.jungle;
const VARIANTS = GAMEPLAY.bouncerVariants;
const CAP_COLOR = 0xd0643a;
const SPOT_COLOR = 0xf2eee3;
const STEM_COLOR = 0xe6d8b8;

// Hongo que rebota (GDD §6.5): sombrero de un solo sentido; al pisarlo lanza a Kerana hacia arriba.
// Variantes (S18, `kind`): de un solo uso (`once`: se desinfla y vuelve) y dormido (`sleep`: lo despierta el tajo cargado).
export class Bouncer {
  readonly motor: BouncerMotor;
  readonly cap: Phaser.GameObjects.Rectangle;
  private readonly stem: Phaser.GameObjects.Rectangle;
  private readonly spots: Phaser.GameObjects.Rectangle;
  private readonly topY: number;

  constructor(
    scene: Phaser.Scene,
    readonly zone: Phaser.Geom.Rectangle,
    kind: BouncerKind = 'normal',
  ) {
    this.motor = new BouncerMotor(kind, VARIANTS.onceRespawnMs);
    // El sombrero ocupa la parte de arriba del tile; el tallo llega al suelo.
    this.topY = zone.bottom - CFG.mushroomHeight;
    this.stem = scene.add.rectangle(zone.centerX, zone.bottom, Math.max(4, zone.width / 3), CFG.mushroomHeight, STEM_COLOR).setOrigin(0.5, 1).setDepth(2);
    this.cap = scene.add.rectangle(zone.x, this.topY, zone.width, CFG.mushroomHeight / 2, CAP_COLOR).setOrigin(0, 0).setDepth(2);
    this.spots = scene.add.rectangle(zone.centerX, this.topY + 2, Math.max(3, zone.width / 4), 2, SPOT_COLOR).setDepth(2);
    scene.physics.add.existing(this.cap, true);
    const body = this.cap.body as Phaser.Physics.Arcade.StaticBody;
    body.checkCollision.down = false;
    body.checkCollision.left = false;
    body.checkCollision.right = false;
    this.applyState(this.motor.state);
  }

  get canBounce(): boolean {
    return this.motor.canBounce;
  }

  /** ¿El cuerpo está apoyado en el sombrero, o llegó caminando hasta el hongo por el suelo? */
  isStoodOn(body: Phaser.Physics.Arcade.Body): boolean {
    if (!body.blocked.down && !body.touching.down) return false;
    const feetOnMushroom = body.bottom >= this.topY - 2 && body.bottom <= this.zone.bottom + 1;
    return feetOnMushroom && body.center.x >= this.zone.left && body.center.x <= this.zone.right;
  }

  /** Rebotó: aplasta el sombrero y el de un solo uso se desinfla. */
  bounced(): void {
    this.motor.bounced();
    if (this.motor.state === 'deflated') this.applyState('deflated');
    else this.squash();
  }

  /** Tajo sobre el hongo; true si despertó al dormido. */
  strike(charged: boolean): boolean {
    if (!this.motor.struck(charged)) return false;
    this.applyState('ready');
    return true;
  }

  update(deltaMs: number): void {
    const before = this.motor.state;
    const state = this.motor.step(deltaMs);
    if (state !== before) this.applyState(state);
  }

  reset(): void {
    this.motor.reset();
    this.applyState(this.motor.state);
  }

  /** Dibujo de cada estado: desinflado (chato y opaco), dormido (apagado) o listo. */
  private applyState(state: BouncerState): void {
    const scene = this.cap.scene;
    scene.tweens.killTweensOf([this.cap, this.spots]);
    if (state === 'deflated') {
      this.cap.setFillStyle(VARIANTS.deflatedColor);
      this.spots.setAlpha(0.4);
      scene.tweens.add({ targets: [this.cap, this.spots], scaleY: 0.35, duration: CFG.squashMs, ease: 'Quad.easeOut' });
      return;
    }
    this.cap.setFillStyle(state === 'asleep' ? VARIANTS.asleepColor : CAP_COLOR);
    this.spots.setAlpha(state === 'asleep' ? 0.5 : 1);
    // Se infla de vuelta (o despierta) con un pequeño salto del sombrero.
    scene.tweens.add({ targets: [this.cap, this.spots], scaleY: 1, duration: CFG.squashMs * 2, ease: 'Back.easeOut' });
  }

  /** Aplastamiento del sombrero al rebotar. */
  squash(): void {
    const scene = this.cap.scene;
    scene.tweens.killTweensOf([this.cap, this.spots]);
    this.cap.setScale(1, 1);
    scene.tweens.add({ targets: [this.cap, this.spots], scaleY: 0.5, duration: CFG.squashMs / 2, yoyo: true, ease: 'Quad.easeOut' });
    this.stem.setScale(1, 0.8);
    scene.tweens.add({ targets: this.stem, scaleY: 1, duration: CFG.squashMs, ease: 'Back.easeOut' });
  }
}
