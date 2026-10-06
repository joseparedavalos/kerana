import Phaser from 'phaser';
import { GAMEPLAY } from '../../config/gameplay';

// Dibujo por código de Teju Jagua (S13d): lomo de lagarto, cola y escamas de los cuellos; S20: onda del coletazo; S21: llamarada.
// Las texturas se generan una vez, al doble de detalle (ART_K), y se dibujan a escala 1/ART_K.
// Cuerpo, patas y cola se dibujan ya achicados por `bodySize` (S20): con pixelArt, escalar la imagen ensuciaría el dibujo.
const CFG = GAMEPLAY.tejuJagua;

export const BODY_TEXTURE = 'teju_jagua_body';
export const TAIL_TEXTURE = 'teju_jagua_tail';
export const NECK_SCALE_TEXTURE = 'teju_jagua_neck_scale';
export const WAVE_TEXTURE = 'teju_jagua_wave';
/** Píxeles de textura por unidad del mundo. */
export const ART_K = 2;
/** Píxeles de textura por unidad del cuerpo a tamaño 1 (cuerpo, patas y cola): incluye `bodySize`. */
const BK = ART_K * CFG.bodySize;
/** Colores de la onda del coletazo: tierra, sombra, borde claro y piedritas. */
const WAVE_COLOR = 0xc9a66b;
const WAVE_DARK = 0x6e5434;
const WAVE_LIGHT = 0xecd8a8;
const WAVE_ROCK = 0x4a3a28;
/** Polvo que levanta la onda por encima de la cresta (unidades). */
const WAVE_SPRAY = 7;
/** Lado de la textura de una escama del cuello (px); se escala al grosor del cuello. */
export const NECK_SCALE_PX = 16;
/** Las patas salen un poco por fuera del montículo (unidades a cada lado). */
const LEG_OUT = 24;

/** Origen de la cola (fracciones de su textura): la base, que queda detrás del cuerpo. */
export function tailOrigin(): [number, number] {
  const { w, h } = tailSize();
  const bw = CFG.tailBaseWidth;
  return [bw / 2 / w, (h - bw / 2) / h];
}

function tailSize(): { w: number; h: number } {
  return { w: CFG.tailLength + CFG.tailBaseWidth, h: CFG.tailRise + CFG.tailBaseWidth };
}

/** Lomo (de la cima al suelo: `floorOffset` = suelo − centro del cuerpo), cola y escama del cuello. */
export function ensureTejuJaguaArt(scene: Phaser.Scene, floorOffset: number): void {
  if (!scene.textures.exists(NECK_SCALE_TEXTURE)) makeNeckScale(scene);
  if (!scene.textures.exists(BODY_TEXTURE)) makeBody(scene, floorOffset);
  if (!scene.textures.exists(TAIL_TEXTURE)) makeTail(scene);
  if (!scene.textures.exists(WAVE_TEXTURE)) makeWave(scene);
}

/** Escama redonda: borde oscuro, cuerpo gris (el tinte le da el color de la cabeza) y un brillo blanco arriba. */
function makeNeckScale(scene: Phaser.Scene): void {
  const s = NECK_SCALE_PX;
  const shade = Math.round(255 * CFG.neckScaleShade);
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  g.fillStyle(0x262626).fillCircle(s / 2, s / 2, s / 2);
  g.fillStyle(Phaser.Display.Color.GetColor(shade, shade, shade)).fillCircle(s / 2, s / 2 + 0.6, s / 2 - 1.6);
  g.fillStyle(0xffffff).fillEllipse(s / 2 - 1, s / 2 - 3, s * 0.38, s * 0.2);
  g.generateTexture(NECK_SCALE_TEXTURE, s, s);
  g.destroy();
}

/** Ruido estable (0..1) para variar escamas sin Math.random. */
function hash(a: number, b: number): number {
  const v = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return v - Math.floor(v);
}

