import { es } from './es';

type Vars = Record<string, string | number>;

const warned = new Set<string>();

// Traduce una clave; si falta, devuelve ⟦clave⟧ y avisa en desarrollo.
export function t(key: string, vars?: Vars): string {
  const table: Record<string, string> = es;
  const raw = table[key];
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
