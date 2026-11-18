import Phaser from 'phaser';
import { ANIMS_SUFFIX, PLAYER_KEY } from '../../assets/manifest';
import { GAMEPLAY } from '../../config/gameplay';
import { uploadAtlas } from '../../systems/pixelArt';
import { SaveManager } from '../../systems/SaveManager';
import { RENDER_ZOOM, VIEW } from '../../systems/View';
import { ensureSoftGlow } from '../../utils/softGlow';
import { INTRO_DONE, type IntroPose, introPose, nextGap, SHINE_END_MS, shineFrame, shootingPose, sparkleAmount, twinkle } from './titleLogic';
import { FINE_K, MENU_STAR_FRAMES, titleArt, twinkleFrame } from './titlePaint';

// Cómo se ve la portada (S105): el logo con su destello, el ñandutí, el titilar de Eichu, la bruma, la estrella
// fugaz, Kerana con Mainumby y la entrada. Todo se pinta una vez (un atlas) y se crea en el constructor: `update`
// solo mueve, cambia de cuadro y de alfa. El menú es de TitleScene; acá solo la estrellita que marca el elegido.
const LOOK = GAMEPLAY.titleLook;
const TAU = Math.PI * 2;
const SHINE_SEED = 61;
const SHOOTING_SEED = 67;

interface ArtInfo {
  key: string;
  blockLogoX: number;
  blockLogoY: number;
  blockLogoWidth: number;
  blockBottom: number;
  tipX: number;
  tipY: number;
  shine: { name: string; x: number; y: number }[];
}

/** Lo que hace falta del arte ya subido (el atlas se pinta una sola vez por texto). */
let artInfo: ArtInfo | null = null;

function ensureArt(scene: Phaser.Scene, title: string, subtitle: string): ArtInfo {
  const key = `title_art:${title}|${subtitle}`;
  if (artInfo?.key === key && scene.textures.exists(key)) return artInfo;
  const art = titleArt(title, subtitle);
  scene.textures.remove(key);
  uploadAtlas(scene, key, art.frames, 1024);
  artInfo = {
    key,
    blockLogoX: art.block.logoX,
    blockLogoY: art.block.logoY,
    blockLogoWidth: art.block.logoWidth,
    blockBottom: art.block.bottom,
    tipX: art.block.tipX,
    tipY: art.block.tipY,
    shine: art.shine.map(({ name, x, y }) => ({ name, x, y })),
  };
  return artInfo;
}

/** Medio píxel del lienzo: las cosas finas se ubican en esa grilla para no partir píxeles. */
const snap = (v: number): number => Math.round(v * RENDER_ZOOM) / RENDER_ZOOM;

