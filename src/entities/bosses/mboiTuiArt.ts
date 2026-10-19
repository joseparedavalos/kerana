import Phaser from 'phaser';
import { GAMEPLAY } from '../../config/gameplay';

// Dibujo por código del agua de Mbói Tu'i (S41), con el criterio de Teju Jagua (S20, S21): el agua avisa por dónde
// sale. Primero se calma, después se abren los juncos y al final gira un remolino; al salir, chapuzón y ondas.
// Nada de esto hace daño: la zona de daño sigue siendo la cabeza (`headWidth` × `headHeight`).
const CFG = GAMEPLAY.mboiTui;

const WATER = {
  /** Brillo de la superficie: rayitas que corren y el espejo del agua calma. */
  glint: 0xd8f0f0,
  calm: 0x9fd6d8,
  still: 0x1f5a5c,
  whirl: 0xe6f6f4,
  whirlDark: 0x123c40,
  ripple: 0xe6f6f4,
  drop: 0xbfe6ec,
  puddle: 0x3f8f8a,
  puddleDeep: 0x2a6b6a,
  mud: 0x4a3524,
  mudWet: 0x3a2a1c,
} as const;

const REED = { stalk: 0x3f7a35, light: 0x6fa64a, tip: 0x6b4426 } as const;

/** Vueltas del cuerpo enroscado (fase 3): los colores del sprite, más apagados que la cabeza, que es lo único que hace daño. */
export const COIL = {
  outline: 0x13281a,
  back: 0x21492a,
  body: 0x2f6b3a,
  light: 0x5a9a48,
  belly: 0xc8a046,
  scale: 0x1a3d22,
} as const;

/** Vueltas de abajo hacia arriba: semiancho, semialto y altura del centro sobre el suelo (unidades). */
const COIL_LOOPS = [
  { rx: 26, ry: 6, lift: 4 },
  { rx: 20, ry: 5, lift: 10 },
  { rx: 13, ry: 4, lift: 15 },
] as const;
/** Grosor del cuerpo (unidades). */
const COIL_THICK = 6;

const MAX_RIPPLES = 12;
/** Rayitas de brillo por punto (agua en reposo). */
const GLINTS = 3;
const SEGMENTS = 20;

interface WaterPoint {
  x: number;
  /** Semiancho del agua alrededor (las ondas no pasan de ahí). */
  half: number;
  /** Charco del islote (se dibuja el charco y no hay agua honda debajo). */
  puddle: boolean;
  calm: number;
  lean: number;
  whirl: number;
  tCalm: number;
  tLean: number;
  tWhirl: number;
}

interface Ripple {
  point: WaterPoint;
  x: number;
  ageMs: number;
  delayMs: number;
  active: boolean;
}

export class MboiWaterFx {
  private readonly points: WaterPoint[] = [];
  private readonly surface: Phaser.GameObjects.Graphics;
  private readonly reeds: Phaser.GameObjects.Graphics;
  private readonly drops: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly ripples: Ripple[] = [];
  private timeMs = 0;

  /** `xs`: puntos del agua honda; `puddleX`: el islote de la fase 3. */
  constructor(
    scene: Phaser.Scene,
    xs: readonly number[],
    puddleX: number,
    private readonly floorY: number,
  ) {
    for (const x of xs) this.points.push(makePoint(x, CFG.pitHalf, false));
    this.points.push(makePoint(puddleX, CFG.puddleHalf, true));
    // Juncos detrás de Kerana y del agua (la raíz queda bajo la superficie); el agua, delante de los tiles y de los
    // camalotes (depth 3, flotan justo donde sale), detrás del cuello y la cabeza.
    this.reeds = scene.add.graphics().setDepth(-0.5);
    this.surface = scene.add.graphics().setDepth(3.5);
    this.drops = scene.add
      .particles(0, 0, 'fx_particle', {
        speedX: { min: -50, max: 50 },
        speedY: { min: -140, max: -60 },
        gravityY: 420,
        lifespan: 550,
        scale: { start: 0.9, end: 0.4 },
        alpha: { start: 1, end: 0.2 },
        tint: WATER.drop,
        emitting: false,
      })
      .setDepth(6);
    for (let i = 0; i < MAX_RIPPLES; i++) this.ripples.push({ point: this.points[0], x: 0, ageMs: 0, delayMs: 0, active: false });
  }

