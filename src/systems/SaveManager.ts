import { GAMEPLAY } from '../config/gameplay';
import type { BossId, GiftId, LevelDef } from '../data/types';

// Guardado (GDD §11.9). localStorage con try/catch: si falla, el juego sigue sin guardar.
const STORAGE_KEY = 'kerana.save.v1';
const VERSION = 1;

export interface SaveSettings {
  music: number;
  sfx: number;
  lang: 'es' | 'en';
  assist: boolean;
  shake: boolean;
  flashes: boolean;
  textSpeed: 1 | 2 | 3;
}

export interface SaveData {
  version: 1;
  unlockedLevel: number;
  freed: BossId[];
  gifts: GiftId[];
  maxHearts: number;
  feathers: Record<string, boolean[]>;
  bestTimes: Record<string, number>;
  settings: SaveSettings;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

export function defaultSave(): SaveData {
  return {
    version: VERSION,
    unlockedLevel: 1,
    freed: [],
    gifts: [],
    maxHearts: GAMEPLAY.hearts.start,
    feathers: {},
    bestTimes: {},
    settings: { music: 1, sfx: 1, lang: 'es', assist: false, shake: true, flashes: true, textSpeed: 2 },
  };
}

/** Acepta cualquier dato (versión vieja o corrupto) y devuelve un SaveData válido. */
function sanitize(raw: unknown): SaveData {
  const def = defaultSave();
  if (!isRecord(raw)) return def;
  const settings = isRecord(raw.settings) ? { ...def.settings, ...raw.settings } : def.settings;
  return {
    version: VERSION,
    unlockedLevel: typeof raw.unlockedLevel === 'number' ? raw.unlockedLevel : def.unlockedLevel,
    freed: Array.isArray(raw.freed) ? (raw.freed as BossId[]) : def.freed,
    gifts: Array.isArray(raw.gifts) ? (raw.gifts as GiftId[]) : def.gifts,
    maxHearts: typeof raw.maxHearts === 'number' ? raw.maxHearts : def.maxHearts,
    feathers: isRecord(raw.feathers) ? (raw.feathers as Record<string, boolean[]>) : def.feathers,
    bestTimes: isRecord(raw.bestTimes) ? (raw.bestTimes as Record<string, number>) : def.bestTimes,
    settings: settings as SaveSettings,
  };
}

export class SaveManager {
  private static _current: SaveData = defaultSave();

  static get current(): SaveData {
    return this._current;
  }

  static hasSave(): boolean {
    try {
      return globalThis.localStorage?.getItem(STORAGE_KEY) != null;
    } catch {
      return false;
    }
  }

  /** Carga desde localStorage (o crea una partida nueva) y la deja como partida actual. */
  static load(): SaveData {
    try {
      const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
      this._current = raw ? sanitize(JSON.parse(raw)) : defaultSave();
    } catch {
      this._current = defaultSave();
    }
    return this._current;
  }

  static startNewGame(): SaveData {
    this._current = defaultSave();
    this.persist();
    return this._current;
  }

  static persist(): void {
    try {
      globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(this._current));
    } catch {
      // Sigue sin guardar (por ejemplo, almacenamiento bloqueado).
    }
  }

  static updateSettings(patch: Partial<SaveSettings>): void {
    this._current = { ...this._current, settings: { ...this._current.settings, ...patch } };
    this.persist();
  }

  static getFeathers(levelId: string): boolean[] {
    return this._current.feathers[levelId] ?? [false, false, false];
  }

  static collectFeather(levelId: string, index: number): void {
    const current = this.getFeathers(levelId).slice();
    current[index] = true;
    this._current = { ...this._current, feathers: { ...this._current.feathers, [levelId]: current } };
    this.persist();
  }

  /**
   * Guarda cuántas plumas se llevan de un nivel como un conteo simple (sin distinguir cuáles).
   * Hasta que los niveles reales (S6+) marquen cada pluma con su índice en el ASCII, es la única
   * forma de que el panel del mapa muestre progreso real.
   */
  static setFeatherCount(levelId: string, count: number): void {
    const arr = [false, false, false].map((_, i) => i < count);
    this._current = { ...this._current, feathers: { ...this._current.feathers, [levelId]: arr } };
    this.persist();
  }

  /**
   * Aplica la liberación de un jefe: desbloquea el siguiente nivel, guarda el don y sube el
   * máximo de corazones. `level.boss` es único por nivel, así que sirve para no aplicarlo dos
   * veces si el jugador rejuega un nivel ya completado (el don `heart_up` se repite en 3 niveles
   * distintos, GDD §3.7, por eso no se puede usar `gifts` solo para esa comprobación).
   */
  static completeLevel(level: LevelDef): void {
    const s = this._current;
    const alreadyFreed = level.boss != null && s.freed.includes(level.boss);
    const unlockedLevel = Math.max(s.unlockedLevel, level.order + 1);
    const freed = level.boss && !alreadyFreed ? [...s.freed, level.boss] : s.freed;
    let gifts = s.gifts;
    let maxHearts = s.maxHearts;
    if (level.gift && !alreadyFreed) {
      if (!s.gifts.includes(level.gift)) gifts = [...s.gifts, level.gift];
      if (level.gift === 'heart_up') maxHearts = Math.min(GAMEPLAY.hearts.max, s.maxHearts + 1);
    }
    this._current = { ...s, unlockedLevel, freed, gifts, maxHearts };
    this.persist();
  }
}
