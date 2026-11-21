import Phaser from 'phaser';
import { GAMEPLAY } from '../../config/gameplay';
import { SaveManager } from '../../systems/SaveManager';
import type { GuardState } from './GuardMotor';
import type { LaserBrain, RectLike } from './jaguaruLaser';
import { segmentEntry } from './jaguaruLaser';
import { paintAim, paintBeam, paintFlash, paintGlow, paintHalo, paintRing, paintSmoke, paintSpark } from './jaguaruLaserArt';
import type { RgbaImage } from '../waterfallArt';

const L = GAMEPLAY.jaguaru.laser;
const A = L.art;
const F = L.fx;
const DETAIL = A.detail;
const TEX = 1 / DETAIL;

/** Pone los píxeles en una textura de lienzo nueva (una sola vez por clave y por partida). */
function ensureTexture(scene: Phaser.Scene, key: string, paint: () => RgbaImage): string {
  if (scene.textures.exists(key)) return key;
  const img = paint();
  const tex = scene.textures.createCanvas(key, img.width, img.height);
  if (!tex) return key;
  const ctx = tex.getContext();
  const data = ctx.createImageData(img.width, img.height);
  data.data.set(img.data);
  ctx.putImageData(data, 0, 0);
  tex.refresh();
  return key;
}

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const clamp01 = (t: number): number => Math.max(0, Math.min(1, t));
const between = (r: readonly [number, number]): number => Phaser.Math.FloatBetween(r[0], r[1]);
/** Sin ojos a la vista (la hoja `idle`): una sola lista vacía, no una por cuadro. */
const NO_EYES: readonly (readonly [number, number])[] = [];

/** Una bocanada del pool. */
interface Puff {
  img: Phaser.GameObjects.Image;
  t: number;
  vx: number;
  vy: number;
  /** Tamaño y vida propios (cada bocanada distinta: no un collar de cuentas). */
  size: number;
  life: number;
}

/** Lo que el dibujo necesita del Jaguarú: dónde están sus pies y hacia dónde mira. */
export interface LaserOwner {
  x: number;
  y: number;
  facing: 1 | -1;
}

/**
 * El dibujo del rayo de un Jaguarú (S117). Aviso: los ojos se encienden con un brillo que crece, partículas que se
 * juntan en ellos y la mira, fina, tenue y titilante, de los ojos al punto fijado. Golpe: destello en los ojos y el
 * rayo (núcleo blanco caliente, cuerpo del color de los ojos, halo aditivo, bordes que vibran y chispas a lo largo) que
 * al final se afina y se apaga; donde se corta contra lo sólido, chispas, humo y un punto caliente; si le da a Kerana,
 * un estallido. Todo se crea una vez (texturas, pools y emisores): en cada cuadro solo se mueve y se muestra u oculta.
 * Respeta los destellos de Opciones: sin ellos, nada titila ni parpadea y el destello y el estallido son tenues.
 */
export class JaguaruLaserFx {
  private readonly eyes: Phaser.GameObjects.Image[] = [];
  private readonly face: Phaser.GameObjects.Image;
  private readonly aim: Phaser.GameObjects.TileSprite;
  private readonly beam: Phaser.GameObjects.TileSprite;
  private readonly halo: Phaser.GameObjects.TileSprite;
  private readonly flash: Phaser.GameObjects.Image;
  private readonly orb: Phaser.GameObjects.Image;
  private readonly hot: Phaser.GameObjects.Image;
  private readonly ring: Phaser.GameObjects.Image;
  private readonly burstFlash: Phaser.GameObjects.Image;
  private readonly puffs: Puff[] = [];
  private readonly gather: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly sparks: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly cutSparks: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly beamKeys: string[] = [];
  /** Lo que se ve solo mientras dispara y lo que se apaga al purificarse (listas armadas una vez). */
  private readonly beamParts: Phaser.GameObjects.Components.Visible[];
  private readonly allParts: Phaser.GameObjects.Components.Visible[];
  /** Centro de los ojos de la cara en el cuadro a la vista (de ahí sale la mira y ahí se juntan las partículas). */
  private gx = 0;
  private gy = 0;
  /** El rayo de este ciclo (copiado del cerebro al disparar). */
  private mx = 0;
  private my = 0;
  private ex = 0;
  private ey = 0;
  private sparkAngle = 0;
  private variant = 0;
  private vibrateMs = 0;
  private vibrateScale = 1;
  private flickerMs = 0;
  private flicker = 1;
  private gatherMs = 0;
  private sparkMs = 0;
  private cutMs = 0;
  private smokeMs = 0;
  private flashT = 1;
  private burstT = 1;
  private recoverFrom = 1;
  /** Abanico de las chispas que rebotan (grados a cada lado): el del corte, o todo alrededor en el estallido. */
  private spread: number = F.cutSpread;
  /** Reloj propio (ms): con el juego congelado, nada titila. */
  private clockMs = 0;

