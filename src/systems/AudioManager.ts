import { SFX_PRESETS, type SfxKey } from './sfxPresets';

// AudioManager mínimo (GDD §10.4): efectos generados por código con ZzFX.
// La música y el desbloqueo en móvil llegan en S5; acá solo hay efectos.
export class AudioManager {
  private static muted = false;

  static play(key: SfxKey): void {
    if (this.muted) return;
    void this.zzfx().then((zzfx) => zzfx(...SFX_PRESETS[key])).catch(() => {
      /* sin audio disponible (por ejemplo, sin gesto del usuario todavía): se ignora */
    });
  }

  static setMuted(muted: boolean): void {
    this.muted = muted;
  }

  private static zzfxPromise: Promise<(...p: number[]) => unknown> | null = null;
  private static zzfx(): Promise<(...p: number[]) => unknown> {
    if (!this.zzfxPromise) this.zzfxPromise = import('zzfx').then((m) => m.zzfx);
    return this.zzfxPromise;
  }
}
