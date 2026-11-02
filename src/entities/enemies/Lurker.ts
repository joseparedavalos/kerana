import Phaser from 'phaser';
import { GAMEPLAY } from '../../config/gameplay';
import type { EnemyDef } from '../../data/enemies';
import { EnemyBase } from './EnemyBase';
import { hideCrouch, LurkerMotor, rhythmState, strikeActive, strikeZone, type LurkerState } from './LurkerMotor';

const HIDE = GAMEPLAY.karaiVosa;

const BUBBLE_EVERY_MS = 140;
const TILE = 16;

// Lurker (GDD §5.2): oculto bajo el agua; burbujas como aviso, emerge cuando Kerana se acerca
// y solo es vulnerable afuera. El punto del mapa es la superficie del agua.
// Colgante (`hangs`, mbói en N5): el punto es el tile bajo una rama; se esconde en ella, las hojas
// caen como aviso y baja colgado.
// Con ritmo (`rhythm`, jakare guasu, S24): no espera a Kerana; LevelScene le da el período y el momento de salir
// de la balsa que tiene al lado (`setRhythm`) y su estado sale del reloj de juego, igual que el de la balsa.
// Escondido (`hides`, Karaí Vosá, S70): el punto es el suelo detrás de algo que lo tapa (la carreta de l4, con `front`).
// Agachado ahí (hundido bajo el suelo, que lo recorta), asoma el sombrero como aviso, se para, sale al costado hacia
// Kerana y da un cucharonazo; después vuelve atrás y se agacha.
export class Lurker extends EnemyBase {
  private readonly motor: LurkerMotor;
  private readonly bubbles: Phaser.GameObjects.Particles.ParticleEmitter;
  private bubbleMs = 0;
  private lurk: LurkerState = 'hidden';
  private rhythm?: { periodMs: number; exposedAtMs: number };
  /** Tiempo de juego desde que se creó (las plataformas cuentan el mismo). */
  private clockMs = 0;
  /** Escondido (S70): ms desde que salió y si el cucharón ya pegó en esta salida. */
  private outMs = 0;
  private struck = false;

  constructor(scene: Phaser.Scene, x: number, y: number, def: EnemyDef, facing: 1 | -1 = -1) {
    super(scene, x, y, def, facing);
    this.motor = new LurkerMotor({
      detectRadius: def.detectRadius ?? 64,
      warnMs: def.warnMs ?? 900,
      exposedMs: def.exposedMs ?? 1800,
      cooldownMs: def.cooldownMs ?? 1400,
    });
    this.body.setAllowGravity(false);
    this.collidesWithGround = false;
    this.bubbles = scene.add
      .particles(0, 0, 'fx_particle', {
        speedY: def.hangs ? { min: 15, max: 35 } : { min: -30, max: -12 },
        speedX: { min: -6, max: 6 },
        lifespan: def.hangs ? 600 : 450,
        alpha: { start: 0.9, end: 0 },
        tint: def.hangs ? 0x5cc85c : 0xd8f0f0,
        emitting: false,
      })
      .setDepth(6);
    this.submerge(true);
  }

  /** Estado actual (el piloto del smoke espera a que el jakare guasu se hunda). */
  get lurkState(): LurkerState {
    return this.lurk;
  }

  /** Ritmo (S24): sale a los `exposedAtMs` de juego y después una vez cada `periodMs`. */
  setRhythm(periodMs: number, exposedAtMs: number): void {
    this.rhythm = { periodMs, exposedAtMs };
  }

  updateBehavior(deltaMs: number, dx: number, dy: number): void {
    const before = this.lurk;
    this.clockMs += deltaMs;
    // No se desliza con el retroceso del golpe: está anclado en el agua.
    this.body.setVelocity(0, 0);
    if (this.rhythm) {
      this.lurk = rhythmState(this.clockMs, this.rhythm.periodMs, this.rhythm.exposedAtMs, this.def.warnMs ?? 900, this.def.exposedMs ?? 1800);
    } else {
      // Colgante: Kerana tiene que pasar por debajo (o a la altura) de la rama.
      const inRange = this.def.hangs ? dy > -TILE && dy < 96 : Math.abs(dy) < 64;
      const near = inRange ? Math.abs(dx) : Infinity;
      this.lurk = this.motor.step(deltaMs, near);
    }
    const state = this.lurk;
    if (state === 'exposed') this.outMs += deltaMs;
    if (state === 'warn' && !this.def.hides) {
      this.bubbleMs -= deltaMs;
      if (this.bubbleMs <= 0) {
        this.bubbleMs = BUBBLE_EVERY_MS;
        const y = this.def.hangs ? this.anchorTop : this.spawnY;
        // El jakare guasu hace burbujas en más ancho y más seguidas.
        const s = this.def.scale ?? 1;
        this.bubbles.emitParticleAt(this.x + Phaser.Math.Between(-8 * s, 8 * s), y, Math.round(s));
      }
    }
    if (state === before) return;
    if (this.def.hides) {
      this.hideStep(state, dx);
      return;
    }
    if (state === 'exposed') {
      // Mira hacia Kerana al salir.
      this.facing = dx >= 0 ? 1 : -1;
      this.emerge();
    } else if (state === 'cooldown') {
      this.submerge(false);
    }
  }

