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
  ensureMonaiArt,
  ensureTreeArt,
  HEAD_DAZE_TEXTURE,
  HEAD_OPEN_TEXTURE,
  HEAD_TEXTURE,
  headOrigin,
  HORNS_TEXTURE,
} from './monaiArt';
import { HeartThief, pulseBlocked, type Trunk } from './monaiLogic';

const CFG = GAMEPLAY.monai;
const TILE = 16;
const SHADOW_COLOR = 0x1b1a2e;
const PULSE_COLORS = [0xe06bd0, 0x6bd0e0, 0xe0d06b] as const;
const HEART_COLOR = 0xe04848;
/** Los cuernos brillan: halo de color alrededor de las puntas (desplazamiento desde la cabeza mirando a la izquierda). */
const HORN_GLOW = { dx: 13, dy: -13, r: 13, alpha: 0.35 };
/** Las estrellitas de mareo, sobre la cabeza (px). */
const STARS_RISE = 16;

interface Segment {
  x: number;
  y: number;
  /** Vuelta del enroscado que queda detrás del tronco. */
  back: boolean;
}

// Moñái (GDD §6.3): serpiente con cuernos que se esconde en las copas de la isla de monte.
// Fase 1: descenso con sombra. Fase 2: + pulso de hipnosis (los troncos lo tapan).
// Fase 3: + robo de un corazón que se recupera golpeando la cola; descensos más rápidos.
// Arte por código (S26, monaiArt.ts): cabeza con cuernos, cuerpo de serpiente enroscado en el tronco y árboles.
export class Monai extends Boss {
  private readonly head: Phaser.GameObjects.Image;
  private readonly horns: Phaser.GameObjects.Image;
  private readonly bodyGfx: Phaser.GameObjects.Graphics;
  /** Vueltas del enroscado detrás del tronco. */
  private readonly backGfx: Phaser.GameObjects.Graphics;
  /** Halo de los cuernos y estrellitas de mareo. */
  private readonly fxGfx: Phaser.GameObjects.Graphics;
  private readonly points: BodyPoint[] = [];
  private readonly shadow: Phaser.GameObjects.Ellipse;
  private readonly pulse: Phaser.GameObjects.Arc;
  private readonly tailHeart: Phaser.GameObjects.Arc;
  private readonly segments: Segment[] = [];
  private readonly trunks: Trunk[];
  private readonly thief = new HeartThief();
  private readonly headRect = new Phaser.Geom.Rectangle();
  private readonly tailRect = new Phaser.Geom.Rectangle();
  private readonly timers: Phaser.Time.TimerEvent[] = [];
  private readonly pulseState = { r: 0 };
  private readonly canopyY: number;
  /** Suelo de la arena (no la copa del medio, ver `BossContext.groundY`). */
  private readonly floorY: number;
  /** Ángulo entre vueltas del enroscado: la cuerda entre segmentos mide `segmentGap`. */
  private readonly coilStep: number;
  private lastHeadX = 0;
  private lastHeadY = 0;
  private perch = 1;
  private harmful = false;
  /** Qué parte se puede golpear en la ventana. */
  private exposed: 'none' | 'body' | 'tail' = 'none';
  /** El cuerpo se apoya en el suelo (aturdido). */
  private grounded = false;
  private stealing = false;
  private pulseActive = false;
  private pulseHit = false;
  private shadowMs = 0;
  private shadowLockMs = 0;
  private glowMs = 0;
  /** Destello blanco del golpe en curso (no lo pisa el brillo de los cuernos). */
  private flashing = false;

