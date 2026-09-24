import Phaser from 'phaser';
import { ensurePlaceholder } from '../../utils/placeholder';

export type PickupKind = 'guavira' | 'luz_arasy' | 'pluma';

const SIZE = 12;

// Objeto recogible del mapa (GDD §4.3): guavirá, Luz de Arasy o pluma de mainumby.
export class Pickup extends Phaser.Physics.Arcade.Sprite {
  declare body: Phaser.Physics.Arcade.Body;
  readonly kind: PickupKind;

  constructor(scene: Phaser.Scene, x: number, y: number, kind: PickupKind) {
    const key = `pickup_${kind}`;
    ensurePlaceholder(scene, key, SIZE, SIZE);
    super(scene, x, y, key);
    this.kind = kind;
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setOrigin(0.5, 1);
    this.body.setAllowGravity(false);
    this.body.setSize(SIZE, SIZE);
    scene.tweens.add({ targets: this, y: y - 4, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  /** Desaparece con un pequeño destello al recogerse. */
  collect(): void {
    this.body.enable = false;
    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      scale: 1.6,
      duration: 200,
      onComplete: () => this.destroy(),
    });
  }
}
