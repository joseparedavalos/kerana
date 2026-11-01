import { describe, expect, it } from 'vitest';
import { addPadActions, controlLabel, DeviceTracker, padStyleFromId, type LabelAction } from '../src/systems/inputDevice';
import { es } from '../src/i18n/es';

// S63: los carteles nombran el control del dispositivo en uso y cambian si se pasa a otro en la misma partida.

const idle = (): Record<LabelAction, boolean> => ({
  left: false,
  right: false,
  up: false,
  down: false,
  jump: false,
  attack: false,
  dash: false,
  pause: false,
  confirm: false,
});

function buttons(pressed: number[], total = 17): { value: number }[] {
  return Array.from({ length: total }, (_, i) => ({ value: pressed.includes(i) ? 1 : 0 }));
}

describe('controlLabel', () => {
  it('con el teclado, el nombre de la tecla', () => {
    expect(controlLabel('keyboard', 'jump', 'Espacio')).toBe('Espacio');
    expect(controlLabel('keyboard', 'attack', 'X')).toBe('X');
  });

  it('con el mando, los botones de Xbox o de PlayStation', () => {
    expect(controlLabel('gamepad', 'jump', 'Espacio', 'xbox')).toBe('A');
    expect(controlLabel('gamepad', 'attack', 'X', 'xbox')).toBe('X');
    expect(controlLabel('gamepad', 'dash', 'C', 'xbox')).toBe('RB');
    expect(controlLabel('gamepad', 'jump', 'Espacio', 'playstation')).toBe('✕');
    expect(controlLabel('gamepad', 'attack', 'X', 'playstation')).toBe('□');
    expect(controlLabel('gamepad', 'dash', 'C', 'playstation')).toBe('R1');
  });

  it('en el celular, el dibujo del botón en pantalla, nunca la tecla', () => {
    const keys: Partial<Record<LabelAction, string>> = { left: '←', right: '→', jump: 'Espacio', attack: 'X', dash: 'C' };
    for (const [action, key] of Object.entries(keys) as [LabelAction, string][]) {
      const label = controlLabel('touch', action, key);
      expect(label).not.toBe(key);
      expect(label.length).toBeGreaterThan(0);
    }
  });

  it('los símbolos del celular no tienen variante emoji (◀ y ▶ se ven como emoji en algunos teléfonos)', () => {
    for (const action of ['left', 'right', 'jump', 'attack', 'dash', 'pause'] as LabelAction[]) {
      const label = controlLabel('touch', action, '?');
      expect(label).not.toMatch(/[▶◀⏸\u{1F5E1}]/u);
    }
  });

  it('cada cartel de ayuda tiene un texto distinto en cada dispositivo si nombra un control', () => {
    const hints = Object.entries(es).filter(([k, v]) => k.startsWith('hint.') && /\{(left|right|jump|attack|dash)\}/.test(v));
    expect(hints.length).toBeGreaterThan(5);
    const keyboard: Record<string, string> = { left: '←', right: '→', jump: 'Espacio', attack: 'X', dash: 'C' };
    const render = (text: string, device: 'keyboard' | 'gamepad' | 'touch') =>
      text.replace(/\{(\w+)\}/g, (_, a: string) => controlLabel(device, a as LabelAction, keyboard[a] ?? a));
    for (const [, text] of hints) {
      expect(render(text, 'touch')).not.toBe(render(text, 'keyboard'));
      // El ataque es X en el teclado y en el mando de Xbox: ahí el texto coincide, y está bien.
      if (text.includes('{jump}')) expect(render(text, 'gamepad')).not.toBe(render(text, 'keyboard'));
    }
  });
});

describe('padStyleFromId', () => {
  it('reconoce los mandos de Sony por el nombre o el código de fabricante', () => {
    expect(padStyleFromId('DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)')).toBe('playstation');
    expect(padStyleFromId('054c-09cc-Wireless Controller')).toBe('playstation');
    expect(padStyleFromId('Xbox 360 Controller (XInput STANDARD GAMEPAD)')).toBe('xbox');
    expect(padStyleFromId('Generic USB Joystick')).toBe('xbox');
  });
});

describe('addPadActions', () => {
  it('A salta, X ataca, RB es el dash y Start pausa', () => {
    const out = idle();
    expect(addPadActions(buttons([0, 2, 5, 9]), 0, 0, out)).toBe(true);
    expect(out).toMatchObject({ jump: true, attack: true, dash: true, pause: true, confirm: true, left: false, right: false });
  });

  it('la cruceta y el stick izquierdo mueven; el stick casi quieto no', () => {
    const out = idle();
    addPadActions(buttons([14]), 0, 0, out);
    expect(out.left).toBe(true);
    const stick = idle();
    addPadActions(buttons([]), 0.8, -0.9, stick);
    expect(stick).toMatchObject({ right: true, up: true, left: false, down: false });
    const rest = idle();
    expect(addPadActions(buttons([]), 0.2, -0.1, rest)).toBe(false);
    expect(Object.values(rest).some(Boolean)).toBe(false);
  });

  it('con dos mandos suma lo de los dos (no borra lo del primero)', () => {
    const out = idle();
    addPadActions(buttons([0]), 0, 0, out);
    addPadActions(buttons([]), 0, 0, out);
    expect(out.jump).toBe(true);
  });

  it('un mando con menos botones no rompe', () => {
    const out = idle();
    expect(addPadActions(buttons([0], 4), 0, 0, out)).toBe(true);
    expect(out.right).toBe(false);
  });
});

describe('DeviceTracker', () => {
  it('avisa al pasar de un dispositivo a otro, y solo si cambió', () => {
    const tracker = new DeviceTracker('keyboard');
    const seen: string[] = [];
    tracker.onChange((d) => seen.push(d));
    expect(tracker.use('keyboard')).toBe(false);
    expect(tracker.use('gamepad', 'xbox')).toBe(true);
    expect(tracker.use('gamepad', 'xbox')).toBe(false);
    expect(tracker.use('touch')).toBe(true);
    expect(tracker.use('keyboard')).toBe(true);
    expect(seen).toEqual(['gamepad', 'touch', 'keyboard']);
    expect(tracker.current).toBe('keyboard');
  });

  it('cambiar de mando de Xbox a uno de PlayStation también avisa (los nombres de los botones cambian)', () => {
    const tracker = new DeviceTracker('gamepad');
    let calls = 0;
    tracker.onChange(() => calls++);
    tracker.use('gamepad', 'playstation');
    expect(tracker.padStyle).toBe('playstation');
    expect(calls).toBe(1);
    // Con el teclado se recuerda la marca del mando para cuando vuelva.
    tracker.use('keyboard');
    expect(tracker.padStyle).toBe('playstation');
  });

  it('se deja de escuchar', () => {
    const tracker = new DeviceTracker('touch');
    let calls = 0;
    const off = tracker.onChange(() => calls++);
    off();
    tracker.use('keyboard');
    expect(calls).toBe(0);
  });
});
