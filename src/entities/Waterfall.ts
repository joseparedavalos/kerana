import Phaser from 'phaser';
import { GAMEPLAY } from '../config/gameplay';
import {
  paintBackSheet,
  paintFoam,
  paintFrontSheet,
  lipCrest,
  paintLip,
  paintPool,
  paintPuff,
  paintRipple,
  type RgbaImage,
  type WaterfallLedge,
} from './waterfallArt';

const CFG = GAMEPLAY.waterfall;

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

/** Un objeto del pool que vive `life` ms y se reinicia; `t` va de 0 a 1. */
interface Pooled<T> {
  obj: T;
  t: number;
  life: number;
  x: number;
  y: number;
}

/**
 * Cascada (S31, el salto de l6; S116, el dibujo nuevo): decoración por código delante de Kerana, sin choque
 * (`rect Waterfall`). Dos láminas translúcidas que caen a distinta velocidad (el cuerpo, en tonos de agua con rendijas
 * por donde se adivina lo de detrás, y los hilos claros de adelante), la cresta curva arriba (el agua que da vuelta por
 * el borde, con brillos que bajan), salpicadura y espuma donde el chorro cruza un piso (la cornisa del secreto) y, al
 * pie, la poza revuelta con ondas, espuma, gotas y una nube de rocío. Texturas generadas una vez; ondas, espuma y
 * brillos en pools fijos; las partículas, de dos emisores. Fuera de cámara no emite ni anima nada más que las láminas.
 */
export class Waterfall {
  private readonly back: Phaser.GameObjects.TileSprite;
  private readonly front: Phaser.GameObjects.TileSprite;
  private readonly glints: Pooled<Phaser.GameObjects.Rectangle>[] = [];
  private readonly ripples: Pooled<Phaser.GameObjects.Image>[] = [];
  private readonly foams: Pooled<Phaser.GameObjects.Image>[] = [];
  private readonly drops: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly mist: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly view: Phaser.Geom.Rectangle;
  private readonly poolY: number;
  /** El filo de la cresta por columna (de `lipCrest`): ahí nacen los brillos. */
  private readonly crest: number[];
  private dropMs = 0;
  private mistMs = 0;
  private ledgeMs = 0;
  private seed = 116;

