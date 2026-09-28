// Lógica pura de Luisón (GDD §6.7): sin Phaser, con tests.

/** Índice del techo más lejano a Kerana: desde ahí tira los terrones. */
export function farthestIndex(x: number, centers: readonly number[]): number {
  let best = 0;
  for (let i = 1; i < centers.length; i++) if (Math.abs(centers[i] - x) > Math.abs(centers[best] - x)) best = i;
  return best;
}

/** Fase 3: ataques encadenados, en este orden (embestida, terrones y póra). */
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
