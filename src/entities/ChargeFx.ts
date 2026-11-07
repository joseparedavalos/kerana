import Phaser from 'phaser';
import { GAMEPLAY } from '../config/gameplay';
import { ChargeFxMotor, findBlade, pointOnLine, strandShape, type StrandShape } from './chargeFxLogic';

// Dibujo de la carga del tajo cargado (S80, GDD §9.7): hebras que entran al filo, el destello de «listo»
// y el filo encendido. La lógica (cuándo nace cada hebra, cuándo está lista) vive en chargeFxLogic.ts.

const CFG = GAMEPLAY.chargeFx;
/** Estrella de cuatro puntas: el destello de «listo» y las chispas de la descarga. */
export const CHARGE_STAR_KEY = 'fx_charge_star';
/** Lado de la textura de la estrella, en unidades del mundo (se dibuja con `FX_TEX_DETAIL` píxeles por unidad). */
export const CHARGE_STAR_UNITS = 16;
/** La onda de luz como media luna (mira a la derecha). */
export const CRESCENT_KEY = 'fx_light_crescent';
/** Píxeles de textura por unidad del mundo de las texturas de este archivo (como los sprites, GDD §9.2). */
export const FX_TEX_DETAIL = 2;
/** Muestras de la línea del filo por cuadro. */
const LINE_SAMPLES = 9;
/** Profundidad de las hebras y la estrella: la de las chispas del tajo. */
const FX_DEPTH = 12;

/** Línea del filo de cada cuadro, en unidades respecto de los pies y mirando a la derecha. */
type BladeLines = Map<string, Float32Array>;

/** Por textura de personaje: las líneas del filo (la textura recortada queda en el TextureManager, entre escenas). */
const bladeCache = new Map<string, BladeLines>();

/**
 * Recorta el sable de cada cuadro de `key` en una textura propia (`<key>_blade`, mismos cuadros) para encenderlo
 * sin encender el cuerpo, y guarda la línea del filo de cada cuadro. Null si no se puede (sin sprite o sin canvas).
 */
function ensureBlade(scene: Phaser.Scene, key: string, detail: number): BladeLines | null {
  const bladeKey = `${key}_blade`;
  const cached = bladeCache.get(key);
  if (cached && scene.textures.exists(bladeKey)) return cached;
  if (!scene.textures.exists(key)) return null;
  if (scene.textures.exists(bladeKey)) scene.textures.remove(bladeKey);
  const tex = scene.textures.get(key);
  const src = tex.getSourceImage();
  if (!(src instanceof HTMLImageElement || src instanceof HTMLCanvasElement)) return null;
  // Canvas propio para leer píxeles: `willReadFrequently` lo deja en memoria (sin ida y vuelta a la GPU).
  const canvas = document.createElement('canvas');
  canvas.width = src.width;
  canvas.height = src.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(src, 0, 0);
  const img = ctx.getImageData(0, 0, src.width, src.height);
  const out = ctx.createImageData(src.width, src.height);
  const lines: BladeLines = new Map();
  let missing = 0;
  for (const name of tex.getFrameNames()) {
    const f = tex.get(name);
    const { cutX: x0, cutY: y0, cutWidth: w, cutHeight: h } = f;
    const shape = findBlade(img.data, src.width, x0, y0, w, h, CFG.bladeMask, w / 2, h - CFG.pivotHeight * detail, LINE_SAMPLES);
    if (!shape) {
      // Los cuadros vacíos del final de la hoja no cuentan: solo avisa si hay dibujo sin sable.
      if (hasInk(img.data, src.width, x0, y0, w, h)) missing++;
      continue;
    }
    for (let p = 0; p < w * h; p++) {
      if (!shape.mask[p]) continue;
      const i = ((y0 + Math.floor(p / w)) * src.width + x0 + (p % w)) * 4;
      out.data[i] = img.data[i];
      out.data[i + 1] = img.data[i + 1];
      out.data[i + 2] = img.data[i + 2];
      out.data[i + 3] = img.data[i + 3];
    }
    // Píxeles del cuadro → unidades respecto de los pies (origen 0,5, 1 del sprite).
    const line = shape.line;
    for (let k = 0; k < line.length; k += 2) {
      line[k] = (line[k] - w / 2) / detail;
      line[k + 1] = (line[k + 1] - h) / detail;
    }
    lines.set(String(name), line);
  }
  ctx.putImageData(out, 0, 0);
  const canvasTex = scene.textures.addCanvas(bladeKey, canvas);
  if (!canvasTex) return null;
  // Los mismos cuadros (nombre y lugar) que la hoja de Kerana: el sable se dibuja con el cuadro que ella muestra.
  for (const name of tex.getFrameNames()) {
    const f = tex.get(name);
    if (lines.has(String(name))) canvasTex.add(name, 0, f.cutX, f.cutY, f.cutWidth, f.cutHeight);
  }
  if (missing > 0) console.warn(`[SABLE] ${missing} cuadros de "${key}" sin sable: la carga usa el punto de GAMEPLAY.chargeFx.fallbackTip.`);
  bladeCache.set(key, lines);
  return lines;
}

