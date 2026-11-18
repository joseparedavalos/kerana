import { GAMEPLAY } from '../../config/gameplay';

// Pintor por software de Moñái (S102): lógica pura, sin Phaser (la prueban los tests y se vuelca a PNG fuera del
// juego). Cada función devuelve píxeles RGBA a ART_K píxeles por unidad; monaiArt.ts los sube como texturas una vez.
const LOOK = GAMEPLAY.monaiLook;
const PAL = LOOK.palette;
/** Píxeles de arte por unidad del mundo (= ART_K de la cabeza). */
export const PAINT_K = 2;

export interface Pixels {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

export function makePixels(width: number, height: number): Pixels {
  return { width, height, data: new Uint8ClampedArray(width * height * 4) };
}

function put(p: Pixels, x: number, y: number, color: number, alpha = 255): void {
  if (x < 0 || y < 0 || x >= p.width || y >= p.height) return;
  const i = (y * p.width + x) * 4;
  p.data[i] = (color >> 16) & 255;
  p.data[i + 1] = (color >> 8) & 255;
  p.data[i + 2] = color & 255;
  p.data[i + 3] = alpha;
}

const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);
const smooth = (t: number): number => t * t * (3 - 2 * t);
/** Tramado ordenado 4 × 4 (Bayer), en [-0,5; 0,5). */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
export const bayer = (i: number, j: number): number => (BAYER[((j & 3) << 2) | (i & 3)] + 0.5) / 16 - 0.5;

/** Mezcla de dos colores (0 = a, 1 = b). */
export function mix(a: number, b: number, t: number): number {
  const r = Math.round(((a >> 16) & 255) * (1 - t) + ((b >> 16) & 255) * t);
  const g = Math.round(((a >> 8) & 255) * (1 - t) + ((b >> 8) & 255) * t);
  const bl = Math.round((a & 255) * (1 - t) + (b & 255) * t);
  return (r << 16) | (g << 8) | bl;
}

// ── Cuerpo ────────────────────────────────────────────────────────────────

/** Radio del cuerpo (unidades) a la fracción `f` del largo: de la nuca (0) a la punta de la cola (1). */
export function bodyRadius(f: number): number {
  const prof = LOOK.body.profile;
  const t = clamp(f, 0, 1);
  for (let i = 1; i < prof.length; i++) {
    const [f1, r1] = prof[i];
    if (t > f1 && i < prof.length - 1) continue;
    const [f0, r0] = prof[i - 1];
    const u = f1 > f0 ? clamp((t - f0) / (f1 - f0), 0, 1) : 1;
    // El último tramo se cierra en punta; los demás pasan suave de un radio al otro.
    if (i === prof.length - 1) return r1 + (r0 - r1) * Math.pow(1 - u, LOOK.body.tipPower);
    return r0 + (r1 - r0) * smooth(u);
  }
  return 0;
}

/** Dónde van los rombos del lomo (unidades desde la nuca): la separación sigue al grosor. */
export function patternCenters(): number[] {
  const P = LOOK.pattern;
  const L = LOOK.body.length;
  const out: number[] = [];
  for (let s = P.start; s < L - 5; ) {
    out.push(s);
    s += P.periodK * bodyRadius(s / L) + P.periodAdd;
  }
  return out;
}

/**
 * Variantes de la tira. De perfil (`front`, `back`, `glow`): el lomo arriba y el vientre abajo, para el cuello, el vuelo
 * y el suelo. De lomo (`dorsal`, `dorsalBack`, `dorsalGlow`): los rombos al centro y sin vientre, para las vueltas del
 * enroscado (se ve el lomo; el vientre abraza la corteza). `mask`: la silueta.
 */
export type SkinVariant = 'front' | 'back' | 'glow' | 'mask' | 'dorsal' | 'dorsalBack' | 'dorsalGlow';

/** Tamaño de la tira del cuerpo en píxeles (todas las variantes miden lo mismo: comparten los UV). */
export function skinSize(): { width: number; height: number } {
  return { width: Math.round(LOOK.body.length * PAINT_K), height: Math.round(LOOK.body.halfHeight * 2 * PAINT_K) };
}

