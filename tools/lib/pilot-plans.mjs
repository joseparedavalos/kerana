// Planes del piloto automático (tools/lib/pilot.mjs), en tiles. Uno por nivel y ruta; ver docs/RECETA-NIVEL.md.

// S36: arma un plan con tramos de otros. Cada tramo es un paso suelto o [pasos, desde, hasta] (un slice de un plan):
// los `retryFrom` de cada tramo (índices dentro de su plan) se corren a la posición que el tramo ocupa en el nuevo.
function chain(...parts) {
  const out = [];
  for (const part of parts) {
    if (!Array.isArray(part)) {
      out.push(part);
      continue;
    }
    const [steps, from = 0, to = steps.length] = part;
    const at = out.length;
    for (const step of steps.slice(from, to)) out.push(step.retryFrom === undefined ? step : { ...step, retryFrom: step.retryFrom - from + at });
  }
  return out;
}

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

// S36: l1 con las tres chipas antes de la puerta de la ofrenda. A: la piedra temporizada de la cueva (x 27), salto
// doble a la repisa y al nicho (si la reja se cerró, la piedra de adentro la abre), y vuelta por la punta izquierda de
// la repisa. B: la ruta alta (L1_HIGH). C: en la galería 2, la onda a través de la roca enciende la piedra de la
// cámara; el ascensor baja, se entra a la cámara por la reja y salto doble a la repisa de la chipa.
export const L1_CHIPAS = {
  ...L1_HIGH,
  hitSwitches: [...L1_COMMON.hitSwitches, [27, 11], [39, 5]],
  steps: [
    // La piedra se golpea volviendo desde la derecha: bajando del bloque, Kerana cae ya pasada (en el aire no golpea).
    { run: 1, untilX: 29.5 },
    { run: -1, untilX: 28.6 },
    { jumpTo: [30, 6], double: true },
    { run: 1, untilX: 40.3 },
    { run: -1, untilX: 24.5 },
    ...L1_COMMON.steps.slice(0, 5),
    { charge: -1 },
    { mover: [200, 22], dir: -1, exit: 'walk' },
    { run: -1, untilX: 194 },
    { jumpTo: [190, 26], double: true },
    { run: 1, untilFight: true },
  ],
};

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

// S36: l2 con las tres chipas antes de la puerta de la ofrenda. A: al empezar, salto doble a la roca de la izquierda y
// salto doble + dash a la cima del pilar; se baja del otro lado y se rompe la roca agrietada desde ahí. B: la copa
// del palmar (L2_COPA) desde la cima del albardón, saltando el pozo. C: desde la cima del ascenso 2, salto doble + dash a
// la repisa de la chipa y salto a la orilla.
export const L2_CHIPAS = {
  ...L2_MAIN,
  noGapJump: [[16, 18], ...L2_MAIN.noGapJump, ...L2_COPA.noGapJump],
  steps: [
    { run: -1, untilX: 7.2 },
    { jumpTo: [4.5, 27], double: true },
    { jumpTo: [15, 22], double: true, dash: true },
    // Del otro lado del pilar, el tajo cargado rompe la roca agrietada entera (lo comprueba el smoke).
    { run: 1, untilX: 19.5 },
    { run: -1, untilX: 18.2 },
    { charge: -1 },
    // De la piedra encerrada (x 90,5) a la cima del albardón (x 149).
    ...L2_MAIN.steps.slice(2, 13),
    { jumpTo: [155.5, 18] },
    ...L2_COPA.steps,
    // Del fuego 2 a la cima del ascenso 2.
    ...L2_MAIN.steps.slice(14, 24),
    { jumpTo: [265.5, 12], double: true, dash: true },
    { jumpTo: [261, 33] },
    // La cadena más larga, la zona de ritmo y la antesala.
    ...L2_MAIN.steps.slice(26),
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
    // S36: cada pozo, desde quieta y con una ráfaga entera (`gust`). Arrancando con la ráfaga por terminar, frenaba en
    // el borde y la ráfaga la empujaba al pozo; y la del pozo 1 la dejaba lanzada hacia el pozo 2 sin su ráfaga. Caía al
    // túnel sin la pluma (en el smoke, 1 de cada 6; suelto, casi siempre).
    { stop: 186.5 },
    { run: 1, untilX: 198, gust: [189, 26], aimX: 197.2 },
    { stop: 199 },
    { run: 1, untilTop: 29, gust: [202, 26] },
    { run: -1, untilX: 178 },
  ],
};

