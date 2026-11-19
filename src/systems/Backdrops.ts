import Phaser from 'phaser';
import { GAMEPLAY } from '../config/gameplay';
import { EICHU_STARS, type EichuPlacement } from '../data/story';
import { seeded } from './ambientLogic';
import {
  crystalKind,
  dropFall,
  dropFallMs,
  flockLayout,
  flockLeadX,
  flockSpread,
  glintAlpha,
  glintRuns,
  goldPixels,
  paintWisp,
  pickGlint,
  polylineMax,
  polylineY,
  rayAlphaAt,
  shadowLeft,
  shelfPack,
  skylineRows,
  spanAlpha,
  sunPulse,
  wispFade,
  wispLeft,
  wispTop,
  zigzag,
  type FlockSlot,
} from './backdropLogic';

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

const LIFE = GAMEPLAY.backdrop.skyLife;
const BIRD_KEY = 'bg_sky_birds';
const SHADOW_KEY = 'bg_cloud_shadow';
/** Siluetas de pájaro por ancho (px de arte): alas arriba (V) y alas abajo (^). `#` es un píxel. */
const BIRD_ART: Record<number, readonly [readonly string[], readonly string[]]> = {
  3: [['#.#', '.#.'], ['.#.', '#.#']],
  4: [['#..#', '.##.'], ['.##.', '#..#']],
  5: [['#...#', '.#.#.', '..#..'], ['..#..', '.###.', '#...#']],
};

const PARROT_KEY = 'bg_sky_parrots';
/** Los parámetros de una bandada (`birds` o `parrots` de GAMEPLAY.backdrop.skyLife). */
type FlockParams = { readonly [K in keyof (typeof LIFE)['birds']]: (typeof LIFE)['birds'][K] extends string ? string : number };
/**
 * Loros (S108, l1), mirando a la derecha: cola larga atrás, cuerpo y cabeza adelante; alas arriba y alas abajo. Se
 * dan vuelta cuando cruzan hacia la izquierda.
 */
const PARROT_ART: Record<number, readonly [readonly string[], readonly string[]]> = {
  7: [['...#...', '...##..', '.######', '#......'], ['.......', '.######', '#..##..', '...#...']],
  9: [['....#....', '....##...', '..#######', '##.......'], ['.........', '..#######', '##..##...', '....#....']],
};

/** La franja del cielo y la de la llanura (`skyLife` en levels.ts), en filas de px de arte de la imagen. */
export interface SkyLifePlacement {
  birds: readonly [number, number];
  shadows?: readonly [number, number];
  /** S108: `parrots`, loros (l1); sin él, los pájaros de l3. */
  flock?: 'birds' | 'parrots';
}

/**
 * Bandadas y sombras de nubes (S98, l3). Todo por código y pegado a la imagen lejana, como `SunShimmer`: `update`
 * recibe la esquina y la escala de la imagen y pone todo en px de arte. Los pájaros son un pool fijo de `countMax`
 * imágenes; las sombras, una imagen cada una. Detrás de todo lo jugable. Tiempo de juego: se paran con la pausa.
 */
export class SkyLife {
  /** Pájaros o loros (S108): sus parámetros, su dibujo y su textura. */
  private readonly cfg: FlockParams;
  private readonly art: Record<number, readonly [readonly string[], readonly string[]]>;
  private readonly key: string;
  private readonly birds: { img: Phaser.GameObjects.Image; size: number }[] = [];
  private readonly slots: FlockSlot[] = [];
  private readonly shadows: Phaser.GameObjects.Image[] = [];
  private readonly rand = new Phaser.Math.RandomDataGenerator(['skyLife']);
  private readonly randFn = () => this.rand.frac();
  /** La bandada en curso: cuántos, de cuándo a cuándo (ms de juego), sentido y altura del guía (px de arte). */
  private flock = { n: 0, start: 0, end: 0, dir: 1 as 1 | -1, y: 0 };
  private next = -1;
  /** Esquina y escala de la imagen en el último cuadro (para pasar a px de arte en `debugState`). */
  private frame = [0, 0, 1, 1];

  constructor(
    scene: Phaser.Scene,
    private readonly place: SkyLifePlacement,
    private readonly imageWidth: number,
    depth: number,
  ) {
    const parrots = place.flock === 'parrots';
    this.cfg = parrots ? LIFE.parrots : LIFE.birds;
    this.art = parrots ? PARROT_ART : BIRD_ART;
    this.key = parrots ? PARROT_KEY : BIRD_KEY;
    makeSkyLifeTextures(scene);
    makeFlockTexture(scene, this.key, this.art);
    const b = this.cfg;
    const birdColor = Phaser.Display.Color.HexStringToColor(b.color).color;
    for (let i = 0; i < b.countMax; i++) {
      const img = scene.add.image(0, 0, this.key, `b${b.sizeMax}_0`).setScrollFactor(0).setTint(birdColor).setAlpha(b.alpha).setDepth(depth + 0.02).setVisible(false);
      this.birds.push({ img, size: b.sizeMax });
      this.slots.push({ back: 0, dy: 0, phase: 0 });
    }
    const shadowColor = Phaser.Display.Color.HexStringToColor(LIFE.shadowColor).color;
    for (let i = 0; place.shadows && i < LIFE.shadows.length; i++) {
      this.shadows.push(
        scene.add.image(0, 0, SHADOW_KEY).setOrigin(0).setScrollFactor(0).setTint(shadowColor).setAlpha(LIFE.shadowAlpha).setDepth(depth).setVisible(false),
      );
    }
    // Los loros (S108): la primera bandada cruza hacia donde va Kerana.
    this.flock.dir = parrots || this.rand.frac() < 0.5 ? 1 : -1;
  }

  get layers(): Phaser.GameObjects.GameObject[] {
    return [...this.shadows, ...this.birds.map((b) => b.img)];
  }

  /**
   * `left`, `top`: esquina de la imagen en la vista; `sx`, `sy`: unidades por px de arte. `on`: la imagen a la vista.
   * `outside` (S108): la vista está afuera de la cueva; la espera de la primera bandada empieza ahí.
   */
  update(left: number, top: number, sx: number, sy: number, now: number, on: boolean, outside = true): void {
    this.frame[0] = left;
    this.frame[1] = top;
    this.frame[2] = sx;
    this.frame[3] = sy;
    this.updateShadows(left, top, sx, sy, now, on);
    this.updateBirds(left, top, sx, sy, now, on, outside);
  }

  private updateShadows(left: number, top: number, sx: number, sy: number, now: number, on: boolean): void {
    if (!this.place.shadows) return;
    const [y0, y1] = this.place.shadows;
    LIFE.shadows.forEach((d, i) => {
      const img = this.shadows[i]!;
      img.setVisible(on);
      if (!on) return;
      const x = shadowLeft(now, d.speed, this.imageWidth, d.width, d.offset);
      const y = y0 + d.at * (y1 - y0) - d.height / 2;
      img.setPosition(left + x * sx, top + y * sy).setDisplaySize(d.width * sx, d.height * sy);
    });
  }

