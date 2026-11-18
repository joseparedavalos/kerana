import Phaser from 'phaser';
import { GAMEPLAY } from '../../config/gameplay';
import { getBossDef } from '../../data/bosses';
import { Boss, type BossContext } from './Boss';
import type { BossTransition } from './BossBrain';
import {
  ART_K,
  type BodyPoint,
  drawSnakeBody,
  type HighBack,
  ensureMonaiArt,
  addArtTree,
  ensureBranchArt,
  ensureTreeArt,
  hasTreeArt,
  GLOW_TEXTURE,
  HEAD_DAZE_TEXTURE,
  HEAD_OPEN_TEXTURE,
  HEAD_SPRITE,
  HEAD_TEXTURE,
  HEART_TEXTURE,
  headOrigin,
  hornTips,
  HORN_SHEEN_PREFIX,
  HORNS_TEXTURE,
  LEAF_PREFIX,
  RING_SIZE,
  RING_TEXTURE,
  SHADOW_OVAL,
  SHADOW_OVAL_TEXTURE,
  SKIN_KEYS,
  SPARKLE_TEXTURE,
  STAR_TEXTURE,
  STREAK_TEXTURE,
  TONGUE_FRAMES,
  TONGUE_PREFIX,
} from './monaiArt';
import { LAYER_BACK, LAYER_FRONT, LAYER_HIGH, SnakeRig } from './monaiBody';
import { bodyRadius } from './monaiPaint';
import { SaveManager } from '../../systems/SaveManager';
import {
  type CoilPlan,
  coilPlan,
  coilStep,
  groundHeadY,
  HeartThief,
  type MonaiExposed,
  pulseBlocked,
  restingSegmentY,
  strikeTargets,
  strikeZone,
  type Trunk,
} from './monaiLogic';
import { DEBUG } from '../../config/debug';
import { hasSprite, spriteDetail } from '../../systems/SpriteSkin';

const CFG = GAMEPLAY.monai;
const LOOK = GAMEPLAY.monaiLook;
const TILE = 16;
const SHADOW_COLOR = 0x1b1a2e;
const PULSE_COLORS = [0xe06bd0, 0x6bd0e0, 0xe0d06b] as const;
const HEART_COLOR = 0xe04848;
/**
 * Los cuernos brillan: halo de color alrededor de las puntas (desplazamiento desde la cabeza mirando a la izquierda).
 * Sigue el largo de los cuernos (S43): con `hornLength` 1 es el de S26 (13, −13, radio 13); con 0 queda en sus bases.
 */
const HORN_GLOW = { dx: 5 + 8 * CFG.hornLength, dy: -6.5 - 6.5 * CFG.hornLength, r: 6 + 7 * CFG.hornLength, alpha: 0.35 };
/** Las estrellitas de mareo, sobre la cabeza (px). */
const STARS_RISE = 16;
/** Puntos de control del dibujo: la nuca bajo la cabeza, cada segmento y la punta de la cola. */
const CONTROLS = CFG.segments + 2;

