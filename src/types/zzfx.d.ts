declare module 'zzfx' {
  export function zzfx(...parameters: number[]): unknown;
  export const ZZFX: {
    buildSamples(...parameters: number[]): number[];
    playSamples(sampleChannels: number[][], volumeScale?: number, rate?: number, pan?: number, loop?: boolean): unknown;
  };
}
