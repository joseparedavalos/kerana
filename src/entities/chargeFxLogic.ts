// Cómo se ve la carga del tajo cargado (S80), en lógica pura, sin Phaser:
// las hebras de luz que entran al filo, el momento de «listo» y dónde está el sable en cada cuadro del dibujo.

export interface StrandConfig {
  /** Hebras a la vez (pool fijo). */
  max: number;
  /** Una hebra nueva cada tantos ms al empezar la carga y al completarla (se interpola entre los dos). */
  everyStartMs: number;
  everyEndMs: number;
  /** Distancia desde la que entra la cabeza (unidades) y lo que tarda en llegar al filo (ms). */
  fromDistance: number;
  travelMs: number;
  /** Largo al salir (unidades); se acorta con la distancia, hasta 0 en el filo. */
  length: number;
  /** De dónde entran (grados, mirando a la derecha; 0 = adelante, negativo = arriba). */
  arcFromDeg: number;
  arcToDeg: number;
  /** Tramo del sable donde caen: de esta fracción (0 = mango) a la punta (1). */
  bladeFrom: number;
}

export interface Strand {
  active: boolean;
  ageMs: number;
  /** Dirección desde el filo hacia donde nació (radianes, mirando a la derecha). */
  angle: number;
  /** Punto del filo al que va (0 = mango, 1 = punta). */
  along: number;
}

export type ChargeFxPhase = 'off' | 'charging' | 'ready';

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Cada cuánto nace una hebra con la carga en `fraction` (0 → 1): cada vez más seguido. */
export function strandEveryMs(fraction: number, cfg: StrandConfig): number {
  return cfg.everyStartMs + (cfg.everyEndMs - cfg.everyStartMs) * clamp01(fraction);
}

export interface StrandShape {
  /** Distancia de la cabeza al filo (unidades). */
  head: number;
  /** Largo de la hebra detrás de la cabeza (unidades). */
  length: number;
  /** 0 al nacer, 1 al llegar. */
  progress: number;
}

/**
 * Forma de una hebra a los `ageMs`: avanza parejo hacia el filo y se acorta en proporción a lo que le falta.
 * (Acelerando pasaba casi toda su vida lejos y se leía como una raya suelta, no como luz que llega.)
 */
export function strandShape(ageMs: number, cfg: StrandConfig, out: StrandShape): StrandShape {
  const p = clamp01(ageMs / Math.max(1, cfg.travelMs));
  const left = 1 - p;
  out.head = cfg.fromDistance * left;
  out.length = cfg.length * left;
  out.progress = p;
  return out;
}

/**
 * Estado de la carga para dibujarla: `charging` echa hebras; `ready` (carga completa) las corta de golpe,
 * y `justReady` vale true solo en el paso en que se completó (el destello).
 */
export class ChargeFxMotor {
  readonly strands: Strand[];
  phase: ChargeFxPhase = 'off';
  justReady = false;
  private untilNextMs = 0;

  constructor(
    private readonly cfg: StrandConfig,
    private readonly rng: () => number = Math.random,
  ) {
    this.strands = Array.from({ length: cfg.max }, () => ({ active: false, ageMs: 0, angle: 0, along: 0 }));
  }

  /** `fraction` es `PlayerMotor.chargeFraction`: 0 sin carga, 1 lista para soltar. */
  step(dtMs: number, fraction: number): void {
    this.justReady = false;
    if (fraction <= 0) {
      if (this.phase !== 'off') this.reset();
      return;
    }
    if (fraction >= 1) {
      if (this.phase !== 'ready') {
        this.phase = 'ready';
        this.justReady = true;
        this.clearStrands();
      }
      return;
    }
    if (this.phase !== 'charging') {
      this.phase = 'charging';
      this.untilNextMs = 0;
    }
    for (const s of this.strands) {
      if (!s.active) continue;
      s.ageMs += dtMs;
      if (s.ageMs >= this.cfg.travelMs) s.active = false;
    }
    this.untilNextMs -= dtMs;
    while (this.untilNextMs <= 0) {
      this.spawn();
      this.untilNextMs += strandEveryMs(fraction, this.cfg);
    }
  }

  get activeCount(): number {
    let n = 0;
    for (const s of this.strands) if (s.active) n++;
    return n;
  }

  reset(): void {
    this.phase = 'off';
    this.justReady = false;
    this.clearStrands();
  }

  private clearStrands(): void {
    for (const s of this.strands) s.active = false;
  }

  /** Si el pool está lleno no nace (no se roba una hebra a medio camino). */
  private spawn(): void {
    const s = this.strands.find((st) => !st.active);
    if (!s) return;
    const { arcFromDeg, arcToDeg, bladeFrom } = this.cfg;
    s.active = true;
    s.ageMs = 0;
    s.angle = ((arcFromDeg + (arcToDeg - arcFromDeg) * this.rng()) * Math.PI) / 180;
    s.along = bladeFrom + (1 - bladeFrom) * this.rng();
  }
}

// ── El sable en el dibujo de Kerana ────────────────────────────────────────

/** Qué píxel es del sable: dorado saturado o su brillo claro, nunca la piel ni el vestido crema. */
export interface BladeColorRule {
  minAlpha: number;
  minRed: number;
  /** Dorado: casi sin azul y con verde. */
  goldMaxBlue: number;
  goldMinGreen: number;
  /** Brillo: verde alto y bastante más rojo que azul (el crema del vestido no llega). */
  shineMinGreen: number;
  shineMinRedOverBlue: number;
  /** Menos píxeles que esto en la mancha más grande: el cuadro no tiene sable. */
  minPixels: number;
}

