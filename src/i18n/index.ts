import { SaveManager } from '../systems/SaveManager';
import { en } from './en';
import { es } from './es';
import { pt } from './pt';

type Vars = Record<string, string | number>;

const warned = new Set<string>();

// Traduce una clave al idioma de los ajustes; si falta en inglés, cae al español; si falta en los dos, ⟦clave⟧.
export function t(key: string, vars?: Vars): string {
  const tables: Record<string, Record<string, string>> = { es, en, pt };
  const base: Record<string, string> = es;
  const table = tables[SaveManager.current.settings.lang] ?? es;
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
