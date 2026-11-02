import Phaser from 'phaser';
import { GAMEPLAY } from '../../config/gameplay';
import { getBossDef } from '../../data/bosses';
import { Boss, type BossContext } from './Boss';
import type { BossTransition } from './BossBrain';
import {
  ART_K,
  type BodyPoint,
  drawDazeStars,
  drawSnakeBody,
  type HighBack,
  ensureMonaiArt,
  addArtTree,
  ensureBranchArt,
  ensureTreeArt,
  hasTreeArt,
  HEAD_DAZE_TEXTURE,
  HEAD_OPEN_TEXTURE,
  HEAD_SPRITE,
  HEAD_TEXTURE,
  headOrigin,
  HORNS_TEXTURE,
} from './monaiArt';
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

/** Lo que depende del dibujo de cada árbol (S67): dónde se posa la cabeza y cómo se enrosca el cuerpo. */
interface TreeSpot {
  perchY: number;
  coil: CoilPlan;
  /** Las vueltas de atrás cuyo borde de arriba queda sobre esta van delante de la copa (`HighBack`). */
  highBelowY: number;
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
  private readonly bodyGfx: Phaser.GameObjects.Graphics;
  /** Vueltas del enroscado detrás del tronco. */
  private readonly backGfx: Phaser.GameObjects.Graphics;
  /** Vueltas de atrás a la altura de la copa: delante de la copa y de la plataforma, detrás de Kerana (S28). */
  private readonly highBack: HighBack;
  /** Halo de los cuernos y estrellitas de mareo. */
  private readonly fxGfx: Phaser.GameObjects.Graphics;
  private readonly points: BodyPoint[] = [];
  private readonly shadow: Phaser.GameObjects.Ellipse;
  private readonly pulse: Phaser.GameObjects.Arc;
  private readonly tailHeart: Phaser.GameObjects.Arc;
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
        return { perchY, coil, highBelowY: tree.trunkTopY - CFG.segmentRadius - 1 };
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
      this.spots = this.trunks.map(() => ({ perchY: this.canopyY - CFG.perchRise, coil, highBelowY: this.canopyY + CFG.crownBelow }));
    }
    this.shadow = scene.add.ellipse(0, this.floorY - 1, CFG.shadowWidth, 8, SHADOW_COLOR, 0.6).setDepth(3).setVisible(false);
    this.backGfx = scene.add.graphics().setDepth(-5);
    this.highBack = { gfx: scene.add.graphics(), belowY: this.spots[1].highBelowY };
    this.bodyGfx = scene.add.graphics();
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
    // Cuerpo y cabeza por delante de las copas y las plataformas, pero detrás de Kerana: nunca la tapan (S28).
    ctx.placeBelowPlayer([this.highBack.gfx, this.bodyGfx, this.head, this.horns]);
    this.fxGfx = scene.add.graphics().setDepth(6);
    this.pulse = scene.add.circle(0, 0, 10).setStrokeStyle(3, PULSE_COLORS[0]).setDepth(6).setVisible(false);
    this.tailHeart = scene.add.circle(0, 0, 4, HEART_COLOR).setDepth(6).setVisible(false);
    for (let i = 0; i < CFG.segments; i++) this.segments.push({ x: 0, y: 0, back: false });
    // Puntos del dibujo: la nuca, cada segmento y uno entre cada par (tubo continuo).
    for (let i = 0; i < CFG.segments * 2; i++) this.points.push({ x: 0, y: 0, r: 0, back: false });
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
    this.scene.tweens.add({ targets: [this.head, this.horns, this.bodyGfx, this.backGfx, this.highBack.gfx, this.fxGfx, this.tailHeart], alpha: 0, duration: ms });
  }

  // ── Visual ────────────────────────────────────────────────────────────────

  protected updateVisuals(deltaMs: number): void {
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
    this.updateHead(perched);
    this.updateSegments(deltaMs, perched, guarding);
    this.drawBody();
    this.drawFx(deltaMs);
    const tail = this.segments[this.segments.length - 1];
    this.tailHeart.setPosition(tail.x, tail.y - 6).setVisible(this.thief.holding && this.head.alpha > 0);
    if (this.thief.holding) this.tailHeart.setScale(1 + Math.sin(this.scene.time.now / 120) * 0.25);
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
  private updateHead(perched: boolean): void {
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
    }
    this.lastHeadX = head.x;
    this.lastHeadY = head.y;
    // La textura de los cuernos es de S26 (ART_K): crece con la cabeza (el tirón del golpe) desde su escala de reposo.
    const hornScale = head.scaleX / this.headScale / ART_K;
    this.horns.setPosition(head.x, head.y).setFlipX(head.flipX).setAngle(head.angle).setScale(hornScale).setAlpha(head.alpha);
    // Cuernos que brillan: parpadeo iridiscente.
    if (this.glowMs > 0) {
      const color = PULSE_COLORS[Math.floor(this.glowMs / 90) % PULSE_COLORS.length];
      this.horns.setTint(color).setTintMode(Phaser.TintModes.MULTIPLY);
    } else if (this.horns.isTinted && !this.flashing) {
      this.horns.clearTint();
    }
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

  /** Tubo continuo de la nuca a la cola (se afina hacia la cola); las vueltas de atrás del tronco, más oscuras. */
  private drawBody(): void {
    this.bodyGfx.clear();
    this.backGfx.clear();
    this.highBack.gfx.clear();
    if (this.head.alpha <= 0) return;
    this.highBack.belowY = this.spots[this.perch].highBelowY;
    const segs = this.segments;
    const n = segs.length;
    const radius = (i: number) => CFG.segmentRadius * (1 - (i / n) * 0.6);
    const pts = this.points;
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
    drawSnakeBody(this.bodyGfx, this.backGfx, pts, k, this.head.alpha, this.highBack);
  }

  /** Halo de los cuernos mientras brillan y estrellitas de mareo en la ventana del cuerpo. */
  private drawFx(deltaMs: number): void {
    const g = this.fxGfx;
    g.clear();
    if (this.glowMs > 0) {
      this.glowMs -= deltaMs;
      const color = PULSE_COLORS[Math.floor(this.glowMs / 90) % PULSE_COLORS.length];
      const side = this.head.flipX ? -1 : 1;
      g.fillStyle(color, HORN_GLOW.alpha * this.head.alpha).fillCircle(this.head.x + side * HORN_GLOW.dx, this.head.y + HORN_GLOW.dy, HORN_GLOW.r);
    }
    if (this.headDazed() && this.brain.vulnerable) drawDazeStars(g, this.head.x, this.head.y - STARS_RISE, this.scene.time.now, this.head.alpha);
    if (DEBUG.debug && this.head.alpha > 0) this.drawDebugZones(g);
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
    this.hideFx();
  }

  private hideFx(): void {
    this.pulseActive = false;
    this.pulse.setVisible(false);
    this.shadow.setVisible(false);
    this.tailHeart.setVisible(false);
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

  private flash(): void {
    this.flashing = true;
    for (const img of [this.head, this.horns]) img.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
    this.scene.time.delayedCall(GAMEPLAY.boss.hitFlashMs, () => {
      this.flashing = false;
      for (const img of [this.head, this.horns]) img.clearTint().setTintMode(Phaser.TintModes.MULTIPLY);
    });
  }
}
