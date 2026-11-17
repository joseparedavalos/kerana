// Elección del idioma (sin Phaser, para poder probarla).
export type Lang = 'es' | 'en' | 'pt';

/** ?lang=en, ?lang=es o ?lang=pt en la URL; null si no está o no es válido. */
export function langFromUrl(search: string): Lang | null {
  const v = new URLSearchParams(search).get('lang')?.trim().toLowerCase();
  return v === 'es' || v === 'en' || v === 'pt' ? v : null;
}

/** Idioma del navegador: español si empieza con "es" o "gn" (guaraní), portugués con "pt"; si no, inglés. */
export function langFromBrowser(language: string | undefined): Lang {
  const v = (language ?? '').toLowerCase();
  if (v.startsWith('es') || v.startsWith('gn')) return 'es';
  if (v.startsWith('pt')) return 'pt';
  return 'en';
}
