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

/** Una estrella de la fase 3: su plataforma (px). */
export interface StarBox {
  left: number;
  right: number;
  top: number;
}

/** Cuánto ocupa Tau alrededor de su centro (px): media anchura, y alto por arriba y por abajo. */
export interface TauExtents {
  halfW: number;
  above: number;
  below: number;
}

/** Más bajo que puede quedar el borde de abajo de Tau con su centro en `x` (sin tapar estrellas ni a Kerana encima). */
function lowestBottom(stars: readonly StarBox[], x: number, halfW: number, clearPx: number): number {
  let bottom = Infinity;
  for (const s of stars) if (s.left < x + halfW && s.right > x - halfW) bottom = Math.min(bottom, s.top - clearPx);
  return bottom;
}

/** Fase 3: borde de abajo de Tau flotando, por encima de la estrella más alta (S94). */
export function floatBottom(stars: readonly StarBox[], clearPx: number): number {
  return Math.min(...stars.map((s) => s.top)) - clearPx;
}

/**
 * Fase 3: dónde lo baja el rayo de la estrella encendida (S94). Sobre ella, montado al menos `minOverlap` px, dentro de
 * [minX, maxX], y lo más bajo posible sin tapar ninguna estrella ni tocar a Kerana parada encima (`clearPx` sobre cada
 * plataforma que tenga debajo). A igual altura, lo más cerca del centro de la estrella. Devuelve su centro.
 */
export function pullSpot(
  stars: readonly StarBox[],
  lit: number,
  ext: TauExtents,
  clearPx: number,
  minX: number,
  maxX: number,
  minOverlap: number,
): { x: number; y: number } {
  const star = stars[lit];
  const cx = (star.left + star.right) / 2;
  const lo = Math.max(minX + ext.halfW, star.left + minOverlap - ext.halfW);
  const hi = Math.min(maxX - ext.halfW, star.right - minOverlap + ext.halfW);
  let bestX = Math.max(lo, Math.min(hi, cx));
  let best = lowestBottom(stars, bestX, ext.halfW, clearPx);
  for (let x = Math.ceil(lo); x <= hi; x++) {
    const bottom = lowestBottom(stars, x, ext.halfW, clearPx);
    if (bottom > best || (bottom === best && Math.abs(x - cx) < Math.abs(bestX - cx))) {
      best = bottom;
      bestX = x;
    }
  }
  return { x: bestX, y: best - ext.below };
}
