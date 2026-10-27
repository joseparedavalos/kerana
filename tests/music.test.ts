import { beforeAll, describe, expect, it } from 'vitest';
import { GAMEPLAY } from '../src/config/gameplay';
import { LEVELS } from '../src/data/levels';
import { BOSS_LAYER, BOSS_LEVEL_TRACKS, bossTrack, INSTRUMENTS, levelTrack, liberationTrack, TRACKS, type TrackId } from '../src/data/music';
import { applyEcho, bossVariant, darkenPattern, keepHead, loopSeconds, normalize, parsePattern, peak, renderTrack, rms, trackSteps, type Synth } from '../src/systems/musicLogic';

// S37: la música generada por código. ZzFX crea un AudioContext al importarse: en Node se le da uno de mentira.
let zzfxBuild: Synth;
beforeAll(async () => {
  (globalThis as unknown as { AudioContext: unknown }).AudioContext ??= class {};
  const { ZZFX } = await import('zzfx');
  zzfxBuild = (params) => {
    const rate = ZZFX.sampleRate;
    ZZFX.sampleRate = GAMEPLAY.audio.musicSampleRate;
    try {
      return ZZFX.buildSamples(...params);
    } finally {
      ZZFX.sampleRate = rate;
    }
  };
});

const IDS = Object.keys(TRACKS) as TrackId[];

describe('parsePattern', () => {
  it('lee notas, silencios, ligaduras, acordes y acentos; `|` no cuenta como paso', () => {
    const p = parsePattern('0 - . 4+7 | x! -3 - -');
    expect(p.steps).toBe(8);
    expect(p.notes).toEqual([
      { step: 0, length: 2, semis: [0], accent: false },
      { step: 3, length: 1, semis: [4, 7], accent: false },
      { step: 4, length: 1, semis: [0], accent: true },
      { step: 5, length: 3, semis: [-3], accent: false },
    ]);
  });

  it('un `-` después de un silencio no alarga nada', () => {
    expect(parsePattern('. - 0').notes).toEqual([{ step: 2, length: 1, semis: [0], accent: false }]);
  });

  it('rechaza tokens que no entiende', () => {
    expect(() => parsePattern('0 do 4')).toThrow(/do/);
  });
});

describe('las trece pistas', () => {
  it('son título, mapa, l1 a l7, Yvága y (S61) la pelea con Tau, la liberación y el sellado', () => {
    expect([...IDS].sort()).toEqual(['l1', 'l2', 'l3', 'l4', 'l5', 'l6', 'l7', 'liberation', 'map', 'seal', 'tau', 'title', 'yvaga']);
  });

  it.each(IDS)('%s: cada voz entra justa en el bucle, con instrumentos que existen', (id) => {
    const def = TRACKS[id];
    const steps = trackSteps(def);
    expect(steps % (def.stepsPerBeat * def.beatsPerBar)).toBe(0);
    for (const v of def.voices) {
      expect(INSTRUMENTS[v.inst], v.inst).toBeDefined();
      expect(steps % parsePattern(v.pattern).steps, `${id}/${v.inst}`).toBe(0);
    }
    // Ni tan corto que canse ni tan largo que pese en memoria.
    expect(loopSeconds(def)).toBeGreaterThan(8);
    expect(loopSeconds(def)).toBeLessThan(40);
  });

  it.each(IDS)('%s: las notas quedan en un registro que se oye (40 Hz a 2,5 kHz)', (id) => {
    const def = TRACKS[id];
    for (const v of def.voices) {
      const inst = INSTRUMENTS[v.inst];
      for (const n of parsePattern(v.pattern).notes) {
        for (const s of n.semis) {
          const hz = (inst.freq ?? def.root) * 2 ** ((s + (v.octave ?? 0)) / 12);
          expect(hz, `${id}/${v.inst} ${s}`).toBeGreaterThan(40);
          expect(hz, `${id}/${v.inst} ${s}`).toBeLessThan(2500);
        }
      }
    }
  });

  it('cada una se distingue: ninguna comparte tónica, pulso y compás con otra', () => {
    const signatures = IDS.map((id) => {
      const d = TRACKS[id];
      return `${d.root}|${d.bpm}|${d.stepsPerBeat}x${d.beatsPerBar}`;
    });
    expect(new Set(signatures).size).toBe(IDS.length);
  });
});

