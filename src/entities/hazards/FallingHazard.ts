import Phaser from 'phaser';
import { GAMEPLAY } from '../../config/gameplay';

const CFG = GAMEPLAY.fallingHazard;
const TEXTURE = 'hazard_stalactite';

export type FallingState = 'hanging' | 'warning' | 'falling' | 'broken' | 'gone';

export interface FallingHazardOptions {
  /** Aviso (polvo y sombra) antes de caer (ms). */
  warnMs?: number;
  /** Cae una sola vez y desaparece (las estalactitas del jefe). */
  oneShot?: boolean;
  /** Al romperse contra el suelo (sonido). */
  onShatter?: () => void;
}

/** Textura provisional: triángulo de piedra apuntando hacia abajo. */
function ensureTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists(TEXTURE)) return;
  const w = CFG.width;
  const h = CFG.height;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  g.fillStyle(0x8a7f74).fillTriangle(0, 0, w, 0, w / 2, h);
  g.fillStyle(0xb5aa9c).fillTriangle(1, 0, w / 2, 0, w / 2, h - 2);
  g.generateTexture(TEXTURE, w, h);
  g.destroy();
}

// Estalactita (GDD §6.1): cuelga del techo; cuando Kerana pasa debajo tiembla y suelta polvo
// (aviso) y después cae. Se rompe contra el suelo y vuelve a crecer al rato.
export class FallingHazard {
  state: FallingState = 'hanging';
  readonly sprite: Phaser.GameObjects.Image;
  private readonly shadow: Phaser.GameObjects.Ellipse;
  private readonly warnMs: number;
  private readonly oneShot: boolean;
  private readonly onShatter?: () => void;
  private msLeft = 0;
  private vy = 0;
  private dustMs = 0;
  private readonly rect = new Phaser.Geom.Rectangle();

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly x: number,
    private readonly topY: number,
    private readonly groundY: number,
    private readonly dust: Phaser.GameObjects.Particles.ParticleEmitter,
    opts: FallingHazardOptions = {},
  ) {
    ensureTexture(scene);
    this.warnMs = opts.warnMs ?? CFG.warnMs;
    this.oneShot = opts.oneShot ?? false;
    this.onShatter = opts.onShatter;
    this.sprite = scene.add.image(x, topY, TEXTURE).setOrigin(0.5, 0).setDepth(5);
    this.shadow = scene.add.ellipse(x, groundY, CFG.width * 1.6, 4, 0x000000, 0.35).setDepth(4).setVisible(false);
    if (this.oneShot) this.startWarning();
  }

  /** Avanza la estalactita; `playerX` dispara la caída. Devuelve si golpea a Kerana este frame. */
  update(deltaMs: number, playerX: number, playerRect: Phaser.Geom.Rectangle): boolean {
    switch (this.state) {
      case 'hanging':
        if (Math.abs(playerX - this.x) <= CFG.triggerRangeX) this.startWarning();
        return false;
      case 'warning':
        this.msLeft -= deltaMs;
        this.sprite.x = this.x + (Math.random() < 0.5 ? -CFG.shakePx : CFG.shakePx);
        this.dustMs -= deltaMs;
        if (this.dustMs <= 0) {
          this.dustMs = 120;
          this.dust.emitParticleAt(this.x, this.topY, 1);
        }
        if (this.msLeft <= 0) {
          this.state = 'falling';
          this.sprite.x = this.x;
          this.vy = 0;
        }
        return false;
      case 'falling': {
        const dt = deltaMs / 1000;
        this.vy = Math.min(CFG.maxFallSpeed, this.vy + CFG.gravity * dt);
        this.sprite.y += this.vy * dt;
        if (this.sprite.y + CFG.height >= this.groundY) {
          this.shatter();
          return false;
        }
        this.rect.setTo(this.sprite.x - CFG.width / 2, this.sprite.y, CFG.width, CFG.height);
        return Phaser.Geom.Rectangle.Overlaps(this.rect, playerRect);
      }
      case 'broken':
        this.msLeft -= deltaMs;
        if (this.msLeft <= 0) this.regrow();
        return false;
      default:
        return false;
    }
  }

  /** Quita la estalactita de la escena. */
  destroy(): void {
    this.state = 'gone';
    this.sprite.destroy();
    this.shadow.destroy();
  }

  private startWarning(): void {
    this.state = 'warning';
    this.msLeft = this.warnMs;
    this.dustMs = 0;
    this.shadow.setVisible(true);
  }

  private shatter(): void {
    this.dust.emitParticleAt(this.x, this.groundY - 2, 6);
    this.shadow.setVisible(false);
    this.onShatter?.();
    if (this.oneShot) {
      this.destroy();
      return;
    }
    this.state = 'broken';
    this.msLeft = CFG.respawnMs;
    this.sprite.setVisible(false);
  }

  private regrow(): void {
    this.state = 'hanging';
    this.sprite.setPosition(this.x, this.topY).setVisible(true).setAlpha(0);
    this.scene.tweens.add({ targets: this.sprite, alpha: 1, duration: 400 });
  }
}
