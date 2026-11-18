// Columna del cuerpo de Moñái para el dibujo (S102): lógica pura, sin Phaser. De los puntos de control (la nuca bajo la
// cabeza, los segmentos de la cuerda y la punta de la cola) sale una curva suave remuestreada a igual distancia; sobre
// ella se escriben los vértices de la tira (monaiBody.ts). Nada de esto mueve los segmentos de la pelea.

/** Curva remuestreada: posición, distancia desde la nuca, tangente, normal y de qué punto de control sale cada punto. */
export class Spine {
  readonly x: Float32Array;
  readonly y: Float32Array;
  readonly s: Float32Array;
  readonly tx: Float32Array;
  readonly ty: Float32Array;
  readonly nx: Float32Array;
  readonly ny: Float32Array;
  /** Curvatura con signo (> 0: la curva dobla hacia +normal), 1/unidades. */
  readonly k: Float32Array;
  /** Posición en los puntos de control (índice + fracción). */
  readonly c: Float32Array;
  length = 0;
  /** Hay curva (al menos dos puntos de control separados). */
  ok = false;
  private readonly dx: Float32Array;
  private readonly dy: Float32Array;
  private readonly ds: Float32Array;
  private readonly dc: Float32Array;
  private readonly px: Float32Array;
  private readonly py: Float32Array;
  private readonly pc: Float32Array;

  constructor(
    readonly n: number,
    maxControls: number,
    private readonly sub = 6,
  ) {
    this.x = new Float32Array(n);
    this.y = new Float32Array(n);
    this.s = new Float32Array(n);
    this.tx = new Float32Array(n);
    this.ty = new Float32Array(n);
    this.nx = new Float32Array(n);
    this.ny = new Float32Array(n);
    this.k = new Float32Array(n);
    this.c = new Float32Array(n);
    const dense = (maxControls - 1) * sub + 1;
    this.dx = new Float32Array(dense);
    this.dy = new Float32Array(dense);
    this.ds = new Float32Array(dense);
    this.dc = new Float32Array(dense);
    this.px = new Float32Array(maxControls);
    this.py = new Float32Array(maxControls);
    this.pc = new Float32Array(maxControls);
  }

  /**
   * Catmull-Rom centrípeta por los `count` puntos de control (no se pasa de largo en las vueltas cerradas) y remuestreo a
   * `n` puntos a igual distancia. Los puntos casi repetidos se saltean (al reiniciar, todos los segmentos coinciden).
   */
  build(cx: ArrayLike<number>, cy: ArrayLike<number>, count: number): void {
    let m = 0;
    for (let i = 0; i < count; i++) {
      if (m > 0 && Math.hypot(cx[i] - this.px[m - 1], cy[i] - this.py[m - 1]) < 0.05) continue;
      this.px[m] = cx[i];
      this.py[m] = cy[i];
      this.pc[m] = i;
      m++;
    }
    this.ok = m >= 2;
    if (!this.ok) {
      this.length = 0;
      for (let i = 0; i < this.n; i++) {
        this.x[i] = cx[0];
        this.y[i] = cy[0];
        this.s[i] = 0;
        this.tx[i] = 1;
        this.ty[i] = 0;
        this.nx[i] = 0;
        this.ny[i] = 1;
        this.k[i] = 0;
        this.c[i] = 0;
      }
      return;
    }
    // Curva densa.
    let d = 0;
    const sub = this.sub;
    for (let i = 0; i < m - 1; i++) {
      const i0 = Math.max(0, i - 1);
      const i3 = Math.min(m - 1, i + 2);
      // Extremos: punto fantasma reflejado para que la tangente siga al tramo.
      const x0 = i0 === i ? 2 * this.px[i] - this.px[i + 1] : this.px[i0];
      const y0 = i0 === i ? 2 * this.py[i] - this.py[i + 1] : this.py[i0];
      const x3 = i3 === i + 1 ? 2 * this.px[i + 1] - this.px[i] : this.px[i3];
      const y3 = i3 === i + 1 ? 2 * this.py[i + 1] - this.py[i] : this.py[i3];
      const x1 = this.px[i];
      const y1 = this.py[i];
      const x2 = this.px[i + 1];
      const y2 = this.py[i + 1];
      const t1 = Math.sqrt(Math.max(1e-4, Math.hypot(x1 - x0, y1 - y0)));
      const t2 = t1 + Math.sqrt(Math.max(1e-4, Math.hypot(x2 - x1, y2 - y1)));
      const t3 = t2 + Math.sqrt(Math.max(1e-4, Math.hypot(x3 - x2, y3 - y2)));
      for (let j = i === 0 ? 0 : 1; j <= sub; j++) {
        const t = t1 + ((t2 - t1) * j) / sub;
        const a1x = ((t1 - t) * x0 + t * x1) / t1;
        const a1y = ((t1 - t) * y0 + t * y1) / t1;
        const a2x = ((t2 - t) * x1 + (t - t1) * x2) / (t2 - t1);
        const a2y = ((t2 - t) * y1 + (t - t1) * y2) / (t2 - t1);
        const a3x = ((t3 - t) * x2 + (t - t2) * x3) / (t3 - t2);
        const a3y = ((t3 - t) * y2 + (t - t2) * y3) / (t3 - t2);
        const b1x = ((t2 - t) * a1x + t * a2x) / t2;
        const b1y = ((t2 - t) * a1y + t * a2y) / t2;
        const b2x = ((t3 - t) * a2x + (t - t1) * a3x) / (t3 - t1);
        const b2y = ((t3 - t) * a2y + (t - t1) * a3y) / (t3 - t1);
        this.dx[d] = ((t2 - t) * b1x + (t - t1) * b2x) / (t2 - t1);
        this.dy[d] = ((t2 - t) * b1y + (t - t1) * b2y) / (t2 - t1);
        this.dc[d] = this.pc[i] + ((this.pc[i + 1] - this.pc[i]) * j) / sub;
        this.ds[d] = d === 0 ? 0 : this.ds[d - 1] + Math.hypot(this.dx[d] - this.dx[d - 1], this.dy[d] - this.dy[d - 1]);
        d++;
      }
    }
    this.length = this.ds[d - 1];
    // Remuestreo a igual distancia.
    let j = 0;
    for (let i = 0; i < this.n; i++) {
      const target = (this.length * i) / (this.n - 1);
      while (j < d - 2 && this.ds[j + 1] < target) j++;
      const seg = this.ds[j + 1] - this.ds[j];
      const f = seg > 1e-6 ? Math.min(1, Math.max(0, (target - this.ds[j]) / seg)) : 0;
      this.x[i] = this.dx[j] + (this.dx[j + 1] - this.dx[j]) * f;
      this.y[i] = this.dy[j] + (this.dy[j + 1] - this.dy[j]) * f;
      this.c[i] = this.dc[j] + (this.dc[j + 1] - this.dc[j]) * f;
      this.s[i] = target;
    }
    this.frame();
  }

