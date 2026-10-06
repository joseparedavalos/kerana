// Medidor del rebote del hongo: lógica pura, sin Phaser. Registra la altura máxima que alcanza
// Kerana después de un rebote (desde los pies al rebotar hasta el punto más alto), medida dentro
// del juego en cada paso: la prueba de humo la lee en vez de muestrear la posición desde afuera.

export class BounceMeter {
  /** Altura (px) del último rebote terminado; 0 si todavía no hubo ninguno. */
  lastHeight = 0;
  /** Rebotes terminados (llegaron a la cima). */
  count = 0;
  private measuring = false;
  private startY = 0;
  private topY = 0;

  /** Rebote: empieza a medir desde los pies (`feetY`). */
  start(feetY: number): void {
    this.measuring = true;
    this.startY = feetY;
    this.topY = feetY;
  }

  /** Un paso: `feetY` actual y velocidad vertical (negativa = sube). Cierra la medida al dejar de subir. */
  sample(feetY: number, vy: number): void {
    if (!this.measuring) return;
    if (feetY < this.topY) this.topY = feetY;
    // Recién lanzada todavía puede no tener la velocidad aplicada: espera a haber subido algo.
    if (vy >= 0 && this.topY < this.startY) {
      this.measuring = false;
      this.lastHeight = this.startY - this.topY;
      this.count++;
    }
  }

  reset(): void {
    this.measuring = false;
    this.lastHeight = 0;
    this.count = 0;
  }
}
