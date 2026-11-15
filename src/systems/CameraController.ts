import Phaser from 'phaser';
import { GAMEPLAY } from '../config/gameplay';
import { VIEW } from './View';

/** Piso de la cámara (S92): con el objetivo dentro de `zone`, el borde de abajo de la vista no pasa de `bottom` (px). */
export interface CameraFloor {
  zone: Phaser.Geom.Rectangle;
  bottom: number;
}

// Seguimiento con lerp, zona muerta, anticipación hacia donde mira y límites del mapa.
export class CameraController {
  private lookX = 0;
  /** Persecución (S31): borde izquierdo fijo de la vista en x, o null (seguimiento normal). */
  private lockedX: number | null = null;
  /** Pisos de la cámara del nivel (S92) y el alto de los límites que este control puso por última vez. */
  private floors: CameraFloor[] = [];
  private floorNow: number;

  constructor(
    private readonly camera: Phaser.Cameras.Scene2D.Camera,
    private readonly target: Phaser.GameObjects.GameObject & { x: number; y: number },
    private readonly bounds: { width: number; height: number },
    /** Cuánto mira hacia arriba (unidades, S92): un nivel que sube quiere ver más cielo que suelo. 0 por defecto. */
    private readonly lookUp = 0,
  ) {
    const c = GAMEPLAY.camera;
    this.floorNow = bounds.height;
    camera.setBounds(0, 0, bounds.width, bounds.height);
    camera.startFollow(this.target, true, c.lerp, c.lerp);
    camera.setDeadzone(c.deadzoneWidth, c.deadzoneHeight);
    camera.setRoundPixels(true);
    camera.setFollowOffset(0, lookUp);
  }

  /**
   * facing: 1 derecha, -1 izquierda. `lookUp` false apaga la mirada hacia arriba del nivel (la arena trabada de un
   * jefe: la pelea se encuadra como siempre). `deltaMs` mueve el piso de la cámara (S92).
   */
  update(facing: 1 | -1, lookUp = true, deltaMs = 0): void {
    const c = GAMEPLAY.camera;
    const target = facing * c.lookahead;
    this.lookX += (target - this.lookX) * c.lookaheadLerp;
    // En Phaser el offset se resta del objetivo: negativo = mirar hacia la derecha; positivo en y = mirar hacia arriba.
    this.camera.setFollowOffset(-this.lookX, lookUp ? this.lookUp : 0);
    this.applyFloor(deltaMs);
  }

  /** Pisos de la cámara del nivel (S92, `rect CameraFloor`); valen desde ya, sin recorrido. */
  setFloors(floors: CameraFloor[]): void {
    this.floors = floors;
    this.applyFloor(null);
  }

  /**
   * S92: con el objetivo dentro de un piso de cámara, los límites del mapa se acortan por abajo hasta ese piso; la vista
   * sube hasta él a `GAMEPLAY.camera.floorSpeed` (con `deltaMs` null, de una vez). Fuera, vuelven los del mapa. No toca
   * nada mientras otro manda en los límites: la arena trabada (BossArena) o la persecución.
   */
  private applyFloor(deltaMs: number | null): void {
    if (this.floors.length === 0 || this.lockedX !== null) return;
    const cam = this.camera;
    const b = cam.getBounds();
    const mine = b.x === 0 && b.y === 0 && b.width === this.bounds.width && (b.height === this.floorNow || b.height === this.bounds.height);
    if (!mine) return;
    const floor = this.floors.find((f) => f.zone.contains(this.target.x, this.target.y - 1));
    const want = floor ? Math.min(floor.bottom, this.bounds.height) : this.bounds.height;
    let next = want;
    if (deltaMs !== null && want < b.height) {
      // Baja desde donde está la vista, no desde el fondo del mapa.
      const from = Math.min(b.height, Math.max(want, cam.worldView.bottom));
      next = Math.max(want, from - (GAMEPLAY.camera.floorSpeed * deltaMs) / 1000);
    }
    if (next !== b.height) cam.setBounds(0, 0, this.bounds.width, next);
    this.floorNow = next;
  }

  /** Al reaparecer: la cámara llega con Kerana. Al caminar el seguimiento sigue suave. */
  snap(): void {
    const cam = this.camera;
    this.applyFloor(null);
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
