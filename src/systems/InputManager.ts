import Phaser from 'phaser';
import { t } from '../i18n';
import { addPadActions, controlLabel, DeviceTracker, padStyleFromId, type PadStyle } from './inputDevice';

// Traduce teclas a acciones abstractas (GDD §3.2). El jugador nunca lee teclas directas.
export type Action = 'left' | 'right' | 'up' | 'down' | 'jump' | 'attack' | 'dash' | 'pause' | 'confirm';

const KEYMAP: Record<Action, string[]> = {
  left: ['LEFT', 'A'],
  right: ['RIGHT', 'D'],
  up: ['UP', 'W'],
  down: ['DOWN', 'S'],
  jump: ['SPACE', 'Z', 'K'],
  attack: ['X', 'J'],
  dash: ['C', 'L', 'SHIFT'],
  pause: ['ESC', 'P'],
  confirm: ['ENTER'],
};

// Nombres de teclas para los textos de ayuda.
const KEY_LABELS: Record<string, string> = {
  LEFT: '←',
  RIGHT: '→',
  UP: '↑',
  DOWN: '↓',
  ENTER: 'Enter',
  ESC: 'Esc',
  SHIFT: 'Shift',
};

function wantsTouch(): boolean {
  if (typeof window === 'undefined') return false;
  if (new URLSearchParams(window.location.search).get('touch') === '1') return true;
  const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  return coarse || navigator.maxTouchPoints > 0;
}

/** Nombre de la primera tecla de una acción. */
function keyLabel(action: Action): string {
  const name = KEYMAP[action][0];
  if (name === 'SPACE') return t('key.space');
  return KEY_LABELS[name] ?? name;
}

const ACTIONS = Object.keys(KEYMAP) as Action[];

// S63: el dispositivo en uso es uno solo para todo el juego (sobrevive al cambio de escena).
let tracker: DeviceTracker | null = null;

/** El último dispositivo usado (teclado, mando o táctil) y su aviso de cambio: los carteles lo escuchan. */
export function inputDevices(): DeviceTracker {
  tracker ??= new DeviceTracker(wantsTouch() ? 'touch' : 'keyboard');
  return tracker;
}

export class InputManager {
  private readonly keys = new Map<Action, Phaser.Input.Keyboard.Key[]>();
  private readonly down = new Map<Action, boolean>();
  private readonly pressedLatch = new Map<Action, boolean>();
  private readonly pressed = new Map<Action, boolean>();
  // Inputs virtuales (botones táctiles). Se suman a las teclas.
  private readonly virtualDown = new Map<Action, boolean>();
  private readonly virtualPressedLatch = new Map<Action, boolean>();
  // Mando (S63): lo apretado en el cuadro anterior, para saber qué se acaba de apretar.
  private readonly padPrev = new Map<Action, boolean>();
  private readonly padState = Object.fromEntries(ACTIONS.map((a) => [a, false])) as Record<Action, boolean>;
  private readonly gamepad: Phaser.Input.Gamepad.GamepadPlugin | null;
  // Marca del último mando con algo apretado (los nombres de los botones cambian entre Xbox y PlayStation).
  private padStyle: PadStyle = 'xbox';
  private readonly onKey = (): void => {
    inputDevices().use('keyboard');
  };

  constructor(scene: Phaser.Scene) {
    const keyboard = scene.input.keyboard;
    this.gamepad = scene.input.gamepad ?? null;
    keyboard?.on('keydown', this.onKey);
    for (const action of ACTIONS) {
      const list: Phaser.Input.Keyboard.Key[] = [];
      if (keyboard) {
        for (const name of KEYMAP[action]) {
          const code = Phaser.Input.Keyboard.KeyCodes[name as keyof typeof Phaser.Input.Keyboard.KeyCodes];
          const key = keyboard.addKey(code, true);
          // El "latch" no pierde pulsaciones más cortas que un frame.
          key.on('down', () => this.pressedLatch.set(action, true));
          list.push(key);
        }
      }
      this.keys.set(action, list);
      this.down.set(action, false);
      this.pressed.set(action, false);
      this.pressedLatch.set(action, false);
      this.virtualDown.set(action, false);
      this.virtualPressedLatch.set(action, false);
      this.padPrev.set(action, false);
    }
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy(scene));
  }

  /** Llamar una vez al inicio de cada update. */
  update(): void {
    const pad = this.readPads();
    let padNew = false;
    for (const action of ACTIONS) {
      const list = this.keys.get(action) ?? [];
      let isDown = false;
      for (const key of list) if (key.isDown) isDown = true;
      // Combina teclado + virtual + mando.
      const padDown = pad?.[action] ?? false;
      isDown = isDown || (this.virtualDown.get(action) ?? false) || padDown;
      this.down.set(action, isDown);

      const padPressed = padDown && !(this.padPrev.get(action) ?? false);
      this.padPrev.set(action, padDown);
      padNew ||= padPressed;
      const justPressed = (this.pressedLatch.get(action) ?? false) || (this.virtualPressedLatch.get(action) ?? false) || padPressed;
      this.pressed.set(action, justPressed);
      this.pressedLatch.set(action, false);
      this.virtualPressedLatch.set(action, false);
    }
    // Pasa al mando con un botón recién apretado, no con uno mantenido: un stick que deriva no hace parpadear los carteles.
    if (padNew) inputDevices().use('gamepad', this.padStyle);
  }

  isDown(action: Action): boolean {
    return this.down.get(action) ?? false;
  }

  justPressed(action: Action): boolean {
    return this.pressed.get(action) ?? false;
  }

  /**
   * Nombre visible del control de una acción en el dispositivo que se está usando (S63): la tecla con el teclado, el
   * botón del mando (A, X, RB… o ✕, □, R1… en uno de PlayStation) y, en el celular, el dibujo del botón en pantalla.
   */
  label(action: Action): string {
    const devices = inputDevices();
    return controlLabel(devices.current, action, keyLabel(action), devices.padStyle);
  }

  /** Lo que tienen apretado los mandos conectados (todos juntos), o null si no hay ninguno. */
  private readPads(): Record<Action, boolean> | null {
    const pads = this.gamepad?.gamepads;
    if (!pads || pads.length === 0) return null;
    for (const action of ACTIONS) this.padState[action] = false;
    let connected = false;
    for (const pad of pads) {
      if (!pad?.connected) continue;
      connected = true;
      if (addPadActions(pad.buttons, pad.axes[0]?.value ?? 0, pad.axes[1]?.value ?? 0, this.padState)) this.padStyle = padStyleFromId(pad.id);
    }
    return connected ? this.padState : null;
  }

  /** Un toque, sin dejar el botón apretado. No carga el tajo. */
  pulse(action: Action): void {
    this.virtualPressedLatch.set(action, true);
  }

  /** Setea el estado de un botón virtual (mantener). */
  setVirtual(action: Action, isDown: boolean): void {
    const wasDown = this.virtualDown.get(action) ?? false;
    this.virtualDown.set(action, isDown);
    if (isDown && !wasDown) {
      this.virtualPressedLatch.set(action, true);
      // Solo los botones en pantalla: el tajo automático usa `pulse` y no es un cambio de dispositivo.
      inputDevices().use('touch');
    }
  }

  private destroy(scene: Phaser.Scene): void {
    const keyboard = scene.input.keyboard;
    keyboard?.off('keydown', this.onKey);
    for (const list of this.keys.values()) {
      for (const key of list) {
        key.removeAllListeners();
        keyboard?.removeKey(key);
      }
    }
    this.keys.clear();
  }
}
