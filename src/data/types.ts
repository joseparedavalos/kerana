// Esquemas de datos (GDD §11.6).
export type LevelId = 'test' | 'vitrina' | 'l1' | 'l2' | 'l3' | 'l4' | 'l5' | 'l6' | 'l7' | 'yvaga';
export type BossId = 'teju_jagua' | 'mboi_tui' | 'monai' | 'jasy_jatere' | 'kurupi' | 'ao_ao' | 'luison' | 'tau';
export type GiftId = 'charged_slash' | 'double_jump' | 'dash' | 'heart_up';
export type Biome = 'cerro' | 'estero' | 'campo' | 'pueblo' | 'selva' | 'montana' | 'ciudad' | 'cielo';

export const BIOMES: readonly Biome[] = ['cerro', 'estero', 'campo', 'pueblo', 'selva', 'montana', 'ciudad', 'cielo'];

export interface LevelBackgrounds {
  far?: string;
  cave?: string;
  brightness?: number;
  /** Ajuste vertical del fondo (unidades del mundo; positivo lo sube). 0 por defecto: centrado. */
  shiftY?: number;
}

export interface LevelDef {
  id: LevelId;
  order: number;
  nameKey: string;
  subtitleKey: string;
  mapKey: string;
  mapSource: 'ascii' | 'tiled';
  biome: Biome;
  /** Fondo fijo a la cámara (ASSETS §6): `far` general, `cave` bajo tierra (zonas `Cave`), `brightness` 0-1 (1 por defecto). */
  backgrounds: LevelBackgrounds;
  musicKey: string;
  /** El nivel de prueba no tiene jefe. */
  boss: BossId | null;
  gift: GiftId | null;
  /** Nivel de noche con iluminación (GDD §4.8): halo de Kerana, faroles y zonas oscuras. */
  dark?: boolean;
  /** Arena final (Yvága): fuera del mapa del mundo; al ganar, final verdadero y créditos (GDD §7). */
  finale?: boolean;
  /** Coordenadas aproximadas del nodo en el mapa (GDD §8.4): x = longitud, y = latitud. */
  mapNode: { x: number; y: number };
}

export interface DialogueLine {
  /** 'kerana' o el id del jefe que habla (GDD §6). */
  speaker: 'kerana' | 'mainumby' | BossId;
  textKey: string;
}
