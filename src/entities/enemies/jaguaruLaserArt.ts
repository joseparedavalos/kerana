// Dibujo del rayo del Jaguarú (S117), lógica pura: las texturas como píxeles RGBA (se generan una vez por partida).
// Sin Phaser: lo prueba tests/jaguaruLaser.test.ts.
//
// Todo en la rampa medida de los ojos del sprite (raw/jaguaru, cuadros 1 a 5 de `attack`, alrededor de cada ojo), del
// violeta hondo al rosado claro, más el núcleo blanco caliente. A `detail` píxeles por unidad, como Kerana y los
// enemigos: el rayo es pixel art, con bandas de color (sin degradés suaves) y bordes que cambian de variante a variante.

import type { RgbaImage } from '../waterfallArt';

/** Lo que el dibujo necesita de GAMEPLAY.jaguaru.laser.art. */
export interface LaserArtConfig {
  /** Ocho colores 0xRRGGBB: siete de la rampa de los ojos (de hondo a claro) y el núcleo. */
  ramp: readonly number[];
  /** El rayo: largo de la textura que se repite (px de textura) y su alto (impar: la fila del centro es el núcleo). */
  beamLength: number;
  beamHeight: number;
  /** Probabilidad de cada fila de afuera (de adentro hacia afuera) por columna: el borde que vibra. */
  edgeChance: readonly number[];
  /** Vetas que corren por el cuerpo: cuántas por textura y su largo (px de textura). */
  streaks: number;
  streakLength: readonly [number, number];
  /** El halo (aditivo): alto (px de textura) y opacidad máxima del centro. */
  haloHeight: number;
  haloAlpha: number;
  /** La mira: largo del dibujo que se repite y del pulso claro (px de textura). */
  aimLength: number;
  aimPulse: number;
  /** El brillo de un ojo: radio (px de textura). */
  glowRadius: number;
  /** El destello (estrella de cuatro puntas): radio de las puntas y del disco (px de textura). */
  flashRadius: number;
  flashCore: number;
  /** El anillo del estallido: radio y grosor (px de textura). */
  ringRadius: number;
  ringWidth: number;
  /** El humo: radio (px de textura), el color del borde y el del centro, y la opacidad del centro. */
  smokeRadius: number;
  smokeColor: number;
  smokeCore: number;
  smokeAlpha: number;
}

const rgb = (c: number): [number, number, number] => [(c >> 16) & 0xff, (c >> 8) & 0xff, c & 0xff];

/** Azar fijo (mulberry32): el mismo dibujo en cada partida. */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function blank(width: number, height: number): RgbaImage {
  return { width, height, data: new Uint8ClampedArray(width * height * 4) };
}

function put(img: RgbaImage, x: number, y: number, color: number, alpha = 1): void {
  if (x < 0 || y < 0 || x >= img.width || y >= img.height) return;
  const i = (y * img.width + x) * 4;
  const [r, g, b] = rgb(color);
  img.data[i] = r;
  img.data[i + 1] = g;
  img.data[i + 2] = b;
  img.data[i + 3] = Math.round(Math.max(0, Math.min(1, alpha)) * 255);
}

/** Opacidad en bandas (pixel art: cuatro escalones, sin degradé). */
const band = (a: number, steps = 4): number => Math.ceil(Math.max(0, Math.min(1, a)) * steps) / steps;

/**
 * El cuerpo del rayo (una variante; se repite a lo largo). La fila del centro y las dos de al lado, el núcleo blanco;
 * hacia afuera, la rampa de claro a hondo; las filas de afuera aparecen o no en cada columna (el borde que vibra al
 * cambiar de variante). Vetas claras que corren por el cuerpo. Sin costura a lo largo.
 */
export function paintBeam(cfg: LaserArtConfig, variant: number): RgbaImage {
  const W = cfg.beamLength;
  const H = cfg.beamHeight | 1;
  const img = blank(W, H);
  const mid = (H - 1) / 2;
  const R = cfg.ramp;
  const rand = seeded(1170 + variant * 37);
  // Del centro hacia afuera: núcleo, núcleo, claro, rosado, magenta, violeta… (la rampa de los ojos al revés).
  const profile = [R[7], R[7], R[6], R[5], R[4], R[3], R[2], R[1]];
  const solid = profile.length - cfg.edgeChance.length;
  for (let x = 0; x < W; x++) {
    // Cuánto llega el borde en esta columna, de cada lado por separado (no es un tubo parejo).
    for (const side of [-1, 1]) {
      let reach = solid - 1;
      for (let k = 0; k < cfg.edgeChance.length; k++) {
        if (rand() < cfg.edgeChance[k]) reach = solid + k;
        else break;
      }
      for (let d = side < 0 ? 1 : 0; d <= Math.min(reach, mid); d++) {
        const outer = d >= solid;
        put(img, x, mid + side * d, profile[Math.min(d, profile.length - 1)], outer ? (d === reach ? 0.7 : 0.9) : 1);
      }
    }
  }
  // Vetas: un tono más claro en el cuerpo (las filas 2 a 4 desde el centro), a lo largo, cruzando la costura.
  for (let s = 0; s < cfg.streaks; s++) {
    const d = 2 + Math.floor(rand() * 3);
    const side = rand() < 0.5 ? -1 : 1;
    const len = cfg.streakLength[0] + Math.floor(rand() * (cfg.streakLength[1] - cfg.streakLength[0] + 1));
    const x0 = Math.floor(rand() * W);
    const color = profile[Math.max(1, d - 1)];
    for (let i = 0; i < len; i++) put(img, (x0 + i) % W, mid + side * d, color, 1);
  }
  // Unos píxeles del núcleo apenas rosados: el blanco no es plano.
  for (let x = 0; x < W; x++) if (rand() < 0.12) put(img, x, mid + (rand() < 0.5 ? -1 : 1), R[6], 1);
  return img;
}

