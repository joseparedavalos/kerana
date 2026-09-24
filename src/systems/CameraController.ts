import Phaser from 'phaser';
import { GAMEPLAY } from '../config/gameplay';

// Seguimiento con lerp, zona muerta, anticipación hacia donde mira y límites del mapa.
export class CameraController {
  private lookX = 0;

  constructor(
    private readonly camera: Phaser.Cameras.Scene2D.Camera,
    target: Phaser.GameObjects.GameObject & { x: number; y: number },
    bounds: { width: number; height: number },
  ) {
    const c = GAMEPLAY.camera;
    camera.setBounds(0, 0, bounds.width, bounds.height);
    camera.startFollow(target, true, c.lerp, c.lerp);
    camera.setDeadzone(c.deadzoneWidth, c.deadzoneHeight);
    camera.setRoundPixels(true);
  }

  /** facing: 1 derecha, -1 izquierda. */
  update(facing: 1 | -1): void {
    const c = GAMEPLAY.camera;
    const target = facing * c.lookahead;
    this.lookX += (target - this.lookX) * c.lookaheadLerp;
    // En Phaser el offset se resta del objetivo: negativo = mirar hacia la derecha.
    this.camera.setFollowOffset(-this.lookX, 0);
  }

}
