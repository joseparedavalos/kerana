import Phaser from 'phaser';
import { FONT_FAMILY } from '../config/fonts';
import { WORLD_LEVELS } from '../data/levels';
import type { LevelDef } from '../data/types';
import { t } from '../i18n';
import { GAMEPLAY } from '../config/gameplay';
import { InputManager } from '../systems/InputManager';
import { SaveManager } from '../systems/SaveManager';

// Mapa del mundo (GDD §8.4). Fondo liso con nodos hasta que el autor tenga la ilustración (§4).
type NodeState = 'blocked' | 'available' | 'completed';

interface MapNode {
  level: LevelDef;
  x: number;
  y: number;
  dot: Phaser.GameObjects.Arc;
  star?: Phaser.GameObjects.Text;
}

// Caja que envuelve las coordenadas de la tabla del GDD §8.4 (longitud, latitud).
const LON_RANGE: [number, number] = [-58.3, -55.52];
const LAT_RANGE: [number, number] = [-26.86, -24.13];
const MARGIN = 60;
const TOP_MARGIN = 70;
const BOTTOM_MARGIN = 60;

export class WorldMapScene extends Phaser.Scene {
  private inputs!: InputManager;
  private nodes: MapNode[] = [];
  private selected = 0;
  private panelName!: Phaser.GameObjects.Text;
  private panelSubtitle!: Phaser.GameObjects.Text;
  private panelFeathers!: Phaser.GameObjects.Text;
  private skyStars: Phaser.GameObjects.Arc[] = [];

  constructor() {
    super('Map');
  }

  create(): void {
    const { width, height } = this.scale;
    this.inputs = new InputManager(this);
    this.add.rectangle(0, 0, width, height, 0x14132a).setOrigin(0);
    this.add.text(width / 2, 16, t('map.title'), { fontFamily: FONT_FAMILY, fontSize: '16px', color: '#F2C14E' }).setOrigin(0.5);

    this.buildSky();
    this.buildPath();
    this.nodes = WORLD_LEVELS.map((level) => this.buildNode(level));
    this.selected = this.firstSelectableIndex();
    this.refreshNodeStyles();

    this.panelName = this.add.text(width / 2, height - 46, '', { fontFamily: FONT_FAMILY, fontSize: '13px', color: '#F2EEE3' }).setOrigin(0.5);
    this.panelSubtitle = this.add.text(width / 2, height - 30, '', { fontFamily: FONT_FAMILY, fontSize: '9px', color: '#CFE3F2' }).setOrigin(0.5);
    this.panelFeathers = this.add.text(width / 2, height - 16, '', { fontFamily: FONT_FAMILY, fontSize: '9px', color: '#F2C14E' }).setOrigin(0.5);
    this.updatePanel();
  }

  override update(): void {
    this.inputs.update();
    const selectable = this.selectableIndices();
    if (selectable.length > 0) {
      if (this.inputs.justPressed('right')) this.moveSelection(selectable, 1);
      else if (this.inputs.justPressed('left')) this.moveSelection(selectable, -1);
      if (this.inputs.justPressed('confirm') || this.inputs.justPressed('jump')) this.enterSelected();
    }
    if (this.inputs.justPressed('pause')) this.scene.start('Title');
  }

  private buildSky(): void {
    const { width } = this.scale;
    const freedCount = SaveManager.current.freed.length;
    for (let i = 0; i < 7; i++) {
      const lit = i < freedCount;
      const star = this.add.circle(30 + i * ((width - 60) / 6), 40, lit ? 2.5 : 1.5, lit ? 0xf2eee3 : 0x4a4870, lit ? 1 : 0.6);
      this.skyStars.push(star);
    }
  }

  private buildPath(): void {
    const graphics = this.add.graphics({ lineStyle: { width: 1, color: 0x4a4870, alpha: 0.8 } });
    const points = WORLD_LEVELS.map((level) => this.projectNode(level));
    for (let i = 0; i < points.length - 1; i++) {
      graphics.lineBetween(points[i].x, points[i].y, points[i + 1].x, points[i + 1].y);
    }
  }

  private projectNode(level: LevelDef): { x: number; y: number } {
    const { width, height } = this.scale;
    const lon = level.mapNode.x;
    const lat = level.mapNode.y;
    const fx = (lon - LON_RANGE[0]) / (LON_RANGE[1] - LON_RANGE[0]);
    // Más al norte (latitud más alta, menos negativa) queda arriba en pantalla.
    const fy = (LAT_RANGE[1] - lat) / (LAT_RANGE[1] - LAT_RANGE[0]);
    return {
      x: MARGIN + fx * (width - MARGIN * 2),
      y: TOP_MARGIN + fy * (height - TOP_MARGIN - BOTTOM_MARGIN),
    };
  }

  private buildNode(level: LevelDef): MapNode {
    const { x, y } = this.projectNode(level);
    const dot = this.add.circle(x, y, 6).setStrokeStyle(1, 0xf2eee3);
    this.add.text(x, y + 10, String(level.order), { fontFamily: FONT_FAMILY, fontSize: '8px', color: '#F2EEE3' }).setOrigin(0.5, 0);
    return { level, x, y, dot };
  }

  private nodeState(level: LevelDef): NodeState {
    const save = SaveManager.current;
    if (level.boss && save.freed.includes(level.boss)) return 'completed';
    return level.order <= save.unlockedLevel ? 'available' : 'blocked';
  }

  private selectableIndices(): number[] {
    return this.nodes.map((_n, i) => i).filter((i) => this.nodeState(this.nodes[i].level) !== 'blocked');
  }

  private firstSelectableIndex(): number {
    const selectable = this.selectableIndices();
    return selectable[selectable.length - 1] ?? 0;
  }

  private moveSelection(selectable: number[], dir: 1 | -1): void {
    const pos = selectable.indexOf(this.selected);
    const nextPos = Phaser.Math.Clamp(pos + dir, 0, selectable.length - 1);
    this.selected = selectable[nextPos];
    this.refreshNodeStyles();
    this.updatePanel();
  }

  private refreshNodeStyles(): void {
    const colors: Record<NodeState, number> = { blocked: 0x2a2946, available: 0xcfe3f2, completed: 0xf2c14e };
    this.nodes.forEach((node, i) => {
      const state = this.nodeState(node.level);
      node.dot.setFillStyle(colors[state]);
      node.dot.setScale(i === this.selected ? 1.5 : 1);
      if (state === 'completed' && !node.star) {
        node.star = this.add.text(node.x, node.y - 16, '★', { fontFamily: FONT_FAMILY, fontSize: '10px', color: '#F2C14E' }).setOrigin(0.5);
      }
    });
  }

  private updatePanel(): void {
    const node = this.nodes[this.selected];
    if (!node) {
      this.panelName.setText(t('map.locked'));
      this.panelSubtitle.setText('');
      this.panelFeathers.setText('');
      return;
    }
    const feathers = SaveManager.getFeathers(node.level.id).filter(Boolean).length;
    this.panelName.setText(t(node.level.nameKey));
    this.panelSubtitle.setText(t(node.level.subtitleKey));
    this.panelFeathers.setText(t('map.feathers', { current: feathers, max: GAMEPLAY.hud.featherMax }));
  }

  private enterSelected(): void {
    const node = this.nodes[this.selected];
    if (!node || this.nodeState(node.level) === 'blocked') return;
    this.scene.start('Level', { levelId: node.level.id });
  }
}
