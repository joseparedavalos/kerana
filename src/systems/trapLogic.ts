// Red de seguridad contra encierros (S23, corregida en S24): lógica pura, sin Phaser.
//
// Un "encierro" es un sitio del mapa al que se puede llegar y del que Kerana no puede salir con lo que tiene
// (en el l2 de S23, el hueco entre el pilar de 7 y la pared del ascenso 2: se entraba cayendo y no se salía).
// Se calcula UNA vez al cargar el nivel, mirando solo la geometría, con un modelo de movimiento que exagera lo que
// Kerana puede hacer, pero nunca más allá de lo que permite la física del juego:
//   - salta `jumpRows` filas y `bounceRows` desde un hongo, calculadas con la física real (`trapReach`): el salto
//     perfecto sube 63,3 px (3 filas; 6 con salto doble) y el hongo 135,7 px (8; 11 con salto doble);
//   - en el aire se mueve sin límite hacia los costados y hacia abajo (mucho más de lo que puede de verdad);
//   - las plataformas móviles son piso en TODO su recorrido, los rompibles y las rejas no existen,
//     y el viento, la arena del jefe, la salida y las vacas cuentan como salida.
// Un piso queda "encerrado" solo si ni con ese modelo exagerado se llega desde él a una salida: el agua honda,
// las espinas o el fondo del mapa (que ya devuelven a Kerana a tierra firme), la arena o la meta.
// Un piso por el que se avanza o se pelea normalmente no puede quedar marcado: desde ahí se llega a la arena.
//
// Lo que corrigió S24: S23 sacaba el alcance de la fórmula continua v²/2g (4,17 tiles, 7,18 con salto doble) y lo
// redondeaba a 4 y 7 filas. El juego integra a paso fijo y sube menos: una pared de 4 (o de 7 con salto doble) no se
// trepa nunca, pero el modelo la daba por salida. Con `gifts=all` el hueco de l2 no quedaba marcado y la red no
// actuaba, por más que Kerana saltara (lo que le pasó a Jose). Exagerar más allá de la física deja encierros sin red.

/** Qué hay en cada tile para el análisis. */
export const TrapCell = {
  Air: 0,
  /** Suelo que no se rompe: no se atraviesa. */
  Solid: 1,
  /** Se pisa desde arriba y se atraviesa desde abajo (plataformas, camalotes, recorrido de las móviles). */
  Floor: 2,
  /** Hongo: lanza `bounceRows` filas. */
  Bounce: 3,
  /** Llegar acá ya saca a Kerana (agua honda, espinas, viento, arena, salida). */
  Escape: 4,
} as const;
export type TrapCellKind = (typeof TrapCell)[keyof typeof TrapCell];

export interface TrapGrid {
  width: number;
  height: number;
  /** `cells[y * width + x]`, un TrapCell. */
  cells: Uint8Array;
}

export interface TrapReach {
  /** Filas de pared que se trepan con el salto (con salto doble, el segundo en el ápice). Ver `trapReach`. */
  jumpRows: number;
  /** Filas de pared que se trepan con el rebote de un hongo (medidas desde el piso del hongo). */
  bounceRows: number;
  /** Filas que ocupa el cuerpo (42 px = 3 filas). */
  bodyRows: number;
}

/** Tramo de piso: tiles seguidos de una misma fila donde Kerana puede estar parada (`y` = fila de los pies). */
export interface TrapSpan {
  y: number;
  x0: number;
  x1: number;
}

export interface TrapResult {
  /** 1 = Kerana parada con los pies en esa celda está encerrada. */
  trapped: Uint8Array;
  /** Todos los tramos de piso, y cuáles quedaron encerrados (índices en `spans`). */
  spans: TrapSpan[];
  trappedSpans: number[];
  /** Tramo de cada celda de pie (-1 si no es piso). */
  spanAt: Int32Array;
}

/**
 * Altura (px) que suben los pies con la física del juego: Arcade avanza a paso fijo (`stepHz`, 60 por defecto) e
 * integra primero la velocidad y después la posición (Euler semi-implícito), así que sube menos que v²/2g. Cada
 * velocidad (px/s, hacia arriba negativa) se aplica en el ápice de la anterior: salto + salto doble.
 */
