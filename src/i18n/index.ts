import { SaveManager } from '../systems/SaveManager';
import { en } from './en';
import { es } from './es';

type Vars = Record<string, string | number>;

const warned = new Set<string>();

// Traduce una clave al idioma de los ajustes; si falta en inglés, cae al español; si falta en los dos, ⟦clave⟧.
export function t(key: string, vars?: Vars): string {
  const base: Record<string, string> = es;
  const table: Record<string, string> = SaveManager.current.settings.lang === 'en' ? en : es;
  const raw = table[key] ?? base[key];
  if (raw === undefined) {
    if (import.meta.env.DEV && !warned.has(key)) {
      warned.add(key);
      console.warn(`[i18n] Falta la clave: ${key}`);
    }
    return `⟦${key}⟧`;
  }
  if (!vars) return raw;
  return raw.replace(/\{(\w+)\}/g, (m, name: string) => (name in vars ? String(vars[name]) : m));
}
