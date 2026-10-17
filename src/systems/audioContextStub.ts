// ZzFX crea un AudioContext al importarse; en el worker de la música no existe y solo hace falta buildSamples.
const g = globalThis as unknown as { AudioContext?: unknown };
g.AudioContext ??= class {};
export {};
