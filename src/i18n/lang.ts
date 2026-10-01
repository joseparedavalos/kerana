// Elección del idioma (sin Phaser, para poder probarla).
export type Lang = 'es' | 'en';

/** ?lang=en o ?lang=es en la URL; null si no está o no es válido. */
export function langFromUrl(search: string): Lang | null {
  const v = new URLSearchParams(search).get('lang')?.trim().toLowerCase();
  return v === 'es' || v === 'en' ? v : null;
}

/** Idioma del navegador: español si empieza con "es" o "gn" (guaraní); si no, inglés. */
export function langFromBrowser(language: string | undefined): Lang {
  const v = (language ?? '').toLowerCase();
  return v.startsWith('es') || v.startsWith('gn') ? 'es' : 'en';
}
