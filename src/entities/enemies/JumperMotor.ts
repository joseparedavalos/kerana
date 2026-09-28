// Máquina de estados del arquetipo Jumper (GDD §5.2): lógica pura, sin Phaser.
// Espera → se agacha (aviso) → salta hacia Kerana → aterriza y vuelve a esperar.

export type JumperState = 'wait' | 'crouch' | 'air';

export interface JumperConfig {
  detectRadius: number;
  /** Espera en el suelo entre saltos (ms). */
  waitMs: number;
  /** Agachado antes de saltar (ms). */
  crouchMs: number;
  /** Velocidad vertical del salto (px/s, negativa = arriba) y horizontal (px/s). */
  jumpVelocity: number;
  jumpSpeedX: number;
}

export interface JumperOutput {
  state: JumperState;
  /** Impulso a aplicar en este paso (solo al despegar); null = no tocar la velocidad. */
  jump: { vx: number; vy: number } | null;
}

export class JumperMotor {
  state: JumperState = 'wait';
  private msLeft: number;
  private readonly impulse = { vx: 0, vy: 0 };
  private readonly out: JumperOutput = { state: 'wait', jump: null };

  constructor(private readonly cfg: JumperConfig) {
    this.msLeft = cfg.waitMs;
  }

  /**
   * `distance`: distancia a Kerana (Infinity si no hay objetivo); `dir`: hacia dónde está (-1 o 1);
   * `grounded`: el cuerpo está apoyado.
   */
  step(dtMs: number, distance: number, dir: 1 | -1, grounded: boolean): JumperOutput {
    this.out.jump = null;
    switch (this.state) {
      case 'wait':
        this.msLeft -= dtMs;
        if (this.msLeft <= 0 && grounded && distance <= this.cfg.detectRadius) {
          this.state = 'crouch';
          this.msLeft = this.cfg.crouchMs;
          this.impulse.vx = dir * this.cfg.jumpSpeedX;
        }
        break;
      case 'crouch':
        this.msLeft -= dtMs;
        if (this.msLeft <= 0) {
          this.state = 'air';
          this.impulse.vy = this.cfg.jumpVelocity;
          this.out.jump = this.impulse;
          // Da un margen para despegar antes de mirar si aterrizó.
          this.msLeft = 100;
        }
        break;
      case 'air':
        this.msLeft -= dtMs;
        if (this.msLeft <= 0 && grounded) {
          this.state = 'wait';
          this.msLeft = this.cfg.waitMs;
        }
        break;
    }
    this.out.state = this.state;
    return this.out;
  }
}
