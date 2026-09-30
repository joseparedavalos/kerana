// Lógica pura del fondo del nivel (sin Phaser): desplazamiento según el avance, encuadre, brillo y tramo de cueva.

/**
 * Desfase horizontal (≤ 0) del fondo fijo a la cámara: 0 al principio del nivel y `-extra * range`
 * al final. `viewX` es el borde izquierdo de la vista; `maxViewX`, el mayor que puede tener.
 */
export function backdropPanX(viewX: number, maxViewX: number, extra: number, range: number): number {
  if (maxViewX <= 0 || extra <= 0) return 0;
  const progress = Math.min(1, Math.max(0, viewX / maxViewX));
  // `|| 0` evita el -0 al principio.
  return -extra * Math.min(1, Math.max(0, range)) * progress || 0;
}

/** Tinte (multiplicador) del fondo: gris según `brightness` (0-1), multiplicado por el ambiente del nivel oscuro. */
export function backdropTint(brightness: number, ambient = 0xffffff): number {
  const k = Math.min(1, Math.max(0, brightness));
  const ch = (shift: number) => Math.round(((ambient >> shift) & 0xff) * k);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

/**
 * Escala (sobre la vista) y borde superior del fondo fijo a la cámara con un ajuste vertical `shiftY`
 * (unidades del mundo; positivo sube la imagen). Si el ajuste destaparía el borde opuesto, agranda la imagen
 * lo justo hacia ese lado (el borde que se corre queda donde el ajuste lo pone).
 */
export function backdropFit(viewHeight: number, overscale: number, shiftY: number): { scale: number; top: number } {
  const base = viewHeight * overscale;
  const margin = (base - viewHeight) / 2;
  if (shiftY >= 0) {
    const top = -margin - shiftY;
    return { scale: Math.max(base, viewHeight - top) / viewHeight, top };
  }
  const bottom = viewHeight + margin - shiftY;
  const height = Math.max(base, bottom);
  return { scale: height / viewHeight, top: bottom - height };
}

/**
 * Tramo horizontal de la vista cubierto por zonas de cueva (ocupan toda la altura), en unidades desde el
 * borde izquierdo de la vista y sin recortar (puede salirse de la vista). Si hay varias a la vista, va de la
 * primera a la última. `null` si ninguna se ve.
 */
export function caveSpan(
  viewX: number,
  viewWidth: number,
  areas: ReadonlyArray<{ x: number; width: number }>,
): { left: number; right: number } | null {
  let left = Infinity;
  let right = -Infinity;
  for (const a of areas) {
    if (a.x + a.width <= viewX || a.x >= viewX + viewWidth) continue;
    left = Math.min(left, a.x - viewX);
    right = Math.max(right, a.x + a.width - viewX);
  }
  return left < right ? { left, right } : null;
}
