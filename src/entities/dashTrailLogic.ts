// Estela del dash (S83): cuándo nace cada copia y cuánto se ve. Lógica pura, sin Phaser.

export interface DashTrailConfig {
  everyMs: number;
  maxGhosts: number;
  alpha: number;
  fadeMs: number;
}

/** Opacidad de una copia con `ageMs` de vida: `alpha` al nacer, lineal hasta 0 en `fadeMs`. */
export function ghostAlpha(ageMs: number, cfg: Pick<DashTrailConfig, 'alpha' | 'fadeMs'>): number {
  if (ageMs >= cfg.fadeMs) return 0;
  return cfg.alpha * (1 - Math.max(0, ageMs) / cfg.fadeMs);
}

/**
 * Reloj de la estela: con `step` dice si este cuadro nace una copia. La primera sale al arrancar el dash;
 * después, una cada `everyMs`. Al terminar el dash se reinicia.
 */
export class DashTrailClock {
  private wasDashing = false;
  private sinceMs = 0;

  constructor(private readonly everyMs: number) {}

  step(dashing: boolean, deltaMs: number): boolean {
    if (!dashing) {
      this.wasDashing = false;
      return false;
    }
    if (!this.wasDashing) {
      this.wasDashing = true;
      this.sinceMs = 0;
      return true;
    }
    this.sinceMs += deltaMs;
    if (this.sinceMs < this.everyMs) return false;
    // Resta en vez de poner a 0: con cuadros desparejos el ritmo medio sigue siendo `everyMs`.
    this.sinceMs -= this.everyMs;
    if (this.sinceMs >= this.everyMs) this.sinceMs = 0;
    return true;
  }
}

/** Índice del lugar de la pila a usar: uno apagado, o si no hay, el más viejo. */
export function pickSlot(ages: ArrayLike<number>, alive: ArrayLike<boolean>): number {
  let oldest = 0;
  for (let i = 0; i < ages.length; i++) {
    if (!alive[i]) return i;
    if (ages[i] > ages[oldest]) oldest = i;
  }
  return oldest;
}

/** Ángulos (grados, Phaser: 0 = derecha, 90 = abajo) del polvo de salida: hacia atrás y algo hacia arriba. */
export function dustAngles(facing: number, spreadDeg: number, liftDeg: number): { min: number; max: number } {
  const center = facing >= 0 ? 180 + liftDeg : -liftDeg;
  return { min: center - spreadDeg, max: center + spreadDeg };
}
