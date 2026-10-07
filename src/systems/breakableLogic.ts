// Lógica pura de los rompibles (S22): sin Phaser.

/** Rectángulo en px (o en tiles) con su clase: solo se agrupan los de la misma clase. */
export interface BreakableBox {
  x: number;
  y: number;
  width: number;
  height: number;
  kind: string;
}

/** ¿Comparten un borde (no solo una esquina)? */
function touches(a: BreakableBox, b: BreakableBox): boolean {
  const overlapX = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const overlapY = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  if (overlapX > 0 && overlapY > 0) return true;
  return (overlapX === 0 && overlapY > 0) || (overlapY === 0 && overlapX > 0);
}

/**
 * Bloques: los rompibles de la misma clase que se tocan forman uno y se rompen juntos (una pared de 3 × 4
 * cae de un golpe). Devuelve, para cada caja, el número de su bloque (0, 1, 2… en orden de aparición).
 */
export function breakableGroups(boxes: readonly BreakableBox[]): number[] {
  const parent = boxes.map((_, i) => i);
  const find = (i: number): number => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]];
      i = parent[i];
    }
    return i;
  };
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      if (boxes[i].kind !== boxes[j].kind || !touches(boxes[i], boxes[j])) continue;
      const a = find(i);
      const b = find(j);
      if (a !== b) parent[Math.max(a, b)] = Math.min(a, b);
    }
  }
  const ids = new Map<number, number>();
  return boxes.map((_, i) => {
    const root = find(i);
    if (!ids.has(root)) ids.set(root, ids.size);
    return ids.get(root)!;
  });
}

/**
 * ¿Un objeto apoyado en (x, y) (sus pies) descansa sobre la cara de arriba de la caja? Se usa para que lo
 * que estaba encima de un nido o una repisa frágil caiga al romperla. `tolerance`: px de holgura en y.
 */
export function restsOn(x: number, y: number, box: BreakableBox, tolerance: number): boolean {
  return x >= box.x && x < box.x + box.width && Math.abs(y - box.y) <= tolerance;
}
