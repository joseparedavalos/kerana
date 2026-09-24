import type { SaveSettings } from './SaveManager';

// Velocidad del texto letra por letra (Opciones, GDD §8.6): caracteres por segundo.
export const CHARS_PER_SEC: Record<SaveSettings['textSpeed'], number> = { 1: 18, 2: 30, 3: 48 };

export function charsToShow(elapsedMs: number, speed: SaveSettings['textSpeed']): number {
  return Math.floor((elapsedMs / 1000) * CHARS_PER_SEC[speed]);
}
