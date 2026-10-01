import Phaser from 'phaser';
import { GAMEPLAY } from '../../config/gameplay';
import { getBossDef } from '../../data/bosses';
import { skinIfAvailable } from '../../systems/SpriteSkin';
import { Boss, type BossContext } from './Boss';
import type { BossTransition } from './BossBrain';

const CFG = GAMEPLAY.mboiTui;
const TILE = 16;
const HEAD_TEXTURE = 'mboi_tui_head_placeholder';
const NECK_COLOR = 0x2f7a3e;
const COIL_COLOR = 0x28603a;
const CREST_COLOR = 0xe04848;
const SWELL_TINT = 0xa8d8f0;
const RING_COLOR = 0xf2eee3;
const BALL_COLOR = 0x7fc8e8;
const MAX_RINGS = 4;
const MAX_BALLS = 6;

interface Ring {
  obj: Phaser.GameObjects.Ellipse;
  dir: 1 | -1;
  /** Ya empujó a Kerana (un empujón por anillo). */
  pushed: boolean;
}

interface Ball {
  obj: Phaser.GameObjects.Arc;
  vx: number;
  vy: number;
}

/** Cabeza de loro de perfil mirando a la izquierda: verde, pico amarillo y ojo rojo (placeholder). */
function ensureTextures(scene: Phaser.Scene): void {
  if (scene.textures.exists(HEAD_TEXTURE)) return;
  const w = CFG.headWidth;
  const h = CFG.headHeight;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  g.fillStyle(0x3fa04e).fillRoundedRect(8, 0, w - 8, h, 6);
  g.fillStyle(0xf2c14e).fillTriangle(0, 9, 11, 4, 11, 14);
  g.fillStyle(0xd09a2a).fillTriangle(2, 12, 11, 12, 10, 17);
  g.fillStyle(0xe04848).fillCircle(15, 6, 2.5);
  g.fillStyle(0x1b1a2e).fillCircle(15, 6, 1);
  g.fillStyle(0x7fcf6a).fillRect(w - 8, 3, 6, h - 6);
  g.generateTexture(HEAD_TEXTURE, w, h);
  g.destroy();
}

// Mbói Tu'i (GDD §6.2): serpiente con cabeza de loro que emerge del agua de la laguna.
// Fase 1: picotazos. Fase 2: + graznido y escupitajo. Fase 3: enroscado en el islote central,
// picotazos rápidos, graznido doble, camalotes que aparecen y desaparecen, y flores que curan.
export class MboiTui extends Boss {
  private readonly head: Phaser.GameObjects.Image;
  private readonly crest: Phaser.GameObjects.Triangle;
  private readonly neck: Phaser.GameObjects.Graphics;
  private readonly coil: Phaser.GameObjects.Ellipse;
  private readonly bubbles: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly rings: Ring[] = [];
  private readonly balls: Ball[] = [];
  private readonly emergeXs: number[];
  private readonly coilX: number;
  private readonly headRect = new Phaser.Geom.Rectangle();
  private readonly tmpRect = new Phaser.Geom.Rectangle();
  private readonly arc = { p: 0 };
  private readonly timers: Phaser.Time.TimerEvent[] = [];
  /** Base del cuello (bajo el agua o sobre el islote central). */
  private baseX = 0;
  private baseY = 0;
  private neckScale = 1;
  private harmful = false;
  private exposed = false;
  private coiled = false;
  private bubbleMs = 0;
  private flowerMs = 0;
  /** Hay sprite real (sin cuello ni cresta por código). */
  private readonly skinned: boolean;

