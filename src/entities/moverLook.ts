import { PLATFORM_TILES } from '../assets/manifest';
import { bayer, clamp, makePixels, mix, put, type Pixels } from '../systems/pixelArt';

/** Casillas de la izquierda, del medio y de la derecha de una plataforma móvil. */
export interface MoverPieces {
  left: number;
  center: number;
  right: number;
}

/**
 * Casillas del tileset para una plataforma de `widthPx` (S57): la izquierda, la del medio repetida
 * y la derecha. Una de un solo tile usa la del medio. S118: `pieces` cambia de dónde salen (la losa del cielo, en la hoja
 * de detalle); sin él, las 16 a 18 de siempre.
 */
export function platformPieces(widthPx: number, tile: number, pieces: MoverPieces = PLATFORM_TILES): number[] {
  const n = Math.max(1, Math.round(widthPx / tile));
  if (n === 1) return [pieces.center];
  return Array.from({ length: n }, (_, i) => (i === 0 ? pieces.left : i === n - 1 ? pieces.right : pieces.center));
}

/** S118: el brillo suave bajo la losa flotante (GAMEPLAY.mover.looks.<bioma>.glow). */
export interface MoverGlowLook {
  /** Cuánto sobresale a cada lado de la losa y cuánto baja (unidades = píxeles). */
  pad: number;
  height: number;
  /** Del centro hacia el borde. */
  colors: readonly number[];
  /** Alfa de cada escalón (de afuera hacia adentro) y dónde empieza (densidad 0..1). */
  alphas: readonly number[];
  steps: readonly number[];
}

/**
 * S118: el aspecto por bioma de la plataforma móvil. `source: 'detail'`: las piezas vienen de la hoja de detalle del
 * nivel (`mover` en su JSON); `artRows`, cuántas filas de arte tienen (la losa del cielo es más alta que el cuerpo);
 * `glow`, un brillo debajo. Un bioma sin entrada se ve como siempre (S57).
 */
export interface MoverLook {
  source: 'detail';
  artRows: number;
  glow?: MoverGlowLook;
  /** Respiración del brillo: período (ms) y cuánto baja el alfa (0..1). Con «Destellos» apagado, quieto. */
  breathMs: number;
  breath: number;
}

/**
 * El brillo bajo la losa (pixel art, sin desenfoque): un óvalo achatado de `widthPx + 2 pad` × `height`, más denso
 * arriba al centro, en escalones de alfa con tramado de Bayer en el borde.
 */
export function paintMoverGlow(widthPx: number, look: MoverGlowLook): Pixels {
  const w = widthPx + look.pad * 2;
  const h = look.height;
  const p = makePixels(w, h);
  const cx = w / 2;
  const rx = w / 2;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (x + 0.5 - cx) / rx;
      const dy = (y + 0.5) / h;
      // Más ancho arriba (bajo la losa) y que se cierra hacia abajo.
      const d = 1 - Math.sqrt(dx * dx * (0.7 + dy * 0.6) + dy * dy);
      const v = d + bayer(x, y) * 0.22;
      let level = -1;
      for (let i = 0; i < look.steps.length; i++) if (v >= look.steps[i]) level = i;
      if (level < 0) continue;
      const t = clamp(1 - d * 1.4, 0, 1);
      const c = look.colors;
      const at = t * (c.length - 1);
      const k = Math.min(c.length - 2, Math.floor(at));
      put(p, x, y, mix(c[k], c[k + 1], at - k), Math.round(look.alphas[level] * 255));
    }
  }
  return p;
}
