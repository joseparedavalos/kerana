// El paso de la ofrenda (S36): lógica pura, sin Phaser.
//
// La entrada a la antesala está cerrada hasta llevar las tres chipas del nivel. Al llegar con las tres, Kerana las
// entrega y el paso se abre. Sin las tres, Mainumby dice cuántas lleva; la puerta no encierra ni devuelve al mapa:
// se puede volver atrás caminando o, desde la pausa, reaparecer donde empieza el tramo de la primera que falta.
// Si el hijo de ese nivel ya está libre (se jugó antes de S36 o ya se entregó la ofrenda), el paso está abierto.

export type OfferingState = 'closed' | 'offering' | 'open';
/** Lo que pasó este cuadro: llegó a la puerta cerrada por primera vez, empezó la ofrenda o se abrió. */
export type OfferingEvent = 'none' | 'reached' | 'offer' | 'opened';

export class OfferingMotor {
  private current: OfferingState;
  private ms = 0;
  /** Kerana llegó a la puerta cerrada al menos una vez: desde ahí la pausa ofrece volver a buscar chipas. */
  reached = false;

  constructor(open: boolean) {
    this.current = open ? 'open' : 'closed';
  }

  get state(): OfferingState {
    return this.current;
  }

  /** Mientras dura la ofrenda la puerta sigue cerrada: se abre al terminar. */
  get blocks(): boolean {
    return this.current !== 'open';
  }

  /** `near`: Kerana está frente a la puerta. `carried`: chipas del nivel que lleva. */
  step(dtMs: number, near: boolean, carried: number, needed: number, offerMs: number): OfferingEvent {
    if (this.current === 'open') return 'none';
    if (this.current === 'offering') {
      this.ms += dtMs;
      if (this.ms < offerMs) return 'none';
      this.current = 'open';
      return 'opened';
    }
    if (!near) return 'none';
    if (carried >= needed) {
      this.current = 'offering';
      this.ms = 0;
      return 'offer';
    }
    if (this.reached) return 'none';
    this.reached = true;
    return 'reached';
  }
}

/** ¿El paso empieza abierto? Sí si el hijo del nivel ya está libre. */
export function offeringStartsOpen(boss: string | null | undefined, freed: readonly string[]): boolean {
  return boss != null && freed.includes(boss);
}

/** Dónde se reaparece para buscar una chipa (pies, en px): el fuego o el inicio de su tramo. */
export interface ChipaReturnPoint {
  chipa: number;
  x: number;
  y: number;
}

/** La primera chipa que falta, en el orden del recorrido (el de la lista de puntos); null si no falta ninguna. */
export function chipaReturnTarget(points: readonly ChipaReturnPoint[], collected: readonly boolean[]): ChipaReturnPoint | null {
  return points.find((p) => collected[p.chipa] !== true) ?? null;
}

/** La pausa ofrece "Volver a buscar chipas" con la puerta cerrada, ya alcanzada, y alguna chipa por buscar. */
export function canReturnForChipas(motor: OfferingMotor, target: ChipaReturnPoint | null): boolean {
  return motor.reached && motor.state === 'closed' && target !== null;
}

/** Clave del texto de Mainumby frente a la puerta. */
export function offeringLineKey(state: OfferingState, carried: number): string {
  if (state !== 'closed') return 'offering.open';
  return carried === 0 ? 'offering.closed_none' : 'offering.closed';
}
