// Lógica pura del brillo que corre por el agua (S110, l2): dónde está la superficie y dónde cae cada destello.

/**
 * Tramos de superficie del agua, en tiles: tríos [x0, x1 (sin incluir), y] de celdas seguidas de una fila donde
 * `surface(x, y)` es cierto. Se calcula una vez por nivel.
 */
export function surfaceRuns(width: number, height: number, surface: (x: number, y: number) => boolean): number[] {
  const out: number[] = [];
  for (let y = 0; y < height; y++) {
    let start = -1;
    for (let x = 0; x <= width; x++) {
      const on = x < width && surface(x, y);
      if (on && start < 0) start = x;
      if (!on && start >= 0) {
        out.push(start, x, y);
        start = -1;
      }
    }
  }
  return out;
}

/**
 * Elige un punto de superficie a la vista: entre los tramos que se cruzan con [`left`, `right`) (en tiles), uno al azar
 * pesado por cuánto se ve (`r1`), y una x dentro de lo que se ve (`r2`, en tiles con decimales). Deja el resultado en
 * `out` (x en tiles, y la fila) y devuelve si encontró. Sin asignar memoria (corre en cada destello).
 */
export function pickSurface(runs: readonly number[], left: number, right: number, r1: number, r2: number, out: { x: number; y: number }): boolean {
  let total = 0;
  for (let i = 0; i < runs.length; i += 3) total += Math.max(0, Math.min(runs[i + 1], right) - Math.max(runs[i], left));
  if (total <= 0) return false;
  let t = r1 * total;
  for (let i = 0; i < runs.length; i += 3) {
    const a = Math.max(runs[i], left);
    const b = Math.min(runs[i + 1], right);
    const len = b - a;
    if (len <= 0) continue;
    if (t < len || i + 3 >= runs.length) {
      out.x = a + r2 * len;
      out.y = runs[i + 2];
      return true;
    }
    t -= len;
  }
  return false;
}

/** Opacidad de un destello según su vida (0 a 1): sube y baja suave, 0 fuera de la vida. */
export function glintEnvelope(t: number): number {
  if (t <= 0 || t >= 1) return 0;
  return Math.sin(Math.PI * t);
}
