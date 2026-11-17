import Phaser from 'phaser';
import type { Action, InputManager } from './InputManager';
import { rotatePromptShown } from './mobileShell';
import { SaveManager } from './SaveManager';
import {
  inMoveZone,
  moveArrowOffset,
  moveDirection,
  resolveTouchLayout,
  touchButtonRadius,
  touchButtonSize,
  type TouchButtonId,
  type TouchButtonPlace,
} from './touchLayout';

const ALPHA = 0.55;
const ALPHA_DOWN = 0.95;
const INK = 0xf2eee3;
const INK_DOWN = 0x1b1a2e;
// Un color por acción: se distinguen con el dedo encima, que tapa el ícono.
const ACCENT: Record<string, number> = {
  move: 0xf2eee3,
  jump: 0xf2c14e,
  attack: 0xe07848,
  dash: 0x7ec8e0,
  pause: 0xf2eee3,
};
// Los punteros del ratón (con `?touch=1` en la PC) no comparten número con los dedos.
const MOUSE_ID = 1000;

export type TouchIcon = 'left' | 'right' | 'jump' | 'attack' | 'dash' | 'pause';
type ButtonId = Exclude<TouchButtonId, 'move'>;

interface Point {
  id: number;
  x: number;
  y: number;
}

interface VirtualButton {
  action: Action;
  x: number;
  y: number;
  radius: number;
  scale: number;
  bg: Phaser.GameObjects.Arc;
  icon: Phaser.GameObjects.Image;
  iconKind: TouchIcon;
  held: boolean;
}

interface MoveArrow {
  dir: -1 | 1;
  x: number;
  bg: Phaser.GameObjects.Arc;
  icon: Phaser.GameObjects.Image;
}

/** S90: izquierda y derecha son una sola zona. El dedo que entra en ella la maneja hasta que se levanta. */
interface MoveZone {
  place: TouchButtonPlace;
  arrows: MoveArrow[];
  finger: number | null;
  dir: -1 | 0 | 1;
}

/**
 * Botones del celular, en la misma capa que los corazones.
 * Izquierda: una zona deslizante con dos flechas. Derecha: salto (el más grande), sable y dash en arco.
 * Varios dedos a la vez: cada toque que sigue en la pantalla mantiene su botón.
 * Se ven en pantalla táctil, o en la PC si la URL lleva `?touch=1`.
 */
