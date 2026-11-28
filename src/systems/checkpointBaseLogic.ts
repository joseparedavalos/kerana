// Base de la fogata del checkpoint (S121): la mancha de tierra y ceniza y las matas de pasto de la franja de delante.
// Lógica pura sobre `Pixels`: la escena arma la franja con las casillas del piso y la sube como textura.

import { alphaAt, colorAt, hash, makePixels, mix, put, type Pixels } from './pixelArt';

export interface PatchConfig {
  detail: number;
  halfWidth: number;
  halfHeight: number;
  centerY: number;
  rim: number;
  ash: number;
  char: number;
  colors: { soil: number; soilDark: number; rimSoil: number; ash: number; ashLight: number; char: number };
}

export interface BladeConfig {
  halfWidth: number;
  max: number;
  chance: number;
  tipLighten: number;
}

/**
 * La mancha: elipse de `2 · halfWidth` × `2 · halfHeight` unidades a `detail` píxeles por unidad. El borde de afuera se
 * trama (un píxel sí y otro no) para fundirse con el piso; adentro, tierra oscura con ceniza y carbón sueltos.
 * El centro de la elipse cae en el centro del lienzo.
 */
export function paintAshPatch(cfg: PatchConfig, seed = 0): Pixels {
  const w = Math.round(cfg.halfWidth * 2 * cfg.detail);
  const h = Math.round(cfg.halfHeight * 2 * cfg.detail);
  const px = makePixels(w, h);
  const c = cfg.colors;
  const cx = w / 2;
  const cy = h / 2;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (x + 0.5 - cx) / (w / 2);
      const dy = (y + 0.5 - cy) / (h / 2);
      const d = dx * dx + dy * dy;
      if (d > 1) continue;
      const r = hash(x + seed * 13.7, y + seed * 7.1);
      if (d > 1 - cfg.rim) {
        // Borde: tierra suelta tramada, más rala hacia afuera.
        if ((x + y) % 2 === 1 && d > 1 - cfg.rim / 2) continue;
        put(px, x, y, r < 0.5 ? c.rimSoil : c.soil);
        continue;
      }
      let color = r < 0.35 ? c.soilDark : c.soil;
      const s = hash(y + seed * 3.3, x * 1.7 + 0.5);
      if (s < cfg.char) color = c.char;
      else if (s < cfg.char + cfg.ash) color = s < cfg.char + cfg.ash * 0.35 ? c.ashLight : c.ash;
      put(px, x, y, color);
    }
  }
  return px;
}

/** ¿El color es pasto (más verde que rojo y azul)? Las matas solo nacen del pasto: ni del adoquín ni de la nube. */
export function isGrass(color: number): boolean {
  const r = (color >> 16) & 255;
  const g = (color >> 8) & 255;
  const b = color & 255;
  return g > r + 6 && g > b + 6;
}

export interface StainConfig {
  halfWidth: number;
  depth: number;
  strength: number;
  edge: number;
}

export interface Blade {
  x: number;
  top: number;
  height: number;
  color: number;
}

/**
 * Matas de pasto sobre la franja: en cada columna a menos de `halfWidth` del centro, el píxel más alto del piso cerca
 * de `groundRow`; si es pasto, crece hacia arriba de 1 a `max` píxeles (por `hash`, una de cada `chance`).
 * `unit` = píxeles por unidad. Se planean sobre el piso limpio y se dibujan después de la mancha (`drawBlades`).
 */
export function planBlades(strip: Pixels, groundRow: number, cfg: BladeConfig, unit = 1, seed = 0): Blade[] {
  const cx = strip.width / 2;
  const reach = cfg.halfWidth * unit;
  const maxPx = Math.round(cfg.max * unit);
  const blades: Blade[] = [];
  for (let x = 0; x < strip.width; x++) {
    if (Math.abs(x + 0.5 - cx) > reach) continue;
    if (hash(x + seed * 5.9, 91.3) >= cfg.chance) continue;
    let top = -1;
    for (let y = Math.max(0, groundRow - maxPx); y < Math.min(strip.height, groundRow + 2 * unit); y++) {
      if (alphaAt(strip, x, y) > 0) {
        top = y;
        break;
      }
    }
    if (top < 0) continue;
    const color = colorAt(strip, x, top);
    if (!isGrass(color)) continue;
    blades.push({ x, top, height: 1 + Math.floor(hash(x * 2.3 + seed, 17.7) * maxPx), color });
  }
  return blades;
}

/** Dibuja las matas: el color del pasto de su columna, la punta más clara. */
export function drawBlades(strip: Pixels, blades: readonly Blade[], tipLighten: number): void {
  for (const b of blades) {
    for (let k = 0; k <= b.height; k++) {
      const y = b.top - k;
      if (y < 0) break;
      put(strip, b.x, y, k === b.height ? mix(b.color, 0xffffff, tipLighten) : b.color);
    }
  }
}

/**
 * La tierra y la ceniza también manchan el borde del piso bajo la ronda: media elipse desde `groundRow` hacia abajo
 * (`halfWidth` × `depth` unidades), que mezcla el piso con los colores de la mancha (`strength` en el centro, tramado
 * hacia el borde de afuera, la fracción `edge`). Solo donde ya hay piso: no agrega píxeles.
 */
export function stainGround(strip: Pixels, groundRow: number, cfg: StainConfig, patch: PatchConfig, unit = 1, seed = 0): number {
  const cx = strip.width / 2;
  const rx = cfg.halfWidth * unit;
  const ry = cfg.depth * unit;
  const c = patch.colors;
  let stained = 0;
  for (let y = groundRow; y < Math.min(strip.height, groundRow + Math.ceil(ry)); y++) {
    for (let x = 0; x < strip.width; x++) {
      if (alphaAt(strip, x, y) === 0) continue;
      const dx = (x + 0.5 - cx) / rx;
      const dy = (y - groundRow + 0.5) / ry;
      const d = dx * dx + dy * dy;
      if (d > 1) continue;
      if (d > 1 - cfg.edge && (x + y) % 2 === 1) continue;
      const r = hash(x + seed * 4.1, y * 3.7 + 1.3);
      const tone = r < patch.char ? c.char : r < patch.char + patch.ash ? c.ash : r < 0.6 ? c.soilDark : c.soil;
      const t = d > 1 - cfg.edge ? cfg.strength * 0.6 : cfg.strength;
      put(strip, x, y, mix(colorAt(strip, x, y), tone, t), alphaAt(strip, x, y));
      stained++;
    }
  }
  return stained;
}
