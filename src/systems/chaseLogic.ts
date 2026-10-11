// Persecución de Ao Ao (GDD §6.6, S31): lógica pura, sin Phaser, con tests.
//
// Un tramo del nivel (`rect ChaseZone`) donde la cámara avanza sola. El motor lleva el borde izquierdo de la vista
// (`edgeX`, en px del mundo): avanza a `speed` y, si Kerana se adelanta más de `aheadFrac` de la vista, la sigue (así
// siempre ve el camino por delante). Quedarse cerca del borde avisa (`warn`); tocarlo es que Ao Ao la alcanza
// (`caught`: 1 corazón y vuelta al último pindó). Parada en lo alto de un pindó (refugio), el borde se detiene.

export interface ChaseSpec {
  /** Línea de largada y de llegada (px del mundo, centro del cuerpo de Kerana). */
  startX: number;
  endX: number;
  /** Velocidad del borde (px/s). */
  speed: number;
  /** Ancho de la vista (px del mundo). */
  viewWidth: number;
  /** Hasta qué fracción de la vista puede adelantarse Kerana antes de arrastrar el borde. */
  aheadFrac: number;
  /** Distancia al borde (px, desde el lado izquierdo del cuerpo) a la que Ao Ao avisa. */
  warnPx: number;
  /** Distancia al borde (px) a la que la alcanza (0 = cuando el cuerpo toca el borde). */
  catchPx: number;
  /** Al volver a un pindó, el borde queda esta distancia detrás de él (px). */
  restartLeadPx: number;
  /** Límite derecho del borde (ancho del mapa − vista). */
  maxEdgeX: number;
}

/** idle: todavía no empezó (o se reinició) · running: el borde avanza · refuge: Kerana en un pindó · done: terminó. */
export type ChasePhase = 'idle' | 'running' | 'refuge' | 'done';

/** Lo que pasó en este paso. */
export type ChaseEvent = 'started' | 'caught' | 'ended' | null;

export class ChaseMotor {
  phase: ChasePhase = 'idle';
  /** Borde izquierdo de la vista (px del mundo). */
  edgeX = 0;
  /** Kerana está en la franja de aviso. */
  warn = false;
  /** Distancia del lado izquierdo de Kerana al borde (px) en el último paso. */
  gapPx = Infinity;
  /** Último pindó del tramo en el que estuvo (su centro en x), o null si todavía ninguno. */
  lastRefugeX: number | null = null;

  constructor(readonly spec: ChaseSpec) {}

  get active(): boolean {
    return this.phase === 'running' || this.phase === 'refuge';
  }

  /**
   * Un paso. `viewX`: borde izquierdo actual de la cámara (solo se usa al largar, así no salta). `left` y `centerX`:
   * cuerpo de Kerana. `refugeX`: centro del pindó en el que está parada, o null.
   */
  step(dtMs: number, viewX: number, left: number, centerX: number, refugeX: number | null): ChaseEvent {
    const s = this.spec;
    switch (this.phase) {
      case 'done':
        return null;
      case 'idle':
        if (centerX < s.startX || centerX >= s.endX) return null;
        this.phase = 'running';
        this.edgeX = Math.min(Math.max(0, viewX), s.maxEdgeX);
        this.lastRefugeX = null;
        this.warn = false;
        return 'started';
      default:
        break;
    }
    if (centerX >= s.endX) {
      this.phase = 'done';
      this.warn = false;
      return 'ended';
    }
    if (refugeX !== null) {
      this.phase = 'refuge';
      this.lastRefugeX = refugeX;
      this.warn = false;
      return null;
    }
    this.phase = 'running';
    this.edgeX += (s.speed * dtMs) / 1000;
    // Kerana adelantada: el borde la sigue (nunca retrocede).
    this.edgeX = Math.max(this.edgeX, centerX - s.viewWidth * s.aheadFrac);
    this.edgeX = Math.min(this.edgeX, s.maxEdgeX);
    const gap = left - this.edgeX;
    this.gapPx = gap;
    this.warn = gap < s.warnPx;
    if (gap < s.catchPx) {
      this.warn = false;
      return 'caught';
    }
    return null;
  }

  /**
   * Después de que la alcanza o de una caída dentro del tramo: si ya pasó por un pindó, vuelve a él con el borde
   * `restartLeadPx` detrás (y queda en refugio hasta que se baje); si no, la persecución se reinicia entera (idle).
   * Devuelve la x a la que vuelve Kerana, o null si vuelve a la largada (la elige la escena).
   */
  restart(): number | null {
    this.warn = false;
    if (this.lastRefugeX === null) {
      this.phase = 'idle';
      return null;
    }
    this.phase = 'refuge';
    this.edgeX = Math.min(Math.max(0, this.lastRefugeX - this.spec.restartLeadPx), this.spec.maxEdgeX);
    return this.lastRefugeX;
  }

  /** Kerana cayó (0 corazones) o volvió al fuego: si no terminó, la persecución vuelve a empezar desde la largada. */
  reset(): void {
    if (this.phase === 'done') return;
    this.phase = 'idle';
    this.warn = false;
    this.lastRefugeX = null;
  }
}
