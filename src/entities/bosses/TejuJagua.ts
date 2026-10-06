import Phaser from 'phaser';
import { GAMEPLAY } from '../../config/gameplay';
import { TEJU_JAGUA_COLORS, TEJU_JAGUA_HEADS, TEJU_JAGUA_HITS_PER_HEAD, getBossDef } from '../../data/bosses';
import { skinIfAvailable } from '../../systems/SpriteSkin';
import { Boss, type BossContext } from './Boss';
import type { BossTransition } from './BossBrain';
import {
  ART_K,
  BODY_TEXTURE,
  ensureTejuJaguaArt,
  FlameArt,
  NECK_SCALE_PX,
  NECK_SCALE_TEXTURE,
  TAIL_TEXTURE,
  tailOrigin,
  WAVE_TEXTURE,
  waveOrigin,
} from './tejuJaguaArt';

const CFG = GAMEPLAY.tejuJagua;
/** Sprite real (npm run sprites → raw/teju_jagua/head/) o placeholder. */
const HEAD_SPRITE = 'teju_jagua_head';
const HEAD_PLACEHOLDER = 'teju_jagua_head_placeholder';
const EYES_TEXTURE = 'teju_jagua_eyes';
const HALO_TEXTURE = 'teju_jagua_halo';
const STAR_TEXTURE = 'teju_jagua_star';
const SLEEP_TINT = 0x2a2838;
/** Polvo y piedritas del coletazo; grieta del aviso; halo y estrellas de la cabeza expuesta; pavesas y calor del fuego. */
const DUST_COLOR = 0xc2a473;
const PEBBLE_COLOR = 0x4a3a28;
const CRACK_COLOR = 0x1e160e;
const EXPOSED_COLOR = 0xffe27a;
const EMBER_COLORS: number[] = [0xfff4c4, 0xffd23c, 0xf08a30, 0xd8441c];
const HEAT_COLOR = 0xffb070;
const FIRE_DEPTH = -0.5;
/** Centro del cuerpo sobre el suelo (unidades, a tamaño 1: se multiplica por `bodySize`). */
const BODY_FLOOR_OFFSET = 110;
/** Tamaño del cuerpo (gameplay.ts): escala las medidas de esta sección y las del lomo. */
const S = CFG.bodySize;
/** Base de la cola: hacia el costado derecho del lomo (fracción del ancho) y sobre el suelo (unidades, a tamaño 1). */
const TAIL_BASE_X = 0.38;
const TAIL_BASE_LIFT = 16;
/** Cola levantada en el aviso del coletazo (escala vertical relativa). */
const TAIL_RAISE = 1.8;

interface Head {
  index: number;
  img: Phaser.GameObjects.Image;
  eyes: Phaser.GameObjects.Image;
  /** Señal de cabeza expuesta: halo detrás y estrellitas de mareo encima. */
  halo: Phaser.GameObjects.Image;
  stars: Phaser.GameObjects.Image[];
  color: number;
  hp: number;
  asleep: boolean;
  /** Muerde o escupe fuego: hace daño al tocarla. */
  harmful: boolean;
  /** Se puede golpear (ventana tras el ataque). */
  exposed: boolean;
  anchorX: number;
  anchorY: number;
  /** Dónde se apoya dormida, sobre el lomo. */
  sleepX: number;
  sleepY: number;
  neckX: number;
  neckY: number;
}

function ensureTextures(scene: Phaser.Scene): void {
  const w = CFG.headWidth;
  const h = CFG.headHeight;
  if (!scene.textures.exists(HEAD_PLACEHOLDER)) {
    // Cabeza de perro de perfil mirando a la izquierda, en gris claro para teñirla.
    // Dibujada a 30 × 18 y escalada a la medida de la hitbox.
    const k = w / 30;
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0xe6e6e6).fillRoundedRect(8 * k, 0, w - 8 * k, h - 4 * k, 4 * k);
    g.fillStyle(0xd0d0d0).fillRect(0, 5 * k, 12 * k, 8 * k);
    g.fillStyle(0xb0b0b0).fillRect(0, 11 * k, 14 * k, 3 * k);
    g.fillStyle(0xffffff).fillTriangle(2 * k, 13 * k, 5 * k, 13 * k, 3 * k, 16 * k);
    g.fillStyle(0xffffff).fillTriangle(8 * k, 13 * k, 11 * k, 13 * k, 9 * k, 16 * k);
    g.generateTexture(HEAD_PLACEHOLDER, w, h);
    g.destroy();
  }
  if (!scene.textures.exists(HALO_TEXTURE)) {
    // Halo blando: óvalos concéntricos, más opacos al centro (blanco: el tinte le da el color).
    const k = ART_K;
    const hw = (w / 2 + CFG.exposedHaloMargin) * k;
    const hh = (h / 2 + CFG.exposedHaloMargin) * k;
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    const rings = 6;
    for (let i = 0; i < rings; i++) {
      const f = 1 - i / rings;
      g.fillStyle(0xffffff, 0.12 + 0.1 * i).fillEllipse(hw, hh, 2 * hw * f, 2 * hh * f);
    }
    g.generateTexture(HALO_TEXTURE, Math.ceil(2 * hw), Math.ceil(2 * hh));
    g.destroy();
  }
  if (!scene.textures.exists(STAR_TEXTURE)) {
    // Estrellita de cuatro puntas (7 × 7) con centro blanco.
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(EXPOSED_COLOR);
    g.fillTriangle(3.5, 0, 2.3, 3.5, 4.7, 3.5).fillTriangle(3.5, 7, 2.3, 3.5, 4.7, 3.5);
    g.fillTriangle(0, 3.5, 3.5, 2.3, 3.5, 4.7).fillTriangle(7, 3.5, 3.5, 2.3, 3.5, 4.7);
    g.fillStyle(0xffffff).fillRect(3, 3, 1, 1);
    g.generateTexture(STAR_TEXTURE, 7, 7);
    g.destroy();
  }
  if (!scene.textures.exists(EYES_TEXTURE)) {
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0xff5a1f).fillRect(0, 0, 3, 3);
    g.fillStyle(0xffd24a).fillRect(1, 1, 1, 1);
    g.generateTexture(EYES_TEXTURE, 3, 3);
    g.destroy();
  }
}

