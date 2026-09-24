// Pipeline de sprites raw/ → public/assets/sprites/ (docs/ASSETS.md §2).
// raw/<id>/<anim>_<C>x<R>.png → sprites/<id>.png + .json; raw/<id>/<parte>/ → sprites/<id>_<parte>.*
// raw/backgrounds/*.png → backgrounds/ (360 px de alto); raw/portraits/*.png → portraits/ (96 × 96).
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PNG } from 'pngjs';
import { coverImage, parseSheetName, processCharacter, resizeImage } from './lib/sprite-pipeline.mjs';

const RAW = 'raw';
const OUT = 'public/assets';
const BACKGROUND_HEIGHT = 360;
const PORTRAIT_SIZE = 96;
const SPECIAL = new Set(['backgrounds', 'portraits']);

const readPng = (file) => {
  const png = PNG.sync.read(readFileSync(file));
  return { width: png.width, height: png.height, data: new Uint8Array(png.data.buffer, png.data.byteOffset, png.data.length) };
};
const writePng = (file, img) => {
  const png = new PNG({ width: img.width, height: img.height });
  png.data = Buffer.from(img.data.buffer, img.data.byteOffset, img.data.length);
  writeFileSync(file, PNG.sync.write(png));
};
const isDir = (p) => statSync(p).isDirectory();

/** Procesa una carpeta de hojas (personaje o parte). Devuelve false si no tiene hojas. */
function processFolder(dir, name) {
  const sheets = readdirSync(dir)
    .map((file) => ({ file, parsed: parseSheetName(file) }))
    .filter((s) => s.parsed)
    .map(({ file, parsed }) => ({ ...parsed, img: readPng(join(dir, file)) }));
  if (sheets.length === 0) return false;
  const cfgPath = join(dir, 'sprite.json');
  const config = existsSync(cfgPath) ? JSON.parse(readFileSync(cfgPath, 'utf8')) : {};
  const { image, meta, summary } = processCharacter(name, sheets, config);
  mkdirSync(join(OUT, 'sprites'), { recursive: true });
  writePng(join(OUT, 'sprites', `${name}.png`), image);
  writeFileSync(join(OUT, 'sprites', `${name}.json`), JSON.stringify(meta, null, 2) + '\n');
  console.log(`${name}:\n${summary.join('\n')}`);
  return true;
}

function processImages(sub, fn, label) {
  const dir = join(RAW, sub);
  if (!existsSync(dir)) return;
  mkdirSync(join(OUT, sub), { recursive: true });
  for (const file of readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.png'))) {
    const out = fn(readPng(join(dir, file)));
    writePng(join(OUT, sub, file), out);
    console.log(`${sub}/${file}: ${out.width}×${out.height} (${label})`);
  }
}

if (!existsSync(RAW)) {
  console.log('No hay carpeta raw/: nada que procesar.');
  process.exit(0);
}
for (const id of readdirSync(RAW)) {
  const dir = join(RAW, id);
  if (!isDir(dir) || SPECIAL.has(id)) continue;
  processFolder(dir, id);
  for (const part of readdirSync(dir)) {
    if (isDir(join(dir, part))) processFolder(join(dir, part), `${id}_${part}`);
  }
}
processImages('backgrounds', (img) => resizeImage(img, Math.round((img.width * BACKGROUND_HEIGHT) / img.height), BACKGROUND_HEIGHT), `${BACKGROUND_HEIGHT} px de alto`);
processImages('portraits', (img) => coverImage(img, PORTRAIT_SIZE, PORTRAIT_SIZE), `${PORTRAIT_SIZE}×${PORTRAIT_SIZE}`);
