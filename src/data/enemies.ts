// Enemigos comunes (GDD §5.2). Los IDs con nombre real llegan con cada nivel (§5.3);
// por ahora hay uno por arquetipo para el nivel de prueba, con color placeholder.

export type Archetype = 'walker' | 'charger' | 'flyer' | 'lurker' | 'diver';

export interface EnemyDef {
  id: string;
  archetype: Archetype;
  /** Golpes que aguanta antes de purificarse (GDD §4.1). */
  hp: number;
  width: number;
  height: number;

  // Walker y Flyer: patrulla.
  speed?: number;
  patrolDistance?: number;

  // Charger
  detectRadius?: number;
  telegraphMs?: number;
  chargeSpeed?: number;
  chargeMaxMs?: number;
  cooldownMs?: number;

  // Flyer: onda vertical.
  amplitude?: number;
  frequencyHz?: number;

  // Lurker: burbujas (aviso), tiempo fuera y altura a la que emerge (px).
  warnMs?: number;
  exposedMs?: number;
  emergeHeight?: number;

  // Diver: velocidad de picada y de regreso a su poste (px/s).
  diveSpeed?: number;
  returnSpeed?: number;
}

export const ENEMIES: Record<string, EnemyDef> = {
  walker: { id: 'walker', archetype: 'walker', hp: 2, width: 16, height: 16, speed: 40, patrolDistance: 48 },
  charger: {
    id: 'charger',
    archetype: 'charger',
    hp: 2,
    width: 18,
    height: 16,
    detectRadius: 90,
    telegraphMs: 400,
    chargeSpeed: 180,
    chargeMaxMs: 2000,
    cooldownMs: 600,
  },
  flyer: { id: 'flyer', archetype: 'flyer', hp: 1, width: 14, height: 14, speed: 30, patrolDistance: 56, amplitude: 14, frequencyHz: 1.2 },

  // Nivel 1 (GDD §5.3)
  teju_i: { id: 'teju_i', archetype: 'walker', hp: 1, width: 18, height: 10, speed: 38, patrolDistance: 40 },
  mbopi: { id: 'mbopi', archetype: 'flyer', hp: 1, width: 14, height: 10, speed: 36, patrolDistance: 48, amplitude: 18, frequencyHz: 1.4 },

  // Nivel 2 (GDD §5.3)
  jakare: {
    id: 'jakare',
    archetype: 'lurker',
    hp: 3,
    width: 30,
    height: 10,
    detectRadius: 64,
    warnMs: 900,
    exposedMs: 1800,
    cooldownMs: 1400,
    emergeHeight: 8,
  },
  nakurutu: {
    id: 'nakurutu',
    archetype: 'diver',
    hp: 1,
    width: 12,
    height: 14,
    detectRadius: 96,
    telegraphMs: 500,
    diveSpeed: 230,
    returnSpeed: 70,
    chargeMaxMs: 1200,
    cooldownMs: 900,
  },
  mboi: { id: 'mboi', archetype: 'walker', hp: 2, width: 22, height: 8, speed: 30, patrolDistance: 44 },
};

export function getEnemyDef(kind: string): EnemyDef {
  const def = ENEMIES[kind];
  if (def) return def;
  console.warn(`[ENEMIGO] "${kind}" no existe; se usa "walker".`);
  return ENEMIES.walker;
}
