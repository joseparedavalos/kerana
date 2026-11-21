import Phaser from 'phaser';
import { GAMEPLAY } from '../config/gameplay';
import { FINE_K } from '../scenes/title/titlePaint';
import { uploadAtlas } from './pixelArt';
import { cloudFrame, driftAtlasFrames, SHOOTING_FRAME } from './skyDriftPaint';
import { driftPosition, type DriftCloud, planDriftClouds, shootingGap, shootingPoseAt } from './skyDriftLogic';
import { VIEW } from './View';

const LOOK = GAMEPLAY.backdrop.skyDrift;
const ATLAS = 'sky_drift';

/**
 * El cielo vivo de Yvága (S118, `skyDrift` en levels.ts): capas de nubes delante del fondo y detrás de todo lo jugable,
 * cada una con su parallax (bajan más despacio que el mundo y más rápido que el fondo mientras se sube) y corriendo de
 * costado; arriba, en la noche, una estrella fugaz cada 10 a 20 s (con «Destellos» apagado, ninguna). Fijas a la cámara,
 * como el fondo: `update` las pone en unidades de la vista. Una sola textura (un lote); solo se dibujan las que se ven.
 */
export class SkyDrift {
  private readonly clouds: DriftCloud[];
  private readonly images: Phaser.GameObjects.Image[];
  private readonly widths: number[];
  private readonly shooting: Phaser.GameObjects.Image;
  private readonly travel: number;
  private shootingAt: number;
  private shootingCount = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    mapHeight: number,
    /** Lo que recorre la imagen del fondo en la subida (LevelBackdrop `climbTravel`). */
    climb: number,
    depth: number,
    private readonly flashes: () => boolean,
  ) {
    uploadAtlas(scene, ATLAS, driftAtlasFrames());
    this.travel = Math.max(0, mapHeight - VIEW.height);
    this.clouds = planDriftClouds(LOOK, this.travel, climb, VIEW.width, VIEW.height, LOOK.seed);
    this.images = this.clouds.map((c) =>
      scene.add
        .image(0, 0, ATLAS, cloudFrame(c.altitude, c.shape))
        .setOrigin(0, 0)
        .setScrollFactor(0)
        .setAlpha(LOOK.layers[c.layer].alpha)
        .setDepth(depth + c.layer * 0.01)
        .setVisible(false),
    );
    this.widths = this.clouds.map((c) => LOOK.sizes[c.altitude][c.shape][0]);
    this.shooting = scene.add
      .image(0, 0, ATLAS, SHOOTING_FRAME)
      .setScale(1 / FINE_K)
      .setScrollFactor(0)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(depth - 0.05)
      .setVisible(false);
    this.shootingAt = shootingGap(LOOK.shooting, 0, LOOK.seed);
  }

  get layers(): Phaser.GameObjects.GameObject[] {
    return [...this.images, this.shooting];
  }

  /**
   * `off`: la esquina de la vista (fixedOffset); `camX`, `camY`: la de la cámara en el mundo; `imageTop`: dónde está el
   * borde de arriba del fondo (mismas unidades que `off`), para saber por dónde va la noche.
   */
  update(off: { x: number; y: number }, camX: number, camY: number, imageTop: number, imageScaleY: number): void {
    const now = this.scene.time.now;
    for (let i = 0; i < this.clouds.length; i++) {
      const c = this.clouds[i];
      const img = this.images[i];
      const w = this.widths[i];
      const pos = driftPosition(c, LOOK.layers[c.layer], w, camX, camY, this.travel, VIEW.width, now);
      const h = img.height;
      const show = pos.y < VIEW.height && pos.y + h > 0 && pos.x < VIEW.width && pos.x + w > 0;
      img.setVisible(show);
      if (show) img.setPosition(off.x + Math.round(pos.x), off.y + Math.round(pos.y));
    }
    this.updateShooting(off, imageTop, imageScaleY, now);
  }

  private updateShooting(off: { x: number; y: number }, imageTop: number, imageScaleY: number, now: number): void {
    const S = LOOK.shooting;
    if (now >= this.shootingAt + S.durationMs) {
      this.shootingCount++;
      this.shootingAt += S.durationMs + shootingGap(S, this.shootingCount, LOOK.seed);
    }
    // La noche: del borde de arriba del fondo hasta `nightBottom` px de arte, en unidades de la vista.
    const top = Math.max(0, imageTop - off.y);
    const bottom = Math.min(VIEW.height, imageTop - off.y + S.nightBottom * imageScaleY);
    const pose = this.flashes() ? shootingPoseAt(S, this.shootingCount, now - this.shootingAt, top, bottom, VIEW.width, LOOK.seed) : null;
    if (!pose) {
      this.shooting.setVisible(false);
      return;
    }
    const fw = this.shooting.frame.width;
    const fh = this.shooting.frame.height;
    // La cabeza está en la esquina de abajo del cuadro (a la derecha; espejado, a la izquierda).
    this.shooting
      .setOrigin(pose.left ? 2 / fw : (fw - 2) / fw, (fh - 2) / fh)
      .setFlipX(pose.left)
      .setPosition(off.x + Math.round(pose.x), off.y + Math.round(pose.y))
      .setAlpha(pose.alpha)
      .setVisible(true);
  }

  /** Para la prueba de humo y las capturas: cuántas nubes se ven y si pasa una estrella fugaz. */
  debugState(): { clouds: number; visible: number; shooting: boolean } {
    return { clouds: this.clouds.length, visible: this.images.filter((i) => i.visible).length, shooting: this.shooting.visible };
  }

  /** Para las capturas: la próxima estrella fugaz sale ya. */
  debugLaunch(): void {
    this.shootingAt = this.scene.time.now;
  }
}
