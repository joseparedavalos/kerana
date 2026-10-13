import Phaser from 'phaser';
import type { InputManager, Action } from './InputManager';

const BUTTON_SIZE = 56;
const MARGIN = 16;
const ALPHA = 0.55;
const ALPHA_PRESSED = 0.85;

interface VirtualButton {
  action: Action;
  zone: Phaser.GameObjects.Zone;
  bg: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
  isDown: boolean;
}

/**
 * Controles táctiles en pantalla (solo se muestran si el dispositivo tiene touch).
 * Alimentan el mismo InputManager que usa el teclado.
 */
export class TouchControls {
  private buttons: VirtualButton[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly input: InputManager,
  ) {
    // Solo en dispositivos con touch.
    const isTouch = this.scene.sys.game.device.input.touch;
    if (!isTouch) return;

    this.createButtons();
  }

  private createButtons(): void {
    const { width, height } = this.scene.scale;
    const bottom = height - MARGIN - BUTTON_SIZE / 2;

    // Izquierda
    this.addButton('left', MARGIN + BUTTON_SIZE / 2, bottom, '◄');
    // Derecha
    this.addButton('right', MARGIN + BUTTON_SIZE * 1.6, bottom, '►');

    // Saltar (derecha)
    this.addButton('jump', width - MARGIN - BUTTON_SIZE / 2, bottom, 'A');
    // Atacar
    this.addButton('attack', width - MARGIN - BUTTON_SIZE * 1.7, bottom, 'X');
    // Dash
    this.addButton('dash', width - MARGIN - BUTTON_SIZE * 2.9, bottom, 'C');

    // Escuchar pointer events globales para soltar si el dedo sale del botón.
    this.scene.input.on('pointerup', this.onPointerUp, this);
    this.scene.input.on('pointerupoutside', this.onPointerUp, this);
  }

  private addButton(action: Action, x: number, y: number, symbol: string): void {
    const bg = this.scene.add
      .rectangle(x, y, BUTTON_SIZE, BUTTON_SIZE, 0x1b1a2e, ALPHA)
      .setStrokeStyle(2, 0xf2eee3, 0.6)
      .setDepth(1000)
      .setScrollFactor(0);

    const label = this.scene.add
      .text(x, y, symbol, {
        fontFamily: 'monospace',
        fontSize: '22px',
        color: '#F2EEE3',
      })
      .setOrigin(0.5)
      .setDepth(1001)
      .setScrollFactor(0);

    const zone = this.scene.add
      .zone(x, y, BUTTON_SIZE + 12, BUTTON_SIZE + 12)
      .setInteractive()
      .setDepth(1002)
      .setScrollFactor(0);

    const btn: VirtualButton = { action, zone, bg, label, isDown: false };

    zone.on('pointerdown', () => {
      btn.isDown = true;
      bg.setFillStyle(0x2a2840, ALPHA_PRESSED);
      this.input.setVirtual(action, true);
    });

    zone.on('pointerup', () => this.release(btn));
    zone.on('pointerout', () => this.release(btn));

    this.buttons.push(btn);
  }

  private release(btn: VirtualButton): void {
    if (!btn.isDown) return;
    btn.isDown = false;
    btn.bg.setFillStyle(0x1b1a2e, ALPHA);
    this.input.setVirtual(btn.action, false);
  }

  private onPointerUp(): void {
    for (const btn of this.buttons) this.release(btn);
  }

  destroy(): void {
    this.scene.input.off('pointerup', this.onPointerUp, this);
    this.scene.input.off('pointerupoutside', this.onPointerUp, this);
    for (const btn of this.buttons) {
      btn.zone.destroy();
      btn.bg.destroy();
      btn.label.destroy();
    }
    this.buttons = [];
  }
}