  constructor(scene: Phaser.Scene, ctx: BossContext) {
    super(scene, getBossDef('mboi_tui'), ctx);
    ensureTextures(scene);
    const arena = ctx.arena;
    this.emergeXs = CFG.emergeTiles.map((t) => arena.left + t * TILE);
    this.coilX = arena.left + CFG.coilTile * TILE;

    this.coil = scene.add.ellipse(this.coilX, ctx.floorY - 10, 70, 24, COIL_COLOR).setDepth(-1);
    this.neck = scene.add.graphics().setDepth(4);
    this.head = scene.add.image(0, 0, HEAD_TEXTURE).setDepth(5);
    this.crest = scene.add.triangle(0, 0, 0, 10, 5, 0, 10, 10, CREST_COLOR).setDepth(4);
    // Sprite real: cabeza y cuerpo enroscado; el agua tapa la parte de abajo (cuello y cresta, solo en el placeholder).
    this.skinned = !!skinIfAvailable(scene, this.head, 'mboi_tui', {
      origin: GAMEPLAY.sprites.mboiTui.origin,
      clipBelowY: () => ctx.floorY,
    });
    this.bubbles = scene.add
      .particles(0, 0, 'fx_particle', {
        speedY: { min: -40, max: -15 },
        speedX: { min: -8, max: 8 },
        lifespan: 500,
        alpha: { start: 0.9, end: 0 },
        tint: 0xd8f0f0,
        emitting: false,
      })
      .setDepth(6);
    for (let i = 0; i < MAX_RINGS; i++) {
      const obj = scene.add.ellipse(0, 0, CFG.ringWidth, CFG.ringHeight).setStrokeStyle(2, RING_COLOR).setOrigin(0.5, 1).setDepth(6).setVisible(false);
      this.rings.push({ obj, dir: 1, pushed: false });
    }
    for (let i = 0; i < MAX_BALLS; i++) {
      this.balls.push({ obj: scene.add.circle(0, 0, CFG.spitRadius, BALL_COLOR).setDepth(6).setVisible(false), vx: 0, vy: 0 });
    }
    this.resetVisuals();
  }

  // ── Presentación ──────────────────────────────────────────────────────────

  protected playIntro(onDone: () => void): void {
    // Un graznido que sacude la pantalla; la cabeza de loro emerge en el centro.
    const x = this.emergeXs[1];
    this.setBase(x, this.ctx.floorY + CFG.headHeight);
    this.head.setPosition(x, this.baseY).setAlpha(1).setFlipX(this.ctx.playerX() > x);
    this.moveHead(x, this.ctx.floorY - CFG.riseHeight, 600);
    this.timers.push(
      this.scene.time.delayedCall(600, () => {
        this.ctx.sfx('squawk');
        this.ctx.shake(400, 0.01);
        this.bristle(true);
      }),
      this.scene.time.delayedCall(1500, () => {
        this.bristle(false);
        this.submerge();
      }),
      this.scene.time.delayedCall(1900, onDone),
    );
  }

  // ── Ataques ───────────────────────────────────────────────────────────────

  protected onTransition(t: BossTransition): void {
    const id = t.attack?.id ?? '';
    switch (t.state) {
      case 'telegraph':
        if (id === 'peck') this.telegraphPeck();
        else if (id === 'spit') this.telegraphSpit();
        else this.telegraphSquawk();
        break;
      case 'active':
        if (id === 'peck') this.peck(t.attack!.activeMs);
        else if (id === 'spit') this.spit();
        else this.squawk(id === 'squawk_double' ? 2 : 1);
        break;
      case 'recover':
        if (id === 'peck') this.endPeck();
        else if (id === 'spit') this.endSpit();
        else this.endSquawk();
        break;
      case 'idle':
        this.rest();
        break;
      default:
        break;
    }
  }

  /** Picotazo: burbujas en el punto (fases 1-2) o la cabeza se agita sobre el islote (fase 3). */
  private telegraphPeck(): void {
    if (this.coiled) {
      this.moveHead(this.coilX, this.ctx.floorY - CFG.riseHeight - 10, 250);
      this.shakeHead();
    } else {
      this.submerge();
      this.setBase(this.pickEmergeX(true), this.ctx.floorY + CFG.headHeight);
      this.bubbleMs = 0;
    }
    this.ctx.sfx('bubbles');
  }

