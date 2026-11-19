import { GAMEPLAY } from '../../config/gameplay';
import { type AtlasFrame, bayer, clamp, hash, makePixels, mix, type Pixels, put, alphaAt, smoothstep } from '../../systems/pixelArt';
import { BIG_CAP, type Glyph, SMALL_ROWS, SMALL_X_TOP, setText } from './logoFont';

// Portada (S105): todo lo que se pinta una sola vez, sin Phaser (TitleLook.ts sube el atlas). El logo y la bruma van a
// 1 píxel por unidad (como los tiles); el ñandutí, las estrellas y la estrella fugaz, a 2 (hilo fino, como los sprites).
const LOOK = GAMEPLAY.titleLook;
const TAU = Math.PI * 2;
/** Píxeles por unidad de lo fino (ñandutí, estrellas, estrella fugaz). */
export const FINE_K = 2;

export interface TitleBlock {
  px: Pixels;
  /** Dónde cae la fila de arriba de las letras grandes (píxel del bloque) y su ancho, para ubicar el bloque. */
  logoX: number;
  logoY: number;
  logoWidth: number;
  /** Fila de abajo del bloque que ocupa el subtítulo (con su sombra), para poner el ñandutí debajo. */
  bottom: number;
  /** Máscara de las letras (sin contorno), la que cruza el destello. */
  ink: boolean[];
  /** Píxel de tinta más a la derecha de la fila de arriba (la punta de la última letra): ahí destella el chispazo. */
  tipX: number;
  tipY: number;
}

interface Part {
  glyph: Glyph;
  x: number;
  y: number;
  gradTop: number;
  gradBottom: number;
  shadow: readonly number[];
  dither: number;
}

/**
 * Logo y subtítulo en un solo bloque: degradé de cinco tonos por fila (oro claro arriba, ámbar abajo, con un tramado
 * de una fila entre tonos en las letras grandes), brillo de 1 píxel en cada borde de arriba, la fila de abajo de cada
 * trazo más honda, contorno ciruela de 1 píxel y la sombra desplazada.
 */
export function paintTitleBlock(title: string, subtitle: string): TitleBlock {
  const big = setText(title, 'big');
  const small = setText(subtitle, 'small');
  const L = LOOK.logo;
  const [bsx] = L.shadowOffset;
  const [ssx, ssy] = L.subShadowOffset;
  const blockW = Math.max(big.width, small.width) + 2 + Math.max(bsx, ssx);
  const bigX = 1 + Math.floor((blockW - 2 - Math.max(bsx, ssx) - big.width) / 2);
  const smallX = 1 + Math.floor((blockW - 2 - Math.max(bsx, ssx) - small.width) / 2);
  const bigY = 1;
  // El subtítulo arranca en su fila de las altas (la 2 de su grilla).
  const smallY = bigY + BIG_CAP + 1 + L.subtitleGap - 2;
  const parts: Part[] = [
    { glyph: big, x: bigX, y: bigY, gradTop: 0, gradBottom: BIG_CAP, shadow: L.shadowOffset, dither: 0.45 },
    { glyph: small, x: smallX, y: smallY, gradTop: SMALL_X_TOP - 1, gradBottom: SMALL_ROWS, shadow: L.subShadowOffset, dither: 0 },
  ];
  const blockH = smallY + SMALL_ROWS + 1 + ssy;
  const px = makePixels(blockW, blockH);
  const ink = new Array<boolean>(blockW * blockH).fill(false);
  const owner = new Int8Array(blockW * blockH).fill(-1);
  parts.forEach((p, n) => {
    for (let y = 0; y < p.glyph.height; y++)
      for (let x = 0; x < p.glyph.width; x++) {
        if (!p.glyph.ink[y * p.glyph.width + x]) continue;
        const i = (p.y + y) * blockW + p.x + x;
        ink[i] = true;
        owner[i] = n;
      }
  });
  const isInk = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < blockW && y < blockH && ink[y * blockW + x];
  const ring = (x: number, y: number): number => {
    // Parte dueña del vecino con tinta (para el contorno y la sombra); -1 si no hay.
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx;
        const yy = y + dy;
        if (isInk(xx, yy)) return owner[yy * blockW + xx];
      }
    return -1;
  };
  const outlined = new Int8Array(blockW * blockH).fill(-1);
  for (let y = 0; y < blockH; y++) for (let x = 0; x < blockW; x++) outlined[y * blockW + x] = ring(x, y);
  // Sombra: la silueta con contorno, corrida; solo donde no hay letra ni contorno.
  for (let y = 0; y < blockH; y++)
    for (let x = 0; x < blockW; x++) {
      if (outlined[y * blockW + x] >= 0) continue;
      for (let n = 0; n < parts.length; n++) {
        const [sx, sy] = parts[n].shadow;
        const xx = x - sx;
        const yy = y - sy;
        if (xx < 0 || yy < 0 || outlined[yy * blockW + xx] !== n) continue;
        put(px, x, y, L.shadow, Math.round(L.shadowAlpha * 255));
        break;
      }
    }
  const tones = L.gradient;
  for (let y = 0; y < blockH; y++)
    for (let x = 0; x < blockW; x++) {
      const n = outlined[y * blockW + x];
      if (n < 0) continue;
      if (!isInk(x, y)) {
        put(px, x, y, L.outline);
        continue;
      }
      const p = parts[owner[y * blockW + x]];
      const row = y - p.y;
      const v = ((row - p.gradTop + 0.5) / (p.gradBottom - p.gradTop)) * tones.length + bayer(x, y) * p.dither;
      let color: number = tones[clamp(Math.floor(v), 0, tones.length - 1)];
      if (!isInk(x, y - 1)) color = L.highlight;
      else if (!isInk(x, y + 1)) color = L.underside;
      put(px, x, y, color);
    }
  let tipX = bigX;
  for (let x = bigX; x < bigX + big.width; x++) if (isInk(x, bigY)) tipX = x;
  return { px, logoX: bigX, logoY: bigY, logoWidth: big.width, bottom: smallY + SMALL_ROWS + 1 + ssy, ink, tipX, tipY: bigY };
}