  private updateBirds(left: number, top: number, sx: number, sy: number, now: number, on: boolean, outside: boolean): void {
    const b = this.cfg;
    if (this.next < 0 && outside) this.next = now + this.rand.between(b.firstMinMs, b.firstMaxMs);
    if (this.flock.n === 0 && this.next >= 0 && now >= this.next) this.launch(now);
    const f = this.flock;
    if (f.n > 0 && now >= f.end) {
      f.n = 0;
      f.dir = f.dir > 0 ? -1 : 1;
      this.next = now + this.rand.between(b.gapMinMs, b.gapMaxMs);
    }
    const lead = f.n > 0 ? flockLeadX((now - f.start) / (f.end - f.start), f.dir, this.imageWidth, b.margin) : 0;
    for (let i = 0; i < this.birds.length; i++) {
      const bird = this.birds[i]!;
      const show = on && i < f.n;
      bird.img.setVisible(show);
      if (!show) continue;
      const slot = this.slots[i]!;
      const frame = Math.floor((now / b.flapMs + slot.phase) * 2) % 2;
      const bob = b.bob * Math.sin((2 * Math.PI * now) / b.bobMs + slot.phase * 2 * Math.PI);
      const x = lead - f.dir * slot.back;
      const y = f.y + slot.dy + bob;
      const art = this.art[bird.size]!;
      bird.img
        .setFrame(`b${bird.size}_${frame}`)
        .setFlipX(f.dir < 0)
        .setPosition(left + x * sx, top + y * sy)
        .setDisplaySize(bird.size * sx, art[0].length * sy);
    }
  }

  /** Arma una bandada nueva: cuántos, de qué tamaño, la V, la altura y cuánto tarda. */
  private launch(now: number): void {
    const b = this.cfg;
    const f = this.flock;
    f.n = this.rand.between(b.countMin, b.countMax);
    f.start = now;
    f.end = now + this.rand.between(b.crossMinMs, b.crossMaxMs);
    flockLayout(f.n, b.spacingX, b.spacingY, b.jitter, this.randFn, this.slots);
    // Un ancho con dibujo, entre el mínimo y el máximo.
    const sizes = Object.keys(this.art).map(Number).filter((w) => w >= b.sizeMin && w <= b.sizeMax);
    for (let i = 0; i < f.n; i++) this.birds[i]!.size = sizes[this.rand.between(0, sizes.length - 1)] ?? b.sizeMax;
    // El guía, a una altura que deja entera a la V (con su vaivén y medio pájaro) dentro de la franja.
    const margin = flockSpread(b.countMax, b.spacingY, b.jitter, b.bob) + 2;
    const [y0, y1] = this.place.birds;
    f.y = this.rand.realInRange(y0 + margin, Math.max(y0 + margin, y1 - margin));
  }

  /** Para la prueba de humo y las capturas: pájaros y sombras a la vista, en px de arte de la imagen. */
  debugState(): { birds: { x: number; y: number; size: number }[]; dir: number; nextMs: number; shadows: { x: number; y: number; width: number; height: number }[] } {
    const [left, top, sx, sy] = this.frame;
    return {
      birds: this.birds.filter((b) => b.img.visible).map((b) => ({ x: (b.img.x - left) / sx, y: (b.img.y - top) / sy, size: b.size })),
      dir: this.flock.dir,
      nextMs: this.flock.n > 0 ? 0 : this.next,
      shadows: this.shadows
        .filter((s) => s.visible)
        .map((s) => ({ x: (s.x - left) / sx, y: (s.y - top) / sy, width: s.displayWidth / sx, height: s.displayHeight / sy })),
    };
  }

  /** Para las capturas: que la próxima bandada salga ya. */
  debugLaunch(now: number): void {
    if (this.flock.n === 0) this.next = now;
  }
}

/** Las siluetas de los pájaros (un cuadro por ancho y aleteo) y la mancha de las sombras (elipse de borde suave). */
function makeSkyLifeTextures(scene: Phaser.Scene): void {
  if (!scene.textures.exists(SHADOW_KEY)) {
    const w = 64;
    const h = 32;
    const tex = scene.textures.createCanvas(SHADOW_KEY, w, h);
    if (tex) {
      const ctx = tex.getContext();
      const img = ctx.createImageData(w, h);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          // Elipse: 1 en el centro, 0 en el borde, con un desvanecido suave (smoothstep).
          const dx = (x + 0.5) / w - 0.5;
          const dy = (y + 0.5) / h - 0.5;
          const d = Math.min(1, Math.sqrt(dx * dx + dy * dy) * 2);
          const t = 1 - d;
          img.data.set([255, 255, 255, Math.round(255 * t * t * (3 - 2 * t))], (y * w + x) * 4);
        }
      }
      ctx.putImageData(img, 0, 0);
      tex.refresh();
      tex.setFilter(Phaser.Textures.FilterMode.LINEAR);
    }
  }
}

/** Las siluetas de una bandada (un cuadro por ancho y aleteo, `#` es un píxel): `b<ancho>_<cuadro>`. */
function makeFlockTexture(scene: Phaser.Scene, key: string, art: Record<number, readonly [readonly string[], readonly string[]]>): void {
  if (scene.textures.exists(key)) return;
  const sizes = Object.keys(art).map(Number);
  const rows = Math.max(...sizes.map((s) => art[s]![0].length));
  const tex = scene.textures.createCanvas(key, sizes.reduce((w, s) => w + s + 1, 0) * 2, rows);
  if (!tex) return;
  const ctx = tex.getContext();
  ctx.fillStyle = '#ffffff';
  let x = 0;
  for (const size of sizes) {
    art[size]!.forEach((lines, frame) => {
      lines.forEach((row, y) => [...row].forEach((c, dx) => c === '#' && ctx.fillRect(x + dx, y, 1, 1)));
      tex.add(`b${size}_${frame}`, 0, x, 0, size, lines.length);
      x += size + 1;
    });
  }
  tex.refresh();
}

const DUSK = GAMEPLAY.backdrop.dusk;
const RAY_KEY = 'bg_dusk_ray';
/** Textura del rayo (px): angosta abajo, abierta arriba; se estira y se gira con filtro lineal. */
const RAY_TEX = [32, 128] as const;

/** El atardecer de un fondo (`dusk` en levels.ts), en px de arte de la imagen. */
export interface DuskPlacement {
  rays: readonly [number, number];
  valleys: ReadonlyArray<{ line: readonly number[]; layer: number }>;
}

type Pix = { data: ArrayLike<number>; width: number; height: number };

/**
 * Copia los píxeles de la imagen que cumplen `keep(i, x, y, …)` dentro de cada rectángulo `i` (x0, y0, x1, y1; el fin
 * adentro) a una textura `key` del mismo tamaño que la imagen, en el mismo lugar; lo demás queda transparente. Se dibuja
 * en la misma posición y escala que la imagen, con `setCrop` al rectángulo: así cae exacto sobre su grilla (un recorte
 * aparte, redondeado por su cuenta, dejaba costuras de un píxel). Una vez por partida.
 */
