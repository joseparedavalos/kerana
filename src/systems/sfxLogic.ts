// Lógica pura de los efectos grabados (S106): la sonoridad con que se igualan a los ZzFX, el recorte del silencio,
// la variante al azar sin repetir y cuándo pisa Kerana. La usan el juego, `tools/sfx.mjs` y las pruebas.
// Sin imports: `tools/sfx.mjs` la carga directo con Node.

/** Ventana (s) con que se mide la sonoridad: la más fuerte del efecto, como el «momentáneo» de un medidor LUFS. */
export const LOUDNESS_WINDOW_SEC = 0.3;
/** Piso de silencio (dBFS) para el recorte del principio y del final. */
export const SILENCE_DB = -50;
/** Lo que se deja antes del primer sonido al recortar (s): que el ataque no pierda el primer filo. */
export const PRE_ROLL_SEC = 0.002;

type Biquad = { b0: number; b1: number; b2: number; a1: number; a2: number };

/** Los dos filtros de la ponderación K (ITU-R BS.1770), calculados para cualquier frecuencia de muestreo. */
function kWeightFilters(rate: number): [Biquad, Biquad] {
  // Estante agudo (+4 dB arriba de ~1,7 kHz): la cabeza.
  let K = Math.tan((Math.PI * 1681.974450955533) / rate);
  const Vh = 10 ** (3.999843853973347 / 20);
  const Vb = Vh ** 0.4996667741545416;
  let Q = 0.7071752369554196;
  let a0 = 1 + K / Q + K * K;
  const shelf: Biquad = {
    b0: (Vh + (Vb * K) / Q + K * K) / a0,
    b1: (2 * (K * K - Vh)) / a0,
    b2: (Vh - (Vb * K) / Q + K * K) / a0,
    a1: (2 * (K * K - 1)) / a0,
    a2: (1 - K / Q + K * K) / a0,
  };
  // Pasa altos (~38 Hz): lo muy grave casi no se oye fuerte.
  K = Math.tan((Math.PI * 38.13547087602444) / rate);
  Q = 0.5003270373238773;
  a0 = 1 + K / Q + K * K;
  const highPass: Biquad = { b0: 1, b1: -2, b2: 1, a1: (2 * (K * K - 1)) / a0, a2: (1 - K / Q + K * K) / a0 };
  return [shelf, highPass];
}

function runBiquad(x: ArrayLike<number>, f: Biquad): Float64Array {
  const y = new Float64Array(x.length);
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const v = x[i];
    const out = f.b0 * v + f.b1 * x1 + f.b2 * x2 - f.a1 * y1 - f.a2 * y2;
    x2 = x1;
    x1 = v;
    y2 = y1;
    y1 = out;
    y[i] = out;
  }
  return y;
}

/**
 * Sonoridad percibida (LUFS) de un efecto corto: la ventana de `LOUDNESS_WINDOW_SEC` más fuerte de la señal ponderada K.
 * Un efecto más corto que la ventana cuenta como si el resto fuera silencio (el oído suma unos 200 a 300 ms).
 * Devuelve -Infinity si es silencio.
 */
export function loudness(samples: ArrayLike<number>, rate: number, windowSec = LOUDNESS_WINDOW_SEC): number {
  const [shelf, highPass] = kWeightFilters(rate);
  const w = runBiquad(runBiquad(samples, shelf), highPass);
  const win = Math.max(1, Math.round(windowSec * rate));
  const hop = Math.max(1, Math.round(rate * 0.005));
  // Suma acumulada de cuadrados para deslizar la ventana sin repetir cuentas.
  const acc = new Float64Array(w.length + 1);
  for (let i = 0; i < w.length; i++) acc[i + 1] = acc[i] + w[i] * w[i];
  let best = 0;
  for (let start = 0; start === 0 || start + win <= w.length; start += hop) {
    const end = Math.min(w.length, start + win);
    best = Math.max(best, acc[end] - acc[start]);
    if (end === w.length) break;
  }
  const meanSquare = best / win;
  return meanSquare > 0 ? -0.691 + 10 * Math.log10(meanSquare) : -Infinity;
}

/** Ganancia (lineal) que lleva una señal de `fromLufs` a `toLufs`. */
export function gainFor(fromLufs: number, toLufs: number): number {
  return Number.isFinite(fromLufs) && Number.isFinite(toLufs) ? 10 ** ((toLufs - fromLufs) / 20) : 1;
}

/**
 * Dónde empieza y termina el sonido: el primer y el último valor que pasan `SILENCE_DB`, con `PRE_ROLL_SEC` antes.
 * `[0, 0]` si todo es silencio.
 */
export function soundSpan(samples: ArrayLike<number>, rate: number, floorDb = SILENCE_DB): [number, number] {
  const floor = 10 ** (floorDb / 20);
  let first = -1;
  let last = -1;
  for (let i = 0; i < samples.length; i++) {
    if (Math.abs(samples[i]) < floor) continue;
    if (first < 0) first = i;
    last = i;
  }
  if (first < 0) return [0, 0];
  return [Math.max(0, first - Math.round(PRE_ROLL_SEC * rate)), last + 1];
}

/** Una variante al azar entre `count`, distinta de la anterior cuando hay más de una. `rand` en [0, 1). */
export function pickVariant(count: number, previous: number, rand: number): number {
  if (count <= 1) return 0;
  if (previous < 0 || previous >= count) return Math.min(count - 1, Math.floor(rand * count));
  // Se elige entre las otras `count - 1` y se salta la anterior.
  const i = Math.min(count - 2, Math.floor(rand * (count - 1)));
  return i >= previous ? i + 1 : i;
}

/** Un valor al azar en [base - spread, base + spread]. `rand` en [0, 1). */
export function jitter(base: number, spread: number, rand: number): number {
  return base + (rand * 2 - 1) * spread;
}

/**
 * Pasos (S106): el cuadro de la animación de correr en que apoya un pie. `contacts` son los cuadros (índices dentro de la
 * animación) en que un pie toca el suelo. Devuelve el contacto en que se acaba de entrar al pasar de `prevFrame` a
 * `frame`, o -1 si no se pisó (el mismo cuadro, o un cuadro sin contacto).
 */
export function stepContact(prevFrame: number, frame: number, contacts: readonly number[]): number {
  if (frame === prevFrame) return -1;
  return contacts.includes(frame) ? frame : -1;
}