export function risePx(velocities: readonly number[], gravity: number, stepHz: number): number {
  const dt = 1 / stepHz;
  let px = 0;
  for (const v0 of velocities) {
    for (let v = Math.abs(v0) - gravity * dt; v > 0; v -= gravity * dt) px += v * dt;
  }
  return px;
}

/** Filas enteras de pared que se trepan subiendo `px` (una pared de N filas pide N × tile px). */
export function riseRows(px: number, tile: number): number {
  // Un margen mínimo para que 47,9999999 cuente como 3 filas de 16.
  return Math.floor(px / tile + 1e-6);
}

export interface ReachPhysics {
  gravity: number;
  /** Pasos de la física por segundo (Arcade `World.fps`). */
  stepHz: number;
  tile: number;
  jumpVelocity: number;
  /** Solo si Kerana tiene el salto doble. */
  doubleJumpVelocity?: number;
  bounceVelocity: number;
  /** Altura del sombrero del hongo sobre el piso (px): el rebote sale de ahí. */
  mushroomHeight: number;
  bodyHeight: number;
}

/**
 * Alcance del modelo (S24) con la física del juego, medido en S24 a 60 Hz cuadro a cuadro: salto 63,3 px (3 filas),
 * salto doble en el ápice 108,7 px (6), hongo 135,7 px (8) y hongo + salto doble 181 px (11).
 * El hongo empuja dos veces: `LevelScene.updateJungle` vuelve a ver a Kerana sobre el sombrero en el mismo cuadro
 * en que el motor ya la lanzó (el cuerpo se mueve recién en el paso siguiente), así que el segundo impulso sale un
 * paso de la física más arriba. Con el juego lento (más pasos por cuadro) sube más: el modelo usa los 60 Hz.
 */
export function trapReach(p: ReachPhysics): TrapReach {
  const extra = p.doubleJumpVelocity === undefined ? [] : [p.doubleJumpVelocity];
  const firstPush = (Math.abs(p.bounceVelocity) - p.gravity / p.stepHz) / p.stepHz;
  return {
    jumpRows: riseRows(risePx([p.jumpVelocity, ...extra], p.gravity, p.stepHz), p.tile),
    bounceRows: riseRows(p.mushroomHeight + firstPush + risePx([p.bounceVelocity, ...extra], p.gravity, p.stepHz), p.tile),
    bodyRows: Math.ceil(p.bodyHeight / p.tile),
  };
}

/**
 * Reloj de la red (S23; en lógica pura y con tests desde S24). Corre desde que Kerana pisa un piso encerrado y sigue
 * mientras salta, camina o ataca adentro: solo se corta cuando pisa un piso que no lo es (salió). Moverse no lo
 * reinicia. `step` devuelve true el cuadro en que se cumple la espera: hay que sacarla.
 */
export class TrapWatch {
  private ms = 0;
  private inside = false;

  /** ¿Pisó un encierro y todavía no pisó un piso libre? */
  get active(): boolean {
    return this.inside;
  }

  get elapsedMs(): number {
    return this.ms;
  }

  /** `standing`: pisa suelo este cuadro. `trappedFloor`: ese suelo es un piso encerrado (solo cuenta si pisa). */
  step(dtMs: number, standing: boolean, trappedFloor: boolean, waitMs: number): boolean {
    if (standing) this.inside = trappedFloor;
    if (!this.inside) {
      this.ms = 0;
      return false;
    }
    this.ms += dtMs;
    if (this.ms < waitMs) return false;
    this.reset();
    return true;
  }

  reset(): void {
    this.ms = 0;
    this.inside = false;
  }
}

