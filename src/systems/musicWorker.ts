// Genera las pistas fuera del hilo del juego (S37): en un celular lento, generar en el hilo principal trababa
// cuadros justo al entrar a un nivel. Recibe la definición y devuelve las muestras ya normalizadas.
// S107: también los jingles (una sola vez, sin bucle); esos vuelven sin normalizar: el AudioManager los lleva a la
// sonoridad del efecto que tocan.
import './audioContextStub';
import { ZZFX } from 'zzfx';
import { INSTRUMENTS } from '../data/music';
import { normalize, renderJingle, renderTrack, type JingleDef, type TrackDef } from './musicLogic';

export interface MusicJob {
  id: number;
  def: TrackDef;
  sampleRate: number;
  rms: number;
  ceiling: number;
  /** Un jingle (`def` es un `JingleDef`): sin bucle y sin normalizar. */
  jingle?: boolean;
}

export type MusicResult = { id: number; samples: Float32Array } | { id: number; error: string };

self.onmessage = async (e: MessageEvent<MusicJob>) => {
  const { id, def, sampleRate, rms, ceiling, jingle } = e.data;
  try {
    // Esta copia de ZzFX es solo del worker: no toca la de los efectos.
    ZZFX.sampleRate = sampleRate;
    const synth = (p: number[]) => ZZFX.buildSamples(...p);
    const samples = jingle
      ? await renderJingle(def as JingleDef, INSTRUMENTS, synth, { sampleRate })
      : await renderTrack(def, INSTRUMENTS, synth, { sampleRate });
    if (!jingle) normalize(samples, rms, ceiling);
    self.postMessage({ id, samples } satisfies MusicResult, { transfer: [samples.buffer] });
  } catch (err) {
    self.postMessage({ id, error: String(err) } satisfies MusicResult);
  }
};
