// Máquina de estados del arquetipo Swarm (GDD §5.2): lógica pura, sin Phaser.
// Enjambre junto a su panal → persigue a Kerana un rato → se dispersa → vuelve al panal y espera.
// Los enjambres que llama Jasy Jatere empiezan persiguiendo y desaparecen al dispersarse.

export type SwarmState = 'idle' | 'chase' | 'disperse' | 'cooldown' | 'gone';

export interface SwarmConfig {
  detectRadius: number;
  /** Tiempo persiguiendo (ms). */
  chaseMs: number;
  /** Tiempo dispersándose, sin dañar (ms). */
  disperseMs: number;
  /** Espera en el panal antes de volver a salir (ms). */
  cooldownMs: number;
}

export class SwarmMotor {
  state: SwarmState = 'idle';
  private msLeft = 0;

  constructor(
    private readonly cfg: SwarmConfig,
    /** De un solo uso (llamado por el jefe): al dispersarse, desaparece. */
    private readonly oneShot = false,
  ) {
    if (oneShot) this.enter('chase', cfg.chaseMs);
  }

  /** Solo pica mientras persigue. */
  get harmful(): boolean {
    return this.state === 'chase';
  }

  /** Avanza un paso; `distance` es la distancia a Kerana. Devuelve el estado. */
  step(dtMs: number, distance: number): SwarmState {
    switch (this.state) {
      case 'idle':
        if (distance <= this.cfg.detectRadius) this.enter('chase', this.cfg.chaseMs);
        break;
      case 'gone':
        break;
      default:
        this.msLeft -= dtMs;
        if (this.msLeft > 0) break;
        if (this.state === 'chase') this.enter('disperse', this.cfg.disperseMs);
        else if (this.state === 'disperse') this.enter(this.oneShot ? 'gone' : 'cooldown', this.cfg.cooldownMs);
        else this.enter('idle', 0);
        break;
    }
    return this.state;
  }

  private enter(state: SwarmState, ms: number): void {
    this.state = state;
    this.msLeft = ms;
  }
}