  /** Sale del agua (o del islote) en arco hacia Kerana y clava el pico. */
  private peck(activeMs: number): void {
    const floorY = this.ctx.floorY;
    const fromX = this.coiled ? this.head.x : this.baseX;
    const fromY = this.coiled ? this.head.y : floorY;
    const reach = this.coiled ? CFG.coiledPeckReach : CFG.peckReach;
    const px = this.ctx.playerX();
    const dir = px >= fromX ? 1 : -1;
    const dist = Phaser.Math.Clamp(Math.abs(px - fromX), TILE * 1.5, reach);
    const arena = this.ctx.arena;
    const toX = Phaser.Math.Clamp(fromX + dir * dist, arena.left + CFG.headWidth, arena.right - CFG.headWidth);
    const toY = floorY - CFG.headHeight / 2;
    this.scene.tweens.killTweensOf(this.head);
    this.head.setAlpha(1).setAngle(0).setFlipX(dir > 0).setPosition(fromX, fromY);
    this.harmful = true;
    this.arc.p = 0;
    this.scene.tweens.killTweensOf(this.arc);
    this.scene.tweens.add({
      targets: this.arc,
      p: 1,
      duration: activeMs,
      ease: 'Quad.easeIn',
      onUpdate: () => {
        const p = this.arc.p;
        this.head.setPosition(fromX + (toX - fromX) * p, fromY + (toY - fromY) * p - Math.sin(Math.PI * p) * CFG.peckArc);
      },
    });
    this.ctx.sfx('peck');
  }

  /** El pico queda clavado: la ventana. */
  private endPeck(): void {
    this.harmful = false;
    this.exposed = true;
    this.ctx.shake(80, 0.004);
  }

  /** Graznido: sale del agua, abre el pico y se le erizan las plumas. */
  private telegraphSquawk(): void {
    this.emergeNear(CFG.riseHeight);
    this.bristle(true);
  }

  private squawk(times: number): void {
    this.ctx.sfx('squawk');
    this.ctx.shake(250, 0.008);
    const perSquawk = CFG.ringsPerSquawk;
    for (let i = 0; i < times * perSquawk; i++) {
      const delay = i * CFG.ringGapMs + (i >= perSquawk ? CFG.ringGapMs : 0);
      this.timers.push(this.scene.time.delayedCall(delay, () => this.launchRing()));
    }
  }

  private launchRing(): void {
    const ring = this.rings.find((r) => !r.obj.visible);
    if (!ring) return;
    ring.dir = this.ctx.playerX() >= this.head.x ? 1 : -1;
    ring.pushed = false;
    ring.obj.setPosition(this.head.x, this.ctx.floorY).setVisible(true).setScale(0.6);
    this.scene.tweens.add({ targets: ring.obj, scale: 1, duration: 200 });
  }

  /** Al terminar el graznido cae agotada hacia Kerana: la ventana de 1 s. */
  private endSquawk(): void {
    this.bristle(false);
    const dir = this.ctx.playerX() >= this.head.x ? 1 : -1;
    this.head.setFlipX(dir > 0);
    this.moveHead(this.head.x + dir * CFG.slumpReach, this.ctx.floorY - CFG.headHeight / 2, 250);
    this.exposed = true;
  }

  /** Escupitajo: se le hincha el cuello. */
  private telegraphSpit(): void {
    this.emergeNear(CFG.riseHeight + 10);
    this.head.setTint(SWELL_TINT);
    this.scene.tweens.add({ targets: this, neckScale: 1.8, duration: 300, yoyo: true, repeat: 0 });
  }

  /** 3 bolas de agua en arco hacia donde está Kerana. */
  private spit(): void {
    this.head.clearTint();
    const hx = this.head.x;
    const hy = this.head.y;
    const g = CFG.spitGravity;
    const vy0 = CFG.spitVy;
    const drop = Math.max(0, this.ctx.floorY - hy);
    const flightS = (-vy0 + Math.sqrt(vy0 * vy0 + 2 * g * drop)) / g;
    const baseVx = (this.ctx.playerX() - hx) / Math.max(0.2, flightS);
    for (let i = 0; i < CFG.spitBalls; i++) {
      const ball = this.balls.find((b) => !b.obj.visible);
      if (!ball) break;
      ball.vx = baseVx + (i - (CFG.spitBalls - 1) / 2) * CFG.spitSpreadVx;
      ball.vy = vy0;
      ball.obj.setPosition(hx, hy).setVisible(true);
    }
    this.ctx.sfx('spit');
  }

  private endSpit(): void {
    this.neckScale = 1;
  }

  /** Entre ataques: bajo el agua (fases 1-2) o erguida sobre el islote central (fase 3). */
  private rest(): void {
    this.harmful = false;
    this.exposed = false;
    this.bristle(false);
    this.head.clearTint();
    this.neckScale = 1;
    if (this.coiled) {
      this.setBase(this.coilX, this.ctx.floorY - 14);
      this.head.setAlpha(1);
      this.moveHead(this.coilX, this.ctx.floorY - CFG.riseHeight - 10, 400);
    } else {
      this.submerge();
    }
  }

