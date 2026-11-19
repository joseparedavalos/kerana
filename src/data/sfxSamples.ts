// Efectos grabados (S106): los físicos salen de cinco paquetes de Kenney.nl (CC0, `raw/audio/kenney/*.zip`); las
// criaturas y lo mágico siguen en ZzFX (`src/systems/sfxPresets.ts`). `npm run sfx` lee esta lista, recorta el silencio
// del principio y del final, iguala todos a la misma sonoridad y los deja en `public/assets/audio/sfx/<nombre>.mp3`.
// En el juego, cada grabación se lleva a la sonoridad del ZzFX que reemplaza (más `db`): si se reafina el preset, la
// grabación lo sigue. Si un archivo falta o no carga, suena el ZzFX.
// Sin imports de valores: `tools/sfx.mjs` la carga directo con Node (los tipos se borran).

import type { Biome } from './types';
import type { SfxKey } from '../systems/sfxPresets';

/** Los paquetes, tal como los subió Jose. */
export const SAMPLE_PACKS = {
  impact: 'kenney_impact-sounds.zip',
  rpg: 'kenney_rpg-audio.zip',
  interface: 'kenney_interface-sounds.zip',
  ui: 'kenney_ui-audio.zip',
  jingles: 'kenney_music-jingles.zip',
} as const;

export type SamplePack = keyof typeof SAMPLE_PACKS;

/** Un archivo de un paquete: `paquete:nombre` (sin carpeta ni `.ogg`; los nombres no se repiten dentro de un paquete). */
export type SampleRef = `${SamplePack}:${string}`;

export interface SampleDef {
  /** Las variantes: cada vez suena una al azar, distinta de la anterior. */
  sources: SampleRef[];
  /** Sonoridad respecto del ZzFX que reemplaza (dB; 0 = igual). */
  db?: number;
  /** Velocidad de reproducción (1 = original; menos de 1, más grave y más lento). */
  rate?: number;
  /** Variación al azar de la velocidad en cada golpe (± fracción): que no suene dos veces igual. */
  pitchJitter?: number;
  /**
   * ZzFX encima de la grabación: `layers` toca solo las capas de `SFX_LAYERS` (el brillo del tajo cargado); `preset`,
   * el preset entero (lo mágico que acompaña a un golpe físico). `zzfxDb` lo baja o lo sube.
   */
  zzfx?: 'layers' | 'preset';
  zzfxDb?: number;
}

/**
 * Qué grabación reemplaza a cada ZzFX. Lo que no está acá (criaturas, lo mágico, `bounce`) sigue en ZzFX.
 * Por qué cada una: `docs/ASSETS.md` §10.
 */
export const SFX_SAMPLES: Partial<Record<SfxKey, SampleDef>> = {
  // Golpes e impactos (Impact Sounds).
  hit: { sources: ['impact:impactPunch_medium_000', 'impact:impactPunch_medium_001', 'impact:impactPunch_medium_002'], pitchJitter: 0.06 },
  bossHit: { sources: ['impact:impactPunch_heavy_000', 'impact:impactPunch_heavy_001', 'impact:impactPunch_heavy_002'], pitchJitter: 0.05 },
  rockBreak: { sources: ['impact:impactMining_000', 'impact:impactMining_001', 'impact:impactMining_002'], pitchJitter: 0.06 },
  land: { sources: ['impact:impactSoft_medium_000', 'impact:impactSoft_medium_001', 'impact:impactSoft_medium_002'], pitchJitter: 0.05 },
  stomp: { sources: ['impact:impactSoft_heavy_000', 'impact:impactSoft_heavy_001', 'impact:impactSoft_heavy_002'], rate: 0.85, pitchJitter: 0.04 },
  // Cortes (RPG Audio): el machete al aire es el «shing» de sacar el cuchillo; el cargado, el tajo largo, más grave,
  // con el brillo de ZzFX encima.
  slash: { sources: ['rpg:drawKnife2', 'rpg:drawKnife1'], pitchJitter: 0.07 },
  chargedSlash: { sources: ['rpg:knifeSlice2'], rate: 0.85, zzfx: 'layers' },
  // Puertas y metal (RPG Audio; el farol, Impact Sounds con su «ding» de ZzFX más bajo encima).
  creak: { sources: ['rpg:creak3', 'rpg:creak1'], pitchJitter: 0.05 },
  gateOpen: { sources: ['rpg:doorOpen_1'] },
  gateClose: { sources: ['rpg:doorClose_4'] },
  switchOn: { sources: ['rpg:metalLatch'], pitchJitter: 0.03 },
  lantern: { sources: ['impact:impactMetal_light_000', 'impact:impactMetal_light_001'], pitchJitter: 0.04, zzfx: 'preset', zzfxDb: -6 },
  // Menú (Interface Sounds: una sola familia de plástico y vidrio).
  uiMove: { sources: ['interface:select_001'] },
  uiConfirm: { sources: ['interface:confirmation_001'] },
  uiBack: { sources: ['interface:back_002'] },
  // La liberación: pizzicato que sube por grados y se queda arriba (lo más cerca del arpa de los cinco paquetes).
  liberation: { sources: ['jingles:jingles_PIZZI10'] },
};