  constructor(
    scene: Phaser.Scene,
    private readonly zone: Phaser.Geom.Rectangle,
    private readonly ledges: readonly WaterfallLedge[] = [],
  ) {
    const z = zone;
    const w = Math.round(z.width);
    const backKey = ensureTexture(scene, `waterfall_back_${w}`, () => paintBackSheet(w, CFG.art));
    const frontKey = ensureTexture(scene, `waterfall_front_${w}`, () => paintFrontSheet(w, CFG.art));
    const lipKey = ensureTexture(scene, `waterfall_lip_${w}`, () => paintLip(w, CFG.art));
    const poolW = w + CFG.pool.overhang * 2;
    const poolKey = ensureTexture(scene, `waterfall_pool_${w}`, () => paintPool(poolW, CFG.pool.height, w, CFG.art));
    const foamKey = ensureTexture(scene, 'waterfall_foam', () => paintFoam(CFG.foam.width, CFG.foam.height, CFG.art));
    const puffKey = ensureTexture(scene, 'waterfall_puff', () => paintPuff(CFG.mist.width, CFG.mist.height, CFG.art));
    const rippleKey = ensureTexture(scene, 'waterfall_ripple', () => paintRipple(CFG.ripples.width, CFG.ripples.height, CFG.art));
    const dropKey = ensureTexture(scene, 'waterfall_drop', () => paintFoam(2, 2, CFG.art));

    // Las dos láminas que caen (S31: dos velocidades), con su propia textura cada una. Empiezan bajo la cresta, que
    // pinta su propio tramo de agua (el arco de arriba) y se funde con ellas en sus últimas filas.
    const top = CFG.art.lipHeight - CFG.art.lipRise - CFG.lipOverlap;
    this.back = scene.add.tileSprite(z.x, z.y + top, z.width, z.height - top, backKey).setOrigin(0, 0).setDepth(CFG.depth);
    this.front = scene.add.tileSprite(z.x, z.y + top, z.width, z.height - top, frontKey).setOrigin(0, 0).setDepth(CFG.depth + 1);
    this.crest = lipCrest(w, CFG.art);
    // La cresta: sube `lipRise` sobre el borde, empieza `lipLead` antes (sobre la roca) y se pasa 2 a la derecha.
    scene.add.image(z.x - CFG.art.lipLead, z.y - CFG.art.lipRise, lipKey).setOrigin(0, 0).setDepth(CFG.depth + 1);
    // Brillos que bajan por la curva de la cresta.
    for (let i = 0; i < CFG.glints.count; i++) {
      const obj = scene.add.rectangle(0, 0, CFG.glints.width, 1, CFG.art.ramp[6], 0).setOrigin(0, 0).setDepth(CFG.depth + 1);
      this.glints.push({ obj, t: i / CFG.glints.count, life: CFG.glints.lifeMs, x: 0, y: 0 });
    }
    // Donde el chorro cruza un piso (la cornisa): una franja de espuma pegada al borde de arriba.
    for (const l of ledges) {
      const lw = Math.max(4, Math.round(l.x1 - l.x0));
      const key = ensureTexture(scene, `waterfall_ledge_${lw}`, () => paintFoam(lw + 4, CFG.ledge.foamHeight, CFG.art, 1167));
      scene.add
        .image(l.x0 - 2, l.y - CFG.ledge.foamHeight + CFG.ledge.foamSink, key)
        .setOrigin(0, 0)
        .setAlpha(CFG.ledge.foamAlpha)
        .setDepth(CFG.depth + 1);
    }
    // La poza al pie, con sus ondas y su espuma.
    this.poolY = z.bottom - CFG.pool.height;
    scene.add.image(z.x - CFG.pool.overhang, this.poolY, poolKey).setOrigin(0, 0).setDepth(CFG.depth + 1);
    for (let i = 0; i < CFG.ripples.count; i++) {
      const obj = scene.add.image(0, 0, rippleKey).setDepth(CFG.depth + 1).setAlpha(0);
      this.ripples.push({ obj, t: i / CFG.ripples.count, life: CFG.ripples.lifeMs, x: 0, y: 0 });
    }
    for (let i = 0; i < CFG.foam.count; i++) {
      const obj = scene.add.image(0, 0, foamKey).setDepth(CFG.depth + 2).setAlpha(0);
      this.foams.push({ obj, t: i / CFG.foam.count, life: CFG.foam.lifeMs, x: 0, y: 0 });
    }
    this.drops = scene.add
      .particles(0, 0, dropKey, {
        speedY: { min: CFG.drops.speedY[0], max: CFG.drops.speedY[1] },
        speedX: { min: -CFG.drops.speedX, max: CFG.drops.speedX },
        gravityY: CFG.drops.gravity,
        lifespan: CFG.drops.lifeMs,
        alpha: { start: 0.9, end: 0 },
        emitting: false,
      })
      .setDepth(CFG.depth + 2);
    this.mist = scene.add
      .particles(0, 0, puffKey, {
        speedY: { min: CFG.mist.speedY[0], max: CFG.mist.speedY[1] },
        speedX: { min: -CFG.mist.speedX, max: CFG.mist.speedX },
        scale: { start: CFG.mist.scale[0], end: CFG.mist.scale[1] },
        alpha: { start: CFG.mist.alpha, end: 0 },
        lifespan: CFG.mist.lifeMs,
        emitting: false,
      })
      .setDepth(CFG.depth + 2);
    const m = CFG.cullMargin;
    this.view = new Phaser.Geom.Rectangle(z.x - m, z.y - m, z.width + m * 2, z.height + m * 2);
  }

  /** Azar barato y fijo para los pools (sin Math.random: se puede repetir una captura). */
  private rand(): number {
    this.seed = (this.seed * 1103515245 + 12345) & 0x7fffffff;
    return this.seed / 0x7fffffff;
  }

