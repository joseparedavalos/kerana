// Camalote (GDD §6.2): lógica pura, sin Phaser. Al pisarlo se hunde después de un aviso y
// reaparece al rato. En la fase 3 de Mbói Tu'i también se hunde solo (ciclo automático).

export type SinkingState = 'floating' | 'sinking' | 'sunk';

export interface SinkingConfig {
  /** Tiempo desde que se pisa hasta que se hunde (ms). */
  sinkDelayMs: number;
  /** Tiempo hundido antes de reaparecer (ms). */
  respawnMs: number;
  /** Ciclo automático: tiempo a flote antes de hundirse solo (ms). */
  cycleFloatMs: number;
}

export class SinkingMotor {
  state: SinkingState = 'floating';
  /** Tiempo que queda en el estado actual (ms). */
  msLeft = 0;
  /** Se hunde solo cada `cycleFloatMs`, aunque nadie lo pise. */
  autoCycle = false;

  constructor(private readonly cfg: SinkingConfig) {}

  /** Sostiene a Kerana (tiene cuerpo sólido). */
  get solid(): boolean {
    return this.state !== 'sunk';
  }

  /** Avanza el tiempo. `stoodOn`: Kerana está parada encima en este frame. */
  step(dtMs: number, stoodOn: boolean): SinkingState {
    switch (this.state) {
      case 'floating':
        if (stoodOn) {
          this.enter('sinking', this.cfg.sinkDelayMs);
        } else if (this.autoCycle) {
          this.msLeft -= dtMs;
          if (this.msLeft <= 0) this.enter('sinking', this.cfg.sinkDelayMs);
        }
        break;
      case 'sinking':
        // Una vez pisado se hunde igual, aunque Kerana salte.
        this.msLeft -= dtMs;
        if (this.msLeft <= 0) this.enter('sunk', this.cfg.respawnMs);
        break;
      case 'sunk':
        this.msLeft -= dtMs;
        if (this.msLeft <= 0) this.enter('floating', this.cfg.cycleFloatMs);
        break;
    }
    return this.state;
  }

  /** Activa o desactiva el ciclo automático (reinicia la espera a flote). */
  setAutoCycle(on: boolean, offsetMs = 0): void {
    this.autoCycle = on;
    if (this.state === 'floating') this.msLeft = this.cfg.cycleFloatMs + offsetMs;
  }

  reset(): void {
    this.autoCycle = false;
    this.enter('floating', this.cfg.cycleFloatMs);
  }

  private enter(state: SinkingState, ms: number): void {
    this.state = state;
    this.msLeft = ms;
  }
}
