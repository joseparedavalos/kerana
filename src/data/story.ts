// Diapositivas del prólogo y el final (GDD §2.4 y §2.6). `DialogueBox` no se usa acá:
// StoryScene solo pasa imagen (si existe) + texto letra por letra.
export interface StorySlide {
  textKey: string;
  /** Imagen de fondo (`bg_<nombre>`, se carga al abrir StoryScene); si falta, StoryScene dibuja un placeholder por código. */
  imageKey?: string;
  /** Cielo de noche por código (sin imagen). */
  night?: boolean;
  /** Eichu dibujada por código encima del fondo. */
  eichu?: EichuPlacement;
  /** Dónde va la franja del texto sobre la imagen (por defecto, al centro). */
  band?: 'center' | 'bottom';
}

/** Centro del cúmulo en fracciones de la vista y su ancho (unidades). */
export interface EichuPlacement {
  x: number;
  y: number;
  size: number;
}

/**
 * Eichu (las Pléyades) con su forma real: Atlas, Alcyone, Merope, Maia, Taygeta, Electra y Celaeno.
 * Posición relativa al centro del cúmulo (ancho ≈ 1, `y` hacia abajo, el este a la izquierda) y magnitud.
 */
export const EICHU_STARS: ReadonlyArray<{ x: number; y: number; mag: number }> = [
  { x: -0.5, y: 0.16, mag: 3.6 }, // Atlas
  { x: -0.12, y: 0.11, mag: 2.9 }, // Alcyone
  { x: 0.15, y: 0.26, mag: 4.2 }, // Merope
  { x: 0.26, y: -0.16, mag: 3.9 }, // Maia
  { x: 0.4, y: -0.26, mag: 4.3 }, // Taygeta
  { x: 0.48, y: 0.09, mag: 3.7 }, // Electra
  { x: 0.49, y: -0.07, mag: 5.4 }, // Celaeno
];

/** Eichu en el cielo de noche (arriba del texto) y en el cielo azul de `final` (a donde mira Kerana). */
const EICHU_NIGHT: EichuPlacement = { x: 0.5, y: 0.2, size: 90 };
const EICHU_FINAL: EichuPlacement = { x: 0.6, y: 0.1, size: 80 };

export const PROLOGUE_SLIDES: StorySlide[] = [
  { textKey: 'story.prologue.1' },
  { textKey: 'story.prologue.2' },
  { textKey: 'story.prologue.3' },
  { textKey: 'story.prologue.4' },
  { textKey: 'story.prologue.5' },
  { textKey: 'story.prologue.6' },
];

/** Al liberar a Luisón (GDD §2.6): las siete estrellas forman Eichu y aparece Tau. Sigue Yvága. */
export const TAU_ARRIVAL_SLIDES: StorySlide[] = [
  { textKey: 'story.ending.1', night: true, eichu: EICHU_NIGHT },
  { textKey: 'story.tau.appears' },
  { textKey: 'story.tau.mainumby' },
];

/** Final verdadero, después de sellar a Tau (GDD §2.6, §6.8, §7). */
export const ENDING_SLIDES: StorySlide[] = [
  { textKey: 'story.final.sealed' },
  { textKey: 'story.final.healed', imageKey: 'bg_final_asuncion', band: 'bottom' },
  { textKey: 'story.ending.2', night: true, eichu: EICHU_NIGHT },
  { textKey: 'story.final.spring', imageKey: 'bg_final', eichu: EICHU_FINAL, band: 'bottom' },
];

/** Diapositiva extra con las 21 plumas: Kerana y Mainumby. */
export const FEATHERS_SLIDE: StorySlide = { textKey: 'story.final.feathers', imageKey: 'bg_final', eichu: EICHU_FINAL, band: 'bottom' };

/** El final completo según las plumas juntadas en todo el juego. */
export function endingSlides(feathers: number, featherTotal: number): StorySlide[] {
  return feathers >= featherTotal ? [...ENDING_SLIDES, FEATHERS_SLIDE] : [...ENDING_SLIDES];
}
