import Phaser from 'phaser';
import type { Action, InputManager } from './InputManager';
import { SaveManager } from './SaveManager';
import { resolveTouchLayout, touchButtonRadius, touchButtonSize, type TouchButtonId } from './touchLayout';

const ALPHA = 0.4;
const ALPHA_DOWN = 0.88;
const INK = 0xf2eee3;
const INK_DOWN = 0x1b1a2e;

type Icon = TouchButtonId;

interface VirtualButton {
  action: Action;
  x: number;
  y: number;
  radius: number;
  scale: number;
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
  private hidden = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly input: InputManager,
  ) {
    this.onNative = (event) => {
      if (this.hidden) return;
      if (event.cancelable) event.preventDefault();
      this.fingers.clear();
      for (let i = 0; i < event.touches.length; i++) {
        const touch = event.touches[i];
        this.fingers.set(touch.identifier, this.toWorld(touch.pageX, touch.pageY));
      }
      this.apply(this.fingers.values());
    };
    this.onFrame = () => {
      if (this.hidden || this.fingers.size > 0) return;
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

  /** Vuelve a leer el guardado. Se usa al salir de la pausa, por si se movieron. */
  relayout(): void {
    this.clearButtons();
    if (!wantsTouch()) return;
    this.createButtons();
  }

  /** Los esconde en la pausa para que no tapen el menú ni se queden apretados. */
  setHidden(hidden: boolean): void {
    this.hidden = hidden;
    if (hidden) this.fingers.clear();
    for (const btn of this.buttons) {
      btn.bg.setVisible(!hidden);
      btn.icon.setVisible(!hidden);
      if (hidden && btn.held) {
        btn.held = false;
        this.input.setVirtual(btn.action, false);
      }
    }
  }

  private createButtons(): void {
    const layout = resolveTouchLayout(SaveManager.current.settings.touchLayout);
    for (const id of Object.keys(layout) as TouchButtonId[]) {
      const place = layout[id];
      this.addButton(id, place.x, place.y, touchButtonSize(id) * place.scale, place.scale);
    }
  }

  private addButton(action: TouchButtonId, x: number, y: number, size: number, scale: number): void {
    const bg = this.scene.add
      .circle(x, y, size / 2, 0x1b1a2e, ALPHA)
      .setStrokeStyle(1.5, INK, 0.9)
      .setDepth(1000);
    const mark = this.scene.add.graphics().setDepth(1001);
    drawTouchIcon(mark, x, y, action, INK, scale);
    this.buttons.push({ action, x, y, radius: touchButtonRadius(action, scale), scale, bg, icon: mark, iconKind: action, held: false });
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
      drawTouchIcon(btn.icon, btn.x, btn.y, btn.iconKind, held ? INK_DOWN : INK, btn.scale);
      this.input.setVirtual(btn.action, held);
    }
  }

  destroy(): void {
    window.removeEventListener('touchstart', this.onNative, true);
    window.removeEventListener('touchmove', this.onNative, true);
    window.removeEventListener('touchend', this.onNative, true);
    window.removeEventListener('touchcancel', this.onNative, true);
    this.scene.events.off('update', this.onFrame);
    this.clearButtons();
    this.fingers.clear();
  }

  private clearButtons(): void {
    for (const btn of this.buttons) {
      this.input.setVirtual(btn.action, false);
      btn.bg.destroy();
      btn.icon.destroy();
    }
    this.buttons.length = 0;
  }
}

export function drawTouchIcon(g: Phaser.GameObjects.Graphics, x: number, y: number, icon: Icon, color: number, scale = 1): void {
  g.clear();
  g.fillStyle(color, 1);
  const s = scale;
  if (icon === 'left' || icon === 'right') {
    const dir = icon === 'left' ? -1 : 1;
    g.fillTriangle(x + dir * 8 * s, y, x - dir * 6 * s, y - 8 * s, x - dir * 6 * s, y + 8 * s);
    return;
  }
  if (icon === 'jump') {
    g.fillTriangle(x, y - 9 * s, x - 8 * s, y + 4 * s, x + 8 * s, y + 4 * s);
    g.fillRect(x - 2 * s, y + 2 * s, 4 * s, 6 * s);
    return;
  }
  if (icon === 'attack') {
    g.fillRect(x - 2 * s, y - 10 * s, 4 * s, 14 * s);
    g.fillTriangle(x - 2 * s, y - 10 * s, x + 2 * s, y - 10 * s, x, y - 15 * s);
    g.fillRect(x - 6 * s, y + 4 * s, 12 * s, 3 * s);
    g.fillRect(x - 1.5 * s, y + 7 * s, 3 * s, 4 * s);
    return;
  }
  if (icon === 'dash') {
    g.fillTriangle(x - 8 * s, y - 6 * s, x - 1 * s, y, x - 8 * s, y + 6 * s);
    g.fillTriangle(x - 1 * s, y - 6 * s, x + 6 * s, y, x - 1 * s, y + 6 * s);
    return;
  }
  g.fillRect(x - 5 * s, y - 6 * s, 3 * s, 12 * s);
  g.fillRect(x + 2 * s, y - 6 * s, 3 * s, 12 * s);
}

function wantsTouch(): boolean {
  if (typeof window === 'undefined') return false;
  if (new URLSearchParams(window.location.search).get('touch') === '1') return true;
  const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  return coarse || navigator.maxTouchPoints > 0;
}
