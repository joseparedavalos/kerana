/** Rectángulo mínimo (compatible con Phaser.Geom.Rectangle) para que la lógica sea pura. */
export interface SpanRect {
  readonly left: number;
  readonly right: number;
  /** S92: con el borde de arriba (Kerana) y el de abajo (la arena), no se cierra con Kerana por debajo de la arena. */
  readonly top?: number;
  readonly bottom?: number;
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
    // S92: en un nivel que sube (Yvága), Kerana pasa por debajo de la arena, en sus mismas columnas: ahí está afuera.
    // En los niveles horizontales la arena llega al suelo y nunca se está por debajo: no cambia nada.
    const below = player.top !== undefined && this.arena.bottom !== undefined && player.top >= this.arena.bottom;
    if (player.right <= this.arena.left || below) this.armed = true;
    return this.armed && !below && player.left >= this.arena.left + this.enterMargin && player.right <= this.arena.right;
  }

  lock(): void {
    this.locked = true;
  }

  unlock(): void {
    this.locked = false;
    this.armed = false;
  }
}
