// Lógica pura de Luisón (GDD §6.7): sin Phaser, con tests.

/** Índice del techo más lejano a Kerana: desde ahí tira los huesos. */
export function farthestIndex(x: number, centers: readonly number[]): number {
  let best = 0;
  for (let i = 1; i < centers.length; i++) if (Math.abs(centers[i] - x) > Math.abs(centers[best] - x)) best = i;
  return best;
}

/** Fase 3: ataques encadenados, en este orden (embestida, huesos y póra). */
export const CHAIN_STEPS = ['charge', 'clods', 'pora'] as const;
export type ChainStep = (typeof CHAIN_STEPS)[number];

/** Qué paso de la cadena toca a los `elapsedMs` de un ataque que dura `totalMs` (partes iguales). */
export function chainStepAt(elapsedMs: number, totalMs: number): ChainStep {
  const part = totalMs / CHAIN_STEPS.length;
  const i = Math.min(CHAIN_STEPS.length - 1, Math.max(0, Math.floor(elapsedMs / part)));
  return CHAIN_STEPS[i];
}

/** El aullido apaga las luces desde la fase 2 (luna llena). `phase` empieza en 0. */
export function howlBlacksOut(phase: number): boolean {
  return phase >= 1;
}

/** Dirección de la embestida: hacia Kerana. */
export function chargeDir(fromX: number, playerX: number): 1 | -1 {
  return playerX >= fromX ? 1 : -1;
}

/**
 * Alfa de los ojos brillantes (S89). Solo existen para seguirlo en el apagón: con la arena alumbrada no se dibujan,
 * y dentro del halo de Kerana tampoco (ahí se ve el sprite, que ya tiene ojos). Entre `haloRadius - fadePx` y
 * `haloRadius` de distancia a Kerana pasan de 0 a 1.
 */
export function eyeGlowAlpha(blackout: boolean, distToKerana: number, haloRadius: number, fadePx: number): number {
  if (!blackout) return 0;
  if (fadePx <= 0) return distToKerana >= haloRadius ? 1 : 0;
  return Math.min(1, Math.max(0, (distToKerana - (haloRadius - fadePx)) / fadePx));
}

/**
 * Ojo del sprite en unidades del mundo, desde los pies (origen 0.5, 1): `forward` hacia donde mira y `rise` hacia arriba.
 * `eye` es el píxel de la hoja (mirando a la izquierda) y `detail` los píxeles de hoja por unidad.
 */
export function eyeOffset(eye: readonly [number, number], frameWidth: number, frameHeight: number, detail: number, out: { forward: number; rise: number }): { forward: number; rise: number } {
  out.forward = (frameWidth / 2 - (eye[0] + 0.5)) / detail;
  out.rise = (frameHeight - (eye[1] + 0.5)) / detail;
  return out;
}
