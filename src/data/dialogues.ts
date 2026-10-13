import type { DialogueLine, LevelId } from './types';

// Liberación (GDD §6): una sola frase de Kerana. El hijo no contesta; sube como estrella.
// Tau no se libera: Kerana lo sella.
export const LIBERATION_DIALOGUES: Partial<Record<LevelId, DialogueLine[]>> = {
  l1: [{ speaker: 'kerana', textKey: 'dialogue.free.l1' }],
  l2: [{ speaker: 'kerana', textKey: 'dialogue.free.l2' }],
  l3: [{ speaker: 'kerana', textKey: 'dialogue.free.l3' }],
  l4: [{ speaker: 'kerana', textKey: 'dialogue.free.l4' }],
  l5: [{ speaker: 'kerana', textKey: 'dialogue.free.l5' }],
  l6: [{ speaker: 'kerana', textKey: 'dialogue.free.l6' }],
  l7: [{ speaker: 'kerana', textKey: 'dialogue.free.l7' }],
  yvaga: [{ speaker: 'kerana', textKey: 'dialogue.tau.seal' }],
};

export function liberationDialogue(levelId: LevelId): DialogueLine[] {
  return LIBERATION_DIALOGUES[levelId] ?? [];
}

/** Nombre de retrato provisional para un hablante (ASSETS §4; hasta S13, placeholder por código). */
export function speakerPortraitKey(speaker: DialogueLine['speaker']): string {
  return `portrait_${speaker}`;
}
