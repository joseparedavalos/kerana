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
  hazard: 19,
  waterSurface: 20,
  waterDeep: 21,
  cracked: 22,
  grass: 23,
  flowers: 24,
  stones: 25,
};
