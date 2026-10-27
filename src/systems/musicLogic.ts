// Música generada por código (S37, GDD §10.2): lógica pura, sin Phaser ni Web Audio.
// Cada pista es un bucle de voces; cada voz, un patrón de texto con un paso por token.
// El sintetizador (ZzFX en el juego, uno falso en las pruebas) llega como parámetro.

/** Parámetros de ZzFX de un instrumento. La frecuencia (índice 2) la pone cada nota. */
export interface InstrumentDef {
  params: readonly number[];
  /** La nota dura lo que dice el patrón (sostenido = largo de la nota); si no, suena como un pulsado. */
  hold?: boolean;
  /** Percusión: frecuencia propia en Hz; el patrón la corre en semitonos, sin mirar la tónica de la pista. */
  freq?: number;
}

export interface VoiceDef {
  inst: string;
  /** Semitonos que se suman a todas las notas (12 = una octava arriba). */
  octave?: number;
  gain?: number;
  /** La melodía de la pieza: en la variante de jefe queda solo el motivo (S61). */
  lead?: boolean;
  /**
   * Un token por paso, separados por espacios; `|` separa compases y no cuenta.
   * `.` silencio · `-` sigue la nota anterior · número = semitonos sobre la tónica · `x` = 0 ·
   * `a+b+c` acorde · `!` al final, acento.
   */
  pattern: string;
}

export interface TrackDef {
  id: string;
  bpm: number;
  /** Pasos por pulso (2 = corcheas, 3 = tresillos). */
  stepsPerBeat: number;
  beatsPerBar: number;
  /** Tónica en Hz. */
  root: number;
  /** Eco del conjunto, que da la vuelta al final del bucle. */
  echo?: { ms: number; feedback: number };
  voices: VoiceDef[];
}

export interface NoteEvent {
  step: number;
  /** En pasos. */
  length: number;
  semis: number[];
  accent: boolean;
}

export interface Pattern {
  steps: number;
  notes: NoteEvent[];
}

const TOKEN = /^(-?\d+|x)(\+(-?\d+|x))*!?$/;

/** Lee un patrón. Lanza un error con el token si algo no se entiende (lo atrapa la prueba de datos). */
export function parsePattern(src: string): Pattern {
  const tokens = src.split(/[\s|]+/).filter(Boolean);
  const notes: NoteEvent[] = [];
  let last: NoteEvent | null = null;
  tokens.forEach((token, step) => {
    if (token === '.') {
      last = null;
      return;
    }
    if (token === '-') {
      if (last) last.length++;
      return;
    }
    if (!TOKEN.test(token)) throw new Error(`patrón: no entiendo "${token}"`);
    const accent = token.endsWith('!');
    const semis = (accent ? token.slice(0, -1) : token).split('+').map((s) => (s === 'x' ? 0 : Number(s)));
    last = { step, length: 1, semis, accent };
    notes.push(last);
  });
  return { steps: tokens.length, notes };
}

/** Pasos del bucle: el de la voz más larga. Las otras se repiten y tienen que entrar justas. */
export function trackSteps(def: TrackDef): number {
  return Math.max(...def.voices.map((v) => parsePattern(v.pattern).steps));
}

export function stepSeconds(def: Pick<TrackDef, 'bpm' | 'stepsPerBeat'>): number {
  return 60 / def.bpm / def.stepsPerBeat;
}

export function loopSeconds(def: TrackDef): number {
  return trackSteps(def) * stepSeconds(def);
}

/** Capa de jefe (S37, S61): la pieza del nivel más rápida, más grave, en menor y con percusión que empuja. */
export interface BossLayer {
  tempo: number;
  drum: string;
  pulse: string;
  bass: string;
  /** Octava del bajo: la tónica cae entre `bassLowHz` y el doble. */
  bassLowHz: number;
  gains: { drum: number; pulse: number; bass: number };
  /** Una voz con notas que no bajan de esto suena una octava más abajo. */
  dropAboveHz: number;
  /** La melodía conserva solo su primera frase (esta fracción de compases, para reconocer el lugar) y suena más bajo. */
  leadKeep: number;
  leadGain: number;
  /** Grados (semitonos sobre la tónica, 0 a 11) que bajan medio tono: tercera, sexta y séptima mayores → menor. */
  darken: readonly number[];
}