  // ── Daño ──────────────────────────────────────────────────────────────────

  protected applyHit(rect: Phaser.Geom.Rectangle, damage: number): number {
    if (!this.brain.vulnerable || !this.exposed) return 0;
    if (!Phaser.Geom.Rectangle.Overlaps(this.headBounds(), rect)) return 0;
    this.flash();
    this.ctx.sfx('bossHit');
    return damage;
  }

  protected override onPhaseChanged(phase: number): void {
    this.ctx.sfx('squawk');
    this.ctx.shake(300, 0.008);
    if (phase >= 2 && !this.coiled) this.coilUp();
  }

  protected override onDefeated(): void {
    this.ctx.setArenaPlatformsCycling(false);
    this.hideProjectiles();
  }

  /** Fase 3: se enrosca en el islote central; los camalotes empiezan a ir y venir. */
  private coilUp(): void {
    this.coiled = true;
    this.coil.setVisible(true).setAlpha(0);
    this.scene.tweens.add({ targets: this.coil, alpha: 1, duration: 500 });
    this.flowerMs = CFG.flowerEveryMs;
    this.ctx.setArenaPlatformsCycling(true);
  }

  hurtsPlayer(playerRect: Phaser.Geom.Rectangle): boolean {
    // Los anillos no dañan: empujan a Kerana hacia atrás (y quizás al agua).
    for (const ring of this.rings) {
      if (!ring.obj.visible || ring.pushed) continue;
      const w = CFG.ringWidth;
      this.tmpRect.setTo(ring.obj.x - w / 2, ring.obj.y - CFG.ringHeight, w, CFG.ringHeight);
      if (Phaser.Geom.Rectangle.Overlaps(this.tmpRect, playerRect)) {
        ring.pushed = true;
        this.ctx.pushPlayer(ring.dir * CFG.pushSpeed, CFG.pushMs);
      }
    }
    if (this.harmful && Phaser.Geom.Rectangle.Overlaps(this.headBounds(), playerRect)) return true;
    const r = CFG.spitRadius;
    for (const ball of this.balls) {
      if (!ball.obj.visible) continue;
      this.tmpRect.setTo(ball.obj.x - r, ball.obj.y - r, r * 2, r * 2);
      if (Phaser.Geom.Rectangle.Overlaps(this.tmpRect, playerRect)) {
        ball.obj.setVisible(false);
        return true;
      }
    }
    return false;
  }

  markPosition(out: Phaser.Math.Vector2): Phaser.Math.Vector2 {
    return out.set(this.head.x, this.head.y);
  }

  fadeOut(ms: number): void {
    this.scene.tweens.add({ targets: [this.head, this.neck, this.coil, this.crest], alpha: 0, duration: ms });
  }

  // ── Visual ────────────────────────────────────────────────────────────────

  protected updateVisuals(deltaMs: number): void {
    const dt = deltaMs / 1000;
    const arena = this.ctx.arena;
    for (const ring of this.rings) {
      if (!ring.obj.visible) continue;
      ring.obj.x += ring.dir * CFG.ringSpeed * dt;
      if (ring.obj.x < arena.left || ring.obj.x > arena.right) ring.obj.setVisible(false);
    }
    for (const ball of this.balls) {
      if (!ball.obj.visible) continue;
      ball.vy += CFG.spitGravity * dt;
      ball.obj.x += ball.vx * dt;
      ball.obj.y += ball.vy * dt;
      if (ball.obj.y > this.ctx.floorY + 2) {
        ball.obj.setVisible(false);
        this.bubbles.emitParticleAt(ball.obj.x, this.ctx.floorY, 4);
      }
    }
    // Aviso del picotazo: burbujas en el punto donde va a salir.
    if (!this.coiled && this.brain.state === 'telegraph' && this.brain.attack?.id === 'peck') {
      this.bubbleMs -= deltaMs;
      if (this.bubbleMs <= 0) {
        this.bubbleMs = 70;
        this.bubbles.emitParticleAt(this.baseX + Phaser.Math.Between(-10, 10), this.ctx.floorY, 2);
      }
    }
    // Fase 3: caen flores (yvoty) que curan.
    if (this.coiled && this.brain.state !== 'defeated') {
      this.flowerMs -= deltaMs;
      if (this.flowerMs <= 0) {
        this.flowerMs = CFG.flowerEveryMs;
        const x = Phaser.Math.Between(arena.left + 2 * TILE, arena.right - 2 * TILE);
        this.ctx.spawnHealFlower(x);
      }
    }

    const dir = this.head.flipX ? -1 : 1;
    this.crest.setPosition(this.head.x + dir * 8, this.head.y - CFG.headHeight / 2 - 3).setAlpha(this.head.alpha);
    this.neck.clear();
    if (this.head.alpha > 0 && !this.skinned) {
      this.neck.lineStyle(CFG.neckWidth * this.neckScale, NECK_COLOR, this.head.alpha);
      this.neck.lineBetween(this.baseX, this.baseY, this.head.x + dir * (CFG.headWidth / 2 - 4), this.head.y + 2);
    }
  }

