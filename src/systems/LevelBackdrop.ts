import Phaser from 'phaser';
import { GAMEPLAY } from '../config/gameplay';
import type { LevelBackgrounds } from '../data/types';
import type { Area } from './lightLogic';
import {
  canopyFill,
  canopyWeights,
  edgeColumns,
  mistLayer,
  mistPuffDither,
  mixColor,
  rainFrame,
  rainMask,
  scrollOffset,
  seeded,
  splitRain,
} from './ambientLogic';
import { backdropClimbHeight, backdropClimbTop, backdropFit, backdropPanX, backdropPanY, backdropTint, caveSpan, rectHidden } from './backdropLogic';
import { CaveLife, DuskGlow, SkyLife, SunShimmer } from './Backdrops';
import { fixedOffset, VIEW } from './View';

const CFG = GAMEPLAY.backdrop;
/** Sobre el fondo lejano (S108): el fondo de cueva tapa lo que va pegado al cielo; su vida va encima. */
const CAVE_DEPTH = 0.4;
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
// S92: con `climb` (Yvága), una imagen más alta que la vista va al ancho de la vista, sin deformar, y se recorre entera
// con el avance vertical (el pie abajo del nivel, el tope arriba). No lleva agrandado, `shiftY` ni relleno.
export class LevelBackdrop {
  private readonly far?: Phaser.GameObjects.Image;
  /** Relleno de la franja destapada arriba de la imagen lejana (S29; S59 por columnas y en degradado). */
  private fill?: Phaser.GameObjects.Image;
  /** Fundido sobre el borde de arriba de la imagen lejana (S29): del color del relleno a transparente. */
  private fillEdge?: Phaser.GameObjects.Image;
  /** S113: el relleno con dosel va a la escala de la imagen y apoyado en su borde (sin fundido: empalma solo). */
  private fillOnImage = false;
  /** Lluvia que cae (S59): fotogramas de la imagen lejana (`<clave>__rain`, `rain_0`…); vacío si el nivel no tiene. */
  private rainFrames: string[] = [];
  /** Copia de la niebla pintada que corre de costado (S59), y dónde está su franja en la imagen (px de arte). */
  private mist?: Phaser.GameObjects.TileSprite;
  private mistAt = { x: 0, y: 0 };
  /** El dosel (S60): bandas de niebla sobre el relleno, con su lugar (S113: los rayos van horneados en el relleno). */
  private canopyMist: { band: Phaser.GameObjects.Image; at: number; speed: number; offset: number }[] = [];
  /** El sol que respira y el reflejo que titila (S96); solo si el nivel define `sun`. */
  private sun?: SunShimmer;
  /** Bandadas y sombras de nubes (S98); solo si el nivel define `skyLife`. */
  private skyLife?: SkyLife;
  /** El atardecer (S108): rayos y bruma en los valles; solo si el nivel define `dusk`. */
  private dusk?: DuskGlow;
  /** La cueva con vida (S108); solo si el nivel define `caveLife`. */
  private caveLife?: CaveLife;
  /** Tramo de la vista donde se ve la cueva (unidades desde el borde izquierdo de la vista), del último cuadro. */
  private readonly caveClip = { left: 0, right: 0 };
  /** El mismo tramo, en la escala en que se ponen las imágenes fijas a la cámara (con el desfase de la vista). */
  private readonly caveScreen = { left: 0, right: 0 };
  /** Dónde estaba la vista en este cuadro (mundo) y el desfase de lo fijo a la cámara: para `hidden`. */
  private readonly viewNow = { x: 0, y: 0, offX: 0, offY: 0, cave: false };
  /**
   * S108: ¿no se ve este rectángulo (en la escala de lo fijo a la cámara)? Fuera de la pantalla, o tapado entero por el
   * fondo de cueva donde se ve o por el cerro macizo. Lo que no se ve no se dibuja (en el primer tramo, casi toda la bruma
   * de los valles de abajo).
   */
  private readonly hidden = (x0: number, y0: number, x1: number, y1: number): boolean => {
    const v = this.viewNow;
    // Fuera de la pantalla (el GPU lo recortaría, pero cada objeto dibujado cuesta igual).
    if (x1 <= v.offX || x0 >= v.offX + VIEW.width || y1 <= v.offY || y0 >= v.offY + VIEW.height) return true;
    if (v.cave && x0 >= this.caveScreen.left && x1 <= this.caveScreen.right) return true;
    const o = this.opaque;
    if (!o) return false;
    return rectHidden(o.mask, o.width, o.height, o.tile, v.x + x0 - v.offX, v.y + y0 - v.offY, v.x + x1 - v.offX, v.y + y1 - v.offY);
  };
  /** Para las capturas (S108): con false, los rayos, la bruma, las bandadas y la vida de la cueva no se dibujan. */
  private lifeOn = true;
  private readonly cave?: Phaser.GameObjects.Image;
  private readonly edges: Phaser.GameObjects.Image[] = [];
  private readonly caves: Area[] = [];
  private readonly brightness: number;
  private readonly fit: { scale: number; top: number };
  /** Cuánto baja el fondo con la vista arriba del nivel (S28; 0 si el nivel no tiene alto para desplazarse). Lo de arriba lo cubre `fill`. */
  private readonly travelY: number;
  /** Lo más que puede destapar el desplazamiento arriba de la imagen (unidades de la vista; ≤ 0 si nunca). */
  private readonly maxUncovered: number;
  /** Fondo de subida (S92): lo que la imagen le sobra a la vista en alto (unidades); 0 si el nivel no lo usa. */
  private readonly climbTravel: number;

