// Yaguareté avá (S76): el Charger que salta un hueco. Lógica pura, sin Phaser.
// Reusa ChargerMotor para el reposo, el aviso (se agazapa), la carrera y el enfriamiento, y le suma tres tiempos:
// se planta en el borde (`gather`), salta UNA vez (`leap`) y cae expuesto (`recover`). Nunca baja de su suelo:
// en un borde salta solo si Kerana está del otro lado y hay suelo a la misma altura a menos de `maxGapPx`; si no, frena.

import { ChargerMotor, type ChargerConfig } from './ChargerMotor';

export type PounceState = 'idle' | 'telegraph' | 'charge' | 'gather' | 'leap' | 'recover' | 'cooldown';

export interface PounceConfig extends ChargerConfig {
  /** Plantado en el borde antes de saltar (ms). */
  gatherMs: number;
  /** Velocidad vertical del salto (px/s, negativa = arriba). */
  leapVelocity: number;
  /** Gravedad del mundo (px/s²): con ella se calcula el tiempo en el aire. */
  gravity: number;
  /** Hueco más ancho que salta (px). Uno más ancho lo frena en el borde. */
  maxGapPx: number;
  /** Cuánto pasa del borde de enfrente (px), además de su propio ancho. */
  landMarginPx: number;
  /** Velocidad horizontal del salto: tope (px/s). */
  leapMaxSpeed: number;
  /** Medio ancho del cuerpo (px). */
  halfWidth: number;
  /** Expuesto después de caer (ms): la ventana para pegarle o pasarlo. */
  recoverMs: number;
}

/** Lo que tiene delante en la dirección en que corre. */
export interface Ahead {
  /** Del frente del cuerpo al borde (px); Infinity si no hay borde cerca. */
  edgePx: number;
  /** Ancho del hueco (px) hasta suelo a la misma altura; null si no hay suelo a menos de `maxGapPx`. */
  gapPx: number | null;
}

export interface PounceOutput {
  state: PounceState;
  /** Velocidad horizontal a aplicar (px/s); en el aire, null (no se toca). */
  vx: number | null;
  /** Impulso del salto (solo en el paso en que despega). */
  jump: { vx: number; vy: number } | null;
}

const NO_AHEAD: Ahead = { edgePx: Infinity, gapPx: null };
/** Margen para despegar antes de mirar si aterrizó (ms), como el Jumper. */
const LIFTOFF_MS = 100;

export class PounceMotor {
  readonly charger: ChargerMotor;
  /** Estado propio (borde, salto, caída); null mientras manda el Charger. */
  private own: 'gather' | 'leap' | 'recover' | null = null;
  private msLeft = 0;
  private dir: 1 | -1 = 1;
  private gapPx = 0;
  /** Tiempo en el estado actual (ms), para repartir los cuadros. */
  elapsedMs = 0;
  private lastState: PounceState = 'idle';
  private readonly impulse = { vx: 0, vy: 0 };
  private readonly out: PounceOutput = { state: 'idle', vx: 0, jump: null };

  constructor(private readonly cfg: PounceConfig) {
    this.charger = new ChargerMotor(cfg);
  }

  get state(): PounceState {
    return this.own ?? this.charger.state;
  }

  /** Avance (0-1) dentro del estado con duración fija (0 en los demás). */
  get progress(): number {
    const total = this.state === 'telegraph' ? this.cfg.telegraphMs : this.state === 'gather' ? this.cfg.gatherMs : this.state === 'recover' ? this.cfg.recoverMs : 0;
    return total > 0 ? Math.min(1, this.elapsedMs / total) : 0;
  }

  /**
   * Avanza un paso. `distance`: distancia horizontal a Kerana (Infinity si no es un blanco: otra altura, o sobre una
   * plataforma que se mueve); `dir`: hacia dónde está; `ahead`: el borde y el hueco en la dirección de la carrera;
   * `grounded`: apoyado.
   */
  step(dtMs: number, distance: number, dir: 1 | -1, ahead: Ahead = NO_AHEAD, grounded = true): PounceOutput {
    this.out.jump = null;
    if (this.own === null) this.stepCharger(dtMs, distance, dir, ahead);
    else this.stepOwn(dtMs, grounded);
    const state = this.state;
    if (state !== this.lastState) this.elapsedMs = 0;
    else this.elapsedMs += dtMs;
    this.lastState = state;
    this.out.state = state;
    return this.out;
  }

  /** Choca contra una pared mientras corre. */
  stopRun(): void {
    this.charger.stopCharge();
  }

