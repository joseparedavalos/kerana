// El rayo de los ojos del Jaguarú (S117), lógica pura: sin Phaser. Lo prueba tests/jaguaruLaser.test.ts.
//
// Al empezar el aviso (abre los ojos), si Kerana está adelante, a la vista y en el alcance, fija la mira en el punto
// donde está ella en ese momento. En el golpe dispara por esa línea fija, desde los ojos, que sigue más allá de la mira
// hasta lo sólido (o hasta su largo máximo): lastima si toca a Kerana, una sola vez por ciclo. Si ella se corrió de la
// línea durante el aviso, no le da. Sin Kerana a la vista, abre y cierra los ojos sin disparar.

import { lineClear } from './payeLogic';
import type { GuardState } from './GuardMotor';

/** Lo que el rayo necesita de GAMEPLAY.jaguaru.laser. */
export interface LaserSpec {
  /** Alcance para fijar la mira (px), de los ojos a Kerana. */
  range: number;
  /** Largo máximo del rayo si no choca con nada (px). */
  maxLength: number;
  /** Paso (px) para ver a Kerana y para buscar dónde se corta el rayo. */
  losStep: number;
  /** Medio grosor del rayo que lastima (px): se suma al cuerpo de Kerana. */
  hitHalfWidth: number;
  /** Cuánto adelante de los ojos tiene que estar Kerana (px, hacia donde mira). */
  minAhead: number;
  /** De dónde sale (px desde los pies): hacia donde mira y hacia arriba. */
  muzzle: { forward: number; up: number };
}

export type SolidAt = (x: number, y: number) => boolean;

/** Rectángulo (px): el cuerpo de Kerana. */
export interface RectLike {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Los ojos (de donde sale el rayo) para un Jaguarú con los pies en (x, feetY) que mira hacia `facing`. */
export function muzzleOf(x: number, feetY: number, facing: 1 | -1, spec: LaserSpec): { x: number; y: number } {
  return { x: x + facing * spec.muzzle.forward, y: feetY - spec.muzzle.up };
}

/** ¿La ve? Adelante de los ojos (no gira), dentro del alcance y con el camino libre de lo sólido. */
export function canAim(mx: number, my: number, facing: 1 | -1, tx: number, ty: number, spec: LaserSpec, solidAt?: SolidAt): boolean {
  const dx = tx - mx;
  const dy = ty - my;
  if (dx * facing <= spec.minAhead) return false;
  if (Math.hypot(dx, dy) > spec.range) return false;
  return !solidAt || lineClear(mx, my, tx, ty, spec.losStep, solidAt);
}

/**
 * Dónde termina el rayo que sale de (mx, my) y pasa por la mira (ax, ay): avanza por esa línea hasta lo sólido (`cut`)
 * o hasta `maxLength`. El borde se afina a medio píxel entre el último paso libre y el primero sólido.
 */
export function traceBeam(mx: number, my: number, ax: number, ay: number, spec: LaserSpec, solidAt?: SolidAt): { x: number; y: number; cut: boolean } {
  const len = Math.hypot(ax - mx, ay - my) || 1;
  const ux = (ax - mx) / len;
  const uy = (ay - my) / len;
  const step = Math.max(0.5, spec.losStep);
  let free = 0;
  if (solidAt) {
    for (let d = step; d <= spec.maxLength; d += step) {
      if (solidAt(mx + ux * d, my + uy * d)) {
        // Entre `free` (libre) y `d` (sólido): bisección hasta medio píxel.
        let lo = free;
        let hi = d;
        while (hi - lo > 0.5) {
          const mid = (lo + hi) / 2;
          if (solidAt(mx + ux * mid, my + uy * mid)) hi = mid;
          else lo = mid;
        }
        return { x: mx + ux * lo, y: my + uy * lo, cut: true };
      }
      free = d;
    }
  }
  return { x: mx + ux * spec.maxLength, y: my + uy * spec.maxLength, cut: false };
}

/** ¿El segmento (x0, y0) → (x1, y1) toca el rectángulo agrandado `pad` por cada lado? (Liang-Barsky.) */
export function segmentHitsRect(x0: number, y0: number, x1: number, y1: number, r: RectLike, pad = 0): boolean {
  const left = r.x - pad;
  const right = r.x + r.width + pad;
  const top = r.y - pad;
  const bottom = r.y + r.height + pad;
  const dx = x1 - x0;
  const dy = y1 - y0;
  let t0 = 0;
  let t1 = 1;
  const p = [-dx, dx, -dy, dy];
  const q = [x0 - left, right - x0, y0 - top, bottom - y0];
  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) {
      if (q[i] < 0) return false;
      continue;
    }
    const t = q[i] / p[i];
    if (p[i] < 0) {
      if (t > t1) return false;
      if (t > t0) t0 = t;
    } else {
      if (t < t0) return false;
      if (t < t1) t1 = t;
    }
  }
  return t0 <= t1;
}

