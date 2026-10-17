declare module 'zzfx' {
  export function zzfx(...parameters: number[]): unknown;
  export const ZZFX: {
    /** Volumen global: se aplica al generar y otra vez al sonar. */
    volume: number;
    sampleRate: number;
    /** Se crea al importar el módulo (por eso se importa después del primer gesto). */
    audioContext: AudioContext;
    buildSamples(...parameters: number[]): number[];
    playSamples(sampleChannels: number[][], volumeScale?: number, rate?: number, pan?: number, loop?: boolean): AudioBufferSourceNode;
  };
}
