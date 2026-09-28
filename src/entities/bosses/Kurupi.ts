import Phaser from 'phaser';
import { GAMEPLAY } from '../../config/gameplay';
import { getBossDef } from '../../data/bosses';
import { Boss, type BossContext } from './Boss';
import type { BossTransition } from './BossBrain';
import { callPlan, pickRealSlot, runDirection, runTargetX, toeSide, type CallPlan } from './kurupiLogic';

const CFG = GAMEPLAY.kurupi;
const TILE = 16;
const BODY_TEXTURE = 'kurupi_placeholder';
const LEAF_COLOR = 0x5cc85c;
const WAVE_COLOR = 0x3f7a3a;
const PRINT_COLOR = 0x6a5236;
const DUST_COLOR = 0xb5aa9c;
/** Ondas de hojas en el suelo a la vez (2 por pisotón). */
const WAVE_POOL = 4;

interface Wave {
  rect: Phaser.GameObjects.Rectangle;
  vx: number;
  lifeMs: number;
}

interface Footprint {
  sole: Phaser.GameObjects.Ellipse;
  toe: Phaser.GameObjects.Arc;
}

/** Una copia del engaño (fase 3): se deshace en hojas al golpearla. */
interface Copy {
  image: Phaser.GameObjects.Image;
  alive: boolean;
  facing: 1 | -1;
}

/** Hombre peludo del monte (placeholder por código), con los pies al revés: los dedos apuntan hacia atrás. */
function ensureTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists(BODY_TEXTURE)) return;
  const w = CFG.width;
  const h = CFG.height;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  g.fillStyle(0x5a3e2a).fillRect(3, 12, w - 6, h - 18); // cuerpo peludo
  g.fillStyle(0x7a5a3a).fillRect(4, 16, 3, 8).fillRect(w - 7, 18, 3, 8).fillRect(10, 30, 3, 6); // mechones
  g.fillStyle(0x4a3222).fillRect(5, 0, w - 10, 14); // cabeza
  g.fillStyle(0xf2c14e).fillRect(w - 11, 5, 2, 2).fillRect(w - 7, 5, 2, 2); // ojos (mira a la derecha)
  g.fillStyle(0x6a2e8f).fillCircle(w / 2, 22, 3); // marca de Tau
  g.fillStyle(0x3e2a1c).fillRect(7, h - 6, 4, 4).fillRect(w - 11, h - 6, 4, 4); // piernas
  // Pies al revés: el talón adelante (derecha) y los dedos atrás (izquierda).
  g.fillStyle(0x3e2a1c).fillRect(2, h - 2, 9, 2).fillRect(w - 16, h - 2, 9, 2);
  g.fillStyle(0xb58a6a).fillRect(2, h - 2, 2, 2).fillRect(w - 16, h - 2, 2, 2);
  g.generateTexture(BODY_TEXTURE, w, h);
  g.destroy();
}

// Kurupi (GDD §6.5): señor de la selva y sus animales. Fase 1: llama kuati o ka'i y embiste.
// Fase 2: corre al revés de donde mira (huellas invertidas) y da pisotones con ondas de hojas.
// Fase 3: se divide en tres; solo el verdadero deja huellas invertidas.
export class Kurupi extends Boss {
  private readonly body: Phaser.GameObjects.Image;
  private readonly copies: Copy[] = [];
  private readonly waves: Wave[] = [];
  private readonly footprints: Footprint[] = [];
  private readonly leaves: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly dust: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly timers: Phaser.Time.TimerEvent[] = [];
  private readonly bodyRect = new Phaser.Geom.Rectangle();
  private readonly copyRect = new Phaser.Geom.Rectangle();
  private readonly waveRect = new Phaser.Geom.Rectangle();
  private readonly plan: CallPlan = { kind: 'kuati', count: 0 };
  private facing: 1 | -1 = -1;
  private harmful = false;
  /** Corre con los pies al revés: deja huellas invertidas. */
  private printing = false;
  private runDir: 1 | -1 = 1;
  private lastPrintX = 0;
  private nextPrint = 0;
  private spot = 2;
  private blinkMs = 0;
  /** Caminata o carrera en curso (aparte de los tweens de pose). */
  private moveTween?: Phaser.Tweens.Tween;