  constructor(
    scene: Phaser.Scene,
    private readonly owner: LaserOwner,
  ) {
    const glowKey = ensureTexture(scene, 'jaguaru_laser_glow', () => paintGlow(A));
    const flashKey = ensureTexture(scene, 'jaguaru_laser_flash', () => paintFlash(A));
    const ringKey = ensureTexture(scene, 'jaguaru_laser_ring', () => paintRing(A));
    const smokeKey = ensureTexture(scene, 'jaguaru_laser_smoke', () => paintSmoke(A));
    const sparkKey = ensureTexture(scene, 'jaguaru_laser_spark', () => paintSpark(2));
    const aimKey = ensureTexture(scene, 'jaguaru_laser_aim', () => paintAim(A));
    const haloKey = ensureTexture(scene, 'jaguaru_laser_halo', () => paintHalo(A));
    for (let i = 0; i < A.beamVariants; i++) this.beamKeys.push(ensureTexture(scene, `jaguaru_laser_beam_${i}`, () => paintBeam(A, i)));
    const D = F.depth;
    const add = Phaser.BlendModes.ADD;
    const maxEyes = Math.max(...A.eyes.map((e) => e.length));
    for (let i = 0; i < maxEyes; i++) this.eyes.push(scene.add.image(0, 0, glowKey).setBlendMode(add).setDepth(D).setVisible(false));
    this.face = scene.add.image(0, 0, glowKey).setBlendMode(add).setDepth(D).setVisible(false);
    // La mira y el rayo: tiras que se repiten a lo largo, con el origen en los ojos.
    this.aim = scene.add.tileSprite(0, 0, 8, 1, aimKey).setOrigin(0, 0.5).setScale(TEX).setDepth(D).setVisible(false);
    this.halo = scene.add.tileSprite(0, 0, 8, A.haloHeight, haloKey).setOrigin(0, 0.5).setBlendMode(add).setDepth(D).setVisible(false);
    this.beam = scene.add.tileSprite(0, 0, 8, A.beamHeight, this.beamKeys[0]).setOrigin(0, 0.5).setDepth(D + 0.1).setVisible(false);
    this.orb = scene.add.image(0, 0, glowKey).setBlendMode(add).setDepth(D + 0.2).setVisible(false);
    this.flash = scene.add.image(0, 0, flashKey).setBlendMode(add).setDepth(D + 0.3).setVisible(false);
    this.hot = scene.add.image(0, 0, glowKey).setBlendMode(add).setDepth(D + 0.2).setVisible(false);
    this.ring = scene.add.image(0, 0, ringKey).setBlendMode(add).setDepth(D + 0.3).setVisible(false);
    this.burstFlash = scene.add.image(0, 0, flashKey).setBlendMode(add).setDepth(D + 0.3).setVisible(false);
    for (let i = 0; i < F.smokePool; i++) {
      this.puffs.push({ img: scene.add.image(0, 0, smokeKey).setDepth(D + 0.15).setVisible(false), t: 1, vx: 0, vy: 0, size: 1, life: F.smokeLifeMs });
    }
    const R = A.ramp;
    // Se juntan en los ojos: nacen en un anillo alrededor y llegan al centro al final de su vida.
    this.gather = scene.add
      .particles(0, 0, sparkKey, {
        emitting: false,
        lifespan: { min: F.gatherLifeMs[0], max: F.gatherLifeMs[1] },
        moveToX: () => this.gx,
        moveToY: () => this.gy,
        scale: { start: TEX * 1.5, end: TEX * 0.6 },
        alpha: { start: 0.35, end: 1 },
        tint: [R[4], R[5], R[6], R[7]],
        blendMode: add,
        emitZone: {
          type: 'random',
          source: {
            getRandomPoint: (p: Phaser.Types.Math.Vector2Like) => {
              const a = Math.random() * Math.PI * 2;
              const r = between(F.gatherRadius);
              p.x = this.gx + Math.cos(a) * r;
              p.y = this.gy + Math.sin(a) * r;
            },
          },
        },
      })
      .setDepth(D + 0.2);
    // Chispas a lo largo del rayo: nacen en cualquier punto de la línea y se apartan un poco.
    this.sparks = scene.add
      .particles(0, 0, sparkKey, {
        emitting: false,
        lifespan: { min: F.sparkLifeMs[0], max: F.sparkLifeMs[1] },
        speed: { min: F.sparkSpeed[0], max: F.sparkSpeed[1] },
        angle: { min: 0, max: 360 },
        scale: { start: TEX, end: 0 },
        tint: [R[5], R[6], R[7]],
        blendMode: add,
        emitZone: {
          type: 'random',
          source: {
            getRandomPoint: (p: Phaser.Types.Math.Vector2Like) => {
              const t = Math.random();
              p.x = lerp(this.mx, this.ex, t);
              p.y = lerp(this.my, this.ey, t);
            },
          },
        },
      })
      .setDepth(D + 0.2);
    // Donde se corta: chispas que rebotan hacia atrás en abanico y caen; también el estallido sobre Kerana.
    this.cutSparks = scene.add
      .particles(0, 0, sparkKey, {
        emitting: false,
        lifespan: { min: F.cutLifeMs[0], max: F.cutLifeMs[1] },
        speed: { min: F.cutSpeed[0], max: F.cutSpeed[1] },
        angle: () => this.sparkAngle + Phaser.Math.FloatBetween(-this.spread, this.spread),
        gravityY: F.cutGravity,
        scale: { start: TEX * 1.5, end: TEX * 0.5 },
        tint: [R[4], R[5], R[6], R[7], 0xffffff],
        blendMode: add,
      })
      .setDepth(D + 0.2);
    this.beamParts = [this.beam, this.halo, this.orb, this.hot];
    this.allParts = [...this.eyes, this.face, this.aim, ...this.beamParts, this.flash, this.ring, this.burstFlash, ...this.puffs.map((p) => p.img)];
  }

