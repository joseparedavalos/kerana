import Phaser from 'phaser';
import { FONT_FAMILY } from '../config/fonts';
import { WORLD_LEVELS } from '../data/levels';
import type { LevelDef } from '../data/types';
import { t } from '../i18n';
import { GAMEPLAY } from '../config/gameplay';
import { AudioManager } from '../systems/AudioManager';
import { InputManager } from '../systems/InputManager';
import { SaveManager } from '../systems/SaveManager';
import { setupView, VIEW } from '../systems/View';

// Mapa del mundo (GDD §8.4): silueta del Paraguay en pixeles, sin departamentos.
// Los nodos usan la latitud y longitud de la tabla. Asunción, Capiatá y Paraguarí
// están a pocos kilómetros: se abren un poco alrededor de ese punto para poder tocarlos.
type NodeState = 'blocked' | 'available' | 'completed';

interface MapNode {
  level: LevelDef;
  x: number;
  y: number;
  dot: Phaser.GameObjects.Arc;
  star?: Phaser.GameObjects.Text;
}

// Contorno simplificado del país (lon, lat). El río Paraguay, el Paraná y el Pilcomayo son el borde.
const OUTLINE: ReadonlyArray<readonly [number, number]> = [
  [-62.685, -22.249], [-62.291, -21.052], [-62.266, -20.514], [-61.786, -19.634], [-60.044, -19.343],
  [-59.115, -19.357], [-58.183, -19.868], [-58.166, -20.177], [-57.871, -20.733], [-57.937, -22.09],
  [-56.882, -22.282], [-56.473, -22.086], [-55.798, -22.357], [-55.611, -22.656], [-55.518, -23.572],
  [-55.401, -23.957], [-55.028, -24.001], [-54.653, -23.84], [-54.293, -24.021], [-54.293, -24.571],
  [-54.429, -25.162], [-54.625, -25.739], [-54.789, -26.622], [-55.696, -27.388], [-56.487, -27.548],
  [-57.61, -27.396], [-58.618, -27.124], [-57.634, -25.604], [-57.777, -25.162], [-58.807, -24.771],
  [-60.029, -24.033], [-60.847, -23.881],
];

const LON0 = -62.685;
const LON1 = -54.293;
const LAT_N = -19.343;
const LAT_S = -27.548;
const CELL = 4;

export class WorldMapScene extends Phaser.Scene {
  private inputs!: InputManager;
  private nodes: MapNode[] = [];
  private spots: { x: number; y: number }[] = [];
  private selected = 0;
  private panelName!: Phaser.GameObjects.Text;
  private panelSubtitle!: Phaser.GameObjects.Text;
  private panelFeathers!: Phaser.GameObjects.Text;
  private skyStars: Phaser.GameObjects.Arc[] = [];
  private healed = false;

  constructor() {
    super('Map');
  }

  create(): void {
    setupView(this);
    AudioManager.music('map');
    const { width, height } = VIEW;
    this.inputs = new InputManager(this);
    // Con Tau sellado, la tierra guaraní sana y el mapa recupera sus colores (GDD §7).
    this.healed = SaveManager.current.freed.includes('tau');
    if (this.healed) this.add.graphics().fillGradientStyle(0x1a3058, 0x1a3058, 0x1e4a32, 0x1e4a32, 1).fillRect(0, 0, width, height);
    else this.add.rectangle(0, 0, width, height, 0x14132a).setOrigin(0);
    this.add.text(width / 2, 16, t('map.title'), { fontFamily: FONT_FAMILY, fontSize: '16px', color: '#F2C14E' }).setOrigin(0.5).setDepth(5);

    this.buildSky();
    this.paintLand();
    this.spots = this.layoutSpots();
    this.buildPath();
    this.nodes = WORLD_LEVELS.map((level, i) => this.buildNode(level, i));
    this.selected = this.firstSelectableIndex();
    this.refreshNodeStyles();

    this.panelName = this.add.text(width / 2, height - 46, '', { fontFamily: FONT_FAMILY, fontSize: '13px', color: '#F2EEE3' }).setOrigin(0.5).setDepth(5);
    this.panelSubtitle = this.add.text(width / 2, height - 30, '', { fontFamily: FONT_FAMILY, fontSize: '9px', color: '#CFE3F2' }).setOrigin(0.5).setDepth(5);
    this.panelFeathers = this.add.text(width / 2, height - 16, '', { fontFamily: FONT_FAMILY, fontSize: '9px', color: '#F2C14E' }).setOrigin(0.5).setDepth(5);
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
    if (this.inputs.justPressed('pause')) {
      AudioManager.play('uiBack');
      this.scene.start('Title');
    }
  }

