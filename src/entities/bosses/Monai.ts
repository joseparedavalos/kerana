import Phaser from 'phaser';
import { GAMEPLAY } from '../../config/gameplay';
import { getBossDef } from '../../data/bosses';
import { skinIfAvailable, type SpriteSkin } from '../../systems/SpriteSkin';
import { Boss, type BossContext } from './Boss';
import type { BossTransition } from './BossBrain';
import { HeartThief, pulseBlocked, type Trunk } from './monaiLogic';

const CFG = GAMEPLAY.monai;
const TILE = 16;
const HEAD_TEXTURE = 'monai_head_placeholder';
const BODY_COLOR = 0x6a4a8c;
const BELLY_COLOR = 0x9a7ab8;
const TRUNK_COLOR = 0x5a3a24;
const LEAVES_COLOR = 0x3f7a3a;
const SHADOW_COLOR = 0x1b1a2e;
const PULSE_COLORS = [0xe06bd0, 0x6bd0e0, 0xe0d06b] as const;
const HEART_COLOR = 0xe04848;

interface Segment {
  x: number;
  y: number;
}

/** Cabeza de serpiente de perfil mirando a la izquierda con dos cuernos (placeholder). */
function ensureTextures(scene: Phaser.Scene): void {
  if (scene.textures.exists(HEAD_TEXTURE)) return;
  const w = CFG.headWidth;
  const h = CFG.headHeight;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  g.fillStyle(0x7a5a9c).fillRoundedRect(0, 5, w, h - 5, 6);
  g.fillStyle(0xd8c89a).fillTriangle(w - 10, 6, w - 4, 0, w - 4, 7);
  g.fillStyle(0xd8c89a).fillTriangle(w - 17, 6, w - 12, 0, w - 11, 7);
  g.fillStyle(0xf2c14e).fillCircle(8, 10, 2.5);
  g.fillStyle(0x1b1a2e).fillCircle(8, 10, 1);
  g.fillStyle(0x4a2a6a).fillRect(1, h - 5, 10, 2);
  g.generateTexture(HEAD_TEXTURE, w, h);
  g.destroy();
}

// Moñái (GDD §6.3): serpiente con cuernos que se esconde en las copas de la isla de monte.
// Fase 1: descenso con sombra. Fase 2: + pulso de hipnosis (los troncos lo tapan).
// Fase 3: + robo de un corazón que se recupera golpeando la cola; descensos más rápidos.
export class Monai extends Boss {
  private readonly head: Phaser.GameObjects.Image;
  private readonly bodyGfx: Phaser.GameObjects.Graphics;
  private readonly shadow: Phaser.GameObjects.Ellipse;
  private readonly pulse: Phaser.GameObjects.Arc;
  private readonly tailHeart: Phaser.GameObjects.Arc;
  private readonly leaves: Phaser.GameObjects.Ellipse[] = [];
  private readonly segments: Segment[] = [];
  private readonly trunks: Trunk[];
  private readonly thief = new HeartThief();
  private readonly headRect = new Phaser.Geom.Rectangle();
  private readonly tailRect = new Phaser.Geom.Rectangle();
  private readonly timers: Phaser.Time.TimerEvent[] = [];
  private readonly pulseState = { r: 0 };
  private readonly canopyY: number;
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
  /** Sprite real (cabeza y cuerpo colgando); el corte de arriba se prolonga hasta fuera de cámara. */
  private readonly skin?: SpriteSkin;

  constructor(scene: Phaser.Scene, ctx: BossContext) {
    super(scene, getBossDef('monai'), ctx);
    ensureTextures(scene);
    const arena = ctx.arena;
    this.canopyY = ctx.floorY - CFG.canopyTiles * TILE;
    this.trunks = CFG.treeTiles.map((t) => ({ x: arena.left + t * TILE, halfWidth: CFG.trunkHalfWidth, topY: this.canopyY }));

    // Troncos y follaje dibujados por código (las copas sólidas son los "=" del mapa).
    for (const trunk of this.trunks) {
      scene.add.rectangle(trunk.x, ctx.floorY, trunk.halfWidth * 2, ctx.floorY - this.canopyY, TRUNK_COLOR).setOrigin(0.5, 1).setDepth(-1);
      this.leaves.push(scene.add.ellipse(trunk.x, this.canopyY - 10, 5 * TILE + 8, 30, LEAVES_COLOR, 0.9).setDepth(7));
    }
    this.shadow = scene.add.ellipse(0, ctx.floorY - 1, CFG.shadowWidth, 8, SHADOW_COLOR, 0.6).setDepth(3).setVisible(false);
    this.bodyGfx = scene.add.graphics().setDepth(4);
    this.head = scene.add.image(0, 0, HEAD_TEXTURE).setDepth(5);
    this.skin = skinIfAvailable(scene, this.head, 'monai', { origin: GAMEPLAY.sprites.monai.origin });
    this.pulse = scene.add.circle(0, 0, 10).setStrokeStyle(3, PULSE_COLORS[0]).setDepth(6).setVisible(false);
    this.tailHeart = scene.add.circle(0, 0, 4, HEART_COLOR).setDepth(6).setVisible(false);
    for (let i = 0; i < CFG.segments; i++) this.segments.push({ x: 0, y: 0 });
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
        if (id === 'descent') this.telegraphDescent(t.attack!.telegraphMs);
        else if (id === 'pulse') this.telegraphPulse(t.attack!.telegraphMs);
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
    this.shadow.setPosition(this.ctx.playerX(), this.ctx.floorY - 1).setVisible(true).setScale(0.4);
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
    this.scene.tweens.add({ targets: this.head, scale: 1.2, duration: 350, yoyo: true });
  }