/** Índice de luz (0 = sombra honda … 5 = brillo) de un punto del corte del cuerpo, con tramado. */
function lightIndex(d: number, dither: number): number {
  const nz = Math.sqrt(Math.max(0, 1 - d * d));
  let v = LOOK.light.across * d + LOOK.light.out * nz + dither * LOOK.light.dither;
  if (d > 0.86) v += 0.12; // rebote cálido del piso en el borde de abajo
  let li = 0;
  for (const th of LOOK.light.thresholds) if (v >= th) li++;
  return li;
}

/**
 * La tira del cuerpo, de la nuca (x = 0) a la punta de la cola, con el lomo arriba. `front`: la piel con luz;
 * `back`: las vueltas de atrás del tronco (menos luz y mezcladas con la sombra); `glow`: máscara blanca de los rombos y
 * del lomo (furia y pulso); `mask`: la silueta blanca (golpe y sombras).
 */
export function paintSkin(variant: SkinVariant): Pixels {
  const { width, height } = skinSize();
  const p = makePixels(width, height);
  const K = PAINT_K;
  const L = LOOK.body.length;
  const H = LOOK.body.halfHeight;
  const centers = patternCenters();
  const P = LOOK.pattern;
  const bellyStart = LOOK.belly.start;
  const skin = PAL.skin;
  const cream = PAL.cream;
  const radius = new Float32Array(width);
  for (let x = 0; x < width; x++) radius[x] = bodyRadius((x + 0.5) / K / L);
  const dorsal = variant === 'dorsal' || variant === 'dorsalBack' || variant === 'dorsalGlow';
  const dark = variant === 'back' || variant === 'dorsalBack';
  const glow = variant === 'glow' || variant === 'dorsalGlow';
  const pCenter = dorsal ? 0 : P.center;
  const pHalf = dorsal ? P.dorsalHalf : P.halfHeight;
  const inside = (x: number, y: number): boolean => {
    if (x < 0 || x >= width) return false;
    const r = radius[x];
    const yy = (y + 0.5) / K - H;
    return r > 0.3 && Math.abs(yy) <= r;
  };
  for (let x = 0; x < width; x++) {
    const s = (x + 0.5) / K;
    const r = radius[x];
    // Rombo más cercano (y su vecino) para el dibujo del lomo.
    let near = 0;
    for (let k = 1; k < centers.length; k++) if (Math.abs(centers[k] - s) < Math.abs(centers[near] - s)) near = k;
    for (let y = 0; y < height; y++) {
      if (!inside(x, y)) continue;
      const yy = (y + 0.5) / K - H;
      const d = yy / r;
      const edgeUp = !inside(x, y - 1);
      const edgeDown = !inside(x, y + 1);
      const edgeEnd = !inside(x + 1, y) && x > width / 2;
      if (variant === 'mask') {
        put(p, x, y, 0xffffff);
        continue;
      }
      // Rombos: distancia "diamante" al centro (≤ 1 adentro).
      let m = 9;
      let blotch = 9;
      if (centers.length) {
        const c = centers[near];
        const rc = bodyRadius(c / L);
        const a = P.lengthK * rc + P.lengthAdd;
        m = Math.abs(s - c) / a + Math.abs(d - pCenter) / pHalf;
        // Mancha del flanco entre dos rombos.
        const next = s >= c ? centers[near + 1] : centers[near - 1];
        if (next !== undefined) {
          const mid = (c + next) / 2;
          const ab = (P.lengthK * rc + P.lengthAdd) * P.blotch.size;
          // De lomo, una mancha a cada flanco.
          const bd = dorsal ? Math.abs(Math.abs(d) - P.blotch.dorsal) : Math.abs(d - P.blotch.center);
          blotch = Math.abs(s - mid) / ab + bd / (P.halfHeight * P.blotch.size);
        }
      }
      if (glow) {
        // El centro de cada rombo brilla como una gema; el borde oscuro no (así el brillo no lava el dibujo).
        let a = 0;
        if (m <= 0.42) a = 255;
        else if (m <= 0.7) a = bayer(x, y) > -0.2 ? 200 : 120;
        else if (m <= 0.86) a = 60;
        else if (m <= 1) a = 0;
        else if (blotch <= 0.7) a = 120;
        else if (dorsal ? Math.abs(d) < 0.4 : d < -0.3 && d > -0.75) a = 30;
        if (edgeUp || edgeDown || edgeEnd) a = 0;
        if (a > 0) put(p, x, y, 0xffffff, a);
        continue;
      }
      let li = lightIndex(d, bayer(x, y));
      if (dark) li = Math.round(li * LOOK.back.light);
      let color: number;
      if (edgeDown || edgeEnd) {
        color = PAL.outline;
      } else if (edgeUp) {
        // Contorno selectivo: arriba, donde da la luz, el borde es rojo oscuro y no negro.
        color = li >= 3 ? skin[1] : PAL.outline;
      } else if (!dorsal && d >= bellyStart) {
        // Vientre: placas claras con la junta oscura; justo en el borde con el flanco, una línea oscura (como la cabeza).
        const top = d < bellyStart + 1.5 / (K * r);
        const plate = ((s / LOOK.belly.plate) % 1 + 1) % 1;
        let ci = clamp(li + 3, 1, 6);
        if (plate < 0.2 && d > bellyStart + 0.12) ci -= 1;
        else if (plate > 0.3 && plate < 0.7 && d < bellyStart + 0.3 && li >= 2) ci = Math.min(6, ci + 0);
        color = top ? skin[clamp(li, 1, 3)] : cream[clamp(ci, 1, 6)];
      } else {
        let si = clamp(li + 1, 1, 6);
        // Brillo del borde del lomo, tramado.
        if (d < LOOK.light.rim && li >= 3 && bayer(x + 1, y) > -0.25) si = Math.min(6, si + 1);
        // Escamas del flanco: la junta de abajo de cada fila y la de atrás de cada escama, un tono más oscuras.
        const rows = LOOK.scales.rows;
        const span = dorsal ? 2 : bellyStart + 1;
        const q = ((d + 1) / span) * (dorsal ? rows * 1.5 : rows);
        const row = Math.floor(q);
        const v = q - row;
        const len = LOOK.scales.length * (0.55 + 0.45 * (r / 7));
        const u = ((s / len + (row % 2) * 0.5) % 1 + 1) % 1;
        // Escamas: una mota oscura al pie de cada escama y una clara arriba (como el moteado de la cabeza).
        const px = Math.floor(u * len * K);
        const rowPx = (span * r * K) / (dorsal ? rows * 1.5 : rows);
        const py = Math.floor(v * rowPx);
        if (li >= 2 && py === Math.floor(rowPx) - 1 && px === Math.floor(len * K * 0.5)) si -= 1;
        else if (li >= 3 && py === 0 && px === 1) si = Math.min(6, si + 1);
        if (m <= 1) {
          // Rombo: rojo hondo con el borde de un píxel más oscuro y el centro un poco más claro.
          si = m > 0.86 ? li - 2 : m < 0.36 ? li - 0 : li - 1;
          si = clamp(si, 1, 4);
        } else if (blotch <= 1) {
          si = clamp(li - 1, 1, 3);
        }
        color = skin[clamp(si, 0, 6)];
      }
      if (dark) color = mix(color, PAL.shadow, LOOK.back.mix);
      put(p, x, y, color);
    }
  }
  return p;
}

