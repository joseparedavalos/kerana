import Phaser from 'phaser';
import { GAMEPLAY } from '../../config/gameplay';
import { CrumbleMotor, type CrumbleState } from './CrumbleMotor';

const CFG = GAMEPLAY.jungle;
const BRANCH_COLOR = 0x7a5a3a;
const CRACK_COLOR = 0xc9a67a;

// Rama que se quiebra (GDD §6.5): plataforma de un solo sentido que cruje y cae 0,6 s después de pisarla.
export class Crumble {
  readonly motor = new CrumbleMotor(CFG);
  readonly branch: Phaser.GameObjects.Rectangle;
  private readonly body: Phaser.Physics.Arcade.StaticBody;
  private readonly topY: number;
  private shakeMs = 0;

  constructor(
    scene: Phaser.Scene,
    readonly zone: Phaser.Geom.Rectangle,
    private readonly onChange?: (state: CrumbleState) => void,
  ) {
    this.topY = zone.top;
    this.branch = scene.add.rectangle(zone.x, this.topY, zone.width, CFG.branchHeight, BRANCH_COLOR).setOrigin(0, 0).setDepth(2);
    scene.physics.add.existing(this.branch, true);
    this.body = this.branch.body as Phaser.Physics.Arcade.StaticBody;
    // Un solo sentido: solo sostiene desde arriba.
    this.body.checkCollision.down = false;
    this.body.checkCollision.left = false;
    this.body.checkCollision.right = false;
  }

  /** ¿Kerana está parada encima? */
  isStoodOn(body: Phaser.Physics.Arcade.Body): boolean {
    if (!this.motor.solid || (!body.blocked.down && !body.touching.down)) return false;
    return Math.abs(body.bottom - this.topY) <= 2 && body.right > this.zone.left && body.left < this.zone.right;
  }

  update(deltaMs: number, stoodOn: boolean): void {
    const before = this.motor.state;
    const state = this.motor.step(deltaMs, stoodOn);
    if (state === 'cracking') {
      // Aviso: tiembla y se aclara donde se va a partir.
      this.shakeMs += deltaMs;
      this.branch.x = this.zone.x + Math.sin(this.shakeMs / 25) * CFG.crumbleShakePx;
    }
    if (state === before) return;
    this.applyState(state);
    this.onChange?.(state);
  }

  reset(): void {
    this.motor.reset();
    this.applyState('solid');
  }

  private applyState(state: CrumbleState): void {
    this.shakeMs = 0;
    const scene = this.branch.scene;
    scene.tweens.killTweensOf(this.branch);
    this.branch.x = this.zone.x;
    if (state === 'cracking') {
      this.branch.setFillStyle(CRACK_COLOR);
    } else if (state === 'fallen') {
      this.body.enable = false;
      // Solo cae el dibujo; el cuerpo estático queda desactivado en su lugar.
      scene.tweens.add({ targets: this.branch, y: this.topY + CFG.crumbleFallPx, alpha: 0, angle: 8, duration: 350, ease: 'Quad.easeIn' });
    } else {
      this.body.enable = true;
      this.branch.setFillStyle(BRANCH_COLOR).setAngle(0).setY(this.topY).setAlpha(0);
      scene.tweens.add({ targets: this.branch, alpha: 1, duration: 250 });
    }
  }
}