  constructor(
    private readonly scene: Phaser.Scene,
    defs: LevelBackgrounds,
    private readonly mapWidth: number,
    private readonly mapHeight: number,
    /** «Destellos» de Opciones (S96): apagado, el sol no respira ni titila el reflejo. */
    private readonly flashes: () => boolean = () => true,
    /** S108: qué tiles tapan del todo lo que va detrás (`opaqueMask`), con su ancho, alto y lado; sin él, nada tapa. */
    private readonly opaque?: { mask: Uint8Array; width: number; height: number; tile: number },
  ) {
    this.brightness = defs.brightness ?? 1;
    this.climbTravel = defs.climb ? Math.max(0, this.climbHeight(defs.far) - VIEW.height) : 0;
    const climb = this.climbTravel > 0;
    this.travelY = climb ? 0 : CFG.panYRange * Math.max(0, mapHeight - VIEW.height);
    this.fit = climb ? { scale: 1, top: 0 } : backdropFit(VIEW.height, CFG.overscale, defs.shiftY ?? 0);
    this.maxUncovered = this.fit.top + this.travelY;
    this.far = this.makeImage(defs.far, climb ? this.climbTravel + VIEW.height : undefined);
    if (this.far && defs.far) {
      if (this.maxUncovered > 0) this.makeFill(defs.far, defs.fillTop, defs.canopy === true);
      if (defs.rain) this.makeRain(defs.far);
      if (defs.mist) this.makeMist(defs.far, defs.mist.region);
      const farPixels = defs.sun || defs.dusk ? this.pixels(defs.far) : undefined;
      if (defs.sun) this.sun = new SunShimmer(scene, defs.sun, farPixels, CFG.depth + 0.3);
      if (defs.skyLife) this.skyLife = new SkyLife(scene, defs.skyLife, this.far.frame.width, CFG.depth + 0.3);
      // S108: detrás de las bandadas; el fondo de cueva (encima) lo tapa donde se ve la cueva.
      if (defs.dusk) this.dusk = new DuskGlow(scene, defs.dusk, defs.far, farPixels, CFG.depth + 0.1);
    }
    this.cave = this.makeImage(defs.cave);
    if (this.cave) {
      // S108: el fondo de cueva va encima de todo lo de afuera (rayos, bruma, bandadas): lo de afuera no se ve adentro.
      this.cave.setVisible(false).setDepth(CFG.depth + CAVE_DEPTH);
      if (defs.caveLife && defs.cave) {
        this.caveLife = new CaveLife(scene, defs.caveLife, defs.cave, this.pixels(defs.cave), this.cave.frame.width, CFG.depth + CAVE_DEPTH + 0.05);
      }
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
    return [
      this.far,
      this.cave,
      this.fill,
      this.fillEdge,
      this.mist,
      ...(this.sun?.layers ?? []),
      ...(this.skyLife?.layers ?? []),
      ...(this.dusk?.layers ?? []),
      ...(this.caveLife?.layers ?? []),
      ...this.canopyMist.map((m) => m.band),
    ].filter(
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
    // S92: en una subida la imagen baja entera con el avance; si no, el desplazamiento corto de S28.
    const panY =
      this.climbTravel > 0
        ? backdropClimbTop(cam.worldView.y, this.mapHeight - VIEW.height, this.climbTravel)
        : backdropPanY(cam.worldView.y, this.mapHeight - VIEW.height, this.travelY);
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
      // S113: el dosel va al píxel de la imagen, con su borde de abajo pegado al de arriba de la imagen.
      this.fill?.setPosition(left, this.fillOnImage ? imageTop : imageTop - this.maxUncovered);
      this.fillEdge?.setPosition(left, imageTop);
    }
    this.updateCanopy(show, left, imageTop - this.maxUncovered);
    if (this.cave) this.updateCave(cam.worldView.x, off, panX);
    this.viewNow.x = cam.worldView.x;
    this.viewNow.y = cam.worldView.y;
    this.viewNow.offX = off.x;
    this.viewNow.offY = off.y;
    this.viewNow.cave = this.cave?.visible === true;
    this.caveScreen.left = off.x + this.caveClip.left;
    this.caveScreen.right = off.x + this.caveClip.right;
    this.updateAmbient(left, imageTop);
    if (ambient !== undefined) this.applyTint(ambient);
  }

  private updateCave(viewX: number, off: { x: number; y: number }, panX: number): void {
    const cave = this.cave!;
    const span = caveSpan(viewX, VIEW.width, this.caves);
    const left = span ? Math.max(0, span.left) : 0;
    const right = span ? Math.min(VIEW.width, span.right) : 0;
    cave.setVisible(span !== null);
    this.caveClip.left = left;
    this.caveClip.right = right;
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
    // S96: en los mismos px de arte que la imagen (su esquina y su escala), así se mueve con ella en todo el nivel.
    this.sun?.update(left, imageTop, this.far?.scaleX ?? 1, this.far?.scaleY ?? 1, now, visible && this.flashes());
    // S108: la vista está afuera de la cueva si su centro no cae en el tramo de cueva (la espera de los loros empieza ahí).
    const caveOn = this.cave?.visible === true;
    const mid = VIEW.width / 2;
    const outside = !caveOn || this.caveClip.left > mid || this.caveClip.right < mid;
    const life = this.lifeOn;
    // S98: igual que el sol, en px de arte de la imagen; no titila, así que no depende de «Destellos».
    this.skyLife?.update(left, imageTop, this.far?.scaleX ?? 1, this.far?.scaleY ?? 1, now, visible && life, outside);
    // S108: el atardecer y la cueva, en px de arte de su imagen (las dos quedan en el mismo lugar).
    this.dusk?.update(left, imageTop, this.far?.scaleX ?? 1, this.far?.scaleY ?? 1, now, visible && life, !this.flashes(), this.hidden);
    if (this.caveLife && this.cave) {
      this.caveLife.update(left, imageTop, this.cave.scaleX, this.cave.scaleY, now, caveOn && life, this.caveScreen, this.flashes());
    }
  }

  /**
   * El dosel (S60): las bandas de niebla corren de costado. Siguen al relleno y solo se dibujan cuando hay franja
   * destapada. Tiempo de juego: se paran con la pausa. (S113: los rayos van quietos, horneados en el relleno.)
   */
  private updateCanopy(show: boolean, left: number, fillTop: number): void {
    if (this.canopyMist.length === 0) return;
    const now = this.scene.time.now;
    const width = this.far!.displayWidth;
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
  get debugState(): {
    images: number;
    far: boolean;
    cave: boolean;
    edges: number;
    climb: number;
    farTop: number;
    farHeight: number;
    sun: ReturnType<SunShimmer['debugState']> | null;
    skyLife: ReturnType<SkyLife['debugState']> | null;
    dusk: ReturnType<DuskGlow['debugState']> | null;
    caveLife: ReturnType<CaveLife['debugState']> | null;
    /** S108: dónde quedó la esquina de las imágenes en la vista (unidades) y cuántas unidades mide un px de arte. */
    art: { left: number; top: number; scale: number };
  } {
    return {
      images: this.images.length,
      far: this.far?.visible ?? false,
      cave: this.cave?.visible ?? false,
      edges: this.edges.filter((e) => e.visible).length,
      // S92: recorrido del fondo de subida, y dónde quedó la imagen lejana en la vista (borde de arriba y alto, unidades).
      climb: this.climbTravel,
      farTop: this.far ? this.far.y - fixedOffset(this.scene.cameras.main).y : 0,
      farHeight: this.far?.displayHeight ?? 0,
      sun: this.sun?.debugState() ?? null,
      skyLife: this.skyLife?.debugState() ?? null,
      dusk: this.dusk?.debugState() ?? null,
      caveLife: this.caveLife?.debugState() ?? null,
      art: this.images[0]
        ? { left: this.images[0].x - fixedOffset(this.scene.cameras.main).x, top: this.images[0].y - fixedOffset(this.scene.cameras.main).y, scale: this.images[0].scaleX }
        : { left: 0, top: 0, scale: 1 },
    };
  }

  /** Para las capturas (S98): que la próxima bandada salga ya. */
  debugLaunchFlock(): void {
    this.skyLife?.debugLaunch(this.scene.time.now);
  }

  /** Para medir (S108): apagar partes del atardecer (`rays`, `glow`, `mist`, `covers`). */
  debugDuskParts(parts: Partial<DuskGlow['parts']>): void {
    if (this.dusk) Object.assign(this.dusk.parts, parts);
  }

  /** Para las capturas (S108): el mismo cuadro con y sin la vida del fondo. */
  debugShowLife(on: boolean): void {
    this.lifeOn = on;
  }

  /** Para las capturas (S108): que el próximo grupo de murciélagos y el próximo destello de cristal salgan ya. */
  debugLaunchCave(): void {
    this.caveLife?.debugLaunch(this.scene.time.now);
  }

  private applyTint(ambient: number): void {
    const tint = backdropTint(this.brightness, ambient);
    for (const img of this.images) img.setTint(tint);
    this.fill?.setTint(tint);
    this.fillEdge?.setTint(tint);
    this.mist?.setTint(tint);
    this.dusk?.setTint(tint);
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
        const hex = (h: string) => Phaser.Display.Color.HexStringToColor(h).color;
        const weights = canopyWeights(edge, top, cc.darkLo, cc.darkHi);
        // S113: las primeras filas de la imagen sin las rayas de lluvia: la franja de abajo del dosel las copia.
        const rows = Math.min(src.height, cc.blend);
        const head = src.data.subarray(0, src.width * rows * 4);
        const clean = new Uint8ClampedArray(head.length);
        splitRain(head, src.width, rows, rainMask(head, src.width, rows, CFG.rain), clean, new Uint8ClampedArray(head.length));
        const out = new Uint8ClampedArray(big.width * big.height * 4);
        canopyFill(edge, top, big.width, big.height, {
          weights,
          pixel: cc.pixel,
          farHeight: cc.farHeight,
          midHeight: cc.midHeight,
          nearHeight: cc.nearHeight,
          fringeMin: cc.fringeMin,
          fringeMax: cc.fringeMax,
          branches: cc.branches,
          lianas: cc.lianas,
          epiphytes: cc.epiphytes,
          rays: { ...cc.rays, color: hex(cc.rays.color) },
          haze: { ...cc.haze, color: hex(cc.haze.color) },
          blend: cc.blend,
          seed: cc.seed,
        }, out, { data: clean, rows });
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
    const weights = canopyWeightsByKey.get(fillKey);
    this.fillOnImage = canopy && weights !== undefined;
    this.fill = this.scene.add
      .image(0, 0, fillKey)
      .setOrigin(0, this.fillOnImage ? 1 : 0)
      .setScrollFactor(0)
      .setDepth(CFG.depth - 1)
      .setVisible(false);
    // S113: el dosel, píxel a píxel con la imagen (las hojas tienen el tamaño de las del fondo); sin fundido encima.
    if (this.fillOnImage) {
      this.fill.setScale(far.scaleX, far.scaleY);
      this.makeCanopyMotion();
      return;
    }
    this.fill.setDisplaySize(width, Math.ceil(this.maxUncovered) + 1);
    this.fillEdge = this.scene.add
      .image(0, 0, edgeKey)
      .setOrigin(0)
      .setScrollFactor(0)
      .setDisplaySize(width, CFG.fillEdgeHeight)
      .setDepth(CFG.depth + 0.5)
      .setVisible(false);
  }

  /**
   * Las bandas de niebla del dosel (S60): jirones sueltos de una textura chica que se estira (una banda a lo ancho tapaba
   * más pantalla y costaba cuadros). S113: el jirón va tramado en tres escalones y sin filtro (píxeles como los del
   * dosel), y los rayos ya no son imágenes: van horneados en el relleno. Delante del relleno, detrás de todo el nivel.
   */
  private makeCanopyMotion(): void {
    const cc = CFG.canopy;
    const rand = seeded(cc.seed + 1);
    const key = 'bg_canopy_mist';
    // El jirón: un texel por píxel del dosel (≈ 1,7 unidades), para que el tramado tenga el tamaño de las hojas.
    const tw = 96;
    const th = 18;
    if (!this.scene.textures.exists(key)) {
      const alpha = mistPuffDither(tw, th, seeded(cc.seed + 2));
      const data = new Uint8ClampedArray(tw * th * 4);
      alpha.forEach((a, i) => data.set([255, 255, 255, a], i * 4));
      if (!this.canvasTexture(key, tw, th, data)) return;
      this.scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
    }
    cc.mist.forEach((m, i) => {
      for (let k = 0; k < m.puffs; k++) {
        const band = this.scene.add
          .image(0, 0, key)
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

  /** Alto (unidades) de la imagen `key` llevada al ancho de la vista sin deformarla (S92); 0 si falta. */
  private climbHeight(key?: string): number {
    if (!key || !this.scene.textures.exists(key)) return 0;
    const src = this.scene.textures.get(key).getSourceImage();
    return backdropClimbHeight(src.width, src.height, VIEW.width);
  }

  /** `height` (S92): alto propio de un fondo de subida; sin él, el de la vista (con el agrandado). */
  private makeImage(key?: string, height?: number): Phaser.GameObjects.Image | undefined {
    if (!key || !this.scene.textures.exists(key)) return undefined;
    return this.scene.add
      .image(0, 0, key)
      .setOrigin(0)
      .setScrollFactor(0)
      // Arte de 1280 × 720 en una vista de 640 × 360: escala 0,5 (doble detalle), más el agrandado.
      .setDisplaySize(VIEW.width * this.fit.scale, height ?? VIEW.height * this.fit.scale)
      .setDepth(CFG.depth);
  }
}
