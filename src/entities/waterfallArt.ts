// Dibujo de la cascada (S116), lógica pura: las texturas como píxeles RGBA (se generan una vez por partida) y dónde
// el chorro cruza un piso. Sin Phaser: lo prueba tests/waterfall.test.ts.
//
// Todo a 1 píxel por unidad del mundo, como los tiles. La paleta es una rampa de seis tonos de agua (medida en el prop
// l6_agua/waterfall y en la bruma de l6_far.jpg) más el brillo: el chorro es agua, no una cortina blanca.

/** Lo que el dibujo necesita de GAMEPLAY.waterfall. */
export interface WaterfallArtConfig {
  /** Seis tonos de agua, del más hondo al más claro, y el brillo (siete colores 0xRRGGBB). */
  ramp: readonly number[];
  /** Opacidad de cada tono de la lámina de atrás (0-1): translúcida, para que se adivine lo de detrás. */
  backAlpha: readonly number[];
  /** Alto de las texturas que caen (se repiten hacia abajo sin costura). */
  period: number;
  /** Rendijas: cuántas por cada 16 de ancho, su largo (unidades) y opacidad (0-1): por ahí se ve detrás. */
  slitsPerTile: number;
  slitLength: readonly [number, number];
  slitAlpha: number;
  /** Hilos claros de atrás y de adelante: cuántos por cada 16 de ancho y su largo. */
  backThreadsPerTile: number;
  frontThreadsPerTile: number;
  threadLength: readonly [number, number];
  /** Opacidad de los hilos de adelante (el claro y el brillo). */
  frontAlpha: readonly [number, number];
  /** Cresta: alto de la textura (unidades), cuánto sube sobre el borde de arriba del chorro y cuánto empieza antes. */
  lipHeight: number;
  lipRise: number;
  lipLead: number;
  /** Cuánto baja el filo de la cresta de la esquina de la roca a la punta de la derecha. */
  lipDrop: number;
}

