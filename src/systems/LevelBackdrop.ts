import Phaser from 'phaser';
import { GAMEPLAY } from '../config/gameplay';
import type { LevelBackgrounds } from '../data/types';
import type { Area } from './lightLogic';
import { averageColor, backdropFit, backdropPanX, backdropPanY, backdropTint, caveSpan } from './backdropLogic';
import { fixedOffset, VIEW } from './View';

const CFG = GAMEPLAY.backdrop;
const EDGE_KEY = 'bg_cave_edge';
const FILL_KEY = 'bg_fill_';

// Fondo del nivel (ASSETS §6): una imagen fija a la cámara, un poco agrandada, que se desplaza en horizontal
// según el avance por el nivel (no se repite, así no se ve la unión). En l1, el fondo de cueva se ve solo
// dentro de las zonas `Cave` (ocupan toda la altura: basta recortarlo en horizontal) y el cielo solo fuera;
// en la boca se ven los dos, con un degradado oscuro en el borde. Si falta la imagen, queda el color de la cámara.
// S29: la escala no depende del alto del nivel (la imagen conserva su tamaño y su proporción); lo que destapa el
// desplazamiento vertical arriba de la imagen lo cubre el color de su borde de arriba, con un fundido sobre el borde.
export class LevelBackdrop {
  private readonly far?: Phaser.GameObjects.Image;
  /** Relleno de la franja destapada arriba de la imagen lejana (S29): el color de su borde de arriba. */
  private readonly fill?: Phaser.GameObjects.Image;
  /** Fundido sobre el borde de arriba de la imagen lejana (S29): del color del relleno a transparente. */
  private readonly fillEdge?: Phaser.GameObjects.Image;
  private readonly cave?: Phaser.GameObjects.Image;
  private readonly edges: Phaser.GameObjects.Image[] = [];
  private readonly caves: Area[] = [];
  private readonly brightness: number;
  private readonly fit: { scale: number; top: number };
  /** Cuánto baja el fondo con la vista arriba del nivel (S28; 0 si el nivel no tiene alto para desplazarse). Lo de arriba lo cubre `fill`. */
  private readonly travelY: number;