export function isBladePixel(r: number, g: number, b: number, a: number, rule: BladeColorRule): boolean {
  if (a < rule.minAlpha || r < rule.minRed) return false;
  return (b <= rule.goldMaxBlue && g >= rule.goldMinGreen) || (g >= rule.shineMinGreen && r - b >= rule.shineMinRedOverBlue);
}

export interface BladeShape {
  /** 1 en los píxeles del sable (la mancha dorada más grande del cuadro), fila por fila. */
  mask: Uint8Array;
  /** Línea del filo del mango a la punta: `samples` pares x, y en píxeles del cuadro. */
  line: Float32Array;
}

/**
 * Busca el sable en un cuadro (x0, y0, w, h) de una imagen RGBA de ancho `stride`.
 * La punta es el píxel del sable más lejos de `pivot` (el pecho); el mango, el más lejos de la punta.
 * La línea sigue la curva: cada muestra es el promedio de los píxeles a esa altura del largo.
 */
export function findBlade(
  data: ArrayLike<number>,
  stride: number,
  x0: number,
  y0: number,
  w: number,
  h: number,
  rule: BladeColorRule,
  pivotX: number,
  pivotY: number,
  samples: number,
): BladeShape | null {
  const n = w * h;
  const cand = new Uint8Array(n);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = ((y0 + y) * stride + x0 + x) * 4;
      if (isBladePixel(data[i], data[i + 1], data[i + 2], data[i + 3], rule)) cand[y * w + x] = 1;
    }
  }
  // Manchas con vecinos en 8 direcciones; queda la más grande.
  const label = new Int32Array(n);
  const stack = new Int32Array(n);
  let best = 0;
  let bestSize = 0;
  let next = 0;
  for (let start = 0; start < n; start++) {
    if (!cand[start] || label[start]) continue;
    const id = ++next;
    let size = 0;
    let top = 0;
    stack[top++] = start;
    label[start] = id;
    while (top > 0) {
      const p = stack[--top];
      size++;
      const px = p % w;
      const py = (p - px) / w;
      for (let dy = -1; dy <= 1; dy++) {
        const ny = py + dy;
        if (ny < 0 || ny >= h) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const nx = px + dx;
          if (nx < 0 || nx >= w) continue;
          const q = ny * w + nx;
          if (cand[q] && !label[q]) {
            label[q] = id;
            stack[top++] = q;
          }
        }
      }
    }
    if (size > bestSize) {
      bestSize = size;
      best = id;
    }
  }
  if (bestSize < rule.minPixels || samples < 2) return null;
  const mask = new Uint8Array(n);
  let tipX = 0;
  let tipY = 0;
  let far = -1;
  for (let p = 0; p < n; p++) {
    if (label[p] !== best) continue;
    mask[p] = 1;
    const x = (p % w) + 0.5;
    const y = Math.floor(p / w) + 0.5;
    const d = (x - pivotX) ** 2 + (y - pivotY) ** 2;
    if (d > far) {
      far = d;
      tipX = x;
      tipY = y;
    }
  }
  let baseX = tipX;
  let baseY = tipY;
  far = -1;
  for (let p = 0; p < n; p++) {
    if (!mask[p]) continue;
    const x = (p % w) + 0.5;
    const y = Math.floor(p / w) + 0.5;
    const d = (x - tipX) ** 2 + (y - tipY) ** 2;
    if (d > far) {
      far = d;
      baseX = x;
      baseY = y;
    }
  }
  const ax = tipX - baseX;
  const ay = tipY - baseY;
  const len2 = Math.max(1e-6, ax * ax + ay * ay);
  const sumX = new Float64Array(samples);
  const sumY = new Float64Array(samples);
  const count = new Uint32Array(samples);
  for (let p = 0; p < n; p++) {
    if (!mask[p]) continue;
    const x = (p % w) + 0.5;
    const y = Math.floor(p / w) + 0.5;
    const t = Math.min(1, Math.max(0, ((x - baseX) * ax + (y - baseY) * ay) / len2));
    const k = Math.round(t * (samples - 1));
    sumX[k] += x;
    sumY[k] += y;
    count[k]++;
  }
  const line = new Float32Array(samples * 2);
  for (let k = 0; k < samples; k++) {
    const t = k / (samples - 1);
    const inner = k > 0 && k < samples - 1 && count[k] > 0;
    line[k * 2] = inner ? sumX[k] / count[k] : baseX + ax * t;
    line[k * 2 + 1] = inner ? sumY[k] / count[k] : baseY + ay * t;
  }
  return { mask, line };
}

/** Punto de la línea del filo en `along` (0 = mango, 1 = punta), interpolando entre muestras. */
export function pointOnLine(line: ArrayLike<number>, along: number, out: { x: number; y: number }): { x: number; y: number } {
  const samples = line.length / 2;
  const f = clamp01(along) * (samples - 1);
  const k = Math.min(samples - 2, Math.floor(f));
  const t = f - k;
  out.x = line[k * 2] + (line[k * 2 + 2] - line[k * 2]) * t;
  out.y = line[k * 2 + 1] + (line[k * 2 + 3] - line[k * 2 + 1]) * t;
  return out;
}
