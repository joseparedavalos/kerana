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

/** Ajustes del fondo de tierra (S68, `GAMEPLAY.backdrop.earth`). */
export interface EarthLook {
  /** Opacidad detrás de la fila tenue de la repisa (0-1): la tierra asoma de a poco. */
  fadeAlpha: number;
  /** Cuánto del color del relleno del tileset queda en la primera fila de tierra (0-1) y en la más honda. */
  shade: number;
  deepShade: number;
  /** En cuántos tiles pasa de `shade` a `deepShade`, desde la fila tenue hacia adentro. */
  deepTiles: number;
}

/**
 * Fondo de tierra (S68): un píxel RGBA por tile, para estirarlo con filtro lineal detrás de la capa Ground.
 * Solo hay tierra donde la repisa no se dibuja entera: la fila tenue (`depth === tiles`) a `fadeAlpha` y más adentro
 * opaca, cada vez más oscura. La fila de antes de la tenue (tapada por un tile entero) lleva `fadeAlpha` para que el
 * degradado del filtro quede escondido; el aire y las filas de al lado del aire, nada: la tierra nunca tapa el aire.
 * `depth` sale de `terrainDepths` con `max ≥ tiles + deepTiles` para que se vea el oscurecimiento. `covered(i)`: la
 * celda se dibuja entera igual (el piso de S29): no lleva tierra, así no se dibuja lo que nadie ve.
 */
export function earthPixels(
  depth: Uint8Array,
  tiles: number,
  color: number,
  look: EarthLook,
  covered?: (i: number) => boolean,
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(depth.length * 4);
  const start = Math.max(2, tiles - 1);
  const r = (color >> 16) & 0xff;
  const g = (color >> 8) & 0xff;
  const b = color & 0xff;
  for (let i = 0; i < depth.length; i++) {
    const d = depth[i];
    const k = Math.min(
      1,
      Math.max(0, (d - tiles) / Math.max(1, look.deepTiles)),
    );
    const shade = look.shade + (look.deepShade - look.shade) * k;
    out[i * 4] = r * shade;
    out[i * 4 + 1] = g * shade;
    out[i * 4 + 2] = b * shade;
    out[i * 4 + 3] =
      d < start || covered?.(i) ? 0 : d > tiles ? 255 : look.fadeAlpha * 255;
  }
  return out;
}

/**
 * Trozos del fondo de tierra (S68): el mapa en tramos de `chunk` columnas y, en cada uno, la caja de los píxeles con
 * tierra (alfa > 0) más una celda de margen (vacía: el filtro lineal no corta el degradado). Tramos sin tierra, fuera.
 */
export function earthChunks(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  chunk: number,
): { x: number; y: number; width: number; height: number }[] {
  const out: { x: number; y: number; width: number; height: number }[] = [];
  for (let x0 = 0; x0 < width; x0 += chunk) {
    const x1 = Math.min(width, x0 + chunk);
    let left = Infinity;
    let right = -Infinity;
    let top = Infinity;
    let bottom = -Infinity;
    for (let y = 0; y < height; y++) {
      for (let x = x0; x < x1; x++) {
        if (pixels[(y * width + x) * 4 + 3] === 0) continue;
        left = Math.min(left, x);
        right = Math.max(right, x);
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
      }
    }
    if (left > right) continue;
    const x = Math.max(x0, left - 1);
    const y = Math.max(0, top - 1);
    out.push({
      x,
      y,
      width: Math.min(x1, right + 2) - x,
      height: Math.min(height, bottom + 2) - y,
    });
  }
  return out;
}
