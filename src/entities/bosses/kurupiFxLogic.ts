import { makePixels, put, type AtlasFrame, type Pixels } from '../../systems/pixelArt';

// Kurupi corriendo rápido (S104): cuándo deja estela, cuántas patadas de tierra y hojas, y el dibujo de las hojas
// y los terrones. Lógica pura, sin Phaser.

/** Las carreras rápidas: la embestida (fase 1) y la carrera al revés (fase 2). El engaño (fase 3) no. */
export const FAST_RUNS: readonly string[] = ['charge', 'reverse_run'];

/** ¿Está en el 'active' de una carrera rápida? */
export function isFastRun(state: string, attackId: string | undefined): boolean {
  return state === 'active' && attackId !== undefined && FAST_RUNS.includes(attackId);
}

export interface KickConfig {
  everyPx: number;
  minSpeed: number;
  maxPerFrame: number;
}

/**
 * Cuenta las patadas: una cada `everyPx` de carrera, solo mientras va a más de `minSpeed` px/s (con la carrera que
 * acelera, las primeras no levantan nada). Por distancia y no por cuadros: sale lo mismo a cualquier FPS.
 */
export class KickMeter {
  private carry = 0;
  /** Patadas desde el último `reset` (la que sigue es la número `count + 1`). */
  count = 0;

  constructor(private readonly cfg: KickConfig) {}

  reset(): void {
    this.carry = 0;
    this.count = 0;
  }

  /** `dx`: lo que avanzó este cuadro (px). Devuelve cuántas patadas salen ahora. */
  step(dx: number, deltaMs: number): number {
    const dist = Math.abs(dx);
    if (deltaMs <= 0 || (dist * 1000) / deltaMs < this.cfg.minSpeed) return 0;
    this.carry += dist;
    let n = 0;
    while (this.carry >= this.cfg.everyPx && n < this.cfg.maxPerFrame) {
      this.carry -= this.cfg.everyPx;
      n++;
    }
    // Un cuadro muy largo no deja patadas guardadas para después.
    if (this.carry >= this.cfg.everyPx) this.carry %= this.cfg.everyPx;
    this.count += n;
    return n;
  }
}

/** ¿La patada número `index` (desde 1) levanta también una hoja? */
export function kickHasLeaf(index: number, leafEvery: number): boolean {
  return leafEvery > 0 && index % leafEvery === 0;
}

// ── Dibujo ─────────────────────────────────────────────────────────────────
// En grises: el emisor los tiñe (multiplica) con los colores de la arena. B es el color tal cual; M, su sombra; D, el
// contorno oscuro que las despega de la selva del fondo (de un valor parecido).

const SHADE: Record<string, number> = { B: 0xffffff, M: 0xc0c0c0, D: 0x7c7c7c };

function fromRows(rows: readonly string[]): Pixels {
  const w = Math.max(...rows.map((r) => r.length));
  const p = makePixels(w, rows.length);
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const shade = SHADE[row[x]];
      if (shade !== undefined) put(p, x, y, shade);
    }
  });
  return p;
}

/**
 * Hojas chicas, a 2 píxeles por unidad. Dos aleteos de cuatro cuadros (de frente, de canto, del revés, de canto):
 * el aleteo se ve cambiando de cuadro, sin girar la textura (el pixel art no se deforma).
 */
export const LEAF_FLUTTERS: Readonly<Record<string, readonly (readonly string[])[]>> = {
  // Acostada, el pecíolo a la izquierda.
  h: [
    ['..DDDD..', '.DBBBBD.', 'DBBBBMMD', '.DDMMDD.'],
    ['..DDDD..', 'DBBBBMMD', '.DDDD...'],
    ['..DDDD..', '.DMMMMD.', 'DMMMMMMD', '.DDDDDD.'],
    ['..DDDD..', 'DMMMMMMD', '.DDDD...'],
  ],
  // En diagonal, la punta arriba a la derecha.
  d: [
    ['...DDD', '..DBBD', '.DBBMD', 'DBBMD.', 'DMMD..', 'DD....'],
    ['....DD', '...DBD', '..DBD.', '.DMD..', 'DD....'],
    ['...DDD', '..DMMD', '.DMMMD', 'DMMMD.', 'DMMD..', 'DD....'],
    ['....DD', '...DMD', '..DMD.', '.DMD..', 'DD....'],
  ],
};

/** Terrones de 1,5 a 2 unidades, con su contorno. */
export const CLODS: readonly (readonly string[])[] = [
  ['.DD.', 'DBBD', '.DMD'],
  ['DBD', 'DMD'],
  ['.DD', 'DBD', 'DD.'],
];

export const leafFrameName = (flutter: string, i: number): string => `leaf_${flutter}${i}`;
export const clodFrameName = (i: number): string => `clod_${i}`;

/** Los cuadros del atlas: las hojas de cada aleteo y los terrones. */
export function debrisFrames(): AtlasFrame[] {
  const frames: AtlasFrame[] = [];
  for (const [flutter, rows] of Object.entries(LEAF_FLUTTERS)) {
    rows.forEach((r, i) => frames.push({ name: leafFrameName(flutter, i), px: fromRows(r) }));
  }
  CLODS.forEach((r, i) => frames.push({ name: clodFrameName(i), px: fromRows(r) }));
  return frames;
}
