// La onda del pisotón de Kurupi (S114): cómo avanza (lo mismo que antes de S114: velocidad, vida y bordes de la arena),
// su hitbox y cuándo se cierran las grietas que deja. Lógica pura, sin Phaser.

/** Lo que mueve una onda: su centro (x), la velocidad (px/s, con signo) y la vida que le queda (ms; 0 = apagada). */
export interface WaveMotion {
  x: number;
  vx: number;
  lifeMs: number;
}

/**
 * Avanza la onda un cuadro. Se apaga al acabarse la vida o al salir de la arena (`left` a `right`). Devuelve si sigue
 * viva. Es la cuenta del rectángulo de antes de S114, en el mismo orden.
 */
export function stepWave(w: WaveMotion, deltaMs: number, left: number, right: number): boolean {
  if (w.lifeMs <= 0) return false;
  w.lifeMs -= deltaMs;
  w.x += w.vx * (deltaMs / 1000);
  if (w.lifeMs <= 0 || w.x < left || w.x > right) {
    w.lifeMs = 0;
    return false;
  }
  return true;
}

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** La hitbox de la onda: `width` × `height` con la base en el suelo y centrada en x (la del rectángulo de antes). */
export function waveBox(x: number, floorY: number, width: number, height: number, out: Box): Box {
  out.x = x - width / 2;
  out.y = floorY - height;
  out.width = width;
  out.height = height;
  return out;
}

/** El paso en que está una grieta de `ageMs` (0 abierta, 1 se cierra, 2 casi borrada) o -1 si ya se apagó. */
export function crackStage(ageMs: number, stagesMs: readonly number[]): number {
  let t = 0;
  for (let i = 0; i < stagesMs.length; i++) {
    t += stagesMs[i];
    if (ageMs < t) return i;
  }
  return -1;
}

/** El cuadro de una animación en bucle de `frames` cuadros a `fps`, a los `ms` de empezada. */
export function loopFrame(ms: number, fps: number, frames: number): number {
  return Math.floor((Math.max(0, ms) * fps) / 1000) % frames;
}
