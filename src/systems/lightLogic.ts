// Luz y oscuridad (GDD §4.8, §6.7): lógica pura, sin Phaser, con tests.

/** Una fuente de luz: halo de Kerana, farol encendido, vela. */
export interface LightSource {
  x: number;
  y: number;
  radius: number;
  /** Farol apagado: no alumbra. */
  on: boolean;
}

/** Rectángulo simple (px). */
export interface Area {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** ¿El punto (x, y) está dentro del radio de alguna luz encendida? */
export function isLit(x: number, y: number, sources: readonly LightSource[]): boolean {
  for (const s of sources) {
    if (!s.on) continue;
    const dx = x - s.x;
    const dy = y - s.y;
    if (dx * dx + dy * dy <= s.radius * s.radius) return true;
  }
  return false;
}

/** Un enemigo que pide luz (póra) solo recibe daño iluminado; los demás, siempre. */
export function takesDamage(needsLight: boolean, lit: boolean): boolean {
  return !needsLight || lit;
}

/** ¿El punto está dentro de alguna zona oscura? */
export function inAnyArea(x: number, y: number, areas: readonly Area[]): boolean {
  for (const a of areas) if (x >= a.x && x <= a.x + a.width && y >= a.y && y <= a.y + a.height) return true;
  return false;
}

export interface AmbientColors {
  night: number;
  dark: number;
  candles: number;
}

/** Ambiente según dónde está Kerana: velas (tras liberar a Luisón) > apagón o zona oscura > noche. */
export function ambientTarget(inDarkZone: boolean, blackout: boolean, candles: boolean, colors: AmbientColors): number {
  if (candles) return colors.candles;
  if (blackout || inDarkZone) return colors.dark;
  return colors.night;
}

/** Mezcla dos colores 0xRRGGBB (t de 0 a 1). */
export function lerpColor(a: number, b: number, t: number): number {
  const k = Math.min(1, Math.max(0, t));
  const ch = (c: number, shift: number) => (c >> shift) & 0xff;
  const mix = (shift: number) => Math.round(ch(a, shift) + (ch(b, shift) - ch(a, shift)) * k);
  return (mix(16) << 16) | (mix(8) << 8) | mix(0);
}
