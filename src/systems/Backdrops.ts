import Phaser from 'phaser';
import { EICHU_STARS, type EichuPlacement } from '../data/story';

// Fondos del final (GDD §7, §6.8) por código: Eichu, el cielo de noche y, si falta el arte (ASSETS §7), el amanecer.

const YVAGA_TOP = 0x0e0c24;
const YVAGA_BOTTOM = 0x3a2a5a;
const NIGHT_TOP = 0x07061a;
const NIGHT_BOTTOM = 0x23204a;
const DAWN_TOP = 0x1b1a4e;
const DAWN_BOTTOM = 0xf2a65a;
const SPRING_COLOR = 0x5ab0d0;
const HILL_COLOR = 0x2f5d3a;
const STAR_COLOR = 0xf2eee3;
const GLOW_COLOR = 0xcfe3f2;
/** Radio de una estrella de Eichu (unidades) según su magnitud: más brillante, más grande. */
const eichuRadius = (mag: number): number => 1 + (5.5 - mag) * 0.5;
/** Halo de cada estrella (múltiplo del radio), su opacidad y el titilar (ms). */
const EICHU_GLOW = 3;
const EICHU_GLOW_ALPHA = 0.3;
const EICHU_TWINKLE_MS = 1400;

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

/** Cielo de noche por código (diapositivas de Eichu sin imagen). */
export function addNightSky(scene: Phaser.Scene, width: number, height: number): Phaser.GameObjects.GameObject[] {
  const parts: Phaser.GameObjects.GameObject[] = [gradient(scene, 0, 0, width, height, NIGHT_TOP, NIGHT_BOTTOM)];
  const rng = new Phaser.Math.RandomDataGenerator(['eichu']);
  for (let i = 0; i < 50; i++) {
    parts.push(scene.add.circle(rng.between(0, width), rng.between(0, height), rng.realInRange(0.4, 0.9), STAR_COLOR, rng.realInRange(0.2, 0.6)));
  }
  return parts;
}

/** Eichu (las Pléyades) con su forma real, titilando. Hay que parar sus tweens al destruirla (`killTweensOf`). */
export function addEichu(scene: Phaser.Scene, place: EichuPlacement, width: number, height: number): Phaser.GameObjects.GameObject[] {
  const parts: Phaser.GameObjects.GameObject[] = [];
  EICHU_STARS.forEach((star, i) => {
    const x = place.x * width + star.x * place.size;
    const y = place.y * height + star.y * place.size;
    const r = eichuRadius(star.mag);
    const glow = scene.add.circle(x, y, r * EICHU_GLOW, GLOW_COLOR, EICHU_GLOW_ALPHA);
    parts.push(glow, scene.add.circle(x, y, r, 0xffffff));
    scene.tweens.add({ targets: glow, alpha: 0.05, duration: EICHU_TWINKLE_MS + i * 170, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  });
  return parts;
}

/** Imagen de la diapositiva o, si falta, amanecer de Ary Pyahu por código (Kerana junto al manantial). */
export function addDawn(scene: Phaser.Scene, key: string, width: number, height: number): Phaser.GameObjects.GameObject[] {
  if (scene.textures.exists(key)) return [scene.add.image(0, 0, key).setOrigin(0).setDisplaySize(width, height)];
  const parts: Phaser.GameObjects.GameObject[] = [gradient(scene, 0, 0, width, height, DAWN_TOP, DAWN_BOTTOM)];
  parts.push(scene.add.ellipse(width * 0.3, height, width * 0.9, height * 0.35, HILL_COLOR));
  parts.push(scene.add.ellipse(width * 0.8, height, width * 0.7, height * 0.25, HILL_COLOR));
  parts.push(scene.add.ellipse(width * 0.45, height * 0.9, 60, 10, SPRING_COLOR));
  // Kerana sentada (silueta) junto al manantial.
  parts.push(scene.add.ellipse(width * 0.36, height * 0.86, 10, 16, 0x1b1a2e));
  parts.push(scene.add.circle(width * 0.36, height * 0.815, 4, 0x1b1a2e));
  return parts;
}
