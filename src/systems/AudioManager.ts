import { SFX_PRESETS, type SfxKey } from './sfxPresets';

// AudioManager mínimo (GDD §10.4): efectos generados por código con ZzFX.
// La música y el desbloqueo en móvil llegan en S5; acá solo hay efectos.
export class AudioManager {
  private static muted = false;

  /** `pan`: -1 (izquierda) a 1 (derecha); el silbido de Jasy Jatere lo usa como pista (GDD §6.4). */
  static play(key: SfxKey, pan = 0): void {
    if (this.muted) return;
    void this.zzfxModule()
      .then(({ zzfx, ZZFX }) => {
        if (pan === 0) zzfx(...SFX_PRESETS[key]);
        else ZZFX.playSamples([ZZFX.buildSamples(...SFX_PRESETS[key])], 1, 1, Math.max(-1, Math.min(1, pan)));
      })
      .catch(() => {
        /* sin audio disponible (por ejemplo, sin gesto del usuario todavía): se ignora */
      });
  }

  static setMuted(muted: boolean): void {
    this.muted = muted;
  }

  private static zzfxPromise: Promise<typeof import('zzfx')> | null = null;
  private static zzfxModule(): Promise<typeof import('zzfx')> {
    if (!this.zzfxPromise) this.zzfxPromise = import('zzfx');
    return this.zzfxPromise;
  }
}
