// Máquina de estados del arquetipo Thrower (GDD §5.2): lógica pura, sin Phaser.
// Quieto → prepara el tiro (aviso) → lanza en arco → espera.

export type ThrowerState = 'idle' | 'windup' | 'cooldown';

export interface ThrowerConfig {
  detectRadius: number;
  /** Aviso antes de lanzar (ms). */
  windupMs: number;
  /** Espera entre tiros (cadencia, ms). */
  cooldownMs: number;
}

export class ThrowerMotor {
  state: ThrowerState = 'idle';
  private msLeft = 0;

  constructor(private readonly cfg: ThrowerConfig) {}

  /** Avanza el tiempo; devuelve true en el paso en que lanza. `distance`: a Kerana (Infinity = sin objetivo). */
  step(dtMs: number, distance: number): boolean {
    switch (this.state) {
      case 'idle':
        if (distance <= this.cfg.detectRadius) this.enter('windup', this.cfg.windupMs);
        return false;
      case 'windup':
        this.msLeft -= dtMs;
        if (this.msLeft > 0) return false;
        this.enter('cooldown', this.cfg.cooldownMs);
        return true;
      case 'cooldown':
        this.msLeft -= dtMs;
        if (this.msLeft <= 0) this.enter('idle', 0);
        return false;
    }
  }

  private enter(state: ThrowerState, ms: number): void {
    this.state = state;
    this.msLeft = ms;
  }
}

/**
 * Velocidad inicial para que un proyectil con gravedad `gravity` llegue a (dx, dy) en `flightMs`.
 * y positiva hacia abajo. Escribe en `out` y lo devuelve.
 */
export function arcVelocity(dx: number, dy: number, flightMs: number, gravity: number, out: { vx: number; vy: number }): { vx: number; vy: number } {
  const t = Math.max(0.05, flightMs / 1000);
  out.vx = dx / t;
  out.vy = (dy - 0.5 * gravity * t * t) / t;
  return out;
}

/** Tiempo de vuelo según la distancia: más lejos, más tiempo (acotado). */
export function flightTimeFor(distance: number, msPerPx: number, minMs: number, maxMs: number): number {
  return Math.min(maxMs, Math.max(minMs, distance * msPerPx));
}
