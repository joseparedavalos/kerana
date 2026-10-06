// Disparador (Switch): lógica pura, sin Phaser. Se enciende con un golpe (sable o onda de luz).
// Permanente (`timerMs` 0): queda encendido. Temporizado: se apaga solo tras `timerMs`,
// avisando (`closing`) durante los últimos `warnMs`.

export type SwitchState = 'off' | 'on' | 'closing';

export interface SwitchSpec {
  /** 0 = permanente; si no, ms encendido antes de apagarse. */
  timerMs: number;
  /** Aviso antes de apagarse (ms). */
  warnMs: number;
}

export class SwitchMotor {
  state: SwitchState = 'off';
  /** Temporizado: ms que le quedan encendido. */
  msLeft = 0;

  constructor(private readonly spec: SwitchSpec) {}

  get permanent(): boolean {
    return this.spec.timerMs <= 0;
  }

  /** Da energía a su objetivo (encendido o avisando). */
  get powered(): boolean {
    return this.state !== 'off';
  }

  /** Golpe: lo enciende (un temporizado vuelve a empezar su cuenta). Devuelve si cambió algo. */
  hit(): boolean {
    if (this.permanent) {
      if (this.state === 'on') return false;
      this.state = 'on';
      return true;
    }
    this.msLeft = this.spec.timerMs;
    const changed = this.state !== 'on';
    this.state = this.stateFor(this.msLeft);
    return changed;
  }

  step(dtMs: number): SwitchState {
    if (this.permanent || this.state === 'off') return this.state;
    this.msLeft = Math.max(0, this.msLeft - dtMs);
    this.state = this.msLeft <= 0 ? 'off' : this.stateFor(this.msLeft);
    return this.state;
  }

  reset(): void {
    this.state = 'off';
    this.msLeft = 0;
  }

  private stateFor(msLeft: number): SwitchState {
    return msLeft <= this.spec.warnMs ? 'closing' : 'on';
  }
}

/** Algo que un Switch maneja por id (reja, plataforma móvil). */
export interface SwitchTarget {
  setPowered(on: boolean): void;
}

/**
 * Tablero de conexiones: cada Switch nombra un objetivo por id y un objetivo puede tener varios.
 * El objetivo tiene energía si alguno de sus Switch está encendido.
 */
export class SwitchBoard {
  private readonly targets = new Map<string, SwitchTarget>();
  private readonly links: { target: string; motor: SwitchMotor }[] = [];
  private readonly last = new Map<string, boolean>();

  addTarget(id: string, target: SwitchTarget): void {
    this.targets.set(id, target);
  }

  addSwitch(targetId: string, motor: SwitchMotor): void {
    this.links.push({ target: targetId, motor });
  }

  /** Ids nombrados por algún Switch que no existen en el nivel. */
  missingTargets(): string[] {
    return [...new Set(this.links.map((l) => l.target))].filter((id) => !this.targets.has(id));
  }

  isPowered(id: string): boolean {
    return this.links.some((l) => l.target === id && l.motor.powered);
  }

  /** Pasa a cada objetivo su energía; solo avisa cuando cambia. */
  update(): void {
    for (const [id, target] of this.targets) {
      const on = this.isPowered(id);
      if (this.last.get(id) === on) continue;
      this.last.set(id, on);
      target.setPowered(on);
    }
  }
}

/** Rectángulo en px del mundo (compatible con Phaser.Geom.Rectangle). */
export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

function overlaps(a: Box, b: Box): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

/** Lo que el sable o la luz pueden encender: el tile que ocupa y su lógica. */
export interface Strikeable {
  zone: Box;
  motor: SwitchMotor;
  /** Último disparo de la onda que lo tocó. */
  lastWaveShot: number;
}

/** Tajo: los Switch que toca `attack` y que este tajo todavía no golpeó (los marca en `hitThisSwing`). */
export function swordStrikes<T extends Strikeable>(switches: readonly T[], attack: Box, hitThisSwing: Set<object>, out: T[] = []): T[] {
  out.length = 0;
  for (const sw of switches) {
    if (hitThisSwing.has(sw) || !overlaps(sw.zone, attack)) continue;
    hitThisSwing.add(sw);
    out.push(sw);
  }
  return out;
}

/** Lo que necesita de la onda de luz (LightWaveMotor). */
export interface WaveLight {
  shot: number;
  y: number;
  x: number;
  canHit: boolean;
  reachActive: boolean;
  reachX: number;
}

/** Rectángulo de la luz (reutilizado: nada de asignar en cada frame). */
const WAVE_BOX: Box = { x: 0, y: 0, width: 0, height: 0 };

/**
 * Luz de la onda: los Switch que toca y que esta onda todavía no encendió (cada onda, una vez).
 * Con `throughWalls` usa el alcance de la luz, que sigue aunque la onda haya chocado con una pared.
 */
export function waveStrikes<T extends Strikeable>(
  switches: readonly T[],
  wave: WaveLight,
  width: number,
  height: number,
  throughWalls: boolean,
  out: T[] = [],
): T[] {
  out.length = 0;
  const lit = throughWalls ? wave.reachActive : wave.canHit;
  if (!lit) return out;
  const x = throughWalls ? wave.reachX : wave.x;
  const rect = WAVE_BOX;
  rect.x = x - width / 2;
  rect.y = wave.y - height / 2;
  rect.width = width;
  rect.height = height;
  for (const sw of switches) {
    if (sw.lastWaveShot === wave.shot || !overlaps(sw.zone, rect)) continue;
    sw.lastWaveShot = wave.shot;
    out.push(sw);
  }
  return out;
}
