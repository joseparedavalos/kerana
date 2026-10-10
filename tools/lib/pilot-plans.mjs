// Planes del piloto automático (tools/lib/pilot.mjs), en tiles. Uno por nivel y ruta; ver docs/RECETA-NIVEL.md.

// l1 · Paraguarí (S19). Ruta baja = la principal: salta el hoyo del hongo (x 146-147), Luz de Arasy, cuatro
// teju'i y el hongo de x 177. Ruta alta: se deja caer al hoyo, rebota y va por las repisas de la fila 8.
const L1_COMMON = {
  // Piedra de la reja (x 91) y la de la balsa (x 117). La temporizada de la cueva (x 27) es opcional.
  hitSwitches: [
    [91, 8],
    [117, 8],
  ],
  // Bajar del bloque de la cueva (no subir a la repisa), bajar de la meseta caminando,
  // entrar a la cueva de C y dejarse caer por el hueco de la galería 1.
  noGapJump: [
    [23, 26],
    [134, 139],
    [186, 197],
    [233, 241],
  ],
  splits: [
    ['fuego x 101', 101],
    ['fuego x 184', 184],
    ['antesala x 250', 250],
  ],
  steps: [
    // S23: el hueco antes del bloque de la piedra (x 112-113) con un salto que apunta al bloque: corriendo, con el juego
    // lento, caía sobre la balsa o pasaba de largo la piedra.
    { run: 1, untilX: 110 },
    { jumpTo: [115.5, 9] },
    // Cae 1,5 tiles adentro de la orilla (con 0,5, al frenar en el aire se volvía al hueco).
    { mover: [118, 9], dir: 1, power: true, exit: 'jump', landX: 131.5 },
    { run: 1, untilTop: 16 },
    { run: -1, untilX: 205.4 },
    { mover: [200, 22], dir: -1, exit: 'walk', exitDir: 1 },
    { run: 1, untilFight: true },
  ],
};

export const L1_LOW = L1_COMMON;
export const L1_HIGH = { ...L1_COMMON, noGapJump: [...L1_COMMON.noGapJump, [143, 147]] };

