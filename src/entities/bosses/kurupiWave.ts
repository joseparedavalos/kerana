import Phaser from 'phaser';
import { GAMEPLAY } from '../../config/gameplay';
import { uploadAtlas } from '../../systems/pixelArt';
import { KickMeter, kickHasLeaf } from './kurupiFxLogic';
import {
  clodFrameName,
  CLODS,
  COLLAPSE_FRAMES,
  collapseFrameName,
  CRACK,
  CRACK_DETAIL,
  CRACK_VARIANTS,
  crackFrameName,
  CREST_FRAMES,
  crestFrameName,
  crestSize,
  DUST_FRAMES,
  dustFrameName,
  LEAF_FLUTTER_FRAMES,
  LEAF_FLUTTERS,
  leafFrameName,
  rootFrameName,
  ROOTS,
  WAVE_DETAIL,
  waveFrames,
} from './kurupiWaveArt';
import { crackStage, loopFrame, stepWave, waveBox, type Box, type WaveMotion } from './kurupiWaveLogic';

// La onda del pisotón de Kurupi (S114): la tierra que revienta el suelo y corre por el piso. La hitbox es la de antes
// (`GAMEPLAY.kurupi`: waveWidth × waveHeight, velocidad, vida); encima va el dibujo: la cresta animada, las grietas
// que deja atrás y se cierran, y lo que salta (terrones, raíces, hojas y polvo). Pools fijos: nada se crea por cuadro.

const HIT = GAMEPLAY.kurupi;
const CFG = GAMEPLAY.kurupiWave;
const ATLAS = 'kurupi_wave_fx';
const DUST_ANIM = 'kurupi_wave_dust';
const leafAnim = (flutter: string): string => `kurupi_wave_leaf_${flutter}`;

interface Wave extends WaveMotion {
  dir: 1 | -1;
  crest: Phaser.GameObjects.Image;
  /** ms desde que salió (la cresta en bucle) o, al apagarse, desde que empezó a derrumbarse. */
  animMs: number;
  collapsing: boolean;
  frame: string;
  lastX: number;
  debris: KickMeter;
  dust: KickMeter;
  cracks: KickMeter;
}

interface Crack {
  image: Phaser.GameObjects.Image;
  variant: number;
  ageMs: number;
  stage: number;
}

export class KurupiWaves {
  /** Las ondas (pool): `lifeMs > 0` es una que daña. */
  readonly list: Wave[] = [];
  private readonly cracks: Crack[] = [];
  private nextCrack = 0;
  private crackCount = 0;
  private readonly clods: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly roots: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly leaves: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly dust: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly box: Box = { x: 0, y: 0, width: 0, height: 0 };
  private readonly hit = new Phaser.Geom.Rectangle();
  private readonly crestFrames: string[] = [];
  private readonly collapseFrames: string[] = [];