// S36: l3 con las tres chipas antes de la puerta de la ofrenda. A: la piedra temporizada de la loma (x 117), bajar por el
// borde y entrar al nicho de la ladera antes de que se cierre (la piedra de adentro lo reabre). B: la cueva del viento
// (L3_SECRET) desde la repisa del ascenso 2, y de vuelta al hongo. C: en la copa 3, tajo cargado al hongo dormido y
// rebote a la copa alta.
export const L3_CHIPAS = {
  ...L3_MAIN,
  ride: true,
  hitSwitches: [
    [117, 20],
    [117, 32],
  ],
  noGapJump: [...(L3_SECRET.noGapJump ?? [])],
  steps: [
    // Hasta la loma (pencas en zigzag).
    ...L3_MAIN.steps.slice(0, 10),
    // La piedra de la loma (la golpea al pasar) y un salto medido al pie del nicho: corriendo, caía 5 a 10 tiles más
    // allá y la reja (3 s) se cerraba antes de volver.
    { run: 1, untilX: 116.8 },
    { jumpTo: [121.5, 33] },
    { run: -1, untilX: 118.0 },
    { run: 1, untilX: 154.5 },
    // Par de balsas y hongo del ascenso 2 a la repisa.
    ...L3_MAIN.steps.slice(11, 15),
    ...L3_SECRET.steps,
    L3_MAIN.steps[14],
    // Si la cueva no pagó la pluma (cayó al túnel), del hongo a la repisa y otra vez, como una persona.
    { ensureChipa: 1, back: 7 },
    // Ascensor, la barra, la rama alta, la meseta, el hongo dormido y las pencas del ascenso 3.
    ...L3_MAIN.steps.slice(15, 28),
    { run: 1, untilX: 275.5 },
    { charge: -1 },
    { bounce: [273, 10], landX: 277, landTop: 4 },
    // De la copa alta a la copa 3 con un salto medido: corriendo, saltaba el borde y caía en la cañada.
    { jumpTo: [279.5, 11] },
    // La cadena de seis, la zona de ritmo y la antesala.
    ...L3_MAIN.steps.slice(29),
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
    // S36: quieta antes del tajo cargado. Llegando a la carrera (el recorrido con las tres chipas), se deslizó un tile
    // hasta el borde del segundo ascensor (x 224), que la subió al techo: la onda pasó por encima de la piedra.
    { stop: 222.3 },
    { charge: 1 },
    // Cruza la ranura del segundo ascensor cuando está abajo (si no, al pasar lo puede levantar).
    { run: 1, wait: [224, 30], untilX: 233.6 },
    { mover: [242, 36], dir: 1, exit: 'walk' },
    { jumpTo: [252, 30], double: true },
    // Hasta la pared: la pluma está en x 252 y, si cae en x 251, solo se lleva la Luz de Arasy (S31: pasó en 1 de 15 smokes).
    { run: 1, untilX: 252.4 },
    { jumpTo: [249.5, 34] },
    { mover: [242, 36], at: 'end', dir: -1, exit: 'jump', landX: 233, double: true },
    { run: -1, untilX: 228.5 },
    { mover: [224, 30], dir: 1, exit: 'walk' },
  ],
};

