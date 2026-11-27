// Generado por `npm run music-points` (tools/music-points.mjs, S119) desde public/assets/audio/music/: no editar a mano.
// Las pistas que suenan desde archivo, en streaming (AudioManager); las que no están acá se generan con ZzFX.
// `start`: dónde empieza a sonar (sin el silencio del principio). `fadeStart`: dónde empieza el fundido final; ahí
// la misma pista vuelve a entrar desde `start` con un fundido cruzado. `duration`: lo que dura el archivo (s).
// `bytes`: su tamaño; si cambia un MP3, tests/musicFiles.test.ts pide volver a correr el script.
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
  l1: { start: 0.33, fadeStart: 54.4, duration: 63.66, bytes: 1535566 },
  l1_boss: { start: 0.08, fadeStart: 63.15, duration: 66.847, bytes: 1612053 },
  l2: { start: 0.72, fadeStart: 54.85, duration: 62.616, bytes: 1510489 },
  l2_boss: { start: 0.05, fadeStart: 62.7, duration: 66.664, bytes: 1607664 },
  l3: { start: 0.37, fadeStart: 56.5, duration: 63.112, bytes: 1522401 },
  l3_boss: { start: 0.09, fadeStart: 59.45, duration: 66.247, bytes: 1597633 },
  l4: { start: 0.72, fadeStart: 54.2, duration: 62.72, bytes: 1512997 },
  l4_boss: { start: 0.03, fadeStart: 59.9, duration: 66.247, bytes: 1597633 },
  l5: { start: 0.38, fadeStart: 53.25, duration: 60.839, bytes: 1467857 },
  l5_boss: { start: 0.26, fadeStart: 56.2, duration: 65.75, bytes: 1585722 },
  l6: { start: 0.39, fadeStart: 53.95, duration: 61.936, bytes: 1494188 },
  l6_boss: { start: 0.05, fadeStart: 56.6, duration: 65.802, bytes: 1586975 },
  l7: { start: 0.39, fadeStart: 139.5, duration: 149.264, bytes: 3590045 },
  l7_boss: { start: 0.09, fadeStart: 177.05, duration: 181.473, bytes: 4363060 },
  tau: { start: 0.09, fadeStart: 169.85, duration: 176.536, bytes: 4244569 },
  yvaga: { start: 0.39, fadeStart: 110, duration: 119.928, bytes: 2885993 },
};
