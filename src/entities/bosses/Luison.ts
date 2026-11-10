import Phaser from 'phaser';
import { GAMEPLAY } from '../../config/gameplay';
import { getBossDef } from '../../data/bosses';
import { arcVelocity } from '../enemies/ThrowerMotor';
import { skinIfAvailable, spriteDetail, type SpriteSkin } from '../../systems/SpriteSkin';
import { Boss, type BossContext } from './Boss';
import type { BossTransition } from './BossBrain';
import { chainStepAt, chargeDir, eyeGlowAlpha, eyeOffset, farthestIndex, howlBlacksOut, type ChainStep } from './luisonLogic';

const CFG = GAMEPLAY.luison;
const SPRITE_CFG = GAMEPLAY.sprites.luison;
const TILE = 16;
const TEXTURE = 'luison_placeholder';
const DUST_COLOR = 0x8a7a66;
const BONE_TEXTURE = 'luison_bone';
/** El hueso se dibuja al doble y se achica a la mitad: con el zoom 2 de la vista queda nítido. */
const BONE_DETAIL = 2;
const SPRITE = 'luison';
/** Ojos del placeholder (sin sprite): hacia adelante y bajo la coronilla (px). */
const PLACEHOLDER_EYE_FORWARD = 8;
const PLACEHOLDER_EYE_DROP = 5;
const TOMB_COLOR = 0x8e8e96;
const TAU_COLOR = 0x2a1438;
const LEAP_PEAK = 28;
const CLOD_POOL = 6;

type Spot = 'floor' | 'roof' | 'tomb';

interface Clod {
  img: Phaser.GameObjects.Image;
  vx: number;
  vy: number;
  active: boolean;
}

/** El hombre lobo (placeholder por código): pelaje oscuro, hocico y orejas. Mira a la derecha. */
function ensureTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists(TEXTURE)) return;
  const w = CFG.width;
  const h = CFG.height;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  g.fillStyle(0x3b3440).fillRoundedRect(3, 10, w - 8, h - 16, 5); // torso
  g.fillStyle(0x4a4252).fillRoundedRect(6, 0, 14, 12, 3); // cabeza
  g.fillStyle(0x4a4252).fillRect(18, 5, 6, 5); // hocico
  g.fillStyle(0x3b3440).fillTriangle(7, 2, 9, -4, 12, 2).fillTriangle(13, 2, 15, -4, 18, 2); // orejas
  g.fillStyle(0xf2eee3).fillRect(21, 9, 1, 2).fillRect(23, 9, 1, 2); // colmillos
  g.fillStyle(0x6a2e8f).fillCircle(w / 2 - 2, 18, 3); // marca de Tau
  g.fillStyle(0x2c2630).fillRect(5, h - 7, 5, 7).fillRect(w - 12, h - 7, 5, 7); // patas
  g.generateTexture(TEXTURE, w, h);
  g.destroy();
}

/** El hueso que tira (S89, por código): caña con dos nudos en cada punta, crema con un borde oscuro fino. Horizontal. */
function ensureBoneTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists(BONE_TEXTURE)) return;
  const k = BONE_DETAIL;
  const len = CFG.boneLengthPx * k;
  const knob = CFG.boneKnobRadius * k;
  const shaft = CFG.boneShaftPx * k;
  const edge = 1; // borde: 1 px de textura (medio px del mundo)
  const h = Math.ceil(knob * 3.6) + edge * 2;
  const w = len + edge * 2;
  const cy = h / 2;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  const draw = (grow: number): void => {
    g.fillRect(edge + knob - grow, cy - shaft / 2 - grow, len - knob * 2 + grow * 2, shaft + grow * 2);
    for (const x of [edge + knob, edge + len - knob]) {
      g.fillCircle(x, cy - knob * 0.8, knob + grow);
      g.fillCircle(x, cy + knob * 0.8, knob + grow);
    }
  };
  g.fillStyle(CFG.boneOutlineColor);
  draw(edge);
  g.fillStyle(CFG.boneColor);
  draw(0);
  g.generateTexture(BONE_TEXTURE, w, h);
  g.destroy();
}

