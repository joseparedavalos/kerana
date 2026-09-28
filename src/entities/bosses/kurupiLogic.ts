// Lógica pura de Kurupi (GDD §6.5): sin Phaser, con tests.

export type MinionKind = 'kuati' | 'kai';

export interface CallPlan {
  kind: MinionKind;
  count: number;
}

/** Llamado de la selva: 2 kuati o, con probabilidad `kaiChance`, 1 ka'i. */
export function callPlan(roll: number, kaiChance: number, kuatiCount: number, out: CallPlan): CallPlan {
  if (roll < kaiChance) {
    out.kind = 'kai';
    out.count = 1;
  } else {
    out.kind = 'kuati';
    out.count = kuatiCount;
  }
  return out;
}

/**
 * Pies al revés [licencia creativa]: mira hacia `facing` y corre hacia el otro lado.
 * En la carrera normal (fase 1) corre hacia donde mira.
 */
export function runDirection(facing: 1 | -1, reversed: boolean): 1 | -1 {
  return reversed ? (-facing as 1 | -1) : facing;
}

/** Hacia dónde apuntan los dedos de la huella: al revés de la carrera si los pies están invertidos. */
export function toeSide(runDir: 1 | -1, reversed: boolean): 1 | -1 {
  return reversed ? (-runDir as 1 | -1) : runDir;
}

/** Hasta dónde corre en la dirección `dir`: `distance` px (Infinity = hasta el borde), sin salir de [left, right]. */
export function runTargetX(fromX: number, dir: 1 | -1, distance: number, left: number, right: number): number {
  const x = fromX + dir * distance;
  return Math.min(right, Math.max(left, x));
}

/** Engaño (fase 3): en cuál de los `slots` lugares está el verdadero. `roll` en [0, 1). */
export function pickRealSlot(roll: number, slots: number): number {
  return Math.min(slots - 1, Math.floor(roll * slots));
}
