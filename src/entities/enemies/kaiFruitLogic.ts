// Lógica pura de la fruta del ka'i (S115): el giro, la semilla que rebota y dónde cae. Sin Phaser.

/** Cuadro del giro según cuánto lleva volando; `dir` 1 gira a la derecha (horario), -1 al revés. */
export function spinFrame(ageMs: number, fps: number, frames: number, dir: 1 | -1): number {
  const n = Math.floor((Math.max(0, ageMs) / 1000) * fps);
  const i = n % frames;
  return dir === 1 ? i : (frames - i) % frames;
}

/**
 * ¿La fruta cayó al piso? Solo después de pasar el blanco (`ageMs >= flightMs`): antes sigue su arco de siempre aunque
 * roce una rama, así no cambia a quién le pega. El terreno macizo la frena siempre; una plataforma de un sentido, solo
 * si viene bajando y venía de arriba del tile.
 */
export function landed(
  ageMs: number,
  flightMs: number,
  vy: number,
  prevY: number,
  y: number,
  tile: number,
  ground: boolean,
  platform: boolean,
): boolean {
  if (ageMs < flightMs) return false;
  if (ground) return true;
  return platform && vy > 0 && prevY <= Math.floor(y / tile) * tile;
}

/**
 * El primer piso (y del borde de arriba) bajo (x, fromY), hasta `maxDrop` px; si no hay, undefined. Si (x, fromY) ya
 * está dentro de un tile sólido (la fruta cayó al piso), es el borde de ese tile.
 */
export function floorBelow(
  x: number,
  fromY: number,
  maxDrop: number,
  tile: number,
  solidAt: (x: number, y: number) => boolean,
): number | undefined {
  const end = Math.floor((fromY + maxDrop) / tile);
  for (let row = Math.floor(fromY / tile); row <= end; row++) {
    if (solidAt(x, row * tile + tile / 2)) return row * tile;
  }
  return undefined;
}

export interface Seed {
  x: number;
  y: number;
  vx: number;
  vy: number;
  ageMs: number;
  lifeMs: number;
  floorY: number;
  bounces: number;
}

export interface SeedConfig {
  gravity: number;
  restitution: number;
  friction: number;
  /** Rebote más lento que esto: se queda quieta en el piso. */
  restSpeed: number;
}

/** Un paso de la semilla: cae, rebota en el piso con `restitution` y frena con `friction`. Devuelve si rebotó. */
export function stepSeed(s: Seed, dtMs: number, cfg: SeedConfig): boolean {
  const dt = dtMs / 1000;
  s.ageMs += dtMs;
  s.vy += cfg.gravity * dt;
  s.x += s.vx * dt;
  s.y += s.vy * dt;
  if (s.y < s.floorY || s.vy <= 0) return false;
  s.y = s.floorY;
  const up = s.vy * cfg.restitution;
  s.vx *= cfg.friction;
  if (up < cfg.restSpeed) {
    s.vy = 0;
    s.vx = 0;
    return false;
  }
  s.vy = -up;
  s.bounces++;
  return true;
}

/** Alfa de la semilla: entera y, en el último `fadeMs`, se apaga en `steps` escalones. */
export function seedAlpha(ageMs: number, lifeMs: number, fadeMs: number, steps: number): number {
  const left = lifeMs - ageMs;
  if (left <= 0) return 0;
  if (left >= fadeMs) return 1;
  return Math.ceil((left / fadeMs) * steps) / (steps + 1);
}
