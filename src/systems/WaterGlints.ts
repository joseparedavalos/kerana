import Phaser from 'phaser';
import { GAMEPLAY } from '../config/gameplay';
import { glintEnvelope, pickSurface } from './waterGlintLogic';

const CFG = GAMEPLAY.backdrop.waterGlints;
const KEY = 'fx_water_glint';

/**
 * El brillo que corre por la superficie del agua (S110, l2; `waterGlints` en levels.ts). Un pool fijo de trazos de luz de
 * 1 px de alto que aparecen sobre la línea de luz del agua a la vista, corren despacio a lo largo y se apagan, como los
 * destellos del reflejo del sol del fondo (S96). Todos van en un solo `Blitter` (un dibujo por cuadro: con imágenes
 * sueltas costaba ≈ 3 % de FPS en el celular emulado) y el largo es el cuadro de la textura. Sin asignar memoria por
 * cuadro. Solo dibujo.
 */
export class WaterGlints {
  private readonly glints: { bob: Phaser.GameObjects.Bob; x: number; y: number; vx: number; born: number; life: number }[] = [];
  private readonly rand = new Phaser.Math.RandomDataGenerator(['water']);
  private readonly pick = { x: 0, y: 0 };
  private readonly blitter: Phaser.GameObjects.Blitter;

  /** `runs`: tramos de superficie (surfaceRuns, en tiles); `tile`: lado del tile en unidades. */
  constructor(
    scene: Phaser.Scene,
    private readonly runs: readonly number[],
    private readonly tile: number,
  ) {
    if (!scene.textures.exists(KEY)) {
      const tex = scene.textures.createCanvas(KEY, CFG.widthMax, 1);
      if (tex) {
        tex.getContext().fillStyle = '#ffffff';
        tex.getContext().fillRect(0, 0, CFG.widthMax, 1);
        for (let w = CFG.widthMin; w <= CFG.widthMax; w++) tex.add(`w${w}`, 0, 0, 0, w, 1);
        tex.refresh();
      }
    }
    this.blitter = scene.add.blitter(0, 0, KEY).setDepth(CFG.depth);
    const color = Phaser.Display.Color.HexStringToColor(CFG.color).color;
    for (let i = 0; i < CFG.count; i++) {
      const bob = this.blitter.create(0, 0, `w${CFG.widthMin}`, false).setTint(color);
      this.glints.push({ bob, x: 0, y: 0, vx: 0, born: this.rand.between(0, CFG.gapMaxMs), life: 0 });
    }
  }

  /** `view`: lo que muestra la cámara (unidades del mundo); `on`: «Destellos» encendido. */
  update(view: Phaser.Geom.Rectangle, now: number, deltaMs: number, on: boolean): void {
    this.blitter.setVisible(on);
    if (!on) return;
    for (const g of this.glints) {
      if (now >= g.born + g.life) this.respawn(g, view, now);
      const a = glintEnvelope((now - g.born) / g.life);
      g.bob.visible = a > 0;
      if (a <= 0) continue;
      g.x += (g.vx * deltaMs) / 1000;
      g.bob.x = Math.round(g.x);
      g.bob.y = g.y;
      g.bob.alpha = a * CFG.alpha;
    }
  }

  /** Para la prueba de humo: cuántos se ven ahora. */
  get visibleCount(): number {
    if (!this.blitter.visible) return 0;
    return this.glints.filter((g) => g.bob.visible).length;
  }

  private respawn(g: WaterGlints['glints'][number], view: Phaser.Geom.Rectangle, now: number): void {
    const t = this.tile;
    if (!pickSurface(this.runs, view.x / t, view.right / t, this.rand.frac(), this.rand.frac(), this.pick)) {
      // Nada de agua a la vista: se vuelve a probar en un rato.
      g.born = now + CFG.gapMaxMs;
      g.life = 1;
      return;
    }
    const width = this.rand.between(CFG.widthMin, CFG.widthMax);
    g.x = this.pick.x * t - width / 2;
    g.y = this.pick.y * t + CFG.rows[this.rand.between(0, CFG.rows.length - 1)];
    g.vx = this.rand.realInRange(CFG.speedMin, CFG.speedMax) * (this.rand.frac() < 0.5 ? -1 : 1);
    g.bob.setFrame(`w${width}`);
    g.born = now + this.rand.between(CFG.gapMinMs, CFG.gapMaxMs);
    g.life = this.rand.between(CFG.lifeMinMs, CFG.lifeMaxMs);
  }
}
