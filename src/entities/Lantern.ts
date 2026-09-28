import Phaser from 'phaser';
import { GAMEPLAY } from '../config/gameplay';
import type { Darkness, LevelLight } from '../systems/Darkness';

const CFG = GAMEPLAY.lantern;
const POST_COLOR = 0x2a2a36;
const GLASS_OFF = 0x3a3a48;
const GLASS_ON = 0xf2d77e;

// Farol de las calles de Asunción (GDD §6.7): poste por código; se enciende al tocarlo y alumbra.
// Luisón lo puede apagar con su aullido (fase 2); Kerana lo vuelve a encender tocándolo.
export class Lantern {
  readonly zone: Phaser.Geom.Rectangle;
  private readonly glass: Phaser.GameObjects.Rectangle;
  private readonly glow: Phaser.GameObjects.Arc;
  private readonly light: LevelLight;
  lit = false;

  constructor(
    scene: Phaser.Scene,
    x: number,
    feetY: number,
    private readonly darkness: Darkness,
    lit = false,
  ) {
    const h = CFG.postHeight;
    scene.add.rectangle(x, feetY, 3, h, POST_COLOR).setOrigin(0.5, 1).setDepth(1);
    this.glass = scene.add.rectangle(x, feetY - h, 8, 9, GLASS_OFF).setOrigin(0.5, 1).setDepth(2).setStrokeStyle(1, POST_COLOR);
    this.glow = darkness.glow(scene.add.circle(x, feetY - h - 4, 3, GLASS_ON).setDepth(3).setVisible(false));
    this.light = darkness.addLight(x, feetY - h - 4, CFG.radius, CFG.color, CFG.intensity, false);
    this.zone = new Phaser.Geom.Rectangle(x - CFG.touchWidth / 2, feetY - CFG.touchHeight, CFG.touchWidth, CFG.touchHeight);
    this.setLit(lit);
  }

  setLit(on: boolean): void {
    this.lit = on;
    this.darkness.setOn(this.light, on);
    this.glow.setVisible(on);
    this.glass.setFillStyle(on ? GLASS_ON : GLASS_OFF);
    if (on) this.darkness.glow(this.glass);
    else this.darkness.unglow(this.glass);
  }
}
