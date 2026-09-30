import Phaser from 'phaser';
import { GAMEPLAY } from '../config/gameplay';
import type { LevelBackgrounds } from '../data/types';
import { inAnyArea, type Area } from './lightLogic';
import { backdropPanX, backdropTint, stepFade } from './backdropLogic';
import { fixedOffset, VIEW } from './View';

const CFG = GAMEPLAY.backdrop;

// Fondo del nivel (ASSETS §6): una imagen fija a la cámara, un poco agrandada, que se desplaza en horizontal
// según el avance por el nivel (no se repite, así no se ve la unión). En l1, dentro de las zonas `Cave`
// se funde al fondo de cueva. Si falta la imagen, queda el color de fondo de la cámara.
export class LevelBackdrop {
  private readonly far?: Phaser.GameObjects.Image;
  private readonly cave?: Phaser.GameObjects.Image;
  private readonly caves: Area[] = [];
  private readonly brightness: number;
  private caveMix = 0;
  private started = false;

  constructor(
    private readonly scene: Phaser.Scene,
    defs: LevelBackgrounds,
    private readonly mapWidth: number,
  ) {
    this.brightness = defs.brightness ?? 1;
    this.far = this.makeImage(defs.far);
    this.cave = this.makeImage(defs.cave);
    this.cave?.setAlpha(0);
    this.applyTint(0xffffff);
  }

  /** Hay al menos una imagen (si no, el nivel puede dibujar otro fondo). */
  get hasImage(): boolean {
    return this.far !== undefined || this.cave !== undefined;
  }

  get images(): Phaser.GameObjects.Image[] {
    return [this.far, this.cave].filter((img): img is Phaser.GameObjects.Image => img !== undefined);
  }

  addCave(area: Area): void {
    this.caves.push(area);
  }

  /** Posición según la cámara y fundido cielo ↔ cueva según dónde está Kerana. `ambient`: color del nivel oscuro. */
  update(playerX: number, playerY: number, deltaMs: number, ambient?: number): void {
    if (!this.hasImage) return;
    const cam = this.scene.cameras.main;
    const off = fixedOffset(cam);
    const width = VIEW.width * CFG.overscale;
    const height = VIEW.height * CFG.overscale;
    const x = off.x + backdropPanX(cam.worldView.x, this.mapWidth - VIEW.width, width - VIEW.width, CFG.panRange);
    const y = off.y - (height - VIEW.height) / 2;
    for (const img of this.images) img.setPosition(x, y);

    if (this.cave) {
      const target = inAnyArea(playerX, playerY, this.caves) ? 1 : 0;
      this.caveMix = this.started ? stepFade(this.caveMix, target, deltaMs, CFG.fadeMs) : target;
      this.cave.setAlpha(this.caveMix);
      this.far?.setVisible(this.caveMix < 1);
    }
    this.started = true;
    if (ambient !== undefined) this.applyTint(ambient);
  }

  private applyTint(ambient: number): void {
    const tint = backdropTint(this.brightness, ambient);
    for (const img of this.images) img.setTint(tint);
  }

  private makeImage(key?: string): Phaser.GameObjects.Image | undefined {
    if (!key || !this.scene.textures.exists(key)) return undefined;
    return this.scene.add
      .image(0, 0, key)
      .setOrigin(0)
      .setScrollFactor(0)
      // Arte de 1280 × 720 en una vista de 640 × 360: escala 0,5 (doble detalle), más el agrandado.
      .setDisplaySize(VIEW.width * CFG.overscale, VIEW.height * CFG.overscale)
      .setDepth(CFG.depth);
  }
}
