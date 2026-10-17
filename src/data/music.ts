import type { LevelId } from './types';
import type { BossLayer, InstrumentDef, TrackDef } from '../systems/musicLogic';

// Música de Kerana (S37, GDD §10.1 y §10.2): diez piezas generadas con ZzFX, sin archivos.
// Registro: arpa paraguaya y guitarra para el título, el mapa y los pueblos; takuapu (bastón de ritmo), mbaraka
// (maraca) y mimby (flauta de caña guaraní, grave y sin soplido de quena) para la naturaleza. Nada de zampoña ni
// huayno: son de otra región. Cada pista es un bucle; Jose puede cambiar notas e instrumentos acá sin tocar el sistema.
// Patrones: ver `VoiceDef.pattern` en src/systems/musicLogic.ts.

export type TrackId = 'title' | 'map' | 'l1' | 'l2' | 'l3' | 'l4' | 'l5' | 'l6' | 'l7' | 'yvaga';
/** Una pista o su variante de jefe (`l1_boss`). */
export type MusicKey = TrackId | `${TrackId}_boss`;

// Parámetros de ZzFX: [volumen, aleatoriedad, frecuencia, ataque, sostenido, caída, forma, curva, slide, deltaSlide,
//  saltoDeTono, tiempoSaltoDeTono, repetición, ruido, modulación, bitCrush, delay, sostenidoVol, decay, trémolo, filtro]
// Filtro negativo = pasa bajos (suaviza); positivo = pasa altos.
export const INSTRUMENTS: Record<string, InstrumentDef> = {
  /** Arpa paraguaya: pulsado brillante que se apaga despacio. */
  arpa: { params: [1, 0, 0, 0.003, 0, 0.9, 1, 1.6, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.35, 0.12, 0, -3500] },
  /** Guitarra: pulsado más opaco, para el bajo y los acordes. */
  guitarra: { params: [1, 0, 0, 0.003, 0, 0.55, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.3, 0.07, 0, -1800] },
  /** Mimby: flauta de caña, redonda, con un temblor leve. */
  mimby: { hold: true, params: [0.8, 0, 0, 0.06, 0, 0.16, 0, 1, 0, 0, 0, 0, 0.16, 0.02, 0, 0, 0, 0.9, 0.04, 0.1, -2600] },
  /** Voz o coro sin palabras: entra lento y respira. */
  voz: { hold: true, params: [0.6, 0, 0, 0.4, 0, 0.8, 0, 1.2, 0, 0, 0, 0, 0.3, 0, 0, 0, 0, 1, 0, 0.25, -1200] },
  /** Órgano de las misiones jesuíticas: acordes tenidos. */
  organo: { hold: true, params: [0.5, 0, 0, 0.15, 0, 0.4, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, -900] },
  /** Cuerno grave de la montaña. */
  cuerno: { hold: true, params: [0.7, 0, 0, 0.08, 0, 0.25, 2, 1, 0, 0, 0, 0, 0.2, 0, 0, 0, 0, 0.9, 0.05, 0.05, -1100] },
  bajo: { params: [1, 0, 0, 0.005, 0, 0.3, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.6, 0.08, 0, -600] },
  /** Campana: el camposanto de l7 y el cielo de Yvága. */
  campana: { params: [0.6, 0, 0, 0.002, 0, 1.4, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.3, 0.25, 0, 0] },
  /** Takuapu: golpe de caña hueca contra el suelo. */
  takuapu: { freq: 150, params: [1, 0, 0, 0.002, 0, 0.12, 0, 1, 0, 0, 0, 0, 0, 0.25, 0, 0, 0, 0.5, 0.03, 0, -1200] },
  /** Mbaraka: semillas en la calabaza. */
  mbaraka: { freq: 1500, params: [0.4, 0, 0, 0.004, 0.02, 0.05, 4, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 3000] },
  /** Angu'a: tambor grave. */
  angua: { freq: 75, params: [1, 0, 0, 0.002, 0, 0.32, 0, 1, -1, 0, 0, 0, 0, 0.1, 0, 0, 0, 0.6, 0.05, 0, -500] },
};

