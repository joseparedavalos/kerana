import Phaser from 'phaser';

// Lo usan Mainumby (S13b) y el humo y el destello del payesero (S62).

/** Brillo suave por código: degradado radial de `color` (alfa 1 en el centro → 0 en el borde), sin borde marcado. */
export function ensureSoftGlow(scene: Phaser.Scene, size: number, color: number): string {
  const key = `soft_glow_${color.toString(16)}`;
  if (scene.textures.exists(key)) return key;
  const tex = scene.textures.createCanvas(key, size, size);
  if (!tex) return key;
  const ctx = tex.getContext();
  const r = size / 2;
  const rgb = `${(color >> 16) & 0xff}, ${(color >> 8) & 0xff}, ${color & 0xff}`;
  const grad = ctx.createRadialGradient(r, r, 0, r, r, r);
  grad.addColorStop(0, `rgba(${rgb}, 1)`);
  grad.addColorStop(0.5, `rgba(${rgb}, 0.45)`);
  grad.addColorStop(1, `rgba(${rgb}, 0)`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  tex.refresh();
  return key;
}
