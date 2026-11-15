import { GAMEPLAY } from '../config/gameplay';
import type { SfxKey } from '../systems/sfxPresets';
import type { ChargeConfig } from './PlayerMotor';

// Cómo suena la carga del tajo (S95), en lógica pura, sin Phaser ni audio:
// el zumbido que sube mientras brilla, el «ting» de lista y el tajo cargado al soltar.

/** Lo que necesita del audio (AudioManager lo cumple tal cual). */
export interface ChargeSoundSink {
  play(key: SfxKey): void;
  /** Un efecto que se puede cortar, desde `offsetSec`. */
  start(key: SfxKey, offsetSec: number): void;
  stop(key: SfxKey): void;
}

export type ChargeSoundPhase = 'off' | 'rising' | 'ready';

/** Lo que dura el zumbido: del brillo hasta que la carga está lista (s). */
export function chargeRiseSec(cfg: ChargeConfig = GAMEPLAY.chargedSlash): number {
  return Math.max(0, cfg.holdMs - cfg.glowFromMs) / 1000;
}

export class ChargeSound {
  phase: ChargeSoundPhase = 'off';
  /** El tajo cargado estaba saliendo en el paso anterior. */
  private swinging = false;
  /** El zumbido se cortó (pausa, diálogo) pero la carga sigue: vuelve donde iba. */
  private cut = false;
  private readonly riseSec: number;

  constructor(
    private readonly sink: ChargeSoundSink,
    cfg: ChargeConfig = GAMEPLAY.chargedSlash,
  ) {
    this.riseSec = chargeRiseSec(cfg);
  }

  /**
   * Un paso. `fraction`: `PlayerMotor.chargeFraction` (0 sin brillo, 1 lista);
   * `chargedSwing`: el tajo cargado está saliendo (suena una vez, al empezar).
   */
  step(fraction: number, chargedSwing: boolean): void {
    if (chargedSwing && !this.swinging) this.sink.play('chargedSlash');
    this.swinging = chargedSwing;

    // Soltó antes, la lastimaron o la carga se reinició: el zumbido se corta en el momento.
    if (fraction <= 0) {
      this.stopRise();
      this.phase = 'off';
      return;
    }
    if (fraction >= 1) {
      if (this.phase === 'ready') return;
      this.stopRise();
      this.phase = 'ready';
      this.sink.play('chargeReady');
      return;
    }
    if (this.phase === 'off' || (this.phase === 'rising' && this.cut)) {
      // Arranca (o vuelve) en el tono que corresponde a la carga.
      this.sink.start('chargeUp', fraction * this.riseSec);
      this.phase = 'rising';
      this.cut = false;
    }
  }

  /** El nivel deja de avanzar (pausa, diálogo, fin): se corta el zumbido sin perder la carga. */
  interrupt(): void {
    if (this.phase !== 'rising' || this.cut) return;
    this.sink.stop('chargeUp');
    this.cut = true;
  }

  private stopRise(): void {
    if (this.phase === 'rising' && !this.cut) this.sink.stop('chargeUp');
    this.cut = false;
  }
}
