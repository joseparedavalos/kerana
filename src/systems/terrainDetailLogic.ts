// Lógica pura del detalle del terreno (S109): qué variante del relleno lleva cada celda y qué calcomanía va encima.
// La hoja (`public/assets/tiles/detalle/<hoja>.png`) y su JSON los escribe tools/make-terrain-tiles.mjs. Todo sale de la
// semilla del nivel y de la posición de la celda: el mismo mapa da siempre el mismo dibujo, en cada partida.
// S110: la configuración por hoja (`sheets`), el agua (superficie, cuerpo y fondo) y la luz de las grietas del barro seco.
import { terrainDepths } from './terrainLogic';

/** Una calcomanía de w × h casillas; `ids` en filas de w (índices dentro de la hoja); `flip`: se puede espejar. */
export interface DetailDecal {
  w: number;
  h: number;
  ids: number[];
  flip?: boolean;
}

/** El JSON de la hoja: variantes del relleno (15), de los bordes (máscara → variantes) y calcomanías por tipo. */
export interface DetailLayout {
  tile: number;
  columns: number;
  fill: number[];
  edges: Record<string, number[]>;
  decals: Record<string, DetailDecal[]>;
  count: number;
  /** S110: el fondo bajo el agua: casilla del autotile (el piso, 14) → variantes con limo y algas en vez de pasto. */
  submerged?: Record<string, number[]>;
  /** S110: el agua honda, que va debajo del cuerpo (21) cuando arriba también hay cuerpo. */
  water?: { deep: number[] };
  /**
   * S110: la luz de las grietas del barro seco (casilla 22 y sus variantes) para la roca que pide el tajo cargado:
   * `"22"` → casilla de la hoja; `"d<id>"` (variante `id` de la hoja) → casilla de la hoja.
   */
  glow?: Record<string, number>;
}

export interface DetailBand {
  /** Profundidad de la celda (a cuántos tiles está el aire más cercano, en las 8 direcciones), de y hasta. */
  minDepth: number;
  maxDepth: number;
  /** Probabilidad de que una celda de la franja lleve algo. */
  chance: number;
  /** Peso de cada tipo de calcomanía en la franja. */
  kinds: Readonly<Record<string, number>>;
}

export interface DetailConfig {
  fillChance: number;
  edgeChance: number;
  maxDepth: number;
  rootsChance: number;
  rootletChance: number;
  overhangChance: number;
  bands: readonly DetailBand[];
  crystal: { reach: number; minDepth: number; maxDepth: number; chance: number };
  /** Las de más de una casilla solo donde todas sus celdas están al menos a esta profundidad (no tocan el borde). */
  multiMinDepth: number;
  depthShade: readonly number[];
  /** S110: probabilidad de que la superficie (20) o el cuerpo (21) del agua lleve otra casilla de la hoja. */
  waterChance: number;
}

/** S110: la configuración de una hoja: la común con lo que cambie esa hoja en `sheets`. */
export function detailConfigFor(
  base: DetailConfig & { readonly sheets?: Readonly<Record<string, Partial<DetailConfig>>> },
  sheet: string,
): DetailConfig {
  return { ...base, ...(base.sheets?.[sheet] ?? {}) };
}

/** Lo que el plan necesita saber del mapa. Fuera del mapa cuenta como sólido. */
export interface DetailMap {
  width: number;
  height: number;
  /** Casilla del tileset (0 a 27) de Ground en la celda, o -1 si es aire. */
  ground(x: number, y: number): number;
  /** La roca se ve entera ahí: Ground opaco o el fondo de tierra debajo (no la roca honda que deja ver la cueva). */
  opaque(x: number, y: number): boolean;
  /** Aire dentro de una zona `Cave`. */
  caveAir(x: number, y: number): boolean;
  /** Aire sin nada en ninguna otra capa (ahí puede salir el pasto de una esquina). */
  emptyAir(x: number, y: number): boolean;
}

export interface PlacedDecal {
  x: number;
  y: number;
  id: number;
  kind: string;
  /** Espejada a lo ancho (la casilla va con `flipX` y las columnas de la calcomanía, al revés). */
  flip: boolean;
}

export interface DecalPlan {
  decals: PlacedDecal[];
  /** Profundidad de cada celda (0 en el aire), cortada en `maxDepth + 1`. */
  depth: Uint8Array;
}

const UP = 1;
const RIGHT = 2;
const LEFT = 8;
const AUTOTILE_LAST = 15;
const WATER_SURFACE = 20;
const WATER_BODY = 21;
const DRY_MUD = 22;

/** Número de 0 a 1 fijo para (x, y, semilla, sal): el azar de cada celda, igual en cada partida. */
export function cellHash(x: number, y: number, seed: number, salt = 0): number {
  let h = Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1) ^ Math.imul((seed + Math.imul(salt, 0x9e3779b9)) | 0, 0x85ebca6b);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  h = Math.imul(h, 0x297a2d39);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

const pickOf = <T>(list: readonly T[], r: number): T => list[Math.min(list.length - 1, Math.floor(r * list.length))];