/** Una escama del lomo: borde oscuro, cuerpo con leve variación y, a veces, un reflejo dorado. */
function bodyScale(g: Phaser.GameObjects.Graphics, x: number, y: number, size: number, seedA: number, seedB: number, goldBoost: number): void {
  const k = BK;
  const sw = size * k;
  const sh = size * 0.8 * k;
  const base = Phaser.Display.Color.IntegerToColor(CFG.bodyColor);
  const shift = Math.round((hash(seedA, seedB) - 0.5) * 18);
  g.fillStyle(CFG.bodyDarkColor).fillEllipse(x * k, y * k, sw, sh);
  g.fillStyle(Phaser.Display.Color.GetColor(base.red + shift, base.green + shift, base.blue + shift)).fillEllipse(x * k, (y - 0.6) * k, sw - 2.5 * k, sh - 2.5 * k);
  if (hash(seedB, seedA) < 0.35 + 0.3 * goldBoost) {
    g.fillStyle(CFG.bodyGoldColor, CFG.bodyGoldAlpha * (0.4 + 0.6 * goldBoost)).fillEllipse((x - size * 0.15) * k, (y - size * 0.18) * k, sw * 0.45, sh * 0.28);
  }
}

function makeBody(scene: Phaser.Scene, floorOffset: number): void {
  const k = BK;
  const a = CFG.bodyWidth / 2;
  const b = CFG.bodyDepth;
  const w = CFG.bodyWidth + 2 * LEG_OUT;
  const h = CFG.bodyTop + floorOffset;
  const cx = w / 2;
  // La cima del óvalo queda en y = 0 (bodyTop sobre el centro del cuerpo).
  const cy = b;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);

  // Montículo: borde oscuro y relleno.
  g.fillStyle(CFG.bodyDarkColor).fillEllipse(cx * k, cy * k, (2 * a + 3) * k, (2 * b + 3) * k);
  g.fillStyle(CFG.bodyColor).fillEllipse(cx * k, cy * k, 2 * a * k, 2 * b * k);

  // Filas de escamas en arco: la curva de la cima, cada fila un poco más abajo (solo dentro del óvalo).
  // Se dibujan de abajo hacia arriba: las de arriba montan sobre las de abajo.
  const rows = Math.ceil(h / CFG.bodyRowStep);
  const size = CFG.bodyScaleSize;
  const halfArc = (Math.PI * (a + b)) / 2;
  const count = Math.round(halfArc / (size * 0.85));
  for (let r = rows; r >= 0; r--) {
    const drop = r * CFG.bodyRowStep;
    const offset = (r % 2) * 0.5;
    for (let i = 0; i <= count; i++) {
      const ang = Math.PI * ((i + offset) / count);
      const x = cx + a * Math.cos(ang);
      const y = cy - b * Math.sin(ang) + drop;
      const dx = (x - cx) / a;
      const dy = (y - cy) / b;
      if (dx * dx + dy * dy > 0.97 || y > h - 4) continue;
      // Más dorado cerca de la cima (la luz viene de arriba).
      const goldBoost = Phaser.Math.Clamp(1 - y / (b * 1.1), 0, 1);
      bodyScale(g, x, y, size, r, i, goldBoost);
    }
  }

  // Cresta del lomo: púas chicas con la punta dorada a lo largo de la cima.
  for (let ang = Math.PI * 1.22; ang <= Math.PI * 1.78; ang += 0.07) {
    const x = cx + a * Math.cos(ang);
    const y = cy + b * Math.sin(ang);
    const nx = Math.cos(ang) / a;
    const ny = Math.sin(ang) / b;
    const nl = Math.hypot(nx, ny);
    const ux = nx / nl;
    const uy = ny / nl;
    const tip = 6;
    g.fillStyle(CFG.bodyDarkColor).fillTriangle(
      (x - uy * 3) * k, (y + ux * 3) * k, (x + uy * 3) * k, (y - ux * 3) * k, (x + ux * tip) * k, (y + uy * tip) * k,
    );
    g.fillStyle(CFG.bodyGoldColor, CFG.bodyGoldAlpha).fillCircle((x + ux * (tip - 1.5)) * k, (y + uy * (tip - 1.5)) * k, 1.1 * k);
  }

  // Sombra del vientre contra el suelo.
  g.fillStyle(CFG.bodyDarkColor, 0.55).fillEllipse(cx * k, h * k, w * 0.85 * k, 26 * k);

  // Patas delanteras a los lados, con garras hacia afuera.
  for (const side of [-1, 1]) drawLeg(g, cx + side * (a - 14), cy + 4, h, side);

  g.generateTexture(BODY_TEXTURE, Math.ceil(w * k), Math.ceil(h * k));
  g.destroy();
}