// l2 · Ñeembucú (S22, segunda pasada en S23). Ruta principal: roca agrietada, cadenas de camalotes (jakare en la 2),
// piedra encerrada y balsa, par de balsas (mbói en la llegada), hongo -> balsa alta, atajo del fardo con el hongo de la
// chimenea, pozo a la ruta baja, poste del ñakurutu y par de balsas, ascenso 2 (hongo dormido, plataforma vertical,
// hongo de un uso -> balsa alta) y la cadena más larga. Ruta alta: pencas, muro y ruta alta. Copa: el camino del ñakurutu guasu.
export const L2_MAIN = {
  aim: true,
  // Bajar de la cima del albardón por el pozo y de la cima del ascenso 2 sin saltar.
  noGapJump: [
    [150, 154.5],
    [250, 254.5],
  ],
  splits: [
    ['fuego x 74', 74],
    ['ascenso 1 x 125', 125],
    ['fuego x 198', 198],
    ['ascenso 2 x 219', 219],
    ['fuego x 307', 307],
    ['antesala x 376', 376],
  ],
  steps: [
    { run: 1, untilX: 12 },
    { charge: 1 },
    { run: 1, untilX: 90.5 },
    { charge: -1 },
    { mover: [89, 33], dir: 1, exit: 'walk' },
    { run: 1, untilX: 107 },
    { mover: [109, 33], dir: 1, exit: 'none' },
    { mover: [122, 33], at: 'end', dir: 1, exit: 'walk' },
    { run: 1, untilX: 130 },
    { bounce: [132, 32], onto: [129, 26] },
    { mover: [129, 26], dir: 1, exit: 'walk' },
    { run: 1, untilX: 146.6 },
    { bounce: [148, 25], landX: 149, landTop: 18 },
    { run: 1, untilTop: 25 },
    { run: 1, untilX: 207 },
    // S23: par de balsas después del poste del ñakurutu (antes, camalotes).
    { mover: [210, 33], dir: 1, exit: 'none' },
    { mover: [219, 33], at: 'end', dir: 1, exit: 'walk' },
    { run: 1, untilX: 222 },
    { charge: 1 },
    { bounce: [224, 32], landX: 229, landTop: 26 },
    { mover: [222, 26], dir: -1, exit: 'walk', exitDir: 1 },
    { run: 1, untilX: 230.5 },
    { bounce: [232, 18], wait: { mover: [229, 12], at: 'origin' }, onto: [229, 12] },
    { mover: [229, 12], dir: 1, exit: 'walk' },
    { run: 1, untilX: 259 },
    { run: 1, untilX: 261.5 },
    { run: 1, wait: [269, 33], untilMover: [269, 33] },
    { mover: [269, 33], dir: 1, exit: 'none' },
    { mover: [280, 27], at: 'end', dir: 1, exit: 'jump', landX: 284.8 },
    { mover: [289, 33], dir: 1, exit: 'none' },
    { mover: [302, 33], at: 'end', dir: 1, exit: 'walk' },
    // S24: zona de ritmo, seis balsas sobre agua honda; en cada encuentro espera a que el jakare guasu se hunda.
    { run: 1, untilX: 317.5 },
    { mover: [319, 33], dir: 1, exit: 'none' },
    { mover: [332, 33], at: 'end', dir: 1, exit: 'none', safe: [327, 32] },
    { mover: [337, 33], dir: 1, exit: 'walk', safe: [336, 32] },
    { mover: [351, 33], at: 'end', dir: 1, exit: 'none' },
    { mover: [356, 33], dir: 1, exit: 'none', safe: [355, 32] },
    { mover: [369, 33], at: 'end', dir: 1, exit: 'walk', safe: [364, 32] },
    { run: 1, untilFight: true },
  ],
};

// Ruta alta de l2, desde la repisa del ascenso 1 (x 143, fila 26): pencas en zigzag, muro de roca agrietada,
// balsa sobre el hueco, nido de fardo, hueco con el ñakurutu del poste y bajada al fuego 2.
export const L2_HIGH = {
  aim: true,
  steps: [
    { jumpTo: [138.5, 23] },
    { jumpTo: [133.5, 20] },
    { jumpTo: [139.5, 17] },
    { run: 1, untilX: 155.5 },
    { charge: 1 },
    { run: 1, untilX: 164.5 },
    { mover: [166, 18], dir: 1, exit: 'walk' },
    { run: 1, untilX: 199 },
  ],
};

// Copa del palmar de l2 (S23), el camino oculto del ñakurutu guasu, desde la cima del albardón (x 155,5, fila 18):
// muro de roca agrietada, ascensor del tronco hueco (se sube saltando desde abajo), par de balsas de la copa, rama del
// guardián (pasa por debajo mientras se lanza y vuelve), rama baja con la pluma B y caída al fuego 2.
export const L2_COPA = {
  aim: true,
  // Bajar de la rama del guardián a la rama baja, y de ahí al suelo, sin saltar.
  noGapJump: [[189, 198]],
  steps: [
    { charge: 1 },
    { run: 1, untilX: 158.5 },
    { mover: [157, 14], dir: 1, exit: 'walk' },
    { mover: [165, 9], dir: 1, exit: 'none' },
    { mover: [176, 9], at: 'end', dir: 1, exit: 'walk' },
    { run: 1, untilX: 199 },
  ],
};

