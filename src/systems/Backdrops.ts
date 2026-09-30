import Phaser from 'phaser';

// Fondos del final (GDD §7, §6.8) por código, para cuando falta el arte (ASSETS §7).

const YVAGA_TOP = 0x0e0c24;
const YVAGA_BOTTOM = 0x3a2a5a;
const DAWN_TOP = 0x1b1a4e;
const DAWN_BOTTOM = 0xf2a65a;
const SPRING_COLOR = 0x5ab0d0;
const HILL_COLOR = 0x2f5d3a;
const STAR_COLOR = 0xf2eee3;
/** Eichu (las Pléyades): siete estrellas juntas, en fracciones del ancho y alto. */
const EICHU: ReadonlyArray<readonly [number, number]> = [
  [0.62, 0.16],
  [0.66, 0.13],
  [0.7, 0.17],
  [0.67, 0.2],
  [0.73, 0.12],
  [0.64, 0.24],
  [0.71, 0.23],
];

function gradient(scene: Phaser.Scene, x: number, y: number, w: number, h: number, top: number, bottom: number): Phaser.GameObjects.Graphics {
  return scene.add.graphics().fillGradientStyle(top, top, bottom, bottom, 1).fillRect(x, y, w, h);
}

/** Cielo de Yvága por código, detrás de la arena, si falta `bg_yvaga_far` (la imagen la pone `LevelBackdrop`). */
export function addYvagaSky(scene: Phaser.Scene, width: number, height: number): void {
  gradient(scene, 0, 0, width, height, YVAGA_TOP, YVAGA_BOTTOM).setDepth(-10);
  const rng = new Phaser.Math.RandomDataGenerator(['yvaga']);
  for (let i = 0; i < 60; i++) {
    scene.add
      .circle(rng.between(0, width), rng.between(0, height * 0.8), rng.realInRange(0.5, 1.2), STAR_COLOR, rng.realInRange(0.3, 0.9))
      .setDepth(-9);
  }
}

/** Amanecer de Ary Pyahu: Kerana junto al manantial y Eichu en el cielo (diapositivas del final). */
export function addDawn(scene: Phaser.Scene, key: string, width: number, height: number): Phaser.GameObjects.GameObject[] {
  if (scene.textures.exists(key)) return [scene.add.image(0, 0, key).setOrigin(0).setDisplaySize(width, height)];
  const parts: Phaser.GameObjects.GameObject[] = [gradient(scene, 0, 0, width, height, DAWN_TOP, DAWN_BOTTOM)];
  for (const [fx, fy] of EICHU) parts.push(scene.add.circle(fx * width, fy * height, 1.6, STAR_COLOR));
  parts.push(scene.add.ellipse(width * 0.3, height, width * 0.9, height * 0.35, HILL_COLOR));
  parts.push(scene.add.ellipse(width * 0.8, height, width * 0.7, height * 0.25, HILL_COLOR));
  parts.push(scene.add.ellipse(width * 0.45, height * 0.9, 60, 10, SPRING_COLOR));
  // Kerana sentada (silueta) junto al manantial.
  parts.push(scene.add.ellipse(width * 0.36, height * 0.86, 10, 16, 0x1b1a2e));
  parts.push(scene.add.circle(width * 0.36, height * 0.815, 4, 0x1b1a2e));
  return parts;
}