function cutouts(
  scene: Phaser.Scene,
  key: string,
  src: Pix,
  rects: ReadonlyArray<readonly [number, number, number, number]>,
  keep: (i: number, x: number, y: number, r: number, g: number, b: number) => boolean,
): boolean {
  if (scene.textures.exists(key)) return true;
  const tex = scene.textures.createCanvas(key, src.width, src.height);
  if (!tex) return false;
  const ctx = tex.getContext();
  const out = ctx.createImageData(src.width, src.height);
  rects.forEach((r, i) => {
    for (let y = Math.max(0, r[1]); y <= Math.min(src.height - 1, r[3]); y++) {
      for (let x = Math.max(0, r[0]); x <= Math.min(src.width - 1, r[2]); x++) {
        const s = (y * src.width + x) * 4;
        if (!keep(i, x, y, src.data[s]!, src.data[s + 1]!, src.data[s + 2]!)) continue;
        out.data[s] = src.data[s]!;
        out.data[s + 1] = src.data[s + 1]!;
        out.data[s + 2] = src.data[s + 2]!;
        out.data[s + 3] = 255;
      }
    }
  });
  ctx.putImageData(out, 0, 0);
  tex.refresh();
  return true;
}

/**
 * El atardecer de l1 (S108): rayos de luz que salen de detrás de las sierras y bruma en los valles del bosque. Todo
 * pegado a la imagen lejana, como `SunShimmer`: `update` recibe su esquina y su escala. La base de los rayos y el pie de
 * cada jirón quedan tapados por la misma imagen recortada (la sierra, la loma de adelante): así salen «de detrás» sin
 * máscaras. Texturas una vez; nada se crea por cuadro.
 */
export class DuskGlow {
  private readonly rays: { img: Phaser.GameObjects.Image; def: (typeof DUSK.rays.list)[number] }[] = [];
  /**
   * Lo que tapa, en columnas angostas de alto justo (`group` 0: la sierra de los rayos; 1 en adelante, cada valle): un
   * rectángulo entero por valle era casi todo transparente y costaba cuadros. Las de un valle se dibujan solo bajo un
   * jirón.
   */
  private readonly covers: { img: Phaser.GameObjects.Image; group: number; x0: number; y0: number; x1: number; y1: number }[] = [];
  /** Por valle, qué columnas de su tapa tienen un jirón encima en este cuadro. */
  private readonly under: Uint8Array[] = [];
  /** Para medir (S108): cada parte se puede apagar desde la consola de depuración. */
  readonly parts = { rays: true, mist: true, covers: true };
  /** Si en el cuadro anterior se dibujó algo (si no, apagado no hay nada que esconder). */
  private drawn = true;
  private readonly wisps: {
    img: Phaser.GameObjects.Image;
    line: readonly number[];
    x0: number;
    x1: number;
    layer: (typeof DUSK.mist.layers)[number];
    /** Qué valle (índice en `place.valleys`). */
    valley: number;
    alpha: number;
    width: number;
    height: number;
    offset: number;
    cell: number;
    top: number;
  }[] = [];
  /** Fila del cielo por columna (px de arte): nada de bruma arriba de esto. */
  private readonly skyline: Int16Array;
  /** Último estado (para la prueba de humo y las capturas). */
  private readonly shown = { rays: 0, wisps: 0, alpha: 0 };
  private coversShown = 0;

  constructor(
    scene: Phaser.Scene,
    private readonly place: DuskPlacement,
    key: string,
    pixels: Pix | undefined,
    depth: number,
  ) {
    this.skyline = pixels ? skylineRows(pixels.data, pixels.width, pixels.height, 460, DUSK.skyRedOverBlue, DUSK.skyMinLum) : new Int16Array(0);
    makeDuskTextures(scene);
    const rc = DUSK.rays;
    const rayColor = Phaser.Display.Color.HexStringToColor(rc.color).color;
    for (const def of rc.list) {
      const img = scene.add
        .image(0, 0, RAY_KEY)
        .setOrigin(0.5, 1)
        .setScrollFactor(0)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setTint(rayColor)
        .setAngle(def.angle)
        .setDepth(depth)
        .setVisible(false);
      this.rays.push({ img, def });
    }
    if (!pixels) return;
    // Lo que tapa: la sierra alrededor de la fuente (todo lo que no es cielo) y, por valle, la franja de la loma de
    // adelante que puede quedar debajo de un jirón.
    const [sx0, sy0] = place.rays;
    const W = pixels.width;
    const x0 = Math.max(0, sx0 - rc.coverHalfWidth);
    const x1 = Math.min(W - 1, sx0 + rc.coverHalfWidth);
    const rects: (readonly [number, number, number, number])[] = [[x0, 0, x1, 0]];
    const reach: ((x: number) => [number, number])[] = [(x) => [this.skyline[x]!, sy0 + rc.coverBelow]];
    const mc = DUSK.mist;
    for (const v of place.valleys) {
      const layer = mc.layers[v.layer] ?? mc.layers[mc.layers.length - 1]!;
      const vx0 = v.line[0]!;
      const vx1 = v.line[v.line.length - 2]!;
      const span = (x: number): [number, number] => {
        const y = Math.round(polylineY(v.line, x));
        return [y, Math.ceil(polylineMax(v.line, x - layer.width, x + layer.width)) + mc.pad + 1];
      };
      rects.push([vx0, 0, vx1, 0]);
      reach.push(span);
      this.under.push(new Uint8Array(Math.ceil((vx1 - vx0 + 1) / COVER_COLUMN)));
    }
    // Cada tapa, en columnas de `COVER_COLUMN` px con el alto justo de lo que tapa en esa columna.
    const columns = rects.map((r, g) => {
      const out: (readonly [number, number, number, number])[] = [];
      for (let c0 = r[0]; c0 <= r[2]; c0 += COVER_COLUMN) {
        const c1 = Math.min(r[2], c0 + COVER_COLUMN - 1);
        let lo = Infinity;
        let hi = -Infinity;
        for (let x = c0; x <= c1; x++) {
          const [a, b] = reach[g]!(x);
          lo = Math.min(lo, a);
          hi = Math.max(hi, b);
        }
        out.push([c0, lo, c1, hi]);
      }
      return out;
    });
    const coverKey = key + '__dusk';
    const all = columns.flat();
    const groupOf = columns.flatMap((cols, g) => cols.map(() => g));
    const ok = cutouts(scene, coverKey, pixels, all, (i, x, y) => {
      const [a, b] = reach[groupOf[i]!]!(x);
      return y >= a && y <= b;
    });
    if (!ok) return;
    const addCovers = (g: number, d: number) => {
      for (const r of columns[g]!) this.covers.push({ img: this.coverImage(scene, coverKey, r, d), group: g, x0: r[0], y0: r[1], x1: r[2], y1: r[3] });
    };
    // Orden de atrás hacia adelante: rayos, sierra; y por valle (del más lejano al más cercano), jirones y su loma.
    const order = place.valleys.map((v, i) => ({ v, i })).sort((a, b) => a.v.layer - b.v.layer || a.i - b.i);
    addCovers(0, depth + 0.005);
    const rand = new Phaser.Math.RandomDataGenerator(['dusk', String(mc.seed)]);
    order.forEach(({ v, i }, k) => {
      const layer = mc.layers[v.layer] ?? mc.layers[mc.layers.length - 1]!;
      const vx0 = v.line[0]!;
      const vx1 = v.line[v.line.length - 2]!;
      const count = Math.max(1, Math.ceil((vx1 - vx0 + layer.width) / layer.gap));
      const d = depth + 0.01 + 0.02 * k;
      for (let n = 0; n < count; n++) {
        const shape = rand.between(0, mc.shapes - 1);
        const img = scene.add
          .image(0, 0, WISP_KEY, `w${Math.min(v.layer, mc.layers.length - 1)}_${shape}`)
          .setOrigin(0)
          .setScrollFactor(0)
          .setFlipX(rand.frac() < 0.5)
          .setDepth(d)
          .setVisible(false);
        const alpha = layer.alpha * (1 - mc.alphaVary * rand.frac());
        this.wisps.push({ img, line: v.line, x0: vx0, x1: vx1, layer, valley: i, alpha, width: layer.width, height: layer.height, offset: (n + 0.5 * rand.frac()) / count, cell: Number.NaN, top: 0 });
      }
      addCovers(i + 1, d + 0.01);
    });
    const tint = Phaser.Display.Color.HexStringToColor(mc.color).color;
    for (const w of this.wisps) w.img.setTint(tint);
  }

