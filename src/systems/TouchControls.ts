import Phaser from 'phaser';
import { FONT_FAMILY } from '../config/fonts';
import type { Action, InputManager } from './InputManager';
import { fixedOffset, VIEW } from './View';

const BUTTON = 52;
const PAD = 14;
const ALPHA = 0.45;
const ALPHA_DOWN = 0.8;

interface VirtualButton {
  action: Action;
  zone: Phaser.GameObjects.Zone;
  bg: Phaser.GameObjects.Arc;
  label: Phaser.GameObjects.Text;
  pointerId: number | null;
}

/**
 * Botones en pantalla para celular. Viven en la escena UI (la de arriba) para recibir el toque,
 * y escriben en el mismo InputManager que el teclado.
 * Se muestran con pantalla táctil, puntero grueso, o `?touch=1` (para probar en la PC).
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
    const hud = fixedOffset(this.scene.cameras.main);
    const y = hud.y + VIEW.height - PAD - BUTTON / 2;
    this.addButton('left', hud.x + PAD + BUTTON / 2, y, '◀');
    this.addButton('right', hud.x + PAD + BUTTON * 1.7, y, '▶');
    this.addButton('dash', hud.x + VIEW.width - PAD - BUTTON * 2.55, y, 'C', 0.78);
    this.addButton('attack', hud.x + VIEW.width - PAD - BUTTON * 1.45, y, 'X');
    this.addButton('jump', hud.x + VIEW.width - PAD - BUTTON / 2, y, 'A');
    this.addButton('pause', hud.x + VIEW.width - PAD - 16, hud.y + PAD + 16, 'II', 0.55);
  }

  private addButton(action: Action, x: number, y: number, symbol: string, scale = 1): void {
    const size = BUTTON * scale;
    const bg = this.scene.add
      .circle(x, y, size / 2, 0x1b1a2e, ALPHA)
      .setStrokeStyle(2, 0xf2eee3, 0.7)
      .setScrollFactor(0)
      .setDepth(1000);
    const label = this.scene.add
      .text(x, y, symbol, { fontFamily: FONT_FAMILY, fontSize: `${Math.round(16 * scale)}px`, color: '#F2EEE3' })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(1001);
    const zone = this.scene.add.zone(x, y, size + 10, size + 10).setScrollFactor(0).setDepth(1002).setInteractive();
    const btn: VirtualButton = { action, zone, bg, label, pointerId: null };
    zone.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      btn.pointerId = pointer.id;
      bg.setFillStyle(0xf2eee3, ALPHA_DOWN);
      this.input.setVirtual(action, true);
    });
    this.buttons.push(btn);
  }

  private release(btn: VirtualButton): void {
    if (btn.pointerId === null) return;
    btn.pointerId = null;
    btn.bg.setFillStyle(0x1b1a2e, ALPHA);
    this.input.setVirtual(btn.action, false);
  }

  destroy(): void {
    this.scene.input.off('pointerup', this.onUp);
    this.scene.input.off('pointerupoutside', this.onUp);
    for (const btn of this.buttons) {
      this.release(btn);
      btn.zone.destroy();
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
