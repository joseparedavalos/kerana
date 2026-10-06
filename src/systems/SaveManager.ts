import { GAMEPLAY } from '../config/gameplay';
import type { BossId, GiftId, LevelDef } from '../data/types';
import { langFromBrowser, langFromUrl, type Lang } from '../i18n/lang';

// Guardado (GDD §11.9). localStorage con try/catch: si falla, el juego sigue sin guardar.
const STORAGE_KEY = 'kerana.save.v1';
const VERSION = 1;

export interface SaveSettings {
  music: number;
  sfx: number;
  lang: Lang;
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
  /** Tiempo jugado en niveles e historia (ms), sin pausa ni menús. */
  playTimeMs: number;
  settings: SaveSettings;
}

/** Cada cuánto se guarda el tiempo jugado mientras corre (ms); al salir de la escena se guarda igual. */
const PLAY_TIME_PERSIST_MS = 10000;

/** Tiempo de juego como "1:02:33" (horas sin ceros a la izquierda). */
export function formatPlayTime(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

const FEATHERS_PER_LEVEL = GAMEPLAY.hud.featherMax;

/**
 * Plumas de un nivel como arreglo de 3 booleanos por índice. Migra guardados viejos: antes de S17
 * se guardaba solo cuántas (`setFeatherCount`, también como número suelto); ese n pasa a ser los
 * primeros n índices. Un arreglo viejo ya tenía esa forma, así que se conserva tal cual.
 */
export function normalizeFeathers(raw: unknown): boolean[] {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    const n = Math.max(0, Math.min(FEATHERS_PER_LEVEL, Math.floor(raw)));
    return Array.from({ length: FEATHERS_PER_LEVEL }, (_, i) => i < n);
  }
  const arr = Array.isArray(raw) ? raw : [];
  return Array.from({ length: FEATHERS_PER_LEVEL }, (_, i) => arr[i] === true);
}

function sanitizeFeathers(raw: unknown): Record<string, boolean[]> {
  if (!isRecord(raw)) return {};
  const out: Record<string, boolean[]> = {};
  for (const [levelId, value] of Object.entries(raw)) out[levelId] = normalizeFeathers(value);
  return out;
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
    playTimeMs: 0,
    settings: { music: 1, sfx: 1, lang: langFromBrowser(globalThis.navigator?.language), assist: false, shake: true, flashes: true, textSpeed: 2 },
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
    feathers: sanitizeFeathers(raw.feathers),
    bestTimes: isRecord(raw.bestTimes) ? (raw.bestTimes as Record<string, number>) : def.bestTimes,
    playTimeMs: typeof raw.playTimeMs === 'number' && raw.playTimeMs >= 0 ? raw.playTimeMs : def.playTimeMs,
    settings: settings as SaveSettings,
  };
}

export class SaveManager {
  private static _current: SaveData = defaultSave();
  private static unsavedPlayMs = 0;

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
    this.unsavedPlayMs = 0;
    let saved = false;
    try {
      const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
      saved = raw != null;
      this._current = raw ? sanitize(JSON.parse(raw)) : defaultSave();
    } catch {
      this._current = defaultSave();
    }
    // ?lang= siempre gana. Sin partida no se crea una (aparecería "Continuar"): se guarda al empezar a jugar.
    const lang = langFromUrl(globalThis.location?.search ?? '');
    if (lang && lang !== this._current.settings.lang) {
      this._current = { ...this._current, settings: { ...this._current.settings, lang } };
      if (saved) this.persist();
    }
    return this._current;
  }

  /** Partida nueva (también "Borrar partida"): reinicia el progreso pero conserva los ajustes. */
  static startNewGame(): SaveData {
    this._current = { ...defaultSave(), settings: { ...this._current.settings } };
    this.persist();
    return this._current;
  }

  static persist(): void {
    this.unsavedPlayMs = 0;
    try {
      globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(this._current));
    } catch {
      // Sigue sin guardar (por ejemplo, almacenamiento bloqueado).
    }
  }

  /** Suma tiempo jugado (lo llaman los `update` de LevelScene y StoryScene: la pausa los detiene). */
  static addPlayTime(ms: number): void {
    if (!(ms > 0)) return;
    // Sin copiar el objeto: se llama en cada frame.
    this._current.playTimeMs += ms;
    this.unsavedPlayMs += ms;
    if (this.unsavedPlayMs >= PLAY_TIME_PERSIST_MS) this.persist();
  }

  static updateSettings(patch: Partial<SaveSettings>): void {
    this._current = { ...this._current, settings: { ...this._current.settings, ...patch } };
    this.persist();
  }

  static getFeathers(levelId: string): boolean[] {
    return this._current.feathers[levelId] ?? normalizeFeathers(null);
  }

  static hasFeather(levelId: string, index: number): boolean {
    return this.getFeathers(levelId)[index] === true;
  }

  /** Cuántas plumas de este nivel hay guardadas (panel del mapa y HUD). */
  static featherCount(levelId: string): number {
    return this.getFeathers(levelId).filter(Boolean).length;
  }

  /**
   * Marca la pluma `index` (0–2) como recogida y guarda en el momento (GDD §4.6). Es acumulativo:
   * nunca desmarca, y una pluma ya guardada no cuenta dos veces.
   */
  static collectFeather(levelId: string, index: number): void {
    if (!Number.isInteger(index) || index < 0 || index >= FEATHERS_PER_LEVEL) return;
    if (this.hasFeather(levelId, index)) return;
    const current = this.getFeathers(levelId).slice();
    current[index] = true;
    this._current = { ...this._current, feathers: { ...this._current.feathers, [levelId]: current } };
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