  constructor(scene: Phaser.Scene, ctx: BossContext) {
    super(scene, getBossDef('kurupi'), ctx);
    ensureTexture(scene);
    for (let i = 0; i < CFG.footprintMax; i++) {
      const sole = scene.add.ellipse(0, ctx.floorY - 1, 6, 2, PRINT_COLOR, 0.9).setDepth(3).setVisible(false);
      const toe = scene.add.circle(0, ctx.floorY - 1, 1.5, PRINT_COLOR, 0.9).setDepth(3).setVisible(false);
      this.footprints.push({ sole, toe });
    }
    for (let i = 0; i < 2; i++) {
      const image = scene.add.image(0, ctx.floorY, BODY_TEXTURE).setOrigin(0.5, 1).setDepth(5).setVisible(false);
      this.copies.push({ image, alive: false, facing: -1 });
    }
    this.body = scene.add.image(0, ctx.floorY, BODY_TEXTURE).setOrigin(0.5, 1).setDepth(5);
    for (let i = 0; i < WAVE_POOL; i++) {
      const rect = scene.add.rectangle(0, ctx.floorY, CFG.waveWidth, CFG.waveHeight, WAVE_COLOR).setOrigin(0.5, 1).setDepth(6).setVisible(false);
      this.waves.push({ rect, vx: 0, lifeMs: 0 });
    }
    this.leaves = scene.add.particles(0, 0, 'fx_particle', {
      speedX: { min: -60, max: 60 },
      speedY: { min: -80, max: -20 },
      gravityY: 160,
      lifespan: 700,
      alpha: { start: 1, end: 0 },
      tint: [LEAF_COLOR, 0x3f7a3a, 0x8cbf5a],
      emitting: false,
    });
    this.leaves.setDepth(8);
    this.dust = scene.add.particles(0, 0, 'fx_particle', {
      speedX: { min: -30, max: 30 },
      speedY: { min: -30, max: -8 },
      lifespan: 400,
      alpha: { start: 0.8, end: 0 },
      tint: DUST_COLOR,
      emitting: false,
    });
    this.dust.setDepth(8);
    this.resetVisuals();
  }

  // ── Presentación ──────────────────────────────────────────────────────────

