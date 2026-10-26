import { PLATFORM_TILES } from '../assets/manifest';

/**
 * Casillas del tileset para una plataforma de `widthPx` (S57): la izquierda, la del medio repetida
 * y la derecha. Una de un solo tile usa la del medio.
 */
export function platformPieces(widthPx: number, tile: number): number[] {
  const n = Math.max(1, Math.round(widthPx / tile));
  if (n === 1) return [PLATFORM_TILES.center];
  return Array.from({ length: n }, (_, i) => (i === 0 ? PLATFORM_TILES.left : i === n - 1 ? PLATFORM_TILES.right : PLATFORM_TILES.center));
}