export interface ShineFrame {
  name: string;
  px: Pixels;
  /** Dónde va el cuadro recortado dentro del bloque. */
  x: number;
  y: number;
}

/** Cuadros del destello: una franja diagonal (/) de luz, con un hilo más fino detrás, solo sobre las letras. */
export function paintShineFrames(block: TitleBlock): ShineFrame[] {
  const S = LOOK.shine;
  const { width, height } = block.px;
  const frames: ShineFrame[] = [];
  const span = width + height * S.slant + S.edge * 2 + S.trailGap;
  const count = Math.ceil(span / S.step) + 1;
  for (let k = 0; k < count; k++) {
    const c = -S.edge + k * S.step;
    const full = makePixels(width, height);
    let any = false;
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        if (!block.ink[y * width + x]) continue;
        const u = x + y * S.slant;
        const d = Math.abs(u - c);
        const dt = Math.abs(u - (c - S.trailGap));
        if (d < S.core) put(full, x, y, S.coreColor);
        else if (d < S.edge) {
          // El borde de la franja se deshace con el tramado (pixel art, sin desenfoque).
          if ((S.edge - d) / (S.edge - S.core) + bayer(x, y) * 0.9 > 0.35) put(full, x, y, S.edgeColor, 230);
        } else if (dt < S.trail) put(full, x, y, S.edgeColor, 210);
        else continue;
        any = true;
      }
    if (!any) continue;
    const box = trimBox(full);
    frames.push({ name: `shine_${frames.length}`, px: box.px, x: box.x0, y: box.y0 });
  }
  return frames;
}

function trimBox(p: Pixels): { px: Pixels; x0: number; y0: number } {
  let x0 = p.width;
  let y0 = p.height;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < p.height; y++)
    for (let x = 0; x < p.width; x++) {
      if (!alphaAt(p, x, y)) continue;
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
    }
  if (x1 < 0) return { px: makePixels(1, 1), x0: 0, y0: 0 };
  const out = makePixels(x1 - x0 + 1, y1 - y0 + 1);
  for (let y = 0; y < out.height; y++) out.data.set(p.data.subarray(((y + y0) * p.width + x0) * 4, ((y + y0) * p.width + x1 + 1) * 4), y * out.width * 4);
  return { px: out, x0, y0 };
}

/** Pone el color más opaco (para los hilos que se cruzan). */
function plot(p: Pixels, x: number, y: number, color: number, alpha: number): void {
  const xi = Math.round(x);
  const yi = Math.round(y);
  if (alpha <= 0 || alphaAt(p, xi, yi) >= alpha) return;
  put(p, xi, yi, color, Math.round(alpha));
}

function line(p: Pixels, x0: number, y0: number, x1: number, y1: number, color: number, alpha: number): void {
  const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
  for (let i = 0; i <= n; i++) plot(p, x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, color, alpha);
}