  protected playIntro(onDone: () => void): void {
    // Sale de entre las hojas del claro y silba llamando a la selva.
    this.leaves.emitParticleAt(this.body.x, this.body.y - CFG.height / 2, 14);
    this.scene.tweens.add({ targets: this.body, alpha: 1, duration: 500 });
    this.timers.push(
      this.scene.time.delayedCall(600, () => {
        this.faceKerana();
        this.ctx.sfxAt('jungleCall', this.body.x);
        this.pose(1.1);
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
        this.harmful = false;
        this.printing = false;
        this.pose(id === 'stomp' ? 0.85 : 1);
        if (id === 'call') this.ctx.sfxAt('laugh', this.body.x);
        break;
      case 'idle':
        this.harmful = false;
        this.printing = false;
        this.pose(1);
        this.dissolveCopies(false);
        this.walk(this.brain.phaseDef.idleMs);
        break;
      default:
        break;
    }
  }

  private telegraph(id: string): void {
    switch (id) {
      case 'call':
        // Pose de silbido: se estira y silba.
        this.faceKerana();
        this.pose(1.12);
        this.ctx.sfxAt('whistle', this.body.x);
        break;
      case 'charge':
        this.faceKerana();
        this.scrape();
        break;
      case 'reverse_run':
        // Mira hacia el otro lado… pero va a correr hacia Kerana.
        this.facing = this.ctx.playerX() >= this.body.x ? -1 : 1;
        this.scrape();
        break;
      case 'stomp':
        this.faceKerana();
        this.pose(0.8);
        this.ctx.sfxAt('growl', this.body.x);
        break;
      case 'decoy':
        this.splitIntoThree();
        break;
    }
  }

  private activate(id: string, activeMs: number): void {
    const arena = this.ctx.arena;
    const left = arena.left + TILE * 2;
    const right = arena.right - TILE;
    switch (id) {
      case 'call':
        this.pose(1);
        this.callAnimals();
        break;
      case 'charge':
        this.harmful = true;
        this.runTo(runDirection(this.facing, false), runTargetX(this.body.x, this.facing, CFG.chargeDistance, left, right), activeMs, false);
        break;
      case 'reverse_run': {
        this.harmful = true;
        const dir = runDirection(this.facing, true);
        this.runTo(dir, runTargetX(this.body.x, dir, Infinity, left + CFG.runEdgeMarginPx, right - CFG.runEdgeMarginPx), activeMs, true);
        break;
      }
      case 'stomp':
        this.stomp();
        break;
      case 'decoy': {
        this.harmful = true;
        const dir = runDirection(this.facing, true);
        this.runTo(dir, runTargetX(this.body.x, dir, Infinity, left + CFG.runEdgeMarginPx, right - CFG.runEdgeMarginPx), activeMs, true);
        // Las copias corren igual, pero no dejan huellas.
        for (const c of this.copies) {
          if (!c.alive) continue;
          const cdir = runDirection(c.facing, true);
          const x = runTargetX(c.image.x, cdir, Infinity, left + CFG.runEdgeMarginPx, right - CFG.runEdgeMarginPx);
          this.scene.tweens.add({ targets: c.image, x, duration: activeMs, ease: 'Sine.easeIn' });
        }
        break;
      }
    }
  }

  /** Llamado de la selva: 2 kuati por los bordes o 1 ka'i en una rama alta. */
  private callAnimals(): void {
    this.ctx.sfxAt('jungleCall', this.body.x);
    const arena = this.ctx.arena;
    const plan = callPlan(Math.random(), CFG.callKaiChance, CFG.callKuati, this.plan);
    if (plan.kind === 'kai') {
      this.spawnKai(Math.random() < 0.5 ? 0 : 1);
      return;
    }
    const edges = [arena.left + CFG.edgeSpawnTiles * TILE, arena.right - CFG.edgeSpawnTiles * TILE];
    for (let i = 0; i < plan.count; i++) {
      const x = edges[i % 2];
      this.leaves.emitParticleAt(x, this.ctx.floorY - 8, 6);
      this.ctx.spawnMinion('kuati', x, this.ctx.floorY);
    }
  }

  private spawnKai(slot: number): void {
    const spot = CFG.kaiSpots[slot];
    const x = this.ctx.arena.left + spot.tx * TILE;
    const y = this.ctx.floorY - spot.ty * TILE;
    this.leaves.emitParticleAt(x, y - 8, 8);
    this.ctx.spawnMinion('kai', x, y);
  }

  /** Pisotón: dos ondas de hojas por el suelo, una a cada lado. */
  private stomp(): void {
    this.pose(1);
    this.ctx.sfx('stomp');
    this.ctx.shake(160, 0.008);
    this.leaves.emitParticleAt(this.body.x, this.ctx.floorY - 4, 10);
    for (const dir of [-1, 1]) {
      const wave = this.waves.find((w) => w.lifeMs <= 0);
      if (!wave) break;
      wave.vx = dir * CFG.waveSpeed;
      wave.lifeMs = CFG.waveLifeMs;
      wave.rect.setPosition(this.body.x + dir * (CFG.width / 2), this.ctx.floorY).setVisible(true).setAlpha(1);
    }
  }

  /** Engaño: se divide en tres en los lugares del suelo; las copias parpadean al aparecer. */
  private splitIntoThree(): void {
    const spots = CFG.floorSpots;
    const real = pickRealSlot(Math.random(), spots.length);
    this.leaves.emitParticleAt(this.body.x, this.body.y - CFG.height / 2, 12);
    this.ctx.sfxAt('leaves', this.body.x);
    this.stopMove();
    this.body.x = this.spotX(real);
    this.facing = this.awayFromKerana(this.body.x);
    let c = 0;
    for (let i = 0; i < spots.length; i++) {
      if (i === real) continue;
      const copy = this.copies[c++];
      if (!copy) break;
      copy.alive = true;
      copy.facing = this.awayFromKerana(this.spotX(i));
      copy.image.setPosition(this.spotX(i), this.ctx.floorY).setVisible(true).setAlpha(CFG.copyAlpha).setFlipX(copy.facing < 0);
      this.leaves.emitParticleAt(copy.image.x, copy.image.y - CFG.height / 2, 8);
    }
    this.blinkMs = this.brain.msLeft;
  }

  /** Las copias que quedan se deshacen en hojas (al terminar el engaño o al golpearlas). */
  private dissolveCopies(fromHit: boolean): void {
    for (const c of this.copies) if (c.alive) this.dissolve(c, fromHit);
  }

  private dissolve(copy: Copy, fromHit: boolean): void {
    copy.alive = false;
    this.scene.tweens.killTweensOf(copy.image);
    copy.image.setVisible(false);
    this.leaves.emitParticleAt(copy.image.x, copy.image.y - CFG.height / 2, 14);
    if (!fromHit) return;
    // Castigo por golpear una copia: un ka'i empieza a lanzar frutas.
    this.ctx.sfxAt('leaves', copy.image.x);
    this.spawnKai(copy.image.x < this.ctx.arena.centerX ? 0 : 1);
  }

  /** Entre ataques camina a otro lugar del suelo. */
  private walk(idleMs: number): void {
    const spots = CFG.floorSpots;
    let next = Phaser.Math.Between(0, spots.length - 2);
    if (next >= this.spot) next++;
    this.spot = next;
    const x = this.spotX(next);
    const ms = Math.min(idleMs * 0.9, (Math.abs(x - this.body.x) / CFG.walkSpeed) * 1000);
    this.facing = x >= this.body.x ? 1 : -1;
    this.stopMove();
    this.moveTween = this.scene.tweens.add({ targets: this.body, x, duration: Math.max(1, ms), ease: 'Sine.easeInOut' });
  }

  /** Corre hasta `x` (con huellas si los pies están al revés). */
  private runTo(dir: 1 | -1, x: number, ms: number, reversed: boolean): void {
    this.runDir = dir;
    this.printing = reversed;
    this.lastPrintX = this.body.x;
    this.ctx.sfxAt('scrape', this.body.x);
    this.stopMove();
    this.moveTween = this.scene.tweens.add({ targets: this.body, x, duration: ms, ease: 'Sine.easeIn' });
  }

  private stopMove(): void {
    this.moveTween?.stop();
    this.moveTween = undefined;
  }

  /** Raspa el suelo antes de correr: polvo desde los talones. */
  private scrape(): void {
    this.ctx.sfxAt('scrape', this.body.x);
    this.dust.emitParticleAt(this.body.x - this.facing * 8, this.ctx.floorY - 2, 6);
  }

  // ── Daño ──────────────────────────────────────────────────────────────────

  protected applyHit(rect: Phaser.Geom.Rectangle, damage: number): number {
    for (const c of this.copies) {
      if (!c.alive || !Phaser.Geom.Rectangle.Overlaps(this.boundsAt(c.image.x, this.copyRect), rect)) continue;
      this.dissolve(c, true);
      return 0;
    }
    if (!this.brain.vulnerable) return 0;
    if (!Phaser.Geom.Rectangle.Overlaps(this.boundsAt(this.body.x, this.bodyRect), rect)) return 0;
    this.flash();
    this.ctx.sfx('bossHit');
    return damage;
  }

  protected override onPhaseChanged(phase: number): void {
    // Los pies se le dan vuelta (fase 2) o se prepara para el engaño (fase 3).
    this.ctx.sfxAt('growl', this.body.x);
    this.ctx.shake(200, 0.006);
    this.leaves.emitParticleAt(this.body.x, this.body.y - CFG.height / 2, phase === 2 ? 16 : 8);
  }

  protected override onDefeated(): void {
    this.harmful = false;
    this.printing = false;
    this.dissolveCopies(false);
    this.hideWaves();
    this.stopMove();
    this.scene.tweens.killTweensOf(this.body);
    this.body.setAlpha(1).setScale(1).clearTint().setTintMode(Phaser.TintModes.MULTIPLY);
  }

  hurtsPlayer(playerRect: Phaser.Geom.Rectangle): boolean {
    for (const w of this.waves) {
      if (w.lifeMs <= 0) continue;
      const r = w.rect;
      if (Phaser.Geom.Rectangle.Overlaps(this.waveRect.setTo(r.x - r.width / 2, r.y - r.height, r.width, r.height), playerRect)) return true;
    }
    if (!this.harmful) return false;
    if (Phaser.Geom.Rectangle.Overlaps(this.boundsAt(this.body.x, this.bodyRect), playerRect)) return true;
    for (const c of this.copies) if (c.alive && Phaser.Geom.Rectangle.Overlaps(this.boundsAt(c.image.x, this.copyRect), playerRect)) return true;
    return false;
  }

  markPosition(out: Phaser.Math.Vector2): Phaser.Math.Vector2 {
    return out.set(this.body.x, this.body.y - CFG.height / 2);
  }

  fadeOut(ms: number): void {
    this.scene.tweens.add({ targets: this.body, alpha: 0, duration: ms });
  }

  // ── Visual ────────────────────────────────────────────────────────────────

  protected updateVisuals(deltaMs: number): void {
    this.body.setFlipX(this.facing < 0);
    this.updateWaves(deltaMs);
    // Las copias parpadean al aparecer (aviso del engaño).
    if (this.blinkMs > 0) {
      this.blinkMs -= deltaMs;
      const on = Math.floor(this.blinkMs / CFG.copyBlinkMs) % 2 === 0;
      for (const c of this.copies) if (c.alive) c.image.setAlpha(this.blinkMs > 0 && !on ? 0.25 : CFG.copyAlpha);
    }
    if (this.printing && Math.abs(this.body.x - this.lastPrintX) >= CFG.footprintGapPx) {
      this.lastPrintX = this.body.x;
      this.stampFootprint(this.body.x);
    }
  }

  /** Huella con los dedos apuntando al revés de la carrera. */
  private stampFootprint(x: number): void {
    const print = this.footprints[this.nextPrint];
    this.nextPrint = (this.nextPrint + 1) % this.footprints.length;
    const side = toeSide(this.runDir, true);
    const y = this.ctx.floorY - 1;
    this.scene.tweens.killTweensOf([print.sole, print.toe]);
    print.sole.setPosition(x, y).setVisible(true).setAlpha(0.9);
    print.toe.setPosition(x + side * 4, y - 1).setVisible(true).setAlpha(0.9);
    this.scene.tweens.add({
      targets: [print.sole, print.toe],
      alpha: 0,
      duration: CFG.footprintFadeMs,
      onComplete: () => {
        print.sole.setVisible(false);
        print.toe.setVisible(false);
      },
    });
  }

  private updateWaves(deltaMs: number): void {
    const arena = this.ctx.arena;
    const dt = deltaMs / 1000;
    for (const w of this.waves) {
      if (w.lifeMs <= 0) continue;
      w.lifeMs -= deltaMs;
      w.rect.x += w.vx * dt;
      // Las hojas se levantan y bajan al avanzar.
      w.rect.scaleY = 0.8 + 0.2 * Math.sin(w.lifeMs / 60);
      if (w.lifeMs <= 0 || w.rect.x < arena.left || w.rect.x > arena.right) {
        w.lifeMs = 0;
        w.rect.setVisible(false);
      }
    }
  }

  protected resetVisuals(): void {
    for (const timer of this.timers) timer.remove();
    this.timers.length = 0;
    this.stopMove();
    this.scene.tweens.killTweensOf(this.body);
    this.harmful = false;
    this.printing = false;
    this.blinkMs = 0;
    this.spot = 2;
    this.facing = -1;
    this.body.setPosition(this.spotX(this.spot), this.ctx.floorY).setAlpha(0).setScale(1).clearTint().setTintMode(Phaser.TintModes.MULTIPLY);
    for (const c of this.copies) {
      c.alive = false;
      this.scene.tweens.killTweensOf(c.image);
      c.image.setVisible(false);
    }
    this.hideWaves();
    for (const f of this.footprints) {
      this.scene.tweens.killTweensOf([f.sole, f.toe]);
      f.sole.setVisible(false);
      f.toe.setVisible(false);
    }
  }

  private hideWaves(): void {
    for (const w of this.waves) {
      w.lifeMs = 0;
      w.rect.setVisible(false);
    }
  }

  /** Estirado (silbido), agachado (pisotón) o normal. */
  private pose(scaleY: number): void {
    this.scene.tweens.add({ targets: this.body, scaleY, duration: 150, ease: 'Quad.easeOut' });
  }

  private faceKerana(): void {
    this.facing = this.ctx.playerX() >= this.body.x ? 1 : -1;
  }

  private awayFromKerana(x: number): 1 | -1 {
    return this.ctx.playerX() >= x ? -1 : 1;
  }

  private spotX(i: number): number {
    return this.ctx.arena.left + CFG.floorSpots[i] * TILE + TILE / 2;
  }

  private boundsAt(x: number, out: Phaser.Geom.Rectangle): Phaser.Geom.Rectangle {
    return out.setTo(x - CFG.width / 2, this.ctx.floorY - CFG.height, CFG.width, CFG.height);
  }

  private flash(): void {
    this.body.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
    this.scene.time.delayedCall(GAMEPLAY.boss.hitFlashMs, () => this.body.clearTint().setTintMode(Phaser.TintModes.MULTIPLY));
  }
}
