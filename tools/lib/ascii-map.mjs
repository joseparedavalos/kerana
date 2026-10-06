// Parser de mapas ASCII → Tiled JSON (GDD §11.7). Lógica pura, sin E/S.
//
// Objetos de motor (S18), además de la tabla de GDD §11.7.1:
//   -  plataforma móvil de un solo sentido (Mover)   +  plataforma móvil sólida (Mover solid=true)
//      Los - (o +) seguidos de una fila son una plataforma; su recorrido se dibuja con ":" pegados a ella,
//      a la derecha o a la izquierda (horizontal) o arriba o abajo de su primer tile (vertical):
//      "---:::::" va 5 tiles a la derecha y vuelve. Va y viene sola salvo que diga mode=run|toggle.
//   |  reja (Gate): los | seguidos de una columna son una reja; la abre un Switch.
//   *  disparador (Switch): piedra de 1 tile que se enciende con el sable o con la onda de luz.
//   Propiedades por objeto con la línea de cabecera "at X,Y clave=valor…" (X, Y: cualquier tile del objeto):
//     Mover:   id=… speed=px/s waitMs=… mode=loop|run|toggle solid=true|false
//     Gate:    id=…
//     Switch:  target=<id de una reja o un Mover> (obligatorio) ms=<0 permanente | ms encendido>
//     Bouncer: kind=once (un solo uso) | kind=sleep (dormido hasta un tajo cargado)
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

  const result = { name: '', width: 0, height: 0, biome: 'cerro', enemies: {}, signs: {}, rects: [], points: [], ats: [], grid: [], warnings: [] };

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
      case 'at': {
        // Propiedades para el objeto de la grilla que ocupa el tile (x, y).
        const m = /^(\d+),(\d+)$/.exec(rest[0] ?? '');
        if (!m) throw new Error(`"at" inválido (se espera "at X,Y clave=valor"): ${line}`);
        const props = Object.fromEntries(Object.entries(parsePairs(rest.slice(1))).map(([k, v]) => [k, parseValue(v)]));
        result.ats.push({ x: Number(m[1]), y: Number(m[2]), props });
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
 * Recorrido de una plataforma móvil de `len` tiles que empieza en (x, y): los ":" pegados a la derecha,
 * a la izquierda, abajo o arriba de su primer tile. Devuelve el desplazamiento en tiles (uno de los dos es 0).
 */
export function moverTrack(grid, x, y, len) {
  const at = (cx, cy) => grid[cy]?.[cx];
  const run = (cx, cy, sx, sy) => {
    let n = 0;
    while (at(cx + sx * (n + 1), cy + sy * (n + 1)) === ':') n++;
    return n;
  };
  const tracks = [
    { dx: run(x + len - 1, y, 1, 0), dy: 0 },
    { dx: -run(x, y, -1, 0), dy: 0 },
    { dx: 0, dy: run(x, y, 0, 1) },
    { dx: 0, dy: -run(x, y, 0, -1) },
  ].filter((t) => t.dx !== 0 || t.dy !== 0);
  if (tracks.length === 0) throw new Error(`Plataforma móvil en (${x}, ${y}) sin recorrido: dibujalo con ":" pegados a ella.`);
  if (tracks.length > 1) throw new Error(`Plataforma móvil en (${x}, ${y}) con ":" en más de un lado.`);
  // -0 → 0 (para que el JSON y los tests no vean "-0").
  return { dx: tracks[0].dx || 0, dy: tracks[0].dy || 0 };
}

/** Líneas "at X,Y …": suman (o pisan) propiedades del objeto de la grilla que ocupa ese tile. */
function applyAts(objects, ats, prop) {
  for (const a of ats) {
    const cx = a.x * TILE + TILE / 2;
    const cy = a.y * TILE + TILE / 2;
    const obj = objects.find((o) => !o.point && cx >= o.x && cx < o.x + o.width && cy >= o.y && cy < o.y + o.height);
    if (!obj) throw new Error(`"at ${a.x},${a.y}": no hay ningún objeto de la grilla en ese tile.`);
    const list = obj.properties ?? [];
    for (const [k, v] of Object.entries(a.props)) {
      const i = list.findIndex((p) => p.name === k);
      if (i >= 0) list[i] = prop(k, v);
      else list.push(prop(k, v));
    }
    obj.properties = list;
  }
}

/** Cada Switch nombra un objetivo (`target`) que tiene que existir como `id` de una reja o un Mover. */
function checkSwitchLinks(objects, warnings) {
  const val = (o, k) => o.properties?.find((p) => p.name === k)?.value;
  const ids = new Set(objects.filter((o) => o.type === 'Gate' || o.type === 'Mover').map((o) => val(o, 'id')).filter((v) => v !== undefined).map(String));
  const used = new Set();
  for (const o of objects.filter((o) => o.type === 'Switch')) {
    const target = val(o, 'target');
    const where = `(${o.x / TILE}, ${o.y / TILE})`;
    if (target === undefined) throw new Error(`Switch en ${where} sin "target": agregá "at ${o.x / TILE},${o.y / TILE} target=<id>".`);
    if (!ids.has(String(target))) throw new Error(`Switch en ${where}: no hay reja ni Mover con id "${target}".`);
    used.add(String(target));
  }
  for (const o of objects.filter((o) => o.type === 'Gate' && !used.has(String(val(o, 'id'))))) {
    warnings.push(`Reja en (${o.x / TILE}, ${o.y / TILE}) sin ningún Switch: queda cerrada.`);
  }
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
        case 'S': {
          // Camalote sobre el agua: los "S" seguidos de una fila forman un solo objeto.
          data.Water[i] = gid(TILES.waterSurface);
          if (grid[y][x - 1] === 'S') break;
          let len = 1;
          while (grid[y][x + len] === 'S') len++;
          addObject('Sinking', x * TILE, y * TILE, len * TILE, TILE);
          break;
        }
        case 'M':
        case 'R': {
          // Hongo que rebota (M) o rama que se quiebra (R): los seguidos de una fila forman un solo objeto.
          if (grid[y][x - 1] === c) break;
          let len = 1;
          while (grid[y][x + len] === c) len++;
          addObject(c === 'M' ? 'Bouncer' : 'Crumble', x * TILE, y * TILE, len * TILE, TILE);
          break;
        }
        case '-':
        case '+': {
          // Plataforma móvil: los seguidos de una fila forman una; el recorrido son los ":" pegados.
          if (grid[y][x - 1] === c) break;
          let len = 1;
          while (grid[y][x + len] === c) len++;
          const { dx, dy } = moverTrack(grid, x, y, len);
          addObject('Mover', x * TILE, y * TILE, len * TILE, TILE, c === '+' ? { dx, dy, solid: true } : { dx, dy });
          break;
        }
        case ':':
          // Recorrido de una plataforma móvil: vacío.
          break;
        case '|': {
          // Reja: los | seguidos de una columna forman una.
          if (y > 0 && grid[y - 1][x] === '|') break;
          let len = 1;
          while (y + len < height && grid[y + len][x] === '|') len++;
          addObject('Gate', x * TILE, y * TILE, TILE, len * TILE);
          break;
        }
        case '*':
          addObject('Switch', x * TILE, y * TILE, TILE, TILE);
          break;
        case 'H':
          // Capa Foreground: se dibuja delante de Kerana y no choca (patios escondidos, GDD §6.4).
          data.Foreground[i] = gid(TILES.groundBase + 15);
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

  applyAts(objects, parsed.ats ?? [], prop);
  for (const r of parsed.rects) addObject(r.cls, r.x * TILE, r.y * TILE, r.w * TILE, r.h * TILE, r.props);
  for (const p of parsed.points) addObject(p.cls, px(p.x), py(p.y), 0, 0, p.props, true);
  checkSwitchLinks(objects, parsed.warnings);

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
