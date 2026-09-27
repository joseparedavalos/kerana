// Lógica pura de Moñái (GDD §6.3), sin Phaser: el corazón robado y los troncos que bloquean la hipnosis.

/** Tronco de un árbol de la arena: centro en x, medio ancho y altura de la copa (y de su borde superior). */
export interface Trunk {
  x: number;
  halfWidth: number;
  topY: number;
}

/**
 * ¿Un tronco tapa el pulso de hipnosis? Moñái lo lanza desde el suelo: si hay un tronco entre él y Kerana
 * y Kerana está por debajo de la copa (detrás del tronco), el pulso no la alcanza.
 */
export function pulseBlocked(sourceX: number, playerX: number, playerFeetY: number, trunks: readonly Trunk[]): boolean {
  const lo = Math.min(sourceX, playerX);
  const hi = Math.max(sourceX, playerX);
  for (const trunk of trunks) {
    if (playerFeetY <= trunk.topY) continue;
    if (trunk.x + trunk.halfWidth > lo && trunk.x - trunk.halfWidth < hi) return true;
  }
  return false;
}

/**
 * Robo del corazón (fase 3): la embestida que acierta se lleva un corazón y lo guarda en la cola
 * (uno a la vez). Golpear la cola lo devuelve.
 */
export class HeartThief {
  private held = false;

  get holding(): boolean {
    return this.held;
  }

  /**
   * La embestida tocó a Kerana. `hit` aplica 1 de daño y devuelve true si se aplicó y Kerana sigue en pie.
   * Devuelve true si el corazón quedó en la cola.
   */
  steal(hit: () => boolean): boolean {
    if (!hit() || this.held) return false;
    this.held = true;
    return true;
  }

  /** Golpe en la cola: devuelve el corazón (llama a `heal(1)`). True si había uno. */
  recover(heal: (amount: number) => void): boolean {
    if (!this.held) return false;
    this.held = false;
    heal(1);
    return true;
  }

  /** La pelea se reinicia (Kerana cayó y vuelve con vida completa): el corazón se pierde. */
  reset(): void {
    this.held = false;
  }
}
