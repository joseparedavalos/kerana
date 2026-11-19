import { GAMEPLAY } from '../../config/gameplay';
import { clamp, hash, smoothstep } from '../../systems/pixelArt';

// Portada (S105): tiempos de la entrada, del titilar y de los destellos. Lógica pura (los tests no necesitan Phaser).
const LOOK = GAMEPLAY.titleLook;
const TAU = Math.PI * 2;

export interface IntroPose {
  /** Negro de la entrada (1: tapa el fondo). */
  black: number;
  /** Por estrella de Eichu: -1 apagada; 0..1 mientras se enciende; 1 ya encendida. */
  stars: number[];
  /** Alfa de lo que está sobre el fondo (bruma, Kerana, Mainumby). */
  world: number;
  logo: number;
  sub: number;
  menu: number;
}

const ramp = (t: number, [a, b]: readonly number[]): number => smoothstep(a, b, t);

/** Cómo está la portada a los `t` ms de la entrada (de `totalMs` en adelante, todo listo). */
export function introPose(t: number): IntroPose {
  const I = LOOK.intro;
  const stars = LOOK.eichu.stars.map((_, i) => {
    const s = (t - (I.starStartMs + i * I.starStepMs)) / I.starPopMs;
    return s < 0 ? -1 : Math.min(1, s);
  });
  const black = 1 - ramp(t, I.blackFade);
  return { black, stars, world: 1 - black, logo: ramp(t, I.logoIn), sub: ramp(t, I.subIn), menu: ramp(t, I.menuIn) };
}

/** Pose final (la entrada salteada o ya terminada). */
export const INTRO_DONE: IntroPose = introPose(LOOK.intro.totalMs);

/** Fase y período de cada estrella (estables). */
export function twinklePhase(i: number): { periodMs: number; phase: number } {
  const [a, b] = LOOK.eichu.periodMs;
  return { periodMs: a + (b - a) * hash(i, 17), phase: hash(i * 3 + 1, 29) * TAU };
}

/**
 * Cuadro (0..último) y alfa del titilar de la estrella `i` a los `t` ms: casi siempre chica y, de a ratos, crece y
 * decrece. `pop` (0..1): la estrella se está encendiendo en la entrada (crece al máximo y vuelve). `calm`: sin destellos.
 */
export function twinkle(i: number, t: number, pop: number, calm: boolean): { frame: number; alpha: number; halo: number } {
  const E = LOOK.eichu;
  const last = LOOK.eichu.arms.length - 1;
  const max = calm ? Math.min(last, LOOK.eichu.calmMaxFrame) : last;
  const { periodMs, phase } = twinklePhase(i);
  const f = 0.5 + 0.5 * Math.sin((TAU * t) / periodMs + phase);
  let size = f * f * f;
  let alpha = E.alpha * (0.6 + 0.4 * f);
  let halo = E.haloRest * (0.5 + 0.5 * size);
  if (pop < 0) return { frame: 0, alpha: 0, halo: 0 };
  if (pop < 1) {
    // Se enciende: sube rápido al máximo, con su halo, y baja a su titilar.
    const up = clamp(pop / 0.3, 0, 1);
    const down = clamp((pop - 0.3) / 0.7, 0, 1);
    size = up * (1 - down) + size * down;
    alpha = E.alpha * up * (1 - down) + alpha * down;
    halo = E.haloAlpha * up * (1 - down) + halo * down;
  }
  return { frame: Math.round(size * max), alpha, halo };
}

/** Espera (ms) antes del evento número `n` de una serie que pasa cada `[a, b]` ms (estable, sin Math.random). */
export function nextGap(range: readonly number[], n: number, seed: number): number {
  const [a, b] = range;
  return a + (b - a) * hash(n + 1, seed);
}

/** Cuadro del destello a `elapsed` ms de empezar (-1: no se ve). */
export function shineFrame(elapsed: number, frames: number): number {
  if (elapsed < 0 || elapsed >= LOOK.shine.durationMs || frames <= 0) return -1;
  return Math.min(frames - 1, Math.floor((elapsed / LOOK.shine.durationMs) * frames));
}

/** El chispazo de la punta del logo empieza cuando la franja ya casi salió. */
const SPARKLE_START = 0.82;

/** Cuánto brilla el chispazo (0..1) a `elapsed` ms de empezar el destello. */
export function sparkleAmount(elapsed: number): number {
  const s = (elapsed - LOOK.shine.durationMs * SPARKLE_START) / LOOK.shine.sparkleMs;
  return s > 0 && s < 1 ? Math.sin(Math.PI * s) : 0;
}

/** Cuándo termina todo un destello (la franja y el chispazo). */
export const SHINE_END_MS = Math.max(LOOK.shine.durationMs, LOOK.shine.durationMs * SPARKLE_START + LOOK.shine.sparkleMs);

export interface ShootingPose {
  x: number;
  y: number;
  alpha: number;
  /** Va hacia la izquierda (el cuadro se espeja). */
  left: boolean;
}

/** Dónde va la estrella fugaz número `n` a `elapsed` ms de salir (null: no se ve). Lejos del logo: en sus cajas. */
export function shootingPose(n: number, elapsed: number): ShootingPose | null {
  const S = LOOK.shootingStar;
  if (elapsed < 0 || elapsed >= S.durationMs) return null;
  const boxes = S.boxes;
  const b = Math.floor(hash(n, 41) * boxes.length) % boxes.length;
  const [bx, by, bw, bh] = boxes[b];
  const left = bx + bw / 2 < 320;
  // Sale de la caja y se aleja del centro, bajando.
  const x0 = bx + bw * (left ? 0.55 + 0.45 * hash(n, 43) : 0.45 * hash(n, 43));
  const y0 = by + bh * 0.6 * hash(n, 47);
  const t = elapsed / S.durationMs;
  const d = S.travel * (1 - (1 - t) * (1 - t));
  const ang = 0.42;
  const alpha = smoothstep(0, 0.15, t) * (1 - smoothstep(0.6, 1, t));
  return { x: x0 + (left ? -1 : 1) * Math.cos(ang) * d, y: y0 + Math.sin(ang) * d, alpha, left };
}