/**
 * Variante tensa de una pista: el acompañamiento y los timbres del nivel (se reconoce el lugar), pero más rápida,
 * más grave, en menor, con la melodía reducida a su primera frase y una capa de tambor, takuapu y bajo encima.
 */
export function bossVariant(def: TrackDef, layer: BossLayer, instruments: Record<string, InstrumentDef>): TrackDef {
  const bar = def.stepsPerBeat * def.beatsPerBar;
  const lastBeat = bar - def.stepsPerBeat;
  const drum: string[] = [];
  const pulse: string[] = [];
  const bass: string[] = [];
  // Dos compases: el segundo cierra con medio tono arriba de la tónica, que no deja descansar.
  for (let b = 0; b < 2; b++) {
    for (let i = 0; i < bar; i++) {
      const onBeat = i % def.stepsPerBeat === 0;
      drum.push(i === 0 ? 'x!' : onBeat || i === bar - 1 ? 'x' : '.');
      pulse.push(onBeat ? '.' : 'x');
      bass.push(i === 0 ? '0!' : i >= lastBeat ? (b === 0 ? '7' : '1') : '0');
    }
  }
  let octave = 0;
  while (def.root * 2 ** (octave / 12) >= layer.bassLowHz * 2) octave -= 12;
  while (def.root * 2 ** (octave / 12) < layer.bassLowHz) octave += 12;
  const voices = def.voices.map((v) => {
    if (instruments[v.inst]?.freq !== undefined) return v; // percusión: igual
    let pattern = darkenPattern(v.pattern, layer.darken);
    let gain = v.gain ?? 1;
    if (v.lead) {
      pattern = keepHead(pattern, bar, layer.leadKeep);
      gain *= layer.leadGain;
    }
    let vOctave = v.octave ?? 0;
    const low = Math.min(...parsePattern(pattern).notes.flatMap((n) => n.semis));
    if (Number.isFinite(low) && def.root * 2 ** ((low + vOctave) / 12) >= layer.dropAboveHz) vOctave -= 12;
    return { ...v, octave: vOctave, gain, pattern };
  });
  return {
    ...def,
    id: `${def.id}_boss`,
    bpm: def.bpm * layer.tempo,
    voices: [
      ...voices,
      { inst: layer.drum, gain: layer.gains.drum, pattern: drum.join(' ') },
      { inst: layer.pulse, gain: layer.gains.pulse, pattern: pulse.join(' ') },
      { inst: layer.bass, octave, gain: layer.gains.bass, pattern: bass.join(' ') },
    ],
  };
}

/** Baja medio tono los grados de `darken` en cada nota del patrón. */
export function darkenPattern(src: string, darken: readonly number[]): string {
  return src.replace(/-?\d+/g, (n) => {
    const s = Number(n);
    return String(darken.includes(((s % 12) + 12) % 12) ? s - 1 : s);
  });
}

/** Deja sonar los primeros compases (la fracción `keep`, al menos uno); el resto, en silencio. */
export function keepHead(src: string, barSteps: number, keep: number): string {
  const tokens = src.split(/[\s|]+/).filter(Boolean);
  const bars = Math.max(1, Math.ceil((tokens.length / barSteps) * keep));
  return tokens.map((t, i) => (i < bars * barSteps ? t : '.')).join(' ');
}

/** Lo que hace el sintetizador: parámetros de ZzFX → muestras. */
export type Synth = (params: number[]) => ArrayLike<number>;

export interface RenderOptions {
  sampleRate: number;
  /** Cada tanto se cede el hilo (para no trabar un cuadro); en las pruebas, nada. */
  yieldEvery?: () => Promise<void> | void;
  /** Cuántas notas se sintetizan entre una cesión y la siguiente. */
  notesPerSlice?: number;
}

