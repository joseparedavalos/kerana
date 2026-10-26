import Phaser from 'phaser';
import { hasArt } from '../../assets/art';
import { ART_DETAIL, type ArtKey } from '../../assets/manifest';
import { GAMEPLAY } from '../../config/gameplay';
import { SinkingMotor, type SinkingState } from './SinkingMotor';

const CFG = GAMEPLAY.water;
const RAFT_COLOR = 0x4e8c3a;
const FLOWER_COLOR = 0xb58fd1;
/**
 * S58: arte de raw/piezas/balsa.jpg a los dos anchos de los mapas (32 y 48 unidades) y la fila de arte donde empieza
 * la superficie de hojas (encima solo asoman las flores): esa fila va en el borde de arriba del cuerpo.
 */
const ART: readonly { key: ArtKey; width: number; surfaceRow: number }[] = [
  { key: 'piece_raft_32', width: 32, surfaceRow: 1 },
  { key: 'piece_raft_48', width: 48, surfaceRow: 2 },
];

// Camalote (GDD §6.2): plataforma flotante de un solo sentido que se hunde al pisarla.
export class Sinking {
  readonly motor = new SinkingMotor(CFG);
  readonly raft: Phaser.GameObjects.Rectangle;
  private readonly flowers: Phaser.GameObjects.Rectangle;
  /** Con arte: la balsa dibujada; el rectángulo del cuerpo queda invisible. */
  private readonly art?: Phaser.GameObjects.Image;
  private readonly artOffsetY: number = 0;
  private readonly body: Phaser.Physics.Arcade.StaticBody;
  private readonly topY: number;
  private wobbleMs = 0;

  constructor(
    scene: Phaser.Scene,
    readonly zone: Phaser.Geom.Rectangle,
    private readonly onChange?: (state: SinkingState) => void,
  ) {
    this.topY = zone.top;
    this.raft = scene.add.rectangle(zone.x, this.topY, zone.width, CFG.raftHeight, RAFT_COLOR).setOrigin(0, 0).setDepth(2);
    // Flores lilas del camalote (irupé/aguapé): solo decoración.
    this.flowers = scene.add.rectangle(zone.centerX, this.topY - 2, Math.max(4, zone.width / 3), 3, FLOWER_COLOR).setDepth(2);
    // El arte del ancho más parecido, estirado o encogido a lo ancho de la zona; el alto, a su escala.
    const look = ART.filter((a) => hasArt(scene, a.key)).sort((a, b) => Math.abs(a.width - zone.width) - Math.abs(b.width - zone.width))[0];
    if (look) {
      this.artOffsetY = -look.surfaceRow / ART_DETAIL;
      this.art = scene.add.image(zone.x, this.topY + this.artOffsetY, look.key).setOrigin(0, 0).setDepth(2);
      this.art.setScale(zone.width / this.art.width, 1 / ART_DETAIL);
      this.raft.setAlpha(0);
      this.flowers.setVisible(false);
    }
    scene.physics.add.existing(this.raft, true);
    this.body = this.raft.body as Phaser.Physics.Arcade.StaticBody;
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
    if (state === 'sinking') {
      // Aviso: tiembla y baja un poco.
      this.wobbleMs += deltaMs;
      this.setVisualY(this.topY + Math.sin(this.wobbleMs / 40) * 1 + 1);
    }
    if (state === before) return;
    this.applyState(state);
    this.onChange?.(state);
  }

  reset(): void {
    this.motor.reset();
    this.applyState('floating');
  }

  private applyState(state: SinkingState): void {
    this.wobbleMs = 0;
    const scene = this.raft.scene;
    scene.tweens.killTweensOf([this.raft, this.flowers, ...(this.art ? [this.art] : [])]);
    if (state === 'sunk') {
      this.body.enable = false;
      scene.tweens.add({ targets: [this.raft, this.flowers, ...(this.art ? [this.art] : [])], alpha: 0, duration: 200 });
      this.setVisualY(this.topY + CFG.sinkDepthPx);
    } else if (state === 'floating') {
      this.body.enable = true;
      this.setVisualY(this.topY);
      this.raft.setAlpha(this.art ? 0 : 1);
      this.flowers.setAlpha(1);
      this.art?.setAlpha(1);
    }
  }

  /** Mueve solo el dibujo; el cuerpo estático queda en su lugar. */
  private setVisualY(y: number): void {
    this.raft.y = y;
    this.flowers.y = y - 2;
    if (this.art) this.art.y = y + this.artOffsetY;
  }
}
