// Lógica pura del fondo del nivel (sin Phaser): desplazamiento según el avance, encuadre, brillo y tramo de cueva.

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
