import Phaser from 'phaser';
import { ANIMS_SUFFIX, PLAYER_KEY } from '../assets/manifest';
import { queueBackgrounds } from '../assets/backgrounds';
import { FONT_FAMILY } from '../config/fonts';
import { PROLOGUE_SLIDES } from '../data/story';
import { t } from '../i18n';
import { addEichu, addNightSky } from '../systems/Backdrops';
import { InputManager } from '../systems/InputManager';
import { SaveManager } from '../systems/SaveManager';
import { setupView, VIEW } from '../systems/View';

const SKY_KEY = 'bg_yvaga_far';

// Título: cielo de Yvága, Kerana en idle y un toque para empezar.
export class TitleScene extends Phaser.Scene {
  private inputs!: InputManager;
  private choices: Array<'start' | 'options' | 'credits'> = ['start', 'options', 'credits'];
  private selected = 0;
  private optionText!: Phaser.GameObjects.Text;
  private creditText!: Phaser.GameObjects.Text;
  private started = false;

  constructor() {
    super('Title');
  }

  preload(): void {
    queueBackgrounds(this, [SKY_KEY]);
  }

  create(): void {
    setupView(this);
    SaveManager.load();
    const { width, height } = VIEW;
    this.inputs = new InputManager(this);
    this.paintSky(width, height);
    this.paintKerana(height);
    this.paintLogo(width);

    const hint = this.add
      .text(width / 2, height - 46, t('title.tap'), { fontFamily: FONT_FAMILY, fontSize: '11px', color: '#F2C14E' })
      .setOrigin(0.5)
      .setDepth(5);
    this.tweens.add({ targets: hint, alpha: 0.25, duration: 700, yoyo: true, repeat: -1 });

    this.optionText = this.sideLink(64, height - 16, 'title.options', () => this.scene.start('Options', { returnScene: 'Title' }));
    this.creditText = this.sideLink(width - 64, height - 16, 'title.credits', () => this.scene.start('Credits'));

    this.add.zone(width / 2, height / 2, width, height).setOrigin(0.5).setInteractive().setDepth(1).on('pointerdown', () => this.startGame());
    this.refresh();
  }

  override update(): void {
    this.inputs.update();
    if (this.inputs.justPressed('left') || this.inputs.justPressed('up')) {
      this.selected = (this.selected - 1 + this.choices.length) % this.choices.length;
    } else if (this.inputs.justPressed('right') || this.inputs.justPressed('down')) {
      this.selected = (this.selected + 1) % this.choices.length;
    } else if (this.inputs.justPressed('confirm') || this.inputs.justPressed('jump')) {
      const choice = this.choices[this.selected];
      if (choice === 'options') this.scene.start('Options', { returnScene: 'Title' });
      else if (choice === 'credits') this.scene.start('Credits');
      else this.startGame();
    }
    this.refresh();
  }

  private paintSky(width: number, height: number): void {
    if (this.textures.exists(SKY_KEY)) {
      this.add.image(0, 0, SKY_KEY).setOrigin(0).setDisplaySize(width, height).setDepth(-10);
    } else {
      for (const part of addNightSky(this, width, height)) (part as unknown as Phaser.GameObjects.Components.Depth).setDepth(-10);
    }
    this.add.rectangle(0, 0, width, height, 0x070614, 0.45).setOrigin(0).setDepth(-8);
    for (const star of addEichu(this, { x: 0.28, y: 0.16, size: 72 }, width, height)) {
      (star as unknown as Phaser.GameObjects.Components.Depth).setDepth(-6);
    }
    this.add.rectangle(0, height - 28, width, 28, 0x100e18).setOrigin(0).setDepth(0);
    this.add.rectangle(0, height - 28, width, 1, 0x3a3458).setOrigin(0).setDepth(0);
  }

  private paintKerana(height: number): void {
    const animated = this.anims.exists(`${PLAYER_KEY}_idle`);
    const sprite = this.add.sprite(118, height - 26, animated ? PLAYER_KEY : 'kerana_placeholder').setOrigin(0.5, 1).setDepth(2);
    if (animated) {
      const meta = this.cache.json.get(PLAYER_KEY + ANIMS_SUFFIX) as { detail?: number } | undefined;
      sprite.setScale(1.5 / (meta?.detail ?? 2));
      sprite.play(`${PLAYER_KEY}_idle`);
    } else {
      sprite.setScale(2);
    }
  }

  private paintLogo(width: number): void {
    const x = width * 0.64;
    const y = 118;
    const glow = this.add.ellipse(x, y, 200, 42, 0xf2c14e, 0.22).setDepth(3);
    this.tweens.add({ targets: glow, alpha: 0.06, scaleX: 1.08, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.add
      .text(x, y, t('game.title'), { fontFamily: FONT_FAMILY, fontSize: '42px', color: '#F2C14E' })
      .setOrigin(0.5)
      .setDepth(4);
    this.add
      .text(x, y + 36, t('game.subtitle'), { fontFamily: FONT_FAMILY, fontSize: '14px', color: '#CFE3F2' })
      .setOrigin(0.5)
      .setDepth(4);
  }

  private sideLink(x: number, y: number, key: string, action: () => void): Phaser.GameObjects.Text {
    const text = this.add
      .text(x, y, t(key), { fontFamily: FONT_FAMILY, fontSize: '10px', color: '#F2EEE3' })
      .setOrigin(0.5)
      .setDepth(6);
    text.setInteractive(new Phaser.Geom.Rectangle(-40, -10, 80, 22), Phaser.Geom.Rectangle.Contains);
    text.on('pointerdown', () => action());
    return text;
  }

  private startGame(): void {
    if (this.started) return;
    this.started = true;
    if (SaveManager.hasSave()) this.continueGame();
    else this.newGame();
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
    const choice = this.choices[this.selected];
    this.optionText.setColor(choice === 'options' ? '#F2C14E' : '#F2EEE3');
    this.creditText.setColor(choice === 'credits' ? '#F2C14E' : '#F2EEE3');
  }
}