// l3 · Misiones (S25). Ruta principal: tacurú agrietado, ñandú, par de balsas, pencas de la loma, grieta, viento en
// contra (espera la calma), par de balsas, hongo -> repisa -> ascensor, vuelta por la barra y la rama alta, meseta (zanja y
// tacurú agrietado), hongo
// dormido, pencas en zigzag, copas, la cadena de seis y la zona de ritmo (en cada encuentro espera que amaine).
export const L3_MAIN = {
  aim: true,
  wind: true,
  splits: [
    ['fuego x 127', 127],
    ['ascenso 2 x 172', 172],
    ['fuego x 232', 232],
    ['cadena x 281', 281],
    ['fuego x 349', 349],
    ['antesala x 448', 448],
  ],
  steps: [
    { run: 1, untilX: 11 },
    { charge: 1 },
    { run: 1, untilX: 59.5 },
    { mover: [61, 33], dir: 1, exit: 'none' },
    { mover: [74, 33], at: 'end', dir: 1, exit: 'walk' },
    { run: 1, untilX: 79 },
    { jumpTo: [81, 30] },
    { jumpTo: [85, 27] },
    { jumpTo: [81, 24] },
    { jumpTo: [86, 21] },
    { run: 1, untilX: 154.5 },
    { mover: [156, 33], dir: 1, exit: 'none' },
    { mover: [169, 33], at: 'end', dir: 1, exit: 'walk' },
    { run: 1, untilX: 172.5 },
    { bounce: [174, 32], landX: 178.5, landTop: 26 },
    // Arriba del ascensor, a la izquierda por la barra (hueco con karakara) hasta el hongo de la rama alta.
    { mover: [181, 26], dir: 1, exit: 'walk', exitDir: -1 },
    { run: -1, untilX: 160.5 },
    { bounce: [158, 14], landX: 162.5, landTop: 9 },
    { run: 1, untilX: 205 },
    { charge: 1 },
    { run: 1, untilX: 243.5 },
    { charge: 1 },
    { bounce: [246, 32], landX: 251.5, landTop: 26 },
    { jumpTo: [244, 23] },
    { jumpTo: [239, 20] },
    { jumpTo: [244, 17] },
    { jumpTo: [239, 14] },
    { jumpTo: [244, 11] },
    { run: 1, untilX: 279.5 },
    { mover: [281, 11], dir: 1, exit: 'none' },
    { mover: [295, 11], at: 'end', dir: 1, exit: 'none' },
    { mover: [301, 11], dir: 1, exit: 'none' },
    { mover: [311, 15], at: 'end', dir: 1, exit: 'none' },
    { mover: [317, 15], dir: 1, exit: 'none' },
    { mover: [327, 11], at: 'end', dir: 1, exit: 'walk' },
    { run: 1, untilX: 360.5 },
    // Zona de ritmo: en cada encuentro espera que amaine el viento en contra.
    { mover: [362, 33], dir: 1, exit: 'none' },
    { mover: [376, 33], at: 'end', dir: 1, exit: 'none', calm: [370, 32] },
    { mover: [382, 33], dir: 1, exit: 'walk', calm: [380, 32] },
    { mover: [396, 33], at: 'end', dir: 1, exit: 'none' },
    { mover: [402, 33], dir: 1, exit: 'none', calm: [400, 32] },
    { mover: [416, 33], at: 'end', dir: 1, exit: 'none', calm: [410, 32] },
    { mover: [422, 33], dir: 1, exit: 'none', calm: [420, 32] },
    { mover: [436, 33], at: 'end', dir: 1, exit: 'walk', calm: [430, 32] },
    { run: 1, untilFight: true },
  ],
};

// Lugar secreto de l3 (S25), la cueva del viento, desde la repisa del ascenso 2 (x 178,5, fila 26): espera el ascensor
// abajo, rompe el fardo de la ladera, salta los dos pozos de 8 con la ráfaga a favor, cobra la pluma B en la cámara, baja
// por el pozo de salida al túnel de abajo y vuelve por él a la izquierda hasta el hongo (rompe el otro fardo).
export const L3_SECRET = {
  aim: true,
  wind: true,
  ride: true,
  noGapJump: [[215, 219]],
  steps: [
    { run: 1, wait: [181, 26], untilX: 186 },
    { run: 1, untilTop: 29 },
    { run: -1, untilX: 178 },
  ],
};

