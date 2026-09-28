import type { BossId } from '../../data/types';

// Lógica pura de Tau (GDD §7): sin Phaser, con tests.

/** Las tres formas de Tau, una por fase (`phase` empieza en 0). */
export const TAU_FORMS = ['disguise', 'echoes', 'true'] as const;
export type TauForm = (typeof TAU_FORMS)[number];

export function formForPhase(phase: number): TauForm {
  return TAU_FORMS[Math.min(TAU_FORMS.length - 1, Math.max(0, phase))];
}

/** Fase 2: cada ataque es la sombra de un hijo que repite su ataque (reutiliza a los jefes). */
export const TAU_ECHOES: Readonly<Record<string, BossId>> = {
  echo_teju: 'teju_jagua',
  echo_mboi: 'mboi_tui',
  echo_jasy: 'jasy_jatere',
};

/** De qué hijo es el eco de un ataque, o null si no es un eco. */
export function echoOf(attackId: string): BossId | null {
  return TAU_ECHOES[attackId] ?? null;
}

/** En las fases 2 y 3 Tau flota fuera del alcance, salvo en la ventana (baja cansado o lo baja la estrella). */
export function floatsOutOfReach(form: TauForm, state: string): boolean {
  return form !== 'disguise' && state !== 'recover' && state !== 'defeated';
}

/**
 * Fase 3: qué estrella se enciende para ayudar a Kerana. La más cercana a ella (centros en x),
 * sin repetir la anterior si hay otra.
 */
export function pickLitStar(starCenters: readonly number[], playerX: number, previous = -1): number {
  let best = -1;
  for (let i = 0; i < starCenters.length; i++) {
    if (i === previous && starCenters.length > 1) continue;
    if (best < 0 || Math.abs(starCenters[i] - playerX) < Math.abs(starCenters[best] - playerX)) best = i;
  }
  return best;
}

/** El humo cubre las nubes: daña si los pies de Kerana están por debajo de su borde superior. */
export function smokeHurts(feetY: number, smokeTopY: number): boolean {
  return feetY > smokeTopY;
}

/** Lado de las nubes más lejano a Kerana (fase 1: Tau cambia de lado para tocar la flauta). */
export function farSide(playerX: number, left: number, right: number): number {
  return Math.abs(playerX - left) >= Math.abs(playerX - right) ? left : right;
}

/** Posiciones x de las rocas del eco de Teju Jagua: centradas en Kerana, dentro de la arena. */
export function echoRockXs(playerX: number, count: number, gapPx: number, minX: number, maxX: number): number[] {
  const xs: number[] = [];
  for (let i = 0; i < count; i++) {
    const x = playerX + (i - (count - 1) / 2) * gapPx;
    xs.push(Math.min(maxX, Math.max(minX, x)));
  }
  return xs;
}
