import Phaser from 'phaser';
import { GAMEPLAY } from '../../config/gameplay';

// Dibujo por código de Moñái y de los árboles de su arena (S26), con el criterio de Teju Jagua (tejuJaguaArt.ts):
// texturas generadas una vez al doble de detalle (ART_K) y dibujadas a escala 1/ART_K; el cuerpo, cada frame.
// Moñái mira a la izquierda. La cabeza dibujada ocupa la zona de daño (headWidth × headHeight); los cuernos
// sobresalen arriba y no hacen daño.
const CFG = GAMEPLAY.monai;

export const HEAD_TEXTURE = 'monai_head';
export const HEAD_OPEN_TEXTURE = 'monai_head_open';
export const HEAD_DAZE_TEXTURE = 'monai_head_daze';
export const HORNS_TEXTURE = 'monai_horns';
/** Píxeles de textura por unidad del mundo. */
export const ART_K = 2;

/** Colores de la serpiente: verde con dibujo dorsal oscuro y vientre crema. */
export const SNAKE = {
  outline: 0x1e2e14,
  body: 0x4f7d2c,
  shade: 0x3a5e21,
  light: 0x86b24a,
  belly: 0xd8cf86,
  spot: 0x2b4618,
  /** Vueltas detrás del tronco: más oscuras. */
  back: 0x2f4a1c,
  backOutline: 0x18240f,
  eye: 0xf2c14e,
  mouth: 0x7a1f2b,
  fang: 0xf4f0e0,
  horn: 0xf1ead2,
  hornBand: 0xb9ae8a,
  star: 0xffe27a,
} as const;

/** Tamaño de las texturas de la cabeza (unidades) y punto que coincide con el centro de la zona de daño. */
const HEAD_W = 38;
const HEAD_H = 34;
const HEAD_CX = 15;
const HEAD_CY = 24;

/** Origen de las texturas de la cabeza y los cuernos (fracciones): el centro de la zona de daño. */
export function headOrigin(): [number, number] {
  return [HEAD_CX / HEAD_W, HEAD_CY / HEAD_H];
}

export function ensureMonaiArt(scene: Phaser.Scene): void {
  if (!scene.textures.exists(HEAD_TEXTURE)) makeHead(scene, HEAD_TEXTURE, 'closed');
  if (!scene.textures.exists(HEAD_OPEN_TEXTURE)) makeHead(scene, HEAD_OPEN_TEXTURE, 'open');
  if (!scene.textures.exists(HEAD_DAZE_TEXTURE)) makeHead(scene, HEAD_DAZE_TEXTURE, 'daze');
  if (!scene.textures.exists(HORNS_TEXTURE)) makeHorns(scene);
}

/** Ruido estable (0..1) para variar sin Math.random. */
function hash(a: number, b: number): number {
  const v = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return v - Math.floor(v);
}

/**
 * Cabeza de perfil, mirando a la izquierda. La zona de daño (headWidth × headHeight) queda centrada en (HEAD_CX, HEAD_CY):
 * el cráneo, el hocico y la mandíbula la llenan. `open`: fauces abiertas con colmillos (ataca). `daze`: ojo cerrado (aturdida).
 */
