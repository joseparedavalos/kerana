import { describe, expect, it } from 'vitest';
import { GAMEPLAY } from '../src/config/gameplay';
import { BIOMES } from '../src/data/types';
import { BIOME_FOOTSTEPS, FOOTSTEP_SOURCES, SAMPLE_DIR, SAMPLE_EXT, SFX_SAMPLES, sampleOutputs } from '../src/data/sfxSamples';
import { SFX_LAYERS, SFX_PRESETS, type SfxKey } from '../src/systems/sfxPresets';
import { gainFor, jitter, loudness, pickVariant, soundSpan, stepContact } from '../src/systems/sfxLogic';

const RATE = 44100;
// Los MP3 generados, como data URL (base64): el nombre y el peso.
const FILES = import.meta.glob('../public/assets/audio/sfx/*.mp3', { eager: true, query: '?inline', import: 'default' }) as Record<string, string>;
const fileBytes = (url: string) => Math.floor((url.length - url.indexOf(',') - 1) * 0.75);
const sine = (hz: number, sec: number, amp = 1) => Float32Array.from({ length: Math.round(sec * RATE) }, (_, i) => amp * Math.sin((2 * Math.PI * hz * i) / RATE));

describe('sonoridad (S106)', () => {
  it('un seno de 1 kHz a fondo de escala mide unos -3 LUFS, como en BS.1770', () => {
    expect(loudness(sine(997, 1), RATE)).toBeCloseTo(-3.01, 1);
  });

  it('a la mitad de amplitud, 6 dB menos; y un grave muy grave suena más bajo que un agudo del mismo pico', () => {
    expect(loudness(sine(997, 1), RATE) - loudness(sine(997, 1, 0.5), RATE)).toBeCloseTo(6.02, 1);
    expect(loudness(sine(30, 1), RATE)).toBeLessThan(loudness(sine(997, 1), RATE) - 3);
  });

  it('un efecto más corto que la ventana cuenta como más bajo; el silencio es -Infinity', () => {
    expect(loudness(sine(997, 0.1), RATE)).toBeLessThan(loudness(sine(997, 1), RATE) - 4);
    expect(loudness(new Float32Array(1000), RATE)).toBe(-Infinity);
  });

  it('la ganancia lleva de una sonoridad a otra', () => {
    const s = sine(997, 0.5, 0.2);
    const g = gainFor(loudness(s, RATE), -20);
    expect(loudness(s.map((v) => v * g), RATE)).toBeCloseTo(-20, 5);
    expect(gainFor(-Infinity, -20)).toBe(1);
  });
});

describe('recorte del silencio', () => {
  it('encuentra dónde empieza y termina, con 2 ms antes', () => {
    const s = new Float32Array(RATE);
    s.fill(0.5, 10000, 20000);
    const [a, b] = soundSpan(s, RATE);
    expect(a).toBe(10000 - Math.round(0.002 * RATE));
    expect(b).toBe(20000);
    expect(soundSpan(new Float32Array(100), RATE)).toEqual([0, 0]);
  });
});

describe('variantes y pasos', () => {
  it('nunca repite la variante anterior y las recorre todas', () => {
    for (const count of [2, 3, 5]) {
      const seen = new Set<number>();
      let prev = -1;
      for (let k = 0; k < 200; k++) {
        const i = pickVariant(count, prev, (k * 0.6180339) % 1);
        expect(i).toBeGreaterThanOrEqual(0);
        expect(i).toBeLessThan(count);
        if (prev >= 0) expect(i).not.toBe(prev);
        seen.add(i);
        prev = i;
      }
      expect(seen.size).toBe(count);
    }
    expect(pickVariant(1, 0, 0.9)).toBe(0);
    expect(pickVariant(4, -1, 0.999)).toBe(3);
  });

  it('el azar queda en el rango', () => {
    expect(jitter(1, 0.1, 0)).toBeCloseTo(0.9);
    expect(jitter(1, 0.1, 0.5)).toBeCloseTo(1);
    expect(jitter(1, 0.1, 0.9999)).toBeLessThan(1.1);
  });

  it('pisa al entrar en un cuadro de apoyo, una sola vez', () => {
    const contacts = GAMEPLAY.audio.footsteps.contactFrames;
    // Una vuelta de la animación de correr (cuadros 1 a 9) y el principio de la siguiente.
    const frames = [1, 1, 2, 3, 3, 3, 4, 5, 6, 7, 7, 8, 9, 1, 2, 3];
    let prev = -1;
    const steps: number[] = [];
    for (const f of frames) {
      if (stepContact(prev, f, contacts) >= 0) steps.push(f);
      prev = f;
    }
    expect(steps).toEqual([3, 7, 3]);
    for (const c of contacts) expect(c).toBeGreaterThanOrEqual(1);
  });
});

describe('datos de las grabaciones', () => {
  // Quedan en ZzFX: criaturas y lo mágico (pedido de S106).
  const STAY_ZZFX: SfxKey[] = [
    'growl', 'squawk', 'bark', 'moo', 'mooGuasu', 'howl', 'luisonHowl', 'hoot', 'laugh', 'buzz', 'jungleCall',
    'luzArasy', 'hypnosis', 'hornGlow', 'sparks', 'staffFlash', 'lightWave', 'chargeUp', 'chargeReady',
  ];

  it('cada grabación reemplaza un ZzFX que existe, y ninguna toca criaturas ni lo mágico', () => {
    for (const key of Object.keys(SFX_SAMPLES) as SfxKey[]) {
      expect(SFX_PRESETS[key], key).toBeDefined();
      expect(STAY_ZZFX).not.toContain(key);
    }
  });

  it('el brillo del tajo cargado existe si se lo pide', () => {
    for (const [key, def] of Object.entries(SFX_SAMPLES)) if (def?.zzfx === 'layers') expect(SFX_LAYERS[key as SfxKey], key).toBeDefined();
  });

  it('cada bioma tiene sus suelos, y cada suelo sus pasos', () => {
    for (const biome of BIOMES) {
      const s = BIOME_FOOTSTEPS[biome];
      expect(FOOTSTEP_SOURCES[s.ground].length, biome).toBeGreaterThan(1);
      expect(FOOTSTEP_SOURCES[s.platforms].length, biome).toBeGreaterThan(1);
    }
  });

  it('están todos los archivos (npm run sfx), sin sobrantes y por debajo de 1,5 MB', () => {
    const names = sampleOutputs().map((o) => o.name + SAMPLE_EXT);
    expect(new Set(names).size).toBe(names.length);
    const files = Object.keys(FILES).map((p) => p.slice(p.lastIndexOf('/') + 1));
    expect(SAMPLE_DIR).toBe('assets/audio/sfx/');
    expect(files.sort()).toEqual([...names].sort());
    const total = Object.values(FILES).reduce((sum, url) => sum + fileBytes(url), 0);
    expect(total).toBeGreaterThan(50 * 1024);
    expect(total).toBeLessThan(1.5 * 1024 * 1024);
  });
});
