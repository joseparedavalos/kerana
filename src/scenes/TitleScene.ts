import Phaser from 'phaser';
import { FONT_FAMILY } from '../config/fonts';
import { PROLOGUE_SLIDES } from '../data/story';
import { t } from '../i18n';
import { InputManager } from '../systems/InputManager';
import { SaveManager } from '../systems/SaveManager';

// Título (GDD §8.2): cielo con 7 estrellas tenues, logo y menú.
export class TitleScene extends Phaser.Scene {
  private inputs!: InputManager;
  private items: { labelKey: string; action: () => void }[] = [];
  private texts: Phaser.GameObjects.Text[] = [];
  private selected = 0;

  constructor() {
    super('Title');
  }

  create(): void {
    SaveManager.load();
    const { width, height } = this.scale;
    this.inputs = new InputManager(this);
    this.add.rectangle(0, 0, width, height, 0x0c0b1a).setOrigin(0);
    for (let i = 0; i < 7; i++) {
      this.add.circle(30 + i * ((width - 60) / 6), 26 + (i % 3) * 8, 1.5, 0xf2eee3, 0.5);
    }

    this.add.text(width / 2, height / 2 - 70, t('game.title'), { fontFamily: FONT_FAMILY, fontSize: '48px', color: '#F2C14E' }).setOrigin(0.5);
    this.add
      .text(width / 2, height / 2 - 26, t('game.subtitle'), { fontFamily: FONT_FAMILY, fontSize: '16px', color: '#CFE3F2' })
      .setOrigin(0.5);

    this.items = [
      { labelKey: 'title.new_game', action: () => this.newGame() },
      ...(SaveManager.hasSave() ? [{ labelKey: 'title.continue', action: () => this.continueGame() }] : []),
      { labelKey: 'title.options', action: () => this.scene.start('Options', { returnScene: 'Title' }) },
      { labelKey: 'title.credits', action: () => this.scene.start('Credits') },
    ];
    const startY = height / 2 + 16;
    this.texts = this.items.map((item, i) =>
      this.add
        .text(width / 2, startY + i * 22, t(item.labelKey), { fontFamily: FONT_FAMILY, fontSize: '13px', color: '#F2EEE3' })
        .setOrigin(0.5),
    );
    this.selected = 0;
    this.refresh();
  }

  override update(): void {
    this.inputs.update();
    if (this.inputs.justPressed('down')) this.selected = (this.selected + 1) % this.items.length;
    else if (this.inputs.justPressed('up')) this.selected = (this.selected - 1 + this.items.length) % this.items.length;
    else if (this.inputs.justPressed('confirm') || this.inputs.justPressed('jump')) this.items[this.selected].action();
    this.refresh();
  }

  private newGame(): void {
    SaveManager.startNewGame();
    this.scene.start('Story', { slides: PROLOGUE_SLIDES, nextScene: 'Map' });
  }

  private continueGame(): void {
    SaveManager.load();
    this.scene.start('Map');
  }

  private refresh(): void {
    this.texts.forEach((text, i) => text.setColor(i === this.selected ? '#F2C14E' : '#F2EEE3'));
  }
}
