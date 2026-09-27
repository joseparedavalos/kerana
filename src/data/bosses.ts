import type { BossId } from './types';

// Jefes (GDD §11.6). Cada fase dura mientras hp / hpMax > untilHpRatio.
export interface AttackDef {
  id: string;
  weight: number;
  telegraphMs: number;
  activeMs: number;
  recoverMs: number;
  /** En la recuperación el jefe se puede golpear (la "ventana" del GDD). Por defecto, sí. */
  punishable?: boolean;
}

export interface BossPhaseDef {
  untilHpRatio: number;
  /** Pausa entre ataques (ms). */
  idleMs: number;
  attacks: AttackDef[];
}

export interface BossDef {
  id: BossId;
  nameKey: string;
  epithetKey: string;
  hp: number;
  phases: BossPhaseDef[];
}

/** Teju Jagua: 7 cabezas × 2 golpes (GDD §6.1). */
export const TEJU_JAGUA_HEADS = 7;
export const TEJU_JAGUA_HITS_PER_HEAD = 2;
/** Colores del arcoíris para las 7 cabezas. */
export const TEJU_JAGUA_COLORS = [0xe04848, 0xf08a30, 0xf2d04e, 0x5cc85c, 0x4a8fe0, 0x5a4ac8, 0xa050d0] as const;

const TEJU_HP = TEJU_JAGUA_HEADS * TEJU_JAGUA_HITS_PER_HEAD;

/** Mbói Tu'i: 12 golpes, 3 fases de 4 (GDD §6.2). */
const MBOI_HP = 12;

/** Moñái: 12 golpes, 3 fases de 4 (GDD §6.3). */
const MONAI_HP = 12;

/** Jasy Jatere: 9 golpes, 3 fases de 3 (GDD §6.4). El noveno no lo vence: suelta el bastón y hay carrera. */
const JASY_HP = 9;

