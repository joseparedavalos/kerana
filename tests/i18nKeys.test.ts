import { describe, expect, it } from 'vitest';
import { en } from '../src/i18n/en';
import { es } from '../src/i18n/es';
import { langFromBrowser, langFromUrl } from '../src/i18n/lang';

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
    const { PROLOGUE_SLIDES, TAU_ARRIVAL_SLIDES, ENDING_SLIDES, FEATHERS_SLIDE } = await import('../src/data/story');
    for (const slide of [...PROLOGUE_SLIDES, ...TAU_ARRIVAL_SLIDES, ...ENDING_SLIDES, FEATHERS_SLIDE]) {
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

describe('i18n: inglés', () => {
  const markers = (text: string): string[] => (text.match(/\{\w+\}/g) ?? []).sort();

  it('en.ts tiene las mismas claves que es.ts', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(es).sort());
  });

  it('cada texto en inglés tiene los mismos {marcadores} que en español', () => {
    const table: Record<string, string> = en;
    for (const [key, text] of Object.entries(es)) expect(markers(table[key] ?? ''), key).toEqual(markers(text));
  });

  it('elige el idioma por URL y por navegador', () => {
    expect(langFromUrl('?lang=en')).toBe('en');
    expect(langFromUrl('?debug=1&lang=ES')).toBe('es');
    expect(langFromUrl('?lang=fr')).toBeNull();
    expect(langFromUrl('')).toBeNull();
    expect(langFromBrowser('es-PY')).toBe('es');
    expect(langFromBrowser('gn')).toBe('es');
    expect(langFromBrowser('en-US')).toBe('en');
    expect(langFromBrowser('pt-BR')).toBe('en');
    expect(langFromBrowser(undefined)).toBe('en');
  });
});