export interface RgbaImage {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

/** Un tramo de piso que el chorro cruza: la línea de arriba de un sólido con aire encima, dentro del chorro. */
export interface WaterfallLedge {
  y: number;
  x0: number;
  x1: number;
}

const rgb = (c: number): [number, number, number] => [(c >> 16) & 0xff, (c >> 8) & 0xff, c & 0xff];

/** Azar fijo (mulberry32): el mismo dibujo en cada partida. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const range = (rnd: () => number, [lo, hi]: readonly [number, number]) => lo + Math.floor(rnd() * (hi - lo + 1));
const mod = (a: number, n: number) => ((a % n) + n) % n;

function image(width: number, height: number): RgbaImage {
  return { width, height, data: new Uint8ClampedArray(width * height * 4) };
}

function put(img: RgbaImage, x: number, y: number, color: number, alpha: number): void {
  if (x < 0 || y < 0 || x >= img.width || y >= img.height) return;
  const [r, g, b] = rgb(color);
  img.data.set([r, g, b, Math.round(Math.max(0, Math.min(1, alpha)) * 255)], (y * img.width + x) * 4);
}

/**
 * Cuán gruesa es la lámina en la columna x (0-1): más agua al centro, menos en los bordes, con canales (unas columnas
 * más cargadas que otras: el agua no cae pareja). Siempre la misma para el mismo ancho.
 */
export function channelProfile(width: number, seed = 116): number[] {
  const rnd = seededRandom(seed);
  const p1 = rnd() * Math.PI * 2;
  const p2 = rnd() * Math.PI * 2;
  return Array.from({ length: width }, (_, x) => {
    const u = (x + 0.5) / width;
    const body = Math.pow(Math.sin(Math.PI * u), 0.5);
    const channels = 0.5 + 0.3 * Math.sin(p1 + x * 0.9) + 0.2 * Math.sin(p2 + x * 0.37);
    return Math.max(0, Math.min(1, 0.55 * body + 0.45 * channels));
  });
}

/**
 * La lámina de atrás: el cuerpo del chorro, translúcido. Cada columna con su tono (el canal) y tramos más claros que
 * bajan (los hilos de atrás), rendijas casi transparentes y los bordes deshilachados (el borde corre hacia adentro y
 * hacia afuera a lo alto). Se repite hacia abajo cada `period`: todo lo que corre a lo alto se envuelve.
 */
export function paintBackSheet(width: number, cfg: WaterfallArtConfig, seed = 1161): RgbaImage {
  const H = cfg.period;
  const img = image(width, H);
  const rnd = seededRandom(seed);
  const profile = channelProfile(width);
  const tone = new Float32Array(width * H);
  const slit = new Uint8Array(width * H);
  for (let x = 0; x < width; x++) {
    // Tono base del canal (1 a 3) con un poco de grano que baja.
    for (let y = 0; y < H; y++) {
      const grain = Math.sin((y / H) * Math.PI * 2 * 3 + x * 1.7) * 0.35;
      // La lámina es un cilindro: la izquierda en la sombra de la roca, la luz a la derecha del centro.
      const u = (x + 0.5) / width;
      const light = u < 0.3 ? -0.6 * (1 - u / 0.3) : 0.4 * Math.sin(Math.PI * Math.min(1, (u - 0.3) / 0.6));
      tone[y * width + x] = 1 + profile[x]! * 2 + grain + light;
    }
  }
  // Hilos de atrás: tramos uno o dos tonos más claros.
  const threads = Math.max(1, Math.round((width / 16) * cfg.backThreadsPerTile));
  for (let k = 0; k < threads; k++) {
    const x = Math.floor(rnd() * width);
    const y0 = Math.floor(rnd() * H);
    const len = range(rnd, cfg.threadLength);
    const lift = 1 + (rnd() < 0.4 ? 1 : 0);
    const wide = rnd() < 0.35 ? 2 : 1;
    for (let j = 0; j < len; j++) {
      const end = Math.min(j, len - 1 - j);
      for (let dx = 0; dx < wide && x + dx < width; dx++) {
        const i = mod(y0 + j, H) * width + x + dx;
        tone[i] = Math.max(tone[i]!, tone[i]! + (lift - dx * 0.5) * Math.min(1, (end + 1) / 3));
      }
    }
  }
  // Rendijas: por ahí se ve lo de detrás (la cornisa, la gruta).
  const slits = Math.max(1, Math.round((width / 16) * cfg.slitsPerTile));
  for (let k = 0; k < slits; k++) {
    const x = 2 + Math.floor(rnd() * Math.max(1, width - 4));
    const y0 = Math.floor(rnd() * H);
    const len = range(rnd, cfg.slitLength);
    for (let j = 0; j < len; j++) {
      const i = mod(y0 + j, H) * width + x;
      tone[i] = Math.max(0, tone[i]! - 1);
      slit[i] = 1;
    }
  }
  // Bordes deshilachados: cuántas columnas faltan a cada lado, a lo alto (periódico).
  const edge = (side: number, y: number) => {
    const w = Math.sin((y / H) * Math.PI * 2 * 2 + side * 2.1) + Math.sin((y / H) * Math.PI * 2 * 5 + side);
    return Math.max(0, Math.round(1.2 + w * 1.1));
  };
  for (let y = 0; y < H; y++) {
    const left = edge(0, y);
    const right = edge(1, y);
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const fromEdge = Math.min(x - left, width - 1 - right - x);
      if (fromEdge < 0) continue;
      let t = Math.round(Math.max(0, Math.min(5, tone[i]!)));
      // El filo de cada lado, un tono más claro: el espesor de la lámina que da vuelta.
      if (fromEdge === 0) t = Math.min(5, t + 1);
      const a = (slit[i] ? cfg.slitAlpha : cfg.backAlpha[t]!) * (fromEdge === 0 ? 0.7 : 1);
      put(img, x, y, cfg.ramp[t]!, a);
    }
  }
  return img;
}

/**
 * La lámina de adelante: casi toda transparente, con los hilos claros que caen más rápido (el claro con su cabeza de
 * brillo) y alguna gota suelta. Se repite hacia abajo cada `period`.
 */
