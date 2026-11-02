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

/** Medidas del dibujo de un árbol, en fracciones del frame sin espejar (`GAMEPLAY.monai.treeArt`). */
export interface TreeArtSpec {
  trunkCenterX: number;
  trunkHalfWidth: number;
  trunkTopY: number;
  trunkBottomY: number;
}

/** Dónde queda un árbol del atlas y su tronco recto, en unidades del mundo. */
export interface ArtTreeLayout {
  /** Centro del dibujo (para que el tronco caiga en `trunkX`). */
  imageX: number;
  /** Pie del dibujo (el suelo más el hundido). */
  baseY: number;
  halfWidth: number;
  crownTopY: number;
  trunkTopY: number;
  trunkBottomY: number;
}

/**
 * S67: coloca un árbol de `width` × `height` unidades (ya escalado), hundido `sink`, con el tronco en `trunkX`. Si va
 * espejado, el centro del tronco pasa al otro lado del centro del dibujo.
 */
export function artTreeLayout(trunkX: number, floorY: number, width: number, height: number, sink: number, flip: boolean, art: TreeArtSpec): ArtTreeLayout {
  const off = (art.trunkCenterX - 0.5) * width;
  const baseY = floorY + sink;
  const yAt = (f: number) => baseY - height * (1 - f);
  return {
    imageX: trunkX - (flip ? -off : off),
    baseY,
    halfWidth: art.trunkHalfWidth * width,
    crownTopY: yAt(0),
    trunkTopY: yAt(art.trunkTopY),
    trunkBottomY: yAt(art.trunkBottomY),
  };
}

/** Enroscado en un tronco: segmentos del cuello, alto de la primera vuelta, bajada y ángulo por segmento, radio. */
export interface CoilPlan {
  neck: number;
  top: number;
  pitch: number;
  step: number;
  radius: number;
}

/** Ángulo entre segmentos de la hélice para que la cuerda entre ellos mida `gap`. */
export function coilStep(gap: number, pitch: number, radius: number): number {
  const chord = Math.sqrt(Math.max(0, gap ** 2 - pitch ** 2));
  return 2 * Math.asin(Math.min(1, chord / (2 * radius)));
}

/**
 * S67: enroscado sobre el tronco recto (de `top` a `bottom`) con la cabeza posada más arriba. El cuello lleva los
 * segmentos que hacen falta para llegar de la nuca a la primera vuelta sin estirar la cuerda (nunca menos de `minNeck`);
 * los que sobran se reparten en vueltas entre `top` y `bottom`.
 */
export function coilPlan(
  neckY: number,
  top: number,
  bottom: number,
  radius: number,
  neckReach: number,
  segments: number,
  gap: number,
  minNeck: number,
): CoilPlan {
  const len = Math.hypot(Math.max(neckReach, radius), top - neckY);
  const neck = Math.min(segments - 2, Math.max(minNeck, Math.ceil(len / gap) - 1));
  const coils = segments - neck;
  const pitch = Math.min(gap * 0.9, Math.max(0, bottom - top) / (coils - 1));
  return { neck, top, pitch, step: coilStep(gap, pitch, radius), radius };
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
