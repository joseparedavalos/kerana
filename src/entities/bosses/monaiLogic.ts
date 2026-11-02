import { GAMEPLAY } from '../../config/gameplay';
import type { Box } from '../slashRect';

// Lógica pura de Moñái (GDD §6.3), sin Phaser: el corazón robado, los troncos que bloquean la hipnosis y dónde recibe
// el tajo (S65).

const CFG = GAMEPLAY.monai;

/** Qué parte de Moñái expone la ventana: ninguna, la cabeza aturdida (descenso, pulso) o la cola (robo). */
export type MonaiExposed = 'none' | 'body' | 'tail';

/**
 * Qué partes reciben el tajo según la ventana (S66). La cabeza vale en toda ventana abierta (en la del robo, según
 * `headInTailWindow`); la cola, solo en la del robo.
 */
export function strikeTargets(exposed: MonaiExposed, vulnerable: boolean, headInTailWindow: boolean = CFG.headInTailWindow): { head: boolean; tail: boolean } {
  if (!vulnerable || exposed === 'none') return { head: false, tail: false };
  if (exposed === 'body') return { head: true, tail: false };
  return { head: headInTailWindow, tail: true };
}

/** Altura del centro de la cabeza apoyada en el suelo (aturdida, el pulso, el final del robo). */
export function groundHeadY(floorY: number): number {
  return floorY - CFG.headHeight / 2;
}

/** Altura de los segmentos que se apoyan en el suelo (la cola en la ventana del robo). */
export function restingSegmentY(floorY: number): number {
  return floorY - CFG.segmentRadius / 2;
}

/**
 * Zona que recibe el tajo (S65): la caja de la cabeza (o de la cola) centrada en (x, y), crecida `strikeRise` hacia
 * arriba hasta la altura del tajo de Kerana. Solo para recibir golpes: la que lastima a Kerana es la caja sin crecer.
 */
export function strikeZone(part: 'head' | 'tail', x: number, y: number, out: Box): Box {
  const w = part === 'head' ? CFG.headWidth : CFG.tailWidth;
  const h = part === 'head' ? CFG.headHeight : CFG.tailHeight;
  out.x = x - w / 2;
  out.y = y - h / 2 - CFG.strikeRise;
  out.width = w;
  out.height = h + CFG.strikeRise;
  return out;
}

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
