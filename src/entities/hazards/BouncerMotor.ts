// Hongo que rebota (GDD §6.5): lógica pura de sus variantes, sin Phaser.
// - `normal`: rebota siempre.
// - `once` (de un solo uso): se desinfla al rebotar y vuelve a inflarse a los `respawnMs`
//   (como la rama de `CrumbleMotor`: un estado con cuenta regresiva y reaparición).
// - `sleep` (dormido): no rebota hasta recibir un tajo cargado; después queda activo
//   (como la roca agrietada de `Breakable`, que solo cede al tajo cargado).

export type BouncerKind = 'normal' | 'once' | 'sleep';
export type BouncerState = 'ready' | 'deflated' | 'asleep';

export function parseBouncerKind(raw: unknown): BouncerKind {
  return raw === 'once' || raw === 'sleep' ? raw : 'normal';
}

export class BouncerMotor {
  state: BouncerState = 'ready';
  /** Desinflado: ms hasta volver. */
  msLeft = 0;

  constructor(
    readonly kind: BouncerKind,
    private readonly respawnMs: number,
  ) {
    this.reset();
  }

  get canBounce(): boolean {
    return this.state === 'ready';
  }

  /** Kerana rebotó: el de un solo uso se desinfla. */
  bounced(): void {
    if (this.kind !== 'once' || this.state !== 'ready') return;
    this.state = 'deflated';
    this.msLeft = this.respawnMs;
  }

  /** Tajo sobre el hongo (`charged`: tajo cargado u onda). Devuelve true si lo despertó. */
  struck(charged: boolean): boolean {
    if (this.state !== 'asleep' || !charged) return false;
    this.state = 'ready';
    return true;
  }

  step(dtMs: number): BouncerState {
    if (this.state === 'deflated') {
      this.msLeft -= dtMs;
      if (this.msLeft <= 0) {
        this.msLeft = 0;
        this.state = 'ready';
      }
    }
    return this.state;
  }

  reset(): void {
    this.state = this.kind === 'sleep' ? 'asleep' : 'ready';
    this.msLeft = 0;
  }
}
