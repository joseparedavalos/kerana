import Phaser from 'phaser';
import { GAMEPLAY } from '../../config/gameplay';

// Dibujo por código de Teju Jagua (S13d): lomo de lagarto, cola y escamas de los cuellos; S20: onda del coletazo.
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
