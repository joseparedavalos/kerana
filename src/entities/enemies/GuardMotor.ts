// Máquina de estados del Guardián (Karaí Vosá, S72): lógica pura, sin Phaser.
// Quieto y a la vista. Cuando Kerana entra en su radio: aviso (levanta la cuchara) → golpe → se recupera → quieto.

export type GuardState = 'idle' | 'telegraph' | 'active' | 'recover';

export interface GuardConfig {
  /** Distancia horizontal (px) a la que empieza el aviso. */
  detectRadius: number;
  /** Diferencia de altura (px) hasta la que la ve: más arriba o más abajo, no golpea. */
  detectHeight: number;
  /** Aviso: la cuchara arriba (ms). */
  telegraphMs: number;
  /** El cucharazo: lo único que lastima (ms). */
  activeMs: number;
  /** Se recupera con la cuchara abajo (ms): la ventana para pasar o pegarle. */
  recoverMs: number;
}

export class GuardMotor {
  state: GuardState = 'idle';
  /** Tiempo en el estado actual (ms). */
  elapsedMs = 0;

  constructor(private readonly cfg: GuardConfig) {}

  /** ¿Kerana está a su alcance? `dx` y `dy`: de él a ella (px, con signo). */
  inRange(dx: number, dy: number): boolean {
    return Math.abs(dx) <= this.cfg.detectRadius && Math.abs(dy) <= this.cfg.detectHeight;
  }

  step(dtMs: number, inRange: boolean): GuardState {
    this.elapsedMs += dtMs;
    switch (this.state) {
      case 'idle':
        if (inRange) this.enter('telegraph');
        break;
      case 'telegraph':
        if (this.elapsedMs >= this.cfg.telegraphMs) this.enter('active', this.elapsedMs - this.cfg.telegraphMs);
        break;
      case 'active':
        if (this.elapsedMs >= this.cfg.activeMs) this.enter('recover', this.elapsedMs - this.cfg.activeMs);
        break;
      case 'recover':
        if (this.elapsedMs >= this.cfg.recoverMs) this.enter('idle');
        break;
    }
    return this.state;
  }

  /** Avance (0-1) dentro del estado actual (0 en reposo). */
  get progress(): number {
    const total = this.state === 'telegraph' ? this.cfg.telegraphMs : this.state === 'active' ? this.cfg.activeMs : this.state === 'recover' ? this.cfg.recoverMs : 0;
    return total > 0 ? Math.min(1, this.elapsedMs / total) : 0;
  }

  private enter(state: GuardState, carryMs = 0): void {
    this.state = state;
    this.elapsedMs = carryMs;
  }
}

/** Cuadros de la hoja `attack` que corresponden a cada tiempo (primero y último, inclusive). */
export interface GuardFrames {
  telegraph: readonly [number, number];
  active: readonly [number, number];
  recover: readonly [number, number];
}

/**
 * Cuadro de `attack` para un estado y su avance (0-1): los del aviso, del golpe y de la recuperación se reparten
 * parejos en su tiempo, así el dibujo dura lo mismo que el estado. En reposo, `null` (va la hoja `idle`).
 */
export function guardFrame(state: GuardState, progress: number, frames: GuardFrames): number | null {
  if (state === 'idle') return null;
  const [first, last] = frames[state];
  const n = last - first + 1;
  return first + Math.min(n - 1, Math.floor(Math.max(0, progress) * n));
}

/** El cucharazo: zona delante del cuerpo (px). */
export interface StrikeSpec {
  /** Desde el borde del cuerpo hacia donde mira. */
  reach: number;
  /** Desde los pies hacia arriba. */
  height: number;
}

/** Zona del cucharazo: desde el borde del cuerpo hacia donde mira, `reach` de largo y `height` desde los pies. */
export function strikeZone(x: number, feetY: number, facing: 1 | -1, halfWidth: number, strike: StrikeSpec): { x: number; y: number; width: number; height: number } {
  const near = x + facing * halfWidth;
  return { x: facing > 0 ? near : near - strike.reach, y: feetY - strike.height, width: strike.reach, height: strike.height };
}

/** Mira hacia Kerana en reposo y en el aviso; en el golpe y al recuperarse, no gira (se lo puede pasar por detrás). */
export function guardTurns(state: GuardState): boolean {
  return state === 'idle' || state === 'telegraph';
}
