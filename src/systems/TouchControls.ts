import Phaser from 'phaser';
import type { Action, InputManager } from './InputManager';
import { VIEW } from './View';

const MOVE = 44;
const ACTION = 42;
const JUMP = 52;
const GAP = 10;
const EDGE = 14;
const ALPHA = 0.4;
const ALPHA_DOWN = 0.88;
const INK = 0xf2eee3;
const INK_DOWN = 0x1b1a2e;

type Icon = 'left' | 'right' | 'jump' | 'attack' | 'dash' | 'pause';

interface VirtualButton {
  action: Action;
  bg: Phaser.GameObjects.Arc;
  icon: Phaser.GameObjects.Graphics;
  iconKind: Icon;
  pointerId: number | null;
}

/**
 * Botones del celular, en la misma capa que los corazones.
 * Izquierda: d-pad de dos botones. Derecha: salto (el más grande), sable y dash en arco.
 * El sable se mantiene apretado para el tajo cargado.
 * Se ven en pantalla táctil, o en la PC si la URL lleva `?touch=1`.
 */
export class TouchControls {
  private readonly buttons: VirtualButton[] = [];
  private readonly onUp: (pointer: Phaser.Input.Pointer) => void;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly input: InputManager,
  ) {
    this.onUp = (pointer) => {
      for (const btn of this.buttons) {
        if (btn.pointerId === pointer.id) this.release(btn);
      }
    };
    if (!wantsTouch()) return;
    this.createButtons();
    this.scene.input.on('pointerup', this.onUp);
    this.scene.input.on('pointerupoutside', this.onUp);
  }

  private createButtons(): void {
    const moveY = VIEW.height - EDGE - MOVE / 2;
    this.addButton('left', EDGE + MOVE / 2, moveY, MOVE, 'left');
    this.addButton('right', EDGE + MOVE / 2 + MOVE + GAP, moveY, MOVE, 'right');

    const jumpX = VIEW.width - EDGE - JUMP / 2;
    const jumpY = VIEW.height - EDGE - JUMP / 2;
    this.addButton('jump', jumpX, jumpY, JUMP, 'jump');
    this.addButton('attack', jumpX - JUMP / 2 - GAP - ACTION / 2, jumpY - 6, ACTION, 'attack');
    this.addButton('dash', jumpX - 18, jumpY - JUMP / 2 - GAP - ACTION / 2, ACTION, 'dash');
    this.addButton('pause', VIEW.width - EDGE - 14, EDGE + 14, 28, 'pause');
  }

  private addButton(action: Action, x: number, y: number, size: number, icon: Icon): void {
    const bg = this.scene.add
      .circle(x, y, size / 2, 0x1b1a2e, ALPHA)
      .setStrokeStyle(1.5, INK, 0.9)
      .setDepth(1000);
    const mark = this.scene.add.graphics().setDepth(1001);
    drawIcon(mark, x, y, icon, INK);
    const hit = new Phaser.Geom.Circle(size / 2, size / 2, size / 2 + 8);
    bg.setInteractive(hit, Phaser.Geom.Circle.Contains);
    const btn: VirtualButton = { action, bg, icon: mark, iconKind: icon, pointerId: null };
    bg.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      btn.pointerId = pointer.id;
      bg.setFillStyle(INK, ALPHA_DOWN);
      drawIcon(mark, x, y, icon, INK_DOWN);
      this.input.setVirtual(action, true);
    });
    this.buttons.push(btn);
  }

  private release(btn: VirtualButton): void {
    if (btn.pointerId === null) return;
    btn.pointerId = null;
    btn.bg.setFillStyle(0x1b1a2e, ALPHA);
    drawIcon(btn.icon, btn.bg.x, btn.bg.y, btn.iconKind, INK);
    this.input.setVirtual(btn.action, false);
  }

  destroy(): void {
    this.scene.input.off('pointerup', this.onUp);
    this.scene.input.off('pointerupoutside', this.onUp);
    for (const btn of this.buttons) {
      this.release(btn);
      btn.bg.destroy();
      btn.icon.destroy();
    }
    this.buttons.length = 0;
  }
}

function drawIcon(g: Phaser.GameObjects.Graphics, x: number, y: number, icon: Icon, color: number): void {
  g.clear();
  g.fillStyle(color, 1);
  if (icon === 'left' || icon === 'right') {
    const dir = icon === 'left' ? -1 : 1;
    g.fillTriangle(x + dir * 8, y, x - dir * 6, y - 8, x - dir * 6, y + 8);
    return;
  }
  if (icon === 'jump') {
    g.fillTriangle(x, y - 9, x - 8, y + 4, x + 8, y + 4);
    g.fillRect(x - 2, y + 2, 4, 6);
    return;
  }
  if (icon === 'attack') {
    // Sable: hoja + empuñadura.
    g.fillRect(x - 2, y - 10, 4, 14);
    g.fillTriangle(x - 2, y - 10, x + 2, y - 10, x, y - 15);
    g.fillRect(x - 6, y + 4, 12, 3);
    g.fillRect(x - 1.5, y + 7, 3, 4);
    return;
  }
  if (icon === 'dash') {
    g.fillTriangle(x - 8, y - 6, x - 1, y, x - 8, y + 6);
    g.fillTriangle(x - 1, y - 6, x + 6, y, x - 1, y + 6);
    return;
  }
  // Pausa: dos barras.
  g.fillRect(x - 5, y - 6, 3, 12);
  g.fillRect(x + 2, y - 6, 3, 12);
}

function wantsTouch(): boolean {
  if (typeof window === 'undefined') return false;
  if (new URLSearchParams(window.location.search).get('touch') === '1') return true;
  const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  return coarse || navigator.maxTouchPoints > 0;
}
