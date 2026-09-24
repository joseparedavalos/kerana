import Phaser from 'phaser';

// Vista lógica del mundo (GDD §11.3): el juego piensa en 640 × 360 y el lienzo es RENDER_ZOOM veces más grande,
// para que los sprites con `detail` 2 (Kerana, jefes) muestren su detalle extra.
export const VIEW = { width: 640, height: 360 } as const;
export const RENDER_ZOOM = 2;

/** Aplica el zoom a la cámara principal. En escenas fijas (sin seguimiento) la centra en la vista lógica. */
export function setupView(scene: Phaser.Scene, fixed = true): Phaser.Cameras.Scene2D.Camera {
  const cam = scene.cameras.main;
  cam.setZoom(RENDER_ZOOM);
  if (fixed) cam.centerOn(VIEW.width / 2, VIEW.height / 2);
  return cam;
}

/**
 * Desfase para objetos con setScrollFactor(0): el zoom se aplica alrededor del centro del lienzo,
 * así que la esquina superior izquierda de la vista lógica queda en (offset.x, offset.y).
 */
export function fixedOffset(cam: Phaser.Cameras.Scene2D.Camera): { x: number; y: number } {
  return { x: (cam.width - cam.width / cam.zoom) / 2, y: (cam.height - cam.height / cam.zoom) / 2 };
}
