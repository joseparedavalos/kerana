import { beforeEach, describe, expect, it } from 'vitest';
import { defaultSave, formatPlayTime, normalizeFeathers, SaveManager } from '../src/systems/SaveManager';
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
  backgrounds: {},
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

  it('las plumas se acumulan entre partidas y el conteo nunca baja', () => {
    SaveManager.startNewGame();
    // Primera partida: la pluma 0; se sale al mapa (recarga).
    SaveManager.collectFeather('l1', 0);
    SaveManager.load();
    // Segunda partida: la 0 ya no aparece; se junta la 2.
    SaveManager.collectFeather('l1', 2);
    expect(SaveManager.load().feathers.l1).toEqual([true, false, true]);
    expect(SaveManager.featherCount('l1')).toBe(2);
    // Una partida sin plumas (o completar el nivel) no baja nada.
    SaveManager.completeLevel(LEVEL_1);
    expect(SaveManager.load().feathers.l1).toEqual([true, false, true]);
    expect(SaveManager.featherCount('l2')).toBe(0);
  });

  it('la misma pluma no cuenta dos veces; índices inválidos se ignoran', () => {
    SaveManager.startNewGame();
    SaveManager.collectFeather('l1', 1);
    SaveManager.collectFeather('l1', 1);
    SaveManager.collectFeather('l1', 3);
    SaveManager.collectFeather('l1', -1);
    expect(SaveManager.featherCount('l1')).toBe(1);
    expect(SaveManager.hasFeather('l1', 1)).toBe(true);
    expect(SaveManager.hasFeather('l1', 0)).toBe(false);
  });

  it('migra el conteo viejo (setFeatherCount) a los primeros n índices', () => {
    const old = { ...defaultSave(), feathers: { l1: [true, true, false], l2: 1, l3: [true], l4: 7, l5: 'x' } };
    globalThis.localStorage.setItem('kerana.save.v1', JSON.stringify(old));
    const save = SaveManager.load();
    expect(save.feathers).toEqual({
      l1: [true, true, false],
      l2: [true, false, false],
      l3: [true, false, false],
      l4: [true, true, true],
      l5: [false, false, false],
    });
    // Después de migrar, juntar la que faltaba suma y no pisa las viejas.
    SaveManager.collectFeather('l1', 2);
    SaveManager.collectFeather('l2', 0);
    expect(SaveManager.load().feathers.l1).toEqual([true, true, true]);
    expect(SaveManager.current.feathers.l2).toEqual([true, false, false]);
    expect(normalizeFeathers(0)).toEqual([false, false, false]);
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

  it('startNewGame conserva los ajustes (idioma, volumen, modo asistido…)', () => {
    SaveManager.startNewGame();
    SaveManager.updateSettings({ lang: 'en', music: 0.3, assist: true, textSpeed: 3 });
    SaveManager.completeLevel(LEVEL_1);
    const fresh = SaveManager.startNewGame();
    expect(fresh.unlockedLevel).toBe(1);
    expect(fresh.settings).toMatchObject({ lang: 'en', music: 0.3, assist: true, textSpeed: 3 });
    expect(SaveManager.load().settings.lang).toBe('en');
  });

  it('completeLevel desbloquea el siguiente nivel, libera al jefe y guarda el don', () => {
    SaveManager.startNewGame();
    SaveManager.completeLevel(LEVEL_1);
    const save = SaveManager.current;
    expect(save.unlockedLevel).toBe(2);
    expect(save.freed).toContain('teju_jagua');
    expect(save.gifts).toContain('charged_slash');
  });

  it('liberar a Teju Jagua (nivel 1 real) guarda el tajo cargado y sobrevive a recargar', async () => {
    const { getLevel } = await import('../src/data/levels');
    SaveManager.startNewGame();
    SaveManager.completeLevel(getLevel('l1'));
    const reloaded = SaveManager.load();
    expect(reloaded.gifts).toContain('charged_slash');
    expect(reloaded.freed).toContain('teju_jagua');
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

  it('suma el tiempo jugado, lo guarda cada tanto y una partida nueva lo reinicia', () => {
    SaveManager.startNewGame();
    SaveManager.addPlayTime(4000);
    SaveManager.addPlayTime(-5);
    expect(SaveManager.current.playTimeMs).toBe(4000);
    const stored = () => JSON.parse(globalThis.localStorage.getItem('kerana.save.v1') ?? '{}').playTimeMs;
    // Todavía no se guardó (se guarda cada 10 s o al salir de la escena).
    expect(stored()).toBe(0);
    SaveManager.addPlayTime(4000);
    SaveManager.addPlayTime(4000);
    expect(stored()).toBe(12000);
    expect(SaveManager.load().playTimeMs).toBe(12000);
    SaveManager.startNewGame();
    expect(SaveManager.current.playTimeMs).toBe(0);
  });

  it('muestra el tiempo como h:mm:ss', () => {
    expect(formatPlayTime(0)).toBe('0:00:00');
    expect(formatPlayTime(3753_000)).toBe('1:02:33');
    expect(formatPlayTime(59_999)).toBe('0:00:59');
  });
});