function circle(p: Pixels, cx: number, cy: number, r: number, color: number, alpha: number): void {
  const n = Math.max(12, Math.ceil(TAU * r * 1.5));
  for (let i = 0; i < n; i++) plot(p, cx + Math.cos((TAU * i) / n) * r, cy + Math.sin((TAU * i) / n) * r, color, alpha);
}

/**
 * Estrellita de cuatro puntas con puntas de `arm` píxeles (a FINE_K por unidad): núcleo blanco, puntas de oro que se
 * afinan (tres píxeles de ancho cerca del centro, uno en la punta) y se apagan.
 */
export function paintStar(arm: number, gold = 0xf2c14e): Pixels {
  const size = arm * 2 + 3;
  const c = arm + 1;
  const p = makePixels(size, size);
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  for (let d = 1; d <= arm; d++) {
    const t = d / (arm + 1);
    const color = mix(0xfff8dc, gold, Math.min(1, t * 1.3));
    const a = Math.round(255 * Math.pow(1 - t, 0.7));
    const thick = arm >= 4 && d <= Math.max(1, Math.round(arm * 0.3));
    for (const [dx, dy] of dirs) {
      put(p, c + dx * d, c + dy * d, color, a);
      if (thick) {
        put(p, c + dx * d + dy, c + dy * d + dx, gold, Math.round(a * 0.55));
        put(p, c + dx * d - dy, c + dy * d - dx, gold, Math.round(a * 0.55));
      }
    }
  }
  // El centro: blanco, con un rombo chico alrededor.
  for (const [dx, dy] of dirs) put(p, c + dx, c + dy, 0xffffff);
  if (arm >= 3)
    for (const [dx, dy] of [
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ])
      put(p, c + dx, c + dy, 0xfff1c2, 170);
  put(p, c, c, 0xffffff);
  return p;
}

/**
 * Estrellita del menú (1 píxel por unidad, como el logo): cuatro puntas cóncavas (un astroide de radio `r`), del
 * blanco del centro al oro y al ámbar en las puntas, con el contorno ciruela del logo.
 */
export function paintMenuStar(r: number): Pixels {
  const L = LOOK.logo;
  const arm = Math.floor(r);
  const c = arm + 1;
  const size = arm * 2 + 3;
  const p = makePixels(size, size);
  const lim = Math.pow(r, 2 / 3);
  const inStar = (dx: number, dy: number): boolean => Math.pow(Math.abs(dx), 2 / 3) + Math.pow(Math.abs(dy), 2 / 3) <= lim + 1e-6;
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const dx = x - c;
      const dy = y - c;
      if (inStar(dx, dy)) {
        const d = Math.max(Math.abs(dx), Math.abs(dy));
        const color = d === 0 ? L.highlight : d === 1 ? L.gradient[0] : d < arm ? L.gradient[2] : L.gradient[3];
        put(p, x, y, color);
        continue;
      }
      let near = false;
      for (let j = -1; j <= 1 && !near; j++) for (let i = -1; i <= 1 && !near; i++) if (Math.abs(i) + Math.abs(j) === 1 && inStar(dx + i, dy + j)) near = true;
      if (near) put(p, x, y, L.outline);
    }
  return p;
}

/**
 * Ñandutí (a FINE_K por unidad): la roseta del centro (rayos, anillos, un zigzag de pétalos y el borde festoneado) y
 * una franja a cada lado (dos hilos con zigzag y rosetas chicas) que se deshace hacia las puntas.
 */
