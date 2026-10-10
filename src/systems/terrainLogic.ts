// Lógica pura del terreno como repisa (S28): qué tiles de la capa Ground se dibujan. Las colisiones no cambian.

/**
 * Profundidad de cada celda: 0 en el aire y, en una celda sólida, a cuántos tiles (en las 8 direcciones) está el
 * aire más cercano. Fuera del mapa cuenta como sólido. Se corta en `max + 1`: más hondo da igual.
 * El índice de la celda (x, y) es `y * width + x`.
 */
export function terrainDepths(solid: (x: number, y: number) => boolean, width: number, height: number, max: number): Uint8Array {
  const cap = Math.min(255, max + 1);
  const depth = new Uint8Array(width * height).fill(cap);
  const queue: number[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (solid(x, y)) continue;
      depth[y * width + x] = 0;
      queue.push(y * width + x);
    }
  }
  for (let head = 0; head < queue.length; head++) {
    const i = queue[head];
    const d = depth[i] + 1;
    if (d >= cap) continue;
    const cx = i % width;
    const cy = (i - cx) / width;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const x = cx + dx;
        const y = cy + dy;
        if (x < 0 || y < 0 || x >= width || y >= height) continue;
        const j = y * width + x;
        if (depth[j] <= d) continue;
        depth[j] = d;
        queue.push(j);
      }
    }
  }
  return depth;
}

/** Cómo se dibuja un tile sólido según su profundidad: entero, la última fila más tenue, o nada (se ve el fondo). */
export function terrainAlpha(depth: number, tiles: number, fadeAlpha: number): number {
  if (depth < tiles) return 1;
  return depth === tiles ? fadeAlpha : 0;
}

/**
 * Piso del nivel (S29): en cada columna, la fila donde empieza el tramo sólido que llega al borde de abajo del mapa
 * (`height` si la columna no lo toca: un pozo), y la línea del piso, la más común de esas filas (empate: la más honda).
 * Lo que está en ese tramo y a la altura de la línea o más abajo se dibuja entero: el suelo llega hasta abajo de la
 * pantalla y no queda una franja flotando con el fondo por debajo. Las casas que se apoyan en el piso siguen huecas.
 */
export function terrainFloor(solid: (x: number, y: number) => boolean, width: number, height: number): { runTop: Int32Array; line: number } {
  const runTop = new Int32Array(width).fill(height);
  const counts = new Map<number, number>();
  for (let x = 0; x < width; x++) {
    let y = height;
    while (y > 0 && solid(x, y - 1)) y--;
    runTop[x] = y;
    if (y < height) counts.set(y, (counts.get(y) ?? 0) + 1);
  }
  let line = height;
  let best = 0;
  for (const [y, n] of counts) {
    if (n > best || (n === best && y > line)) {
      best = n;
      line = y;
    }
  }
  return { runTop, line };
}

/** El tile (x, y) es piso y se dibuja entero (ver `terrainFloor`). */
export function isFloorTile(floor: { runTop: Int32Array; line: number }, x: number, y: number): boolean {
  return y >= floor.runTop[x] && y >= floor.line;
}
