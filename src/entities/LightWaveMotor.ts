// Onda de luz del tajo cargado: lógica pura, sin Phaser. Una sola en pantalla.

export interface LightWaveConfig {
  speed: number;
  rangePx: number;
  /** Empieza a desvanecerse a esta fracción del alcance. */
  fadeFrom: number;
  bossDamage: number;
}

export class LightWaveMotor {
  active = false;
  x = 0;
  y = 0;
  dir: 1 | -1 = 1;
  traveled = 0;
  /** Lo que ya tocó esta onda (cada objetivo recibe un solo golpe). */
  private readonly hits = new Set<object>();

  constructor(private readonly cfg: LightWaveConfig) {}

  /** Lanza la onda; si ya hay una en pantalla, no sale otra. */
  fire(x: number, y: number, dir: 1 | -1): boolean {
    if (this.active) return false;
    this.active = true;
    this.x = x;
    this.y = y;
    this.dir = dir;
    this.traveled = 0;
    this.hits.clear();
    return true;
  }

  step(dtMs: number): void {
    if (!this.active) return;
    const dx = Math.min(this.cfg.speed * (dtMs / 1000), this.cfg.rangePx - this.traveled);
    this.x += this.dir * dx;
    this.traveled += dx;
    if (this.traveled >= this.cfg.rangePx) this.stop();
  }

  stop(): void {
    this.active = false;
    this.hits.clear();
  }

  /** Opacidad: 1 hasta `fadeFrom` del alcance y baja a 0 al final. */
  get alpha(): number {
    if (!this.active) return 0;
    const f = this.traveled / this.cfg.rangePx;
    if (f <= this.cfg.fadeFrom) return 1;
    return Math.max(0, 1 - (f - this.cfg.fadeFrom) / (1 - this.cfg.fadeFrom));
  }

  hasHit(target: object): boolean {
    return this.hits.has(target);
  }

  /** Registra el golpe a `target`; false si esta onda ya lo tocó. */
  tryHit(target: object): boolean {
    if (!this.active || this.hits.has(target)) return false;
    this.hits.add(target);
    return true;
  }

  /** Daño a un jefe: solo en su ventana vulnerable. */
  bossDamage(vulnerable: boolean): number {
    return vulnerable ? this.cfg.bossDamage : 0;
  }
}