export function paintNanduti(): Pixels {
  const N = LOOK.nanduti;
  const R = N.radius;
  const w = (R + N.wing) * 2 + 1;
  const h = R * 2 + 3;
  const cx = R + N.wing;
  const cy = R + 1;
  const p = makePixels(w, h);
  const full = Math.round(N.alpha * 255);
  const [r0, r1, r2, r3] = N.rings;
  // Rayos.
  for (let k = 0; k < N.spokes; k++) {
    const a = (TAU * k) / N.spokes;
    line(p, cx + Math.cos(a) * 3, cy + Math.sin(a) * 3, cx + Math.cos(a) * r3, cy + Math.sin(a) * r3, k % 2 ? N.deep : N.thread, full);
  }
  circle(p, cx, cy, r0, N.thread, full);
  circle(p, cx, cy, r2, N.thread, full);
  // Pétalos: de cada rayo (en el anillo de adentro) al medio entre dos rayos (más afuera) y al rayo siguiente.
  for (let k = 0; k < N.spokes; k += 2) {
    const a0 = (TAU * k) / N.spokes;
    const a1 = (TAU * (k + 1)) / N.spokes;
    const a2 = (TAU * (k + 2)) / N.spokes;
    line(p, cx + Math.cos(a0) * r1, cy + Math.sin(a0) * r1, cx + Math.cos(a1) * (r2 - 1), cy + Math.sin(a1) * (r2 - 1), N.thread, full);
    line(p, cx + Math.cos(a1) * (r2 - 1), cy + Math.sin(a1) * (r2 - 1), cx + Math.cos(a2) * r1, cy + Math.sin(a2) * r1, N.thread, full);
  }
  // Borde festoneado: un arco entre cada par de rayos y un nudo en cada punta.
  for (let k = 0; k < N.spokes; k++) {
    const a0 = (TAU * k) / N.spokes;
    const a1 = (TAU * (k + 1)) / N.spokes;
    for (let s = 0; s <= 8; s++) {
      const t = s / 8;
      const a = a0 + (a1 - a0) * t;
      const r = r3 - 2 + Math.sin(Math.PI * t) * 2.6;
      plot(p, cx + Math.cos(a) * r, cy + Math.sin(a) * r, N.thread, full);
    }
    plot(p, cx + Math.cos(a0) * r3, cy + Math.sin(a0) * r3, N.knot, 255);
    if (k % 2 === 0) plot(p, cx + Math.cos(a0) * r1, cy + Math.sin(a0) * r1, N.knot, 255);
  }
  // Nudo del centro.
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) put(p, cx + dx, cy + dy, dx === 0 || dy === 0 ? N.knot : N.thread, 255);
  // Franjas: dos hilos con zigzag; rosetas chicas cada tanto; se deshacen hacia la punta.
  const band = 3;
  const zig = 6;
  for (const side of [-1, 1]) {
    const start = R + 1;
    for (let d = start; d <= R + N.wing; d++) {
      const x = cx + side * d;
      const fade = 1 - smoothstep(R + N.wing * 0.45, R + N.wing, d);
      const keep = (x: number, y: number): boolean => fade + bayer(x, y) * 0.9 > 0.45;
      const a = Math.round(full * (0.55 + 0.45 * fade));
      if (keep(x, cy - band)) plot(p, x, cy - band, N.thread, a);
      if (keep(x, cy + band)) plot(p, x, cy + band, N.thread, a);
      // Zigzag entre los hilos.
      const ph = ((d - start) % (zig * 2)) / zig;
      const zy = ph < 1 ? -band + ph * band * 2 : band - (ph - 1) * band * 2;
      if (keep(x + 1, cy + zy)) plot(p, x, cy + zy, N.deep, a);
    }
    // Rosetas chicas sobre la franja.
    for (const d of [R + 18, R + 44, R + 72]) {
      const fade = 1 - smoothstep(R + N.wing * 0.45, R + N.wing, d);
      const x = cx + side * d;
      const a = Math.round(full * (0.5 + 0.5 * fade));
      for (let k = 0; k < 8; k++) {
        const ang = (TAU * k) / 8;
        line(p, x + Math.cos(ang), cy + Math.sin(ang), x + Math.cos(ang) * 5, cy + Math.sin(ang) * 5, N.thread, a);
      }
      circle(p, x, cy, 5, N.thread, a);
      put(p, x, cy, N.knot, 255);
    }
    put(p, cx + side * (R + N.wing), cy, N.knot, 200);
  }
  return p;
}

/** Contorno de arriba de una capa de bruma: bancos chatos (óvalos anchos) que se pisan, repetible cada `width`. */
function fogTop(width: number, seed: number, base: number): Float32Array {
  // Sin banco encima, la masa sigue más abajo (no quedan columnas vacías).
  const top = new Float32Array(width).fill(base + 26);
  const n = 15;
  for (let i = 0; i < n; i++) {
    const bx = (i + hash(i, seed) * 0.8) * (width / n);
    const rx = 26 + hash(seed, i * 3 + 1) * 52;
    const ry = 4 + hash(i * 5, seed + 1) * 12;
    const by = base + ry + hash(i * 7, seed + 2) * 22;
    for (let x = 0; x < width; x++) {
      // Distancia con vuelta (la tira se repite).
      let dx = Math.abs(x + 0.5 - bx) % width;
      if (dx > width / 2) dx = width - dx;
      if (dx >= rx) continue;
      top[x] = Math.min(top[x], by - ry * Math.sqrt(1 - (dx / rx) * (dx / rx)));
    }
  }
  return top;
}

/**
 * Una capa de bruma (1 píxel por unidad), repetible en x cada 640: bancos chatos que se juntan, vetas casi
 * horizontales adentro, tres escalones de alfa tramados con Bayer (la técnica de la niebla de la siesta, S103) y la
 * luz arriba. La de atrás se deshace también por abajo para no hacer una franja.
 */
