import Phaser from 'phaser';
import existingAssets from 'virtual:kerana-assets';
import { ANIMS_SUFFIX, MANIFEST, PLAYER_PLACEHOLDER_KEY, type AssetEntry } from '../assets/manifest';
import { DEBUG } from '../config/debug';
import { FONT_FAMILY } from '../config/fonts';
import { GAMEPLAY } from '../config/gameplay';
import { t } from '../i18n';
import { makePlaceholderTexture } from '../utils/placeholder';

const ASSET_BASE = 'assets/';

/** Formato del JSON que genera `npm run sprites` (tools/lib/sprite-pipeline.mjs). */
interface SpriteMeta {
  anims: Record<string, { frames: number[]; frameRate: number; repeat: number }>;
}

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
    this.add.text(width / 2, height / 2 - 16, t('loading'), { fontFamily: FONT_FAMILY, fontSize: '10px', color: '#F2EEE3' }).setOrigin(0.5);
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
      else if (entry.type === 'json') this.load.json(entry.key, url);
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
    this.registerSpriteAnims();

    if (DEBUG.level) this.scene.start('Level', { levelId: DEBUG.level });
    else this.scene.start('Title');
  }

  /** Crea las animaciones que describe cada JSON del pipeline (`<id>_anims`), si su hoja cargó de verdad. */
  private registerSpriteAnims(): void {
    for (const entry of MANIFEST) {
      if (entry.type !== 'json' || !entry.key.endsWith(ANIMS_SUFFIX)) continue;
      const textureKey = entry.key.slice(0, -ANIMS_SUFFIX.length);
      const sheetMissing = this.missing.some((m) => m.key === textureKey);
      const meta = this.cache.json.get(entry.key) as SpriteMeta | undefined;
      if (sheetMissing || !meta) continue;
      for (const [key, a] of Object.entries(meta.anims)) {
        this.anims.create({
          key,
          frames: this.anims.generateFrameNumbers(textureKey, { frames: a.frames }),
          frameRate: a.frameRate,
          repeat: a.repeat,
        });
      }
    }
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