  /** Índice del charco del islote. */
  get puddleIndex(): number {
    return this.points.length - 1;
  }

  /** Punto más cercano a `x` si está sobre su agua (o -1). */
  pointAt(x: number): number {
    for (let i = 0; i < this.points.length; i++) {
      if (Math.abs(this.points[i].x - x) <= this.points[i].half) return i;
    }
    return -1;
  }

  /** Aviso en el punto `i` con avance `p` (0 a 1). Llamar cada frame mientras dura. */
  warn(i: number, p: number): void {
    const pt = this.points[i];
    if (!pt) return;
    const whirl = clamp01((p - CFG.emergeReedsEnd) / (1 - CFG.emergeReedsEnd));
    pt.tCalm = Math.max(pt.tCalm, clamp01(p / CFG.emergeCalmEnd) * (1 - whirl));
    pt.tLean = Math.max(pt.tLean, clamp01((p - CFG.emergeCalmEnd) / (CFG.emergeReedsEnd - CFG.emergeCalmEnd)));
    pt.tWhirl = Math.max(pt.tWhirl, whirl);
  }

  /** La serpiente está afuera en el punto `i`: los juncos siguen abiertos. Llamar cada frame. */
  occupy(i: number): void {
    const pt = this.points[i];
    if (pt) pt.tLean = 1;
  }

  /** Chapuzón y ondas en el punto `i` (al salir; `strong` false al hundirse). */
  splash(i: number, strong: boolean): void {
    const pt = this.points[i];
    if (!pt) return;
    this.drops.emitParticleAt(pt.x, this.floorY - 2, strong ? CFG.splashDrops : Math.ceil(CFG.splashDrops / 2));
    const count = strong ? CFG.ripplesOnEmerge : 1;
    for (let k = 0; k < count; k++) {
      const r = this.ripples.find((rr) => !rr.active);
      if (!r) break;
      r.point = pt;
      r.x = pt.x;
      r.ageMs = 0;
      r.delayMs = k * CFG.rippleGapMs;
      r.active = true;
    }
    // Al salir el remolino se deshace.
    pt.whirl = 0;
    pt.calm = 0;
  }

  update(deltaMs: number): void {
    this.timeMs += deltaMs;
    const k = 1 - Math.pow(1 - CFG.reedLerp, deltaMs / (1000 / 60));
    for (const pt of this.points) {
      // Sube en el acto (sigue al aviso); baja suave.
      pt.calm = pt.tCalm >= pt.calm ? pt.tCalm : pt.calm + (pt.tCalm - pt.calm) * k * 2;
      pt.whirl = pt.tWhirl >= pt.whirl ? pt.tWhirl : pt.whirl + (pt.tWhirl - pt.whirl) * k * 2;
      pt.lean = pt.tLean >= pt.lean ? pt.lean + (pt.tLean - pt.lean) * Math.min(1, k * 4) : pt.lean + (pt.tLean - pt.lean) * k;
      pt.tCalm = 0;
      pt.tLean = 0;
      pt.tWhirl = 0;
    }
    for (const r of this.ripples) {
      if (!r.active) continue;
      if (r.delayMs > 0) r.delayMs -= deltaMs;
      else r.ageMs += deltaMs;
      if (r.ageMs >= CFG.rippleMs) r.active = false;
    }
    this.draw();
  }

  reset(): void {
    for (const pt of this.points) {
      pt.calm = 0;
      pt.lean = 0;
      pt.whirl = 0;
    }
    for (const r of this.ripples) r.active = false;
    this.drops.killAll();
    this.draw();
  }

