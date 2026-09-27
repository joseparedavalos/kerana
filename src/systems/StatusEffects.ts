// Estados alterados de Kerana (GDD §4.8). Lógica pura, sin Phaser.
// Por ahora solo la hipnosis de Moñái: invierte izquierda y derecha durante un tiempo.

export interface HorizontalInput {
  left: boolean;
  right: boolean;
}

export class StatusEffects {
  private hypnosisMs = 0;
  private hypnosisTotalMs = 1;

  get hypnotized(): boolean {
    return this.hypnosisMs > 0;
  }

  /** Lo que queda de hipnosis (1 → 0), para el icono. */
  get hypnosisFraction(): number {
    return this.hypnosisMs / this.hypnosisTotalMs;
  }

  /** Aplica (o renueva) la hipnosis. Devuelve true si Kerana no estaba hipnotizada. */
  applyHypnosis(ms: number): boolean {
    const fresh = !this.hypnotized;
    if (ms >= this.hypnosisMs) {
      this.hypnosisMs = ms;
      this.hypnosisTotalMs = Math.max(1, ms);
    }
    return fresh;
  }

  step(dtMs: number): void {
    this.hypnosisMs = Math.max(0, this.hypnosisMs - dtMs);
  }

  /** Controles horizontales invertidos mientras dura la hipnosis (modifica `input`). */
  applyTo(input: HorizontalInput): void {
    if (!this.hypnotized) return;
    const left = input.left;
    input.left = input.right;
    input.right = left;
  }

  clear(): void {
    this.hypnosisMs = 0;
  }
}