  constructor(
    scene: Phaser.Scene,
    private readonly arena: Phaser.Geom.Rectangle,
    private readonly floorY: number,
    pool: number,
  ) {
    ensureArt(scene);
    const size = crestSize(HIT.waveWidth, HIT.waveHeight);
    for (let i = 0; i < CREST_FRAMES; i++) this.crestFrames.push(crestFrameName(i));
    for (let i = 0; i < COLLAPSE_FRAMES; i++) this.collapseFrames.push(collapseFrameName(i));
    for (let i = 0; i < pool; i++) {
      const crest = scene.add
        .image(0, floorY, ATLAS, this.crestFrames[0])
        .setOrigin(0.5, size.floor / size.height)
        .setScale(1 / WAVE_DETAIL)
        .setDepth(CFG.depth.crest)
        .setVisible(false);
      const d = CFG.debris;
      this.list.push({
        x: 0,
        vx: 0,
        lifeMs: 0,
        dir: 1,
        crest,
        animMs: 0,
        collapsing: false,
        frame: '',
        lastX: 0,
        debris: new KickMeter({ everyPx: d.everyPx, minSpeed: 0, maxPerFrame: d.maxPerFrame }),
        dust: new KickMeter({ everyPx: CFG.dust.everyPx, minSpeed: 0, maxPerFrame: 1 }),
        cracks: new KickMeter({ everyPx: CFG.crack.everyPx, minSpeed: 0, maxPerFrame: 1 }),
      });
    }
    for (let i = 0; i < CFG.crack.max; i++) {
      const image = scene.add
        .image(0, floorY, ATLAS, crackFrameName(0, 0))
        .setOrigin(0.5, CRACK.floor / CRACK.height)
        .setScale(1 / CRACK_DETAIL)
        .setDepth(CFG.depth.crack)
        .setVisible(false);
      this.cracks.push({ image, variant: 0, ageMs: 0, stage: -1 });
    }
    // Lo que cae al suelo se apaga ahí (se mete en la tierra).
    const ground = new Phaser.Geom.Rectangle(arena.left - arena.width, floorY + CFG.sinkPx, arena.width * 3, arena.height + 64);
    const sink = { type: 'onEnter' as const, source: ground };
    const scale = 1 / WAVE_DETAIL;
    // Salen de lo ancho de la cresta, un poco sobre el suelo.
    const half = HIT.waveWidth / 2 - 2;
    const spread = {
      type: 'random' as const,
      source: {
        getRandomPoint: (point: Phaser.Types.Math.Vector2Like): void => {
          point.x = Phaser.Math.FloatBetween(-half, half);
          point.y = Phaser.Math.FloatBetween(-6, -2);
        },
      },
    };
    const angle = { min: CFG.clod.angle[0], max: CFG.clod.angle[1] };
    const c = CFG.clod;
    this.clods = scene.add.particles(0, 0, ATLAS, {
      frame: CLODS.map((_, i) => clodFrameName(i)),
      speed: { min: c.speedMin, max: c.speedMax },
      angle,
      gravityY: c.gravityY,
      lifespan: { min: c.lifespanMin, max: c.lifespanMax },
      scale,
      emitZone: spread,
      deathZone: sink,
      maxAliveParticles: c.max,
      emitting: false,
    });
    const r = CFG.root;
    this.roots = scene.add.particles(0, 0, ATLAS, {
      frame: ROOTS.map((_, i) => rootFrameName(i)),
      speed: { min: r.speedMin, max: r.speedMax },
      angle,
      gravityY: r.gravityY,
      lifespan: { min: r.lifespanMin, max: r.lifespanMax },
      scale,
      emitZone: spread,
      deathZone: sink,
      maxAliveParticles: r.max,
      emitting: false,
    });
    const l = CFG.leaf;
    this.leaves = scene.add.particles(0, 0, ATLAS, {
      anim: { anims: LEAF_FLUTTERS.map(leafAnim), cycle: false },
      speed: { min: l.speedMin, max: l.speedMax },
      angle,
      gravityY: l.gravityY,
      lifespan: { min: l.lifespanMin, max: l.lifespanMax },
      scale,
      emitZone: spread,
      deathZone: sink,
      maxAliveParticles: l.max,
      emitting: false,
    });
    const u = CFG.dust;
    this.dust = scene.add.particles(0, 0, ATLAS, {
      anim: DUST_ANIM,
      speedX: { min: -u.speedX, max: u.speedX },
      speedY: { min: u.speedYMin, max: u.speedYMax },
      lifespan: (DUST_FRAMES * 1000) / u.fps,
      scale,
      maxAliveParticles: u.max,
      emitting: false,
    });
    this.clods.setDepth(CFG.depth.debris);
    this.roots.setDepth(CFG.depth.debris);
    this.leaves.setDepth(CFG.depth.debris);
    this.dust.setDepth(CFG.depth.dust);
  }

  /** Revienta una onda en `x` que corre hacia `dir`. false si no queda ninguna libre (como antes: 2 por pisotón). */
  spawn(x: number, dir: 1 | -1): boolean {
    const w = this.list.find((v) => v.lifeMs <= 0);
    if (!w) return false;
    w.vx = dir * HIT.waveSpeed;
    w.lifeMs = HIT.waveLifeMs;
    w.x = x;
    w.dir = dir;
    w.lastX = x;
    w.animMs = 0;
    w.collapsing = false;
    w.debris.reset();
    w.dust.reset();
    w.cracks.reset();
    this.showFrame(w, this.crestFrames[0]);
    w.crest.setPosition(x, this.floorY).setFlipX(dir < 0).setVisible(true);
    const b = CFG.burst;
    this.clods.emitParticleAt(x, this.floorY, b.clods);
    this.leaves.emitParticleAt(x, this.floorY, b.leaves);
    this.roots.emitParticleAt(x, this.floorY, b.roots);
    this.dust.emitParticleAt(x - dir * (HIT.waveWidth / 2), this.floorY - 2, b.dust);
    this.stampCrack(x);
    return true;
  }

  update(deltaMs: number): void {
    for (const w of this.list) {
      if (w.lifeMs > 0) {
        if (stepWave(w, deltaMs, this.arena.left, this.arena.right)) this.advance(w, deltaMs);
        else this.collapse(w);
      } else if (w.collapsing) {
        w.animMs += deltaMs;
        const i = Math.floor((w.animMs * CFG.collapseFps) / 1000);
        if (i >= this.collapseFrames.length) {
          w.collapsing = false;
          w.crest.setVisible(false);
        } else this.showFrame(w, this.collapseFrames[i]);
      }
    }
    for (const c of this.cracks) {
      if (c.stage < 0) continue;
      c.ageMs += deltaMs;
      const stage = crackStage(c.ageMs, CFG.crack.stageMs);
      if (stage === c.stage) continue;
      c.stage = stage;
      if (stage < 0) c.image.setVisible(false);
      else c.image.setFrame(crackFrameName(c.variant, stage));
    }
  }

