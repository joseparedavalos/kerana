import Phaser from 'phaser';
import { GAMEPLAY } from '../../config/gameplay';
import { getBossDef } from '../../data/bosses';
import { Boss, type BossContext } from './Boss';
import type { BossTransition } from './BossBrain';
import { chargeTarget, cubsForPhase, nearestIndex, type ChargeResult } from './aoAoLogic';

const CFG = GAMEPLAY.aoAo;
const TILE = 16;
const RUN_TEXTURE = 'ao_ao_placeholder';
const REAR_TEXTURE = 'ao_ao_rear_placeholder';
const DUST_COLOR = 0xb5aa9c;
const STAR_COLOR = 0xf2c14e;
const CLAW_COLOR = 0xf2eee3;
const STARS = 3;

/** Bestia lanuda de cabeza de oso (placeholder por código): en cuatro patas y erguida. Mira a la derecha. */
function ensureTextures(scene: Phaser.Scene): void {
  if (!scene.textures.exists(RUN_TEXTURE)) {
    const w = CFG.width;
    const h = CFG.height;
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0xd9d2c0).fillRoundedRect(2, 6, w - 14, h - 12, 6); // lana
    g.fillStyle(0xc4bca8).fillCircle(10, 10, 5).fillCircle(20, 8, 5).fillCircle(28, 10, 4); // rulos
    g.fillStyle(0x4a3222).fillRoundedRect(w - 16, 4, 15, 14, 4); // cabeza de oso
    g.fillStyle(0xe04848).fillRect(w - 6, 8, 2, 2); // ojo rojo
    g.fillStyle(0xf2eee3).fillRect(w - 4, 15, 1, 3).fillRect(w - 8, 15, 1, 3); // colmillos
    g.fillStyle(0x6a2e8f).fillCircle(w / 2 - 4, 14, 3); // marca de Tau
    g.fillStyle(0x3e2a1c).fillRect(6, h - 6, 4, 6).fillRect(14, h - 6, 4, 6).fillRect(w - 20, h - 6, 4, 6).fillRect(w - 13, h - 6, 4, 6);
    g.generateTexture(RUN_TEXTURE, w, h);
    g.destroy();
  }
  if (!scene.textures.exists(REAR_TEXTURE)) {
    const w = 30;
    const h = CFG.rearHeight;
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0xd9d2c0).fillRoundedRect(4, 12, w - 8, h - 20, 6);
    g.fillStyle(0x4a3222).fillRoundedRect(8, 0, 15, 14, 4);
    g.fillStyle(0xe04848).fillRect(18, 4, 2, 2);
    g.fillStyle(0x3e2a1c).fillRect(w - 6, 14, 6, 4).fillRect(0, 18, 5, 4); // zarpas
    g.fillStyle(0x6a2e8f).fillCircle(w / 2, 24, 3);
    g.fillStyle(0x3e2a1c).fillRect(8, h - 8, 5, 8).fillRect(w - 13, h - 8, 5, 8);
    g.generateTexture(REAR_TEXTURE, w, h);
    g.destroy();
  }
}

// Ao Ao (GDD §6.6): señor de los cerros. Fase 1: embestida (aturdido si choca contra una roca).
// Fase 2: zarpazo erguido y aullido que llama crías. Fase 3: furia, embestidas dobles y rocas que caen.
// Si Kerana está en lo alto de un pindó no la puede alcanzar: da vueltas al pie y aúlla.
export class AoAo extends Boss {
  private readonly body: Phaser.GameObjects.Image;
  private readonly claw: Phaser.GameObjects.Rectangle;
  private readonly stars: Phaser.GameObjects.Arc[] = [];
  private readonly dust: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly timers: Phaser.Time.TimerEvent[] = [];
  private readonly bodyRect = new Phaser.Geom.Rectangle();
  private readonly clawRect = new Phaser.Geom.Rectangle();
  private readonly charge: ChargeResult = { x: 0, hitRock: false };
  private facing: 1 | -1 = -1;
  private harmful = false;
  private clawing = false;
  private reared = false;
  private stunned = false;
  /** La embestida en curso termina contra una roca en esta x (null = llega al borde). */
  private pendingStunX: number | null = null;
  /** Kerana en el pindó: la pelea se detiene y él da vueltas al pie aullando. */
  private circling = false;
  private circleMs = 0;
  private howlMs = 0;
  private moveTween?: Phaser.Tweens.Tween;

