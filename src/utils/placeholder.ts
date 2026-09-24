import Phaser from 'phaser';

// Color estable a partir de la clave, para distinguir placeholders.
export function colorForKey(key: string): string {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return `hsl(${h % 360}, 55%, 45%)`;
}

/** Crea una textura de reemplazo: rectángulo de color con la clave escrita. */
export function makePlaceholderTexture(
  scene: Phaser.Scene,
  key: string,
  frameWidth: number,
  frameHeight: number,
  frames = 1,
): void {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const tex = scene.textures.createCanvas(key, frameWidth * frames, frameHeight);
  if (!tex) return;
  const ctx = tex.getContext();
  for (let i = 0; i < frames; i++) {
    const x = i * frameWidth;
    ctx.fillStyle = colorForKey(key);
    ctx.fillRect(x, 0, frameWidth, frameHeight);
    ctx.strokeStyle = '#F2EEE3';
    ctx.strokeRect(x + 0.5, 0.5, frameWidth - 1, frameHeight - 1);
    ctx.fillStyle = '#F2EEE3';
    ctx.font = '6px monospace';
    ctx.textBaseline = 'top';
    ctx.fillText(key, x + 1, 1, frameWidth - 2);
    if (frames > 1) tex.add(i, 0, x, 0, frameWidth, frameHeight);
  }
  tex.refresh();
}

/** Genera la textura solo si todavía no existe (para no repetirla por instancia). */
export function ensurePlaceholder(scene: Phaser.Scene, key: string, frameWidth: number, frameHeight: number, frames = 1): void {
  if (scene.textures.exists(key)) return;
  makePlaceholderTexture(scene, key, frameWidth, frameHeight, frames);
}