function makeHead(scene: Phaser.Scene, key: string, mood: 'closed' | 'open' | 'daze'): void {
  const k = ART_K;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  const left = HEAD_CX - CFG.headWidth / 2;
  const top = HEAD_CY - CFG.headHeight / 2;
  const w = CFG.headWidth;
  const h = CFG.headHeight;
  const e = (x: number, y: number, ew: number, eh: number) => g.fillEllipse(x * k, y * k, ew * k, eh * k);
  const jawDrop = mood === 'open' ? h * 0.22 : 0;
  // Formas en fracciones de la zona de daño: nuca, cráneo, hocico y mandíbula.
  const nape = [left + w * 0.8, top + h * 0.55, w * 0.42, h * 0.8] as const;
  const skull = [left + w * 0.5, top + h * 0.4, w * 0.82, h * 0.62] as const;
  const snout = [left + w * 0.2, top + h * 0.52, w * 0.42, h * 0.46] as const;
  const jaw = [left + w * 0.45, top + h * 0.78 + jawDrop * 0.6, w * 0.72, h * 0.34] as const;

  // Borde oscuro (todo un poco más grande) y relleno.
  g.fillStyle(SNAKE.outline);
  for (const [x, y, ew, eh] of [nape, skull, snout, jaw]) e(x, y, ew + 2, eh + 2);
  if (mood === 'open') {
    // Boca abierta: el interior entre el labio de arriba y la mandíbula, con dos colmillos.
    g.fillStyle(SNAKE.mouth).fillTriangle((left + 1) * k, (top + h * 0.62) * k, (left + w * 0.7) * k, (top + h * 0.66) * k, (left + 2) * k, (top + h * 0.62 + jawDrop + 3) * k);
    g.fillStyle(SNAKE.fang);
    for (const fx of [0.12, 0.3]) {
      const x = left + w * fx;
      const y = top + h * 0.62;
      g.fillTriangle((x - 1.2) * k, y * k, (x + 1.2) * k, y * k, x * k, (y + 3.2) * k);
    }
  }
  g.fillStyle(SNAKE.belly);
  e(jaw[0], jaw[1], jaw[2], jaw[3]);
  g.fillStyle(SNAKE.body);
  e(nape[0], nape[1], nape[2], nape[3]);
  e(skull[0], skull[1], skull[2], skull[3]);
  e(snout[0], snout[1], snout[2], snout[3]);
  // Labio de abajo del cráneo (separa la mandíbula) y luz arriba.
  g.fillStyle(SNAKE.shade);
  e(skull[0] + 1, top + h * 0.6, w * 0.78, h * 0.12);
  g.fillStyle(SNAKE.light, 0.85);
  e(left + w * 0.45, top + h * 0.2, w * 0.5, h * 0.14);
  // Escamas del cráneo: manchas oscuras en fila.
  g.fillStyle(SNAKE.spot);
  for (let i = 0; i < 4; i++) e(left + w * (0.42 + i * 0.13), top + h * (0.26 + hash(i, 3) * 0.08), 2.4, 1.6);
  if (mood !== 'open') {
    // Comisura de la boca.
    g.lineStyle(1 * k, SNAKE.outline).lineBetween((left + 1) * k, (top + h * 0.64) * k, (left + w * 0.62) * k, (top + h * 0.7) * k);
  }
  // Fosa nasal.
  g.fillStyle(SNAKE.outline).fillCircle((left + 2.4) * k, (top + h * 0.42) * k, 0.8 * k);
  // Ojo hipnótico (pupila de rendija) o cerrado; ceja oscura encima.
  const ex = left + w * 0.36;
  const ey = top + h * 0.36;
  g.fillStyle(SNAKE.spot);
  e(ex + 0.4, ey - 2.4, 6.4, 2);
  if (mood === 'daze') {
    g.lineStyle(1 * k, SNAKE.outline).lineBetween((ex - 2.4) * k, ey * k, (ex + 2.4) * k, (ey + 0.6) * k);
  } else {
    g.fillStyle(SNAKE.outline).fillCircle(ex * k, ey * k, 3 * k);
    g.fillStyle(SNAKE.eye).fillCircle(ex * k, ey * k, 2.3 * k);
    g.fillStyle(SNAKE.outline).fillRect((ex - 0.45) * k, (ey - 2) * k, 0.9 * k, 4 * k);
    g.fillStyle(0xffffff).fillCircle((ex - 1) * k, (ey - 1) * k, 0.5 * k);
  }
  g.generateTexture(key, HEAD_W * k, HEAD_H * k);
  g.destroy();
}

/** Cuernos largos que salen de la nuca hacia arriba y atrás, color hueso con anillos (el tinte los vuelve iridiscentes). */
function makeHorns(scene: Phaser.Scene): void {
  const k = ART_K;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  const left = HEAD_CX - CFG.headWidth / 2;
  const top = HEAD_CY - CFG.headHeight / 2;
  const w = CFG.headWidth;
  // Dos cuernos: base sobre el cráneo, punta arriba y hacia atrás (el de atrás, más largo).
  const horns = [
    { bx: left + w * 0.6, by: top + 2, cx: left + w * 0.62, cy: top - 8, tx: left + w * 0.95, ty: 1.5, r: 1.9 },
    { bx: left + w * 0.78, by: top + 3, cx: left + w * 0.84, cy: top - 6, tx: HEAD_W - 1.5, ty: 4, r: 1.7 },
  ];
  const steps = 22;
  for (const pass of [0, 1, 2]) {
    for (const hn of horns) {
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const u = 1 - t;
        const x = u * u * hn.bx + 2 * u * t * hn.cx + t * t * hn.tx;
        const y = u * u * hn.by + 2 * u * t * hn.cy + t * t * hn.ty;
        const r = hn.r * (1 - t * 0.7);
        if (pass === 0) g.fillStyle(SNAKE.outline).fillCircle(x * k, y * k, (r + 0.8) * k);
        else if (pass === 1) g.fillStyle(i % 5 === 2 && t < 0.8 ? SNAKE.hornBand : SNAKE.horn).fillCircle(x * k, y * k, r * k);
        else if (t < 0.85) g.fillStyle(0xffffff, 0.7).fillCircle((x - r * 0.35) * k, (y - r * 0.2) * k, r * 0.35 * k);
      }
    }
  }
  g.generateTexture(HORNS_TEXTURE, HEAD_W * k, HEAD_H * k);
  g.destroy();
}

