import Phaser from 'phaser';
import { FONT_FAMILY } from '../config/fonts';
import { t } from '../i18n';
import { EventBus, GameEvents } from '../systems/EventBus';
import { InputManager } from '../systems/InputManager';

// Pausa (GDD §8.6): Continuar · Reiniciar desde el fuego · Opciones · Salir al mapa.
export class PauseScene extends Phaser.Scene {
  private inputs!: InputManager;
  private items: { labelKey: string; action: () => void }[] = [];
  private texts: Phaser.GameObjects.Text[] = [];
  private selected = 0;

  constructor() {
    super('Pause');
  }

  create(): void {
    const { width, height } = this.scale;
    this.inputs = new InputManager(this);
    this.add.rectangle(0, 0, width, height, 0x1b1a2e, 0.85).setOrigin(0);
    this.add.text(width / 2, height / 2 - 70, t('pause.title'), { fontFamily: FONT_FAMILY, fontSize: '16px', color: '#F2C14E' }).setOrigin(0.5);

    this.items = [
      { labelKey: 'pause.continue', action: () => this.resumeLevel() },
      { labelKey: 'pause.restart', action: () => this.restart() },
      { labelKey: 'pause.options', action: () => this.scene.start('Options', { returnScene: 'Pause' }) },
      { labelKey: 'pause.exit_to_map', action: () => this.exitToMap() },
    ];
    this.selected = 0;
    this.texts = this.items.map((item, i) =>
      this.add
        .text(width / 2, height / 2 - 30 + i * 22, t(item.labelKey), { fontFamily: FONT_FAMILY, fontSize: '12px', color: '#F2EEE3' })
        .setOrigin(0.5),
    );
    this.refresh();
  }

  override update(): void {
    this.inputs.update();
    if (this.inputs.justPressed('down')) this.selected = (this.selected + 1) % this.items.length;
    else if (this.inputs.justPressed('up')) this.selected = (this.selected - 1 + this.items.length) % this.items.length;
    else if (this.inputs.justPressed('confirm') || this.inputs.justPressed('jump')) this.items[this.selected].action();
    else if (this.inputs.justPressed('pause')) this.resumeLevel();
    this.refresh();
  }

  private resumeLevel(): void {
    this.scene.resume('Level');
    this.scene.stop();
  }

  private restart(): void {
    EventBus.emit(GameEvents.restartFromCheckpoint);
    this.resumeLevel();
  }

  private exitToMap(): void {
    this.scene.stop('Level');
    this.scene.start('Map');
  }

  private refresh(): void {
    this.texts.forEach((text, i) => text.setColor(i === this.selected ? '#F2C14E' : '#F2EEE3'));
  }
}
