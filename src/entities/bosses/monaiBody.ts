import Phaser from 'phaser';
import { GAMEPLAY } from '../../config/gameplay';
import { Spine, dorsalSides, innerHalf } from './monaiSpine';

// Cuerpo de Moñái como tiras texturizadas (S102). Phaser 4 trae `Rope`: una tira de triángulos que estira una textura a
// lo largo de una lista de puntos, con color y alfa por vértice, y se dibuja en un solo lote. Es mejor que rebanadas
// sueltas para un cuerpo a lo largo de una curva: la piel pintada una vez (monaiPaint.ts) se ve continua (no hay juntas
// entre rebanadas ni huecos del lado de afuera de las curvas), es un objeto por capa y no cientos, y el alfa y el color
// por vértice dejan correr ondas (pulso, furia, golpe) y sombrear las vueltas sin tocar la textura. Los vértices y los
// UV los escribe esta clase (no `Rope.updateVertices`): así el grosor sigue la respiración, el lado de adentro de las
// curvas cerradas no se dobla y el lomo queda arriba. Las cuerdas comparten los arreglos de vértices y de UV.
const LOOK = GAMEPLAY.monaiLook;

/** Capa de cada punto: delante del tronco, detrás del tronco, o detrás pero delante de la copa (S28). */
export const LAYER_FRONT = 0;
export const LAYER_BACK = 1;
export const LAYER_HIGH = 2;

export interface SkinKeys {
  front: string;
  glow: string;
  mask: string;
  dorsal: string;
  dorsalBack: string;
  dorsalGlow: string;
}

/** Tronco cercano (para la sombra en la corteza). */
export interface BarkRect {
  x: number;
  halfWidth: number;
  topY: number;
  bottomY: number;
}

/** Lo que el jefe le pasa a la tira en cada cuadro, además de la columna. */
export interface RigFrame {
  /** Alfa general (el de la cabeza). */
  alpha: number;
  trunk: BarkRect | null;
  /** Peso de la sombra en el tronco (enroscada = 1). */
  trunkShadow: number;
  floorY: number;
  /** La sombra en el piso se corre a la derecha con la altura (luz de arriba a la izquierda). */
  groundLean: number;
}

export class SnakeRig {
  readonly spine: Spine;
  readonly n: number;
  /** Desplazamiento a lo largo de la normal (onda, golpe, recogida): lo llena el jefe antes de `write`. */
  readonly off: Float32Array;
  /** Grosor relativo de cada punto (respiración, hinchazón del enroscado). */
  readonly half: Float32Array;
  readonly layer: Uint8Array;
  /** Cuánto es vuelta del enroscado (0 = de perfil, 1 = de lomo) y su sombreado de cilindro (tinte por punto). */
  readonly coilW: Float32Array;
  readonly coilTint: Uint32Array;
  /** Brillo del lomo (furia, pulso): alfa y color por punto. */
  readonly glowA: Float32Array;
  readonly glowC: Uint32Array;
  /** Destello del golpe por punto. */
  readonly flashA: Float32Array;
  readonly back: Phaser.GameObjects.Rope;
  readonly front: Phaser.GameObjects.Rope;
  readonly coil: Phaser.GameObjects.Rope;
  readonly high: Phaser.GameObjects.Rope;
  readonly glow: Phaser.GameObjects.Rope;
  readonly glowCoil: Phaser.GameObjects.Rope;
  readonly flash: Phaser.GameObjects.Rope;
  readonly trunkShade: Phaser.GameObjects.Rope;
  readonly groundShade: Phaser.GameObjects.Rope;
  private readonly side: Int8Array;
  private readonly verts: Float32Array;
  /** UV de perfil (el lomo del lado que toca) y de lomo (la luz siempre arriba). */
  private readonly uv: Float32Array;
  private readonly uvD: Float32Array;
  private readonly shadeVerts: Float32Array;
  private readonly groundVerts: Float32Array;
  private readonly ropes: Phaser.GameObjects.Rope[];

