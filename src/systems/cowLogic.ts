// Lógica pura de las vacas (sin Phaser).

/**
 * Patrulla de una vaca que aparece donde se purificó la vaca embrujada (S29). La vaca no tiene gravedad ni choca con
 * el terreno: va y viene `patrol` a cada lado del centro. Si el centro queda cerca de un borde, la patrulla se sale del
 * piso y la vaca camina en el aire. Se corre el centro lo mínimo para que todo el recorrido (con el ancho de la vaca,
 * `halfWidth` a cada lado) quede sobre el tramo de piso continuo bajo `x`; si el tramo es más corto que el recorrido,
 * la vaca va al medio del tramo y la patrulla se acorta a lo que entra. `floorAt(col)`: hay piso pisable en esa
 * columna (sólido a la altura de los pies y sin pared ni fardo encima). Si bajo `x` no hay piso, no cambia nada.
 */
export function cowPatrol(
  x: number,
  halfWidth: number,
  patrol: number,
  tile: number,
  floorAt: (col: number) => boolean,
): { x: number; patrol: number } {
  const col = Math.floor(x / tile);
  if (!floorAt(col)) return { x, patrol };
  let l = col;
  let r = col;
  while (floorAt(l - 1)) l--;
  while (floorAt(r + 1)) r++;
  const left = l * tile;
  const right = (r + 1) * tile;
  const min = left + patrol + halfWidth;
  const max = right - patrol - halfWidth;
  if (min > max) return { x: (left + right) / 2, patrol: Math.max(0, (right - left) / 2 - halfWidth) };
  return { x: Math.min(max, Math.max(min, x)), patrol };
}
