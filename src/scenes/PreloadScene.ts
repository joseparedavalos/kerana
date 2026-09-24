import Phaser from 'phaser';
import existingAssets from 'virtual:kerana-assets';
import { MANIFEST, PLAYER_PLACEHOLDER_KEY, type AssetEntry } from '../assets/manifest';
import { DEBUG } from '../config/debug';
import { GAMEPLAY } from '../config/gameplay';
import { t } from '../i18n';
import { makePlaceholderTexture } from '../utils/placeholder';

const ASSET_BASE = 'assets/';

// Carga el manifest; lo que falte se reemplaza por un placeholder (GDD §11.8).
export class PreloadScene extends Phaser.Scene {
  private readonly missing: AssetEntry[] = [];

  constructor() {
    super('Preload');
  }

  preload(): void {
    const { width, height } = this.scale;
    const bar = this.add.rectangle(width / 2 - 100, height / 2, 0, 6, 0xf2c14e).setOrigin(0, 0.5);
    this.add.rectangle(width / 2, height / 2, 200, 6).setStrokeStyle(1, 0xf2eee3);
    this.add.text(width / 2, height / 2 - 16, t('loading'), { fontFamily: 'monospace', fontSize: '10px', color: '#F2EEE3' }).setOrigin(0.5);
    this.load.on(Phaser.Loader.Events.PROGRESS, (p: number) => (bar.width = 200 * p));

    this.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, (file: Phaser.Loader.File) => {
      const entry = MANIFEST.find((e) => e.key === file.key);
      if (entry && !this.missing.includes(entry)) this.missing.push(entry);
    });

    const existing = new Set(existingAssets);
    for (const entry of MANIFEST) {
      // No se piden archivos que no existen: así no hay 404 en consola.
      if (!existing.has(entry.path)) {
        this.missing.push(entry);
        continue;
      }
      const url = ASSET_BASE + entry.path;
      if (entry.type === 'image') this.load.image(entry.key, url);
      else if (entry.type === 'spritesheet')
        this.load.spritesheet(entry.key, url, { frameWidth: entry.frameWidth, frameHeight: entry.frameHeight });
      else this.load.tilemapTiledJSON(entry.key, url);
    }
  }

  create(): void {
    for (const entry of this.missing) {
      console.warn(`[ASSET FALTANTE] ${entry.key}`);
      if (entry.type === 'image') makePlaceholderTexture(this, entry.key, entry.width, entry.height);
      else if (entry.type === 'spritesheet')
        makePlaceholderTexture(this, entry.key, entry.frameWidth, entry.frameHeight, entry.frames);
      // Un mapa faltante no tiene placeholder: LevelScene avisa y vuelve al título.
    }
    this.makePlayerPlaceholder();

    if (DEBUG.level) this.scene.start('Level', { levelId: DEBUG.level });
    else this.scene.start('Title');
  }

  /** Kerana provisional: rectángulo de 16 × 40 con un "ojo" mirando a la derecha. */
  private makePlayerPlaceholder(): void {
    const w = GAMEPLAY.player.bodyWidth;
    const h = GAMEPLAY.player.bodyHeight;
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0xb8322a).fillRect(0, 0, w, h);
    g.fillStyle(0xc98b2b).fillRect(0, 0, w, 6);
    g.fillStyle(0xf2eee3).fillRect(0, 16, w, h - 16);
    g.fillStyle(0xf2eee3).fillRect(w - 6, 8, 4, 4);
    g.fillStyle(0x1b1a2e).fillRect(w - 4, 9, 2, 2);
    g.generateTexture(PLAYER_PLACEHOLDER_KEY, w, h);
    g.destroy();
  }
}