/** ¿Hay algún píxel visible en el cuadro? */
function hasInk(data: Uint8ClampedArray, stride: number, x0: number, y0: number, w: number, h: number): boolean {
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) if (data[(y * stride + x) * 4 + 3] > 0) return true;
  return false;
}

/** Estrella de cuatro puntas blanca (se tiñe): dos rombos finos cruzados y un centro redondo. */
export function ensureChargeStar(scene: Phaser.Scene): string {
  if (scene.textures.exists(CHARGE_STAR_KEY)) return CHARGE_STAR_KEY;
  const s = CHARGE_STAR_UNITS * FX_TEX_DETAIL;
  const c = s / 2;
  const thin = s * 0.09;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  g.fillStyle(0xffffff, 1);
  g.fillPoints([new Phaser.Math.Vector2(c, 0), new Phaser.Math.Vector2(c + thin, c), new Phaser.Math.Vector2(c, s), new Phaser.Math.Vector2(c - thin, c)], true);
  g.fillPoints([new Phaser.Math.Vector2(0, c), new Phaser.Math.Vector2(c, c - thin), new Phaser.Math.Vector2(s, c), new Phaser.Math.Vector2(c, c + thin)], true);
  g.fillCircle(c, c, thin * 1.6);
  g.generateTexture(CHARGE_STAR_KEY, s, s);
  g.destroy();
  return CHARGE_STAR_KEY;
}

/**
 * Media luna de la onda de luz, mirando a la derecha: el borde de adelante y el de atrás son parábolas que se juntan
 * en los cuernos (grosor `thickness` en el centro, 0 en las puntas). Encima, una línea clara en el borde de adelante.
 */
export function ensureCrescent(scene: Phaser.Scene, color: number): string {
  if (scene.textures.exists(CRESCENT_KEY)) return CRESCENT_KEY;
  const cr = CFG.crescent;
  const k = FX_TEX_DETAIL;
  const pad = 1;
  const w = cr.bulge + cr.thickness + cr.halo + pad * 2;
  const h = cr.height + pad * 2;
  const steps = 16;
  const shape = (front: number, back: number): Phaser.Math.Vector2[] => {
    const pts: Phaser.Math.Vector2[] = [];
    // Borde de adelante de arriba abajo, el de atrás de abajo arriba.
    for (let i = 0; i <= steps; i++) {
      const t = -1 + (2 * i) / steps;
      pts.push(new Phaser.Math.Vector2((pad + front * (1 - t * t)) * k, (pad + ((t + 1) * cr.height) / 2) * k));
    }
    for (let i = steps; i >= 0; i--) {
      const t = -1 + (2 * i) / steps;
      pts.push(new Phaser.Math.Vector2((pad + back * (1 - t * t)) * k, (pad + ((t + 1) * cr.height) / 2) * k));
    }
    return pts;
  };
  const front = cr.bulge + cr.thickness;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  // Halo tenue un poco más grande, el cuerpo y la línea clara del borde de adelante: se lee como luz, no como un sólido.
  g.fillStyle(color, cr.haloAlpha).fillPoints(shape(front + cr.halo, Math.max(0, cr.bulge - cr.halo)), true);
  g.fillStyle(color, cr.bodyAlpha).fillPoints(shape(front, cr.bulge), true);
  g.fillStyle(cr.edgeColor, 1).fillPoints(shape(front, front - cr.edge), true);
  g.generateTexture(CRESCENT_KEY, Math.ceil(w * k), Math.ceil(h * k));
  g.destroy();
  return CRESCENT_KEY;
}

