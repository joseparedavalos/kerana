import Phaser from 'phaser';
import { GAMEPLAY } from '../../config/gameplay';
import { uploadAtlas } from '../../systems/pixelArt';
import { STAR_FRAMES, starAtlasFrames, twinkleAt } from './tauStarPaint';

const LOOK = GAMEPLAY.tau.starLook;
const ATLAS = 'tau_stars';
/** Escala de un cuadro del atlas (pintado a `detail` píxeles por unidad) para que mida lo que dice en unidades. */
export const STAR_K = 1 / LOOK.detail;

/**
 * Las siete estrellas de la arena de Tau (S118): el cristal (la imagen que Tau mueve con sus tweens, como antes la
 * estrella de código) y, siguiéndolo, el halo, el destello que titila desfasado y, en la encendida, los rayos. Cada cuadro
 * copia la posición, la escala, el giro y el alfa de su cristal. Corre con el `update` de la escena, también antes de la
 * pelea (se ven desde la antesala). Con «Destellos» apagado no titilan ni respiran.
 */
export class TauStars {
  readonly crystals: Phaser.GameObjects.Image[] = [];
  private readonly halos: Phaser.GameObjects.Image[] = [];
  private readonly glints: Phaser.GameObjects.Image[] = [];
  private readonly rays: Phaser.GameObjects.Image[] = [];
  private readonly lit: boolean[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly flashes: () => boolean,
  ) {
    uploadAtlas(scene, ATLAS, starAtlasFrames());
    scene.events.on(Phaser.Scenes.Events.UPDATE, this.update, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.events.off(Phaser.Scenes.Events.UPDATE, this.update, this));
  }

  /** Una estrella en (x, y): devuelve el cristal (para los tweens de Tau). */
  add(x: number, y: number, depth: number): Phaser.GameObjects.Image {
    const s = this.scene;
    this.halos.push(s.add.image(x, y, ATLAS, STAR_FRAMES.haloIdle).setScale(STAR_K).setDepth(depth - 0.1).setBlendMode(Phaser.BlendModes.ADD));
    this.rays.push(s.add.image(x, y, ATLAS, STAR_FRAMES.rays).setScale(STAR_K).setDepth(depth - 0.05).setBlendMode(Phaser.BlendModes.ADD).setVisible(false));
    const crystal = s.add.image(x, y, ATLAS, STAR_FRAMES.idle).setScale(STAR_K).setDepth(depth);
    this.glints.push(s.add.image(x, y, ATLAS, STAR_FRAMES.glint).setScale(STAR_K).setDepth(depth + 0.05).setBlendMode(Phaser.BlendModes.ADD).setVisible(false));
    this.crystals.push(crystal);
    this.lit.push(false);
    return crystal;
  }

  /** Enciende o apaga la estrella `i` (el cristal dorado, el halo grande y los rayos). `scale`: la de Tau, en unidades. */
  setLit(i: number, lit: boolean, scale: number): void {
    this.lit[i] = lit;
    this.crystals[i].setFrame(lit ? STAR_FRAMES.lit : STAR_FRAMES.idle).setScale(scale * STAR_K);
    this.halos[i].setFrame(lit ? STAR_FRAMES.haloLit : STAR_FRAMES.haloIdle);
    this.rays[i].setVisible(lit);
  }

  private update(): void {
    const now = this.scene.time.now;
    const fx = this.flashes();
    for (let i = 0; i < this.crystals.length; i++) {
      const c = this.crystals[i];
      const lit = this.lit[i];
      // La escala del cristal sobre la de reposo (los tweens de Tau la cambian): el resto la sigue.
      const k = c.scaleX / STAR_K;
      const breath = fx ? 0.5 + 0.5 * Math.sin(now / (lit ? LOOK.litBreathMs : LOOK.idleBreathMs) + i * 1.7) : 0.5;
      const halo = this.halos[i];
      const base = lit ? LOOK.haloLit.alpha : LOOK.haloIdle.alpha;
      halo.setPosition(c.x, c.y).setScale(c.scaleX).setAlpha(c.alpha * (base[0] + (base[1] - base[0]) * breath));
      const ray = this.rays[i];
      if (lit) ray.setPosition(c.x, c.y).setScale(c.scaleX).setAngle(fx ? (now / LOOK.rays.spinMs) * 360 : 0).setAlpha(c.alpha * (0.7 + 0.3 * breath));
      const g = this.glints[i];
      const tw = fx ? (lit ? 0.6 + 0.4 * breath : twinkleAt(i, now)) : 0;
      g.setVisible(tw > 0.02);
      if (tw > 0.02) {
        // El destello cae en la punta de arriba a la izquierda (la que mira a la luz).
        const ox = LOOK.glint.at[0] * k;
        const oy = LOOK.glint.at[1] * k;
        const rad = Phaser.Math.DegToRad(c.angle);
        g.setPosition(c.x + ox * Math.cos(rad) - oy * Math.sin(rad), c.y + ox * Math.sin(rad) + oy * Math.cos(rad))
          .setScale(STAR_K * (0.4 + 0.8 * tw) * (lit ? 1.3 : 1))
          .setAlpha(c.alpha * tw);
      }
    }
  }
}
