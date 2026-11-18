import Phaser from 'phaser';
import { queueBackgrounds } from '../assets/backgrounds';
import { GAMEPLAY } from '../config/gameplay';
import { FONT_FAMILY } from '../config/fonts';
import { PROLOGUE_SLIDES } from '../data/story';
import { t } from '../i18n';
import { AudioManager } from '../systems/AudioManager';
import { addNightSky } from '../systems/Backdrops';
import { InputManager, type Action } from '../systems/InputManager';
import { SaveManager } from '../systems/SaveManager';
import { centerHitArea } from '../systems/hitArea';
import { armFullscreenOnTouch } from '../systems/mobileShell';
import { setupView, VIEW } from '../systems/View';
import { TitleLook } from './title/TitleLook';

const SKY_KEY = 'bg_yvaga_far';
const LOOK = GAMEPLAY.titleLook;
const MENU = LOOK.menu;
const ACTIONS: Action[] = ['left', 'right', 'up', 'down', 'jump', 'attack', 'dash', 'pause', 'confirm'];
/** Píxeles de textura por píxel del texto del menú (con el zoom 2, nítido). */
const TEXT_RESOLUTION = 2;

// Título: cielo de Yvága con Eichu, el logo en pixel art, Kerana con Mainumby y el menú (S105: el dibujo en TitleLook).
export class TitleScene extends Phaser.Scene {
  /** La entrada (desde negro) se ve una vez por sesión: al volver de Opciones o del mapa, el menú está listo. */
  private static introShown = false;
  private inputs!: InputManager;
  private look!: TitleLook;
  private choices: Array<'start' | 'options' | 'credits'> = ['start', 'options', 'credits'];
  private selected = 0;
  private optionText!: Phaser.GameObjects.Text;
  private creditText!: Phaser.GameObjects.Text;
  /** Lo que marca la opción 'start': «Continuar» con partida o «Tocá la pantalla» sin ella. */
  private startText!: Phaser.GameObjects.Text;
  private hint: Phaser.GameObjects.Text | null = null;
  private menuTexts: Phaser.GameObjects.Text[] = [];
  private started = false;
  /** El menú escucha (la entrada terminó o se salteó; el toque que la saltea no cuenta). La lee el smoke. */
  menuReady = false;

  constructor() {
    super('Title');
  }

  preload(): void {
    queueBackgrounds(this, [SKY_KEY]);
  }

  create(): void {
    setupView(this);
    // La instancia se reusa al volver al título (S38).
    this.started = false;
    this.menuTexts = [];
    this.hint = null;
    SaveManager.load();
    AudioManager.music('title');
    // S90: en el celular, el primer toque pide pantalla completa y, si se puede, fija la orientación horizontal.
    armFullscreenOnTouch();
    const { width, height } = VIEW;
    this.inputs = new InputManager(this);
    this.paintSky(width, height);
    const intro = !TitleScene.introShown;
    TitleScene.introShown = true;
    this.menuReady = !intro;
    this.look = new TitleLook(this, t('game.title'), t('game.subtitle'), intro);

    const hasSave = SaveManager.hasSave();
    const cx = width / 2;
    const [row1, row2] = MENU.rows;
    if (hasSave) {
      this.startText = this.sideLink(cx - MENU.columnGap, row1, 'title.continue', () => this.continueGame());
      this.sideLink(cx + MENU.columnGap, row1, 'title.new_game', () => this.newGame());
    } else {
      this.hint = this.menuText(cx, row1, t('title.tap'), MENU.selected);
      this.startText = this.hint;
    }
    this.optionText = this.sideLink(cx - MENU.columnGap, row2, 'title.options', () => this.scene.start('Options', { returnScene: 'Title' }));
    this.creditText = this.sideLink(cx + MENU.columnGap, row2, 'title.credits', () => this.scene.start('Credits'));

    if (!hasSave) {
      this.add
        .zone(width / 2, height / 2, width, height)
        .setOrigin(0.5)
        .setInteractive()
        .setDepth(1)
        .on('pointerdown', () => this.menuReady && this.startGame());
    }
    if (intro) this.listenSkip();
    this.refresh();
    this.applyMenuAlpha();
  }

