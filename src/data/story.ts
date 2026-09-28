// Diapositivas del prólogo y el final (GDD §2.4 y §2.6). `DialogueBox` no se usa acá:
// StoryScene solo pasa imagen (si existe) + texto letra por letra.
export interface StorySlide {
  textKey: string;
  /** Imagen de fondo (manifest); si falta, StoryScene dibuja un placeholder por código. */
  imageKey?: string;
}

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
  { textKey: 'story.ending.1' },
  { textKey: 'story.tau.appears' },
  { textKey: 'story.tau.mainumby' },
];

/** Final verdadero, después de sellar a Tau (GDD §2.6, §6.8, §7). */
export const ENDING_SLIDES: StorySlide[] = [
  { textKey: 'story.final.sealed' },
  { textKey: 'story.final.healed' },
  { textKey: 'story.ending.2' },
  { textKey: 'story.final.spring', imageKey: 'bg_final' },
];

/** Diapositiva extra con las 21 plumas: Kerana y Mainumby. */
export const FEATHERS_SLIDE: StorySlide = { textKey: 'story.final.feathers', imageKey: 'bg_final' };

/** El final completo según las plumas juntadas en todo el juego. */
export function endingSlides(feathers: number, featherTotal: number): StorySlide[] {
  return feathers >= featherTotal ? [...ENDING_SLIDES, FEATHERS_SLIDE] : [...ENDING_SLIDES];
}
