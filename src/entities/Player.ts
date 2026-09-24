import Phaser from 'phaser';
import { GAMEPLAY } from '../config/gameplay';
import { PLAYER_PLACEHOLDER_KEY } from '../assets/manifest';
import type { InputManager } from '../systems/InputManager';
import { PlayerMotor, type MotorBody, type MoveInput } from './PlayerMotor';

// Kerana: sprite con física; el movimiento lo decide PlayerMotor (lógica pura).
export class Player extends Phaser.Physics.Arcade.Sprite {
  readonly motor = new PlayerMotor();
  declare body: Phaser.Physics.Arcade.Body;

  private readonly moveInput: MoveInput = { left: false, right: false, jumpPressed: false, jumpHeld: false };
  private readonly motorBody: MotorBody = { onGround: false, vx: 0, vy: 0 };

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
  }

  tick(deltaMs: number, input: InputManager): void {
    const mi = this.moveInput;
    mi.left = input.isDown('left');
    mi.right = input.isDown('right');
    mi.jumpPressed = input.justPressed('jump');
    mi.jumpHeld = input.isDown('jump');

    const b = this.motorBody;
    b.onGround = this.body.blocked.down || this.body.touching.down;
    b.vx = this.body.velocity.x;
    b.vy = this.body.velocity.y;

    const out = this.motor.step(deltaMs, mi, b);
    this.body.setVelocity(out.vx, out.vy);
    this.setFlipX(this.motor.facing < 0);
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
}