/** Color del ciclo iridiscente (los del pulso) en la fracción `f` del ciclo, mezclado suave entre uno y otro. */
function iridescent(f: number): number {
  const n = PULSE_COLORS.length;
  const x = (((f % 1) + 1) % 1) * n;
  const i = Math.floor(x);
  const t = x - i;
  const a = PULSE_COLORS[i % n];
  const b = PULSE_COLORS[(i + 1) % n];
  const ch = (sh: number) => Math.round(((a >> sh) & 255) * (1 - t) + ((b >> sh) & 255) * t);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

/** Azar del dibujo con semilla (no toca Math.random: el cerebro y las copas lo usan). */
function visualRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TONGUE_KEYS = Array.from({ length: TONGUE_FRAMES }, (_, i) => `${TONGUE_PREFIX}${i}`);
const SHEEN_KEYS = Array.from({ length: LOOK.horns.sheenFrames }, (_, i) => `${HORN_SHEEN_PREFIX}${i}`);
/** Lengüetazo: cuadros de la lengua mientras sale (0 = corta … 3 = horqueta abierta). */
const TONGUE_SEQ = [0, 1, 2, 3, 2, 3, 2, 1, 0] as const;
const TAU = Math.PI * 2;
const smoothstep = (v: number): number => {
  const t = v < 0 ? 0 : v > 1 ? 1 : v;
  return t * t * (3 - 2 * t);
};

/** Una hoja que cae de la copa en el aviso de la caída. */
interface Leaf {
  img: Phaser.GameObjects.Image;
  vx: number;
  vy: number;
  life: number;
  phase: number;
}

/** Lo que depende del dibujo de cada árbol (S67): dónde se posa la cabeza y cómo se enrosca el cuerpo. */
interface TreeSpot {
  perchY: number;
  coil: CoilPlan;
  /** Las vueltas de atrás cuyo borde de arriba queda sobre esta van delante de la copa (`HighBack`). */
  highBelowY: number;
  /** S102: dónde empieza el tronco visible bajo la copa (la sombra del cuerpo en la corteza va de acá al suelo). */
  barkTopY: number;
}

interface Segment {
  x: number;
  y: number;
  /** Vuelta del enroscado que queda detrás del tronco. */
  back: boolean;
}

// Moñái (GDD §6.3): serpiente con cuernos que se esconde en las copas de la isla de monte.
// Fase 1: descenso con sombra. Fase 2: + pulso de hipnosis (los troncos lo tapan).
// Fase 3: + robo de un corazón que se recupera golpeando la cola; descensos más rápidos.
// Arte por código (S26, monaiArt.ts): cuernos y cuerpo de serpiente enroscado en el tronco. La cabeza es el sprite
// `monai_head` (S43); si falta, la dibujada por código. Árboles: el prop `l3_arboles/shade_tree_green` (S67); si falta
// el atlas, los de código de S26.
export class Monai extends Boss {
  private readonly head: Phaser.GameObjects.Sprite;
  /** La cabeza es el sprite (no la textura por código) y su escala de reposo. */
  private readonly headSprite: boolean;
  private readonly headScale: number;
  private headMood: 'idle' | 'attack' | 'daze' = 'idle';
  private readonly horns: Phaser.GameObjects.Image;
  /**
   * Cuerpo pintado en tiras (S102, monaiBody.ts). En Canvas (sin WebGL no hay `Rope`) vuelve el dibujo de S26:
   * `legacy`, con el cuerpo delante, las vueltas de atrás del tronco y las de la altura de la copa (S28).
   */
  private readonly rig: SnakeRig | null;
  private readonly legacy: { body: Phaser.GameObjects.Graphics; back: Phaser.GameObjects.Graphics; high: HighBack; points: BodyPoint[] } | null;
  private readonly ctrlX = new Float32Array(CONTROLS);
  private readonly ctrlY = new Float32Array(CONTROLS);
  private readonly ctrlBack = new Uint8Array(CONTROLS);
  /** Cajas de depuración (y, en Canvas, las estrellitas de mareo). */
  private readonly fxGfx: Phaser.GameObjects.Graphics;
  private readonly shadow: Phaser.GameObjects.Ellipse;
  private readonly pulse: Phaser.GameObjects.Arc;
  // Piezas del dibujo (S102): todas se crean una vez.
  private readonly tongue: Phaser.GameObjects.Image;
  private readonly sheen: Phaser.GameObjects.Image;
  private readonly hornGlow: Phaser.GameObjects.Image;
  private readonly tipSparks: Phaser.GameObjects.Image[] = [];
  private readonly eyeGlint: Phaser.GameObjects.Image;
  private readonly stars: Phaser.GameObjects.Image[] = [];
  private readonly heart: Phaser.GameObjects.Image;
  private readonly heartGlow: Phaser.GameObjects.Image;
  private readonly shadowArt: Phaser.GameObjects.Image;
  private readonly ring: Phaser.GameObjects.Image;
  private readonly leaves: Leaf[] = [];
  private readonly streaks: Phaser.GameObjects.Image[] = [];
  private readonly tmp = new Phaser.Math.Vector2();
  private readonly rnd = visualRng(102);
  /** Reloj del dibujo (ms) y fase de la onda (vueltas). */
  private clockMs = 0;
  private wavePhase = 0;
  private waveAmp = 0;
  /** Tiempo desde el último golpe (ms; < 0 = ninguno). */
  private hitMs = -1;
  /** Tiempo dentro del aviso en curso y su largo (ms). */
  private warnMs = 0;
  private warnTotal = 0;
  private leavesDone = false;
  private ringLockMs = -1;
  private nextTongueMs = 0;
  private tongueMs = -1;
  private streakMs = 0;
  /** Peso de la sombra del cuerpo en la corteza (enroscada = 1). */
  private trunkShade = 0;
  /** Puntas de los cuernos (para los destellos) e índices del cambio de capa por tramo de la columna. */
  private readonly tips = hornTips();
  private readonly turnAt = new Int16Array(CONTROLS);
  private readonly barkRect = { x: 0, halfWidth: 0, topY: 0, bottomY: 0 };
  private readonly rigFrame = { alpha: 1, startSide: -1, trunk: null as null | { x: number; halfWidth: number; topY: number; bottomY: number }, trunkShadow: 0, floorY: 0, groundLean: 0.15 };
  private readonly segments: Segment[] = [];
  private readonly trunks: Trunk[];
  private readonly spots: TreeSpot[];
  private readonly thief = new HeartThief();
  private readonly headRect = new Phaser.Geom.Rectangle();
  /** Zonas que reciben el tajo (S65): la cabeza y la cola crecidas hacia arriba hasta la altura del tajo. */
  private readonly headStrike = new Phaser.Geom.Rectangle();
  private readonly tailStrike = new Phaser.Geom.Rectangle();
  private readonly timers: Phaser.Time.TimerEvent[] = [];
  private readonly pulseState = { r: 0 };
  private readonly canopyY: number;
  /** Suelo de la arena (no la copa del medio, ver `BossContext.groundY`). */
  private readonly floorY: number;
  private lastHeadX = 0;
  private lastHeadY = 0;
  private velX = 0;
  private velY = 0;
  private perch = 1;
  private harmful = false;
  /** Qué parte se puede golpear en la ventana. */
  private exposed: MonaiExposed = 'none';
  /** El cuerpo se apoya en el suelo (aturdido). */
  private grounded = false;
  private stealing = false;
  private pulseActive = false;
  private pulseHit = false;
  private shadowMs = 0;
  private shadowLockMs = 0;
  private glowMs = 0;
  /** Tiempo con la joroba levantada en el suelo (S44); lastima desde `guardArmMs`. */
  private guardMs = 0;
  /** Destello blanco del golpe en curso (no lo pisa el brillo de los cuernos). */
  private flashing = false;

  constructor(scene: Phaser.Scene, ctx: BossContext) {
    super(scene, getBossDef('monai'), ctx);
    ensureMonaiArt(scene);
    const arena = ctx.arena;
    this.floorY = ctx.groundY;
    this.canopyY = this.floorY - CFG.canopyTiles * TILE;
    const trunkXs = CFG.treeTiles.map((t) => arena.left + t * TILE);
    if (hasTreeArt(scene)) {
      // S67: el árbol del atlas (l3_arboles/shade_tree_green), cada uno a su escala. La barra "=" cruza la copa y se ve
      // como una rama; el tronco que tapa el pulso, las vueltas y la cabeza posada siguen al dibujo de cada uno.
      const branch = ensureBranchArt(scene);
      const branches: Phaser.GameObjects.Image[] = [];
      const neckReach = CFG.headWidth / 2 - 4;
      this.trunks = [];
      this.spots = trunkXs.map((x, i) => {
        const tree = addArtTree(scene, i, x, this.floorY);
        this.trunks.push({ x, halfWidth: tree.halfWidth, topY: this.canopyY });
        branches.push(scene.add.image(x, this.canopyY - 1, branch.key).setOrigin(0.5, 0).setScale(1 / ART_K));
        const perchY = tree.crownTopY - CFG.perchAboveCrown;
        const radius = tree.halfWidth + CFG.coilClearance;
        const coil = coilPlan(perchY + 2, tree.trunkTopY, tree.trunkBottomY, radius, neckReach, CFG.segments, CFG.segmentGap, CFG.neckSegments);
        return { perchY, coil, highBelowY: tree.trunkTopY - CFG.segmentRadius - 1, barkTopY: tree.trunkTopY - 4 };
      });
      // Delante de los árboles y de las plataformas, detrás de Moñái y de Kerana.
      ctx.placeBelowPlayer(branches);
    } else {
      // Árboles por código (S26, monaiArt.ts), detrás de Kerana. Las copas sólidas son los "=" del mapa.
      this.trunks = trunkXs.map((x) => ({ x, halfWidth: CFG.trunkHalfWidth, topY: this.canopyY }));
      const trunkHeight = this.floorY - this.canopyY + CFG.crownBelow / 2;
      this.trunks.forEach((trunk, i) => {
        const keys = ensureTreeArt(scene, i, trunkHeight, trunk.halfWidth);
        const crownOriginY = keys.crownAbove / (keys.crownAbove + keys.crownBelow);
        scene.add.image(trunk.x, this.floorY, keys.trunk).setOrigin(0.5, 1).setScale(1 / ART_K).setDepth(-4);
        scene.add.image(trunk.x, this.canopyY, keys.crown).setOrigin(0.5, crownOriginY).setScale(1 / ART_K).setDepth(-3);
      });
      const coil: CoilPlan = {
        neck: CFG.neckSegments,
        top: this.canopyY + CFG.coilPitch,
        pitch: CFG.coilPitch,
        step: coilStep(CFG.segmentGap, CFG.coilPitch, CFG.coilRadius),
        radius: CFG.coilRadius,
      };
      this.spots = this.trunks.map(() => ({ perchY: this.canopyY - CFG.perchRise, coil, highBelowY: this.canopyY + CFG.crownBelow, barkTopY: this.canopyY + CFG.crownBelow }));
    }
    // La sombra de la caída: la elipse de juego (su x es donde cae) ya no se pinta; encima va la tramada con su anillo.
    this.shadow = scene.add.ellipse(0, this.floorY - 1, CFG.shadowWidth, 8, SHADOW_COLOR, 0).setDepth(3).setVisible(false);
    this.shadowArt = scene.add.image(0, this.floorY - 1, SHADOW_OVAL_TEXTURE).setScale(1 / ART_K).setDepth(3).setVisible(false);
    this.ring = scene.add.image(0, this.floorY - 1, RING_TEXTURE).setDepth(3).setTint(PULSE_COLORS[2]).setVisible(false);
    // Cuerpo: tiras (Rope) en WebGL; en Canvas, el dibujo de S26.
    const webgl = scene.renderer.type === Phaser.WEBGL;
    this.rig = webgl ? new SnakeRig(scene, SKIN_KEYS, CONTROLS) : null;
    this.legacy = webgl
      ? null
      : { body: scene.add.graphics(), back: scene.add.graphics().setDepth(-5), high: { gfx: scene.add.graphics(), belowY: this.spots[1].highBelowY }, points: [] };
    const [ox, oy] = headOrigin();
    this.headSprite = hasSprite(scene, HEAD_SPRITE);
    if (this.headSprite) {
      this.headScale = 1 / spriteDetail(scene, HEAD_SPRITE);
      this.head = scene.add.sprite(0, 0, HEAD_SPRITE).setOrigin(...CFG.headSpriteOrigin).setScale(this.headScale);
      this.head.play(`${HEAD_SPRITE}_idle`);
    } else {
      this.headScale = 1 / ART_K;
      this.head = scene.add.sprite(0, 0, HEAD_TEXTURE).setOrigin(ox, oy).setScale(this.headScale);
    }
    this.horns = scene.add.image(0, 0, HORNS_TEXTURE).setOrigin(ox, oy).setScale(1 / ART_K);
    this.sheen = scene.add.image(0, 0, SHEEN_KEYS[0]).setOrigin(ox, oy).setScale(1 / ART_K).setTintMode(Phaser.TintModes.FILL);
    this.tongue = scene.add.image(0, 0, TONGUE_KEYS[0]).setOrigin(1, 0.5).setScale(1 / ART_K).setVisible(false);
    // Cuerpo y cabeza por delante de las copas y las plataformas, pero detrás de Kerana: nunca la tapan (S28).
    const body: (Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Depth)[] = this.rig ? this.rig.playerLayers() : [this.legacy!.high.gfx, this.legacy!.body];
    ctx.placeBelowPlayer([...body, this.tongue, this.head, this.horns, this.sheen]);
    this.hornGlow = scene.add.image(0, 0, GLOW_TEXTURE).setScale(1 / ART_K).setBlendMode(Phaser.BlendModes.ADD).setDepth(6).setVisible(false);
    for (let i = 0; i < 2; i++) this.tipSparks.push(scene.add.image(0, 0, SPARKLE_TEXTURE).setScale(1 / ART_K).setBlendMode(Phaser.BlendModes.ADD).setDepth(6).setVisible(false));
    this.eyeGlint = scene.add.image(0, 0, SPARKLE_TEXTURE).setScale(1 / ART_K).setTint(LOOK.stealWarn.eyeColor).setBlendMode(Phaser.BlendModes.ADD).setDepth(6).setVisible(false);
    for (let i = 0; i < 3; i++) this.stars.push(scene.add.image(0, 0, STAR_TEXTURE).setScale(1 / ART_K).setDepth(6).setVisible(false));
    this.heartGlow = scene.add.image(0, 0, GLOW_TEXTURE).setScale(0.6 / ART_K).setTint(HEART_COLOR).setBlendMode(Phaser.BlendModes.ADD).setDepth(6).setVisible(false);
    this.heart = scene.add.image(0, 0, HEART_TEXTURE).setScale(1 / ART_K).setDepth(6).setVisible(false);
    for (let i = 0; i < LOOK.descentWarn.leaves; i++) {
      this.leaves.push({ img: scene.add.image(0, 0, `${LEAF_PREFIX}${i % 2}`).setScale(1 / ART_K).setDepth(6).setVisible(false), vx: 0, vy: 0, life: 0, phase: 0 });
    }
    for (let i = 0; i < LOOK.stealWarn.streaks; i++) this.streaks.push(scene.add.image(0, 0, STREAK_TEXTURE).setScale(1 / ART_K).setDepth(6).setVisible(false));
    this.fxGfx = scene.add.graphics().setDepth(6);
    this.pulse = scene.add.circle(0, 0, 10).setStrokeStyle(3, PULSE_COLORS[0]).setDepth(6).setVisible(false);
    for (let i = 0; i < CFG.segments; i++) this.segments.push({ x: 0, y: 0, back: false });
    // Puntos del dibujo de Canvas: la nuca, cada segmento y uno entre cada par (tubo continuo).
    if (this.legacy) for (let i = 0; i < CFG.segments * 2; i++) this.legacy.points.push({ x: 0, y: 0, r: 0, back: false });
    this.resetVisuals();
  }

  // ── Presentación ──────────────────────────────────────────────────────────

  protected playIntro(onDone: () => void): void {
    // Cruza el cielo y se posa en la copa del medio; los cuernos brillan.
    const arena = this.ctx.arena;
    this.placeAll(arena.right + 40, arena.top + 40);
    this.head.setAlpha(1);
    this.flyTo(this.perchX(1), this.perchY(1), 900);
    this.perch = 1;
    this.timers.push(
      this.scene.time.delayedCall(900, () => {
        this.ctx.sfx('hornGlow');
        this.ctx.shake(300, 0.008);
        this.glowMs = 900;
      }),
      this.scene.time.delayedCall(1800, onDone),
    );
  }

  // ── Ataques ───────────────────────────────────────────────────────────────

  protected onTransition(t: BossTransition): void {
    const id = t.attack?.id ?? '';
    // S102: el dibujo sigue el aviso en curso (anillo, hojas, recogida del cuello).
    this.warnMs = 0;
    this.warnTotal = t.ms;
    if (t.state === 'telegraph') {
      this.leavesDone = false;
      this.ringLockMs = -1;
    }
    switch (t.state) {
      case 'telegraph':
        if (id === 'descent') this.telegraphDescent(t.ms);
        else if (id === 'pulse') this.telegraphPulse(t.ms);
        else this.telegraphSteal();
        break;
      case 'active':
        if (id === 'descent') this.descend(t.attack!.activeMs);
        else if (id === 'pulse') this.firePulse(t.attack!.activeMs);
        else this.steal(t.attack!.activeMs);
        break;
      case 'recover':
        this.land(id === 'steal' ? 'tail' : 'body');
        break;
      case 'idle':
        this.rest();
        break;
      default:
        break;
    }
  }

  /** Se esconde en una copa; la sombra aparece bajo Kerana y la sigue un rato. */
  private telegraphDescent(telegraphMs: number): void {
    this.perch = this.pickPerch();
    this.flyTo(this.perchX(this.perch), this.perchY(), Math.min(CFG.flyMs, telegraphMs / 2));
    this.shadowMs = 0;
    this.shadowLockMs = telegraphMs * CFG.shadowTrackFraction;
    this.shadow.setPosition(this.ctx.playerX(), this.floorY - 1).setVisible(true).setScale(0.4);
    this.scene.tweens.add({ targets: this.shadow, scale: 1, duration: telegraphMs });
  }

  /** Cae en picada sobre la sombra. */
  private descend(activeMs: number): void {
    this.harmful = true;
    this.ctx.sfx('dive');
    this.scene.tweens.killTweensOf(this.head);
    this.head.setFlipX(this.shadow.x > this.head.x);
    this.scene.tweens.add({ targets: this.head, x: this.shadow.x, y: this.groundHeadY(), duration: activeMs, ease: 'Quad.easeIn' });
  }

  /** Baja al suelo junto a un tronco y los cuernos brillan (1 s) con un sonido agudo. */
  private telegraphPulse(telegraphMs: number): void {
    const trunk = this.trunks[this.perch];
    const side = this.ctx.playerX() >= trunk.x ? 1 : -1;
    const x = trunk.x + side * CFG.pulseTrunkOffsetTiles * TILE;
    this.flyTo(x, this.groundHeadY(), Math.min(CFG.flyMs, telegraphMs / 2));
    this.grounded = true;
    this.glowMs = telegraphMs;
    this.ctx.sfx('hornGlow');
  }

  /** Anillo que crece desde los cuernos hasta 200 px; si toca a Kerana (sin tronco en medio), la hipnotiza. */
  private firePulse(activeMs: number): void {
    this.glowMs = 0;
    this.pulseActive = true;
    this.pulseHit = false;
    this.pulseState.r = 8;
    this.pulse.setPosition(this.head.x, this.head.y).setVisible(true).setAlpha(1);
    this.scene.tweens.killTweensOf(this.pulseState);
    this.scene.tweens.add({ targets: this.pulseState, r: CFG.pulseRadius, duration: activeMs, ease: 'Sine.easeOut' });
    this.ctx.sfx('hypnosis');
  }

  /** Se enrosca y tiembla sobre la copa (0,7 s). */
  private telegraphSteal(): void {
    this.scene.tweens.killTweensOf(this.head);
    this.head.setPosition(this.perchX(this.perch), this.perchY());
    this.scene.tweens.add({ targets: this.head, angle: { from: -10, to: 10 }, duration: 70, yoyo: true, repeat: 4, onComplete: () => this.head.setAngle(0) });
    this.scene.tweens.add({ targets: this.head, scale: 1.2 * this.headScale, duration: 350, yoyo: true });
  }

  /** Embestida en diagonal hacia donde está Kerana; si acierta, se lleva un corazón. */
  private steal(activeMs: number): void {
    const px = this.ctx.playerX();
    const dir = px >= this.head.x ? 1 : -1;
    const arena = this.ctx.arena;
    const toX = Phaser.Math.Clamp(px + dir * CFG.stealOvershoot, arena.left + TILE, arena.right - TILE);
    this.harmful = true;
    this.stealing = true;
    this.head.setAngle(0).setScale(this.headScale).setFlipX(dir > 0);
    this.scene.tweens.killTweensOf(this.head);
    this.scene.tweens.add({ targets: this.head, x: toX, y: this.groundHeadY(), duration: activeMs, ease: 'Sine.easeIn' });
    this.ctx.sfx('dive');
  }

  /** Queda en el suelo: aturdido (cuerpo) o con la cola expuesta (robo). */
  private land(part: 'body' | 'tail'): void {
    this.harmful = false;
    this.stealing = false;
    this.pulseActive = false;
    this.pulse.setVisible(false);
    this.shadow.setVisible(false);
    this.grounded = true;
    this.exposed = part;
    this.head.setAngle(0);
    if (part === 'body') this.ctx.shake(100, 0.005);
  }

  /** Entre ataques vuelve volando a una copa. */
  private rest(): void {
    this.harmful = false;
    this.stealing = false;
    this.exposed = 'none';
    this.grounded = false;
    this.glowMs = 0;
    this.head.setAngle(0).setScale(this.headScale);
    this.flyTo(this.perchX(this.perch), this.perchY(), CFG.flyMs);
  }

  // ── Daño ──────────────────────────────────────────────────────────────────

  protected applyHit(rect: Phaser.Geom.Rectangle, damage: number): number {
    const targets = strikeTargets(this.exposed, this.brain.vulnerable);
    // La cola devuelve el corazón robado; la cabeza (S66: también en la ventana del robo) solo resta vida.
    if (targets.tail && Phaser.Geom.Rectangle.Overlaps(this.tailStrikeBounds(), rect)) {
      if (this.thief.recover((n) => this.ctx.healPlayer(n))) this.ctx.sfx('heartBack');
    } else if (!(targets.head && Phaser.Geom.Rectangle.Overlaps(this.headStrikeBounds(), rect)) && !(targets.head && CFG.bodyIsTarget && this.touchesBody(rect))) {
      return 0;
    }
    this.flash();
    this.ctx.sfx('bossHit');
    return damage;
  }

  protected override onPhaseChanged(): void {
    this.ctx.sfx('hornGlow');
    this.ctx.shake(300, 0.008);
  }

  protected override onDefeated(): void {
    // El corazón robado vuelve a Kerana.
    this.thief.recover((n) => this.ctx.healPlayer(n));
    this.hideFx();
  }

  hurtsPlayer(playerRect: Phaser.Geom.Rectangle): boolean {
    if (this.pulseActive && !this.pulseHit) {
      const dx = playerRect.centerX - this.pulse.x;
      const dy = playerRect.centerY - this.pulse.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (Math.abs(d - this.pulseState.r) <= CFG.pulseBand && !pulseBlocked(this.pulse.x, playerRect.centerX, playerRect.bottom, this.trunks)) {
        this.pulseHit = true;
        this.ctx.confusePlayer();
      }
    }
    // La joroba del cuerpo en el suelo lastima al tocarla (S44): hay que ir por delante o saltarla.
    if (this.guardMs >= CFG.guardArmMs && this.touchesGuard(playerRect)) return true;
    if (!this.harmful || !Phaser.Geom.Rectangle.Overlaps(this.headBounds(), playerRect)) return false;
    if (!this.stealing) return true;
    // Robo: un solo intento por embestida. Si el golpe la dejó sin corazones, la pelea ya se reinició (cerebro en
    // 'waiting'): no se guarda nada en la cola para el intento siguiente (S65).
    this.stealing = false;
    if (this.thief.steal(() => this.ctx.damagePlayer(this.head.x) && this.brain.state !== 'waiting')) this.ctx.sfx('steal');
    return false;
  }

  markPosition(out: Phaser.Math.Vector2): Phaser.Math.Vector2 {
    return out.set(this.head.x, this.head.y);
  }

  fadeOut(ms: number): void {
    const body: Phaser.GameObjects.GameObject[] = this.rig ? [...this.rig.objects] : [this.legacy!.body, this.legacy!.back, this.legacy!.high.gfx];
    this.scene.tweens.add({ targets: [this.head, this.horns, this.sheen, this.tongue, this.fxGfx, this.heart, this.heartGlow, ...body], alpha: 0, duration: ms });
  }

  // ── Visual ────────────────────────────────────────────────────────────────

  protected updateVisuals(deltaMs: number): void {
    this.clockMs += deltaMs;
    this.warnMs += deltaMs;
    if (this.hitMs >= 0) this.hitMs += deltaMs;
    // Sombra: sigue a Kerana durante parte del aviso y después queda fija.
    if (this.shadow.visible && this.brain.state === 'telegraph') {
      this.shadowMs += deltaMs;
      if (this.shadowMs < this.shadowLockMs) this.shadow.x += (this.ctx.playerX() - this.shadow.x) * Math.min(1, deltaMs / 80);
    }
    // Pulso: el anillo crece y cambia de color (iridiscente).
    if (this.pulseActive) {
      const color = PULSE_COLORS[Math.floor(this.pulseState.r / 20) % PULSE_COLORS.length];
      this.pulse.setRadius(this.pulseState.r).setStrokeStyle(3, color, 1 - this.pulseState.r / (CFG.pulseRadius * 1.3));
    }
    const perched = this.isPerched();
    const guarding = this.isGuarding();
    this.guardMs = guarding ? this.guardMs + deltaMs : 0;
    this.updateHead(perched, deltaMs);
    this.updateSegments(deltaMs, perched, guarding);
    if (this.rig) this.drawRig(deltaMs, perched);
    else this.drawLegacyBody();
    this.drawFx(deltaMs);
    this.drawExtras(deltaMs);
  }

  /** Quieta en una copa (no vuela, no ataca, no está en el suelo): se enrosca en el tronco. */
  private isPerched(): boolean {
    if (this.grounded || this.harmful || this.head.alpha <= 0) return false;
    return Math.abs(this.head.x - this.perchX(this.perch)) < 4 && Math.abs(this.head.y - this.perchY()) < 4;
  }

  /** En el suelo con la cabeza apoyada (aturdida o para el pulso, no en la ventana de la cola): levanta la joroba. */
  private isGuarding(): boolean {
    if (!this.grounded || this.harmful || this.exposed === 'tail' || this.head.alpha <= 0) return false;
    return Math.abs(this.head.y - this.groundHeadY()) < 3;
  }

  /** Cara según lo que hace (fauces abiertas = hace daño; ojo cerrado = aturdida) y cuernos pegados a la cabeza. */
  private updateHead(perched: boolean, deltaMs: number): void {
    const head = this.head;
    const mood = this.harmful ? 'attack' : this.headDazed() ? 'daze' : 'idle';
    if (this.headSprite) {
      // Las fauces abren y quedan abiertas (la animación no se repite) mientras dure el daño.
      if (mood !== this.headMood) head.play(`${HEAD_SPRITE}_${mood}`);
    } else {
      const texture = mood === 'attack' ? HEAD_OPEN_TEXTURE : mood === 'daze' ? HEAD_DAZE_TEXTURE : HEAD_TEXTURE;
      if (head.texture.key !== texture) head.setTexture(texture);
    }
    this.headMood = mood;
    // En la copa mira hacia Kerana; al caer o embestir, se inclina hacia donde va.
    if (perched && this.brain.state !== 'telegraph') head.setFlipX(this.ctx.playerX() > head.x);
    if (this.harmful && CFG.diveTiltMaxDeg > 0) {
      const vx = head.x - this.lastHeadX;
      const vy = head.y - this.lastHeadY;
      if (Math.abs(vx) + Math.abs(vy) > 0.5) {
        const deg = Phaser.Math.Clamp(Phaser.Math.RadToDeg(Math.atan2(vy, Math.abs(vx))), -CFG.diveTiltMaxDeg, CFG.diveTiltMaxDeg);
        head.setAngle(head.flipX ? deg : -deg);
      }
    } else if (!this.stealWarning()) {
      // S102, solo el dibujo: mareada, la cabeza cuelga; en el aviso de la caída, el hocico apunta abajo (se asoma).
      const down = head.flipX ? 1 : -1;
      let target = 0;
      if (this.grounded && this.headDazed()) target = down * LOOK.daze.droopDeg;
      else if (this.brain.state === 'telegraph' && this.brain.attack?.id === 'descent') target = down * LOOK.descentWarn.peekDeg * this.descentRecoil();
      head.setAngle(head.angle + (target - head.angle) * Math.min(1, deltaMs / 120));
    }
    this.velX = head.x - this.lastHeadX;
    this.velY = head.y - this.lastHeadY;
    this.lastHeadX = head.x;
    this.lastHeadY = head.y;
    // La textura de los cuernos es de S26 (ART_K): crece con la cabeza (el tirón del golpe) desde su escala de reposo.
    // El espejo de Phaser es sobre el medio de la textura: con el origen espejado, los cuernos quedan sobre la nuca.
    const hornScale = head.scaleX / this.headScale / ART_K;
    const [ox, oy] = headOrigin();
    const hox = head.flipX ? 1 - ox : ox;
    this.horns.setOrigin(hox, oy).setPosition(head.x, head.y).setFlipX(head.flipX).setAngle(head.angle).setScale(hornScale).setAlpha(head.alpha);
    if (this.horns.isTinted && !this.flashing) this.horns.clearTint();
  }

  /** El aviso del robo está en curso (su temblor es un tween del ángulo: no se pisa). */
  private stealWarning(): boolean {
    return this.brain.state === 'telegraph' && this.brain.attack?.id === 'steal';
  }

  /** Recogida del aviso de la caída (0 → 1 en la última parte del aviso). */
  private descentRecoil(): number {
    if (this.brain.state !== 'telegraph' || this.brain.attack?.id !== 'descent' || this.warnTotal <= 0) return 0;
    return smoothstep((this.warnMs / this.warnTotal - 0.5) / 0.45);
  }

  /** Punto de la cabeza (unidades desde el centro de la zona de daño, mirando a la izquierda) en el mundo. */
  private headPoint(dx: number, dy: number, out: Phaser.Math.Vector2): Phaser.Math.Vector2 {
    const h = this.head;
    const sc = h.scaleX / this.headScale;
    const x = (h.flipX ? -dx : dx) * sc;
    const y = dy * sc;
    const c = Math.cos(h.rotation);
    const sn = Math.sin(h.rotation);
    return out.set(h.x + x * c - y * sn, h.y + x * sn + y * c);
  }

  /** La cabeza en el suelo se le puede pegar (aturdida; S66: también en la ventana del robo): ojo cerrado y estrellitas. */
  private headDazed(): boolean {
    return this.exposed === 'body' || (this.exposed === 'tail' && CFG.headInTailWindow);
  }

  /** Dónde sale el cuello: detrás de la cabeza. */
  private neckX(): number {
    return this.head.x + (this.head.flipX ? -1 : 1) * (CFG.headWidth / 2 - 4);
  }

  /**
   * El cuerpo sigue a la cabeza como una cuerda; aturdido, se apoya en el suelo. En una copa, cada segmento va hacia su
   * lugar del enroscado: el cuello baja a la copa y el resto da vueltas alrededor del tronco hasta el suelo.
   */
  private updateSegments(deltaMs: number, perched: boolean, guarding: boolean): void {
    let prevX = this.neckX();
    let prevY = this.head.y + 2;
    const floor = restingSegmentY(this.floorY);
    const settle = Math.min(1, deltaMs / 120);
    const coil = Math.min(1, deltaMs / CFG.coilSettleMs);
    const trunk = this.trunks[this.perch];
    const plan = this.spots[this.perch].coil;
    const neckX = prevX;
    const neckY = prevY;
    const coilTop = plan.top;
    // Joroba (S44): detrás de la nuca, del lado contrario a donde mira la cabeza.
    const back = this.head.flipX ? -1 : 1;
    const guardStep = Math.min(1, deltaMs / CFG.guardSettleMs);
    for (let i = 0; i < this.segments.length; i++) {
      const s = this.segments[i];
      if (this.grounded && !guarding) s.y += (floor - s.y) * settle;
      const dx = s.x - prevX;
      const dy = s.y - prevY;
      const d = Math.sqrt(dx * dx + dy * dy);
      // La joroba tiene su propia forma (sus segmentos van más separados que la cuerda): no tira.
      if (d > CFG.segmentGap && !guarding) {
        s.x = prevX + (dx / d) * CFG.segmentGap;
        s.y = prevY + (dy / d) * CFG.segmentGap;
      }
      s.back = false;
      if (guarding) {
        // Los primeros segmentos, en arco; el resto, chato en el suelo detrás de la joroba.
        const g = CFG.guardSegments;
        const f = Math.min(1, (i + 1) / g);
        const tx = neckX + back * (CFG.guardWidth * f + Math.max(0, i + 1 - g) * CFG.segmentGap);
        const ty = floor - (i < g ? CFG.guardHeight * Math.sin(Math.PI * f) : 0);
        s.x += (tx - s.x) * guardStep;
        s.y += (ty - s.y) * guardStep;
      } else if (perched) {
        // Lugar en el enroscado: el cuello, recto de la nuca a la copa; después, la hélice alrededor del tronco.
        let tx: number;
        let ty: number;
        let back = false;
        const n = plan.neck;
        const startAngle = trunk.x >= neckX ? -Math.PI / 2 : Math.PI / 2;
        if (i < n) {
          const f = (i + 1) / (n + 1);
          tx = neckX + (trunk.x + plan.radius * Math.sin(startAngle) - neckX) * f;
          ty = neckY + (coilTop - neckY) * f;
        } else {
          // S67: la primera vuelta cruza por delante del tronco (antes, del lado derecho se iba atrás y no se veía).
          const a = startAngle - Math.sign(startAngle) * (i - n) * plan.step;
          tx = trunk.x + plan.radius * Math.sin(a);
          ty = coilTop + (i - n) * plan.pitch;
          back = Math.cos(a) < 0;
        }
        s.x += (tx - s.x) * coil;
        s.y += (ty - s.y) * coil;
        s.back = back && Math.abs(tx - s.x) + Math.abs(ty - s.y) < 3;
      }
      prevX = s.x;
      prevY = s.y;
    }
  }

  /** Canvas (sin `Rope`): el tubo de S26, de la nuca a la cola; las vueltas de atrás del tronco, más oscuras. */
  private drawLegacyBody(): void {
    const lg = this.legacy!;
    lg.body.clear();
    lg.back.clear();
    lg.high.gfx.clear();
    if (this.head.alpha <= 0) return;
    lg.high.belowY = this.spots[this.perch].highBelowY;
    const segs = this.segments;
    const n = segs.length;
    const radius = (i: number) => CFG.segmentRadius * (1 - (i / n) * 0.6);
    const pts = lg.points;
    // Entre la nuca y el primer segmento, un punto más (el cuello no se corta).
    const p0 = pts[0];
    p0.x = (this.neckX() + segs[0].x) / 2;
    p0.y = (this.head.y + 2 + segs[0].y) / 2;
    p0.r = radius(0);
    p0.back = false;
    let k = 1;
    for (let i = 0; i < n; i++) {
      const s = segs[i];
      const p = pts[k++];
      p.x = s.x;
      p.y = s.y;
      p.r = radius(i);
      p.back = s.back;
      if (i === n - 1) break;
      const t = segs[i + 1];
      const m = pts[k++];
      m.x = (s.x + t.x) / 2;
      m.y = (s.y + t.y) / 2;
      m.r = (radius(i) + radius(i + 1)) / 2;
      m.back = s.back && t.back;
    }
    drawSnakeBody(lg.body, lg.back, pts, k, this.head.alpha, lg.high);
  }

  /**
   * S102: el cuerpo pintado. La columna pasa por la nuca (bajo la cabeza), cada segmento de la cuerda y la punta de la
   * cola; sobre ella van la onda, la respiración, la sacudida del golpe y la recogida de los avisos (solo el dibujo: los
   * segmentos, que son la joroba y la cola de la pelea, no se mueven).
   */
  private drawRig(deltaMs: number, perched: boolean): void {
    const rig = this.rig!;
    const head = this.head;
    const segs = this.segments;
    const n = segs.length;
    const nape = this.headMood === 'attack' ? LOOK.nape.attack : LOOK.nape.idle;
    this.headPoint(nape[0], nape[1], this.tmp);
    this.ctrlX[0] = this.tmp.x;
    this.ctrlY[0] = this.tmp.y;
    this.ctrlBack[0] = 0;
    for (let i = 0; i < n; i++) {
      this.ctrlX[i + 1] = segs[i].x;
      this.ctrlY[i + 1] = segs[i].y;
      this.ctrlBack[i + 1] = segs[i].back ? 1 : 0;
    }
    // La punta de la cola sigue de largo en la dirección del último tramo.
    const a = segs[n - 1];
    const b = segs[n - 2];
    let dx = a.x - b.x;
    let dy = a.y - b.y;
    let l = Math.hypot(dx, dy);
    if (l < 0.01) {
      dx = head.flipX ? -1 : 1;
      dy = 0;
      l = 1;
    }
    this.ctrlX[n + 1] = a.x + (dx / l) * LOOK.tailTip;
    this.ctrlY[n + 1] = a.y + (dy / l) * LOOK.tailTip;
    this.ctrlBack[n + 1] = this.ctrlBack[n];
    rig.spine.build(this.ctrlX, this.ctrlY, n + 2);
    this.fillOffsets(deltaMs, perched);
    rig.spine.offset(rig.off);
    this.fillLayers();
    this.fillGlow();
    this.trunkShade += ((perched ? 1 : 0) - this.trunkShade) * Math.min(1, deltaMs / 200);
    const trunk = this.trunks[this.perch];
    this.barkRect.x = trunk.x;
    this.barkRect.halfWidth = trunk.halfWidth;
    this.barkRect.topY = this.spots[this.perch].barkTopY;
    this.barkRect.bottomY = this.floorY;
    this.rigFrame.alpha = head.alpha;
    this.rigFrame.startSide = head.flipX ? 1 : -1;
    this.rigFrame.trunk = this.barkRect;
    this.rigFrame.trunkShadow = this.trunkShade;
    this.rigFrame.floorY = this.floorY;
    rig.write(this.rigFrame);
  }

  /** Onda de la cabeza a la cola, hinchazón del enroscado, respiración, golpe que baja y recogidas de los avisos. */
  private fillOffsets(deltaMs: number, perched: boolean): void {
    const rig = this.rig!;
    const sp = rig.spine;
    const W = LOOK.wave;
    const len = Math.max(1, sp.length);
    const dazed = this.grounded && this.headDazed();
    const target = dazed ? 0 : this.grounded ? W.ground : perched ? W.perched : W.fly;
    this.waveAmp += (target - this.waveAmp) * Math.min(1, deltaMs / W.settleMs);
    // Mareada, la onda se detiene; en cada fase corre más rápido (furia).
    const speed = W.phaseSpeed[Math.min(this.brain.phase, W.phaseSpeed.length - 1)];
    if (!dazed) this.wavePhase += (deltaMs / W.periodMs) * speed;
    const B = LOOK.breath;
    const breath = B.amount * Math.sin((TAU * this.clockMs) / (dazed ? B.dazedPeriodMs : B.periodMs));
    const coilFrom = perched ? this.spots[this.perch].coil.neck + 1 : 1e9;
    const swellAmp = W.perched > 0 ? (W.swell * this.waveAmp) / W.perched : 0;
    // Recogida del cuello en S (aviso de la caída al final; el del robo, entero) y cascabeleo de la cola en el robo.
    const stealWarn = this.stealWarning();
    const recoil = stealWarn ? 1 : this.descentRecoil();
    const rattle = stealWarn ? LOOK.stealWarn.tailRattle : 0;
    const H = LOOK.hit;
    const flashes = SaveManager.current.settings.flashes;
    const hitOn = this.hitMs >= 0 && this.hitMs < H.travelMs + 240;
    const hitFront = (this.hitMs / H.travelMs) * len;
    const hitFade = hitOn ? 1 - this.hitMs / (H.travelMs + 240) : 0;
    for (let i = 0; i < rig.n; i++) {
      const s = sp.s[i];
      const coil = Math.max(0, Math.min(1, sp.c[i] - coilFrom + 1));
      const ph = TAU * (s / W.length - this.wavePhase);
      const wave = Math.sin(ph);
      let off = this.waveAmp * smoothstep(s / W.rampIn) * (1 - coil) * wave;
      let half = 1 + coil * swellAmp * wave + breath * Math.exp(-(((s - 24) / 18) ** 2));
      if (recoil > 0) off += recoil * 3 * Math.sin((TAU * s) / 22) * smoothstep(s / 6) * (1 - smoothstep((s - 26) / 14));
      if (rattle > 0) off += rattle * Math.sin(this.clockMs / 16 + s * 0.6) * smoothstep((s - (len - 22)) / 18);
      let flash = 0;
      if (hitOn) {
        const env = Math.exp(-(((s - hitFront) / H.width) ** 2)) * hitFade;
        off += H.amplitude * env * Math.sin((TAU * s) / H.wobble + this.hitMs / 30);
        half += 0.06 * env;
        if (flashes) flash = H.flashAlpha * env;
      }
      rig.off[i] = off;
      rig.half[i] = half;
      rig.flashA[i] = flash;
    }
  }

  /**
   * Capa de cada punto (delante o detrás del tronco, o detrás pero delante de la copa). Entre un segmento de adelante
   * y uno de atrás, el cambio va donde la vuelta se aleja más del tronco: ahí el cuerpo da la vuelta por el costado.
   */
  private fillLayers(): void {
    const rig = this.rig!;
    const sp = rig.spine;
    const best = this.turnAt;
    best.fill(-1);
    const trunkX = this.trunks[this.perch].x;
    for (let i = 0; i < rig.n; i++) {
      const a = Math.min(CONTROLS - 2, Math.floor(sp.c[i]));
      if (this.ctrlBack[a] === this.ctrlBack[a + 1]) continue;
      if (best[a] < 0 || Math.abs(sp.x[i] - trunkX) > Math.abs(sp.x[best[a]] - trunkX)) best[a] = i;
    }
    const belowY = this.spots[this.perch].highBelowY;
    for (let i = 0; i < rig.n; i++) {
      const a = Math.min(CONTROLS - 2, Math.floor(sp.c[i]));
      let back = this.ctrlBack[a];
      if (this.ctrlBack[a] !== this.ctrlBack[a + 1]) back = i >= best[a] ? this.ctrlBack[a + 1] : this.ctrlBack[a];
      else if (sp.c[i] - a > 0.5) back = this.ctrlBack[a + 1];
      const r = bodyRadius(sp.s[i] / Math.max(1, sp.length)) * LOOK.body.length / LOOK.body.length;
      rig.layer[i] = !back ? LAYER_FRONT : sp.y[i] - r < belowY ? LAYER_HIGH : LAYER_BACK;
    }
  }

  /** Brillo del lomo: dorado en la furia (más en cada fase) y la ola iridiscente del pulso de hipnosis. */
  private fillGlow(): void {
    const rig = this.rig!;
    const sp = rig.spine;
    const len = Math.max(1, sp.length);
    const F = LOOK.furyGlow;
    const fury = F.alpha[Math.min(this.brain.phase, F.alpha.length - 1)];
    const Hy = LOOK.hypnoWave;
    const pulse = this.brain.attack?.id === 'pulse' && (this.brain.state === 'telegraph' || this.brain.state === 'active');
    const firing = pulse && this.brain.state === 'active';
    const speed = firing ? Hy.speedFire : Hy.speedWarn;
    const span = len + Hy.width * 2;
    const front = pulse ? ((this.warnMs * speed) / 1000) % span - Hy.width : -1e9;
    const hAlpha = firing ? Hy.alphaFire : Hy.alphaWarn;
    for (let i = 0; i < rig.n; i++) {
      const s = sp.s[i];
      const aFury = fury * (0.75 + 0.25 * Math.sin(TAU * (s / 30 - this.clockMs / F.shimmerMs)));
      let aH = 0;
      if (pulse) aH = hAlpha * Math.exp(-(((s - front) / Hy.width) ** 2));
      if (aH > aFury) {
        rig.glowA[i] = aH;
        rig.glowC[i] = iridescent(s / len - this.clockMs / Hy.cycleMs);
      } else {
        rig.glowA[i] = aFury;
        rig.glowC[i] = F.color;
      }
    }
  }

  /** Cajas de depuración; el contador del brillo de los cuernos. */
  private drawFx(deltaMs: number): void {
    const g = this.fxGfx;
    g.clear();
    if (this.glowMs > 0) this.glowMs -= deltaMs;
    if (DEBUG.debug && this.head.alpha > 0) this.drawDebugZones(g);
  }

  /** Lengua, reflejo y brillo de los cuernos, ojo del robo, estrellitas, corazón robado, aviso de la caída y hojas. */
  private drawExtras(deltaMs: number): void {
    const head = this.head;
    const alpha = head.alpha;
    const shown = alpha > 0;
    const flashes = SaveManager.current.settings.flashes;
    const [ox, oy] = headOrigin();
    const hox = head.flipX ? 1 - ox : ox;
    // Reflejo iridiscente que corre por los cuernos; brillando, más fuerte y más rápido.
    const Hn = LOOK.horns;
    const glowing = this.glowMs > 0;
    const cycle = glowing && flashes ? Hn.glowCycleMs : Hn.cycleMs;
    const runMs = Hn.sheenFrames * Hn.sheenMs * (glowing ? 1 : 4);
    const fi = Math.floor((this.clockMs % runMs) / Hn.sheenMs);
    this.sheen
      .setTexture(SHEEN_KEYS[fi < Hn.sheenFrames ? fi : 0])
      .setOrigin(hox, oy)
      .setPosition(head.x, head.y)
      .setFlipX(head.flipX)
      .setAngle(head.angle)
      .setScale(this.horns.scaleX)
      .setTint(iridescent(this.clockMs / cycle))
      .setAlpha(alpha * (glowing ? Hn.glowSheenAlpha : Hn.sheenAlpha))
      .setVisible(shown && !this.flashing);
    // Brillo de los cuernos (aviso del pulso y presentación): resplandor tramado que late y destellos en las puntas.
    const side = head.flipX ? -1 : 1;
    if (glowing && shown) {
      const beat = flashes ? 0.8 + 0.2 * Math.sin(this.clockMs / 55) : 1;
      this.hornGlow
        .setPosition(head.x + side * HORN_GLOW.dx, head.y + HORN_GLOW.dy)
        .setTint(iridescent(this.clockMs / cycle + 0.33))
        .setAlpha(Hn.glowAlpha * beat * alpha)
        .setScale((beat * HORN_GLOW.r) / Hn.glowRadius / ART_K)
        .setVisible(true);
      this.tips.forEach(([tx, ty], i) => {
        this.headPoint(tx, ty, this.tmp);
        const tw = flashes ? 0.55 + 0.45 * Math.abs(Math.sin(this.clockMs / 90 + i * 1.7)) : 0.7;
        this.tipSparks[i].setPosition(this.tmp.x, this.tmp.y).setTint(iridescent(this.clockMs / cycle + i * 0.5)).setScale(tw / ART_K).setAlpha(alpha).setVisible(true);
      });
    } else {
      this.hornGlow.setVisible(false);
      for (const sp of this.tipSparks) sp.setVisible(false);
    }
    // Lengua bífida: sale cada tanto en reposo; mareada, cuelga.
    const T = LOOK.tongue;
    const dazed = this.headMood === 'daze';
    const idle = this.headMood === 'idle' && !this.harmful && !this.stealWarning();
    if (this.tongueMs < 0 && idle && this.clockMs >= this.nextTongueMs) this.tongueMs = 0;
    if (this.tongueMs >= 0) {
      this.tongueMs += deltaMs;
      if (this.tongueMs >= T.flickMs || !idle) {
        this.tongueMs = -1;
        this.nextTongueMs = this.clockMs + T.minMs + this.rnd() * (T.maxMs - T.minMs);
      }
    }
    const flick = this.tongueMs >= 0;
    if (shown && (dazed || flick)) {
      const frame = dazed ? 2 : TONGUE_SEQ[Math.min(TONGUE_SEQ.length - 1, Math.floor((this.tongueMs / T.flickMs) * TONGUE_SEQ.length))];
      this.headPoint(T.at[0], T.at[1], this.tmp);
      this.tongue
        .setTexture(TONGUE_KEYS[frame])
        .setOrigin(head.flipX ? 0 : 1, 0.5)
        .setPosition(this.tmp.x, this.tmp.y)
        .setFlipX(head.flipX)
        .setAngle(head.angle + (dazed ? (head.flipX ? 1 : -1) * 38 : 0))
        .setScale(head.scaleX / this.headScale / ART_K)
        .setAlpha(alpha)
        .setVisible(true);
    } else {
      this.tongue.setVisible(false);
    }
    // Ojo del robo: un brillo rojo que titila mientras se prepara.
    if (shown && this.stealWarning()) {
      this.headPoint(LOOK.stealWarn.eyeAt[0], LOOK.stealWarn.eyeAt[1], this.tmp);
      const tw = flashes ? 0.6 + 0.5 * Math.abs(Math.sin(this.clockMs / 45)) : 0.9;
      this.eyeGlint.setPosition(this.tmp.x, this.tmp.y).setScale(tw / ART_K).setAlpha(alpha).setVisible(true);
    } else {
      this.eyeGlint.setVisible(false);
    }
    // Estrellitas de mareo (ventana para golpear).
    const starsOn = shown && this.headDazed() && this.brain.vulnerable;
    this.stars.forEach((star, i) => {
      if (!starsOn) {
        star.setVisible(false);
        return;
      }
      const ang = this.clockMs / 260 + (i * TAU) / this.stars.length;
      star.setPosition(head.x + Math.cos(ang) * 11, head.y - STARS_RISE + Math.sin(ang) * 3.5).setAlpha(alpha).setVisible(true);
    });
    // Corazón robado: late en la punta de la cola mientras lo tiene.
    if (shown && this.thief.holding) {
      const sp = this.rig?.spine;
      const tail = this.segments[this.segments.length - 1];
      const tx = sp && sp.ok ? sp.x[sp.n - 1] : tail.x;
      const ty = sp && sp.ok ? sp.y[sp.n - 1] : tail.y;
      const ph = (this.clockMs % LOOK.heart.beatMs) / LOOK.heart.beatMs;
      const beat = Math.max(0, Math.sin(ph * TAU)) ** 3 + 0.5 * Math.max(0, Math.sin(ph * TAU - 1.2)) ** 3;
      this.heart.setPosition(tx, ty - LOOK.heart.rise).setScale((1 + 0.18 * beat) / ART_K).setAlpha(alpha).setVisible(true);
      this.heartGlow
        .setPosition(tx, ty - LOOK.heart.rise)
        .setAlpha(LOOK.heart.glowAlpha * (flashes ? 0.6 + 0.4 * beat : 0.8) * alpha)
        .setVisible(true);
    } else {
      this.heart.setVisible(false);
      this.heartGlow.setVisible(false);
    }
    this.drawDescentWarn(deltaMs);
    this.drawStreaks(shown);
  }

  /** La sombra tramada sigue a la de juego; el anillo se cierra sobre ella y destella al quedar fija. Hojas que caen. */
  private drawDescentWarn(deltaMs: number): void {
    const D = LOOK.descentWarn;
    const sh = this.shadow;
    this.shadowArt.setPosition(sh.x, sh.y).setScale((sh.scaleX * CFG.shadowWidth) / SHADOW_OVAL.w / ART_K, sh.scaleY / ART_K).setVisible(sh.visible);
    const descent = this.brain.attack?.id === 'descent' && (this.brain.state === 'telegraph' || this.brain.state === 'active');
    if (sh.visible && descent) {
      const telegraph = this.brain.state === 'telegraph';
      const track = telegraph && this.shadowLockMs > 0 ? Math.min(1, this.shadowMs / this.shadowLockMs) : 1;
      if (track >= 1 && this.ringLockMs < 0) this.ringLockMs = 0;
      if (this.ringLockMs >= 0) this.ringLockMs += deltaMs;
      const flashes = SaveManager.current.settings.flashes;
      // Al quedar fija: dos destellos (o, sin destellos, el anillo más firme).
      const blink = this.ringLockMs >= 0 && this.ringLockMs < 240 ? (flashes ? (Math.floor(this.ringLockMs / 60) % 2 === 0 ? 1 : 0.35) : 1) : 0.85;
      const k = D.ringFrom + (D.ringTo - D.ringFrom) * smoothstep(track);
      this.ring
        .setPosition(sh.x, sh.y)
        .setScale((k * RING_SIZE.w) / RING_SIZE.w / ART_K, k / ART_K)
        .setAlpha(D.ringAlpha * blink)
        .setVisible(true);
      if (telegraph && !this.leavesDone && this.warnTotal > 0 && this.warnMs >= this.warnTotal * D.leavesAt) {
        this.leavesDone = true;
        this.dropLeaves();
      }
    } else {
      this.ring.setVisible(false);
    }
    for (const leaf of this.leaves) {
      if (leaf.life <= 0) continue;
      leaf.life -= deltaMs;
      const img = leaf.img;
      const dt = deltaMs / 1000;
      if (img.y < this.floorY - 1) {
        img.x += leaf.vx * dt + Math.sin(this.clockMs / 170 + leaf.phase) * 0.35;
        img.y += leaf.vy * dt;
        img.setAngle(Math.sin(this.clockMs / 210 + leaf.phase) * 50);
      }
      img.setAlpha(Math.min(1, leaf.life / 300)).setVisible(leaf.life > 0);
    }
  }

  /** Hojas sueltas de la copa donde está posada (empieza a moverse para caer). */
  private dropLeaves(): void {
    const x = this.perchX(this.perch);
    const y = this.perchY() + 6;
    for (const leaf of this.leaves) {
      leaf.img.setPosition(x + (this.rnd() - 0.5) * 34, y + this.rnd() * 10).setVisible(true).setAlpha(1);
      leaf.vx = (this.rnd() - 0.5) * 18;
      leaf.vy = 26 + this.rnd() * 22;
      leaf.life = 1300 + this.rnd() * 500;
      leaf.phase = this.rnd() * TAU;
    }
  }

  /** Rayas de velocidad detrás de la cabeza en la embestida del robo y en la caída. */
  private drawStreaks(shown: boolean): void {
    const speed = Math.hypot(this.velX, this.velY);
    const on = shown && this.harmful && speed > 1.2;
    this.streakMs = on ? this.streakMs + 1 : 0;
    if (!on) {
      for (const st of this.streaks) st.setVisible(false);
      return;
    }
    const ux = this.velX / speed;
    const uy = this.velY / speed;
    const ang = Math.atan2(uy, ux);
    this.streaks.forEach((st, i) => {
      const back = 12 + i * 5 + ((this.streakMs * 3 + i * 7) % 9);
      const across = (i - (this.streaks.length - 1) / 2) * 5;
      st.setPosition(this.head.x - ux * back - uy * across, this.head.y - uy * back + ux * across)
        .setRotation(ang + Math.PI)
        .setAlpha(0.55 * this.head.alpha * (1 - i * 0.15))
        .setVisible(true);
    });
  }

  /**
   * Con `?debug=1` (S65): la zona que lastima a Kerana (la cabeza mientras hace daño, rojo) y las que reciben el tajo
   * (cabeza y cola; amarillo cuando es la parte expuesta en la ventana, gris si no).
   */
  private drawDebugZones(g: Phaser.GameObjects.Graphics): void {
    const targets = strikeTargets(this.exposed, this.brain.vulnerable);
    const head = this.headStrikeBounds();
    const tail = this.tailStrikeBounds();
    g.lineStyle(1, targets.head ? 0xffe27a : 0x9a9a9a, 1).strokeRect(head.x, head.y, head.width, head.height);
    g.lineStyle(1, targets.tail ? 0xffe27a : 0x9a9a9a, 1).strokeRect(tail.x, tail.y, tail.width, tail.height);
    if (this.harmful) {
      const hurt = this.headBounds();
      g.lineStyle(1, 0xe04848, 1).strokeRect(hurt.x, hurt.y, hurt.width, hurt.height);
    }
  }

  protected resetVisuals(): void {
    for (const timer of this.timers) timer.remove();
    this.timers.length = 0;
    this.scene.tweens.killTweensOf([this.head, this.shadow, this.pulseState]);
    this.thief.reset();
    this.harmful = false;
    this.stealing = false;
    this.exposed = 'none';
    this.grounded = false;
    this.guardMs = 0;
    this.glowMs = 0;
    this.perch = 1;
    this.placeAll(this.perchX(1), this.perchY());
    this.head.setAlpha(0).setAngle(0).setScale(this.headScale).clearTint().setTintMode(Phaser.TintModes.MULTIPLY);
    this.horns.clearTint();
    this.flashing = false;
    this.hitMs = -1;
    this.waveAmp = 0;
    this.tongueMs = -1;
    this.trunkShade = 0;
    for (const leaf of this.leaves) {
      leaf.life = 0;
      leaf.img.setVisible(false);
    }
    this.hideFx();
  }

  private hideFx(): void {
    this.pulseActive = false;
    this.pulse.setVisible(false);
    this.shadow.setVisible(false);
    for (const img of [this.heart, this.heartGlow, this.ring, this.shadowArt, this.hornGlow, this.eyeGlint, ...this.tipSparks, ...this.stars, ...this.streaks]) img.setVisible(false);
  }

  private placeAll(x: number, y: number): void {
    this.head.setPosition(x, y);
    this.lastHeadX = x;
    this.lastHeadY = y;
    for (const s of this.segments) {
      s.x = x;
      s.y = y;
      s.back = false;
    }
  }

  private perchX(i: number): number {
    return this.trunks[i].x;
  }

  /** La cabeza asoma sobre la copa (S67: con el árbol del atlas, sobre el borde de arriba de su copa). */
  private perchY(i = this.perch): number {
    return this.spots[i].perchY;
  }

  private groundHeadY(): number {
    return groundHeadY(this.floorY);
  }

  /** Copa más cercana a Kerana (a veces la segunda, para variar). */
  private pickPerch(): number {
    const px = this.ctx.playerX();
    const order = this.trunks.map((_, i) => i).sort((a, b) => Math.abs(this.trunks[a].x - px) - Math.abs(this.trunks[b].x - px));
    return Math.random() < 0.3 ? order[1] : order[0];
  }

  private flyTo(x: number, y: number, ms: number): void {
    this.scene.tweens.killTweensOf(this.head);
    this.head.setFlipX(x > this.head.x);
    this.scene.tweens.add({ targets: this.head, x, y, duration: ms, ease: 'Sine.easeInOut' });
  }

  private headBounds(): Phaser.Geom.Rectangle {
    const w = CFG.headWidth;
    const h = CFG.headHeight;
    return this.headRect.setTo(this.head.x - w / 2, this.head.y - h / 2, w, h);
  }

  private headStrikeBounds(): Phaser.Geom.Rectangle {
    strikeZone('head', this.head.x, this.head.y, this.headStrike);
    return this.headStrike;
  }

  private tailStrikeBounds(): Phaser.Geom.Rectangle {
    const tail = this.segments[this.segments.length - 1];
    strikeZone('tail', tail.x, tail.y, this.tailStrike);
    return this.tailStrike;
  }

  /** Kerana toca la joroba (S44): círculo de cada segmento de la joroba contra su caja. */
  private touchesGuard(rect: Phaser.Geom.Rectangle): boolean {
    const n = this.segments.length;
    for (let i = 0; i < CFG.guardSegments; i++) {
      const s = this.segments[i];
      const r = CFG.segmentRadius * (1 - (i / n) * 0.6);
      const cx = Phaser.Math.Clamp(s.x, rect.left, rect.right);
      const cy = Phaser.Math.Clamp(s.y, rect.top, rect.bottom);
      if ((s.x - cx) ** 2 + (s.y - cy) ** 2 <= r * r) return true;
    }
    return false;
  }

  /** El tajo toca alguno de los primeros segmentos del cuerpo (aturdido; desde S44 solo si `bodyIsTarget`). */
  private touchesBody(rect: Phaser.Geom.Rectangle): boolean {
    for (let i = 0; i < this.segments.length / 2; i++) {
      const s = this.segments[i];
      if (rect.contains(s.x, s.y)) return true;
    }
    return false;
  }

  /** Golpe: la sacudida baja por el cuerpo (S102); el destello blanco, solo con «Destellos: sí». */
  private flash(): void {
    this.hitMs = 0;
    if (!SaveManager.current.settings.flashes) return;
    this.flashing = true;
    for (const img of [this.head, this.horns]) img.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
    this.scene.time.delayedCall(GAMEPLAY.boss.hitFlashMs, () => {
      this.flashing = false;
      for (const img of [this.head, this.horns]) img.clearTint().setTintMode(Phaser.TintModes.MULTIPLY);
    });
  }
}