/** El halo aditivo del rayo: bandas del magenta de la rampa que se apagan hacia afuera, parejo a lo largo. */
export function paintHalo(cfg: LaserArtConfig): RgbaImage {
  const W = 8;
  const H = cfg.haloHeight | 1;
  const img = blank(W, H);
  const mid = (H - 1) / 2;
  for (let y = 0; y < H; y++) {
    const t = Math.abs(y - mid) / (mid + 1);
    const a = band(cfg.haloAlpha * (1 - t) ** 1.6);
    const color = t < 0.35 ? cfg.ramp[5] : t < 0.7 ? cfg.ramp[4] : cfg.ramp[3];
    for (let x = 0; x < W; x++) put(img, x, y, color, a);
  }
  return img;
}

/** La mira: una línea de un píxel en el magenta de la rampa con un pulso claro que corre hacia la mira. */
export function paintAim(cfg: LaserArtConfig): RgbaImage {
  const W = cfg.aimLength;
  const img = blank(W, 1);
  for (let x = 0; x < W; x++) {
    const pulse = x >= W - cfg.aimPulse;
    put(img, x, 0, pulse ? (x === W - 1 ? cfg.ramp[7] : cfg.ramp[6]) : x % 4 === 3 ? cfg.ramp[3] : cfg.ramp[4], pulse ? 1 : 0.8);
  }
  return img;
}

/** El brillo de un ojo: anillos de la rampa (de blanco al centro a violeta hondo afuera), en bandas. */
export function paintGlow(cfg: LaserArtConfig): RgbaImage {
  const r = cfg.glowRadius;
  const S = r * 2 + 1;
  const img = blank(S, S);
  const R = cfg.ramp;
  const rings = [R[7], R[6], R[5], R[4], R[3], R[2]];
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const d = Math.hypot(x - r, y - r) / (r + 0.5);
      if (d > 1) continue;
      const k = Math.min(rings.length - 1, Math.floor(d * rings.length));
      put(img, x, y, rings[k], band(1 - d * 0.85));
    }
  }
  return img;
}

/** El destello: una estrella de cuatro puntas (de núcleo blanco a rosado) sobre un disco chico. */
export function paintFlash(cfg: LaserArtConfig): RgbaImage {
  const r = cfg.flashRadius;
  const S = r * 2 + 1;
  const img = blank(S, S);
  const R = cfg.ramp;
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const dx = Math.abs(x - r);
      const dy = Math.abs(y - r);
      const d = Math.hypot(dx, dy);
      // Puntas: en los ejes, se afinan hacia afuera; en diagonal, más cortas.
      const axis = Math.min(dx, dy) <= Math.max(0, 1 - Math.max(dx, dy) / r) * 1.5 && Math.max(dx, dy) <= r;
      const diag = Math.abs(dx - dy) <= 0.5 && d <= r * 0.45;
      if (d <= cfg.flashCore) put(img, x, y, d <= cfg.flashCore * 0.5 ? R[7] : R[6], 1);
      else if (axis) put(img, x, y, Math.max(dx, dy) < r * 0.5 ? R[6] : R[5], band(1 - Math.max(dx, dy) / (r + 1)));
      else if (diag) put(img, x, y, R[5], 0.75);
      else if (d <= cfg.flashCore + 2) put(img, x, y, R[4], 0.5);
    }
  }
  return img;
}

/** El anillo del estallido: un aro de la rampa, claro adentro y magenta afuera. */
export function paintRing(cfg: LaserArtConfig): RgbaImage {
  const r = cfg.ringRadius;
  const S = r * 2 + 1;
  const img = blank(S, S);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const d = Math.hypot(x - r, y - r);
      const t = r - d;
      if (t < 0 || t >= cfg.ringWidth) continue;
      put(img, x, y, t < 1 ? cfg.ramp[4] : t < cfg.ringWidth - 1 ? cfg.ramp[6] : cfg.ramp[5], 1);
    }
  }
  return img;
}

/**
 * Una bocanada de humo: un disco de borde irregular en bandas de opacidad (no un círculo lleno), con el borde oscuro y
 * el centro claro, así se lee sobre la roca clara y sobre el cielo de tormenta.
 */
export function paintSmoke(cfg: LaserArtConfig): RgbaImage {
  const r = cfg.smokeRadius;
  const S = r * 2 + 1;
  const img = blank(S, S);
  const rand = seeded(1171);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      // El centro, un poco arriba a la izquierda: la luz de arriba.
      const d = Math.hypot(x - r, y - r) / (r + 0.5) + (rand() - 0.5) * 0.25;
      if (d > 1) continue;
      const core = Math.hypot(x - r + 1, y - r + 1) / (r + 0.5) < 0.55;
      put(img, x, y, core ? cfg.smokeCore : cfg.smokeColor, band(cfg.smokeAlpha * (1 - d * 0.7), 3));
    }
  }
  return img;
}

/** Una chispa: un cuadradito blanco (se tiñe con la rampa). */
export function paintSpark(size: number): RgbaImage {
  const img = blank(size, size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) put(img, x, y, 0xffffff, 1);
  return img;
}