export function paintFrontSheet(width: number, cfg: WaterfallArtConfig, seed = 1162): RgbaImage {
  const H = cfg.period;
  const img = image(width, H);
  const rnd = seededRandom(seed);
  const count = Math.max(1, Math.round((width / 16) * cfg.frontThreadsPerTile));
  for (let k = 0; k < count; k++) {
    const x = 1 + Math.floor(((k + rnd() * 0.8) / count) * (width - 2));
    const y0 = Math.floor(rnd() * H);
    const len = range(rnd, cfg.threadLength);
    for (let j = 0; j < len; j++) {
      const y = mod(y0 + j, H);
      // La cabeza (abajo, lo que va adelante al caer) es el brillo; la cola se apaga hacia arriba.
      const head = j >= len - 2;
      const fade = Math.min(1, (j + 1) / (len * 0.6));
      put(img, x, y, cfg.ramp[head ? 6 : 5]!, (head ? cfg.frontAlpha[1] : cfg.frontAlpha[0]) * fade);
      // Algunos hilos van de a dos columnas: una lámina fina, un tono más oscura al lado.
      if (k % 3 === 0 && !head) put(img, x + 1, y, cfg.ramp[4]!, cfg.frontAlpha[0] * 0.55 * fade);
    }
    // Una gota suelta delante del hilo.
    if (rnd() < 0.5) put(img, x, mod(y0 + len + 2, H), cfg.ramp[6]!, cfg.frontAlpha[1] * 0.8);
  }
  // Grumos de agua blanca que bajan: manchas chatas, más claras al frente (abajo), tramadas atrás.
  const clumps = Math.max(1, Math.round((width / 16) * 2));
  for (let k = 0; k < clumps; k++) {
    const cx = 3 + Math.floor(rnd() * (width - 6));
    const cy = Math.floor(rnd() * H);
    const rw = 2 + Math.floor(rnd() * 3);
    const rh = 3 + Math.floor(rnd() * 4);
    for (let dy = -rh; dy <= 1; dy++) {
      for (let dx = -rw; dx <= rw; dx++) {
        const d = Math.hypot(dx / rw, dy / rh);
        if (d > 1 || (d > 0.55 && rnd() < 0.55)) continue;
        put(img, cx + dx, mod(cy + dy, H), cfg.ramp[dy >= 0 ? 6 : 5]!, cfg.frontAlpha[0] * (dy >= 0 ? 1.2 : 0.8));
      }
    }
  }
  return img;
}

/**
 * El filo de la cresta, columna por columna de su textura (fila donde empieza el agua; la línea del suelo es `lipRise`):
 * arriba de todo en la esquina de la roca, de donde sale el agua, y en arco hacia la derecha, cada vez más abajo (el agua
 * que se aleja del borde ya va cayendo). Sobre la roca, la lámina fina apoyada en el suelo. Lo usa también el brillo.
 */
export function lipCrest(width: number, cfg: WaterfallArtConfig): number[] {
  const lead = cfg.lipLead;
  const W = lead + width + 2;
  const R = cfg.lipRise;
  return Array.from({ length: W }, (_, x) => {
    if (x < lead) return R;
    const u = (x - lead) / Math.max(1, W - 1 - lead);
    const arc = Math.round(cfg.lipDrop * Math.pow(u, 1.7));
    // Una ondita larga en el filo, para que no sea una regla.
    const wave = Math.sin((x - lead) * 0.3 + 0.6) > 0.55 ? 1 : 0;
    return Math.min(cfg.lipHeight - 6, Math.max(0, R - 3 + arc + wave));
  });
}

/**
 * La cresta: el agua que se curva al caer por el borde. Una franja que empieza `lipLead` antes del chorro (sobre la
 * roca de arriba: la lámina fina que corre hacia el borde), sube `lipRise` sobre el borde de arriba y se pasa 2 a la
 * derecha. El filo redondo con su luz (brillo, tono claro), la curva que se oscurece al dar vuelta (la sombra bajo el
 * filo), los primeros hilos que nacen de ahí, y abajo se funde con la lámina. En la esquina de la roca el filo sube:
 * ahí el agua da vuelta.
 */
