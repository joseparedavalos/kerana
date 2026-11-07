import { GAMEPLAY } from '../config/gameplay';

/** Rectángulo en el mundo (compatible con `Phaser.Geom.Rectangle`). */
export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Rectángulo del tajo de Kerana con los pies en (feetX, feetY): delante del cuerpo, desde media altura
 * hasta cerca de los pies (S65: sale de `Player` para que las pruebas midan el mismo tajo que el juego).
 * El borde de arriba no se mueve; el de abajo baja hasta `attack.groundGap` para alcanzar a los bichos bajos.
 */
export function slashRect(feetX: number, feetY: number, facing: number, charged: boolean, out: Box): Box {
  const w = charged ? GAMEPLAY.chargedSlash.hitboxWidth : GAMEPLAY.attack.hitboxWidth;
  const h = charged ? GAMEPLAY.chargedSlash.hitboxHeight : GAMEPLAY.attack.hitboxHeight;
  const body = GAMEPLAY.player;
  const cx = feetX + facing * (body.bodyWidth / 2 + w / 2);
  const top = feetY - body.bodyHeight / 2 - h / 2;
  const floor = feetY - GAMEPLAY.attack.groundGap;
  out.x = cx - w / 2;
  out.y = top;
  out.width = w;
  out.height = Math.max(h, floor - top);
  return out;
}

/** ¿Se tocan? Mismo criterio que `Phaser.Geom.Rectangle.Overlaps` (bordes que se tocan no cuentan). */
export function boxesOverlap(a: Box, b: Box): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}
