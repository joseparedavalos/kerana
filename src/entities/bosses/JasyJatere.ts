import Phaser from 'phaser';
import { GAMEPLAY } from '../../config/gameplay';
import { getBossDef } from '../../data/bosses';
import { FONT_FAMILY } from '../../config/fonts';
import { t } from '../../i18n';
import { skinIfAvailable } from '../../systems/SpriteSkin';
import { Boss, type BossContext } from './Boss';
import type { BossTransition } from './BossBrain';
import { lethalClamp, Reveal, StaffRace } from './jasyLogic';

const CFG = GAMEPLAY.jasyJatere;
const TILE = 16;
const BODY_TEXTURE = 'jasy_jatere_placeholder';
const STAFF_TEXTURE = 'jasy_staff_placeholder';
const NOTE_TEXTURE = 'fx_note';
const SPARK_COLOR = 0xf2c14e;
const FOOTPRINT_COLOR = 0xb5aa9c;
/** Tinte dorado del brillo tenue mientras es invisible. */
const FAINT_TINT = 0xfff0b0;
/** Chispas en vuelo a la vez (2 abanicos). */
const SPARK_POOL = CFG.sparks * 2;
const KERANA_W = GAMEPLAY.player.bodyWidth;
const KERANA_H = GAMEPLAY.player.bodyHeight;

interface Spark {
  arc: Phaser.GameObjects.Arc;
  vx: number;
  vy: number;
  lifeMs: number;
}

/** Niño rubio con sombrero de paja (placeholder por código) y su bastón de oro. */
function ensureTextures(scene: Phaser.Scene): void {
  if (!scene.textures.exists(BODY_TEXTURE)) {
    const w = CFG.width;
    const h = CFG.height;
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0xd8a878).fillRect(3, 8, w - 6, 8); // cara
    g.fillStyle(0xf2d04e).fillRect(2, 5, w - 4, 4); // pelo rubio
    g.fillStyle(0xc9a63a).fillRect(0, 3, w, 3).fillRect(3, 0, w - 6, 4); // sombrero de paja
    g.fillStyle(0x1b1a2e).fillRect(4, 11, 2, 2).fillRect(w - 6, 11, 2, 2); // ojos
    g.fillStyle(0xf2eee3).fillRect(2, 16, w - 4, 10); // camisa
    g.fillStyle(0x6a4a3a).fillRect(3, 26, w - 6, h - 26); // pantalón
    g.generateTexture(BODY_TEXTURE, w, h);
    g.destroy();
  }
  if (!scene.textures.exists(STAFF_TEXTURE)) {
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0xc9a63a).fillRect(2, 4, 2, CFG.staffHeight - 4);
    g.fillStyle(0xf2c14e).fillCircle(3, 3, 3);
    g.generateTexture(STAFF_TEXTURE, CFG.staffWidth, CFG.staffHeight);
    g.destroy();
  }
  if (!scene.textures.exists(NOTE_TEXTURE)) {
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0xffffff).fillEllipse(3, 8, 5, 4).fillRect(4, 1, 1, 7).fillRect(4, 1, 3, 2);
    g.generateTexture(NOTE_TEXTURE, 8, 10);
    g.destroy();
  }
}

