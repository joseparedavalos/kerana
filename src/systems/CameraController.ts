import Phaser from 'phaser';
import { GAMEPLAY } from '../config/gameplay';
import { VIEW } from './View';

// Seguimiento con lerp, zona muerta, anticipación hacia donde mira y límites del mapa.
export class CameraController {
  private lookX = 0;
  /** Persecución (S31): borde izquierdo fijo de la vista en x, o null (seguimiento normal). */
  private lockedX: number | null = null;

  constructor(
    private readonly camera: Phaser.Cameras.Scene2D.Camera,
    private readonly target: Phaser.GameObjects.GameObject & { x: number; y: number },
    private readonly bounds: { width: number; height: number },
  ) {
    const c = GAMEPLAY.camera;
    camera.setBounds(0, 0, bounds.width, bounds.height);
    camera.startFollow(this.target, true, c.lerp, c.lerp);
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

  /** Al reaparecer: la cámara llega con Kerana. Al caminar el seguimiento sigue suave. */
  snap(): void {
    const cam = this.camera;
    const x = this.target.x - cam.followOffset.x;
    const y = this.target.y - cam.followOffset.y;
    cam.midPoint.set(x, y);
    cam.scrollX = x - cam.width * 0.5;
    cam.scrollY = y - cam.height * 0.5;
    if (cam.useBounds) {
      cam.scrollX = cam.clampX(cam.scrollX);
      cam.scrollY = cam.clampY(cam.scrollY);
    }
  }

  /**
   * Persecución (S31): fija el borde izquierdo de la vista en `x` (px del mundo) con límites de un ancho de vista;
   * el seguimiento en y sigue igual. Con null vuelven los límites del mapa y la cámara alcanza a Kerana con su lerp.
   * Solo lo usa la persecución: la arena de un jefe pone sus propios límites (BossArena) y nunca coinciden.
   */
  lockScrollX(x: number | null): void {
    if (x === null) {
      if (this.lockedX === null) return;
      this.lockedX = null;
      this.camera.setBounds(0, 0, this.bounds.width, this.bounds.height);
      return;
    }
    this.lockedX = x;
    this.camera.setBounds(x, 0, VIEW.width, this.bounds.height);
  }
}