// ── Cuerpo ────────────────────────────────────────────────────────────────

/** Un punto del cuerpo para dibujar: posición, radio y si queda detrás del tronco. */
export interface BodyPoint {
  x: number;
  y: number;
  r: number;
  back: boolean;
}

/** Vueltas de atrás que asoman a la altura de la copa: van en otra capa, delante de la copa y de la plataforma (S28). */
export interface HighBack {
  gfx: Phaser.GameObjects.Graphics;
  /** Los puntos de atrás cuyo borde de arriba queda sobre esta y van en `gfx`. */
  belowY: number;
}

/**
 * Cuerpo de serpiente: un tubo que se afina hacia la cola, con borde oscuro, vientre crema abajo, manchas en el lomo
 * y brillo arriba. `front` recibe lo que va delante del tronco y `back` las vueltas de atrás (más oscuras); con
 * `high`, las vueltas de atrás que tocan la copa van en su capa (siguen oscuras, pero no se esconden tras la copa).
 * Los puntos van de la nuca a la cola; se dibujan de la cola a la nuca (lo de adelante monta encima).
 */
export function drawSnakeBody(
  front: Phaser.GameObjects.Graphics,
  back: Phaser.GameObjects.Graphics,
  pts: readonly BodyPoint[],
  n: number,
  alpha: number,
  high?: HighBack,
): void {
  const backOf = (p: BodyPoint) => (high && p.y - p.r < high.belowY ? high.gfx : back);
  for (let i = n - 1; i >= 0; i--) {
    const p = pts[i];
    const g = p.back ? backOf(p) : front;
    g.fillStyle(p.back ? SNAKE.backOutline : SNAKE.outline, alpha).fillCircle(p.x, p.y, p.r + 1);
  }
  for (let i = n - 1; i >= 0; i--) {
    const p = pts[i];
    if (p.back) {
      backOf(p).fillStyle(SNAKE.back, alpha).fillCircle(p.x, p.y, p.r);
      continue;
    }
    front.fillStyle(SNAKE.body, alpha).fillCircle(p.x, p.y, p.r);
    front.fillStyle(SNAKE.belly, alpha).fillCircle(p.x, p.y + p.r * 0.45, p.r * 0.55);
  }
  for (let i = n - 1; i >= 0; i--) {
    const p = pts[i];
    if (p.back) continue;
    // Manchas del lomo cada tres puntos y brillo arriba.
    if (i % 3 === 1) front.fillStyle(SNAKE.spot, alpha).fillEllipse(p.x, p.y - p.r * 0.35, p.r * 1.1, p.r * 0.7);
    front.fillStyle(SNAKE.light, alpha * 0.8).fillCircle(p.x - p.r * 0.2, p.y - p.r * 0.5, p.r * 0.3);
  }
}

/** Estrellitas de mareo que giran sobre la cabeza (ventana para golpear). */
export function drawDazeStars(g: Phaser.GameObjects.Graphics, x: number, y: number, timeMs: number, alpha: number): void {
  const n = 3;
  for (let i = 0; i < n; i++) {
    const a = timeMs / 260 + (i * Math.PI * 2) / n;
    const sx = x + Math.cos(a) * 11;
    const sy = y + Math.sin(a) * 3.5;
    const s = 2.6;
    g.fillStyle(SNAKE.star, alpha);
    g.fillTriangle(sx - s, sy, sx + s, sy, sx, sy - s * 1.4);
    g.fillTriangle(sx - s, sy, sx + s, sy, sx, sy + s * 1.4);
  }
}

