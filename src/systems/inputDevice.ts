// El dispositivo con el que se está jugando y cómo se nombra cada control en él (GDD §3.2: los textos de ayuda
// muestran el control del dispositivo en uso). Lógica pura, sin Phaser: la prueban los tests.

export type InputDevice = 'keyboard' | 'gamepad' | 'touch';
export type PadStyle = 'xbox' | 'playstation';
export type LabelAction = 'left' | 'right' | 'up' | 'down' | 'jump' | 'attack' | 'dash' | 'pause' | 'confirm';

// Botones del mando en el mapeo estándar del navegador (A, X, RB, Start y la cruceta).
export const PAD_BUTTONS = {
  a: 0,
  x: 2,
  rb: 5,
  start: 9,
  up: 12,
  down: 13,
  left: 14,
  right: 15,
} as const;

/** Desde cuánto el stick o un botón analógico cuentan como apretados (0 a 1). */
export const PAD_THRESHOLD = 0.5;

// Lo que dibuja cada botón del celular (TouchControls.drawTouchIcon). Sin variantes emoji: ◄ ► ▲ y no ◀ ▶.
const TOUCH_LABELS: Partial<Record<LabelAction, string>> = {
  left: '◄',
  right: '►',
  jump: '▲',
  attack: '†',
  dash: '►►',
  pause: '❚❚',
};

const PAD_LABELS: Record<PadStyle, Record<LabelAction, string>> = {
  xbox: {
    left: '◄',
    right: '►',
    up: '▲',
    down: '▼',
    jump: 'A',
    attack: 'X',
    dash: 'RB',
    pause: 'Start',
    confirm: 'A',
  },
  playstation: {
    left: '◄',
    right: '►',
    up: '▲',
    down: '▼',
    jump: '✕',
    attack: '□',
    dash: 'R1',
    pause: 'Options',
    confirm: '✕',
  },
};

/** Sony se reconoce por el nombre o por su código de fabricante (054c). El resto, con los nombres de Xbox. */
export function padStyleFromId(id: string): PadStyle {
  return /playstation|dualshock|dualsense|sony|054c/i.test(id) ? 'playstation' : 'xbox';
}

/**
 * Nombre del control de una acción en el dispositivo. `keyboardLabel` es el de la tecla (lo da InputManager): se usa
 * con el teclado y, en el celular, para lo que no tiene botón en pantalla (arriba, abajo, confirmar).
 */
export function controlLabel(device: InputDevice, action: LabelAction, keyboardLabel: string, padStyle: PadStyle = 'xbox'): string {
  if (device === 'gamepad') return PAD_LABELS[padStyle][action];
  if (device === 'touch') return TOUCH_LABELS[action] ?? keyboardLabel;
  return keyboardLabel;
}

/**
 * Suma a `out` lo que un mando tiene apretado (un OR: con varios mandos se llama una vez por cada uno sobre el mismo
 * `out`). `buttons` son los valores de sus botones (0 a 1) y `stickX`/`stickY`, el stick izquierdo. Devuelve si había
 * algo apretado. No crea objetos: se llama en cada cuadro.
 */
export function addPadActions(buttons: ArrayLike<{ value: number } | undefined>, stickX: number, stickY: number, out: Record<LabelAction, boolean>): boolean {
  const left = pressedAt(buttons, PAD_BUTTONS.left) || stickX <= -PAD_THRESHOLD;
  const right = pressedAt(buttons, PAD_BUTTONS.right) || stickX >= PAD_THRESHOLD;
  const up = pressedAt(buttons, PAD_BUTTONS.up) || stickY <= -PAD_THRESHOLD;
  const down = pressedAt(buttons, PAD_BUTTONS.down) || stickY >= PAD_THRESHOLD;
  const a = pressedAt(buttons, PAD_BUTTONS.a);
  const x = pressedAt(buttons, PAD_BUTTONS.x);
  const rb = pressedAt(buttons, PAD_BUTTONS.rb);
  const start = pressedAt(buttons, PAD_BUTTONS.start);
  out.left ||= left;
  out.right ||= right;
  out.up ||= up;
  out.down ||= down;
  out.jump ||= a;
  out.attack ||= x;
  out.dash ||= rb;
  out.pause ||= start;
  out.confirm ||= a;
  return left || right || up || down || a || x || rb || start;
}

function pressedAt(buttons: ArrayLike<{ value: number } | undefined>, i: number): boolean {
  return (buttons[i]?.value ?? 0) >= PAD_THRESHOLD;
}

type Listener = (device: InputDevice) => void;

/**
 * El último dispositivo usado. Vive fuera de las escenas: pasar de un nivel a otro no lo olvida. Arranca en táctil si
 * la pantalla es táctil y en teclado si no; cambia con la primera tecla, botón del mando o botón en pantalla.
 */
export class DeviceTracker {
  private device: InputDevice;
  private style: PadStyle = 'xbox';
  private readonly listeners = new Set<Listener>();

  constructor(initial: InputDevice) {
    this.device = initial;
  }

  get current(): InputDevice {
    return this.device;
  }

  get padStyle(): PadStyle {
    return this.style;
  }

  /** Anota el dispositivo que se acaba de usar. Avisa solo si cambió (también si cambió la marca del mando). */
  use(device: InputDevice, padStyle?: PadStyle): boolean {
    const style = device === 'gamepad' && padStyle ? padStyle : this.style;
    if (device === this.device && style === this.style) return false;
    this.device = device;
    this.style = style;
    for (const fn of this.listeners) fn(device);
    return true;
  }

  onChange(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
}
