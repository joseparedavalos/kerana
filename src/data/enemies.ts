import { GAMEPLAY } from '../config/gameplay';
import type { SfxKey } from '../systems/sfxPresets';

// Enemigos comunes (GDD §5.2). Los IDs con nombre real llegan con cada nivel (§5.3);
// por ahora hay uno por arquetipo para el nivel de prueba, con color placeholder.

export type Archetype = 'walker' | 'charger' | 'flyer' | 'lurker' | 'diver' | 'swarm' | 'jumper' | 'thrower';

export interface EnemyDef {
  id: string;
  archetype: Archetype;
  /** Golpes que aguanta antes de purificarse (GDD §4.1). */
  hp: number;
  width: number;
  height: number;
  /** Sprite de otro enemigo que usa (el ñakurutu guasu dibuja el del ñakurutu). */
  look?: string;
  /** Escala del dibujo y del cuerpo (1 si falta). */
  scale?: number;
  /** Corazones que quita al tocarlo (si falta, `GAMEPLAY.damage.enemyContact`). */
  contactDamage?: number;

  // Walker y Flyer: patrulla.
  speed?: number;
  patrolDistance?: number;

  // Charger
  detectRadius?: number;
  telegraphMs?: number;
  chargeSpeed?: number;
  chargeMaxMs?: number;
  cooldownMs?: number;
  /** Sonido al empezar el aviso (el ladrido del jagua). */
  warnSfx?: SfxKey;
  /** Al purificarse queda en el nivel como otra cosa (la vaca embrujada queda como vaca tranquila). */
  purifiesInto?: 'vaca';
  /** Ojos que brillan en la oscuridad y se encienden en el aviso (jagua hũ, N7). */
  glowEyes?: boolean;
  /** Solo recibe daño iluminado (póra, N7; GDD §5.3). */
  needsLight?: boolean;

  // Flyer: onda vertical.
  amplitude?: number;
  frequencyHz?: number;

  // Lurker: burbujas (aviso), tiempo fuera y altura a la que emerge (px).
  warnMs?: number;
  exposedMs?: number;
  emergeHeight?: number;
  /** Lurker colgante (mbói en N5): cuelga de la rama que tiene encima en vez de salir del agua. */
  hangs?: boolean;
  /**
   * Lurker con ritmo (jakare guasu, S24): no espera a Kerana; asoma cada vez que llega la plataforma móvil que tiene
   * al lado (LevelScene lo sincroniza con ella). `emergeHeight` es lo que sale del agua el cuerpo ya escalado.
   */
  rhythm?: boolean;

  // Diver: velocidad de picada y de regreso a su poste (px/s); `restMs`, quieto en el suelo tras la picada.
  diveSpeed?: number;
  returnSpeed?: number;
  restMs?: number;

  // Swarm: tiempo persiguiendo y dispersándose (ms); `speed` es la velocidad de persecución.
  chaseMs?: number;
  disperseMs?: number;

  // Jumper: espera entre saltos (ms) y velocidad vertical del salto (px/s); `speed` es la horizontal
  // y `telegraphMs`, el agachado previo.
  waitMs?: number;
  jumpVelocity?: number;

  // Thrower: `telegraphMs` es el aviso y `cooldownMs` la cadencia. Proyectil: gravedad (px/s²),
  // tiempo de vuelo por px de distancia, radio (px) y cuántos puede tener en el aire.
  projectileGravity?: number;
  flightMsPerPx?: number;
  projectileRadius?: number;
  projectilePool?: number;
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
  // Jakare guasu (S24): el jakare en grande de la zona de ritmo de l2, sincronizado con las balsas; valores en
  // GAMEPLAY.bigJakare.
  jakare_guasu: {
    id: 'jakare_guasu',
    archetype: 'lurker',
    look: 'jakare',
    hp: GAMEPLAY.bigJakare.hp,
    width: 25,
    height: 16,
    scale: GAMEPLAY.bigJakare.scale,
    warnMs: GAMEPLAY.bigJakare.warnMs,
    exposedMs: GAMEPLAY.bigJakare.exposedMs,
    emergeHeight: GAMEPLAY.bigJakare.emergeHeight,
    rhythm: true,
  },
  // Ñakurutu guasu (S23): guardián de un camino oculto de l2; valores en GAMEPLAY.guardian.
  nakurutu_guasu: {
    id: 'nakurutu_guasu',
    archetype: 'diver',
    look: 'nakurutu',
    hp: GAMEPLAY.guardian.hp,
    width: 12,
    height: 14,
    scale: GAMEPLAY.guardian.scale,
    contactDamage: GAMEPLAY.guardian.contactDamage,
    detectRadius: GAMEPLAY.guardian.detectRadius,
    telegraphMs: GAMEPLAY.guardian.telegraphMs,
    diveSpeed: GAMEPLAY.guardian.diveSpeed,
    returnSpeed: GAMEPLAY.guardian.returnSpeed,
    chargeMaxMs: GAMEPLAY.guardian.diveMaxMs,
    restMs: GAMEPLAY.guardian.restMs,
    cooldownMs: GAMEPLAY.guardian.cooldownMs,
    warnSfx: 'hoot',
  },

