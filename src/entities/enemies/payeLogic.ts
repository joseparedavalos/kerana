// Payé del payesero (S62): lógica pura, sin Phaser. El primer proyectil que sigue a Kerana, con tres frenos para que
// sea justo: va despacio, corrige el rumbo solo los primeros `homingMs` (después sigue recto) y el sable lo corta.

export interface PayeConfig {
  /** Velocidad (px/s), siempre la misma: girar no la cambia. */
  speed: number;
  /** Cuánto tiempo corrige el rumbo desde que sale (ms). Después sigue recto. */
  homingMs: number;
  /** Cuánto puede girar por segundo mientras corrige (grados). */
  turnRateDeg: number;
  /** Cuánto vive en total (ms): al cumplirlo se deshace. */
  lifeMs: number;
}

export interface Paye {
  x: number;
  y: number;
  /** Rumbo en radianes (0 = a la derecha, y positiva hacia abajo). */
  heading: number;
  ageMs: number;
  alive: boolean;
}

export function createPaye(): Paye {
  return { x: 0, y: 0, heading: 0, ageMs: 0, alive: false };
}

/** Sale desde (x, y) apuntando a (tx, ty). Reusa el objeto (pool). */
export function launchPaye(p: Paye, x: number, y: number, tx: number, ty: number): void {
  p.x = x;
  p.y = y;
  p.heading = Math.atan2(ty - y, tx - x);
  p.ageMs = 0;
  p.alive = true;
}

/** Diferencia de ángulos en (-π, π]. */
export function angleDelta(from: number, to: number): number {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d <= -Math.PI) d += Math.PI * 2;
  return d;
}

/** ¿Todavía corrige el rumbo? */
export function isHoming(p: Paye, cfg: PayeConfig): boolean {
  return p.alive && p.ageMs < cfg.homingMs;
}

/**
 * Avanza `dtMs`: dentro de la ventana gira hacia (tx, ty) como mucho `turnRateDeg` por segundo; después, recto.
 * Al cumplir `lifeMs` muere.
 */
export function stepPaye(p: Paye, dtMs: number, tx: number, ty: number, cfg: PayeConfig): void {
  if (!p.alive) return;
  if (isHoming(p, cfg)) {
    // Solo la parte del paso que cae dentro de la ventana gira.
    const homingDt = Math.min(dtMs, cfg.homingMs - p.ageMs) / 1000;
    const maxTurn = ((cfg.turnRateDeg * Math.PI) / 180) * homingDt;
    const d = angleDelta(p.heading, Math.atan2(ty - p.y, tx - p.x));
    p.heading += Math.max(-maxTurn, Math.min(maxTurn, d));
  }
  const dt = dtMs / 1000;
  p.x += Math.cos(p.heading) * cfg.speed * dt;
  p.y += Math.sin(p.heading) * cfg.speed * dt;
  p.ageMs += dtMs;
  if (p.ageMs >= cfg.lifeMs) p.alive = false;
}

/** ¿El círculo del payé (radio `r`) toca el rectángulo? Sirve para Kerana y para el tajo. */
export function payeTouches(p: Paye, r: number, rect: { x: number; y: number; width: number; height: number }): boolean {
  if (!p.alive) return false;
  const cx = Math.max(rect.x, Math.min(p.x, rect.x + rect.width));
  const cy = Math.max(rect.y, Math.min(p.y, rect.y + rect.height));
  return (p.x - cx) ** 2 + (p.y - cy) ** 2 <= r * r;
}

/**
 * ¿Hay camino libre de (x0, y0) a (x1, y1)? Mira cada `step` px con `solidAt`. Sin esto el payesero cargaría contra
 * Kerana a través de la roca, desde la galería de abajo.
 */
export function lineClear(x0: number, y0: number, x1: number, y1: number, step: number, solidAt: (x: number, y: number) => boolean): boolean {
  const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / step));
  for (let i = 1; i < n; i++) if (solidAt(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n)) return false;
  return true;
}
