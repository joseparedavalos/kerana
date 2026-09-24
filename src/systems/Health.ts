// Vida de Kerana: lógica pura (GDD §3.6), sin Phaser, para poder probarla.

export class Health {
  current: number;
  max: number;
  private invulnerableLeftMs = 0;

  constructor(start: number, max: number) {
    this.max = max;
    this.current = start;
  }

  get isDead(): boolean {
    return this.current <= 0;
  }

  get isInvulnerable(): boolean {
    return this.invulnerableLeftMs > 0;
  }

  /** Avanza el temporizador de invulnerabilidad. */
  tick(dtMs: number): void {
    this.invulnerableLeftMs = Math.max(0, this.invulnerableLeftMs - dtMs);
  }

  /** Quita `amount` corazones y activa la invulnerabilidad. Devuelve si se aplicó. */
  damage(amount: number, invulnerableMs: number): boolean {
    if (this.isInvulnerable || this.isDead) return false;
    this.current = Math.max(0, this.current - amount);
    this.invulnerableLeftMs = invulnerableMs;
    return true;
  }

  /** Cura hasta `max`. Devuelve cuánto se curó de verdad. */
  heal(amount: number): number {
    const before = this.current;
    this.current = Math.min(this.max, this.current + amount);
    return this.current - before;
  }

  /** Reaparición: vida completa, sin invulnerabilidad. */
  reset(to: number = this.max): void {
    this.current = to;
    this.invulnerableLeftMs = 0;
  }
}