  private coverImage(scene: Phaser.Scene, key: string, r: readonly [number, number, number, number], depth: number): Phaser.GameObjects.Image {
    return scene.add
      .image(0, 0, key)
      .setOrigin(0)
      .setScrollFactor(0)
      .setCrop(r[0], r[1], r[2] - r[0] + 1, r[3] - r[1] + 1)
      .setDepth(depth)
      .setVisible(false);
  }

  get layers(): Phaser.GameObjects.GameObject[] {
    return [...this.rays.map((r) => r.img), ...this.covers.map((c) => c.img), ...this.wisps.map((w) => w.img)];
  }

  /** Lo recortado de la imagen va con su mismo tinte (S108): si no, se notaría la costura. */
  setTint(tint: number): void {
    for (const c of this.covers) c.img.setTint(tint);
  }

  /**
   * `left`, `top`: esquina de la imagen en la vista; `sx`, `sy`: unidades por px de arte. `on`: la imagen a la vista.
   * `calm`: «Destellos» apagado; los rayos quedan quietos en su medio, sin respirar. `hidden(x0, y0, x1, y1)`: ese
   * rectángulo (misma escala que `left`) lo tapa entero algo opaco (el cerro, el fondo de cueva): ahí no se dibuja.
   */
  update(left: number, top: number, sx: number, sy: number, now: number, on: boolean, calm: boolean, hidden: Hidden = NEVER_HIDDEN): void {
    if (!on && !this.drawn) return;
    this.drawn = on;
    const rc = DUSK.rays;
    const [fx, fy] = this.place.rays;
    const parts = this.parts;
    let alphaSum = 0;
    for (const r of this.rays) {
      r.img.setVisible(on && parts.rays);
      if (!on || !parts.rays) continue;
      const d = r.def;
      // Opacidad y ancho respiran con el mismo ciclo, el ancho un poco corrido.
      const k = calm ? 0.5 : sunPulse(now + d.phase * d.periodMs, d.periodMs);
      const kw = calm ? 0.5 : sunPulse(now + (d.phase + 0.3) * d.periodMs, d.periodMs * 1.17);
      const alpha = rc.alphaMin + (rc.alphaMax - rc.alphaMin) * k;
      alphaSum += alpha;
      r.img
        .setPosition(left + fx * sx, top + fy * sy)
        .setDisplaySize(d.width * (rc.widthMin + (rc.widthMax - rc.widthMin) * kw) * sx, d.length * sy)
        .setAlpha(alpha);
    }
    const mc = DUSK.mist;
    let shown = 0;
    for (const u of this.under) u.fill(0);
    for (const w of this.wisps) {
      const x = wispLeft(now, w.layer.speed, w.x0, w.x1, w.width, w.offset);
      const fade = wispFade(x, w.width, w.x0, w.x1, mc.fade);
      let show = on && parts.mist && fade > 0;
      if (show) {
        // La altura cambia con la cresta de abajo: se recalcula solo al pasar a otro px de arte.
        const cell = Math.floor(x);
        if (cell !== w.cell) {
          w.cell = cell;
          w.top = wispTop(w.line, this.skyline, cell, w.width, w.height, mc.pad, mc.skyMargin);
        }
        // Lo que tapa entero el cerro o la cueva no se dibuja: en el primer tramo, casi todos los valles de abajo.
        show = !hidden(left + x * sx, top + w.top * sy, left + (x + w.width) * sx, top + (w.top + w.height) * sy);
      }
      w.img.setVisible(show);
      if (!show) continue;
      shown++;
      w.img.setPosition(left + x * sx, top + w.top * sy).setDisplaySize(w.width * sx, w.height * sy).setAlpha(w.alpha * fade);
      // Las columnas de la tapa que quedan debajo de este jirón.
      const u = this.under[w.valley]!;
      const c0 = Math.max(0, Math.floor((x - w.x0) / COVER_COLUMN));
      const c1 = Math.min(u.length - 1, Math.floor((x + w.width - w.x0) / COVER_COLUMN));
      for (let c = c0; c <= c1; c++) u[c] = 1;
    }
    // En la misma esquina y escala que la imagen: el recorte cae justo sobre sus píxeles. La sierra, si hay rayos; cada
    // columna de un valle, si tiene un jirón encima.
    let covers = 0;
    for (const c of this.covers) {
      const need = c.group === 0 ? parts.rays : this.under[c.group - 1]![Math.floor((c.x0 - this.place.valleys[c.group - 1]!.line[0]!) / COVER_COLUMN)] === 1;
      const show = on && parts.covers && need && !hidden(left + c.x0 * sx, top + c.y0 * sy, left + (c.x1 + 1) * sx, top + (c.y1 + 1) * sy);
      c.img.setVisible(show);
      if (show) {
        c.img.setPosition(left, top).setScale(sx, sy);
        covers++;
      }
    }
    this.coversShown = covers;
    this.shown.rays = on && parts.rays ? this.rays.length : 0;
    this.shown.wisps = shown;
    this.shown.alpha = alphaSum / Math.max(1, this.rays.length);
  }

  /** Para la prueba de humo y las capturas: rayos y jirones a la vista, y la línea del cielo medida en la imagen. */
  debugState(): { rays: number; rayAlpha: number; wisps: number; covers: number; skyline: number[] } {
    const sky: number[] = [];
    for (let x = 0; x < this.skyline.length; x += 64) sky.push(this.skyline[x]!);
    return { rays: this.shown.rays, rayAlpha: this.shown.alpha, wisps: this.shown.wisps, covers: this.coversShown, skyline: sky };
  }

