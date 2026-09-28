// Rama que se quiebra (GDD §6.5): lógica pura, sin Phaser. Al pisarla cruje (aviso),
// se quiebra y cae; al rato vuelve a crecer en su lugar.

export type CrumbleState = 'solid' | 'cracking' | 'fallen';

export interface CrumbleConfig {
  /** Tiempo desde que se pisa hasta que se quiebra (ms). */
  crumbleDelayMs: number;
  /** Tiempo quebrada antes de reaparecer (ms). */
  crumbleRespawnMs: number;
}

export class CrumbleMotor {
  state: CrumbleState = 'solid';
  /** Tiempo que queda en el estado actual (ms). */
  msLeft = 0;

  constructor(private readonly cfg: CrumbleConfig) {}

  /** Sostiene a Kerana (tiene cuerpo sólido). */
  get solid(): boolean {
    return this.state !== 'fallen';
  }

  /** Avanza el tiempo. `stoodOn`: Kerana está parada encima en este frame. */
  step(dtMs: number, stoodOn: boolean): CrumbleState {
    switch (this.state) {
      case 'solid':
        if (stoodOn) this.enter('cracking', this.cfg.crumbleDelayMs);
        break;
      case 'cracking':
        // Una vez pisada se quiebra igual, aunque Kerana salte.
        this.msLeft -= dtMs;
        if (this.msLeft <= 0) this.enter('fallen', this.cfg.crumbleRespawnMs);
        break;
      case 'fallen':
        this.msLeft -= dtMs;
        if (this.msLeft <= 0) this.enter('solid', 0);
        break;
    }
    return this.state;
  }

  reset(): void {
    this.enter('solid', 0);
  }

  private enter(state: CrumbleState, ms: number): void {
    this.state = state;
    this.msLeft = ms;
  }
}
