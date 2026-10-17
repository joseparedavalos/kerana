import Phaser from 'phaser';
import { PLAYER_KEY } from '../assets/manifest';
import { FONT_FAMILY } from '../config/fonts';
import { speakerPortraitKey } from '../data/dialogues';
import type { DialogueLine } from '../data/types';
import { t } from '../i18n';
import { ensurePlaceholder } from '../utils/placeholder';
import { AudioManager } from './AudioManager';
import { SaveManager } from './SaveManager';
import { charsToShow } from './textReveal';
import { fixedOffset, VIEW } from './View';

// Caja de diálogo (GDD §8.7): retrato, nombre y texto letra por letra. La usan los diálogos de
// liberación de cada jefe (GDD §6); quien la crea decide si pausa el resto de la escena.
const BOX_HEIGHT = 76;
const PORTRAIT_SIZE = 64;
/** Primer cuadro de `kerana_idle` (kerana.json). Cabeza y hombros, mirando al texto. */
const KERANA_IDLE_FRAME = 11;
const KERANA_CROP = { x: 46, y: 32, w: 32, h: 32 };

export class DialogueBox {
  private readonly container: Phaser.GameObjects.Container;
  private readonly portrait: Phaser.GameObjects.Image;
  private readonly nameText: Phaser.GameObjects.Text;
  private readonly bodyText: Phaser.GameObjects.Text;
  private readonly marker: Phaser.GameObjects.Text;
  private lines: DialogueLine[] = [];
  private index = 0;
  private fullText = '';
  private shownChars = 0;
  private charTimerMs = 0;
  private onComplete: (() => void) | null = null;

  constructor(scene: Phaser.Scene) {
    const { width, height } = VIEW;
    const hud = fixedOffset(scene.cameras.main);
    const bg = scene.add.rectangle(0, 0, width, BOX_HEIGHT, 0x1b1a2e, 0.92).setOrigin(0, 1).setStrokeStyle(1, 0xf2eee3);
    this.portrait = scene.add.image(8, -BOX_HEIGHT + 8, '').setOrigin(0, 0).setDisplaySize(PORTRAIT_SIZE, PORTRAIT_SIZE);
    this.nameText = scene.add
      .text(PORTRAIT_SIZE + 16, -BOX_HEIGHT + 10, '', { fontFamily: FONT_FAMILY, fontSize: '11px', color: '#F2C14E' });
    this.bodyText = scene.add.text(PORTRAIT_SIZE + 16, -BOX_HEIGHT + 28, '', {
      fontFamily: FONT_FAMILY,
      fontSize: '10px',
      color: '#F2EEE3',
      wordWrap: { width: width - PORTRAIT_SIZE - 32 },
    });
    this.marker = scene.add.text(width - 10, -8, '', { fontFamily: FONT_FAMILY, fontSize: '10px', color: '#CFE3F2' }).setOrigin(1, 1);
    this.container = scene.add
      .container(hud.x, hud.y + height, [bg, this.portrait, this.nameText, this.bodyText, this.marker])
      .setScrollFactor(0)
      .setDepth(200)
      .setVisible(false);
  }

  get active(): boolean {
    return this.container.visible;
  }

  /** Empieza a mostrar `lines`; llama a `onComplete` al cerrar la última. */
  show(lines: DialogueLine[], onComplete: () => void): void {
    this.lines = lines;
    this.index = -1;
    this.onComplete = onComplete;
    this.container.setVisible(true);
    // La música baja mientras se lee (S37).
    AudioManager.duck(true);
    this.advanceLine();
  }

  /** Llamar cada frame mientras `active`. `pressed`: Saltar, Atacar o tocar la pantalla (GDD §8.7). */
  update(deltaMs: number, pressed: boolean): void {
    if (!this.active) return;
    if (this.shownChars < this.fullText.length) {
      this.charTimerMs += deltaMs;
      const chars = charsToShow(this.charTimerMs, SaveManager.current.settings.textSpeed);
      if (pressed) this.shownChars = this.fullText.length;
      else this.shownChars = Math.min(this.fullText.length, Math.max(this.shownChars, chars));
      this.bodyText.setText(this.fullText.slice(0, this.shownChars));
      if (this.shownChars >= this.fullText.length) this.marker.setText(t('dialogue.advance_marker'));
      return;
    }
    if (pressed) this.advanceLine();
  }

  destroy(): void {
    if (this.active) AudioManager.duck(false);
    this.container.destroy();
  }

  private advanceLine(): void {
    this.index++;
    if (this.index >= this.lines.length) {
      this.container.setVisible(false);
      AudioManager.duck(false);
      const done = this.onComplete;
      this.onComplete = null;
      done?.();
      return;
    }
    const line = this.lines[this.index];
    const scene = this.container.scene;
    const key = speakerPortraitKey(line.speaker);
    if (!(line.speaker === 'kerana' && showKeranaPortrait(scene, key))) {
      ensurePlaceholder(scene, key, PORTRAIT_SIZE, PORTRAIT_SIZE);
    }
    this.portrait.setTexture(key).setDisplaySize(PORTRAIT_SIZE, PORTRAIT_SIZE);
    this.nameText.setText(t(`speaker.${line.speaker}`));
    this.fullText = t(line.textKey);
    this.shownChars = 0;
    this.charTimerMs = 0;
    this.bodyText.setText('');
    this.marker.setText('');
  }
}

const PORTRAIT_MARK = 'sprite';

/** Retrato de Kerana recortado del sprite que ya está en el juego. false si todavía no cargó. */
function showKeranaPortrait(scene: Phaser.Scene, key: string): boolean {
  if (!scene.textures.exists(PLAYER_KEY)) return false;
  const current = scene.textures.exists(key) ? scene.textures.get(key) : null;
  const data = current?.customData as { mark?: string } | undefined;
  if (data?.mark === PORTRAIT_MARK) return true;
  if (current) scene.textures.remove(key);
  const sheet = scene.textures.get(PLAYER_KEY);
  const frame = sheet.get(KERANA_IDLE_FRAME);
  const canvas = scene.textures.createCanvas(key, PORTRAIT_SIZE, PORTRAIT_SIZE);
  if (!canvas) return false;
  const ctx = canvas.getContext();
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, PORTRAIT_SIZE, PORTRAIT_SIZE);
  ctx.drawImage(
    sheet.getSourceImage() as CanvasImageSource,
    frame.cutX + KERANA_CROP.x,
    frame.cutY + KERANA_CROP.y,
    KERANA_CROP.w,
    KERANA_CROP.h,
    0,
    0,
    PORTRAIT_SIZE,
    PORTRAIT_SIZE,
  );
  canvas.refresh();
  (canvas.customData as { mark?: string }).mark = PORTRAIT_MARK;
  return true;
}