// Jasy Jatere (GDD §6.4): el jefe más chico y escurridizo. Fase 1: salta entre techos y lanza chispas.
// Fases 2 y 3: invisible; lo delatan el silbido (paneo estéreo), notas, huellas y un brillo tenue.
// El golpe final le hace soltar el bastón: carrera por recuperarlo.
export class JasyJatere extends Boss {
  private readonly body: Phaser.GameObjects.Image;
  private readonly staff: Phaser.GameObjects.Image;
  private readonly notes: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly sparks: Spark[] = [];
  private readonly footprints: Phaser.GameObjects.Ellipse[] = [];
  private readonly timers: Phaser.Time.TimerEvent[] = [];
  private readonly race = new StaffRace();
  private readonly reveal = new Reveal();
  private readonly bodyRect = new Phaser.Geom.Rectangle();
  private readonly staffRect = new Phaser.Geom.Rectangle();
  private readonly keranaRect = new Phaser.Geom.Rectangle();
  private readonly hop = { p: 0, x0: 0, y0: 0, x1: 0, y1: 0, arc: 0 };
  private spot = 2;
  private facing: 1 | -1 = -1;
  private harmful = false;
  /** Bastón en alto (aviso de las chispas) o destello (aviso de la emboscada). */
  private staffRaised = false;
  private staffFlashMs = 0;
  /** El bastón está suelto (carrera). */
  private staffLoose = false;
  /** Hay sprite real: el bastón en la mano lo dibuja el sprite. */
  private readonly skinned: boolean;
  /** "¡!" sobre él cuando se le escapa el bastón. */
  private readonly surprise: Phaser.GameObjects.Text;
  private whistleMs = 0;
  private noteMs = 0;
  private lastPrintX = 0;
  private nextPrint = 0;

  constructor(scene: Phaser.Scene, ctx: BossContext) {
    super(scene, getBossDef('jasy_jatere'), ctx);
    ensureTextures(scene);
    for (let i = 0; i < CFG.footprintMax; i++) {
      this.footprints.push(scene.add.ellipse(0, ctx.floorY - 1, 5, 2, FOOTPRINT_COLOR, 0.8).setDepth(3).setVisible(false));
    }
    this.body = scene.add.image(0, 0, BODY_TEXTURE).setOrigin(0.5, 1).setDepth(5);
    this.staff = scene.add.image(0, 0, STAFF_TEXTURE).setDepth(6);
    // Sprite real (siempre con bastón): el de la mano se recorta cuando el bastón de código se ve aparte.
    const look = GAMEPLAY.sprites.jasyJatere;
    this.skinned = !!skinIfAvailable(scene, this.body, 'jasy_jatere', {
      hideColumns: () => (this.staffLoose || this.staffRaised || this.staffFlashMs > 0 ? look.staffColumns : null),
    });
    this.surprise = scene.add
      .text(0, 0, t('boss.jasy_jatere.surprise'), { fontFamily: FONT_FAMILY, fontSize: '12px', color: '#ffffff', stroke: '#1b1a2e', strokeThickness: 3, resolution: 2 })
      .setOrigin(0.5, 1)
      .setDepth(8)
      .setVisible(false);
    for (let i = 0; i < SPARK_POOL; i++) {
      const arc = scene.add.circle(0, 0, CFG.sparkRadius, SPARK_COLOR).setDepth(7).setVisible(false);
      this.sparks.push({ arc, vx: 0, vy: 0, lifeMs: 0 });
    }
    this.notes = scene.add.particles(0, 0, NOTE_TEXTURE, {
      speedY: { min: -30, max: -15 },
      speedX: { min: -12, max: 12 },
      lifespan: 1100,
      alpha: { start: 0.9, end: 0 },
      tint: [0xf2c14e, 0xf2eee3, 0xe06bd0],
      emitting: false,
    });
    this.notes.setDepth(8);
    this.resetVisuals();
  }

  // ── Presentación ──────────────────────────────────────────────────────────

  protected playIntro(onDone: () => void): void {
    // Aparece riéndose sobre la rama del lapacho y hace girar el bastón.
    this.placeAt(this.spot);
    this.scene.tweens.add({ targets: this.body, alpha: 1, duration: 500 });
    this.timers.push(
      this.scene.time.delayedCall(500, () => {
        this.ctx.sfx('laugh');
        this.notes.emitParticleAt(this.body.x, this.body.y - CFG.height, 4);
        this.staffFlashMs = 500;
      }),
      this.scene.time.delayedCall(1500, onDone),
    );
  }

  // ── Ataques ───────────────────────────────────────────────────────────────

