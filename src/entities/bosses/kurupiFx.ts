import Phaser from 'phaser';
import { GAMEPLAY } from '../../config/gameplay';
import { uploadAtlas } from '../../systems/pixelArt';
import { dustAngles } from '../dashTrailLogic';
import { GhostTrail, type GhostSource } from '../GhostTrail';
import { clodFrameName, CLODS, debrisFrames, KickMeter, kickHasLeaf, LEAF_FLUTTERS, leafFrameName } from './kurupiFxLogic';

// Kurupi corriendo rápido (S104): siluetas que quedan atrás (la `GhostTrail` del dash de Kerana, con su color) y la
// tierra y las hojas que levantan sus pies, más un último puñado al frenar. Pools fijos y sin Glow ni destellos.

const CFG = GAMEPLAY.kurupiTrail;
const ATLAS = 'kurupi_debris_fx';
const flutterAnim = (flutter: string): string => `kurupi_leaf_${flutter}`;

/** El abanico como config del emisor (se arma una vez; Phaser 4 no cambia un rango con `setEmitterAngle`). */
type Aim = { angle: { min: number; max: number } };
const aimAt = (angle: Aim['angle']): Aim => ({ angle });

export class KurupiFx {
  private readonly ghosts: GhostTrail;
  private readonly dirt: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly leaves: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly kicks = new KickMeter(CFG.kick);
  // Abanicos precalculados: patada hacia atrás y frenada hacia adelante, para cada lado de la carrera.
  private readonly kickLeft = aimAt(dustAngles(-1, CFG.kick.spreadDeg, CFG.kick.liftDeg));
  private readonly kickRight = aimAt(dustAngles(1, CFG.kick.spreadDeg, CFG.kick.liftDeg));
  private readonly brakeLeft = aimAt(dustAngles(1, CFG.brake.spreadDeg, CFG.brake.liftDeg));
  private readonly brakeRight = aimAt(dustAngles(-1, CFG.brake.spreadDeg, CFG.brake.liftDeg));
  private running = false;
  private dir: 1 | -1 = 1;
  private lastX = 0;

  /** `arena` y `floorY`: lo que cae al suelo de la arena se apaga ahí. */
  constructor(scene: Phaser.Scene, source: GhostSource, arena: Phaser.Geom.Rectangle, floorY: number) {
    this.ghosts = new GhostTrail(scene, source, CFG);
    ensureDebris(scene);
    const scale = 1 / CFG.detail;
    const fade = { start: 1, end: 0, ease: 'Quad.easeIn' };
    const ground = new Phaser.Geom.Rectangle(arena.left - arena.width, floorY + CFG.sinkPx, arena.width * 3, arena.height + 64);
    const sink = { type: 'onEnter', source: ground };
    const d = CFG.dirt;
    this.dirt = scene.add.particles(0, 0, ATLAS, {
      frame: CLODS.map((_, i) => clodFrameName(i)),
      speed: { min: d.speedMin, max: d.speedMax },
      gravityY: d.gravityY,
      lifespan: { min: d.lifespanMin, max: d.lifespanMax },
      scale,
      alpha: fade,
      tint: [...CFG.dirtColors],
      deathZone: sink,
      // La carrera usa hasta `max`; el resto queda para el puñado de la frenada.
      maxAliveParticles: d.max + CFG.brake.dirt,
      emitting: false,
    });
    const l = CFG.leaf;
    this.leaves = scene.add.particles(0, 0, ATLAS, {
      anim: { anims: Object.keys(LEAF_FLUTTERS).map(flutterAnim), cycle: false },
      speed: { min: l.speedMin, max: l.speedMax },
      gravityY: l.gravityY,
      lifespan: { min: l.lifespanMin, max: l.lifespanMax },
      scale,
      alpha: fade,
      tint: [...CFG.leafColors],
      deathZone: sink,
      maxAliveParticles: l.max + CFG.brake.leaves,
      emitting: false,
    });
    // Detrás de Kurupi y encima de sus siluetas: su misma profundidad y justo antes que él en la lista.
    for (const emitter of [this.dirt, this.leaves]) {
      emitter.setDepth(source.depth);
      scene.children.moveBelow(emitter, source);
    }
  }

  /**
   * `fast`: está en una carrera rápida; `x`, el centro de sus pies; `floorY`, el suelo; `runDir`, hacia dónde corre
   * (en la carrera al revés, al contrario de donde mira).
   */
  update(deltaMs: number, fast: boolean, x: number, floorY: number, runDir: 1 | -1): void {
    this.ghosts.update(deltaMs, fast);
    if (fast && !this.running) {
      this.running = true;
      this.dir = runDir;
      this.lastX = x;
      this.kicks.reset();
      this.aim(runDir >= 0 ? this.kickRight : this.kickLeft);
      return;
    }
    if (!fast) {
      if (this.running) this.brake(x, floorY);
      return;
    }
    const n = this.kicks.step(x - this.lastX, deltaMs);
    this.lastX = x;
    if (n <= 0) return;
    const fx = x - this.dir * CFG.kick.backPx;
    const fy = floorY - CFG.kick.upPx;
    for (let k = this.kicks.count - n + 1; k <= this.kicks.count; k++) {
      if (this.dirt.getAliveParticleCount() < CFG.dirt.max) this.dirt.emitParticleAt(fx, fy, 1);
      if (kickHasLeaf(k, CFG.kick.leafEvery) && this.leaves.getAliveParticleCount() < CFG.leaf.max) this.leaves.emitParticleAt(fx, fy, 1);
    }
  }

  /** Apaga todo de golpe (la pelea se reinicia o termina). */
  clear(): void {
    this.running = false;
    this.ghosts.clear();
    this.dirt.killAll();
    this.leaves.killAll();
  }

  /** Frena: el último puñado sale hacia adelante, desde la punta del pie (detrás de él no se vería). */
  private brake(x: number, floorY: number): void {
    this.running = false;
    this.aim(this.dir >= 0 ? this.brakeRight : this.brakeLeft);
    const fx = x + this.dir * CFG.brake.frontPx;
    const fy = floorY - CFG.kick.upPx;
    this.dirt.emitParticleAt(fx, fy, CFG.brake.dirt);
    this.leaves.emitParticleAt(fx, fy, CFG.brake.leaves);
  }

  /**
   * Apunta el abanico. Con `setEmitterAngle({ min, max })` Phaser 4 no cambia el rango (lo recorta a un número y el
   * ángulo sigue al azar entre 0 y 360): hay que recargar la operación del ángulo.
   */
  private aim(aim: Aim): void {
    this.dirt.ops.angle.loadConfig(aim);
    this.leaves.ops.angle.loadConfig(aim);
  }
}

/** El atlas de las hojas y los terrones y los aleteos: una sola vez por partida. */
function ensureDebris(scene: Phaser.Scene): void {
  uploadAtlas(scene, ATLAS, debrisFrames());
  for (const [flutter, frames] of Object.entries(LEAF_FLUTTERS)) {
    const key = flutterAnim(flutter);
    if (scene.anims.exists(key)) continue;
    scene.anims.create({
      key,
      frames: frames.map((_, i) => ({ key: ATLAS, frame: leafFrameName(flutter, i) })),
      frameRate: CFG.leaf.flutterFps,
      repeat: -1,
    });
  }
}
