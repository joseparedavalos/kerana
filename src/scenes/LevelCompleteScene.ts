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

// Pantalla de nivel completado: hijo, don y chipas juntos. Siguiente sigue la lista; el último va a Yvága.
export class LevelCompleteScene extends Phaser.Scene {
  private inputs!: InputManager;
  private def!: LevelDef;
  private left = false;

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
      .text(width / 2, 48, t('level_complete.title'), { fontFamily: FONT_FAMILY, fontSize: '20px', color: '#F2C14E' })
      .setOrigin(0.5);

    let y = 100;
    if (this.def.boss) {
      this.add
        .text(width / 2, y, t('level_complete.freed', { name: t(`speaker.${this.def.boss}`) }), {
          fontFamily: FONT_FAMILY,
          fontSize: '16px',
          color: '#F2EEE3',
        })
        .setOrigin(0.5);
      y += 28;
    }
    if (this.def.gift) {
      this.add
        .text(width / 2, y, t('level_complete.gift', { gift: t(`gift.${this.def.gift}`) }), {
          fontFamily: FONT_FAMILY,
          fontSize: '12px',
          color: '#CFE3F2',
        })
        .setOrigin(0.5);
      y += 28;
    }
    this.addChipas(width / 2, y);

    this.bigButton(width / 2, height - 88, t('level_complete.next'), () => this.goNext());
    const map = this.add
      .text(width / 2, height - 40, t('level_complete.map'), { fontFamily: FONT_FAMILY, fontSize: '12px', color: '#CFE3F2' })
      .setOrigin(0.5);
    map.setInteractive(new Phaser.Geom.Rectangle(-80, -14, 160, 28), Phaser.Geom.Rectangle.Contains);
    map.on('pointerdown', () => this.goMap());
  }

  /** Las chipas de este nivel, en color las juntadas. */
  private addChipas(x: number, y: number): void {
    const got = SaveManager.getFeathers(this.def.id);
    const n = GAMEPLAY.hud.featherMax;
    const step = 26;
    for (let i = 0; i < n; i++) {
      const key = got[i] ? 'ui_chipa' : 'ui_chipa_empty';
      if (!this.textures.exists(key)) continue;
      this.add.image(x + (i - (n - 1) / 2) * step, y, key).setScale(0.75);
    }
    const current = got.filter(Boolean).length;
    this.add
      .text(x, y + 22, t('level_complete.feathers', { current, max: n }), {
        fontFamily: FONT_FAMILY,
        fontSize: '11px',
        color: '#F2C14E',
      })
      .setOrigin(0.5);
  }

  private bigButton(x: number, y: number, label: string, onClick: () => void): void {
    const bg = this.add.rectangle(x, y, 220, 36, 0xf2c14e).setInteractive({ useHandCursor: true });
    const text = this.add
      .text(x, y, label, { fontFamily: FONT_FAMILY, fontSize: '16px', color: '#1B1A2E' })
      .setOrigin(0.5);
    bg.on('pointerdown', onClick);
    text.setInteractive({ useHandCursor: true }).on('pointerdown', onClick);
  }

  override update(): void {
    this.inputs.update();
    if (this.inputs.justPressed('confirm') || this.inputs.justPressed('jump')) this.goNext();
    else if (this.inputs.justPressed('pause')) this.goMap();
  }

  /** El siguiente de la lista. Si no hay otro, Yvága, como hasta ahora. */
  private goNext(): void {
    if (this.left) return;
    this.left = true;
    const index = WORLD_LEVELS.findIndex((level) => level.id === this.def.id);
    const next = index >= 0 ? WORLD_LEVELS[index + 1] : undefined;
    if (next) {
      this.scene.start('Level', { levelId: next.id });
      return;
    }
    this.scene.start('Story', { slides: TAU_ARRIVAL_SLIDES, nextScene: 'Level', nextData: { levelId: 'yvaga' } });
  }

  private goMap(): void {
    if (this.left) return;
    this.left = true;
    this.scene.start('Map');
  }
}
