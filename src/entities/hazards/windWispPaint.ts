import { GAMEPLAY } from '../../config/gameplay';
import { type AtlasFrame, bayer, clamp, makePixels, mix, put, type Pixels } from '../../systems/pixelArt';

// Jirones de nube del viento de Yvága (S118): tiras de nube largas y finas que corren con la ráfaga (WindZone con
// `grass=false`). Pintadas una vez, a 1 píxel por unidad (como los tiles): más gruesas al frente, deshilachadas atrás,
// la luz arriba y el borde tramado. Lógica pura: WindZone sube el atlas.
const LOOK = GAMEPLAY.wind.wisps;

export const wispFrame = (i: number): string => `wisp_${i}`;

/** El jirón `shape` (0..): ancho y alto de `LOOK.sizes`, la cabeza a la derecha (se espeja si sopla a la izquierda). */
export function paintWisp(shape: number): Pixels {
  const [w, h] = LOOK.sizes[shape % LOOK.sizes.length];
  const p = makePixels(w, h);
  const pal = LOOK.palette;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const t = x / (w - 1); // 0 la cola, 1 la cabeza
      // Grosor: crece hacia la cabeza y se redondea en la punta; la cola se deshilacha en hebras.
      const thick = (0.25 + 0.75 * Math.pow(t, 0.7)) * (1 - Math.pow(Math.max(0, t - 0.86) / 0.14, 2));
      const wave = Math.sin(t * 7 + shape * 2.1) * 0.12;
      const dy = Math.abs((y + 0.5) / h - 0.5 + wave) * 2;
      const d = thick - dy + bayer(x, y) * 0.35 - (t < 0.3 && (y + shape) % 2 === 0 ? 0.3 : 0);
      if (d < 0.08) continue;
      const lit = (y + 0.5) / h < 0.5 + wave ? 1 : 0;
      const c = mix(pal[0], pal[1], clamp(t * 0.8 + lit * 0.3, 0, 1));
      put(p, x, y, c, Math.round(255 * (d > 0.45 ? LOOK.alphas[1] : LOOK.alphas[0])));
    }
  }
  return p;
}

export function wispAtlasFrames(): AtlasFrame[] {
  return LOOK.sizes.map((_, i) => ({ name: wispFrame(i), px: paintWisp(i) }));
}
