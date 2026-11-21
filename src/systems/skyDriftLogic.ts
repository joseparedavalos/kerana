// El cielo vivo de Yvága (S118): capas de nubes que se deslizan delante del fondo a distintas velocidades de parallax
// mientras se sube, y alguna estrella fugaz en la noche de arriba. Lógica pura: dónde va cada nube de cada capa según la
// cámara y el tiempo, de qué altura es (el color y cuántas hay), y cuándo y por dónde pasa cada estrella fugaz.
// Todo sale de una semilla fija (`hash`): no toca el azar del juego.
import { backdropClimbTop } from './backdropLogic';
import { hash } from './pixelArt';

/** De qué pedazo del fondo es una nube: el mar de nubes de abajo, el atardecer, el violeta del medio o la noche. */
export type Altitude = 'low' | 'dusk' | 'mid' | 'high';

export interface DriftLayer {
  /** Fracción del avance de la cámara que recorre la capa (el fondo, ≈ 0,19; lo jugable, 1). */
  parallax: number;
  /** Cuánto corre de costado (unidades por segundo; negativo, a la izquierda). */
  drift: number;
  /** Distancia vertical media entre dos nubes de la capa (unidades de la capa). */
  spacing: number;
  /** Alfa de las nubes de la capa (las de adelante, más). */
  alpha: number;
}

export interface DriftCloud {
  layer: number;
  /** Altura en la capa: a la vista en `y + (travel − camY) · parallax`. */
  y: number;
  x0: number;
  shape: number;
  altitude: Altitude;
}

export interface DriftConfig {
  layers: readonly DriftLayer[];
  /** Ancho y alto (unidades) de cada forma de nube, por altura. */
  sizes: Readonly<Record<Altitude, ReadonlyArray<readonly [number, number]>>>;
  /** Qué hay en el fondo hasta cada fila (unidades de la imagen, de arriba abajo): la última, hasta el pie. */
  bands: ReadonlyArray<readonly [number, Altitude]>;
  /** Cuántas de las nubes de cada altura quedan (0..1): muchas abajo, pocas en la noche. */
  density: Readonly<Record<Altitude, number>>;
}

/** La altura del fondo en la fila `imageY` de la imagen (unidades). */
export function altitudeAt(imageY: number, bands: DriftConfig['bands']): Altitude {
  for (const [until, alt] of bands) if (imageY < until) return alt;
  return bands[bands.length - 1][1];
}

/**
 * La fila del fondo (unidades de la imagen) que queda detrás de una nube de la capa `parallax` en la altura `y` de la
 * capa, cuando la nube pasa por el medio de la vista: así la nube toma el color de lo que tiene detrás. `travel`: el
 * recorrido de la cámara; `climb`: el de la imagen (`backdropClimbTop`).
 */
export function backdropRowBehind(y: number, parallax: number, travel: number, climb: number, viewH: number): number {
  const camY = Math.min(travel, Math.max(0, travel - (viewH / 2 - y) / parallax));
  const screenY = y + (travel - camY) * parallax;
  return screenY - backdropClimbTop(camY, travel, climb, 0);
}

/**
 * Las nubes de todas las capas para un nivel de `travel` unidades de recorrido de cámara (alto del mapa menos el de la
 * vista), un fondo que recorre `climb` y una vista de `viewW` × `viewH`. Cada capa las reparte de arriba abajo cada
 * `spacing` (con un corrimiento fijo por nube); cada una es de la altura del fondo que tiene detrás y se descarta según
 * la densidad de esa altura.
 */
export function planDriftClouds(cfg: DriftConfig, travel: number, climb: number, viewW: number, viewH: number, seed: number): DriftCloud[] {
  const out: DriftCloud[] = [];
  cfg.layers.forEach((layer, li) => {
    const top = -travel * layer.parallax - 60;
    const bottom = viewH + 60;
    for (let j = 0, y = top; y < bottom; j++, y = top + j * layer.spacing) {
      const n = seed + li * 31 + j;
      const yy = y + (hash(n, 1) - 0.5) * layer.spacing * 0.7;
      const band = altitudeAt(backdropRowBehind(yy, layer.parallax, travel, climb, viewH), cfg.bands);
      if (hash(n, 2) >= cfg.density[band]) continue;
      const shapes = cfg.sizes[band].length;
      out.push({ layer: li, y: yy, x0: hash(n, 3) * (viewW + 200), shape: Math.floor(hash(n, 4) * shapes) % shapes, altitude: band });
    }
  });
  return out;
}

/**
 * Dónde se ve la nube (esquina de arriba a la izquierda, unidades de la vista) con la cámara en (`camX`, `camY`) a `nowMs`:
 * baja con la subida al ritmo de su capa y corre de costado; da la vuelta por los bordes (sale entera antes de volver).
 */
export function driftPosition(
  c: DriftCloud,
  layer: DriftLayer,
  width: number,
  camX: number,
  camY: number,
  travel: number,
  viewW: number,
  nowMs: number,
): { x: number; y: number } {
  const lap = viewW + width + 40;
  const raw = c.x0 + (layer.drift * nowMs) / 1000 - camX * layer.parallax;
  const x = ((raw % lap) + lap) % lap - width - 20;
  return { x, y: c.y + (travel - camY) * layer.parallax };
}

export interface ShootingConfig {
  /** Cada cuánto (ms, al azar entre los dos) sale una. */
  everyMs: readonly [number, number];
  durationMs: number;
  /** Cuánto recorre (unidades) y con qué ángulo baja (radianes). */
  travel: number;
  angle: number;
  /** Alto mínimo (unidades) de la franja de noche a la vista para que salga. */
  minBand: number;
}

/** Espera (ms) antes de la estrella fugaz número `n`. */
export function shootingGap(cfg: ShootingConfig, n: number, seed: number): number {
  const [a, b] = cfg.everyMs;
  return a + hash(seed + n, 7) * (b - a);
}

export interface ShootingPose {
  x: number;
  y: number;
  alpha: number;
  /** Va hacia la izquierda. */
  left: boolean;
}

/**
 * La estrella fugaz número `n` a `elapsed` ms de salir, dentro de la franja de noche a la vista (`bandTop` a `bandBottom`,
 * unidades de la vista): sale de la mitad de arriba de la franja y baja en diagonal, alejándose del centro. null: no se ve.
 */
export function shootingPoseAt(
  cfg: ShootingConfig,
  n: number,
  elapsed: number,
  bandTop: number,
  bandBottom: number,
  viewW: number,
  seed: number,
): ShootingPose | null {
  if (elapsed < 0 || elapsed >= cfg.durationMs || bandBottom - bandTop < cfg.minBand) return null;
  const left = hash(seed + n, 11) < 0.5;
  const x0 = viewW * (left ? 0.45 + 0.45 * hash(seed + n, 13) : 0.1 + 0.45 * hash(seed + n, 13));
  const y0 = bandTop + (bandBottom - bandTop) * 0.45 * hash(seed + n, 17);
  const t = elapsed / cfg.durationMs;
  const d = cfg.travel * (1 - (1 - t) * (1 - t));
  const alpha = Math.min(1, t / 0.15) * (1 - Math.max(0, (t - 0.6) / 0.4));
  return { x: x0 + (left ? -1 : 1) * Math.cos(cfg.angle) * d, y: y0 + Math.sin(cfg.angle) * d, alpha, left };
}
