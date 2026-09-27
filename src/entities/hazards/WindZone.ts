import Phaser from 'phaser';
import { GAMEPLAY } from '../../config/gameplay';
import { WindCycle, type WindPhase } from './WindCycle';

const CFG = GAMEPLAY.wind;
const GRASS_COLOR = 0xc9a63a;
const STREAK_TINT = 0xf2eee3;

// Zona de viento (GDD §4.8, §6.3): ráfagas que empujan a Kerana en una dirección.
// Aviso: el pasto se inclina y aparecen partículas 1 s antes de soplar.
export class WindZone {
  readonly cycle: WindCycle;
  private readonly blades: Phaser.GameObjects.Rectangle[] = [];
  private readonly streaks: Phaser.GameObjects.Particles.ParticleEmitter;
  private lean = 0;

  constructor(
    scene: Phaser.Scene,
    readonly zone: Phaser.Geom.Rectangle,
    /** 1 = sopla hacia la derecha, -1 = hacia la izquierda. */
    readonly dir: 1 | -1,
    private readonly speed: number,
    offsetMs: number,
    private readonly onPhase?: (phase: WindPhase, zone: WindZone) => void,
  ) {
    this.cycle = new WindCycle(CFG, offsetMs);
    for (let x = zone.left + 4; x < zone.right; x += CFG.grassSpacing) {
      this.blades.push(scene.add.rectangle(x, zone.bottom, 2, CFG.grassHeight, GRASS_COLOR).setOrigin(0.5, 1).setDepth(11));
    }
    this.streaks = scene.add
      .particles(0, 0, 'fx_particle', {
        x: { min: zone.left, max: zone.right },
        y: { min: zone.top, max: zone.bottom - 4 },
        speedX: dir * CFG.streakSpeed,
        speedY: { min: -6, max: 6 },
        scaleX: 3,
        scaleY: 0.5,
        lifespan: CFG.streakLifeMs,
        alpha: { start: 0.7, end: 0 },
        tint: STREAK_TINT,
        frequency: -1,
      })
      .setDepth(12);
  }

  /** Velocidad (px/s) que suma a Kerana si está adentro y sopla. */
  pushFor(x: number, y: number): number {
    return this.cycle.blowing && this.zone.contains(x, y) ? this.dir * this.speed : 0;
  }

  update(deltaMs: number): void {
    const changed = this.cycle.step(deltaMs);
    if (changed) this.onPhase?.(changed, this);
    const phase = this.cycle.phase;
    const target = phase === 'gust' ? CFG.gustLeanDeg : phase === 'warn' ? CFG.warnLeanDeg : 0;
    this.lean += (target - this.lean) * Math.min(1, deltaMs / 150);
    for (let i = 0; i < this.blades.length; i++) this.blades[i].setAngle(this.dir * this.lean + Math.sin(i) * 3);
    if (phase !== 'calm' && Math.random() < (phase === 'gust' ? CFG.streakChanceGust : CFG.streakChanceWarn)) this.streaks.explode(1);
  }
}