// ── Cuernos ───────────────────────────────────────────────────────────────

/** Un cuerno: curva cuadrática de la base a la punta (unidades, dentro de la textura de la cabeza) y radio en la base. */
export interface HornCurve {
  bx: number;
  by: number;
  cx: number;
  cy: number;
  tx: number;
  ty: number;
  r: number;
}

interface HornHit {
  inside: boolean;
  t: number;
  d: number;
  nx: number;
  ny: number;
}

const HORN_STEPS = 40;

function hornAt(h: HornCurve, t: number): [number, number] {
  const u = 1 - t;
  return [u * u * h.bx + 2 * u * t * h.cx + t * t * h.tx, u * u * h.by + 2 * u * t * h.cy + t * t * h.ty];
}

/** El punto (x, y) contra un cuerno: adentro, a qué altura del cuerno (t) y del lado (d en -1..1) de su eje. */
function hornHit(h: HornCurve, x: number, y: number, out: HornHit): HornHit {
  let best = 1e9;
  out.inside = false;
  for (let i = 0; i < HORN_STEPS; i++) {
    const [ax, ay] = hornAt(h, i / HORN_STEPS);
    const [bx, by] = hornAt(h, (i + 1) / HORN_STEPS);
    const ex = bx - ax;
    const ey = by - ay;
    const el = ex * ex + ey * ey || 1e-6;
    const f = clamp(((x - ax) * ex + (y - ay) * ey) / el, 0, 1);
    const px = ax + ex * f;
    const py = ay + ey * f;
    const dist = Math.hypot(x - px, y - py);
    if (dist < best) {
      best = dist;
      const t = (i + f) / HORN_STEPS;
      const l = Math.sqrt(el);
      out.t = t;
      out.nx = -ey / l;
      out.ny = ex / l;
      const r = h.r * (1 - t * 0.72);
      const side = (x - px) * out.nx + (y - py) * out.ny;
      out.d = side / Math.max(0.2, r);
      // Al pie del cuerno (f = 0 en el primer tramo) el corte es recto.
      out.inside = dist <= r && !(i === 0 && f <= 0 && Math.hypot(x - h.bx, y - h.by) > 0);
    }
  }
  return out;
}

