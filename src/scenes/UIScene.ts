import Phaser from 'phaser';
import { EventBus, GameEvents } from '../systems/EventBus';

const HEART_SPACING = 14;
const MARGIN = 8;

// HUD en paralelo al nivel. Solo escucha EventBus (corazones como placeholder).
export class UIScene extends Phaser.Scene {
  private hearts: Phaser.GameObjects.Image[] = [];

  constructor() {
    super('UI');
  }

  create(): void {
    this.hearts = [];
    const state = this.registry.get('hearts') as { current: number; max: number } | undefined;
    if (state) this.renderHearts(state.current, state.max);
    EventBus.on(GameEvents.heartsChanged, this.renderHearts, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => EventBus.off(GameEvents.heartsChanged, this.renderHearts, this));
  }

  private renderHearts(current: number, max: number): void {
    while (this.hearts.length < max) {
      const i = this.hearts.length;
      this.hearts.push(this.add.image(MARGIN + i * HEART_SPACING, MARGIN, 'heart_full').setOrigin(0, 0));
    }
    this.hearts.forEach((img, i) => {
      img.setVisible(i < max);
      img.setTexture(i < current ? 'heart_full' : 'heart_empty');
    });
  }
}