// S36: l4 con las tres chipas antes de la puerta de la ofrenda. A: en el patio del jagua, la onda a través de la reja y la
// pared enciende la piedra del nicho. B: el potrero de la vaca guasu (L4_SECRET) desde la repisa del ascenso 2, que
// termina en el segundo ascensor. C: arriba del campanario, el dash por encima de la espina y de vuelta.
export const L4_CHIPAS = {
  ...L4_MAIN,
  noGapJump: [...L4_MAIN.noGapJump, ...L4_SECRET.noGapJump],
  steps: chain(
    // Hasta el patio del jagua.
    [L4_MAIN.steps, 0, 8],
    { run: 1, untilX: 95 },
    { charge: 1 },
    { run: 1, untilX: 98.5 },
    // Ascenso 1, mercado, despensa, zanja, terraza y el ascensor dormido hasta la repisa.
    [L4_MAIN.steps, 8, 24],
    [L4_SECRET.steps],
    // Techo del galpón, casa Z, plaza, campanario.
    [L4_MAIN.steps, 25, 36],
    { run: -1, untilX: 307.4 },
    // El dash (3,2 tiles) termina contra la pared (centro en 303,5) si sale con el centro entre 305,5 (más a la
    // izquierda, el cuerpo toca la espina de x 304) y 306,7: al medio. Con 306,6 (era el punto con dos espinas), a
    // ±6 px salía pasado y, con el juego lento, el dash corto la dejaba sobre la espina (S36: una caída en el smoke).
    { dash: -1, from: 306.0 },
    // De vuelta, desde donde quedó (pegada a la pared): con from 303,6 el cuerpo ya tocaba la espina.
    { dash: 1 },
    // La cadena de bajada, la galería de las tejas y la antesala.
    [L4_MAIN.steps, 36],
  ),
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
    // S31: saltando (hay 1 tile de hueco entre la punta de la balsa y la copa 5): bajando caminando, a veces quedaba en
    // el borde, la balsa se iba y caía por el hueco (2 de 5 corridas del smoke en S31, también con el código de S30).
    { mover: [165, 10], at: 'end', dir: 1, exit: 'jump', landX: 170.5 },
    { run: 1, untilX: 174.5 },
    { charge: 1 },
    // S31: el hueco del ascensor del claro (x 194-196) con un salto a la copa 6: el run apuntaba a veces al ascensor que
    // bajaba y caía con él al claro (y el paso terminaba adentro, en x 204,5).
    { run: 1, untilX: 192.4 },
    { jumpTo: [198.5, 14] },
    { run: 1, untilX: 202.5 },
    // S31: con carrera desde x 201,5 (si el paso anterior la dejaba en el borde, saltaba desde quieta, no llegaba y
    // reaparecía en el mismo borde: 176 caídas en una corrida).
    { jumpTo: [219, 14], double: true, dash: true, runup: 201.5 },
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
    // La columna de fardo, con tajo cargado desde antes de llegar (S31): corriendo, a veces llegaba antes de que el tajo
    // la rompiera, la tomaba por una pared y, con el salto doble del guardado, saltaba el muro del claro (pozo en x 231).
    { run: 1, untilX: 200.8 },
    { charge: 1 },
    { run: 1, untilX: 203.2 },
    { run: -1, untilX: 193.6 },
    { bounce: [191, 35], landX: 188, landTop: 28 },
    { jumpTo: [193.6, 36] },
    { mover: [194, 14], at: 'end', dir: 1, exit: 'walk' },
  ],
};

// S36: l5 con las tres chipas antes de la puerta de la ofrenda. A: en la cadena de hongos, el hongo de un uso con salto
// doble en el ápice, y de ahí al tercer hongo. B: el claro (L5_SECRET) desde la copa 6. C: después del salto largo, el
// hongo de la copa 7, salto doble y dash por encima de la columna de espinas, y del otro lado a la rama baja.
export const L5_CHIPAS = {
  ...L5_MAIN,
  steps: chain(
    [L5_MAIN.steps, 0, 3],
    { bounce: [39, 90], via: [[46, 90]], landX: 46.5, landTop: 92, double: true, afterDouble: true },
    { bounce: [53, 90], landX: 61, landTop: 92 },
    // Las ramas del pozo, el tronco, los ascensores, la reja de raíces, el compás y el dosel hasta la copa 6.
    [L5_MAIN.steps, 4, 46],
    [L5_SECRET.steps],
    [L5_MAIN.steps, 46, 49],
    { stop: 223.2 },
    { bounce: [227, 13], landX: 231.5, landTop: 14, double: true, dash: true, hold: true },
    { jumpTo: [234, 26] },
    { run: 1, untilX: 236 },
    // La bajada: ramas que se quiebran, la cortina de karaguatá, los tres ascensores y la antesala.
    [L5_MAIN.steps, 51],
  ),
};