function drawLeg(g: Phaser.GameObjects.Graphics, sx: number, sy: number, floorY: number, side: number): void {
  const k = BK;
  const fx = sx + side * 12;
  const fy = floorY - 6;
  const shapes = (grow: number, color: number): void => {
    g.fillStyle(color);
    g.fillEllipse(sx * k, sy * k, (40 + grow) * k, (46 + grow) * k);
    // Antebrazo: cuadrilátero del hombro al pie (dos triángulos).
    const w0 = 13 + grow / 2;
    const w1 = 9 + grow / 2;
    g.fillTriangle((sx - w0) * k, sy * k, (sx + w0) * k, sy * k, (fx + w1) * k, fy * k);
    g.fillTriangle((sx - w0) * k, sy * k, (fx + w1) * k, fy * k, (fx - w1) * k, fy * k);
    g.fillEllipse(fx * k, fy * k, (32 + grow) * k, (13 + grow) * k);
  };
  shapes(3, CFG.bodyDarkColor);
  shapes(0, CFG.bodyColor);
  // Escamas del hombro y reflejo dorado.
  for (let i = 0; i < 5; i++) bodyScale(g, sx - 10 + i * 5, sy - 10 + (i % 2) * 6, 9, side * 7 + i, i, 0.8);
  for (let i = 0; i < 3; i++) bodyScale(g, sx + side * (2 + i * 3), sy + 14 + i * 9, 8, side * 3 + i, i + 9, 0.3);
  // Garras: tres, hacia afuera y abajo.
  g.fillStyle(CFG.clawColor);
  for (let i = 0; i < 3; i++) {
    const bx = fx + side * (10 + i * 2.5);
    const by = fy - 3 + i * 3;
    g.fillTriangle(bx * k, (by - 2) * k, bx * k, (by + 2) * k, (bx + side * 7) * k, (by + 3) * k);
  }
}

/** Cola gruesa que sale de un costado, se curva hacia afuera y levanta la punta. */
function makeTail(scene: Phaser.Scene): void {
  const k = BK;
  const { w, h } = tailSize();
  const bw = CFG.tailBaseWidth;
  const x0 = bw / 2;
  const y0 = h - bw / 2;
  const x1 = w * 0.78;
  const y1 = h - bw / 2;
  const x2 = w - CFG.tailTipWidth;
  const y2 = CFG.tailTipWidth + 2;
  const steps = 28;
  const left: Phaser.Math.Vector2[] = [];
  const right: Phaser.Math.Vector2[] = [];
  const centers: { x: number; y: number; width: number }[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const mt = 1 - t;
    const x = mt * mt * x0 + 2 * mt * t * x1 + t * t * x2;
    const y = mt * mt * y0 + 2 * mt * t * y1 + t * t * y2;
    const dx = 2 * mt * (x1 - x0) + 2 * t * (x2 - x1);
    const dy = 2 * mt * (y1 - y0) + 2 * t * (y2 - y1);
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    const half = (bw + (CFG.tailTipWidth - bw) * t) / 2;
    left.push(new Phaser.Math.Vector2((x + nx * half) * k, (y + ny * half) * k));
    right.push(new Phaser.Math.Vector2((x - nx * half) * k, (y - ny * half) * k));
    centers.push({ x, y, width: half * 2 });
  }
  const outline = left.concat(right.reverse());
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  g.lineStyle(3 * k, CFG.bodyDarkColor).strokePoints(outline, true, true);
  g.fillStyle(CFG.bodyColor).fillPoints(outline, true, true);
  // Escamas a lo largo de la cola, más chicas hacia la punta.
  for (let i = 1; i < centers.length - 1; i += 2) {
    const c = centers[i];
    bodyScale(g, c.x, c.y - c.width * 0.12, Math.max(3, c.width * 0.55), i, 42, 0.5);
  }
  g.generateTexture(TAIL_TEXTURE, Math.ceil(w * k), Math.ceil(h * k));
  g.destroy();
}

