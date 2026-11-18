import Phaser from 'phaser';
import { GAMEPLAY } from '../../config/gameplay';

// Dibujo por código de Teju Jagua. S101: el cuerpo es un lagarto agazapado pintado píxel a píxel una sola vez (volumen
// por formas, luz fría de los cristales, rebote cálido del oro, sombra propia, escamas de Voronoi, placas, cicatrices y
// musgo, con tramado); cuellos y cola son tubos que se dibujan en cada cuadro con colores fijos de la paleta. Se
// conservan la onda del coletazo (S20) y la llamarada (S21). Todo al detalle de las cabezas: ART_K píxeles por unidad.
const CFG = GAMEPLAY.tejuJagua;
const LOOK = GAMEPLAY.tejuJaguaLook;
const PAL = LOOK.palette;

export const BODY_TEXTURE = 'teju_jagua_body';
export const BODY_RIM_TEXTURE = 'teju_jagua_body_rim';
export const COLLAR_TEXTURE = 'teju_jagua_collar';
export const SHADOW_TEXTURE = 'teju_jagua_shadow';
export const HEAD_SHADOW_TEXTURE = 'teju_jagua_head_shadow';
export const GLOW_TEXTURE = 'teju_jagua_glow';
export const WAVE_TEXTURE = 'teju_jagua_wave';
/** Píxeles de textura por unidad del mundo (el mismo `detail` que el sprite de las cabezas). */
export const ART_K = 2;
/** Medidas de la textura del cuerpo (unidades): el origen es el centro del cuerpo, en el suelo. */
export const BODY_HALF_W = 128;
export const BODY_HEIGHT = 124;
/** Variantes del collar (cuadros `c0`… de COLLAR_TEXTURE). */
export const COLLAR_VARIANTS = 3;
/** Resplandor: lado de la textura (px). */
const GLOW_PX = 32;
/** Colores de la onda del coletazo: tierra, sombra, borde claro y piedritas. */
const WAVE_COLOR = 0xc9a66b;
const WAVE_DARK = 0x6e5434;
const WAVE_LIGHT = 0xecd8a8;
const WAVE_ROCK = 0x4a3a28;
/** Polvo que levanta la onda por encima de la cresta (unidades). */
const WAVE_SPRAY = 7;

/** Óvalo del lomo en coordenadas del suelo (unidades, y hacia arriba): de él salen los cuellos y en él duermen las cabezas. */
export interface BodyGeometry {
  /** Semiancho, semieje vertical y altura del centro sobre el suelo. */
  a: number;
  b: number;
  hc: number;
}

/** El mismo óvalo que usa TejuJagua.moundTopY, medido desde el suelo. `floorOffset`: suelo − centro del cuerpo a tamaño 1. */
export function bodyGeometry(floorOffset: number): BodyGeometry {
  const s = CFG.bodySize;
  return { a: (CFG.bodyWidth / 2) * s, b: CFG.bodyDepth * s, hc: (floorOffset - (CFG.bodyDepth - CFG.bodyTop)) * s };
}

/** Respiración en un cuadro del cuerpo: cuánto crece el torso a lo alto (las patas no). */
export function breathLift(frame: number): number {
  return LOOK.breath.frames > 1 ? (frame / (LOOK.breath.frames - 1)) * LOOK.breath.scale : 0;
}

/** Cuerpo, collares, sombras, resplandor y onda: se generan una sola vez por partida. */
export function ensureTejuJaguaArt(scene: Phaser.Scene, floorOffset: number): void {
  const geo = bodyGeometry(floorOffset);
  if (!scene.textures.exists(BODY_TEXTURE)) makeBody(scene, geo);
  if (!scene.textures.exists(COLLAR_TEXTURE)) makeCollars(scene);
  if (!scene.textures.exists(SHADOW_TEXTURE)) makeShadow(scene, SHADOW_TEXTURE, LOOK.shadow.width, LOOK.shadow.height);
  if (!scene.textures.exists(HEAD_SHADOW_TEXTURE)) makeShadow(scene, HEAD_SHADOW_TEXTURE, LOOK.shadow.headWidth, 6);
  if (!scene.textures.exists(GLOW_TEXTURE)) makeGlow(scene);
  if (!scene.textures.exists(WAVE_TEXTURE)) makeWave(scene);
}

// ── Utilidades del pintor ──────────────────────────────────────────────────

