import Phaser from 'phaser';
import { TILE_SIZE } from '../assets/manifest';
import { ArenaGate } from './ArenaGate';

const WALL_COLOR = 0x4a3b2e;
/** Margen (px) que Kerana tiene que entrar en la arena antes de que se cierre. */
const ENTER_MARGIN = TILE_SIZE * 2;

// Arena del jefe (GDD §6.0): al entrar, la cámara se fija a la arena y la entrada se cierra con rocas.
export class BossArena {
  private readonly gate: ArenaGate;
  private readonly wall: Phaser.GameObjects.Rectangle;
  private readonly wallBody: Phaser.Physics.Arcade.StaticBody;

  constructor(
    private readonly scene: Phaser.Scene,
    readonly rect: Phaser.Geom.Rectangle,
    floorY: number,
    player: Phaser.GameObjects.GameObject,
  ) {
    this.gate = new ArenaGate(rect, ENTER_MARGIN);
    // La entrada está a la izquierda de la arena (así se dibujan los mapas ASCII).
    const h = floorY - rect.top;
    this.wall = scene.add.rectangle(rect.left, rect.top, TILE_SIZE, h, WALL_COLOR).setOrigin(0, 0).setDepth(9).setVisible(false);
    scene.physics.add.existing(this.wall, true);
    this.wallBody = this.wall.body as Phaser.Physics.Arcade.StaticBody;
    this.wallBody.enable = false;
    scene.physics.add.collider(player, this.wall);
  }

  /** Kerana ya está bien adentro de la arena. */
  shouldLock(playerRect: Phaser.Geom.Rectangle): boolean {
    return this.gate.shouldLock(playerRect);
  }

  get locked(): boolean {
    return this.gate.locked;
  }

  lock(camera: Phaser.Cameras.Scene2D.Camera): void {
    this.gate.lock();
    camera.setBounds(this.rect.x, this.rect.y, this.rect.width, this.rect.height);
    this.wallBody.enable = true;
    this.wall.setVisible(true).setScale(1, 0);
    this.scene.tweens.add({ targets: this.wall, scaleY: 1, duration: 250, ease: 'Back.easeOut' });
  }

  unlock(camera: Phaser.Cameras.Scene2D.Camera, mapWidth: number, mapHeight: number): void {
    this.gate.unlock();
    camera.setBounds(0, 0, mapWidth, mapHeight);
    this.wallBody.enable = false;
    this.wall.setVisible(false);
  }
}