  /**
   * Un paso del dibujo. `frame`: el cuadro de `attack` a la vista (null: la hoja `idle`, los ojos cerrados); `event`:
   * lo que devolvió el cerebro en este paso ('aim' al fijar la mira, 'fire' al disparar).
   */
  update(deltaMs: number, state: GuardState, progress: number, frame: number | null, brain: LaserBrain, event: 'aim' | 'fire' | null): void {
    const flashes = SaveManager.current.settings.flashes;
    this.clockMs += deltaMs;
    this.placeEyes(frame);
    if (event === 'fire') this.fire(brain, flashes);
    const charging = brain.aimed && state === 'telegraph';
    const firing = brain.aimed && state === 'active';
    // El brillo de los ojos: crece en el aviso, a pleno en el golpe, se apaga al cerrar los ojos.
    let glow = 0;
    if (charging) glow = progress;
    else if (firing) glow = 1;
    else if (state === 'recover' && this.recoverFrom > 0) glow = this.recoverFrom * clamp01(1 - progress / F.eyeFadeOut);
    if (state !== 'recover') this.recoverFrom = firing ? 1 : charging ? progress : 0;
    this.showEyes(frame, glow, flashes);
    this.updateAim(deltaMs, charging, progress, brain, flashes);
    this.updateGather(deltaMs, charging, progress);
    this.updateBeam(deltaMs, firing, progress, brain, flashes);
    this.updateFlashes(deltaMs, flashes);
    this.updateSmoke(deltaMs);
  }