  private draw(): void {
    const g = this.surface;
    const y = this.floorY;
    g.clear();
    this.reeds.clear();
    for (const pt of this.points) {
      if (pt.puddle) this.drawPuddle(pt);
      this.drawGlints(pt);
      if (pt.calm > 0.01) {
        // Agua calma: un espejo liso, más claro arriba y quieto debajo.
        g.fillStyle(WATER.still, 0.3 * pt.calm).fillRect(pt.x - pt.half * 0.6, y + 1, pt.half * 1.2, 3);
        g.fillStyle(WATER.calm, 0.55 * pt.calm).fillRect(pt.x - pt.half * 0.55, y, pt.half * 1.1, 1);
      }
      if (pt.whirl > 0.01) this.drawWhirl(pt);
      this.drawReeds(pt);
    }
    for (const r of this.ripples) {
      if (!r.active || r.delayMs > 0) continue;
      const p = r.ageMs / CFG.rippleMs;
      const rx = Math.min(r.point.half, 5 + (CFG.rippleRadius - 5) * p);
      g.lineStyle(1, WATER.ripple, 0.85 * (1 - p));
      ellipsePath(g, r.x, y + 1, rx, Math.max(1, rx * 0.16), 0, Math.PI * 2);
    }
  }

  /** Rayitas de luz que corren por el agua en reposo; se apagan cuando el agua se calma. */
  private drawGlints(pt: WaterPoint): void {
    const a = 0.5 * (1 - pt.calm) * (1 - pt.whirl);
    if (a <= 0.02) return;
    const g = this.surface;
    const span = pt.half * 1.6;
    g.fillStyle(WATER.glint, a);
    for (let i = 0; i < GLINTS; i++) {
      const s = ((this.timeMs * 0.008 + (i * span) / GLINTS + pt.x) % span) - span / 2;
      g.fillRect(pt.x + s - 2, this.floorY + 1 + (i % 2), 4, 1);
    }
  }

  /** Remolino visto casi de costado: anillos aplastados que giran y un hundimiento oscuro en el centro. */
  private drawWhirl(pt: WaterPoint): void {
    const g = this.surface;
    const y = this.floorY + 1;
    const w = pt.whirl;
    const turn = (this.timeMs / 1000) * CFG.whirlTurnsPerS * Math.PI * 2;
    g.fillStyle(WATER.whirlDark, 0.55 * w).fillEllipse(pt.x, y + 0.5, 16 * w + 2, 3);
    for (let ring = 1; ring <= 3; ring++) {
      const rx = (CFG.whirlRadius * ring * w) / 3;
      const ry = Math.max(1, rx * 0.12);
      // Cada anillo es un arco con un hueco que gira; los de adentro, más rápido.
      const a0 = turn * (1.6 - ring * 0.25) + ring;
      g.lineStyle(1, WATER.whirl, (0.9 - ring * 0.15) * w);
      ellipsePath(g, pt.x, y, rx, ry, a0, a0 + Math.PI * 1.35);
    }
  }

  /** Juncos a cada lado del punto: se mecen en reposo y se abren hacia afuera con `lean`. */
  private drawReeds(pt: WaterPoint): void {
    const g = this.reeds;
    const sway = Math.sin((this.timeMs / CFG.reedSwayMs) * Math.PI * 2 + pt.x * 0.05) * CFG.reedSwayDeg;
    const inner = pt.puddle ? pt.half - 6 : CFG.reedInner;
    for (let side = -1; side <= 1; side += 2) {
      for (let i = 0; i < CFG.reedsPerSide; i++) {
        const rootX = pt.x + side * (inner + i * CFG.reedGap);
        const rootY = this.floorY + 3;
        const h = CFG.reedHeight * (1 - ((i * 37) % 5) * 0.07) * (i === CFG.reedsPerSide - 1 ? 0.75 : 1);
        // Los de adentro se abren más.
        const deg = sway * (1 - pt.lean) + side * pt.lean * CFG.reedLeanDeg * (1 - i * 0.18);
        const a = Phaser.Math.DegToRad(deg);
        // Dos tramos: la punta se dobla un poco más.
        const midX = rootX + Math.sin(a * 0.6) * h * 0.55;
        const midY = rootY - Math.cos(a * 0.6) * h * 0.55;
        const tipX = midX + Math.sin(a * 1.3) * h * 0.45;
        const tipY = midY - Math.cos(a * 1.3) * h * 0.45;
        g.lineStyle(1.5, i % 2 === 0 ? REED.stalk : REED.light, 1);
        g.beginPath();
        g.moveTo(rootX, rootY);
        g.lineTo(midX, midY);
        g.lineTo(tipX, tipY);
        g.strokePath();
        if (i % 2 === 1) {
          // Totora: la espiga marrón cerca de la punta.
          const ex = midX + (tipX - midX) * 0.55;
          const ey = midY + (tipY - midY) * 0.55;
          g.fillStyle(REED.tip, 1).fillEllipse(ex, ey, 2.5, 5);
        }
      }
    }
  }