const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);
const smooth = (e0: number, e1: number, v: number): number => {
  const t = clamp((v - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};
/** Tramado ordenado 4 × 4 (Bayer). */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const bayer = (i: number, j: number): number => (BAYER[((j & 3) << 2) | (i & 3)] + 0.5) / 16 - 0.5;

/** Azar con semilla (mulberry32): el dibujo sale igual en cada partida. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash2(x: number, y: number, seed: number): number {
  const v = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453;
  return v - Math.floor(v);
}

/** Ruido de valor suave (0..1). */
function vnoise(x: number, y: number, seed: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const fx = x - xi;
  const fy = y - yi;
  const u = fx * fx * (3 - 2 * fx);
  const v = fy * fy * (3 - 2 * fy);
  const a = hash2(xi, yi, seed);
  const b = hash2(xi + 1, yi, seed);
  const c = hash2(xi, yi + 1, seed);
  const d = hash2(xi + 1, yi + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

function norm3(x: number, y: number, z: number): [number, number, number] {
  const l = Math.hypot(x, y, z) || 1;
  return [x / l, y / l, z / l];
}

const LF = norm3(LOOK.light.fill[0], LOOK.light.fill[1], LOOK.light.fill[2]);
const LC = norm3(LOOK.light.cold[0], LOOK.light.cold[1], LOOK.light.cold[2]);
const LW = norm3(LOOK.light.warm[0], LOOK.light.warm[1], LOOK.light.warm[2]);

/**
 * Cuánto pega cada luz de borde en un punto con normal n. La fría viene de los cristales, arriba y a cada costado (x
 * del lado del punto); la cálida del oro, arriba y detrás del centro (x hacia el centro), y manda cerca del medio.
 * `center`: semiancho (unidades) donde manda el oro. Devuelve [fría, cálida] en 0..1.
 */
function rimLight(x: number, nx: number, ny: number, nz: number, center: number, out: [number, number]): [number, number] {
  const L = LOOK.light;
  const side = x < 0 ? -1 : 1;
  const cold = smooth(L.coldFrom, L.coldTo, nx * LC[0] * side + ny * LC[1] + nz * LC[2]);
  const toward = -side * Math.min(1, Math.abs(x) / Math.max(1, center * 0.6));
  const warm = smooth(L.warmFrom, L.warmTo, nx * LW[0] * toward + ny * LW[1] + nz * LW[2]);
  const mid = 1 - smooth(center * 0.4, center, Math.abs(x));
  out[0] = cold * (1 - 0.8 * mid);
  out[1] = warm * (0.35 + 0.65 * mid);
  return out;
}
const rimTmp: [number, number] = [0, 0];

/** Óvalo (eje `v` = dirección vx, vy; `bb`: semieje del lado de abajo) o cápsula que se afina. `d`: relieve por radio. */
interface Ell {
  kind: 'e';
  x: number;
  y: number;
  a: number;
  b: number;
  bb?: number;
  vx?: number;
  vy?: number;
  d: number;
}
interface Cap {
  kind: 'c';
  x: number;
  y: number;
  x1: number;
  y1: number;
  r: number;
  r1: number;
  d: number;
}
type Blob = (Ell | Cap) & { box?: [number, number, number, number] };

const E = (x: number, y: number, a: number, b: number, d: number, extra: Partial<Ell> = {}): Blob => {
  const e: Ell = { kind: 'e', x, y, a, b, d, ...extra };
  // El eje del óvalo tiene que ser unitario (si no, el óvalo crece y la caja lo recorta en rectángulo).
  if (e.vx !== undefined && e.vy !== undefined) {
    const l = Math.hypot(e.vx, e.vy) || 1;
    e.vx /= l;
    e.vy /= l;
  }
  return e;
};
const C = (x: number, y: number, x1: number, y1: number, r: number, r1: number, d = 1): Blob => ({ kind: 'c', x, y, x1, y1, r, r1, d });

/** Caja (unidades) fuera de la cual la forma no aporta. */
function blobBox(b: Blob): [number, number, number, number] {
  if (b.kind === 'e') {
    const m = Math.max(b.a, b.b, b.bb ?? 0);
    return [b.x - m, b.y - m, b.x + m, b.y + m];
  }
  const m = Math.max(b.r, b.r1);
  return [Math.min(b.x, b.x1) - m, Math.min(b.y, b.y1) - m, Math.max(b.x, b.x1) + m, Math.max(b.y, b.y1) + m];
}

/** Campo de una forma: positivo adentro; su raíz es el relieve (un elipsoide exacto para un óvalo solo). */
function blobField(b: Blob, x: number, y: number): number {
  const box = b.box!;
  if (x < box[0] || x > box[2] || y < box[1] || y > box[3]) return -1e6;
  if (b.kind === 'e') {
    let u = x - b.x;
    let v = y - b.y;
    if (b.vx !== undefined && b.vy !== undefined) {
      const vv = u * b.vx + v * b.vy;
      u = u * b.vy - v * b.vx;
      v = vv;
    }
    const bv = v < 0 && b.bb !== undefined ? b.bb : b.b;
    const q = (u / b.a) * (u / b.a) + (v / bv) * (v / bv);
    return b.d * b.d * (1 - q);
  }
  const dx = b.x1 - b.x;
  const dy = b.y1 - b.y;
  const t = clamp(((x - b.x) * dx + (y - b.y) * dy) / (dx * dx + dy * dy || 1), 0, 1);
  const r = b.r + (b.r1 - b.r) * t;
  const ex = x - (b.x + dx * t);
  const ey = y - (b.y + dy * t);
  const z = r * b.d;
  return z * z * (1 - (ex * ex + ey * ey) / (r * r));
}

/** Unión suave (las formas se funden en `k`). */
function smax(a: number, b: number, k: number): number {
  if (k <= 0) return Math.max(a, b);
  const h = clamp(0.5 + (0.5 * (b - a)) / k, 0, 1);
  return a + (b - a) * h + k * h * (1 - h);
}

type Material = 'skin' | 'bone' | 'plate';

/** Una pieza del dibujo: se pinta entera sobre las anteriores (contorno interior donde las tapa). */
interface Part {
  blobs: Blob[];
  k: number;
  mat: Material;
  /** Sube y se ensancha con la respiración (torso, cresta); las patas no. */
  breathe: boolean;
  /** Luz de la pieza (las patas de atrás quedan en sombra). */
  dim: number;
  /** Placas claras del vientre, musgo y cicatrices. */
  chest?: boolean;
  moss?: boolean;
  scars?: boolean;
}

/** Celdas de las escamas: sitios con tamaño propio (grandes en el lomo, chicas en los flancos y las patas). */
class ScaleField {
  private readonly xs: number[] = [];
  private readonly ys: number[] = [];
  private readonly ss: number[] = [];
  private readonly vars: number[] = [];
  private readonly grid = new Map<number, number[]>();
  private readonly cell = 3;
  private readonly reach: number;
  /** Resultado de la última consulta. */
  sx = 0;
  sy = 0;
  size = 1;
  f1 = 0;
  f2 = 0;
  variance = 0;

  constructor(x0: number, y0: number, x1: number, y1: number, sizeAt: (x: number, y: number) => number, seed: number) {
    const rand = rng(seed);
    let maxSize = 0;
    const attempts = Math.ceil(((x1 - x0) * (y1 - y0)) / (LOOK.scales.small * LOOK.scales.small)) * 6;
    for (let n = 0; n < attempts; n++) {
      const x = x0 + rand() * (x1 - x0);
      const y = y0 + rand() * (y1 - y0);
      const s = sizeAt(x, y);
      if (this.near(x, y, s * 0.82)) continue;
      this.add(x, y, s, rand());
      maxSize = Math.max(maxSize, s);
    }
    this.reach = Math.ceil((maxSize * 1.6) / this.cell);
  }

  private key(cx: number, cy: number): number {
    return (cy + 512) * 4096 + (cx + 2048);
  }

  private near(x: number, y: number, r: number): boolean {
    const cx = Math.floor(x / this.cell);
    const cy = Math.floor(y / this.cell);
    const span = Math.ceil(r / this.cell);
    for (let j = cy - span; j <= cy + span; j++) {
      for (let i = cx - span; i <= cx + span; i++) {
        const list = this.grid.get(this.key(i, j));
        if (!list) continue;
        for (const k of list) if (Math.hypot(this.xs[k] - x, this.ys[k] - y) < Math.min(r, this.ss[k] * 0.82)) return true;
      }
    }
    return false;
  }

  private add(x: number, y: number, s: number, v: number): void {
    const k = this.xs.length;
    this.xs.push(x);
    this.ys.push(y);
    this.ss.push(s);
    this.vars.push(v);
    const key = this.key(Math.floor(x / this.cell), Math.floor(y / this.cell));
    const list = this.grid.get(key);
    if (list) list.push(k);
    else this.grid.set(key, [k]);
  }

  /** Escama más cercana (distancias pesadas por tamaño: las grandes ocupan más) y la segunda, para la grieta. */
  query(x: number, y: number): void {
    const cx = Math.floor(x / this.cell);
    const cy = Math.floor(y / this.cell);
    let b1 = Infinity;
    let b2 = Infinity;
    let best = -1;
    for (let j = cy - this.reach; j <= cy + this.reach; j++) {
      for (let i = cx - this.reach; i <= cx + this.reach; i++) {
        const list = this.grid.get(this.key(i, j));
        if (!list) continue;
        for (const k of list) {
          // Un poco más anchas que altas: hileras que montan.
          const dx = (x - this.xs[k]) * 0.85;
          const dy = y - this.ys[k];
          const d = Math.sqrt(dx * dx + dy * dy) / Math.sqrt(this.ss[k]);
          if (d < b1) {
            b2 = b1;
            b1 = d;
            best = k;
          } else if (d < b2) b2 = d;
        }
      }
    }
    if (best < 0) {
      this.f1 = 0;
      this.f2 = 99;
      return;
    }
    const s = this.ss[best];
    this.sx = this.xs[best];
    this.sy = this.ys[best];
    this.size = s;
    this.variance = this.vars[best];
    // A unidades: la grieta mide lo mismo en escamas grandes y chicas.
    const root = Math.sqrt(s);
    this.f1 = b1 * root;
    this.f2 = b2 * root;
  }
}

/** Lienzo de trabajo: color, pieza que pintó cada píxel y si lo pinta la luz fría (contorno selectivo). */
class Canvas {
  readonly rgba: Uint8ClampedArray;
  readonly part: Uint8Array;
  readonly cold: Float32Array;
  readonly rim: Uint8ClampedArray;
  readonly z: Float32Array;

  constructor(
    readonly w: number,
    readonly h: number,
  ) {
    this.rgba = new Uint8ClampedArray(w * h * 4);
    this.part = new Uint8Array(w * h);
    this.cold = new Float32Array(w * h);
    this.rim = new Uint8ClampedArray(w * h * 4);
    this.z = new Float32Array(w * h);
  }

  set(idx: number, color: number, alpha = 255): void {
    const o = idx * 4;
    this.rgba[o] = (color >> 16) & 255;
    this.rgba[o + 1] = (color >> 8) & 255;
    this.rgba[o + 2] = color & 255;
    this.rgba[o + 3] = alpha;
  }

  setRim(idx: number, color: number): void {
    const o = idx * 4;
    this.rim[o] = (color >> 16) & 255;
    this.rim[o + 1] = (color >> 8) & 255;
    this.rim[o + 2] = color & 255;
    this.rim[o + 3] = 255;
  }

  get(idx: number): number {
    const o = idx * 4;
    return (this.rgba[o] << 16) | (this.rgba[o + 1] << 8) | this.rgba[o + 2];
  }
}

/** Contexto de pintura: dónde está el origen del dibujo en el lienzo y qué rasgos tiene (escamas, cicatrices…). */
interface Paint {
  cv: Canvas;
  /** Origen (px del lienzo) del punto (0, 0) del dibujo; y crece hacia arriba. */
  ox: number;
  oy: number;
  scales?: ScaleField;
  geo?: BodyGeometry;
  scars?: readonly number[];
  /** Respiración del cuadro: crecimiento a lo alto y a lo ancho del torso. */
  by: number;
  bx: number;
  seed: number;
  /** Lo que queda bajo y = 0 no se pinta (el suelo: ahí se clavan las garras). */
  floor?: boolean;
}

/** Pinta una pieza: relieve, normales, material y luz, con tramado. */
function paintPart(p: Paint, part: Part, id: number): void {
  const { cv } = p;
  const K = ART_K;
  for (const b of part.blobs) b.box = blobBox(b);
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const b of part.blobs) {
    x0 = Math.min(x0, b.box![0]);
    y0 = Math.min(y0, b.box![1]);
    x1 = Math.max(x1, b.box![2]);
    y1 = Math.max(y1, b.box![3]);
  }
  const sx = part.breathe ? 1 + p.bx : 1;
  const sy = part.breathe ? 1 + p.by : 1;
  const i0 = clamp(Math.floor(p.ox + x0 * sx * K) - 1, 0, cv.w - 1);
  const i1 = clamp(Math.ceil(p.ox + x1 * sx * K) + 1, 0, cv.w - 1);
  const j0 = clamp(Math.floor(p.oy - y1 * sy * K) - 1, 0, cv.h - 1);
  const j1 = clamp(Math.ceil(p.oy - y0 * sy * K) + 1, 0, cv.h - 1);
  const z = cv.z;
  // Relieve de la pieza.
  for (let j = j0; j <= j1; j++) {
    for (let i = i0; i <= i1; i++) {
      const x = (i + 0.5 - p.ox) / K / sx;
      const y = (p.oy - j - 0.5) / K / sy;
      let f = -1e6;
      for (const b of part.blobs) f = smax(f, blobField(b, x, y), part.k);
      // Lo que queda bajo el suelo no se dibuja (las garras se clavan).
      z[j * cv.w + i] = f > 0 && (!p.floor || y * sy >= 0) ? Math.sqrt(f) : 0;
    }
  }
  for (let j = j0; j <= j1; j++) {
    for (let i = i0; i <= i1; i++) {
      const idx = j * cv.w + i;
      const zc = z[idx];
      if (zc <= 0) continue;
      const zl = i > 0 ? z[idx - 1] : 0;
      const zr = i < cv.w - 1 ? z[idx + 1] : 0;
      const zu = j > 0 ? z[idx - cv.w] : 0;
      const zd = j < cv.h - 1 ? z[idx + cv.w] : 0;
      // Pendiente (unidades por unidad) y normal, con y hacia arriba.
      const gx = ((zr - zl) * K) / 2;
      const gy = ((zu - zd) * K) / 2;
      const [nx, ny, nz] = norm3(-gx, -gy, 1);
      const x = (i + 0.5 - p.ox) / K / sx;
      const y = (p.oy - j - 0.5) / K / sy;
      cv.set(idx, shade(p, part, i, j, x, y, nx, ny, nz, idx));
      cv.part[idx] = id;
    }
  }
  // Limpia el relieve para la próxima pieza.
  for (let j = j0; j <= j1; j++) z.fill(0, j * cv.w + i0, j * cv.w + i1 + 1);
}

/** Color de un píxel: material, escamas, luz y tramado. Guarda en el lienzo cuánto lo toca la luz fría. */
function shade(p: Paint, part: Part, i: number, j: number, x: number, y: number, nx: number, ny: number, nz: number, idx: number): number {
  const L = LOOK.light;
  const d = bayer(i, j);
  let crevice = false;
  let lip = false;
  let variance = 0;
  if (part.mat === 'skin' && p.scales) {
    const sc = p.scales;
    sc.query(x, y);
    // Las escamas montan: la junta de abajo de cada una es sombra, la de arriba es el canto que toma luz.
    const edge = sc.f2 - sc.f1 < LOOK.scales.crevice;
    crevice = edge && y < sc.sy + sc.size * 0.15;
    lip = edge && !crevice;
    variance = sc.variance < 0.12 ? -0.7 : sc.variance > 0.9 ? 0.6 : 0;
    // Cada escama abomba: la luz le pega arriba y la sombra le cae abajo.
    const bump = LOOK.scales.bulge / Math.max(1, sc.size);
    [nx, ny, nz] = norm3(nx + (x - sc.sx) * bump, ny + (y - sc.sy) * bump, nz);
  } else if (part.mat === 'plate') {
    variance = (hash2(Math.floor(x), Math.floor(y), p.seed) - 0.5) * 0.4;
  }
  const yWorld = y * (part.breathe ? 1 + p.by : 1);
  let fill = L.ambient + L.diffuse * Math.max(0, nx * LF[0] + ny * LF[1] + nz * LF[2]);
  // Más luz arriba (la caverna), sombra propia contra el suelo (las garras la toman menos: asoman a la luz).
  if (p.floor) {
    const shadeFloor = part.mat === 'bone' ? 0.6 : 0.3;
    fill *= (0.72 + 0.28 * clamp(yWorld / 100, 0, 1)) * (shadeFloor + (1 - shadeFloor) * smooth(0, L.floorShade, yWorld));
  }
  fill *= part.dim;
  const [cold, warmRaw] = rimLight(x, nx, ny, nz, p.geo ? p.geo.a : 40, rimTmp);
  const warm = warmRaw * part.dim;
  p.cv.cold[idx] = Math.max(cold, warm);
  // En la sombra honda la piel se simplifica: sin juntas, solo el tramado (la forma se lee mejor).
  if (fill < 0.22) {
    crevice = false;
    lip = false;
  }

  let color: number;
  let tone = 0;
  if (part.mat === 'bone') {
    tone = clamp(Math.round(fill * 5 + d * L.dither), 0, 5);
    color = PAL.bone[tone];
  } else {
    tone = clamp(Math.round(0.6 + fill * L.toneSpan + variance + d * L.dither), 1, 6);
    if (crevice) tone = Math.max(1, tone - 2);
    else if (lip) tone = fill > 0.5 ? Math.min(6, tone + 1) : Math.max(1, tone - 1);
    color = PAL.skin[tone];
    if (part.chest && p.geo) {
      const c = chestPlate(p.geo, x, y, nz, d);
      if (c > -5) {
        const t = clamp(Math.round(fill * 4.2 + c * 0.7 + d * L.dither), 0, 5);
        color = c === -8 ? PAL.belly[Math.max(0, t - 2)] : PAL.belly[t];
        tone = t;
      } else if (c === -9) {
        color = PAL.belly[0];
        tone = 0;
      }
    }
    if (part.moss && ny > 0.3 && !crevice) {
      const m = vnoise(x / LOOK.moss.scale, y / LOOK.moss.scale, p.seed) * 0.7 + vnoise(x / 2, y / 2, p.seed + 7) * 0.3;
      // Más musgo en las juntas y en lo más alto (donde gotea la caverna).
      const bias = (crevice || lip ? 0.06 : 0) + 0.1 * smooth(0.9 * (p.geo?.b ?? 60), 1.6 * (p.geo?.b ?? 60), y);
      if (m + bias + d * 0.1 > LOOK.moss.threshold + 0.2 * (1 - ny)) color = PAL.moss[clamp(Math.round(fill * 3.2 + d), 0, 3)];
    }
    if (part.scars && p.scars) {
      const s = scarAt(p.scars, x, y);
      if (s === 1) color = PAL.scar[clamp(Math.round(fill * 3 + d), 0, 3)];
      else if (s === 2) color = PAL.skin[1];
    }
  }
  // Luz fría: el borde de arriba se enciende con el cian de los cristales. Rebote cálido abajo y hacia el centro.
  const rc = cold * L.coldStrength + d;
  if (rc >= 1 && !crevice) {
    color = PAL.cold[clamp(Math.floor(rc) - 1 + (tone >= 4 ? 1 : 0), 0, 4)];
    p.cv.setRim(idx, color);
  } else {
    const rw = warm * L.warmStrength + d;
    if (rw >= 1 && !crevice) {
      color = PAL.warm[clamp(Math.floor(rw) - 1 + (tone >= 4 ? 1 : 0), 0, 4)];
      p.cv.setRim(idx, color);
    }
  }
  return color;
}

/**
 * Placas del vientre: −99 si el píxel no es del vientre, −9 la junta de abajo de una placa (sombra), −8 la junta del
 * costado (más suave), o un ajuste de tono (el canto de arriba de cada placa toma luz).
 */
function chestPlate(geo: BodyGeometry, x: number, y: number, nz: number, d: number): number {
  const ca = geo.a * 0.5;
  const cb = geo.b * 0.3;
  const cy = geo.b * 0.39;
  const q = (x / ca) * (x / ca) + ((y - cy) / cb) * ((y - cy) / cb);
  if (q > 1 + 0.12 * Math.sin(x * 0.9 + y * 0.7) || nz < 0.35) return -99;
  const rowH = geo.b * 0.09;
  const v = (y - geo.b * 0.06 - geo.b * 0.16 * (x / ca) * (x / ca)) / rowH;
  const row = Math.floor(v);
  const fv = v - row;
  const colW = geo.a * 0.11 * (1 - 0.35 * Math.abs(x / ca));
  const u = x / colW + (row & 1) * 0.5;
  const fu = u - Math.floor(u);
  if (fv < 0.11) return -9;
  if (fu < 0.06) return -8;
  return fv > 0.78 ? 1 : fv < 0.3 ? -1 + (d > 0.3 ? 1 : 0) : 0;
}

/** Cicatrices (segmentos de a cuatro números): 1 = la cicatriz, 2 = su surco oscuro de abajo, 0 = nada. */
function scarAt(scars: readonly number[], x: number, y: number): number {
  for (let s = 0; s + 3 < scars.length; s += 4) {
    const ax = scars[s];
    const ay = scars[s + 1];
    const dx = scars[s + 2] - ax;
    const dy = scars[s + 3] - ay;
    const t = clamp(((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy), 0, 1);
    const ex = x - (ax + dx * t);
    const ey = y - (ay + dy * t);
    const dist = Math.hypot(ex, ey);
    // Más fina en las puntas.
    const wd = 0.75 * Math.sin(Math.PI * clamp(t, 0.08, 0.92));
    if (dist < wd) return 1;
    if (dist < wd + 0.6 && ey < 0) return 2;
  }
  return 0;
}

/**
 * Contorno selectivo: oscuro abajo y a los costados, nada donde el borde de arriba lo enciende la luz fría.
 * Donde una pieza tapa a otra de atrás, una línea interior un poco más clara que el contorno.
 */
function outline(cv: Canvas, floorRow: number): void {
  const { w, h } = cv;
  const out = new Uint32Array(w * h);
  const mark = new Uint8Array(w * h);
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const idx = j * w + i;
      if (cv.rgba[idx * 4 + 3] === 0) continue;
      const empty = (ii: number, jj: number): boolean =>
        ii < 0 || ii >= w || jj < 0 || (jj >= h ? false : cv.rgba[(jj * w + ii) * 4 + 3] === 0);
      const up = empty(i, j - 1);
      const side = empty(i - 1, j) || empty(i + 1, j);
      const down = j < floorRow && empty(i, j + 1);
      const me = cv.part[idx];
      if (up || side || down) {
        if (up && !side && !down && cv.cold[idx] > 0.35) continue;
        out[idx] = PAL.outline;
        mark[idx] = 1;
        continue;
      }
      const behind = (ii: number, jj: number): boolean => cv.part[jj * w + ii] < me;
      if (behind(i, j - 1) || behind(i - 1, j) || behind(i + 1, j) || behind(i, j + 1)) {
        out[idx] = cv.cold[idx] > 0.35 ? PAL.skin[2] : PAL.skin[1];
        mark[idx] = 1;
      }
    }
  }
  for (let idx = 0; idx < w * h; idx++) if (mark[idx]) cv.set(idx, out[idx]);
}

// ── El cuerpo ──────────────────────────────────────────────────────────────

/** Piezas del lagarto agazapado, de atrás hacia adelante (unidades desde el centro del cuerpo en el suelo). */
function bodyParts(geo: BodyGeometry, seed: number): Part[] {
  const { a: A, b: B, hc: HC } = geo;
  const rand = rng(seed);
  const parts: Part[] = [];
  // Patas de atrás: asoman bajo el vientre, en sombra.
  const hind: Blob[] = [];
  for (const s of [-1, 1]) {
    hind.push(E(s * 0.6 * A, 0.29 * B, 0.17 * A, 0.23 * B, 0.8 * 0.23 * B));
    hind.push(C(s * 0.64 * A, 0.22 * B, s * 0.7 * A, 0.06 * B, 0.11 * B, 0.08 * B, 0.85));
    hind.push(E(s * 0.72 * A, 0.055 * B, 0.1 * A, 0.06 * B, 0.05 * B));
    for (let k = 0; k < 3; k++) hind.push(C(s * (0.69 + 0.025 * k) * A, 0.05 * B, s * (0.66 + 0.06 * k) * A, 0.018 * B, 0.035 * B, 0.025 * B));
  }
  parts.push({ blobs: hind, k: 0.04 * B * B, mat: 'skin', breathe: false, dim: 0.62, moss: true });
  const hindClaws: Blob[] = [];
  for (const s of [-1, 1]) for (let k = 0; k < 3; k++) {
    const ex = s * (0.66 + 0.06 * k) * A;
    hindClaws.push(C(ex, 0.018 * B, ex + s * (k - 1) * 0.6, -1.4, 1.1, 0.25));
  }
  parts.push({ blobs: hindClaws, k: 0, mat: 'bone', breathe: false, dim: 0.7 });

  // Cresta de placas óseas sobre el lomo (detrás del torso: el torso tapa su base).
  const crest: Blob[] = [];
  for (let x = -0.9 * A; x <= 0.9 * A; x += 0.085 * A * (0.8 + 0.4 * rand())) {
    const ux = x / A;
    const top = HC + B * Math.sqrt(Math.max(0, 1 - ux * ux));
    let nx = x / (A * A);
    let ny = (top - HC) / (B * B);
    const nl = Math.hypot(nx, ny) || 1;
    nx /= nl;
    ny /= nl;
    // Más altas en el medio; algunas rotas.
    const chipped = rand() < 0.18 ? 0.55 : 1;
    const len = (0.09 + 0.17 * (1 - ux * ux)) * B * (0.75 + 0.5 * rand()) * chipped;
    const half = 0.24 * len + 1.4;
    // Inclinadas hacia afuera, como placas que se abren en abanico.
    const lean = ux * 0.35;
    const tx = nx + lean * ny;
    const ty = ny - lean * nx;
    crest.push(C(x - nx * 2, top - ny * 2, x + tx * len, top + ty * len, half, 0.5, 0.8));
  }
  parts.push({ blobs: crest, k: 0, mat: 'bone', breathe: true, dim: 1 });

  // Torso: lomo, vientre que cuelga y hombros sobre las patas.
  parts.push({
    blobs: [
      E(0, HC, 0.9 * A, B, 0.95 * B, { bb: 0.42 * B }),
      E(0, 0.44 * B, 0.66 * A, 0.36 * B, 0.75 * B),
      E(-0.84 * A, 0.9 * B, 0.21 * A, 0.42 * B, 0.5 * B),
      E(0.84 * A, 0.9 * B, 0.21 * A, 0.42 * B, 0.5 * B),
    ],
    k: 0.06 * B * B,
    mat: 'skin',
    breathe: true,
    dim: 1,
    chest: true,
    moss: true,
    scars: true,
  });

  // Patas de adelante: brazo hacia afuera, codo, antebrazo al suelo, pie abierto con cuatro dedos.
  const legs: Blob[] = [];
  const toes: Blob[] = [];
  const claws: Blob[] = [];
  for (const s of [-1, 1]) {
    legs.push(C(s * 0.8 * A, 0.92 * B, s * 1.04 * A, 0.74 * B, 0.2 * B, 0.15 * B, 0.9));
    legs.push(E(s * 1.07 * A, 0.72 * B, 0.1 * A, 0.15 * B, 0.13 * B));
    legs.push(C(s * 1.05 * A, 0.7 * B, s * 0.99 * A, 0.13 * B, 0.15 * B, 0.1 * B, 0.9));
    legs.push(E(s * 1.0 * A, 0.075 * B, 0.12 * A, 0.08 * B, 0.065 * B));
    for (let k = 0; k < 4; k++) {
      const ex = s * (0.88 + 0.095 * k) * A;
      // Dedos aparte (contorno propio entre ellos), abiertos en abanico.
      toes.push(C(s * (0.95 + 0.03 * k) * A, 0.09 * B, ex, 0.04 * B, 0.052 * B, 0.04 * B));
      // Garras clavadas: salen de la punta del dedo, se curvan hacia abajo y se hunden en el suelo.
      const cx = ex + s * ((k - 1.5) * 0.8 + 1.2);
      claws.push(C(ex + s * 0.6, 0.06 * B, cx, -1.5, 2.2, 0.35));
    }
  }
  parts.push({ blobs: legs, k: 0.05 * B * B, mat: 'skin', breathe: false, dim: 1, moss: true, scars: true });
  parts.push({ blobs: toes, k: 0, mat: 'skin', breathe: false, dim: 0.95 });
  parts.push({ blobs: claws, k: 0, mat: 'bone', breathe: false, dim: 1.1 });
  return parts;
}

/** Tamaño de las escamas (unidades): grandes en el lomo, chicas en los flancos bajos y en las patas. */
function scaleSizeAt(geo: BodyGeometry, x: number, y: number): number {
  const S = LOOK.scales;
  const ax = Math.abs(x);
  if (ax > 0.92 * geo.a && y < 0.75 * geo.b) return S.leg;
  if (y < 0.3 * geo.b && ax > 0.5 * geo.a) return S.leg;
  const up = smooth(0.3 * geo.b, 1.65 * geo.b, y);
  return (S.small + (S.large - S.small) * up) * (1 - 0.3 * smooth(0.6 * geo.a, geo.a, ax));
}

/** Cicatrices (segmentos): zarpazos en el flanco izquierdo, un tajo largo a la derecha y uno en el antebrazo. */
function scarLines(geo: BodyGeometry): number[] {
  const { a: A, b: B } = geo;
  return [
    -0.62 * A, 1.12 * B, -0.45 * A, 0.86 * B,
    -0.55 * A, 1.16 * B, -0.38 * A, 0.9 * B,
    -0.48 * A, 1.19 * B, -0.32 * A, 0.94 * B,
    0.3 * A, 1.2 * B, 0.66 * A, 0.74 * B,
    -1.04 * A, 0.44 * B, -0.98 * A, 0.3 * B,
  ];
}

function makeBody(scene: Phaser.Scene, geo: BodyGeometry): void {
  const K = ART_K;
  const w = BODY_HALF_W * 2 * K;
  const h = BODY_HEIGHT * K;
  const frames = LOOK.breath.frames;
  const tex = scene.textures.createCanvas(BODY_TEXTURE, w * frames, h);
  const rimTex = scene.textures.createCanvas(BODY_RIM_TEXTURE, w, h);
  if (!tex || !rimTex) return;
  const seed = 1013;
  const scales = new ScaleField(-BODY_HALF_W, -2, BODY_HALF_W, BODY_HEIGHT, (x, y) => scaleSizeAt(geo, x, y), seed);
  const scars = scarLines(geo);
  for (let f = 0; f < frames; f++) {
    const cv = new Canvas(w, h);
    const by = breathLift(f);
    const paint: Paint = { cv, ox: w / 2, oy: h, scales, geo, scars, by, bx: by * 0.5, seed, floor: true };
    bodyParts(geo, seed).forEach((part, n) => paintPart(paint, part, n + 1));
    outline(cv, h - 1);
    const img = tex.context.createImageData(w, h);
    img.data.set(cv.rgba);
    tex.context.putImageData(img, f * w, 0);
    tex.add(`b${f}`, 0, f * w, 0, w, h);
    if (f === 0) {
      const rim = rimTex.context.createImageData(w, h);
      rim.data.set(cv.rim);
      rimTex.context.putImageData(rim, 0, 0);
    }
  }
  tex.refresh();
  rimTex.refresh();
}

/** Collares: placas grandes en media luna que tapan la base del cuello, con un pliegue de piel debajo. */
function makeCollars(scene: Phaser.Scene): void {
  const K = ART_K;
  const cw = LOOK.collar.width;
  const ch = LOOK.collar.height;
  const w = cw * K;
  const h = ch * K;
  const tex = scene.textures.createCanvas(COLLAR_TEXTURE, w * COLLAR_VARIANTS, h);
  if (!tex) return;
  for (let v = 0; v < COLLAR_VARIANTS; v++) {
    const rand = rng(77 + v * 31);
    const cv = new Canvas(w, h);
    // Origen: la raíz del cuello.
    const paint: Paint = { cv, ox: w / 2, oy: h * COLLAR_ORIGIN_Y, by: 0, bx: 0, seed: 91 + v };
    let id = 1;
    paintPart(paint, { blobs: [E(0, -3.2, cw * 0.4, 4.5, 3.5)], k: 0, mat: 'plate', breathe: false, dim: 0.8 }, id++);
    // Placas de los costados primero, la del frente al final (la que más tapa).
    const order = [0, 4, 1, 3, 2];
    for (const k of order) {
      const ang = Math.PI * (1.1 + 0.2 * k) + (rand() - 0.5) * 0.12;
      const px = Math.cos(ang) * cw * 0.33;
      const py = Math.sin(ang) * 4.6 + 0.6;
      const big = k === 2 ? 1.15 : k === 1 || k === 3 ? 1 : 0.82;
      const pa = (4.6 + rand() * 0.8) * big;
      const pb = (4 + rand() * 0.6) * big;
      paintPart(paint, { blobs: [E(px, py, pa, pb, pb * 0.95, { vx: Math.cos(ang) * 0.4, vy: Math.sin(ang) * 0.4 + 0.6 })], k: 0, mat: 'plate', breathe: false, dim: 1 }, id++);
    }
    // Púas cortas en el canto del collar.
    const spikes: Blob[] = [];
    for (let k = 0; k < 4; k++) {
      const ang = Math.PI * (1.16 + 0.22 * k);
      spikes.push(E(Math.cos(ang) * cw * 0.42, Math.sin(ang) * 4.8 + 3.6, 1.2, 2.2, 1.2, { vx: Math.cos(ang) * 0.5, vy: 0.85 }));
    }
    paintPart(paint, { blobs: spikes, k: 0, mat: 'bone', breathe: false, dim: 0.9 }, id++);
    outline(cv, h);
    const img = tex.context.createImageData(w, h);
    img.data.set(cv.rgba);
    tex.context.putImageData(img, v * w, 0);
    tex.add(`c${v}`, 0, v * w, 0, w, h);
  }
  tex.refresh();
}

/** Altura del origen del collar en su textura (fracción desde arriba). */
const COLLAR_ORIGIN_Y = 0.5;

/** Origen del collar (fracciones): la raíz del cuello. */
export function collarOrigin(): [number, number] {
  return [0.5, COLLAR_ORIGIN_Y];
}

/** Sombra en el suelo: óvalo tramado, más denso al centro (`w` × `h` unidades). */
function makeShadow(scene: Phaser.Scene, key: string, wu: number, hu: number): void {
  const w = Math.ceil(wu * ART_K);
  const h = Math.ceil(hu * ART_K);
  const tex = scene.textures.createCanvas(key, w, h);
  if (!tex) return;
  const img = tex.context.createImageData(w, h);
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const u = (i + 0.5) / w - 0.5;
      const v = (j + 0.5) / h - 0.5;
      const q = 1 - (u * u + v * v) * 4;
      if (q <= 0) continue;
      const level = q + bayer(i, j) * 0.5;
      if (level < 0.2) continue;
      const o = (j * w + i) * 4;
      img.data[o] = 4;
      img.data[o + 1] = 5;
      img.data[o + 2] = 9;
      img.data[o + 3] = level > 0.65 ? 255 : level > 0.4 ? 170 : 90;
    }
  }
  tex.context.putImageData(img, 0, 0);
  tex.refresh();
}