/** Primer punto (t de 0 a 1 sobre el segmento) donde el rayo entra al rectángulo agrandado; para el estallido. */
export function segmentEntry(x0: number, y0: number, x1: number, y1: number, r: RectLike, pad = 0): number {
  // Pocos pasos alcanzan: es solo dónde se dibuja el estallido.
  const n = 48;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = x0 + (x1 - x0) * t;
    const y = y0 + (y1 - y0) * t;
    if (x >= r.x - pad && x <= r.x + r.width + pad && y >= r.y - pad && y <= r.y + r.height + pad) return t;
  }
  return 1;
}

/**
 * El rayo de un Jaguarú a lo largo de su ciclo. `update` se llama en cada paso con el estado del GuardMotor: al
 * entrar al aviso intenta fijar la mira (con la posición de Kerana de ese momento); al entrar al golpe traza el rayo
 * contra lo sólido; en el golpe, `hits` dice si toca a Kerana (una vez por ciclo).
 */
export class LaserBrain {
  /** Hay mira fijada en este ciclo (y, en el golpe, rayo). */
  aimed = false;
  /** Ya lastimó en este ciclo. */
  struck = false;
  /** Los ojos, la mira y el final del rayo (px). */
  mx = 0;
  my = 0;
  ax = 0;
  ay = 0;
  ex = 0;
  ey = 0;
  /** El rayo termina contra algo sólido (no en el aire). */
  cut = false;
  private last: GuardState = 'idle';

  constructor(private readonly spec: LaserSpec) {}

  /**
   * Un paso del ciclo. (x, feetY): los pies del Jaguarú; (tx, ty): el centro de Kerana. Devuelve 'aim' en el paso que
   * fija la mira, 'fire' en el que empieza a disparar y null en los demás.
   */
  update(state: GuardState, x: number, feetY: number, facing: 1 | -1, tx: number, ty: number, solidAt?: SolidAt): 'aim' | 'fire' | null {
    const before = this.last;
    this.last = state;
    if (state === before) return null;
    if (state === 'telegraph') {
      this.struck = false;
      const m = muzzleOf(x, feetY, facing, this.spec);
      this.mx = m.x;
      this.my = m.y;
      this.aimed = canAim(m.x, m.y, facing, tx, ty, this.spec, solidAt);
      if (!this.aimed) return null;
      this.ax = tx;
      this.ay = ty;
      return 'aim';
    }
    if (state === 'active' && this.aimed) {
      const end = traceBeam(this.mx, this.my, this.ax, this.ay, this.spec, solidAt);
      this.ex = end.x;
      this.ey = end.y;
      this.cut = end.cut;
      return 'fire';
    }
    if (state === 'idle') this.aimed = false;
    return null;
  }

  /** ¿El rayo toca a Kerana ahora? Solo en el golpe, con mira, y una vez por ciclo. */
  hits(state: GuardState, rect: RectLike): boolean {
    if (state !== 'active' || !this.aimed || this.struck) return false;
    if (!segmentHitsRect(this.mx, this.my, this.ex, this.ey, rect, this.spec.hitHalfWidth)) return false;
    this.struck = true;
    return true;
  }

  /** Olvida la mira (al purificarse). */
  clear(): void {
    this.aimed = false;
    this.struck = false;
  }
}
