// Diapositivas del prólogo y el final (GDD §2.4 y §2.6). `DialogueBox` no se usa acá:
// StoryScene solo pasa imagen (si existe) + texto letra por letra.
export interface StorySlide {
  textKey: string;
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

/** Créditos-preludio del final (GDD §2.6, pasos 1 a 3: siempre iguales). */
export const ENDING_SLIDES: StorySlide[] = [
  { textKey: 'story.ending.1' },
  { textKey: 'story.ending.2' },
  { textKey: 'story.ending.3' },
];

/** Último paso del final: depende de si están las 21 plumas (GDD §2.6, paso 4). */
export function endingLastSlide(allFeathers: boolean): StorySlide {
  return { textKey: allFeathers ? 'story.ending.4_all_feathers' : 'story.ending.4_missing_feathers' };
}