/** Resplandor blanco en escalones (se tiñe y se suma): ojos, bocas y la luz de la presentación. */
function makeGlow(scene: Phaser.Scene): void {
  const s = GLOW_PX;
  const tex = scene.textures.createCanvas(GLOW_TEXTURE, s, s);
  if (!tex) return;
  const img = tex.context.createImageData(s, s);
  for (let j = 0; j < s; j++) {
    for (let i = 0; i < s; i++) {
      const r = Math.hypot(i + 0.5 - s / 2, j + 0.5 - s / 2) / (s / 2);
      if (r >= 1) continue;
      const v = (1 - r) * (1 - r) + bayer(i, j) * 0.08;
      const a = v > 0.55 ? 255 : v > 0.3 ? 150 : v > 0.12 ? 80 : v > 0.03 ? 35 : 0;
      const o = (j * s + i) * 4;
      img.data[o] = 255;
      img.data[o + 1] = 255;
      img.data[o + 2] = 255;
      img.data[o + 3] = a;
    }
  }
  tex.context.putImageData(img, 0, 0);
  tex.refresh();
}

/** Puntos de la medialuna de cada placa, tope de púas por tubo y paso de los mechones de la crin (unidades). */
const CRESCENT_POINTS = 4;
const MAX_SPIKES = 24;
const MANE_STEP = 2.8;

