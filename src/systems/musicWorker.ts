// Genera las pistas fuera del hilo del juego (S37): en un celular lento, generar en el hilo principal trababa
// cuadros justo al entrar a un nivel. Recibe la definición y devuelve las muestras ya normalizadas.
import './audioContextStub';
import { ZZFX } from 'zzfx';
import { INSTRUMENTS } from '../data/music';
import { normalize, renderTrack, type TrackDef } from './musicLogic';

export interface MusicJob {
  id: number;
  def: TrackDef;
  sampleRate: number;
  rms: number;
  ceiling: number;
}

export type MusicResult = { id: number; samples: Float32Array } | { id: number; error: string };

self.onmessage = async (e: MessageEvent<MusicJob>) => {
  const { id, def, sampleRate, rms, ceiling } = e.data;
  try {
    // Esta copia de ZzFX es solo del worker: no toca la de los efectos.
    ZZFX.sampleRate = sampleRate;
    const samples = await renderTrack(def, INSTRUMENTS, (p) => ZZFX.buildSamples(...p), { sampleRate });
    normalize(samples, rms, ceiling);
    self.postMessage({ id, samples } satisfies MusicResult, { transfer: [samples.buffer] });
  } catch (err) {
    self.postMessage({ id, error: String(err) } satisfies MusicResult);
  }
};