  constructor(scene: Phaser.Scene, keys: SkinKeys, maxControls: number) {
    const n = LOOK.points;
    this.n = n;
    this.spine = new Spine(n, maxControls);
    this.off = new Float32Array(n);
    this.half = new Float32Array(n).fill(1);
    this.layer = new Uint8Array(n);
    this.coilW = new Float32Array(n);
    this.coilTint = new Uint32Array(n).fill(0xffffff);
    this.glowA = new Float32Array(n);
    this.glowC = new Uint32Array(n).fill(0xffffff);
    this.flashA = new Float32Array(n);
    this.side = new Int8Array(n);
    this.verts = new Float32Array(n * 4);
    this.uv = new Float32Array(n * 4);
    this.uvD = new Float32Array(n * 4);
    this.shadeVerts = new Float32Array(n * 4);
    this.groundVerts = new Float32Array(n * 4);
    const pts = Array.from({ length: n }, (_, i) => ({ x: i, y: 0 }));
    const make = (key: string, verts: Float32Array, uv: Float32Array, fill?: number): Phaser.GameObjects.Rope => {
      const rope = scene.add.rope(0, 0, key, undefined, pts);
      rope.vertices = verts;
      rope.uv = uv;
      rope.dirty = false;
      if (fill !== undefined) {
        rope.tintMode = Phaser.TintModes.FILL;
        rope.colors.fill(fill);
      }
      return rope;
    };
    this.back = make(keys.dorsalBack, this.verts, this.uvD).setDepth(-5);
    this.front = make(keys.front, this.verts, this.uv);
    this.coil = make(keys.dorsal, this.verts, this.uvD);
    this.high = make(keys.dorsalBack, this.verts, this.uvD);
    this.glow = make(keys.glow, this.verts, this.uv, 0xffffff);
    this.glowCoil = make(keys.dorsalGlow, this.verts, this.uvD, 0xffffff);
    // El destello del golpe corre por el dibujo del lomo (la máscara de los rombos), no tapa la silueta entera.
    this.flash = make(keys.glow, this.verts, this.uv, LOOK.hit.flashColor);
    this.trunkShade = make(keys.mask, this.shadeVerts, this.uv, LOOK.palette.shadow);
    this.groundShade = make(keys.mask, this.groundVerts, this.uv, LOOK.palette.shadow);
    this.ropes = [this.back, this.front, this.coil, this.high, this.glow, this.glowCoil, this.flash, this.trunkShade, this.groundShade];
  }

  /** Cuerdas que van a la altura de Kerana, de abajo hacia arriba (`placeBelowPlayer`). */
  playerLayers(): Phaser.GameObjects.Rope[] {
    return [this.groundShade, this.trunkShade, this.high, this.front, this.coil, this.glow, this.glowCoil, this.flash];
  }

  setVisible(on: boolean): void {
    for (const r of this.ropes) r.setVisible(on);
  }

  get objects(): readonly Phaser.GameObjects.Rope[] {
    return this.ropes;
  }

  /**
   * Lado del lomo, decidido sobre la columna antes de la onda y de las recogidas (así no se da vuelta con un temblor).
   * `startSide`: el de la nuca (+1 / -1 respecto de la normal).
   */
  decideSides(startSide: number): void {
    dorsalSides(this.spine.ny, this.n, startSide, LOOK.flipThreshold, this.side, LOOK.flipReach);
  }

