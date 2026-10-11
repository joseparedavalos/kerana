import Phaser from 'phaser';
import { GAMEPLAY } from '../config/gameplay';

const CFG = GAMEPLAY.waterfall;

/**
 * Cascada (S31, el salto de l6): una cortina de agua por código delante de Kerana y sin choque (`rect Waterfall`).
 * Velo translúcido, hilos que caen (un pool fijo, sin asignar por frame) y espuma al pie. Lo que está detrás se ve
 * a medias: así se descubre la cornisa.
 */
export class Waterfall {
  private readonly streaks: Phaser.GameObjects.Rectangle[] = [];
  private readonly foam: Phaser.GameObjects.Particles.ParticleEmitter;
  private foamMs = 0;

  constructor(
    scene: Phaser.Scene,
    private readonly zone: Phaser.Geom.Rectangle,
    particleKey: string,
  ) {
    scene.add.rectangle(zone.x, zone.y, zone.width, zone.height, CFG.color, CFG.alpha).setOrigin(0, 0).setDepth(10);
    const count = Math.max(1, Math.round((zone.width / 16) * CFG.streaksPerTile));
    for (let i = 0; i < count; i++) {
      const x = zone.x + ((i + 0.5) / count) * zone.width;
      // Repartidos a lo alto desde el principio: la cortina ya está llena.
      const y = zone.y + ((i * 0.37) % 1) * zone.height;
      this.streaks.push(scene.add.rectangle(x, y, 1, CFG.streakLength, 0xffffff, CFG.streakAlpha).setOrigin(0.5, 0).setDepth(10));
    }
    this.foam = scene.add
      .particles(0, 0, particleKey, {
        speedY: { min: -50, max: -15 },
        speedX: { min: -25, max: 25 },
        gravityY: 120,
        lifespan: 500,
        alpha: { start: 0.8, end: 0 },
        tint: 0xffffff,
        emitting: false,
      })
      .setDepth(10);
  }

  update(deltaMs: number): void {
    const dy = (CFG.streakSpeed * deltaMs) / 1000;
    const z = this.zone;
    for (let i = 0; i < this.streaks.length; i++) {
      const s = this.streaks[i];
      s.y += dy * (1 + (i % 3) * 0.15);
      if (s.y > z.bottom - CFG.streakLength) s.y = z.y;
    }
    this.foamMs += deltaMs;
    const every = 1000 / CFG.foamPerSec;
    while (this.foamMs >= every) {
      this.foamMs -= every;
      this.foam.emitParticleAt(z.x + Math.random() * z.width, z.bottom - 2, 1);
    }
  }
}
