import Phaser from 'phaser';
import { GAMEPLAY } from '../../config/gameplay';
import { TEJU_JAGUA_HEADS, TEJU_JAGUA_HITS_PER_HEAD, getBossDef } from '../../data/bosses';
import { SaveManager } from '../../systems/SaveManager';
import { skinIfAvailable, type SpriteSkin } from '../../systems/SpriteSkin';
import { Boss, type BossContext } from './Boss';
import type { BossTransition } from './BossBrain';
import {
  ART_K,
  BODY_RIM_TEXTURE,
  BODY_TEXTURE,
  bodyGeometry,
  breathLift,
  COLLAR_TEXTURE,
  COLLAR_VARIANTS,
  collarOrigin,
  ensureTejuJaguaArt,
  FlameArt,
  GLOW_TEXTURE,
  GLOW_UNITS,
  HEAD_SHADOW_TEXTURE,
  lerpColor,
  mulColor,
  newTubeColors,
  newTubeShape,
  SHADOW_TEXTURE,
  TubeArt,
  tubeColors,
  type TubeShape,
  type TubeStyle,
  WAVE_TEXTURE,
  waveOrigin,
} from './tejuJaguaArt';

const CFG = GAMEPLAY.tejuJagua;
const LOOK = GAMEPLAY.tejuJaguaLook;
/** Sprite real (npm run sprites → raw/teju_jagua/head/) o placeholder. */
const HEAD_SPRITE = 'teju_jagua_head';
const HEAD_PLACEHOLDER = 'teju_jagua_head_placeholder';
const EYES_TEXTURE = 'teju_jagua_eyes';
const HALO_TEXTURE = 'teju_jagua_halo';
const STAR_TEXTURE = 'teju_jagua_star';
const SLEEP_TINT = 0x2a2838;
/** Lo que la cabeza dormida le hace a su cuello: el mismo oscurecimiento que SLEEP_TINT sobre el tinte de la cabeza. */
const SLEEP_NECK_TINT =
  (Math.min(255, Math.round((0x2a / ((CFG.headColor >> 16) & 255)) * 255)) << 16) |
  (Math.min(255, Math.round((0x28 / ((CFG.headColor >> 8) & 255)) * 255)) << 8) |
  Math.min(255, Math.round((0x38 / (CFG.headColor & 255)) * 255));
/** Polvo y piedritas del coletazo; grieta del aviso; halo y estrellas de la cabeza expuesta; pavesas y calor del fuego. */
const DUST_COLOR = 0xc2a473;
const PEBBLE_COLOR = 0x4a3a28;
const CRACK_COLOR = 0x1e160e;
const EXPOSED_COLOR = 0xffe27a;
const EMBER_COLORS: number[] = [0xfff4c4, 0xffd23c, 0xf08a30, 0xd8441c];
const HEAT_COLOR = 0xffb070;
const FIRE_DEPTH = -0.5;
/** Profundidades del dibujo (de atrás hacia adelante; Kerana está en 0). */
const DEPTH = {
  revealGlow: -7.6,
  groundShadow: -7.5,
  headShadow: -6.8,
  tail: -6,
  body: -5,
  bodyRim: -4.99,
  neck: -3,
  attackerNeck: -2.65,
  snout: -1.95,
  mouth: -1.9,
  eyeGlow: -0.95,
} as const;
/** Centro del cuerpo sobre el suelo (unidades, a tamaño 1: se multiplica por `bodySize`). */
const BODY_FLOOR_OFFSET = 110;
/** Tamaño del cuerpo (gameplay.ts): escala las medidas de esta sección y las del lomo. */
const S = CFG.bodySize;
/** Poses de la cola (índice de `LOOK.tail.follow`). */
const TAIL_REST = 0;
const TAIL_TENSE = 1;
const TAIL_SLAM = 2;
/** Tiempo de la cola tensa antes de empezar a temblar (ms): lo que tarda en levantarse. */
const TAIL_RAISE_MS = 300;

const NECK_STYLE: TubeStyle = {
  segments: LOOK.neck.segments,
  plateStep: LOOK.neck.plateStep,
  ring: false,
  ventralStep: LOOK.neck.ventralStep,
  spikeFrom: 0.06,
  spikeTo: LOOK.neck.spikeTo,
  spikeLen: LOOK.neck.spikeLen,
  spikeEvery: 2,
  maneFrom: LOOK.neck.maneFrom,
  maneLen: LOOK.neck.maneLen,
};
const TAIL_STYLE: TubeStyle = {
  segments: 10,
  plateStep: 0.65,
  ring: true,
  ventralStep: 6,
  spikeFrom: 0.03,
  spikeTo: 0.9,
  spikeLen: [5.5, 1.5],
  spikeEvery: 1,
  maneFrom: 2,
  maneLen: [0, 0],
};