  /** Escondido (S70): asoma en el aviso, sale al costado y golpea, y vuelve a agacharse. */
  private hideStep(state: LurkerState, dx: number): void {
    const crouch = this.spawnY + hideCrouch(state, HIDE);
    this.scene.tweens.killTweensOf(this);
    if (state === 'warn') {
      // Asoma del lado de Kerana: el sombrero sobre lo que lo tapa.
      this.facing = dx >= 0 ? 1 : -1;
      this.setVisible(true);
      this.scene.tweens.add({ targets: this, y: crouch, duration: HIDE.peekMs, ease: 'Sine.easeOut' });
    } else if (state === 'exposed') {
      this.body.enable = true;
      this.setVisible(true);
      this.outMs = 0;
      this.struck = false;
      const x = this.spawnX + this.facing * HIDE.stepOut;
      this.scene.tweens.add({ targets: this, x, y: crouch, duration: HIDE.stepMs, ease: 'Sine.easeOut' });
      this.playAnim('attack', 'idle');
    } else if (state === 'cooldown') {
      this.body.enable = false;
      this.scene.tweens.add({
        targets: this,
        x: this.spawnX,
        y: crouch,
        duration: HIDE.hideMs,
        ease: 'Sine.easeIn',
        onComplete: () => this.setVisible(false),
      });
    }
  }

  /** Animación `<sprite>_<name>` del dibujo, si existe; `then`, la que sigue al terminar. */
  private playAnim(name: string, then?: string): void {
    const sprite = this.skin?.sprite;
    const look = this.def.look ?? this.def.id;
    if (!sprite || !this.scene.anims.exists(`${look}_${name}`)) return;
    sprite.play(`${look}_${name}`);
    if (then) sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => this.purified || sprite.play(`${look}_${then}`));
  }

  /** El cucharón (S70): lastima una vez por salida, delante del cuerpo, en los cuadros del golpe. */
  override projectileHits(rect: Phaser.Geom.Rectangle): boolean {
    if (!this.def.hides || this.purified || this.lurk !== 'exposed' || this.struck || !strikeActive(this.outMs, HIDE.strike)) return false;
    const z = strikeZone(this.x, this.y, this.facing, this.def.width / 2, HIDE.strike);
    if (!Phaser.Geom.Intersects.RectangleToRectangle(rect, new Phaser.Geom.Rectangle(z.x, z.y, z.width, z.height))) return false;
    this.struck = true;
    return true;
  }

  /** Zona del cucharón ahora, o null fuera del golpe (para `debug=1`, el smoke y las capturas). */
  get strikeRect(): { x: number; y: number; width: number; height: number } | null {
    if (!this.def.hides || this.lurk !== 'exposed' || !strikeActive(this.outMs, HIDE.strike)) return null;
    return strikeZone(this.x, this.y, this.facing, this.def.width / 2, HIDE.strike);
  }

  private emerge(): void {
    this.body.enable = true;
    this.setVisible(true);
    this.scene.tweens.killTweensOf(this);
    // `emergeHeight`: cuánto sale del agua el cuerpo (con la escala del jakare guasu).
    const y = this.def.hangs ? this.anchorTop + this.def.height : this.spawnY + this.bodyHeight - (this.def.emergeHeight ?? 8);
    this.scene.tweens.add({ targets: this, y, duration: 160, ease: 'Back.easeOut' });
  }

  /** Alto del cuerpo ya escalado (px). */
  private get bodyHeight(): number {
    return this.def.height * (this.def.scale ?? 1);
  }

  /** Borde inferior de la rama de la que cuelga (colgante). */
  private get anchorTop(): number {
    return this.spawnY - TILE;
  }

  /** Bajo el agua (o en la rama) no toca ni se puede golpear. */
  private submerge(instant: boolean): void {
    this.body.enable = false;
    if (this.def.hides) {
      this.setPosition(this.spawnX, this.spawnY + hideCrouch('hidden', HIDE)).setVisible(false);
      return;
    }
    const hiddenY = this.def.hangs ? this.anchorTop + 2 : this.spawnY + this.bodyHeight + 2;
    this.scene.tweens.killTweensOf(this);
    if (instant) {
      this.setY(hiddenY).setVisible(false);
      return;
    }
    this.scene.tweens.add({ targets: this, y: hiddenY, duration: 220, onComplete: () => this.setVisible(false) });
  }

  override purify(): void {
    this.scene.tweens.killTweensOf(this);
    super.purify();
  }

  /** Un humano (Karaí Vosá) se purifica como el payesero: humo, destello cálido y se desvanece, sin chispas. */
  protected override purifyEffect(): void {
    if (this.def.human) {
      this.playAnim('idle');
      this.humanPurifyEffect();
      return;
    }
    super.purifyEffect();
  }

  override destroy(fromScene?: boolean): void {
    this.bubbles.destroy();
    super.destroy(fromScene);
  }
}
