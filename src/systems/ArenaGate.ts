/** Rectángulo mínimo (compatible con Phaser.Geom.Rectangle) para que la lógica sea pura. */
export interface SpanRect {
  readonly left: number;
  readonly right: number;
}

// Cuándo se cierra la arena del jefe (lógica pura, con tests).
// Tras reabrirla (Kerana cayó), no vuelve a cerrarse hasta que Kerana haya estado afuera:
// así un rectángulo viejo del mismo frame no la encierra de nuevo desde la antesala.
export class ArenaGate {
  locked = false;
  private armed = true;

  constructor(
    private readonly arena: SpanRect,
    private readonly enterMargin: number,
  ) {}

  /** Llamar cada frame antes de cerrar; devuelve true si Kerana ya está bien adentro. */
  shouldLock(player: SpanRect): boolean {
    if (this.locked) return false;
    if (player.right <= this.arena.left) this.armed = true;
    return this.armed && player.left >= this.arena.left + this.enterMargin && player.right <= this.arena.right;
  }

  lock(): void {
    this.locked = true;
  }

  unlock(): void {
    this.locked = false;
    this.armed = false;
  }
}