// l6 · Guairá (S31). Ruta principal: la manada, la escalera de lajas, la columna de roca (tajo cargado), el pozo de la
// piedra (bajar, golpear la piedra, hongo y salto doble), el hongo de un uso del patio, la segunda escalera de lajas
// hacia la izquierda, el escalón al filo, la grieta con viento (en la calma), el par de balsas del filo, el hongo
// dormido y el par de balsas sobre la cascada, la cadena ascensor → balsa → balsa, el par de balsas al fuego 2, LA
// PERSECUCIÓN (por la ruta baja: el cerco, las lajas que se quiebran, la manada, las terrazas), la cadena de bajada, el
// último par de balsas y la antesala.
export const L6_MAIN = {
  aim: true,
  wind: true,
  hitSwitches: [[88, 54]],
  // Dejarse caer al pozo de la piedra (no saltarlo) y no saltar desde el borde del rellano si la laja 5 no está.
  noGapJump: [
    [89, 93],
    [95.5, 98],
  ],
  splits: [
    ['fuego 1 x 105', 105],
    ['el filo (fila 17)', 62, 18],
    ['cumbre 2 x 188', 188, 10],
    ['fuego 2 x 262', 262],
    ['fin de la persecución x 387', 387],
    ['antesala x 452', 452],
  ],
  steps: [
    { run: 1, untilX: 32.5 },
    { mover: [34, 57], dir: 1, exit: 'none' },
    { mover: [48, 54], at: 'end', dir: 1, exit: 'none' },
    { mover: [52, 51], dir: 1, exit: 'none' },
    { mover: [66, 48], at: 'end', dir: 1, exit: 'jump', landX: 71.5 },
    { run: 1, untilX: 78.5 },
    { charge: 1 },
    // Salta adentro del pozo hacia su fondo (lejos del hongo, x 95) y va a la piedra.
    { jumpTo: [93, 55] },
    { run: -1, untilX: 89.6 },
    { bounce: [95, 54], landX: 97.5, landTop: 45, double: true },
    { run: 1, untilX: 106 },
    { bounce: [110, 44], landX: 108, landTop: 36, double: true },
    { run: -1, untilX: 97.6 },
    { mover: [93, 35], dir: -1, exit: 'none' },
    { mover: [79, 32], at: 'end', dir: -1, exit: 'none' },
    { mover: [75, 29], dir: -1, exit: 'none' },
    { mover: [61, 26], at: 'end', dir: -1, exit: 'jump', landX: 57.5 },
    { jumpTo: [56, 20] },
    { jumpTo: [61.5, 17] },
    { run: 1, untilX: 126.4 },
    { mover: [128, 17], dir: 1, exit: 'none' },
    { mover: [139, 17], at: 'end', dir: 1, exit: 'walk' },
    { run: 1, untilX: 156.5 },
    { charge: 1 },
    { bounce: [158, 14], onto: [157, 7], reach: 5 },
    { mover: [157, 7], dir: 1, exit: 'none' },
    { mover: [180, 7], at: 'end', dir: 1, exit: 'jump', landX: 188.5 },
    { run: 1, untilX: 205.5 },
    { mover: [208, 9], dir: 1, exit: 'none' },
    { mover: [217, 14], at: 'end', dir: 1, exit: 'none' },
    { mover: [221, 14], dir: 1, exit: 'jump', landX: 231.5 },
    { run: 1, untilX: 239.5 },
    { mover: [241, 14], dir: 1, exit: 'none' },
    { mover: [254, 14], at: 'end', dir: 1, exit: 'jump', landX: 259.5 },
    { run: 1, untilX: 306.5 },
    { jumpTo: [313.5, 22] },
    { jumpTo: [319.5, 22] },
    { jumpTo: [325.5, 22] },
    { jumpTo: [331.5, 22] },
    { run: 1, untilX: 399.5 },
    { mover: [401, 30], dir: 1, exit: 'none' },
    { mover: [410, 35], at: 'end', dir: 1, exit: 'none' },
    { mover: [414, 35], dir: 1, exit: 'none' },
    { mover: [423, 40], at: 'end', dir: 1, exit: 'jump', landX: 428.5 },
    { run: 1, untilX: 430.4 },
    { mover: [432, 40], dir: 1, exit: 'none' },
    { mover: [442, 40], at: 'end', dir: 1, exit: 'walk' },
    { run: 1, untilFight: true },
  ],
};

// Lugar secreto de l6 (S31), la gruta tras la cascada, desde la cumbre 1 (x 163, fila 15): se deja caer por el borde a
// través de la cascada hasta la cornisa, entra a la gruta (Luz de Arasy y una guavirá), rompe la columna de fardo (la
// pluma B cae) y sigue hasta la otra guavirá; vuelve y sube en el ascensor de la cascada a la cumbre 1.
export const L6_SECRET = {
  aim: true,
  // Dejarse caer por el borde de la cumbre (no saltar la garganta).
  noGapJump: [[160, 168]],
  steps: [
    { run: 1, untilTop: 19 },
    { run: -1, untilX: 157 },
    { run: -1, untilX: 151.5 },
    // Frena lejos del borde de la cornisa (con el juego lento se pasa) y espera el ascensor abajo.
    { run: 1, untilX: 167.2 },
    { mover: [171, 26], dir: 1, strict: true, exit: 'none' },
    { jumpTo: [163.5, 15] },
  ],
};