/** Suelos con pasos grabados (Impact Sounds trae cinco por suelo). */
export type Surface = 'grass' | 'concrete' | 'wood' | 'carpet';

export const FOOTSTEP_SOURCES: Record<Surface, SampleRef[]> = {
  grass: [0, 1, 2, 3, 4].map((i) => `impact:footstep_grass_00${i}` as const),
  concrete: [0, 1, 2, 3, 4].map((i) => `impact:footstep_concrete_00${i}` as const),
  wood: [0, 1, 2, 3, 4].map((i) => `impact:footstep_wood_00${i}` as const),
  carpet: [0, 1, 2, 3, 4].map((i) => `impact:footstep_carpet_00${i}` as const),
};

/**
 * El suelo de cada bioma: `ground` es la capa `Ground` (el terreno) y `platforms`, la capa `Platforms` y lo que lleva a
 * Kerana (plataformas que se mueven, balsas, hongos).
 */
export const BIOME_FOOTSTEPS: Record<Biome, { ground: Surface; platforms: Surface }> = {
  cerro: { ground: 'concrete', platforms: 'wood' },
  estero: { ground: 'grass', platforms: 'grass' },
  campo: { ground: 'grass', platforms: 'wood' },
  pueblo: { ground: 'concrete', platforms: 'wood' },
  selva: { ground: 'grass', platforms: 'wood' },
  montana: { ground: 'concrete', platforms: 'wood' },
  ciudad: { ground: 'concrete', platforms: 'wood' },
  // Yvága: nubes; lo más blando y apagado.
  cielo: { ground: 'carpet', platforms: 'carpet' },
};

/** Nombre del archivo de salida (sin carpeta ni extensión). */
export function sampleName(key: SfxKey | `step_${Surface}`, index: number): string {
  return `${key}_${index}`;
}

/** Carpeta y formato de salida: MP3 suena en Chrome, Firefox y Safari (también el del iPhone). */
export const SAMPLE_DIR = 'assets/audio/sfx/';
export const SAMPLE_EXT = '.mp3';

/** Todo lo que se genera: nombre de salida → archivo de origen. */
export function sampleOutputs(): { name: string; source: SampleRef }[] {
  const out: { name: string; source: SampleRef }[] = [];
  for (const [key, def] of Object.entries(SFX_SAMPLES) as [SfxKey, SampleDef][]) {
    def.sources.forEach((source, i) => out.push({ name: sampleName(key, i), source }));
  }
  for (const [surface, sources] of Object.entries(FOOTSTEP_SOURCES) as [Surface, SampleRef[]][]) {
    sources.forEach((source, i) => out.push({ name: sampleName(`step_${surface}`, i), source }));
  }
  return out;
}