/** Medidas de la textura de la onda (unidades): estela baja detrás, cresta del tamaño de la hitbox y polvo arriba. */
function waveSize(): { w: number; h: number; crestX: number } {
  const trail = CFG.tailWaveTrail;
  return { w: trail + CFG.tailWaveWidth + 6, h: CFG.tailWaveHeight + WAVE_SPRAY, crestX: trail + CFG.tailWaveWidth / 2 };
}

/** Origen de la onda (fracciones): centro de la cresta, al ras del suelo. Volteada, el centro se refleja. */
export function waveOrigin(flipped: boolean): [number, number] {
  const { w, crestX } = waveSize();
  const ox = crestX / w;
  return [flipped ? 1 - ox : ox, 1];
}

/**
 * Onda de tierra que avanza hacia la derecha (se voltea para ir a la izquierda): una cresta empinada adelante, del
 * mismo ancho y alto que la hitbox, con piedritas y polvo encima; detrás, una estela de lomitas cada vez más bajas.
 */
function makeWave(scene: Phaser.Scene): void {
  const k = ART_K;
  const { w, h } = waveSize();
  const trail = CFG.tailWaveTrail;
  const cw = CFG.tailWaveWidth;
  const ch = CFG.tailWaveHeight;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  const pts: Phaser.Math.Vector2[] = [];
  const steps = 24;

  // Estela: lomitas que se achican hacia atrás (el suelo todavía se mueve por donde pasó).
  pts.push(new Phaser.Math.Vector2(0, h * k));
  for (let i = 0; i <= steps; i++) {
    const u = i / steps;
    const bump = Math.abs(Math.sin(u * Math.PI * 3)) * (0.15 + 0.35 * u);
    pts.push(new Phaser.Math.Vector2(u * trail * k, (h - ch * bump) * k));
  }
  pts.push(new Phaser.Math.Vector2(trail * k, h * k));
  g.fillStyle(WAVE_DARK, 0.85).fillPoints(pts, true, true);

  // Cresta: sube suave desde atrás y cae empinada adelante (se ve que avanza hacia la derecha).
  const crest = (u: number): number => ch * Math.pow(Math.sin(Math.PI * Math.pow(u, 0.7)), 0.9);
  const top: Phaser.Math.Vector2[] = [];
  for (let i = 0; i <= steps; i++) {
    const u = i / steps;
    top.push(new Phaser.Math.Vector2((trail + u * cw) * k, (h - crest(u)) * k));
  }
  const body = [new Phaser.Math.Vector2(trail * k, h * k), ...top, new Phaser.Math.Vector2((trail + cw) * k, h * k)];
  g.fillStyle(WAVE_DARK).fillPoints(body, true, true);
  // Relleno un poco más adentro, para que quede un borde oscuro.
  const inner = body.map((p) => new Phaser.Math.Vector2(p.x, Math.min(h * k, p.y + 1.2 * k)));
  g.fillStyle(WAVE_COLOR).fillPoints(inner, true, true);
  // Borde claro arriba: la luz pega en la cresta.
  g.lineStyle(1.2 * k, WAVE_LIGHT).strokePoints(top.slice(2, steps - 3), false, false);
  // Piedritas metidas en la tierra.
  for (let i = 0; i < 6; i++) {
    const u = 0.15 + 0.12 * i;
    const x = trail + u * cw;
    const y = h - crest(u) * (0.25 + 0.4 * ((i * 37) % 10) / 10);
    g.fillStyle(WAVE_ROCK).fillEllipse(x * k, y * k, 2.6 * k, 1.8 * k);
  }
  // Polvo sobre la cresta y piedritas que saltan hacia adelante.
  g.fillStyle(WAVE_LIGHT, 0.55);
  for (let i = 0; i < 4; i++) {
    const u = 0.3 + 0.15 * i;
    g.fillCircle((trail + u * cw) * k, (h - crest(u) - 2 - (i % 2) * 2) * k, (2.2 - i * 0.3) * k);
  }
  g.fillStyle(WAVE_ROCK);
  g.fillCircle((trail + cw + 2) * k, (h - ch * 0.75) * k, 1 * k);
  g.fillCircle((trail + cw + 4.5) * k, (h - ch * 0.45) * k, 0.8 * k);
  g.fillCircle((trail + cw * 0.85) * k, (h - ch - 4) * k, 0.9 * k);

  g.generateTexture(WAVE_TEXTURE, Math.ceil(w * k), Math.ceil(h * k));
  g.destroy();
}