describe('variante de jefe (S61)', () => {
  const bossOf = (id: TrackId) => bossVariant(TRACKS[id], BOSS_LAYER, INSTRUMENTS);

  it('baja medio tono la tercera, la sexta y la séptima mayores, en todas las octavas y en los acordes', () => {
    expect(darkenPattern('0 4 7 . 9 - 11 16 -1 | -7+-5+-1 x!', [4, 9, 11])).toBe('0 3 7 . 8 - 10 15 -2 | -7+-5+-2 x!');
  });

  it('la melodía conserva solo su primera frase', () => {
    expect(keepHead('1 2 | 3 4 | 5 6 | 7 8', 2, 0.5)).toBe('1 2 3 4 . . . .');
    expect(keepHead('1 2 | 3 4 | 5 6', 2, 0.5)).toBe('1 2 3 4 . .');
    expect(keepHead('1 2', 2, 0.5)).toBe('1 2');
  });

  it.each(BOSS_LEVEL_TRACKS)('%s: más rápida, con la percusión del nivel intacta y tres voces más que entran justas', (id) => {
    const base = TRACKS[id];
    const boss = bossOf(id);
    expect(boss.id).toBe(`${id}_boss`);
    expect(boss.bpm).toBeCloseTo(base.bpm * 1.25);
    expect(boss.voices.length).toBe(base.voices.length + 3);
    base.voices.forEach((v, i) => {
      expect(boss.voices[i].inst).toBe(v.inst);
      if (INSTRUMENTS[v.inst].freq !== undefined) expect(boss.voices[i]).toEqual(v);
    });
    const steps = trackSteps(boss);
    expect(steps).toBe(trackSteps(base));
    for (const v of boss.voices) expect(steps % parsePattern(v.pattern).steps).toBe(0);
    const bass = boss.voices[boss.voices.length - 1];
    const hz = base.root * 2 ** ((bass.octave ?? 0) / 12);
    expect(hz).toBeGreaterThanOrEqual(BOSS_LAYER.bassLowHz);
    expect(hz).toBeLessThan(BOSS_LAYER.bassLowHz * 2);
  });

  it.each(BOSS_LEVEL_TRACKS)('%s: menos melódica, más grave y más golpeada que el recorrido', (id) => {
    const base = TRACKS[id];
    const boss = bossOf(id);
    // Notas por vuelta de las voces elegidas (una voz corta se repite hasta llenar el bucle).
    const count = (def: typeof base, pick: (inst: string, lead: boolean) => boolean) =>
      def.voices
        .filter((v) => pick(v.inst, !!v.lead))
        .reduce((n, v) => n + parsePattern(v.pattern).notes.length * (trackSteps(def) / parsePattern(v.pattern).steps), 0);
    const leadNotes = (def: typeof base) => count(def, (_, lead) => lead);
    const hits = (def: typeof base) => count(def, (inst) => INSTRUMENTS[inst].freq !== undefined);
    expect(leadNotes(base), id).toBeGreaterThan(0);
    expect(leadNotes(boss)).toBeLessThanOrEqual(leadNotes(base) * 0.6);
    expect(hits(boss)).toBeGreaterThanOrEqual(hits(base) + trackSteps(base) / 2);
    const lowest = (def: typeof base) =>
      Math.min(...def.voices.filter((v) => v.lead).flatMap((v) => parsePattern(v.pattern).notes.flatMap((n) => n.semis.map((x) => x + (v.octave ?? 0)))));
    expect(lowest(boss)).toBeLessThan(lowest(base));
  });
});

describe('qué suena dónde', () => {
  it('cada nivel tiene su pista, su pelea y su liberación; Tau pelea con la suya y se sella; las salas de prueba usan la de l1', () => {
    for (const level of Object.values(LEVELS)) {
      const track = levelTrack(level.id);
      expect(TRACKS[track], level.id).toBeDefined();
      expect(bossTrack(level.id)).toBe(level.id === 'yvaga' ? 'tau' : `${track}_boss`);
      expect(liberationTrack(level.id)).toBe(level.id === 'yvaga' ? 'seal' : 'liberation');
    }
    expect(levelTrack('test')).toBe('l1');
    expect(levelTrack('l7')).toBe('l7');
    expect(levelTrack('yvaga')).toBe('yvaga');
  });
});