function weighted(kinds: Record<string, number>, r: number): string | null {
  const entries = Object.entries(kinds).filter(([, w]) => w > 0);
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let t = r * total;
  for (const [k, w] of entries) {
    if (t < w) return k;
    t -= w;
  }
  return entries.at(-1)?.[0] ?? null;
}

/** Distancia (Chebyshev, en tiles) de cada celda al aire de cueva más cercano, hasta `reach` (más lejos: 255). */
export function caveDistance(map: DetailMap, reach: number): Uint8Array {
  const { width, height } = map;
  const dist = new Uint8Array(width * height).fill(255);
  const queue: number[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!map.caveAir(x, y)) continue;
      dist[y * width + x] = 0;
      queue.push(y * width + x);
    }
  }
  for (let head = 0; head < queue.length; head++) {
    const i = queue[head];
    const d = dist[i] + 1;
    if (d > reach) continue;
    const cx = i % width;
    const cy = (i - cx) / width;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const x = cx + dx;
        const y = cy + dy;
        if (x < 0 || y < 0 || x >= width || y >= height) continue;
        const j = y * width + x;
        if (dist[j] <= d) continue;
        dist[j] = d;
        queue.push(j);
      }
    }
  }
  return dist;
}

/**
 * Variantes: por celda (`y * width + x`), la casilla de la hoja que reemplaza a la de la capa, o -1. Cada celda de
 * relleno (15) lleva una de `layout.fill` con probabilidad `fillChance`, y cada casilla con variantes en
 * `layout.edges` (bordes del autotile, el medio de la laja), una de ellas con `edgeChance`. `ground(x, y)`: la casilla
 * del tileset (0 a 27) o -1. S110: donde `underWater(x, y)` (agua justo arriba) y la hoja tiene `submerged` para esa
 * casilla, siempre una de esas (el fondo del agua no lleva pasto).
 */
export function planTerrainVariants(
  width: number,
  height: number,
  ground: (x: number, y: number) => number,
  layout: DetailLayout,
  cfg: Pick<DetailConfig, 'fillChance' | 'edgeChance'>,
  seed: number,
  underWater?: (x: number, y: number) => boolean,
): Int16Array {
  const variant = new Int16Array(width * height).fill(-1);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const t = ground(x, y);
      if (t < 0) continue;
      const wet = underWater?.(x, y) ? layout.submerged?.[String(t)] : undefined;
      if (wet?.length) {
        variant[y * width + x] = pickOf(wet, cellHash(x, y, seed, 2));
        continue;
      }
      const list = t === AUTOTILE_LAST ? layout.fill : layout.edges[String(t)];
      const chance = t === AUTOTILE_LAST ? cfg.fillChance : cfg.edgeChance;
      if (!list?.length || cellHash(x, y, seed, 1) >= chance) continue;
      variant[y * width + x] = pickOf(list, cellHash(x, y, seed, 2));
    }
  }
  return variant;
}

/**
 * Calcomanías, una por celda como mucho y solo sobre roca que se ve: raíces bajo el pasto del piso (`roots`, dos
 * casillas hacia abajo, o `rootlet`), el pasto que sale por las esquinas de arriba hacia el aire vacío
 * (`overhangLeft` / `overhangRight`), vetas de cristal cerca del aire de las cuevas y, en el resto, lo que diga la
 * franja de profundidad (piedras, capas, grietas, liquen).
 */
