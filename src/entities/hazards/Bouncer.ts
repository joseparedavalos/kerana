import Phaser from 'phaser';
import { hasArt } from '../../assets/art';
import { ART_DETAIL } from '../../assets/manifest';
import { GAMEPLAY } from '../../config/gameplay';
import { BouncerMotor, type BouncerKind, type BouncerState } from './BouncerMotor';

const CFG = GAMEPLAY.jungle;
const VARIANTS = GAMEPLAY.bouncerVariants;
const CAP = 0xc44830;
const CAP_LIGHT = 0xe87848;
const CAP_DARK = 0x6e2420;
const SPOT = 0xf6e4be;
const STEM = 0xe8d0a8;
const STEM_DARK = 0xa07854;
/** S32: en la ciudad (l7) el hongo es un toldo o una lona de mercado: tela a rayas sobre un parante de madera. */
const AWNING_COLOR = 0xa8443a;
const AWNING_STRIPE = 0xe8dcc0;
const POLE_COLOR = 0x5a4632;
/** S58: arte del hongo (raw/piezas/hongo.jpg, un hongo por tile; mide `mushroomHeight` con el tallo acortado). */
const ART = 'piece_mushroom';

/** Cómo se dibuja: hongo (por defecto) o toldo (bioma ciudad). */
export type BouncerLook = 'mushroom' | 'awning';

type PieceRole = 'cap' | 'light' | 'stem' | 'spot';

// Hongo que rebota (GDD §6.5): sombrero de un solo sentido; al pisarlo lanza a Kerana hacia arriba.
// Variantes (S18, `kind`): de un solo uso (`once`: se desinfla y vuelve) y dormido (`sleep`: lo despierta el tajo cargado).
export class Bouncer {
  readonly motor: BouncerMotor;
  readonly cap: Phaser.GameObjects.Rectangle;
  private readonly stem: Phaser.GameObjects.Rectangle;
  private readonly spots: Phaser.GameObjects.Rectangle;
  private readonly art: Phaser.GameObjects.Container;
  private readonly pieces: Phaser.GameObjects.Rectangle[] = [];
  /** S58: con arte, un sprite por tile en vez de las piezas por código. */
  private readonly sprites: Phaser.GameObjects.Image[] = [];
  private readonly topY: number;

  constructor(
    scene: Phaser.Scene,
    readonly zone: Phaser.Geom.Rectangle,
    kind: BouncerKind = 'normal',
    private readonly look: BouncerLook = 'mushroom',
  ) {
    this.motor = new BouncerMotor(kind, VARIANTS.onceRespawnMs);
    // El sombrero ocupa la parte de arriba del tile; el tallo llega al suelo.
    this.topY = zone.bottom - CFG.mushroomHeight;
    const awning = look === 'awning';
    this.art = scene.add.container(0, zone.bottom).setDepth(2);
    if (awning) {
      const stemW = 2;
      this.stem = scene.add.rectangle(zone.centerX, 0, stemW, CFG.mushroomHeight, POLE_COLOR).setOrigin(0.5, 1);
      this.cap = scene.add.rectangle(zone.x, this.topY, zone.width, CFG.mushroomHeight / 2, AWNING_COLOR).setOrigin(0, 0).setDepth(2);
      this.spots = scene.add.rectangle(zone.centerX, this.topY + CFG.mushroomHeight / 2, zone.width, 2, AWNING_STRIPE).setDepth(2);
      this.art.add([this.stem]);
    } else {
      this.drawMushrooms(scene, zone);
      // El cuerpo del rebote no se ve: el dibujo es el hongo. El tamaño y el lugar no cambian.
      this.cap = scene.add.rectangle(zone.x, this.topY, zone.width, CFG.mushroomHeight / 2, CAP).setOrigin(0, 0).setDepth(2).setAlpha(0);
      this.stem = scene.add.rectangle(0, 0, 1, 1, STEM).setVisible(false);
      this.spots = scene.add.rectangle(0, 0, 1, 1, SPOT).setVisible(false);
    }
    scene.physics.add.existing(this.cap, true);
    const body = this.cap.body as Phaser.Physics.Arcade.StaticBody;
    body.checkCollision.down = false;
    body.checkCollision.left = false;
    body.checkCollision.right = false;
    this.applyState(this.motor.state);
  }

  /** Un hongo por tile: sombrero en cúpula, manchas y tallo. El rebote sigue siendo el de toda la zona. */
  private drawMushrooms(scene: Phaser.Scene, zone: Phaser.Geom.Rectangle): void {
    const tiles = Math.max(1, Math.round(zone.width / 16));
    const tileW = zone.width / tiles;
    const s = tileW / 16;
    const withArt = hasArt(scene, ART);
    for (let i = 0; i < tiles; i++) {
      const x = zone.x + tileW * (i + 0.5);
      if (withArt) {
        // Apoyado en el suelo: el sombrero llega a la altura del rebote (topY).
        const img = scene.add.image(x, 0, ART).setOrigin(0.5, 1).setScale(s / ART_DETAIL, 1 / ART_DETAIL);
        this.sprites.push(img);
        this.art.add(img);
        continue;
      }
      this.piece(scene, x, 0, 4 * s, 4, STEM, 'stem');
      this.piece(scene, x + s, 0, s, 4, STEM_DARK, 'stem');
      this.piece(scene, x, -4, 14 * s, 1, CAP_DARK, 'cap');
      this.piece(scene, x, -5, 14 * s, 3, CAP, 'cap');
      this.piece(scene, x, -8, 12 * s, 1, CAP, 'cap');
      this.piece(scene, x, -9, 8 * s, 1, CAP_LIGHT, 'light');
      this.piece(scene, x - 4 * s, -6, 2 * s, 2, SPOT, 'spot');
      this.piece(scene, x + 3 * s, -6, 2 * s, 2, SPOT, 'spot');
    }
  }