  /** Estallido donde el rayo entra en Kerana. */
  burstOn(rect: RectLike): void {
    const t = segmentEntry(this.mx, this.my, this.ex, this.ey, rect, L.hitHalfWidth);
    const x = lerp(this.mx, this.ex, t);
    const y = lerp(this.my, this.ey, t);
    this.ring.setPosition(x, y).setVisible(true);
    this.burstFlash.setPosition(x, y).setVisible(true);
    this.burstT = 0;
    this.sparkAngle = Phaser.Math.RadToDeg(Math.atan2(this.my - this.ey, this.mx - this.ex));
    this.spread = 180;
    this.cutSparks.explode(F.burstSparks, x, y);
    this.spread = F.cutSpread;
  }

  /** Se apaga todo de una vez (al purificarse). */
  stop(): void {
    for (const o of this.allParts) o.setVisible(false);
    for (const p of this.puffs) p.t = 1;
    this.flashT = 1;
    this.burstT = 1;
    this.gather.stop();
    this.sparks.stop();
    this.cutSparks.stop();
  }

  destroy(): void {
    for (const e of this.eyes) e.destroy();
    for (const p of this.puffs) p.img.destroy();
    for (const o of [this.face, this.aim, this.beam, this.halo, this.orb, this.hot, this.flash, this.ring, this.burstFlash, this.gather, this.sparks, this.cutSparks]) o.destroy();
  }

  /** Un ojo del cuadro en el mundo: el cuadro mira a la izquierda; mirando a la derecha, el espejo. */
  private eyeX(px: number): number {
    return this.owner.x + this.owner.facing * ((A.frame[0] / 2 - px) / DETAIL);
  }

  private eyeY(py: number): number {
    return this.owner.y - (A.frame[1] - py) / DETAIL;
  }

  /** El centro de los ojos de la cara en el cuadro a la vista (en reposo, el del cuadro 0). */
  private placeEyes(frame: number | null): void {
    const f = frame ?? 0;
    const list = A.eyes[f];
    const n = A.faceEyes[f];
    let sx = 0;
    let sy = 0;
    for (let i = 0; i < n; i++) {
      sx += list[i][0];
      sy += list[i][1];
    }
    this.gx = this.eyeX(sx / n);
    this.gy = this.eyeY(sy / n);
  }

  private showEyes(frame: number | null, glow: number, flashes: boolean): void {
    const list = frame === null ? NO_EYES : A.eyes[frame];
    const on = glow > 0.01 && frame !== null;
    const pulse = flashes ? 1 + 0.08 * Math.sin((this.owner.x + this.clockMs / 1000) * F.eyePulseHz * Math.PI * 2) : 1;
    const scale = lerp(F.eyeScale[0], F.eyeScale[1], glow) * pulse * TEX;
    const alpha = lerp(F.eyeAlpha[0], F.eyeAlpha[1], glow);
    for (let i = 0; i < this.eyes.length; i++) {
      const img = this.eyes[i];
      if (!on || i >= list.length) {
        img.setVisible(false);
        continue;
      }
      img.setPosition(this.eyeX(list[i][0]), this.eyeY(list[i][1])).setScale(scale).setAlpha(alpha).setVisible(true);
    }
    this.face
      .setPosition(this.gx, this.gy)
      .setScale(lerp(F.faceScale[0], F.faceScale[1], glow) * TEX)
      .setAlpha(lerp(F.faceAlpha[0], F.faceAlpha[1], glow))
      .setVisible(on);
  }

