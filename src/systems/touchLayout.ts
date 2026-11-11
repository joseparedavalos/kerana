import { GAMEPLAY } from '../config/gameplay';
import { VIEW } from './View';

/**
 * Botones que se pueden mover. El tamaño es un factor sobre el de fábrica.
 * S90: izquierda y derecha son una sola pieza, `move`: una zona con las dos flechas. Su `x`, `y` es el medio entre ellas.
 */
export const TOUCH_IDS = ['move', 'jump', 'attack', 'dash', 'pause'] as const;
export type TouchButtonId = (typeof TOUCH_IDS)[number];

export interface TouchButtonPlace {
  x: number;
  y: number;
  scale: number;
}

export type TouchLayout = Record<TouchButtonId, TouchButtonPlace>;

// `move` es el diámetro de cada flecha.
const BASE_SIZE: Record<TouchButtonId, number> = {
  move: 44,
  jump: 52,
  attack: 42,
  dash: 42,
  pause: 22,
};

const MIN_SCALE = 0.7;
const MAX_SCALE = 1.7;

export function touchButtonSize(id: TouchButtonId): number {
  return BASE_SIZE[id];
}

/** El de pausa tiene poco margen extra para no comerse el nivel. */
export function touchButtonRadius(id: TouchButtonId, scale: number): number {
  const slop = id === 'pause' ? GAMEPLAY.touch.pauseSlop : GAMEPLAY.touch.slop;
  return (BASE_SIZE[id] * scale) / 2 + slop;
}

/** Del medio de la zona de moverse al centro de cada flecha. */
export function moveArrowOffset(scale: number): number {
  return ((BASE_SIZE.move + GAMEPLAY.touch.moveGap) * scale) / 2;
}

/** La zona de moverse es una cápsula: todo lo que queda a un radio de toque del tramo entre las dos flechas. */
export function inMoveZone(place: TouchButtonPlace, x: number, y: number): boolean {
  const half = moveArrowOffset(place.scale);
  const dx = Math.max(0, Math.abs(x - place.x) - half);
  const dy = y - place.y;
  const r = touchButtonRadius('move', place.scale);
  return dx * dx + dy * dy <= r * r;
}

/** Hacia dónde mueve un dedo apoyado en `x`: −1 izquierda, 1 derecha, 0 en la zona muerta del medio. */
export function moveDirection(place: TouchButtonPlace, x: number): -1 | 0 | 1 {
  const offset = x - place.x;
  if (Math.abs(offset) < GAMEPLAY.touch.moveDeadZone * place.scale) return 0;
  return offset < 0 ? -1 : 1;
}

/** Posiciones de fábrica. La pausa queda chica, en la esquina, sin tapar el juego. */
export function defaultTouchLayout(): TouchLayout {
  const edge = 14;
  const move = BASE_SIZE.move;
  const jump = BASE_SIZE.jump;
  const action = BASE_SIZE.attack;
  const gap = 10;
  const moveY = VIEW.height - edge - move / 2;
  const jumpX = VIEW.width - edge - jump / 2;
  const jumpY = VIEW.height - edge - jump / 2;
  return {
    move: { x: edge + move / 2 + moveArrowOffset(1), y: moveY, scale: 1 },
    jump: { x: jumpX, y: jumpY, scale: 1 },
    attack: { x: jumpX - jump / 2 - gap - action / 2, y: jumpY - 6, scale: 1 },
    dash: { x: jumpX - 18, y: jumpY - jump / 2 - gap - action / 2, scale: 1 },
    pause: { x: VIEW.width - 16, y: 16, scale: 1 },
  };
}

function clampPlace(id: TouchButtonId, place: TouchButtonPlace): TouchButtonPlace {
  const scale = clamp(place.scale, MIN_SCALE, MAX_SCALE);
  const r = (BASE_SIZE[id] * scale) / 2;
  // La zona de moverse es más ancha que alta: las dos flechas tienen que quedar enteras en la pantalla.
  const rx = id === 'move' ? r + moveArrowOffset(scale) : r;
  return {
    x: clamp(place.x, rx, VIEW.width - rx),
    y: clamp(place.y, r, VIEW.height - r),
    scale,
  };
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function readPlace(value: unknown): TouchButtonPlace | null {
  if (!value || typeof value !== 'object') return null;
  const place = value as Record<string, unknown>;
  if (typeof place.x !== 'number' || typeof place.y !== 'number' || typeof place.scale !== 'number') return null;
  if (!Number.isFinite(place.x) || !Number.isFinite(place.y) || !Number.isFinite(place.scale)) return null;
  return { x: place.x, y: place.y, scale: place.scale };
}

/**
 * Guardados de antes de S90: `left` y `right` por separado. La zona queda en el medio de los dos, con el tamaño
 * promedio; si solo se guardó uno, se corre lo mismo que se había corrido ese.
 */
function migrateMove(raw: Record<string, unknown>): TouchButtonPlace | null {
  const left = readPlace(raw.left);
  const right = readPlace(raw.right);
  if (left && right) return { x: (left.x + right.x) / 2, y: (left.y + right.y) / 2, scale: (left.scale + right.scale) / 2 };
  const one = left ?? right;
  if (!one) return null;
  const side = left ? -1 : 1;
  return { x: one.x - side * moveArrowOffset(one.scale), y: one.y, scale: one.scale };
}

/** Completa lo que falte con la fábrica y deja cada botón dentro de la pantalla. */
export function resolveTouchLayout(saved: unknown): TouchLayout {
  const layout = defaultTouchLayout();
  if (!saved || typeof saved !== 'object') return layout;
  const raw = saved as Record<string, unknown>;
  for (const id of TOUCH_IDS) {
    const place = readPlace(raw[id]) ?? (id === 'move' ? migrateMove(raw) : null);
    if (place) layout[id] = clampPlace(id, place);
  }
  return layout;
}

export function stepTouchScale(scale: number, dir: 1 | -1): number {
  return clamp(Math.round((scale + dir * 0.15) * 100) / 100, MIN_SCALE, MAX_SCALE);
}