export class TouchControls {
  private readonly buttons: VirtualButton[] = [];
  private move: MoveZone | null = null;
  private readonly fingers: Point[] = [];
  private readonly onNative: (event: TouchEvent) => void;
  private readonly onFrame: () => void;
  private hidden = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly input: InputManager,
  ) {
    this.onNative = (event) => {
      if (this.hidden) return;
      // El botón de pantalla completa es del navegador: si se cancela el toque, su click no llega.
      const target = event.target as HTMLElement | null;
      if (target?.closest?.('#kerana-fullscreen')) return;
      if (event.cancelable) event.preventDefault();
      this.fingers.length = 0;
      // Con el aviso de girar el teléfono encima, ningún toque llega a los botones.
      if (!rotatePromptShown()) {
        for (let i = 0; i < event.touches.length; i++) {
          const touch = event.touches[i];
          const point = this.toWorld(touch.pageX, touch.pageY);
          this.fingers.push({ id: touch.identifier, x: point.x, y: point.y });
        }
      }
      this.apply(this.fingers);
    };
    this.onFrame = () => {
      if (this.hidden || this.fingers.length > 0) return;
      const points: Point[] = [];
      const cam = this.scene.cameras.main;
      for (const pointer of this.scene.input.manager.pointers) {
        if (!pointer.isDown || pointer.wasTouch) continue;
        const point = cam.getWorldPoint(pointer.x, pointer.y);
        points.push({ id: MOUSE_ID + pointer.id, x: point.x, y: point.y });
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
    if (hidden) {
      this.fingers.length = 0;
      this.apply(this.fingers);
    }
    for (const btn of this.buttons) btn.bg.setVisible(!hidden);
    for (const btn of this.buttons) btn.icon.setVisible(!hidden);
    for (const arrow of this.move?.arrows ?? []) {
      arrow.bg.setVisible(!hidden);
      arrow.icon.setVisible(!hidden);
    }
  }

  private createButtons(): void {
    const layout = resolveTouchLayout(SaveManager.current.settings.touchLayout);
    this.addMoveZone(layout.move);
    for (const id of Object.keys(layout) as TouchButtonId[]) {
      if (id === 'move') continue;
      const place = layout[id];
      this.addButton(id, place.x, place.y, touchButtonSize(id) * place.scale, place.scale);
    }
  }


  /** Brillo arriba: el botón se lee con volumen, no como un círculo plano. */
  private highlight(x: number, y: number, size: number): void {
    this.scene.add.circle(x, y - size * 0.16, size * 0.3, 0xffffff, 0.14).setDepth(1000.5);
  }

  private circle(x: number, y: number, size: number, accent: number): Phaser.GameObjects.Arc {
    return this.scene.add
      .circle(x, y, size / 2, 0x1b1a2e, ALPHA)
      .setStrokeStyle(3, accent, 1)
      .setDepth(1000);
  }

  private addMoveZone(place: TouchButtonPlace): void {
    const size = touchButtonSize('move') * place.scale;
    const arrows: MoveArrow[] = [];
    for (const dir of [-1, 1] as const) {
      const x = place.x + dir * moveArrowOffset(place.scale);
      const bg = this.circle(x, place.y, size, ACCENT.move);
      this.highlight(x, place.y, size);
      const icon = touchIcon(this.scene, x, place.y, dir < 0 ? 'left' : 'right', size);
      arrows.push({ dir, x, bg, icon });
    }
    this.move = { place, arrows, finger: null, dir: 0 };
  }

  private addButton(action: ButtonId, x: number, y: number, size: number, scale: number): void {
    const bg = this.circle(x, y, size, ACCENT[action] ?? INK);
    this.highlight(x, y, size);
    const mark = touchIcon(this.scene, x, y, action, size);
    this.buttons.push({ action, x, y, radius: touchButtonRadius(action, scale), scale, bg, icon: mark, iconKind: action, held: false });
  }

  /** Página → coordenadas del mundo de la UI (la cámara tiene zoom). */
  private toWorld(pageX: number, pageY: number): { x: number; y: number } {
    const scale = this.scene.scale;
    const sx = scale.transformX(pageX);
    const sy = scale.transformY(pageY);
    return this.scene.cameras.main.getWorldPoint(sx, sy);
  }

  private apply(list: readonly Point[]): void {
    this.applyMove(list);
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
      btn.bg.setFillStyle(held ? ACCENT[btn.action] ?? INK : 0x1b1a2e, held ? ALPHA_DOWN : ALPHA);
      btn.bg.setStrokeStyle(held ? 5 : 3, ACCENT[btn.action] ?? INK, 1);
      btn.bg.setScale(held ? 0.94 : 1);
      btn.icon.setTint(held ? INK_DOWN : 0xffffff);
      this.input.setVirtual(btn.action, held);
    }
  }

  /**
   * El dedo que entró en la zona manda hasta que se levanta, aunque se salga un poco: mueve hacia el lado en que
   * está respecto del medio entre las flechas, y cambia de lado al deslizar.
   */
  private applyMove(list: readonly Point[]): void {
    const move = this.move;
    if (!move) return;
    let finger: Point | null = null;
    if (move.finger !== null) {
      for (const point of list) if (point.id === move.finger) finger = point;
    }
    if (!finger) {
      for (const point of list) {
        if (inMoveZone(move.place, point.x, point.y)) {
          finger = point;
          break;
        }
      }
    }
    move.finger = finger ? finger.id : null;
    const dir = finger ? moveDirection(move.place, finger.x) : 0;
    this.input.setVirtual('left', dir < 0);
    this.input.setVirtual('right', dir > 0);
    if (dir === move.dir) return;
    move.dir = dir;
    for (const arrow of move.arrows) {
      const on = arrow.dir === dir;
      arrow.bg.setFillStyle(on ? ACCENT.move : 0x1b1a2e, on ? ALPHA_DOWN : ALPHA);
      arrow.bg.setStrokeStyle(on ? 5 : 3, ACCENT.move, 1);
      arrow.bg.setScale(on ? 0.94 : 1);
      arrow.icon.setTint(on ? INK_DOWN : 0xffffff);
    }
  }

  destroy(): void {
    window.removeEventListener('touchstart', this.onNative, true);
    window.removeEventListener('touchmove', this.onNative, true);
    window.removeEventListener('touchend', this.onNative, true);
    window.removeEventListener('touchcancel', this.onNative, true);
    this.scene.events.off('update', this.onFrame);
    this.clearButtons();
    this.fingers.length = 0;
  }

  private clearButtons(): void {
    for (const btn of this.buttons) {
      this.input.setVirtual(btn.action, false);
      btn.bg.destroy();
      btn.icon.destroy();
    }
    this.buttons.length = 0;
    if (this.move) {
      this.input.setVirtual('left', false);
      this.input.setVirtual('right', false);
      for (const arrow of this.move.arrows) {
        arrow.bg.destroy();
        arrow.icon.destroy();
      }
      this.move = null;
    }
  }
}


