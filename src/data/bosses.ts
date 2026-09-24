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
};

export function getBossDef(id: BossId): BossDef {
  const def = BOSSES[id];
  if (!def) throw new Error(`Jefe sin datos: ${id}`);
  return def;
}