// Pluma A de l6 (S31): en el fondo de la quebrada (la red de la escalera de lajas), tajo cargado a la columna de roca
// agrietada de la pared y la pluma del nicho. Empieza parada en el fondo (x 66, fila 62).
export const L6_FEATHER_A = {
  steps: [
    { run: 1, untilX: 67.4 },
    { charge: 1 },
    { run: 1, untilX: 71.6 },
  ],
};

// Pluma C de l6 (S31): durante la persecución, la ruta alta. Del pindó 1, salto doble a la cornisa (5 filas); bajo el techo, el
// dash por encima de la espina; la pluma; y se deja caer a la llegada de las lajas que se quiebran. Empieza en el último
// rellano antes de la persecución (x 263, fila 16): larga la persecución.
export const L6_FEATHER_C = {
  steps: [
    { run: 1, untilX: 300.5 },
    { jumpTo: [304, 19] },
    // Salta parada en la copa (destino a menos de 2,5 tiles), no desde el borde.
    { jumpTo: [306.4, 14], double: true },
    // El dash empieza pegado a la espina: con el juego muy lento el último cuadro del dash ya va a paso de carrera y,
    // desde 314.6, a veces terminaba intangible encima de ella. Si igual la toca, reaparece en el pindó y vuelve a saltar
    // (sin retryFrom caminaba desde la copa hacia el dash y caía al pozo una y otra vez: 31 caídas).
    { dash: 1, from: 315.2, retryFrom: 1 },
    { run: 1, untilX: 323 },
    { run: 1, untilX: 333 },
  ],
};

// S36: l6 con las tres chipas antes de la puerta de la ofrenda. A: antes de la escalera de lajas, al fondo de la
// quebrada, tajo cargado a la columna de roca y la chipa; de vuelta a la meseta con salto doble. B: la gruta tras la
// cascada (L6_SECRET), saltando el hongo dormido de la cumbre 1 a la ida y a la vuelta. C: la ruta alta de la persecución
// (L6_FEATHER_C).
export const L6_CHIPAS = {
  ...L6_MAIN,
  noGapJump: [...L6_MAIN.noGapJump, ...L6_SECRET.noGapJump],
  steps: chain(
    [L6_MAIN.steps, 0, 1],
    { jumpTo: [50, 62] },
    [L6_FEATHER_A.steps],
    { run: -1, untilX: 37 },
    { jumpTo: [32, 57], double: true },
    // La escalera de lajas, el pozo de la piedra, el patio, la segunda escalera, el filo y la cumbre 1.
    [L6_MAIN.steps, 1, 23],
    { jumpTo: [161, 15] },
    [L6_SECRET.steps],
    { jumpTo: [156.5, 15] },
    // El hongo dormido, las cumbres y el fuego 2.
    [L6_MAIN.steps, 23, 34],
    [L6_FEATHER_C.steps],
    // La bajada a la meseta y la antesala.
    [L6_MAIN.steps, 39],
  ),
};