  /** Desplaza cada punto a lo largo de su normal (`off[i]` unidades) y recalcula tangentes y normales. */
  offset(off: ArrayLike<number>): void {
    for (let i = 0; i < this.n; i++) {
      this.x[i] += this.nx[i] * off[i];
      this.y[i] += this.ny[i] * off[i];
    }
    this.frame();
  }

  /** Tangentes (diferencias centradas), normales (la tangente girada 90°) y curvatura. */
  private frame(): void {
    const n = this.n;
    for (let i = 0; i < n; i++) {
      const a = Math.max(0, i - 1);
      const b = Math.min(n - 1, i + 1);
      let tx = this.x[b] - this.x[a];
      let ty = this.y[b] - this.y[a];
      const l = Math.hypot(tx, ty);
      if (l < 1e-6) {
        tx = i > 0 ? this.tx[i - 1] : 1;
        ty = i > 0 ? this.ty[i - 1] : 0;
      } else {
        tx /= l;
        ty /= l;
      }
      this.tx[i] = tx;
      this.ty[i] = ty;
      this.nx[i] = -ty;
      this.ny[i] = tx;
    }
    const step = n > 1 ? this.length / (n - 1) : 1;
    for (let i = 0; i < n; i++) {
      const a = Math.max(0, i - 1);
      const b = Math.min(n - 1, i + 1);
      const cross = this.tx[a] * this.ty[b] - this.ty[a] * this.tx[b];
      const dot = this.tx[a] * this.tx[b] + this.ty[a] * this.ty[b];
      // Con la normal (-ty, tx), girar hacia +normal es cruz positiva.
      this.k[i] = step > 1e-6 ? Math.atan2(cross, dot) / ((b - a) * step) : 0;
    }
  }
}

/**
 * Lado del lomo en cada punto (+1: hacia +normal; -1: hacia -normal). Empieza con el de la nuca y se da vuelta solo
 * cuando el lomo apuntaría hacia abajo más que `threshold` (0..1): las vueltas muestran el vientre abajo.
 */
export function dorsalSides(ny: ArrayLike<number>, n: number, startSide: number, threshold: number, out: Int8Array): void {
  let side = startSide >= 0 ? 1 : -1;
  for (let i = 0; i < n; i++) {
    // "Arriba" es y negativa: el lomo (side · normal) mira hacia arriba si side · ny < 0.
    const up = -side * ny[i];
    if (up < -threshold) side = -side;
    out[i] = side;
  }
}

/** Medio grosor del lado de adentro de una curva: no más que `limit` veces su radio (para que la tira no se doble). */
export function innerHalf(half: number, curvature: number, limit: number, min = 1): number {
  const k = Math.abs(curvature);
  if (k < 1e-6) return half;
  return Math.min(half, Math.max(min, limit / k));
}
