// Distribución del tileset placeholder (compartida por los scripts y el parser).
export const TILE = 16;
export const TILESET_COLUMNS = 4;
export const TILESET_ROWS = 7;

// Índices (base 0) dentro del tileset.
export const TILES = {
  groundBase: 0, // 0–15 según la máscara de vecinos
  platformLeft: 16,
  platformCenter: 17,
  platformRight: 18,
  hazard: 19, // y sus variantes 26 y 27 (S64)
  waterSurface: 20,
  waterDeep: 21,
  cracked: 22,
  grass: 23,
  flowers: 24,
  stones: 25,
  hazardB: 26,
  hazardC: 27,
};

/** Las tres variantes del peligro (S64): una fila de ^ alterna entre ellas para no verse estampada. */
export const HAZARD_TILES = [TILES.hazard, TILES.hazardB, TILES.hazardC];

/**
 * Qué variante del peligro va en la columna `x`: fija (depende solo de x) y nunca la misma que la columna anterior.
 * El dibujo no cambia el choque: lastima cualquier baldosa de la capa Hazards.
 */
export function hazardTileAt(x) {
  // Cada columna avanza 1 o 2 lugares respecto de la anterior (según un bit fijo de x): nunca se repite al lado.
  const bit = (c) => {
    let h = Math.imul(c, 0x45d9f3b);
    h ^= h >>> 16;
    h = Math.imul(h, 0x45d9f3b);
    return (h ^ (h >>> 16)) & 1;
  };
  let v = 0;
  for (let c = 1; c <= x; c++) v = (v + 1 + bit(c)) % HAZARD_TILES.length;
  return HAZARD_TILES[v];
}