// l7 · Asunción (S32). Ruta principal: la calle, el portón del zaguán (farol), el andamio del patio (farol de pared), los
// tejados, el mercado (par de carros, lona de un uso + salto doble sobre el muro del cabildo), la plaza (columna de roca,
// farol de la puerta → andamio 2 → la onda por la ventana enciende la piedra → reja de la torre), LA RONDA DEL FAROLERO
// (cinco ascensores que llama un farol temporizado: con `lantern`, el piloto espera a que el farol esté encendido y con
// tiempo), los tejados de la catedral (tres ascensores y dos pares de balsas), la fosa (farol → losa), el farol del otro
// lado (onda), LA CRIPTA (se baja por la fosa abierta, farol → ascensor, tajo cargado a la pared de roca y el farol de la
// reja del panteón; se sube en el ascensor), el toldo plegado (tajo cargado), el par de losas, la capilla (salto doble) y la
// antesala.
export const L7_MAIN = {
  aim: true,
  noGapJump: [
    [193, 198],
    [204, 208],
    [228, 233],
    [239, 243],
    [263, 268],
    [372, 378],
    [436, 440],
  ],
  splits: [
    ['fuego 1 x 148', 148],
    ['la torre x 174', 174],
    ['el campanario (fila 15)', 191, 16],
    ['fuego 2 x 305', 305],
    ['la cripta x 398', 399],
    ['fuego 3 x 410', 410],
  ],
  steps: [
    { run: 1, untilX: 49.3 },
    { mover: [50, 60], dir: 1, exit: 'walk', lantern: [53, 59] },
    { run: 1, untilX: 109.5 },
    { mover: [111, 60], dir: 1, exit: 'none', strict: 1000 },
    { mover: [125, 60], at: 'end', dir: 1, exit: 'walk' },
    { run: 1, untilX: 136.5 },
    { bounce: [138, 59], landX: 143.6, landTop: 60, double: true },
    { run: 1, untilX: 158.3 },
    { charge: 1 },
    { run: 1, untilX: 169.3 },
    { mover: [169, 60], dir: 1, exit: 'none', lantern: [171, 59] },
    { charge: 1 },
    { mover: [169, 60], at: 'end', dir: 1, exit: 'walk' },
    { run: 1, untilX: 176.5 },
    { run: 1, untilX: 183.2 },
    {
      mover: [187, 51],
      at: 'end',
      dir: 1,
      exit: 'walk',
      exitDir: -1,
      lantern: [184, 59],
    },
    {
      mover: [175, 42],
      at: 'end',
      dir: -1,
      exit: 'walk',
      exitDir: 1,
      lantern: [180, 50],
    },
    {
      mover: [187, 33],
      at: 'end',
      dir: 1,
      exit: 'walk',
      exitDir: -1,
      lantern: [184, 41],
    },
    {
      mover: [175, 24],
      at: 'end',
      dir: -1,
      exit: 'walk',
      exitDir: 1,
      lantern: [180, 32],
    },
    { mover: [187, 15], at: 'end', dir: 1, exit: 'walk', lantern: [184, 23] },
    { run: 1, untilX: 194.2 },
    { mover: [196, 15], dir: 1, exit: 'walk', strict: true, retryFrom: 20 },
    { run: 1, untilX: 204.0 },
    { mover: [207, 28], dir: 1, exit: 'none', retryFrom: 22, strict: 1200 },
    { mover: [221, 28], at: 'end', dir: 1, exit: 'walk', retryFrom: 22 },
    { run: 1, untilX: 229.5 },
    { mover: [231, 28], dir: 1, exit: 'walk', strict: true, retryFrom: 25 },
    { run: 1, untilX: 239.0 },
    { mover: [242, 41], dir: 1, exit: 'none', retryFrom: 27, strict: 1200 },
    { mover: [256, 41], at: 'end', dir: 1, exit: 'walk', retryFrom: 27 },
    { run: 1, untilX: 264.3 },
    { mover: [266, 41], dir: 1, exit: 'walk', strict: true, retryFrom: 30 },
    { run: 1, untilX: 310.5 },
    { mover: [327, 60], at: 'end', dir: 1, exit: 'walk' },
    { run: 1, untilX: 347.5 },
    { charge: 1 },
    { run: 1, untilX: 373.4 },
    { run: 1, untilX: 388.3 },
    { charge: 1 },
    { run: 1, untilX: 395.6 },
    { run: -1, untilX: 378.6 },
    { mover: [374, 66], dir: -1, exit: 'walk', exitDir: 1 },
    { run: 1, untilX: 423.5 },
    { charge: 1 },
    { bounce: [428, 59], landX: 431, landTop: 52 },
    { run: 1, untilX: 437.0 },
    { mover: [439, 52], dir: 1, exit: 'none', strict: 1000 },
    { mover: [454, 52], at: 'end', dir: 1, exit: 'walk' },
    { run: 1, untilX: 467.5 },
    { jumpTo: [474, 55], double: true },
    { run: 1, untilFight: true },
  ],
};

// S36: l7 con las tres chipas antes de la puerta de la ofrenda. A: el sótano de la casona (L7_SECRET) desde la calle del
// mercado. B: arriba del andamio 2, después de encender la piedra de la torre, el balcón del obispado (dash ida y vuelta)
// y de nuevo al andamio. C: parada en el ascensor del ángel, la onda enciende el farol de la capilla; de la cornisa se
// baja por el lado del mausoleo a la calle.
export const L7_CHIPAS = {
  ...L7_MAIN,
  noGapJump: [...L7_MAIN.noGapJump, [462, 464.5]],
  // Los pasos, al final del archivo: usan L7_SECRET, L7_FEATHER_B y L7_FEATHER_C, que se definen más abajo.
  steps: [],
};