interface Head {
  index: number;
  img: Phaser.GameObjects.Image;
  /** Sprite real que copia a `img` (si está): las animaciones de la cara y el desplazamiento del dibujo van en él. */
  skin?: SpriteSkin;
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
  /** ── Solo dibujo (S101): nada de esto mueve la hitbox, que sigue en `img`. ── */
  neck: Phaser.GameObjects.Graphics;
  tube: TubeArt;
  collar: Phaser.GameObjects.Image;
  glow: Phaser.GameObjects.Image;
  mouth: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Image;
  phase: number;
  /** Desplazamiento del dibujo de la cabeza en este cuadro (unidades). */
  ox: number;
  oy: number;
  swayW: number;
  blinkMs: number;
  blinking: number;
  growlMs: number;
  growling: number;
  /** Ojos encendidos por un aviso. */
  glare: boolean;
  eyeI: number;
  heat: number;
  emberMs: number;
  recoil: number;
  recoilDir: number;
  gather: number;
  droop: number;
  flashMs: number;
  /** Tiempo juntado desde el último dibujo del cuello (los quietos se dibujan en cuadros alternos). */
  neckDt: number;
  /** Punto de control del cuello, que sigue a la cabeza con retraso. */
  lagX: number;
  lagY: number;
  lagInit: boolean;
  /** Cuadro de la cara que se está sosteniendo (dormida o rugido), −1 = la animación corre. */
  heldFrame: number;
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

const approach = (v: number, target: number, rate: number, dt: number): number => v + (target - v) * (1 - Math.exp(-rate * dt));
/** Escala del resplandor para que mida `units` unidades de lado. */
const glowScale = (units: number): number => units / (GLOW_UNITS * ART_K);
const between = (range: readonly [number, number]): number => Phaser.Math.FloatBetween(range[0], range[1]);

// Teju Jagua (GDD §6.1): siete cabezas de perro sobre un cuerpo de lagarto que no se mueve.
// Pelean las cabezas; cada una aguanta 2 golpes y al vencerla se duerme.
export class TejuJagua extends Boss {
  private readonly heads: Head[] = [];
  private readonly body: Phaser.GameObjects.Image;
  /** Silueta de la presentación: solo los bordes que enciende la luz. */
  private readonly bodyRim: Phaser.GameObjects.Image;
  private readonly groundShadow: Phaser.GameObjects.Image;
  private readonly revealGlow: Phaser.GameObjects.Image;
  private readonly tail: Phaser.GameObjects.Graphics;
  private readonly tailTube: TubeArt;
  private readonly tailPose: number[] = [...LOOK.tail.rest];
  private tailMode = TAIL_REST;
  private tailClock = 0;
  private slamHold = 0;
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
  /** Aviso de la mordida (solo dibujo: el cuello se recoge). */
  private biteWarnElapsed = 0;
  private biteWarnMs = 1;
  /** Hocicos de las cabezas que soplan, de a pares (x, y); se reusa cada frame. */
  private readonly mouths: number[] = [];
  private readonly embers: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly heat: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly smoke: Phaser.GameObjects.Particles.ParticleEmitter;
  /** Brasas que se escapan de los hocicos (aviso del fuego y furia). */
  private readonly snout: Phaser.GameObjects.Particles.ParticleEmitter;
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
  /** ── Estado del dibujo (S101) ── */
  private readonly geo = bodyGeometry(BODY_FLOOR_OFFSET);
  /** Luz de la escena: 1 = silueta a oscuras (antes de la pelea), 0 = revelado; `rim`: cuánto se ven sus bordes. */
  private readonly light = { dark: 1, rim: 0 };
  private breathClock = 0;
  private breathFrame = 0;
  private shakeMs = 0;
  private roarMs = 0;
  /** Cuadros dibujados (para alternar los cuellos quietos y la cola en reposo). */
  private frameNo = 0;
  private tailDt = 0;
  private fury = 0;
  private readonly colors = newTubeColors();
  private readonly shape: TubeShape = newTubeShape();

  constructor(scene: Phaser.Scene, ctx: BossContext) {
    super(scene, getBossDef('teju_jagua'), ctx);
    ensureTextures(scene);
    const arena = ctx.arena;
    this.bodyX = arena.centerX;
    this.bodyY = ctx.floorY - BODY_FLOOR_OFFSET * S;

    // Lagarto agazapado pintado una vez (tejuJaguaArt.ts), con su sombra; respira cambiando de cuadro.
    ensureTejuJaguaArt(scene, BODY_FLOOR_OFFSET);
    this.revealGlow = scene.add
      .image(this.bodyX, ctx.floorY - this.geo.hc, GLOW_TEXTURE)
      .setScale(glowScale(this.geo.a * 3), glowScale(this.geo.b * 2.6))
      .setTint(LOOK.palette.warm[4])
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0)
      .setDepth(DEPTH.revealGlow);
    this.groundShadow = scene.add.image(this.bodyX, ctx.floorY, SHADOW_TEXTURE).setScale(1 / ART_K).setAlpha(LOOK.shadow.alpha).setDepth(DEPTH.groundShadow);
    this.body = scene.add.image(this.bodyX, ctx.floorY, BODY_TEXTURE, 'b0').setOrigin(0.5, 1).setScale(1 / ART_K).setDepth(DEPTH.body);
    this.bodyRim = scene.add.image(this.bodyX, ctx.floorY, BODY_RIM_TEXTURE).setOrigin(0.5, 1).setScale(1 / ART_K).setDepth(DEPTH.bodyRim);
    this.tail = scene.add.graphics().setDepth(DEPTH.tail);
    this.tailTube = new TubeArt(this.tail, TAIL_STYLE);
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
    this.snout = scene.add
      .particles(0, 0, 'fx_particle', {
        speedY: { min: -40, max: -14 },
        speedX: { min: -14, max: 14 },
        gravityY: -10,
        lifespan: { min: 420, max: 900 },
        alpha: { start: 1, end: 0 },
        scale: { start: 0.8, end: 0.1 },
        tint: EMBER_COLORS,
        maxParticles: 48,
        emitting: false,
      })
      .setDepth(DEPTH.snout);