/** Capa de los jefes: la pieza del nivel, más rápida, con tambor, takuapu y un bajo que late (S37). */
export const BOSS_LAYER: BossLayer = {
  tempo: 1.15,
  drum: 'angua',
  pulse: 'takuapu',
  bass: 'bajo',
  bassLowHz: 55,
  gains: { drum: 0.9, pulse: 0.35, bass: 0.6 },
};

// Tónicas.
const A2 = 110;
const C3 = 130.81;
const D3 = 146.83;
const E2 = 82.41;
const E3 = 164.81;
const F3 = 174.61;
const G3 = 196;
const A3 = 220;
const C4 = 261.63;

export const TRACKS: Record<TrackId, TrackDef> = {
  // «Canto de Eichu» (GDD §10.2): las Siete Cabrillas, de noche. Vals lento de arpa y mimby, en re mayor.
  title: {
    id: 'title',
    bpm: 66,
    stepsPerBeat: 2,
    beatsPerBar: 3,
    root: D3,
    echo: { ms: 420, feedback: 0.35 },
    voices: [
      {
        inst: 'arpa',
        gain: 0.7,
        pattern:
          '0 7 12 16 19 16 | -3 4 9 12 16 12 | -7 0 5 9 12 9 | -5 2 7 11 14 11 | 0 7 12 16 19 16 | -3 4 9 12 16 12 | -7 0 5 9 12 9 | -5 2 7 11 14 11',
      },
      {
        inst: 'mimby',
        octave: 12,
        gain: 0.6,
        pattern: '4 - - 7 9 - | 12 - - 11 9 - | 7 - - 9 7 4 | 2 - - - . . | 4 - - 7 9 - | 12 - - 14 16 - | 14 - 12 - 11 9 | 7 - - - . .',
      },
      { inst: 'bajo', octave: -12, gain: 0.7, pattern: '0 . . . . . | -3 . . . . . | -7 . . . . . | -5 . . . . .' },
      { inst: 'voz', gain: 0.3, pattern: '0 - - - - - - - - - - -' },
    ],
  },
  // Mapa: caminata en sol mayor, guitarra que marca el paso y arpa que canta; mbaraka en el contratiempo.
  map: {
    id: 'map',
    bpm: 104,
    stepsPerBeat: 2,
    beatsPerBar: 4,
    root: G3,
    voices: [
      {
        inst: 'guitarra',
        gain: 0.6,
        pattern:
          '-12 . -5+0+4 . -5 . -5+0+4 . | -17 . -5+-1+2 . -10 . -5+-1+2 . | -15 . -3+0+4 . -8 . -3+0+4 . | -19 . -7+-3+0 . -12 . -7+-3+0 . | ' +
          '-12 . -5+0+4 . -5 . -5+0+4 . | -17 . -5+-1+2 . -10 . -5+-1+2 . | -19 . -7+-3+0 . -12 . -7+-3+0 . | -17 . -5+-1+2 . -10 . -5+-1+2 .',
      },
      {
        inst: 'arpa',
        octave: 12,
        gain: 0.65,
        pattern:
          '0 . 2 4 7 . 4 . | 2 . -1 . 2 4 2 . | 4 . 7 . 11 . 9 7 | 9 - - . 7 . 4 . | 0 . 2 4 7 . 12 . | 11 . 9 . 7 . 2 . | 4 . 5 . 7 . 9 . | 2 - . . -1 - . .',
      },
      { inst: 'mbaraka', gain: 0.5, pattern: '. x . x . x . x' },
      { inst: 'takuapu', gain: 0.6, pattern: 'x . . . x . . .' },
    ],
  },
  // l1, los cerros dormidos: canto lento de mimby sobre un zumbido de la, takuapu al paso. Hay una cueva: eco.
  l1: {
    id: 'l1',
    bpm: 76,
    stepsPerBeat: 2,
    beatsPerBar: 4,
    root: A2,
    echo: { ms: 330, feedback: 0.3 },
    voices: [
      { inst: 'voz', gain: 0.45, pattern: '0+7 - - - - - - - - - - - - - - -' },
      { inst: 'takuapu', gain: 0.7, pattern: 'x . . . x . . .' },
      { inst: 'mbaraka', gain: 0.4, pattern: '. . . . . . x . | . . . . . . . .' },
      {
        inst: 'mimby',
        octave: 12,
        gain: 0.7,
        pattern:
          '12 - - - 10 - 7 - | 9 - - - 7 - - - | 5 - 7 - 3 - - - | 0 - - - - - . . | 7 - - - 9 - 10 - | 15 - - - 14 - 12 - | 10 - 9 - 7 - 5 - | 7 - - - - - . .',
      },
      { inst: 'arpa', gain: 0.45, pattern: '0 . . 7 . . 12 . | . . . . . . . .' },
    ],
  },
  // l2, las lagunas del estero: 6/8 que se mece, arpa como agua y gotas de campana con eco.
  l2: {
    id: 'l2',
    bpm: 80,
    stepsPerBeat: 3,
    beatsPerBar: 2,
    root: F3,
    echo: { ms: 280, feedback: 0.3 },
    voices: [
      {
        inst: 'arpa',
        gain: 0.6,
        pattern: '0 4 7 12 7 4 | -3 0 4 9 4 0 | -7 -3 0 5 0 -3 | -5 -1 2 7 2 -1 | 0 4 7 12 7 4 | -8 -5 -1 4 -1 -5 | -7 -3 0 5 0 -3 | -5 -1 2 7 2 -1',
      },
      {
        inst: 'mimby',
        octave: 12,
        gain: 0.6,
        pattern: '7 - - 9 - 7 | 4 - - 2 - 0 | 2 - - 5 - 2 | -1 - - - - . | 7 - - 9 - 12 | 11 - - 9 - 7 | 5 - - 4 - 2 | -1 - - 2 - -',
      },
      { inst: 'campana', octave: 24, gain: 0.25, pattern: '12 . . . . . | . . . 7 . . | . . . . . . | . . . 9 . .' },
      { inst: 'bajo', octave: -12, gain: 0.6, pattern: '0 . . . . . | -3 . . . . . | -7 . . . . . | -5 . . . . . | 0 . . . . . | -8 . . . . . | -7 . . . . . | -5 . . . . .' },
      { inst: 'mbaraka', gain: 0.35, pattern: 'x . . x . .' },
    ],
  },
  // l3, el campo abierto de Misiones: mi mayor, órgano de las reducciones jesuíticas y arpa que corre.
  l3: {
    id: 'l3',
    bpm: 112,
    stepsPerBeat: 2,
    beatsPerBar: 4,
    root: E3,
    voices: [
      {
        inst: 'organo',
        gain: 0.35,
        pattern:
          '0+4+7 - - - - - - - | 0+5+9 - - - - - - - | 0+4+7 - - - - - - - | -1+2+7 - - - - - - - | -3+0+4 - - - - - - - | 0+5+9 - - - - - - - | -1+2+7 - - - - - - - | -1+2+5 - - - - - - -',
      },
      {
        inst: 'arpa',
        gain: 0.45,
        pattern:
          '0 4 7 4 12 7 4 7 | 0 5 9 5 12 9 5 9 | 0 4 7 4 12 7 4 7 | -1 2 7 2 11 7 2 7 | -3 0 4 0 9 4 0 4 | 0 5 9 5 12 9 5 9 | -1 2 7 2 11 7 2 7 | -1 2 5 2 11 5 2 -1',
      },
      {
        inst: 'mimby',
        octave: 12,
        gain: 0.6,
        pattern:
          '7 - - - 9 - 11 - | 12 - - - 9 - - - | 7 - - - 4 - 7 - | 2 - - - - - . . | 4 - - - 7 - 9 - | 12 - - - 14 - 12 - | 11 - - - 9 - 7 - | 5 - - - 2 - - -',
      },
      { inst: 'bajo', octave: -12, gain: 0.6, pattern: '0 . . . 7 . . . | 5 . . . 0 . . . | 0 . . . 7 . . . | -5 . . . 2 . . . | -3 . . . 4 . . . | 5 . . . 0 . . . | -5 . . . 2 . . . | -5 . . . 2 . . .' },
      { inst: 'takuapu', gain: 0.55, pattern: 'x . . . x . x .' },
      { inst: 'mbaraka', gain: 0.4, pattern: '. x . x . x . x' },
    ],
  },
  // l4, la siesta de Capiatá: polca paraguaya perezosa. La guitarra va en 3/4 y el arpa en 6/8.
  l4: {
    id: 'l4',
    bpm: 76,
    stepsPerBeat: 3,
    beatsPerBar: 2,
    root: C4,
    voices: [
      {
        inst: 'guitarra',
        octave: -12,
        gain: 0.55,
        pattern:
          '0 . 4+7+12 . 4+7+12 . | -5 . 5+7+11 . 5+7+11 . | -5 . 5+7+11 . 5+7+11 . | 0 . 4+7+12 . 4+7+12 . | ' +
          '0 . 4+7+12 . 4+7+12 . | -7 . 5+9+12 . 5+9+12 . | -5 . 5+7+11 . 5+7+11 . | 0 . 4+7+12 . 4+7+12 .',
      },
      {
        inst: 'arpa',
        gain: 0.65,
        pattern: '7 . 4 7 . 12 | 11 - . 7 . 5 | 2 . 5 7 . 11 | 12 - - . . . | 16 . 14 12 . 7 | 9 - . 12 . 9 | 7 . 5 2 . -1 | 0 - - . . .',
      },
      { inst: 'mbaraka', gain: 0.3, pattern: '. . x . . x' },
    ],
  },
  // l5, la selva profunda: re dórico, percusión cruzada (3+3+2 contra el pulso) y llamados de mimby como pájaros.
  l5: {
    id: 'l5',
    bpm: 100,
    stepsPerBeat: 2,
    beatsPerBar: 4,
    root: D3,
    voices: [
      { inst: 'takuapu', gain: 0.7, pattern: 'x . . x . . x .' },
      { inst: 'mbaraka', gain: 0.35, pattern: '. x x . x x . x' },
      { inst: 'angua', gain: 0.6, pattern: 'x . . . . . . . | x . . . . . x .' },
      { inst: 'bajo', octave: -12, gain: 0.6, pattern: '0 . 0 . 3 . 5 . | 0 . 0 . 10 . 7 .' },
      { inst: 'arpa', octave: 12, gain: 0.35, pattern: '0 . 3 . 5 . 3 . | 0 . -2 . -3 . -2 .' },
      {
        inst: 'mimby',
        octave: 12,
        gain: 0.55,
        pattern:
          '. . . . . . . . | 19 - 17 . . . . . | . . . . . . . . | 14 - 12 - 10 - . . | . . . . . . . . | 19 - 21 - 19 . . . | . . . . . . . . | 12 - - - . . . .',
      },
    ],
  },
  // l6, las montañas del Ybytyruzú: mi menor, tambor grave y un cuerno que llama de cerro a cerro.
  l6: {
    id: 'l6',
    bpm: 92,
    stepsPerBeat: 2,
    beatsPerBar: 4,
    root: E2,
    voices: [
      { inst: 'angua', gain: 0.8, pattern: 'x! . . x x . . .' },
      { inst: 'takuapu', gain: 0.5, pattern: '. . x . . . x .' },
      { inst: 'bajo', gain: 0.6, pattern: '0 . 0 . 7 . 0 . | 0 . 0 . 10 . 7 . | -4 . -4 . 3 . -4 . | -2 . -2 . 5 . -2 .' },
      { inst: 'voz', octave: 12, gain: 0.3, pattern: '0+7 - - - - - - - - - - - - - - -' },
      {
        inst: 'cuerno',
        octave: 12,
        gain: 0.55,
        pattern:
          '12 - - - - - 15 - | 14 - 12 - 10 - - - | 8 - - - 7 - 8 - | 10 - - - - - . . | 12 - - - - - 15 - | 17 - 15 - 14 - 12 - | 8 - 10 - 12 - 15 - | 14 - - - - - . .',
      },
    ],
  },
  // l7, Asunción de noche: guarania lenta en la menor, arpa y guitarra que llora; una campana del camposanto.
  l7: {
    id: 'l7',
    bpm: 60,
    stepsPerBeat: 2,
    beatsPerBar: 3,
    root: A3,
    echo: { ms: 500, feedback: 0.3 },
    voices: [
      {
        inst: 'arpa',
        gain: 0.55,
        pattern:
          '-12 -5 0 3 7 3 | -7 0 5 8 12 8 | -14 -2 2 5 10 5 | -9 -2 3 7 10 7 | -16 -4 0 3 8 3 | -7 0 5 8 12 8 | -17 -5 -1 2 5 2 | -12 -5 0 3 7 3',
      },
      {
        inst: 'guitarra',
        octave: 12,
        gain: 0.6,
        pattern: '7 - - 8 7 3 | 5 - - - 3 0 | 2 - - 3 5 2 | 3 - - - - . | 0 - - 3 8 7 | 5 - - 3 2 0 | -1 - - 2 -1 -5 | 0 - - - - .',
      },
      { inst: 'campana', gain: 0.3, pattern: '0 . . . . . | . . . . . . | . . . . . . | . . . . . . | 0 . . . . . | . . . . . . | . . . . . . | . . . . . .' },
    ],
  },
  // Yvága y la pelea con Tau: el cielo, hermoso y ajeno. Escala de tonos enteros, coro sobre un tritono, campanas.
  yvaga: {
    id: 'yvaga',
    bpm: 70,
    stepsPerBeat: 2,
    beatsPerBar: 4,
    root: C3,
    echo: { ms: 520, feedback: 0.45 },
    voices: [
      {
        inst: 'voz',
        gain: 0.4,
        pattern: '0+6 - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - | -2+4 - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -',
      },
      { inst: 'campana', octave: 24, gain: 0.25, pattern: '0 . . 6 . . . . | 4 . . . 10 . . 8' },
      { inst: 'arpa', octave: -12, gain: 0.5, pattern: '0 . . . . . 6 . | . . 4 . . . . .' },
      { inst: 'mbaraka', gain: 0.3, pattern: '. . . . . . . x | . . . . . . . . | . . . x . . . . | . . . . . . . .' },
      {
        inst: 'voz',
        octave: 12,
        gain: 0.35,
        pattern: '0 - - - 2 - - - | 4 - - - - - - - | 6 - - - 4 - - - | 2 - - - - - . . | 8 - - - 6 - - - | 4 - - - 2 - - - | 0 - - - -2 - - - | 0 - - - - - . .',
      },
    ],
  },
};

/** Pista de cada nivel. Las salas de prueba usan la de l1. */
export function levelTrack(levelId: LevelId): TrackId {
  switch (levelId) {
    case 'test':
    case 'vitrina':
      return 'l1';
    default:
      return levelId;
  }
}

/** La pelea con el jefe del nivel: la misma pieza, tensa. */
export function bossTrack(levelId: LevelId): MusicKey {
  return `${levelTrack(levelId)}_boss`;
}