export function findTraps(grid: TrapGrid, reach: TrapReach): TrapResult {
  const { width: w, height: h, cells } = grid;
  const at = (x: number, y: number): number => (x < 0 || x >= w || y >= h ? TrapCell.Solid : y < 0 ? TrapCell.Air : cells[y * w + x]);

  // El cuerpo entra con los pies en (x, y) si ninguna de sus filas es suelo.
  const clear = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let ok = true;
      for (let k = 0; k < reach.bodyRows && ok; k++) if (at(x, y - k) === TrapCell.Solid) ok = false;
      clear[y * w + x] = ok ? 1 : 0;
    }
  }
  const supports = (c: number) => c === TrapCell.Solid || c === TrapCell.Floor || c === TrapCell.Bounce;
  const standing = (x: number, y: number) => y + 1 < h && clear[y * w + x] === 1 && supports(at(x, y + 1));

  // Tramos de piso.
  const spanAt = new Int32Array(w * h).fill(-1);
  const spans: TrapSpan[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!standing(x, y)) continue;
      const prev = x > 0 ? spanAt[y * w + x - 1] : -1;
      if (prev >= 0) {
        spans[prev].x1 = x;
        spanAt[y * w + x] = prev;
      } else {
        spanAt[y * w + x] = spans.length;
        spans.push({ y, x0: x, x1: x });
      }
    }
  }

  // Nodos: un tramo (salta `jumpRows`) o un hongo (lanza `bounceRows`). Los hongos van después de los tramos.
  const bounceNode = new Int32Array(w * h).fill(-1);
  const bounceSeeds: [number, number][] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (cells[y * w + x] !== TrapCell.Bounce) continue;
      bounceNode[y * w + x] = spans.length + bounceSeeds.length;
      bounceSeeds.push([x, y]);
    }
  }
  const nodeCount = spans.length + bounceSeeds.length;
  const escapes = new Uint8Array(nodeCount);
  const next: number[][] = Array.from({ length: nodeCount }, () => []);

  // Relleno del aire desde un nodo: todo lo conectado sin pasar por encima de la fila `top`.
  const seen = new Int32Array(w * h).fill(-1);
  const queue = new Int32Array(w * h);
  const fill = (node: number, seeds: [number, number][], top: number): void => {
    let head = 0;
    let tail = 0;
    const succ = new Set<number>();
    const push = (x: number, y: number) => {
      const i = y * w + x;
      if (seen[i] === node) return;
      seen[i] = node;
      queue[tail++] = i;
    };
    for (const [x, y] of seeds) if (clear[y * w + x]) push(x, y);
    while (head < tail) {
      const i = queue[head++];
      const x = i % w;
      const y = (i - x) / w;
      const c = cells[i];
      if (c === TrapCell.Escape || at(x, y - 1) === TrapCell.Escape) {
        escapes[node] = 1;
        return;
      }
      const s = spanAt[i];
      if (s >= 0 && s !== node) succ.add(s);
      if (c === TrapCell.Bounce && bounceNode[i] !== node) succ.add(bounceNode[i]);
      const below = at(x, y + 1);
      if (y + 1 < h && below === TrapCell.Bounce && bounceNode[i + w] !== node) succ.add(bounceNode[i + w]);
      if (x > 0 && clear[i - 1]) push(x - 1, y);
      if (x + 1 < w && clear[i + 1]) push(x + 1, y);
      if (y - 1 >= Math.max(top, 0) && clear[i - w]) push(x, y - 1);
      // Hacia abajo, salvo que haya algo que pisar (no se atraviesan las plataformas desde arriba).
      if (y + 1 >= h) {
        escapes[node] = 1;
        return;
      }
      if (!supports(below) && clear[i + w]) push(x, y + 1);
    }
    next[node] = [...succ];
  };

  spans.forEach((sp, n) => {
    const seeds: [number, number][] = [];
    for (let x = sp.x0; x <= sp.x1; x++) seeds.push([x, sp.y]);
    fill(n, seeds, sp.y - reach.jumpRows);
  });
  bounceSeeds.forEach(([x, y], k) => fill(spans.length + k, [[x, y]], y - reach.bounceRows));

  // Libre = llega (en uno o varios pasos) a una salida. Se propaga hacia atrás desde las salidas.
  const prev: number[][] = Array.from({ length: nodeCount }, () => []);
  next.forEach((list, from) => list.forEach((to) => prev[to].push(from)));
  const free = new Uint8Array(nodeCount);
  const stack: number[] = [];
  for (let n = 0; n < nodeCount; n++) {
    if (escapes[n]) {
      free[n] = 1;
      stack.push(n);
    }
  }
  while (stack.length) {
    const n = stack.pop()!;
    for (const p of prev[n]) {
      if (free[p]) continue;
      free[p] = 1;
      stack.push(p);
    }
  }

  const trapped = new Uint8Array(w * h);
  const trappedSpans: number[] = [];
  spans.forEach((sp, n) => {
    if (free[n]) return;
    trappedSpans.push(n);
    for (let x = sp.x0; x <= sp.x1; x++) trapped[sp.y * w + x] = 1;
  });
  return { trapped, spans, trappedSpans, spanAt };
}

