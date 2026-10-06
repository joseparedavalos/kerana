// Plataforma móvil (Mover): lógica pura, sin Phaser. Recorre una recta entre su origen (pos 0)
// y el otro extremo (pos = largo), horizontal o vertical, con espera opcional en cada punta.
// También mueve a la vaca (patrulla de ida y vuelta que empieza en el medio).

/**
 * Cómo responde a los Switch:
 * - `loop`: va y viene siempre (no escucha a los Switch).
 * - `run`: quieta en el origen hasta tener energía; con energía va y viene; sin energía vuelve al origen.
 * - `toggle`: con energía va al otro extremo y se queda; sin energía vuelve al origen.
 */
export type MoverMode = 'loop' | 'run' | 'toggle';

export interface MoverSpec {
  /** Desplazamiento total hasta el otro extremo (px; con signo). Uno de los dos es 0. */
  dx: number;
  dy: number;
  /** px/s. */
  speed: number;
  /** Espera en cada extremo (ms). */
  waitMs: number;
  mode?: MoverMode;
  /** Arranca en este punto del recorrido (px desde el origen) y en este sentido (vaca: en el medio). */
  startPos?: number;
  startDir?: 1 | -1;
}

export interface MoverDelta {
  dx: number;
  dy: number;
}

export class MoverMotor {
  readonly length: number;
  readonly mode: MoverMode;
  /** Distancia recorrida desde el origen (0 … length). */
  pos = 0;
  /** Sentido actual: 1 hacia el otro extremo, -1 hacia el origen. */
  dir: 1 | -1 = 1;
  waitLeftMs = 0;
  /** Algún Switch que la maneja está encendido. */
  powered = false;
  private readonly ux: number;
  private readonly uy: number;
  private readonly out: MoverDelta = { dx: 0, dy: 0 };

  constructor(private readonly spec: MoverSpec) {
    this.length = Math.hypot(spec.dx, spec.dy);
    this.ux = this.length > 0 ? spec.dx / this.length : 0;
    this.uy = this.length > 0 ? spec.dy / this.length : 0;
    this.mode = spec.mode ?? 'loop';
    this.reset();
  }

  /** Desplazamiento desde el origen (px). */
  get offsetX(): number {
    return this.ux * this.pos;
  }

  get offsetY(): number {
    return this.uy * this.pos;
  }

  /** ¿Se está moviendo en este momento? */
  get moving(): boolean {
    return this.waitLeftMs <= 0 && this.goal() !== this.pos;
  }

  setPowered(on: boolean): void {
    if (on === this.powered) return;
    this.powered = on;
    // Al recibir energía sale hacia el otro extremo sin esperar.
    if (on && this.mode !== 'loop') {
      this.dir = this.pos >= this.length ? -1 : 1;
      this.waitLeftMs = 0;
    }
  }

  /** Avanza el tiempo; devuelve cuánto se movió en este paso (objeto reutilizado). */
  step(dtMs: number): MoverDelta {
    const before = this.pos;
    let left = dtMs;
    // Puede llegar a un extremo y seguir con el tiempo que sobra (o esperar ahí).
    for (let guard = 0; left > 0 && guard < 4; guard++) {
      if (this.waitLeftMs > 0) {
        const w = Math.min(this.waitLeftMs, left);
        this.waitLeftMs -= w;
        left -= w;
        continue;
      }
      const goal = this.goal();
      if (goal === this.pos) {
        // Va y viene pero ya está en la punta hacia la que mira (arranque en un extremo): da la vuelta.
        if (!this.pingPong() || this.length === 0) break;
        this.dir = this.dir > 0 ? -1 : 1;
        continue;
      }
      const sign = goal > this.pos ? 1 : -1;
      const maxMove = (this.spec.speed * left) / 1000;
      const dist = Math.abs(goal - this.pos);
      if (dist > maxMove) {
        this.pos += sign * maxMove;
        left = 0;
        break;
      }
      this.pos = goal;
      left -= (dist / this.spec.speed) * 1000;
      if (this.pingPong()) {
        this.dir = this.dir > 0 ? -1 : 1;
        this.waitLeftMs = this.spec.waitMs;
      }
    }
    const moved = this.pos - before;
    this.out.dx = this.ux * moved;
    this.out.dy = this.uy * moved;
    return this.out;
  }

  /** Vuelve al estado inicial (al reentrar al nivel). */
  reset(): void {
    this.pos = Math.min(this.length, Math.max(0, this.spec.startPos ?? 0));
    this.dir = this.spec.startDir ?? 1;
    this.waitLeftMs = 0;
    this.powered = false;
  }

  /** ¿Va y viene entre los extremos? */
  private pingPong(): boolean {
    return this.mode === 'loop' || (this.mode === 'run' && this.powered);
  }

  /** Hacia dónde va ahora (pos). */
  private goal(): number {
    if (this.pingPong()) return this.dir > 0 ? this.length : 0;
    if (this.mode === 'toggle' && this.powered) return this.length;
    return 0;
  }
}

/** Caja de un cuerpo (px del mundo) y su velocidad vertical. */
export interface RiderBox {
  left: number;
  right: number;
  bottom: number;
  vy: number;
  /** Apoyado en algo en el último paso de la física (blocked/touching down). */
  grounded: boolean;
}

/** ¿El cuerpo viaja sobre la plataforma cuya cara de arriba es `top` entre `left` y `right`? */
export function isRiding(rider: RiderBox, top: number, left: number, right: number, tolerancePx: number): boolean {
  if (!rider.grounded || rider.vy < 0) return false;
  if (rider.right <= left || rider.left >= right) return false;
  return Math.abs(rider.bottom - top) <= tolerancePx;
}
