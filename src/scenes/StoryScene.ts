import Phaser from 'phaser';
import { FONT_FAMILY } from '../config/fonts';
import { ANIMS_SUFFIX, PLAYER_KEY, PLAYER_PLACEHOLDER_KEY } from '../assets/manifest';
import type { StorySlide } from '../data/story';
import { queueBackgrounds } from '../assets/backgrounds';
import { AudioManager } from '../systems/AudioManager';
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
  private touchAdvance = false;
  private text!: Phaser.GameObjects.Text;
  private hint!: Phaser.GameObjects.Text;
  private skip!: Phaser.GameObjects.Text;

  private skipReady = false;

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
    // El prólogo y el final, con el canto de Eichu; la llegada de Tau ya suena a Yvága.
    const next = (this.nextData as { levelId?: string } | undefined)?.levelId;
    AudioManager.music(next === 'yvaga' ? 'yvaga' : 'title');
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
    this.add.zone(width / 2, height / 2, width, height).setInteractive().on('pointerdown', () => {
      this.touchAdvance = true;
    });
    // Saltar siempre visible: en el celular no hay botón de pausa durante la historia.
    this.skip = this.add
      .text(width - 12, 12, t('story.skip'), { fontFamily: FONT_FAMILY, fontSize: '11px', color: '#F2C14E' })
      .setOrigin(1, 0)
      .setDepth(3)
      .setInteractive({ useHandCursor: true });
    this.skip.on('pointerdown', () => {
      if (this.skipReady) this.finish();
    });
    this.time.delayedCall(600, () => {
      this.skipReady = true;
    });
    this.advanceSlide();
  }

  override update(_time: number, delta: number): void {
    this.inputs.update();
    SaveManager.addPlayTime(delta);
    const advance = this.skipReady && (this.inputs.justPressed('jump') || this.inputs.justPressed('attack') || this.touchAdvance);
    this.touchAdvance = false;

    if (this.skipReady && this.inputs.isDown('pause')) {
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
    if (slide.figures) this.backdrop.push(...this.addFigures(slide.figures, width, height));

    const bottom = slide.band === 'bottom';
    const bandHeight = bottom ? BAND_BOTTOM_HEIGHT : BAND_HEIGHT;
    this.band.setVisible(slide.imageKey !== undefined || bottom).setSize(width, bandHeight).setY(bottom ? height - bandHeight / 2 : height / 2);
    this.text.setY(bottom ? height - BAND_BOTTOM_TEXT_Y : height / 2);
  }

  /** Sprites del prólogo, parados sobre la franja del texto. Kerana y Tau miran a la derecha. */
  private addFigures(kind: NonNullable<StorySlide['figures']>, width: number, height: number): Phaser.GameObjects.GameObject[] {
    const feet = height - BAND_BOTTOM_HEIGHT + 6;
    const parts: Phaser.GameObjects.GameObject[] = [];
    const ground = this.add.rectangle(0, feet - 4, width, 14, 0x241c18).setOrigin(0, 0).setDepth(0);
    const grass = this.add.rectangle(0, feet - 4, width, 3, 0x3f6b3a).setOrigin(0, 0).setDepth(0);
    parts.push(ground, grass);

    const keranaX = kind === 'taken' ? width * 0.58 : kind === 'wake' ? width * 0.42 : width * 0.3;
    // Las hojas de Kerana y de Tau miran a la derecha. En el rapto se miran.
    const keranaFacesRight = kind !== 'taken';
    const kerana = this.placeFigure(PLAYER_KEY, `${PLAYER_KEY}_idle`, keranaX, feet, keranaFacesRight);
    if (kerana) parts.push(kerana);

    if (kind === 'taken') {
      // El cuadro de Tau es más chico: sin este factor queda a la mitad de Kerana.
      const tau = this.placeFigure('tau_disguise', 'tau_disguise_idle', width * 0.38, feet, true, 1.08);
      if (tau) parts.push(tau);
    }

    if (kind === 'wake' && kerana) {
      const handX = kerana.x + (kerana.flipX ? -1 : 1) * kerana.displayWidth * 0.16;
      const handY = kerana.y - kerana.displayHeight * 0.42;
      const glow = this.add.ellipse(handX, handY, 28, 18, 0xf2c14e, 0.35).setDepth(0);
      const core = this.add.circle(handX, handY, 4, 0xfff2c0).setDepth(0);
      this.tweens.add({ targets: glow, alpha: 0.12, scaleX: 1.15, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      parts.push(glow, core);
    }
    return parts;
  }

  /** Un sprite ya cargado. Las hojas miran a la derecha: `flipX` solo si tiene que mirar a la izquierda. */
  private placeFigure(
    key: string,
    anim: string,
    x: number,
    feet: number,
    facesRight: boolean,
    scale?: number,
  ): Phaser.GameObjects.Sprite | null {
    const animated = this.textures.exists(key) && this.anims.exists(anim);
    const texture = animated ? key : key === PLAYER_KEY && this.textures.exists(PLAYER_PLACEHOLDER_KEY) ? PLAYER_PLACEHOLDER_KEY : null;
    if (!texture) return null;
    const sprite = this.add.sprite(x, feet, texture).setOrigin(0.5, 1).setDepth(0).setFlipX(!facesRight);
    if (animated) {
      const meta = this.cache.json.get(key + ANIMS_SUFFIX) as { detail?: number } | undefined;
      sprite.setScale(scale ?? 1.5 / (meta?.detail ?? 2));
      sprite.play(anim);
    } else {
      sprite.setScale(scale ?? 2);
    }
    return sprite;
  }

  private finish(): void {
    this.scene.start(this.nextScene, this.nextData);
  }
}