  private updateAim(deltaMs: number, charging: boolean, progress: number, brain: LaserBrain, flashes: boolean): void {
    if (!charging) {
      this.aim.setVisible(false);
      return;
    }
    const dx = brain.ax - this.gx;
    const dy = brain.ay - this.gy;
    const len = Math.hypot(dx, dy);
    this.flickerMs -= deltaMs;
    if (this.flickerMs <= 0) {
      this.flickerMs = F.aimFlickerMs;
      this.flicker = flashes ? 1 - Math.random() * F.aimFlicker : 1;
    }
    let alpha = lerp(F.aimAlpha[0], F.aimAlpha[1], progress) * this.flicker;
    // Al final del aviso parpadea: ya viene.
    if (flashes && progress >= F.aimBlinkFrom && Math.floor(this.clockMs / F.aimBlinkMs) % 2 === 1) alpha *= 0.35;
    this.aim.tilePositionX -= (F.aimSpeed * DETAIL * deltaMs) / 1000;
    this.aim
      .setPosition(this.gx, this.gy)
      .setSize(Math.max(1, Math.round(len * DETAIL)), 1)
      .setRotation(Math.atan2(dy, dx))
      .setAlpha(alpha)
      .setVisible(true);
  }

  private updateGather(deltaMs: number, charging: boolean, progress: number): void {
    if (!charging) return;
    this.gatherMs -= deltaMs;
    const every = lerp(F.gatherEveryMs[0], F.gatherEveryMs[1], progress);
    while (this.gatherMs <= 0) {
      this.gatherMs += every;
      this.gather.emitParticle(1);
    }
  }

  /** Al empezar el golpe: copia el rayo, destello en los ojos y la primera variante. */
  private fire(brain: LaserBrain, flashes: boolean): void {
    this.mx = brain.mx;
    this.my = brain.my;
    this.ex = brain.ex;
    this.ey = brain.ey;
    this.flashT = 0;
    this.flash.setPosition(this.mx, this.my).setVisible(true).setAlpha(flashes ? 1 : F.calmFlashAlpha);
    this.vibrateMs = 0;
    this.sparkAngle = Phaser.Math.RadToDeg(Math.atan2(this.my - this.ey, this.mx - this.ex));
  }

  private updateBeam(deltaMs: number, firing: boolean, progress: number, brain: LaserBrain, flashes: boolean): void {
    if (!firing) {
      for (const o of this.beamParts) o.setVisible(false);
      return;
    }
    const dx = this.ex - this.mx;
    const dy = this.ey - this.my;
    const len = Math.hypot(dx, dy);
    const angle = Math.atan2(dy, dx);
    // Se ensancha de golpe, se sostiene y al final se afina y se apaga.
    const grow = progress < F.growUntil ? lerp(0.35, 1, progress / F.growUntil) : 1;
    const thin = progress > F.thinFrom ? clamp01((progress - F.thinFrom) / (1 - F.thinFrom)) : 0;
    const width = grow * lerp(1, F.thinTo, thin);
    const fade = 1 - thin * thin;
    // Se atenúa con la distancia: en el aire, a su largo máximo, se disipa.
    const far = fade * (1 - (F.farFade * len) / L.maxLength);
    // Los bordes vibran: otra variante y otro grosor cada `vibrateMs` (sin destellos, más despacio).
    this.vibrateMs -= deltaMs;
    if (this.vibrateMs <= 0) {
      this.vibrateMs = flashes ? F.vibrateMs : F.vibrateMs * 2;
      this.variant = (this.variant + 1 + Math.floor(Math.random() * (A.beamVariants - 1))) % A.beamVariants;
      this.vibrateScale = 1 + (Math.random() * 2 - 1) * F.vibrate;
      this.flicker = flashes ? 1 - Math.random() * F.haloFlicker : 1;
      this.beam.setTexture(this.beamKeys[this.variant]);
    }
    const w = Math.max(1, Math.round(len * DETAIL));
    this.beam.tilePositionX -= (F.flowSpeed * DETAIL * deltaMs) / 1000;
    this.beam
      .setPosition(this.mx, this.my)
      .setSize(w, A.beamHeight)
      .setRotation(angle)
      .setScale(TEX, TEX * width * this.vibrateScale)
      .setAlpha(fade, far, fade, far)
      .setVisible(true);
    this.halo
      .setPosition(this.mx, this.my)
      .setSize(w, A.haloHeight)
      .setRotation(angle)
      .setScale(TEX, TEX * width)
      .setAlpha(fade * this.flicker, far * this.flicker, fade * this.flicker, far * this.flicker)
      .setVisible(true);
    this.orb
      .setPosition(this.mx, this.my)
      .setScale(F.orbScale * TEX * (0.7 + 0.3 * width) * this.vibrateScale)
      .setAlpha(fade)
      .setVisible(true);
    // Chispas a lo largo.
    this.sparkMs -= deltaMs;
    while (this.sparkMs <= 0) {
      this.sparkMs += F.sparkEveryMs;
      if (fade > 0.3) this.sparks.emitParticle(1);
    }
    // Contra lo sólido: el punto caliente, las chispas que rebotan y el humo.
    if (!brain.cut) {
      this.hot.setVisible(false);
      return;
    }
    this.hot
      .setPosition(this.ex, this.ey)
      .setScale(F.hotScale * TEX * (0.6 + 0.4 * width) * this.vibrateScale)
      .setAlpha(fade)
      .setVisible(true);
    this.cutMs -= deltaMs;
    while (this.cutMs <= 0) {
      this.cutMs += F.cutEveryMs;
      if (fade > 0.3) this.cutSparks.emitParticle(1, this.ex, this.ey);
    }
    this.smokeMs -= deltaMs;
    while (this.smokeMs <= 0) {
      this.smokeMs += F.smokeEveryMs * between(F.smokeLife);
      this.puff(this.ex, this.ey);
    }
  }