  /** Para las pruebas de las capturas: cada jirón a la vista (px de arte). */
  debugWisps(): { x: number; top: number; width: number; height: number }[] {
    return this.wisps.filter((w) => w.img.visible).map((w) => ({ x: Math.floor(w.cell), top: w.top, width: w.width, height: w.height }));
  }
}

/** Ancho (px de arte) de cada columna de lo que tapa. */
const COVER_COLUMN = 32;
/** ¿Algo opaco tapa entero este rectángulo de la vista? */
export type Hidden = (x0: number, y0: number, x1: number, y1: number) => boolean;
const NEVER_HIDDEN: Hidden = () => false;

const WISP_KEY = 'bg_dusk_wisps';

/** El rayo (degradado, filtro lineal) y los jirones de bruma de cada capa (tramados, sin filtro). */
function makeDuskTextures(scene: Phaser.Scene): void {
  if (!scene.textures.exists(RAY_KEY)) {
    const [w, h] = RAY_TEX;
    const tex = scene.textures.createCanvas(RAY_KEY, w, h);
    if (tex) {
      const img = tex.getContext().createImageData(w, h);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) img.data.set([255, 255, 255, Math.round(255 * rayAlphaAt(x, y, w, h, DUSK.rays.base, DUSK.rays.peakAt))], (y * w + x) * 4);
      }
      tex.getContext().putImageData(img, 0, 0);
      tex.refresh();
      tex.setFilter(Phaser.Textures.FilterMode.LINEAR);
    }
  }
  if (!scene.textures.exists(WISP_KEY)) {
    const mc = DUSK.mist;
    const sizes: (readonly [number, number])[] = [];
    // A la escala del píxel del arte (`texel`): el jirón se agranda al dibujarlo.
    const tw = (l: (typeof mc.layers)[number]) => Math.max(2, Math.round(l.width / mc.texel));
    const th = (l: (typeof mc.layers)[number]) => Math.max(2, Math.round(l.height / mc.texel));
    mc.layers.forEach((l) => {
      for (let s = 0; s < mc.shapes; s++) sizes.push([tw(l), th(l)]);
    });
    const pack = shelfPack(sizes, 2048);
    const tex = scene.textures.createCanvas(WISP_KEY, pack.width, pack.height);
    if (!tex) return;
    const ctx = tex.getContext();
    const out = ctx.createImageData(pack.width, pack.height);
    const rand = seeded(mc.seed);
    let k = 0;
    mc.layers.forEach((l, li) => {
      for (let s = 0; s < mc.shapes; s++, k++) {
        const w = tw(l);
        const h = th(l);
        const alpha = new Uint8ClampedArray(w * h);
        paintWisp(w, h, rand, mc, alpha);
        const at = pack.at[k]!;
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) out.data.set([255, 255, 255, alpha[y * w + x]!], ((at.y + y) * pack.width + at.x + x) * 4);
        }
        tex.add(`w${li}_${s}`, 0, at.x, at.y, w, h);
      }
    });
    ctx.putImageData(out, 0, 0);
    tex.refresh();
  }
}

const CAVE = GAMEPLAY.backdrop.caveLife;
const CAVE_FX_KEY = 'bg_cave_fx';
const CAVE_HALO_KEY = 'bg_cave_halo';
/** Lo chico de la cueva, en px de arte (`#` lleno, `+` medio, `-` tenue): estrellas, gota, salpicón y murciélago. */
const CAVE_FX_ART: Record<string, readonly string[]> = {
  star5: ['..-..', '..+..', '-+#+-', '..+..', '..-..'],
  star3: ['.+.', '+#+', '.+.'],
  dot: ['#'],
  drop: ['+', '#'],
  splash: ['+.+', '.#.'],
  bat0: ['#.......#', '##.....##', '.##.#.##.', '...###...'],
  bat1: ['.........', '###.#.###', '.#######.', '...###...'],
  bat2: ['.........', '...#.#...', '.#######.', '##..#..##'],
};

/** La cueva con vida (`caveLife` en levels.ts), en px de arte de la imagen de cueva. */
export interface CaveLifePlacement {
  bats: readonly [number, number];
  crystals: ReadonlyArray<readonly [number, number, number, number]>;
  gold: readonly [number, number, number, number];
  drops: ReadonlyArray<readonly [number, number, number]>;
  dust: readonly [number, number, number, number];
}

type Clip = { left: number; right: number };

/**
 * La cueva de l1 con vida (S108): murciélagos que cruzan lejos, cristales que laten y destellan, chispas sobre el oro,
 * gotas que caen de las estalactitas y polvo que flota. Pegado a la imagen de cueva y solo donde se ve (el tramo de las
 * zonas `Cave`): lo grande se recorta (`setCrop`) y lo chico se funde en el borde. Pools fijos; nada se crea por cuadro.
 */
export class CaveLife {
  private readonly crystals: {
    cut: Phaser.GameObjects.Image;
    halo: Phaser.GameObjects.Image;
    rect: readonly [number, number, number, number];
    period: number;
    phase: number;
    /** Píxeles de cristal de la mitad de arriba (donde destella), plano x, y. */
    tips: number[];
  }[] = [];
  private readonly star: Phaser.GameObjects.Image;
  private flash = { crystal: -1, x: 0, y: 0, start: 0, next: -1 };
  private readonly gold: number[];
  private readonly sparks: { img: Phaser.GameObjects.Image; x: number; y: number; born: number; life: number }[] = [];
  private readonly drops: {
    img: Phaser.GameObjects.Image;
    splash: Phaser.GameObjects.Image;
    tip: readonly [number, number, number];
    /** Cuándo empieza a formarse, cuándo se suelta y cuándo llega (ms de juego). */
    form: number;
    fall: number;
    land: number;
  }[] = [];
  private readonly dust: { img: Phaser.GameObjects.Image; x: number; y: number; vx: number; vy: number; born: number; life: number; phase: number }[] = [];
  private readonly bats: { img: Phaser.GameObjects.Image; back: number; dy: number; zigMs: number; phase: number; flap: number }[] = [];
  private group = { n: 0, start: 0, end: 0, dir: 1 as 1 | -1, y: 0 };
  private nextBats = -1;
  private readonly rand = new Phaser.Math.RandomDataGenerator(['caveLife']);
  private frame = [0, 0, 1, 1];
  /** El tramo de la cueva a la vista y si se ve, del cuadro en curso (para `put`). */
  private readonly clip: Clip = { left: 0, right: 0 };
  private on = false;
  private wasHidden = false;

