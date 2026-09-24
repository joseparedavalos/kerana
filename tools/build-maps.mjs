// Convierte tools/levels/*.txt en public/assets/maps/*.json (GDD §11.7).
// Uso: npm run maps [-- id1 id2]
// Los niveles con mapSource: 'tiled' en src/data/levels.ts se saltan (el autor los edita en Tiled).
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildTiledMap, parseAscii } from './lib/ascii-map.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC_DIR = join(ROOT, 'tools', 'levels');
const OUT_DIR = join(ROOT, 'public', 'assets', 'maps');

// Lee levels.ts como texto para encontrar los mapas editados en Tiled.
function tiledLevels() {
  try {
    const src = readFileSync(join(ROOT, 'src', 'data', 'levels.ts'), 'utf8');
    const ids = new Set();
    const re = /id:\s*'(\w+)'[\s\S]*?mapSource:\s*'(ascii|tiled)'/g;
    let m;
    while ((m = re.exec(src))) if (m[2] === 'tiled') ids.add(m[1]);
    return ids;
  } catch {
    return new Set();
  }
}

const only = process.argv.slice(2);
const skip = tiledLevels();
mkdirSync(OUT_DIR, { recursive: true });
let failed = false;
for (const file of readdirSync(SRC_DIR).filter((f) => f.endsWith('.txt'))) {
  const id = basename(file, '.txt');
  if (only.length && !only.includes(id)) continue;
  if (skip.has(id)) {
    console.log(`= ${id}: mapSource 'tiled', no se regenera`);
    continue;
  }
  try {
    const parsed = parseAscii(readFileSync(join(SRC_DIR, file), 'utf8'));
    for (const w of parsed.warnings) console.warn(`! ${id}: ${w}`);
    const map = buildTiledMap(parsed);
    writeFileSync(join(OUT_DIR, `${id}.json`), JSON.stringify(map));
    console.log(`+ ${id}.json (${parsed.width}×${parsed.height}, ${map.layers.at(-1).objects.length} objetos)`);
  } catch (err) {
    failed = true;
    console.error(`✗ ${id}: ${err.message}`);
  }
}
if (failed) process.exit(1);