  protected resetVisuals(): void {
    for (const timer of this.timers) timer.remove();
    this.timers.length = 0;
    this.scene.tweens.killTweensOf([this.head, this.coil, this.arc, this]);
    this.harmful = false;
    this.exposed = false;
    this.coiled = false;
    this.neckScale = 1;
    this.coil.setVisible(false).setAlpha(1);
    this.crest.setVisible(false);
    this.neck.setAlpha(1);
    this.setBase(this.emergeXs[1], this.ctx.floorY + CFG.headHeight);
    this.head.setPosition(this.baseX, this.baseY).setAlpha(0).setScale(1).clearTint().setTintMode(Phaser.TintModes.MULTIPLY);
    this.hideProjectiles();
    this.ctx.setArenaPlatformsCycling(false);
  }

  private hideProjectiles(): void {
    for (const ring of this.rings) ring.obj.setVisible(false);
    for (const ball of this.balls) ball.obj.setVisible(false);
  }

  private headBounds(): Phaser.Geom.Rectangle {
    const w = CFG.headWidth;
    const h = CFG.headHeight;
    return this.headRect.setTo(this.head.x - w / 2, this.head.y - h / 2, w, h);
  }

  /** Emerge (o se yergue sobre el islote) cerca de Kerana, `height` px sobre el agua. */
  private emergeNear(height: number): void {
    const x = this.coiled ? this.coilX : this.pickEmergeX(false);
    if (!this.coiled) {
      this.setBase(x, this.ctx.floorY + CFG.headHeight);
      this.head.setPosition(x, this.baseY);
    }
    this.head.setAlpha(1).setFlipX(this.ctx.playerX() > x);
    this.moveHead(x, this.ctx.floorY - height, 300);
    this.ctx.sfx('bubbles');
  }

  private submerge(): void {
    this.scene.tweens.killTweensOf(this.head);
    this.scene.tweens.add({ targets: this.head, y: this.ctx.floorY + CFG.headHeight, alpha: 0, duration: 250 });
  }

  /** Punto de emergencia más cercano a Kerana; con `varied`, a veces el segundo más cercano. */
  private pickEmergeX(varied: boolean): number {
    const px = this.ctx.playerX();
    const sorted = [...this.emergeXs].sort((a, b) => Math.abs(a - px) - Math.abs(b - px));
    return varied && Math.random() < 0.35 ? sorted[1] : sorted[0];
  }

  private setBase(x: number, y: number): void {
    this.baseX = x;
    this.baseY = y;
  }

  private moveHead(x: number, y: number, ms: number): void {
    this.scene.tweens.killTweensOf(this.head);
    this.scene.tweens.add({ targets: this.head, x, y, duration: ms, ease: 'Sine.easeInOut' });
  }

  private shakeHead(): void {
    this.scene.tweens.add({ targets: this.head, angle: { from: -8, to: 8 }, duration: 80, yoyo: true, repeat: 3, onComplete: () => this.head.setAngle(0) });
  }

  /** Pico abierto y plumas erizadas (aviso del graznido). */
  private bristle(on: boolean): void {
    this.crest.setVisible(on && !this.skinned);
    this.head.setScale(on ? 1.15 : 1);
  }

  private flash(): void {
    this.head.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
    this.scene.time.delayedCall(GAMEPLAY.boss.hitFlashMs, () => this.head.clearTint().setTintMode(Phaser.TintModes.MULTIPLY));
  }
}