  /** Embestida en diagonal hacia donde está Kerana; si acierta, se lleva un corazón. */
  private steal(activeMs: number): void {
    const px = this.ctx.playerX();
    const dir = px >= this.head.x ? 1 : -1;
    const arena = this.ctx.arena;
    const toX = Phaser.Math.Clamp(px + dir * CFG.stealOvershoot, arena.left + TILE, arena.right - TILE);
    this.harmful = true;
    this.stealing = true;
    this.head.setAngle(0).setScale(1).setFlipX(dir > 0);
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
    if (part === 'body') this.ctx.shake(100, 0.005);
  }

  /** Entre ataques vuelve volando a una copa. */
  private rest(): void {
    this.harmful = false;
    this.stealing = false;
    this.exposed = 'none';
    this.grounded = false;
    this.glowMs = 0;
    this.head.setAngle(0).setScale(1);
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
    this.scene.tweens.add({ targets: [this.head, this.bodyGfx, this.tailHeart], alpha: 0, duration: ms });
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
    // Cuernos que brillan: parpadeo iridiscente de la cabeza.
    if (this.glowMs > 0) {
      this.glowMs -= deltaMs;
      const color = PULSE_COLORS[Math.floor(this.glowMs / 90) % PULSE_COLORS.length];
      this.head.setTint(color).setTintMode(Phaser.TintModes.MULTIPLY);
      if (this.glowMs <= 0) this.head.clearTint();
    }
    this.updateSegments(deltaMs);
    this.drawBody();
    const tail = this.segments[this.segments.length - 1];
    this.tailHeart.setPosition(tail.x, tail.y - 6).setVisible(this.thief.holding && this.head.alpha > 0);
    if (this.thief.holding) this.tailHeart.setScale(1 + Math.sin(this.scene.time.now / 120) * 0.25);
  }

  /** El cuerpo sigue a la cabeza como una cuerda; aturdido, se apoya en el suelo. */
  private updateSegments(deltaMs: number): void {
    let prevX = this.head.x + (this.head.flipX ? -1 : 1) * (CFG.headWidth / 2 - 4);
    let prevY = this.head.y + 2;
    const floor = this.ctx.floorY - CFG.segmentRadius / 2;
    const settle = Math.min(1, deltaMs / 120);
    for (const s of this.segments) {
      if (this.grounded) s.y += (floor - s.y) * settle;
      const dx = s.x - prevX;
      const dy = s.y - prevY;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d > CFG.segmentGap) {
        s.x = prevX + (dx / d) * CFG.segmentGap;
        s.y = prevY + (dy / d) * CFG.segmentGap;
      }
      prevX = s.x;
      prevY = s.y;
    }
  }

  private drawBody(): void {
    const g = this.bodyGfx;
    g.clear();
    if (this.head.alpha <= 0) return;
    const look = GAMEPLAY.sprites.monai;
    const body = this.skin ? look.bodyColor : BODY_COLOR;
    const belly = this.skin ? look.bellyColor : BELLY_COLOR;
    const n = this.segments.length;
    for (let i = n - 1; i >= 0; i--) {
      const s = this.segments[i];
      const r = CFG.segmentRadius * (1 - (i / n) * 0.6);
      g.fillStyle(i % 2 === 0 ? body : belly, this.head.alpha).fillCircle(s.x, s.y, r);
    }
    if (this.skin) this.drawHangingBody(this.skin.sprite);
  }

  /** El sprite corta el cuerpo arriba: se prolonga hacia arriba hasta salir de cámara (lo tapa el follaje si hay). */
  private drawHangingBody(sprite: Phaser.GameObjects.Sprite): void {
    const look = GAMEPLAY.sprites.monai;
    const top = sprite.getTopCenter();
    const camTop = this.scene.cameras.main.worldView.top - TILE;
    if (top.y === undefined || top.x === undefined || top.y <= camTop) return;
    // El cuello sale del centro del borde superior del frame (ver monai.png).
    const x = sprite.x + (0.5 - sprite.originX) * sprite.displayWidth;
    this.bodyGfx
      .fillStyle(look.columnColor, this.head.alpha)
      .fillRect(x - look.columnWidth / 2, camTop, look.columnWidth, top.y - camTop + 1);
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
    this.head.setAlpha(0).setAngle(0).setScale(1).clearTint().setTintMode(Phaser.TintModes.MULTIPLY);
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
    for (const s of this.segments) {
      s.x = x;
      s.y = y;
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
    return this.ctx.floorY - CFG.headHeight / 2;
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
    this.head.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
    this.scene.time.delayedCall(GAMEPLAY.boss.hitFlashMs, () => this.head.clearTint().setTintMode(Phaser.TintModes.MULTIPLY));
  }
}
