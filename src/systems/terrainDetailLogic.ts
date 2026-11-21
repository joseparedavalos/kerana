// Lógica pura del detalle del terreno (S109): qué variante del relleno lleva cada celda y qué calcomanía va encima.
// La hoja (`public/assets/tiles/detalle/<hoja>.png`) y su JSON los escribe tools/make-terrain-tiles.mjs. Todo sale de la
// semilla del nivel y de la posición de la celda: el mismo mapa da siempre el mismo dibujo, en cada partida.
// S110: la configuración por hoja (`sheets`), el agua (superficie, cuerpo y fondo) y la luz de las grietas del barro seco.
// S112: las zonas del pueblo (l4): qué celda es calle (tierra, empedrado, ladrillo, cimiento) y cuál es casa (cal, zócalo).
// S118: zonas por rectángulo (la terraza de la arena de Yvága) y la quilla que cuelga bajo las islas del cielo.
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
  /**
   * S112: zonas (las de `townZones`): zona → casilla del autotile → variantes. Una celda de una zona con casilla en su
   * lista lleva siempre una de esas (la calle no tiene cal en ningún lado); si no, lo de siempre.
   */
  zones?: Record<string, Record<string, number[]>>;
  /** S118: la losa de piedra que se mueve (Mover) en la hoja: casilla de la izquierda, del medio y de la derecha. */
  mover?: { left: number; center: number; right: number };
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
  /**
   * S113: raicillas que cuelgan en el aire debajo de una saliente (`hang` en la hoja): probabilidad por celda de aire con
   * terreno justo arriba y al menos `HANG_CLEAR` filas de aire debajo (en un pasaje bajo estorbarían). Sin ella, nada.
   */
  hangChance?: number;
  /** S112: el pueblo: cómo se reparte el mapa en calle y casas (`townZones`). */
  town?: TownConfig;
  /** S112: las calcomanías de cada zona (en vez de las franjas de siempre); una zona que no está, sin calcomanías. */
  zoneDecals?: Readonly<Record<string, ZoneDecals>>;
  /** S118: zonas por rectángulo (`regionZones`), en vez del pueblo. */
  regions?: RegionConfig;
  /**
   * S118: la quilla bajo las islas del cielo: en la celda de aire justo debajo de un terreno, una calcomanía según la forma
   * de la isla (`keelMid`, `keelLeft`, `keelRight`, `keelSolo`) con `chance` (`midChance` en el medio); si debajo hay menos de `clear` filas de
   * aire libre (un pasaje), la corta (`keelShort…`), y con menos de `shortClear`, nada.
   */
  keel?: {
    /** Probabilidad en las puntas y en una isla de una casilla; `midChance`, en el medio de una isla (y `deep`, antes). */
    chance: number;
    midChance: number;
    clear: number;
    shortClear: number;
    /** Un cono de dos celdas (`keelDeep`) bajo una celda con isla a `reach` o más a cada lado y `clear` filas libres. */
    deep?: { chance: number; clear: number; reach: number };
  };
}

/** S118: rectángulos del mapa (en tiles) con su zona; lo demás del autotile va a `rest`. */
export interface RegionConfig {
  rest: string;
  rects: ReadonlyArray<{ zone: string; x: number; y: number; w: number; h: number }>;
}

/** S112: las calcomanías de una zona: las franjas por profundidad y, en el piso (aire arriba), qué va y cuánto. */
export interface ZoneDecals {
  bands: readonly DetailBand[];
  floorChance: number;
  floor: Readonly<Record<string, number>>;
}

/** S112: el reparto del pueblo en calle y casas. */
export interface TownConfig {
  /** Un piso elevado de la calle (de ladrillo) está a esta cantidad de filas del borde de abajo o menos. */
  streetRows: number;
  /** Un piso con terreno arriba a esta distancia o menos es de adentro (el zaguán, la galería, el henil). */
  interiorReach: number;
  /** El zócalo de cada casa que se apoya en la calle: zona → peso (`wall`, sin zócalo). */
  socle: Readonly<Record<string, number>>;
}

