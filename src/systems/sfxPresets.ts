// Parámetros de ZzFX por efecto (GDD §10.3). Provisionales: Jose los puede reafinar
// en https://killedbyapixel.github.io/ZzFX/ y pegar el array actualizado aquí.

export type SfxKey =
  | 'jump'
  | 'land'
  | 'slash'
  | 'chargedSlash'
  | 'hit'
  | 'purify'
  | 'hurt'
  | 'heal'
  | 'luzArasy'
  | 'feather'
  | 'fire'
  | 'rockBreak'
  // Teju Jagua (GDD §6.1, §10.3)
  | 'growl'
  | 'bite'
  | 'tailWave'
  | 'fireBreath'
  | 'bossHit'
  | 'headSleep'
  | 'arenaLock'
  | 'liberation';

// [volumen, aleatoriedad, frecuencia, ataque, sostenido, caída, forma, curva, slide, deltaSlide,
//  saltoDeTono, tiempoSaltoDeTono, repetición, ruido, modulación, bitCrush, delay, sostenidoVol, decay, tremolo]
export const SFX_PRESETS: Record<SfxKey, number[]> = {
  jump: [0.9, 0.05, 320, 0.02, 0.05, 0.08, 1, 1.6, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0.4, 0.05],
  land: [0.6, 0.1, 120, 0, 0.03, 0.05, 4, 0.6, 0, 0, 0, 0, 0, 0.6, 0, 0, 0, 0.5, 0.02],
  slash: [0.8, 0.1, 900, 0, 0.03, 0.07, 3, 1.2, -20, 0, 0, 0, 0, 0.2, 0, 0, 0, 0.5, 0.02],
  hit: [0.7, 0.15, 180, 0, 0.05, 0.08, 2, 1.5, -10, 0, 0, 0, 0, 0.4, 0, 0, 0, 0.6, 0.02],
  purify: [0.8, 0.1, 500, 0.02, 0.12, 0.2, 0, 1, 0, 0, 400, 0.06, 0, 0, 0, 0, 0, 0.7, 0.1],
  hurt: [0.8, 0.2, 140, 0, 0.08, 0.15, 3, 2, -6, 0, 0, 0, 0, 0.3, 0, 0, 0, 0.6, 0.05],
  heal: [0.6, 0.05, 440, 0.03, 0.15, 0.2, 0, 1, 0, 0, 220, 0.08, 0, 0, 0, 0, 0, 0.7, 0.1],
  luzArasy: [0.7, 0.05, 660, 0.05, 0.2, 0.3, 0, 1, 0, 0, 330, 0.1, 0.02, 0, 0, 0, 0, 0.7, 0.15],
  feather: [0.5, 0.05, 700, 0, 0.06, 0.1, 0, 1, 0, 0, 260, 0.05, 0, 0, 0, 0, 0, 0.6, 0.05],
  fire: [0.5, 0.1, 200, 0.02, 0.08, 0.15, 3, 1, 0, 0, 0, 0, 0, 0.5, 0, 0, 0, 0.5, 0.03],
  chargedSlash: [1, 0.05, 600, 0.01, 0.06, 0.18, 3, 1.4, -30, 0, 0, 0, 0, 0.3, 0, 0, 0.05, 0.6, 0.05],
  rockBreak: [0.9, 0.2, 90, 0, 0.06, 0.25, 4, 1.5, -2, 0, 0, 0, 0, 1.2, 0, 0.2, 0, 0.5, 0.05],
  growl: [0.8, 0.1, 70, 0.08, 0.3, 0.25, 2, 2.5, -1, 0, 0, 0, 0, 0.8, 8, 0.1, 0, 0.6, 0.1],
  bite: [0.9, 0.1, 160, 0, 0.04, 0.1, 3, 2, -12, 0, 0, 0, 0, 0.6, 0, 0.1, 0, 0.6, 0.02],
  tailWave: [0.9, 0.1, 55, 0.02, 0.2, 0.4, 4, 1, 0, 0, 0, 0, 0, 1.5, 0, 0.3, 0, 0.6, 0.1],
  fireBreath: [0.8, 0.2, 120, 0.1, 0.5, 0.4, 4, 1, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0.7, 0.2, 0.3],
  bossHit: [1, 0.1, 220, 0, 0.06, 0.12, 2, 1.8, -8, 0, 0, 0, 0, 0.5, 0, 0.1, 0, 0.6, 0.03],
  headSleep: [0.7, 0.05, 300, 0.05, 0.25, 0.5, 0, 1, -2, 0, -80, 0.15, 0, 0, 0, 0, 0, 0.6, 0.2],
  arenaLock: [1, 0.1, 60, 0, 0.1, 0.5, 4, 1, 0, 0, 0, 0, 0, 1.8, 0, 0.4, 0, 0.5, 0.1],
  liberation: [0.8, 0.02, 520, 0.08, 0.5, 0.8, 0, 1, 0, 0, 260, 0.12, 0.08, 0, 0, 0, 0.1, 0.8, 0.3],
};