// Luisón (GDD §6.7): señor de la noche y los camposantos. Fase 1: huesos desde los techos y aullido
// sobre la lápida (llama póra). Fase 2 (luna llena): crece, apaga las luces y embiste desde la oscuridad.
// Fase 3: la sombra de Tau lo mueve como a un títere y encadena embestida, huesos y póra.
export class Luison extends Boss {
  private readonly body: Phaser.GameObjects.Image;
  private readonly skin?: SpriteSkin;
  /** Ojos en la oscuridad (S89): por cada ojo, el brillo y el punto. Solo se ven en el apagón (ver `updateEyes`). */
  private readonly eyeGlows: Phaser.GameObjects.Arc[] = [];
  private readonly eyeDots: Phaser.GameObjects.Rectangle[] = [];
  /** Lo que mueven los tweens: `fade` (presentación y liberación) y `pulse` (aviso de la embestida). */
  private readonly eyeFx = { fade: 1, pulse: 1 };
  private readonly eyePos = { forward: 0, rise: 0 };
  /** El apagón está puesto (lo pone y lo saca Luisón: fase 2 en adelante). */
  private blackout = false;
  private readonly arm: Phaser.GameObjects.Rectangle;
  private readonly tauShadow: Phaser.GameObjects.Ellipse;
  private readonly dust: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly clods: Clod[] = [];
  private readonly timers: Phaser.Time.TimerEvent[] = [];
  private readonly bodyRect = new Phaser.Geom.Rectangle();
  private readonly clodRect = new Phaser.Geom.Rectangle();
  private readonly aim = { vx: 0, vy: 0 };
  private facing: 1 | -1 = -1;
  private harmful = false;
  private spot: Spot = 'tomb';
  private speedScale = 1;
  /** Fase cuyos efectos (crecer, apagón, sombra de Tau) ya se aplicaron. */
  private appliedPhase = 0;
  private moveTween?: Phaser.Tweens.Tween;
  /** Cadena de la fase 3: tiempo dentro del ataque y paso actual. */
  private chainTotalMs = 0;
  private chainMs = 0;
  private chainStep?: ChainStep;

  constructor(scene: Phaser.Scene, ctx: BossContext) {
    super(scene, getBossDef('luison'), ctx);
    ensureTexture(scene);
    scene.add.rectangle(this.tombX(), ctx.floorY, 12, CFG.tombHeight, TOMB_COLOR).setOrigin(0.5, 1).setDepth(1);
    scene.add.rectangle(this.tombX(), ctx.floorY - CFG.tombHeight + 5, 8, 2, 0x6e6e76).setDepth(1);
    this.tauShadow = ctx.glow(scene.add.ellipse(0, 0, CFG.width + CFG.tauShadowPadPx * 2, CFG.height * 2, TAU_COLOR, 1).setDepth(4).setVisible(false));
    this.body = scene.add.image(0, ctx.floorY, TEXTURE).setOrigin(0.5, 1).setDepth(5);
    this.skin = skinIfAvailable(scene, this.body, SPRITE, { sourceFacesRight: true });
    this.arm = scene.add.rectangle(0, 0, 12, 3, 0x4a4252).setOrigin(0, 0.5).setDepth(6).setVisible(false);
    for (let i = 0; i < 2; i++) {
      this.eyeGlows.push(ctx.glow(scene.add.circle(0, 0, CFG.eyeGlowRadius, CFG.eyeColor, CFG.eyeGlowAlpha).setDepth(7).setVisible(false)));
      this.eyeDots.push(ctx.glow(scene.add.rectangle(0, 0, CFG.eyeDotPx, CFG.eyeDotPx, CFG.eyeColor).setDepth(7).setVisible(false)));
    }
    ensureBoneTexture(scene);
    for (let i = 0; i < CLOD_POOL; i++) {
      const img = ctx.glow(scene.add.image(0, 0, BONE_TEXTURE).setScale(1 / BONE_DETAIL).setDepth(8).setVisible(false));
      this.clods.push({ img, vx: 0, vy: 0, active: false });
    }
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
    // Aparece sobre la lápida y aúlla a la luna.
    this.scene.tweens.add({ targets: this.body, alpha: 1, duration: 600 });
    this.timers.push(
      this.scene.time.delayedCall(700, () => {
        this.faceKerana();
        this.ctx.sfxAt('howl', this.body.x);
        this.ctx.shake(250, 0.006);
      }),
      this.scene.time.delayedCall(1600, onDone),
    );
  }

