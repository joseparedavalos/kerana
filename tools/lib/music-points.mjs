// Puntos del bucle de una pista en archivo (S119), sobre las muestras mono ya decodificadas. Lógica pura: el test la
// prueba con una señal sintética; tools/music-points.mjs la corre sobre cada MP3 de public/assets/audio/music/.
//   start      dónde empieza a sonar (sin el silencio del principio)
//   fadeStart  dónde empieza el fundido final: el último momento en que la pista suena a su nivel de siempre (el de los
//              segundos anteriores); después solo se apaga
//   end        dónde deja de sonar (lo que sigue es el silencio del final)

export const POINTS = {
  /** Bloques (s) para buscar el primer y el último sonido. */
  blockSec: 0.01,
  /** El sonido empieza en el primer bloque que llega a esto por debajo de la mediana de la pista (dB). */
  startBelowDb: 30,
  /** Se arranca un poco antes del primer bloque, para no comerse el ataque (s). */
  preRollSec: 0.02,
  /** Después del último bloque con un pico por encima de esto (dBFS) solo hay silencio. */
  endFloorDb: -50,
  /** Envolvente para el fundido: ventana (s) centrada y paso (s). Una ventana de 1 s alisa el pulso de la música. */
  envWindowSec: 1,
  envHopSec: 0.05,
  /** El nivel de siempre en un momento: la mediana de la envolvente en los segundos anteriores (s). */
  refSec: 10,
  /** Sigue sonando a su nivel mientras no baje más que esto de esa mediana (dB). */
  fadeTolDb: 1.5,
};

const db = (x) => (x > 0 ? 20 * Math.log10(x) : -200);

/** Envolvente en dB: RMS de una ventana centrada cada `hop` muestras (sumas acumuladas, una pasada). */
export function envelope(samples, rate, windowSec, hopSec) {
  const n = samples.length;
  const cum = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) cum[i + 1] = cum[i] + samples[i] * samples[i];
  const half = Math.round((rate * windowSec) / 2);
  const hop = Math.max(1, Math.round(rate * hopSec));
  const out = [];
  for (let c = 0; c < n; c += hop) {
    const a = Math.max(0, c - half);
    const b = Math.min(n, c + half);
    out.push(db(Math.sqrt((cum[b] - cum[a]) / Math.max(1, b - a))));
  }
  return { db: out, hop: hop / rate };
}

function blockLevel(samples, from, to) {
  let e = 0;
  let p = 0;
  for (let i = from; i < to; i++) {
    const v = samples[i];
    e += v * v;
    const a = Math.abs(v);
    if (a > p) p = a;
  }
  return { rms: db(Math.sqrt(e / Math.max(1, to - from))), peak: db(p) };
}

/** Los tres puntos de una pista, en segundos (redondeados al ms). */
export function musicPoints(samples, rate, opts = POINTS) {
  const n = samples.length;
  const duration = n / rate;
  const env = envelope(samples, rate, opts.envWindowSec, opts.envHopSec);
  const sorted = [...env.db].filter((v) => v > -120).sort((a, b) => a - b);
  const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : -200;
  const blk = Math.max(1, Math.round(rate * opts.blockSec));

  let first = 0;
  for (let i = 0; i < n; i += blk) {
    if (blockLevel(samples, i, Math.min(n, i + blk)).rms >= median - opts.startBelowDb) {
      first = i;
      break;
    }
  }
  let last = n;
  for (let i = Math.floor((n - 1) / blk) * blk; i >= 0; i -= blk) {
    if (blockLevel(samples, i, Math.min(n, i + blk)).peak > opts.endFloorDb) {
      last = Math.min(n, i + blk);
      break;
    }
  }
  const start = Math.max(0, first / rate - opts.preRollSec);
  const end = last / rate;

  // Hacia atrás desde la última ventana entera antes del final: el primer momento que suena a su nivel de siempre
  // (no más de `fadeTolDb` por debajo de la mediana de los `refSec` anteriores) es donde empieza el fundido. Contra lo
  // anterior y no contra toda la pista: una pista con partes suaves (l7, Tau) no corta su último tramo.
  const refN = Math.max(1, Math.round(opts.refSec / env.hop));
  const floor = Math.ceil((start + opts.refSec) / env.hop);
  let i = Math.min(env.db.length - 1, Math.floor((end - opts.envWindowSec / 2) / env.hop));
  for (; i > floor; i--) {
    const ref = env.db.slice(i - refN, i).sort((a, b) => a - b)[refN >> 1];
    if (env.db[i] >= ref - opts.fadeTolDb) break;
  }
  const fadeStart = i * env.hop;
  const ms = (x) => Math.round(x * 1000) / 1000;
  return { start: ms(start), fadeStart: ms(fadeStart), end: ms(end), duration: ms(duration), median };
}
