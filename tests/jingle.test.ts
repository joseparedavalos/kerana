import { beforeAll, describe, expect, it } from 'vitest';
import { GAMEPLAY } from '../src/config/gameplay';
import { INSTRUMENTS, JINGLES, TRACKS } from '../src/data/music';
import { SFX_SAMPLES } from '../src/data/sfxSamples';
import { applyEcho, fadeTail, loopSeconds, parsePattern, peak, renderJingle, trackSteps, type JingleDef, type Synth } from '../src/systems/musicLogic';
import { loudness, soundSpan } from '../src/systems/sfxLogic';
import { SFX_PRESETS, type SfxKey } from '../src/systems/sfxPresets';

// S107: el jingle de la estrella, generado con los instrumentos de la música. ZzFX crea un AudioContext al importarse:
// en Node se le da uno de mentira.
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

const JINGLE = JINGLES.liberation!;

/** Las notas de una voz, en orden: paso y semitonos (sin la octava de la voz). */
function notesOf(def: { voices: { inst: string; pattern: string }[] }, inst: string) {
  return def.voices.filter((v) => v.inst === inst).flatMap((v) => parsePattern(v.pattern).notes);
}

describe('renderJingle', () => {
  const tiny: JingleDef = { id: 'tiny', bpm: 60, stepsPerBeat: 1, beatsPerBar: 4, root: 100, fadeMs: 0, voices: [{ inst: 'p', pattern: '. . . 0' }] };

  it('sin bucle: la cola que pasa el final se pierde y el principio queda en silencio', async () => {
    // Cada nota: 15 muestras de 1 a 10 Hz; la pieza dura 4 s = 40 muestras y la nota empieza en la 30.
    const out = await renderJingle(tiny, { p: { params: [1] } }, () => new Array(15).fill(1), { sampleRate: 10 });
    expect(out.length).toBe(40);
    expect(out[0]).toBe(0);
    expect(out[4]).toBe(0);
    expect(out[30]).toBe(1);
    expect(out[39]).toBe(1);
  });

  it('el eco no da la vuelta y los últimos `fadeMs` se apagan hasta el silencio', async () => {
    const buf = new Float32Array(100);
    buf[95] = 1;
    applyEcho(buf, 10, 0.5, false);
    expect(buf[5]).toBe(0);
    const flat = new Float32Array(100).fill(1);
    fadeTail(flat, 20);
    expect(flat[79]).toBe(1);
    expect(flat[80]).toBeLessThan(1);
    expect(flat[80]).toBeGreaterThan(0.95);
    expect(flat[99]).toBeCloseTo(0, 6);
    // 500 ms a 10 Hz: las últimas 5 muestras.
    const out = await renderJingle({ ...tiny, fadeMs: 500 }, { p: { params: [1] } }, () => new Array(15).fill(1), { sampleRate: 10 });
    expect(out[34]).toBe(1);
    expect(out[35]).toBeLessThan(1);
    expect(out[39]).toBeCloseTo(0, 6);
  });
});

