import { GAMEPLAY } from '../config/gameplay';
import { paintShootingStar } from '../scenes/title/titlePaint';
import { type AtlasFrame, bayer, clamp, hash, makePixels, put, smoothstep, type Pixels } from './pixelArt';
import type { Altitude } from './skyDriftLogic';

// Las nubes del cielo vivo de Yvága (S118), pintadas una vez a 1 píxel por unidad (como los tiles): bancos de lóbulos
// con la base más chata, la luz arriba, tres escalones de alfa y el borde tramado (Bayer), como la bruma de S103. Una
// paleta por altura: el mar de nubes de abajo, el violeta del medio, la noche de arriba. La estrella fugaz es la de la
// portada (S105).
const LOOK = GAMEPLAY.backdrop.skyDrift;

export const ALTITUDES: readonly Altitude[] = ['low', 'dusk', 'mid', 'high'];
export const cloudFrame = (alt: Altitude, shape: number): string => `drift_${alt}_${shape}`;
export const SHOOTING_FRAME = 'drift_shooting';

/**
 * Densidad (0..1) del banco: unión suave de lóbulos estirados a lo ancho (`stretch`: los de la noche y del atardecer,
 * tiras chatas; los de abajo, bancos con lomo), de tamaños distintos, la panza más chata.
 */
function bankDensity(shape: number, w: number, h: number, stretch: number): (x: number, y: number) => number {
  const n = 3 + Math.floor(hash(shape * 7, 3) * 3);
  const blobs: { x: number; y: number; r: number }[] = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const mid = 1 - Math.abs(t - 0.5) * 2;
    blobs.push({
      x: w * (0.12 + 0.76 * t + (hash(shape * 13 + i, 5) - 0.5) * 0.08),
      y: h * (0.66 - 0.22 * mid + (hash(i, shape + 9) - 0.5) * 0.12),
      r: h * (0.22 + 0.24 * mid * hash(shape + 5, i + 2) + hash(shape + 3, i) * 0.1),
    });
  }
  // Que los lóbulos se toquen a lo ancho: el radio horizontal alcanza para llegar al de al lado.
  const reach = (w * 0.76) / (n - 1);
  return (x, y) => {
    let d = 0;
    for (const b of blobs) {
      const dx = (x - b.x) / Math.max(b.r * stretch, reach * (0.7 + 0.5 * (b.r / h)));
      const dy = (y - b.y) / b.r;
      const q = 1 - (dx * dx + dy * dy);
      if (q > 0) d += q * q;
    }
    // La panza chata y las puntas que se afinan (nunca un corte recto en el borde del cuadro).
    return clamp(d, 0, 1) * smoothstep(h, h * 0.74, y) * smoothstep(0, w * 0.14, x) * smoothstep(w, w * 0.86, x);
  };
}

/** Un banco de nube de la altura `alt` y la forma `shape` (tamaño de `LOOK.sizes`). */
export function paintCloudBank(alt: Altitude, shape: number): Pixels {
  const sizes = LOOK.sizes[alt];
  const [w, h] = sizes[shape % sizes.length];
  const pal = LOOK.palettes[alt];
  const p = makePixels(w, h);
  const dens = bankDensity(shape + ALTITUDES.indexOf(alt) * 5, w, h, LOOK.stretch[alt]);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const d = dens(x + 0.5, y + 0.5);
      if (d < 0.02) continue;
      const v = d + bayer(x, y) * 0.24;
      let level = -1;
      for (let i = 0; i < LOOK.steps.length; i++) if (v >= LOOK.steps[i]) level = i;
      if (level < 0) continue;
      // Luz de arriba: el píxel mira al cielo si la nube crece hacia abajo.
      const toward = dens(x + 0.5, y + 2.5) - dens(x + 0.5, y - 1.5);
      const lit = 0.35 + toward * 1.1 + (0.5 - y / h) * 0.6 + bayer(x + 2, y + 1) * 0.15;
      put(p, x, y, pal[clamp(Math.floor(lit * pal.length), 0, pal.length - 1)], Math.round(LOOK.alphas[level] * 255));
    }
  }
  return p;
}

export function driftAtlasFrames(): AtlasFrame[] {
  const frames: AtlasFrame[] = [];
  for (const alt of ALTITUDES) for (let s = 0; s < LOOK.sizes[alt].length; s++) frames.push({ name: cloudFrame(alt, s), px: paintCloudBank(alt, s) });
  frames.push({ name: SHOOTING_FRAME, px: paintShootingStar() });
  return frames;
}