/** Lado (unidades) del resplandor a escala 1. */
export const GLOW_UNITS = GLOW_PX / ART_K;

// ── Cuellos y cola: tubos dibujados en cada cuadro ─────────────────────────

/** Colores de un tubo ya multiplicados por el tinte del estado (dormida, silueta de la presentación). */
export interface TubeColors {
  outline: number;
  lit: number;
  mid: number;
  shade: number;
  ventral: number;
  ventralSeam: number;
  seam: number;
  seamLight: number;
  cold: number;
  warm: number;
  /** Borde de arriba cuando le pega el oro del fondo (cerca del centro). */
  warmTop: number;
  bone: number;
  boneLight: number;
  boneDark: number;
  fur: number[];
}

export function newTubeColors(): TubeColors {
  return { outline: 0, lit: 0, mid: 0, shade: 0, ventral: 0, ventralSeam: 0, seam: 0, seamLight: 0, cold: 0, warm: 0, warmTop: 0, bone: 0, boneLight: 0, boneDark: 0, fur: [0, 0, 0, 0, 0] };
}

/** Multiplica un color por un tinte (0xRRGGBB, blanco = sin cambio). */
export function mulColor(c: number, t: number): number {
  if (t === 0xffffff) return c;
  const r = (((c >> 16) & 255) * ((t >> 16) & 255)) / 255;
  const g = (((c >> 8) & 255) * ((t >> 8) & 255)) / 255;
  const b = ((c & 255) * (t & 255)) / 255;
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b);
}

