// Parser de mapas ASCII → Tiled JSON (GDD §11.7). Lógica pura, sin E/S.
import { TILE, TILESET_COLUMNS, TILESET_ROWS, TILES } from './tileset-layout.mjs';

const TILED_VERSION = '1.10.2';
const MAP_VERSION = '1.10';

/** Valores de propiedades: número, booleano o texto. */
export function parseValue(raw) {
  if (/^-?\d+(\.\d+)?$/.test(raw)) return Number(raw);
  if (raw === 'true' || raw === 'false') return raw === 'true';
  return raw;
}

function parsePairs(tokens) {
  const out = {};
  for (const tok of tokens) {
    const eq = tok.indexOf('=');
    if (eq <= 0) throw new Error(`Par clave=valor inválido: "${tok}"`);
    out[tok.slice(0, eq)] = tok.slice(eq + 1);
  }
  return out;
}

/**
 * Lee el texto ASCII. Devuelve { name, width, height, biome, enemies, signs, rects, points, grid, warnings }.
 */
export function parseAscii(text) {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const sep = lines.findIndex((l) => l.trim() === '---');
  if (sep < 0) throw new Error('Falta la línea "---" que separa la cabecera de la grilla.');

  const result = { name: '', width: 0, height: 0, biome: 'cerro', enemies: {}, signs: {}, rects: [], points: [], grid: [], warnings: [] };

  for (const rawLine of lines.slice(0, sep)) {
    const line = rawLine.trim();
    if (!line) continue;
    if (line.startsWith('#')) {
      if (!result.name) result.name = line.replace(/^#\s*/, '');
      continue;
    }
    const [cmd, ...rest] = line.split(/\s+/);
    switch (cmd) {
      case 'size': {
        const m = /^(\d+)x(\d+)$/.exec(rest[0] ?? '');
        if (!m) throw new Error(`"size" inválido: ${line}`);
        result.width = Number(m[1]);
        result.height = Number(m[2]);
        break;
      }
      case 'biome':
        result.biome = rest[0];
        break;
      case 'enemy':
        for (const [ch, kind] of Object.entries(parsePairs(rest))) {
          if (!/^[a-z]$/.test(ch)) throw new Error(`Enemigo con carácter inválido: "${ch}"`);
          result.enemies[ch] = kind;
        }
        break;
      case 'sign':
        for (const [ch, key] of Object.entries(parsePairs(rest))) {
          if (!/^[1-9]$/.test(ch)) throw new Error(`Cartel con carácter inválido: "${ch}"`);
          result.signs[ch] = key;
        }
        break;
      case 'rect':
      case 'point': {
        const [cls, ...pairs] = rest;
        if (!cls) throw new Error(`"${cmd}" sin clase: ${line}`);
        const props = parsePairs(pairs);
        const need = cmd === 'rect' ? ['x', 'y', 'w', 'h'] : ['x', 'y'];
        for (const k of need) if (props[k] === undefined) throw new Error(`"${cmd} ${cls}" sin "${k}"`);
        const geom = {};
        for (const k of need) {
          geom[k] = Number(props[k]);
          delete props[k];
        }
        const extra = Object.fromEntries(Object.entries(props).map(([k, v]) => [k, parseValue(v)]));
        (cmd === 'rect' ? result.rects : result.points).push({ cls, ...geom, props: extra });
        break;
      }
      default:
        throw new Error(`Cabecera desconocida: "${cmd}"`);
    }
  }

  let rows = lines.slice(sep + 1);
  while (rows.length && rows[rows.length - 1].trim() === '') rows.pop();
  if (!result.width || !result.height) {
    result.height = rows.length;
    result.width = Math.max(0, ...rows.map((r) => r.length));
  }
  if (rows.length !== result.height)
    result.warnings.push(`La grilla tiene ${rows.length} filas y "size" dice ${result.height}; se ajusta.`);
  rows.forEach((r, i) => {
    if (r.length !== result.width) result.warnings.push(`Fila ${i}: ${r.length} columnas en vez de ${result.width}; se ajusta.`);
  });
  result.grid = Array.from({ length: result.height }, (_, y) => (rows[y] ?? '').padEnd(result.width, '.').slice(0, result.width));
  return result;
}

/** Máscara de vecinos del suelo: arriba 1, derecha 2, abajo 4, izquierda 8. Fuera del mapa cuenta como suelo. */
export function groundMask(grid, x, y, isGround = (c) => c === '#') {
  const h = grid.length;
  const w = grid[0]?.length ?? 0;
  const at = (cx, cy) => (cx < 0 || cy < 0 || cx >= w || cy >= h ? true : isGround(grid[cy][cx]));
  return (at(x, y - 1) ? 1 : 0) | (at(x + 1, y) ? 2 : 0) | (at(x, y + 1) ? 4 : 0) | (at(x - 1, y) ? 8 : 0);
}

/**
 * Convierte el resultado de parseAscii en un mapa de Tiled (objeto JSON).
 * Opciones: autotile (true), tilesetImage ('../tiles/<bioma>.png'), enemyDefaults.
 */
export function buildTiledMap(parsed, options = {}) {
  const { width, height, grid, biome } = parsed;
  const autotile = options.autotile ?? true;
  const enemyDefaults = options.enemyDefaults ?? { facing: 'left', patrol: 64 };
  const gid = (index) => index + 1; // firstgid = 1
  const blank = () => new Array(width * height).fill(0);
  const data = { Background: blank(), Ground: blank(), Platforms: blank(), Hazards: blank(), Water: blank(), Foreground: blank() };

  const objects = [];
  let nextId = 1;
  const prop = (name, value) => ({ name, type: typeof value === 'number' ? (Number.isInteger(value) ? 'int' : 'float') : typeof value === 'boolean' ? 'bool' : 'string', value });
  const addObject = (cls, x, y, w, h, props = {}, isPoint = false) => {
    const obj = { id: nextId++, name: '', type: cls, x, y, width: w, height: h, rotation: 0, visible: true };
    if (isPoint) obj.point = true;
    const list = Object.entries(props).map(([k, v]) => prop(k, v));
    if (list.length) obj.properties = list;
    objects.push(obj);
  };
  // Puntos de la grilla: centro horizontal y borde inferior del tile (donde van los pies).
  const px = (cx) => cx * TILE + TILE / 2;
  const py = (cy) => (cy + 1) * TILE;

  let checkpoints = 0;
  let feathers = 0;
  let spawns = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const c = grid[y][x];
      const i = y * width + x;
      switch (c) {
        case '.':
        case ' ':
          break;
        case '#':
          data.Ground[i] = gid(autotile ? TILES.groundBase + groundMask(grid, x, y) : TILES.groundBase + 15);
          break;
        case '=': {
          const l = grid[y][x - 1] === '=';
          const r = grid[y][x + 1] === '=';
          data.Platforms[i] = gid(l && r ? TILES.platformCenter : !l && r ? TILES.platformLeft : l && !r ? TILES.platformRight : TILES.platformCenter);
          break;
        }
        case '^':
          data.Hazards[i] = gid(TILES.hazard);
          break;
        case '~':
          data.Water[i] = gid(y > 0 && grid[y - 1][x] === '~' ? TILES.waterDeep : TILES.waterSurface);
          break;
        case 'B':
          data.Ground[i] = gid(TILES.cracked);
          addObject('Breakable', x * TILE, y * TILE, TILE, TILE);
          break;
        case 'P':
          spawns++;
          addObject('PlayerSpawn', px(x), py(y), 0, 0, {}, true);
          break;
        case 'C':
          addObject('Checkpoint', px(x), py(y), 0, 0, { id: checkpoints++ }, true);
          break;
        case 'G':
          addObject('Pickup', px(x), py(y), 0, 0, { kind: 'guavira' }, true);
          break;
        case 'L':
          addObject('Pickup', px(x), py(y), 0, 0, { kind: 'luz_arasy' }, true);
          break;
        case 'F':
          addObject('Pickup', px(x), py(y), 0, 0, { kind: 'pluma', index: feathers++ }, true);
          break;
        default:
          if (/[1-9]/.test(c)) {
            const key = parsed.signs[c];
            if (!key) throw new Error(`Cartel "${c}" en (${x}, ${y}) sin línea "sign".`);
            addObject('Sign', px(x), py(y), 0, 0, { textKey: key }, true);
          } else if (/[a-z]/.test(c)) {
            const kind = parsed.enemies[c];
            if (!kind) throw new Error(`Enemigo "${c}" en (${x}, ${y}) sin línea "enemy".`);
            addObject('Enemy', px(x), py(y), 0, 0, { kind, ...enemyDefaults }, true);
          } else {
            throw new Error(`Carácter desconocido "${c}" en (${x}, ${y}).`);
          }
      }
    }
  }
  if (spawns !== 1) throw new Error(`El mapa debe tener exactamente un "P" (tiene ${spawns}).`);
  if (feathers > 3) throw new Error(`Hay ${feathers} plumas; el máximo es 3.`);

  for (const r of parsed.rects) addObject(r.cls, r.x * TILE, r.y * TILE, r.w * TILE, r.h * TILE, r.props);
  for (const p of parsed.points) addObject(p.cls, px(p.x), py(p.y), 0, 0, p.props, true);

  let layerId = 1;
  const tileLayer = (name) => ({ id: layerId++, name, type: 'tilelayer', x: 0, y: 0, width, height, opacity: 1, visible: true, data: data[name] });
  const layers = Object.keys(data).map(tileLayer);
  layers.push({ id: layerId++, name: 'Objects', type: 'objectgroup', draworder: 'topdown', x: 0, y: 0, opacity: 1, visible: true, objects });

  return {
    type: 'map',
    version: MAP_VERSION,
    tiledversion: TILED_VERSION,
    orientation: 'orthogonal',
    renderorder: 'right-down',
    infinite: false,
    compressionlevel: -1,
    width,
    height,
    tilewidth: TILE,
    tileheight: TILE,
    nextlayerid: layerId,
    nextobjectid: nextId,
    properties: [prop('biome', biome)],
    layers,
    tilesets: [
      {
        firstgid: 1,
        name: biome,
        image: options.tilesetImage ?? `../tiles/${biome}.png`,
        imagewidth: TILE * TILESET_COLUMNS,
        imageheight: TILE * TILESET_ROWS,
        columns: TILESET_COLUMNS,
        tilecount: TILESET_COLUMNS * TILESET_ROWS,
        tilewidth: TILE,
        tileheight: TILE,
        margin: 0,
        spacing: 0,
      },
    ],
  };
}