export function paintLip(width: number, cfg: WaterfallArtConfig, seed = 1163): RgbaImage {
  const lead = cfg.lipLead;
  const W = lead + width + 2;
  const H = cfg.lipHeight;
  const R = cfg.lipRise;
  const img = image(W, H);
  const rnd = seededRandom(seed);
  const profile = channelProfile(width);
  // La lámina sobre la roca: de 1 fila en la punta a 2 junto al borde, apoyada en la línea del suelo (fila R).
  for (let x = 0; x < lead; x++) {
    const rows = x < lead / 2 ? 1 : 2;
    for (let k = 0; k < rows; k++) {
      const y = R - 1 - k;
      const top = k === rows - 1;
      put(img, x, y, cfg.ramp[top ? 5 : 3]!, (top ? 0.75 : 0.7) * Math.min(1, (x + 1) / 3));
    }
  }
  const crest = lipCrest(width, cfg);
  // Las filas bajo el filo: el brillo, los claros que dan vuelta, la sombra y la lámina que se funde.
  const curl: [number, number][] = [
    [6, 0.92],
    [5, 0.86],
    [4, 0.8],
    [4, 0.74],
    [3, 0.68],
    [2, 0.62],
    [1, 0.56],
    [2, 0.54],
  ];
  for (let x = lead; x < W; x++) {
    const i = Math.max(0, Math.min(width - 1, x - lead));
    const p = profile[i]!;
    const hug = x - lead < 2;
    for (let y = crest[x]!; y < H; y++) {
      const k = y - crest[x]!;
      let [t, a] = k < curl.length ? curl[k]! : [Math.max(1, Math.min(4, Math.round(1 + p * 2.2))), 0.56];
      // Los canales más cargados llevan la luz más abajo; los flacos se oscurecen antes.
      if (k >= 2 && k <= 4 && p > 0.62) t = Math.min(5, t + 1);
      if (k >= 1 && k <= 3 && p < 0.4) t = Math.max(1, t - 1);
      if (k === 0 && rnd() < 0.2) t = 5;
      // Junto a la roca, a la sombra.
      if (hug && k > 0) t = Math.max(1, t - 1);
      const fadeFrom = H - 5;
      if (y >= fadeFrom) a *= 1 - (y - fadeFrom + 1) / 6;
      const edge = x >= W - 2;
      put(img, x, y, cfg.ramp[t]!, edge ? a * 0.6 : a);
    }
  }
  return img;
}

/** Una mancha de espuma (w × h): blanca azulada, con el borde tramado y más transparente. */
export function paintFoam(w: number, h: number, cfg: WaterfallArtConfig, seed = 1164): RgbaImage {
  const img = image(w, h);
  const rnd = seededRandom(seed);
  const cx = (w - 1) / 2;
  const cy = (h - 1) / 2;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const d = Math.hypot((x - cx) / (w / 2), (y - cy) / (h / 2));
      if (d > 1) continue;
      if (d > 0.7 && rnd() < 0.5) continue;
      const t = d < 0.45 ? 6 : d < 0.8 ? 5 : 4;
      put(img, x, y, cfg.ramp[t]!, d < 0.45 ? 0.9 : 0.7);
    }
  }
  return img;
}

/** Una bocanada de rocío (w × h): blanca azulada, opaca al centro y tramada hacia afuera (pixel art, sin degradé liso). */
export function paintPuff(w: number, h: number, cfg: WaterfallArtConfig, seed = 1165): RgbaImage {
  const img = image(w, h);
  const rnd = seededRandom(seed);
  const cx = (w - 1) / 2;
  const cy = (h - 1) / 2;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const d = Math.hypot((x - cx) / (w / 2), (y - cy) / (h / 2));
      if (d > 1) continue;
      // Trama: cuanto más lejos del centro, menos píxeles.
      const keep = d < 0.4 ? 1 : 1 - (d - 0.4) / 0.6;
      if (rnd() > keep) continue;
      put(img, x, y, cfg.ramp[d < 0.5 ? 6 : 5]!, d < 0.5 ? 0.8 : 0.55);
    }
  }
  return img;
}

