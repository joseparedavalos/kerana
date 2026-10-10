import Phaser from 'phaser';
import { GAMEPLAY } from '../config/gameplay';
import { skinIfAvailable } from '../systems/SpriteSkin';
import { carryRiders, collectRiders, placeKinematic } from './Mover';
import { MoverMotor } from './MoverMotor';

const LOOK = GAMEPLAY.cow;
const TEXTURE = 'vaca_placeholder';

/** Lo que cambia de una vaca a otra: la común (`GAMEPLAY.cow`) o la vaca guasu (`GAMEPLAY.bigCow`, S27). */
export interface CowConfig {
  speed: number;
  patrolDistance: number;
  turnPauseMs: number;
  mooMinMs: number;
  mooMaxMs: number;
  /** Tamaño respecto de la vaca común (dibujo y cuerpo); 1 si falta. */
  scale?: number;
}

/** Vaca overa (placeholder por código): cuerpo blanco con manchas, cabeza a la derecha. */
function ensureTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists(TEXTURE)) return;
  const w = LOOK.width;
  const h = LOOK.height;
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
// y se puede usar de plataforma (se salta sobre su lomo). Desde S18 la patrulla es un `MoverMotor`
// (ida y vuelta de ± `patrolDistance` que empieza en el medio, con pausa en cada punta) y lleva a
// quien está encima con el mismo código que las plataformas móviles. La vaca guasu (S27) es la misma
// vaca en grande: escala el dibujo y el cuerpo, con su velocidad, patrulla y mugido.
export class Cow extends Phaser.Physics.Arcade.Image {
  declare body: Phaser.Physics.Arcade.Body;
  readonly motor: MoverMotor;
  private mooMs: number;
  private readonly patrolOriginX: number;
  private readonly riders: Phaser.Physics.Arcade.Body[] = [];

  constructor(
    scene: Phaser.Scene,
    x: number,
    feetY: number,
    facing: 1 | -1,
    private readonly onMoo: (cow: Cow) => void,
    private readonly cfg: CowConfig = GAMEPLAY.cow,
  ) {
    ensureTexture(scene);
    super(scene, x, feetY, TEXTURE);
    this.patrolOriginX = x - cfg.patrolDistance;
    this.motor = new MoverMotor({
      dx: cfg.patrolDistance * 2,
      dy: 0,
      speed: cfg.speed,
      waitMs: cfg.turnPauseMs,
      startPos: cfg.patrolDistance,
      startDir: facing,
    });
    this.mooMs = Phaser.Math.Between(cfg.mooMinMs, cfg.mooMaxMs);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setOrigin(0.5, 1).setDepth(4);
    this.body.setSize(LOOK.width, LOOK.height - 4).setOffset(0, 4);
    // El cuerpo de Arcade escala con la imagen: el lomo queda `(height − 4) × scale` sobre los pies.
    if (cfg.scale) this.setScale(cfg.scale);
    Cow.setupBody(this.body);
    // Sprite real (S13c): el placeholder mira a la derecha sin voltear; quieta, el cuadro 0.
    skinIfAvailable(scene, this, 'vaca', { anim: 'vaca_walk', sourceFacesRight: true, stillFrame: true });
  }

  /** Plataforma que camina: sin gravedad, la mueve el código y solo se choca desde arriba. */
  static setupBody(body: Phaser.Physics.Arcade.Body): void {
    body.setAllowGravity(false).setImmovable(true);
    body.moves = false;
    body.checkCollision.down = false;
    body.checkCollision.left = false;
    body.checkCollision.right = false;
  }

  /** Avanza la patrulla y lleva a los cuerpos de `bodies` que están sobre el lomo. */
  tick(deltaMs: number, bodies: readonly Phaser.Physics.Arcade.Body[]): void {
    this.mooMs -= deltaMs;
    if (this.mooMs <= 0) {
      this.mooMs = Phaser.Math.Between(this.cfg.mooMinMs, this.cfg.mooMaxMs);
      this.onMoo(this);
    }
    collectRiders(bodies, this.body.top, this.body.left, this.body.right, this.riders);
    const d = this.motor.step(deltaMs);
    // Mira hacia donde va (en la pausa de cada punta ya mira para el otro lado, como antes).
    this.setFlipX(this.motor.dir < 0);
    if (d.dx === 0) return;
    placeKinematic(this, this.body, this.patrolOriginX + this.motor.offsetX, this.y);
    carryRiders(this.riders, d);
  }
}