  override update(_time: number, delta: number): void {
    this.inputs.update();
    this.look.update(delta);
    if (!this.menuReady) {
      // Cualquier tecla, botón o toque saltea la entrada; ese mismo toque no elige nada.
      if (this.look.introRunning && ACTIONS.some((a) => this.inputs.justPressed(a))) this.look.skipIntro();
      if (!this.look.introRunning) this.menuReady = true;
      this.applyMenuAlpha();
      return;
    }
    if (this.inputs.justPressed('left') || this.inputs.justPressed('up')) {
      this.selected = (this.selected - 1 + this.choices.length) % this.choices.length;
      AudioManager.play('uiMove');
    } else if (this.inputs.justPressed('right') || this.inputs.justPressed('down')) {
      this.selected = (this.selected + 1) % this.choices.length;
      AudioManager.play('uiMove');
    } else if (this.inputs.justPressed('confirm') || this.inputs.justPressed('jump')) {
      AudioManager.play('uiConfirm');
      const choice = this.choices[this.selected];
      if (choice === 'options') this.scene.start('Options', { returnScene: 'Title' });
      else if (choice === 'credits') this.scene.start('Credits');
      else if (SaveManager.hasSave()) this.continueGame();
      else this.startGame();
    }
    this.refresh();
    this.applyMenuAlpha();
  }

  /** La entrada se saltea también con teclas fuera de las acciones, con cualquier botón del mando o con un toque. */
  private listenSkip(): void {
    const skip = (): void => this.look.skipIntro();
    this.input.keyboard?.on('keydown', skip);
    this.input.gamepad?.on('down', skip);
    this.input.on('pointerdown', skip);
    this.events.once('shutdown', () => {
      this.input.keyboard?.off('keydown', skip);
      this.input.gamepad?.off('down', skip);
      this.input.off('pointerdown', skip);
    });
  }

  private paintSky(width: number, height: number): void {
    if (this.textures.exists(SKY_KEY)) {
      this.add.image(0, 0, SKY_KEY).setOrigin(0).setDisplaySize(width, height).setDepth(-10);
    } else {
      for (const part of addNightSky(this, width, height)) (part as unknown as Phaser.GameObjects.Components.Depth).setDepth(-10);
    }
    this.add.rectangle(0, 0, width, height, 0x070614, LOOK.skyDim).setOrigin(0).setDepth(-9);
  }

  private menuText(x: number, y: number, text: string, color: string = MENU.color): Phaser.GameObjects.Text {
    const label = this.add
      .text(x, y, text, {
        fontFamily: FONT_FAMILY,
        fontSize: `${MENU.fontPx}px`,
        color,
        stroke: MENU.stroke,
        strokeThickness: MENU.strokePx,
        resolution: TEXT_RESOLUTION,
      })
      .setOrigin(0.5)
      .setDepth(6);
    this.menuTexts.push(label);
    return label;
  }

  private sideLink(x: number, y: number, key: string, action: () => void): Phaser.GameObjects.Text {
    const text = this.menuText(x, y, t(key));
    centerHitArea(text, 112, 24);
    text.on('pointerdown', () => this.menuReady && action());
    return text;
  }

  private startGame(): void {
    if (this.started) return;
    this.started = true;
    if (SaveManager.hasSave()) this.continueGame();
    else this.newGame();
  }

  private newGame(): void {
    SaveManager.startNewGame();
    this.scene.start('Story', { slides: PROLOGUE_SLIDES, nextScene: 'Map' });
  }

  private continueGame(): void {
    SaveManager.load();
    this.scene.start('Map');
  }

  private refresh(): void {
    const choice = this.choices[this.selected];
    this.optionText.setColor(choice === 'options' ? MENU.selected : MENU.color);
    this.creditText.setColor(choice === 'credits' ? MENU.selected : MENU.color);
    if (this.startText !== this.hint) this.startText.setColor(choice === 'start' ? MENU.selected : MENU.color);
    this.look.mark(choice === 'start' ? this.startText : choice === 'options' ? this.optionText : this.creditText);
  }

  /** El menú aparece al final de la entrada; «Tocá la pantalla» además late suave. */
  private applyMenuAlpha(): void {
    const a = this.look.menuAlpha;
    for (const text of this.menuTexts) text.setAlpha(a);
    if (this.hint) this.hint.setAlpha(a * (0.6 + 0.4 * (0.5 + 0.5 * Math.sin((this.time.now / MENU.pulseMs) * Math.PI))));
  }
}
