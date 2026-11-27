// npm run music-points (S119): mide cada MP3 de public/assets/audio/music/ y escribe src/data/musicFiles.ts, la tabla
// de las pistas que suenan desde archivo: dónde empiezan a sonar, dónde empieza su fundido final (el bucle vuelve a
// entrar ahí) y cuánto duran. Necesita ffmpeg en el PATH. Correlo cada vez que se agrega o se cambia un MP3:
// tests/musicFiles.test.ts falla si la tabla no coincide con los archivos de la carpeta.
import { execFileSync } from 'node:child_process';
import { readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { musicPoints } from './lib/music-points.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = join(ROOT, 'public', 'assets', 'audio', 'music');
const OUT = join(ROOT, 'src', 'data', 'musicFiles.ts');
const RATE = 44100;

function decode(file) {
  const buf = execFileSync('ffmpeg', ['-v', 'error', '-i', file, '-ac', '1', '-ar', String(RATE), '-f', 'f32le', '-'], {
    maxBuffer: 1 << 30,
  });
  return new Float32Array(buf.buffer, buf.byteOffset, buf.length / 4);
}

try {
  execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' });
} catch {
  console.error('music-points: falta ffmpeg en el PATH (https://ffmpeg.org/download.html).');
  process.exit(1);
}

const rows = [];
for (const name of readdirSync(DIR).filter((n) => n.endsWith('.mp3')).sort()) {
  const key = name.slice(0, -4);
  const p = musicPoints(decode(join(DIR, name)), RATE);
  rows.push({ key, ...p, bytes: statSync(join(DIR, name)).size });
}

const n = (x) => x.toFixed(3).replace(/\.?0+$/, '');
const lines = rows.map((r) => `  ${r.key}: { start: ${n(r.start)}, fadeStart: ${n(r.fadeStart)}, duration: ${n(r.duration)}, bytes: ${r.bytes} },`);
writeFileSync(
  OUT,
  `// Generado por \`npm run music-points\` (tools/music-points.mjs, S119) desde public/assets/audio/music/: no editar a mano.
// Las pistas que suenan desde archivo, en streaming (AudioManager); las que no están acá se generan con ZzFX.
// \`start\`: dónde empieza a sonar (sin el silencio del principio). \`fadeStart\`: dónde empieza el fundido final; ahí
// la misma pista vuelve a entrar desde \`start\` con un fundido cruzado. \`duration\`: lo que dura el archivo (s).
// \`bytes\`: su tamaño; si cambia un MP3, tests/musicFiles.test.ts pide volver a correr el script.
import type { MusicKey } from './music';

export interface MusicFile {
  start: number;
  fadeStart: number;
  duration: number;
  bytes: number;
}

/** Carpeta de las pistas en archivo, relativa a la página (como los demás assets). */
export const MUSIC_DIR = 'assets/audio/music/';

export const MUSIC_FILES: Partial<Record<MusicKey, MusicFile>> = {
${lines.join('\n')}
};
`,
);

console.log('pista        inicio  fundido  duración  fundido→fin  silencio final');
for (const r of rows) {
  console.log(
    `${r.key.padEnd(12)} ${r.start.toFixed(2).padStart(6)} ${r.fadeStart.toFixed(2).padStart(8)} ${r.duration.toFixed(2).padStart(9)} ${(r.duration - r.fadeStart).toFixed(2).padStart(12)} ${(r.duration - r.end).toFixed(2).padStart(15)}`,
  );
}
console.log(`→ ${OUT}`);
