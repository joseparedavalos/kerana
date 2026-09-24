// Enemigos comunes (GDD §5.2). Los IDs con nombre real llegan con cada nivel (§5.3);
// por ahora hay uno por arquetipo para el nivel de prueba, con color placeholder.

export type Archetype = 'walker' | 'charger' | 'flyer';

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
};

export function getEnemyDef(kind: string): EnemyDef {
  const def = ENEMIES[kind];
  if (def) return def;
  console.warn(`[ENEMIGO] "${kind}" no existe; se usa "walker".`);
  return ENEMIES.walker;
}