  constructor(scene: Phaser.Scene, ctx: BossContext) {
    super(scene, getBossDef('ao_ao'), ctx);
    ensureTextures(scene);
    this.body = scene.add.image(0, ctx.floorY, RUN_TEXTURE).setOrigin(0.5, 1).setDepth(5);
    this.claw = scene.add.rectangle(0, 0, CFG.clawReachPx, 6, CLAW_COLOR, 0.8).setDepth(6).setVisible(false);
    for (let i = 0; i < STARS; i++) this.stars.push(scene.add.circle(0, 0, 2, STAR_COLOR).setDepth(7).setVisible(false));
    this.dust = scene.add.particles(0, 0, 'fx_particle', {
      speedX: { min: -40, max: 40 },
      speedY: { min: -40, max: -10 },
      lifespan: 450,
      alpha: { start: 0.8, end: 0 },
      tint: DUST_COLOR,
      emitting: false,
    });
    this.dust.setDepth(8);
    this.resetVisuals();
  }

  // ── Presentación ──────────────────────────────────────────────────────────

  protected playIntro(onDone: () => void): void {
    // Baja del cerro entre polvo y aúlla con la cabeza en alto.
    this.dust.emitParticleAt(this.body.x, this.ctx.floorY - 6, 14);
    this.scene.tweens.add({ targets: this.body, alpha: 1, duration: 500 });
    this.timers.push(
      this.scene.time.delayedCall(600, () => {
        this.faceKerana();
        this.rear(true);
        this.ctx.sfxAt('howl', this.body.x);
        this.ctx.shake(250, 0.006);
      }),
      this.scene.time.delayedCall(1700, () => {
        this.rear(false);
        onDone();
      }),
    );
  }

  // ── Refugio en el pindó ───────────────────────────────────────────────────

  override update(deltaMs: number): void {
    const refuge = this.ctx.playerOnRefuge();
    // El ataque en curso termina; entre ataques, si Kerana está en el pindó, la pelea espera.
    if (refuge && (this.brain.state === 'idle' || this.circling)) {
      if (!this.circling) this.startCircling();
      this.updateCircling(deltaMs);
      this.updateVisuals(deltaMs);
      return;
    }
    if (this.circling) this.stopCircling();
    super.update(deltaMs);
  }

  private startCircling(): void {
    this.circling = true;
    this.circleMs = 0;
    this.howlMs = CFG.refugeHowlEveryMs * 0.5;
    this.stopMove();
    this.harmful = false;
    this.rear(false);
  }

  private stopCircling(): void {
    this.circling = false;
    this.rear(false);
  }

  /** Da vueltas al pie del pindó donde está Kerana y aúlla. */
  private updateCircling(deltaMs: number): void {
    this.circleMs += deltaMs;
    const centers = CFG.pindoTiles.map((t) => this.tileX(t));
    const center = centers[nearestIndex(this.ctx.playerX(), centers)];
    const target = center + Math.sin(this.circleMs / 700) * CFG.refugeCirclePx;
    const step = (CFG.refugeCircleSpeed * deltaMs) / 1000;
    const dx = Phaser.Math.Clamp(target - this.body.x, -step, step);
    this.body.x = Phaser.Math.Clamp(this.body.x + dx, this.minX(), this.maxX());
    if (Math.abs(dx) > 0.05) this.facing = dx > 0 ? 1 : -1;
    this.howlMs -= deltaMs;
    if (this.howlMs <= 0) {
      this.howlMs = CFG.refugeHowlEveryMs;
      this.ctx.sfxAt('howl', this.body.x);
      this.rear(true);
      this.timers.push(this.scene.time.delayedCall(500, () => this.circling && this.rear(false)));
    }
  }