  override update(deltaMs: number): void {
    if (this.race.active) {
      this.updateRace(deltaMs);
      this.updateVisuals(deltaMs);
      return;
    }
    super.update(deltaMs);
  }

  protected onTransition(t: BossTransition): void {
    const id = t.attack?.id ?? '';
    switch (t.state) {
      case 'telegraph':
        this.faceKerana();
        if (id === 'sparks') this.staffRaised = true;
        else if (id === 'ambush') {
          this.staffFlashMs = t.ms;
          this.ctx.sfxAt('staffFlash', this.body.x);
        } else this.ctx.sfxAt('buzz', this.body.x);
        break;
      case 'active':
        if (id === 'sparks') this.fireSparks();
        else if (id === 'ambush') this.ambush(t.attack!.activeMs);
        else this.ctx.spawnSwarm(this.body.x, this.body.y - CFG.height / 2);
        break;
      case 'recover':
        this.harmful = false;
        this.staffRaised = false;
        if (t.attack?.punishable ?? true) this.taunt();
        break;
      case 'idle':
        this.harmful = false;
        this.staffRaised = false;
        this.move(this.brain.phaseDef.idleMs);
        break;
      default:
        break;
    }
  }

  /** Tres chispas doradas en abanico hacia Kerana. */
  private fireSparks(): void {
    this.staffRaised = false;
    this.ctx.sfxAt('sparks', this.body.x);
    const sx = this.body.x + this.facing * 6;
    const sy = this.body.y - CFG.height;
    const base = Math.atan2(this.ctx.playerY() - KERANA_H / 2 - sy, this.ctx.playerX() - sx);
    const spread = Phaser.Math.DegToRad(CFG.sparkSpreadDeg);
    for (let i = 0; i < CFG.sparks; i++) {
      const spark = this.sparks.find((s) => s.lifeMs <= 0);
      if (!spark) break;
      const a = base + (i - (CFG.sparks - 1) / 2) * spread;
      spark.vx = Math.cos(a) * CFG.sparkSpeed;
      spark.vy = Math.sin(a) * CFG.sparkSpeed;
      spark.lifeMs = CFG.sparkLifeMs;
      spark.arc.setPosition(sx, sy).setVisible(true);
    }
  }

  /** Emboscada: corre (o salta) hasta pasar a Kerana. */
  private ambush(activeMs: number): void {
    this.harmful = true;
    const arena = this.ctx.arena;
    const px = this.ctx.playerX();
    const dir = px >= this.body.x ? 1 : -1;
    const x = Phaser.Math.Clamp(px + dir * CFG.ambushOvershoot, arena.left + TILE * 2, arena.right - TILE);
    this.facing = dir;
    this.jumpTo(x, this.ctx.floorY, activeMs, this.body.y < this.ctx.floorY - 1 ? CFG.hopArc / 2 : 0);
  }

  /** Ventana: se ríe, se burla y silba (pista aunque sea invisible). */
  private taunt(): void {
    this.ctx.sfxAt('laugh', this.body.x);
    this.notes.emitParticleAt(this.body.x, this.body.y - CFG.height, 3);
    this.scene.tweens.add({ targets: this.body, scaleY: 0.9, duration: 120, yoyo: true, repeat: 3 });
  }

  /** Entre ataques: salta a otro techo (fase 1) o se acerca a Kerana sin que lo vean (fases 2 y 3). */
  private move(idleMs: number): void {
    const spots = CFG.spots;
    if (this.brain.phase === 0 || Math.random() < 0.3) {
      let next = Phaser.Math.Between(0, spots.length - 2);
      if (next >= this.spot) next++;
      this.spot = next;
      this.jumpTo(this.spotX(next), this.spotY(next), Math.min(CFG.hopMs, idleMs), CFG.hopArc);
      return;
    }
    const arena = this.ctx.arena;
    const side = Math.random() < 0.5 ? -1 : 1;
    const x = Phaser.Math.Clamp(this.ctx.playerX() + side * CFG.ambushApproach, arena.left + TILE * 2, arena.right - TILE);
    const onFloor = this.body.y >= this.ctx.floorY - 1;
    this.jumpTo(x, this.ctx.floorY, Math.max(200, idleMs * 0.8), onFloor ? 0 : CFG.hopArc);
  }

