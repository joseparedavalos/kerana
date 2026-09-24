import Phaser from 'phaser';
import { FONT_FAMILY } from '../config/fonts';
import { GAMEPLAY } from '../config/gameplay';
import type { Boss } from '../entities/bosses';
import { AudioManager } from './AudioManager';

const CFG = GAMEPLAY.boss;
const MARK_COLOR = 0x6a2e8f;
const LIGHT_COLOR = 0xfff2c0;

export interface LiberationOptions {
  scene: Phaser.Scene;
  boss: Boss;
  /** Muestra el diálogo de reencuentro y llama a `done` al terminar. */
  showDialogue: (done: () => void) => void;
  /** Texto del cartel "Don obtenido" (ya traducido), o null si el nivel no da don. */
  giftText: string | null;
  /** Destellos de pantalla permitidos (Opciones, GDD §4.9). */
  flashes: boolean;
  onDone: () => void;
}

// Secuencia de liberación común a todos los jefes (GDD §6.0):
// cámara lenta → la marca de Tau estalla → diálogo → el hijo sube como luz → "Don obtenido".
export function playLiberation(o: LiberationOptions): void {
  const { scene, boss } = o;
  const world = (scene.physics as Phaser.Physics.Arcade.ArcadePhysics).world;
  const mark = boss.markPosition(new Phaser.Math.Vector2());

  // 1. Cámara lenta.
  world.timeScale = 1 / CFG.slowMoScale;
  scene.tweens.timeScale = CFG.slowMoScale;
  scene.time.delayedCall(CFG.slowMoMs, () => {
    world.timeScale = 1;
    scene.tweens.timeScale = 1;
    world.pause();
    burst();
  });

  // 2. La marca se agrieta y estalla en luz.
  function burst(): void {
    AudioManager.play('liberation');
    const ring = scene.add.circle(mark.x, mark.y, 6, MARK_COLOR, 0.9).setDepth(30);
    scene.tweens.add({ targets: ring, scale: 8, alpha: 0, duration: CFG.markBurstMs, ease: 'Cubic.easeOut', onComplete: () => ring.destroy() });
    const sparks = scene.add
      .particles(mark.x, mark.y, 'fx_particle', {
        speed: { min: 40, max: 140 },
        lifespan: CFG.markBurstMs,
        alpha: { start: 1, end: 0 },
        tint: [0xf2c14e, 0xffffff, 0xc8c8e6],
        emitting: false,
      })
      .setDepth(31);
    sparks.explode(28);
    if (o.flashes) scene.cameras.main.flash(250, 255, 242, 192);
    scene.time.delayedCall(CFG.markBurstMs, () => {
      sparks.destroy();
      o.showDialogue(ascend);
    });
  }

  // 3-4. El hijo se vuelve luz y sube.
  function ascend(): void {
    boss.fadeOut(CFG.ascendMs / 2);
    const light = scene.add.circle(mark.x, mark.y, 5, LIGHT_COLOR, 1).setDepth(30);
    scene.tweens.add({
      targets: light,
      y: scene.cameras.main.worldView.top - 20,
      scale: 1.6,
      duration: CFG.ascendMs,
      ease: 'Sine.easeIn',
      onComplete: () => {
        light.destroy();
        giftBanner();
      },
    });
  }

  // 5. Cartel "Don obtenido".
  function giftBanner(): void {
    if (!o.giftText) {
      o.onDone();
      return;
    }
    const cam = scene.cameras.main;
    const text = scene.add
      .text(cam.width / 2, cam.height / 2, o.giftText, {
        fontFamily: FONT_FAMILY,
        fontSize: '12px',
        color: '#F2C14E',
        backgroundColor: '#1B1A2EDD',
        padding: { x: 8, y: 6 },
        align: 'center',
        wordWrap: { width: 360 },
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(200)
      .setAlpha(0);
    AudioManager.play('feather');
    scene.tweens.add({ targets: text, alpha: 1, duration: 250 });
    scene.time.delayedCall(CFG.giftBannerMs, o.onDone);
  }
}