  /** Escribe vértices, UV, alfas y colores de todas las cuerdas a partir de la columna ya armada y desplazada. */
  write(f: RigFrame): void {
    const sp = this.spine;
    const n = this.n;
    const visible = sp.ok && f.alpha > 0;
    this.setVisible(visible);
    if (!visible) return;
    for (const r of this.ropes) r.setAlpha(f.alpha);
    const H = LOOK.body.halfHeight;
    const len = Math.max(1e-3, sp.length);
    const fr = this.front.frame;
    const u0 = fr.u0;
    const u1 = fr.u1;
    const v0 = fr.v0;
    const v1 = fr.v1;
    const v = this.verts;
    const uv = this.uv;
    const uvD = this.uvD;
    const sv = this.shadeVerts;
    const gv = this.groundVerts;
    const tr = f.trunk;
    const sh = LOOK.shadow;
    for (let i = 0; i < n; i++) {
      // La tira va de la cola a la nuca: lo de adelante (el cuello) queda encima.
      const j = n - 1 - i;
      const q = j * 4;
      const x = sp.x[i];
      const y = sp.y[i];
      const nx = sp.nx[i];
      const ny = sp.ny[i];
      const h = H * this.half[i];
      const k = sp.k[i];
      const minIn = h * LOOK.innerMin;
      const plus = k > 0 ? innerHalf(h, k, LOOK.innerLimit, minIn) : h;
      const minus = k < 0 ? innerHalf(h, k, LOOK.innerLimit, minIn) : h;
      v[q] = x + nx * plus;
      v[q + 1] = y + ny * plus;
      v[q + 2] = x - nx * minus;
      v[q + 3] = y - ny * minus;
      const u = u0 + (sp.s[i] / len) * (u1 - u0);
      const dorsalPlus = this.side[i] > 0;
      uv[q] = u;
      uv[q + 1] = dorsalPlus ? v0 : v1;
      uv[q + 2] = u;
      uv[q + 3] = dorsalPlus ? v1 : v0;
      // De lomo: la luz arriba (el vértice +normal es el de arriba si la normal apunta hacia arriba).
      const plusUp = ny <= 0;
      uvD[q] = u;
      uvD[q + 1] = plusUp ? v0 : v1;
      uvD[q + 2] = u;
      uvD[q + 3] = plusUp ? v1 : v0;
      // Sombra en la corteza: la misma tira corrida abajo a la derecha, solo sobre el tronco.
      for (let e = 0; e < 2; e++) {
        sv[q + e * 2] = v[q + e * 2] + sh.trunkDx;
        sv[q + e * 2 + 1] = v[q + e * 2 + 1] + sh.trunkDy;
      }
      // Sombra en el piso: la columna aplastada sobre el suelo, más tenue cuanto más alto está el cuerpo.
      const lift = Math.max(0, f.floorY - y);
      const gx = x + lift * f.groundLean;
      const gh = sh.groundHalf * this.half[i];
      gv[q] = gx;
      gv[q + 1] = f.floorY - gh;
      gv[q + 2] = gx;
      gv[q + 3] = f.floorY + gh;
      const ga = sh.groundAlpha * Math.max(0, 1 - lift / sh.groundFade);
      const L = this.layer[i];
      const front = L === LAYER_FRONT ? 1 : 0;
      const cw = this.coilW[i];
      // La de atrás va entera bajo los cruces (no se ve el fondo en el cambio de capa); lejos de ellos, solo atrás.
      const nearBack = this.nearLayer(i) ? 1 : 0;
      const a2 = j * 2;
      const set = (r: Phaser.GameObjects.Rope, a: number) => {
        r.alphas[a2] = a;
        r.alphas[a2 + 1] = a;
      };
      set(this.front, front);
      set(this.coil, front * cw);
      this.coil.colors[a2] = this.coil.colors[a2 + 1] = this.coilTint[i];
      set(this.back, nearBack);
      set(this.high, L === LAYER_HIGH ? 1 : 0);
      const ga2 = this.glowA[i] * (front || L === LAYER_HIGH ? 1 : 0.4);
      set(this.glow, ga2 * (1 - cw));
      set(this.glowCoil, ga2 * cw);
      this.glow.colors[a2] = this.glow.colors[a2 + 1] = this.glowC[i];
      this.glowCoil.colors[a2] = this.glowCoil.colors[a2 + 1] = this.glowC[i];
      set(this.flash, this.flashA[i]);
      set(this.groundShade, ga);
      for (let e = 0; e < 2; e++) {
        let ta = 0;
        if (tr && f.trunkShadow > 0 && front) {
          const tx = sv[q + e * 2];
          const ty = sv[q + e * 2 + 1];
          const edge = tr.halfWidth - Math.abs(tx - tr.x);
          const fx = Math.max(0, Math.min(1, edge / 1.5));
          const fy = ty > tr.topY && ty < tr.bottomY ? 1 : 0;
          ta = sh.trunkAlpha * f.trunkShadow * fx * fy;
        }
        this.trunkShade.alphas[a2 + e] = ta;
      }
    }
    for (const r of this.ropes) r.dirty = false;
  }

  /** ¿El punto i es de atrás o está a dos puntos de uno de atrás? (la cuerda de atrás lo cubre). */
  private nearLayer(i: number): boolean {
    for (let d = -2; d <= 2; d++) {
      const k = i + d;
      if (k < 0 || k >= this.n) continue;
      if (this.layer[k] !== LAYER_FRONT) return true;
    }
    return false;
  }
}