  // ── Ataques ───────────────────────────────────────────────────────────────

  protected onTransition(t: BossTransition): void {
    const id = t.attack?.id ?? '';
    switch (t.state) {
      case 'telegraph':
        this.telegraph(id);
        break;
      case 'active':
        this.activate(id, t.attack!.activeMs);
        break;
      case 'recover':
        this.harmful = false;
        this.clawing = false;
        this.claw.setVisible(false);
        if (id === 'charge' || id === 'double_charge') {
          // Solo queda aturdido si chocó contra una roca; si no, sigue sin ventana.
          if (!this.stunned && this.pendingStunX !== null) {
            this.stopMove();
            this.body.x = this.pendingStunX;
            this.impact();
          }
          if (!this.stunned) {
            this.brain.interrupt();
            this.onIdle();
          }
        } else if (id !== 'claw') {
          this.rear(false);
        }
        break;
      case 'idle':
        this.onIdle();
        break;
      default:
        break;
    }
  }

  private onIdle(): void {
    this.harmful = false;
    this.clawing = false;
    this.stunned = false;
    this.pendingStunX = null;
    this.claw.setVisible(false);
    this.rear(false);
    this.walkTowardKerana(this.brain.phaseDef.idleMs);
  }

  private telegraph(id: string): void {
    switch (id) {
      case 'charge':
      case 'double_charge':
        // Rasca el suelo y resopla.
        this.stopMove();
        this.faceKerana();
        this.ctx.sfxAt('scrape', this.body.x);
        this.ctx.sfxAt('grunt', this.body.x);
        this.dust.emitParticleAt(this.body.x - this.facing * (CFG.width / 2), this.ctx.floorY - 2, 8);
        this.scene.tweens.add({ targets: this.body, scaleX: 0.92, duration: 120, yoyo: true, repeat: 2 });
        break;
      case 'claw':
        this.stopMove();
        this.faceKerana();
        this.rear(true);
        this.ctx.sfxAt('growl', this.body.x);
        break;
      case 'howl':
        this.stopMove();
        this.rear(true);
        this.ctx.sfxAt('howl', this.body.x);
        break;
      case 'rockfall':
        // Golpea el suelo: el cerro se sacude.
        this.stopMove();
        this.rear(true);
        this.ctx.sfxAt('growl', this.body.x);
        break;
    }
  }

  private activate(id: string, activeMs: number): void {
    switch (id) {
      case 'charge':
        this.harmful = true;
        this.chargeLeg(activeMs, false);
        break;
      case 'double_charge':
        this.harmful = true;
        this.chargeLeg(activeMs / 2, true);
        break;
      case 'claw':
        this.clawing = true;
        this.harmful = true;
        this.ctx.sfx('claw');
        break;
      case 'howl': {
        this.rear(false);
        const n = cubsForPhase(this.brain.phase, CFG.cubsPerHowl);
        const arena = this.ctx.arena;
        const edges = [arena.left + CFG.edgeSpawnTiles * TILE, arena.right - CFG.edgeSpawnTiles * TILE];
        for (let i = 0; i < n; i++) {
          const x = edges[i % 2];
          this.dust.emitParticleAt(x, this.ctx.floorY - 6, 6);
          this.ctx.spawnMinion('ao_ao_cria', x, this.ctx.floorY, CFG.maxCubs);
        }
        break;
      }
      case 'rockfall': {
        this.rear(false);
        this.ctx.sfx('stomp');
        this.ctx.shake(200, 0.008);
        const arena = this.ctx.arena;
        for (let i = 0; i < CFG.rocksPerFall; i++) {
          // La primera cae sobre Kerana; las otras, en cualquier lugar de la arena.
          const x = i === 0 ? this.ctx.playerX() : Phaser.Math.Between(arena.left + TILE * 2, arena.right - TILE * 2);
          this.timers.push(this.scene.time.delayedCall(i * CFG.rockFallGapMs, () => this.ctx.spawnFalling(x, 'roca')));
        }
        break;
      }
    }
  }