  /** El destello de los ojos y el estallido sobre Kerana: crecen y se apagan. */
  private updateFlashes(deltaMs: number, flashes: boolean): void {
    if (this.flashT < 1) {
      this.flashT = Math.min(1, this.flashT + deltaMs / F.flashMs);
      const a = (flashes ? 1 : F.calmFlashAlpha) * (1 - this.flashT);
      this.flash.setScale(lerp(F.flashScale[0], F.flashScale[1], Math.sqrt(this.flashT)) * TEX).setAlpha(a);
      if (this.flashT >= 1) this.flash.setVisible(false);
    }
    if (this.burstT < 1) {
      this.burstT = Math.min(1, this.burstT + deltaMs / F.burstMs);
      const e = 1 - (1 - this.burstT) ** 3;
      const a = (flashes ? 1 : F.calmFlashAlpha) * (1 - this.burstT);
      this.ring.setScale(lerp(F.burstScale[0], F.burstScale[1], e) * TEX).setAlpha(a);
      // Sin destellos, el estallido es solo el anillo tenue y las chispas.
      this.burstFlash.setScale(lerp(F.flashScale[0], F.flashScale[1], e) * TEX).setAlpha(flashes ? a : 0);
      if (this.burstT >= 1) {
        this.ring.setVisible(false);
        this.burstFlash.setVisible(false);
      }
    }
  }

  /** Una bocanada nueva (la más vieja del pool, si están todas en uso). */
  private puff(x: number, y: number): void {
    let p = this.puffs[0];
    for (const q of this.puffs) if (q.t > p.t) p = q;
    p.t = 0;
    // Sube y se aparta de la pared, hacia de donde vino el rayo.
    const back = Phaser.Math.DegToRad(this.sparkAngle);
    p.vx = Math.cos(back) * F.smokeDrift + (Math.random() * 2 - 1) * F.smokeDrift * 0.5;
    p.vy = -between(F.smokeRise);
    p.size = between(F.smokeSize);
    p.life = F.smokeLifeMs * between(F.smokeLife);
    const j = F.smokeJitter;
    p.img.setPosition(x + (Math.random() * 2 - 1) * j, y + (Math.random() * 2 - 1) * j).setVisible(true);
  }

  private updateSmoke(deltaMs: number): void {
    const dt = deltaMs / 1000;
    for (const p of this.puffs) {
      if (p.t >= 1) continue;
      p.t = Math.min(1, p.t + deltaMs / p.life);
      p.img.x += p.vx * dt;
      // Sube rápido al principio y se frena.
      p.img.y += p.vy * dt * (1 - p.t * 0.6);
      p.img.setScale(lerp(F.smokeGrow[0], F.smokeGrow[1], Math.sqrt(p.t)) * p.size * TEX).setAlpha((1 - p.t) * (1 - p.t * 0.3));
      if (p.t >= 1) p.img.setVisible(false);
    }
  }
}