  constructor(
    scene: Phaser.Scene,
    private readonly place: CaveLifePlacement,
    key: string,
    pixels: Pix | undefined,
    private readonly imageWidth: number,
    depth: number,
  ) {
    makeCaveTextures(scene);
    const cc = CAVE.crystals;
    // Los cristales: cada grupo, sus píxeles de cristal sumados sobre sí mismos, y un halo de su color.
    if (pixels) {
      const kinds = place.crystals.map(() => [0, 0, 0]);
      const tips: number[][] = place.crystals.map(() => []);
      const cutKey = key + '__crystals';
      const ok = cutouts(scene, cutKey, pixels, place.crystals, (i, x, y, r, g, b) => {
        const k = crystalKind(r, g, b, cc);
        if (k === 0) return false;
        kinds[i]![k]!++;
        const rect = place.crystals[i]!;
        if (y < (rect[1] + rect[3]) / 2) tips[i]!.push(x, y);
        return true;
      });
      // Si la textura ya estaba (otra partida), se cuentan los colores igual.
      if (ok && kinds.every((k) => k[1] + k[2] === 0)) {
        place.crystals.forEach((rect, i) => {
          for (let y = rect[1]; y <= rect[3]; y++) {
            for (let x = rect[0]; x <= rect[2]; x++) {
              const s = (y * pixels.width + x) * 4;
              const k = crystalKind(pixels.data[s]!, pixels.data[s + 1]!, pixels.data[s + 2]!, cc);
              if (k === 0) continue;
              kinds[i]![k]!++;
              if (y < (rect[1] + rect[3]) / 2) tips[i]!.push(x, y);
            }
          }
        });
      }
      if (ok) {
        const violet = Phaser.Display.Color.HexStringToColor(cc.violet).color;
        const cyan = Phaser.Display.Color.HexStringToColor(cc.cyan).color;
        place.crystals.forEach((rect, i) => {
          const cut = scene.add.image(0, 0, cutKey).setOrigin(0).setScrollFactor(0).setBlendMode(Phaser.BlendModes.ADD).setDepth(depth + 0.02).setVisible(false);
          const halo = scene.add
            .image(0, 0, CAVE_HALO_KEY)
            .setOrigin(0)
            .setScrollFactor(0)
            .setBlendMode(Phaser.BlendModes.ADD)
            .setTint(kinds[i]![2]! > kinds[i]![1]! ? cyan : violet)
            .setDepth(depth + 0.01)
            .setVisible(false);
          this.crystals.push({ cut, halo, rect, period: this.rand.between(cc.periodMinMs, cc.periodMaxMs), phase: this.rand.frac(), tips: tips[i]! });
        });
      }
    }
    this.star = scene.add.image(0, 0, CAVE_FX_KEY, 'star5').setOrigin(0.5).setScrollFactor(0).setBlendMode(Phaser.BlendModes.ADD).setDepth(depth + 0.03).setVisible(false);
    // El oro: chispas que caen sobre píxeles de oro medidos en la imagen.
    const gc = CAVE.gold;
    this.gold = pixels ? goldPixels(pixels.data, pixels.width, place.gold, gc.minYellow) : [];
    const goldColor = Phaser.Display.Color.HexStringToColor(gc.color).color;
    for (let i = 0; i < gc.count; i++) {
      const img = scene.add.image(0, 0, CAVE_FX_KEY, 'star3').setOrigin(0.5).setScrollFactor(0).setBlendMode(Phaser.BlendModes.ADD).setTint(goldColor).setDepth(depth + 0.03).setVisible(false);
      this.sparks.push({ img, x: 0, y: 0, born: this.rand.between(0, gc.gapMaxMs), life: 0 });
    }
    // Las gotas: cada estalactita la suya, con su salpicón.
    const dc = CAVE.drops;
    const dropColor = Phaser.Display.Color.HexStringToColor(dc.color).color;
    for (const tip of place.drops) {
      const img = scene.add.image(0, 0, CAVE_FX_KEY, 'drop').setOrigin(0.5, 1).setScrollFactor(0).setTint(dropColor).setDepth(depth + 0.04).setVisible(false);
      const splash = scene.add.image(0, 0, CAVE_FX_KEY, 'splash').setOrigin(0.5, 1).setScrollFactor(0).setBlendMode(Phaser.BlendModes.ADD).setTint(dropColor).setDepth(depth + 0.04).setVisible(false);
      const form = this.rand.between(0, dc.gapMaxMs);
      this.drops.push({ img, splash, tip, form, fall: form + dc.formMs, land: form + dc.formMs + dropFallMs(tip[2] - tip[1], dc.gravity) });
    }
    // El polvo.
    const uc = CAVE.dust;
    const dustColor = Phaser.Display.Color.HexStringToColor(uc.color).color;
    for (let i = 0; i < uc.count; i++) {
      const img = scene.add.image(0, 0, CAVE_FX_KEY, 'dot').setOrigin(0.5).setScrollFactor(0).setTint(dustColor).setDepth(depth + 0.005).setVisible(false);
      const mote = { img, x: 0, y: 0, vx: 0, vy: 0, born: 0, life: 1, phase: 0 };
      this.respawnDust(mote, 0);
      // Arrancan a mitad de su vida, repartidas.
      mote.born -= this.rand.frac() * mote.life;
      this.dust.push(mote);
    }
    // Los murciélagos.
    const bc = CAVE.bats;
    const batColor = Phaser.Display.Color.HexStringToColor(bc.color).color;
    for (let i = 0; i < bc.countMax; i++) {
      const img = scene.add.image(0, 0, CAVE_FX_KEY, 'bat0').setOrigin(0.5).setScrollFactor(0).setTint(batColor).setAlpha(bc.alpha).setDepth(depth).setVisible(false);
      this.bats.push({ img, back: 0, dy: 0, zigMs: bc.zigMinMs, phase: 0, flap: 0 });
    }
    this.group.dir = this.rand.frac() < 0.5 ? 1 : -1;
  }

  get layers(): Phaser.GameObjects.GameObject[] {
    return [
      ...this.crystals.flatMap((c) => [c.halo, c.cut]),
      this.star,
      ...this.sparks.map((s) => s.img),
      ...this.drops.flatMap((d) => [d.img, d.splash]),
      ...this.dust.map((d) => d.img),
      ...this.bats.map((b) => b.img),
    ];
  }

  /**
   * `left`, `top`: esquina de la imagen de cueva en la vista; `sx`, `sy`: unidades por px de arte. `on`: la cueva a la
   * vista; `clip`: el tramo de la vista donde se ve (misma escala que `left`). `flashes`: «Destellos» encendido.
   */
  update(left: number, top: number, sx: number, sy: number, now: number, on: boolean, clip: Clip, flashes: boolean): void {
    // Afuera de la cueva, una vez escondido todo, no hay nada que hacer (los tiempos se ponen al día al volver).
    if (!on && !this.on && this.wasHidden) return;
    this.wasHidden = !on;
    this.frame[0] = left;
    this.frame[1] = top;
    this.frame[2] = sx;
    this.frame[3] = sy;
    this.clip.left = clip.left;
    this.clip.right = clip.right;
    this.on = on;
    this.updateCrystals(left, top, sx, sy, now, on, clip, flashes);
    this.updateGold(now, flashes);
    this.updateDrops(now, flashes);
    this.updateDust(now);
    this.updateBats(now, on);
  }