  private stepCharger(dtMs: number, distance: number, dir: 1 | -1, ahead: Ahead): void {
    const before = this.charger.state;
    const c = this.charger.step(dtMs, distance, dir);
    if (c.state === 'telegraph' && before === 'idle') this.dir = dir;
    this.out.vx = c.vx;
    if (c.state !== 'charge') return;
    // No persigue a quien ya no es un blanco (subió a una plataforma que se mueve, o cambió de altura).
    if (!Number.isFinite(distance)) {
      this.charger.stopCharge();
      this.out.vx = 0;
      return;
    }
    // El borde: llega con el paso de este cuadro (más un margen) y frena ahí.
    if (ahead.edgePx > (this.cfg.chargeSpeed * dtMs) / 1000 + 2) return;
    this.charger.stopCharge();
    this.out.vx = 0;
    // Salta solo si hay dónde caer y Kerana está del otro lado del hueco, en la dirección de la carrera.
    const across = dir === this.dir && ahead.gapPx !== null && distance > ahead.edgePx + ahead.gapPx;
    if (!across || ahead.gapPx === null) return;
    this.own = 'gather';
    this.msLeft = this.cfg.gatherMs;
    this.gapPx = ahead.gapPx + Math.max(0, ahead.edgePx);
  }

  private stepOwn(dtMs: number, grounded: boolean): void {
    this.msLeft -= dtMs;
    switch (this.own) {
      case 'gather':
        this.out.vx = 0;
        if (this.msLeft > 0) return;
        this.own = 'leap';
        this.msLeft = LIFTOFF_MS;
        this.impulse.vx = this.dir * leapSpeed(this.gapPx, this.cfg);
        this.impulse.vy = this.cfg.leapVelocity;
        this.out.jump = this.impulse;
        this.out.vx = null;
        return;
      case 'leap':
        this.out.vx = null;
        if (this.msLeft > 0 || !grounded) return;
        this.own = 'recover';
        this.msLeft = this.cfg.recoverMs;
        this.out.vx = 0;
        return;
      case 'recover':
        this.out.vx = 0;
        // Después, el enfriamiento del Charger (ya está en `cooldown` desde que frenó en el borde).
        if (this.msLeft <= 0) this.own = null;
        return;
    }
  }
}

/** Tiempo en el aire (s) de un salto con `vy` y la gravedad, de un suelo a otro a la misma altura. */
export function airTime(vy: number, gravity: number): number {
  return (2 * Math.abs(vy)) / gravity;
}

/**
 * Velocidad horizontal del salto (px/s): de despegar con el frente en el borde a caer con el cuerpo entero pasando el
 * borde de enfrente, más `landMarginPx`. Con tope `leapMaxSpeed`.
 */
export function leapSpeed(gapPx: number, cfg: Pick<PounceConfig, 'leapVelocity' | 'gravity' | 'halfWidth' | 'landMarginPx' | 'leapMaxSpeed'>): number {
  const travel = gapPx + 2 * cfg.halfWidth + cfg.landMarginPx;
  return Math.min(cfg.leapMaxSpeed, travel / airTime(cfg.leapVelocity, cfg.gravity));
}

/**
 * ¿Hay detrás de Kerana (en la dirección en que la empujaría) un borde sin dónde caer a menos de `guardPx`? Un hueco que
 * se puede saltar no cuenta (del otro lado hay suelo, y abajo, en l5, el claro con su ascensor); un borde a una caída o
 * a una pared, sí. Así no la tira al vacío: el golpe la empuja ≈ 60 px.
 */
export function ledgeBehind(targetX: number, footY: number, dir: 1 | -1, guardPx: number, maxGapPx: number, step: number, groundAt: (x: number, y: number) => boolean): boolean {
  const a = scanAhead(targetX, footY, dir, guardPx, maxGapPx, step, groundAt);
  return Number.isFinite(a.edgePx) && a.gapPx === null;
}

/**
 * Mira el suelo delante (`groundAt`: hay suelo firme en ese punto; solo el terreno, no las plataformas que se mueven).
 * `frontX`: el frente del cuerpo; `footY`: la línea de los pies. Busca el borde a menos de `lookPx` y, pasado el borde,
 * suelo a la misma altura (sin pared encima) a menos de `maxGapPx`.
 */
export function scanAhead(frontX: number, footY: number, dir: 1 | -1, lookPx: number, maxGapPx: number, step: number, groundAt: (x: number, y: number) => boolean): Ahead {
  const below = footY + 1;
  let edge = Infinity;
  for (let d = 0; d <= lookPx; d += step) {
    if (!groundAt(frontX + dir * d, below)) {
      edge = d;
      break;
    }
  }
  if (!Number.isFinite(edge)) return { edgePx: Infinity, gapPx: null };
  for (let g = step; g <= maxGapPx + step; g += step) {
    const x = frontX + dir * (edge + g);
    if (groundAt(x, below)) {
      // Suelo a la misma altura: sin nada sólido justo encima (no es una pared).
      if (groundAt(x, footY - 1)) return { edgePx: edge, gapPx: null };
      return g <= maxGapPx ? { edgePx: edge, gapPx: g } : { edgePx: edge, gapPx: null };
    }
  }
  return { edgePx: edge, gapPx: null };
}
