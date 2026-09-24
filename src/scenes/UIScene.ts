import Phaser from 'phaser';
import { FONT_FAMILY } from '../config/fonts';
import { t } from '../i18n';
import { ensurePlaceholder } from '../utils/placeholder';
import { EventBus, GameEvents } from '../systems/EventBus';
import { setupView, VIEW } from '../systems/View';

const HEART_SPACING = 14;
const MARGIN = 8;
const FEATHER_ICON = 'hud_pluma';
const LUZ_ICON = 'hud_luz_arasy';
const BAR_WIDTH = 40;
const BOSS_BAR_WIDTH = 240;
const BOSS_BAR_COLOR = 0xb8322a;

// HUD en paralelo al nivel. Solo escucha EventBus (placeholders dibujados por código).
export class UIScene extends Phaser.Scene {
  private hearts: Phaser.GameObjects.Image[] = [];
  private featherText!: Phaser.GameObjects.Text;
  private luzIcon!: Phaser.GameObjects.Image;
  private luzBarBg!: Phaser.GameObjects.Rectangle;
  private luzBarFill!: Phaser.GameObjects.Rectangle;
  private bossBar!: Phaser.GameObjects.Container;
  private bossBarFill!: Phaser.GameObjects.Rectangle;
  private bossName!: Phaser.GameObjects.Text;

  constructor() {
    super('UI');
  }

  create(): void {
    setupView(this);
    this.hearts = [];
    ensurePlaceholder(this, FEATHER_ICON, 10, 10);
    ensurePlaceholder(this, LUZ_ICON, 10, 10);

    const featherY = MARGIN + HEART_SPACING;
    this.add.image(MARGIN, featherY, FEATHER_ICON).setOrigin(0, 0);
    this.featherText = this.add
      .text(MARGIN + 14, featherY, '0/0', { fontFamily: FONT_FAMILY, fontSize: '9px', color: '#F2EEE3' })
      .setOrigin(0, 0);

    const luzY = featherY + 14;
    this.luzIcon = this.add.image(MARGIN, luzY, LUZ_ICON).setOrigin(0, 0).setVisible(false);
    this.luzBarBg = this.add.rectangle(MARGIN + 14, luzY + 5, BAR_WIDTH, 4).setOrigin(0, 0.5).setStrokeStyle(1, 0xf2eee3).setVisible(false);
    this.luzBarFill = this.add.rectangle(MARGIN + 15, luzY + 5, BAR_WIDTH - 2, 2, 0xc8c8e6).setOrigin(0, 0.5).setVisible(false);

    // Barra del jefe (GDD §6.0): nombre, epíteto y vida, abajo al centro.
    const { width, height } = VIEW;
    const barY = height - 14;
    this.bossName = this.add
      .text(0, -8, '', { fontFamily: FONT_FAMILY, fontSize: '9px', color: '#F2EEE3' })
      .setOrigin(0.5, 1);
    const bg = this.add.rectangle(0, 0, BOSS_BAR_WIDTH, 6).setStrokeStyle(1, 0xf2eee3);
    this.bossBarFill = this.add.rectangle(-BOSS_BAR_WIDTH / 2 + 1, 0, BOSS_BAR_WIDTH - 2, 4, BOSS_BAR_COLOR).setOrigin(0, 0.5);
    this.bossBar = this.add.container(width / 2, barY, [this.bossName, bg, this.bossBarFill]).setVisible(false);

    const heartsState = this.registry.get('hearts') as { current: number; max: number } | undefined;
    if (heartsState) this.renderHearts(heartsState.current, heartsState.max);
    const feathersState = this.registry.get('feathers') as { current: number; max: number } | undefined;
    if (feathersState) this.renderFeathers(feathersState.current, feathersState.max);

    EventBus.on(GameEvents.heartsChanged, this.renderHearts, this);
    EventBus.on(GameEvents.feathersChanged, this.renderFeathers, this);
    EventBus.on(GameEvents.luzArasyChanged, this.renderLuzArasy, this);
    EventBus.on(GameEvents.bossBarShow, this.showBossBar, this);
    EventBus.on(GameEvents.bossHpChanged, this.renderBossHp, this);
    EventBus.on(GameEvents.bossBarHide, this.hideBossBar, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      EventBus.off(GameEvents.bossBarShow, this.showBossBar, this);
      EventBus.off(GameEvents.bossHpChanged, this.renderBossHp, this);
      EventBus.off(GameEvents.bossBarHide, this.hideBossBar, this);
      EventBus.off(GameEvents.heartsChanged, this.renderHearts, this);
      EventBus.off(GameEvents.feathersChanged, this.renderFeathers, this);
      EventBus.off(GameEvents.luzArasyChanged, this.renderLuzArasy, this);
    });
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

  private showBossBar(nameKey: string, epithetKey: string): void {
    this.bossName.setText(`${t(nameKey)} · ${t(epithetKey)}`);
    this.bossBar.setVisible(true).setAlpha(0);
    this.tweens.add({ targets: this.bossBar, alpha: 1, duration: 300 });
  }

  private renderBossHp(fraction: number): void {
    this.bossBarFill.width = Math.max(0, (BOSS_BAR_WIDTH - 2) * Phaser.Math.Clamp(fraction, 0, 1));
  }

  private hideBossBar(): void {
    this.bossBar.setVisible(false);
  }

  private renderFeathers(current: number, max: number): void {
    this.featherText.setText(`${current}/${max}`);
  }

  private renderLuzArasy(active: boolean, fraction: number): void {
    this.luzIcon.setVisible(active);
    this.luzBarBg.setVisible(active);
    this.luzBarFill.setVisible(active);
    this.luzBarFill.width = Math.max(0, (BAR_WIDTH - 2) * Phaser.Math.Clamp(fraction, 0, 1));
  }
}
