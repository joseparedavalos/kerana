import Phaser from 'phaser';
import { FONT_FAMILY } from '../config/fonts';
import { t } from '../i18n';
import { SaveManager } from '../systems/SaveManager';
import { drawTouchIcon } from '../systems/TouchControls';
import {
  defaultTouchLayout,
  inMoveZone,
  moveArrowOffset,
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

// La zona de moverse (`move`) se dibuja con dos piezas, una por flecha; se mueve y se agranda entera.
interface Drawn {
  id: TouchButtonId;
  side: -1 | 0 | 1;
  bg: Phaser.GameObjects.Arc;
  icon: Phaser.GameObjects.Graphics;
}

// Se arrastran los botones y se les cambia el tamaño. Se guarda al tocar Listo.
export class ButtonLayoutScene extends Phaser.Scene {
  private optionsReturn = 'Title';
  // S90: desde la pausa se entra directo y al cerrar se vuelve a la pausa, sin pasar por Opciones.
  private returnTo: 'Options' | 'Pause' = 'Options';
  private layout!: TouchLayout;
  private drawn: Drawn[] = [];
  private selected: TouchButtonId = 'jump';
  private drag: { id: TouchButtonId; dx: number; dy: number } | null = null;

  constructor() {
    super('Buttons');
  }

  init(data: { optionsReturn?: string; returnTo?: 'Options' | 'Pause' }): void {
    this.optionsReturn = data.optionsReturn ?? 'Title';
    this.returnTo = data.returnTo ?? 'Options';
    this.drag = null;
    // La instancia se reusa: las piezas de la visita anterior ya se destruyeron con la escena.
    this.drawn = [];
  }

  create(): void {
    setupView(this);
    const { width, height } = VIEW;
    this.layout = resolveTouchLayout(SaveManager.current.settings.touchLayout ?? defaultTouchLayout());
    this.add.rectangle(0, 0, width, height, 0x1b1a2e).setOrigin(0);
    this.add.text(width / 2, 18, t('buttons.title'), { fontFamily: FONT_FAMILY, fontSize: '16px', color: '#F2C14E' }).setOrigin(0.5);
    this.add.text(width / 2, 38, t('buttons.hint'), { fontFamily: FONT_FAMILY, fontSize: '10px', color: '#CFE3F2' }).setOrigin(0.5);

    for (const id of TOUCH_IDS) {
      for (const side of id === 'move' ? ([-1, 1] as const) : ([0] as const)) {
        const bg = this.add.circle(0, 0, 8, 0x1b1a2e, 0.4).setStrokeStyle(1.5, 0xf2eee3, 0.9).setDepth(2);
        const icon = this.add.graphics().setDepth(3);
        this.drawn.push({ id, side, bg, icon });
      }
    }
    this.paint();

    this.tool(width / 2 - 150, height - 22, '−', () => this.resize(-1));
    this.tool(width / 2 - 110, height - 22, '+', () => this.resize(1));
    this.tool(width / 2 + 10, height - 22, t('buttons.reset'), () => {
      this.layout = defaultTouchLayout();
      this.paint();
    });
    this.tool(width / 2 + 110, height - 22, t('buttons.done'), () => this.finish());

    // S90: antes se ignoraba todo toque en los 40 px de abajo (la franja de − + Reiniciar Listo), y ahí están de
    // fábrica las flechas: no se podían elegir ni arrastrar. Ahora solo se ignora el toque que cae en una herramienta.
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      if (over.length > 0) return;
      const point = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
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
      const inside = id === 'move' ? inMoveZone(place, x, y) : d <= r * r;
      if (inside && d < best) {
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
      const x = place.x + item.side * moveArrowOffset(place.scale);
      item.bg.setPosition(x, place.y).setRadius(size / 2).setStrokeStyle(selected ? 2.5 : 1.5, selected ? 0xf2c14e : 0xf2eee3, 0.95);
      const icon = item.id === 'move' ? (item.side < 0 ? 'left' : 'right') : item.id;
      drawTouchIcon(item.icon, x, place.y, icon, 0xf2eee3, place.scale);
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
    if (this.returnTo === 'Pause') this.scene.start('Pause');
    else this.scene.start('Options', { returnScene: this.optionsReturn });
  }
}
