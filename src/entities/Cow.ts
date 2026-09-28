import Phaser from 'phaser';
import { GAMEPLAY } from '../config/gameplay';

const CFG = GAMEPLAY.cow;
const TEXTURE = 'vaca_placeholder';

/** Vaca overa (placeholder por código): cuerpo blanco con manchas, cabeza a la derecha. */
function ensureTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists(TEXTURE)) return;
  const w = CFG.width;
  const h = CFG.height;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  g.fillStyle(0xf2eee3).fillRect(2, 3, w - 9, h - 8); // lomo
  g.fillStyle(0x3e2a1c).fillRect(6, 4, 6, 4).fillRect(15, 7, 5, 4); // manchas
  g.fillStyle(0xf2eee3).fillRect(w - 9, 1, 8, 7); // cabeza
  g.fillStyle(0xe8a0a0).fillRect(w - 4, 5, 3, 3); // hocico
  g.fillStyle(0xd9c9a3).fillRect(w - 9, 0, 1, 2).fillRect(w - 3, 0, 1, 2); // cuernos
  g.fillStyle(0x1b1a2e).fillRect(w - 6, 3, 1, 1); // ojo
  g.fillStyle(0xd9d2c0).fillRect(4, h - 5, 3, 5).fillRect(w - 13, h - 5, 3, 5); // patas
  g.generateTexture(TEXTURE, w, h);
  g.destroy();
}

// Vaca suelta de Capiatá: camina despacio de un lado a otro, muge de vez en cuando, no hace daño
// y se puede usar de plataforma (se salta sobre su lomo).
export class Cow extends Phaser.Physics.Arcade.Image {
  declare body: Phaser.Physics.Arcade.Body;
  private facing: 1 | -1;
  private pauseMs = 0;
  private mooMs: number;
  private readonly minX: number;
  private readonly maxX: number;

  constructor(
    scene: Phaser.Scene,
    x: number,
    feetY: number,
    facing: 1 | -1,
    private readonly onMoo: (cow: Cow) => void,
  ) {
    ensureTexture(scene);
    super(scene, x, feetY, TEXTURE);
    this.facing = facing;
    this.minX = x - CFG.patrolDistance;
    this.maxX = x + CFG.patrolDistance;
    this.mooMs = Phaser.Math.Between(CFG.mooMinMs, CFG.mooMaxMs);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setOrigin(0.5, 1).setDepth(4);
    this.body.setSize(CFG.width, CFG.height - 4).setOffset(0, 4);
    this.body.setAllowGravity(false).setImmovable(true);
    // Solo se choca desde arriba: es una plataforma que camina (lleva a quien está encima).
    this.body.checkCollision.down = false;
    this.body.checkCollision.left = false;
    this.body.checkCollision.right = false;
  }

  tick(deltaMs: number): void {
    this.mooMs -= deltaMs;
    if (this.mooMs <= 0) {
      this.mooMs = Phaser.Math.Between(CFG.mooMinMs, CFG.mooMaxMs);
      this.onMoo(this);
    }
    if (this.pauseMs > 0) {
      this.pauseMs -= deltaMs;
      this.body.setVelocityX(0);
      return;
    }
    if ((this.facing > 0 && this.x >= this.maxX) || (this.facing < 0 && this.x <= this.minX)) {
      this.facing = this.facing > 0 ? -1 : 1;
      this.pauseMs = CFG.turnPauseMs;
      this.body.setVelocityX(0);
    } else {
      this.body.setVelocityX(this.facing * CFG.speed);
    }
    this.setFlipX(this.facing < 0);
  }
}
