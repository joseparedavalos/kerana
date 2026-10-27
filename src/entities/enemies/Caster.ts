import Phaser from 'phaser';
import { hasArt } from '../../assets/art';
import { ART_DETAIL } from '../../assets/manifest';
import { GAMEPLAY } from '../../config/gameplay';
import type { EnemyDef } from '../../data/enemies';
import { AudioManager } from '../../systems/AudioManager';
import { spriteDetail } from '../../systems/SpriteSkin';
import { ensureSoftGlow } from '../../utils/softGlow';
import { EnemyBase } from './EnemyBase';
import { createPaye, launchPaye, lineClear, payeTouches, stepPaye, type Paye, type PayeConfig } from './payeLogic';
import { ThrowerMotor } from './ThrowerMotor';

const CFG = GAMEPLAY.payesero;
const PAYE_ART = 'piece_paye';

interface PayeSlot {
  paye: Paye;
  img: Phaser.GameObjects.Image | Phaser.GameObjects.Arc;
  /** Deshaciéndose en humo (ms que faltan): el lugar no se reusa hasta que termine. */
  puffMsLeft: number;
}

// Caster (S62, GDD §5.2 y §5.3): el payesero. Quieto, mira a Kerana y lanza payé, un proyectil que la sigue un rato.
// El ciclo (reposo → carga con aviso → lanza → espera) es el del Thrower y reusa su máquina de estados; lo propio es el
// proyectil (payeLogic.ts), el aura que avisa y la purificación de un humano.
export class Caster extends EnemyBase {
  /** Lo sólido para el payé: la escena lo conecta con la capa Ground (las plataformas de un sentido no lo frenan). */
  solidAt?: (x: number, y: number) => boolean;
  private readonly motor: ThrowerMotor;
  /** Alcance (px): fuera de él no carga. */
  private readonly range: number;
  private readonly slots: PayeSlot[] = [];
  private readonly payeCfg: PayeConfig & typeof CFG.paye = CFG.paye;
  private readonly aura?: Phaser.Filters.Glow;
  private auraStrength: number = CFG.aura.idleStrength;
  private chargeMs = 0;
  /** Mientras empuja la palma no gira (ms). */
  private castLockMs = 0;
  private targetX = 0;
  private targetY = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, def: EnemyDef, facing: 1 | -1 = -1) {
    super(scene, x, y, def, facing);
    this.range = def.detectRadius ?? CFG.range;
    this.motor = new ThrowerMotor({ detectRadius: this.range, windupMs: def.telegraphMs ?? CFG.chargeMs, cooldownMs: def.cooldownMs ?? CFG.cooldownMs });
    const art = hasArt(scene, PAYE_ART);
    for (let i = 0; i < (def.projectilePool ?? CFG.paye.pool); i++) {
      const img = art
        ? scene.add.image(0, 0, PAYE_ART).setOrigin(CFG.paye.coreX, 0.5).setScale(1 / ART_DETAIL)
        : scene.add.circle(0, 0, CFG.paye.fallbackRadius, CFG.paye.fallbackColor);
      this.slots.push({ paye: createPaye(), img: img.setDepth(7).setVisible(false), puffMsLeft: 0 });
    }
    // El aura va sobre lo que se ve: el sprite si está, el placeholder si no.
    const look = this.skin?.sprite ?? this;
    look.enableFilters();
    this.aura = look.filters?.internal.addGlow(CFG.aura.color, this.auraStrength, 0, this.skin ? spriteDetail(scene, def.look ?? def.id) : 1);
  }

  updateBehavior(deltaMs: number, dx: number, dy: number): void {
    this.body.setVelocityX(0);
    this.targetX = this.x + dx;
    this.targetY = this.y + dy - CFG.targetLift;
    this.castLockMs = Math.max(0, this.castLockMs - deltaMs);
    // Gira para mirarla cuando le pasa al otro lado: así no se lo golpea por la espalda sin riesgo.
    if (this.castLockMs <= 0 && Math.abs(dx) <= CFG.watchRadius && Math.abs(dy) <= CFG.watchRadius && dx !== 0) this.facing = dx > 0 ? 1 : -1;
    // Fuera de alcance o sin camino libre desde la mano (roca de por medio), no carga.
    const distance = Math.hypot(dx, dy - CFG.targetLift);
    const open = distance <= this.range && this.clearShot();
    const was = this.motor.state;
    const fired = this.motor.step(deltaMs, open ? distance : Infinity);
    if (was !== 'windup' && this.motor.state === 'windup') this.startCharge();
    if (fired) this.cast();
    this.chargeMs = this.motor.state === 'windup' ? this.chargeMs + deltaMs : 0;
    this.updateAura(deltaMs);
  }

  private clearShot(): boolean {
    if (!this.solidAt) return true;
    const hx = this.x + this.facing * CFG.hand.forward;
    return lineClear(hx, this.y - CFG.hand.rise, this.targetX, this.targetY, CFG.losStep, this.solidAt);
  }

  private startCharge(): void {
    this.playAnim('charge');
    if (this.def.warnSfx) AudioManager.play(this.def.warnSfx);
  }

  private cast(): void {
    this.playAnim('cast', 'idle');
    this.castLockMs = this.skin?.sprite.anims.currentAnim?.duration ?? 0;
    const slot = this.slots.find((s) => !s.paye.alive && s.puffMsLeft <= 0);
    if (!slot) return;
    // Sale de la punta de la mano, no del pecho: ahí el sprite ya tiene dibujada su esfera.
    const hx = this.x + this.facing * CFG.hand.forward;
    const hy = this.y - CFG.hand.rise;
    launchPaye(slot.paye, hx, hy, this.targetX, this.targetY);
    slot.img.setPosition(hx, hy).setAlpha(1).setScale(this.payeScale).setVisible(true);
    if (this.def.castSfx) AudioManager.play(this.def.castSfx);
  }

  /** Animación `<sprite>_<name>` (charge, cast, idle); `then`, la que sigue al terminar. */
  private playAnim(name: string, then?: string): void {
    const sprite = this.skin?.sprite;
    const look = this.def.look ?? this.def.id;
    if (!sprite || !this.scene.anims.exists(`${look}_${name}`)) return;
    sprite.play(`${look}_${name}`);
    if (then) sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => this.purified || sprite.play(`${look}_${then}`));
  }

  /** Tenue en reposo; sube con un latido mientras carga (el aviso); vuelve al reposo después de lanzar. */
  private updateAura(deltaMs: number): void {
    const a = CFG.aura;
    if (this.motor.state === 'windup') {
      const t = Math.min(1, this.chargeMs / (this.def.telegraphMs ?? CFG.chargeMs));
      const pulse = 1 + a.chargePulse * Math.sin((this.chargeMs / 1000) * a.chargePulseHz * Math.PI * 2);
      this.auraStrength = (a.idleStrength + (a.chargeStrength - a.idleStrength) * t) * pulse;
    } else {
      const step = ((a.chargeStrength - a.idleStrength) * deltaMs) / a.settleMs;
      this.auraStrength = Math.max(a.idleStrength, this.auraStrength - step);
    }
    if (this.aura) this.aura.outerStrength = this.auraStrength;
  }

  /** Fuerza del aura ahora (para el smoke y las capturas). */
  get auraLevel(): number {
    return this.auraStrength;
  }

  private get payeScale(): number {
    return this.slots[0]?.img instanceof Phaser.GameObjects.Image ? 1 / ART_DETAIL : 1;
  }

  override preUpdate(time: number, delta: number): void {
    super.preUpdate(time, delta);
    // Los payé siguen volando aunque el payesero no actualice su comportamiento.
    for (const s of this.slots) {
      if (s.puffMsLeft > 0) {
        s.puffMsLeft -= delta;
        const k = Math.max(0, s.puffMsLeft / this.payeCfg.puffMs);
        s.img.setAlpha(k).setScale(this.payeScale * (2 - k));
        if (s.puffMsLeft <= 0) s.img.setVisible(false);
        continue;
      }
      if (!s.paye.alive) continue;
      stepPaye(s.paye, delta, this.targetX, this.targetY, this.payeCfg);
      s.img.setPosition(s.paye.x, s.paye.y);
      // El arte mira a la izquierda: la cabeza del cometa va hacia donde vuela.
      if (s.img instanceof Phaser.GameObjects.Image) s.img.setRotation(s.paye.heading + Math.PI);
      if (!s.paye.alive || this.solidAt?.(s.paye.x, s.paye.y)) this.dissolve(s);
    }
  }

  /** Se deshace en humo (cortado, contra una pared o al caducar). */
  private dissolve(s: PayeSlot): void {
    s.paye.alive = false;
    s.puffMsLeft = this.payeCfg.puffMs;
  }

  override projectileHits(rect: Phaser.Geom.Rectangle): boolean {
    for (const s of this.slots) {
      if (!payeTouches(s.paye, this.payeCfg.hitRadius, rect)) continue;
      this.dissolve(s);
      return true;
    }
    return false;
  }

  override cutProjectiles(rect: Phaser.Geom.Rectangle): boolean {
    let cut = false;
    for (const s of this.slots) {
      if (!payeTouches(s.paye, this.payeCfg.cutRadius, rect)) continue;
      this.dissolve(s);
      cut = true;
    }
    return cut;
  }

  /** Payé en el aire (para el smoke y las capturas). */
  get payes(): readonly Paye[] {
    return this.slots.map((s) => s.paye);
  }

  /**
   * Purificar a un humano (GDD §4.1): humo violeta que sube, destello cálido, el aura se apaga y se desvanece. Sin
   * chispas ni agrandarse: es una persona que queda libre, no un animal que huye ni algo que se disuelve.
   */
  protected override purifyEffect(): void {
    const p = CFG.purify;
    for (const s of this.slots) if (s.paye.alive) this.dissolve(s);
    this.playAnim('idle');
    const scene = this.scene;
    const w = this.def.width;
    const h = this.def.height;
    const depth = (this.skin?.sprite.depth ?? this.depth) + 1;
    // Humo: bocanadas de borde suave (un círculo lleno se lee como burbujas).
    const smoke = ensureSoftGlow(scene, p.softSize, p.smokeColor);
    for (let i = 0; i < p.smokeCount; i++) {
      const puff = scene.add
        .image(this.x + Phaser.Math.FloatBetween(-w / 2, w / 2), this.y - Phaser.Math.FloatBetween(h * 0.1, h * 0.9), smoke)
        .setDisplaySize(p.smokeSize, p.smokeSize)
        .setAlpha(p.smokeAlpha)
        .setDepth(depth);
      scene.tweens.add({
        targets: puff,
        y: puff.y - p.smokeRise * Phaser.Math.FloatBetween(0.7, 1.3),
        scale: puff.scale * p.smokeGrow,
        alpha: 0,
        delay: i * p.smokeStaggerMs,
        duration: p.smokeMs * Phaser.Math.FloatBetween(0.8, 1.2),
        ease: 'Sine.easeOut',
        onComplete: () => puff.destroy(),
      });
    }
    const flash = scene.add
      .image(this.x, this.y - h * 0.6, ensureSoftGlow(scene, p.softSize, p.flashColor))
      .setDisplaySize(p.flashSize, p.flashSize)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(depth);
    const full = flash.scale;
    flash.setScale(full * 0.2);
    scene.tweens.add({ targets: flash, scale: full, alpha: 0, duration: p.flashMs, ease: 'Cubic.easeOut', onComplete: () => flash.destroy() });
    // Destello cálido en la silueta (pisa el blanco del golpe) y vuelve a sus colores: quedó libre.
    this.setTint(p.flashColor).setTintMode(Phaser.TintModes.FILL);
    scene.time.delayedCall(p.flashMs, () => this.active && this.clearTint().setTintMode(Phaser.TintModes.MULTIPLY));
    scene.tweens.addCounter({
      from: this.auraStrength,
      to: 0,
      duration: p.auraOffMs,
      onUpdate: (tw) => {
        this.auraStrength = tw.getValue() ?? 0;
        if (this.aura) this.aura.outerStrength = this.auraStrength;
      },
    });
    scene.tweens.add({ targets: this, alpha: 0, delay: p.fadeDelayMs, duration: p.fadeMs, ease: 'Sine.easeIn', onComplete: () => this.destroy() });
  }

  override destroy(fromScene?: boolean): void {
    for (const s of this.slots) s.img.destroy();
    this.slots.length = 0;
    super.destroy(fromScene);
  }
}