/** Una onda en la poza: el borde de una elipse de 1 px (w × h), el frente claro y la parte de atrás más tenue. */
export function paintRipple(w: number, h: number, cfg: WaterfallArtConfig): RgbaImage {
  const img = image(w, h);
  const cx = (w - 1) / 2;
  const cy = (h - 1) / 2;
  const steps = Math.max(24, Math.round((w + h) * 2));
  for (let k = 0; k < steps; k++) {
    const a = (k / steps) * Math.PI * 2;
    const x = Math.round(cx + Math.cos(a) * cx);
    const y = Math.round(cy + Math.sin(a) * cy);
    const front = Math.sin(a) > 0;
    put(img, x, y, cfg.ramp[front ? 5 : 4]!, front ? 0.85 : 0.45);
  }
  return img;
}

/**
 * La poza al pie (w × h): el agua revuelta que recibe el chorro. Franjas horizontales que ondulan, más claras arriba
 * (la superficie con su línea de luz), y espuma tramada donde cae el chorro (el centro, `jet` de ancho).
 */
export function paintPool(w: number, h: number, jet: number, cfg: WaterfallArtConfig, seed = 1166): RgbaImage {
  const img = image(w, h);
  const rnd = seededRandom(seed);
  const cx = w / 2;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const end = Math.min(x, w - 1 - x);
      if (end < 3 && y < 3 - end) continue;
      const wave = Math.sin(x * 0.45 + y * 1.3) * 0.6;
      // La superficie con su línea de luz, el agua clara debajo y más honda (más oscura y transparente) abajo.
      let t = y === 0 ? 5 : y === 1 ? 4 : Math.max(1, Math.round(3.4 - (y / h) * 1.8 + wave));
      const inJet = Math.abs(x - cx) < jet / 2 + (rnd() < 0.5 ? 2 : 0);
      if (inJet && y < h - 3 && rnd() < 0.55) t = rnd() < 0.5 ? 6 : 5;
      const base = y < 2 ? 0.8 : 0.62 - (y / h) * 0.15;
      const a = end < 4 ? base * (0.45 + end * 0.14) : inJet ? Math.max(base, 0.8) : base;
      put(img, x, y, cfg.ramp[t]!, a);
    }
  }
  return img;
}

/**
 * Dónde el chorro cruza un piso: dentro de las columnas del chorro, cada fila de sólido con aire encima (no la primera
 * fila del chorro: de ahí sale el agua). `solid(cx, cy)` en celdas; el chorro en unidades. Tramos contiguos juntos.
 */
export function waterfallLedges(
  zone: { x: number; y: number; width: number; height: number },
  tile: number,
  solid: (cx: number, cy: number) => boolean,
): WaterfallLedge[] {
  const out: WaterfallLedge[] = [];
  const cx0 = Math.floor(zone.x / tile);
  const cx1 = Math.ceil((zone.x + zone.width) / tile) - 1;
  const cy0 = Math.floor(zone.y / tile);
  const cy1 = Math.ceil((zone.y + zone.height) / tile) - 1;
  for (let cy = cy0 + 1; cy <= cy1; cy++) {
    let run: WaterfallLedge | null = null;
    for (let cx = cx0; cx <= cx1; cx++) {
      const top = solid(cx, cy) && !solid(cx, cy - 1);
      if (top && run) run.x1 = (cx + 1) * tile;
      else if (top) run = { y: cy * tile, x0: cx * tile, x1: (cx + 1) * tile };
      if (!top && run) {
        out.push(run);
        run = null;
      }
    }
    if (run) out.push(run);
  }
  return out.map((l) => ({ y: l.y, x0: Math.max(l.x0, zone.x), x1: Math.min(l.x1, zone.x + zone.width) }));
}