// ── Árboles de la arena ───────────────────────────────────────────────────

/** Colores de los árboles: corteza y tres tonos de follaje (luz desde arriba a la izquierda). */
const BARK = { base: 0x5e3d25, dark: 0x3a2516, light: 0x80583a, outline: 0x24170d };
const LEAF_TONES = [
  { dark: 0x24461f, mid: 0x356b2c, light: 0x5c9a3e, outline: 0x15290f },
  { dark: 0x2a4a1c, mid: 0x3f7230, light: 0x6fa547, outline: 0x182b10 },
  { dark: 0x21431f, mid: 0x30652f, light: 0x548f43, outline: 0x13270f },
] as const;

export interface TreeKeys {
  trunk: string;
  crown: string;
  /** Alto de la copa por encima y por debajo de la línea de la copa (unidades), para el origen. */
  crownAbove: number;
  crownBelow: number;
}

interface Blob {
  x: number;
  y: number;
  r: number;
}

/**
 * Árbol `i` de la arena: tronco con corteza (surcos, nudos, raíces y un muñón de rama) de `height` unidades y copa
 * irregular de racimos de hojas. Cada árbol varía (semilla `i`): ancho y alto de la copa, tono, surcos y ramas.
 * La copa va detrás de Kerana y de la plataforma "=" (que se ve como una rama que la cruza) y tapa la punta del tronco.
 */
export function ensureTreeArt(scene: Phaser.Scene, i: number, height: number, halfWidth: number): TreeKeys {
  const keys: TreeKeys = {
    trunk: `monai_tree_trunk_${i}`,
    crown: `monai_tree_crown_${i}`,
    crownAbove: CFG.crownAbove * (1 + (hash(i, 7) - 0.5) * CFG.treeVariation),
    crownBelow: CFG.crownBelow,
  };
  if (!scene.textures.exists(keys.trunk)) makeTrunk(scene, keys.trunk, i, height, halfWidth);
  if (!scene.textures.exists(keys.crown)) makeCrown(scene, keys, i);
  return keys;
}

/** Ancho de la textura del tronco (unidades): el tronco más las raíces a los lados. */
export function trunkTextureWidth(halfWidth: number): number {
  return halfWidth * 2 + 12;
}

function makeTrunk(scene: Phaser.Scene, key: string, seed: number, height: number, hw: number): void {
  const k = ART_K;
  const w = trunkTextureWidth(hw);
  const h = height;
  const cx = w / 2;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  // Raíces: triángulos que se abren al pie.
  const root = (side: number, spread: number, rh: number) => {
    g.fillStyle(BARK.outline).fillTriangle((cx + side * (hw - 2)) * k, (h - rh - 1) * k, (cx + side * (hw + spread + 1)) * k, h * k, (cx + side * (hw - 3)) * k, h * k);
    g.fillStyle(BARK.base).fillTriangle((cx + side * (hw - 2)) * k, (h - rh) * k, (cx + side * (hw + spread)) * k, h * k, (cx + side * (hw - 3)) * k, h * k);
  };
  root(-1, 4 + hash(seed, 1) * 2, 9);
  root(1, 3 + hash(seed, 2) * 3, 7);
  // Muñón de rama (a veces a un lado, a veces al otro).
  const side = hash(seed, 3) < 0.5 ? -1 : 1;
  const by = h * (0.25 + hash(seed, 4) * 0.25);
  g.fillStyle(BARK.outline).fillTriangle((cx + side * (hw - 1)) * k, (by - 1) * k, (cx + side * (hw + 5)) * k, (by - 6) * k, (cx + side * (hw - 1)) * k, (by + 5) * k);
  g.fillStyle(BARK.base).fillTriangle((cx + side * (hw - 1)) * k, by * k, (cx + side * (hw + 4)) * k, (by - 5) * k, (cx + side * (hw - 1)) * k, (by + 4) * k);
  // Fuste: borde, base, luz a la izquierda y sombra a la derecha.
  g.fillStyle(BARK.outline).fillRect((cx - hw - 1) * k, 0, (hw * 2 + 2) * k, h * k);
  g.fillStyle(BARK.base).fillRect((cx - hw) * k, 0, hw * 2 * k, h * k);
  g.fillStyle(BARK.light).fillRect((cx - hw) * k, 0, 2.5 * k, h * k);
  g.fillStyle(BARK.dark).fillRect((cx + hw - 3) * k, 0, 3 * k, h * k);
  // Surcos de la corteza: líneas que ondulan, cada árbol con su fase.
  for (let s = 0; s < 3; s++) {
    const x0 = cx - hw + 3 + s * ((hw * 2 - 6) / 2);
    const phase = hash(seed, 10 + s) * 6;
    for (let y = 1; y < h - 1; y += 1) {
      const x = x0 + Math.sin(y / 5 + phase) * 0.9;
      if (hash(s * 31 + seed, y) < 0.12) continue;
      g.fillStyle(BARK.dark).fillRect(x * k, y * k, 0.9 * k, 1 * k);
    }
  }
  // Nudos.
  for (let n = 0; n < 2; n++) {
    const ny = h * (0.3 + hash(seed, 20 + n) * 0.55);
    const nx = cx + (hash(seed, 30 + n) - 0.5) * hw;
    g.fillStyle(BARK.outline).fillEllipse(nx * k, ny * k, 3.4 * k, 4.4 * k);
    g.fillStyle(BARK.light).fillEllipse((nx - 0.4) * k, (ny - 0.4) * k, 1.6 * k, 2.2 * k);
  }
  g.generateTexture(key, Math.ceil(w * k), Math.ceil(h * k));
  g.destroy();
}

