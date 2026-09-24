import Phaser from 'phaser';
import { FONT_FAMILY } from '../config/fonts';
import { t } from '../i18n';
import { InputManager } from '../systems/InputManager';
import { SaveManager, type SaveSettings } from '../systems/SaveManager';

// Opciones (GDD §8.6): volumen, idioma, modo asistido, sacudida, destellos, velocidad del texto y borrar partida.
type Row = { labelKey: string; valueText: () => string; onChange: (dir: 1 | -1) => void };

const ROW_HEIGHT = 22;
const ERASE_CONFIRM_WINDOW_MS = 3000;

export class OptionsScene extends Phaser.Scene {
  private inputs!: InputManager;
  private returnScene = 'Title';
  private rows: Row[] = [];
  private texts: Phaser.GameObjects.Text[] = [];
  private selected = 0;
  private eraseArmedUntil = 0;

  constructor() {
    super('Options');
  }

  init(data: { returnScene?: string }): void {
    this.returnScene = data.returnScene ?? 'Title';
    this.selected = 0;
    this.eraseArmedUntil = 0;
  }

  create(): void {
    const { width, height } = this.scale;
    this.inputs = new InputManager(this);
    this.add.rectangle(0, 0, width, height, 0x1b1a2e).setOrigin(0);
    this.add.text(width / 2, 24, t('options.title'), { fontFamily: FONT_FAMILY, fontSize: '16px', color: '#F2C14E' }).setOrigin(0.5);

    this.rows = this.buildRows();
    const startY = 60;
    this.texts = this.rows.map((_row, i) =>
      this.add.text(width / 2, startY + i * ROW_HEIGHT, '', { fontFamily: FONT_FAMILY, fontSize: '11px', color: '#F2EEE3' }).setOrigin(0.5),
    );
    this.refresh();
  }

  override update(_time: number, delta: number): void {
    this.inputs.update();
    if (this.eraseArmedUntil > 0 && this.time.now > this.eraseArmedUntil) {
      this.eraseArmedUntil = 0;
      this.refresh();
    }
    if (this.inputs.justPressed('down')) this.selected = (this.selected + 1) % this.rows.length;
    else if (this.inputs.justPressed('up')) this.selected = (this.selected - 1 + this.rows.length) % this.rows.length;
    else if (this.inputs.justPressed('right')) this.rows[this.selected].onChange(1);
    else if (this.inputs.justPressed('left')) this.rows[this.selected].onChange(-1);
    else if (this.inputs.justPressed('confirm')) this.rows[this.selected].onChange(1);
    else if (this.inputs.justPressed('pause')) {
      this.scene.start(this.returnScene);
      return;
    }
    void delta;
    this.refresh();
  }

  private setting<K extends keyof SaveSettings>(key: K, value: SaveSettings[K]): void {
    SaveManager.updateSettings({ [key]: value } as Partial<SaveSettings>);
  }

  private buildRows(): Row[] {
    const s = () => SaveManager.current.settings;
    const pct = (v: number) => `${Math.round(v * 100)}%`;
    return [
      {
        labelKey: 'options.music',
        valueText: () => pct(s().music),
        onChange: (d) => this.setting('music', Phaser.Math.Clamp(s().music + d * 0.1, 0, 1)),
      },
      {
        labelKey: 'options.sfx',
        valueText: () => pct(s().sfx),
        onChange: (d) => this.setting('sfx', Phaser.Math.Clamp(s().sfx + d * 0.1, 0, 1)),
      },
      {
        labelKey: 'options.lang',
        valueText: () => s().lang.toUpperCase(),
        onChange: () => this.setting('lang', s().lang === 'es' ? 'en' : 'es'),
      },
      {
        labelKey: 'options.assist',
        valueText: () => t(s().assist ? 'options.on' : 'options.off'),
        onChange: () => this.setting('assist', !s().assist),
      },
      {
        labelKey: 'options.shake',
        valueText: () => t(s().shake ? 'options.on' : 'options.off'),
        onChange: () => this.setting('shake', !s().shake),
      },
      {
        labelKey: 'options.flashes',
        valueText: () => t(s().flashes ? 'options.on' : 'options.off'),
        onChange: () => this.setting('flashes', !s().flashes),
      },
      {
        labelKey: 'options.text_speed',
        valueText: () => t(`options.text_speed.${(['slow', 'normal', 'fast'] as const)[s().textSpeed - 1]}`),
        onChange: (d) => this.setting('textSpeed', (((s().textSpeed - 1 + d + 3) % 3) + 1) as SaveSettings['textSpeed']),
      },
      {
        labelKey: 'options.erase_save',
        valueText: () => (this.eraseArmedUntil > 0 ? t('options.erase_confirm', { key: this.inputs.label('confirm') }) : ''),
        onChange: () => this.onEraseChange(),
      },
      { labelKey: 'options.back', valueText: () => '', onChange: () => this.scene.start(this.returnScene) },
    ];
  }

  private onEraseChange(): void {
    if (this.eraseArmedUntil > 0) {
      SaveManager.startNewGame();
      this.eraseArmedUntil = 0;
      this.scene.start('Title');
      return;
    }
    this.eraseArmedUntil = this.time.now + ERASE_CONFIRM_WINDOW_MS;
  }

  private refresh(): void {
    this.rows.forEach((row, i) => {
      const label = t(row.labelKey);
      const value = row.valueText();
      const line = value ? `${label}: ${value}` : label;
      const text = this.texts[i];
      text.setText(i === this.selected ? `> ${line}` : line);
      text.setColor(i === this.selected ? '#F2C14E' : '#F2EEE3');
    });
  }
}
