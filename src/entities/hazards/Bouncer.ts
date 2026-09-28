import Phaser from 'phaser';
import { GAMEPLAY } from '../../config/gameplay';

const CFG = GAMEPLAY.jungle;
const CAP_COLOR = 0xd0643a;
const SPOT_COLOR = 0xf2eee3;
const STEM_COLOR = 0xe6d8b8;

// Hongo que rebota (GDD §6.5): sombrero de un solo sentido; al pisarlo lanza a Kerana hacia arriba.
export class Bouncer {
  readonly cap: Phaser.GameObjects.Rectangle;
  private readonly stem: Phaser.GameObjects.Rectangle;
  private readonly spots: Phaser.GameObjects.Rectangle;
  private readonly topY: number;

  constructor(
    scene: Phaser.Scene,
    readonly zone: Phaser.Geom.Rectangle,
  ) {
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
  }

  /** ¿El cuerpo está apoyado en el sombrero, o llegó caminando hasta el hongo por el suelo? */
  isStoodOn(body: Phaser.Physics.Arcade.Body): boolean {
    if (!body.blocked.down && !body.touching.down) return false;
    const feetOnMushroom = body.bottom >= this.topY - 2 && body.bottom <= this.zone.bottom + 1;
    return feetOnMushroom && body.center.x >= this.zone.left && body.center.x <= this.zone.right;
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
