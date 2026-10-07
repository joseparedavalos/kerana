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
    { run: 1, untilX: 116.2 },
    { mover: [118, 9], dir: 1, power: true, exit: 'jump', landX: 130.5 },
    { run: 1, untilTop: 16 },
    { run: -1, untilX: 205.4 },
    { mover: [200, 22], dir: -1, exit: 'walk', exitDir: 1 },
    { run: 1, untilFight: true },
  ],
};

export const L1_LOW = L1_COMMON;
export const L1_HIGH = { ...L1_COMMON, noGapJump: [...L1_COMMON.noGapJump, [143, 147]] };

// l2 · Ñeembucú (S22). Ruta principal: roca agrietada, cadenas de camalotes, piedra encerrada y balsa, par de balsas,
// hongo -> balsa alta, atajo del fardo con el hongo de la chimenea, pozo a la ruta baja, ascenso 2 (hongo dormido,
// plataforma vertical, hongo de un uso -> balsa alta) y la cadena más larga. Ruta alta: pencas, muro y copas.
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
    ['antesala x 309', 309],
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
    { run: 1, untilX: 205 },
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
    { run: 1, untilFight: true },
  ],
};

// Ruta alta de l2, desde la repisa del ascenso 1 (x 143, fila 26): pencas en zigzag, muro de roca agrietada,
// balsa sobre el hueco, pluma B y bajada al fuego 2.
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
