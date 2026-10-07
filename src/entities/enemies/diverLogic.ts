// Trayectoria de la picada del ñakurutu y del karakara (S24): lógica pura, sin Phaser.
//
// Jose vio un ñakurutu parado en una columna con un muro delante, sin hacer nada. Desde S23 la picada no choca con el
// suelo en su primera mitad (si no, el primer paso la apoyaba en su poste y terminaba ahí), así que con un muro en el
// medio la picada lo atravesaba o se frenaba contra él. Ahora el Diver solo avisa y se lanza si la caja de su cuerpo
// recorre libre todo el camino hasta Kerana; si no, espera en su lugar a tenerlo. Solo cruza su percha: la cara de
// arriba del poste o la rama donde está parado (el karakara espera en el aire y no tiene).

/** Rectángulo en px. */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** ¿Hay algo que frene la picada en (x, y) (px)? Suelo, rompibles sin romper y plataformas. */
export type SolidAt = (x: number, y: number) => boolean;

/**
 * Percha del Diver: la fila de tiles justo debajo de sus pies, si la hay, en el tramo continuo que toca su cuerpo
 * (la cara de arriba del poste, de la rama o de la penca). La picada sale atravesándola.
 */
export function findPerch(feetX: number, feetY: number, halfW: number, tile: number, solidAt: SolidAt): Box | undefined {
  const row = Math.floor((feetY + 1) / tile);
  const solid = (tx: number) => solidAt(tx * tile + tile / 2, row * tile + tile / 2);
  let x0 = Math.floor((feetX - halfW + 1) / tile);
  let x1 = Math.floor((feetX + halfW - 1) / tile);
  while (x0 <= x1 && !solid(x0)) x0++;
  while (x1 >= x0 && !solid(x1)) x1--;
  if (x0 > x1) return undefined;
  while (solid(x0 - 1)) x0--;
  while (solid(x1 + 1)) x1++;
  return { x: x0 * tile, y: row * tile, w: (x1 - x0 + 1) * tile, h: tile };
}

/** Separación máxima (px) entre los puntos que se miran en el borde de la caja: un tile de 16 no pasa entre dos. */
const EDGE_STEP_PX = 8;

/**
 * ¿La picada tiene el camino libre? Lleva la caja del cuerpo (medio ancho y medio alto en px) desde su centro hasta
 * el destino, cada `stepPx`, y mira su borde (1 px adentro): nada sólido, salvo la percha.
 */
export function divePathClear(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  halfW: number,
  halfH: number,
  solidAt: SolidAt,
  perch?: Box,
  stepPx = 4,
): boolean {
  const steps = Math.max(1, Math.ceil(Math.hypot(toX - fromX, toY - fromY) / stepPx));
  const hw = halfW - 1;
  const hh = halfH - 1;
  const nx = Math.max(1, Math.ceil((2 * hw) / EDGE_STEP_PX));
  const ny = Math.max(1, Math.ceil((2 * hh) / EDGE_STEP_PX));
  const blocked = (x: number, y: number) =>
    solidAt(x, y) && !(perch && x >= perch.x && x < perch.x + perch.w && y >= perch.y && y < perch.y + perch.h);
  for (let i = 0; i <= steps; i++) {
    const cx = fromX + ((toX - fromX) * i) / steps;
    const cy = fromY + ((toY - fromY) * i) / steps;
    for (let k = 0; k <= nx; k++) {
      const x = cx - hw + (2 * hw * k) / nx;
      if (blocked(x, cy - hh) || blocked(x, cy + hh)) return false;
    }
    for (let k = 1; k < ny; k++) {
      const y = cy - hh + (2 * hh * k) / ny;
      if (blocked(cx - hw, y) || blocked(cx + hw, y)) return false;
    }
  }
  return true;
}