/** Objeto del mapa en px (como viene de Tiled), con su clase y propiedades. */
export interface TrapObject {
  cls: string;
  x: number;
  y: number;
  width: number;
  height: number;
  props: Record<string, unknown>;
}

export interface TrapMapSource {
  width: number;
  height: number;
  tile: number;
  ground: (x: number, y: number) => boolean;
  platforms: (x: number, y: number) => boolean;
  hazards: (x: number, y: number) => boolean;
  water: (x: number, y: number) => boolean;
  objects: readonly TrapObject[];
  /** Medio ancho (px) de la zona en la que una vaca puede llevar a Kerana (su patrulla y un poco más). */
  cowReachPx: number;
}

/** Arma la grilla del análisis desde las capas y los objetos del mapa (el mismo JSON de Tiled que carga el nivel). */
export function trapGridFromMap(src: TrapMapSource): TrapGrid {
  const { width: w, height: h, tile } = src;
  const cells = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (src.ground(x, y)) cells[i] = TrapCell.Solid;
      else if (src.platforms(x, y)) cells[i] = TrapCell.Floor;
      else if (src.hazards(x, y) || src.water(x, y)) cells[i] = TrapCell.Escape;
    }
  }
  // Recorre los tiles que toca un rectángulo en px.
  const paint = (px: number, py: number, pw: number, ph: number, put: (i: number) => void) => {
    const x0 = Math.max(0, Math.floor(px / tile));
    const x1 = Math.min(w - 1, Math.ceil((px + pw) / tile) - 1);
    const y0 = Math.max(0, Math.floor(py / tile));
    const y1 = Math.min(h - 1, Math.ceil((py + ph) / tile) - 1);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) put(y * w + x);
  };
  const num = (v: unknown) => (typeof v === 'number' ? v : Number(v ?? 0) || 0);
  // Primero lo que abre (rompibles), después lo que se pisa y al final las salidas (solo sobre aire).
  for (const o of src.objects) if (o.cls === 'Breakable') paint(o.x, o.y, o.width, o.height, (i) => (cells[i] = TrapCell.Air));
  for (const o of src.objects) {
    if (o.cls === 'Mover') {
      const dx = num(o.props.dx) * tile;
      const dy = num(o.props.dy) * tile;
      const x0 = Math.min(o.x, o.x + dx);
      const y0 = Math.min(o.y, o.y + dy);
      paint(x0, y0, o.width + Math.abs(dx), o.height + Math.abs(dy), (i) => {
        if (cells[i] !== TrapCell.Solid) cells[i] = TrapCell.Floor;
      });
    } else if (o.cls === 'Crumble' || o.cls === 'Sinking') {
      paint(o.x, o.y, o.width, o.height, (i) => {
        if (cells[i] !== TrapCell.Solid) cells[i] = TrapCell.Floor;
      });
    } else if (o.cls === 'Bouncer') {
      paint(o.x, o.y, o.width, o.height, (i) => (cells[i] = TrapCell.Bounce));
    }
  }
  const escape = (i: number) => {
    if (cells[i] === TrapCell.Air) cells[i] = TrapCell.Escape;
  };
  for (const o of src.objects) {
    if (o.cls === 'WindZone' || o.cls === 'BossArena' || o.cls === 'LevelExit' || o.cls === 'ChaseZone') {
      paint(o.x, o.y, o.width, o.height, escape);
    } else if (o.cls === 'Enemy' && (o.props.kind === 'vaca' || o.props.kind === 'vaca_embrujada')) {
      // La vaca es una plataforma que camina: donde puede estar, se puede subir a ella.
      paint(o.x - src.cowReachPx, o.y - 5 * tile, src.cowReachPx * 2, 5 * tile, escape);
    }
  }
  return { width: w, height: h, cells };
}
