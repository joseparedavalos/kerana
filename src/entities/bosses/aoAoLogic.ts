// Lógica pura de Ao Ao y del pindó (GDD §6.6): sin Phaser, con tests.

export interface ChargeResult {
  /** Dónde termina la embestida (centro del cuerpo). */
  x: number;
  /** Chocó contra una roca: queda aturdido (la ventana). */
  hitRock: boolean;
}

/**
 * Embestida desde `fromX` hacia `dir`: se detiene contra la primera roca en el camino o en el borde
 * de la arena [`left`, `right`] (centros). `rocks` son los centros de las rocas.
 */
export function chargeTarget(
  fromX: number,
  dir: 1 | -1,
  rocks: readonly number[],
  rockHalfWidth: number,
  bodyHalfWidth: number,
  left: number,
  right: number,
  out: ChargeResult,
): ChargeResult {
  let stop = dir > 0 ? right : left;
  let hitRock = false;
  for (const rx of rocks) {
    // Donde el cuerpo toca la roca.
    const contact = rx - dir * (rockHalfWidth + bodyHalfWidth);
    const ahead = dir > 0 ? contact > fromX : contact < fromX;
    const closer = dir > 0 ? contact < stop : contact > stop;
    if (ahead && closer) {
      stop = contact;
      hitRock = true;
    }
  }
  out.x = stop;
  out.hitRock = hitRock;
  return out;
}

/** Copa de un pindó (px): Kerana está a salvo parada encima. */
export interface Refuge {
  left: number;
  right: number;
  top: number;
}

/**
 * ¿Kerana está en lo alto de un pindó? Tiene que estar parada (en el suelo de la copa), con los pies
 * a la altura de la copa (± `tolerance`) y dentro de su ancho.
 */
export function onRefuge(feetX: number, feetY: number, grounded: boolean, refuges: readonly Refuge[], tolerance: number): boolean {
  if (!grounded) return false;
  for (const r of refuges) {
    if (feetX >= r.left && feetX <= r.right && Math.abs(feetY - r.top) <= tolerance) return true;
  }
  return false;
}

/** Crías que llama el aullido: 2 en la fase 2, 3 en la furia (fase 3). `phase` empieza en 0. */
export function cubsForPhase(phase: number, perPhase: readonly number[]): number {
  if (phase < 1) return 0;
  return perPhase[Math.min(phase - 1, perPhase.length - 1)];
}

/** El pindó más cercano a `x` (centros): Ao Ao da vueltas al pie de ese. */
export function nearestIndex(x: number, centers: readonly number[]): number {
  let best = 0;
  for (let i = 1; i < centers.length; i++) if (Math.abs(centers[i] - x) < Math.abs(centers[best] - x)) best = i;
  return best;
}