  /** ¿Alguna onda viva toca a Kerana? La hitbox de siempre: waveWidth × waveHeight con la base en el suelo. */
  hurts(playerRect: Phaser.Geom.Rectangle): boolean {
    for (const w of this.list) {
      if (w.lifeMs <= 0) continue;
      const b = waveBox(w.x, this.floorY, HIT.waveWidth, HIT.waveHeight, this.box);
      if (Phaser.Geom.Rectangle.Overlaps(this.hit.setTo(b.x, b.y, b.width, b.height), playerRect)) return true;
    }
    return false;
  }

  /** Apaga todo de golpe (la pelea se reinicia o termina). */
  clear(): void {
    for (const w of this.list) {
      w.lifeMs = 0;
      w.collapsing = false;
      w.crest.setVisible(false);
    }
    for (const c of this.cracks) {
      c.stage = -1;
      c.image.setVisible(false);
    }
    this.clods.killAll();
    this.roots.killAll();
    this.leaves.killAll();
    this.dust.killAll();
  }

  /** La cresta en marcha: se revuelve, tira lo que salta y deja grietas atrás, todo por distancia. */
  private advance(w: Wave, deltaMs: number): void {
    w.animMs += deltaMs;
    w.crest.x = w.x;
    this.showFrame(w, this.crestFrames[loopFrame(w.animMs, CFG.crestFps, this.crestFrames.length)]);
    const dx = w.x - w.lastX;
    w.lastX = w.x;
    const n = w.debris.step(dx, deltaMs);
    for (let k = w.debris.count - n + 1; k <= w.debris.count; k++) {
      this.clods.emitParticleAt(w.x, this.floorY, 1);
      if (kickHasLeaf(k, CFG.debris.leafEvery)) this.leaves.emitParticleAt(w.x, this.floorY, 1);
      if (kickHasLeaf(k, CFG.debris.rootEvery)) this.roots.emitParticleAt(w.x, this.floorY, 1);
    }
    const back = w.x - w.dir * (HIT.waveWidth / 2);
    if (w.dust.step(dx, deltaMs) > 0) this.dust.emitParticleAt(back, this.floorY - 2, 1);
    if (w.cracks.step(dx, deltaMs) > 0) this.stampCrack(back + w.dir * 2);
  }

  /** Se acabó la onda (la vida o la arena): la cresta se derrumba, suelta lo último y deja su grieta. */
  private collapse(w: Wave): void {
    w.collapsing = true;
    w.animMs = 0;
    this.showFrame(w, this.collapseFrames[0]);
    if (w.x < this.arena.left || w.x > this.arena.right) return;
    this.clods.emitParticleAt(w.x, this.floorY, CFG.end.clods);
    this.dust.emitParticleAt(w.x, this.floorY - 2, CFG.end.dust);
    this.stampCrack(w.x);
  }

  /** Una grieta en x, en la grilla del tileset (se lee como parte del piso); la más vieja se recicla si no hay libre. */
  private stampCrack(x: number): void {
    const cx = Math.round(x);
    if (cx - CRACK.width / 2 < this.arena.left || cx + CRACK.width / 2 > this.arena.right) return;
    const c = this.cracks[this.nextCrack];
    this.nextCrack = (this.nextCrack + 1) % this.cracks.length;
    const n = this.crackCount++;
    c.variant = n % CRACK_VARIANTS;
    c.ageMs = 0;
    c.stage = 0;
    c.image
      .setFrame(crackFrameName(c.variant, 0))
      .setPosition(cx, this.floorY)
      .setFlipX(Math.floor(n / CRACK_VARIANTS) % 2 === 1)
      .setVisible(true);
  }

  private showFrame(w: Wave, frame: string): void {
    if (w.frame === frame) return;
    w.frame = frame;
    w.crest.setFrame(frame);
  }
}

/** El atlas de la onda y sus animaciones (las hojas que aletean y el polvo): una sola vez por partida. */
function ensureArt(scene: Phaser.Scene): void {
  uploadAtlas(scene, ATLAS, waveFrames(HIT.waveWidth, HIT.waveHeight));
  for (const flutter of LEAF_FLUTTERS) {
    const key = leafAnim(flutter);
    if (scene.anims.exists(key)) continue;
    const frames = [];
    for (let i = 0; i < LEAF_FLUTTER_FRAMES; i++) frames.push({ key: ATLAS, frame: leafFrameName(flutter, i) });
    scene.anims.create({ key, frames, frameRate: CFG.leaf.flutterFps, repeat: -1 });
  }
  if (!scene.anims.exists(DUST_ANIM)) {
    const frames = [];
    for (let i = 0; i < DUST_FRAMES; i++) frames.push({ key: ATLAS, frame: dustFrameName(i) });
    scene.anims.create({ key: DUST_ANIM, frames, frameRate: CFG.dust.fps, repeat: 0 });
  }
}