/** Mezcla dos tintes (`k` = 0 → a, 1 → b). */
export function lerpColor(a: number, b: number, k: number): number {
  const r = ((a >> 16) & 255) + ((((b >> 16) & 255) - ((a >> 16) & 255)) * k);
  const g = ((a >> 8) & 255) + ((((b >> 8) & 255) - ((a >> 8) & 255)) * k);
  const bl = (a & 255) + (((b & 255) - (a & 255)) * k);
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(bl);
}

/** Paleta del tubo con el tinte `t`; `rimT` tiñe los bordes de luz (en la silueta de la presentación se ven antes). */
export function tubeColors(out: TubeColors, t: number, rimT: number): TubeColors {
  const s = PAL.skin;
  out.outline = mulColor(PAL.outline, t);
  out.shade = mulColor(s[2], t);
  out.mid = mulColor(s[3], t);
  out.lit = mulColor(s[4], t);
  out.seam = mulColor(s[1], t);
  out.seamLight = mulColor(s[5], t);
  out.ventral = mulColor(PAL.belly[2], t);
  out.ventralSeam = mulColor(PAL.belly[1], t);
  out.cold = mulColor(PAL.cold[3], rimT);
  out.warm = mulColor(PAL.warm[2], rimT);
  out.warmTop = mulColor(PAL.warm[3], rimT);
  out.bone = mulColor(PAL.bone[3], t);
  out.boneLight = mulColor(PAL.bone[5], t);
  out.boneDark = mulColor(PAL.bone[1], t);
  for (let k = 0; k < 5; k++) out.fur[k] = mulColor(PAL.fur[k + 2], t);
  return out;
}

