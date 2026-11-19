// npm run sfx (S106): raw/audio/kenney/*.zip → public/assets/audio/sfx/*.mp3, solo los que lista src/data/sfxSamples.ts.
// Por archivo: decodifica (ffmpeg), pasa a mono 44,1 kHz, recorta el silencio del principio (deja 2 ms) y del final
// (con un fundido corto), lo lleva a la misma sonoridad que los demás (sin pasar el techo de pico) y lo codifica en MP3.
// Los originales no se tocan. Necesita ffmpeg con libmp3lame en el PATH y Node 22.18 o más (lee los .ts directo).
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import { basename, join } from 'node:path';
import { readZip } from './lib/zip.mjs';

const { SAMPLE_PACKS, SAMPLE_DIR, SAMPLE_EXT, sampleOutputs } = await import('../src/data/sfxSamples.ts');
const { loudness, soundSpan, gainFor } = await import('../src/systems/sfxLogic.ts');

const RAW = 'raw/audio/kenney';
const OUT = join('public', SAMPLE_DIR);
const RATE = 44100;
/** Sonoridad de todos los archivos (LUFS); el juego la corrige a la del ZzFX que reemplaza. */
const FILE_LUFS = -18;
/** Techo de pico (dBFS): si para llegar a `FILE_LUFS` hay que pasarlo, el archivo queda más bajo y el juego lo compensa. */
const PEAK_CEILING_DB = -1;
/** Fundido al final del recorte (s), para que no haga clic. */
const TAIL_FADE_SEC = 0.012;
/** MP3 mono a esta tasa: en efectos cortos no se distingue del original. */
const BITRATE = '96k';
/** Peso máximo de todo lo generado (bytes). */
const BUDGET = 1.5 * 1024 * 1024;

function ffmpeg(args, input) {
  return execFileSync('ffmpeg', ['-v', 'error', ...args], { input, maxBuffer: 1 << 28 });
}

const packs = new Map();
function entry(ref) {
  const [pack, name] = ref.split(':');
  if (!packs.has(pack)) {
    const zip = join(RAW, SAMPLE_PACKS[pack]);
    if (!existsSync(zip)) throw new Error(`falta ${zip}`);
    const byName = new Map();
    for (const [full, read] of readZip(zip)) if (full.endsWith('.ogg')) byName.set(basename(full, '.ogg'), read);
    packs.set(pack, byName);
  }
  const read = packs.get(pack).get(name);
  if (!read) throw new Error(`${ref}: no está en ${SAMPLE_PACKS[pack]}`);
  return read();
}

mkdirSync(OUT, { recursive: true });
const outputs = sampleOutputs();
const wanted = new Set(outputs.map((o) => o.name + SAMPLE_EXT));
let total = 0;
const rows = [];
for (const { name, source } of outputs) {
  const raw = ffmpeg(['-i', 'pipe:0', '-ac', '1', '-ar', String(RATE), '-f', 'f32le', 'pipe:1'], entry(source));
  const all = new Float32Array(raw.buffer, raw.byteOffset, raw.byteLength / 4);
  const [a, b] = soundSpan(all, RATE);
  const s = all.slice(a, b);
  const fade = Math.min(s.length, Math.round(TAIL_FADE_SEC * RATE));
  for (let i = 0; i < fade; i++) s[s.length - fade + i] *= 1 - (i + 1) / fade;
  const before = loudness(s, RATE);
  let peak = 0;
  for (const v of s) peak = Math.max(peak, Math.abs(v));
  const gain = Math.min(gainFor(before, FILE_LUFS), 10 ** (PEAK_CEILING_DB / 20) / Math.max(peak, 1e-9));
  for (let i = 0; i < s.length; i++) s[i] *= gain;
  const file = join(OUT, name + SAMPLE_EXT);
  ffmpeg(['-y', '-f', 'f32le', '-ar', String(RATE), '-ac', '1', '-i', 'pipe:0', '-c:a', 'libmp3lame', '-b:a', BITRATE, file], Buffer.from(s.buffer));
  const bytes = statSync(file).size;
  total += bytes;
  rows.push({ name, source, leadMs: Math.round((a / RATE) * 1000), sec: (s.length / RATE).toFixed(2), lufs: loudness(s, RATE).toFixed(1), kb: (bytes / 1024).toFixed(1) });
}

// Lo que ya no está en la lista se borra.
for (const f of readdirSync(OUT)) if (f.endsWith(SAMPLE_EXT) && !wanted.has(f)) unlinkSync(join(OUT, f));

console.table(rows);
console.log(`${rows.length} archivos, ${(total / 1024).toFixed(1)} KB (tope ${(BUDGET / 1024).toFixed(0)} KB)`);
if (total > BUDGET) {
  console.error('Se pasó del peso máximo: sacá variantes o bajá BITRATE.');
  process.exit(1);
}
