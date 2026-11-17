import Phaser from 'phaser';
import { GAMEPLAY } from '../config/gameplay';

const CFG = GAMEPLAY.waterfall;
const SHEET_KEY = 'waterfall_sheet';
const SHEET_W = 32;
const SHEET_H = 64;

/**
 * Textura del chorro (una sola para todas las cascadas): canales verticales de distinta claridad y tramos
 * brillantes cortos. Al correr hacia abajo se lee como agua que cae, no como una cortina plana.
 */
function ensureSheet(scene: Phaser.Scene): void {
  if (scene.textures.exists(SHEET_KEY)) return;
  const tex = scene.textures.createCanvas(SHEET_KEY, SHEET_W, SHEET_H);
  if (!tex) return;
  const ctx = tex.getContext();
  const img = ctx.createImageData(SHEET_W, SHEET_H);
  for (let y = 0; y < SHEET_H; y++) {
    for (let x = 0; x < SHEET_W; x++) {
      // Canales: unas columnas más claras que otras (el agua no cae pareja).
      const channel = 0.65 + 0.35 * (0.5 + 0.5 * Math.sin(x * 1.3));
      // Tramos brillantes cortos que bajan con la textura: el hilo suelto dentro del chorro.
      const thread = (y + x * 3) % 11 < 2 && x % 4 === 1 ? 0.5 : 0;
      const light = Math.min(1, channel * 0.8 + thread);
      const r = Math.round(190 + 65 * light);
      const g = Math.round(214 + 41 * light);
      const b = Math.round(224 + 31 * light);
      img.data.set([r, g, b, 255], (y * SHEET_W + x) * 4);
    }
  }
  ctx.putImageData(img, 0, 0);
  tex.refresh();
}

/**
 * Cascada (S31, el salto de l6): cortina de agua por código delante de Kerana, sin choque (`rect Waterfall`).
 * Dos capas que caen a distinta velocidad (el grosor y el hilo de adelante), bordes brillantes, hilos sueltos
 * y espuma con rocío al pie. Detrás se ve la cornisa.
 */
export class Waterfall {
  private readonly layers: Phaser.GameObjects.TileSprite[] = [];
  private readonly streaks: { img: Phaser.GameObjects.Rectangle; speed: number; len: number }[] = [];
  private readonly foam: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly mist: Phaser.GameObjects.Particles.ParticleEmitter;
  private foamMs = 0;
  private mistMs = 0;

  constructor(
    scene: Phaser.Scene,
    private readonly zone: Phaser.Geom.Rectangle,
    particleKey: string,
  ) {
    ensureSheet(scene);
    const z = zone;
    // Cuerpo: dos capas de la misma textura, la de atrás más lenta. Caen las dos.
    this.layers.push(this.sheet(scene, CFG.backAlpha, 0xcfe8f0));
    this.layers.push(this.sheet(scene, CFG.frontAlpha, 0xffffff));
    // Bordes brillantes: enmarcan el chorro y lo separan de la roca.
    for (const ex of [z.x, z.right - CFG.edgeWidth]) {
      scene.add.rectangle(ex, z.y, CFG.edgeWidth, z.height, 0xffffff, CFG.edgeAlpha).setOrigin(0, 0).setDepth(10);
    }
    // Hilos sueltos adelante: más rápidos, de largo y velocidad distintos.
    const count = Math.max(1, Math.round((z.width / 16) * CFG.streaksPerTile));
    for (let i = 0; i < count; i++) {
      const len = CFG.streakLength * (0.5 + ((i * 37) % 10) / 10);
      const img = scene.add
        .rectangle(z.x + ((i + 0.5) / count) * z.width, z.y + ((i * 0.37) % 1) * z.height, 1, len, 0xffffff, CFG.streakAlpha)
        .setOrigin(0.5, 0)
        .setDepth(11);
      this.streaks.push({ img, speed: CFG.streakSpeed * (0.8 + (i % 4) * 0.12), len });
    }
    this.foam = this.spray(scene, particleKey, { min: -60, max: -20 }, { min: -30, max: 30 }, 140, 460);
    this.mist = this.spray(scene, particleKey, { min: -30, max: -8 }, { min: -12, max: 12 }, 40, 900);
  }

  private sheet(scene: Phaser.Scene, alpha: number, tint: number): Phaser.GameObjects.TileSprite {
    const z = this.zone;
    return scene.add
      .tileSprite(z.x, z.y, z.width, z.height, SHEET_KEY)
      .setOrigin(0, 0)
      .setAlpha(alpha)
      .setTint(tint)
      .setDepth(10);
  }

  private spray(
    scene: Phaser.Scene,
    key: string,
    speedY: { min: number; max: number },
    speedX: { min: number; max: number },
    gravityY: number,
    lifespan: number,
  ): Phaser.GameObjects.Particles.ParticleEmitter {
    return scene.add
      .particles(0, 0, key, {
        speedY,
        speedX,
        gravityY,
        lifespan,
        alpha: { start: 0.7, end: 0 },
        tint: 0xffffff,
        emitting: false,
      })
      .setDepth(11);
  }

  update(deltaMs: number): void {
    const dt = deltaMs / 1000;
    const speeds = [CFG.backSpeed, CFG.frontSpeed];
    this.layers.forEach((layer, i) => {
      layer.tilePositionY -= speeds[i]! * dt;
    });
    const z = this.zone;
    for (const s of this.streaks) {
      s.img.y += s.speed * dt;
      if (s.img.y > z.bottom - s.len) s.img.y = z.y;
    }
    this.foamMs += deltaMs;
    const foamEvery = 1000 / CFG.foamPerSec;
    while (this.foamMs >= foamEvery) {
      this.foamMs -= foamEvery;
      this.foam.emitParticleAt(z.x + Math.random() * z.width, z.bottom - 2, 1);
    }
    this.mistMs += deltaMs;
    const mistEvery = 1000 / CFG.mistPerSec;
    while (this.mistMs >= mistEvery) {
      this.mistMs -= mistEvery;
      this.mist.emitParticleAt(z.x + Math.random() * z.width, z.bottom - 6, 1);
    }
  }
}
