import Phaser from 'phaser';
import { GAMEPLAY } from '../../config/gameplay';
import { getBossDef } from '../../data/bosses';
import { Boss, type BossContext } from './Boss';
import type { BossTransition } from './BossBrain';
import { echoOf, echoRockXs, farSide, formForPhase, pickLitStar, smokeHurts, type TauForm } from './tauLogic';

const CFG = GAMEPLAY.tau;
const TILE = 16;
const DISGUISE_TEXTURE = 'tau_disguise_placeholder';
const SHOT_POOL = 10;
const ECHO_SHADOW = 0x1b1a2e;
/** Color del contorno de cada eco (el del hijo). */
const ECHO_COLORS: Record<string, number> = { echo_teju: 0xe04848, echo_mboi: 0x4e8c6a, echo_jasy: 0xf2c14e };
/** Tamaño de cada sombra (px). */
const ECHO_SIZES: Record<string, [number, number]> = { echo_teju: [44, 18], echo_mboi: [40, 12], echo_jasy: [12, 18] };

interface Shot {
  arc: Phaser.GameObjects.Arc;
  vx: number;
  vy: number;
  active: boolean;
}

/** El joven de la flauta (placeholder por código): pelo oscuro, camisa clara, flauta y la marca. */
function ensureTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists(DISGUISE_TEXTURE)) return;
  const w = CFG.width;
  const h = CFG.height;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  g.fillStyle(0xc89a78).fillCircle(w / 2, 6, 5); // cara
  g.fillStyle(0x2a1f1a).fillRect(w / 2 - 5, 0, 10, 4); // pelo
  g.fillStyle(0xe6e0d0).fillRect(3, 11, w - 6, 12); // camisa
  g.fillStyle(0x3a3050).fillRect(4, 23, 3, 9).fillRect(w - 7, 23, 3, 9); // piernas
  g.fillStyle(0x8a6a4a).fillRect(w / 2, 8, 8, 2); // flauta
  g.fillStyle(0x6a2e8f).fillCircle(w / 2, 16, 2); // marca de Tau
  g.generateTexture(DISGUISE_TEXTURE, w, h);
  g.destroy();
}

// Tau (GDD §7), jefe final en Yvága. Fase 1: el joven de la flauta (notas y melodía que hipnotiza).
// Fase 2: sombras de tres hijos repiten un ataque cada una (rocas, graznido y barrida, enjambre).
// Fase 3: su forma real, humo violeta con ojos rojos; las siete estrellas lo bajan con su luz.
export class Tau extends Boss {
  private readonly body: Phaser.GameObjects.Image;
  private readonly core: Phaser.GameObjects.Ellipse;
  private readonly eyes: Phaser.GameObjects.Rectangle[];
  private readonly smokeFx: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly stars: Phaser.GameObjects.Star[] = [];
  private readonly starCenters: number[] = [];
  private readonly starTops: number[] = [];
  private readonly echoes: Record<string, Phaser.GameObjects.Ellipse> = {};
  private readonly ring: Phaser.GameObjects.Arc;
  private readonly smokeRect: Phaser.GameObjects.Rectangle;
  private readonly beam: Phaser.GameObjects.Rectangle;
  private readonly shots: Shot[] = [];
  private readonly timers: Phaser.Time.TimerEvent[] = [];
  private readonly bodyRect = new Phaser.Geom.Rectangle();
  private readonly shotRect = new Phaser.Geom.Rectangle();
  private readonly sweepRect = new Phaser.Geom.Rectangle();
  private readonly ringState = { r: 0 };
  private form: TauForm = 'disguise';
  /** Fase cuyos efectos (subir, forma real) ya se aplicaron. */
  private appliedPhase = 0;
  private moveTween?: Phaser.Tweens.Tween;
  private ringActive = false;
  private ringHit = false;
  private smokeActive = false;
  private sweepActive = false;
  private litStar = -1;
  private sweepEcho?: Phaser.GameObjects.Ellipse;

