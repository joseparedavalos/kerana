// Onda de luz del tajo cargado: lógica pura, sin Phaser. Una sola en pantalla.

export interface LightWaveConfig {
  speed: number;
  rangePx: number;
  /** Empieza a desvanecerse a esta fracción del alcance. */
  fadeFrom: number;
  bossDamage: number;
  /** Ancho de la onda (px): el borde delantero es el que choca con el terreno. */
  width: number;
  /** Al chocar con el terreno se apaga en este tiempo (ms), sin dañar nada. */
  wallFadeMs: number;
}

/** ¿Hay terreno sólido (capa Ground) en (x, y)? */
export type SolidProbe = (x: number, y: number) => boolean;

export class LightWaveMotor {
  active = false;
  x = 0;
  y = 0;
  dir: 1 | -1 = 1;
  traveled = 0;
  /** Chocó con el terreno: ya no avanza ni daña, solo se apaga. */
  blocked = false;
  private blockedMs = 0;
  /** Lo que ya tocó esta onda (cada objetivo recibe un solo golpe). */
  private readonly hits = new Set<object>();
  /**
   * Alcance de la luz (S18): avanza con la onda hasta `rangePx` aunque ella choque con una pared.
   * Solo lo usan los Switch (la luz pasa entre las piedras); no daña nada.
   */
  reachActive = false;
  reachX = 0;
  private reachTraveled = 0;
  /** Número de disparo (cada onda nueva suma 1): un Switch cuenta cada onda una sola vez. */
  shot = 0;

  constructor(private readonly cfg: LightWaveConfig) {}

  /** Lanza la onda; si ya hay una en pantalla, no sale otra. */
  fire(x: number, y: number, dir: 1 | -1): boolean {
    if (this.active) return false;
    this.active = true;
    this.x = x;
    this.y = y;
    this.dir = dir;
    this.traveled = 0;
    this.blocked = false;
    this.blockedMs = 0;
    this.hits.clear();
    this.reachActive = true;
    this.reachX = x;
    this.reachTraveled = 0;
    this.shot++;
    return true;
  }

  /** Avanza; si el borde delantero entra en el terreno, se detiene y se desvanece. */
  step(dtMs: number, isSolid?: SolidProbe): void {
    this.stepReach(dtMs);
    if (!this.active) return;
    if (this.blocked) {
      this.blockedMs += dtMs;
      if (this.blockedMs >= this.cfg.wallFadeMs) this.stop();
      return;
    }
    // Sale ya dentro de una pared (Kerana pegada a ella): se apaga ahí mismo.
    if (this.traveled === 0 && isSolid?.(this.frontX(), this.y)) {
      this.blocked = true;
      return;
    }
    let remaining = Math.min(this.cfg.speed * (dtMs / 1000), this.cfg.rangePx - this.traveled);
    // Pasos de hasta la mitad del ancho para no saltarse paredes finas.
    const maxStep = Math.max(1, this.cfg.width / 2);
    while (remaining > 0) {
      const dx = Math.min(remaining, maxStep);
      this.x += this.dir * dx;
      this.traveled += dx;
      remaining -= dx;
      if (isSolid?.(this.frontX(), this.y)) {
        this.blocked = true;
        return;
      }
    }
    if (this.traveled >= this.cfg.rangePx) this.stop();
  }

  /** La luz sigue derecho a la velocidad de la onda, sin chocar, hasta el alcance. */
  private stepReach(dtMs: number): void {
    if (!this.reachActive) return;
    const dx = Math.min(this.cfg.speed * (dtMs / 1000), this.cfg.rangePx - this.reachTraveled);
    this.reachX += this.dir * dx;
    this.reachTraveled += dx;
    if (this.reachTraveled >= this.cfg.rangePx) this.reachActive = false;
  }

  stop(): void {
    this.active = false;
    this.blocked = false;
    this.hits.clear();
  }

  private frontX(): number {
    return this.x + (this.dir * this.cfg.width) / 2;
  }

  /** Opacidad: 1 hasta `fadeFrom` del alcance y baja a 0 al final. */
  get alpha(): number {
    if (!this.active) return 0;
    if (this.blocked) return this.baseAlpha() * Math.max(0, 1 - this.blockedMs / this.cfg.wallFadeMs);
    return this.baseAlpha();
  }

  private baseAlpha(): number {
    const f = this.traveled / this.cfg.rangePx;
    if (f <= this.cfg.fadeFrom) return 1;
    return Math.max(0, 1 - (f - this.cfg.fadeFrom) / (1 - this.cfg.fadeFrom));
  }

  /** Tras chocar con el terreno no daña nada (ni lo que está del otro lado). */
  get canHit(): boolean {
    return this.active && !this.blocked;
  }

  hasHit(target: object): boolean {
    return this.hits.has(target);
  }

  /** Registra el golpe a `target`; false si esta onda ya lo tocó. */
  tryHit(target: object): boolean {
    if (!this.canHit || this.hits.has(target)) return false;
    this.hits.add(target);
    return true;
  }

  /** Daño a un jefe: solo en su ventana vulnerable. */
  bossDamage(vulnerable: boolean): number {
    return vulnerable ? this.cfg.bossDamage : 0;
  }
}