// ── Llamarada (S21) ─────────────────────────────────────────────────────────

/** Colores del fuego: núcleo casi blanco, chorro amarillo, cuerpo naranja (la zona de daño) y desborde rojizo. */
const FLAME_WHITE = 0xfff4c4;
const FLAME_YELLOW = 0xffd23c;
const FLAME_ORANGE = 0xf08a30;
const FLAME_RED = 0xd8441c;
const HAZE_COLOR = 0xfff0d8;
/** Tramos de los bordes de la llama y de las hebras de calor. */
const FLAME_STEPS = 20;
const HAZE_STEPS = 10;
/** Hebras de aire que tiembla a cada costado de la llama. */
const HAZE_STRANDS = 3;
/** Lenguas claras que bajan por el cuerpo de la llama. */
const FLAME_TONGUES = 9;

/** Ruido suave (0..1) que se mueve con el tiempo: agita los bordes. */
function flicker(y: number, t: number, seed: number): number {
  return 0.5 + 0.3 * Math.sin(y * 0.09 + t * 6.3 + seed) + 0.2 * Math.sin(y * 0.23 - t * 10.1 + seed * 2.7);
}

/** Contornos de la llama: desborde (hacia afuera), cuerpo (= zona, hacia adentro) y banda clara interior. */
const OUTLINE_SPILL = 0;
const OUTLINE_CORE = 1;
const OUTLINE_BAND = 2;

/** Cuánto sale el borde de la zona (negativo: entra), a la altura `y` (`v` = 0 arriba, 1 en el suelo). */
function edgeOffset(zone: Phaser.Geom.Rectangle, mode: number, v: number, y: number, t: number, side: number): number {
  if (mode === OUTLINE_SPILL) return CFG.fireSpill * (0.35 + 0.65 * v) * (0.45 + 0.55 * flicker(y, t, side * 3.1));
  if (mode === OUTLINE_CORE) return -CFG.fireCoreJitter * flicker(y, t, side * 5.7);
  return -(CFG.fireCoreJitter + zone.width * 0.12 * (1 - 0.5 * v) * (0.6 + 0.4 * flicker(y, t, side * 1.9)));
}

function pointPool(n: number): Phaser.Math.Vector2[] {
  const out: Phaser.Math.Vector2[] = [];
  for (let i = 0; i < n; i++) out.push(new Phaser.Math.Vector2());
  return out;
}

/**
 * Dibuja el aliento de fuego y su aviso en un Graphics, cada frame, con puntos preasignados (sin objetos nuevos).
 * El cuerpo naranja ocupa exactamente la zona de daño; lo que desborda (lenguas, suelo iluminado, calor) es tenue.
 */
export class FlameArt {
  private readonly edge = pointPool(2 * FLAME_STEPS + 2);
  private readonly haze = pointPool(HAZE_STEPS + 1);

  constructor(private readonly g: Phaser.GameObjects.Graphics) {}

  clear(): void {
    this.g.clear();
  }

