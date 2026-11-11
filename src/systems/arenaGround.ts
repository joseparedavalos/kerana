// S91: el punto de regreso (safeGround) mientras una arena de jefe está trabada. Lógica pura: columnas y filas de tiles.

export interface ArenaBox {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface ArenaCells {
  /** Celda de suelo firme (capa Ground). */
  ground: (col: number, row: number) => boolean;
  /** Celda donde no se puede reaparecer: peligro, agua o sólido (los pies tienen que quedar en el aire). */
  blocked: (col: number, row: number) => boolean;
}

/**
 * La entrada de la arena: el primer suelo firme desde la izquierda (la pared está en la primera columna), a partir de
 * `fromTiles` tiles del borde, con la columna y sus dos vecinas en suelo a la misma altura y libres por encima (lo mismo
 * que pide `trackSafeGround`). Devuelve los pies en unidades del mundo, o null si la arena no tiene ninguno.
 */
export function arenaEntry(box: ArenaBox, tile: number, cells: ArenaCells, fromTiles: number): { x: number; y: number } | null {
  const firstCol = Math.floor(box.left / tile) + fromTiles;
  const lastCol = Math.ceil(box.right / tile) - 2;
  const topRow = Math.floor(box.top / tile);
  const bottomRow = Math.ceil(box.bottom / tile) - 1;
  for (let col = firstCol; col <= lastCol; col++) {
    let row = topRow;
    while (row <= bottomRow && !cells.ground(col, row)) row++;
    if (row > bottomRow || row === topRow) continue;
    let ok = true;
    for (const c of [col - 1, col, col + 1]) {
      if (!cells.ground(c, row) || cells.blocked(c, row - 1) || cells.blocked(c, row - 2)) ok = false;
    }
    if (ok) return { x: (col + 0.5) * tile, y: row * tile };
  }
  return null;
}

/** ¿Este punto de regreso está dentro de la arena, del lado de adentro de la pared (que ocupa el primer tile)? */
export function insideArena(box: ArenaBox, tile: number, x: number, y: number): boolean {
  return x >= box.left + tile && x <= box.right && y > box.top && y <= box.bottom;
}
