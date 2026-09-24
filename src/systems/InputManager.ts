import Phaser from 'phaser';

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
  SPACE: 'Espacio',
  ENTER: 'Enter',
  ESC: 'Esc',
  SHIFT: 'Shift',
};

const ACTIONS = Object.keys(KEYMAP) as Action[];

export class InputManager {
  private readonly keys = new Map<Action, Phaser.Input.Keyboard.Key[]>();
  private readonly down = new Map<Action, boolean>();
  private readonly pressedLatch = new Map<Action, boolean>();
  private readonly pressed = new Map<Action, boolean>();

  constructor(scene: Phaser.Scene) {
    const keyboard = scene.input.keyboard;
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
    }
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy(scene));
  }

  /** Llamar una vez al inicio de cada update. */
  update(): void {
    for (const action of ACTIONS) {
      const list = this.keys.get(action) ?? [];
      let isDown = false;
      for (const key of list) if (key.isDown) isDown = true;
      this.down.set(action, isDown);
      this.pressed.set(action, this.pressedLatch.get(action) ?? false);
      this.pressedLatch.set(action, false);
    }
  }

  isDown(action: Action): boolean {
    return this.down.get(action) ?? false;
  }

  justPressed(action: Action): boolean {
    return this.pressed.get(action) ?? false;
  }

  /** Nombre visible de la primera tecla de una acción. */
  label(action: Action): string {
    const name = KEYMAP[action][0];
    return KEY_LABELS[name] ?? name;
  }

  private destroy(scene: Phaser.Scene): void {
    const keyboard = scene.input.keyboard;
    for (const list of this.keys.values()) {
      for (const key of list) {
        key.removeAllListeners();
        keyboard?.removeKey(key);
      }
    }
    this.keys.clear();
  }
}
