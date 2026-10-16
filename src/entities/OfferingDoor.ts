import Phaser from 'phaser';
import { artOrPlaceholder, type ArtLook } from '../assets/art';
import { GAMEPLAY } from '../config/gameplay';

const CFG = GAMEPLAY.offering;
const SLOT_PH = 'offering_slot';
const SLOT_EMPTY_PH = 'offering_slot_empty';

// El paso de la ofrenda (S36): una cortina de raíces que cierra la entrada a la antesala, de la fila del techo (o del
// borde de arriba del mapa) al piso, con una tablita de tres huecos a la altura de los ojos de Kerana. Cada hueco muestra
// una chipa si Kerana la lleva. Al llegar con las tres, las chipas vuelan a la tablita y las raíces se recogen hacia
// arriba. No se parece a una reja (no hay piedra que buscar): la tablita dice qué falta.
export class OfferingDoor {
  readonly block: Phaser.GameObjects.Zone;
  private readonly body: Phaser.Physics.Arcade.StaticBody;
  private readonly roots: Phaser.GameObjects.Container;
  private readonly plaque: Phaser.GameObjects.Container;
  private readonly slots: Phaser.GameObjects.Image[] = [];
  private readonly full: ArtLook;
  private readonly empty: ArtLook;
  readonly line: Phaser.GameObjects.Text;

  constructor(
    private readonly scene: Phaser.Scene,
    readonly zone: Phaser.Geom.Rectangle,
    needed: number,
    open: boolean,
    lineStyle: Phaser.Types.GameObjects.Text.TextStyle,
    /** Pies de Kerana frente a la puerta (px): la tablita va a la altura de sus ojos. Por defecto, el pie de la puerta. */
    frontY = zone.bottom,
  ) {
    this.roots = scene.add.container(zone.x, zone.y).setDepth(3);
    this.roots.add(this.drawRoots(zone.width, zone.height));
    this.full = artOrPlaceholder(scene, 'ui_chipa', SLOT_PH, CFG.slotSize, CFG.slotSize);
    this.empty = artOrPlaceholder(scene, 'ui_chipa_empty', SLOT_EMPTY_PH, CFG.slotSize, CFG.slotSize);
    const cx = zone.centerX;
    const py = frontY - CFG.plaqueHeightPx;
    this.plaque = scene.add.container(cx, py).setDepth(4);
    const w = CFG.slotSpacing * needed + 6;
    const board = scene.add.graphics();
    board.fillStyle(CFG.boardEdge).fillRect(-w / 2 - 1, -CFG.slotSize / 2 - 3, w + 2, CFG.slotSize + 6);
    board.fillStyle(CFG.boardColor).fillRect(-w / 2, -CFG.slotSize / 2 - 2, w, CFG.slotSize + 4);
    this.plaque.add(board);
    for (let i = 0; i < needed; i++) {
      const slot = scene.add.image((i - (needed - 1) / 2) * CFG.slotSpacing, 0, this.empty.key);
      slot.setScale(this.empty.scale * this.slotFit(this.empty));
      this.slots.push(slot);
      this.plaque.add(slot);
    }
    this.line = scene.add.text(cx, py - CFG.lineAbovePx, '', lineStyle).setOrigin(0.5, 1).setDepth(20).setVisible(false);
    this.block = scene.add.zone(zone.x, zone.y, zone.width, zone.height).setOrigin(0, 0);
    scene.physics.add.existing(this.block, true);
    this.body = this.block.body as Phaser.Physics.Arcade.StaticBody;
    if (open) this.showOpen();
  }

  /** Lo que se ve de las chipas: llenas las que Kerana lleva. */
  setCarried(carried: number): void {
    this.slots.forEach((slot, i) => this.setSlot(slot, i < carried));
  }

  /** Las chipas salen de Kerana y vuelan a la tablita, una tras otra. */
  playOffering(fromX: number, fromY: number): void {
    this.slots.forEach((slot) => this.setSlot(slot, false));
    this.slots.forEach((slot, i) => {
      const flyer = this.scene.add.image(fromX, fromY, this.full.key).setScale(this.full.scale * this.slotFit(this.full)).setDepth(21);
      this.scene.tweens.add({
        targets: flyer,
        x: this.plaque.x + slot.x,
        y: this.plaque.y + slot.y,
        delay: i * CFG.flyStaggerMs,
        duration: CFG.flyMs,
        ease: 'Quad.easeInOut',
        onComplete: () => {
          flyer.destroy();
          this.setSlot(slot, true);
        },
      });
    });
  }

  /** Fin de la ofrenda: las raíces se recogen hacia arriba y dejan pasar. */
  open(): void {
    this.body.enable = false;
    this.scene.tweens.add({ targets: this.roots, scaleY: CFG.openScale, duration: CFG.retractMs, ease: 'Quad.easeIn' });
    this.scene.tweens.add({ targets: this.plaque, alpha: 0, y: this.plaque.y - CFG.plaqueRisePx, duration: CFG.retractMs, ease: 'Quad.easeIn' });
  }

  /** Para el nivel oscuro: la tablita se lee sin luz. */
  get plaqueParts(): Phaser.GameObjects.GameObject[] {
    return [...this.plaque.list];
  }

  private showOpen(): void {
    this.body.enable = false;
    this.roots.setScale(1, CFG.openScale);
    this.plaque.setVisible(false);
  }

  private setSlot(slot: Phaser.GameObjects.Image, on: boolean): void {
    const look = on ? this.full : this.empty;
    slot.setTexture(look.key).setScale(look.scale * this.slotFit(look));
  }

  /** Escala extra para que el ícono mida `slotSize` en el mundo. */
  private slotFit(look: ArtLook): number {
    const frame = this.scene.textures.getFrame(look.key);
    const w = (frame?.width ?? CFG.slotSize) * look.scale;
    return w > 0 ? CFG.slotSize / w : 1;
  }

  /** Raíces que bajan ondulando, con hojas y raicillas que se clavan en el piso. Un poco más anchas que el paso. */
  private drawRoots(w: number, h: number): Phaser.GameObjects.Graphics {
    const g = this.scene.add.graphics();
    const pad = CFG.rootPadPx;
    const span = w + pad * 2;
    const strands = Math.max(4, Math.round(span / 4));
    for (let k = 0; k < strands; k++) {
      const x0 = ((k + 0.5) * span) / strands - pad;
      const phase = k * 1.7;
      const at = (y: number) => x0 + Math.sin(y / CFG.rootWavePx + phase) * CFG.rootWaveAmp;
      for (let y = 0; y < h; y += 2) {
        g.fillStyle(CFG.rootColor).fillRect(Math.round(at(y)) - 1, y, 3, 2);
        g.fillStyle(CFG.rootLight).fillRect(Math.round(at(y)) - 1, y, 1, 2);
      }
      for (let y = 6 + k * 5; y < h - 8; y += CFG.leafEveryPx) {
        const side = (Math.floor(y / CFG.leafEveryPx) + k) % 2 === 0 ? 1 : -1;
        g.fillStyle(CFG.leafColor).fillRect(Math.round(at(y)) + side * 2, y, 3 * side, 2);
      }
    }
    // Raicillas abiertas al pie.
    g.fillStyle(CFG.rootColor);
    for (let k = 0; k < strands; k++) {
      const x0 = ((k + 0.5) * span) / strands - pad;
      g.fillRect(x0 - 3, h - 2, 6, 2);
    }
    return g;
  }
}