export const BOSSES: Partial<Record<BossId, BossDef>> = {
  teju_jagua: {
    id: 'teju_jagua',
    nameKey: 'boss.teju_jagua.name',
    epithetKey: 'boss.teju_jagua.epithet',
    hp: TEJU_HP,
    phases: [
      // Fase 1: hasta dormir 3 cabezas.
      {
        untilHpRatio: 8 / TEJU_HP,
        idleMs: 700,
        attacks: [
          { id: 'bite', weight: 2, telegraphMs: 800, activeMs: 450, recoverMs: 1500 },
          { id: 'tail', weight: 1, telegraphMs: 700, activeMs: 2600, recoverMs: 300, punishable: false },
        ],
      },
      // Fase 2: hasta dormir 6 cabezas. Estalactitas después de cada coletazo.
      {
        untilHpRatio: 2 / TEJU_HP,
        idleMs: 550,
        attacks: [
          { id: 'bite', weight: 1, telegraphMs: 800, activeMs: 450, recoverMs: 1500 },
          { id: 'fire', weight: 2, telegraphMs: 1000, activeMs: 1100, recoverMs: 1000 },
          { id: 'tail_stalactites', weight: 1, telegraphMs: 700, activeMs: 2600, recoverMs: 300, punishable: false },
        ],
      },
      // Fase 3: la última cabeza, mordidas rápidas alternadas con fuego.
      {
        untilHpRatio: 0,
        idleMs: 350,
        attacks: [
          { id: 'bite', weight: 1, telegraphMs: 500, activeMs: 380, recoverMs: 1000 },
          { id: 'fire', weight: 1, telegraphMs: 500, activeMs: 900, recoverMs: 1000 },
        ],
      },
    ],
  },
  mboi_tui: {
    id: 'mboi_tui',
    nameKey: 'boss.mboi_tui.name',
    epithetKey: 'boss.mboi_tui.epithet',
    hp: MBOI_HP,
    phases: [
      // Fase 1: picotazos desde uno de los 3 puntos del agua.
      {
        untilHpRatio: 8 / MBOI_HP,
        idleMs: 700,
        attacks: [{ id: 'peck', weight: 1, telegraphMs: 1000, activeMs: 450, recoverMs: 1500 }],
      },
      // Fase 2: + graznido (anillos que empujan) y escupitajo (sin ventana).
      {
        untilHpRatio: 4 / MBOI_HP,
        idleMs: 600,
        attacks: [
          { id: 'peck', weight: 2, telegraphMs: 1000, activeMs: 450, recoverMs: 1500 },
          { id: 'squawk', weight: 1, telegraphMs: 800, activeMs: 1500, recoverMs: 1000 },
          { id: 'spit', weight: 1, telegraphMs: 600, activeMs: 1200, recoverMs: 400, punishable: false },
        ],
      },
      // Fase 3: enroscado en el islote central; picotazos rápidos y graznido doble.
      {
        untilHpRatio: 0,
        idleMs: 450,
        attacks: [
          { id: 'peck', weight: 2, telegraphMs: 600, activeMs: 350, recoverMs: 1000 },
          { id: 'squawk_double', weight: 1, telegraphMs: 600, activeMs: 2400, recoverMs: 1000 },
        ],
      },
    ],
  },
  monai: {
    id: 'monai',
    nameKey: 'boss.monai.name',
    epithetKey: 'boss.monai.epithet',
    hp: MONAI_HP,
    phases: [
      // Fase 1: se esconde en una copa y cae en picada (sombra 1 s); aturdido 1,5 s.
      {
        untilHpRatio: 8 / MONAI_HP,
        idleMs: 800,
        attacks: [{ id: 'descent', weight: 1, telegraphMs: 1000, activeMs: 450, recoverMs: 1500 }],
      },
      // Fase 2: + pulso de hipnosis desde el suelo (los troncos lo tapan).
      {
        untilHpRatio: 4 / MONAI_HP,
        idleMs: 700,
        attacks: [
          { id: 'descent', weight: 2, telegraphMs: 1000, activeMs: 450, recoverMs: 1500 },
          { id: 'pulse', weight: 1, telegraphMs: 1000, activeMs: 700, recoverMs: 1000 },
        ],
      },
      // Fase 3: + robo del corazón (embestida en diagonal; la cola queda expuesta 1,2 s); descensos más rápidos.
      {
        untilHpRatio: 0,
        idleMs: 550,
        attacks: [
          { id: 'descent', weight: 1, telegraphMs: 750, activeMs: 320, recoverMs: 1300 },
          { id: 'pulse', weight: 1, telegraphMs: 1000, activeMs: 700, recoverMs: 1000 },
          { id: 'steal', weight: 2, telegraphMs: 700, activeMs: 550, recoverMs: 1200 },
        ],
      },
    ],
  },
  jasy_jatere: {
    id: 'jasy_jatere',
    nameKey: 'boss.jasy_jatere.name',
    epithetKey: 'boss.jasy_jatere.epithet',
    hp: JASY_HP,
    phases: [
      // Fase 1 (visible): salta entre techos y suelo; levanta el bastón 0,6 s y lanza 3 chispas; se burla 1,2 s.
      {
        untilHpRatio: 6 / JASY_HP,
        idleMs: 900,
        attacks: [{ id: 'sparks', weight: 1, telegraphMs: 600, activeMs: 400, recoverMs: 1200 }],
      },
      // Fase 2 (invisible): emboscada tras el destello del bastón (0,4 s) y enjambres con zumbido.
      {
        untilHpRatio: 3 / JASY_HP,
        idleMs: 1000,
        attacks: [
          { id: 'ambush', weight: 2, telegraphMs: 400, activeMs: 450, recoverMs: 1300 },
          { id: 'swarm', weight: 1, telegraphMs: 700, activeMs: 200, recoverMs: 500, punishable: false },
        ],
      },
      // Fase 3 (invisible, más rápido): + chispas. El golpe final suelta el bastón (carrera).
      {
        untilHpRatio: 0,
        idleMs: 800,
        attacks: [
          { id: 'ambush', weight: 2, telegraphMs: 400, activeMs: 400, recoverMs: 1200 },
          { id: 'swarm', weight: 1, telegraphMs: 700, activeMs: 200, recoverMs: 500, punishable: false },
          { id: 'sparks', weight: 1, telegraphMs: 500, activeMs: 400, recoverMs: 1000 },
        ],
      },
    ],
  },
};

export function getBossDef(id: BossId): BossDef {
  const def = BOSSES[id];
  if (!def) throw new Error(`Jefe sin datos: ${id}`);
  return def;
}
