import type { BossId, DialogueLine, LevelId } from './types';

// Diálogos de liberación (GDD §6.1 a §6.7), uno por nivel con jefe.
export const LIBERATION_DIALOGUES: Partial<Record<LevelId, DialogueLine[]>> = {
  l1: [
    { speaker: 'teju_jagua', textKey: 'dialogue.l1.1' },
    { speaker: 'kerana', textKey: 'dialogue.l1.2' },
    { speaker: 'teju_jagua', textKey: 'dialogue.l1.3' },
  ],
  l2: [
    { speaker: 'mboi_tui', textKey: 'dialogue.l2.1' },
    { speaker: 'kerana', textKey: 'dialogue.l2.2' },
    { speaker: 'mboi_tui', textKey: 'dialogue.l2.3' },
  ],
  l3: [
    { speaker: 'monai', textKey: 'dialogue.l3.1' },
    { speaker: 'kerana', textKey: 'dialogue.l3.2' },
    { speaker: 'monai', textKey: 'dialogue.l3.3' },
  ],
  l4: [
    { speaker: 'jasy_jatere', textKey: 'dialogue.l4.1' },
    { speaker: 'kerana', textKey: 'dialogue.l4.2' },
    { speaker: 'jasy_jatere', textKey: 'dialogue.l4.3' },
  ],
  l5: [
    { speaker: 'kurupi', textKey: 'dialogue.l5.1' },
    { speaker: 'kerana', textKey: 'dialogue.l5.2' },
    { speaker: 'kurupi', textKey: 'dialogue.l5.3' },
  ],
  l6: [
    { speaker: 'ao_ao', textKey: 'dialogue.l6.1' },
    { speaker: 'kerana', textKey: 'dialogue.l6.2' },
    { speaker: 'ao_ao', textKey: 'dialogue.l6.3' },
  ],
  l7: [
    { speaker: 'luison', textKey: 'dialogue.l7.1' },
    { speaker: 'kerana', textKey: 'dialogue.l7.2' },
  ],
};

export function liberationDialogue(levelId: LevelId): DialogueLine[] {
  return LIBERATION_DIALOGUES[levelId] ?? [];
}

/** Nombre de retrato provisional para un hablante (ASSETS §4; hasta S13, placeholder por código). */
export function speakerPortraitKey(speaker: 'kerana' | BossId): string {
  return `portrait_${speaker}`;
}