  /** Pone algo chico en (`ax`, `ay`) px de arte, a la escala de la imagen, fundido en el borde del tramo de cueva. */
  private put(img: Phaser.GameObjects.Image, ax: number, ay: number, alpha: number): void {
    const [left, top, sx, sy] = this.frame;
    const x = left + ax * sx;
    const a = this.on ? alpha * spanAlpha(x, this.clip.left, this.clip.right, CAVE.edgeFade) : 0;
    img.setVisible(a > 0);
    if (a > 0) img.setPosition(x, top + ay * sy).setScale(sx, sy).setAlpha(a);
  }

  private updateCrystals(
    left: number,
    top: number,
    sx: number,
    sy: number,
    now: number,
    on: boolean,
    clip: Clip,
    flashes: boolean,
  ): void {
    const cc = CAVE.crystals;
    // Un destello a la vez, en un cristal al azar que esté a la vista.
    const f = this.flash;
    if (f.next < 0) f.next = now + this.rand.between(cc.flashGapMinMs, cc.flashGapMaxMs);
    if (f.crystal >= 0 && now >= f.start + cc.flashMs) {
      f.crystal = -1;
      f.next = now + this.rand.between(cc.flashGapMinMs, cc.flashGapMaxMs);
    }
    if (f.crystal < 0 && now >= f.next && flashes && on && this.crystals.length > 0) {
      // Entre los que se ven ahora (el cuadro anterior): un destello fuera de la vista no lo ve nadie.
      let seen = 0;
      for (const c of this.crystals) if (c.cut.visible && c.tips.length >= 2) seen++;
      let pick = this.rand.between(0, Math.max(0, seen - 1));
      let i = -1;
      for (let k = 0; k < this.crystals.length && i < 0; k++) if (this.crystals[k]!.cut.visible && this.crystals[k]!.tips.length >= 2 && pick-- === 0) i = k;
      const c = this.crystals[Math.max(0, i)]!;
      if (i >= 0) {
        const k = this.rand.between(0, c.tips.length / 2 - 1) * 2;
        Object.assign(f, { crystal: i, x: c.tips[k]!, y: c.tips[k + 1]!, start: now });
      } else f.next = now + cc.flashGapMinMs;
    }
    const ft = f.crystal >= 0 ? glintAlpha((now - f.start) / cc.flashMs) : 0;
    for (let i = 0; i < this.crystals.length; i++) {
      const c = this.crystals[i]!;
      const k = flashes ? sunPulse(now + c.phase * c.period, c.period) : 0.5;
      const boost = i === f.crystal ? cc.flashBoost * ft : 0;
      const [x0, y0, x1, y1] = c.rect;
      const w = x1 - x0 + 1;
      const h = y1 - y0 + 1;
      cutToClip(c.cut, left, top, sx, sy, c.rect, on, clip, cc.alphaMin + (cc.alphaMax - cc.alphaMin) * k + boost);
      const hw = w * cc.haloScale;
      const hh = h * cc.haloScale;
      cropToClip(c.halo, left + (x0 + w / 2 - hw / 2) * sx, top + (y0 + h / 2 - hh / 2) * sy, (hw / 32) * sx, (hh / 32) * sy, 32, 32, on, clip, cc.haloMin + (cc.haloMax - cc.haloMin) * k + boost * 0.3);
    }
    if (f.crystal >= 0 && flashes) this.put(this.star, f.x, f.y, ft);
    else this.star.setVisible(false);
  }

  private updateGold(now: number, flashes: boolean): void {
    const gc = CAVE.gold;
    for (const s of this.sparks) {
      if (now >= s.born + s.life) {
        if (this.gold.length < 2) {
          s.img.setVisible(false);
          continue;
        }
        const k = this.rand.between(0, this.gold.length / 2 - 1) * 2;
        s.x = this.gold[k]!;
        s.y = this.gold[k + 1]!;
        s.born = now + this.rand.between(gc.gapMinMs, gc.gapMaxMs);
        s.life = this.rand.between(gc.lifeMinMs, gc.lifeMaxMs);
        // Algunas, estrella grande; las más, la chica.
        s.img.setFrame(this.rand.frac() < gc.bigShare ? 'star5' : 'star3');
      }
      const a = flashes ? glintAlpha((now - s.born) / s.life) : 0;
      this.put(s.img, s.x + 0.5, s.y + 0.5, a * gc.alpha);
    }
  }

  private updateDrops(now: number, flashes: boolean): void {
    const dc = CAVE.drops;
    for (const d of this.drops) {
      if (now >= d.land + dc.splashMs) {
        d.form = now + this.rand.between(dc.gapMinMs, dc.gapMaxMs);
        d.fall = d.form + dc.formMs;
        d.land = d.fall + dropFallMs(d.tip[2] - d.tip[1], dc.gravity);
      }
      const [tx, ty, ly] = d.tip;
      if (now < d.form) {
        d.img.setVisible(false);
        d.splash.setVisible(false);
      } else if (now < d.fall) {
        // Se forma en la punta: aparece despacio.
        this.put(d.img, tx + 0.5, ty + 1, dc.alpha * ((now - d.form) / dc.formMs));
        d.splash.setVisible(false);
      } else if (now < d.land) {
        this.put(d.img, tx + 0.5, Math.min(ly, ty + 1 + dropFall(now - d.fall, dc.gravity)), dc.alpha);
        d.splash.setVisible(false);
      } else {
        d.img.setVisible(false);
        const t = (now - d.land) / dc.splashMs;
        if (flashes) this.put(d.splash, tx + 0.5, ly + 0.5, dc.splashAlpha * (1 - t));
        else d.splash.setVisible(false);
      }
    }
  }

  private updateDust(now: number): void {
    const uc = CAVE.dust;
    for (const m of this.dust) {
      if (now >= m.born + m.life) this.respawnDust(m, now);
      const t = (now - m.born) / m.life;
      const s = (now - m.born) / 1000;
      const sway = uc.sway * Math.sin((2 * Math.PI * now) / uc.swayMs + m.phase * 2 * Math.PI);
      this.put(m.img, m.x + m.vx * s + sway, m.y + m.vy * s, uc.alphaMax * Math.sin(Math.PI * Math.min(1, Math.max(0, t))));
    }
  }

  private respawnDust(m: CaveLife['dust'][number], now: number): void {
    const uc = CAVE.dust;
    const [x0, y0, x1, y1] = this.place.dust;
    const angle = this.rand.frac() * Math.PI * 2;
    const speed = uc.speed * (0.5 + this.rand.frac());
    Object.assign(m, {
      x: this.rand.between(x0, x1),
      y: this.rand.between(y0, y1),
      // Más de costado que de arriba abajo: el aire de la cueva corre.
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed * 0.4,
      born: now,
      life: this.rand.between(uc.lifeMinMs, uc.lifeMaxMs),
      phase: this.rand.frac(),
    });
  }