/** Luz de un punto del cuerno (desde arriba a la izquierda y adelante). */
function hornLight(hit: HornHit): number {
  const d = clamp(hit.d, -1, 1);
  const nz = Math.sqrt(Math.max(0, 1 - d * d));
  const nx = hit.nx * d;
  const ny = hit.ny * d;
  return -0.45 * nx - 0.7 * ny + 0.55 * nz;
}

/** Cuernos de nácar con anillos, contorno oscuro y luz de arriba a la izquierda, en una textura de `w` × `h` unidades. */
export function paintHorns(horns: readonly HornCurve[], w: number, h: number): Pixels {
  const K = PAINT_K;
  const p = makePixels(Math.round(w * K), Math.round(h * K));
  const hit: HornHit = { inside: false, t: 0, d: 0, nx: 0, ny: 0 };
  const ramp = PAL.horn;
  const mask = new Uint8Array(p.width * p.height);
  // Primero la silueta (para el contorno), después la luz.
  for (let y = 0; y < p.height; y++) {
    for (let x = 0; x < p.width; x++) {
      for (const horn of horns) if (hornHit(horn, (x + 0.5) / K, (y + 0.5) / K, hit).inside) mask[y * p.width + x] = 1;
    }
  }
  const at = (x: number, y: number) => (x >= 0 && y >= 0 && x < p.width && y < p.height ? mask[y * p.width + x] : 0);
  for (let y = 0; y < p.height; y++) {
    for (let x = 0; x < p.width; x++) {
      if (!at(x, y)) {
        if (at(x - 1, y) || at(x + 1, y) || at(x, y - 1) || at(x, y + 1)) put(p, x, y, PAL.outline);
        continue;
      }
      let best = -1;
      let bi = 0;
      for (const horn of horns) {
        hornHit(horn, (x + 0.5) / K, (y + 0.5) / K, hit);
        if (!hit.inside) continue;
        const v = hornLight(hit) + bayer(x, y) * 0.12;
        let i = v > 0.75 ? 6 : v > 0.5 ? 5 : v > 0.25 ? 4 : v > 0 ? 3 : 2;
        // Anillos: una franja más oscura cada tanto, hasta cerca de la punta.
        if (hit.t < 0.82 && (hit.t * 6.5) % 1 < 0.2) i -= 1;
        if (i > best) {
          best = i;
          bi = i;
        }
      }
      put(p, x, y, ramp[clamp(bi, 1, 6)]);
    }
  }
  return p;
}

/**
 * Reflejo iridiscente de los cuernos, cuadro `frame` de `frames`: una franja blanca del lado de la luz que sube de la
 * base a la punta (el jefe la tiñe con los colores del pulso).
 */
