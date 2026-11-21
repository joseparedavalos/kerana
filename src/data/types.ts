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
  /**
   * Color de arriba del relleno (S59, '#rrggbb'): lo que destapa la vista arriba de la imagen pasa en degradado del
   * borde de la imagen a este color. Sin él, el relleno es del color del borde.
   */
  fillTop?: string;
  /** La imagen trae lluvia pintada (S59): se separa del dibujo y cae (GAMEPLAY.backdrop.rain). */
  rain?: boolean;
  /** La imagen trae niebla pintada en esta franja (S59; fracciones x0, y0, x1, y1): una copia corre de costado. */
  mist?: { region: readonly [number, number, number, number] };
  /** El relleno de arriba es dosel (S60): siluetas de copas, niebla en bandas y rayos de luz (GAMEPLAY.backdrop.canopy). */
  canopy?: boolean;
  /**
   * Fondo de una subida (S92): si `far` es más alta que la vista, va al ancho de la vista en su proporción y se recorre
   * entera con el avance vertical: abajo del nivel se ve su pie y arriba, su tope. Sin agrandado, `shiftY` ni relleno.
   * Con una imagen que no es más alta que la vista no cambia nada.
   */
  climb?: boolean;
  /**
   * El cielo vivo (S118, Yvága): capas de nubes que se deslizan delante del fondo a distintas velocidades de parallax
   * mientras se sube, detrás de todo lo jugable, y una estrella fugaz de vez en cuando en la noche de arriba
   * (GAMEPLAY.backdrop.skyDrift). Con «Destellos» apagado, sin estrellas fugaces.
   */
  skyDrift?: boolean;
  /**
   * El sol de la imagen (S96; px de arte): `at`, el centro del disco; `reflection`, el rectángulo (x0, y0, x1, y1) de la
   * columna dorada del agua. Un halo respira sobre el sol y titilan destellos en el reflejo (GAMEPLAY.backdrop.sun).
   */
  sun?: { at: readonly [number, number]; reflection: readonly [number, number, number, number] };
  /**
   * El cielo y la llanura con vida (S98; px de arte, filas y0 y1 de la imagen): `birds`, la franja del cielo por donde
   * cruzan las bandadas; `shadows`, la franja de la llanura por donde corren las sombras de nubes (GAMEPLAY.backdrop.skyLife).
   */
  skyLife?: { birds: readonly [number, number]; shadows?: readonly [number, number]; flock?: 'birds' | 'parrots' };
  /**
   * El atardecer de l1 (S108; px de arte de `far`): `rays`, de dónde salen los rayos (detrás de las sierras); `valleys`,
   * cada cresta del bosque como polilínea (x, y, x, y…) y su capa (0 la más lejana): la bruma va arriba de la cresta,
   * con el pie tapado por la loma (GAMEPLAY.backdrop.dusk).
   */
  dusk?: { rays: readonly [number, number]; valleys: ReadonlyArray<{ line: readonly number[]; layer: number }> };
  /**
   * La cueva con vida (S108; px de arte de `cave`): `bats`, la franja (y0, y1) por donde cruzan los murciélagos;
   * `crystals`, el rectángulo (x0, y0, x1, y1) de cada grupo; `gold`, el del montón de oro; `drops`, cada gota (x y
   * de la punta de la estalactita, y donde cae); `dust`, el rectángulo del polvo (GAMEPLAY.backdrop.caveLife).
   */
  caveLife?: {
    bats: readonly [number, number];
    crystals: ReadonlyArray<readonly [number, number, number, number]>;
    gold: readonly [number, number, number, number];
    drops: ReadonlyArray<readonly [number, number, number]>;
    dust: readonly [number, number, number, number];
  };
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
  /**
   * Terreno como repisa (S28): la capa Ground se dibuja solo hasta estos tiles del aire más cercano (la última fila,
   * tenue) y más adentro se ve el fondo. Solo es dibujo: las colisiones no cambian. Sin valor, bloque macizo.
   * El piso que llega al borde de abajo se dibuja entero, salvo `solidFloor: false`.
   */
  terrainShell?: number;
  /** false: también el piso largo es una franja y debajo se ve el fondo. Por defecto se dibuja hasta abajo. */
  solidFloor?: boolean;
  /**
   * Fondo de tierra (S68, S69, S71): con `terrainShell`, lo que asoma detrás de la repisa dentro de la tierra maciza
   * es la baldosa del relleno del suelo, igual que el terreno (GAMEPLAY.backdrop.earth), y no el fondo lejano.
   */
  earthBackdrop?: boolean;
  /**
   * Detalle del terreno (S109): la hoja `tiles/detalle/<sheet>.png` (con su .json) pone variantes del relleno y de los
   * bordes, elegidas por celda con `seed`, y una capa de calcomanías sobre Ground (GAMEPLAY.backdrop.terrainDetail; lo
   * propio de cada hoja, en su `sheets`). S110: también el agua (superficie, cuerpo y fondo) y la luz del barro seco.
   * Solo dibujo: las colisiones y el autotile no cambian.
   */
  terrainDetail?: { sheet: string; seed: number };
  /**
   * S110: un brillo que corre por la superficie del agua (trazos de luz que aparecen, corren y se apagan; GAMEPLAY.backdrop
   * .waterGlints). Solo dibujo; con «Destellos» apagado no se ve.
   */
  waterGlints?: boolean;
  musicKey: string;
  /** El nivel de prueba no tiene jefe. */
  boss: BossId | null;
  gift: GiftId | null;
  /** Nivel de noche con iluminación (GDD §4.8): halo de Kerana, faroles y zonas oscuras. */
  dark?: boolean;
  /**
   * Cuánto mira la cámara hacia arriba (unidades del mundo, S92): un nivel que sube quiere ver lo que viene. Solo fuera
   * de la arena trabada. Sin valor, Kerana va al centro de la vista, como siempre.
   */
  cameraLookUp?: number;
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