// l4 · Capiatá (S27). Ruta principal: casa de práctica (salto doble), museo (piedra del techo del corredor y portón),
// niebla y teja, pozo con pretil al patio del jagua, ascenso 1 en zigzag (balcón, rama, techo), par de balsas con
// panal, mercado (fuego 1), la despensa (fardo, roca agrietada y la piedra de la balsa dormida), la zanja, el descanso
// de la vaca embrujada, el ascensor dormido (onda a través de la pared) y el segundo ascensor al techo del galpón,
// fuego 2, par de balsas con panal, terraza del jagua y piedra temporizada de la puerta del campanario, ascenso 3,
// la cadena de bajada (balsa, ascensor, balsa, ascensor, balsa), la repisa del jagua, fuego 3 y la galería de las tejas.
export const L4_MAIN = {
  aim: true,
  hitSwitches: [
    [37, 32],
    [171, 36],
    [288, 22],
  ],
  // Bajar del techo del corredor caminando.
  noGapJump: [[29, 31]],
  splits: [
    ['fuego x 148', 148],
    ['zanja x 182', 182],
    ['ascenso 2 x 217', 217],
    ['fuego x 257', 257],
    ['campanario x 302', 302],
    ['cadena x 320', 320],
    ['fuego x 373', 373],
    ['antesala x 462', 462],
  ],
  steps: [
    { run: 1, untilX: 9 },
    { jumpTo: [13, 32], double: true },
    { run: 1, untilX: 26 },
    { jumpTo: [33, 33], double: true },
    { run: 1, untilX: 38.5 },
    { run: -1, untilTop: 34 },
    { run: 1, untilX: 75.5 },
    { jumpTo: [85, 35], double: true },
    { jumpTo: [93, 30], double: true },
    { jumpTo: [86, 25], double: true },
    { jumpTo: [98, 23], double: true },
    { run: 1, untilX: 112.5 },
    { mover: [114, 23], dir: 1, exit: 'none' },
    { mover: [127, 23], at: 'end', dir: 1, exit: 'walk' },
    { run: 1, untilX: 164 },
    { run: 1, untilX: 167.5 },
    { charge: 1 },
    { run: 1, untilX: 172 },
    { charge: 1 },
    { run: 1, untilX: 180 },
    { mover: [182, 37], dir: 1, exit: 'jump', landX: 199, double: true },
    { run: 1, untilX: 218 },
    { charge: 1 },
    { mover: [217, 37], dir: 1, exit: 'walk' },
    { mover: [224, 30], dir: 1, exit: 'walk' },
    // Del techo del galpón a la casa Z con saltos medidos: un run que salta el fardo de la casa puede aterrizar sobre la
    // balsa que ya salió y seguir corriendo al hueco. El segundo, a x 261 y no a 260,5: con el margen de 3 px de `seek`
    // el cuerpo quedaba hasta 3 px sobre el fardo (x 259), caía en su esquina y saltaba en el lugar para siempre.
    { run: 1, untilX: 252.5 },
    { jumpTo: [257, 25] },
    { jumpTo: [261, 25] },
    { mover: [262, 25], dir: 1, exit: 'none' },
    { mover: [275, 25], at: 'end', dir: 1, exit: 'jump', landX: 280.5, double: true },
    { run: 1, untilX: 287.5 },
    { jumpTo: [298, 23], double: true },
    { run: 1, untilX: 308 },
    { jumpTo: [315, 18], double: true },
    { jumpTo: [309, 13], double: true },
    { jumpTo: [312, 8], double: true },
    { run: 1, untilX: 318.5 },
    { mover: [320, 8], dir: 1, exit: 'none' },
    { mover: [330, 14], at: 'end', dir: 1, exit: 'none' },
    { mover: [334, 14], dir: 1, exit: 'none' },
    { mover: [344, 20], at: 'end', dir: 1, exit: 'none' },
    { mover: [348, 20], dir: 1, exit: 'jump', landX: 359 },
    { run: 1, untilX: 376.5 },
    { mover: [378, 33], dir: 1, exit: 'none' },
    { mover: [392, 33], at: 'end', dir: 1, exit: 'none' },
    { mover: [398, 33], dir: 1, exit: 'walk' },
    { mover: [412, 33], at: 'end', dir: 1, exit: 'none' },
    { mover: [418, 33], dir: 1, exit: 'none' },
    { mover: [432, 33], at: 'end', dir: 1, exit: 'none' },
    { mover: [438, 33], dir: 1, exit: 'none' },
    { mover: [452, 33], at: 'end', dir: 1, exit: 'walk' },
    { run: 1, untilFight: true },
  ],
};

