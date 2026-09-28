import Phaser from 'phaser';
import { GAMEPLAY } from '../../config/gameplay';
import type { EnemyDef } from '../../data/enemies';
import { takesDamage } from '../../systems/lightLogic';
import { colorForKey } from '../../utils/placeholder';

const FLASH_MS = 60;

/** Textura placeholder por arquetipo: rectángulo de color con espiral violeta (marca de Tau). */
function ensureEnemyTexture(scene: Phaser.Scene, def: EnemyDef): string {
  const key = `enemy_${def.id}`;
  if (scene.textures.exists(key)) return key;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  g.fillStyle(hslToHex(colorForKey(def.id)));
  g.fillRect(0, 0, def.width, def.height);
  g.fillStyle(0x6a2e8f, 0.8);
  g.fillCircle(def.width / 2, def.height / 3, Math.min(def.width, def.height) / 6);
  g.generateTexture(key, def.width, def.height);
  g.destroy();
  return key;
}

function hslToHex(hsl: string): number {
  const m = /hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/.exec(hsl);
  if (!m) return 0x808080;
  const h = Number(m[1]) / 360;
  const s = Number(m[2]) / 100;
  const l = Number(m[3]) / 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h * 6) % 2) - 1));
  const mm = l - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 1 / 6) [r, g, b] = [c, x, 0];
  else if (h < 2 / 6) [r, g, b] = [x, c, 0];
  else if (h < 3 / 6) [r, g, b] = [0, c, x];
  else if (h < 4 / 6) [r, g, b] = [0, x, c];
  else if (h < 5 / 6) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const to255 = (v: number) => Math.round((v + mm) * 255);
  return (to255(r) << 16) | (to255(g) << 8) | to255(b);
}

// Enemigo común marcado por Tau: aguanta unos golpes y se purifica (GDD §4.1, §5.1).
export abstract class EnemyBase extends Phaser.Physics.Arcade.Sprite {
  declare body: Phaser.Physics.Arcade.Body;
  readonly def: EnemyDef;
  hp: number;
  purified = false;
  facing: 1 | -1;
  /** Parpadeando en blanco tras un golpe: los arquetipos no deben tocar el tinte mientras dure. */
  flashing = false;
  /** Choca con el suelo y las plataformas (los voladores y los que viven en el agua, no). */
  collidesWithGround = true;
  readonly spawnX: number;
  readonly spawnY: number;
  /** Aviso al purificarse (la vaca embrujada deja una vaca tranquila en su lugar). */
  onPurified?: (enemy: EnemyBase) => void;
  /** Está iluminado (lo actualiza el nivel oscuro cada frame; fuera de N7 siempre es true). */
  lit = true;
  /** Partes que brillan con luz propia en la oscuridad (ojos del jagua hũ). */
  readonly glowParts: Phaser.GameObjects.GameObject[] = [];

  constructor(scene: Phaser.Scene, x: number, y: number, def: EnemyDef, facing: 1 | -1 = -1) {
    super(scene, x, y, ensureEnemyTexture(scene, def));
    this.def = def;
    this.hp = def.hp;
    this.facing = facing;
    this.spawnX = x;
    this.spawnY = y;
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setOrigin(0.5, 1);
    this.body.setSize(def.width, def.height);
  }

  /** Tocarlo daña a Kerana (el enjambre, solo mientras persigue). */
  get touchHurts(): boolean {
    return true;
  }

  /** Proyectiles propios que tocan a Kerana (frutas del Thrower); consume el que pega. */
  projectileHits(_rect: Phaser.Geom.Rectangle): boolean {
    return false;
  }

  /** El póra solo recibe daño iluminado (GDD §5.3); los demás, siempre. */
  get vulnerable(): boolean {
    return takesDamage(this.def.needsLight === true, this.lit);
  }

  /** Golpe del sable de Kerana: `dir` es hacia dónde sale despedido. En la oscuridad el sable atraviesa al póra. */
  hit(damage: number, dir: 1 | -1): void {
    if (this.purified || !this.vulnerable) return;
    this.hp -= damage;
    this.flashing = true;
    this.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
    this.body.setVelocityX(dir * GAMEPLAY.attack.knockback);
    this.scene.time.delayedCall(FLASH_MS, () => {
      this.flashing = false;
      if (!this.purified) this.clearTint().setTintMode(Phaser.TintModes.MULTIPLY);
    });
    if (this.hp <= 0) this.purify();
  }

  /** Se purifica en vez de morir: humo violeta y chispas doradas (GDD §4.1). */
  purify(): void {
    if (this.purified) return;
    this.purified = true;
    this.body.enable = false;
    this.onPurified?.(this);
    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      scale: 1.4,
      duration: 320,
      ease: 'Cubic.easeOut',
      onStart: () => this.setTint(0xf2c14e),
      onComplete: () => this.destroy(),
    });
  }

  /** Comportamiento propio del arquetipo; `dx` es la distancia horizontal a Kerana (con signo). */
  abstract updateBehavior(deltaMs: number, dx: number, dy: number): void;

  override preUpdate(time: number, delta: number): void {
    super.preUpdate(time, delta);
    if (this.purified) return;
    this.setFlipX(this.facing < 0);
    // El póra se ve apenas en la oscuridad y se vuelve sólido con la luz.
    if (this.def.needsLight) this.setAlpha(this.lit ? 1 : GAMEPLAY.darkness.unlitPoraAlpha);
  }
}
