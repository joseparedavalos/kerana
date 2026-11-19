// Lógica pura del fondo del nivel (sin Phaser): desplazamiento según el avance, encuadre, brillo y tramo de cueva.
import { bayer } from './pixelArt';

/**
 * Desfase horizontal (≤ 0) del fondo fijo a la cámara: 0 al principio del nivel y `-extra * range`
 * al final. `viewX` es el borde izquierdo de la vista; `maxViewX`, el mayor que puede tener.
 */
export function backdropPanX(viewX: number, maxViewX: number, extra: number, range: number): number {
  if (maxViewX <= 0 || extra <= 0) return 0;
  const progress = Math.min(1, Math.max(0, viewX / maxViewX));
  // `|| 0` evita el -0 al principio.
  return -extra * Math.min(1, Math.max(0, range)) * progress || 0;
}

/** Tinte (multiplicador) del fondo: gris según `brightness` (0-1), multiplicado por el ambiente del nivel oscuro. */
export function backdropTint(brightness: number, ambient = 0xffffff): number {
  const k = Math.min(1, Math.max(0, brightness));
  const ch = (shift: number) => Math.round(((ambient >> shift) & 0xff) * k);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

/**
 * Escala (sobre la vista) y borde superior del fondo fijo a la cámara con un ajuste vertical `shiftY`
 * (unidades del mundo; positivo sube la imagen). Si el ajuste destaparía el borde opuesto, agranda la imagen
 * lo justo hacia ese lado (el borde que se corre queda donde el ajuste lo pone).
 */
export function backdropFit(viewHeight: number, overscale: number, shiftY: number): { scale: number; top: number } {
  const base = viewHeight * overscale;
  const margin = (base - viewHeight) / 2;
  if (shiftY >= 0) {
    const top = -margin - shiftY;
    return { scale: Math.max(base, viewHeight - top) / viewHeight, top };
  }
  const bottom = viewHeight + margin - shiftY;
  const height = Math.max(base, bottom);
  return { scale: height / viewHeight, top: bottom - height };
}

/**
 * Desplazamiento vertical (≥ 0, hacia abajo) del fondo fijo a la cámara (S28): `travel` con la vista arriba del
 * nivel y 0 abajo (el encuadre de siempre). `viewY` es el borde de arriba de la vista; `maxViewY`, el mayor posible.
 */
export function backdropPanY(viewY: number, maxViewY: number, travel: number): number {
  if (maxViewY <= 0 || travel <= 0) return 0;
  const progress = Math.min(1, Math.max(0, viewY / maxViewY));
  return travel * (1 - progress) || 0;
}

/**
 * Alto con el que se dibuja una imagen de `width` × `height` px llevada al ancho de la vista, sin deformarla (S92).
 */
export function backdropClimbHeight(width: number, height: number, viewWidth: number): number {
  return width > 0 ? (height * viewWidth) / width : 0;
}

/**
 * Borde de arriba (≤ 0) de un fondo de subida (S92), más alto que la vista: con la vista arriba del nivel se ve el
 * tope de la imagen (0) y con la vista abajo, su pie (`-travel`, donde `travel` es lo que la imagen le sobra a la
 * vista). En el medio, proporcional al avance. Va a pasos de `snap` unidades (medio = un píxel del lienzo) para que el
 * pixel art no tiemble. `viewY` es el borde de arriba de la vista; `maxViewY`, el mayor posible.
 */
export function backdropClimbTop(viewY: number, maxViewY: number, travel: number, snap = 0.5): number {
  if (travel <= 0) return 0;
  const progress = maxViewY <= 0 ? 1 : Math.min(1, Math.max(0, viewY / maxViewY));
  const top = -travel * progress;
  return (snap > 0 ? Math.round(top / snap) * snap : top) || 0;
}

/**
 * Color medio (`0xRRGGBB`) de una fila de píxeles RGBA (de `getImageData`), para el relleno del fondo (S29).
 */
export function averageColor(rgba: ArrayLike<number>): number {
  let r = 0;
  let g = 0;
  let b = 0;
  const n = Math.floor(rgba.length / 4);
  if (n === 0) return 0;
  for (let i = 0; i < n * 4; i += 4) {
    r += rgba[i];
    g += rgba[i + 1];
    b += rgba[i + 2];
  }
  return (Math.round(r / n) << 16) | (Math.round(g / n) << 8) | Math.round(b / n);
}

/**
 * Tramo horizontal de la vista cubierto por zonas de cueva (ocupan toda la altura), en unidades desde el
 * borde izquierdo de la vista y sin recortar (puede salirse de la vista). Si hay varias a la vista, va de la
 * primera a la última. `null` si ninguna se ve.
 */
export function caveSpan(
  viewX: number,
  viewWidth: number,
  areas: ReadonlyArray<{ x: number; width: number }>,
): { left: number; right: number } | null {
  let left = Infinity;
  let right = -Infinity;
  for (const a of areas) {
    if (a.x + a.width <= viewX || a.x >= viewX + viewWidth) continue;
    left = Math.min(left, a.x - viewX);
    right = Math.max(right, a.x + a.width - viewX);
  }
  return left < right ? { left, right } : null;
}

/** Respirar del halo del sol (S96): 0 en su mínimo (al empezar) y 1 en su máximo, a mitad de `periodMs`. */
export function sunPulse(now: number, periodMs: number): number {
  if (periodMs <= 0) return 0;
  return 0.5 - 0.5 * Math.cos((2 * Math.PI * now) / periodMs);
}

/** Brillo de un destello a lo largo de su vida (`t` de 0 a 1): sube y baja, 0 afuera. */
export function glintAlpha(t: number): number {
  return t <= 0 || t >= 1 ? 0 : Math.sin(Math.PI * t);
}

/**
 * Tiras horizontales del reflejo dorado (S96) dentro de `region` (px de arte: x0, y0, x1, y1, el fin afuera): cada
 * tira es una corrida de píxeles con rojo ≥ `minRed` y verde ≥ `minGreen` de al menos `minRun` px. Plano: x, y, largo.
 */
export function glintRuns(
  data: ArrayLike<number>,
  width: number,
  region: readonly [number, number, number, number],
  minRed: number,
  minGreen: number,
  minRun: number,
): number[] {
  const [x0, y0, x1, y1] = region;
  const height = data.length / 4 / width;
  const runs: number[] = [];
  for (let y = Math.max(0, y0); y < Math.min(height, y1); y++) {
    let start = -1;
    for (let x = Math.max(0, x0); x <= Math.min(width, x1); x++) {
      const i = (y * width + x) * 4;
      const gold = x < Math.min(width, x1) && data[i]! >= minRed && data[i + 1]! >= minGreen;
      if (gold && start < 0) start = x;
      if (!gold && start >= 0) {
        if (x - start >= minRun) runs.push(start, y, x - start);
        start = -1;
      }
    }
  }
  return runs;
}

/**
 * Dónde cae un destello (S96): una tira al azar de `runs` (de `glintRuns`) y, dentro de ella, un ancho entre
 * `widthMin` y `widthMax` que no se pasa de la tira. `r1`, `r2` y `r3`, azares de 0 a 1. Escribe x, y y ancho en `out`.
 */
export function pickGlint(
  runs: ArrayLike<number>,
  widthMin: number,
  widthMax: number,
  r1: number,
  r2: number,
  r3: number,
  out: { x: number; y: number; width: number },
): boolean {
  const count = Math.floor(runs.length / 3);
  if (count === 0) return false;
  const k = Math.min(count - 1, Math.floor(r1 * count)) * 3;
  const len = runs[k + 2]!;
  const width = Math.min(len, widthMin + Math.floor(r2 * (widthMax - widthMin + 1)));
  out.width = Math.max(1, Math.min(width, widthMax));
  out.x = runs[k]! + Math.min(len - out.width, Math.floor(r3 * (len - out.width + 1)));
  out.y = runs[k + 1]!;
  return true;
}

/** Un pájaro de la bandada (S98): atrás del que guía (`back`, px de arte, ≥ 0) y arriba o abajo (`dy`), y su fase. */
export interface FlockSlot {
  back: number;
  dy: number;
  phase: number;
}

/**
 * Formación en V suelta (S98): el primero guía; los demás se reparten en las dos alas, alternando, cada fila
 * `spacingX` más atrás y `spacingY` más afuera, con hasta `jitter` px de azar en cada eje. `rand`, azar de 0 a 1.
 * Llena los primeros `n` de `out` (no crea objetos).
 */
export function flockLayout(n: number, spacingX: number, spacingY: number, jitter: number, rand: () => number, out: FlockSlot[]): void {
  for (let i = 0; i < n && i < out.length; i++) {
    const rank = Math.ceil(i / 2);
    const side = i % 2 === 1 ? -1 : 1;
    const j = (k: number) => (rand() * 2 - 1) * k;
    out[i]!.back = i === 0 ? 0 : Math.max(0, rank * spacingX + j(jitter));
    out[i]!.dy = i === 0 ? 0 : side * rank * spacingY + j(jitter);
    out[i]!.phase = rand();
  }
}

/** Lo más que se aparta un pájaro del guía en vertical (px de arte), con el azar y el vaivén. */
export function flockSpread(maxBirds: number, spacingY: number, jitter: number, bob: number): number {
  return Math.ceil((maxBirds - 1) / 2) * spacingY + jitter + bob;
}

/**
 * Dónde va el guía de una bandada (px de arte, x de la imagen) a la fracción `t` (0 a 1) de su cruce: de afuera de
 * un borde de la imagen (`margin` px) a afuera del otro. `dir` 1 cruza de izquierda a derecha; −1, al revés.
 */
export function flockLeadX(t: number, dir: 1 | -1, imageWidth: number, margin: number): number {
  const span = imageWidth + 2 * margin;
  const p = Math.min(1, Math.max(0, t));
  return dir > 0 ? -margin + span * p : imageWidth + margin - span * p;
}

/**
 * Borde izquierdo de una sombra de nube (S98, px de arte) que corre a `speed` px/s y vuelve a entrar por la izquierda:
 * cruza la imagen entera y sale entera antes de volver. `offset` (0 a 1) reparte las sombras a lo ancho.
 */
export function shadowLeft(now: number, speed: number, imageWidth: number, shadowWidth: number, offset: number): number {
  const lap = imageWidth + shadowWidth;
  if (lap <= 0) return 0;
  const x = (((now / 1000) * speed + offset * lap) % lap + lap) % lap;
  return x - shadowWidth;
}

// S108: el atardecer y la cueva de l1.

/**
 * Fila de la línea del cielo por columna (S108): subiendo desde `fromY`, la primera fila que tiene arriba `run` filas
 * de cielo (rojo sobre azul ≥ `redOverBlue` y brillo ≥ `minLum`). Suavizada con una mediana de 7 columnas.
 */
export function skylineRows(
  data: ArrayLike<number>,
  width: number,
  height: number,
  fromY: number,
  redOverBlue: number,
  minLum: number,
  run = 4,
): Int16Array {
  const sky = (x: number, y: number): boolean => {
    const i = (y * width + x) * 4;
    const r = data[i]!;
    const g = data[i + 1]!;
    const b = data[i + 2]!;
    return r - b >= redOverBlue && 0.299 * r + 0.587 * g + 0.114 * b >= minLum;
  };
  const raw = new Int16Array(width);
  for (let x = 0; x < width; x++) {
    let y = Math.min(height - 1, fromY);
    const clear = (yy: number) => {
      for (let k = 1; k <= run; k++) if (!sky(x, yy - k)) return false;
      return true;
    };
    while (y > run && !clear(y)) y--;
    raw[x] = y;
  }
  const out = new Int16Array(width);
  const win: number[] = [];
  for (let x = 0; x < width; x++) {
    win.length = 0;
    for (let k = Math.max(0, x - 3); k <= Math.min(width - 1, x + 3); k++) win.push(raw[k]!);
    win.sort((a, b) => a - b);
    out[x] = win[Math.floor(win.length / 2)]!;
  }
  return out;
}

/** Alto de una polilínea plana (x, y, x, y… con x creciente) en `x`; NaN fuera de ella. */
export function polylineY(line: ArrayLike<number>, x: number): number {
  const n = line.length;
  if (n < 2 || x < line[0]! || x > line[n - 2]!) return Number.NaN;
  for (let i = 0; i + 2 < n; i += 2) {
    const x0 = line[i]!;
    const x1 = line[i + 2]!;
    if (x <= x1) return x1 === x0 ? line[i + 1]! : line[i + 1]! + ((line[i + 3]! - line[i + 1]!) * (x - x0)) / (x1 - x0);
  }
  return line[n - 1]!;
}

/** Lo más bajo (la y más grande) de la polilínea entre `x0` y `x1`, recortado a su tramo; NaN si no se tocan. */
export function polylineMax(line: ArrayLike<number>, x0: number, x1: number): number {
  const n = line.length;
  const a = Math.max(x0, line[0]!);
  const b = Math.min(x1, line[n - 2]!);
  if (n < 2 || a > b) return Number.NaN;
  let m = Math.max(polylineY(line, a), polylineY(line, b));
  for (let i = 0; i < n; i += 2) if (line[i]! > a && line[i]! < b) m = Math.max(m, line[i + 1]!);
  return m;
}

/** Lo más grande de `values` entre los índices `x0` y `x1` (recortados al arreglo). */
export function rangeMax(values: ArrayLike<number>, x0: number, x1: number): number {
  let m = Number.NEGATIVE_INFINITY;
  for (let x = Math.max(0, Math.floor(x0)); x <= Math.min(values.length - 1, Math.ceil(x1)); x++) m = Math.max(m, values[x]!);
  return m;
}

/**
 * Borde izquierdo de un jirón de bruma (px de arte) que se desliza a `speed` px/s por un valle de `x0` a `x1` y vuelve a
 * entrar por la izquierda: sale entero antes de volver. `offset` (0 a 1) los reparte.
 */
export function wispLeft(now: number, speed: number, x0: number, x1: number, width: number, offset: number): number {
  const lap = x1 - x0 + width;
  if (lap <= 0) return x0;
  const x = (((now / 1000) * speed + offset * lap) % lap + lap) % lap;
  return x0 - width + x;
}

/** Cuánto se ve un jirón según dónde está su centro en el valle: 1 adentro, 0 en las puntas (fundido de `fade` px). */
export function wispFade(left: number, width: number, x0: number, x1: number, fade: number): number {
  const c = left + width / 2;
  const d = Math.min(c - x0, x1 - c);
  if (fade <= 0) return d >= 0 ? 1 : 0;
  return Math.min(1, Math.max(0, d / fade));
}

/**
 * Borde de arriba de un jirón (px de arte): su pie queda `pad` px debajo de lo más bajo de la cresta que tiene abajo (lo
 * tapa la loma) y su borde de arriba nunca sube a menos de `skyMargin` px del cielo (`skyline`, por columna).
 */
export function wispTop(
  line: ArrayLike<number>,
  skyline: ArrayLike<number>,
  left: number,
  width: number,
  height: number,
  pad: number,
  skyMargin: number,
): number {
  const bottom = polylineMax(line, left, left + width);
  const sky = rangeMax(skyline, left, left + width) + skyMargin;
  if (Number.isNaN(bottom)) return sky;
  return Math.max(Math.round(bottom + pad - height), sky);
}

/** Onda triangular de -1 a 1 (zigzag) con período 1: 0 en t = 0, 1 en t = 0,25. */
export function zigzag(t: number): number {
  const f = (((t + 0.25) % 1) + 1) % 1;
  return 1 - 4 * Math.abs(f - 0.5);
}

/** Cuánto bajó una gota (px de arte) a los `ms` de soltarse, con aceleración `gravity` (px/s²). */
export function dropFall(ms: number, gravity: number): number {
  const t = Math.max(0, ms) / 1000;
  return 0.5 * gravity * t * t;
}

/** Cuánto tarda en caer `distance` px de arte (ms). */
export function dropFallMs(distance: number, gravity: number): number {
  return gravity > 0 ? Math.sqrt((2 * Math.max(0, distance)) / gravity) * 1000 : 0;
}

/**
 * Cuánto se ve algo chico del fondo de cueva en `x` (misma escala que `left` y `right`, el tramo de la cueva a la
 * vista): 1 adentro, 0 afuera, con un fundido de `fade` en cada borde.
 */
export function spanAlpha(x: number, left: number, right: number, fade: number): number {
  const d = Math.min(x - left, right - x);
  if (fade <= 0) return d >= 0 ? 1 : 0;
  return Math.min(1, Math.max(0, d / fade));
}

/** Qué cristal es un píxel (S108): 1 violeta, 2 cian, 0 ninguno. */
export function crystalKind(
  r: number,
  g: number,
  b: number,
  c: { violetBlueOver: number; violetMinBlue: number; cyanOver: number; cyanMinGreen: number },
): 0 | 1 | 2 {
  if (b - Math.max(r, g) > c.violetBlueOver && b > c.violetMinBlue) return 1;
  if (g - r > c.cyanOver && b - r > c.cyanOver && g > c.cyanMinGreen) return 2;
  return 0;
}

/** Píxeles de oro (rojo + verde − 2 × azul > `minYellow`) dentro de `rect` (x0, y0, x1, y1; el fin adentro). Plano: x, y. */
export function goldPixels(data: ArrayLike<number>, width: number, rect: readonly [number, number, number, number], minYellow: number): number[] {
  const height = data.length / 4 / width;
  const out: number[] = [];
  for (let y = Math.max(0, rect[1]); y <= Math.min(height - 1, rect[3]); y++) {
    for (let x = Math.max(0, rect[0]); x <= Math.min(width - 1, rect[2]); x++) {
      const i = (y * width + x) * 4;
      if (data[i]! + data[i + 1]! - 2 * data[i + 2]! > minYellow) out.push(x, y);
    }
  }
  return out;
}

/**
 * Alfa de un rayo de luz (S108) en una textura de `w` × `h`: angosto abajo (`base` del ancho) y abierto arriba. Sube
 * desde la fuente (abajo, tapada por la sierra) hasta su brillo más fuerte en `peakAt` del largo y se apaga hacia arriba.
 * Fila 0 arriba.
 */
export function rayAlphaAt(x: number, y: number, w: number, h: number, base: number, peakAt = 0.06): number {
  const t = (h - 1 - y + 0.5) / h;
  const half = base + (1 - base) * t;
  const u = Math.abs(x + 0.5 - w / 2) / (w / 2);
  if (u >= half) return 0;
  const across = Math.cos((Math.PI / 2) * (u / half)) ** 2;
  const p = Math.max(0.01, Math.min(0.9, peakAt));
  const along = t < p ? t / p : ((1 - t) / (1 - p)) ** 1.4;
  return across * along;
}

/**
 * Un jirón de bruma (S108) de `w` × `h` px, tramado como la niebla de la siesta: dos o tres lomos de nube con el borde
 * de arriba deshilachado, denso abajo (se apoya en el valle), con huecos y las puntas afinadas. Alfa 0-255 por píxel en
 * `out` (w × h); `rand`, azar de 0 a 1.
 */
export function paintWisp(
  w: number,
  h: number,
  rand: () => number,
  look: { alphas: readonly number[]; steps: readonly number[]; dither: number },
  out: Uint8ClampedArray,
): void {
  // Los lomos: centro, ancho y alto de cada uno (fracciones del jirón).
  const lobes = 2 + Math.floor(rand() * 2);
  const lobe: number[] = [];
  for (let k = 0; k < lobes; k++) lobe.push(0.18 + 0.64 * rand(), 0.16 + 0.18 * rand(), 0.55 + 0.45 * rand());
  const seedA = Math.floor(rand() * 1e6);
  // Ruido de valor suave (celdas de 6 × 3 px): los huecos y las hebras de la bruma.
  const cell = (i: number, j: number) => {
    let n = (i * 374761393 + j * 668265263 + seedA * 1442695041) | 0;
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  };
  const noise = (x: number, y: number) => {
    const fx = x / 6;
    const fy = y / 3;
    const i = Math.floor(fx);
    const j = Math.floor(fy);
    const sx = (fx - i) * (fx - i) * (3 - 2 * (fx - i));
    const sy = (fy - j) * (fy - j) * (3 - 2 * (fy - j));
    const a = cell(i, j) + (cell(i + 1, j) - cell(i, j)) * sx;
    const b = cell(i, j + 1) + (cell(i + 1, j + 1) - cell(i, j + 1)) * sx;
    return a + (b - a) * sy;
  };
  for (let x = 0; x < w; x++) {
    const u = (x + 0.5) / w;
    const env = Math.sin(Math.PI * u) ** 0.6;
    let crest = 0;
    for (let k = 0; k < lobes; k++) {
      const d = (u - lobe[3 * k]!) / lobe[3 * k + 1]!;
      crest = Math.max(crest, lobe[3 * k + 2]! * Math.exp(-d * d));
    }
    // Deshilachado: el borde sube y baja un poco de columna en columna.
    crest = env * Math.min(1, crest * (0.85 + 0.3 * noise(x * 2, 7)));
    for (let y = 0; y < h; y++) {
      const b = (h - 1 - y + 0.5) / h;
      let d = crest > 0.04 ? Math.max(0, 1 - b / crest) ** 0.8 : 0;
      d *= 0.55 + 0.6 * noise(x, y);
      const v = d + bayer(x, y) * look.dither;
      let a = 0;
      for (let k = 0; k < look.steps.length; k++) if (v >= look.steps[k]!) a = look.alphas[k]!;
      out[y * w + x] = Math.round(a * 255);
    }
  }
}

/**
 * Acomoda rectángulos (`[ancho, alto]`) en estantes de hasta `maxWidth` px, con 1 px de aire, para juntarlos en una
 * sola textura. Devuelve dónde va cada uno (en el orden recibido) y el tamaño total.
 */
export function shelfPack(sizes: ReadonlyArray<readonly [number, number]>, maxWidth: number): { at: { x: number; y: number }[]; width: number; height: number } {
  const order = sizes.map((_, i) => i).sort((a, b) => sizes[b]![1] - sizes[a]![1]);
  const at: { x: number; y: number }[] = sizes.map(() => ({ x: 0, y: 0 }));
  let x = 0;
  let y = 0;
  let shelf = 0;
  let width = 0;
  for (const i of order) {
    const [w, h] = sizes[i]!;
    if (x > 0 && x + w > maxWidth) {
      y += shelf + 1;
      x = 0;
      shelf = 0;
    }
    at[i] = { x, y };
    x += w + 1;
    shelf = Math.max(shelf, h);
    width = Math.max(width, x - 1);
  }
  return { at, width: Math.max(1, width), height: Math.max(1, y + shelf) };
}

/**
 * Qué tiles tapan del todo lo que va detrás (S108): el fondo de tierra (`earth`) y la roca dibujada entera (`full`: visible
 * y sin transparencia) rodeada de roca por sus ocho vecinos (los bordes del autotile traen partes transparentes). Fuera
 * del mapa cuenta como roca. 1 si tapa.
 */
export function opaqueMask(
  width: number,
  height: number,
  earth: (x: number, y: number) => boolean,
  ground: (x: number, y: number) => boolean,
  full: (x: number, y: number) => boolean,
): Uint8Array {
  const out = new Uint8Array(width * height);
  const rock = (x: number, y: number) => x < 0 || y < 0 || x >= width || y >= height || ground(x, y);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (earth(x, y)) {
        out[y * width + x] = 1;
        continue;
      }
      if (!full(x, y)) continue;
      let inner = true;
      for (let dy = -1; dy <= 1 && inner; dy++) for (let dx = -1; dx <= 1 && inner; dx++) inner = rock(x + dx, y + dy);
      if (inner) out[y * width + x] = 1;
    }
  }
  return out;
}

/** ¿Los tiles opacos (`mask`) tapan entero el rectángulo del mundo (x0, y0)-(x1, y1)? Fuera del mapa no tapa. */
export function rectHidden(mask: Uint8Array, width: number, height: number, tile: number, x0: number, y0: number, x1: number, y1: number): boolean {
  if (x1 <= x0 || y1 <= y0) return false;
  const tx0 = Math.floor(x0 / tile);
  const ty0 = Math.floor(y0 / tile);
  const tx1 = Math.ceil(x1 / tile) - 1;
  const ty1 = Math.ceil(y1 / tile) - 1;
  if (tx0 < 0 || ty0 < 0 || tx1 >= width || ty1 >= height) return false;
  for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) if (mask[ty * width + tx] !== 1) return false;
  return true;
}
