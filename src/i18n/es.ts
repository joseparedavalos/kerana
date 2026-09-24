// Textos en español (voseo paraguayo, GDD §2.7).
export const es = {
  'game.title': 'KERANA',
  'game.subtitle': 'Pokõi Mbyja',
  'title.press_start': 'Pulsá {key}',
  'loading': 'Cargando…',

  'level.test.name': 'Nivel de prueba',

  'hint.test.move': 'Movete con {left} y {right}. Saltá con {jump}: mantenelo para llegar más alto.',
  'hint.test.water': 'El agua honda y los pozos te devuelven al último suelo firme.',

  'debug.state': 'Estado: {state}',
  'debug.fps': 'FPS: {fps}',
  'debug.velocity': 'Vel: {vx}, {vy}',
  'debug.ground': 'Suelo: {ground}',
  'debug.hearts': 'Corazones: {current}/{max}',
} as const;

export type TextKey = keyof typeof es;