// Lugar secreto de l4 (S27), el potrero de la vaca guasu, desde la repisa del ascenso 2 (x 221, fila 30): la onda pasa
// entre los barrotes de la reja y enciende la piedra del pasillo; el henil (nido de fardo); la vaca guasu cruza el
// potrero de espinas con Kerana en el lomo; repisa del premio y salto doble al estante de la pluma B; de vuelta en la
// vaca, salto al henil y por la reja al segundo ascensor, que sube al techo del galpón.
export const L4_SECRET = {
  aim: true,
  // Hasta el borde del henil caminando: la vaca se aborda desde ahí, cuando está en su punta.
  noGapJump: [[233.5, 235]],
  steps: [
    { run: 1, untilX: 222.5 },
    { charge: 1 },
    // Cruza la ranura del segundo ascensor cuando está abajo (si no, al pasar lo puede levantar).
    { run: 1, wait: [224, 30], untilX: 233.6 },
    { mover: [242, 36], dir: 1, exit: 'walk' },
    { jumpTo: [252, 30], double: true },
    { jumpTo: [249.5, 34] },
    { mover: [242, 36], at: 'end', dir: -1, exit: 'jump', landX: 233, double: true },
    { run: -1, untilX: 228.5 },
    { mover: [224, 30], dir: 1, exit: 'walk' },
  ],
};

