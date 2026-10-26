import Phaser from 'phaser';
import { hasArt } from '../assets/art';
import { GAMEPLAY } from '../config/gameplay';
import type { SwitchTarget } from './SwitchMotor';

const CFG = GAMEPLAY.gate;
const BAR_W = 2;
const BAR_GAP = 5;
/** S58: arte de la reja en tres partes (raw/piezas/reja.jpg): arriba y abajo con su travesaño, y los barrotes solos. */
const ART_TOP = 'piece_gate_top';
const ART_MID = 'piece_gate_mid';
const ART_BOTTOM = 'piece_gate_bottom';

// Reja (S18): pared de barrotes que un Switch abre (se recogen hacia arriba y dejan pasar) y cierra.
// La luz de la onda pasa entre los barrotes (no es terreno). No se cierra sobre Kerana:
// espera a que salga.
export class Gate implements SwitchTarget {
  readonly bars: Phaser.GameObjects.Container;
  readonly block: Phaser.GameObjects.Zone;
  private readonly body: Phaser.Physics.Arcade.StaticBody;
  private open = false;
  /** Cerrarse está pendiente hasta que no haya nadie adentro. */
  private closePending = false;

  constructor(
    scene: Phaser.Scene,
    readonly zone: Phaser.Geom.Rectangle,
  ) {
    this.bars = scene.add.container(zone.x, zone.y).setDepth(3);
    if (hasArt(scene, ART_TOP) && hasArt(scene, ART_MID) && hasArt(scene, ART_BOTTOM)) this.drawArt(scene, zone);
    else {
      const g = scene.add.graphics();
      g.fillStyle(CFG.color);
      for (let x = 1; x + BAR_W <= zone.width; x += BAR_W + BAR_GAP) g.fillRect(x, 0, BAR_W, zone.height);
      g.fillRect(0, 0, zone.width, 2).fillRect(0, zone.height / 2 - 1, zone.width, 2);
      this.bars.add(g);
    }
    this.block = scene.add.zone(zone.x, zone.y, zone.width, zone.height).setOrigin(0, 0);
    scene.physics.add.existing(this.block, true);
    this.body = this.block.body as Phaser.Physics.Arcade.StaticBody;
  }

  /**
   * Los extremos (travesaño y cuerda) a su tamaño; los barrotes del medio se estiran a lo alto que falte. La veta de
   * la madera es vertical: estirada, solo se alarga; repetida, dejaría una costura horizontal cada pocos píxeles.
   */
  private drawArt(scene: Phaser.Scene, zone: Phaser.Geom.Rectangle): void {
    const top = scene.add.image(0, 0, ART_TOP).setOrigin(0, 0);
    const bottom = scene.add.image(0, zone.height, ART_BOTTOM).setOrigin(0, 1);
    const sx = zone.width / top.width;
    top.setScale(sx);
    bottom.setScale(sx);
    const midH = Math.max(0, zone.height - top.displayHeight - bottom.displayHeight);
    const mid = scene.add.image(0, top.displayHeight, ART_MID).setOrigin(0, 0).setDisplaySize(zone.width, midH);
    this.bars.add([mid, top, bottom]);
  }

  get isOpen(): boolean {
    return this.open;
  }

  setPowered(on: boolean): void {
    if (on) {
      this.closePending = false;
      if (this.open) return;
      this.open = true;
      this.body.enable = false;
      this.slide(CFG.openScale);
    } else if (this.open) {
      this.closePending = true;
    }
  }

  /** Cierra cuando ya no hay nadie dentro de la reja. */
  update(blockers: readonly Phaser.Geom.Rectangle[]): void {
    if (!this.closePending) return;
    for (const r of blockers) if (Phaser.Geom.Rectangle.Overlaps(r, this.zone)) return;
    this.closePending = false;
    this.open = false;
    this.body.enable = true;
    this.slide(1);
  }

  /** Los barrotes se recogen hacia arriba (escala vertical desde el borde de arriba). */
  private slide(scaleY: number): void {
    const scene = this.bars.scene;
    scene.tweens.killTweensOf(this.bars);
    scene.tweens.add({ targets: this.bars, scaleY, duration: CFG.moveMs, ease: 'Quad.easeInOut' });
  }
}