// Teju Jagua (GDD §6.1): siete cabezas de perro sobre un cuerpo de lagarto que no se mueve.
// Pelean las cabezas; cada una aguanta 2 golpes y al vencerla se duerme.
export class TejuJagua extends Boss {
  private readonly heads: Head[] = [];
  /** Escamas de los cuellos: un pool por cabeza (sin asignar objetos en cada frame). */
  private readonly necks: Phaser.GameObjects.Container;
  private readonly neckScales: Phaser.GameObjects.Image[][] = [];
  private readonly body: Phaser.GameObjects.Image;
  private readonly tail: Phaser.GameObjects.Image;
  private readonly wave: Phaser.GameObjects.Image;
  /** Llamarada y su aviso, dibujados cada frame (tejuJaguaArt.ts); `fireOn`: el fuego quema (antes, `fire.visible`). */
  private readonly fire: Phaser.GameObjects.Graphics;
  private readonly flame: FlameArt;
  private fireOn = false;
  private fireClock = 0;
  /** Aviso del fuego: tiempo transcurrido y total (ms). */
  private fireWarnElapsed = 0;
  private fireWarnMs = 1;
  private heatMs = 0;
  private emberMs = 0;
  /** Hocicos de las cabezas que soplan, de a pares (x, y); se reusa cada frame. */
  private readonly mouths: number[] = [];
  private readonly embers: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly heat: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly smoke: Phaser.GameObjects.Particles.ParticleEmitter;
  /** Polvo y piedritas del coletazo (aviso y onda) y grieta del suelo durante el aviso. */
  private readonly dust: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly pebbles: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly crack: Phaser.GameObjects.Graphics;
  private readonly waveRect = new Phaser.Geom.Rectangle();
  private readonly fireRect = new Phaser.Geom.Rectangle();
  private readonly headRect = new Phaser.Geom.Rectangle();
  /** Cabezas del ataque en curso. */
  private attackers: Head[] = [];
  private lastHit?: Head;
  private waveDir: 1 | -1 = -1;
  private smokeMs = 0;
  private dustMs = 0;
  /** Aviso del coletazo: tiempo transcurrido y total (ms). */
  private warnElapsed = 0;
  private warnMs = 1;
  private waveClock = 0;
  private readonly introTimers: Phaser.Time.TimerEvent[] = [];
  private readonly bodyX: number;
  private readonly bodyY: number;

