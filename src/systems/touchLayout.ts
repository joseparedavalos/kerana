import { VIEW } from './View';

/** Botones que se pueden mover. El tamaño es un factor sobre el de fábrica. */
export const TOUCH_IDS = ['left', 'right', 'jump', 'attack', 'dash', 'pause'] as const;
export type TouchButtonId = (typeof TOUCH_IDS)[number];

export interface TouchButtonPlace {
  x: number;
  y: number;
  scale: number;
}

export type TouchLayout = Record<TouchButtonId, TouchButtonPlace>;

const BASE_SIZE: Record<TouchButtonId, number> = {
  left: 44,
  right: 44,
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
  const slop = id === 'pause' ? 4 : 18;
  return (BASE_SIZE[id] * scale) / 2 + slop;
}

/** Posiciones de fábrica. La pausa queda chica, en la esquina, sin tapar el juego. */
export function defaultTouchLayout(): TouchLayout {
  const edge = 14;
  const move = BASE_SIZE.left;
  const jump = BASE_SIZE.jump;
  const action = BASE_SIZE.attack;
  const gap = 10;
  const moveY = VIEW.height - edge - move / 2;
  const jumpX = VIEW.width - edge - jump / 2;
  const jumpY = VIEW.height - edge - jump / 2;
  return {
    left: { x: edge + move / 2, y: moveY, scale: 1 },
    right: { x: edge + move / 2 + move + gap, y: moveY, scale: 1 },
    jump: { x: jumpX, y: jumpY, scale: 1 },
    attack: { x: jumpX - jump / 2 - gap - action / 2, y: jumpY - 6, scale: 1 },
    dash: { x: jumpX - 18, y: jumpY - jump / 2 - gap - action / 2, scale: 1 },
    pause: { x: VIEW.width - 16, y: 16, scale: 1 },
  };
}

function clampPlace(id: TouchButtonId, place: TouchButtonPlace): TouchButtonPlace {
  const scale = clamp(place.scale, MIN_SCALE, MAX_SCALE);
  const r = (BASE_SIZE[id] * scale) / 2;
  return {
    x: clamp(place.x, r, VIEW.width - r),
    y: clamp(place.y, r, VIEW.height - r),
    scale,
  };
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/** Completa lo que falte con la fábrica y deja cada botón dentro de la pantalla. */
export function resolveTouchLayout(saved: unknown): TouchLayout {
  const layout = defaultTouchLayout();
  if (!saved || typeof saved !== 'object') return layout;
  const raw = saved as Record<string, unknown>;
  for (const id of TOUCH_IDS) {
    const value = raw[id];
    if (!value || typeof value !== 'object') continue;
    const place = value as Record<string, unknown>;
    if (typeof place.x !== 'number' || typeof place.y !== 'number' || typeof place.scale !== 'number') continue;
    if (!Number.isFinite(place.x) || !Number.isFinite(place.y) || !Number.isFinite(place.scale)) continue;
    layout[id] = clampPlace(id, { x: place.x, y: place.y, scale: place.scale });
  }
  return layout;
}

export function stepTouchScale(scale: number, dir: 1 | -1): number {
  return clamp(Math.round((scale + dir * 0.15) * 100) / 100, MIN_SCALE, MAX_SCALE);
}