export function planTerrainDecals(map: DetailMap, layout: DetailLayout, cfg: DetailConfig, seed: number): DecalPlan {
  const { width, height } = map;
  const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < width && y < height;
  const g = (x: number, y: number) => (inside(x, y) ? map.ground(x, y) : 15);
  const solid = (x: number, y: number) => g(x, y) !== -1;
  const depth = terrainDepths(solid, width, height, cfg.maxDepth);

  const used = new Uint8Array(width * height);
  const decals: PlacedDecal[] = [];
  const autotile = (x: number, y: number) => {
    const t = inside(x, y) ? map.ground(x, y) : -1;
    return t >= 0 && t <= AUTOTILE_LAST;
  };
  const eligible = (x: number, y: number) => inside(x, y) && autotile(x, y) && map.opaque(x, y) && !used[y * width + x];
  const place = (x: number, y: number, kind: string, decal: DetailDecal, minDepth = 0): boolean => {
    for (let i = 0; i < decal.ids.length; i++) {
      const px = x + (i % decal.w);
      const py = y + Math.floor(i / decal.w);
      if (!eligible(px, py) || depth[py * width + px] < minDepth) return false;
    }
    const flip = decal.flip === true && cellHash(x, y, seed, 6) < 0.5;
    for (let i = 0; i < decal.ids.length; i++) {
      const col = i % decal.w;
      const row = Math.floor(i / decal.w);
      const px = x + col;
      const py = y + row;
      used[py * width + px] = 1;
      const src = flip ? row * decal.w + (decal.w - 1 - col) : i;
      decals.push({ x: px, y: py, id: decal.ids[src], kind, flip });
    }
    return true;
  };
  const decalOf = (kind: string, x: number, y: number): DetailDecal | null => {
    const list = layout.decals[kind];
    return list?.length ? pickOf(list, cellHash(x, y, seed, 5)) : null;
  };
  const near = caveDistance(map, cfg.crystal.reach);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (used[i]) continue;
      const t = map.ground(x, y);
      const roll = cellHash(x, y, seed, 3);
      if (t === -1) {
        // El pasto de una esquina de arriba sale hacia el aire vacío de al lado.
        if (!map.emptyAir(x, y) || roll >= cfg.overhangChance) continue;
        // Una esquina de arriba en (cx, y) con aire del lado `side` (el de esta celda).
        const cornerAt = (cx: number, side: number) => autotile(cx, y) && !(g(cx, y) & UP) && !(g(cx, y) & side) && map.opaque(cx, y);
        let kind: string | null = null;
        if (cornerAt(x + 1, LEFT)) kind = 'overhangLeft';
        else if (cornerAt(x - 1, RIGHT)) kind = 'overhangRight';
        const decal = kind ? decalOf(kind, x, y) : null;
        if (kind && decal) {
          used[i] = 1;
          decals.push({ x, y, id: decal.ids[0], kind, flip: false });
        }
        continue;
      }
      if (!eligible(x, y)) continue;
      const d = depth[i];
      if (!(t & UP)) {
        // Piso: raíces que bajan del pasto (las largas, solo en el piso llano).
        const roots = t === 14 ? decalOf('roots', x, y) : null;
        if (roots && roll < cfg.rootsChance && place(x, y, 'roots', roots)) continue;
        const rootlet = decalOf('rootlet', x, y);
        if (rootlet && roll < cfg.rootsChance + cfg.rootletChance) place(x, y, 'rootlet', rootlet);
        continue;
      }
      const crystalDepth = d >= cfg.crystal.minDepth && d <= cfg.crystal.maxDepth;
      if (near[i] <= cfg.crystal.reach && crystalDepth && roll < cfg.crystal.chance) {
        const crystal = decalOf('crystal', x, y);
        if (crystal && place(x, y, 'crystal', crystal)) continue;
      }
      const band = cfg.bands.find((b) => d >= b.minDepth && d <= b.maxDepth);
      if (!band || roll >= band.chance) continue;
      const kind = weighted(band.kinds, cellHash(x, y, seed, 4));
      const decal = kind ? decalOf(kind, x, y) : null;
      if (!kind || !decal) continue;
      place(x, y, kind, decal, decal.ids.length > 1 ? cfg.multiMinDepth : 0);
    }
  }
  return { decals, depth };
}

/** Tinte gris (multiplica) para la profundidad `d` según `shade` (índice = profundidad; más hondo usa el último). */
export function depthTint(d: number, shade: readonly number[]): number {
  const f = shade[Math.min(shade.length - 1, Math.max(0, d))] ?? 1;
  const c = Math.max(0, Math.min(255, Math.round(255 * f)));
  return (c << 16) | (c << 8) | c;
}

/**
 * S110: el agua por celda (`y * width + x`): la casilla de la hoja que reemplaza a la de la capa Water, o -1. Donde el
 * cuerpo (21) tiene cuerpo arriba, el fondo (`layout.water.deep`): así el color baja en tres casillas (superficie, cuerpo,
 * fondo) y después sigue igual. La superficie y el cuerpo llevan otra casilla (de `layout.edges`) con `chance`.
 * `water(x, y)`: la casilla del tileset (0 a 27) o -1.
 */
export function planWaterTiles(
  width: number,
  height: number,
  water: (x: number, y: number) => number,
  layout: DetailLayout,
  chance: number,
  seed: number,
): Int16Array {
  const out = new Int16Array(width * height).fill(-1);
  const deep = layout.water?.deep ?? [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const t = water(x, y);
      if (t !== WATER_SURFACE && t !== WATER_BODY) continue;
      if (t === WATER_BODY && y > 0 && water(x, y - 1) === WATER_BODY && deep.length) {
        out[y * width + x] = pickOf(deep, cellHash(x, y, seed, 8));
        continue;
      }
      const list = layout.edges[String(t)];
      if (!list?.length || cellHash(x, y, seed, 7) >= chance) continue;
      out[y * width + x] = pickOf(list, cellHash(x, y, seed, 9));
    }
  }
  return out;
}

/**
 * S110: la casilla de la hoja con la luz de las grietas de una celda de barro seco, o -1. `tile`: la casilla del tileset
 * (0 a 27) o, si la celda lleva una variante, `-1` y `variant`, su casilla en la hoja.
 */
export function glowTileFor(layout: DetailLayout, tile: number, variant = -1): number {
  if (!layout.glow) return -1;
  if (variant >= 0) return layout.glow[`d${variant}`] ?? -1;
  return tile === DRY_MUD ? (layout.glow[String(DRY_MUD)] ?? -1) : -1;
}