const ICON_KEY: Record<TouchIcon, string> = {
  left: 'ui_icon_left',
  right: 'ui_icon_right',
  jump: 'ui_icon_jump',
  attack: 'ui_icon_attack',
  dash: 'ui_icon_dash',
  pause: 'ui_icon_pause',
};

/** Ícono de pixel art del botón, blanco teñido. Cae al dibujo por código si falta la textura. */
function touchIcon(scene: Phaser.Scene, x: number, y: number, icon: TouchIcon, size: number): Phaser.GameObjects.Image {
  const key = ICON_KEY[icon];
  const img = scene.add.image(x, y, scene.textures.exists(key) ? key : ICON_KEY.pause).setDepth(1001);
  img.setDisplaySize(size * 0.52, size * 0.52);
  return img;
}

export function drawTouchIcon(g: Phaser.GameObjects.Graphics, x: number, y: number, icon: TouchIcon, color: number, scale = 1): void {
  g.clear();
  const s = scale;
  // Sombra corrida un píxel: le da cuerpo al ícono.
  g.fillStyle(0x000000, 0.35);
  drawIcon(g, x + 1 * s, y + 1 * s, icon, s);
  g.fillStyle(color, 1);
  drawIcon(g, x, y, icon, s);
}

function drawIcon(g: Phaser.GameObjects.Graphics, x: number, y: number, icon: TouchIcon, s: number): void {
  if (icon === 'left' || icon === 'right') {
    const dir = icon === 'left' ? -1 : 1;
    // Chevrón grueso: se lee de lejos.
    g.fillTriangle(x + dir * 9 * s, y, x - dir * 2 * s, y - 9 * s, x - dir * 2 * s, y + 9 * s);
    g.fillTriangle(x + dir * 2 * s, y, x - dir * 9 * s, y - 9 * s, x - dir * 9 * s, y + 9 * s);
    return;
  }
  if (icon === 'jump') {
    g.fillTriangle(x, y - 11 * s, x - 9 * s, y + 1 * s, x + 9 * s, y + 1 * s);
    g.fillRect(x - 3 * s, y, 6 * s, 9 * s);
    return;
  }
  if (icon === 'attack') {
    // Sable: hoja curva, guarda y empuñadura.
    g.fillTriangle(x + 1 * s, y - 13 * s, x - 3 * s, y + 2 * s, x + 4 * s, y + 2 * s);
    g.fillRect(x - 7 * s, y + 2 * s, 14 * s, 3 * s);
    g.fillRect(x - 1.5 * s, y + 5 * s, 3 * s, 6 * s);
    g.fillRect(x - 3 * s, y + 10 * s, 6 * s, 2 * s);
    return;
  }
  if (icon === 'dash') {
    g.fillTriangle(x - 9 * s, y - 7 * s, x - 1 * s, y, x - 9 * s, y + 7 * s);
    g.fillTriangle(x - 2 * s, y - 7 * s, x + 6 * s, y, x - 2 * s, y + 7 * s);
    g.fillTriangle(x + 4 * s, y - 7 * s, x + 11 * s, y, x + 4 * s, y + 7 * s);
    return;
  }
  g.fillRoundedRect(x - 6 * s, y - 7 * s, 4 * s, 14 * s, 1 * s);
  g.fillRoundedRect(x + 2 * s, y - 7 * s, 4 * s, 14 * s, 1 * s);
}

function wantsTouch(): boolean {
  if (typeof window === 'undefined') return false;
  if (new URLSearchParams(window.location.search).get('touch') === '1') return true;
  const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  return coarse || navigator.maxTouchPoints > 0;
}