/** Lo que ChargeFx lee de Kerana (el sprite y su carga). */
export interface ChargeFxHost {
  readonly x: number;
  readonly y: number;
  readonly flipX: boolean;
  readonly alpha: number;
  readonly depth: number;
  readonly visible: boolean;
  readonly frame: Phaser.Textures.Frame;
  readonly active: boolean;
}

export class ChargeFx {
  private readonly motor = new ChargeFxMotor(CFG.strands);
  private readonly lines: BladeLines | null;
  /** Copia del sable (solo sus píxeles) encima de Kerana: el filo que se enciende. */
  private readonly blade?: Phaser.GameObjects.Image;
  private readonly bladeGlow?: Phaser.Filters.Glow;
  private readonly strands: Phaser.GameObjects.Graphics;
  private readonly star: Phaser.GameObjects.Image;
  private starMsLeft = 0;
  private whiteMsLeft = 0;
  private readonly fallbackLine = new Float32Array([CFG.fallbackBase.x, CFG.fallbackBase.y, CFG.fallbackTip.x, CFG.fallbackTip.y]);
  private readonly shape: StrandShape = { head: 0, length: 0, progress: 0 };
  private readonly pt = { x: 0, y: 0 };
  private destroyed = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly host: ChargeFxHost,
    /** Fracción de la carga (`PlayerMotor.chargeFraction`). */
    private readonly fraction: () => number,
    /** Opción «Destellos» (GDD §4): sin ella no sale el destello de «listo». */
    private readonly flashes: () => boolean,
    /** Textura de Kerana ('' con el placeholder: sin sable que encender) y sus píxeles por unidad. */
    textureKey: string,
    detail: number,
  ) {
    this.lines = textureKey ? ensureBlade(scene, textureKey, detail) : null;
    if (this.lines) {
      this.blade = scene.add
        .image(host.x, host.y, `${textureKey}_blade`)
        .setOrigin(0.5, 1)
        .setScale(1 / detail)
        .setTintMode(Phaser.TintModes.FILL)
        .setVisible(false);
      this.blade.enableFilters();
      this.bladeGlow = this.blade.filters!.internal.addGlow(CFG.bladeGlowColor, CFG.bladeGlowStrength, 0, detail);
      this.bladeGlow.setActive(false);
    }
    // Aditiva: la hebra suma luz al fondo (normal, sobre el azul de la cueva, se leía como un trazo gris).
    this.strands = scene.add.graphics().setDepth(FX_DEPTH).setBlendMode(Phaser.BlendModes.ADD);
    this.star = scene.add
      .image(0, 0, ensureChargeStar(scene))
      .setTint(CFG.readyStarColor)
      .setDepth(FX_DEPTH)
      .setVisible(false);
    // Después de la física: Kerana ya está donde se dibuja (si no, la luz va un cuadro atrás al correr).
    scene.events.on(Phaser.Scenes.Events.POST_UPDATE, this.update, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
  }

  /** Lo que tiene que brillar con luz propia en un nivel oscuro. */
  get objects(): Phaser.GameObjects.GameObject[] {
    return this.blade ? [this.blade, this.strands, this.star] : [this.strands, this.star];
  }

  get phase(): ChargeFxMotor['phase'] {
    return this.motor.phase;
  }

  private update(_time: number, deltaMs: number): void {
    const host = this.host;
    if (!host.active) return;
    const fraction = host.visible ? this.fraction() : 0;
    this.motor.step(deltaMs, fraction);
    if (this.motor.justReady && this.flashes()) {
      this.starMsLeft = CFG.readyStarMs;
      this.whiteMsLeft = CFG.readyWhiteMs;
    }
    this.starMsLeft = Math.max(0, this.starMsLeft - deltaMs);
    this.whiteMsLeft = Math.max(0, this.whiteMsLeft - deltaMs);
    if (this.motor.phase === 'off') {
      this.starMsLeft = 0;
      this.whiteMsLeft = 0;
    }
    const facing = host.flipX ? -1 : 1;
    const line = this.lines?.get(String(host.frame.name)) ?? this.fallbackLine;
    this.drawBlade(fraction, line !== this.fallbackLine);
    this.drawStrands(line, facing);
    this.drawStar(line, facing);
  }

  /** Mientras carga, el filo se calienta poco a poco; lista, queda encendido y quieto (con Glow solo en el sable). */
  private drawBlade(fraction: number, hasBlade: boolean): void {
    const blade = this.blade;
    if (!blade) return;
    const phase = this.motor.phase;
    if (phase === 'off' || !hasBlade) {
      blade.setVisible(false);
      return;
    }
    const host = this.host;
    const ready = phase === 'ready';
    const alpha = ready ? CFG.bladeReadyAlpha : CFG.bladeChargingAlpha * fraction;
    blade
      .setVisible(true)
      .setPosition(host.x, host.y)
      .setFlipX(host.flipX)
      .setFrame(host.frame.name)
      .setDepth(host.depth + 0.5)
      .setTint(this.whiteMsLeft > 0 ? 0xffffff : CFG.bladeColor)
      .setAlpha((this.whiteMsLeft > 0 ? 1 : alpha) * host.alpha);
    this.bladeGlow?.setActive(ready);
  }

  private drawStrands(line: Float32Array, facing: number): void {
    const g = this.strands.clear();
    if (this.motor.phase !== 'charging') return;
    const cfg = CFG.strands;
    const host = this.host;
    for (const s of this.motor.strands) {
      if (!s.active) continue;
      const shape = strandShape(s.ageMs, cfg, this.shape);
      const p = pointOnLine(line, s.along, this.pt);
      const tx = host.x + p.x * facing;
      const ty = host.y + p.y;
      const dx = Math.cos(s.angle) * facing;
      const dy = Math.sin(s.angle);
      const head = shape.head;
      const mid = head + shape.length / 2;
      const tail = head + shape.length;
      const alpha = (cfg.alphaFrom + (cfg.alphaTo - cfg.alphaFrom) * shape.progress) * host.alpha;
      // Cola más tenue que la cabeza: se lee como luz que viaja hacia el filo.
      g.lineStyle(cfg.width, cfg.color, alpha * cfg.tailAlpha).lineBetween(tx + dx * tail, ty + dy * tail, tx + dx * mid, ty + dy * mid);
      g.lineStyle(cfg.width, cfg.color, alpha).lineBetween(tx + dx * mid, ty + dy * mid, tx + dx * head, ty + dy * head);
    }
  }

  /** El destello de «listo»: en la punta, entero y apagándose en seco (sin estela). */
  private drawStar(line: Float32Array, facing: number): void {
    if (this.starMsLeft <= 0) {
      this.star.setVisible(false);
      return;
    }
    const tip = pointOnLine(line, 1, this.pt);
    const t = this.starMsLeft / CFG.readyStarMs;
    const size = CFG.readyStarSize / CHARGE_STAR_UNITS / FX_TEX_DETAIL;
    this.star
      .setVisible(true)
      .setPosition(this.host.x + tip.x * facing, this.host.y + tip.y)
      .setScale(size * (0.4 + 0.6 * t))
      .setAlpha(Math.min(1, t * 2));
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.scene.events.off(Phaser.Scenes.Events.POST_UPDATE, this.update, this);
    this.scene.events.off(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
    this.blade?.destroy();
    this.strands.destroy();
    this.star.destroy();
  }
}