export function paintHornSheen(horns: readonly HornCurve[], w: number, h: number, frame: number, frames: number): Pixels {
  const K = PAINT_K;
  const p = makePixels(Math.round(w * K), Math.round(h * K));
  const hit: HornHit = { inside: false, t: 0, d: 0, nx: 0, ny: 0 };
  const tc = -0.15 + (1.3 * frame) / Math.max(1, frames - 1);
  for (let y = 0; y < p.height; y++) {
    for (let x = 0; x < p.width; x++) {
      let a = 0;
      for (const horn of horns) {
        hornHit(horn, (x + 0.5) / K, (y + 0.5) / K, hit);
        if (!hit.inside) continue;
        const light = hornLight(hit);
        const band = Math.abs(hit.t - tc);
        // Todo el cuerno lleva un poco de color; la franja que corre, mucho.
        let v = light > 0.2 ? 90 : 50;
        if (band < 0.12) v = 255;
        else if (band < 0.22 && bayer(x, y) > -0.2) v = 170;
        a = Math.max(a, v);
      }
      if (a) put(p, x, y, 0xffffff, a);
    }
  }
  return p;
}

// ── Piezas chicas ─────────────────────────────────────────────────────────

/** Resplandor tramado (blanco: se tiñe): tres escalones de alfa con tramado de Bayer, radio `r` unidades. */
export function paintGlow(r: number): Pixels {
  const K = PAINT_K;
  const size = Math.ceil(r * 2 * K);
  const p = makePixels(size, size);
  const c = size / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dist = Math.hypot(x + 0.5 - c, y + 0.5 - c) / c;
      if (dist > 1) continue;
      const v = Math.pow(1 - dist, 1.4) + bayer(x, y) * 0.22;
      const a = v > 0.55 ? 200 : v > 0.3 ? 120 : v > 0.1 ? 60 : 0;
      if (a) put(p, x, y, 0xffffff, a);
    }
  }
  return p;
}

/** Destello de cuatro puntas (blanco, se tiñe), `r` unidades de radio. */
export function paintSparkle(r: number): Pixels {
  const K = PAINT_K;
  const size = Math.round(r * 2 * K) | 1;
  const p = makePixels(size, size);
  const c = (size - 1) / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = Math.abs(x - c);
      const dy = Math.abs(y - c);
      const arm = (dx === 0 && dy <= c) || (dy === 0 && dx <= c);
      const core = dx + dy <= 1;
      const diag = dx === 1 && dy === 1 && size > 9;
      if (core) put(p, x, y, 0xffffff);
      else if (arm) put(p, x, y, 0xffffff, dx + dy > c * 0.6 ? 150 : 230);
      else if (diag) put(p, x, y, 0xffffff, 120);
    }
  }
  return p;
}

/** Estrellita de mareo: cuatro puntas amarillas con contorno. */
export function paintStar(): Pixels {
  const size = 11;
  const p = makePixels(size, size);
  const c = 5;
  const [outline, base, light] = PAL.star;
  const inStar = (x: number, y: number) => {
    const dx = Math.abs(x - c);
    const dy = Math.abs(y - c);
    return (dx <= 1 && dy <= 4) || (dy <= 1 && dx <= 4) || dx + dy <= 3;
  };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (inStar(x, y)) {
        const edge = !inStar(x - 1, y) || !inStar(x + 1, y) || !inStar(x, y - 1) || !inStar(x, y + 1);
        put(p, x, y, edge ? outline : Math.abs(x - c) + Math.abs(y - c) <= 1 ? light : base);
      }
    }
  }
  return p;
}

/** Corazón robado: rojo con luz arriba a la izquierda y contorno, `w` unidades de ancho. */
export function paintHeart(w = 9): Pixels {
  const K = PAINT_K;
  const size = Math.round(w * K);
  const p = makePixels(size, size);
  const [outline, dark, base, light, shine] = PAL.heart;
  const inside = (x: number, y: number) => {
    const u = ((x + 0.5) / size - 0.5) * 2.5;
    const v = (0.45 - (y + 0.5) / size) * 2.6;
    const a = u * u + v * v - 1;
    return a * a * a - u * u * v * v * v <= 0;
  };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!inside(x, y)) continue;
      const edge = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1);
      const lx = x / size;
      const ly = y / size;
      const shade = lx * 0.6 + ly * 0.9 + bayer(x, y) * 0.15;
      let c: number = shade < 0.55 ? light : shade < 0.95 ? base : dark;
      if (Math.hypot(lx - 0.3, ly - 0.3) < 0.09) c = shine;
      put(p, x, y, edge ? outline : c);
    }
  }
  return p;
}

