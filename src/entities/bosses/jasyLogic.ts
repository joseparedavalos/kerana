// Lógica pura de Jasy Jatere (GDD §6.4), sin Phaser: el golpe final que suelta el bastón,
// la carrera por recuperarlo y el paneo estéreo del silbido.

/**
 * El golpe que lo dejaría en 0 no lo vence: el bastón sale volando y queda con 1 de vida.
 * Devuelve el daño que se aplica y si empieza la carrera por el bastón.
 */
export function lethalClamp(hp: number, damage: number): { applied: number; race: boolean } {
  if (damage < hp) return { applied: damage, race: false };
  return { applied: Math.max(0, hp - 1), race: true };
}

/** Paneo estéreo (-1 izquierda, 1 derecha) de un sonido en `x` según el centro de la vista. */
export function panFor(x: number, viewCenterX: number, viewHalfWidth: number): number {
  if (viewHalfWidth <= 0) return 0;
  return Math.max(-1, Math.min(1, (x - viewCenterX) / viewHalfWidth));
}

export type RaceResult = 'kerana' | 'jasy' | null;

/**
 * Carrera por el bastón: si Kerana lo toca primero, gana la pelea; si pasan `raceMs`, Jasy Jatere
 * lo recupera y vuelve a esconderse.
 */
export class StaffRace {
  private msLeft = 0;
  private running = false;

  get active(): boolean {
    return this.running;
  }

  /** Fracción de la carrera que ya pasó (0 → 1), para mover a Jasy hacia el bastón. */
  progress(raceMs: number): number {
    return raceMs > 0 ? 1 - this.msLeft / raceMs : 1;
  }

  start(raceMs: number): void {
    this.running = true;
    this.msLeft = raceMs;
  }

  /** `keranaTouches`: Kerana toca el bastón en este paso. */
  step(dtMs: number, keranaTouches: boolean): RaceResult {
    if (!this.running) return null;
    if (keranaTouches) {
      this.running = false;
      return 'kerana';
    }
    this.msLeft -= dtMs;
    if (this.msLeft > 0) return null;
    this.running = false;
    return 'jasy';
  }

  reset(): void {
    this.running = false;
    this.msLeft = 0;
  }
}

/** Visible un rato después de cada golpe (fase invisible, GDD §6.4). */
export class Reveal {
  private msLeft = 0;

  get visible(): boolean {
    return this.msLeft > 0;
  }

  show(ms: number): void {
    this.msLeft = Math.max(this.msLeft, ms);
  }

  step(dtMs: number): void {
    this.msLeft = Math.max(0, this.msLeft - dtMs);
  }

  reset(): void {
    this.msLeft = 0;
  }
}