  constructor(scene: Phaser.Scene, ctx: BossContext) {
    super(scene, getBossDef('monai'), ctx);
    ensureMonaiArt(scene);
    const arena = ctx.arena;
    this.floorY = ctx.groundY;
    this.canopyY = this.floorY - CFG.canopyTiles * TILE;
    this.trunks = CFG.treeTiles.map((t) => ({ x: arena.left + t * TILE, halfWidth: CFG.trunkHalfWidth, topY: this.canopyY }));
    const chord = Math.sqrt(Math.max(0, CFG.segmentGap ** 2 - CFG.coilPitch ** 2));
    this.coilStep = 2 * Math.asin(Math.min(1, chord / (2 * CFG.coilRadius)));

    // Árboles por código (monaiArt.ts), detrás de Kerana. Las copas sólidas son los "=" del mapa, a canopyTiles del suelo.
    const trunkHeight = this.floorY - this.canopyY + CFG.crownBelow / 2;
    this.trunks.forEach((trunk, i) => {
      const keys = ensureTreeArt(scene, i, trunkHeight, trunk.halfWidth);
      const crownOriginY = keys.crownAbove / (keys.crownAbove + keys.crownBelow);
      scene.add.image(trunk.x, this.floorY, keys.trunk).setOrigin(0.5, 1).setScale(1 / ART_K).setDepth(-4);
      scene.add.image(trunk.x, this.canopyY, keys.crown).setOrigin(0.5, crownOriginY).setScale(1 / ART_K).setDepth(-3);
    });
    this.shadow = scene.add.ellipse(0, this.floorY - 1, CFG.shadowWidth, 8, SHADOW_COLOR, 0.6).setDepth(3).setVisible(false);
    this.backGfx = scene.add.graphics().setDepth(-5);
    this.bodyGfx = scene.add.graphics().setDepth(4);
    const [ox, oy] = headOrigin();
    this.head = scene.add.image(0, 0, HEAD_TEXTURE).setOrigin(ox, oy).setScale(1 / ART_K).setDepth(5);
    this.horns = scene.add.image(0, 0, HORNS_TEXTURE).setOrigin(ox, oy).setScale(1 / ART_K).setDepth(5);
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
    this.flyTo(this.perchX(1), this.perchY(), 900);
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
    this.scene.tweens.add({ targets: this.head, scale: 1.2 / ART_K, duration: 350, yoyo: true });
  }

  /** Embestida en diagonal hacia donde está Kerana; si acierta, se lleva un corazón. */
  private steal(activeMs: number): void {
    const px = this.ctx.playerX();
    const dir = px >= this.head.x ? 1 : -1;
    const arena = this.ctx.arena;
    const toX = Phaser.Math.Clamp(px + dir * CFG.stealOvershoot, arena.left + TILE, arena.right - TILE);
    this.harmful = true;
    this.stealing = true;
    this.head.setAngle(0).setScale(1 / ART_K).setFlipX(dir > 0);
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
    this.head.setAngle(0).setScale(1 / ART_K);
    this.flyTo(this.perchX(this.perch), this.perchY(), CFG.flyMs);
  }

  // ── Daño ──────────────────────────────────────────────────────────────────