/** Estilo de un tubo: púas, crin y placas. Fracciones del largo (0 = base, 1 = punta). */
export interface TubeStyle {
  segments: number;
  /** Placas que montan (crestas en el lado de arriba; `ring`: anillos de lado a lado, como la cola). */
  plateStep: number;
  ring: boolean;
  ventralStep: number;
  spikeFrom: number;
  spikeTo: number;
  spikeLen: readonly [number, number];
  /** Púas cada tantas placas. */
  spikeEvery: number;
  /** Desde dónde la cresta se vuelve crin (> 1: sin crin). */
  maneFrom: number;
  maneLen: readonly [number, number];
}

/** Forma de un tubo en este cuadro: Bézier cúbica, grosores, ondulación y lado del lomo. */
export interface TubeShape {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  x3: number;
  y3: number;
  w0: number;
  w1: number;
  /** Ensanche en la base (fracción). */
  flare: number;
  /** Lado del lomo: hacia dónde mira su normal además de arriba (+1 derecha, −1 izquierda). */
  back: number;
  /** El lomo va arriba aunque la curva se combe hacia abajo (cuello dormido que cuelga, cola). */
  dorsalUp: boolean;
  /** Ondulación perpendicular: amplitud (unidades), fase (rad) y ondas a lo largo; `coil`: S fija (aviso). */
  waveAmp: number;
  wavePhase: number;
  waveCount: number;
  coil: number;
  /** Movimiento de la crin (rad). */
  maneSway: number;
  /** Donde le pega el oro del fondo: el borde de arriba se vuelve cálido a menos de `warmR` de `warmX` (0: nunca). */
  warmX: number;
  warmR: number;
}

export function newTubeShape(): TubeShape {
  return { x0: 0, y0: 0, x1: 0, y1: 0, x2: 0, y2: 0, x3: 0, y3: 0, w0: 1, w1: 1, flare: 0, back: 1, dorsalUp: false, waveAmp: 0, wavePhase: 0, waveCount: 1, coil: 0, maneSway: 0, warmX: 0, warmR: 0 };
}