  /** Un tramo de embestida: hasta la roca o el borde. `thenBack`: la embestida doble vuelve hacia Kerana. */
  private chargeLeg(ms: number, thenBack: boolean): void {
    this.stunned = false;
    this.ctx.sfxAt('grunt', this.body.x);
    const res = chargeTarget(this.body.x, this.facing, this.rockCenters(), CFG.rockHalfWidthPx, CFG.width / 2, this.minX(), this.maxX(), this.charge);
    const hitRock = res.hitRock;
    this.pendingStunX = hitRock ? res.x : null;
    this.stopMove();
    this.moveTween = this.scene.tweens.add({
      targets: this.body,
      x: res.x,
      duration: Math.max(1, ms),
      ease: 'Quad.easeIn',
      onUpdate: () => {
        if (Math.random() < 0.3) this.dust.emitParticleAt(this.body.x - this.facing * (CFG.width / 2), this.ctx.floorY - 2, 1);
      },
      onComplete: () => {
        if (hitRock) {
          this.impact();
          return;
        }
        if (thenBack) {
          this.faceKerana();
          this.chargeLeg(ms, false);
        }
      },
    });
  }

  /** Choca contra la roca: queda aturdido (la ventana). */
  private impact(): void {
    this.stunned = true;
    this.pendingStunX = null;
    this.harmful = false;
    this.ctx.sfx('stomp');
    this.ctx.sfxAt('rockBreak', this.body.x);
    this.ctx.shake(180, 0.01);
    this.dust.emitParticleAt(this.body.x + this.facing * (CFG.width / 2), this.ctx.floorY - 10, 12);
  }

  private walkTowardKerana(idleMs: number): void {
    const dir: 1 | -1 = this.ctx.playerX() >= this.body.x ? 1 : -1;
    const x = Phaser.Math.Clamp(this.body.x + dir * CFG.walkSpeed * (idleMs / 1000) * 0.8, this.minX(), this.maxX());
    // No camina a través de las rocas.
    const res = chargeTarget(this.body.x, dir, this.rockCenters(), CFG.rockHalfWidthPx, CFG.width / 2, this.minX(), this.maxX(), this.charge);
    const target = dir > 0 ? Math.min(x, res.x) : Math.max(x, res.x);
    this.facing = dir;
    this.stopMove();
    this.moveTween = this.scene.tweens.add({ targets: this.body, x: target, duration: Math.max(1, idleMs * 0.8), ease: 'Sine.easeInOut' });
  }

  private stopMove(): void {
    this.moveTween?.stop();
    this.moveTween = undefined;
  }

  // ── Daño ──────────────────────────────────────────────────────────────────

  protected applyHit(rect: Phaser.Geom.Rectangle, damage: number): number {
    if (!this.brain.vulnerable) return 0;
    if (!Phaser.Geom.Rectangle.Overlaps(this.bounds(this.bodyRect), rect)) return 0;
    this.flash();
    this.ctx.sfx('bossHit');
    return damage;
  }

  protected override onPhaseChanged(phase: number): void {
    // Se enfurece: aúlla y el cerro tiembla.
    this.ctx.sfxAt('howl', this.body.x);
    this.ctx.shake(220, 0.008);
    this.dust.emitParticleAt(this.body.x, this.ctx.floorY - 4, phase === 2 ? 18 : 10);
  }

  protected override onDefeated(): void {
    this.harmful = false;
    this.clawing = false;
    this.stunned = false;
    this.pendingStunX = null;
    this.circling = false;
    this.stopMove();
    this.claw.setVisible(false);
    for (const s of this.stars) s.setVisible(false);
    this.scene.tweens.killTweensOf(this.body);
    this.body.setAlpha(1).setScale(1).clearTint().setTintMode(Phaser.TintModes.MULTIPLY);
  }

