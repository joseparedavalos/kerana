// Máquina de estados del arquetipo Charger (GDD §5.2): lógica pura, sin Phaser.

export type ChargerState = 'idle' | 'telegraph' | 'charge' | 'cooldown';

export interface ChargerConfig {
  detectRadius: number;
  telegraphMs: number;
  chargeSpeed: number;
  /** Tope de seguridad: si no choca antes, corta la carga (ms). */
  chargeMaxMs: number;
  cooldownMs: number;
}

export interface ChargerOutput {
  state: ChargerState;
  vx: number;
}

export class ChargerMotor {
  state: ChargerState = 'idle';
  private msLeft = 0;
  private chargeDir: 1 | -1 = 1;
  private readonly out: ChargerOutput = { state: 'idle', vx: 0 };

  constructor(private readonly cfg: ChargerConfig) {}

  /**
   * Avanza un paso. `distance` y `dirToTarget` (-1 o 1) describen dónde está Kerana;
   * pasar `distance = Infinity` si no hay objetivo válido (por ejemplo, distinta altura).
   */
  step(dtMs: number, distance: number, dirToTarget: 1 | -1): ChargerOutput {
    switch (this.state) {
      case 'idle':
        if (distance <= this.cfg.detectRadius) {
          this.chargeDir = dirToTarget;
          this.state = 'telegraph';
          this.msLeft = this.cfg.telegraphMs;
        }
        break;
      case 'telegraph':
        this.msLeft -= dtMs;
        if (this.msLeft <= 0) {
          this.state = 'charge';
          this.msLeft = this.cfg.chargeMaxMs;
        }
        break;
      case 'charge':
        this.msLeft -= dtMs;
        if (this.msLeft <= 0) this.stopCharge();
        break;
      case 'cooldown':
        this.msLeft -= dtMs;
        if (this.msLeft <= 0) this.state = 'idle';
        break;
    }
    // El vx se deriva del estado ya actualizado (evita un frame de retraso en las transiciones).
    this.out.vx = this.state === 'charge' ? this.chargeDir * this.cfg.chargeSpeed : 0;
    this.out.state = this.state;
    return this.out;
  }

  /** Llamar cuando el cuerpo choca contra una pared mientras carga. */
  stopCharge(): void {
    if (this.state !== 'charge') return;
    this.state = 'cooldown';
    this.msLeft = this.cfg.cooldownMs;
  }
}