  constructor(scene: Phaser.Scene, ctx: BossContext) {
    super(scene, getBossDef('teju_jagua'), ctx);
    ensureTextures(scene);
    const arena = ctx.arena;
    this.bodyX = arena.centerX;
    this.bodyY = ctx.floorY - BODY_FLOOR_OFFSET * S;

    // Lomo de lagarto por código (tejuJaguaArt.ts), con patas a los lados y la cola hacia un costado; respira lento.
    ensureTejuJaguaArt(scene, BODY_FLOOR_OFFSET);
    this.body = scene.add.image(this.bodyX, ctx.floorY, BODY_TEXTURE).setOrigin(0.5, 1).setScale(1 / ART_K).setDepth(-5);
    scene.tweens.add({
      targets: this.body,
      scaleX: (1 + CFG.breathScale / 2) / ART_K,
      scaleY: (1 + CFG.breathScale) / ART_K,
      duration: CFG.breathMs / 2,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    const [tox, toy] = tailOrigin();
    this.tail = scene.add
      .image(this.bodyX + CFG.bodyWidth * S * TAIL_BASE_X, ctx.floorY - TAIL_BASE_LIFT * S, TAIL_TEXTURE)
      .setOrigin(tox, toy)
      .setScale(1 / ART_K)
      .setDepth(-6);
    this.necks = scene.add.container(0, 0).setDepth(-3);
    this.wave = scene.add.image(0, 0, WAVE_TEXTURE).setScale(1 / ART_K).setDepth(6).setVisible(false);
    this.crack = scene.add.graphics().setDepth(5);
    this.dust = scene.add
      .particles(0, 0, 'fx_particle', {
        speedY: { min: -50, max: -12 },
        speedX: { min: -18, max: 18 },
        gravityY: 60,
        lifespan: 550,
        alpha: { start: 0.75, end: 0 },
        scale: { start: 1, end: 2.6 },
        tint: DUST_COLOR,
        emitting: false,
      })
      .setDepth(5);
    this.pebbles = scene.add
      .particles(0, 0, 'fx_particle', {
        speedY: { min: -110, max: -55 },
        speedX: { min: -25, max: 25 },
        gravityY: 520,
        lifespan: 420,
        scale: 0.7,
        tint: PEBBLE_COLOR,
        emitting: false,
      })
      .setDepth(5);
    // Delante de cabezas y cuellos, detrás de Kerana (depth 0): se la ve dentro del fuego.
    this.fire = scene.add.graphics().setDepth(FIRE_DEPTH);
    this.flame = new FlameArt(this.fire);
    // Pavesas que se desprenden de la llama y suben; calor que sube del suelo durante el aviso.
    this.embers = scene.add
      .particles(0, 0, 'fx_particle', {
        speedY: { min: -95, max: -40 },
        speedX: { min: -22, max: 22 },
        gravityY: -20,
        lifespan: { min: 350, max: 700 },
        alpha: { start: 1, end: 0 },
        scale: { start: 1, end: 0.2 },
        tint: EMBER_COLORS,
        emitting: false,
      })
      .setDepth(6.5);
    this.heat = scene.add
      .particles(0, 0, 'fx_particle', {
        speedY: { min: -45, max: -20 },
        speedX: { min: -6, max: 6 },
        lifespan: 650,
        alpha: { start: 0.6, end: 0 },
        scale: { start: 1, end: 3 },
        tint: HEAT_COLOR,
        emitting: false,
      })
      .setDepth(5.5);
    this.smoke = scene.add
      .particles(0, 0, 'fx_particle', {
        speedY: { min: -30, max: -10 },
        speedX: { min: -10, max: 10 },
        lifespan: 600,
        alpha: { start: 0.6, end: 0 },
        scale: { start: 1, end: 2.5 },
        tint: 0x9a9aa6,
        emitting: false,
      })
      .setDepth(7);

    // La cabeza gris del sprite sirve para las siete: cada una se tiñe con su color (como el placeholder).
    const texture = HEAD_PLACEHOLDER;
    const bodyTopY = this.bodyY - CFG.bodyTop * S;
    const half = (TEJU_JAGUA_HEADS - 1) / 2;
    for (let i = 0; i < TEJU_JAGUA_HEADS; i++) {
      const offset = i - half;
      const anchorX = this.bodyX + offset * CFG.fanSpacing;
      // Las de las puntas quedan `fanLift` sobre la cima del lomo; cada lugar hacia el centro sube `fanRise`.
      const anchorY = bodyTopY - CFG.fanLift - (half - Math.abs(offset)) * CFG.fanRise;
      const neckX = this.bodyX + offset * CFG.neckSpacing * S;
      const sleepX = this.bodyX + offset * CFG.sleepSpread * (CFG.bodyWidth / 2) * S;
      const halo = scene.add.image(anchorX, anchorY, HALO_TEXTURE).setDepth(-2.5).setScale(1 / ART_K).setTint(EXPOSED_COLOR).setVisible(false);
      const img = scene.add.image(anchorX, anchorY, texture).setDepth(-2);
      skinIfAvailable(scene, img, HEAD_SPRITE, { origin: GAMEPLAY.sprites.tejuHead.origin });
      const eyes = scene.add.image(anchorX, anchorY, EYES_TEXTURE).setDepth(-1).setScale(CFG.eyeScale);
      const stars: Phaser.GameObjects.Image[] = [];
      for (let k = 0; k < CFG.exposedStars; k++) stars.push(scene.add.image(anchorX, anchorY, STAR_TEXTURE).setDepth(0).setVisible(false));
      const scales: Phaser.GameObjects.Image[] = [];
      for (let k = 0; k < CFG.neckMaxScales; k++) scales.push(scene.add.image(0, 0, NECK_SCALE_TEXTURE).setVisible(false));
      this.necks.add(scales);
      this.neckScales.push(scales);
      const color = TEJU_JAGUA_COLORS[i % TEJU_JAGUA_COLORS.length];
      this.heads.push({
        index: i,
        img,
        eyes,
        halo,
        stars,
        color,
        hp: TEJU_JAGUA_HITS_PER_HEAD,
        asleep: false,
        harmful: false,
        exposed: false,
        anchorX,
        anchorY,
        sleepX,
        sleepY: this.moundTopY(sleepX) - CFG.headHeight / 2 + CFG.headHeight * CFG.sleepSink,
        neckX,
        neckY: this.moundTopY(neckX) + CFG.neckRootInset * S,
      });
    }
    this.resetVisuals();
  }

  // ── Presentación ──────────────────────────────────────────────────────────

  protected playIntro(onDone: () => void): void {
    // Siete pares de ojos de fuego se encienden uno a uno en la oscuridad.
    const time = this.scene.time;
    this.heads.forEach((head, i) => {
      this.introTimers.push(
        time.delayedCall(i * CFG.introEyeMs, () => {
          head.eyes.setVisible(true);
          if (i % 2 === 0) this.ctx.sfx('growl');
        }),
      );
    });
    const shown = TEJU_JAGUA_HEADS * CFG.introEyeMs;
    this.introTimers.push(
      time.delayedCall(shown, () => {
        this.scene.tweens.add({ targets: this.heads.map((h) => h.img), alpha: 1, duration: 500 });
      }),
      time.delayedCall(shown + 500, onDone),
    );
  }

  // ── Ataques ───────────────────────────────────────────────────────────────

  protected onTransition(t: BossTransition): void {
    const id = t.attack?.id ?? '';
    switch (t.state) {
      case 'telegraph':
        if (id === 'bite') this.telegraphBite(t.ms);
        else if (id === 'fire') this.telegraphFire(t.ms);
        else this.telegraphTail(t.ms);
        break;
      case 'active':
        if (id === 'bite') this.lungeBite(t.attack!.activeMs);
        else if (id === 'fire') this.breatheFire();
        else this.launchWave();
        break;
      case 'recover':
        if (id === 'bite') this.endBite();
        else if (id === 'fire') this.endFire();
        else this.endTail(id === 'tail_stalactites');
        break;
      case 'idle':
        this.returnHeads();
        break;
      default:
        break;
    }
  }

  /** Mordida: una cabeza se coloca en un borde, a ras del suelo o de una repisa, y se lanza hacia Kerana. */
  private telegraphBite(telegraphMs: number): void {
    const head = this.randomAwake(1)[0];
    if (!head) return;
    this.attackers = [head];
    const arena = this.ctx.arena;
    const px = this.ctx.playerX();
    const onLedge = this.ctx.ledgeY !== null && this.ctx.playerY() <= this.ctx.ledgeY + 2;
    const laneY = onLedge && this.ctx.ledgeY !== null ? this.ctx.ledgeY : this.ctx.floorY;
    const fromRight = px < arena.centerX;
    const startX = fromRight ? arena.right - CFG.headWidth : arena.left + CFG.headWidth;
    head.img.setFlipX(!fromRight);
    this.moveHead(head, startX, laneY - CFG.headHeight / 2, telegraphMs * 0.4);
    this.glowEyes(head, true);
    this.ctx.sfx('growl');
  }

  private lungeBite(activeMs: number): void {
    const head = this.attackers[0];
    if (!head) return;
    const arena = this.ctx.arena;
    const dir = head.img.flipX ? 1 : -1;
    // Apunta a donde estaba Kerana y un poco más allá.
    const targetX = Phaser.Math.Clamp(this.ctx.playerX() + dir * 48, arena.left + CFG.headWidth, arena.right - CFG.headWidth);
    head.harmful = true;
    this.scene.tweens.killTweensOf(head.img);
    this.scene.tweens.add({ targets: head.img, x: targetX, duration: activeMs, ease: 'Cubic.easeIn' });
    this.ctx.sfx('bite');
  }

  /** La cabeza queda clavada: es la ventana para golpearla. */
  private endBite(): void {
    for (const head of this.attackers) {
      head.harmful = false;
      head.exposed = !head.asleep;
      this.glowEyes(head, false);
    }
    this.ctx.shake(80, 0.004);
  }

  /**
   * Coletazo: la cola se levanta y el suelo tiembla por donde va a pasar la onda (polvo, piedritas y una grieta que
   * avanza desde el borde donde nace; ver updateVisuals). La dirección se decide acá, para avisar el recorrido real.
   */
  private telegraphTail(telegraphMs: number): void {
    this.attackers = [];
    this.waveDir = this.ctx.playerX() < this.ctx.arena.centerX ? -1 : 1;
    this.warnElapsed = 0;
    this.warnMs = Math.max(1, telegraphMs);
    this.dustMs = 0;
    this.scene.tweens.add({ targets: this.tail, scaleY: TAIL_RAISE / ART_K, angle: -15, duration: 300, ease: 'Back.easeOut' });
    this.ctx.shake(telegraphMs, CFG.tailWarnShake);
    this.ctx.sfx('growl');
  }

  /** Borde donde nace la onda (centro de la cresta). */
  private waveStartX(): number {
    const arena = this.ctx.arena;
    return this.waveDir < 0 ? arena.right - CFG.tailWaveWidth : arena.left + CFG.tailWaveWidth;
  }

  /** Una onda recorre el suelo de lado a lado: hay que saltarla. */
  private launchWave(): void {
    const flipped = this.waveDir < 0;
    const [ox, oy] = waveOrigin(flipped);
    this.crack.clear();
    this.waveClock = 0;
    this.wave.setOrigin(ox, oy).setFlipX(flipped).setScale(1 / ART_K).setPosition(this.waveStartX(), this.ctx.floorY).setVisible(true);
    this.scene.tweens.add({ targets: this.tail, scaleY: 1 / ART_K, angle: 0, duration: 200 });
    this.ctx.sfx('tailWave');
    this.ctx.shake(200, 0.006);
  }

  private endTail(withStalactites: boolean): void {
    this.wave.setVisible(false);
    if (!withStalactites) return;
    // Fase 2: caen 3 o 4 estalactitas después de cada coletazo, repartidas por la arena.
    const arena = this.ctx.arena;
    const count = Phaser.Math.Between(CFG.stalactitesMin, CFG.stalactitesMax);
    const slot = (arena.width - 64) / count;
    for (let i = 0; i < count; i++) {
      const x = arena.left + 32 + slot * i + Phaser.Math.Between(8, Math.max(8, Math.floor(slot) - 8));
      this.scene.time.delayedCall(i * 150, () => this.ctx.spawnFalling(x));
    }
  }

  /**
   * Aliento de fuego: dos cabezas sobre el tercio de la arena donde está Kerana. Aviso: humo en los hocicos y, en la
   * zona que va a quemar, el suelo que se tiñe, aire que brilla y calor que sube (ver updateFireWarning).
   */
  private telegraphFire(telegraphMs: number): void {
    const arena = this.ctx.arena;
    const third = arena.width / 3;
    const zone = Phaser.Math.Clamp(Math.floor((this.ctx.playerX() - arena.left) / third), 0, 2);
    const left = arena.left + zone * third;
    this.fireRect.setTo(left, arena.top + 90, third, this.ctx.floorY - (arena.top + 90));
    this.attackers = this.randomAwake(2);
    this.attackers.forEach((head, i) => {
      const x = left + third * (this.attackers.length === 1 ? 0.5 : 0.3 + i * 0.4);
      head.img.setFlipX(false);
      this.moveHead(head, x, arena.top + 70, 350);
      this.glowEyes(head, true);
    });
    this.smokeMs = 0;
    this.heatMs = 0;
    this.fireWarnElapsed = 0;
    this.fireWarnMs = Math.max(1, telegraphMs);
    this.ctx.sfx('growl');
  }

  /** La llamarada sale de los hocicos y cubre la zona (la hitbox no cambia: `fireRect`). */
  private breatheFire(): void {
    this.fireOn = true;
    this.fireClock = 0;
    this.emberMs = 0;
    this.ctx.sfx('fireBreath');
    if (CFG.fireShake > 0) this.ctx.shake(this.brain.attack?.activeMs ?? 0, CFG.fireShake);
  }

  /** Apaga la llamarada y sus efectos: nada tapa el halo ni las estrellitas de las cabezas expuestas. */
  private stopFire(): void {
    this.fireOn = false;
    this.flame.clear();
    this.embers.killAll();
    this.heat.killAll();
  }

  /** Después del fuego las cabezas bajan, cansadas: se pueden golpear. */
  private endFire(): void {
    this.stopFire();
    for (const head of this.attackers) {
      this.glowEyes(head, false);
      head.exposed = !head.asleep;
      this.moveHead(head, head.img.x, this.ctx.floorY - CFG.fireRecoverHeadHeight, 250);
    }
  }

  private returnHeads(): void {
    for (const head of this.attackers) {
      head.harmful = false;
      head.exposed = false;
      this.glowEyes(head, false);
      if (!head.asleep) this.moveHead(head, head.anchorX, head.anchorY, 400);
    }
    this.attackers = [];
    this.wave.setVisible(false);
    this.crack.clear();
    this.stopFire();
  }

  // ── Daño ──────────────────────────────────────────────────────────────────

  protected applyHit(rect: Phaser.Geom.Rectangle, damage: number): number {
    if (!this.brain.vulnerable) return 0;
    for (const head of this.attackers) {
      if (!head.exposed || head.asleep) continue;
      if (!Phaser.Geom.Rectangle.Overlaps(this.boundsOf(head), rect)) continue;
      const applied = Math.min(damage, head.hp);
      head.hp -= applied;
      this.lastHit = head;
      this.flash(head);
      this.ctx.sfx('bossHit');
      if (head.hp <= 0) this.sleep(head);
      return applied;
    }
    return 0;
  }

  /** La cabeza vencida no muere: se duerme y se apoya sobre el lomo. */
  private sleep(head: Head): void {
    head.asleep = true;
    head.exposed = false;
    head.harmful = false;
    head.eyes.setVisible(false);
    head.img.setTint(SLEEP_TINT);
    this.moveHead(head, head.sleepX, head.sleepY, 600);
    this.ctx.sfx('headSleep');
    // Si se durmieron todas las cabezas del ataque, el jefe pasa al siguiente.
    if (this.brain.hp > 0 && this.attackers.every((h) => h.asleep)) {
      this.brain.interrupt();
      this.returnHeads();
    }
  }

  protected override onPhaseChanged(): void {
    this.ctx.sfx('growl');
    this.ctx.shake(300, 0.008);
  }

  hurtsPlayer(playerRect: Phaser.Geom.Rectangle): boolean {
    for (const head of this.attackers) {
      if (head.harmful && Phaser.Geom.Rectangle.Overlaps(this.boundsOf(head), playerRect)) return true;
    }
    if (this.wave.visible) {
      this.waveRect.setTo(this.wave.x - CFG.tailWaveWidth / 2, this.wave.y - CFG.tailWaveHeight, CFG.tailWaveWidth, CFG.tailWaveHeight);
      if (Phaser.Geom.Rectangle.Overlaps(this.waveRect, playerRect)) return true;
    }
    return this.fireOn && Phaser.Geom.Rectangle.Overlaps(this.fireRect, playerRect);
  }

  markPosition(out: Phaser.Math.Vector2): Phaser.Math.Vector2 {
    const head = this.lastHit ?? this.heads[0];
    return out.set(head.img.x, head.img.y);
  }

  fadeOut(ms: number): void {
    const targets = [this.body, this.tail, this.necks, ...this.heads.flatMap((h) => [h.img, h.eyes])];
    this.scene.tweens.add({ targets, alpha: 0, duration: ms });
  }

  // ── Visual ────────────────────────────────────────────────────────────────

  protected updateVisuals(deltaMs: number): void {
    const attackId = this.brain.attack?.id ?? '';
    const isTail = attackId === 'tail' || attackId === 'tail_stalactites';
    if (this.brain.state === 'telegraph' && isTail) this.updateTailWarning(deltaMs);
    if (this.wave.visible) {
      this.wave.x += this.waveDir * CFG.tailWaveSpeed * (deltaMs / 1000);
      const arena = this.ctx.arena;
      if (this.wave.x < arena.left || this.wave.x > arena.right) this.wave.setVisible(false);
      else this.updateWave(deltaMs);
    }
    if (this.brain.state === 'telegraph' && attackId === 'fire') {
      this.smokeMs -= deltaMs;
      if (this.smokeMs <= 0) {
        this.smokeMs = 90;
        for (const head of this.attackers) this.smoke.emitParticleAt(head.img.x - CFG.headWidth / 2, head.img.y + 4, 1);
      }
      this.updateFireWarning(deltaMs);
    }
    if (this.fireOn) this.updateFlame(deltaMs);

    // Cuellos: del lomo a cada cabeza. Los ojos y la señal de expuesta siguen a la cabeza.
    const now = this.scene.time.now;
    for (const head of this.heads) {
      const dir = head.img.flipX ? 1 : -1;
      head.eyes.setPosition(head.img.x + dir * CFG.eyeOffsetX, head.img.y + CFG.eyeOffsetY);
      head.eyes.setAlpha(head.img.alpha > 0 ? 1 : 0);
      this.drawNeck(head, dir);
      this.updateExposed(head, now);
    }
  }

  /** Superficie del lomo (y del mundo) en x: la mitad de arriba del óvalo del dibujo. Fuera del lomo, su borde. */
  private moundTopY(x: number): number {
    const a = (CFG.bodyWidth / 2) * S;
    const b = CFG.bodyDepth * S;
    const cy = this.bodyY + (CFG.bodyDepth - CFG.bodyTop) * S;
    const dx = Phaser.Math.Clamp((x - this.bodyX) / a, -1, 1);
    return cy - b * Math.sqrt(1 - dx * dx);
  }

  /**
   * Aviso del coletazo, por el recorrido de la onda: un frente de polvo sale del borde donde nace y barre el suelo
   * hasta el otro borde; detrás del frente, el suelo sigue soltando polvo y piedritas y una grieta tiembla.
   */
  private updateTailWarning(deltaMs: number): void {
    this.warnElapsed += deltaMs;
    const arena = this.ctx.arena;
    const floorY = this.ctx.floorY;
    const start = this.waveStartX();
    const span = arena.width - 2 * CFG.tailWaveWidth;
    const p = Phaser.Math.Clamp(this.warnElapsed / (this.warnMs * CFG.tailWarnSweep), 0, 1);
    const reach = span * p;
    const dir = this.waveDir;
    this.dustMs -= deltaMs;
    if (this.dustMs <= 0) {
      this.dustMs = CFG.tailWarnDustMs;
      this.dust.emitParticleAt(start, floorY, 2);
      this.dust.emitParticleAt(start + dir * reach, floorY, 2);
      this.dust.emitParticleAt(start + dir * Math.random() * reach, floorY, 1);
      this.pebbles.emitParticleAt(start + dir * Math.random() * reach, floorY - 1, 1);
    }
    // Grieta: tramos cortos al ras del suelo, cada uno con su temblor.
    const g = this.crack;
    const h = CFG.tailWarnCrackHeight;
    const jitter = CFG.tailWarnCrackJitter;
    const step = 6;
    g.clear().fillStyle(CRACK_COLOR, 0.55 + 0.25 * Math.random());
    for (let d = 0; d <= reach; d += step) {
      const x = dir > 0 ? start + d : start - d - step;
      g.fillRect(x, floorY - h - Math.random() * jitter, step - 1, h);
    }
  }

  /** Aviso del fuego: dibujo en el suelo y el aire de la zona, y calor que sube del suelo ya teñido. */
  private updateFireWarning(deltaMs: number): void {
    this.fireWarnElapsed += deltaMs;
    const r = this.fireRect;
    const p = Phaser.Math.Clamp(this.fireWarnElapsed / this.fireWarnMs, 0, 1);
    let cx = r.centerX;
    if (this.attackers.length > 0) {
      cx = 0;
      for (const head of this.attackers) cx += this.mouthX(head);
      cx = Phaser.Math.Clamp(cx / this.attackers.length, r.x, r.right);
    }
    this.flame.drawWarning(r, cx, p, this.scene.time.now);
    this.heatMs -= deltaMs;
    if (this.heatMs <= 0) {
      this.heatMs = CFG.fireWarnHeatMs;
      const sweep = Phaser.Math.Clamp(p / CFG.fireWarnSweep, 0, 1);
      const left = Phaser.Math.Linear(cx, r.x, sweep);
      const right = Phaser.Math.Linear(cx, r.right, sweep);
      this.heat.emitParticleAt(Phaser.Math.FloatBetween(left, right), r.bottom - 2, 1);
    }
  }

  /** La llamarada sigue a los hocicos, agita sus bordes y suelta pavesas desde adentro de la zona. */
  private updateFlame(deltaMs: number): void {
    this.fireClock += deltaMs;
    const m = this.mouths;
    m.length = 0;
    for (const head of this.attackers) m.push(this.mouthX(head), head.img.y + CFG.fireMouthY);
    const r = this.fireRect;
    this.flame.drawFlame(r, m, this.fireClock);
    this.emberMs -= deltaMs;
    if (this.emberMs <= 0) {
      this.emberMs = CFG.fireEmberMs;
      this.embers.emitParticleAt(Phaser.Math.FloatBetween(r.x, r.right), Phaser.Math.FloatBetween(r.y + r.height * 0.3, r.bottom), 1);
      this.embers.emitParticleAt(Phaser.Math.FloatBetween(r.x, r.right), r.bottom - 2, 1);
    }
  }

  /** Hocico de una cabeza que mira a la izquierda (la del fuego). */
  private mouthX(head: Head): number {
    return head.img.x - CFG.headWidth / 2 + CFG.fireMouthX;
  }

  /** La onda avanza ondulando y suelta polvo detrás. */
  private updateWave(deltaMs: number): void {
    this.waveClock += deltaMs;
    const wobble = 1 + CFG.tailWaveWobble * Math.sin((this.waveClock / CFG.tailWaveWobbleMs) * Math.PI * 2);
    this.wave.setScale(1 / ART_K, wobble / ART_K);
    this.dustMs -= deltaMs;
    if (this.dustMs <= 0) {
      this.dustMs = CFG.tailWaveDustMs;
      const back = this.wave.x - this.waveDir * CFG.tailWaveWidth * 0.6;
      this.dust.emitParticleAt(back, this.ctx.floorY, 2);
      this.pebbles.emitParticleAt(this.wave.x, this.ctx.floorY - CFG.tailWaveHeight, 1);
    }
  }

  /** Cabeza expuesta (ventana del fuego o de la mordida): halo que late detrás y estrellitas que giran encima. */
  private updateExposed(head: Head, now: number): void {
    const on = head.exposed && !head.asleep && this.brain.vulnerable && head.img.alpha > 0;
    if (head.halo.visible !== on) {
      head.halo.setVisible(on);
      for (const star of head.stars) star.setVisible(on);
    }
    if (!on) return;
    const pulse = 0.5 + 0.5 * Math.sin((now / CFG.exposedPulseMs) * Math.PI * 2);
    const alpha = CFG.exposedHaloAlphaMin + (CFG.exposedHaloAlphaMax - CFG.exposedHaloAlphaMin) * pulse;
    head.halo.setPosition(head.img.x, head.img.y).setAlpha(alpha).setScale((1 + 0.08 * pulse) / ART_K);
    const spin = (now / CFG.exposedStarSpinMs) * Math.PI * 2;
    const cy = head.img.y - CFG.headHeight / 2 - 4;
    const n = head.stars.length;
    for (let i = 0; i < n; i++) {
      const ang = spin + (i * Math.PI * 2) / n;
      head.stars[i].setPosition(head.img.x + Math.cos(ang) * CFG.exposedStarOrbit, cy + Math.sin(ang) * CFG.exposedStarOrbit * 0.35);
    }
  }

  /**
   * Cadena de escamas sobre una Bézier cuadrática que sube desde el lomo y llega a la cabeza: gruesa en la base
   * (neckWidth) y más fina junto a la cabeza (neckTipScale). Las escamas más cercanas a la cabeza van encima.
   */
  private drawNeck(head: Head, dir: number): void {
    const scales = this.neckScales[head.index];
    const alpha = head.img.alpha;
    const x0 = head.neckX;
    const y0 = head.neckY;
    const x2 = head.img.x - dir * CFG.neckAttachX;
    const y2 = head.img.y;
    const x1 = x0 + (x2 - x0) * CFG.neckCurveLean;
    const y1 = Math.min(y0, y2) - CFG.neckCurveRise;
    const length = (Math.hypot(x2 - x0, y2 - y0) + Math.hypot(x1 - x0, y1 - y0) + Math.hypot(x2 - x1, y2 - y1)) / 2;
    const meanWidth = (CFG.neckWidth * (1 + CFG.neckTipScale)) / 2;
    const count = alpha > 0 ? Phaser.Math.Clamp(Math.ceil(length / (meanWidth * CFG.neckScaleSpacing)) + 1, 2, scales.length) : 0;
    const tint = head.asleep ? SLEEP_TINT : head.color;
    for (let i = 0; i < scales.length; i++) {
      const img = scales[i];
      if (i >= count) {
        if (img.visible) img.setVisible(false);
        continue;
      }
      const t = i / (count - 1);
      const mt = 1 - t;
      const width = CFG.neckWidth * (1 + (CFG.neckTipScale - 1) * t);
      img
        .setVisible(true)
        .setPosition(mt * mt * x0 + 2 * mt * t * x1 + t * t * x2, mt * mt * y0 + 2 * mt * t * y1 + t * t * y2)
        .setScale(width / NECK_SCALE_PX)
        .setTint(tint)
        .setAlpha(alpha);
    }
  }

  protected resetVisuals(): void {
    for (const timer of this.introTimers) timer.remove();
    this.introTimers.length = 0;
    this.attackers = [];
    this.lastHit = undefined;
    this.wave.setVisible(false);
    this.crack.clear();
    this.stopFire();
    this.tail.setScale(1 / ART_K).setAngle(0);
    this.body.setAlpha(1);
    this.tail.setAlpha(1);
    this.necks.setAlpha(1);
    for (const head of this.heads) {
      this.scene.tweens.killTweensOf(head.img);
      head.hp = TEJU_JAGUA_HITS_PER_HEAD;
      head.asleep = false;
      head.harmful = false;
      head.exposed = false;
      head.img.setPosition(head.anchorX, head.anchorY).setAlpha(0).setFlipX(false).setTint(head.color);
      head.eyes.setVisible(false).setScale(CFG.eyeScale);
      head.halo.setVisible(false);
      for (const star of head.stars) star.setVisible(false);
    }
  }

  private boundsOf(head: Head): Phaser.Geom.Rectangle {
    const w = CFG.headWidth;
    const h = CFG.headHeight;
    return this.headRect.setTo(head.img.x - w / 2, head.img.y - h / 2, w, h);
  }

  private moveHead(head: Head, x: number, y: number, ms: number): void {
    this.scene.tweens.killTweensOf(head.img);
    this.scene.tweens.add({ targets: head.img, x, y, duration: ms, ease: 'Sine.easeInOut' });
  }

  private glowEyes(head: Head, on: boolean): void {
    this.scene.tweens.killTweensOf(head.eyes);
    head.eyes.setScale(CFG.eyeScale);
    if (on) this.scene.tweens.add({ targets: head.eyes, scale: CFG.eyeScale * 2, duration: 160, yoyo: true, repeat: -1 });
  }

  private flash(head: Head): void {
    head.img.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
    this.scene.time.delayedCall(GAMEPLAY.boss.hitFlashMs, () => {
      head.img.setTintMode(Phaser.TintModes.MULTIPLY).setTint(head.asleep ? SLEEP_TINT : head.color);
    });
  }

  /** Hasta `n` cabezas despiertas al azar. */
  private randomAwake(n: number): Head[] {
    const awake = this.heads.filter((h) => !h.asleep);
    Phaser.Utils.Array.Shuffle(awake);
    return awake.slice(0, n);
  }
}
