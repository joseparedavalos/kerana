import type { AttackDef, BossDef, BossPhaseDef } from '../../data/bosses';

// Lógica pura común a todos los jefes (GDD §11.5): fases por umbral de vida, cola de ataques
// con pesos y ciclo aviso → activo → recuperación. Sin Phaser, para probarla con tiempos simulados.

export type BossState = 'waiting' | 'idle' | 'telegraph' | 'active' | 'recover' | 'defeated';

/** Índice de la fase según la vida: la fase i dura mientras hp / max > untilHpRatio. */
export function phaseIndexFor(hp: number, maxHp: number, phases: readonly BossPhaseDef[]): number {
  const ratio = maxHp > 0 ? hp / maxHp : 0;
  for (let i = 0; i < phases.length; i++) if (ratio > phases[i].untilHpRatio) return i;
  return phases.length - 1;
}

/**
 * Elige un ataque según su peso. Evita repetir `avoidId` si hay otra opción, para que los
 * ataques se alternen. `rng` devuelve un número en [0, 1).
 */
export function pickWeighted(attacks: readonly AttackDef[], rng: () => number, avoidId?: string): AttackDef {
  const pool = attacks.length > 1 && avoidId ? attacks.filter((a) => a.id !== avoidId) : attacks;
  const total = pool.reduce((sum, a) => sum + Math.max(0, a.weight), 0);
  if (total <= 0) return pool[0];
  let roll = rng() * total;
  for (const a of pool) {
    roll -= Math.max(0, a.weight);
    if (roll < 0) return a;
  }
  return pool[pool.length - 1];
}

export interface BossTransition {
  state: BossState;
  attack: AttackDef | null;
}

export interface BossBrainOptions {
  rng?: () => number;
  /** Multiplica los avisos (modo asistido: 1.3, GDD §4.7). */
  telegraphScale?: number;
}

export class BossBrain {
  readonly maxHp: number;
  hp: number;
  state: BossState = 'waiting';
  phase = 0;
  attack: AttackDef | null = null;
  /** Tiempo que queda en el estado actual (ms). */
  msLeft = 0;
  private lastAttackId?: string;
  private readonly rng: () => number;
  private readonly telegraphScale: number;
  private readonly transition: BossTransition = { state: 'waiting', attack: null };
  /** Ataques que quedan en la cola (se rellena con una elección por pesos). */
  readonly queue: AttackDef[] = [];

  constructor(
    readonly def: BossDef,
    opts: BossBrainOptions = {},
  ) {
    this.maxHp = def.hp;
    this.hp = def.hp;
    this.rng = opts.rng ?? Math.random;
    this.telegraphScale = opts.telegraphScale ?? 1;
  }

  get phaseDef(): BossPhaseDef {
    return this.def.phases[this.phase];
  }

  get hpFraction(): number {
    return this.maxHp > 0 ? this.hp / this.maxHp : 0;
  }

  /** Se puede golpear: en la recuperación de un ataque castigable (la "ventana"). */
  get vulnerable(): boolean {
    return this.state === 'recover' && (this.attack?.punishable ?? true);
  }

  /** Empieza la pelea (después de la presentación). */
  start(): void {
    this.enter('idle', null, this.phaseDef.idleMs);
  }

  /** Vuelve al estado inicial (al caer Kerana durante la pelea). */
  reset(): void {
    this.hp = this.maxHp;
    this.phase = 0;
    this.attack = null;
    this.lastAttackId = undefined;
    this.queue.length = 0;
    this.state = 'waiting';
    this.msLeft = 0;
  }

  /** Avanza el tiempo. Devuelve la transición si cambió de estado (objeto reutilizado) o null. */
  step(dtMs: number): BossTransition | null {
    if (this.state === 'waiting' || this.state === 'defeated') return null;
    this.msLeft -= dtMs;
    if (this.msLeft > 0) return null;
    switch (this.state) {
      case 'idle': {
        const attack = this.nextAttack();
        return this.enter('telegraph', attack, attack.telegraphMs * this.telegraphScale);
      }
      case 'telegraph':
        return this.enter('active', this.attack, this.attack?.activeMs ?? 0);
      case 'active':
        return this.enter('recover', this.attack, this.attack?.recoverMs ?? 0);
      default:
        return this.enter('idle', null, this.phaseDef.idleMs);
    }
  }

  /** Aplica daño. Devuelve true si cambió de fase o fue derrotado. */
  damage(amount: number): { phaseChanged: boolean; defeated: boolean } {
    if (this.state === 'defeated' || amount <= 0) return { phaseChanged: false, defeated: false };
    this.hp = Math.max(0, this.hp - amount);
    if (this.hp <= 0) {
      this.state = 'defeated';
      this.attack = null;
      this.queue.length = 0;
      return { phaseChanged: false, defeated: true };
    }
    const phase = phaseIndexFor(this.hp, this.maxHp, this.def.phases);
    const phaseChanged = phase !== this.phase;
    if (phaseChanged) {
      this.phase = phase;
      // La cola se arma de nuevo con los ataques de la fase nueva.
      this.queue.length = 0;
    }
    return { phaseChanged, defeated: false };
  }

  /** Corta el ataque en curso y pasa a la pausa (por ejemplo, al dormirse la cabeza que atacaba). */
  interrupt(): void {
    if (this.state === 'defeated' || this.state === 'waiting') return;
    this.enter('idle', null, this.phaseDef.idleMs);
  }

  private nextAttack(): AttackDef {
    if (this.queue.length === 0) this.queue.push(pickWeighted(this.phaseDef.attacks, this.rng, this.lastAttackId));
    const attack = this.queue.shift() as AttackDef;
    this.lastAttackId = attack.id;
    return attack;
  }

  private enter(state: BossState, attack: AttackDef | null, ms: number): BossTransition {
    this.state = state;
    this.attack = attack;
    this.msLeft = ms;
    this.transition.state = state;
    this.transition.attack = attack;
    return this.transition;
  }
}
