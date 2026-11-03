import Phaser from 'phaser';
import { GAMEPLAY } from '../../config/gameplay';
import type { EnemyDef } from '../../data/enemies';
import { EnemyBase } from './EnemyBase';
import { guardFrame, GuardMotor, guardTurns, strikeZone, type GuardFrames, type GuardState, type StrikeSpec } from './GuardMotor';
import { lineClear } from './payeLogic';

const CFG = GAMEPLAY.karaiVosa;
const JAGUARU = GAMEPLAY.jaguaru;

// Guardián (S72): Karaí Vosá. Quieto y siempre a la vista, cuida un lugar de paso. Cuando Kerana entra en su radio
// levanta la cuchara (aviso), pega un cucharazo corto delante (lo único que lastima) y se recupera. Mira hacia ella en
// reposo y en el aviso; en el golpe y al recuperarse no gira, así que se lo puede pasar por detrás o pegarle.
// El dibujo sigue al estado: la hoja `attack` se reparte entre los tres tiempos (GuardMotor.guardFrame).
// Con reloj (`clock`, el Jaguarú, S77): no mira a Kerana ni gira; abre los ojos, muerde y los cierra con su propio ritmo.
export class Guard extends EnemyBase {
  /** Lo sólido (la capa Ground, con los fardos): la escena lo conecta. No ve a Kerana a través de un fardo o un muro. */
  solidAt?: (x: number, y: number) => boolean;
  private readonly motor: GuardMotor;
  /** El cucharazo ya pegó en este golpe. */
  private struck = false;
  /** Cuadro de `attack` a la vista (null: la hoja `idle`). */
  private shownFrame: number | null = null;
  private readonly frames: GuardFrames;
  private readonly strike: StrikeSpec;

  constructor(scene: Phaser.Scene, x: number, y: number, def: EnemyDef, facing: 1 | -1 = -1) {
    super(scene, x, y, def, facing);
    if (def.clock) {
      this.motor = new GuardMotor({
        detectRadius: 0,
        detectHeight: 0,
        telegraphMs: JAGUARU.telegraphMs,
        activeMs: JAGUARU.activeMs,
        recoverMs: JAGUARU.recoverMs,
        restMs: JAGUARU.restMs,
        startMs: JAGUARU.startMs,
      });
      this.frames = JAGUARU.frames;
      this.strike = JAGUARU.strike;
    } else {
      this.motor = new GuardMotor({
        detectRadius: def.detectRadius ?? CFG.detectRadius,
        detectHeight: CFG.detectHeight,
        telegraphMs: def.telegraphMs ?? CFG.telegraphMs,
        activeMs: CFG.activeMs,
        recoverMs: CFG.recoverMs,
      });
      this.frames = CFG.frames;
      this.strike = CFG.strike;
    }
  }

  /** Estado actual (el smoke, el piloto y las capturas lo miran). */
  get guardState(): GuardState {
    return this.motor.state;
  }

  /** Tocarlo no lastima: solo el cucharazo (S72). Así nunca es un obstáculo que pega sin que se vea el golpe. */
  override get touchHurts(): boolean {
    return false;
  }

  updateBehavior(deltaMs: number, dx: number, dy: number): void {
    // No camina ni se desliza con el retroceso del golpe.
    this.body.setVelocityX(0);
    const before = this.motor.state;
    // Con reloj no la busca: el ciclo sigue igual esté donde esté (S77).
    const sees = !this.motor.clocked && this.motor.inRange(dx, dy) && this.seesKerana(dx, dy);
    const state = this.motor.step(deltaMs, sees);
    const turns = !this.motor.clocked && guardTurns(state);
    if (turns && dx !== 0 && Math.abs(dx) <= CFG.watchRadius && Math.abs(dy) <= CFG.watchRadius) this.facing = dx > 0 ? 1 : -1;
    if (state === 'active' && before !== 'active') this.struck = false;
    this.showFrame(guardFrame(state, this.motor.progress, this.frames));
  }

  /** Camino libre a la altura del pecho, de él a ella (sin escena conectada, siempre). */
  private seesKerana(dx: number, dy: number): boolean {
    if (!this.solidAt) return true;
    const y = this.y - CFG.eyeHeight;
    return lineClear(this.x, y, this.x + dx, y + dy, CFG.losStep, this.solidAt);
  }

  /** Pone el cuadro de `attack` que toca, o vuelve a la hoja `idle`. */
  private showFrame(index: number | null): void {
    if (index === this.shownFrame) return;
    this.shownFrame = index;
    const sprite = this.skin?.sprite;
    if (!sprite) return;
    const look = this.def.look ?? this.def.id;
    if (index === null) {
      if (this.scene.anims.exists(`${look}_idle`)) sprite.play(`${look}_idle`);
      return;
    }
    const anim = this.scene.anims.get(`${look}_attack`);
    const frame = anim?.frames[Math.min(index, anim.frames.length - 1)];
    if (!frame) return;
    sprite.anims.stop();
    sprite.setFrame(frame.frame.name);
  }

  /** El cucharazo: lastima una vez por golpe, delante del cuerpo, solo mientras baja la cuchara. */
  override projectileHits(rect: Phaser.Geom.Rectangle): boolean {
    const z = this.strikeRect;
    if (!z || this.struck) return false;
    if (!Phaser.Geom.Intersects.RectangleToRectangle(rect, new Phaser.Geom.Rectangle(z.x, z.y, z.width, z.height))) return false;
    this.struck = true;
    return true;
  }

  /** Zona del cucharazo ahora, o null fuera del golpe (para `debug=1`, el smoke y las capturas). */
  get strikeRect(): { x: number; y: number; width: number; height: number } | null {
    if (this.purified || this.motor.state !== 'active') return null;
    return strikeZone(this.x, this.y, this.facing, this.def.width / 2, this.strike);
  }

  /** Un humano se purifica como el payesero: humo, destello cálido y se desvanece, sin chispas; el Jaguarú, como los demás. */
  protected override purifyEffect(): void {
    this.showFrame(null);
    if (this.def.human) this.humanPurifyEffect();
    else super.purifyEffect();
  }
}