  // Nivel 3 (GDD §5.3): el ñandu corre en línea recta (se lo salta); el karakara pica como el ñakurutu.
  nandu: {
    id: 'nandu',
    archetype: 'charger',
    hp: 2,
    width: 16,
    height: 26,
    detectRadius: 130,
    telegraphMs: 450,
    chargeSpeed: 200,
    chargeMaxMs: 1800,
    cooldownMs: 900,
  },
  karakara: {
    id: 'karakara',
    archetype: 'diver',
    hp: 1,
    width: 14,
    height: 12,
    detectRadius: 110,
    telegraphMs: 450,
    diveSpeed: 250,
    returnSpeed: 80,
    chargeMaxMs: 1200,
    cooldownMs: 1000,
  },

  // Nivel 4 (GDD §5.3): el jagua ladra antes de cargar; las abejas son un enjambre de partículas.
  jagua: {
    id: 'jagua',
    archetype: 'charger',
    hp: 2,
    width: 22,
    height: 14,
    detectRadius: 110,
    telegraphMs: 500,
    chargeSpeed: 210,
    chargeMaxMs: 1600,
    cooldownMs: 900,
    warnSfx: 'bark',
  },
  abejas: {
    id: 'abejas',
    archetype: 'swarm',
    hp: 1,
    width: 14,
    height: 12,
    speed: 70,
    detectRadius: 80,
    chaseMs: 2800,
    disperseMs: 900,
    cooldownMs: 2500,
  },

  // Nivel 5 (GDD §5.3): el kuati salta hacia Kerana; el ka'i lanza frutas desde las copas;
  // el mbói cuelga de las ramas y baja cuando Kerana pasa cerca.
  kuati: {
    id: 'kuati',
    archetype: 'jumper',
    hp: 2,
    width: 18,
    height: 12,
    detectRadius: 120,
    waitMs: 1100,
    telegraphMs: 350,
    jumpVelocity: -320,
    speed: 95,
  },
  kai: {
    id: 'kai',
    archetype: 'thrower',
    hp: 2,
    width: 14,
    height: 18,
    detectRadius: 170,
    telegraphMs: 550,
    cooldownMs: 1900,
    projectileGravity: 600,
    flightMsPerPx: 5,
    projectileRadius: 4,
    projectilePool: 3,
  },
  mboi_colgante: {
    id: 'mboi_colgante',
    archetype: 'lurker',
    hangs: true,
    hp: 2,
    width: 8,
    height: 26,
    detectRadius: 56,
    warnMs: 700,
    exposedMs: 1600,
    cooldownMs: 1400,
  },

  // Nivel 4, extra: la vaca embrujada embiste como un Charger; purificada queda como vaca tranquila.
  vaca_embrujada: {
    id: 'vaca_embrujada',
    archetype: 'charger',
    hp: 3,
    width: 30,
    height: 18,
    detectRadius: 120,
    telegraphMs: 700,
    chargeSpeed: 170,
    chargeMaxMs: 1600,
    cooldownMs: 1200,
    warnSfx: 'moo',
    purifiesInto: 'vaca',
  },

  // Nivel 6 (GDD §5.3): los taitetu van en manada (de a 2 o 3 en el mapa); la cría de Ao Ao salta.
  taitetu: {
    id: 'taitetu',
    archetype: 'charger',
    hp: 2,
    width: 20,
    height: 12,
    detectRadius: 120,
    telegraphMs: 450,
    chargeSpeed: 190,
    chargeMaxMs: 1500,
    cooldownMs: 1000,
    warnSfx: 'grunt',
  },
  ao_ao_cria: {
    id: 'ao_ao_cria',
    archetype: 'jumper',
    hp: 1,
    width: 14,
    height: 12,
    detectRadius: 130,
    waitMs: 900,
    telegraphMs: 300,
    jumpVelocity: -280,
    speed: 100,
  },

  // Nivel 7 (GDD §5.3): el póra flota a través de las paredes y solo se puede golpear iluminado;
  // el jagua hũ embiste y sus ojos brillan en la oscuridad como aviso.
  pora: { id: 'pora', archetype: 'flyer', hp: 2, width: 14, height: 18, speed: 22, patrolDistance: 64, amplitude: 10, frequencyHz: 0.6, needsLight: true },
  jagua_hu: {
    id: 'jagua_hu',
    archetype: 'charger',
    hp: 2,
    width: 22,
    height: 14,
    detectRadius: 120,
    telegraphMs: 700,
    chargeSpeed: 200,
    chargeMaxMs: 1600,
    cooldownMs: 1000,
    warnSfx: 'growl',
    glowEyes: true,
  },
};

export function getEnemyDef(kind: string): EnemyDef {
  const def = ENEMIES[kind];
  if (def) return def;
  console.warn(`[ENEMIGO] "${kind}" no existe; se usa "walker".`);
  return ENEMIES.walker;
}