    // La cabeza gris del sprite sirve para las siete. El tinte las deja del marrón del lomo.
    const texture = HEAD_PLACEHOLDER;
    const bodyTopY = this.bodyY - CFG.bodyTop * S;
    const half = (TEJU_JAGUA_HEADS - 1) / 2;
    const [cox, coy] = collarOrigin();
    for (let i = 0; i < TEJU_JAGUA_HEADS; i++) {
      const offset = i - half;
      const anchorX = this.bodyX + offset * CFG.fanSpacing;
      // Las de las puntas quedan `fanLift` sobre la cima del lomo; cada lugar hacia el centro sube `fanRise`.
      const anchorY = bodyTopY - CFG.fanLift - (half - Math.abs(offset)) * CFG.fanRise;
      const neckX = this.bodyX + offset * CFG.neckSpacing * S;
      const sleepX = this.bodyX + offset * CFG.sleepSpread * (CFG.bodyWidth / 2) * S;
      const neck = scene.add.graphics().setDepth(DEPTH.neck + i * 0.01);
      const collar = scene.add
        .image(neckX, 0, COLLAR_TEXTURE, `c${i % COLLAR_VARIANTS}`)
        .setOrigin(cox, coy)
        .setScale(1 / ART_K)
        .setFlipX(offset > 0)
        .setDepth(DEPTH.neck + i * 0.01 + 0.005);
      const halo = scene.add.image(anchorX, anchorY, HALO_TEXTURE).setDepth(-2.5).setScale(1 / ART_K).setTint(EXPOSED_COLOR).setVisible(false);
      const img = scene.add.image(anchorX, anchorY, texture).setDepth(-2);
      const skin = skinIfAvailable(scene, img, HEAD_SPRITE, { origin: GAMEPLAY.sprites.tejuHead.origin });
      const eyes = scene.add.image(anchorX, anchorY, EYES_TEXTURE).setDepth(-1).setScale(CFG.eyeScale);
      const glow = scene.add.image(anchorX, anchorY, GLOW_TEXTURE).setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH.eyeGlow).setVisible(false);
      const mouth = scene.add.image(anchorX, anchorY, GLOW_TEXTURE).setBlendMode(Phaser.BlendModes.ADD).setTint(LOOK.palette.mouth).setDepth(DEPTH.mouth).setVisible(false);
      const shadow = scene.add.image(anchorX, ctx.floorY, HEAD_SHADOW_TEXTURE).setScale(1 / ART_K).setDepth(DEPTH.headShadow).setVisible(false);
      const stars: Phaser.GameObjects.Image[] = [];
      for (let k = 0; k < CFG.exposedStars; k++) stars.push(scene.add.image(anchorX, anchorY, STAR_TEXTURE).setDepth(0).setVisible(false));
      const color = CFG.headColor;
      this.heads.push({
        index: i,
        img,
        skin,
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
        neck,
        tube: new TubeArt(neck, NECK_STYLE),
        collar,
        glow,
        mouth,
        shadow,
        phase: i * 1.37,
        ox: 0,
        oy: 0,
        swayW: 0,
        blinkMs: between(LOOK.head.blinkEvery),
        blinking: 0,
        growlMs: between(LOOK.head.growlEvery),
        growling: 0,
        glare: false,
        eyeI: 0,
        heat: 0,
        emberMs: 0,
        recoil: 0,
        recoilDir: 1,
        gather: 0,
        droop: 0,
        flashMs: 0,
        neckDt: 0,
        lagX: 0,
        lagY: 0,
        lagInit: false,
        heldFrame: -1,
      });
    }
    this.resetVisuals();
  }

  // ── Presentación ──────────────────────────────────────────────────────────

  protected playIntro(onDone: () => void): void {
    // A oscuras, siete pares de ojos de fuego se encienden uno a uno; al final la luz revela la silueta y ruge.
    const time = this.scene.time;
    this.heads.forEach((head, i) => {
      this.introTimers.push(
        time.delayedCall(i * CFG.introEyeMs, () => {
          head.eyes.setVisible(true);
          head.glow.setVisible(true);
          // Se encienden de golpe y bajan a su brillo de reposo.
          head.eyeI = 1;
          if (i % 2 === 0) this.ctx.sfx('growl');
        }),
      );
    });
    const shown = TEJU_JAGUA_HEADS * CFG.introEyeMs;
    // Mientras se encienden los ojos, la luz de los cristales va dibujando los bordes.
    this.scene.tweens.add({ targets: this.light, rim: 1, duration: shown, ease: 'Sine.easeIn' });
    this.introTimers.push(
      time.delayedCall(shown, () => this.reveal()),
      time.delayedCall(shown + LOOK.intro.revealMs, onDone),
    );
  }

  /** La luz revela al lagarto entero y ruge (mismo tiempo que el fundido de antes). */
  private reveal(): void {
    const I = LOOK.intro;
    this.scene.tweens.add({ targets: this.light, dark: 0, duration: I.revealMs, ease: 'Cubic.easeOut' });
    const flashes = SaveManager.current.settings.flashes;
    // El oro del fondo se enciende detrás: un resplandor que se apaga (con «Destellos: no», suave y sin golpe).
    this.scene.tweens.killTweensOf(this.revealGlow);
    this.revealGlow.setAlpha(0);
    this.scene.tweens.chain({
      targets: this.revealGlow,
      tweens: [
        { alpha: flashes ? I.glowAlpha : I.glowAlpha * 0.35, duration: flashes ? 120 : 400, ease: 'Quad.easeOut' },
        { alpha: 0, duration: 900, ease: 'Quad.easeIn' },
      ],
    });
    this.roarMs = I.roarMs;
    for (const head of this.heads) this.holdFrame(head, LOOK.head.roarFrame);
    this.ctx.sfx('growl');
    this.ctx.sfx('stomp');
    this.ctx.shake(I.roarShakeMs, I.roarShake);
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
    this.biteWarnElapsed = 0;
    this.biteWarnMs = Math.max(1, telegraphMs);
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
    this.tailMode = TAIL_TENSE;
    this.tailClock = 0;
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
    this.tailMode = TAIL_SLAM;
    this.slamHold = LOOK.tail.slamHoldMs;
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
    if (this.tailMode === TAIL_TENSE) this.tailMode = TAIL_REST;
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
    head.glow.setVisible(false);
    head.img.setTint(SLEEP_TINT);
    this.holdFrame(head, LOOK.head.sleepFrame);
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
    // Después de la pelea el jefe ya no se actualiza: se funde todo lo que se ve, tal como quedó.
    const targets: Phaser.GameObjects.GameObject[] = [this.body, this.bodyRim, this.groundShadow, this.tail];
    for (const h of this.heads) targets.push(h.img, h.eyes, h.glow, h.mouth, h.neck, h.collar, h.shadow);
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
    if (this.brain.state === 'telegraph' && attackId === 'bite') this.biteWarnElapsed += deltaMs;
    if (this.fireOn) this.updateFlame(deltaMs);
    this.drawCreature(deltaMs);
  }

  /** Cuerpo, cola, cuellos y cabezas en este cuadro (también una vez al reiniciar, con `deltaMs` 0). */
  private drawCreature(deltaMs: number): void {
    const now = this.scene.time.now;
    const asleep = this.heads.reduce((n, h) => n + (h.asleep ? 1 : 0), 0);
    this.fury = asleep / Math.max(1, TEJU_JAGUA_HEADS - 1);
    this.frameNo++;
    this.updateBody(deltaMs);
    this.drawTail(deltaMs, now);
    for (const head of this.heads) {
      this.updateHead(head, deltaMs, now);
      this.drawNeck(head, deltaMs, now);
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

  /** Desplazamiento de la sacudida del golpe en este cuadro (unidades): todo el cuerpo a la vez. */
  private shakeOffset(): number {
    const H = LOOK.hit;
    if (this.shakeMs <= 0) return 0;
    const left = this.shakeMs / H.shakeMs;
    return H.shakeAmp * left * Math.sin((1 - left) * (H.shakeMs / 1000) * H.shakeHz * Math.PI * 2);
  }

  /** Respiración (cuadro pintado del torso), sacudida y luz de la presentación. */
  private updateBody(deltaMs: number): void {
    const B = LOOK.breath;
    const period = B.periodMs * (1 - B.furyFaster * this.fury);
    this.breathClock = (this.breathClock + deltaMs / period) % 1;
    // Inspira y espira pasando por los cuadros: 0, 1, 2, 1, 0…
    const frames = B.frames;
    const frame = Math.round(((1 - Math.cos(this.breathClock * Math.PI * 2)) / 2) * (frames - 1));
    if (frame !== this.breathFrame) {
      this.breathFrame = frame;
      this.body.setFrame(`b${frame}`);
    }
    this.shakeMs = Math.max(0, this.shakeMs - deltaMs);
    this.roarMs = Math.max(0, this.roarMs - deltaMs);
    const sx = this.shakeOffset();
    const floorY = this.ctx.floorY;
    this.body.setPosition(this.bodyX + sx, floorY);
    this.bodyRim.setPosition(this.bodyX + sx, floorY);
    const tint = this.darkTint();
    this.body.setTint(tint);
    this.bodyRim.setAlpha(this.light.rim * this.light.dark * this.body.alpha).setVisible(this.light.dark > 0.01);
    this.groundShadow.setAlpha(LOOK.shadow.alpha * this.body.alpha);
  }

  /** Nada cambia de golpe: sin sacudida, sin rugido y con la luz quieta (se puede dibujar en cuadros alternos). */
  private calm(): boolean {
    return this.shakeMs <= 0 && this.roarMs <= 0 && (this.light.dark <= 0 || this.light.dark >= 1);
  }

  /** Tinte de la silueta: negro azulado a oscuras, sin tinte una vez revelado. */
  private darkTint(): number {
    return lerpColor(0xffffff, LOOK.intro.darkMul, this.light.dark);
  }

  /** Cuánto sube y se corre el lomo con la respiración en un punto (x, y del mundo) sobre su superficie. */
  private breathAt(x: number, y: number, out: { x: number; y: number }): void {
    const by = breathLift(this.breathFrame);
    out.x = (x - this.bodyX) * by * 0.5;
    out.y = -(this.ctx.floorY - y) * by;
  }

  private readonly tmpBreath = { x: 0, y: 0 };

  /** Cola: sigue su pose (reposo, tensa, golpe), se mece con retraso hacia la punta y tiembla tensa. */
  private drawTail(deltaMs: number, now: number): void {
    const T = LOOK.tail;
    // En reposo se mueve lento: se dibuja un cuadro sí y otro no (tensa o golpeando, siempre).
    this.tailDt += deltaMs;
    if (deltaMs > 0 && this.tailMode === TAIL_REST && this.calm() && this.frameNo % 2 === 0) return;
    deltaMs = this.tailDt;
    this.tailDt = 0;
    if (this.tailMode === TAIL_SLAM) {
      this.slamHold -= deltaMs;
      if (this.slamHold <= 0) this.tailMode = TAIL_REST;
    }
    this.tailClock += deltaMs;
    const target = this.tailMode === TAIL_TENSE ? T.tense : this.tailMode === TAIL_SLAM ? T.slam : T.rest;
    const pose = this.tailPose;
    const k = deltaMs > 0 ? 1 - Math.exp(-deltaMs / T.follow[this.tailMode]) : 1;
    for (let i = 0; i < pose.length; i++) pose[i] += (target[i] - pose[i]) * k;
    const fury = this.fury;
    const rest = this.tailMode === TAIL_REST ? 1 : 0.15;
    const tau = (now / (T.swayMs * (1 - 0.4 * fury))) * Math.PI * 2;
    const amp = rest * (1 + fury);
    const tremble = this.tailMode === TAIL_TENSE && this.tailClock > TAIL_RAISE_MS ? T.tremble : 0;
    const tr = (n: number): number => tremble * Math.sin(now * 0.001 * T.trembleHz * Math.PI * 2 + n);
    const sx = this.shakeOffset();
    const bx = this.bodyX + sx;
    const fy = this.ctx.floorY;
    const sh = this.shape;
    sh.x0 = bx + pose[0];
    sh.y0 = fy - pose[1];
    sh.x1 = bx + pose[2];
    sh.y1 = fy - pose[3];
    sh.x2 = bx + pose[4] + Math.sin(tau - 0.6) * T.swayAmp[0] * 0.5 * amp + tr(1);
    sh.y2 = fy - pose[5] - Math.sin(tau - 0.2) * T.swayAmp[1] * 0.4 * amp + tr(2);
    sh.x3 = bx + pose[6] + Math.sin(tau) * T.swayAmp[0] * amp + tr(3);
    sh.y3 = fy - pose[7] - Math.sin(tau + 0.8) * T.swayAmp[1] * amp + tr(4);
    sh.w0 = T.baseWidth;
    sh.w1 = T.tipWidth;
    sh.flare = 0.15;
    sh.back = 1;
    sh.dorsalUp = true;
    sh.waveAmp = 0;
    sh.coil = 0;
    sh.maneSway = 0;
    sh.warmR = 0;
    const tint = this.darkTint();
    tubeColors(this.colors, tint, 0xffffff);
    this.tail.clear().setAlpha(this.body.alpha);
    this.tailTube.draw(sh, this.colors, this.rimAlpha());
  }

  /** Alfa de los bordes de luz de cuellos y cola: a oscuras se ven solo con la luz de la presentación. */
  private rimAlpha(): number {
    return this.light.dark > 0 ? Phaser.Math.Linear(1, this.light.rim, this.light.dark) : 1;
  }

  /**
   * Cabeza: se mece, parpadea, gruñe, cuelga dormida y se ve más furiosa cuantas más duermen. Todo es desplazamiento
   * del dibujo (SpriteSkin.shakeX/Y): la hitbox sigue en `img`, y en los ataques el dibujo coincide con ella.
   */
  private updateHead(head: Head, deltaMs: number, now: number): void {
    const H = LOOK.head;
    const dt = deltaMs / 1000;
    const dir = head.img.flipX ? 1 : -1;
    const attacking = this.attackers.includes(head);
    const fury = this.fury;
    head.swayW = deltaMs > 0 ? approach(head.swayW, !head.asleep && !attacking ? 1 : 0, 8, dt) : !head.asleep && !attacking ? 1 : 0;
    // Mecerse (más con la furia).
    const swayAmp = head.swayW * (1 + 0.6 * fury);
    let ox = Math.sin((now / H.swayMsX) * Math.PI * 2 + head.phase) * H.swayX * swayAmp;
    let oy = Math.sin((now / H.swayMsY) * Math.PI * 2 + head.phase * 1.3) * H.swayY * swayAmp;
    // Parpadeo y gruñido, cada tanto.
    head.blinkMs -= deltaMs;
    if (head.blinkMs <= 0) {
      head.blinking = H.blinkMs;
      head.blinkMs = between(H.blinkEvery);
    }
    head.blinking = Math.max(0, head.blinking - deltaMs);
    head.growlMs -= deltaMs * (1 + H.furyFaster * fury * 2);
    if (head.growlMs <= 0) {
      head.growlMs = between(H.growlEvery);
      if (!head.asleep && !attacking) head.growling = H.growlMs;
    }
    head.growling = Math.max(0, head.growling - deltaMs);
    if (head.growling > 0) {
      ox += Math.sin(now * 0.19 + head.phase) * H.growlJitter;
      oy += Math.cos(now * 0.23 + head.phase) * H.growlJitter * 0.6;
    }
    // Rugido de la presentación: se alzan.
    if (this.roarMs > 0) oy -= LOOK.intro.roarLift * Math.sin((this.roarMs / LOOK.intro.roarMs) * Math.PI);
    else if (head.heldFrame === LOOK.head.roarFrame) this.releaseFrame(head);
    // Aviso de la mordida: la cabeza se echa atrás mientras el cuello se recoge; en el lanzón vuelve de golpe.
    const biting = attacking && this.brain.attack?.id === 'bite';
    const gatherTarget = biting && this.brain.state === 'telegraph' ? Phaser.Math.Clamp(this.biteWarnElapsed / this.biteWarnMs, 0, 1) : 0;
    head.gather = gatherTarget > head.gather ? gatherTarget : deltaMs > 0 ? approach(head.gather, 0, 25, dt) : 0;
    const g = Phaser.Math.Easing.Sine.Out(head.gather);
    ox -= dir * LOOK.neck.recoil * g;
    oy -= 1.5 * g;
    // Golpe: se echa atrás, lejos de Kerana.
    head.recoil = deltaMs > 0 ? approach(head.recoil, 0, 9, dt) : 0;
    ox += head.recoilDir * head.recoil;
    // Dormida: cuelga, respira lento y sube con el lomo.
    const droopTarget = head.asleep ? H.sleepDroopDeg * dir : 0;
    head.droop = deltaMs > 0 ? approach(head.droop, droopTarget, 4, dt) : droopTarget;
    head.img.setAngle(head.droop);
    if (head.asleep) {
      oy += Math.sin((now / H.sleepBreathMs) * Math.PI * 2 + head.phase) * H.sleepBreathAmp;
      this.breathAt(head.img.x, head.img.y, this.tmpBreath);
      ox += this.tmpBreath.x;
      oy += this.tmpBreath.y;
    }
    ox += this.shakeOffset();
    head.ox = ox;
    head.oy = oy;
    if (head.skin) {
      head.skin.shakeX = ox;
      head.skin.shakeY = oy;
      const anims = head.skin.sprite.anims;
      anims.timeScale = head.growling > 0 ? 2.2 : head.glare ? 1.6 : 1 + fury * 0.6;
    }
    // Tinte: el de su estado, a oscuras en la presentación (salvo durante el destello del golpe).
    if (head.flashMs > 0) {
      head.flashMs -= deltaMs;
      if (head.flashMs <= 0) head.img.setTintMode(Phaser.TintModes.MULTIPLY);
    }
    if (head.flashMs <= 0) head.img.setTint(mulColor(head.asleep ? SLEEP_TINT : head.color, this.darkTint()));
    this.updateEyes(head, deltaMs, now, dir);
    this.updateShadow(head);
  }

  /** Ojos y boca: brillo de reposo según la furia, al máximo en un aviso; brasas en el hocico. */
  private updateEyes(head: Head, deltaMs: number, now: number, dir: number): void {
    const E = LOOK.eyes;
    const P = LOOK.palette;
    const dt = deltaMs / 1000;
    const fury = this.fury;
    const x = head.img.x + head.ox;
    const y = head.img.y + head.oy;
    const alpha = head.img.alpha;
    // La última despierta, la peor.
    const furyTarget = E.base + E.fury * fury;
    const target = head.asleep ? 0 : head.glare ? 1 : furyTarget;
    head.eyeI = deltaMs > 0 ? approach(head.eyeI, target, head.eyeI > target ? 3 : 10, dt) : target;
    const blink = head.blinking > 0 && !head.glare ? 0.25 : 1;
    head.eyes.setPosition(x + dir * CFG.eyeOffsetX, y + CFG.eyeOffsetY).setAlpha(alpha).setScale(CFG.eyeScale, CFG.eyeScale * blink);
    const pulse = head.glare && SaveManager.current.settings.flashes ? 0.85 + 0.15 * Math.sin((now / E.glarePulseMs) * Math.PI) : 1;
    const i = head.eyeI;
    const glowColor = head.glare ? lerpColor(P.eye, P.eyeHot, i * 0.6) : lerpColor(P.eye, P.eyeFury, fury);
    const scale = (E.glowScale[0] + (E.glowScale[1] - E.glowScale[0]) * i) * pulse;
    head.glow
      .setPosition(head.eyes.x, head.eyes.y)
      .setScale(glowScale(scale * E.glowSize))
      .setTint(glowColor)
      .setAlpha(E.glowAlpha * i * blink * alpha);
    // Calor en la boca: aviso del fuego (crece con el aviso) y furia (a partir de unas cuantas dormidas).
    const B = LOOK.embers;
    const warn = head.glare && this.brain.state === 'telegraph' && this.brain.attack?.id === 'fire';
    const p = warn ? Phaser.Math.Clamp(this.fireWarnElapsed / this.fireWarnMs, 0, 1) : 0;
    const furyHeat = !head.asleep && fury >= B.furyFrom ? 0.25 + 0.35 * fury : 0;
    const heatTarget = warn ? 0.3 + 0.7 * p : furyHeat * (0.75 + 0.25 * Math.sin(now * 0.013 + head.phase));
    head.heat = deltaMs > 0 ? approach(head.heat, heatTarget, 8, dt) : heatTarget;
    const mx = this.snoutX(head);
    const my = head.img.y + head.oy + CFG.fireMouthY;
    const on = head.heat > 0.02 && alpha > 0 && this.light.dark < 0.5;
    head.mouth.setVisible(on);
    if (on) head.mouth.setPosition(mx, my).setScale(glowScale(B.mouthScale * (0.5 + 0.5 * head.heat) * E.glowSize)).setAlpha(head.heat * 0.8 * alpha);
    head.emberMs -= deltaMs;
    if (on && head.emberMs <= 0) {
      const every = warn ? B.warnEvery[0] + (B.warnEvery[1] - B.warnEvery[0]) * p : B.furyEvery[0] + (B.furyEvery[1] - B.furyEvery[0]) * fury;
      head.emberMs = every;
      if (warn || furyHeat > 0) this.snout.emitParticleAt(mx, my, 1);
      // La última despierta echa humo por la nariz.
      if (!warn && fury >= 0.99 && Math.random() < 0.35) this.smoke.emitParticleAt(mx, my - 3, 1);
    }
  }

  /** Punta del hocico, mirando a donde mire la cabeza (dibujo). */
  private snoutX(head: Head): number {
    const tip = CFG.headWidth / 2 - CFG.fireMouthX;
    return head.img.x + head.ox + (head.img.flipX ? tip : -tip);
  }

  /** Sombra de la cabeza en el suelo cuando baja cerca de él. */
  private updateShadow(head: Head): void {
    const D = LOOK.shadow;
    const bottom = head.img.y + head.oy + CFG.headHeight * 0.35;
    const dist = this.ctx.floorY - bottom;
    const near = !head.asleep && dist < D.headRange && dist > -4 && head.img.alpha > 0;
    head.shadow.setVisible(near);
    if (!near) return;
    const k = Phaser.Math.Clamp(1 - dist / D.headRange, 0, 1);
    head.shadow.setPosition(head.img.x + head.ox, this.ctx.floorY).setAlpha(D.headAlpha * k * head.img.alpha).setScale((0.6 + 0.4 * k) / ART_K, 1 / ART_K);
  }

  /** Aviso del coletazo, por el recorrido de la onda: un frente de polvo sale del borde donde nace y barre el suelo
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
    const hx = head.img.x + head.ox;
    const hy = head.img.y + head.oy;
    const pulse = 0.5 + 0.5 * Math.sin((now / CFG.exposedPulseMs) * Math.PI * 2);
    const alpha = CFG.exposedHaloAlphaMin + (CFG.exposedHaloAlphaMax - CFG.exposedHaloAlphaMin) * pulse;
    head.halo.setPosition(hx, hy).setAlpha(alpha).setScale((1 + 0.08 * pulse) / ART_K);
    const spin = (now / CFG.exposedStarSpinMs) * Math.PI * 2;
    const cy = hy - CFG.headHeight / 2 - 4;
    const n = head.stars.length;
    for (let i = 0; i < n; i++) {
      const ang = spin + (i * Math.PI * 2) / n;
      head.stars[i].setPosition(hx + Math.cos(ang) * CFG.exposedStarOrbit, cy + Math.sin(ang) * CFG.exposedStarOrbit * 0.35);
    }
  }

  /**
   * Cuello: tubo sobre una Bézier del lomo a la cabeza, grueso en la base y fino junto a la cabeza (tejuJaguaArt.ts).
   * El punto de control sigue a la cabeza con retraso, la onda viaja de la base a la cabeza, en el aviso de la mordida
   * se recoge en S y dormido cuelga. El collar tapa la raíz; los cuellos que atacan van delante de los demás.
   */
  private drawNeck(head: Head, deltaMs: number, now: number): void {
    const N = LOOK.neck;
    const dir = head.img.flipX ? 1 : -1;
    const alpha = head.img.alpha;
    const shake = this.shakeOffset();
    this.breathAt(head.neckX, head.neckY, this.tmpBreath);
    const x0 = head.neckX + this.tmpBreath.x + shake;
    const y0 = head.neckY + this.tmpBreath.y;
    const attacking = this.attackers.includes(head);
    const depth = (attacking ? DEPTH.attackerNeck : DEPTH.neck) + head.index * 0.01;
    if (head.neck.depth !== depth) {
      head.neck.setDepth(depth);
      head.collar.setDepth(depth + 0.005);
    }
    head.collar.setPosition(x0, y0 - LOOK.collar.lift).setTint(this.darkTint()).setAlpha(this.body.alpha);
    // Los cuellos quietos se dibujan en cuadros alternos (la mitad en cada uno); el que ataca, siempre.
    head.neckDt += deltaMs;
    if (deltaMs > 0 && !attacking && this.calm() && (this.frameNo + head.index) % 2 === 0) {
      head.neck.setAlpha(alpha);
      return;
    }
    deltaMs = head.neckDt;
    head.neckDt = 0;
    head.neck.clear().setAlpha(alpha);
    if (alpha <= 0) return;
    const x3 = head.img.x + head.ox - dir * CFG.neckAttachX;
    const y3 = head.img.y + head.oy;
    // Control (como antes: un poco hacia la cabeza y por encima del extremo más alto), recogido en el aviso.
    const gather = Phaser.Math.Easing.Sine.Out(head.gather);
    let qx = x0 + (x3 - x0) * CFG.neckCurveLean * (1 - N.gatherPull * gather);
    let qy = Math.min(y0, y3) - CFG.neckCurveRise - N.gatherRise * gather;
    if (head.asleep) {
      // Dormido: el cuello cuelga entre la raíz y la cabeza.
      qx = (x0 + x3) / 2;
      qy = Math.max(y0, y3) + N.droopSag - Math.abs(x3 - x0) * 0.15;
    }
    if (!head.lagInit || deltaMs <= 0) {
      head.lagX = qx;
      head.lagY = qy;
      head.lagInit = true;
    } else {
      const k = 1 - Math.exp(-deltaMs / N.lagMs);
      head.lagX += (qx - head.lagX) * k;
      head.lagY += (qy - head.lagY) * k;
    }
    const sh = this.shape;
    sh.x0 = x0;
    sh.y0 = y0;
    sh.x3 = x3;
    sh.y3 = y3;
    // Cuadrática → cúbica.
    sh.x1 = x0 + ((head.lagX - x0) * 2) / 3;
    sh.y1 = y0 + ((head.lagY - y0) * 2) / 3;
    sh.x2 = x3 + ((head.lagX - x3) * 2) / 3;
    sh.y2 = y3 + ((head.lagY - y3) * 2) / 3;
    sh.w0 = CFG.neckWidth;
    sh.w1 = CFG.neckWidth * CFG.neckTipScale;
    sh.flare = N.flare;
    sh.back = -dir;
    sh.dorsalUp = head.asleep;
    const fury = this.fury;
    const waveMs = head.asleep ? N.sleepWaveMs : N.waveMs * (1 - 0.35 * fury);
    sh.waveAmp = head.asleep ? N.sleepWaveAmp : N.waveAmp * (1 + 0.5 * fury) * (0.4 + 0.6 * head.swayW) * (1 - gather);
    sh.wavePhase = (now / waveMs) * Math.PI * 2 + head.phase;
    sh.waveCount = 1;
    sh.coil = N.gatherCoil * gather * -dir;
    sh.maneSway = 0.12 * Math.sin(now / 700 + head.phase) + (head.growling > 0 ? 0.15 : 0);
    sh.warmX = this.bodyX;
    sh.warmR = this.geo.a * LOOK.light.warmReach;
    const tint = mulColor(head.asleep ? SLEEP_NECK_TINT : 0xffffff, this.darkTint());
    tubeColors(this.colors, tint, head.asleep ? SLEEP_NECK_TINT : 0xffffff);
    head.tube.draw(sh, this.colors, this.rimAlpha() * (head.asleep ? 0.5 : 1));
  }

  protected resetVisuals(): void {
    for (const timer of this.introTimers) timer.remove();
    this.introTimers.length = 0;
    this.attackers = [];
    this.lastHit = undefined;
    this.wave.setVisible(false);
    this.crack.clear();
    this.stopFire();
    this.scene.tweens.killTweensOf(this.light);
    this.scene.tweens.killTweensOf(this.revealGlow);
    this.revealGlow.setAlpha(0);
    // Antes de la pelea es una silueta a oscuras, con un poco de luz fría en los bordes y los ojos apagados.
    this.light.dark = 1;
    this.light.rim = LOOK.intro.rimStart;
    this.tailMode = TAIL_REST;
    this.tailPose.splice(0, this.tailPose.length, ...LOOK.tail.rest);
    this.shakeMs = 0;
    this.roarMs = 0;
    this.body.setAlpha(1);
    this.bodyRim.setAlpha(1);
    this.tail.setAlpha(1);
    for (const head of this.heads) {
      this.scene.tweens.killTweensOf(head.img);
      head.hp = TEJU_JAGUA_HITS_PER_HEAD;
      head.asleep = false;
      head.harmful = false;
      head.exposed = false;
      head.img.setPosition(head.anchorX, head.anchorY).setAlpha(1).setFlipX(false).setAngle(0).setTintMode(Phaser.TintModes.MULTIPLY).setTint(head.color);
      head.eyes.setVisible(false).setScale(CFG.eyeScale);
      head.glow.setVisible(false);
      head.mouth.setVisible(false);
      head.halo.setVisible(false);
      for (const star of head.stars) star.setVisible(false);
      head.glare = false;
      head.eyeI = 0;
      head.heat = 0;
      head.recoil = 0;
      head.gather = 0;
      head.droop = 0;
      head.flashMs = 0;
      head.lagInit = false;
      head.neck.setAlpha(1);
      head.collar.setAlpha(1);
      this.releaseFrame(head);
    }
    // El jefe se actualiza solo durante la pelea: la silueta queda dibujada desde ya.
    this.drawCreature(0);
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

  /** Ojos encendidos de un aviso (el brillo se ve en updateEyes). */
  private glowEyes(head: Head, on: boolean): void {
    head.glare = on;
  }

  /** Sostiene un cuadro de la cara (dormida: la boca cerrada; rugido: abierta). */
  private holdFrame(head: Head, frame: number): void {
    const anims = head.skin?.sprite.anims;
    const frames = anims?.currentAnim?.frames;
    if (!anims || !frames || frames.length === 0) return;
    anims.pause(frames[Math.min(frame, frames.length - 1)]);
    head.heldFrame = frame;
  }

  private releaseFrame(head: Head): void {
    if (head.heldFrame < 0) return;
    head.heldFrame = -1;
    if (head.asleep) {
      this.holdFrame(head, LOOK.head.sleepFrame);
      return;
    }
    head.skin?.sprite.anims.resume();
  }

  /** Golpe: destello de la cabeza (si los destellos están permitidos), se echa atrás y se sacude el cuerpo entero. */
  private flash(head: Head): void {
    head.flashMs = GAMEPLAY.boss.hitFlashMs;
    if (SaveManager.current.settings.flashes) head.img.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
    head.recoil = LOOK.hit.recoil;
    head.recoilDir = head.img.x >= this.ctx.playerX() ? 1 : -1;
    this.shakeMs = LOOK.hit.shakeMs;
    // Las garras raspan el suelo.
    const reach = this.geo.a;
    this.dust.emitParticleAt(this.bodyX - reach, this.ctx.floorY, 2);
    this.dust.emitParticleAt(this.bodyX + reach, this.ctx.floorY, 2);
  }

  /** Hasta `n` cabezas despiertas al azar. */
  private randomAwake(n: number): Head[] {
    const awake = this.heads.filter((h) => !h.asleep);
    Phaser.Utils.Array.Shuffle(awake);
    return awake.slice(0, n);
  }
}
