import Phaser from 'phaser';
import { GAMEPLAY } from '../../config/gameplay';
import { TEJU_JAGUA_COLORS, TEJU_JAGUA_HEADS, TEJU_JAGUA_HITS_PER_HEAD, getBossDef } from '../../data/bosses';
import { Boss, type BossContext } from './Boss';
import type { BossTransition } from './BossBrain';

const CFG = GAMEPLAY.tejuJagua;
/** Sprite real (npm run sprites → raw/teju_jagua/head/) o placeholder. */
const HEAD_SPRITE = 'teju_jagua_head';
const HEAD_PLACEHOLDER = 'teju_jagua_head_placeholder';
const EYES_TEXTURE = 'teju_jagua_eyes';
const SLEEP_TINT = 0x2a2838;
const FIRE_COLOR = 0xf08a30;
const WAVE_COLOR = 0xc9a66b;

interface Head {
  index: number;
  img: Phaser.GameObjects.Image;
  eyes: Phaser.GameObjects.Image;
  color: number;
  neckColor: number;
  hp: number;
  asleep: boolean;
  /** Muerde o escupe fuego: hace daño al tocarla. */
  harmful: boolean;
  /** Se puede golpear (ventana tras el ataque). */
  exposed: boolean;
  anchorX: number;
  anchorY: number;
  neckX: number;
  neckY: number;
}

