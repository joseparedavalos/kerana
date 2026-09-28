import { GAMEPLAY } from '../config/gameplay';

// Estados alterados de Kerana (GDD §4.8). Lógica pura, sin Phaser.
// Hipnosis de Moñái (izquierda y derecha invertidas) y sueño de siesta (N4: quieta en la niebla → se duerme).

export interface HorizontalInput {
  left: boolean;
  right: boolean;
}

/** Entrada que el sueño anula mientras Kerana duerme. */
export interface SleepableInput extends HorizontalInput {
  jumpPressed?: boolean;
  jumpHeld?: boolean;
  attackPressed?: boolean;
  attackHeld?: boolean;
  dashPressed?: boolean;
}

export interface SleepConfig {
  stillToSleepMs: number;
  yawnAtMs: number;
  sleepMs: number;
  pressCutMs: number;
}

/** Lo que pasó con el sueño en este paso (para sonido e icono). */
export type SleepEvent = 'yawn' | 'asleep' | 'awake' | null;

export class StatusEffects {
  private hypnosisMs = 0;
  private hypnosisTotalMs = 1;
  /** Tiempo quieta dentro de la niebla (ms). */
  private stillMs = 0;
  /** Sueño que queda (ms); > 0 = dormida. */
  private sleepLeftMs = 0;

  constructor(private readonly sleepCfg: SleepConfig = GAMEPLAY.sleep) {}

  get hypnotized(): boolean {
    return this.hypnosisMs > 0;
  }

  /** Lo que queda de hipnosis (1 → 0), para el icono. */
  get hypnosisFraction(): number {
    return this.hypnosisMs / this.hypnosisTotalMs;
  }

  get asleep(): boolean {
    return this.sleepLeftMs > 0;
  }

  /** Ya bostezó: se va a dormir si sigue quieta. */
  get drowsy(): boolean {
    return !this.asleep && this.stillMs >= this.sleepCfg.yawnAtMs;
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

  /**
   * Sueño de siesta. `inFog`: Kerana está dentro de la niebla. `still`: no mantiene ningún botón.
   * `pressed`: pulsó algún botón en este paso (dormida, acorta el sueño).
   */
  stepSleep(dtMs: number, inFog: boolean, still: boolean, pressed: boolean): SleepEvent {
    const cfg = this.sleepCfg;
    if (this.asleep) {
      this.sleepLeftMs -= dtMs + (pressed ? cfg.pressCutMs : 0);
      if (this.sleepLeftMs > 0) return null;
      this.sleepLeftMs = 0;
      this.stillMs = 0;
      return 'awake';
    }
    if (!inFog || !still) {
      this.stillMs = 0;
      return null;
    }
    const before = this.stillMs;
    this.stillMs += dtMs;
    if (this.stillMs >= cfg.stillToSleepMs) {
      this.sleepLeftMs = cfg.sleepMs;
      this.stillMs = 0;
      return 'asleep';
    }
    return before < cfg.yawnAtMs && this.stillMs >= cfg.yawnAtMs ? 'yawn' : null;
  }

  /** La despierta (por ejemplo, al recibir daño). */
  wake(): void {
    this.sleepLeftMs = 0;
    this.stillMs = 0;
  }

  /** Controles invertidos (hipnosis) o anulados (dormida). Modifica `input`. */
  applyTo(input: SleepableInput): void {
    if (this.asleep) {
      input.left = false;
      input.right = false;
      input.jumpPressed = false;
      input.jumpHeld = false;
      input.attackPressed = false;
      input.attackHeld = false;
      input.dashPressed = false;
      return;
    }
    if (!this.hypnotized) return;
    const left = input.left;
    input.left = input.right;
    input.right = left;
  }

  clear(): void {
    this.hypnosisMs = 0;
    this.wake();
  }
}