  // ── Carrera por el bastón ─────────────────────────────────────────────────

  /** El bastón vuela al lugar más lejos de Kerana y gira; él corre a buscarlo. */
  private startRace(): void {
    this.harmful = false;
    this.staffRaised = false;
    this.hideSparks();
    this.reveal.show(CFG.raceMs + CFG.staffFlyMs);
    this.staffLoose = true;
    const px = this.ctx.playerX();
    let far = 0;
    for (let i = 1; i < CFG.spots.length; i++) if (Math.abs(this.spotX(i) - px) > Math.abs(this.spotX(far) - px)) far = i;
    const tx = this.spotX(far);
    const ty = this.spotY(far) - CFG.staffHeight / 2;
    this.scene.tweens.killTweensOf(this.staff);
    this.scene.tweens.add({ targets: this.staff, x: tx, duration: CFG.staffFlyMs, ease: 'Sine.easeOut' });
    this.scene.tweens.add({ targets: this.staff, y: Math.min(this.staff.y, ty) - 60, duration: CFG.staffFlyMs / 2, ease: 'Sine.easeOut', yoyo: false });
    this.scene.tweens.add({ targets: this.staff, y: ty, delay: CFG.staffFlyMs / 2, duration: CFG.staffFlyMs / 2, ease: 'Sine.easeIn' });
    this.ctx.sfx('staffSpin');
    this.ctx.shake(200, 0.006);
    this.race.start(CFG.raceMs);
    // Corre hacia el bastón: llega justo cuando se acaba la carrera.
    this.jumpTo(tx, this.spotY(far), CFG.raceMs, CFG.hopArc);
  }

  private updateRace(deltaMs: number): void {
    const px = this.ctx.playerX();
    const py = this.ctx.playerY();
    this.keranaRect.setTo(px - KERANA_W / 2, py - KERANA_H, KERANA_W, KERANA_H);
    const touches = Phaser.Geom.Rectangle.Overlaps(this.staffBounds(), this.keranaRect);
    const result = this.race.step(deltaMs, touches);
    if (result === 'kerana') {
      this.ctx.sfx('heartBack');
      this.defeatNow();
    } else if (result === 'jasy') {
      // Lo recuperó: vuelve a esconderse con 1 golpe más.
      this.staffLoose = false;
      this.scene.tweens.killTweensOf(this.staff);
      this.reveal.reset();
      this.staffFlashMs = 400;
      this.ctx.sfxAt('laugh', this.body.x);
      this.brain.interrupt();
    }
  }

  // ── Daño ──────────────────────────────────────────────────────────────────

  protected applyHit(rect: Phaser.Geom.Rectangle, damage: number): number {
    if (this.race.active || !this.brain.vulnerable) return 0;
    if (!Phaser.Geom.Rectangle.Overlaps(this.bounds(), rect)) return 0;
    const { applied, race } = lethalClamp(this.brain.hp, damage);
    this.reveal.show(CFG.revealMs);
    this.flash();
    this.ctx.sfx('bossHit');
    if (race) this.startRace();
    return applied;
  }

  protected override onPhaseChanged(phase: number): void {
    // Aprieta el bastón y se vuelve invisible (fase 2).
    if (phase === 1) {
      this.staffFlashMs = 600;
      this.ctx.sfx('staffFlash');
      this.ctx.shake(200, 0.006);
    }
  }

  protected override onDefeated(): void {
    this.race.reset();
    this.harmful = false;
    this.hideSparks();
    this.reveal.show(60000);
    this.body.setAlpha(1).clearTint();
  }

