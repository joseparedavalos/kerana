import { describe, expect, it } from 'vitest';
import { GAMEPLAY } from '../src/config/gameplay';
import { BOSS_LEVEL_TRACKS, TRACKS, type MusicKey } from '../src/data/music';
import { MUSIC_FILES } from '../src/data/musicFiles';
import { crossfadeCurves, longestBelow, loopDue } from '../src/systems/musicLoopLogic';
import { musicFolder } from '../tools/lib/mp3-info.mjs';
import { musicPoints } from '../tools/lib/music-points.mjs';

// S119: la música en archivo suena en streaming con un bucle sin cortes. La tabla de src/data/musicFiles.ts (inicio,
// comienzo del fundido final y duración de cada pista) la escribe `npm run music-points`; acá se compara con los MP3
// de la carpeta, sin ffmpeg: los mismos archivos, el mismo tamaño y la duración contando los cuadros del MP3.

const folder: { name: string; bytes: number; info: { duration: number } | null }[] = musicFolder();
const files = folder.map((f) => f.name);
const table = Object.entries(MUSIC_FILES) as [MusicKey, NonNullable<(typeof MUSIC_FILES)[MusicKey]>][];
const crossfade = GAMEPLAY.audio.loopCrossfadeMs / 1000;
const RERUN = 'si cambió un MP3, corré `npm run music-points`';

describe('la tabla de las pistas en archivo (S119)', () => {
  it('tiene una fila por cada MP3 de la carpeta, y ninguna más', () => {
    expect(table.map(([k]) => `${k}.mp3`).sort(), RERUN).toEqual(files);
  });

  it('cada fila es una pista del juego, que se puede generar si el archivo falla', () => {
    const bosses = BOSS_LEVEL_TRACKS.map((id) => `${id}_boss`);
    for (const [key] of table) {
      const base = key.endsWith('_boss') ? key.slice(0, -'_boss'.length) : key;
      expect(key in TRACKS || bosses.includes(key), key).toBe(true);
      expect(TRACKS[base as keyof typeof TRACKS], key).toBeDefined();
    }
  });

  it('las pistas sin archivo siguen generadas con ZzFX', () => {
    for (const key of ['title', 'map', 'liberation', 'seal', 'credits'] as const) {
      expect(MUSIC_FILES[key], key).toBeUndefined();
      expect(TRACKS[key], key).toBeDefined();
    }
  });

  it('el tamaño y la duración coinciden con cada archivo', () => {
    for (const [key, f] of table) {
      const file = folder.find((x) => x.name === `${key}.mp3`)!;
      expect(file.bytes, `${key}: ${RERUN}`).toBe(f.bytes);
      const info = file.info;
      expect(info, key).not.toBeNull();
      // Contar cuadros no descuenta el retardo del codificador (menos de dos cuadros).
      expect(Math.abs(info!.duration - f.duration), key).toBeLessThan(0.08);
    }
  });

  it('los puntos están en orden y el bucle cabe: el silencio del principio afuera, el fundido entero adentro', () => {
    for (const [key, f] of table) {
      expect(f.start, key).toBeGreaterThanOrEqual(0);
      expect(f.start, key).toBeLessThan(1);
      expect(f.fadeStart - f.start, key).toBeGreaterThan(40);
      // Lo que queda después del punto del bucle alcanza para el fundido cruzado (el que sale no se corta en seco).
      expect(f.duration - f.fadeStart, key).toBeGreaterThan(crossfade);
      expect(f.duration - f.fadeStart, key).toBeLessThan(15);
    }
  });
});

describe('la medición de los puntos (tools/lib/music-points.mjs)', () => {
  // 0,5 s de silencio, 50 s de «música» (un tono con pulso), 8 s de fundido lineal y 2 s de silencio.
  const rate = 8000;
  const lead = 0.5;
  const body = 50;
  const fade = 8;
  const tail = 2;
  const n = Math.round((lead + body + fade + tail) * rate);
  const s = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / rate;
    if (t < lead || t >= lead + body + fade) continue;
    const pulse = 0.6 + 0.4 * Math.abs(Math.sin(Math.PI * 2 * t));
    const env = t < lead + body ? 1 : 1 - (t - lead - body) / fade;
    s[i] = 0.3 * pulse * env * Math.sin(2 * Math.PI * 220 * t);
  }
  const p = musicPoints(s, rate);

  it('encuentra dónde empieza a sonar', () => {
    expect(p.start).toBeGreaterThan(lead - 0.05);
    expect(p.start).toBeLessThanOrEqual(lead);
  });

  it('encuentra el comienzo del fundido: no corta música y cae en su primer quinto', () => {
    // La regla marca dónde ya bajó 1,5 dB: con un fundido lineal de 8 s, algo más de un segundo adentro.
    expect(p.fadeStart).toBeGreaterThan(lead + body - 0.25);
    expect(p.fadeStart).toBeLessThan(lead + body + 0.2 * fade);
  });

  it('el final del sonido y la duración', () => {
    expect(p.duration).toBeCloseTo(lead + body + fade + tail, 2);
    expect(p.end).toBeLessThanOrEqual(lead + body + fade + 0.01);
    expect(p.end).toBeGreaterThan(lead + body + fade - 1);
  });
});

describe('el bucle (src/systems/musicLoopLogic.ts)', () => {
  it('el fundido cruzado es de igual potencia: de 0 a 1 y de 1 a 0', () => {
    const { fadeIn, fadeOut } = crossfadeCurves(64);
    expect(fadeIn[0]).toBe(0);
    expect(fadeIn[63]).toBe(1);
    expect(fadeOut[0]).toBe(1);
    expect(fadeOut[63]).toBe(0);
    for (let i = 0; i < 64; i++) expect(fadeIn[i] ** 2 + fadeOut[i] ** 2).toBeCloseTo(1, 5);
  });

  it('entra en la vuelta siguiente al llegar al fundido, una sola vez', () => {
    expect(loopDue(52.9, 53, false)).toBe(false);
    expect(loopDue(53, 53, false)).toBe(true);
    expect(loopDue(53.5, 53, true)).toBe(false);
  });

  it('mide el hueco más largo por debajo de un nivel', () => {
    const series: [number, number][] = [
      [0, 1],
      [0.1, 0.001],
      [0.2, 0.001],
      [0.3, 1],
      [0.4, 0.001],
      [0.9, 0.001],
      [1.0, 1],
    ];
    expect(longestBelow(series, 0.01)).toBeCloseTo(0.5);
    expect(longestBelow([[0, 1]], 0.01)).toBe(0);
  });
});