  constructor(scene: Phaser.Scene, ctx: BossContext) {
    super(scene, getBossDef('tau'), ctx);
    ensureTexture(scene);
    // Las siete estrellas sobre sus plataformas (el mapa pone la plataforma, acá va el brillo).
    for (const [tx, row] of CFG.starTiles) {
      const cx = this.tileX(tx + CFG.starWidthTiles / 2);
      const top = ctx.arena.top + row * TILE;
      this.starCenters.push(cx);
      this.starTops.push(top);
      this.stars.push(scene.add.star(cx, top - 1, 5, 3, 7, CFG.starColor, 0.9).setDepth(2));
    }
    this.smokeRect = scene.add
      .rectangle(ctx.arena.left, ctx.floorY, ctx.arena.width, CFG.smokeTiles * TILE, CFG.smokeColor, 0.8)
      .setOrigin(0, 1)
      .setDepth(9)
      .setVisible(false);
    this.beam = scene.add.rectangle(0, 0, 4, 10, CFG.beamColor, 0.9).setOrigin(0.5, 0).setDepth(7).setVisible(false);
    for (const id of Object.keys(ECHO_COLORS)) {
      const [w, h] = ECHO_SIZES[id];
      this.echoes[id] = scene.add.ellipse(0, 0, w, h, ECHO_SHADOW, 0.75).setStrokeStyle(2, ECHO_COLORS[id]).setDepth(6).setVisible(false);
    }
    this.core = scene.add.ellipse(0, 0, CFG.trueWidth, CFG.trueHeight, CFG.smokeColor, 0.85).setDepth(5).setVisible(false);
    this.body = scene.add.image(0, ctx.floorY, DISGUISE_TEXTURE).setOrigin(0.5, 1).setDepth(5);
    this.eyes = [0, 1].map(() => scene.add.rectangle(0, 0, 4, 2, CFG.eyeColor).setDepth(8).setVisible(false));
    this.ring = scene.add.circle(0, 0, 10).setStrokeStyle(3, CFG.noteColor).setDepth(6).setVisible(false);
    for (let i = 0; i < SHOT_POOL; i++) {
      this.shots.push({ arc: scene.add.circle(0, 0, CFG.noteRadius, CFG.noteColor).setDepth(8).setVisible(false), vx: 0, vy: 0, active: false });
    }
    this.smokeFx = scene.add.particles(0, 0, 'fx_particle', {
      speedX: { min: -20, max: 20 },
      speedY: { min: -30, max: -5 },
      scale: { start: 2, end: 0.5 },
      lifespan: 700,
      alpha: { start: 0.6, end: 0 },
      tint: CFG.smokeColor,
      frequency: 60,
      emitting: false,
    });
    this.smokeFx.setDepth(4);
    this.resetVisuals();
  }

  // ── Presentación ──────────────────────────────────────────────────────────