  private updateBats(now: number, on: boolean): void {
    const bc = CAVE.bats;
    if (this.nextBats < 0 && on) this.nextBats = now + this.rand.between(bc.firstMinMs, bc.firstMaxMs);
    const g = this.group;
    if (g.n === 0 && this.nextBats >= 0 && now >= this.nextBats) this.launchBats(now);
    if (g.n > 0 && now >= g.end) {
      g.n = 0;
      g.dir = g.dir > 0 ? -1 : 1;
      this.nextBats = now + this.rand.between(bc.gapMinMs, bc.gapMaxMs);
    }
    const lead = g.n > 0 ? flockLeadX((now - g.start) / (g.end - g.start), g.dir, this.imageWidth, bc.margin) : 0;
    for (let i = 0; i < this.bats.length; i++) {
      const b = this.bats[i]!;
      if (i >= g.n) {
        b.img.setVisible(false);
        continue;
      }
      const frame = Math.floor(now / bc.flapMs + b.flap * 3) % 3;
      b.img.setFrame(`bat${frame}`);
      this.put(b.img, lead - g.dir * b.back, g.y + b.dy + bc.zigAmp * zigzag(now / b.zigMs + b.phase), bc.alpha);
      // Un píxel del murciélago mide `scale` px de la imagen (`place` lo pone a la escala de la imagen).
      if (b.img.visible) b.img.setScale(b.img.scaleX * bc.scale, b.img.scaleY * bc.scale);
    }
  }

  private launchBats(now: number): void {
    const bc = CAVE.bats;
    const g = this.group;
    g.n = this.rand.between(bc.countMin, bc.countMax);
    g.start = now;
    g.end = now + this.rand.between(bc.crossMinMs, bc.crossMaxMs);
    const [y0, y1] = this.place.bats;
    const margin = bc.spreadY / 2 + bc.zigAmp + 3;
    g.y = this.rand.realInRange(y0 + margin, Math.max(y0 + margin, y1 - margin));
    for (let i = 0; i < g.n; i++) {
      const b = this.bats[i]!;
      b.back = this.rand.frac() * bc.spreadX;
      b.dy = (this.rand.frac() - 0.5) * bc.spreadY;
      b.zigMs = this.rand.between(bc.zigMinMs, bc.zigMaxMs);
      b.phase = this.rand.frac();
      b.flap = this.rand.frac();
    }
  }

  /** Para la prueba de humo y las capturas: qué se ve, en px de arte de la imagen de cueva. */
  debugState(): { crystals: number; flash: number; sparks: number; drops: number; dust: number; bats: { x: number; y: number }[]; nextBatsMs: number } {
    const [left, top, sx, sy] = this.frame;
    return {
      crystals: this.crystals.filter((c) => c.cut.visible).length,
      flash: this.star.visible ? this.flash.crystal : -1,
      sparks: this.sparks.filter((s) => s.img.visible).length,
      drops: this.drops.filter((d) => d.img.visible || d.splash.visible).length,
      dust: this.dust.filter((d) => d.img.visible).length,
      bats: this.bats.filter((b) => b.img.visible).map((b) => ({ x: (b.img.x - left) / sx, y: (b.img.y - top) / sy })),
      nextBatsMs: this.group.n > 0 ? 0 : this.nextBats,
    };
  }

  /** Para las capturas: que el próximo grupo de murciélagos y el próximo destello salgan ya. */
  debugLaunch(now: number): void {
    if (this.group.n === 0) this.nextBats = now;
    if (this.flash.crystal < 0) this.flash.next = now;
  }
}

/**
 * Pone una imagen sin girar (origen arriba a la izquierda) en `x`, `y` con escala `scaleX`, `scaleY` y la recorta al
 * tramo de la cueva a la vista: lo que cae afuera no se dibuja. `w`, `h`: tamaño de su cuadro (px de textura).
 */
function cropToClip(img: Phaser.GameObjects.Image, x: number, y: number, scaleX: number, scaleY: number, w: number, h: number, on: boolean, clip: Clip, alpha: number): void {
  const right = x + w * scaleX;
  const show = on && alpha > 0 && right > clip.left && x < clip.right;
  img.setVisible(show);
  if (!show) return;
  const c0 = Math.max(0, (clip.left - x) / scaleX);
  const c1 = Math.min(w, (clip.right - x) / scaleX);
  img.setPosition(x, y).setScale(scaleX, scaleY).setAlpha(Math.min(1, alpha));
  if (c0 > 0 || c1 < w) img.setCrop(c0, 0, c1 - c0, h);
  else img.setCrop();
}

/**
 * Un recorte de la imagen (textura del tamaño de la imagen, ver `cutouts`) en la esquina `left`, `top` de la imagen y a
 * su escala, recortado a su rectángulo y al tramo de la cueva a la vista.
 */
function cutToClip(
  img: Phaser.GameObjects.Image,
  left: number,
  top: number,
  sx: number,
  sy: number,
  r: readonly [number, number, number, number],
  on: boolean,
  clip: Clip,
  alpha: number,
): void {
  const x0 = Math.max(r[0], (clip.left - left) / sx);
  const x1 = Math.min(r[2] + 1, (clip.right - left) / sx);
  const show = on && alpha > 0 && x1 > x0;
  img.setVisible(show);
  if (!show) return;
  img.setPosition(left, top).setScale(sx, sy).setAlpha(Math.min(1, alpha)).setCrop(x0, r[1], x1 - x0, r[3] - r[1] + 1);
}

/** Las piezas chicas de la cueva (sin filtro, para que queden en la grilla del arte) y el halo (degradado, con filtro). */
function makeCaveTextures(scene: Phaser.Scene): void {
  if (!scene.textures.exists(CAVE_FX_KEY)) {
    const names = Object.keys(CAVE_FX_ART);
    const sizes = names.map((n) => [CAVE_FX_ART[n]![0]!.length, CAVE_FX_ART[n]!.length] as const);
    const pack = shelfPack(sizes, 256);
    const tex = scene.textures.createCanvas(CAVE_FX_KEY, pack.width, pack.height);
    if (tex) {
      const ctx = tex.getContext();
      const out = ctx.createImageData(pack.width, pack.height);
      const level: Record<string, number> = { '#': 255, '+': 150, '-': 70 };
      names.forEach((n, i) => {
        const at = pack.at[i]!;
        CAVE_FX_ART[n]!.forEach((row, y) =>
          [...row].forEach((c, x) => {
            if (level[c]) out.data.set([255, 255, 255, level[c]!], ((at.y + y) * pack.width + at.x + x) * 4);
          }),
        );
        tex.add(n, 0, at.x, at.y, sizes[i]![0], sizes[i]![1]);
      });
      ctx.putImageData(out, 0, 0);
      tex.refresh();
    }
  }
  if (!scene.textures.exists(CAVE_HALO_KEY)) {
    const tex = scene.textures.createCanvas(CAVE_HALO_KEY, 32, 32);
    if (tex) {
      const ctx = tex.getContext();
      const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
      grad.addColorStop(0, 'rgba(255,255,255,1)');
      grad.addColorStop(0.45, 'rgba(255,255,255,0.45)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 32, 32);
      tex.refresh();
      tex.setFilter(Phaser.Textures.FilterMode.LINEAR);
    }
  }
}