  update(deltaMs: number, camera?: Phaser.Cameras.Scene2D.Camera): void {
    const dt = deltaMs / 1000;
    this.back.tilePositionY -= CFG.backSpeed * dt;
    this.front.tilePositionY -= CFG.frontSpeed * dt;
    if (camera && !Phaser.Geom.Rectangle.Overlaps(camera.worldView, this.view)) return;
    const z = this.zone;
    // Brillos de la cresta: nacen en el filo y bajan por la curva, apagándose.
    for (const g of this.glints) {
      g.t += deltaMs / g.life;
      if (g.t >= 1) {
        g.t -= 1;
        const col = Math.floor(this.rand() * (z.width - CFG.glints.width));
        g.x = z.x + col;
        g.y = z.y - CFG.art.lipRise + (this.crest[col + CFG.art.lipLead] ?? 0) + 1;
      }
      const fall = g.t * CFG.glints.travel;
      g.obj.setPosition(g.x, Math.round(g.y + fall)).setAlpha(Math.sin(Math.PI * g.t) * CFG.glints.alpha);
    }
    // Ondas en la poza: salen del pie del chorro hacia los costados, se abren y se apagan.
    const cx = z.centerX;
    for (const r of this.ripples) {
      r.t += deltaMs / r.life;
      if (r.t >= 1) {
        r.t -= 1;
        r.x = cx + (this.rand() - 0.5) * z.width * 0.5;
        r.y = this.poolY + 2 + this.rand() * 2;
      }
      const s = CFG.ripples.scale[0] + (CFG.ripples.scale[1] - CFG.ripples.scale[0]) * r.t;
      r.obj.setPosition(r.x, r.y).setScale(s, 0.6 + s * 0.4).setAlpha((1 - r.t) * CFG.ripples.alpha);
    }
    // Espuma: manchas que hierven al pie, suben un poco y se deshacen.
    for (const f of this.foams) {
      f.t += deltaMs / f.life;
      if (f.t >= 1) {
        f.t -= 1;
        // Una parte de la espuma va donde el chorro golpea un piso (la cornisa); el resto, en la poza.
        const ledge = this.ledges.length && this.rand() < CFG.ledge.foamShare ? this.ledges[Math.floor(this.rand() * this.ledges.length)]! : null;
        f.x = ledge ? ledge.x0 + this.rand() * (ledge.x1 - ledge.x0) : z.x + this.rand() * z.width;
        f.y = ledge ? ledge.y - 1 : this.poolY + this.rand() * 3;
      }
      f.obj
        .setPosition(Math.round(f.x + Math.sin(f.t * 6) * 1.5), Math.round(f.y - f.t * CFG.foam.rise))
        .setAlpha(Math.sin(Math.PI * f.t) * CFG.foam.alpha);
    }
    // Gotas y rocío: al pie y donde el chorro golpea un piso.
    this.dropMs += deltaMs;
    const dropEvery = 1000 / CFG.drops.perSec;
    while (this.dropMs >= dropEvery) {
      this.dropMs -= dropEvery;
      this.drops.emitParticleAt(z.x + this.rand() * z.width, this.poolY, 1);
    }
    this.mistMs += deltaMs;
    const mistEvery = 1000 / CFG.mist.perSec;
    while (this.mistMs >= mistEvery) {
      this.mistMs -= mistEvery;
      this.mist.emitParticleAt(z.x + this.rand() * z.width, this.poolY - 2, 1);
    }
    if (this.ledges.length) {
      this.ledgeMs += deltaMs;
      const ledgeEvery = 1000 / CFG.ledge.dropsPerSec;
      while (this.ledgeMs >= ledgeEvery) {
        this.ledgeMs -= ledgeEvery;
        const l = this.ledges[Math.floor(this.rand() * this.ledges.length)]!;
        this.drops.emitParticleAt(l.x0 + this.rand() * (l.x1 - l.x0), l.y - 1, 1);
        if (this.rand() < CFG.ledge.mistShare) this.mist.emitParticleAt(l.x0 + this.rand() * (l.x1 - l.x0), l.y - 3, 1);
      }
    }
  }
}