export function paintFogStrip(layer: number, width = 640): Pixels {
  const F = LOOK.fog;
  const def = F.layers[layer];
  const h = def.height;
  const p = makePixels(width, h);
  const top = fogTop(width, def.seed, 4);
  const pal = F.palette;
  const fadeBottom = layer === 0;
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < h; y++) {
      const depth = y + 0.5 - top[x];
      if (depth < -3) continue;
      // Vetas: períodos que dividen el ancho, para que la tira se repita sin costura.
      const wisp =
        0.5 +
        0.32 * Math.sin((TAU * x) / (width / 4) + y * 0.42 + def.seed) +
        0.18 * Math.sin((TAU * x) / (width / 9) - y * 0.27 + def.seed * 2);
      let d = smoothstep(-3, F.edge, depth) * (0.45 + 0.55 * wisp);
      if (fadeBottom) d *= smoothstep(h, h * 0.45, y);
      const v = d + bayer(x, y) * 0.24;
      let level = -1;
      for (let i = 0; i < F.steps.length; i++) if (v >= F.steps[i]) level = i;
      if (level < 0) continue;
      // Luz arriba: el canto de cada banco más claro; lo hondo, más oscuro. Lo más tenue del borde no lleva el tono
      // más claro (con el tramado, haría una línea de puntos).
      const lit = 1 - smoothstep(0, F.edge * 1.4, depth) + bayer(x + 2, y + 1) * 0.25;
      const color = pal[clamp(Math.floor(lit * pal.length), 0, level === 0 ? pal.length - 2 : pal.length - 1)];
      put(p, x, y, color, Math.round(F.alphas[level] * 255));
    }
  }
  return p;
}

/** Estrella fugaz (a FINE_K por unidad), bajando hacia la derecha: cabeza blanca y cola que se afina y se apaga. */
export function paintShootingStar(): Pixels {
  const S = LOOK.shootingStar;
  const ang = 0.42;
  const len = S.length;
  const w = Math.ceil(Math.cos(ang) * len) + 4;
  const h = Math.ceil(Math.sin(ang) * len) + 4;
  const p = makePixels(w, h);
  const hx = w - 2;
  const hy = h - 2;
  for (let i = len; i >= 0; i--) {
    const t = i / len;
    const x = hx - Math.cos(ang) * i;
    const y = hy - Math.sin(ang) * i;
    if (t > 0.12 && 1 - t + bayer(Math.round(x), Math.round(y)) * 0.5 < 0.18) continue;
    const tail = S.tail;
    const color = t < 0.5 ? mix(tail[0], tail[1], t * 2) : mix(tail[1], tail[2], (t - 0.5) * 2);
    plot(p, x, y, color, 255 * Math.pow(1 - t, 0.9));
  }
  for (const [dx, dy, a] of [
    [0, 0, 255],
    [-1, 0, 230],
    [0, -1, 200],
    [1, 0, 120],
    [0, 1, 120],
  ])
    put(p, hx + dx, hy + dy, S.head, a);
  return p;
}

/** Cuadros del titilar de Eichu. */
export const twinkleFrame = (i: number): string => `twinkle_${i}`;
/** Cuadros de la estrellita del menú. */
export const MENU_STAR_FRAMES = ['menu_star_0', 'menu_star_1'] as const;

export interface TitleArt {
  frames: AtlasFrame[];
  block: TitleBlock;
  shine: ShineFrame[];
}

/** Todo lo de la portada en una lista de cuadros para un solo atlas. */
export function titleArt(title: string, subtitle: string): TitleArt {
  const block = paintTitleBlock(title, subtitle);
  const shine = paintShineFrames(block);
  const frames: AtlasFrame[] = [
    { name: 'block', px: block.px },
    { name: 'nanduti', px: paintNanduti() },
    { name: 'fog_0', px: paintFogStrip(0) },
    { name: 'fog_1', px: paintFogStrip(1) },
    { name: 'shooting', px: paintShootingStar() },
    { name: MENU_STAR_FRAMES[0], px: paintMenuStar(LOOK.menu.starArms[0]) },
    { name: MENU_STAR_FRAMES[1], px: paintMenuStar(LOOK.menu.starArms[1]) },
    ...LOOK.eichu.arms.map((arm, i) => ({ name: twinkleFrame(i), px: paintStar(arm, 0xffd76a) })),
    ...shine.map((s) => ({ name: s.name, px: s.px })),
  ];
  return { frames, block, shine };
}