describe('el jingle de la estrella (S107)', () => {
  it("es el efecto 'liberation': ya no es grabado y tiene su preset de ZzFX para igualar la sonoridad", () => {
    expect(SFX_SAMPLES.liberation).toBeUndefined();
    for (const key of Object.keys(JINGLES) as SfxKey[]) expect(SFX_PRESETS[key], key).toBeDefined();
  });

  it('dura unos 3 s, con instrumentos que existen y voces que entran justas', () => {
    for (const v of JINGLE.voices) {
      expect(INSTRUMENTS[v.inst], v.inst).toBeDefined();
      expect(trackSteps(JINGLE) % parsePattern(v.pattern).steps).toBe(0);
    }
    expect(loopSeconds(JINGLE)).toBeGreaterThan(2.5);
    expect(loopSeconds(JINGLE)).toBeLessThan(3.5);
    expect(JINGLE.fadeMs / 1000).toBeLessThan(loopSeconds(JINGLE) / 2);
  });

  it("empalma con la pista 'liberation': su tónica, su tempo y su compás; dura su primer compás", () => {
    const track = TRACKS.liberation;
    expect(JINGLE.root).toBe(track.root);
    expect(JINGLE.bpm).toBe(track.bpm);
    expect(JINGLE.beatsPerBar).toBe(track.beatsPerBar);
    expect(loopSeconds(JINGLE)).toBeCloseTo((60 / track.bpm) * track.beatsPerBar, 6);
  });

  it('todo en sol mayor y sin fa♯: la cadencia es plagal y no choca con el fa del sellado de Tau', () => {
    const allowed = new Set([0, 2, 4, 5, 7, 9]);
    for (const v of JINGLE.voices) {
      if (INSTRUMENTS[v.inst].freq) continue; // percusión: sin altura
      for (const n of parsePattern(v.pattern).notes) for (const s of n.semis) expect(allowed.has((((s + (v.octave ?? 0)) % 12) + 12) % 12), `${v.inst} ${s}`).toBe(true);
    }
  });

  it("el arpa sube y, encima, siete campanas que suben con el motivo de 'yvaga'", () => {
    const harp = JINGLE.voices[0];
    expect(harp.inst).toBe('arpa');
    const up = parsePattern(harp.pattern).notes.map((n) => n.semis[0]);
    expect(up.length).toBeGreaterThanOrEqual(8);
    for (let i = 1; i < up.length; i++) expect(up[i]).toBeGreaterThan(up[i - 1]);
    const bells = notesOf(JINGLE, 'campana').map((n) => n.semis[0]);
    expect(bells).toHaveLength(7);
    const motif = notesOf(TRACKS.yvaga, 'campana').map((n) => n.semis[0]);
    expect(motif).toHaveLength(7);
    expect(bells.map((b) => b - bells[0])).toEqual(motif.map((m) => m - motif[0]));
    // Encima del arpa: cada campana es lo más agudo de lo que empieza desde ella hasta la siguiente.
    const bellOctave = JINGLE.voices.find((v) => v.inst === 'campana')!.octave ?? 0;
    const bellNotes = notesOf(JINGLE, 'campana');
    const harpNotes = notesOf(JINGLE, 'arpa');
    bellNotes.forEach((bell, i) => {
      const until = bellNotes[i + 1]?.step ?? Infinity;
      const around = harpNotes.filter((n) => n.step >= bell.step && n.step < until).flatMap((n) => n.semis);
      expect(bell.semis[0] + bellOctave, `campana ${i + 1}`).toBeGreaterThan(Math.max(...around));
    });
  });

  it('termina en un acorde de sol que entra con la séptima campana, en la tónica', () => {
    const onsets = JINGLE.voices.flatMap((v) => parsePattern(v.pattern).notes.map((n) => ({ v, n })));
    const lastStep = Math.max(...onsets.map((o) => o.n.step));
    const final = onsets.filter((o) => o.n.step === lastStep);
    const pcs = new Set(final.flatMap((o) => o.n.semis.map((s) => (((s + (o.v.octave ?? 0)) % 12) + 12) % 12)));
    expect([...pcs].sort((a, b) => a - b)).toEqual([0, 4, 7]);
    const lastBell = notesOf(JINGLE, 'campana').at(-1)!;
    expect(lastBell.step).toBe(lastStep);
    expect(lastBell.semis[0] % 12).toBe(0);
    // Le queda casi la mitad para apagarse.
    expect(lastStep / trackSteps(JINGLE)).toBeLessThan(0.6);
  });

  it('con ZzFX de verdad: empieza enseguida, el acorde final es lo más fuerte y termina en silencio', async () => {
    const rate = GAMEPLAY.audio.musicSampleRate;
    const s = await renderJingle(JINGLE, INSTRUMENTS, zzfxBuild, { sampleRate: rate });
    expect(s.every(Number.isFinite)).toBe(true);
    expect(s.length / rate).toBeCloseTo(loopSeconds(JINGLE), 2);
    expect(soundSpan(s, rate)[0] / rate).toBeLessThan(0.005);
    expect(Math.abs(s[s.length - 1])).toBeLessThan(1e-6);
    // Los últimos 100 ms, por lo menos 30 dB debajo del pico.
    expect(20 * Math.log10(peak(s.subarray(s.length - rate / 10)) / peak(s))).toBeLessThan(-30);
    // La ventana más fuerte (la que iguala la sonoridad) cae en el acorde final, no en el arpegio.
    const chordSec = (Math.max(...notesOf(JINGLE, 'campana').map((n) => n.step)) * 60) / JINGLE.bpm / JINGLE.stepsPerBeat;
    const chordIndex = Math.round(chordSec * rate);
    expect(loudness(s.subarray(chordIndex), rate)).toBeCloseTo(loudness(s, rate), 1);
    expect(loudness(s.subarray(0, chordIndex), rate)).toBeLessThan(loudness(s, rate) - 1);
  }, 30000);
});