  // ── Ataques ───────────────────────────────────────────────────────────────

  protected onTransition(t: BossTransition): void {
    const id = t.attack?.id ?? '';
    switch (t.state) {
      case 'telegraph':
        this.telegraph(id, t.ms);
        break;
      case 'active':
        this.activate(id, t.attack!.activeMs);
        break;
      case 'recover':
        this.harmful = false;
        this.chainStep = undefined;
        this.arm.setVisible(false);
        this.body.setAlpha(1);
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
    this.chainStep = undefined;
    this.arm.setVisible(false);
    this.body.setAlpha(1);
    // En la fase 1 anda entre las tumbas; desde la 2 baja al suelo y acecha.
    const idleMs = this.brain.phaseDef.idleMs;
    if (this.spot !== 'floor') this.leapTo(this.clampFloor(this.body.x), this.ctx.floorY, 'floor', Math.min(CFG.leapMs, idleMs));
    else this.walkTowardKerana(idleMs);
  }

  private telegraph(id: string, telegraphMs: number): void {
    switch (id) {
      case 'clods': {
        // Salta al techo más lejano y gira el brazo.
        const roofs = CFG.roofTiles.map((tile) => this.tileX(tile));
        const roof = roofs[farthestIndex(this.ctx.playerX(), roofs)];
        this.leapTo(roof, this.roofY(), 'roof', Math.min(CFG.leapMs, telegraphMs * 0.6), () => this.spinArm(telegraphMs * 0.4));
        this.ctx.sfxAt('growl', this.body.x);
        break;
      }
      case 'howl':
        // Trepa a la lápida.
        this.leapTo(this.tombX(), this.ctx.floorY - CFG.tombHeight, 'tomb', Math.min(CFG.leapMs * 1.5, telegraphMs * 0.8));
        break;
      case 'charge':
      case 'chain':
        // Dos ojos brillantes y un gruñido; desde la luna llena, el cuerpo se pierde en la oscuridad.
        if (this.spot !== 'floor') this.leapTo(this.clampFloor(this.body.x), this.ctx.floorY, 'floor', Math.min(CFG.leapMs, telegraphMs * 0.5));
        else this.stopMove();
        this.faceKerana();
        this.ctx.sfxAt('growl', this.body.x);
        if (this.brain.phase >= 1) this.body.setAlpha(0.35);
        this.eyeFx.pulse = 1;
        this.scene.tweens.add({ targets: this.eyeFx, pulse: CFG.eyePulseScale, duration: 150, yoyo: true, repeat: 1 });
        break;
    }
  }

  private activate(id: string, activeMs: number): void {
    switch (id) {
      case 'clods':
        this.throwClods();
        break;
      case 'howl':
        this.howl();
        break;
      case 'charge':
        this.chargeAcross(activeMs);
        break;
      case 'chain':
        this.chainTotalMs = activeMs;
        this.chainMs = 0;
        this.chainStep = undefined;
        this.stepChain(0);
        break;
    }
  }

  /** Cadena de la fase 3: embestida, huesos y póra, en tercios del ataque. */
  private stepChain(deltaMs: number): void {
    this.chainMs += deltaMs;
    const step = chainStepAt(this.chainMs, this.chainTotalMs);
    if (step === this.chainStep) return;
    this.chainStep = step;
    const part = this.chainTotalMs / 3;
    if (step === 'charge') this.chargeAcross(part);
    else if (step === 'clods') {
      this.harmful = false;
      this.body.setAlpha(1);
      this.faceKerana();
      this.throwClods();
    } else this.callPora();
  }

  private howl(): void {
    this.ctx.sfxAt('howl', this.body.x);
    this.ctx.shake(200, 0.006);
    // Desde la luna llena, el aullido apaga las luces de la arena.
    if (howlBlacksOut(this.brain.phase)) this.setBlackout(true);
    this.callPora();
  }

  private callPora(): void {
    const arena = this.ctx.arena;
    const y = this.ctx.floorY - TILE * 3;
    const edges = [arena.left + TILE * 3, arena.right - TILE * 3];
    for (let i = 0; i < CFG.poraPerHowl; i++) this.ctx.spawnMinion('pora', edges[i % 2], y, CFG.maxPora);
  }

  private throwClods(): void {
    this.arm.setVisible(false);
    for (let i = 0; i < CFG.clodsPerThrow; i++) {
      this.timers.push(this.scene.time.delayedCall((i * CFG.clodGapMs) / this.speedScale, () => this.throwClod(i)));
    }
  }

  private throwClod(i: number): void {
    const clod = this.clods.find((c) => !c.active);
    if (!clod) return;
    const x = this.body.x + this.facing * 8;
    const y = this.body.y - this.body.displayHeight * 0.8;
    // El primero va a Kerana; los otros caen un poco antes y un poco después.
    const spread = (i - (CFG.clodsPerThrow - 1) / 2) * TILE * 2;
    const tx = this.ctx.playerX() + (i === 0 ? 0 : spread);
    arcVelocity(tx - x, this.ctx.playerY() - 8 - y, CFG.clodFlightMs / this.speedScale, CFG.clodGravity, this.aim);
    clod.vx = this.aim.vx;
    clod.vy = this.aim.vy;
    clod.active = true;
    // Sale girando hacia donde vuela.
    clod.img.setPosition(x, y).setAngle(0).setVisible(true);
    this.ctx.sfx('throw');
  }

  private updateClods(deltaMs: number): void {
    const dt = deltaMs / 1000;
    for (const clod of this.clods) {
      if (!clod.active) continue;
      clod.vy += CFG.clodGravity * dt;
      clod.img.x += clod.vx * dt;
      clod.img.y += clod.vy * dt;
      clod.img.angle += Math.sign(clod.vx || 1) * CFG.boneSpinDegPerSec * dt;
      if (clod.img.y >= this.ctx.floorY || clod.img.y > this.ctx.arena.bottom) {
        this.dust.emitParticleAt(clod.img.x, this.ctx.floorY - 2, 4);
        this.hideClod(clod);
      }
    }
  }

  private hideClod(clod: Clod): void {
    clod.active = false;
    clod.img.setVisible(false);
  }

  /** Embiste en el suelo hacia Kerana, de mausoleo a mausoleo. */
  private chargeAcross(ms: number): void {
    this.harmful = true;
    this.faceKerana();
    const dir = chargeDir(this.body.x, this.ctx.playerX());
    const target = dir > 0 ? this.maxX() : this.minX();
    this.stopMove();
    this.ctx.sfxAt('grunt', this.body.x);
    this.moveTween = this.scene.tweens.add({
      targets: this.body,
      x: target,
      duration: Math.max(1, ms * 0.9),
      ease: 'Quad.easeIn',
      onUpdate: () => {
        if (Math.random() < 0.3) this.dust.emitParticleAt(this.body.x - this.facing * 8, this.ctx.floorY - 2, 1);
      },
    });
  }

  private spinArm(ms: number): void {
    this.arm.setVisible(true).setAngle(0);
    this.scene.tweens.add({ targets: this.arm, angle: -720, duration: Math.max(1, ms) });
  }

  /** Salto en arco a (x, pies en y). */
  private leapTo(x: number, feetY: number, spot: Spot, ms: number, onDone?: () => void): void {
    this.stopMove();
    this.facing = x >= this.body.x ? 1 : -1;
    const x0 = this.body.x;
    const y0 = this.body.y;
    this.spot = spot;
    this.moveTween = this.scene.tweens.addCounter({
      from: 0,
      to: 1,
      duration: Math.max(1, ms / this.speedScale),
      onUpdate: (tw) => {
        const k = tw.getValue() ?? 0;
        this.body.setPosition(x0 + (x - x0) * k, y0 + (feetY - y0) * k - Math.sin(Math.PI * k) * LEAP_PEAK);
      },
      onComplete: () => {
        this.body.setPosition(x, feetY);
        this.dust.emitParticleAt(x, feetY - 2, 5);
        onDone?.();
      },
    });
  }

  private walkTowardKerana(idleMs: number): void {
    const dir: 1 | -1 = this.ctx.playerX() >= this.body.x ? 1 : -1;
    const x = this.clampFloor(this.body.x + dir * CFG.walkSpeed * this.speedScale * (idleMs / 1000) * 0.8);
    this.facing = dir;
    this.stopMove();
    this.moveTween = this.scene.tweens.add({ targets: this.body, x, duration: Math.max(1, idleMs * 0.8), ease: 'Sine.easeInOut' });
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

  /** Efectos al entrar en cada fase (se revisa en cada frame: vale también si la fase cambia sin `tryHit`). */
  private enterPhase(phase: number): void {
    if (phase >= 1 && this.appliedPhase < 1) {
      // Luna llena: crece, gana velocidad y apaga las luces.
      this.speedScale = CFG.grownSpeedScale;
      this.scene.tweens.add({ targets: this.body, scale: CFG.grownScale, duration: 500, ease: 'Back.easeOut' });
      this.ctx.sfxAt('howl', this.body.x);
      this.ctx.shake(300, 0.008);
      this.setBlackout(true);
    }
    if (phase >= 2 && this.appliedPhase < 2) {
      // Aparece la sombra de Tau detrás.
      this.tauShadow.setVisible(true).setAlpha(0);
      this.scene.tweens.add({ targets: this.tauShadow, alpha: CFG.tauShadowAlpha, duration: 700 });
      this.ctx.sfx('laugh');
      this.ctx.shake(250, 0.008);
    }
    this.appliedPhase = phase;
  }

  protected override onDefeated(): void {
    // La liberación enciende las velas: los ojos brillantes ya no hacen falta.
    this.blackout = false;
    this.harmful = false;
    this.chainStep = undefined;
    this.stopMove();
    this.arm.setVisible(false);
    for (const clod of this.clods) this.hideClod(clod);
    this.scene.tweens.killTweensOf(this.body);
    this.body.setAlpha(1).clearTint().setTintMode(Phaser.TintModes.MULTIPLY);
    // La sombra de Tau se va.
    this.scene.tweens.add({ targets: this.tauShadow, alpha: 0, duration: 600 });
  }

  hurtsPlayer(playerRect: Phaser.Geom.Rectangle): boolean {
    for (const clod of this.clods) {
      if (!clod.active) continue;
      const r = CFG.clodRadius;
      if (Phaser.Geom.Rectangle.Overlaps(this.clodRect.setTo(clod.img.x - r, clod.img.y - r, r * 2, r * 2), playerRect)) {
        this.hideClod(clod);
        return true;
      }
    }
    return this.harmful && Phaser.Geom.Rectangle.Overlaps(this.bounds(this.bodyRect), playerRect);
  }

  markPosition(out: Phaser.Math.Vector2): Phaser.Math.Vector2 {
    return out.set(this.body.x, this.body.y - this.body.displayHeight / 2);
  }

  fadeOut(ms: number): void {
    this.scene.tweens.add({ targets: [this.body, this.tauShadow], alpha: 0, duration: ms });
    this.scene.tweens.add({ targets: this.eyeFx, fade: 0, duration: ms });
  }

  // ── Visual ────────────────────────────────────────────────────────────────

  protected updateVisuals(deltaMs: number): void {
    if (this.brain.phase !== this.appliedPhase && this.brain.state !== 'defeated') this.enterPhase(this.brain.phase);
    if (this.chainStep !== undefined && this.brain.state === 'active') this.stepChain(deltaMs);
    this.updateClods(deltaMs);
    this.body.setFlipX(this.facing < 0);
    const s = this.body.scaleX;
    this.updateEyes(s);
    this.arm.setPosition(this.body.x + this.facing * 4 * s, this.body.y - (CFG.height - 12) * s);
    if (this.tauShadow.visible) {
      // La sombra se mece detrás, como quien mueve un títere.
      const sway = Math.sin(this.scene.time.now / 500) * 6;
      this.tauShadow.setPosition(this.body.x - this.facing * 6 + sway, this.body.y - this.body.displayHeight * 0.75);
    }
  }

  /**
   * Ojos (S89). Alumbrado no se dibuja nada: el sprite ya tiene ojos. En el apagón, dos puntos con su brillo sobre el
   * ojo del sprite en el cuadro que se está mostrando (la hoja es de perfil: el segundo es el ojo de atrás, un poco
   * más adelante), del lado al que mira. Cerca de Kerana su halo lo alumbra y los puntos se apagan.
   */
  private updateEyes(scale: number): void {
    const pos = this.eyePos;
    let gap = 0;
    const sprite = this.skin?.sprite;
    const eyes = sprite ? SPRITE_CFG.eyes[sprite.anims.getName()] : undefined;
    if (sprite && eyes) {
      const i = Math.max(0, (sprite.anims.currentFrame?.index ?? 1) - 1) % eyes.length;
      const detail = spriteDetail(this.scene, SPRITE);
      eyeOffset(eyes[i], sprite.frame.width, sprite.frame.height, detail, pos);
      gap = SPRITE_CFG.eyeGapPx / detail;
    } else {
      pos.forward = PLACEHOLDER_EYE_FORWARD;
      pos.rise = CFG.height - PLACEHOLDER_EYE_DROP;
      gap = CFG.eyeGlowRadius;
    }
    const x = this.body.x + this.facing * pos.forward * scale;
    const y = this.body.y - pos.rise * scale;
    const dist = Math.hypot(x - this.ctx.playerX(), y - (this.ctx.playerY() - GAMEPLAY.player.bodyHeight / 2));
    const alpha = eyeGlowAlpha(this.blackout, dist, GAMEPLAY.darkness.haloRadius, CFG.eyeLitFadePx) * this.eyeFx.fade;
    const visible = alpha > 0.01;
    for (let i = 0; i < this.eyeDots.length; i++) {
      const ex = x + this.facing * gap * scale * i;
      this.eyeDots[i].setVisible(visible).setPosition(ex, y).setAlpha(alpha).setScale(this.eyeFx.pulse);
      this.eyeGlows[i].setVisible(visible).setPosition(ex, y).setAlpha(alpha).setScale(this.eyeFx.pulse);
    }
  }

  private setBlackout(on: boolean): void {
    this.blackout = on;
    this.ctx.setBlackout(on);
  }

  protected resetVisuals(): void {
    for (const timer of this.timers) timer.remove();
    this.timers.length = 0;
    this.stopMove();
    this.scene.tweens.killTweensOf([this.body, this.eyeFx, this.arm, this.tauShadow]);
    this.harmful = false;
    this.chainStep = undefined;
    this.speedScale = 1;
    this.appliedPhase = 0;
    this.facing = -1;
    this.spot = 'tomb';
    this.arm.setVisible(false);
    this.tauShadow.setVisible(false);
    for (const clod of this.clods) this.hideClod(clod);
    this.setBlackout(false);
    this.eyeFx.fade = 1;
    this.eyeFx.pulse = 1;
    for (const part of [...this.eyeDots, ...this.eyeGlows]) part.setVisible(false);
    this.body
      .setPosition(this.tombX(), this.ctx.floorY - CFG.tombHeight)
      .setAlpha(0)
      .setScale(1)
      .clearTint()
      .setTintMode(Phaser.TintModes.MULTIPLY);
  }

  private faceKerana(): void {
    this.facing = this.ctx.playerX() >= this.body.x ? 1 : -1;
  }

  private tileX(tiles: number): number {
    return this.ctx.arena.left + tiles * TILE;
  }

  private tombX(): number {
    return this.tileX(CFG.tombTile);
  }

  private roofY(): number {
    return this.ctx.floorY - CFG.roofHeightTiles * TILE;
  }

  private minX(): number {
    return this.tileX(CFG.floorTiles[0]) + CFG.edgeMarginPx + (CFG.width * this.body.scaleX) / 2;
  }

  private maxX(): number {
    return this.tileX(CFG.floorTiles[1]) - CFG.edgeMarginPx - (CFG.width * this.body.scaleX) / 2;
  }

  private clampFloor(x: number): number {
    return Phaser.Math.Clamp(x, this.minX(), this.maxX());
  }

  private bounds(out: Phaser.Geom.Rectangle): Phaser.Geom.Rectangle {
    const w = this.body.displayWidth;
    const h = this.body.displayHeight;
    return out.setTo(this.body.x - w / 2, this.body.y - h, w, h);
  }

  private flash(): void {
    this.body.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
    this.scene.time.delayedCall(GAMEPLAY.boss.hitFlashMs, () => this.body.clearTint().setTintMode(Phaser.TintModes.MULTIPLY));
  }
}
