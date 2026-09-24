import Phaser from 'phaser';
import { DEFAULT_LEVEL } from '../data/levels';
import { t } from '../i18n';
import { InputManager } from '../systems/InputManager';

// Título mínimo: logo en texto y "Pulsá Enter".
export class TitleScene extends Phaser.Scene {
  private inputs!: InputManager;

  constructor() {
    super('Title');
  }

  create(): void {
    const { width, height } = this.scale;
    this.inputs = new InputManager(this);
    this.add
      .text(width / 2, height / 2 - 40, t('game.title'), { fontFamily: 'monospace', fontSize: '48px', color: '#F2C14E' })
      .setOrigin(0.5);
    this.add
      .text(width / 2, height / 2 + 4, t('game.subtitle'), { fontFamily: 'monospace', fontSize: '16px', color: '#CFE3F2' })
      .setOrigin(0.5);
    const prompt = this.add
      .text(width / 2, height / 2 + 60, t('title.press_start', { key: this.inputs.label('confirm') }), {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#F2EEE3',
      })
      .setOrigin(0.5);
    this.tweens.add({ targets: prompt, alpha: 0.3, duration: 700, yoyo: true, repeat: -1 });
  }

  override update(): void {
    this.inputs.update();
    if (this.inputs.justPressed('confirm')) this.scene.start('Level', { levelId: DEFAULT_LEVEL });
  }
}
