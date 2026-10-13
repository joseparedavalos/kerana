import Phaser from 'phaser';
import { FONT_FAMILY } from '../config/fonts';
import type { Action, InputManager } from './InputManager';
import { VIEW } from './View';

const SIZE = 36;
const GAP = 8;
const EDGE = 12;
const ALPHA = 0.38;
const ALPHA_DOWN = 0.85;

interface VirtualButton {
  action: Action;
  bg: Phaser.GameObjects.Arc;
  label: Phaser.GameObjects.Text;
  pointerId: number | null;
}

/**
 * Botones del celular, en la misma capa que los corazones.
 * Izquierda: moverse. Derecha: saltar, atacar y dash.
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
    const y = VIEW.height - EDGE - SIZE / 2;
    const step = SIZE + GAP;
    this.addButton('left', EDGE + SIZE / 2, y, '◀');
    this.addButton('right', EDGE + SIZE / 2 + step, y, '▶');

    const jumpX = VIEW.width - EDGE - SIZE / 2;
    this.addButton('jump', jumpX, y, '▲');
    this.addButton('attack', jumpX - step, y, 'X');
    this.addButton('dash', jumpX - step * 2, y, 'C');
  }

  private addButton(action: Action, x: number, y: number, symbol: string): void {
    const bg = this.scene.add
      .circle(x, y, SIZE / 2, 0x1b1a2e, ALPHA)
      .setStrokeStyle(1, 0xf2eee3, 0.85)
      .setDepth(1000);
    const label = this.scene.add
      .text(x, y, symbol, { fontFamily: FONT_FAMILY, fontSize: '14px', color: '#F2EEE3' })
      .setOrigin(0.5)
      .setDepth(1001);
    const hit = new Phaser.Geom.Circle(SIZE / 2, SIZE / 2, SIZE / 2 + 6);
    bg.setInteractive(hit, Phaser.Geom.Circle.Contains);
    const btn: VirtualButton = { action, bg, label, pointerId: null };
    bg.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      btn.pointerId = pointer.id;
      bg.setFillStyle(0xf2eee3, ALPHA_DOWN);
      label.setColor('#1B1A2E');
      this.input.setVirtual(action, true);
    });
    this.buttons.push(btn);
  }

  private release(btn: VirtualButton): void {
    if (btn.pointerId === null) return;
    btn.pointerId = null;
    btn.bg.setFillStyle(0x1b1a2e, ALPHA);
    btn.label.setColor('#F2EEE3');
    this.input.setVirtual(btn.action, false);
  }

  destroy(): void {
    this.scene.input.off('pointerup', this.onUp);
    this.scene.input.off('pointerupoutside', this.onUp);
    for (const btn of this.buttons) {
      this.release(btn);
      btn.bg.destroy();
      btn.label.destroy();
    }
    this.buttons.length = 0;
  }
}

function wantsTouch(): boolean {
  if (typeof window === 'undefined') return false;
  if (new URLSearchParams(window.location.search).get('touch') === '1') return true;
  const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  return coarse || navigator.maxTouchPoints > 0;
}
