import type { LevelId } from '../data/types';

// Parámetros de URL de depuración (GDD §11.11).
export interface DebugFlags {
  debug: boolean;
  level: LevelId | null;
  boss: boolean;
  giftsAll: boolean;
  god: boolean;
}

const LEVEL_IDS: readonly LevelId[] = ['test', 'l1', 'l2', 'l3', 'l4', 'l5', 'l6', 'l7'];

export function parseLevelParam(value: string | null): LevelId | null {
  if (!value) return null;
  const v = value.trim().toLowerCase();
  if (/^[1-7]$/.test(v)) return `l${v}` as LevelId;
  return (LEVEL_IDS as readonly string[]).includes(v) ? (v as LevelId) : null;
}

/** Los parámetros solo se activan en desarrollo o con ?debug=1. */
export function parseDebugFlags(search: string, isDev: boolean): DebugFlags {
  const p = new URLSearchParams(search);
  const debug = p.get('debug') === '1';
  const active = isDev || debug;
  return {
    debug,
    level: active ? parseLevelParam(p.get('level')) : null,
    boss: active && p.get('boss') === '1',
    giftsAll: active && p.get('gifts') === 'all',
    god: active && p.get('god') === '1',
  };
}

export const DEBUG: DebugFlags =
  typeof window === 'undefined'
    ? parseDebugFlags('', false)
    : parseDebugFlags(window.location.search, import.meta.env.DEV);
