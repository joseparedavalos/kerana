import Phaser from 'phaser';
import { GAMEPLAY } from '../config/gameplay';
import { dustAngles } from './dashTrailLogic';
import { GhostTrail } from './GhostTrail';

// Estela del dash (S83): copias del cuadro de Kerana que se apagan detrás de ella, y el polvo de salida.
// Las copias son una `GhostTrail` (S104, la misma que usa Kurupi) y sin Glow: brilla solo el tajo cargado.

const CFG = GAMEPLAY.dashFx;

/** Lo que la estela necesita de Kerana: el sprite y si está en dash. */
export interface DashTrailTarget {
  sprite: Phaser.GameObjects.Sprite;
  dashing: () => boolean;
  facing: () => number;
  /** Pies (centro de abajo del cuerpo), en unidades del mundo. */
  feet: () => { x: number; y: number };
}

export class DashTrail {
  private readonly ghosts: GhostTrail;
  private readonly dustAngleLeft = dustAngles(-1, CFG.dust.spreadDeg, CFG.dust.liftDeg);
  private readonly dustAngleRight = dustAngles(1, CFG.dust.spreadDeg, CFG.dust.liftDeg);
  private readonly dust: Phaser.GameObjects.Particles.ParticleEmitter;
  private wasDashing = false;

  constructor(scene: Phaser.Scene, private readonly target: DashTrailTarget, particleKey: string) {
    const kerana = target.sprite;
    this.ghosts = new GhostTrail(scene, kerana, CFG);
    const d = CFG.dust;
    this.dust = scene.add
      .particles(0, 0, particleKey, {
        speed: { min: d.speedMin, max: d.speedMax },
        lifespan: d.lifespanMs,
        scale: { start: d.scale, end: 0 },
        alpha: { start: d.alpha, end: 0 },
        tint: CFG.tint,
        emitting: false,
      })
      .setDepth(kerana.depth);
    scene.children.moveBelow(this.dust, kerana);
  }

  update(deltaMs: number): void {
    const dashing = this.target.dashing();
    const starting = dashing && !this.wasDashing;
    this.wasDashing = dashing;
    if (starting) this.burst();
    this.ghosts.update(deltaMs, dashing);
  }

  /** Apaga todas las copias (al reaparecer o al cortar el nivel). */
  clear(): void {
    this.ghosts.clear();
  }

  private burst(): void {
    const feet = this.target.feet();
    this.dust.setEmitterAngle(this.target.facing() >= 0 ? this.dustAngleRight : this.dustAngleLeft);
    this.dust.emitParticleAt(feet.x, feet.y, CFG.dust.count);
  }
}
