import Phaser from 'phaser';
import { GAMEPLAY } from '../config/gameplay';
import { EICHU_STARS, type EichuPlacement } from '../data/story';
import { glintAlpha, glintRuns, pickGlint, sunPulse } from './backdropLogic';

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
/** Estrella de Eichu todavía apagada (mapa, GDD §8.4): un punto muy tenue, sin halo ni titilar. */
const EICHU_DIM_ALPHA = 0.22;

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

/**
 * Eichu (las Pléyades) con su forma real, titilando. Hay que parar sus tweens al destruirla (`killTweensOf`).
 * `lit[i]` dice si la estrella `i` de `EICHU_STARS` está encendida (sin `lit`, todas); las apagadas quedan tenues.
 */
export function addEichu(
  scene: Phaser.Scene,
  place: EichuPlacement,
  width: number,
  height: number,
  lit?: ReadonlyArray<boolean>,
): Phaser.GameObjects.GameObject[] {
  const parts: Phaser.GameObjects.GameObject[] = [];
  EICHU_STARS.forEach((star, i) => {
    const x = place.x * width + star.x * place.size;
    const y = place.y * height + star.y * place.size;
    const r = eichuRadius(star.mag);
    if (lit && !lit[i]) {
      parts.push(scene.add.circle(x, y, r, GLOW_COLOR, EICHU_DIM_ALPHA));
      return;
    }
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

const SUN = GAMEPLAY.backdrop.sun;
const HALO_KEY = 'bg_sun_halo';
const GLINT_KEY = 'bg_sun_glint';
/** Lado de la textura del halo (px): se estira al radio del momento, con filtro lineal. */
const HALO_TEX = 64;

/** El sol de un fondo y su reflejo (`sun` en levels.ts), en px de arte de la imagen. */
export interface SunPlacement {
  at: readonly [number, number];
  reflection: readonly [number, number, number, number];
}

/**
 * El sol que respira y el reflejo que titila (S96, l2). Todo por código y pegado a la imagen lejana: `update` recibe
 * dónde quedó la imagen (su esquina y su escala) y pone el halo y los destellos en los mismos px de arte. Los destellos
 * son un pool fijo de imágenes de 1 px que caen sobre tiras doradas medidas en la imagen (`glintRuns`).
 */
export class SunShimmer {
  private readonly halo: Phaser.GameObjects.Image;
  private readonly glints: { img: Phaser.GameObjects.Image; x: number; y: number; width: number; born: number; life: number }[] = [];
  private readonly runs: number[];
  private readonly pick = { x: 0, y: 0, width: 0 };
  private readonly rand = new Phaser.Math.RandomDataGenerator(['sun']);
  /** Radio del halo ahora (px de arte). */
  private radius = 0;

  constructor(
    scene: Phaser.Scene,
    private readonly place: SunPlacement,
    pixels: { data: ArrayLike<number>; width: number } | undefined,
    depth: number,
  ) {
    makeSunTextures(scene);
    const g = SUN.glints;
    this.runs = pixels ? glintRuns(pixels.data, pixels.width, place.reflection, g.minRed, g.minGreen, g.widthMin) : [];
    this.halo = scene.add
      .image(0, 0, HALO_KEY)
      .setScrollFactor(0)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(Phaser.Display.Color.HexStringToColor(SUN.color).color)
      .setDepth(depth)
      .setVisible(false);
    const glintColor = Phaser.Display.Color.HexStringToColor(g.color).color;
    for (let i = 0; i < g.count; i++) {
      const img = scene.add.image(0, 0, GLINT_KEY).setOrigin(0).setScrollFactor(0).setTint(glintColor).setDepth(depth + 0.01).setVisible(false);
      // Arrancan escalonados, apagados.
      this.glints.push({ img, x: 0, y: 0, width: 0, born: this.rand.between(0, g.gapMaxMs), life: 0 });
    }
  }

  get layers(): Phaser.GameObjects.GameObject[] {
    return [this.halo, ...this.glints.map((g) => g.img)];
  }

  /** `left`, `top`: esquina de la imagen en la vista; `sx`, `sy`: unidades por px de arte. `on`: «Destellos» y la imagen a la vista. */
  update(left: number, top: number, sx: number, sy: number, now: number, on: boolean): void {
    this.halo.setVisible(on);
    if (!on) {
      for (const g of this.glints) g.img.setVisible(false);
      return;
    }
    const k = sunPulse(now, SUN.periodMs);
    const radius = SUN.radiusMin + (SUN.radiusMax - SUN.radiusMin) * k;
    this.radius = radius;
    this.halo
      .setPosition(left + this.place.at[0] * sx, top + this.place.at[1] * sy)
      .setDisplaySize(2 * radius * sx, 2 * radius * sy)
      .setAlpha(SUN.alphaMin + (SUN.alphaMax - SUN.alphaMin) * k);
    const gc = SUN.glints;
    for (const g of this.glints) {
      if (now >= g.born + g.life) this.respawn(g, now);
      const a = glintAlpha((now - g.born) / g.life);
      g.img.setVisible(a > 0);
      if (a > 0) g.img.setPosition(left + g.x * sx, top + g.y * sy).setDisplaySize(g.width * sx, sy).setAlpha(a * gc.alpha);
    }
  }

  /** Para la prueba de humo y las capturas: el halo y los destellos encendidos, en px de arte de la imagen. */
  debugState(): { halo: boolean; radius: number; alpha: number; glints: { x: number; y: number; width: number }[]; runs: number } {
    return {
      halo: this.halo.visible,
      radius: this.radius,
      alpha: this.halo.alpha,
      glints: this.glints.filter((g) => g.img.visible).map((g) => ({ x: g.x, y: g.y, width: g.width })),
      runs: this.runs.length / 3,
    };
  }

  /** Otro lugar, otra vida, después de una pausa apagado. */
  private respawn(g: SunShimmer['glints'][number], now: number): void {
    const gc = SUN.glints;
    if (!pickGlint(this.runs, gc.widthMin, gc.widthMax, this.rand.frac(), this.rand.frac(), this.rand.frac(), this.pick)) {
      g.born = now;
      g.life = Number.POSITIVE_INFINITY;
      return;
    }
    g.x = this.pick.x;
    g.y = this.pick.y;
    g.width = this.pick.width;
    g.born = now + this.rand.between(gc.gapMinMs, gc.gapMaxMs);
    g.life = this.rand.between(gc.lifeMinMs, gc.lifeMaxMs);
  }
}

/** Halo (degradado radial, más fuerte en `ringAt` y casi nada en el centro) y el píxel blanco de los destellos. */
function makeSunTextures(scene: Phaser.Scene): void {
  if (!scene.textures.exists(HALO_KEY)) {
    const tex = scene.textures.createCanvas(HALO_KEY, HALO_TEX, HALO_TEX);
    if (tex) {
      const ctx = tex.getContext();
      const r = HALO_TEX / 2;
      const grad = ctx.createRadialGradient(r, r, 0, r, r, r);
      grad.addColorStop(0, 'rgba(255,255,255,0.35)');
      grad.addColorStop(SUN.ringAt, 'rgba(255,255,255,1)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, HALO_TEX, HALO_TEX);
      tex.refresh();
      tex.setFilter(Phaser.Textures.FilterMode.LINEAR);
    }
  }
  if (!scene.textures.exists(GLINT_KEY)) {
    const tex = scene.textures.createCanvas(GLINT_KEY, 1, 1);
    if (tex) {
      tex.getContext().fillStyle = '#ffffff';
      tex.getContext().fillRect(0, 0, 1, 1);
      tex.refresh();
    }
  }
}