function ensureTextures(scene: Phaser.Scene): void {
  const w = CFG.headWidth;
  const h = CFG.headHeight;
  if (!scene.textures.exists(HEAD_PLACEHOLDER)) {
    // Cabeza de perro de perfil mirando a la izquierda, en gris claro para teñirla.
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0xe6e6e6).fillRoundedRect(8, 0, w - 8, h - 4, 4);
    g.fillStyle(0xd0d0d0).fillRect(0, 5, 12, 8);
    g.fillStyle(0xb0b0b0).fillRect(0, 11, 14, 3);
    g.fillStyle(0xffffff).fillTriangle(2, 13, 5, 13, 3, 16);
    g.fillStyle(0xffffff).fillTriangle(8, 13, 11, 13, 9, 16);
    g.fillStyle(0xc8c8c8).fillTriangle(w - 8, 0, w - 2, 0, w - 4, -4);
    g.generateTexture(HEAD_PLACEHOLDER, w, h);
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
  private readonly necks: Phaser.GameObjects.Graphics;
  private readonly body: Phaser.GameObjects.Ellipse;
  private readonly tail: Phaser.GameObjects.Rectangle;
  private readonly wave: Phaser.GameObjects.Rectangle;
  private readonly fire: Phaser.GameObjects.Rectangle;
  private readonly smoke: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly waveRect = new Phaser.Geom.Rectangle();
  private readonly fireRect = new Phaser.Geom.Rectangle();
  private readonly headRect = new Phaser.Geom.Rectangle();
  /** Cabezas del ataque en curso. */
  private attackers: Head[] = [];
  private lastHit?: Head;
  private waveDir: 1 | -1 = -1;
  private smokeMs = 0;
  private readonly introTimers: Phaser.Time.TimerEvent[] = [];
  private readonly bodyX: number;
  private readonly bodyY: number;

  constructor(scene: Phaser.Scene, ctx: BossContext) {
    super(scene, getBossDef('teju_jagua'), ctx);
    ensureTextures(scene);
    const arena = ctx.arena;
    this.bodyX = arena.centerX;
    this.bodyY = ctx.floorY - 110;

    // Silueta del cuerpo enorme en la penumbra del fondo (ASSETS §5: l1_boss_body.png cuando exista).
    this.body = scene.add.ellipse(this.bodyX, this.bodyY, 300, 150, 0x0e0c16, 0.92).setDepth(-5);
    this.tail = scene.add.rectangle(this.bodyX + 150, this.bodyY + 20, 10, 60, 0x1c1a28).setOrigin(0.5, 1).setDepth(-4);
    this.necks = scene.add.graphics().setDepth(-3);
    this.wave = scene.add.rectangle(0, 0, CFG.tailWaveWidth, CFG.tailWaveHeight, WAVE_COLOR).setOrigin(0.5, 1).setDepth(6).setVisible(false);
    this.fire = scene.add.rectangle(0, 0, 1, 1, FIRE_COLOR, 0.7).setOrigin(0, 0).setDepth(6).setVisible(false);
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

    const texture = scene.textures.exists(HEAD_SPRITE) ? HEAD_SPRITE : HEAD_PLACEHOLDER;
    for (let i = 0; i < TEJU_JAGUA_HEADS; i++) {
      const offset = i - (TEJU_JAGUA_HEADS - 1) / 2;
      const anchorX = this.bodyX + offset * 44;
      const anchorY = this.bodyY - 50 - (3 - Math.abs(offset)) * 10;
      const img = scene.add.image(anchorX, anchorY, texture).setDepth(-2);
      const eyes = scene.add.image(anchorX, anchorY, EYES_TEXTURE).setDepth(-1);
      const color = TEJU_JAGUA_COLORS[i % TEJU_JAGUA_COLORS.length];
      this.heads.push({
        index: i,
        img,
        eyes,
        color,
        neckColor: Phaser.Display.Color.ValueToColor(color).darken(45).color,
        hp: TEJU_JAGUA_HITS_PER_HEAD,
        asleep: false,
        harmful: false,
        exposed: false,
        anchorX,
        anchorY,
        neckX: this.bodyX + offset * 24,
        neckY: this.bodyY - 30,
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
        if (id === 'bite') this.telegraphBite(t.attack!.telegraphMs);
        else if (id === 'fire') this.telegraphFire();
        else this.telegraphTail();
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

  /** Coletazo: la cola se levanta al fondo. */
  private telegraphTail(): void {
    this.attackers = [];
    this.scene.tweens.add({ targets: this.tail, scaleY: 1.8, angle: -15, duration: 300, ease: 'Back.easeOut' });
    this.ctx.sfx('growl');
  }

  /** Una onda recorre el suelo de lado a lado: hay que saltarla. */
  private launchWave(): void {
    const arena = this.ctx.arena;
    this.waveDir = this.ctx.playerX() < arena.centerX ? -1 : 1;
    const startX = this.waveDir < 0 ? arena.right - CFG.tailWaveWidth : arena.left + CFG.tailWaveWidth;
    this.wave.setPosition(startX, this.ctx.floorY).setVisible(true);
    this.scene.tweens.add({ targets: this.tail, scaleY: 1, angle: 0, duration: 200 });
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

  /** Aliento de fuego: dos cabezas sobre el tercio de la arena donde está Kerana; humo como aviso. */
  private telegraphFire(): void {
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
    this.ctx.sfx('growl');
  }

  private breatheFire(): void {
    const r = this.fireRect;
    this.fire.setPosition(r.x, r.y).setSize(r.width, r.height).setVisible(true);
    this.ctx.sfx('fireBreath');
  }

  /** Después del fuego las cabezas bajan, cansadas: se pueden golpear. */
  private endFire(): void {
    this.fire.setVisible(false);
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
    this.fire.setVisible(false);
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

  /** La cabeza vencida no muere: se duerme y se retira a la sombra. */
  private sleep(head: Head): void {
    head.asleep = true;
    head.exposed = false;
    head.harmful = false;
    head.eyes.setVisible(false);
    head.img.setTint(SLEEP_TINT);
    this.moveHead(head, head.anchorX, head.anchorY + 20, 600);
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
    return this.fire.visible && Phaser.Geom.Rectangle.Overlaps(this.fireRect, playerRect);
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
    if (this.wave.visible) {
      this.wave.x += this.waveDir * CFG.tailWaveSpeed * (deltaMs / 1000);
      const arena = this.ctx.arena;
      if (this.wave.x < arena.left || this.wave.x > arena.right) this.wave.setVisible(false);
    }
    if (this.brain.state === 'telegraph' && this.brain.attack?.id === 'fire') {
      this.smokeMs -= deltaMs;
      if (this.smokeMs <= 0) {
        this.smokeMs = 90;
        for (const head of this.attackers) this.smoke.emitParticleAt(head.img.x - CFG.headWidth / 2, head.img.y + 4, 1);
      }
    }
    if (this.fire.visible) this.fire.setAlpha(0.55 + Math.random() * 0.3);

    // Cuellos: del cuerpo a cada cabeza. Los ojos siguen a la cabeza.
    this.necks.clear();
    for (const head of this.heads) {
      const dir = head.img.flipX ? 1 : -1;
      head.eyes.setPosition(head.img.x + dir * 4, head.img.y - 3);
      head.eyes.setAlpha(head.img.alpha > 0 ? 1 : 0);
      if (head.img.alpha <= 0) continue;
      this.necks.lineStyle(CFG.neckWidth, head.asleep ? SLEEP_TINT : head.neckColor, head.img.alpha);
      this.necks.lineBetween(head.neckX, head.neckY, head.img.x - dir * (CFG.headWidth / 2 - 2), head.img.y);
    }
  }

  protected resetVisuals(): void {
    for (const timer of this.introTimers) timer.remove();
    this.introTimers.length = 0;
    this.attackers = [];
    this.lastHit = undefined;
    this.wave.setVisible(false);
    this.fire.setVisible(false);
    this.tail.setScale(1).setAngle(0);
    this.body.setAlpha(0.92);
    this.tail.setAlpha(1);
    this.necks.setAlpha(1);
    for (const head of this.heads) {
      this.scene.tweens.killTweensOf(head.img);
      head.hp = TEJU_JAGUA_HITS_PER_HEAD;
      head.asleep = false;
      head.harmful = false;
      head.exposed = false;
      head.img.setPosition(head.anchorX, head.anchorY).setAlpha(0).setFlipX(false).setTint(head.color);
      head.eyes.setVisible(false).setScale(1);
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
    head.eyes.setScale(1);
    if (on) this.scene.tweens.add({ targets: head.eyes, scale: 2, duration: 160, yoyo: true, repeat: -1 });
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