  hurtsPlayer(playerRect: Phaser.Geom.Rectangle): boolean {
    for (const s of this.sparks) {
      if (s.lifeMs <= 0 || !playerRect.contains(s.arc.x, s.arc.y)) continue;
      s.lifeMs = 0;
      s.arc.setVisible(false);
      return true;
    }
    return this.harmful && Phaser.Geom.Rectangle.Overlaps(this.bounds(), playerRect);
  }

  markPosition(out: Phaser.Math.Vector2): Phaser.Math.Vector2 {
    return out.set(this.body.x, this.body.y - CFG.height / 2);
  }

  fadeOut(ms: number): void {
    this.scene.tweens.add({ targets: [this.body, this.staff], alpha: 0, duration: ms });
  }

  // ── Visual ────────────────────────────────────────────────────────────────

  protected updateVisuals(deltaMs: number): void {
    this.reveal.step(deltaMs);
    this.updateSparks(deltaMs);
    const invisible = this.isInvisible();
    if (this.brain.state !== 'defeated' && this.body.alpha > 0) {
      this.body.setAlpha(invisible ? CFG.invisibleAlpha : 1);
      if (invisible) this.body.setTint(FAINT_TINT);
      else if (this.body.tintMode !== Phaser.TintModes.FILL) this.body.clearTint();
    }
    this.body.setFlipX(this.facing > 0);
    if (!this.staffLoose) {
      const lift = this.staffRaised ? 14 : 0;
      this.staff.setPosition(this.body.x + this.facing * (this.skinned ? 10 : 7), this.body.y - CFG.height / 2 - lift).setAngle(this.staffRaised ? this.facing * 20 : 0);
    } else {
      this.staff.angle += deltaMs * 0.9;
    }
    // Destello del bastón: se ve aunque él sea invisible (es el aviso de la emboscada).
    if (this.staffFlashMs > 0) {
      this.staffFlashMs -= deltaMs;
      const on = Math.floor(this.staffFlashMs / 70) % 2 === 0;
      this.staff.setAlpha(1).setTint(on ? 0xffffff : SPARK_COLOR).setTintMode(Phaser.TintModes.FILL);
    } else {
      this.staff.setTintMode(Phaser.TintModes.MULTIPLY).clearTint();
      const held = this.skinned ? 0 : this.body.alpha;
      this.staff.setAlpha(this.staffLoose || this.staffRaised ? 1 : held);
    }
    const surprised = this.skinned && this.staffLoose && this.brain.state !== 'defeated';
    this.surprise.setVisible(surprised);
    if (surprised) this.surprise.setPosition(this.body.x, this.body.y - CFG.height - GAMEPLAY.sprites.jasyJatere.surpriseOffsetY);
    if (invisible && this.brain.state !== 'waiting') this.updateClues(deltaMs);
  }

  /** Pistas de la fase invisible: silbido con paneo, notas y huellas de polvo en el suelo. */
  private updateClues(deltaMs: number): void {
    this.whistleMs -= deltaMs;
    if (this.whistleMs <= 0) {
      this.whistleMs = CFG.whistleEveryMs;
      this.ctx.sfxAt('whistle', this.body.x);
    }
    this.noteMs -= deltaMs;
    if (this.noteMs <= 0) {
      this.noteMs = CFG.noteEveryMs;
      this.notes.emitParticleAt(this.body.x, this.body.y - CFG.height, 1);
    }
    const onFloor = this.body.y >= this.ctx.floorY - 1;
    if (onFloor && Math.abs(this.body.x - this.lastPrintX) >= CFG.footprintGapPx) {
      this.lastPrintX = this.body.x;
      const print = this.footprints[this.nextPrint];
      this.nextPrint = (this.nextPrint + 1) % this.footprints.length;
      this.scene.tweens.killTweensOf(print);
      print.setPosition(this.body.x, this.ctx.floorY - 1).setVisible(true).setAlpha(0.8);
      this.scene.tweens.add({ targets: print, alpha: 0, duration: CFG.footprintFadeMs, onComplete: () => print.setVisible(false) });
    }
  }

