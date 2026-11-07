import Phaser from 'phaser';
import { FONT_FAMILY } from '../config/fonts';
import { GAMEPLAY } from '../config/gameplay';
import { WORLD_LEVELS } from '../data/levels';
import { TAU_ARRIVAL_SLIDES } from '../data/story';
import type { LevelDef } from '../data/types';
import { t } from '../i18n';
import { AudioManager } from '../systems/AudioManager';
import { InputManager } from '../systems/InputManager';
import { formatLevelTime, SaveManager } from '../systems/SaveManager';
import { centerHitArea } from '../systems/hitArea';
import { setupView, VIEW } from '../systems/View';

// Pantalla de nivel completado: hijo, don y chipas juntos. Siguiente sigue la lista; el último va a Yvága.
export class LevelCompleteScene extends Phaser.Scene {
  private inputs!: InputManager;
  private def!: LevelDef;
  private left = false;
  private timeMs?: number;
  private record = false;

  constructor() {
    super('LevelComplete');
  }

  init(data: { level: LevelDef; timeMs?: number; record?: boolean }): void {
    this.def = data.level;
    this.timeMs = data.timeMs;
    this.record = data.record === true;
    // Phaser reusa la instancia de la escena: sin esto, la segunda vez los botones no hacían nada (S38).
    this.left = false;
  }

  create(): void {
    setupView(this);
    AudioManager.music('map');
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
    if (this.def.gift === 'heart_up') {
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
    this.addTime(width / 2, y + 52);

    this.bigButton(width / 2, height - 88, t('level_complete.next'), () => this.goNext());
    const map = this.add
      .text(width / 2, height - 40, t('level_complete.map'), { fontFamily: FONT_FAMILY, fontSize: '12px', color: '#CFE3F2' })
      .setOrigin(0.5);
    centerHitArea(map, 160, 28);
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

  /** Tiempo de la corrida; a la derecha "¡Récord!" o, debajo, la mejor marca. */
  private addTime(x: number, y: number): void {
    if (this.timeMs === undefined) return;
    const style = { fontFamily: FONT_FAMILY, fontSize: '12px' };
    const line = this.add
      .text(x, y, t('level_complete.time', { time: formatLevelTime(this.timeMs) }), { ...style, color: '#F2EEE3' })
      .setOrigin(0.5)
      .setName('level_complete_time');
    if (this.record) {
      // Corre la línea a la izquierda para que el par quede centrado.
      const badge = this.add.text(0, y, t('level_complete.record'), { ...style, color: '#F2C14E' }).setOrigin(0, 0.5);
      const gap = 12;
      const total = line.width + gap + badge.width;
      line.setX(x - total / 2 + line.width / 2);
      badge.setX(x - total / 2 + line.width + gap);
      return;
    }
    const best = SaveManager.getBestTime(this.def.id);
    if (best === undefined) return;
    this.add
      .text(x, y + 20, t('level_complete.best', { time: formatLevelTime(best) }), { ...style, color: '#CFE3F2' })
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
    if (this.inputs.justPressed('confirm') || this.inputs.justPressed('jump')) {
      AudioManager.play('uiConfirm');
      this.goNext();
    } else if (this.inputs.justPressed('pause')) {
      AudioManager.play('uiBack');
      this.goMap();
    }
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
