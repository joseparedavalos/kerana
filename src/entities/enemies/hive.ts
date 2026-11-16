// Dónde va el panal de un enjambre (S99): lógica pura, sin Phaser.

export type SolidAt = (x: number, y: number) => boolean;

/** El panal cuelga por la ramita de un techo (`y` = borde de abajo del techo) o se apoya en el piso (`y` = el piso). */
export interface HivePlacement {
  hang: boolean;
  y: number;
}

/**
 * `x`, `feetY`: el pie del enjambre (el centro abajo del tile donde se colocó). Si hay terreno sólido (`groundAt`) o
 * una plataforma de un sentido (`platformAt`) en alguna de las `rows` filas de arriba, cuelga del más cercano: del
 * borde de abajo del tile sólido, o de `platformLip` unidades bajo el borde de arriba de la plataforma (su dibujo es
 * fino). Si no, se apoya con la base en `feetY`.
 */
export function hivePlacement(
  x: number,
  feetY: number,
  tile: number,
  rows: number,
  groundAt: SolidAt,
  platformAt: SolidAt,
  platformLip: number,
): HivePlacement {
  const row = Math.floor((feetY - 1) / tile);
  for (let k = 1; k <= rows; k++) {
    const y = (row - k) * tile + tile / 2;
    if (groundAt(x, y)) return { hang: true, y: (row - k + 1) * tile };
    if (platformAt(x, y)) return { hang: true, y: (row - k) * tile + platformLip };
  }
  return { hang: false, y: feetY };
}