/**
 * Dibuja un tubo (cuello o cola) en un Graphics, con arreglos preasignados: contorno, bandas de luz (el lomo
 * iluminado, la vuelta en sombra, el vientre claro), placas que montan, juntas del vientre, borde frío arriba,
 * rebote cálido abajo, púas óseas y crin de pelo. Los cuadriláteros por tramo aguantan curvas cerradas sin romperse.
 */
export class TubeArt {
  private readonly n: number;
  private readonly px: Float32Array;
  private readonly py: Float32Array;
  private readonly nx: Float32Array;
  private readonly ny: Float32Array;
  private readonly wd: Float32Array;
  private readonly arc: Float32Array;

  constructor(
    private readonly g: Phaser.GameObjects.Graphics,
    private readonly style: TubeStyle,
  ) {
    this.n = style.segments;
    const m = this.n + 1;
    this.px = new Float32Array(m);
    this.py = new Float32Array(m);
    this.nx = new Float32Array(m);
    this.ny = new Float32Array(m);
    this.wd = new Float32Array(m);
    this.arc = new Float32Array(m);
  }

  draw(sh: TubeShape, c: TubeColors, rimAlpha: number): void {
    const g = this.g;
    const n = this.n;
    const { px, py, nx, ny, wd, arc } = this;
    // Centro de la curva, con la onda perpendicular sobre la recta base → punta.
    const bx = sh.x3 - sh.x0;
    const by = sh.y3 - sh.y0;
    const bl = Math.hypot(bx, by) || 1;
    const pxn = -by / bl;
    const pyn = bx / bl;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const mt = 1 - t;
      const a = mt * mt * mt;
      const b = 3 * mt * mt * t;
      const cc = 3 * mt * t * t;
      const d = t * t * t;
      const env = Math.sin(Math.PI * t);
      const off = (sh.waveAmp * Math.sin(sh.wavePhase - t * Math.PI * 2 * sh.waveCount) + sh.coil * Math.sin(Math.PI * 2 * t)) * env;
      px[i] = a * sh.x0 + b * sh.x1 + cc * sh.x2 + d * sh.x3 + pxn * off;
      py[i] = a * sh.y0 + b * sh.y1 + cc * sh.y2 + d * sh.y3 + pyn * off;
      wd[i] = (sh.w0 + (sh.w1 - sh.w0) * Math.pow(t, 0.85)) * (1 + sh.flare * (1 - smooth(0, 0.22, t)));
    }
    // Normales (rotando la tangente) y largo acumulado; el lomo queda arriba (o hacia `back` si el tramo es vertical).
    arc[0] = 0;
    for (let i = 0; i <= n; i++) {
      const i0 = Math.max(0, i - 1);
      const i1 = Math.min(n, i + 1);
      const tx = px[i1] - px[i0];
      const ty = py[i1] - py[i0];
      const tl = Math.hypot(tx, ty) || 1;
      nx[i] = ty / tl;
      ny[i] = -tx / tl;
      if (i > 0) arc[i] = arc[i - 1] + Math.hypot(px[i] - px[i - 1], py[i] - py[i - 1]);
    }
    // El lomo es el lado de afuera de la curva (un cuello que se arquea); si casi no se curva o cuelga, arriba.
    const mid = n >> 1;
    const bulgeX = px[mid] - (px[0] + px[n]) / 2;
    const bulgeY = py[mid] - (py[0] + py[n]) / 2;
    const bulge = Math.hypot(bulgeX, bulgeY);
    const outer = nx[mid] * bulgeX + ny[mid] * bulgeY;
    const up = -ny[mid] + 0.6 * nx[mid] * sh.back;
    const sign = (!sh.dorsalUp && bulge > 3 ? outer : up) >= 0 ? 1 : -1;
    for (let i = 0; i <= n; i++) {
      nx[i] *= sign;
      ny[i] *= sign;
    }

    // Contorno y bandas: u = +1 el lomo, −1 el vientre.
    this.band(-1.06, 1.06, c.outline, 0.5);
    this.band(-1, 1, c.mid, 0);
    this.band(0.45, 1, c.lit, 0);
    this.band(-0.62, -0.12, c.shade, 0);
    this.band(-1, -0.62, c.ventral, 0);

