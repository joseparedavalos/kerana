import type { LevelDef, LevelId } from './types';

// Los 7 niveles (GDD §6, coordenadas §8.4) más el nivel de prueba.
// Hasta que cada sesión de nivel (S6-S12) genere su propio `tools/levels/l<N>.txt`,
// el nodo apunta a su `map_lN` futuro (l1 ya tiene el suyo desde S6). El flujo Mapa → Nivel → Nivel
// completado → Mapa se puede jugar de punta a punta desde ya (criterio de aceptación de S4).
export const LEVELS: Partial<Record<LevelId, LevelDef>> = {
  test: {
    id: 'test',
    order: 0,
    nameKey: 'level.test.name',
    subtitleKey: 'level.test.name',
    mapKey: 'map_test',
    mapSource: 'ascii',
    biome: 'cerro',
    backgrounds: {},
    musicKey: '',
    boss: null,
    gift: null,
    mapNode: { x: 0, y: 0 },
  },
  // Vitrina de las piezas de motor (S18): fuera de la campaña y del mapa (order 0). ?debug=1&level=vitrina&gifts=all
  vitrina: {
    id: 'vitrina',
    order: 0,
    nameKey: 'level.vitrina.name',
    subtitleKey: 'level.vitrina.name',
    mapKey: 'map_vitrina',
    mapSource: 'ascii',
    biome: 'selva',
    backgrounds: {},
    musicKey: '',
    boss: null,
    gift: null,
    mapNode: { x: 0, y: 0 },
  },
  l1: {
    id: 'l1',
    order: 1,
    nameKey: 'level.l1.name',
    subtitleKey: 'level.l1.subtitle',
    mapKey: 'map_l1',
    mapSource: 'ascii',
    biome: 'cerro',
    // Subido: con el suelo tan arriba de la vista, centrado quedaban tapados los cerros.
    backgrounds: {
      far: 'bg_l1_far',
      cave: 'bg_l1_cave',
      shiftY: 110,
      // S108: loros que van a dormir, en el cielo arriba de las sierras (la cima más alta, x 478, llega a y 307).
      skyLife: { birds: [185, 265], flock: 'parrots' },
      // S108, medido en l1_far.jpg: los rayos salen de detrás de la cima más alta; cada valle, la cresta de la loma de
      // adelante (bordes de lejanía, rastreados y simplificados a 2 px). A: el pie de las sierras; B: las lomas del medio;
      // C, D y E: las de adelante.
      dusk: {
        rays: [478, 352],
        valleys: [
          {
            layer: 0,
            line: [
              96, 383, 112, 392, 128, 395, 160, 413, 176, 410, 192, 416, 208, 416, 272, 401, 304, 403, 336, 413, 368, 404,
              384, 403, 416, 413, 464, 420, 480, 422, 512, 418, 544, 423, 576, 418, 592, 411, 640, 401, 672, 403, 720, 415,
              736, 413, 768, 416, 832, 433, 848, 420, 864, 424, 880, 423, 896, 417, 912, 420, 1024, 411, 1072, 424,
              1104, 423, 1120, 415, 1136, 394, 1152, 404, 1168, 408, 1200, 408, 1216, 394, 1232, 395, 1279, 406,
            ],
          },
          {
            layer: 1,
            line: [
              380, 456, 428, 436, 492, 460, 524, 463, 556, 477, 620, 493, 636, 504, 668, 499, 684, 506, 716, 500, 748, 499,
              764, 488, 780, 486, 812, 475, 828, 474, 860, 460, 876, 462, 924, 452, 956, 438, 988, 438, 1068, 458,
              1084, 458, 1116, 449, 1164, 428, 1279, 456,
            ],
          },
          {
            layer: 2,
            line: [
              0, 465, 32, 463, 48, 458, 64, 471, 96, 485, 112, 484, 128, 494, 160, 482, 176, 486, 208, 504, 256, 520, 288, 523,
              304, 532, 320, 532, 352, 540, 384, 554, 400, 568,
            ],
          },
          { layer: 2, line: [470, 565, 518, 545, 534, 545, 566, 533, 582, 532, 598, 521, 630, 521, 640, 507] },
          {
            layer: 2,
            line: [
              1000, 550, 1048, 539, 1080, 525, 1128, 518, 1144, 511, 1160, 519, 1176, 512, 1192, 512, 1208, 522, 1224, 515,
              1240, 516, 1256, 522, 1272, 522, 1279, 526,
            ],
          },
        ],
      },
      // S108, medido en l1_cave.jpg (por color: violeta, cian y oro): trece grupos de cristales, el montón de oro, seis
      // estalactitas con la punta a la vista y dónde cae cada gota (cinco sobre un cristal), y el aire del medio.
      caveLife: {
        bats: [205, 320],
        crystals: [
          [69, 333, 91, 359],
          [110, 360, 145, 395],
          [123, 469, 165, 501],
          [171, 320, 185, 348],
          [190, 332, 213, 370],
          [446, 422, 472, 444],
          [573, 427, 612, 449],
          [624, 403, 643, 421],
          [817, 376, 840, 398],
          [1134, 282, 1185, 335],
          [52, 462, 98, 498],
          [822, 414, 862, 439],
          [1016, 330, 1060, 368],
        ],
        gold: [662, 350, 815, 410],
        drops: [
          [114, 222, 362],
          [174, 171, 320],
          [500, 157, 431],
          [827, 202, 389],
          [1036, 171, 330],
          [1163, 159, 285],
        ],
        dust: [240, 170, 1080, 420],
      },
    },
    terrainShell: 3,
    solidFloor: false,
    // S87: el cerro macizo entre las dos cuevas va relleno; bajo las zonas `Cave` sigue el fondo de cueva.
    earthBackdrop: true,
    // S109: la roca del cerro sin repetirse (variantes por celda) y con detalle según la profundidad.
    terrainDetail: { sheet: 'cerro', seed: 109 },
    musicKey: '',
    boss: 'teju_jagua',
    gift: 'charged_slash',
    mapNode: { x: -57.15, y: -25.62 },
  },
  l2: {
    id: 'l2',
    order: 2,
    nameKey: 'level.l2.name',
    subtitleKey: 'level.l2.subtitle',
    mapKey: 'map_l2',
    mapSource: 'ascii',
    biome: 'estero',
    // S96: el sol respira y el reflejo titila. Medido en l2_far.jpg: el disco va de x 712 a 741 y de y 324 a 341.
    backgrounds: { far: 'bg_l2_far', sun: { at: [726, 334], reflection: [692, 354, 764, 442] } },
    terrainShell: 3,
    // S110: el barro macizo del albardón, la pared y la cima va relleno (eran los últimos agujeros del juego).
    earthBackdrop: true,
    // S110: el barro del estero sin repetirse (variantes por celda), con detalle según la profundidad, el agua en tres
    // tonos y el brillo que corre por la superficie.
    terrainDetail: { sheet: 'estero', seed: 110 },
    waterGlints: true,
    musicKey: '',
    boss: 'mboi_tui',
    gift: 'heart_up',
    mapNode: { x: -58.3, y: -26.86 },
  },
  l3: {
    id: 'l3',
    order: 3,
    nameKey: 'level.l3.name',
    subtitleKey: 'level.l3.subtitle',
    mapKey: 'map_l3',
    mapSource: 'ascii',
    biome: 'campo',
    // S98: medido en l3_far.jpg (px de arte): nubes bajas de y 300 a 348, sierras desde 349, llanura de 378 a 480.
    backgrounds: { far: 'bg_l3_far', skyLife: { birds: [302, 344], shadows: [384, 474] } },
    terrainShell: 3,
    // S68: dentro de la tierra maciza se ve tierra colorada, no el cielo. l2, l4, l5 y l6: la misma línea.
    earthBackdrop: true,
    // S111: la tierra colorada sin repetirse (variantes por celda sobre el tileset real de S56), con laterita, itakurú,
    // cuarzo, raíces y galerías de hormigas según la profundidad.
    terrainDetail: { sheet: 'campo', seed: 111 },
    musicKey: '',
    boss: 'monai',
    gift: 'double_jump',
    mapNode: { x: -57.14, y: -26.67 },
  },
  l4: {
    id: 'l4',
    order: 4,
    nameKey: 'level.l4.name',
    subtitleKey: 'level.l4.subtitle',
    mapKey: 'map_l4',
    mapSource: 'ascii',
    biome: 'pueblo',
    // Fondo lejano (cerros, campanario, lapacho). La calle es el tileset, como en l3.
    // S73: es el original entero, sin deformar. Bajado 96: la imagen crece pareja (×1,33 sobre la vista) y el patio con
    // vacas (desde la fila 760 de 1008) queda bajo el borde de abajo de la pantalla aun con la cámara al fondo del nivel.
    backgrounds: { far: 'bg_l4_far', shiftY: -96, skyLife: { birds: [80, 200] }, sun: { at: [558, 82], reflection: [0, 0, 1, 1] } },
    terrainShell: 3,
    // S75: el cuerpo de casa Z, la plaza y la base del campanario se cortó (losas flotantes); el relleno queda para
    // lo poco que sigue macizo (museo, casa del patio, galpón, muelles). tests/holes.test.ts lo exige.
    earthBackdrop: true,
    // S112: Capiatá por código (tools/lib/pueblo-art.mjs): casas de adobe encalado con tejas y, en la hoja de detalle, la
    // calle por zonas (tierra, empedrado, ladrillo, zócalo y cimiento), variantes y calcomanías según la profundidad.
    terrainDetail: { sheet: 'pueblo', seed: 112 },
    musicKey: '',
    boss: 'jasy_jatere',
    gift: 'dash',
    mapNode: { x: -57.45, y: -25.35 },
  },
  l5: {
    id: 'l5',
    order: 5,
    nameKey: 'level.l5.name',
    subtitleKey: 'level.l5.subtitle',
    mapKey: 'map_l5',
    mapSource: 'ascii',
    biome: 'selva',
    // S59: arriba del dosel, la luz que se filtra (no negro); la lluvia pintada cae.
    // S60: el dosel (copas, niebla en bandas y rayos de luz) en el relleno de arriba.
    backgrounds: { far: 'bg_l5_far', fillTop: '#a9bf98', rain: true, canopy: true },
    terrainShell: 3,
    // S100: el relleno (la casilla 15 de selva, sin tinte) tapa las masas huecas: la meseta de x 98-128 y la columna de x 261-263.
    earthBackdrop: true,
    // S113: el monte de Canindeyú por código (tools/lib/selva-art.mjs): tierra colorada bajo el humus y la hojarasca, y en
    // la hoja de detalle variantes, raíces, piedras con musgo, semillas, bichos y raicillas que cuelgan de las salientes.
    terrainDetail: { sheet: 'selva', seed: 113 },
    musicKey: '',
    boss: 'kurupi',
    gift: 'heart_up',
    mapNode: { x: -55.52, y: -24.13 },
  },
  l6: {
    id: 'l6',
    order: 6,
    nameKey: 'level.l6.name',
    subtitleKey: 'level.l6.subtitle',
    mapKey: 'map_l6',
    mapSource: 'ascii',
    biome: 'montana',
    // Sombras de nubes que cruzan despacio (S98, el mismo sistema que l3) sobre la franja de nubes;
    // pájaros altos y chicos. No mueve el dibujo: es una capa encima, se saca sacando skyLife.
    backgrounds: { far: 'bg_l6_far', rain: true, skyLife: { birds: [60, 150], shadows: [120, 340] } },
    terrainShell: 3,
    // S78: dentro del cerro en zigzag, la baldosa de montana rodeada por los cuatro lados, al mismo tono que el
    // terreno (sin tinte ni degradado), en la grilla de 16 px: no se ve el cielo de tormenta adentro.
    earthBackdrop: true,
    // S116: la tierra del cerro sin repetirse (variantes por celda sobre el tileset real de montana), con capas y bloques
    // de arenisca, vetas de hierro, cuarzo, liquen y raíces según la profundidad.
    terrainDetail: { sheet: 'montana', seed: 116 },
    musicKey: '',
    boss: 'ao_ao',
    gift: 'heart_up',
    mapNode: { x: -56.25, y: -25.85 },
  },
  l7: {
    id: 'l7',
    order: 7,
    nameKey: 'level.l7.name',
    subtitleKey: 'level.l7.subtitle',
    mapKey: 'map_l7',
    mapSource: 'ascii',
    biome: 'ciudad',
    // S59: la niebla baja entre los mausoleos corre despacio.
    backgrounds: { far: 'bg_l7_far', mist: { region: [0, 0.69, 1, 0.8] } },
    musicKey: '',
    boss: 'luison',
    gift: null,
    dark: true,
    mapNode: { x: -57.63, y: -25.28 },
  },
  // Yvága, el cielo (GDD §7): la subida (S92), un nivel vertical de siete tramos, y arriba la arena de Tau. Se llega
  // al liberar a Luisón; Kerana empieza abajo y entra a la antesala por debajo.
  yvaga: {
    id: 'yvaga',
    order: 8,
    nameKey: 'level.yvaga.name',
    subtitleKey: 'level.yvaga.subtitle',
    mapKey: 'map_yvaga',
    mapSource: 'ascii',
    biome: 'cielo',
    // S92: un solo cielo vertical, del mar de nubes (la base) a la noche con estrellas (la arena); se recorre entero
    // con la subida (`climb`). `bg_yvaga_far` queda para el título.
    // S118: el cielo vivo: capas de nubes con parallax y estrellas fugaces en la noche (`skyDrift`).
    backgrounds: { far: 'bg_yvaga_subida', climb: true, skyDrift: true },
    // S92: la cámara mira 2,5 tiles hacia arriba: subiendo, sobre la cabeza de Kerana se ven unas 10 filas (sin esto, 7).
    cameraLookUp: 40,
    // S118: las ruinas flotantes por código (tools/lib/cielo-art.mjs): variantes de los sillares, la quilla bajo las
    // islas, el detalle de la cara (musgo, flores, grietas, runas) y la terraza de la arena (zona `terrace`).
    terrainDetail: { sheet: 'cielo', seed: 118 },
    musicKey: '',
    boss: 'tau',
    gift: null,
    finale: true,
    mapNode: { x: -57.63, y: -25.28 },
  },
};

/** Los 7 niveles jugables, en orden (sin el nivel de prueba ni Yvága), para el mapa del mundo. */
export const WORLD_LEVELS: LevelDef[] = Object.values(LEVELS)
  .filter((l): l is LevelDef => l != null && l.order > 0 && !l.finale)
  .sort((a, b) => a.order - b.order);

export const DEFAULT_LEVEL: LevelId = 'test';

export function getLevel(id: LevelId): LevelDef {
  const def = LEVELS[id];
  if (def) return def;
  console.warn(`[NIVEL] "${id}" todavía no existe; se usa "${DEFAULT_LEVEL}".`);
  return LEVELS[DEFAULT_LEVEL] as LevelDef;
}