  /**
   * Llamarada sobre `zone` (la hitbox). `mouths`: hocicos de las cabezas, de a pares (x, y). `timeMs`: reloj del fuego.
   * Capas, de atrás hacia adelante: suelo iluminado, desborde tenue, cuerpo (= zona), chorros amarillos y núcleo.
   */
  drawFlame(zone: Phaser.Geom.Rectangle, mouths: readonly number[], timeMs: number): void {
    const g = this.g.clear();
    const t = (timeMs / CFG.fireFlickerMs) * 0.5;
    const top = zone.y;
    const bottom = zone.bottom;
    const jitter = CFG.fireCoreJitter;

    // Suelo iluminado: tenue fuera de la zona, más fuerte adentro.
    g.fillStyle(FLAME_ORANGE, CFG.fireFloorGlowAlpha * (0.8 + 0.2 * Math.sin(t * 7)));
    g.fillEllipse(zone.centerX, bottom, zone.width + 2 * CFG.fireFloorGlow, 12);
    this.hazeStrands(zone, t);

    // Desborde: lenguas rojizas que se agitan y se abren al llegar al suelo.
    this.outline(zone, OUTLINE_SPILL, t);
    g.fillStyle(FLAME_RED, CFG.fireSpillAlpha * (0.85 + 0.15 * Math.sin(t * 11))).fillPoints(this.edge, true, true);

    // Cuerpo: la zona de daño; los bordes se agitan solo hacia adentro.
    this.outline(zone, OUTLINE_CORE, t);
    g.fillStyle(FLAME_ORANGE, CFG.fireCoreAlpha).fillPoints(this.edge, true, true);
    // Banda más clara adentro: el naranja del borde va hacia el amarillo.
    this.outline(zone, OUTLINE_BAND, t);
    g.fillStyle(0xf8a83a, 0.55).fillPoints(this.edge, true, true);

    // Chorros desde cada hocico: se ensanchan al bajar; nunca salen de la zona.
    for (let i = 0; i + 1 < mouths.length; i += 2) {
      const mx = Phaser.Math.Clamp(mouths[i], zone.x + jitter, zone.right - jitter);
      const my = mouths[i + 1];
      const wide = zone.width * CFG.fireJetSpread;
      // Cuello corto entre el hocico y el borde de arriba de la zona (pegado a la cabeza): tenue, como el desborde.
      if (my < top) {
        g.fillStyle(FLAME_YELLOW, CFG.fireSpillAlpha + 0.25);
        g.fillTriangle(mx - 3, my, mx + 3, my, mx + 5, top + 1).fillTriangle(mx - 3, my, mx - 5, top + 1, mx + 5, top + 1);
      }
      this.jet(zone, mx, top, wide, t, i);
      g.fillStyle(FLAME_YELLOW, 0.9).fillPoints(this.edge, true, true);
      this.jet(zone, mx, top, wide * 0.3, t, i + 7);
      g.fillStyle(FLAME_WHITE, 0.8).fillPoints(this.edge, true, true);
    }
    // Lenguas que bajan por el cuerpo: el fuego fluye de los hocicos al suelo.
    for (let k = 0; k < FLAME_TONGUES; k++) {
      const phase = (t * 0.9 + k / FLAME_TONGUES) % 1;
      const x = zone.x + jitter + (zone.width - 2 * jitter) * ((k * 0.618 + 0.13) % 1);
      const y = top + zone.height * phase;
      const len = 26 + 14 * Math.sin(k * 1.7);
      const w = 3 + 2 * (1 - phase);
      const tip = Math.min(bottom, y + len);
      g.fillStyle(k % 2 === 0 ? FLAME_YELLOW : FLAME_WHITE, 0.55 * (1 - phase * 0.6));
      g.fillTriangle(x - w, y, x + w, y, x + Math.sin(t * 8 + k) * 2, tip);
    }
    // Suelo de la zona al rojo blanco donde pega la llama.
    g.fillStyle(FLAME_YELLOW, 0.7).fillRect(zone.x + jitter, bottom - 3, zone.width - 2 * jitter, 3);
  }

