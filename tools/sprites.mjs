// Pipeline de sprites raw/ → public/assets/sprites/ (docs/ASSETS.md §2).
// raw/<id>/<anim>_<C>x<R>.png → sprites/<id>.png + .json; raw/<id>/<parte>/ → sprites/<id>_<parte>.*
// raw/portraits/*.png → portraits/ (96 × 96). Los fondos (raw/backgrounds) los procesa `npm run backgrounds`.
// raw/props/*.png → props/ y raw/hud/*.png|jpg → ui/ (props e íconos de la interfaz; tamaños en raw/<carpeta>/sprite.json).
// raw/props/<carpeta>/*.png → props/<carpeta>.png + .json: un atlas por carpeta de props por bioma (S46).
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import jpeg from 'jpeg-js';
import { PNG } from 'pngjs';
import { coverImage, packAtlas, parseSheetName, processCharacter, processIcon, propFrameData, propName } from './lib/sprite-pipeline.mjs';

const RAW = 'raw';
const OUT = 'public/assets';
const PORTRAIT_SIZE = 96;
/** Carpetas de props e íconos → carpeta de salida en public/assets. */
const ICON_FOLDERS = { props: 'props', hud: 'ui' };
/** Ancho máximo de un atlas de props (px de textura): entra en cualquier GPU de celular. */
const ATLAS_MAX_WIDTH = 1024;
const SPECIAL = new Set(['backgrounds', 'portraits', ...Object.keys(ICON_FOLDERS)]);

const readPng = (file) => {
  const png = PNG.sync.read(readFileSync(file));
  return { width: png.width, height: png.height, data: new Uint8Array(png.data.buffer, png.data.byteOffset, png.data.length) };
};
const readJpg = (file) => {
  const img = jpeg.decode(readFileSync(file), { useTArray: true, formatAsRGBA: true, maxMemoryUsageInMB: 256 });
  return { width: img.width, height: img.height, data: new Uint8Array(img.data.buffer, img.data.byteOffset, img.data.length) };
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

/** Props e íconos: un PNG por imagen, recortado al dibujo y escalado a `size[nombre]` (unidades) × `detail`. */
function processIcons(sub, outSub) {
  const dir = join(RAW, sub);
  if (!existsSync(dir)) return;
  const cfgPath = join(dir, 'sprite.json');
  const config = existsSync(cfgPath) ? JSON.parse(readFileSync(cfgPath, 'utf8')) : {};
  mkdirSync(join(OUT, outSub), { recursive: true });
  for (const file of readdirSync(dir).filter((f) => /\.(png|jpe?g)$/i.test(f))) {
    const name = file.replace(/\.[^.]+$/, '');
    const img = /\.png$/i.test(file) ? readPng(join(dir, file)) : readJpg(join(dir, file));
    const opts = { ...config, size: config.size?.[name] ?? config.size?.default };
    const result = processIcon(img, opts);
    if (!result) {
      console.log(`${sub}/${file}: vacío, se omite`);
      continue;
    }
    writePng(join(OUT, outSub, `${name}.png`), result.image);
    console.log(`${sub}/${file} → ${outSub}/${name}.png: ${result.image.width}×${result.image.height} (detail ${config.detail ?? 1}, fondo ${result.background})`);
  }
}

/**
 * Props por bioma (S46): cada subcarpeta de raw/props es un atlas (props/<carpeta>.png + .json, formato JSON Hash
 * de Phaser). Cada PNG pasa por el mismo proceso que un prop suelto; `size.<nombre>` da su tamaño en unidades,
 * `sheets.<nombre>.ignore` lo deja afuera; `hang` (cuelga del techo), `sink` y `waterOnly` (S47, hundido) y `flow`,
 * `splash` y `mist` (S47, agua animada) van en el frame del atlas (`propFrameData`).
 */
function processPropAtlases() {
  const dir = join(RAW, 'props');
  if (!existsSync(dir)) return;
  for (const folder of readdirSync(dir).filter((f) => isDir(join(dir, f))).sort()) {
    const sub = join(dir, folder);
    const cfgPath = join(sub, 'sprite.json');
    const config = existsSync(cfgPath) ? JSON.parse(readFileSync(cfgPath, 'utf8')) : {};
    const entries = [];
    for (const file of readdirSync(sub).filter((f) => /\.png$/i.test(f)).sort()) {
      const name = propName(file);
      const sheet = config.sheets?.[name] ?? {};
      if (sheet.ignore) {
        console.log(`props/${folder}/${file}: ignorado (sheets.${name}.ignore)`);
        continue;
      }
      // S50: `sheets.<nombre>.edge` y `edgePasses` reemplazan los de la carpeta para un solo prop (el fleco blanco del charco)
      const edge = { edge: sheet.edge ?? config.edge, edgePasses: sheet.edgePasses ?? config.edgePasses };
      const result = processIcon(readPng(join(sub, file)), { ...config, ...edge, size: config.size?.[name] ?? config.size?.default });
      if (!result) {
        console.log(`props/${folder}/${file}: vacío, se omite`);
        continue;
      }
      entries.push({ name, image: result.image, data: propFrameData(sheet) });
    }
    if (entries.length === 0) continue;
    const { image, frames } = packAtlas(entries, ATLAS_MAX_WIDTH);
    const detail = config.detail ?? 1;
    const json = {
      frames: Object.fromEntries(
        entries.map(({ name, data }) => {
          const { x, y, w, h } = frames[name];
          const frame = { frame: { x, y, w, h }, rotated: false, trimmed: false, spriteSourceSize: { x: 0, y: 0, w, h }, sourceSize: { w, h } };
          return [name, { ...frame, ...data }];
        }),
      ),
      meta: { image: `${folder}.png`, format: 'RGBA8888', size: { w: image.width, h: image.height }, scale: '1', detail },
    };
    mkdirSync(join(OUT, 'props'), { recursive: true });
    writePng(join(OUT, 'props', `${folder}.png`), image);
    writeFileSync(join(OUT, 'props', `${folder}.json`), JSON.stringify(json, null, 2) + '\n');
    const sizes = entries.map(({ name, image: img }) => `${name} ${img.width / detail}×${img.height / detail}`).join(', ');
    console.log(`props/${folder}.png: ${image.width}×${image.height}, ${entries.length} props (unidades: ${sizes})`);
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
for (const [sub, outSub] of Object.entries(ICON_FOLDERS)) processIcons(sub, outSub);
processPropAtlases();
processImages('portraits', (img) => coverImage(img, PORTRAIT_SIZE, PORTRAIT_SIZE), `${PORTRAIT_SIZE}×${PORTRAIT_SIZE}`);
