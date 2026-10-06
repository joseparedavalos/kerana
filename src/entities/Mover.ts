import Phaser from 'phaser';
import { GAMEPLAY } from '../config/gameplay';
import { isRiding, MoverMotor, type MoverDelta, type MoverSpec } from './MoverMotor';
import type { SwitchTarget } from './SwitchMotor';

const CFG = GAMEPLAY.mover;

/**
 * Mueve un objeto con cuerpo Arcade "cinemático" (sin velocidad propia, `moves = false`) a (x, y).
 * `prev` queda en la posición anterior: Arcade calcula el solapamiento máximo con el desplazamiento del frame.
 */
export function placeKinematic(go: Phaser.GameObjects.Components.Transform, body: Phaser.Physics.Arcade.Body, x: number, y: number): void {
  body.prev.set(body.position.x, body.position.y);
  go.x = x;
  go.y = y;
}

/** Cuerpos que viajan sobre la cara de arriba `top` (entre `left` y `right`): se miden antes de mover. */
export function collectRiders(
  bodies: readonly Phaser.Physics.Arcade.Body[],
  top: number,
  left: number,
  right: number,
  out: Phaser.Physics.Arcade.Body[],
): Phaser.Physics.Arcade.Body[] {
  out.length = 0;
  for (const b of bodies) {
    if (!b.enable) continue;
    const grounded = b.blocked.down || b.touching.down;
    if (isRiding({ left: b.left, right: b.right, bottom: b.bottom, vy: b.velocity.y, grounded }, top, left, right, CFG.rideTolerancePx)) out.push(b);
  }
  return out;
}

/** Lleva a los que viajan encima: mismo desplazamiento que la plataforma (en x y en y). */
export function carryRiders(riders: readonly Phaser.Physics.Arcade.Body[], d: MoverDelta): void {
  if (d.dx === 0 && d.dy === 0) return;
  for (const b of riders) {
    const go = b.gameObject as unknown as Phaser.GameObjects.Components.Transform;
    go.x += d.dx;
    go.y += d.dy;
  }
}

// Plataforma móvil (S18): va y viene entre dos puntos, sólida o de un solo sentido, y lleva
// a Kerana y a los enemigos que estén encima. Un Switch puede arrancarla o cambiarla de extremo.
export class Mover implements SwitchTarget {
  readonly motor: MoverMotor;
  readonly block: Phaser.GameObjects.Rectangle;
  readonly body: Phaser.Physics.Arcade.Body;
  private readonly riders: Phaser.Physics.Arcade.Body[] = [];

  /**
   * `zone`: el lugar que ocupa en el origen (px). Una de un solo sentido es una franja de `thickness`
   * arriba del tile, como el `=`; una sólida ocupa la zona entera.
   */
  constructor(
    scene: Phaser.Scene,
    readonly zone: Phaser.Geom.Rectangle,
    spec: MoverSpec,
    readonly solid: boolean,
  ) {
    this.motor = new MoverMotor(spec);
    const h = solid ? zone.height : CFG.thickness;
    this.block = scene.add.rectangle(zone.x, zone.y, zone.width, h, CFG.color).setOrigin(0, 0).setDepth(3);
    this.block.setStrokeStyle(1, CFG.edgeColor);
    scene.physics.add.existing(this.block);
    this.body = this.block.body as Phaser.Physics.Arcade.Body;
    this.body.setAllowGravity(false).setImmovable(true);
    // La mueve el código (sin velocidad): Arcade no la empuja ni la integra.
    this.body.moves = false;
    if (!solid) {
      this.body.checkCollision.down = false;
      this.body.checkCollision.left = false;
      this.body.checkCollision.right = false;
    }
    this.place();
  }

  setPowered(on: boolean): void {
    this.motor.setPowered(on);
  }

  /** Avanza, se mueve y lleva a los cuerpos de `bodies` que viajan encima. */
  update(deltaMs: number, bodies: readonly Phaser.Physics.Arcade.Body[]): void {
    collectRiders(bodies, this.body.top, this.body.left, this.body.right, this.riders);
    const d = this.motor.step(deltaMs);
    if (d.dx === 0 && d.dy === 0) return;
    this.place();
    carryRiders(this.riders, d);
  }

  /** Vuelve al origen (al reentrar al nivel se crea de nuevo; esto sirve si se reinicia en el lugar). */
  reset(): void {
    this.motor.reset();
    this.place();
  }

  private place(): void {
    placeKinematic(this.block, this.body, this.zone.x + this.motor.offsetX, this.zone.y + this.motor.offsetY);
  }
}
