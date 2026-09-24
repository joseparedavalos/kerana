import { beforeEach, describe, expect, it } from 'vitest';
import { defaultSave, SaveManager } from '../src/systems/SaveManager';
import type { LevelDef } from '../src/data/types';

// vitest corre en entorno 'node': no hay localStorage real, se simula uno en memoria.
class MemoryStorage {
  private store = new Map<string, string>();
  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
}

const LEVEL_1: LevelDef = {
  id: 'l1',
  order: 1,
  nameKey: 'level.l1.name',
  subtitleKey: 'level.l1.subtitle',
  mapKey: 'map_test',
  mapSource: 'ascii',
  biome: 'cerro',
  backgrounds: [],
  musicKey: '',
  boss: 'teju_jagua',
  gift: 'charged_slash',
  mapNode: { x: -57.15, y: -25.62 },
};

beforeEach(() => {
  globalThis.localStorage = new MemoryStorage() as unknown as Storage;
});

describe('SaveManager', () => {
  it('sin partida guardada, carga los valores por defecto', () => {
    expect(SaveManager.hasSave()).toBe(false);
    const save = SaveManager.load();
    expect(save).toEqual(defaultSave());
  });

  it('guarda y recupera (sobrevive a recargar)', () => {
    SaveManager.startNewGame();
    SaveManager.collectFeather('l1', 0);
    const reloaded = SaveManager.load();
    expect(reloaded.feathers.l1).toEqual([true, false, false]);
  });

  it('datos corruptos devuelven una partida por defecto en vez de romper el juego', () => {
    globalThis.localStorage.setItem('kerana.save.v1', '{ esto no es json');
    const save = SaveManager.load();
    expect(save).toEqual(defaultSave());
  });

  it('migra datos de una versión anterior o incompleta rellenando lo que falte', () => {
    globalThis.localStorage.setItem('kerana.save.v1', JSON.stringify({ unlockedLevel: 3 }));
    const save = SaveManager.load();
    expect(save.unlockedLevel).toBe(3);
    expect(save.settings).toEqual(defaultSave().settings);
    expect(save.freed).toEqual([]);
  });

  it('completeLevel desbloquea el siguiente nivel, libera al jefe y guarda el don', () => {
    SaveManager.startNewGame();
    SaveManager.completeLevel(LEVEL_1);
    const save = SaveManager.current;
    expect(save.unlockedLevel).toBe(2);
    expect(save.freed).toContain('teju_jagua');
    expect(save.gifts).toContain('charged_slash');
  });

  it('el don heart_up sube el máximo de corazones sin pasar el tope', () => {
    SaveManager.startNewGame();
    const bosses = ['mboi_tui', 'kurupi', 'ao_ao', 'luison'] as const;
    for (const [i, boss] of bosses.entries()) {
      SaveManager.completeLevel({ ...LEVEL_1, order: i, boss, gift: 'heart_up' });
    }
    // 4 (inicio) + 3 dones = 7 (tope, GDD §3.4/§11.9); el cuarto don no debe pasarlo.
    expect(SaveManager.current.maxHearts).toBe(7);
  });

  it('no vuelve a aplicar el don ni a liberar al jefe si el nivel ya estaba completado', () => {
    SaveManager.startNewGame();
    const heartLevel: LevelDef = { ...LEVEL_1, boss: 'mboi_tui', gift: 'heart_up' };
    SaveManager.completeLevel(heartLevel);
    SaveManager.completeLevel(heartLevel);
    expect(SaveManager.current.maxHearts).toBe(5);
    expect(SaveManager.current.freed.filter((b) => b === 'mboi_tui')).toHaveLength(1);
  });
});
