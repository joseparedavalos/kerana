import Phaser from 'phaser';
import { FONT_FAMILY } from '../config/fonts';
import type { StorySlide } from '../data/story';
import { queueBackgrounds } from '../assets/backgrounds';
import { addDawn, addEichu, addNightSky } from '../systems/Backdrops';
import { t } from '../i18n';
import { SaveManager } from '../systems/SaveManager';
import { charsToShow } from '../systems/textReveal';
import { InputManager } from '../systems/InputManager';
import { setupView, VIEW } from '../systems/View';

const HOLD_TO_SKIP_MS = 500;
/** Franja del texto sobre una imagen: alto al centro, alto abajo (entra el texto de 3 líneas y la ayuda) y centro del texto sobre el borde de abajo. */
const BAND_HEIGHT = 90;
const BAND_BOTTOM_HEIGHT = 112;
const BAND_BOTTOM_TEXT_Y = 60;

// Diapositivas genéricas (GDD §8.3): prólogo y final. Recibe `slides` y a qué escena ir al terminar.
export class StoryScene extends Phaser.Scene {
  private inputs!: InputManager;
  private slides: StorySlide[] = [];
  private nextScene = 'Map';
  private nextData?: object;
  private backdrop: Phaser.GameObjects.GameObject[] = [];
  private band!: Phaser.GameObjects.Rectangle;
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

  init(data: { slides: StorySlide[]; nextScene: string; nextData?: object }): void {
    this.slides = data.slides;
    this.nextScene = data.nextScene;
    this.nextData = data.nextData;
    this.backdrop = [];
    this.index = -1;
    this.holdMs = 0;
  }

  /** Solo las imágenes de estas diapositivas. */
  preload(): void {
    queueBackgrounds(this, this.slides.map((s) => s.imageKey));
  }

  create(): void {
    setupView(this);
    const { width, height } = VIEW;
    this.inputs = new InputManager(this);
    this.add.rectangle(0, 0, width, height, 0x1b1a2e).setOrigin(0);
    // Franja para leer el texto sobre una imagen.
    this.band = this.add.rectangle(0, height / 2, width, BAND_HEIGHT, 0x1b1a2e, 0.75).setOrigin(0, 0.5).setDepth(1).setVisible(false);
    this.text = this.add
      .text(width / 2, height / 2, '', {
        fontFamily: FONT_FAMILY,
        fontSize: '13px',
        color: '#F2EEE3',
        wordWrap: { width: width - 140 },
        align: 'center',
        lineSpacing: 6,
      })
      .setOrigin(0.5)
      .setDepth(2);
    this.hint = this.add
      .text(width / 2, height - 12, '', { fontFamily: FONT_FAMILY, fontSize: '9px', color: '#CFE3F2' })
      .setOrigin(0.5)
      .setDepth(2);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => SaveManager.persist());
    this.advanceSlide();
  }

  override update(_time: number, delta: number): void {
    this.inputs.update();
    SaveManager.addPlayTime(delta);
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
    const slide = this.slides[this.index];
    this.showBackdrop(slide);
    this.fullText = t(slide.textKey);
    this.shownChars = 0;
    this.charTimerMs = 0;
    this.text.setText('');
    this.hint.setText('');
  }

  /** Imagen (o su placeholder), cielo de noche y Eichu de la diapositiva; la franja no tapa lo principal. */
  private showBackdrop(slide: StorySlide): void {
    const { width, height } = VIEW;
    for (const part of this.backdrop) {
      this.tweens.killTweensOf(part);
      part.destroy();
    }
    this.backdrop = [];
    if (slide.imageKey) this.backdrop.push(...addDawn(this, slide.imageKey, width, height));
    else if (slide.night) this.backdrop.push(...addNightSky(this, width, height));
    if (slide.eichu) this.backdrop.push(...addEichu(this, slide.eichu, width, height));

    const bottom = slide.band === 'bottom';
    const bandHeight = bottom ? BAND_BOTTOM_HEIGHT : BAND_HEIGHT;
    this.band.setVisible(slide.imageKey !== undefined).setSize(width, bandHeight).setY(bottom ? height - bandHeight / 2 : height / 2);
    this.text.setY(bottom ? height - BAND_BOTTOM_TEXT_Y : height / 2);
  }

  private finish(): void {
    this.scene.start(this.nextScene, this.nextData);
  }
}