/** S112: los nombres de las zonas del pueblo (las claves de `layout.zones` y de `zoneDecals`). */
export const TOWN_ZONES = {
  /** La tierra colorada bajo la calle. */
  earth: 'street.earth',
  /** El piso de la calle al aire libre: empedrado. */
  cobble: 'street.cobble',
  /** El piso de la calle bajo techo (el zaguán, el galpón): ladrillo. */
  brick: 'street.brick',
  /** La calle justo bajo una casa: el cimiento de piedra. */
  plinth: 'street.plinth',
  /** Las casas: la cal y las tejas (el tileset). */
  wall: 'wall',
  /** Un piso de adentro de una casa (el henil) o elevado (el patio, la terraza, la galería): ladrillo sobre la cal. */
  wallBrick: 'wall.brick',
} as const;

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
/** S118: las formas de la quilla, según qué vecinos tiene la casilla de arriba (izquierda, derecha). */
const KEEL_SHAPES = ['Solo', 'Left', 'Right', 'Mid'] as const;
const AUTOTILE_LAST = 15;
const WATER_SURFACE = 20;
const WATER_BODY = 21;
const DRY_MUD = 22;
/** S113: filas de aire que tiene que haber debajo de una saliente para que cuelguen raicillas (el túnel de l5 tiene 3). */
export const HANG_CLEAR = 4;

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
 * casilla, siempre una de esas (el fondo del agua no lleva pasto). S112: donde `zoneAt(x, y)` da una zona con casillas
 * propias para esa casilla (`layout.zones`), siempre una de esas.
 */
