import Phaser from 'phaser';
import { FONT_FAMILY } from '../config/fonts';
import type { StorySlide } from '../data/story';
import { t } from '../i18n';
import { SaveManager } from '../systems/SaveManager';
import { charsToShow } from '../systems/textReveal';
import { InputManager } from '../systems/InputManager';

const HOLD_TO_SKIP_MS = 500;

// Diapositivas genéricas (GDD §8.3): prólogo y final. Recibe `slides` y a qué escena ir al terminar.
export class StoryScene extends Phaser.Scene {
  private inputs!: InputManager;
  private slides: StorySlide[] = [];
  private nextScene = 'Map';
  private index = -1;
  private fullText = '';
  private shownChars = 0;
  private charTimerMs = 0;
  private holdMs = 0;
  private text!: Phaser.GameObjects.Text;
  private hint!: Phaser.GameObjects.Text;

  constructor() {
    super('Story');
  }

  init(data: { slides: StorySlide[]; nextScene: string }): void {
    this.slides = data.slides;
    this.nextScene = data.nextScene;
    this.index = -1;
    this.holdMs = 0;
  }

  create(): void {
    const { width, height } = this.scale;
    this.inputs = new InputManager(this);
    this.add.rectangle(0, 0, width, height, 0x1b1a2e).setOrigin(0);
    this.text = this.add
      .text(width / 2, height / 2, '', {
        fontFamily: FONT_FAMILY,
        fontSize: '13px',
        color: '#F2EEE3',
        wordWrap: { width: width - 140 },
        align: 'center',
        lineSpacing: 6,
      })
      .setOrigin(0.5);
    this.hint = this.add
      .text(width / 2, height - 18, '', { fontFamily: FONT_FAMILY, fontSize: '9px', color: '#CFE3F2' })
      .setOrigin(0.5);
    this.advanceSlide();
  }

  override update(_time: number, delta: number): void {
    this.inputs.update();
    const advance = this.inputs.justPressed('jump') || this.inputs.justPressed('attack');

    if (this.inputs.isDown('pause')) {
      this.holdMs += delta;
      if (this.holdMs >= HOLD_TO_SKIP_MS) {
        this.finish();
        return;
      }
    } else {
      this.holdMs = 0;
    }

    if (this.shownChars < this.fullText.length) {
      this.charTimerMs += delta;
      const chars = charsToShow(this.charTimerMs, SaveManager.current.settings.textSpeed);
      this.shownChars = advance ? this.fullText.length : Math.min(this.fullText.length, Math.max(this.shownChars, chars));
      this.text.setText(this.fullText.slice(0, this.shownChars));
      return;
    }

    this.hint.setText(t('story.advance_hint', { key: this.inputs.label('attack') }));
    if (advance) this.advanceSlide();
  }

  private advanceSlide(): void {
    this.index++;
    if (this.index >= this.slides.length) {
      this.finish();
      return;
    }
    this.fullText = t(this.slides[this.index].textKey);
    this.shownChars = 0;
    this.charTimerMs = 0;
    this.text.setText('');
    this.hint.setText('');
  }

  private finish(): void {
    this.scene.start(this.nextScene);
  }
}
