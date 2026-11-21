import Phaser from 'phaser';
import { GAMEPLAY } from '../../config/gameplay';
import { uploadAtlas } from '../../systems/pixelArt';
import { WindCycle, type WindPhase } from './WindCycle';
import { wispAtlasFrames, wispFrame } from './windWispPaint';

const CFG = GAMEPLAY.wind;
const GRASS_COLOR = 0xc9a63a;
const STREAK_TINT = 0xf2eee3;
const WISP_ATLAS = 'wind_wisps';

// Zona de viento (GDD §4.8, §6.3): ráfagas que empujan a Kerana en una dirección.
// Aviso: el pasto se inclina y aparecen partículas 1 s antes de soplar.
export class WindZone {
  readonly cycle: WindCycle;
  private readonly blades: Phaser.GameObjects.Rectangle[] = [];
  private readonly streaks: Phaser.GameObjects.Particles.ParticleEmitter;
  /** S118: jirones de nube que corren con la ráfaga (solo sin pasto: el viento del cielo). */
  private readonly wisps?: Phaser.GameObjects.Particles.ParticleEmitter;
  private lean = 0;

  constructor(
    scene: Phaser.Scene,
    readonly zone: Phaser.Geom.Rectangle,
    /** 1 = sopla hacia la derecha, -1 = hacia la izquierda. */
    readonly dir: 1 | -1,
    private readonly speed: number,
    offsetMs: number,
    private readonly onPhase?: (phase: WindPhase, zone: WindZone) => void,
    /** false (S92, `grass=false` en el mapa): sin las matas de pasto; el aviso son solo las rayas (Yvága, en el aire). */
    grass = true,
  ) {
    this.cycle = new WindCycle(CFG, offsetMs);
    for (let x = zone.left + 4; grass && x < zone.right; x += CFG.grassSpacing) {
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
    if (!grass) {
      const W = CFG.wisps;
      uploadAtlas(scene, WISP_ATLAS, wispAtlasFrames());
      // Nacen del lado de donde viene el viento y cruzan la zona (con la cabeza hacia donde sopla).
      const from = dir > 0 ? zone.left - 30 : zone.right + 30;
      this.wisps = scene.add
        .particles(0, 0, WISP_ATLAS, {
          frame: W.sizes.map((_, i) => wispFrame(i)),
          x: { min: from - 20, max: from + 20 },
          y: { min: zone.top + 4, max: zone.bottom - 6 },
          speedX: { min: dir * W.speed * 0.8, max: dir * W.speed * 1.2 },
          speedY: { min: -4, max: 4 },
          lifespan: W.lifeMs,
          // Aparece y se apaga suave (sube en el primer cuarto de la vida, baja en el último).
          alpha: { onEmit: () => 0, onUpdate: (_p: unknown, _k: string, t: number) => Math.min(1, t * 4, (1 - t) * 4) },
          scaleX: dir,
          frequency: -1,
        })
        .setDepth(11);
    }
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
    if (this.wisps && phase !== 'calm' && Math.random() < (phase === 'gust' ? CFG.wisps.chanceGust : CFG.wisps.chanceWarn)) this.wisps.explode(1);
  }
}
