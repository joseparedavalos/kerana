import Phaser from 'phaser';
import { artOrPlaceholder } from '../../assets/art';
import type { ArtKey } from '../../assets/manifest';
import { ensurePlaceholder } from '../../utils/placeholder';

export type PickupKind = 'guavira' | 'luz_arasy' | 'pluma' | 'yvoty';

const SIZE = 12;
/** Íconos de raw/hud por tipo; lo que no tiene arte (yvoty) sigue con su placeholder. */
const ART: Partial<Record<PickupKind, ArtKey>> = { guavira: 'ui_guavira', luz_arasy: 'ui_luz_arasy', pluma: 'ui_feather' };

// Objeto recogible del mapa (GDD §4.3): guavirá, Luz de Arasy o pluma de mainumby.
export class Pickup extends Phaser.Physics.Arcade.Sprite {
  declare body: Phaser.Physics.Arcade.Body;
  readonly kind: PickupKind;
  /** Plumas: índice estable dentro del nivel (0–2, orden de aparición en el ASCII); -1 en lo demás. */
  readonly index: number;
  /** Pies (y) en reposo: el vaivén sube 4 desde acá. */
  private restY: number;

  constructor(scene: Phaser.Scene, x: number, y: number, kind: PickupKind, index = -1) {
    const placeholder = `pickup_${kind}`;
    const art = ART[kind];
    const look = art ? artOrPlaceholder(scene, art, placeholder, SIZE, SIZE) : { key: placeholder, scale: 1 };
    if (!art) ensurePlaceholder(scene, placeholder, SIZE, SIZE);
    super(scene, x, y, look.key);
    this.kind = kind;
    this.index = index;
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setOrigin(0.5, 1).setScale(look.scale);
    this.body.setAllowGravity(false);
    // El cuerpo se mide en píxeles de la textura: con arte (detail 2) se pide el doble para que mida SIZE unidades.
    this.body.setSize(SIZE / look.scale, SIZE / look.scale);
    this.restY = y;
    this.bob();
  }

  get baseY(): number {
    return this.restY;
  }

  private bob(): void {
    this.scene.tweens.add({ targets: this, y: this.restY - 4, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  /** Cae hasta `y` (S22: se rompió lo que lo sostenía) y sigue flotando ahí. */
  dropTo(y: number, speed: number): void {
    if (y <= this.restY) return;
    this.scene.tweens.killTweensOf(this);
    const ms = ((y - this.y) / speed) * 1000;
    this.restY = y;
    this.scene.tweens.add({ targets: this, y, duration: Math.max(1, ms), ease: 'Quad.easeIn', onComplete: () => this.active && this.bob() });
  }

  /** Desaparece con un pequeño destello al recogerse. */
  collect(): void {
    this.body.enable = false;
    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      scale: this.scale * 1.6,
      duration: 200,
      onComplete: () => this.destroy(),
    });
  }
}