describe('renderTrack', () => {
  const tiny = {
    id: 'tiny',
    bpm: 60,
    stepsPerBeat: 1,
    beatsPerBar: 4,
    root: 100,
    voices: [{ inst: 'p', pattern: '0 . . .' }],
  };

  it('la cola de una nota que pasa el final vuelve al principio (el bucle no se corta)', async () => {
    const rate = 10;
    // Cada nota: 10 muestras de 1 (un segundo a 10 Hz); el bucle dura 4 s = 40 muestras.
    const synth: Synth = () => new Array(10).fill(1);
    const out = await renderTrack({ ...tiny, voices: [{ inst: 'p', pattern: '. . . 0' }] }, { p: { params: [1] } }, synth, { sampleRate: rate });
    expect(out.length).toBe(40);
    expect(out[30]).toBe(1);
    expect(out[39]).toBe(1);
    expect(out[0]).toBe(0);
    const long: Synth = () => new Array(15).fill(1);
    const wrapped = await renderTrack({ ...tiny, voices: [{ inst: 'p', pattern: '. . . 0' }] }, { p: { params: [1] } }, long, { sampleRate: rate });
    expect(wrapped[0]).toBe(1);
    expect(wrapped[4]).toBe(1);
    expect(wrapped[5]).toBe(0);
  });

  it('las notas tenidas piden el sostenido de su largo; las pulsadas no', async () => {
    const seen: number[][] = [];
    const synth: Synth = (p) => {
      seen.push(p);
      return [0];
    };
    await renderTrack({ ...tiny, voices: [{ inst: 'h', pattern: '0 - - .' }, { inst: 'p', pattern: '0 - - .' }] }, { h: { hold: true, params: [1, 0, 0, 0.5] }, p: { params: [1, 0, 0, 0.5] } }, synth, { sampleRate: 10 });
    expect(seen[0][4]).toBeCloseTo(2.5); // 3 pasos de 1 s menos el ataque
    expect(seen[1][4]).toBe(0);
    expect(seen[0][2]).toBe(100);
  });

  it('falla claro si falta un instrumento', async () => {
    await expect(renderTrack(tiny, {}, () => [0], { sampleRate: 10 })).rejects.toThrow(/instrumento "p"/);
  });

  it('cede el hilo cada tanto mientras genera', async () => {
    let yields = 0;
    await renderTrack(TRACKS.l5, INSTRUMENTS, () => [0], { sampleRate: 100, notesPerSlice: 4, yieldEvery: () => void yields++ });
    expect(yields).toBeGreaterThan(3);
  });
});

describe('volumen parejo', () => {
  it('normalize lleva al RMS pedido', () => {
    const buf = Float32Array.from({ length: 1000 }, (_, i) => Math.sin(i / 5) * (i % 100 < 10 ? 2 : 1));
    normalize(buf, 0.25, 0.85);
    expect(rms(buf)).toBeCloseTo(0.25, 3);
  });

  it('normalize redondea los picos: nunca pasa de 1', () => {
    const buf = Float32Array.from({ length: 1000 }, (_, i) => (i % 100 === 0 ? 50 : Math.sin(i / 5) * 0.1));
    normalize(buf, 0.25, 0.85);
    expect(peak(buf)).toBeLessThanOrEqual(1);
    expect(peak(buf)).toBeGreaterThan(0.85);
  });

  it('el eco da la vuelta: el principio del bucle tiene la cola del final', () => {
    const buf = new Float32Array(100);
    buf[95] = 1;
    applyEcho(buf, 10, 0.5);
    expect(buf[5]).toBeCloseTo(0.5);
    expect(buf[15]).toBeCloseTo(0.25);
  });

  it('con ZzFX de verdad, las trece pistas y las peleas salen parejas, sin recortar y sin NaN', async () => {
    const levels: number[] = [];
    for (const id of IDS) {
      const defs = (BOSS_LEVEL_TRACKS as readonly string[]).includes(id) ? [TRACKS[id], bossVariant(TRACKS[id], BOSS_LAYER, INSTRUMENTS)] : [TRACKS[id]];
      for (const def of defs) {
        const samples = await renderTrack(def, INSTRUMENTS, zzfxBuild, { sampleRate: GAMEPLAY.audio.musicSampleRate });
        expect(samples.every(Number.isFinite), def.id).toBe(true);
        expect(rms(samples), `${def.id} suena`).toBeGreaterThan(0);
        normalize(samples, GAMEPLAY.audio.musicRms, GAMEPLAY.audio.musicCeiling);
        expect(peak(samples), def.id).toBeLessThanOrEqual(1);
        levels.push(rms(samples));
      }
    }
    // Dentro de 1,5 dB entre todas (los picos redondeados bajan un poco el RMS de las más golpeadas).
    const db = levels.map((l) => 20 * Math.log10(l));
    expect(Math.max(...db) - Math.min(...db)).toBeLessThan(1.5);
  }, 60000);
});
