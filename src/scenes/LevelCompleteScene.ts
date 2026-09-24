import Phaser from 'phaser';
import { FONT_FAMILY } from '../config/fonts';
import { GAMEPLAY } from '../config/gameplay';
import type { LevelDef } from '../data/types';
import { t } from '../i18n';
import { InputManager } from '../systems/InputManager';
import { SaveManager } from '../systems/SaveManager';

// Pantalla de nivel completado (GDD §8.8): hijo liberado, don obtenido y plumas. Luego, al mapa.
export class LevelCompleteScene extends Phaser.Scene {
  private inputs!: InputManager;
  private def!: LevelDef;

  constructor() {
    super('LevelComplete');
  }

  init(data: { level: LevelDef }): void {
    this.def = data.level;
  }

  create(): void {
    const { width, height } = this.scale;
    this.inputs = new InputManager(this);
    this.add.rectangle(0, 0, width, height, 0x1b1a2e).setOrigin(0);
    this.add
      .text(width / 2, height / 2 - 60, t('level_complete.title'), { fontFamily: FONT_FAMILY, fontSize: '20px', color: '#F2C14E' })
      .setOrigin(0.5);

    let y = height / 2 - 20;
    if (this.def.boss) {
      this.add
        .text(width / 2, y, t('level_complete.freed', { name: t(`speaker.${this.def.boss}`) }), {
          fontFamily: FONT_FAMILY,
          fontSize: '12px',
          color: '#F2EEE3',
        })
        .setOrigin(0.5);
      y += 20;
    }
    if (this.def.gift) {
      this.add
        .text(width / 2, y, t('level_complete.gift', { gift: t(`gift.${this.def.gift}`) }), {
          fontFamily: FONT_FAMILY,
          fontSize: '12px',
          color: '#F2EEE3',
        })
        .setOrigin(0.5);
      y += 20;
    }
    const feathers = SaveManager.getFeathers(this.def.id).filter(Boolean).length;
    this.add
      .text(width / 2, y, t('level_complete.feathers', { current: feathers, max: GAMEPLAY.hud.featherMax }), {
        fontFamily: FONT_FAMILY,
        fontSize: '12px',
        color: '#F2EEE3',
      })
      .setOrigin(0.5);

    const hint = this.add
      .text(width / 2, height - 30, t('level_complete.continue_hint', { key: this.inputs.label('confirm') }), {
        fontFamily: FONT_FAMILY,
        fontSize: '10px',
        color: '#CFE3F2',
      })
      .setOrigin(0.5);
    this.tweens.add({ targets: hint, alpha: 0.3, duration: 700, yoyo: true, repeat: -1 });
  }

  override update(): void {
    this.inputs.update();
    if (this.inputs.justPressed('confirm') || this.inputs.justPressed('jump')) this.scene.start('Map');
  }
}
