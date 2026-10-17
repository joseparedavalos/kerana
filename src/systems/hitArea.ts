import Phaser from 'phaser';

// Zonas de clic de los menús (S38).

/**
 * Zona de clic de `w` × `h` centrada en el texto (al menos tan ancha como él). El área de Phaser se mide desde la
 * esquina del texto, no desde su origen: `Rectangle(-w/2, …)` la dejaba corrida medio texto a la izquierda (S38).
 * Si el texto cambia de ancho, se vuelve a llamar.
 */
export function centerHitArea(text: Phaser.GameObjects.Text, w: number, h: number): void {
  const width = Math.max(w, text.width);
  const x = (text.width - width) / 2;
  const y = (text.height - h) / 2;
  const area = text.input?.hitArea as Phaser.Geom.Rectangle | undefined;
  if (area) area.setTo(x, y, width, h);
  else text.setInteractive(new Phaser.Geom.Rectangle(x, y, width, h), Phaser.Geom.Rectangle.Contains);
}