  /** Charco del islote: barro húmedo en el borde y agua quieta en el medio. */
  private drawPuddle(pt: WaterPoint): void {
    const g = this.surface;
    const y = this.floorY;
    g.fillStyle(WATER.mudWet, 1).fillEllipse(pt.x, y + 1.5, pt.half * 2 + 6, 6);
    g.fillStyle(WATER.mud, 1).fillEllipse(pt.x, y + 1, pt.half * 2 + 2, 4);
    g.fillStyle(WATER.puddleDeep, 1).fillEllipse(pt.x, y + 1.5, pt.half * 2 - 4, 3.5);
    g.fillStyle(WATER.puddle, 1).fillEllipse(pt.x, y + 1, pt.half * 2 - 8, 2);
  }
}

/** Vueltas del cuerpo enroscado sobre el charco; `rise` de 0 (bajo el agua) a 1. */
export function drawCoil(g: Phaser.GameObjects.Graphics, x: number, floorY: number, rise: number, alpha: number): void {
  g.clear();
  if (rise <= 0.01 || alpha <= 0) return;
  const t = COIL_THICK;
  for (const loop of COIL_LOOPS) {
    const cy = floorY + 1 - loop.lift * rise;
    const rx = loop.rx;
    const ry = loop.ry;
    // Mitad de atrás (arriba en la elipse): más oscura, la tapa la vuelta de encima.
    g.lineStyle(t + 2, COIL.outline, alpha);
    ellipsePath(g, x, cy, rx, ry, Math.PI, Math.PI * 2);
    g.lineStyle(t, COIL.back, alpha);
    ellipsePath(g, x, cy, rx, ry, Math.PI, Math.PI * 2);
    // Mitad de adelante: cuerpo, brillo del lomo arriba y vientre dorado abajo.
    g.lineStyle(t + 2, COIL.outline, alpha);
    ellipsePath(g, x, cy, rx, ry, 0, Math.PI);
    g.lineStyle(t, COIL.body, alpha);
    ellipsePath(g, x, cy, rx, ry, 0, Math.PI);
    g.lineStyle(1.5, COIL.light, alpha);
    ellipsePath(g, x, cy - t * 0.25, rx, ry, 0.15, Math.PI - 0.15);
    g.lineStyle(1.5, COIL.belly, alpha);
    ellipsePath(g, x, cy + t * 0.3, rx, ry, 0.35, Math.PI - 0.35);
    // Escamas: puntitos oscuros por la mitad de adelante.
    g.fillStyle(COIL.scale, alpha);
    for (let k = 1; k < 8; k++) {
      const a = (Math.PI * k) / 8;
      g.fillRect(x + Math.cos(a) * rx - 0.5, cy + Math.sin(a) * ry - 0.5, 1, 1);
    }
  }
}

function makePoint(x: number, half: number, puddle: boolean): WaterPoint {
  return { x, half, puddle, calm: 0, lean: 0, whirl: 0, tCalm: 0, tLean: 0, tWhirl: 0 };
}

/** Arco de elipse a mano (sin cerrar el camino). */
function ellipsePath(g: Phaser.GameObjects.Graphics, cx: number, cy: number, rx: number, ry: number, a0: number, a1: number): void {
  g.beginPath();
  for (let i = 0; i <= SEGMENTS; i++) {
    const a = a0 + ((a1 - a0) * i) / SEGMENTS;
    const px = cx + Math.cos(a) * rx;
    const py = cy + Math.sin(a) * ry;
    if (i === 0) g.moveTo(px, py);
    else g.lineTo(px, py);
  }
  g.strokePath();
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
