import Phaser from 'phaser';
import type { EnemyDef } from '../../data/enemies';
import { AudioManager } from '../../systems/AudioManager';
import { divePathClear, findPerch, type Box, type SolidAt } from './diverLogic';
import { EnemyBase } from './EnemyBase';

const DIVE_OVERSHOOT_MS = 150;

type DiverState = 'perch' | 'telegraph' | 'dive' | 'rest' | 'return';

// Diver (GDD §5.2): espera en lo alto (un poste) y se lanza en picada hacia donde estaba
// Kerana al terminar el aviso; después vuelve despacio a su lugar. Con `restMs` (ñakurutu guasu, S23)
// queda quieto en el suelo un rato antes de volver. Desde S24 solo avisa y pica con el camino libre hasta
// Kerana (`diverLogic.ts`): con una pared en el medio espera en su lugar en vez de picar contra ella.
export class Diver extends EnemyBase {
  /** Qué frena la picada (lo pone LevelScene: suelo y plataformas). Sin esto, el camino se da por libre. */
  solidAt?: SolidAt;
  /** Tile del mapa (px), para hallar la percha. */
  tileSize = 16;
  private diveState: DiverState = 'perch';
  private msLeft = 0;
  private readonly dir = new Phaser.Math.Vector2();
  /** Desde dónde salió la picada y cuánto (al cuadrado) recorre sin chocar con el suelo. */
  private readonly diveFrom = new Phaser.Math.Vector2();
  private diveGraceSq = 0;
  /** Cara de arriba del poste o la rama donde espera (null: en el aire); se busca la primera vez. */
  private perch?: Box | null;

  constructor(scene: Phaser.Scene, x: number, y: number, def: EnemyDef, facing: 1 | -1 = -1) {
    super(scene, x, y, def, facing);
    this.body.setAllowGravity(false);
    this.collidesWithGround = false;
  }

  updateBehavior(deltaMs: number, dx: number, dy: number): void {
    const def = this.def;
    this.msLeft -= deltaMs;
    switch (this.diveState) {
      case 'perch':
        this.body.setVelocity(0, 0);
        // Solo se lanza si Kerana está abajo, a su alcance y con el camino libre (S24: si no, espera).
        if (this.msLeft <= 0 && dy > 0 && Math.hypot(dx, dy) <= (def.detectRadius ?? 96) && this.pathClear(dx, dy)) {
          this.facing = dx >= 0 ? 1 : -1;
          this.enter('telegraph', def.telegraphMs ?? 500);
          this.warning = true;
          if (def.warnSfx) AudioManager.play(def.warnSfx);
          if (!this.flashing) this.setTint(0xf2eee3);
        }
        break;
      case 'telegraph':
        if (this.msLeft <= 0) {
          this.warning = false;
          if (!this.flashing) this.clearTint();
          // Si durante el aviso Kerana quedó detrás de una pared, no pica: vuelve a esperar el camino libre (S24).
          if (!this.pathClear(dx, dy)) {
            this.enter('perch', 0);
            break;
          }
          // Apunta a los pies de Kerana en este momento.
          const speed = def.diveSpeed ?? 230;
          const dist = Math.hypot(dx, dy);
          this.dir.set(dx, dy).normalize();
          this.facing = dx >= 0 ? 1 : -1;
          this.body.setVelocity(this.dir.x * speed, this.dir.y * speed);
          // Llega un poco más allá de donde estaba Kerana; solo choca con el suelo en la picada, y no en la primera
          // mitad (S23): parado sobre un poste, el primer paso lo apoyaba en el poste y la picada terminaba ahí.
          // Con el camino libre (S24), en esa mitad solo cruza su percha.
          this.enter('dive', Math.min(def.chargeMaxMs ?? 1200, (dist / speed) * 1000 + DIVE_OVERSHOOT_MS));
          this.diveFrom.set(this.x, this.y);
          this.diveGraceSq = (dist / 2) ** 2;
        }
        break;
      case 'dive':
        if (!this.collidesWithGround && Phaser.Math.Distance.Squared(this.x, this.y, this.diveFrom.x, this.diveFrom.y) > this.diveGraceSq) {
          this.collidesWithGround = true;
        }
        if (this.msLeft <= 0 || (this.collidesWithGround && (this.body.blocked.down || this.body.blocked.left || this.body.blocked.right))) {
          this.collidesWithGround = false;
          this.body.setVelocity(0, 0);
          this.enter(def.restMs ? 'rest' : 'return', def.restMs ?? 0);
        }
        break;
      case 'rest':
        this.body.setVelocity(0, 0);
        if (this.msLeft <= 0) this.enter('return', 0);
        break;
      case 'return': {
        const tx = this.spawnX - this.x;
        const ty = this.spawnY - this.y;
        const dist = Math.hypot(tx, ty);
        if (dist < 3) {
          this.body.reset(this.spawnX, this.spawnY);
          this.enter('perch', def.cooldownMs ?? 900);
          break;
        }
        const speed = def.returnSpeed ?? 70;
        this.facing = tx >= 0 ? 1 : -1;
        this.body.setVelocity((tx / dist) * speed, (ty / dist) * speed);
        break;
      }
    }
  }

  private enter(state: DiverState, ms: number): void {
    this.diveState = state;
    this.msLeft = ms;
  }

  /** ¿La caja del cuerpo llega libre hasta los pies de Kerana (`dx`, `dy` desde los suyos)? Ver `diverLogic.ts`. */
  private pathClear(dx: number, dy: number): boolean {
    const solidAt = this.solidAt;
    if (!solidAt) return true;
    const b = this.body;
    if (this.perch === undefined) this.perch = findPerch(this.spawnX, this.spawnY, b.halfWidth, this.tileSize, solidAt) ?? null;
    return divePathClear(b.center.x, b.center.y, b.center.x + dx, b.center.y + dy, b.halfWidth, b.halfHeight, solidAt, this.perch ?? undefined);
  }
}
