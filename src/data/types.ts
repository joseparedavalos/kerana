// Esquemas de datos (GDD §11.6).
export type LevelId = 'test' | 'l1' | 'l2' | 'l3' | 'l4' | 'l5' | 'l6' | 'l7';
export type BossId = 'teju_jagua' | 'mboi_tui' | 'monai' | 'jasy_jatere' | 'kurupi' | 'ao_ao' | 'luison' | 'tau';
export type GiftId = 'charged_slash' | 'double_jump' | 'dash' | 'heart_up';
export type Biome = 'cerro' | 'estero' | 'campo' | 'pueblo' | 'selva' | 'montana' | 'ciudad';

export const BIOMES: readonly Biome[] = ['cerro', 'estero', 'campo', 'pueblo', 'selva', 'montana', 'ciudad'];

export interface LevelDef {
  id: LevelId;
  order: number;
  nameKey: string;
  subtitleKey: string;
  mapKey: string;
  mapSource: 'ascii' | 'tiled';
  biome: Biome;
  backgrounds: { key: string; factor: number }[];
  musicKey: string;
  /** El nivel de prueba no tiene jefe. */
  boss: BossId | null;
  gift: GiftId | null;
  /** Coordenadas aproximadas del nodo en el mapa (GDD §8.4): x = longitud, y = latitud. */
  mapNode: { x: number; y: number };
}

export interface DialogueLine {
  /** 'kerana' o el id del jefe que habla (GDD §6). */
  speaker: 'kerana' | BossId;
  textKey: string;
}