/** Sintetiza el bucle entero en una sola pista mono. Las colas que pasan el final vuelven al principio. */
export async function renderTrack(def: TrackDef, instruments: Record<string, InstrumentDef>, synth: Synth, opts: RenderOptions): Promise<Float32Array> {
  const rate = opts.sampleRate;
  const steps = trackSteps(def);
  const stepSec = stepSeconds(def);
  const total = Math.max(1, Math.round(steps * stepSec * rate));
  const out = new Float32Array(total);
  const cache = new Map<string, ArrayLike<number>>();
  const perSlice = opts.notesPerSlice ?? 24;
  let made = 0;
  for (const voice of def.voices) {
    const inst = instruments[voice.inst];
    if (!inst) throw new Error(`música: falta el instrumento "${voice.inst}" en ${def.id}`);
    const pattern = parsePattern(voice.pattern);
    if (steps % pattern.steps !== 0) throw new Error(`música: la voz ${voice.inst} de ${def.id} no entra justa en el bucle`);
    const gain = voice.gain ?? 1;
    const octave = voice.octave ?? 0;
    for (let rep = 0; rep < steps / pattern.steps; rep++) {
      for (const note of pattern.notes) {
        const start = Math.round((rep * pattern.steps + note.step) * stepSec * rate);
        for (const semi of note.semis) {
          const key = `${voice.inst}|${semi + octave}|${note.length}|${note.accent}`;
          let samples = cache.get(key);
          if (!samples) {
            samples = synth(noteParams(inst, def.root, semi + octave, note.length * stepSec, note.accent));
            cache.set(key, samples);
            if (++made % perSlice === 0) await opts.yieldEvery?.();
          }
          // Rasgueo: las notas de un acorde salen apenas corridas.
          const strum = note.semis.length > 1 ? Math.round(note.semis.indexOf(semi) * STRUM_SEC * rate) : 0;
          mixInto(out, samples, start + strum, gain);
        }
      }
    }
  }
  if (def.echo) applyEcho(out, Math.round((def.echo.ms / 1000) * rate), def.echo.feedback);
  return out;
}

const STRUM_SEC = 0.012;
/** Acento: un poco más fuerte. */
const ACCENT_GAIN = 1.35;

export function noteParams(inst: InstrumentDef, root: number, semis: number, seconds: number, accent: boolean): number[] {
  const p = [...inst.params];
  while (p.length < 21) p.push(0);
  p[0] = (p[0] || 1) * (accent ? ACCENT_GAIN : 1);
  // Sin aleatoriedad: la misma nota suena igual (y se puede reusar).
  p[1] = 0;
  p[2] = (inst.freq ?? root) * 2 ** (semis / 12);
  if (inst.hold) p[4] = Math.max(0, seconds - p[3] - p[18]);
  return p;
}

function mixInto(out: Float32Array, samples: ArrayLike<number>, start: number, gain: number): void {
  const n = out.length;
  for (let i = 0; i < samples.length; i++) out[(start + i) % n] += samples[i] * gain;
}

/** Eco con realimentación que da la vuelta al bucle: dos vueltas para que el principio también lo tenga. */
export function applyEcho(buf: Float32Array, delay: number, feedback: number): void {
  const n = buf.length;
  if (delay <= 0 || delay >= n || feedback <= 0) return;
  const dry = Float32Array.from(buf);
  for (let k = 0; k < n * 2; k++) {
    const i = k % n;
    buf[i] = dry[i] + feedback * buf[(i - delay + n) % n];
  }
}

export function rms(buf: ArrayLike<number>): number {
  let sum = 0;
  for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
  return buf.length ? Math.sqrt(sum / buf.length) : 0;
}

export function peak(buf: ArrayLike<number>): number {
  let max = 0;
  for (let i = 0; i < buf.length; i++) max = Math.max(max, Math.abs(buf[i]));
  return max;
}

/**
 * Lleva la pista a la misma intensidad que las otras (`targetRms`) y redondea los picos por encima de `ceiling`
 * para que nunca recorte. Así las diez pistas suenan parejas sin ajustar una por una.
 */
export function normalize(buf: Float32Array, targetRms: number, ceiling: number): void {
  const level = rms(buf);
  if (level <= 0) return;
  const g = targetRms / level;
  for (let i = 0; i < buf.length; i++) {
    const v = buf[i] * g;
    const a = Math.abs(v);
    buf[i] = a <= ceiling ? v : Math.sign(v) * (ceiling + (1 - ceiling) * Math.tanh((a - ceiling) / (1 - ceiling)));
  }
}