export function planTerrainVariants(
  width: number,
  height: number,
  ground: (x: number, y: number) => number,
  layout: DetailLayout,
  cfg: Pick<DetailConfig, 'fillChance' | 'edgeChance'>,
  seed: number,
  underWater?: (x: number, y: number) => boolean,
  zoneAt?: (x: number, y: number) => string | null,
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
      // S112: la celda de una zona con casillas propias lleva siempre una de ellas.
      const zone = zoneAt?.(x, y);
      const own = zone ? layout.zones?.[zone]?.[String(t)] : undefined;
      if (own?.length) {
        variant[y * width + x] = pickOf(own, cellHash(x, y, seed, 10));
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
 * franja de profundidad (piedras, capas, grietas, liquen). S112: con `zoneAt` y `cfg.zoneDecals`, cada zona con lo
 * suyo (y nada en las que no están). S113: con `cfg.hangChance`, raicillas (`hang`) en el aire bajo las salientes.
 */
export function planTerrainDecals(
  map: DetailMap,
  layout: DetailLayout,
  cfg: DetailConfig,
  seed: number,
  zoneAt?: (x: number, y: number) => string | null,
): DecalPlan {
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
  const zoned = zoneAt && cfg.zoneDecals ? zoneAt : null;
  const place = (x: number, y: number, kind: string, decal: DetailDecal, minDepth = 0): boolean => {
    const zone = zoned?.(x, y);
    for (let i = 0; i < decal.ids.length; i++) {
      const px = x + (i % decal.w);
      const py = y + Math.floor(i / decal.w);
      if (!eligible(px, py) || depth[py * width + px] < minDepth) return false;
      // S112: con zonas, todas las celdas de una calcomanía en la misma (no cruza de la casa a la calle).
      if (zoned && zoned(px, py) !== zone) return false;
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
        if (!map.emptyAir(x, y)) continue;
        // El pasto de una esquina de arriba sale hacia el aire vacío de al lado.
        if (roll < cfg.overhangChance) {
          // Una esquina de arriba en (cx, y) con aire del lado `side` (el de esta celda).
          const cornerAt = (cx: number, side: number) => autotile(cx, y) && !(g(cx, y) & UP) && !(g(cx, y) & side) && map.opaque(cx, y);
          let kind: string | null = null;
          if (cornerAt(x + 1, LEFT)) kind = 'overhangLeft';
          else if (cornerAt(x - 1, RIGHT)) kind = 'overhangRight';
          const decal = kind ? decalOf(kind, x, y) : null;
          if (kind && decal) {
            used[i] = 1;
            decals.push({ x, y, id: decal.ids[0], kind, flip: false });
            continue;
          }
        }
        // S118: la quilla bajo una isla del cielo (la colisión no cambia: va en la celda de aire).
        const keel = cfg.keel;
        if (keel && autotile(x, y - 1) && map.opaque(x, y - 1)) {
          const above = g(x, y - 1);
          const mid = above & RIGHT && above & LEFT;
          const look = Math.max(keel.clear, keel.deep?.clear ?? 0);
          let clear = 0;
          while (clear < look && inside(x, y + clear) && map.ground(x, y + clear) === -1 && map.emptyAir(x, y + clear)) clear++;
          const shape = KEEL_SHAPES[(above & RIGHT ? 1 : 0) + (above & LEFT ? 2 : 0)];
          // Las puntas, siempre (la isla se afina); el medio, en una parte de las celdas (lo demás termina en el cascajo).
          const keelRoll = cellHash(x, y, seed, 13);
          // En el corazón de una isla ancha, a veces un cono de dos celdas (`keelDeep`), con aire de sobra debajo.
          if (mid && keel.deep && clear >= keel.deep.clear && !used[i + width] && cellHash(x, y, seed, 14) < keel.deep.chance) {
            let reach = 0;
            while (reach < keel.deep.reach && autotile(x - reach - 1, y - 1) && autotile(x + reach + 1, y - 1)) reach++;
            const deep = reach >= keel.deep.reach ? decalOf('keelDeep', x, y) : null;
            if (deep && deep.ids.length === 2) {
              used[i] = 1;
              used[i + width] = 1;
              decals.push({ x, y, id: deep.ids[0], kind: 'keelDeep', flip: false }, { x, y: y + 1, id: deep.ids[1], kind: 'keelDeep', flip: false });
              continue;
            }
          }
          const take = keelRoll < (mid ? keel.midChance : keel.chance);
          const kind = !take ? null : clear >= keel.clear ? `keel${shape}` : clear >= keel.shortClear ? `keelShort${shape}` : null;
          const decal = kind ? decalOf(kind, x, y) : null;
          if (kind && decal) {
            used[i] = 1;
            decals.push({ x, y, id: decal.ids[0], kind, flip: decal.flip === true && cellHash(x, y, seed, 6) < 0.5 });
          }
          continue;
        }
        // S113: raicillas que cuelgan debajo de una saliente, donde abajo hay aire de sobra.
        const hang = cfg.hangChance ?? 0;
        if (hang > 0 && cellHash(x, y, seed, 12) < hang && autotile(x, y - 1) && map.opaque(x, y - 1)) {
          let clear = true;
          for (let k = 0; k < HANG_CLEAR && clear; k++) clear = inside(x, y + k) && map.ground(x, y + k) === -1;
          const decal = clear ? decalOf('hang', x, y) : null;
          if (decal) {
            used[i] = 1;
            decals.push({ x, y, id: decal.ids[0], kind: 'hang', flip: decal.flip === true && cellHash(x, y, seed, 6) < 0.5 });
          }
        }
        continue;
      }
      if (!eligible(x, y)) continue;
      const d = depth[i];
      if (zoned) {
        // S112: cada zona con sus calcomanías: en el piso (aire arriba) lo de `floor`; adentro, sus franjas.
        const zone = zoned(x, y);
        const zd = zone ? cfg.zoneDecals?.[zone] : undefined;
        if (!zd) continue;
        const top = !(t & UP);
        const band = top ? null : zd.bands.find((b) => d >= b.minDepth && d <= b.maxDepth);
        const chance = top ? zd.floorChance : (band?.chance ?? 0);
        if (roll >= chance) continue;
        const kind = weighted(top ? zd.floor : band!.kinds, cellHash(x, y, seed, 4));
        const decal = kind ? decalOf(kind, x, y) : null;
        if (kind && decal) place(x, y, kind, decal, !top && decal.ids.length > 1 ? cfg.multiMinDepth : 0);
        continue;
      }
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

/**
 * S112: el pueblo por celda (`y * width + x`): la zona de cada celda del autotile (null en el aire y en lo que se
 * rompe). Medido en el mapa: la calle es la tierra que llega al borde de abajo, desde la línea del piso (la fila más
 * común donde empieza el tramo sólido que llega abajo; empate, la más honda); su piso al aire libre es empedrado y bajo
 * techo (terreno arriba a `interiorReach` filas o menos: el zaguán), ladrillo; bajo una casa, el cimiento. Lo demás son
 * casas: arriba, tejas; ladrillo si es un piso de adentro (el henil) o un piso elevado de la calle (con aire arriba, a
 * `streetRows` filas del fondo o menos, de dos o más de ancho, sobre un tramo que llega abajo: el patio, la terraza, la
 * galería; los pretiles de una casilla llevan tejas); donde se apoyan en la calle, el zócalo de esa casa (uno por casa:
 * las celdas conectadas).
 */
export function townZones(
  width: number,
  height: number,
  ground: (x: number, y: number) => number,
  cfg: TownConfig,
  seed: number,
): (string | null)[] {
  const auto = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return false;
    const t = ground(x, y);
    return t >= 0 && t <= AUTOTILE_LAST;
  };
  // Dónde empieza en cada columna el tramo que llega abajo, y la línea del piso.
  const runTop = new Int32Array(width).fill(height);
  const counts = new Map<number, number>();
  for (let x = 0; x < width; x++) {
    let y = height;
    while (y > 0 && auto(x, y - 1)) y--;
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
  const isTop = (x: number, y: number) => auto(x, y) && !(ground(x, y) & UP);
  const inStreet = (x: number, y: number) => auto(x, y) && runTop[x] < height && y >= runTop[x] && y >= line;
  const raised = (x: number, y: number) => isTop(x, y) && runTop[x] < height && y >= runTop[x] && y >= height - 1 - cfg.streetRows;
  const interior = (x: number, y: number) => {
    for (let k = 1; k <= cfg.interiorReach; k++) if (auto(x, y - k)) return true;
    return false;
  };
  // Las casas: celdas conectadas que no son calle; el zócalo es uno por casa.
  const house = new Int32Array(width * height).fill(-1);
  const socleOf: string[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!auto(x, y) || inStreet(x, y) || house[y * width + x] >= 0) continue;
      const id = socleOf.length;
      socleOf.push(weighted({ ...cfg.socle }, cellHash(x, y, seed, 11)) ?? TOWN_ZONES.wall);
      const stack = [y * width + x];
      house[y * width + x] = id;
      while (stack.length) {
        const i = stack.pop()!;
        const cx = i % width;
        const cy = (i - cx) / width;
        for (const [nx, ny] of [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]]) {
          if (!auto(nx, ny) || inStreet(nx, ny) || house[ny * width + nx] >= 0) continue;
          house[ny * width + nx] = id;
          stack.push(ny * width + nx);
        }
      }
    }
  }
  const out: (string | null)[] = new Array(width * height).fill(null);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!auto(x, y)) continue;
      const top = isTop(x, y);
      let zone: string;
      if (inStreet(x, y)) {
        if (top) zone = interior(x, y) ? TOWN_ZONES.brick : TOWN_ZONES.cobble;
        else zone = inStreet(x, y - 1) ? TOWN_ZONES.earth : TOWN_ZONES.plinth;
      } else if (top) {
        const floor = interior(x, y) || (raised(x, y) && (raised(x - 1, y) || raised(x + 1, y)));
        zone = floor ? TOWN_ZONES.wallBrick : TOWN_ZONES.wall;
      } else zone = inStreet(x, y + 1) ? socleOf[house[y * width + x]] : TOWN_ZONES.wall;
      out[y * width + x] = zone;
    }
  }
  return out;
}

/**
 * S118: zonas por rectángulo: cada celda del autotile lleva la zona del primer rectángulo que la contiene o `rest` (null en
 * el aire y en lo que no es del autotile). Con `zoneDecals`, `rest` también tiene que estar ahí o esas celdas quedan sin
 * calcomanías.
 */
export function regionZones(width: number, height: number, ground: (x: number, y: number) => number, cfg: RegionConfig): (string | null)[] {
  const out: (string | null)[] = new Array(width * height).fill(null);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const t = ground(x, y);
      if (t < 0 || t > AUTOTILE_LAST) continue;
      const r = cfg.rects.find((q) => x >= q.x && x < q.x + q.w && y >= q.y && y < q.y + q.h);
      out[y * width + x] = r ? r.zone : cfg.rest;
    }
  }
  return out;
}
