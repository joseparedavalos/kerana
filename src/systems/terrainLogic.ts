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

/** Ajustes del fondo de tierra (S68, S69: `GAMEPLAY.backdrop.earth`). */
export interface EarthLook {
  /** Cuánto queda del color de la baldosa (0-1, tinte multiplicado) detrás de la fila tenue y en la más honda. */
  shade: number;
  deepShade: number;
  /** En cuántos tiles pasa de `shade` a `deepShade`, desde la fila tenue hacia adentro. */
  deepTiles: number;
  /** Variación del tinte de una baldosa a otra (± fracción del tinte): que no se lea como papel tapiz. */
  jitter: number;
}

/** Una baldosa del fondo de tierra: celda, tinte gris (0-255 por canal) y orientación (0-7: giro × 90° y espejo). */
export interface EarthCell {
  x: number;
  y: number;
  gray: number;
  turn: number;
  flip: boolean;
}

/** Hash entero de una celda (determinista: la tierra se ve igual en cada partida). */
function cellHash(x: number, y: number): number {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}

/**
 * Fondo de tierra (S69; S68 era una mancha de color): detrás de la repisa va la misma baldosa del suelo, en sombra.
 * Una celda por tile de Ground que la repisa no dibuja entero: la fila tenue (`depth === tiles`, que se dibuja a
 * `terrainFadeAlpha` encima y hace la transición) y todo lo de adentro. Nunca en el aire ni al lado del aire. El tinte
 * baja de `shade` a `deepShade` en `deepTiles` tiles y varía un poco por celda; la orientación (cuatro giros y espejo)
 * sale de un hash de la celda, así la baldosa no se repite en bloque. `covered(i)`: se dibuja entera igual (el piso de
 * S29): no lleva. `depth` sale de `terrainDepths` con `max ≥ tiles + deepTiles`.
 */
export function earthCells(
  depth: Uint8Array,
  width: number,
  tiles: number,
  look: EarthLook,
  covered?: (i: number) => boolean,
): EarthCell[] {
  const out: EarthCell[] = [];
  for (let i = 0; i < depth.length; i++) {
    const d = depth[i];
    if (d < tiles || covered?.(i)) continue;
    const x = i % width;
    const y = (i - x) / width;
    const k = Math.min(1, (d - tiles) / Math.max(1, look.deepTiles));
    const h = cellHash(x, y);
    const wobble = 1 + look.jitter * (((h >>> 8) & 0xff) / 127.5 - 1);
    const shade = (look.shade + (look.deepShade - look.shade) * k) * wobble;
    out.push({ x, y, gray: Math.round(Math.min(1, Math.max(0, shade)) * 255), turn: h & 3, flip: (h & 4) !== 0 });
  }
  return out;
}