export class TitleLook {
  private readonly info: ArtInfo;
  private readonly black: Phaser.GameObjects.Rectangle;
  private readonly vignette: Phaser.GameObjects.Graphics;
  private readonly twinkles: Phaser.GameObjects.Image[] = [];
  private readonly halos: Phaser.GameObjects.Image[] = [];
  private readonly fog: Phaser.GameObjects.Image[][] = [];
  private readonly block: Phaser.GameObjects.Image;
  private readonly shine: Phaser.GameObjects.Image;
  private readonly sparkle: Phaser.GameObjects.Image;
  private readonly nanduti: Phaser.GameObjects.Image;
  private readonly shooting: Phaser.GameObjects.Image;
  private readonly shootingW: number;
  private readonly shootingH: number;
  private readonly kerana: Phaser.GameObjects.Sprite;
  private readonly bird?: Phaser.GameObjects.Sprite;
  private readonly birdGlow?: Phaser.GameObjects.Image;
  private readonly menuStar: Phaser.GameObjects.Image;
  private readonly blockX: number;
  private readonly blockY: number;
  private clockMs = 0;
  /** Tiempo de la entrada; null si no hay entrada (ya se vio en esta sesión) o ya terminó. */
  private introMs: number | null;
  private pose: IntroPose;
  private shineAt: number;
  private shineCount = 0;
  private shootingAt: number;
  private shootingCount = 0;
  private marked: Phaser.GameObjects.Text | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    title: string,
    subtitle: string,
    intro: boolean,
  ) {
    const info = ensureArt(scene, title, subtitle);
    this.info = info;
    const key = info.key;
    const { width, height } = VIEW;
    this.black = scene.add.rectangle(0, 0, width, height, 0x000000).setOrigin(0).setDepth(-8);
    const E = LOOK.eichu;
    const haloKey = ensureSoftGlow(scene, GAMEPLAY.sprites.mainumby.glowTextureSize, E.haloColor);
    for (const [sx0, sy0] of E.stars) {
      // Centradas en la grilla de medio píxel del lienzo, como los cuadros de 2 por unidad.
      const x = snap(sx0);
      const y = snap(sy0);
      this.halos.push(scene.add.image(x, y, haloKey).setDisplaySize(E.haloRadius * 2, E.haloRadius * 2).setBlendMode(Phaser.BlendModes.ADD).setDepth(-6.2));
      this.twinkles.push(scene.add.image(x, y, key, twinkleFrame(0)).setScale(1 / FINE_K).setBlendMode(Phaser.BlendModes.ADD).setDepth(-6));
    }
    this.shooting = scene.add.image(0, 0, key, 'shooting').setScale(1 / FINE_K).setBlendMode(Phaser.BlendModes.ADD).setDepth(-6.5).setVisible(false);
    this.shootingW = this.shooting.frame.width;
    this.shootingH = this.shooting.frame.height;
    LOOK.fog.layers.forEach((layer, i) => {
      const pair = [0, 1].map(() => scene.add.image(0, layer.top, key, `fog_${i}`).setOrigin(0).setDepth(layer.depth).setAlpha(layer.alpha));
      this.fog.push(pair);
    });
    this.vignette = scene.add
      .graphics()
      .fillGradientStyle(LOOK.vignetteColor, LOOK.vignetteColor, LOOK.vignetteColor, LOOK.vignetteColor, 0, 0, LOOK.vignetteAlpha, LOOK.vignetteAlpha)
      .fillRect(0, LOOK.vignetteTop, width, height - LOOK.vignetteTop)
      .setDepth(1);
    // Logo y subtítulo: un solo bloque, en la grilla de las unidades (cada píxel del logo = 2 del lienzo).
    this.blockX = Math.round(LOOK.logo.centerX - info.blockLogoX - info.blockLogoWidth / 2);
    this.blockY = LOOK.logo.top - info.blockLogoY;
    this.block = scene.add.image(this.blockX, this.blockY, key, 'block').setOrigin(0).setDepth(4);
    this.shine = scene.add.image(0, 0, key, info.shine[0]?.name ?? 'block').setOrigin(0).setDepth(4.1).setVisible(false);
    const [sx, sy] = LOOK.shine.sparkleAt;
    this.sparkle = scene.add
      .image(snap(this.blockX + info.tipX + sx), snap(this.blockY + info.tipY + sy), key, twinkleFrame(0))
      .setScale(1 / FINE_K)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(4.2)
      .setVisible(false);
    const nW = scene.textures.getFrame(key, 'nanduti').width;
    this.nanduti = scene.add
      .image(snap(LOOK.logo.centerX - (nW - 1) / 2 / FINE_K), this.blockY + info.blockBottom + LOOK.nanduti.gapBelow, key, 'nanduti')
      .setOrigin(0)
      .setScale(1 / FINE_K)
      .setDepth(4);
    this.kerana = this.addKerana();
    const bird = this.addBird();
    if (bird) {
      this.bird = bird.bird;
      this.birdGlow = bird.glow;
    }
    // A 1 píxel por unidad, como el logo.
    this.menuStar = scene.add.image(0, 0, key, MENU_STAR_FRAMES[1]).setDepth(6).setVisible(false);
    this.introMs = intro ? 0 : null;
    this.pose = intro ? introPose(0) : INTRO_DONE;
    this.shineAt = intro ? LOOK.intro.shineAtMs : nextGap(LOOK.shine.everyMs, 0, SHINE_SEED);
    this.shootingAt = (intro ? LOOK.intro.totalMs : 0) + nextGap(LOOK.shootingStar.everyMs, 0, SHOOTING_SEED);
    this.update(0);
  }

  private addKerana(): Phaser.GameObjects.Sprite {
    const K = LOOK.kerana;
    const scene = this.scene;
    const animated = scene.anims.exists(`${PLAYER_KEY}_idle`);
    const sprite = scene.add.sprite(K.x, K.feetY, animated ? PLAYER_KEY : 'kerana_placeholder').setOrigin(0.5, 1).setDepth(2);
    // Escala entera: `artPx` píxeles del lienzo por píxel de la hoja.
    sprite.setScale(K.artPx / RENDER_ZOOM);
    if (animated) sprite.play(`${PLAYER_KEY}_idle`);
    else sprite.setScale(2);
    return sprite;
  }

  private addBird(): { bird: Phaser.GameObjects.Sprite; glow: Phaser.GameObjects.Image } | null {
    const scene = this.scene;
    if (!scene.anims.exists('mainumby_fly') || !scene.textures.exists('mainumby')) return null;
    const look = GAMEPLAY.sprites.mainumby;
    const meta = scene.cache.json.get('mainumby' + ANIMS_SUFFIX) as { detail?: number } | undefined;
    const scale = LOOK.kerana.artPx / RENDER_ZOOM;
    // El brillo crece con la escala del pájaro (en el juego va a 1 / detail).
    const grow = scale * (meta?.detail ?? 2);
    const glow = scene.add
      .image(0, 0, ensureSoftGlow(scene, look.glowTextureSize, look.glowColor))
      .setDisplaySize(look.glowRadius * 2 * grow, look.glowRadius * 2 * grow)
      .setAlpha(look.glowAlpha)
      .setDepth(2.6);
    const bird = scene.add.sprite(0, 0, 'mainumby').setScale(scale).setDepth(2.7);
    bird.play('mainumby_fly');
    return { bird, glow };
  }

  /** Entrada en curso. */
  get introRunning(): boolean {
    return this.introMs !== null;
  }

  /** Alfa del menú (sube al final de la entrada). */
  get menuAlpha(): number {
    return this.pose.menu;
  }

  /** Saltea la entrada: todo queda como al final, en este mismo cuadro. */
  skipIntro(): void {
    if (this.introMs === null) return;
    this.introMs = null;
    this.pose = INTRO_DONE;
    // El logo igual aparece con su destello, si todavía no lo tuvo.
    if (this.shineCount === 0 && this.shineAt > this.clockMs) this.shineAt = this.clockMs;
    this.shootingAt = Math.max(this.shootingAt, this.clockMs + nextGap(LOOK.shootingStar.everyMs, 0, SHOOTING_SEED));
    this.apply();
  }

  /** La estrellita del menú va al lado de `text` (null: ninguna). */
  mark(text: Phaser.GameObjects.Text | null): void {
    this.marked = text && text.text ? text : null;
  }

  update(deltaMs: number): void {
    this.clockMs += deltaMs;
    if (this.introMs !== null) {
      this.introMs += deltaMs;
      if (this.introMs >= LOOK.intro.totalMs) {
        this.introMs = null;
        this.pose = INTRO_DONE;
      } else this.pose = introPose(this.introMs);
    }
    this.apply();
  }

  private apply(): void {
    const t = this.clockMs;
    const pose = this.pose;
    const flashes = SaveManager.current.settings.flashes;
    this.black.setAlpha(pose.black).setVisible(pose.black > 0);
    this.twinkles.forEach((img, i) => {
      const tw = twinkle(i, t, pose.stars[i], !flashes);
      img.setFrame(twinkleFrame(tw.frame)).setAlpha(tw.alpha);
      this.halos[i].setAlpha(tw.halo);
    });
    LOOK.fog.layers.forEach((layer, i) => {
      const off = snap(((t / 1000) * layer.speed) % VIEW.width);
      const [a, b] = this.fog[i];
      a.setX(-off).setAlpha(layer.alpha * pose.world);
      b.setX(VIEW.width - off).setAlpha(layer.alpha * pose.world);
    });
    this.vignette.setAlpha(pose.world);
    this.kerana.setAlpha(pose.world);
    this.updateBird(t, pose.world);
    this.block.setAlpha(pose.logo);
    this.nanduti.setAlpha(pose.sub);
    this.updateShine(t, flashes && pose.logo > 0.5);
    this.updateShooting(t, flashes && pose.world > 0.9);
    this.updateMenuStar(t, pose.menu);
  }

  private updateBird(t: number, alpha: number): void {
    if (!this.bird || !this.birdGlow) return;
    const M = LOOK.mainumby;
    const a = (TAU * t) / M.periodMs;
    // Revolotea en un ocho chato junto al hombro de Kerana y mira hacia donde va.
    const x = this.kerana.x + M.offsetX + Math.sin(a) * M.radiusX;
    const y = this.kerana.y + M.offsetY + Math.sin(a * 2) * M.radiusY + Math.sin((TAU * t) / M.bobMs) * M.bob;
    // La hoja mira a la derecha: espejado, mira a Kerana.
    this.bird.setFlipX(x > this.kerana.x).setPosition(snap(x), snap(y)).setAlpha(alpha);
    this.birdGlow.setPosition(snap(x), snap(y)).setAlpha(GAMEPLAY.sprites.mainumby.glowAlpha * alpha);
  }

  private updateShine(t: number, enabled: boolean): void {
    const frames = this.info.shine;
    const elapsed = t - this.shineAt;
    // Sin destellos (o con el logo todavía apagado) la serie sigue corriendo sin mostrarse.
    const k = enabled ? shineFrame(elapsed, frames.length) : -1;
    if (k >= 0) {
      const f = frames[k];
      this.shine.setFrame(f.name).setPosition(this.blockX + f.x, this.blockY + f.y).setVisible(true).setAlpha(this.pose.logo);
    } else this.shine.setVisible(false);
    // El chispazo: cuando la franja sale por la derecha, la punta de la última letra destella (crece y se apaga).
    const g = enabled ? sparkleAmount(elapsed) : 0;
    if (g > 0) {
      const last = LOOK.eichu.arms.length - 1;
      this.sparkle.setFrame(twinkleFrame(Math.round(g * last))).setAlpha(g * this.pose.logo).setVisible(true);
    } else this.sparkle.setVisible(false);
    if (elapsed >= SHINE_END_MS) {
      // Cada 5 a 7 s, de comienzo a comienzo.
      this.shineCount++;
      this.shineAt += nextGap(LOOK.shine.everyMs, this.shineCount, SHINE_SEED);
    }
  }

  private updateShooting(t: number, enabled: boolean): void {
    const S = LOOK.shootingStar;
    const pose = enabled ? shootingPose(this.shootingCount, t - this.shootingAt) : null;
    if (t >= this.shootingAt + S.durationMs) {
      // Cada 8 a 15 s, de comienzo a comienzo.
      this.shootingCount++;
      this.shootingAt += nextGap(S.everyMs, this.shootingCount, SHOOTING_SEED);
    }
    if (!pose) {
      this.shooting.setVisible(false);
      return;
    }
    // La cabeza está en la esquina de abajo del cuadro (a la derecha; espejado, a la izquierda).
    const ox = pose.left ? 2 / this.shootingW : (this.shootingW - 2) / this.shootingW;
    this.shooting
      .setOrigin(ox, (this.shootingH - 2) / this.shootingH)
      .setFlipX(pose.left)
      .setPosition(snap(pose.x), snap(pose.y))
      .setAlpha(pose.alpha)
      .setVisible(true);
  }

  private updateMenuStar(t: number, alpha: number): void {
    const text = this.marked;
    if (!text || alpha <= 0) {
      this.menuStar.setVisible(false);
      return;
    }
    const pulse = 0.5 + 0.5 * Math.sin((TAU * t) / LOOK.menu.pulseMs);
    const left = text.x - text.displayWidth * text.originX;
    this.menuStar
      .setFrame(MENU_STAR_FRAMES[pulse > 0.55 ? 1 : 0])
      .setPosition(snap(left - LOOK.menu.starGap), snap(text.y - text.displayHeight * (text.originY - 0.5)))
      .setAlpha(alpha * (0.8 + 0.2 * pulse))
      .setVisible(true);
  }
}
