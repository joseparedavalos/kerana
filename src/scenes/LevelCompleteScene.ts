import Phaser from 'phaser';
import { FONT_FAMILY } from '../config/fonts';
import { GAMEPLAY } from '../config/gameplay';
import { WORLD_LEVELS } from '../data/levels';
import { TAU_ARRIVAL_SLIDES } from '../data/story';
import type { LevelDef } from '../data/types';
import { t } from '../i18n';
import { InputManager } from '../systems/InputManager';
import { SaveManager } from '../systems/SaveManager';
import { setupView, VIEW } from '../systems/View';

// Pantalla de nivel completado (GDD §8.8): hijo liberado, don obtenido y plumas. Luego, al mapa (o al final).
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
    setupView(this);
    const { width, height } = VIEW;
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
    if (this.inputs.justPressed('confirm') || this.inputs.justPressed('jump')) this.continueOn();
  }

  /** Después del último nivel aparece Tau y sigue Yvága (GDD §2.6, §7); si no, el mapa. */
  private continueOn(): void {
    const last = WORLD_LEVELS[WORLD_LEVELS.length - 1];
    if (this.def.id !== last.id) {
      this.scene.start('Map');
      return;
    }
    this.scene.start('Story', { slides: TAU_ARRIVAL_SLIDES, nextScene: 'Level', nextData: { levelId: 'yvaga' } });
  }
}
