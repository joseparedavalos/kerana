import Phaser from 'phaser';
import { FONT_FAMILY } from '../config/fonts';
import { t } from '../i18n';
import { SaveManager } from '../systems/SaveManager';
import { drawTouchIcon } from '../systems/TouchControls';
import {
  defaultTouchLayout,
  resolveTouchLayout,
  stepTouchScale,
  touchButtonRadius,
  touchButtonSize,
  TOUCH_IDS,
  type TouchButtonId,
  type TouchLayout,
} from '../systems/touchLayout';
import { centerHitArea } from '../systems/hitArea';
import { setupView, VIEW } from '../systems/View';

interface Drawn {
  id: TouchButtonId;
  bg: Phaser.GameObjects.Arc;
  icon: Phaser.GameObjects.Graphics;
}

// Se arrastran los botones y se les cambia el tamaño. Se guarda al tocar Listo.
export class ButtonLayoutScene extends Phaser.Scene {
  private optionsReturn = 'Title';
  private layout!: TouchLayout;
  private drawn: Drawn[] = [];
  private selected: TouchButtonId = 'jump';
  private drag: { id: TouchButtonId; dx: number; dy: number } | null = null;

  constructor() {
    super('Buttons');
  }

  init(data: { optionsReturn?: string }): void {
    this.optionsReturn = data.optionsReturn ?? 'Title';
    this.drag = null;
  }

  create(): void {
    setupView(this);
    const { width, height } = VIEW;
    this.layout = resolveTouchLayout(SaveManager.current.settings.touchLayout ?? defaultTouchLayout());
    this.add.rectangle(0, 0, width, height, 0x1b1a2e).setOrigin(0);
    this.add.text(width / 2, 18, t('buttons.title'), { fontFamily: FONT_FAMILY, fontSize: '16px', color: '#F2C14E' }).setOrigin(0.5);
    this.add.text(width / 2, 38, t('buttons.hint'), { fontFamily: FONT_FAMILY, fontSize: '10px', color: '#CFE3F2' }).setOrigin(0.5);

    for (const id of TOUCH_IDS) {
      const bg = this.add.circle(0, 0, 8, 0x1b1a2e, 0.4).setStrokeStyle(1.5, 0xf2eee3, 0.9).setDepth(2);
      const icon = this.add.graphics().setDepth(3);
      this.drawn.push({ id, bg, icon });
    }
    this.paint();

    this.tool(width / 2 - 150, height - 22, '−', () => this.resize(-1));
    this.tool(width / 2 - 110, height - 22, '+', () => this.resize(1));
    this.tool(width / 2 + 10, height - 22, t('buttons.reset'), () => {
      this.layout = defaultTouchLayout();
      this.paint();
    });
    this.tool(width / 2 + 110, height - 22, t('buttons.done'), () => this.finish());

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      const point = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      if (point.y > height - 40) return;
      const hit = this.hit(point.x, point.y);
      if (!hit) return;
      this.selected = hit;
      const place = this.layout[hit];
      this.drag = { id: hit, dx: point.x - place.x, dy: point.y - place.y };
      this.paint();
    });
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!this.drag || !pointer.isDown) return;
      const point = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      const id = this.drag.id;
      const next = resolveTouchLayout({
        ...this.layout,
        [id]: { ...this.layout[id], x: point.x - this.drag.dx, y: point.y - this.drag.dy },
      });
      this.layout[id] = next[id];
      this.paint();
    });
    this.input.on('pointerup', () => {
      this.drag = null;
    });
  }

  private hit(x: number, y: number): TouchButtonId | null {
    let found: TouchButtonId | null = null;
    let best = Infinity;
    for (const id of TOUCH_IDS) {
      const place = this.layout[id];
      const dx = x - place.x;
      const dy = y - place.y;
      const r = touchButtonRadius(id, place.scale);
      const d = dx * dx + dy * dy;
      if (d <= r * r && d < best) {
        best = d;
        found = id;
      }
    }
    return found;
  }

  private resize(dir: 1 | -1): void {
    const id = this.selected;
    const place = this.layout[id];
    const next = resolveTouchLayout({
      ...this.layout,
      [id]: { ...place, scale: stepTouchScale(place.scale, dir) },
    });
    this.layout[id] = next[id];
    this.paint();
  }

  private paint(): void {
    for (const item of this.drawn) {
      const place = this.layout[item.id];
      const size = touchButtonSize(item.id) * place.scale;
      const selected = item.id === this.selected;
      item.bg.setPosition(place.x, place.y).setRadius(size / 2).setStrokeStyle(selected ? 2.5 : 1.5, selected ? 0xf2c14e : 0xf2eee3, 0.95);
      drawTouchIcon(item.icon, place.x, place.y, item.id, 0xf2eee3, place.scale);
    }
  }

  private tool(x: number, y: number, label: string, onClick: () => void): void {
    const text = this.add
      .text(x, y, label, { fontFamily: FONT_FAMILY, fontSize: '14px', color: '#F2EEE3' })
      .setOrigin(0.5)
      .setDepth(4);
    centerHitArea(text, 72, 28);
    text.on('pointerdown', () => onClick());
  }

  private finish(): void {
    SaveManager.updateSettings({ touchLayout: this.layout });
    this.scene.start('Options', { returnScene: this.optionsReturn });
  }
}