  protected playIntro(onDone: () => void): void {
    // Aparece en las nubes y toca la flauta.
    this.scene.tweens.add({ targets: this.body, alpha: 1, duration: 700 });
    this.timers.push(
      this.scene.time.delayedCall(800, () => {
        this.ctx.sfxAt('whistle', this.body.x);
        this.ctx.sfx('laugh');
      }),
      this.scene.time.delayedCall(1600, onDone),
    );
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
        this.recover(id);
        break;
      case 'idle':
        this.onIdle();
        break;
      default:
        break;
    }
  }

  private onIdle(): void {
    this.endEffects();
    const idleMs = this.brain.phaseDef.idleMs;
    if (this.form === 'disguise') return;
    // Fases 2 y 3: vuelve a flotar fuera del alcance, más o menos sobre Kerana.
    this.moveTo(this.clampX(this.ctx.playerX()), this.floatY(), Math.min(CFG.floatMs, idleMs));
  }

  private telegraph(id: string): void {
    const echo = echoOf(id);
    if (echo) {
      this.showEcho(id);
      return;
    }
    switch (id) {
      case 'notes':
      case 'melody': {
        // Cambia de lado en un parpadeo y levanta la flauta.
        const x = farSide(this.ctx.playerX(), this.tileX(CFG.floorTiles[0]), this.tileX(CFG.floorTiles[1]));
        this.blinkTo(x);
        break;
      }
      case 'smoke': {
        // El humo empieza a subir por las nubes; la estrella más cercana a Kerana se enciende.
        this.smokeRect.setVisible(true).setAlpha(0);
        this.scene.tweens.add({ targets: this.smokeRect, alpha: 0.3, duration: 400 });
        this.lightStar(pickLitStar(this.starCenters, this.ctx.playerX(), this.litStar));
        this.ctx.sfx('laugh');
        break;
      }
      case 'bolts':
        for (const eye of this.eyes) this.scene.tweens.add({ targets: eye, scaleX: 2, duration: 150, yoyo: true, repeat: 1 });
        this.ctx.sfxAt('growl', this.core.x);
        break;
    }
  }

  private activate(id: string, activeMs: number): void {
    switch (id) {
      case 'notes':
        this.fireShots(CFG.notesPerAttack, activeMs, CFG.noteSpeed, CFG.noteColor, 'whistle');
        break;
      case 'melody':
        this.playMelody(activeMs);
        break;
      case 'echo_teju': {
        const arena = this.ctx.arena;
        const xs = echoRockXs(this.ctx.playerX(), CFG.echoRocks, CFG.echoRockGapTiles * TILE, arena.left + TILE, arena.right - TILE);
        const gap = activeMs / (xs.length + 1);
        xs.forEach((x, i) => this.timers.push(this.scene.time.delayedCall(i * gap, () => this.ctx.spawnFalling(x, 'roca'))));
        this.ctx.sfx('growl');
        break;
      }
      case 'echo_mboi':
        this.squawkAndSweep(activeMs);
        break;
      case 'echo_jasy': {
        const shadow = this.echoes.echo_jasy;
        for (let i = 0; i < CFG.echoSwarms; i++) this.ctx.spawnSwarm(shadow.x, shadow.y);
        this.ctx.sfxAt('buzz', shadow.x);
        break;
      }
      case 'smoke':
        this.smokeActive = true;
        this.smokeRect.setAlpha(0.8);
        this.ctx.shake(200, 0.004);
        break;
      case 'bolts':
        this.fireShots(CFG.boltsPerAttack, activeMs, CFG.boltSpeed, CFG.boltColor, 'throw');
        break;
    }
  }

  private recover(id: string): void {
    this.endEffects();
    if (id === 'smoke' && this.litStar >= 0) {
      // La estrella encendida lo baja con su rayo, junto a ella: esa es la ventana.
      const i = this.litStar;
      const cx = this.starCenters[i];
      const dir = cx < this.ctx.arena.centerX ? 1 : -1;
      const x = cx + dir * CFG.pullOffsetPx;
      const y = this.starTops[i] - 4;
      this.beam.setVisible(true).setAlpha(0.9).setPosition(cx, this.ctx.arena.top).setSize(4, this.starTops[i] - this.ctx.arena.top);
      this.scene.tweens.add({ targets: this.beam, alpha: 0, duration: 600, onComplete: () => this.beam.setVisible(false) });
      this.moveTo(x, y, 300);
      this.ctx.sfx('staffFlash');
      return;
    }
    if (this.form === 'echoes') {
      // Baja cansado a las nubes después del eco.
      this.moveTo(this.clampX(this.body.x), this.ctx.floorY, CFG.floatMs);
    }
  }

  private showEcho(id: string): void {
    const shadow = this.echoes[id];
    const arena = this.ctx.arena;
    let x = arena.centerX;
    let y = this.floatY() - 30;
    if (id === 'echo_mboi') {
      // La serpiente aparece en las nubes, del lado opuesto a Kerana.
      x = farSide(this.ctx.playerX(), arena.left + TILE * 2, arena.right - TILE * 2);
      y = this.ctx.floorY - CFG.sweepHeight / 2;
    } else if (id === 'echo_jasy') {
      // El niño aparece sobre la estrella más lejana a Kerana.
      let far = 0;
      for (let i = 1; i < this.starCenters.length; i++) {
        if (Math.abs(this.starCenters[i] - this.ctx.playerX()) > Math.abs(this.starCenters[far] - this.ctx.playerX())) far = i;
      }
      x = this.starCenters[far];
      y = this.starTops[far] - 10;
      this.ctx.sfxAt('whistle', x);
    }
    shadow.setPosition(x, y).setVisible(true).setAlpha(0);
    this.scene.tweens.add({ targets: shadow, alpha: 0.75, duration: 300 });
    this.ctx.sfx('laugh');
  }

  private squawkAndSweep(activeMs: number): void {
    const shadow = this.echoes.echo_mboi;
    const dir = shadow.x < this.ctx.arena.centerX ? 1 : -1;
    // Graznido: empuja a Kerana lejos de la serpiente; después la sombra barre las nubes.
    this.ctx.pushPlayer(dir * CFG.squawkPush, CFG.squawkMs);
    this.ctx.sfxAt('squawk', shadow.x);
    this.ctx.shake(150, 0.004);
    this.sweepActive = true;
    this.sweepEcho = shadow;
    const target = dir > 0 ? this.ctx.arena.right - TILE * 2 : this.ctx.arena.left + TILE * 2;
    this.scene.tweens.add({ targets: shadow, x: target, duration: Math.max(1, activeMs * 0.9), ease: 'Quad.easeIn' });
  }

  private playMelody(activeMs: number): void {
    this.ringActive = true;
    this.ringHit = false;
    this.ringState.r = 8;
    this.ring.setPosition(this.body.x, this.body.y - CFG.height / 2).setVisible(true).setAlpha(1);
    this.scene.tweens.killTweensOf(this.ringState);
    this.scene.tweens.add({ targets: this.ringState, r: CFG.melodyRadius, duration: activeMs, ease: 'Sine.easeOut' });
    this.ctx.sfxAt('hypnosis', this.body.x);
  }

  private fireShots(count: number, activeMs: number, speed: number, color: number, sfx: 'whistle' | 'throw'): void {
    const gap = activeMs / count;
    for (let i = 0; i < count; i++) {
      this.timers.push(
        this.scene.time.delayedCall(i * gap, () => {
          const shot = this.shots.find((s) => !s.active);
          if (!shot) return;
          const from = this.markPosition(this.tmp);
          const angle = Phaser.Math.Angle.Between(from.x, from.y, this.ctx.playerX(), this.ctx.playerY() - 16);
          shot.vx = Math.cos(angle) * speed;
          shot.vy = Math.sin(angle) * speed;
          shot.active = true;
          shot.arc.setPosition(from.x, from.y).setFillStyle(color).setVisible(true);
          this.ctx.sfxAt(sfx, from.x);
        }),
      );
    }
  }

  private readonly tmp = new Phaser.Math.Vector2();

  private updateShots(deltaMs: number): void {
    const dt = deltaMs / 1000;
    const arena = this.ctx.arena;
    for (const shot of this.shots) {
      if (!shot.active) continue;
      shot.arc.x += shot.vx * dt;
      shot.arc.y += shot.vy * dt;
      if (!arena.contains(shot.arc.x, shot.arc.y) || shot.arc.y >= this.ctx.floorY) this.hideShot(shot);
    }
  }

  private hideShot(shot: Shot): void {
    shot.active = false;
    shot.arc.setVisible(false);
  }

  private lightStar(i: number): void {
    this.litStar = i;
    this.stars.forEach((star, j) => {
      const lit = j === i;
      star.setFillStyle(lit ? CFG.starLitColor : CFG.starColor, lit ? 1 : 0.9).setScale(lit ? CFG.starLitScale : 1);
    });
    if (i >= 0) this.scene.tweens.add({ targets: this.stars[i], angle: 72, duration: 600 });
  }

  /** Corta los efectos del ataque (anillo, humo, barrida, sombras). */
  private endEffects(): void {
    this.ringActive = false;
    this.ring.setVisible(false);
    if (this.smokeActive || this.smokeRect.visible) {
      this.smokeActive = false;
      this.scene.tweens.killTweensOf(this.smokeRect);
      this.scene.tweens.add({ targets: this.smokeRect, alpha: 0, duration: 300, onComplete: () => this.smokeRect.setVisible(false) });
    }
    this.sweepActive = false;
    this.sweepEcho = undefined;
    for (const shadow of Object.values(this.echoes)) {
      if (!shadow.visible) continue;
      this.scene.tweens.killTweensOf(shadow);
      this.scene.tweens.add({ targets: shadow, alpha: 0, duration: 300, onComplete: () => shadow.setVisible(false) });
    }
  }

  // ── Movimiento ────────────────────────────────────────────────────────────

  /** Mueve la parte visible (disfraz: pies; forma real: centro del humo). */
  private moveTo(x: number, y: number, ms: number): void {
    this.stopMove();
    this.moveTween = this.scene.tweens.add({ targets: this.target(), x, y, duration: Math.max(1, ms), ease: 'Sine.easeInOut' });
  }

  /** Desaparece en humo y aparece en otro lado (fase 1). */
  private blinkTo(x: number): void {
    this.stopMove();
    this.smokeFx.explode(8, this.body.x, this.body.y - CFG.height / 2);
    this.body.setAlpha(0);
    this.timers.push(
      this.scene.time.delayedCall(CFG.blinkMs, () => {
        this.body.setPosition(x, this.ctx.floorY).setAlpha(1);
        this.smokeFx.explode(8, x, this.ctx.floorY - CFG.height / 2);
        this.body.setFlipX(this.ctx.playerX() < x);
      }),
    );
  }

  private stopMove(): void {
    this.moveTween?.stop();
    this.moveTween = undefined;
  }

  private target(): Phaser.GameObjects.Image | Phaser.GameObjects.Ellipse {
    return this.form === 'true' ? this.core : this.body;
  }

  // ── Daño ──────────────────────────────────────────────────────────────────

  protected applyHit(rect: Phaser.Geom.Rectangle, damage: number): number {
    if (!this.brain.vulnerable) return 0;
    if (!Phaser.Geom.Rectangle.Overlaps(this.bounds(this.bodyRect), rect)) return 0;
    this.flash();
    this.ctx.sfx('bossHit');
    return damage;
  }

  /** Efectos al entrar en cada fase (se revisa en cada frame: vale también si la fase cambia sin `tryHit`). */
  private enterPhase(phase: number): void {
    const form = formForPhase(phase);
    if (form === this.form) {
      this.appliedPhase = phase;
      return;
    }
    this.endEffects();
    for (const shot of this.shots) this.hideShot(shot);
    this.smokeFx.explode(16, this.body.x, this.body.y - CFG.height / 2);
    this.ctx.sfx('laugh');
    this.ctx.shake(300, 0.008);
    if (form === 'echoes') {
      // Sube al cielo: desde acá llama a las sombras de los hijos.
      this.form = form;
      this.moveTo(this.clampX(this.body.x), this.floatY(), CFG.floatMs);
    } else {
      // Forma real: humo violeta con ojos rojos. Las estrellas despiertan.
      const x = this.body.x;
      this.form = form;
      this.body.setVisible(false);
      this.core.setPosition(x, this.floatY() - CFG.trueHeight / 2).setVisible(true).setAlpha(0);
      this.scene.tweens.add({ targets: this.core, alpha: 0.85, duration: 600 });
      for (const eye of this.eyes) eye.setVisible(true);
      this.smokeFx.startFollow(this.core);
      this.smokeFx.emitting = true;
      for (const star of this.stars) this.scene.tweens.add({ targets: star, alpha: 1, scale: 1.2, duration: 300, yoyo: true });
    }
    this.appliedPhase = phase;
  }

  protected override onDefeated(): void {
    this.endEffects();
    this.stopMove();
    for (const shot of this.shots) this.hideShot(shot);
    this.smokeFx.emitting = false;
    this.body.clearTint().setTintMode(Phaser.TintModes.MULTIPLY);
    // Los siete hijos brillan juntos.
    for (const star of this.stars) star.setFillStyle(CFG.starLitColor, 1).setScale(CFG.starLitScale);
  }

  hurtsPlayer(playerRect: Phaser.Geom.Rectangle): boolean {
    if (this.brain.state === 'defeated') return false;
    for (const shot of this.shots) {
      if (!shot.active) continue;
      const r = CFG.noteRadius;
      if (Phaser.Geom.Rectangle.Overlaps(this.shotRect.setTo(shot.arc.x - r, shot.arc.y - r, r * 2, r * 2), playerRect)) {
        this.hideShot(shot);
        return true;
      }
    }
    if (this.ringActive && !this.ringHit) {
      // La melodía no daña: hipnotiza (controles invertidos, como el pulso de Moñái).
      const d = Phaser.Math.Distance.Between(this.ring.x, this.ring.y, playerRect.centerX, playerRect.centerY);
      if (Math.abs(d - this.ringState.r) < CFG.melodyBandPx) {
        this.ringHit = true;
        this.ctx.hypnotizePlayer();
      }
    }
    if (this.sweepActive && this.sweepEcho) {
      const s = this.sweepEcho;
      this.sweepRect.setTo(s.x - s.width / 2, this.ctx.floorY - CFG.sweepHeight, s.width, CFG.sweepHeight);
      if (Phaser.Geom.Rectangle.Overlaps(this.sweepRect, playerRect)) return true;
    }
    return this.smokeActive && smokeHurts(playerRect.bottom, this.smokeTop());
  }

  markPosition(out: Phaser.Math.Vector2): Phaser.Math.Vector2 {
    if (this.form === 'true') return out.set(this.core.x, this.core.y);
    return out.set(this.body.x, this.body.y - CFG.height / 2);
  }

  fadeOut(ms: number): void {
    // Queda sellado: el humo se encoge hasta desaparecer (como en el mito de Tume Arandu).
    this.smokeFx.emitting = false;
    this.scene.tweens.add({ targets: [this.body, this.core, ...this.eyes], alpha: 0, scale: 0.2, duration: ms });
  }

  // ── Visual ────────────────────────────────────────────────────────────────

  protected updateVisuals(deltaMs: number): void {
    if (this.brain.phase !== this.appliedPhase && this.brain.state !== 'defeated') this.enterPhase(this.brain.phase);
    this.updateShots(deltaMs);
    if (this.ringActive) this.ring.setRadius(this.ringState.r);
    if (this.form === 'true') {
      const sway = Math.sin(this.scene.time.now / 400) * 2;
      this.eyes[0].setPosition(this.core.x - 7, this.core.y - 4 + sway * 0.3);
      this.eyes[1].setPosition(this.core.x + 7, this.core.y - 4 + sway * 0.3);
      this.core.setScale(1 + sway * 0.02, 1 - sway * 0.02);
    } else if (this.brain.state !== 'defeated') {
      this.body.setFlipX(this.ctx.playerX() < this.body.x);
    }
  }

  protected resetVisuals(): void {
    for (const timer of this.timers) timer.remove();
    this.timers.length = 0;
    this.stopMove();
    this.scene.tweens.killTweensOf([this.body, this.core, this.ring, this.smokeRect, this.beam, ...this.eyes, ...this.stars, ...Object.values(this.echoes)]);
    this.form = 'disguise';
    this.appliedPhase = 0;
    this.ringActive = false;
    this.smokeActive = false;
    this.sweepActive = false;
    this.sweepEcho = undefined;
    this.litStar = -1;
    this.lightStar(-1);
    for (const star of this.stars) star.setAngle(0).setAlpha(0.9);
    for (const shot of this.shots) this.hideShot(shot);
    for (const shadow of Object.values(this.echoes)) shadow.setVisible(false);
    for (const eye of this.eyes) eye.setVisible(false).setAlpha(1).setScale(1);
    this.ring.setVisible(false);
    this.smokeRect.setVisible(false);
    this.beam.setVisible(false);
    this.smokeFx.stopFollow();
    this.smokeFx.emitting = false;
    this.core.setVisible(false).setScale(1).setAlpha(0.85);
    this.body
      .setVisible(true)
      .setPosition(this.tileX(CFG.floorTiles[1]), this.ctx.floorY)
      .setAlpha(0)
      .setScale(1)
      .clearTint()
      .setTintMode(Phaser.TintModes.MULTIPLY);
  }

  private tileX(tiles: number): number {
    return this.ctx.arena.left + tiles * TILE;
  }

  /** Altura a la que flota en las fases 2 y 3 (pies del disfraz o centro del humo). */
  private floatY(): number {
    return this.ctx.floorY - CFG.floatTiles * TILE;
  }

  private smokeTop(): number {
    return this.ctx.floorY - CFG.smokeTiles * TILE;
  }

  private clampX(x: number): number {
    return Phaser.Math.Clamp(x, this.tileX(CFG.floorTiles[0]), this.tileX(CFG.floorTiles[1]));
  }

  private bounds(out: Phaser.Geom.Rectangle): Phaser.Geom.Rectangle {
    if (this.form === 'true') return out.setTo(this.core.x - CFG.trueWidth / 2, this.core.y - CFG.trueHeight / 2, CFG.trueWidth, CFG.trueHeight);
    return out.setTo(this.body.x - CFG.width / 2, this.body.y - CFG.height, CFG.width, CFG.height);
  }

  private flash(): void {
    const part = this.target();
    if (part === this.body) {
      this.body.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
      this.scene.time.delayedCall(GAMEPLAY.boss.hitFlashMs, () => this.body.clearTint().setTintMode(Phaser.TintModes.MULTIPLY));
      return;
    }
    this.core.setFillStyle(0xffffff, 0.9);
    this.scene.time.delayedCall(GAMEPLAY.boss.hitFlashMs, () => this.core.setFillStyle(CFG.smokeColor, 0.85));
  }
}