    const total = arc[n];
    const st = this.style;
    // Juntas del vientre: rayas cortas de lado a lado de la banda clara.
    g.lineStyle(0.5, c.ventralSeam, 1);
    for (let s = st.ventralStep * 0.5; s < total; s += st.ventralStep) this.across(s, -0.98, -0.64);
    // Placas que montan: una medialuna que se curva hacia la base, con su canto claro del lado de la cabeza.
    let plate = 0;
    let spikes = 0;
    for (let s = 0.12 * total; s < total * 0.97; plate++) {
      const i = this.indexAt(s);
      const t = s / total;
      const w = wd[i];
      if (t < st.maneFrom || st.ring) this.crescent(s, w, st.ring ? -0.95 : -0.12, c.seam, c.seamLight);
      // Púas óseas en el lomo, más chicas hacia la punta (se dibujan todas juntas, abajo).
      if (t >= st.spikeFrom && t <= st.spikeTo && plate % st.spikeEvery === 0 && spikes < MAX_SPIKES) {
        const k = (t - st.spikeFrom) / Math.max(0.01, st.spikeTo - st.spikeFrom);
        this.spikeAt[spikes] = s;
        this.spikeLen[spikes] = st.spikeLen[0] + (st.spikeLen[1] - st.spikeLen[0]) * k;
        spikes++;
      }
      s += Math.max(1.6, w * st.plateStep);
    }
    this.spikes(spikes, c);
    // Borde frío donde el lomo mira hacia arriba y rebote cálido donde el vientre mira hacia abajo.
    this.edge(0.9, c.cold, rimAlpha, 1, sh, c.warmTop);
    this.edge(-0.92, c.warm, rimAlpha * 0.9, -1, sh, c.warm);
    // Crin: mechones que salen del lomo hacia atrás y se agrandan hacia la cabeza; cerca de la cabeza, también abajo.
    if (st.maneFrom <= 1) this.mane(total, sh.maneSway, c);
  }

  /** Banda entre u0 y u1 (fracciones del semigrosor), ampliada `grow` unidades hacia afuera. */
  private band(u0: number, u1: number, color: number, grow: number): void {
    const g = this.g;
    const { px, py, nx, ny, wd } = this;
    g.fillStyle(color, 1);
    for (let i = 0; i < this.n; i++) {
      const h0 = wd[i] / 2;
      const h1 = wd[i + 1] / 2;
      const a0 = u0 * h0 - (u0 < 0 ? grow : 0);
      const b0 = u1 * h0 + (u1 > 0 ? grow : 0);
      const a1 = u0 * h1 - (u0 < 0 ? grow : 0);
      const b1 = u1 * h1 + (u1 > 0 ? grow : 0);
      const ax = px[i] + nx[i] * a0;
      const ay = py[i] + ny[i] * a0;
      const bx = px[i] + nx[i] * b0;
      const by = py[i] + ny[i] * b0;
      const cx = px[i + 1] + nx[i + 1] * b1;
      const cy = py[i + 1] + ny[i + 1] * b1;
      const dx = px[i + 1] + nx[i + 1] * a1;
      const dy = py[i + 1] + ny[i + 1] * a1;
      g.fillTriangle(ax, ay, bx, by, cx, cy);
      g.fillTriangle(ax, ay, cx, cy, dx, dy);
    }
  }

  /** Índice del tramo que contiene el largo `s`. */
  private indexAt(s: number): number {
    const arc = this.arc;
    let i = 0;
    while (i < this.n - 1 && arc[i + 1] < s) i++;
    return i;
  }

  /** Punto del centro y normal en el largo `s` (interpolados), en los campos de trabajo. */
  private cx = 0;
  private cy = 0;
  private cnx = 0;
  private cny = 0;
  private cw = 0;
  private at(s: number): void {
    const i = this.indexAt(s);
    const { px, py, nx, ny, wd, arc } = this;
    const seg = arc[i + 1] - arc[i] || 1;
    const f = clamp((s - arc[i]) / seg, 0, 1);
    this.cx = px[i] + (px[i + 1] - px[i]) * f;
    this.cy = py[i] + (py[i + 1] - py[i]) * f;
    this.cnx = nx[i] + (nx[i + 1] - nx[i]) * f;
    this.cny = ny[i] + (ny[i + 1] - ny[i]) * f;
    this.cw = wd[i] + (wd[i + 1] - wd[i]) * f;
  }

  /** Raya de lado a lado entre u0 y u1 en el largo `s` (con el lineStyle ya puesto). */
  private across(s: number, u0: number, u1: number): void {
    this.at(s);
    const h = this.cw / 2;
    this.g.lineBetween(this.cx + this.cnx * u0 * h, this.cy + this.cny * u0 * h, this.cx + this.cnx * u1 * h, this.cy + this.cny * u1 * h);
  }

  /** Medialuna de una placa: junta oscura que se curva hacia la base y su canto claro hacia la cabeza. */
  private crescent(s: number, w: number, u0: number, seam: number, light: number): void {
    const g = this.g;
    const bow = 0.3 * w;
    const last = CRESCENT_POINTS - 1;
    for (let pass = 0; pass < 2; pass++) {
      g.lineStyle(0.5, pass === 0 ? seam : light, 1);
      g.beginPath();
      let has = false;
      for (let k = 0; k <= last; k++) {
        const u = u0 + (0.95 - u0) * (k / last);
        // El canto claro va solo en la mitad de arriba, donde pega la luz.
        if (pass === 1 && u < 0.3) continue;
        const m = (k / last) * 2 - 1;
        this.at(Math.max(0, s - bow * (1 - m * m) + pass * 0.6));
        const x = this.cx + this.cnx * u * (this.cw / 2);
        const y = this.cy + this.cny * u * (this.cw / 2);
        if (has) g.lineTo(x, y);
        else g.moveTo(x, y);
        has = true;
      }
      g.strokePath();
    }
  }

  /**
   * Borde de luz (línea fina) a lo largo de u, solo en los tramos que miran hacia arriba (`face` 1) o abajo (−1).
   * Cerca del oro del fondo (`sh.warmX`, `sh.warmR`) toma el color `near`.
   */
  private edge(u: number, color: number, alpha: number, face: number, sh: TubeShape, near: number): void {
    if (alpha <= 0) return;
    const g = this.g;
    const { px, py, nx, ny, wd } = this;
    // Un camino por tramo seguido del mismo color: cortarlo solo cuando cambia de color o deja de mirar a la luz.
    let current = -1;
    let open = false;
    for (let i = 0; i < this.n; i++) {
      const lit = -(ny[i] + ny[i + 1]) * 0.5 * face >= 0.2;
      const want = !lit ? -1 : sh.warmR > 0 && Math.abs((px[i] + px[i + 1]) / 2 - sh.warmX) < sh.warmR ? near : color;
      if (want !== current && open) {
        g.strokePath();
        open = false;
      }
      current = want;
      if (want < 0) continue;
      const h1 = (wd[i + 1] / 2) * u;
      if (!open) {
        const h0 = (wd[i] / 2) * u;
        g.lineStyle(0.5, want, alpha).beginPath().moveTo(px[i] + nx[i] * h0, py[i] + ny[i] * h0);
        open = true;
      }
      g.lineTo(px[i + 1] + nx[i + 1] * h1, py[i + 1] + ny[i + 1] * h1);
    }
    if (open) g.strokePath();
  }

  /** Púas óseas del lomo, inclinadas hacia la base: contorno, hueso y su cara iluminada, un color por pasada. */
  private readonly spikeAt = new Float32Array(MAX_SPIKES);
  private readonly spikeLen = new Float32Array(MAX_SPIKES);
  private spikes(count: number, c: TubeColors): void {
    const g = this.g;
    for (let pass = 0; pass < 3; pass++) {
      g.fillStyle(pass === 0 ? c.outline : pass === 1 ? c.bone : c.boneLight, 1);
      for (let k = 0; k < count; k++) {
        const len = this.spikeLen[k];
        this.at(this.spikeAt[k]);
        const h = this.cw / 2;
        const bx = this.cx + this.cnx * h * 0.85;
        const by = this.cy + this.cny * h * 0.85;
        // Tangente hacia la base (perpendicular a la normal).
        const tx = this.cny;
        const ty = -this.cnx;
        const half = Math.max(1, len * 0.42, this.cw * 0.08);
        const ax = bx + this.cnx * len + tx * len * 0.45;
        const ay = by + this.cny * len + ty * len * 0.45;
        const lx = bx - tx * half;
        const ly = by - ty * half;
        const rx = bx + tx * half;
        const ry = by + ty * half;
        if (pass === 0) g.fillTriangle(lx - this.cnx * 0.6, ly - this.cny * 0.6, rx - this.cnx * 0.6, ry - this.cny * 0.6, ax + this.cnx * 0.7, ay + this.cny * 0.7);
        else if (pass === 1) g.fillTriangle(lx, ly, rx, ry, ax, ay);
        else g.fillTriangle(lx, ly, (lx + rx) / 2, (ly + ry) / 2, ax, ay);
      }
    }
  }

  /** Crin de pelo del color de la cabeza: mechones en capas, de oscuro a claro (un color por capa). */
  private mane(total: number, sway: number, c: TubeColors): void {
    const g = this.g;
    const st = this.style;
    const from = st.maneFrom * total;
    const step = MANE_STEP;
    for (let layer = 0; layer < 4; layer++) {
      // Capa 3: la gorguera bajo la cabeza.
      g.fillStyle(layer === 3 ? c.fur[2] : c.fur[layer * 2], 1);
      let k = 0;
      for (let s = from; s < total; s += step, k++) {
        const f = (s - from) / Math.max(1, total - from);
        if (layer === 3 && f <= 0.7) continue;
        this.at(s);
        const len = st.maneLen[0] + (st.maneLen[1] - st.maneLen[0]) * f;
        const h = this.cw / 2;
        const tx = this.cny;
        const ty = -this.cnx;
        if (layer === 3) {
          const l = len * 0.55 * (0.7 + 0.4 * hash2(k, 5, 4));
          const ang = 0.7 + sway * 0.5;
          const dx = -this.cnx * Math.cos(ang) + tx * Math.sin(ang);
          const dy = -this.cny * Math.cos(ang) + ty * Math.sin(ang);
          const bx = this.cx - this.cnx * h * 0.6;
          const by = this.cy - this.cny * h * 0.6;
          g.fillTriangle(bx - tx, by - ty, bx + tx, by + ty, bx + dx * l, by + dy * l);
          continue;
        }
        const jitter = hash2(k, layer, 3) - 0.5;
        const l = len * (0.7 + 0.45 * hash2(k, layer, 9)) * (1 - layer * 0.15);
        const ang = 0.55 + jitter * 0.5 + sway * (0.6 + f);
        // Hacia afuera del lomo y hacia la base.
        const dx = this.cnx * Math.cos(ang) + tx * Math.sin(ang);
        const dy = this.cny * Math.cos(ang) + ty * Math.sin(ang);
        const bx = this.cx + this.cnx * h * (0.6 - layer * 0.14);
        const by = this.cy + this.cny * h * (0.6 - layer * 0.14);
        const wv = 1.4 + 0.7 * (1 - f);
        g.fillTriangle(bx - tx * wv, by - ty * wv, bx + tx * wv, by + ty * wv, bx + dx * l, by + dy * l);
      }
    }
  }
}

// ── Onda del coletazo (S20) ────────────────────────────────────────────────

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