  hurtsPlayer(playerRect: Phaser.Geom.Rectangle): boolean {
    // El pindó tiene un hechizo contra su ferocidad: ahí arriba no la alcanza.
    if (!this.harmful || this.ctx.playerOnRefuge()) return false;
    if (this.clawing && Phaser.Geom.Rectangle.Overlaps(this.clawBounds(), playerRect)) return true;
    return Phaser.Geom.Rectangle.Overlaps(this.bounds(this.bodyRect), playerRect);
  }

  markPosition(out: Phaser.Math.Vector2): Phaser.Math.Vector2 {
    return out.set(this.body.x, this.body.y - this.body.displayHeight / 2);
  }

  fadeOut(ms: number): void {
    this.scene.tweens.add({ targets: this.body, alpha: 0, duration: ms });
  }

  // ── Visual ────────────────────────────────────────────────────────────────

  protected updateVisuals(_deltaMs: number): void {
    this.body.setFlipX(this.facing < 0);
    if (this.clawing) {
      const r = this.clawBounds();
      this.claw.setPosition(r.centerX, r.centerY).setVisible(true);
    }
    // Estrellitas girando sobre la cabeza mientras está aturdido.
    const showStars = this.stunned && this.brain.state === 'recover';
    for (let i = 0; i < STARS; i++) {
      const star = this.stars[i];
      star.setVisible(showStars);
      if (!showStars) continue;
      const a = this.scene.time.now / 200 + (i * Math.PI * 2) / STARS;
      star.setPosition(this.body.x + this.facing * 12 + Math.cos(a) * 10, this.ctx.floorY - CFG.height - 4 + Math.sin(a) * 3);
    }
  }

  protected resetVisuals(): void {
    for (const timer of this.timers) timer.remove();
    this.timers.length = 0;
    this.stopMove();
    this.scene.tweens.killTweensOf(this.body);
    this.harmful = false;
    this.clawing = false;
    this.stunned = false;
    this.pendingStunX = null;
    this.circling = false;
    this.facing = -1;
    this.reared = true;
    this.rear(false);
    this.claw.setVisible(false);
    for (const s of this.stars) s.setVisible(false);
    this.body.setPosition(this.tileX(CFG.startTile), this.ctx.floorY).setAlpha(0).setScale(1).clearTint().setTintMode(Phaser.TintModes.MULTIPLY);
  }

  /** Erguido en dos patas (zarpazo, aullido) o en cuatro. */
  private rear(on: boolean): void {
    if (this.reared === on) return;
    this.reared = on;
    this.body.setTexture(on ? REAR_TEXTURE : RUN_TEXTURE);
  }

  private faceKerana(): void {
    this.facing = this.ctx.playerX() >= this.body.x ? 1 : -1;
  }

  private tileX(tiles: number): number {
    return this.ctx.arena.left + tiles * TILE;
  }

  private rockCenters(): number[] {
    return CFG.rockTiles.map((t) => this.tileX(t));
  }

  private minX(): number {
    return this.ctx.arena.left + CFG.edgeMarginPx + CFG.width / 2;
  }

  private maxX(): number {
    return this.ctx.arena.right - CFG.edgeMarginPx - CFG.width / 2;
  }

  private bounds(out: Phaser.Geom.Rectangle): Phaser.Geom.Rectangle {
    const w = this.body.displayWidth;
    const h = this.body.displayHeight;
    return out.setTo(this.body.x - w / 2, this.ctx.floorY - h, w, h);
  }

  private clawBounds(): Phaser.Geom.Rectangle {
    const w = this.body.displayWidth;
    const x = this.facing > 0 ? this.body.x + w / 2 : this.body.x - w / 2 - CFG.clawReachPx;
    return this.clawRect.setTo(x, this.ctx.floorY - CFG.clawHeight, CFG.clawReachPx, CFG.clawHeight);
  }

  private flash(): void {
    this.body.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
    this.scene.time.delayedCall(GAMEPLAY.boss.hitFlashMs, () => this.body.clearTint().setTintMode(Phaser.TintModes.MULTIPLY));
  }
}