/** Sombra de la caída en el piso: un óvalo tramado (`w` × `h` unidades), más denso en el centro. */
export function paintShadowOval(w: number, h: number): Pixels {
  const K = PAINT_K;
  const p = makePixels(Math.round(w * K), Math.round(h * K));
  for (let y = 0; y < p.height; y++) {
    for (let x = 0; x < p.width; x++) {
      const ex = ((x + 0.5) / p.width - 0.5) * 2;
      const ey = ((y + 0.5) / p.height - 0.5) * 2;
      const dist = ex * ex + ey * ey;
      if (dist > 1) continue;
      const v = 1 - dist + bayer(x, y) * 0.3;
      const a = v > 0.55 ? 190 : v > 0.25 ? 130 : v > 0.05 ? 70 : 0;
      if (a) put(p, x, y, PAL.shadow, a);
    }
  }
  return p;
}

/** Anillo del aviso de la caída: un óvalo de 1 unidad de grosor, blanco con borde oscuro (se tiñe). */
export function paintRing(w: number, h: number): Pixels {
  const K = PAINT_K;
  const p = makePixels(Math.round(w * K) + 2, Math.round(h * K) + 2);
  const rx = (p.width - 2) / 2;
  const ry = (p.height - 2) / 2;
  const cx = p.width / 2;
  const cy = p.height / 2;
  const ring = (x: number, y: number) => {
    const ex = (x + 0.5 - cx) / rx;
    const ey = (y + 0.5 - cy) / ry;
    const dist = Math.sqrt(ex * ex + ey * ey);
    const th = K / Math.min(rx, ry);
    return dist <= 1 && dist >= 1 - th * 1.1;
  };
  for (let y = 0; y < p.height; y++) {
    for (let x = 0; x < p.width; x++) {
      if (ring(x, y)) put(p, x, y, 0xffffff);
      else if (ring(x - 1, y) || ring(x + 1, y) || ring(x, y - 1) || ring(x, y + 1)) put(p, x, y, PAL.shadow, 170);
    }
  }
  return p;
}

/** Lengua bífida apuntando a la izquierda (la base a la derecha), `len` unidades; `fork`: cuánto se abre la horqueta. */
export function paintTongue(len: number, fork: number): Pixels {
  const K = PAINT_K;
  const w = Math.max(4, Math.round((len + 2) * K));
  const h = 9;
  const p = makePixels(w, h);
  const [outline, dark, base, light] = PAL.tongue;
  const mid = 4;
  const forkLen = Math.min(3, Math.round(1.6 * K));
  const stem = w - forkLen;
  for (let x = forkLen; x < w; x++) {
    put(p, x, mid - 1, x > w - 3 ? dark : light);
    put(p, x, mid, x > w - 3 ? outline : base);
    put(p, x, mid + 1, dark);
  }
  // Horqueta: dos puntas que se abren.
  for (let i = 0; i < forkLen; i++) {
    const x = forkLen - 1 - i;
    const spread = Math.round(((i + 1) / forkLen) * fork * 2);
    put(p, x, mid - 1 - spread, base);
    put(p, x, mid + 1 + spread - 1, dark);
  }
  void stem;
  return p;
}

/** Hoja que cae (dos tonos y contorno), variante `v`. */
export function paintLeaf(v: number): Pixels {
  const p = makePixels(6, 4);
  const [outline, base, light] = PAL.leaf;
  const shape = v % 2 === 0 ? ['.oo...', 'obbo..', '.obllo', '...oo.'] : ['..oo..', '.oblo.', 'obbllo', '.oooo.'];
  shape.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (ch === 'o') put(p, x, y, outline);
      else if (ch === 'b') put(p, x, y, base);
      else if (ch === 'l') put(p, x, y, light);
    }
  });
  return p;
}

/** Raya de velocidad: blanca, más opaca adelante (a la izquierda), `len` unidades. */
export function paintStreak(len: number): Pixels {
  const K = PAINT_K;
  const p = makePixels(Math.round(len * K), 2);
  for (let x = 0; x < p.width; x++) {
    const f = x / p.width;
    const a = f < 0.3 ? 230 : f < 0.65 ? 150 : bayer(x, 0) > 0 ? 80 : 0;
    if (a) {
      put(p, x, 0, 0xffffff, a);
      if (f < 0.5) put(p, x, 1, 0xffffff, a >> 1);
    }
  }
  return p;
}
