// Máquina de estados del arquetipo Lurker (GDD §5.2): lógica pura, sin Phaser.
// Oculto → burbujas (aviso) → fuera (vulnerable) → se sumerge y espera.
import { moverTiming, type MoverSpec } from '../MoverMotor';

export type LurkerState = 'hidden' | 'warn' | 'exposed' | 'cooldown';

export interface LurkerConfig {
  detectRadius: number;
  /** Burbujas antes de emerger (ms). */
  warnMs: number;
  /** Tiempo fuera del agua (ms). */
  exposedMs: number;
  /** Tiempo sumergido antes de poder volver a emerger (ms). */
  cooldownMs: number;
}

export class LurkerMotor {
  state: LurkerState = 'hidden';
  private msLeft = 0;

  constructor(private readonly cfg: LurkerConfig) {}

  /** Solo se le puede pegar (y solo muerde) cuando está fuera. */
  get exposed(): boolean {
    return this.state === 'exposed';
  }

  /** `distance`: distancia a Kerana (Infinity si no hay objetivo válido). */
  step(dtMs: number, distance: number): LurkerState {
    switch (this.state) {
      case 'hidden':
        if (distance <= this.cfg.detectRadius) this.enter('warn', this.cfg.warnMs);
        break;
      case 'warn':
        this.msLeft -= dtMs;
        if (this.msLeft <= 0) this.enter('exposed', this.cfg.exposedMs);
        break;
      case 'exposed':
        this.msLeft -= dtMs;
        if (this.msLeft <= 0) this.enter('cooldown', this.cfg.cooldownMs);
        break;
      case 'cooldown':
        this.msLeft -= dtMs;
        if (this.msLeft <= 0) this.enter('hidden', 0);
        break;
    }
    return this.state;
  }

  private enter(state: LurkerState, ms: number): void {
    this.state = state;
    this.msLeft = ms;
  }
}

/**
 * Estado de un Lurker con ritmo (jakare guasu, S24) a los `clockMs` de juego: sale (`exposed`) a los `exposedAtMs` y
 * después una vez por período, con `warnMs` de burbujas antes; el resto del período está abajo (`cooldown`). Sale del
 * reloj y no de un estado que avanza, así que no se desfasa de las plataformas por más vueltas que den.
 */
export function rhythmState(clockMs: number, periodMs: number, exposedAtMs: number, warnMs: number, exposedMs: number): LurkerState {
  const phase = (((clockMs - exposedAtMs + warnMs) % periodMs) + periodMs) % periodMs;
  if (phase < warnMs) return 'warn';
  if (phase < warnMs + exposedMs) return 'exposed';
  return 'cooldown';
}

/** Plataforma para sincronizar un jakare guasu (px): su lugar en el origen y su recorrido. */
export interface RhythmMover {
  x: number;
  y: number;
  width: number;
  spec: MoverSpec;
}

/**
 * Sincroniza un jakare guasu (S24) con la plataforma `loop` cuya punta (el origen o el otro extremo) queda más cerca
 * de su punto (`x`, `y`: la superficie del agua), a no más de `maxDist` px: sale cuando ella llega a esa punta y
 * después una vez por vuelta. Sin plataforma cerca, `undefined` (espera a Kerana como un jakare común).
 */
export function rhythmFromMovers(x: number, y: number, movers: readonly RhythmMover[], maxDist: number): { periodMs: number; exposedAtMs: number } | undefined {
  let best: { dist: number; periodMs: number; exposedAtMs: number } | undefined;
  for (const m of movers) {
    if ((m.spec.mode ?? 'loop') !== 'loop' || (m.spec.dx === 0 && m.spec.dy === 0)) continue;
    const t = moverTiming(m.spec);
    const ends: readonly [number, number, number][] = [
      [0, 0, t.atOriginMs],
      [m.spec.dx, m.spec.dy, t.atEndMs],
    ];
    for (const [ox, oy, atMs] of ends) {
      const left = m.x + ox;
      if (Math.abs(m.y + oy - y) > maxDist) continue;
      const dist = Math.max(0, left - x, x - (left + m.width));
      if (dist <= maxDist && (!best || dist < best.dist)) best = { dist, periodMs: t.periodMs, exposedAtMs: atMs };
    }
  }
  return best && { periodMs: best.periodMs, exposedAtMs: best.exposedAtMs };
}

/** Lurker escondido detrás de algo (Karaí Vosá, S70): medidas en GAMEPLAY.karaiVosa. */
export interface HideSpec {
  /** Alto del dibujo y de lo que lo tapa (unidades). */
  artHeight: number;
  coverHeight: number;
  /** Cuánto se ve del sombrero en el aviso. */
  peek: number;
}

/**
 * Cuánto está agachado (px bajo los pies de pie) en cada estado: escondido, con todo el dibujo bajo el borde de lo
 * que lo tapa; en el aviso, `peek` más arriba (asoma el sombrero); afuera, de pie. Lo que queda bajo el suelo no se
 * dibuja (el recorte del lurker), así que agacharse es hundirse.
 */
export function hideCrouch(state: LurkerState, spec: HideSpec): number {
  const hidden = Math.max(0, spec.artHeight - spec.coverHeight + 1);
  if (state === 'exposed') return 0;
  if (state === 'warn') return Math.max(0, hidden - spec.peek);
  return hidden;
}

/** El golpe del cucharón: ventana desde que sale (ms) y zona delante del cuerpo (px). */
export interface StrikeSpec {
  fromMs: number;
  toMs: number;
  reach: number;
  height: number;
}

/** ¿El cucharón lastima a los `outMs` de haber salido? */
export function strikeActive(outMs: number, strike: StrikeSpec): boolean {
  return outMs >= strike.fromMs && outMs < strike.toMs;
}

/** Zona del cucharón: desde el borde del cuerpo hacia donde mira, `reach` de largo y `height` desde los pies. */
export function strikeZone(x: number, feetY: number, facing: 1 | -1, halfWidth: number, strike: StrikeSpec): { x: number; y: number; width: number; height: number } {
  const near = x + facing * halfWidth;
  return { x: facing > 0 ? near : near - strike.reach, y: feetY - strike.height, width: strike.reach, height: strike.height };
}