  constructor(
    private readonly scene: Phaser.Scene,
    defs: LevelBackgrounds,
    private readonly mapWidth: number,
    private readonly mapHeight: number,
  ) {
    this.brightness = defs.brightness ?? 1;
    this.travelY = CFG.panYRange * Math.max(0, mapHeight - VIEW.height);
    this.fit = backdropFit(VIEW.height, CFG.overscale, defs.shiftY ?? 0);
    this.fill = this.makeFill(defs.far);
    this.far = this.makeImage(defs.far);
    if (this.fill && this.far) {
      this.fillEdge = scene.add
        .image(0, 0, FILL_KEY + defs.far + '_edge')
        .setOrigin(0)
        .setScrollFactor(0)
        .setDisplaySize(VIEW.width, CFG.fillEdgeHeight)
        .setDepth(CFG.depth + 0.5)
        .setVisible(false);
    }
    this.cave = this.makeImage(defs.cave);
    if (this.cave) {
      this.cave.setVisible(false);
      this.makeEdgeTexture();
      for (let i = 0; i < 2; i++) {
        this.edges.push(
          scene.add
            .image(0, 0, EDGE_KEY)
            .setOrigin(0.5, 0)
            .setScrollFactor(0)
            .setDisplaySize(CFG.caveEdgeWidth, VIEW.height)
            .setDepth(CFG.depth + 1)
            .setVisible(false),
        );
      }
    }
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

  /** Posición según la cámara y tramo de cueva a la vista. `ambient`: color del nivel oscuro. */
  update(ambient?: number): void {
    if (!this.hasImage) return;
    const cam = this.scene.cameras.main;
    const off = fixedOffset(cam);
    const width = VIEW.width * this.fit.scale;
    const panX = backdropPanX(cam.worldView.x, this.mapWidth - VIEW.width, width - VIEW.width, CFG.panRange);
    const panY = backdropPanY(cam.worldView.y, this.mapHeight - VIEW.height, this.travelY);
    for (const img of this.images) img.setPosition(off.x + panX, off.y + this.fit.top + panY);
    // Franja destapada arriba de la imagen (unidades de la vista); casi siempre ninguna.
    const uncovered = this.fit.top + panY;
    const show = uncovered > 0 && this.far?.visible === true;
    this.fill?.setVisible(show);
    this.fillEdge?.setVisible(show);
    if (show) {
      this.fill?.setPosition(off.x, off.y).setDisplaySize(VIEW.width, Math.ceil(uncovered));
      this.fillEdge?.setPosition(off.x, off.y + uncovered);
    }
    if (this.cave) this.updateCave(cam.worldView.x, off, panX);
    if (ambient !== undefined) this.applyTint(ambient);
  }

  private updateCave(viewX: number, off: { x: number; y: number }, panX: number): void {
    const cave = this.cave!;
    const span = caveSpan(viewX, VIEW.width, this.caves);
    const left = span ? Math.max(0, span.left) : 0;
    const right = span ? Math.min(VIEW.width, span.right) : 0;
    cave.setVisible(span !== null);
    // Cueva de borde a borde: el cielo no se ve.
    this.far?.setVisible(!span || left > 0 || right < VIEW.width);
    if (span) cave.setCrop((left - panX) / cave.scaleX, 0, (right - left) / cave.scaleX, cave.frame.height);
    // Degradado en cada boca de la cueva que cae dentro del mapa (no en los bordes del nivel).
    this.placeEdge(this.edges[0], span?.left, viewX, off);
    this.placeEdge(this.edges[1], span?.right, viewX, off);
  }

  /** Degradado en `x` (unidades desde el borde izquierdo de la vista), si cae dentro del mapa y cerca de la vista. */
  private placeEdge(edge: Phaser.GameObjects.Image, x: number | undefined, viewX: number, off: { x: number; y: number }): void {
    const show =
      x !== undefined && viewX + x > 0 && viewX + x < this.mapWidth && x > -CFG.caveEdgeWidth && x < VIEW.width + CFG.caveEdgeWidth;
    edge.setVisible(show);
    if (show) edge.setPosition(off.x + x, off.y);
  }

  /** Estado para la prueba de humo. */
  get debugState(): { images: number; far: boolean; cave: boolean; edges: number } {
    return {
      images: this.images.length,
      far: this.far?.visible ?? false,
      cave: this.cave?.visible ?? false,
      edges: this.edges.filter((e) => e.visible).length,
    };
  }

  private applyTint(ambient: number): void {
    const tint = backdropTint(this.brightness, ambient);
    for (const img of this.images) img.setTint(tint);
    this.fill?.setTint(tint);
    this.fillEdge?.setTint(tint);
  }

  /**
   * Relleno de lo que destapa el desplazamiento vertical: el color medio de las filas de arriba de la imagen, y su
   * fundido (de opaco a transparente) para el borde. Solo se dibujan cuando hay franja destapada (ver `update`): una
   * imagen más a pantalla completa costaba muchos cuadros por segundo con el render por software del smoke.
   */
  private makeFill(key?: string): Phaser.GameObjects.Image | undefined {
    if (!key || !this.scene.textures.exists(key)) return undefined;
    const fillKey = FILL_KEY + key;
    if (!this.scene.textures.exists(fillKey)) {
      const src = this.scene.textures.get(key).getSourceImage() as CanvasImageSource & { width: number; height: number };
      const probe = document.createElement('canvas');
      probe.width = src.width;
      probe.height = CFG.fillSampleRows;
      const pctx = probe.getContext('2d', { willReadFrequently: true });
      if (!pctx) return undefined;
      pctx.drawImage(src, 0, 0);
      const top = averageColor(pctx.getImageData(0, 0, src.width, CFG.fillSampleRows).data);
      const rgba = (a: number) => `rgba(${(top >> 16) & 0xff},${(top >> 8) & 0xff},${top & 0xff},${a})`;
      const h = 64;
      const tex = this.scene.textures.createCanvas(fillKey, 4, 4);
      if (!tex) return undefined;
      tex.getContext().fillStyle = rgba(1);
      tex.getContext().fillRect(0, 0, 4, 4);
      tex.refresh();
      const edge = this.scene.textures.createCanvas(fillKey + '_edge', 4, h);
      if (edge) {
        const ectx = edge.getContext();
        const eg = ectx.createLinearGradient(0, 0, 0, h);
        eg.addColorStop(0, rgba(1));
        eg.addColorStop(1, rgba(0));
        ectx.fillStyle = eg;
        ectx.fillRect(0, 0, 4, h);
        edge.refresh();
      }
    }
    return this.scene.add.image(0, 0, fillKey).setOrigin(0).setScrollFactor(0).setDepth(CFG.depth - 1).setVisible(false);
  }

  /** Franja horizontal transparente → oscura → transparente (se estira a lo alto de la vista). */
  private makeEdgeTexture(): void {
    if (this.scene.textures.exists(EDGE_KEY)) return;
    const w = 64;
    const tex = this.scene.textures.createCanvas(EDGE_KEY, w, 4);
    if (!tex) return;
    const ctx = tex.getContext();
    const grad = ctx.createLinearGradient(0, 0, w, 0);
    const color = Phaser.Display.Color.HexStringToColor(CFG.caveEdgeColor);
    const rgba = (a: number) => `rgba(${color.red},${color.green},${color.blue},${a})`;
    grad.addColorStop(0, rgba(0));
    grad.addColorStop(0.5, rgba(CFG.caveEdgeAlpha));
    grad.addColorStop(1, rgba(0));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, 4);
    tex.refresh();
  }

  private makeImage(key?: string): Phaser.GameObjects.Image | undefined {
    if (!key || !this.scene.textures.exists(key)) return undefined;
    return this.scene.add
      .image(0, 0, key)
      .setOrigin(0)
      .setScrollFactor(0)
      // Arte de 1280 × 720 en una vista de 640 × 360: escala 0,5 (doble detalle), más el agrandado.
      .setDisplaySize(VIEW.width * this.fit.scale, VIEW.height * this.fit.scale)
      .setDepth(CFG.depth);
  }
}
