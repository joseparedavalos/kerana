import Phaser from 'phaser';
import { FONT_FAMILY } from '../config/fonts';
import { t } from '../i18n';
import { InputManager } from '../systems/InputManager';
import { setupView, VIEW } from '../systems/View';

// Créditos (GDD §8.9): idea y dirección, desarrollo, arte y sonido, agradecimientos.
export class CreditsScene extends Phaser.Scene {
  private inputs!: InputManager;

  constructor() {
    super('Credits');
  }

  create(): void {
    setupView(this);
    const { width, height } = VIEW;
    this.inputs = new InputManager(this);
    this.add.rectangle(0, 0, width, height, 0x1b1a2e).setOrigin(0);
    this.add.text(width / 2, 30, t('credits.title'), { fontFamily: FONT_FAMILY, fontSize: '18px', color: '#F2C14E' }).setOrigin(0.5);

    const lines = [t('credits.direction'), t('credits.development'), t('credits.art_audio'), t('credits.thanks')];
    lines.forEach((line, i) => {
      this.add.text(width / 2, 90 + i * 22, line, { fontFamily: FONT_FAMILY, fontSize: '11px', color: '#F2EEE3' }).setOrigin(0.5);
    });

    // Frase de prueba de la tipografía (ASSETS §8): confirma que se ven ñ y las vocales nasales.
    this.add
      .text(width / 2, height - 46, t('credits.font_test'), { fontFamily: FONT_FAMILY, fontSize: '11px', color: '#CFE3F2' })
      .setOrigin(0.5);

    this.add
      .text(width / 2, height - 18, t('credits.back_hint', { key: this.inputs.label('pause') }), {
        fontFamily: FONT_FAMILY,
        fontSize: '9px',
        color: '#CFE3F2',
      })
      .setOrigin(0.5);
  }

  override update(): void {
    this.inputs.update();
    if (this.inputs.justPressed('pause') || this.inputs.justPressed('confirm')) this.scene.start('Title');
  }
}