  /**
   * Aviso: el suelo de la zona se tiñe desde abajo de las cabezas (`centerX`) hasta los bordes, el aire de la zona
   * brilla y los bordes se marcan. `p`: avance del aviso (0..1).
   */
  drawWarning(zone: Phaser.Geom.Rectangle, centerX: number, p: number, timeMs: number): void {
    const g = this.g.clear();
    const t = timeMs / 1000;
    const sweep = Phaser.Math.Clamp(p / CFG.fireWarnSweep, 0, 1);
    const pulse = 0.85 + 0.15 * Math.sin(t * 22);
    // Columna de aire caliente: crece con el aviso, más intensa abajo.
    const bands = 6;
    for (let i = 0; i < bands; i++) {
      const v = i / bands;
      g.fillStyle(FLAME_ORANGE, CFG.fireWarnColumnAlpha * p * (0.35 + 0.65 * v) * pulse);
      g.fillRect(zone.x, zone.y + zone.height * v, zone.width, zone.height / bands);
    }
    // Bordes de la zona: dos líneas finas de calor, cada vez más claras.
    g.fillStyle(FLAME_YELLOW, 0.7 * p * pulse);
    g.fillRect(zone.x, zone.y, 1, zone.height).fillRect(zone.right - 1, zone.y, 1, zone.height);
    // Suelo que se tiñe: brasa que se extiende desde abajo de las cabezas hasta los dos bordes.
    const left = Phaser.Math.Linear(centerX, zone.x, sweep);
    const right = Phaser.Math.Linear(centerX, zone.right, sweep);
    const glow = CFG.fireWarnGlow * (0.5 + 0.5 * p);
    for (let i = 0; i < 4; i++) {
      const f = 1 - i / 4;
      g.fillStyle(FLAME_ORANGE, CFG.fireWarnFloorAlpha * 0.25 * p * pulse).fillRect(left, zone.bottom - glow * f, right - left, glow * f);
    }
    g.fillStyle(FLAME_RED, CFG.fireWarnFloorAlpha * (0.4 + 0.6 * p) * pulse).fillRect(left, zone.bottom - 4, right - left, 4);
    g.fillStyle(FLAME_YELLOW, CFG.fireWarnFloorAlpha * p * pulse).fillRect(left, zone.bottom - 2, right - left, 2);
  }

  /** Contorno de la zona en `edge`: lado izquierdo de arriba abajo y derecho de abajo arriba. */
  private outline(zone: Phaser.Geom.Rectangle, mode: number, t: number): void {
    const e = this.edge;
    const n = FLAME_STEPS;
    for (let i = 0; i <= n; i++) {
      const v = i / n;
      const y = zone.y + zone.height * v;
      e[i].set(zone.x - edgeOffset(zone, mode, v, y, t, -1), y);
      e[2 * n + 1 - i].set(zone.right + edgeOffset(zone, mode, v, y, t, 1), y);
    }
  }

  /** Cono de un chorro en `edge`: de `startW` en el hocico a `endW` en el suelo, recortado a la zona. */
  private jet(zone: Phaser.Geom.Rectangle, cx: number, top: number, endW: number, t: number, seed: number): void {
    const e = this.edge;
    const n = FLAME_STEPS;
    const bottom = zone.bottom;
    const lo = zone.x + CFG.fireCoreJitter;
    const hi = zone.right - CFG.fireCoreJitter;
    for (let i = 0; i <= n; i++) {
      const v = i / n;
      const y = top + (bottom - top) * v;
      const half = (6 + (endW - 6) * Math.pow(v, 0.8)) / 2;
      const l = half * (0.8 + 0.35 * flicker(y, t, seed));
      const r = half * (0.8 + 0.35 * flicker(y, t, seed + 4.2));
      e[i].set(Phaser.Math.Clamp(cx - l, lo, hi), y);
      e[2 * n + 1 - i].set(Phaser.Math.Clamp(cx + r, lo, hi), y);
    }
  }

  /** Aire que tiembla: hebras finas y onduladas que suben a los costados de la llama. */
  private hazeStrands(zone: Phaser.Geom.Rectangle, t: number): void {
    if (CFG.fireHazeAlpha <= 0) return;
    const g = this.g;
    const pts = this.haze;
    const height = zone.height * 0.75;
    for (let side = -1; side <= 1; side += 2) {
      for (let s = 0; s < HAZE_STRANDS; s++) {
        const baseX = side < 0 ? zone.x - CFG.fireSpill - 4 - s * 7 : zone.right + CFG.fireSpill + 4 + s * 7;
        for (let i = 0; i <= HAZE_STEPS; i++) {
          const v = i / HAZE_STEPS;
          const y = zone.bottom - height * v;
          pts[i].set(baseX + 2.5 * Math.sin(y * 0.12 + t * 9 + s * 2.1), y);
        }
        g.lineStyle(1, HAZE_COLOR, CFG.fireHazeAlpha * (1 - 0.3 * s)).strokePoints(pts, false, false);
      }
    }
  }
}
