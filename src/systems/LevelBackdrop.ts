import Phaser from 'phaser';
import { GAMEPLAY } from '../config/gameplay';
import type { LevelBackgrounds } from '../data/types';
import type { Area } from './lightLogic';
import {
  canopyFill,
  canopyWeights,
  edgeColumns,
  mistPuffAlpha,
  mistLayer,
  mixColor,
  rainFrame,
  rainMask,
  rayAlpha,
  rayAnchors,
  scrollOffset,
  seeded,
  splitRain,
} from './ambientLogic';
import { backdropFit, backdropPanX, backdropPanY, backdropTint, caveSpan } from './backdropLogic';
import { fixedOffset, VIEW } from './View';

const CFG = GAMEPLAY.backdrop;
const EDGE_KEY = 'bg_cave_edge';
const FILL_KEY = 'bg_fill_';
/** Cuánto es dosel cada columna del borde (S60), por textura de relleno: las texturas duran toda la partida. */
const canopyWeightsByKey = new Map<string, number[]>();

/** Color `hex` multiplicado por el tinte del fondo (como lo haría el tinte sobre una textura de ese color). */
function mixTint(hex: string, tint: number): number {
  const c = Phaser.Display.Color.HexStringToColor(hex).color;
  const ch = (shift: number) => Math.round((((c >> shift) & 0xff) * ((tint >> shift) & 0xff)) / 255);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

// Fondo del nivel (ASSETS §6): una imagen fija a la cámara, un poco agrandada, que se desplaza en horizontal
// según el avance por el nivel (no se repite, así no se ve la unión). En l1, el fondo de cueva se ve solo
// dentro de las zonas `Cave` (ocupan toda la altura: basta recortarlo en horizontal) y el cielo solo fuera;
// en la boca se ven los dos, con un degradado oscuro en el borde. Si falta la imagen, queda el color de la cámara.
// S29: la escala no depende del alto del nivel (la imagen conserva su tamaño y su proporción); lo que destapa el
// desplazamiento vertical arriba de la imagen lo cubre el color de su borde de arriba, con un fundido sobre el borde.
// S59: ese relleno va por columnas (el color del borde en cada tramo) y, si el nivel define `fillTop`, pasa en
// degradado a ese color hacia arriba (l5: la luz que se filtra por el dosel). La lluvia pintada (l5) cae en
// fotogramas de la propia imagen, como el agua de S47; la niebla pintada (l7) tiene una copia que corre de costado.
// S60: con `canopy` (l5), el relleno lleva las copas horneadas y por encima cruzan bandas de niebla y bajan rayos de luz.
export class LevelBackdrop {
  private readonly far?: Phaser.GameObjects.Image;
  /** Relleno de la franja destapada arriba de la imagen lejana (S29; S59 por columnas y en degradado). */
  private fill?: Phaser.GameObjects.Image;
  /** Fundido sobre el borde de arriba de la imagen lejana (S29): del color del relleno a transparente. */
  private fillEdge?: Phaser.GameObjects.Image;
  /** Lluvia que cae (S59): fotogramas de la imagen lejana (`<clave>__rain`, `rain_0`…); vacío si el nivel no tiene. */
  private rainFrames: string[] = [];
  /** Copia de la niebla pintada que corre de costado (S59), y dónde está su franja en la imagen (px de arte). */
  private mist?: Phaser.GameObjects.TileSprite;
  private mistAt = { x: 0, y: 0 };
  /** El dosel (S60): rayos de luz y bandas de niebla sobre el relleno, con su fase y su lugar. */
  private rays: { img: Phaser.GameObjects.Image; at: number; phase: number }[] = [];
  private canopyMist: { band: Phaser.GameObjects.Image; at: number; speed: number; offset: number }[] = [];
  private readonly cave?: Phaser.GameObjects.Image;
  private readonly edges: Phaser.GameObjects.Image[] = [];
  private readonly caves: Area[] = [];
  private readonly brightness: number;
  private readonly fit: { scale: number; top: number };
  /** Cuánto baja el fondo con la vista arriba del nivel (S28; 0 si el nivel no tiene alto para desplazarse). Lo de arriba lo cubre `fill`. */
  private readonly travelY: number;
  /** Lo más que puede destapar el desplazamiento arriba de la imagen (unidades de la vista; ≤ 0 si nunca). */
  private readonly maxUncovered: number;

  constructor(
    private readonly scene: Phaser.Scene,
    defs: LevelBackgrounds,
    private readonly mapWidth: number,
    private readonly mapHeight: number,
  ) {
    this.brightness = defs.brightness ?? 1;
    this.travelY = CFG.panYRange * Math.max(0, mapHeight - VIEW.height);
    this.fit = backdropFit(VIEW.height, CFG.overscale, defs.shiftY ?? 0);
    this.maxUncovered = this.fit.top + this.travelY;
    this.far = this.makeImage(defs.far);
    if (this.far && defs.far) {
      if (this.maxUncovered > 0) this.makeFill(defs.far, defs.fillTop, defs.canopy === true);
      if (defs.rain) this.makeRain(defs.far);
      if (defs.mist) this.makeMist(defs.far, defs.mist.region);
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

  /** Todo lo que dibuja el fondo (para que la luz del nivel oscuro no lo toque). */
  get layers(): Phaser.GameObjects.GameObject[] {
    return [this.far, this.cave, this.fill, this.fillEdge, this.mist, ...this.rays.map((r) => r.img), ...this.canopyMist.map((m) => m.band)].filter(
      (o): o is NonNullable<typeof o> => o !== undefined,
    );
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
    // El relleno sigue a la imagen como si fuera su continuación hacia arriba (S59): el degradado no se aprieta.
    const left = off.x + panX;
    const imageTop = off.y + uncovered;
    if (show) {
      this.fill?.setPosition(left, imageTop - this.maxUncovered);
      this.fillEdge?.setPosition(left, imageTop);
    }
    this.updateCanopy(show, left, imageTop - this.maxUncovered);
    if (this.cave) this.updateCave(cam.worldView.x, off, panX);
    this.updateAmbient(left, imageTop);
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

  /** Lluvia y niebla (S59): siguen a la imagen y corren con el tiempo de juego (se paran con la pausa). */
  private updateAmbient(left: number, imageTop: number): void {
    const visible = this.far?.visible === true;
    const now = this.scene.time.now;
    if (this.rainFrames.length > 0 && visible) {
      const rc = CFG.rain;
      // Un ciclo corre `period` px de arte; a `speed` unidades/s (px de arte = unidades / escala de la imagen).
      const at = scrollOffset(now, rc.speed / this.far!.scaleY, rc.period) / rc.period;
      this.far!.setFrame(this.rainFrames[Math.floor(at * this.rainFrames.length) % this.rainFrames.length]!);
    }
    if (this.mist) {
      const scale = this.mist.scaleX;
      this.mist.setVisible(visible).setPosition(left + this.mistAt.x * scale, imageTop + this.mistAt.y * this.mist.scaleY);
      this.mist.tilePositionX = -scrollOffset(now, GAMEPLAY.backdrop.mist.speed / scale, this.mist.frame.width);
    }
  }

  /**
   * El dosel (S60): los rayos respiran y se mecen, las bandas de niebla corren de costado. Siguen al relleno y solo se
   * dibujan cuando hay franja destapada. Tiempo de juego: se paran con la pausa.
   */
  private updateCanopy(show: boolean, left: number, fillTop: number): void {
    if (this.rays.length === 0 && this.canopyMist.length === 0) return;
    const rc = CFG.canopy.rays;
    const now = this.scene.time.now;
    const width = this.far!.displayWidth;
    const cycle = (2 * Math.PI * now) / rc.periodMs;
    for (const r of this.rays) {
      r.img.setVisible(show);
      if (!show) continue;
      const sway = rc.sway * Math.sin(cycle * 0.6 + r.phase * 1.7);
      r.img.setPosition(left + r.at * width + sway, fillTop).setAlpha(Math.max(0, rc.alpha + rc.pulse * Math.sin(cycle + r.phase)));
    }
    for (const m of this.canopyMist) {
      m.band.setVisible(show);
      if (!show) continue;
      // Cada jirón cruza el relleno y vuelve a entrar por el otro lado (sale entero antes de volver).
      const lap = width + m.band.displayWidth;
      const x = scrollOffset(now, m.speed, lap) + m.offset * lap;
      m.band.setPosition(left - m.band.displayWidth + (x % lap), fillTop + m.at * this.maxUncovered - m.band.displayHeight / 2);
    }
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
    this.mist?.setTint(tint);
    for (const m of this.canopyMist) m.band.setTint(mixTint(CFG.canopy.mistColor, tint));
  }

  /** Píxeles de la imagen `key` (lienzo de trabajo; se descarta después). */
  private pixels(key: string): ImageData | undefined {
    const src = this.scene.textures.get(key).getSourceImage() as CanvasImageSource & { width: number; height: number };
    const probe = document.createElement('canvas');
    probe.width = src.width;
    probe.height = src.height;
    const ctx = probe.getContext('2d', { willReadFrequently: true });
    if (!ctx) return undefined;
    ctx.drawImage(src, 0, 0);
    return ctx.getImageData(0, 0, src.width, src.height);
  }

  /** Textura de lienzo con estos píxeles (una vez por partida). */
  private canvasTexture(key: string, width: number, height: number, data: Uint8ClampedArray): boolean {
    if (this.scene.textures.exists(key)) return true;
    const tex = this.scene.textures.createCanvas(key, width, height);
    if (!tex) return false;
    const img = tex.getContext().createImageData(width, height);
    img.data.set(data);
    tex.getContext().putImageData(img, 0, 0);
    tex.refresh();
    return true;
  }

  /**
   * Lluvia (S59), como el agua de S47: se separan las rayas pintadas del resto del dibujo y se arman `frames`
   * fotogramas de la imagen entera en los que solo las rayas bajan; la imagen lejana va cambiando de fotograma.
   * No se dibuja nada más (una capa aparte a pantalla completa costaba ~13 cuadros por segundo con el render por
   * software del contenedor); a cambio, la textura pesa `frames` veces la imagen (8 × 1280 × 720 × 4 B ≈ 29 MB).
   * En grilla: lado ≤ 4096 px.
   */
  private makeRain(key: string): void {
    const rc = CFG.rain;
    const rainKey = key + '__rain';
    const names = Array.from({ length: rc.frames }, (_, k) => `rain_${k}`);
    if (!this.scene.textures.exists(rainKey)) {
      const src = this.pixels(key);
      if (!src) return;
      const { width, height } = src;
      const perRow = Math.max(1, Math.floor(4096 / width));
      const cols = Math.min(rc.frames, perRow);
      const tex = this.scene.textures.createCanvas(rainKey, width * cols, height * Math.ceil(rc.frames / cols));
      if (!tex) return;
      const mask = rainMask(src.data, width, height, rc);
      const clean = new Uint8ClampedArray(width * height * 4);
      const rain = new Uint8ClampedArray(width * height * 4);
      splitRain(src.data, width, height, mask, clean, rain);
      const out = tex.getContext().createImageData(width, height);
      names.forEach((name, k) => {
        rainFrame(clean, rain, width, height, rc.period, k / rc.frames, rc.alpha, out.data);
        const x = (k % cols) * width;
        const y = Math.floor(k / cols) * height;
        tex.getContext().putImageData(out, x, y);
        tex.add(name, 0, x, y, width, height);
      });
      tex.refresh();
    }
    this.far!.setTexture(rainKey, names[0]);
    this.rainFrames = names;
  }

  /** Niebla (S59): una copia de la niebla de la franja que corre de costado sobre la quieta, repitiéndose. */
  private makeMist(key: string, region: readonly [number, number, number, number]): void {
    const far = this.far!;
    const mistKey = key + '__mist';
    const src = this.pixels(key);
    if (!src) return;
    const layer = mistLayer(src.data, src.width, src.height, region, CFG.mist, CFG.mist.feather);
    if (layer.width <= 0 || layer.height <= 0) return;
    if (!this.canvasTexture(mistKey, layer.width, layer.height, layer.data)) return;
    this.mistAt = { x: layer.x, y: layer.y };
    this.mist = this.scene.add
      .tileSprite(0, 0, layer.width, layer.height, mistKey)
      .setOrigin(0)
      .setScrollFactor(0)
      .setScale(far.scaleX, far.scaleY)
      .setAlpha(CFG.mist.alpha)
      .setDepth(CFG.depth + 0.25);
  }

  /**
   * Relleno de lo que destapa el desplazamiento vertical (S29): el color de las filas de arriba de la imagen, ahora
   * por columnas (S59), y su fundido (de opaco a transparente) para el borde. Con `fillTop`, el relleno pasa en
   * degradado del borde a ese color hacia arriba. Texturas chicas con filtro lineal: se estiran sin escalones.
   * Solo se dibujan cuando hay franja destapada (ver `update`): una imagen más a pantalla completa costaba muchos
   * cuadros por segundo con el render por software del smoke.
   */
  private makeFill(key: string, fillTop?: string, canopy = false): void {
    const fillKey = FILL_KEY + key + (canopy ? '_canopy' : '');
    const edgeKey = FILL_KEY + key + '_edge';
    const cols = CFG.fillColumns;
    // Alto que no es potencia de 2: WebGL no repite la textura y el filtro lineal no mezcla la fila de arriba con la de abajo.
    const rows = 31;
    const far = this.far!;
    // Con dosel (S60), el relleno va a la resolución de la imagen: las copas tienen forma (no se estiran).
    const big = { width: far.frame.width, height: Math.ceil(this.maxUncovered / far.scaleY) + 1 };
    if (!this.scene.textures.exists(fillKey) || !this.scene.textures.exists(edgeKey)) {
      const src = this.pixels(key);
      if (!src) return;
      const edge = edgeColumns(src.data, src.width, CFG.fillSampleRows, cols, CFG.fillBlur);
      const top = fillTop ? Phaser.Display.Color.HexStringToColor(fillTop).color : undefined;
      const fill = new Uint8ClampedArray(cols * rows * 4);
      const fade = new Uint8ClampedArray(cols * rows * 4);
      for (let y = 0; y < rows; y++) {
        const t = y / (rows - 1);
        for (let x = 0; x < cols; x++) {
          const c = top === undefined ? edge[x]! : mixColor(top, edge[x]!, t);
          const i = (y * cols + x) * 4;
          fill.set([(c >> 16) & 0xff, (c >> 8) & 0xff, c & 0xff, 255], i);
          fade.set([(edge[x]! >> 16) & 0xff, (edge[x]! >> 8) & 0xff, edge[x]! & 0xff, Math.round(255 * (1 - t))], i);
        }
      }
      if (canopy && top !== undefined) {
        const cc = CFG.canopy;
        const pxPerUnit = 1 / far.scaleX;
        const weights = canopyWeights(edge, top, cc.darkLo, cc.darkHi);
        const out = new Uint8ClampedArray(big.width * big.height * 4);
        canopyFill(edge, top, big.width, big.height, {
          weights,
          crownColor: Phaser.Display.Color.HexStringToColor(cc.crownColor).color,
          crownAlpha: cc.crownAlpha,
          crownHeight: cc.crownHeight,
          crownVary: cc.crownVary,
          hazeTop: cc.hazeTop,
          bottomFade: cc.bottomFade,
          fringeMin: cc.fringeMin,
          fringeMax: cc.fringeMax,
          fringeAlpha: cc.fringeAlpha,
          rMin: cc.radiusMin * pxPerUnit,
          rMax: cc.radiusMax * pxPerUnit,
          seed: cc.seed,
        }, out);
        if (!this.canvasTexture(fillKey, big.width, big.height, out)) return;
        canopyWeightsByKey.set(fillKey, weights);
      } else {
        if (!this.canvasTexture(fillKey, cols, rows, fill)) return;
        this.scene.textures.get(fillKey).setFilter(Phaser.Textures.FilterMode.LINEAR);
      }
      if (!this.canvasTexture(edgeKey, cols, rows, fade)) return;
      this.scene.textures.get(edgeKey).setFilter(Phaser.Textures.FilterMode.LINEAR);
    }
    const width = far.displayWidth;
    this.fill = this.scene.add
      .image(0, 0, fillKey)
      .setOrigin(0)
      .setScrollFactor(0)
      .setDisplaySize(width, Math.ceil(this.maxUncovered) + 1)
      .setDepth(CFG.depth - 1)
      .setVisible(false);
    this.fillEdge = this.scene.add
      .image(0, 0, edgeKey)
      .setOrigin(0)
      .setScrollFactor(0)
      .setDisplaySize(width, CFG.fillEdgeHeight)
      .setDepth(CFG.depth + 0.5)
      .setVisible(false);
    const weights = canopyWeightsByKey.get(fillKey);
    if (canopy && weights) this.makeCanopyMotion(weights);
  }

  /**
   * Rayos y bandas de niebla del dosel (S60): una textura chica (un rayo de 16 × 64 px y un jirón de 128 × 32) que se
   * estira. Cada banda son jirones sueltos: una banda a lo ancho tapaba más pantalla y costaba cuadros. Delante del relleno y del fundido del borde, detrás de todo el nivel (profundidad del fondo + 0,6 a 0,8).
   */
  private makeCanopyMotion(weights: number[]): void {
    const cc = CFG.canopy;
    const rand = seeded(cc.seed + 1);
    // Un rayo y un jirón en la misma textura (una sola textura más para el dibujo).
    const key = 'bg_canopy_motion';
    if (!this.scene.textures.exists(key)) {
      const tex = this.scene.textures.createCanvas(key, 128, 96);
      if (!tex) return;
      const put = (alpha: Uint8ClampedArray, w: number, h: number, y: number) => {
        const img = tex.getContext().createImageData(w, h);
        alpha.forEach((a, i) => img.data.set([255, 255, 255, a], i * 4));
        tex.getContext().putImageData(img, 0, y);
        tex.add(y === 0 ? 'puff' : 'ray', 0, 0, y, w, h);
      };
      put(mistPuffAlpha(128, 32, seeded(cc.seed + 2)), 128, 32, 0);
      put(rayAlpha(16, 64), 16, 64, 32);
      tex.refresh();
      tex.setFilter(Phaser.Textures.FilterMode.LINEAR);
    }
    const rc = cc.rays;
    const rayColor = Phaser.Display.Color.HexStringToColor(rc.color).color;
    for (const at of rayAnchors(weights, rc.count, rand)) {
      const img = this.scene.add
        .image(0, 0, key, 'ray')
        .setOrigin(0.5, 0)
        .setScrollFactor(0)
        .setDisplaySize(rc.width, this.maxUncovered * rc.length)
        .setAngle(rc.tiltDeg)
        .setTint(rayColor)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(CFG.depth + 0.6)
        .setVisible(false);
      this.rays.push({ img, at, phase: rand() * Math.PI * 2 });
    }
    cc.mist.forEach((m, i) => {
      for (let k = 0; k < m.puffs; k++) {
        const band = this.scene.add
          .image(0, 0, key, 'puff')
          .setOrigin(0)
          .setScrollFactor(0)
          .setDisplaySize(m.width * (0.8 + 0.4 * rand()), m.height * (0.8 + 0.4 * rand()))
          .setFlipX(rand() < 0.5)
          .setAlpha(m.alpha)
          .setDepth(CFG.depth + 0.7 + i * 0.05)
          .setVisible(false);
        // Repartidos a lo ancho, con un poco de azar; cada banda un poco más arriba o más abajo.
        this.canopyMist.push({ band, at: m.at + (rand() - 0.5) * 0.08, speed: m.speed, offset: (k + 0.6 * rand()) / m.puffs });
      }
    });
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
