import { describe, expect, it } from 'vitest';
import { es } from '../src/i18n/es';

describe('i18n: claves usadas en los datos', () => {
  const table: Record<string, string> = es;

  it('los diálogos de liberación referencian claves existentes', async () => {
    const { LIBERATION_DIALOGUES } = await import('../src/data/dialogues');
    for (const lines of Object.values(LIBERATION_DIALOGUES)) {
      for (const line of lines ?? []) {
        expect(table[line.textKey], line.textKey).toBeDefined();
        expect(table[`speaker.${line.speaker}`], `speaker.${line.speaker}`).toBeDefined();
      }
    }
  });

  it('las diapositivas de historia referencian claves existentes', async () => {
    const { PROLOGUE_SLIDES, ENDING_SLIDES, endingLastSlide } = await import('../src/data/story');
    for (const slide of [...PROLOGUE_SLIDES, ...ENDING_SLIDES, endingLastSlide(true), endingLastSlide(false)]) {
      expect(table[slide.textKey], slide.textKey).toBeDefined();
    }
  });

  it('los niveles referencian nameKey y subtitleKey existentes', async () => {
    const { LEVELS } = await import('../src/data/levels');
    for (const level of Object.values(LEVELS)) {
      if (!level) continue;
      expect(table[level.nameKey], level.nameKey).toBeDefined();
      expect(table[level.subtitleKey], level.subtitleKey).toBeDefined();
    }
  });

  it('los dones tienen nombre traducido', async () => {
    const giftIds = ['charged_slash', 'double_jump', 'dash', 'heart_up'];
    for (const id of giftIds) expect(table[`gift.${id}`], `gift.${id}`).toBeDefined();
  });
});
