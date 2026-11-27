// Duración de un MP3 contando sus cuadros (S119), sin decodificar: para que el test compare la tabla de
// src/data/musicFiles.ts con los archivos sin depender de ffmpeg. Salta la etiqueta ID3v2 y el cuadro Xing/Info
// (que no trae audio). No descuenta el retardo del codificador (menos de dos cuadros, unos 50 ms).
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const BITRATES = {
  // [versión MPEG 1][capa III] y [versión MPEG 2 y 2.5][capa III], en kbit/s
  1: [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0],
  2: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0],
};
const RATES = { 1: [44100, 48000, 32000], 2: [22050, 24000, 16000], 25: [11025, 12000, 8000] };

/** `buf`: el archivo entero (Uint8Array). Devuelve { frames, sampleRate, duration } o null si no es MP3 capa III. */
export function mp3Info(buf) {
  let p = 0;
  if (buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33) {
    const size = ((buf[6] & 0x7f) << 21) | ((buf[7] & 0x7f) << 14) | ((buf[8] & 0x7f) << 7) | (buf[9] & 0x7f);
    p = 10 + size + (buf[5] & 0x10 ? 10 : 0);
  }
  let frames = 0;
  let sampleRate = 0;
  let samplesPerFrame = 0;
  let first = true;
  while (p + 4 <= buf.length) {
    if (buf[p] !== 0xff || (buf[p + 1] & 0xe0) !== 0xe0) {
      p++;
      continue;
    }
    const verBits = (buf[p + 1] >> 3) & 3; // 0: 2.5, 2: 2, 3: 1
    const layer = (buf[p + 1] >> 1) & 3; // 1: capa III
    const brIdx = buf[p + 2] >> 4;
    const srIdx = (buf[p + 2] >> 2) & 3;
    const pad = (buf[p + 2] >> 1) & 1;
    if (verBits === 1 || layer !== 1 || brIdx === 0 || brIdx === 15 || srIdx === 3) {
      p++;
      continue;
    }
    const ver = verBits === 3 ? 1 : verBits === 2 ? 2 : 25;
    const kbps = BITRATES[ver === 1 ? 1 : 2][brIdx];
    const sr = RATES[ver][srIdx];
    const spf = ver === 1 ? 1152 : 576;
    const len = Math.floor(((spf / 8) * kbps * 1000) / sr) + pad;
    if (first) {
      first = false;
      // El cuadro Xing/Info: la marca está después de la información lateral.
      const side = ver === 1 ? ((buf[p + 3] >> 6) === 3 ? 17 : 32) : (buf[p + 3] >> 6) === 3 ? 9 : 17;
      const tag = String.fromCharCode(...buf.subarray(p + 4 + side, p + 8 + side));
      if (tag === 'Xing' || tag === 'Info') {
        p += len;
        continue;
      }
    }
    frames++;
    sampleRate = sr;
    samplesPerFrame = spf;
    p += len;
  }
  if (!frames) return null;
  return { frames, sampleRate, duration: (frames * samplesPerFrame) / sampleRate };
}

/** Los MP3 de public/assets/audio/music/ (para el test): nombre, tamaño en bytes y lo que da `mp3Info`. */
export function musicFolder() {
  const dir = fileURLToPath(new URL('../../public/assets/audio/music/', import.meta.url));
  return readdirSync(dir)
    .filter((n) => n.endsWith('.mp3'))
    .sort()
    .map((name) => {
      const path = join(dir, name);
      return { name, bytes: statSync(path).size, info: mp3Info(new Uint8Array(readFileSync(path))) };
    });
}