  private frame(): { ox: number; oy: number; drawW: number; drawH: number; spanx: number; spanlat: number; xs: number } {
    const { width, height } = VIEW;
    const xs = Math.cos((((LAT_N + LAT_S) / 2) * Math.PI) / 180);
    const spanx = (LON1 - LON0) * xs;
    const spanlat = LAT_N - LAT_S;
    const oy = 40;
    const drawH = height - oy - 68;
    const drawW = drawH * (spanx / spanlat);
    return { ox: (width - drawW) / 2, oy, drawW, drawH, spanx, spanlat, xs };
  }

  private project(lon: number, lat: number): { x: number; y: number } {
    const { ox, oy, drawW, drawH, spanx, spanlat, xs } = this.frame();
    return {
      x: ox + ((lon - LON0) * xs * drawW) / spanx,
      y: oy + ((LAT_N - lat) * drawH) / spanlat,
    };
  }

  private contains(lon: number, lat: number): boolean {
    let hit = false;
    for (let i = 0, j = OUTLINE.length - 1; i < OUTLINE.length; j = i++) {
      const [xi, yi] = OUTLINE[i];
      const [xj, yj] = OUTLINE[j];
      if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) hit = !hit;
    }
    return hit;
  }

  private paintLand(): void {
    const { ox, oy, drawW, drawH, spanx, spanlat, xs } = this.frame();
    const g = this.add.graphics();
    const fill = this.healed ? 0x2c6a3e : 0x1c3c30;
    const dither = this.healed ? 0x3d8450 : 0x2a5644;
    const shore = this.healed ? 0x9ed48a : 0x6aa890;
    const x0 = Math.floor(ox / CELL) * CELL;
    const y0 = Math.floor(oy / CELL) * CELL;
    for (let py = y0; py < oy + drawH; py += CELL) {
      for (let px = x0; px < ox + drawW; px += CELL) {
        const lon = LON0 + ((px + CELL / 2 - ox) * spanx) / drawW / xs;
        const lat = LAT_N - ((py + CELL / 2 - oy) * spanlat) / drawH;
        if (!this.contains(lon, lat)) continue;
        let edge = false;
        for (const [dx, dy] of [
          [CELL, 0],
          [-CELL, 0],
          [0, CELL],
          [0, -CELL],
        ] as const) {
          const lon2 = LON0 + ((px + dx + CELL / 2 - ox) * spanx) / drawW / xs;
          const lat2 = LAT_N - ((py + dy + CELL / 2 - oy) * spanlat) / drawH;
          if (!this.contains(lon2, lat2)) edge = true;
        }
        const speck = ((px / CELL + py / CELL) % 5) === 0;
        g.fillStyle(edge ? shore : speck ? dither : fill);
        g.fillRect(px, py, CELL - 1, CELL - 1);
      }
    }
  }

  /** Proyección real y, si dos lugares caen encima, un abanico corto alrededor de ese punto. */
  private layoutSpots(): { x: number; y: number }[] {
    const raw = WORLD_LEVELS.map((level) => this.project(level.mapNode.x, level.mapNode.y));
    const seen = raw.map(() => false);
    for (let i = 0; i < raw.length; i++) {
      if (seen[i]) continue;
      const group = [i];
      seen[i] = true;
      for (let k = 0; k < group.length; k++) {
        for (let j = 0; j < raw.length; j++) {
          if (seen[j]) continue;
          if (Phaser.Math.Distance.Between(raw[group[k]].x, raw[group[k]].y, raw[j].x, raw[j].y) < 26) {
            seen[j] = true;
            group.push(j);
          }
        }
      }
      if (group.length < 2) continue;
      const cx = group.reduce((sum, idx) => sum + raw[idx].x, 0) / group.length;
      const cy = group.reduce((sum, idx) => sum + raw[idx].y, 0) / group.length;
      const west = group.reduce((a, b) => (raw[a].x < raw[b].x ? a : b));
      const south = group.reduce((a, b) => (raw[a].y > raw[b].y ? a : b));
      if (group.length === 3 && west !== south) {
        const east = group.find((idx) => idx !== west && idx !== south) ?? west;
        raw[west] = { x: cx - 16, y: cy - 4 };
        raw[east] = { x: cx + 15, y: cy - 6 };
        raw[south] = { x: cx + 2, y: cy + 16 };
      }
    }
    return raw;
  }

  private buildSky(): void {
    const { width } = VIEW;
    const freedCount = SaveManager.current.freed.length;
    for (let i = 0; i < 7; i++) {
      const lit = i < freedCount;
      const star = this.add.circle(30 + i * ((width - 60) / 6), 34, lit ? 2.5 : 1.5, lit ? 0xf2eee3 : 0x4a4870, lit ? 1 : 0.6);
      star.setDepth(5);
      this.skyStars.push(star);
    }
  }

  private buildPath(): void {
    const color = this.healed ? 0xf2c14e : 0x8aa4c8;
    const g = this.add.graphics();
    const points = this.spots;
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i];
      const b = points[i + 1];
      const dist = Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y);
      const steps = Math.max(1, Math.floor(dist / 6));
      for (let s = 0; s < steps; s += 2) {
        const t = s / steps;
        g.fillStyle(color, 0.75);
        g.fillRect(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, 2, 2);
      }
    }
  }

  private buildNode(level: LevelDef, index: number): MapNode {
    const { x, y } = this.spots[index];
    const dot = this.add.circle(x, y, 5).setStrokeStyle(1, 0xf2eee3).setDepth(3);
    dot.setInteractive(new Phaser.Geom.Circle(5, 5, 16), Phaser.Geom.Circle.Contains);
    dot.on('pointerdown', () => this.tapNode(index));
    this.add.text(x, y + 9, String(level.order), { fontFamily: FONT_FAMILY, fontSize: '8px', color: '#F2EEE3' }).setOrigin(0.5, 0).setDepth(4);
    this.addChipas(level, x, y);
    return { level, x, y, dot };
  }

  /** Las chipas de ese nivel, bajo el número. El guardado sigue en `feathers`. */
  private addChipas(level: LevelDef, x: number, y: number): void {
    const got = SaveManager.getFeathers(level.id);
    const n = GAMEPLAY.hud.featherMax;
    const step = 8;
    for (let i = 0; i < n; i++) {
      const key = got[i] ? 'ui_chipa' : 'ui_chipa_empty';
      if (!this.textures.exists(key)) continue;
      this.add.image(x + (i - (n - 1) / 2) * step, y + 22, key).setScale(0.28).setDepth(4);
    }
  }

  private tapNode(index: number): void {
    if (this.nodeState(this.nodes[index].level) === 'blocked') return;
    if (this.selected === index) {
      this.enterSelected();
      return;
    }
    this.selected = index;
    this.refreshNodeStyles();
    this.updatePanel();
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
    if (selectable[nextPos] !== this.selected) AudioManager.play('uiMove');
    this.selected = selectable[nextPos];
    this.refreshNodeStyles();
    this.updatePanel();
  }

  private refreshNodeStyles(): void {
    const colors: Record<NodeState, number> = { blocked: 0x2a2946, available: 0xcfe3f2, completed: 0xf2c14e };
    this.nodes.forEach((node, i) => {
      const state = this.nodeState(node.level);
      node.dot.setFillStyle(colors[state]);
      node.dot.setScale(i === this.selected ? 1.6 : 1);
      if (state === 'completed' && !node.star) {
        node.star = this.add.text(node.x, node.y - 14, '★', { fontFamily: FONT_FAMILY, fontSize: '10px', color: '#F2C14E' }).setOrigin(0.5).setDepth(4);
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
    AudioManager.play('uiConfirm');
    this.scene.start('Level', { levelId: node.level.id });
  }
}