  private updateSparks(deltaMs: number): void {
    const dt = deltaMs / 1000;
    for (const s of this.sparks) {
      if (s.lifeMs <= 0) continue;
      s.lifeMs -= deltaMs;
      s.arc.x += s.vx * dt;
      s.arc.y += s.vy * dt;
      if (s.lifeMs <= 0 || s.arc.y >= this.ctx.floorY) {
        s.lifeMs = 0;
        s.arc.setVisible(false);
      }
    }
  }

  protected resetVisuals(): void {
    for (const timer of this.timers) timer.remove();
    this.timers.length = 0;
    this.scene.tweens.killTweensOf([this.body, this.staff, this.hop]);
    this.race.reset();
    this.reveal.reset();
    this.harmful = false;
    this.staffRaised = false;
    this.staffLoose = false;
    this.staffFlashMs = 0;
    this.whistleMs = 0;
    this.noteMs = 0;
    this.spot = 2;
    this.placeAt(this.spot);
    this.body.setAlpha(0).setScale(1).clearTint().setTintMode(Phaser.TintModes.MULTIPLY);
    this.staff.setAlpha(0).setAngle(0);
    this.hideSparks();
    for (const f of this.footprints) f.setVisible(false);
  }

  /** Invisible en las fases 2 y 3, salvo un rato después de cada golpe y durante la carrera. */
  private isInvisible(): boolean {
    return this.brain.phase > 0 && !this.reveal.visible && !this.race.active && this.brain.state !== 'waiting';
  }

  private hideSparks(): void {
    for (const s of this.sparks) {
      s.lifeMs = 0;
      s.arc.setVisible(false);
    }
  }

  private faceKerana(): void {
    this.facing = this.ctx.playerX() >= this.body.x ? 1 : -1;
  }

  private placeAt(spot: number): void {
    this.scene.tweens.killTweensOf(this.hop);
    this.body.setPosition(this.spotX(spot), this.spotY(spot));
    this.lastPrintX = this.body.x;
  }

  /** Salta (o corre, con arc = 0) hasta (x, y de los pies). */
  private jumpTo(x: number, y: number, ms: number, arc: number): void {
    const h = this.hop;
    this.scene.tweens.killTweensOf(h);
    h.p = 0;
    h.x0 = this.body.x;
    h.y0 = this.body.y;
    h.x1 = x;
    h.y1 = y;
    h.arc = arc;
    if (x !== this.body.x) this.facing = x > this.body.x ? 1 : -1;
    this.scene.tweens.add({
      targets: h,
      p: 1,
      duration: ms,
      ease: arc > 0 ? 'Linear' : 'Sine.easeInOut',
      onUpdate: () => {
        this.body.x = h.x0 + (h.x1 - h.x0) * h.p;
        this.body.y = h.y0 + (h.y1 - h.y0) * h.p - h.arc * 4 * h.p * (1 - h.p);
      },
    });
  }

  private spotX(i: number): number {
    return this.ctx.arena.left + CFG.spots[i].tx * TILE;
  }

  private spotY(i: number): number {
    return this.ctx.floorY - CFG.spots[i].ty * TILE;
  }

  private bounds(): Phaser.Geom.Rectangle {
    return this.bodyRect.setTo(this.body.x - CFG.width / 2, this.body.y - CFG.height, CFG.width, CFG.height);
  }

  private staffBounds(): Phaser.Geom.Rectangle {
    const w = CFG.staffWidth + 6;
    const h = CFG.staffHeight;
    return this.staffRect.setTo(this.staff.x - w / 2, this.staff.y - h / 2, w, h);
  }

  private flash(): void {
    this.body.setAlpha(1).setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
    this.scene.time.delayedCall(GAMEPLAY.boss.hitFlashMs, () => this.body.clearTint().setTintMode(Phaser.TintModes.MULTIPLY));
  }
}