/** Racimos de la copa: un contorno irregular de círculos, más chato abajo, y relleno adentro. */
function crownBlobs(seed: number, w: number, above: number, below: number): Blob[] {
  const blobs: Blob[] = [];
  const cx = w / 2;
  const cy = above;
  const ring = 16;
  for (let j = 0; j < ring; j++) {
    const a = (j / ring) * Math.PI * 2 + hash(seed, j) * 0.3;
    const rx = w / 2 - 9;
    const ry = Math.sin(a) < 0 ? above - 9 : below - 6;
    blobs.push({ x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry, r: 7 + hash(seed, j + 50) * 5 });
  }
  for (let j = 0; j < 9; j++) {
    blobs.push({ x: cx + (hash(seed, j + 80) - 0.5) * (w - 30), y: cy + (hash(seed, j + 90) - 0.6) * (above - 6), r: 9 + hash(seed, j + 99) * 5 });
  }
  return blobs;
}

function makeCrown(scene: Phaser.Scene, keys: TreeKeys, seed: number): void {
  const k = ART_K;
  const tone = LEAF_TONES[seed % LEAF_TONES.length];
  const w = CFG.crownWidth * (1 + (hash(seed, 5) - 0.5) * CFG.treeVariation);
  const above = keys.crownAbove;
  const below = keys.crownBelow;
  const h = above + below;
  const blobs = crownBlobs(seed, w, above, below);
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  // Relleno de adentro (sin huecos entre racimos) y racimos: borde, sombra, tono medio y luz arriba a la izquierda.
  g.fillStyle(tone.dark).fillEllipse((w / 2) * k, (above - 2) * k, (w - 22) * k, (h - 12) * k);
  for (const b of blobs) g.fillStyle(tone.outline).fillCircle(b.x * k, b.y * k, (b.r + 1.2) * k);
  for (const b of blobs) g.fillStyle(tone.dark).fillCircle(b.x * k, b.y * k, b.r * k);
  for (const b of blobs) g.fillStyle(tone.mid).fillCircle((b.x - 1) * k, (b.y - 1.6) * k, b.r * 0.8 * k);
  for (const b of blobs) {
    if (b.y > above + 2) continue;
    g.fillStyle(tone.light).fillCircle((b.x - b.r * 0.3) * k, (b.y - b.r * 0.4) * k, b.r * 0.45 * k);
  }
  // Hojitas sueltas: puntos claros y oscuros sobre los racimos.
  for (const b of blobs) {
    for (let j = 0; j < 4; j++) {
      const px = b.x + (hash(b.x, j) - 0.5) * b.r * 1.4;
      const py = b.y + (hash(j, b.y) - 0.5) * b.r * 1.2;
      g.fillStyle(j % 2 ? tone.light : tone.outline, 0.8).fillRect(px * k, py * k, 1.2 * k, 1.2 * k);
    }
  }
  g.generateTexture(keys.crown, Math.ceil(w * k), Math.ceil(h * k));
  g.destroy();
}