// l5 · Canindeyú (S30). Ruta principal: el túnel de raíces (dash), la cadena de hongos sobre el karaguatá, las ramas que
// se quiebran sobre el pozo, el hongo dormido al pie del tronco, la cadena de cinco ascensores, la rama larga hacia la
// izquierda (mbói en el hueco, la reja de raíces: hongo dormido → rama alta con la piedra), la zona de ritmo (el compás
// de los hongos: cinco ramas que van y vienen, hongos normales, de un uso y dormido), el dosel (par de balsas, balsa
// larga, hongo → ascensor → balsa, roca, salto largo con salto doble y dash) y la bajada (ascensor, ramas que se
// quiebran, cortina de karaguatá con dash, cadena de tres ascensores) hasta la antesala. Filas reales del JSON.
export const L5_MAIN = {
  aim: true,
  hitSwitches: [[118, 44]],
  // Bajar de la rama de la piedra caminando (no saltar contra el nudo del tronco).
  noGapJump: [[116.5, 124]],
  splits: [
    ['fuego 1 x 96', 96],
    ['rama larga (fila 54)', 145, 55],
    ['dosel x 74 (fila 14)', 74, 15],
    ['copa 7 x 217', 217, 15],
    ['antesala x 266', 266],
  ],
  steps: [
    { run: 1, untilX: 18 },
    { dash: 1, from: 20.2 },
    // Antes de que el run vea las espinas (34 px adelante) y salte: el salto lo decide el paso del hongo.
    { run: 1, untilX: 34.4 },
    { bounce: [39, 90], via: [[46, 90], [53, 90]], landX: 61, landTop: 92 },
    { run: 1, untilX: 71.5 },
    { jumpTo: [76, 90] },
    { jumpTo: [81, 88] },
    { jumpTo: [86, 90] },
    { jumpTo: [91, 88] },
    { jumpTo: [96.5, 92] },
    { run: 1, untilX: 99.5 },
    { charge: 1 },
    { bounce: [101, 91], landX: 106, landTop: 84 },
    { run: 1, untilX: 129.5 },
    { mover: [131, 84], dir: 1, exit: 'none' },
    { mover: [135, 72], at: 'end', dir: 1, exit: 'none' },
    { mover: [139, 72], dir: 1, exit: 'none' },
    { mover: [143, 60], at: 'end', dir: 1, exit: 'none' },
    { mover: [147, 60], dir: 1, exit: 'none' },
    { run: -1, untilX: 126.5 },
    { charge: -1 },
    { bounce: [124, 53], landX: 120.5, landTop: 45 },
    { run: -1, untilX: 90 },
    { run: -1, untilX: 58.5 },
    { bounce: [55, 53], onto: [58, 46], reach: 5 },
    { mover: [58, 46], dir: 1, exit: 'walk' },
    { bounce: [75, 45], onto: [58, 38], reach: 5, double: true },
    { mover: [58, 38], at: 'end', dir: -1, exit: 'walk' },
    { bounce: [55, 37], onto: [58, 30], reach: 5 },
    { mover: [58, 30], dir: 1, exit: 'walk' },
    { bounce: [75, 29], onto: [58, 22], reach: 5, double: true },
    { mover: [58, 22], at: 'end', dir: -1, exit: 'walk' },
    { charge: -1 },
    { bounce: [55, 21], onto: [58, 14], reach: 5 },
    { mover: [58, 14], dir: 1, exit: 'walk' },
    { run: 1, untilX: 85.5 },
    { mover: [87, 14], dir: 1, exit: 'none' },
    { mover: [102, 14], at: 'end', dir: 1, exit: 'walk' },
    { mover: [113, 14], dir: 1, exit: 'walk' },
    { run: 1, untilX: 148 },
    { bounce: [151, 15], onto: [155, 16], reach: 5 },
    { mover: [155, 16], dir: 1, exit: 'none' },
    { mover: [165, 10], at: 'end', dir: 1, exit: 'walk' },
    { run: 1, untilX: 174.5 },
    { charge: 1 },
    { run: 1, untilX: 202.5 },
    { jumpTo: [219, 14], double: true, dash: true },
    { mover: [224, 14], dir: 1, exit: 'walk' },
    { run: 1, untilX: 236 },
    { jumpTo: [239, 30] },
    { jumpTo: [243, 34] },
    { jumpTo: [245, 38] },
    { dash: 1, from: 250 },
    { mover: [256, 38], dir: 1, exit: 'none' },
    { mover: [252, 66], at: 'end', dir: -1, exit: 'none' },
    { mover: [256, 66], dir: 1, exit: 'walk' },
    { run: 1, untilFight: true },
  ],
};

// Lugar secreto de l5 (S30), el claro, desde la copa 6 (x 192, fila 14): el ascensor que tapa el hueco baja al claro;
// la guavirá del hueco, la Luz de Arasy y dos guavirá en el piso; el hongo de un uso lanza a la rama de la pluma B; de
// vuelta, el mismo ascensor sube a la copa.
export const L5_SECRET = {
  aim: true,
  steps: [
    { mover: [194, 14], dir: 1, exit: 'walk' },
    { run: 1, untilX: 202.5 },
    { run: -1, untilX: 193.6 },
    { bounce: [191, 35], landX: 188, landTop: 28 },
    { jumpTo: [193.6, 36] },
    { mover: [194, 14], at: 'end', dir: 1, exit: 'walk' },
  ],
};
