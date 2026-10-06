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
