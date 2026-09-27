// Ciclo de una ráfaga de viento (GDD §4.8): calma → aviso → ráfaga → calma. Lógica pura.

export type WindPhase = 'calm' | 'warn' | 'gust';

export interface WindTiming {
  calmMs: number;
  /** El pasto se inclina y aparecen partículas antes de la ráfaga. */
  warnMs: number;
  gustMs: number;
}

export class WindCycle {
  phase: WindPhase = 'calm';
  private leftMs: number;

  constructor(
    private readonly cfg: WindTiming,
    /** Desfase inicial (ms) para que zonas vecinas no soplen a la vez. */
    offsetMs = 0,
  ) {
    this.leftMs = cfg.calmMs + offsetMs;
  }

  get blowing(): boolean {
    return this.phase === 'gust';
  }

  /** Avanza; devuelve la fase nueva si cambió, o null. */
  step(dtMs: number): WindPhase | null {
    this.leftMs -= dtMs;
    if (this.leftMs > 0) return null;
    const next: WindPhase = this.phase === 'calm' ? 'warn' : this.phase === 'warn' ? 'gust' : 'calm';
    this.phase = next;
    this.leftMs += next === 'warn' ? this.cfg.warnMs : next === 'gust' ? this.cfg.gustMs : this.cfg.calmMs;
    if (this.leftMs <= 0) this.leftMs = 1;
    return next;
  }
}
