// Máquina de estados del arquetipo Lurker (GDD §5.2): lógica pura, sin Phaser.
// Oculto → burbujas (aviso) → fuera (vulnerable) → se sumerge y espera.

export type LurkerState = 'hidden' | 'warn' | 'exposed' | 'cooldown';

export interface LurkerConfig {
  detectRadius: number;
  /** Burbujas antes de emerger (ms). */
  warnMs: number;
  /** Tiempo fuera del agua (ms). */
  exposedMs: number;
  /** Tiempo sumergido antes de poder volver a emerger (ms). */
  cooldownMs: number;
}

export class LurkerMotor {
  state: LurkerState = 'hidden';
  private msLeft = 0;

  constructor(private readonly cfg: LurkerConfig) {}

  /** Solo se le puede pegar (y solo muerde) cuando está fuera. */
  get exposed(): boolean {
    return this.state === 'exposed';
  }

  /** `distance`: distancia a Kerana (Infinity si no hay objetivo válido). */
  step(dtMs: number, distance: number): LurkerState {
    switch (this.state) {
      case 'hidden':
        if (distance <= this.cfg.detectRadius) this.enter('warn', this.cfg.warnMs);
        break;
      case 'warn':
        this.msLeft -= dtMs;
        if (this.msLeft <= 0) this.enter('exposed', this.cfg.exposedMs);
        break;
      case 'exposed':
        this.msLeft -= dtMs;
        if (this.msLeft <= 0) this.enter('cooldown', this.cfg.cooldownMs);
        break;
      case 'cooldown':
        this.msLeft -= dtMs;
        if (this.msLeft <= 0) this.enter('hidden', 0);
        break;
    }
    return this.state;
  }

  private enter(state: LurkerState, ms: number): void {
    this.state = state;
    this.msLeft = ms;
  }
}
