import Phaser from 'phaser';
import { GAMEPLAY } from '../config/gameplay';

const CFG = GAMEPLAY.breakable;

/**
 * Clases de rompible (S22). Cada una se ve distinta del terreno y de la otra, sin cartel:
 * - `rock`: roca agrietada ("B"), pide el tajo cargado. Piedra gris azulada con grietas que laten con la luz del tajo.
 * - `brittle`: bloque frágil ("%"), cede al tajo normal. Fardo de totora seca: paja clara con hebras y atadura.
 * - `liana`: cortina de liana (rect con `kind=liana`), cede al tajo normal. Hojas claras y las mismas ataduras que el fardo.
 */
export type BreakableKind = 'rock' | 'brittle' | 'liana';

export function parseBreakableKind(raw: unknown): BreakableKind {
  return raw === 'liana' || raw === 'brittle' ? raw : 'rock';
}

/** Lo que pide cada clase: la roca solo cede al tajo cargado (o a su onda). */
export function needsChargedSlash(kind: BreakableKind): boolean {
  return kind === 'rock';
}

const T = 16;
/** Número fijo por tile (para que las grietas no cambien entre partidas). */
const hash = (x: number, y: number): number => ((x * 73856093) ^ (y * 19349663)) >>> 0;

/**
 * Dibuja un bloque de rompibles de una misma clase (todas sus cajas, en px) y devuelve lo creado,
 * para borrarlo al romperse. Los bordes se marcan solo hacia afuera del bloque.
 */
export function drawBreakables(scene: Phaser.Scene, kind: BreakableKind, zones: readonly Phaser.Geom.Rectangle[]): Phaser.GameObjects.GameObject[] {
  if (kind === 'liana') return zones.map((z) => drawLiana(scene, z));
  // Tiles del bloque, para saber qué bordes dan afuera.
  const tiles = new Set<string>();
  const cells: [number, number][] = [];
  for (const z of zones) {
    for (let y = z.top; y < z.bottom; y += T) {
      for (let x = z.left; x < z.right; x += T) {
        tiles.add(`${x},${y}`);
        cells.push([x, y]);
      }
    }
  }
  const open = (x: number, y: number): boolean => !tiles.has(`${x},${y}`);
  const base = scene.add.graphics().setDepth(1);
  if (kind === 'brittle') {
    for (const [x, y] of cells) drawBrittleTile(base, x, y, open);
    return [base];
  }
  const glow = scene.add.graphics().setDepth(1.1);
  for (const [x, y] of cells) drawRockTile(base, glow, x, y, open);
  scene.tweens.add({
    targets: glow,
    alpha: { from: CFG.rockGlowAlphaMin, to: CFG.rockGlowAlphaMax },
    duration: CFG.rockGlowPulseMs,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut',
  });
  return [base, glow];
}

function drawRockTile(g: Phaser.GameObjects.Graphics, glow: Phaser.GameObjects.Graphics, x: number, y: number, open: (x: number, y: number) => boolean): void {
  g.fillStyle(CFG.rockColor).fillRect(x, y, T, T);
  // Luz arriba y a la izquierda, sombra abajo y a la derecha: solo en los bordes de afuera.
  g.fillStyle(CFG.rockEdgeColor);
  if (open(x, y - T)) g.fillRect(x, y, T, 2);
  if (open(x - T, y)) g.fillRect(x, y, 2, T);
  g.fillStyle(CFG.rockCrackColor, 0.55);
  if (open(x, y + T)) g.fillRect(x, y + T - 2, T, 2);
  if (open(x + T, y)) g.fillRect(x + T - 2, y, 2, T);
  // Grieta en zigzag de arriba abajo y una rama corta; la luz corre por adentro.
  const h = hash(x / T, y / T);
  const pts = [
    new Phaser.Math.Vector2(x + 4 + (h % 8), y),
    new Phaser.Math.Vector2(x + 3 + ((h >> 3) % 10), y + 6),
    new Phaser.Math.Vector2(x + 5 + ((h >> 6) % 7), y + 11),
    new Phaser.Math.Vector2(x + 4 + ((h >> 9) % 8), y + T),
  ];
  const branchFrom = pts[1 + ((h >> 12) % 2)];
  const branchTo = new Phaser.Math.Vector2(branchFrom.x + ((h >> 14) % 2 ? 5 : -5), branchFrom.y + 3);
  g.lineStyle(2, CFG.rockCrackColor).strokePoints(pts).lineBetween(branchFrom.x, branchFrom.y, branchTo.x, branchTo.y);
  glow.lineStyle(1, CFG.rockGlowColor).strokePoints(pts).lineBetween(branchFrom.x, branchFrom.y, branchTo.x, branchTo.y);
}

function drawBrittleTile(g: Phaser.GameObjects.Graphics, x: number, y: number, open: (x: number, y: number) => boolean): void {
  g.fillStyle(CFG.brittleColor).fillRect(x, y, T, T);
  // Hebras de paja levemente inclinadas.
  g.lineStyle(1, CFG.brittleStrandColor, 0.8);
  for (let k = 0; k < 4; k++) g.lineBetween(x + 2 + k * 4, y + 1, x + 4 + k * 4, y + T - 1);
  // Atadura clara por el medio, con nudos.
  g.fillStyle(CFG.brittleTieColor).fillRect(x, y + 7, T, 2);
  g.fillStyle(CFG.brittleStrandColor).fillRect(x + 7, y + 6, 2, 4);
  // Contorno oscuro hacia afuera del fardo.
  g.fillStyle(CFG.brittleStrandColor);
  if (open(x, y - T)) g.fillRect(x, y, T, 1);
  if (open(x, y + T)) g.fillRect(x, y + T - 1, T, 1);
  if (open(x - T, y)) g.fillRect(x, y, 1, T);
  if (open(x + T, y)) g.fillRect(x + T - 1, y, 1, T);
}

/** Liana: el cuerpo (rect verde de 6 px) lo crea la escena; acá van las hojas y las ataduras. */
function drawLiana(scene: Phaser.Scene, z: Phaser.Geom.Rectangle): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics().setDepth(3.1);
  const cx = z.centerX;
  g.fillStyle(CFG.lianaLeafColor);
  for (let y = z.top + 3, side = 1; y < z.bottom - 2; y += 6, side = -side) {
    g.fillTriangle(cx + side * 2, y, cx + side * 7, y + 2, cx + side * 2, y + 4);
  }
  g.fillStyle(CFG.brittleTieColor);
  for (let y = z.top + 6; y < z.bottom; y += T) g.fillRect(cx - 4, y, 8, 2);
  return g;
}