  private piece(
    scene: Phaser.Scene,
    x: number,
    bottom: number,
    w: number,
    h: number,
    color: number,
    role: PieceRole,
  ): void {
    const rect = scene.add.rectangle(x, bottom, Math.max(1, w), h, color).setOrigin(0.5, 1);
    rect.setData('role', role);
    rect.setData('color', color);
    this.pieces.push(rect);
    this.art.add(rect);
  }

  private get readyColor(): number {
    return this.look === 'awning' ? AWNING_COLOR : CAP;
  }

  get canBounce(): boolean {
    return this.motor.canBounce;
  }

  /** ¿El cuerpo está apoyado en el sombrero, o llegó caminando hasta el hongo por el suelo? */
  isStoodOn(body: Phaser.Physics.Arcade.Body): boolean {
    if (!body.blocked.down && !body.touching.down) return false;
    const feetOnMushroom = body.bottom >= this.topY - 2 && body.bottom <= this.zone.bottom + 1;
    return feetOnMushroom && body.center.x >= this.zone.left && body.center.x <= this.zone.right;
  }

  /** Rebotó: aplasta el sombrero y el de un solo uso se desinfla. */
  bounced(): void {
    this.motor.bounced();
    if (this.motor.state === 'deflated') this.applyState('deflated');
    else this.squash();
  }

  /** Tajo sobre el hongo; true si despertó al dormido. */
  strike(charged: boolean): boolean {
    if (!this.motor.struck(charged)) return false;
    this.applyState('ready');
    return true;
  }

  update(deltaMs: number): void {
    const before = this.motor.state;
    const state = this.motor.step(deltaMs);
    if (state !== before) this.applyState(state);
  }

  reset(): void {
    this.motor.reset();
    this.applyState(this.motor.state);
  }

  /** Dibujo de cada estado: desinflado (chato y opaco), dormido (apagado) o listo. */
  private applyState(state: BouncerState): void {
    const scene = this.cap.scene;
    scene.tweens.killTweensOf([this.cap, this.spots, this.art]);
    if (this.look === 'awning') {
      this.applyAwning(state);
      return;
    }
    const dull = state === 'deflated' ? VARIANTS.deflatedColor : state === 'asleep' ? VARIANTS.asleepColor : 0;
    for (const img of this.sprites) {
      if (dull) img.setTint(dull);
      else img.clearTint();
    }
    for (const rect of this.pieces) {
      const role = rect.getData('role') as PieceRole;
      if (role === 'spot') {
        rect.setAlpha(dull ? 0.45 : 1);
        continue;
      }
      if (role === 'stem') {
        rect.setFillStyle(dull ? 0x9a9084 : (rect.getData('color') as number));
        continue;
      }
      rect.setFillStyle(dull || (rect.getData('color') as number));
    }
    const scaleY = state === 'deflated' ? 0.35 : 1;
    scene.tweens.add({ targets: this.art, scaleY, duration: CFG.squashMs * (state === 'deflated' ? 1 : 2), ease: state === 'deflated' ? 'Quad.easeOut' : 'Back.easeOut' });
  }

  private applyAwning(state: BouncerState): void {
    const scene = this.cap.scene;
    if (state === 'deflated') {
      this.cap.setFillStyle(VARIANTS.deflatedColor);
      this.spots.setAlpha(0.4);
      scene.tweens.add({ targets: [this.cap, this.spots], scaleY: 0.35, duration: CFG.squashMs, ease: 'Quad.easeOut' });
      return;
    }
    this.cap.setFillStyle(state === 'asleep' ? VARIANTS.asleepColor : this.readyColor);
    this.spots.setAlpha(state === 'asleep' ? 0.5 : 1);
    scene.tweens.add({ targets: [this.cap, this.spots], scaleY: 1, duration: CFG.squashMs * 2, ease: 'Back.easeOut' });
  }

  /** Aplastamiento del sombrero al rebotar. */
  squash(): void {
    const scene = this.cap.scene;
    if (this.look === 'awning') {
      scene.tweens.killTweensOf([this.cap, this.spots, this.stem]);
      this.cap.setScale(1, 1);
      scene.tweens.add({ targets: [this.cap, this.spots], scaleY: 0.5, duration: CFG.squashMs / 2, yoyo: true, ease: 'Quad.easeOut' });
      this.stem.setScale(1, 0.8);
      scene.tweens.add({ targets: this.stem, scaleY: 1, duration: CFG.squashMs, ease: 'Back.easeOut' });
      return;
    }
    scene.tweens.killTweensOf(this.art);
    this.art.setScale(1, 1);
    scene.tweens.add({ targets: this.art, scaleY: 0.55, duration: CFG.squashMs / 2, yoyo: true, ease: 'Quad.easeOut' });
  }
}