  protected applyHit(rect: Phaser.Geom.Rectangle, damage: number): number {
    if (!this.brain.vulnerable || this.exposed === 'none') return 0;
    if (this.exposed === 'tail') {
      if (!Phaser.Geom.Rectangle.Overlaps(this.tailBounds(), rect)) return 0;
      if (this.thief.recover((n) => this.ctx.healPlayer(n))) this.ctx.sfx('heartBack');
    } else if (!Phaser.Geom.Rectangle.Overlaps(this.headBounds(), rect) && !this.touchesBody(rect)) {
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
        this.ctx.hypnotizePlayer();
      }
    }
    if (!this.harmful || !Phaser.Geom.Rectangle.Overlaps(this.headBounds(), playerRect)) return false;
    if (!this.stealing) return true;
    // Robo: un solo intento por embestida.
    this.stealing = false;
    if (this.thief.steal(() => this.ctx.damagePlayer(this.head.x))) this.ctx.sfx('steal');
    return false;
  }

  markPosition(out: Phaser.Math.Vector2): Phaser.Math.Vector2 {
    return out.set(this.head.x, this.head.y);
  }

  fadeOut(ms: number): void {
    this.scene.tweens.add({ targets: [this.head, this.horns, this.bodyGfx, this.backGfx, this.fxGfx, this.tailHeart], alpha: 0, duration: ms });
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
    this.updateHead(perched);
    this.updateSegments(deltaMs, perched);
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

  /** Cara según lo que hace (fauces abiertas = hace daño; ojo cerrado = aturdida) y cuernos pegados a la cabeza. */
  private updateHead(perched: boolean): void {
    const head = this.head;
    const texture = this.harmful ? HEAD_OPEN_TEXTURE : this.exposed === 'body' ? HEAD_DAZE_TEXTURE : HEAD_TEXTURE;
    if (head.texture.key !== texture) head.setTexture(texture);
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
    this.horns.setPosition(head.x, head.y).setFlipX(head.flipX).setAngle(head.angle).setScale(head.scaleX, head.scaleY).setAlpha(head.alpha);
    // Cuernos que brillan: parpadeo iridiscente.
    if (this.glowMs > 0) {
      const color = PULSE_COLORS[Math.floor(this.glowMs / 90) % PULSE_COLORS.length];
      this.horns.setTint(color).setTintMode(Phaser.TintModes.MULTIPLY);
    } else if (this.horns.isTinted && !this.flashing) {
      this.horns.clearTint();
    }
  }

  /** Dónde sale el cuello: detrás de la cabeza. */
  private neckX(): number {
    return this.head.x + (this.head.flipX ? -1 : 1) * (CFG.headWidth / 2 - 4);
  }

  /**
   * El cuerpo sigue a la cabeza como una cuerda; aturdido, se apoya en el suelo. En una copa, cada segmento va hacia su
   * lugar del enroscado: el cuello baja a la copa y el resto da vueltas alrededor del tronco hasta el suelo.
   */
  private updateSegments(deltaMs: number, perched: boolean): void {
    let prevX = this.neckX();
    let prevY = this.head.y + 2;
    const floor = this.floorY - CFG.segmentRadius / 2;
    const settle = Math.min(1, deltaMs / 120);
    const coil = Math.min(1, deltaMs / CFG.coilSettleMs);
    const trunk = this.trunks[this.perch];
    const neckX = prevX;
    const neckY = prevY;
    const coilTop = this.canopyY + CFG.coilPitch;
    for (let i = 0; i < this.segments.length; i++) {
      const s = this.segments[i];
      if (this.grounded) s.y += (floor - s.y) * settle;
      const dx = s.x - prevX;
      const dy = s.y - prevY;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d > CFG.segmentGap) {
        s.x = prevX + (dx / d) * CFG.segmentGap;
        s.y = prevY + (dy / d) * CFG.segmentGap;
      }
      s.back = false;
      if (perched) {
        // Lugar en el enroscado: el cuello, recto de la nuca a la copa; después, la hélice alrededor del tronco.
        let tx: number;
        let ty: number;
        let back = false;
        const n = CFG.neckSegments;
        const startAngle = trunk.x >= neckX ? -Math.PI / 2 : Math.PI / 2;
        if (i < n) {
          const f = (i + 1) / (n + 1);
          tx = neckX + (trunk.x + CFG.coilRadius * Math.sin(startAngle) - neckX) * f;
          ty = neckY + (coilTop - neckY) * f;
        } else {
          const a = startAngle + (i - n) * this.coilStep;
          tx = trunk.x + CFG.coilRadius * Math.sin(a);
          ty = coilTop + (i - n) * CFG.coilPitch;
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
    if (this.head.alpha <= 0) return;
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
    drawSnakeBody(this.bodyGfx, this.backGfx, pts, k, this.head.alpha);
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
    if (this.exposed === 'body' && this.brain.vulnerable) drawDazeStars(g, this.head.x, this.head.y - STARS_RISE, this.scene.time.now, this.head.alpha);
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
    this.glowMs = 0;
    this.perch = 1;
    this.placeAll(this.perchX(1), this.perchY());
    this.head.setAlpha(0).setAngle(0).setScale(1 / ART_K).clearTint().setTintMode(Phaser.TintModes.MULTIPLY);
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

  /** La cabeza asoma sobre la copa. */
  private perchY(): number {
    return this.canopyY - CFG.perchRise;
  }

  private groundHeadY(): number {
    return this.floorY - CFG.headHeight / 2;
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

  private tailBounds(): Phaser.Geom.Rectangle {
    const tail = this.segments[this.segments.length - 1];
    return this.tailRect.setTo(tail.x - CFG.tailWidth / 2, tail.y - CFG.tailHeight / 2, CFG.tailWidth, CFG.tailHeight);
  }

  /** El tajo toca alguno de los primeros segmentos del cuerpo (aturdido). */
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
