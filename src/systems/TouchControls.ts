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
/** Margen extra: el pulgar no tiene que acertar el centro. */
const SLOP = 18;

type Icon = 'left' | 'right' | 'jump' | 'attack' | 'dash' | 'pause';

interface VirtualButton {
  action: Action;
  x: number;
  y: number;
  radius: number;
  bg: Phaser.GameObjects.Arc;
  icon: Phaser.GameObjects.Graphics;
  iconKind: Icon;
  held: boolean;
}

/**
 * Botones del celular, en la misma capa que los corazones.
 * Izquierda: d-pad de dos botones. Derecha: salto (el más grande), sable y dash en arco.
 * Varios dedos a la vez: cada toque que sigue en la pantalla mantiene su botón.
 * Se ven en pantalla táctil, o en la PC si la URL lleva `?touch=1`.
 */
export class TouchControls {
  private readonly buttons: VirtualButton[] = [];
  private readonly fingers = new Map<number, { x: number; y: number }>();
  private readonly onNative: (event: TouchEvent) => void;
  private readonly onFrame: () => void;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly input: InputManager,
  ) {
    this.onNative = (event) => {
      if (event.cancelable) event.preventDefault();
      this.fingers.clear();
      for (let i = 0; i < event.touches.length; i++) {
        const touch = event.touches[i];
        this.fingers.set(touch.identifier, this.toWorld(touch.pageX, touch.pageY));
      }
      this.apply(this.fingers.values());
    };
    this.onFrame = () => {
      if (this.fingers.size > 0) return;
      const points: { x: number; y: number }[] = [];
      const cam = this.scene.cameras.main;
      for (const pointer of this.scene.input.manager.pointers) {
        if (!pointer.isDown || pointer.wasTouch) continue;
        points.push(cam.getWorldPoint(pointer.x, pointer.y));
      }
      this.apply(points);
    };
    if (!wantsTouch()) return;
    this.scene.input.addPointer(5);
    this.createButtons();
    window.addEventListener('touchstart', this.onNative, { passive: false, capture: true });
    window.addEventListener('touchmove', this.onNative, { passive: false, capture: true });
    window.addEventListener('touchend', this.onNative, { passive: false, capture: true });
    window.addEventListener('touchcancel', this.onNative, { passive: false, capture: true });
    this.scene.events.on('update', this.onFrame);
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
    this.buttons.push({ action, x, y, radius: size / 2 + SLOP, bg, icon: mark, iconKind: icon, held: false });
  }

  /** Página → coordenadas del mundo de la UI (la cámara tiene zoom). */
  private toWorld(pageX: number, pageY: number): { x: number; y: number } {
    const scale = this.scene.scale;
    const sx = scale.transformX(pageX);
    const sy = scale.transformY(pageY);
    return this.scene.cameras.main.getWorldPoint(sx, sy);
  }

  private apply(points: Iterable<{ x: number; y: number }>): void {
    const list = Array.from(points);
    for (const btn of this.buttons) {
      let held = false;
      for (const point of list) {
        const dx = point.x - btn.x;
        const dy = point.y - btn.y;
        if (dx * dx + dy * dy <= btn.radius * btn.radius) {
          held = true;
          break;
        }
      }
      if (held === btn.held) {
        if (held) this.input.setVirtual(btn.action, true);
        continue;
      }
      btn.held = held;
      btn.bg.setFillStyle(held ? INK : 0x1b1a2e, held ? ALPHA_DOWN : ALPHA);
      drawIcon(btn.icon, btn.x, btn.y, btn.iconKind, held ? INK_DOWN : INK);
      this.input.setVirtual(btn.action, held);
    }
  }

  destroy(): void {
    window.removeEventListener('touchstart', this.onNative, true);
    window.removeEventListener('touchmove', this.onNative, true);
    window.removeEventListener('touchend', this.onNative, true);
    window.removeEventListener('touchcancel', this.onNative, true);
    this.scene.events.off('update', this.onFrame);
    for (const btn of this.buttons) {
      this.input.setVirtual(btn.action, false);
      btn.bg.destroy();
      btn.icon.destroy();
    }
    this.buttons.length = 0;
    this.fingers.clear();
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
  g.fillRect(x - 5, y - 6, 3, 12);
  g.fillRect(x + 2, y - 6, 3, 12);
}

function wantsTouch(): boolean {
  if (typeof window === 'undefined') return false;
  if (new URLSearchParams(window.location.search).get('touch') === '1') return true;
  const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  return coarse || navigator.maxTouchPoints > 0;
}