// Lugar secreto de l7 (S32), el sótano de la casona, desde la calle del mercado (x 99, fila 60): rompe la puerta de fardo
// (x 97), cruza el zaguán (el farol encendido es la luz que se ve desde la calle), baja por la escalera, salta el piso
// podrido (tablones que se quiebran sobre un pozo), recoge dos guavirá, la Luz de Arasy y la pluma A, y sale por la
// trampilla de la vereda (x 108-109).
export const L7_SECRET = {
  aim: true,
  steps: [
    { run: -1, untilX: 93 },
    // S36: un salto medido al fondo del hueco de la escalera (x 87-91): frenando en x 91,7 a veces quedaba en el borde
    // del piso y seguía por la calle (por eso fallaba el chequeo del sótano también en main); corriendo más, caía sobre
    // el escalón (x 87-88) y cruzaba el sótano por arriba, sin pasar por la chipa.
    { jumpTo: [90.5, 68] },
    { run: 1, untilX: 108.6 },
    { jumpTo: [105.8, 65] },
    { jumpTo: [107.6, 62] },
    { jumpTo: [108.8, 60] },
  ],
};

// Pluma B de l7 (S32): el balcón del obispado, junto al tablón del andamio 2 (x 166-168, fila 44): techo bajo y una espina;
// el dash desde pegada a ella.
export const L7_FEATHER_B = {
  steps: [
    { run: -1, untilX: 166 },
    // S36: el dash cruza la espina si arranca con el centro entre x 164,5 y 165,7 (el piloto frena a ±6 px): desde 164,6,
    // a veces ya la tocaba.
    { dash: -1, from: 165.1 },
    { run: -1, untilX: 160.6 },
  ],
};

// Pluma C de l7 (S32): parada en el ascensor del ángel (x 469-471, fila 60), el tajo cargado: la onda enciende el farol de
// la hornacina de la capilla (el sable no llega) y el ascensor sube a la cornisa de la pluma (S36: después va y viene).
export const L7_FEATHER_C = {
  steps: [
    { charge: 1 },
    { mover: [469, 60], dir: -1, exit: 'walk' },
    { run: -1, untilX: 466.2 },
  ],
};

// S36: el resto de L7_CHIPAS (usa L7_SECRET, L7_FEATHER_B y L7_FEATHER_C, definidos arriba).
L7_CHIPAS.steps = chain(
  [L7_MAIN.steps, 0, 2],
  { run: 1, untilX: 99 },
  [L7_SECRET.steps],
  // El mercado, la lona, la plaza y el andamio 2 con la onda por la ventana de la torre.
  [L7_MAIN.steps, 2, 12],
  // Mientras se carga el tajo, el andamio ya baja: una vuelta más y, arriba, al tablón del balcón.
  { mover: [169, 60], at: 'origin', dir: 1, exit: 'walk', exitDir: -1 },
  // Quieta en el tablón, como empieza la prueba suelta del balcón (llegando a la carrera, se pasaba hasta la espina).
  { stop: 167.5 },
  [L7_FEATHER_B.steps],
  // De vuelta, con el centro entre x 161,3 y 162,5 (a ±6 px del punto, el piloto no toca la espina).
  { dash: 1, from: 161.9 },
  { run: 1, untilX: 167.5 },
  // En dos corridas del smoke el desvío no tocó la chipa (no se reprodujo suelto): si quedó en el mapa, otra vuelta.
  { ensureChipa: 1, back: 7 },
  // Abajo en el andamio, la torre (la ronda del farolero), los tejados de la catedral, el camposanto y la cripta.
  [L7_MAIN.steps, 12, 49],
  // Parada en el ascensor del ángel, sin pasarse de x 470: más a la derecha, la onda no llega al farol de la capilla.
  { run: 1, untilX: 469 },
  { stop: 469.8 },
  [L7_FEATHER_C.steps],
  // De la cornisa al techo del mausoleo con un salto medido (corriendo, se pasaba y caía en la fosa común) y a la calle.
  { jumpTo: [460, 52] },
  // El ascensor ya va y viene: el salto a la capilla, con él abajo (a media altura podría caer sobre él).
  { run: 1, wait: [469, 60], untilX: 467.5 },
  [L7_MAIN.steps, 49],
);
