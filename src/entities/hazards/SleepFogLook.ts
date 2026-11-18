import Phaser from 'phaser';
import { GAMEPLAY } from '../../config/gameplay';
import { uploadAtlas } from '../../systems/pixelArt';
import { SaveManager } from '../../systems/SaveManager';
import { DUST_FRAMES, DUST_K, type FogDust, type FogPuff, fogAtlasFrames, fogDensity, fogDust, fogPuffs, puffFrame, type Zone } from './sleepFogPaint';

// Cómo se ve una zona de niebla del sueño (S103): bocanadas que se arremolinan despacio y respiran, más densas al
// centro, y polvo dorado lento adentro. Solo el dibujo: la zona y el sueño los maneja LevelScene. Se actualiza solo
// cuando la zona está en cámara; no crea nada por cuadro ni usa Math.random.
const LOOK = GAMEPLAY.sleepFogLook;
const ATLAS = 'siesta_fog';
/** Margen (unidades) alrededor de la zona para decidir si está en cámara: las bocanadas salen un poco del borde. */
const CULL_MARGIN = 48;
const TAU = Math.PI * 2;

export class SleepFogLook {
  private readonly puffs: FogPuff[];
  private readonly puffImgs: Phaser.GameObjects.Image[] = [];
  private readonly dust: FogDust[];
  private readonly dustImgs: Phaser.GameObjects.Image[] = [];
  private readonly bounds: Phaser.Geom.Rectangle;
  private clockMs = 0;
  private shown = true;

  constructor(
    scene: Phaser.Scene,
    private readonly zone: Zone,
  ) {
    uploadAtlas(scene, ATLAS, fogAtlasFrames());
    this.bounds = new Phaser.Geom.Rectangle(zone.x - CULL_MARGIN, zone.y - CULL_MARGIN, zone.width + CULL_MARGIN * 2, zone.height + CULL_MARGIN * 2);
    this.puffs = fogPuffs(zone);
    // De atrás para adelante: primero la capa de atrás, después el velo.
    for (const p of this.puffs) {
      const img = scene.add
        .image(p.x, p.y, ATLAS, puffFrame(p.size, p.shape))
        .setDepth(p.front ? LOOK.frontDepth : LOOK.backDepth)
        .setFlipX(p.flipX)
        .setAlpha(p.alpha);
      this.puffImgs.push(img);
    }
    this.dust = fogDust(zone);
    for (let i = 0; i < this.dust.length; i++) {
      this.dustImgs.push(scene.add.image(0, 0, ATLAS, DUST_FRAMES[1]).setScale(1 / DUST_K).setDepth(LOOK.dustDepth).setAlpha(0));
    }
    this.update(0, null);
  }

  /** `view`: lo que ve la cámara (null: dibujar igual). */
  update(deltaMs: number, view: Phaser.Geom.Rectangle | null): void {
    this.clockMs += deltaMs;
    const visible = !view || Phaser.Geom.Rectangle.Overlaps(view, this.bounds);
    if (visible !== this.shown) {
      this.shown = visible;
      for (const img of this.puffImgs) img.setVisible(visible);
      for (const img of this.dustImgs) img.setVisible(visible);
    }
    if (!visible) return;
    const t = this.clockMs;
    for (let i = 0; i < this.puffs.length; i++) {
      const p = this.puffs[i];
      const a = p.phase + (p.dir * TAU * t) / p.swirlMs;
      // Respiración: toda la bruma junta, con un desfase que corre de un lado al otro.
      const b = 0.5 + 0.5 * Math.sin((TAU * t) / LOOK.breathMs + p.breathPhase);
      this.puffImgs[i]
        .setPosition(p.x + Math.cos(a) * p.swirlR, p.y + Math.sin(a) * p.swirlR * LOOK.swirlFlatten - LOOK.breathRise * b)
        .setAlpha(p.alpha * (1 - LOOK.breathAlpha * (1 - b)));
    }
    const calm = !SaveManager.current.settings.flashes;
    const z = this.zone;
    const span = z.height + 6;
    for (let i = 0; i < this.dust.length; i++) {
      const d = this.dust[i];
      // Sube despacio, se mece y vuelve a empezar abajo; se apaga al salir de la bruma.
      const climb = ((t / 1000) * d.rise + d.phase * span) % span;
      const y = z.y + z.height - 2 - climb;
      const x = d.x + Math.sin((TAU * t) / d.swayMs + d.phase * TAU) * LOOK.dustSway;
      const tw = 0.5 + 0.5 * Math.sin((TAU * t) / d.twinkleMs + d.phase * 9);
      const glint = calm ? 0.7 + 0.15 * tw : 0.35 + 0.65 * tw;
      const dens = Math.min(1, fogDensity(z, x, y) * 2);
      const frame = !calm && tw > 0.8 ? DUST_FRAMES[3] : tw > 0.6 ? DUST_FRAMES[2] : tw > 0.25 ? DUST_FRAMES[1] : DUST_FRAMES[0];
      this.dustImgs[i].setPosition(x, y).setFrame(frame).setAlpha(glint * dens);
    }
  }
}
