import { GAMEPLAY } from '../config/gameplay';

/** Rectángulo en el mundo (compatible con `Phaser.Geom.Rectangle`). */
export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Rectángulo del tajo de Kerana con los pies en (feetX, feetY): delante del cuerpo y centrado a media altura
 * (S65: sale de `Player` para que las pruebas midan el mismo tajo que el juego).
 */
export function slashRect(feetX: number, feetY: number, facing: number, charged: boolean, out: Box): Box {
  const w = charged ? GAMEPLAY.chargedSlash.hitboxWidth : GAMEPLAY.attack.hitboxWidth;
  const h = charged ? GAMEPLAY.chargedSlash.hitboxHeight : GAMEPLAY.attack.hitboxHeight;
  const body = GAMEPLAY.player;
  const cx = feetX + facing * (body.bodyWidth / 2 + w / 2);
  const cy = feetY - body.bodyHeight / 2;
  out.x = cx - w / 2;
  out.y = cy - h / 2;
  out.width = w;
  out.height = h;
  return out;
}

/** ¿Se tocan? Mismo criterio que `Phaser.Geom.Rectangle.Overlaps` (bordes que se tocan no cuentan). */
export function boxesOverlap(a: Box, b: Box): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}
