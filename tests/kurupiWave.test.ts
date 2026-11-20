import { describe, expect, it } from 'vitest';
import { GAMEPLAY } from '../src/config/gameplay';
import {
  COLLAPSE_FRAMES,
  CRACK,
  CRACK_STAGES,
  CRACK_VARIANTS,
  CREST_FRAMES,
  crestSize,
  DUST_FRAMES,
  paintCrack,
  paintCrest,
  paintDust,
  WAVE_COLORS,
  WAVE_DETAIL,
  waveFrames,
} from '../src/entities/bosses/kurupiWaveArt';
import { crackStage, loopFrame, stepWave, waveBox, type Box } from '../src/entities/bosses/kurupiWaveLogic';
import { alphaAt, colorAt, type Pixels } from '../src/systems/pixelArt';

// S114: la onda del pisotón de Kurupi, dibujada de nuevo (la tierra que revienta el suelo). El dibujo cambia; lo que
// daña no: la hitbox, la velocidad y la vida son las de antes.

const K = GAMEPLAY.kurupi;
const W = GAMEPLAY.kurupiWave;
const DARK = new Set([0x0e0a08, 0x17110c]);

const opaque = (p: Pixels, x: number, y: number): boolean => alphaAt(p, x, y) > 0;
function count(p: Pixels, x0 = 0, y0 = 0, x1 = p.width - 1, y1 = p.height - 1): number {
  let n = 0;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (opaque(p, x, y)) n++;
  return n;
}

describe('la onda del pisotón de Kurupi (S114)', () => {
  it('lo que daña es lo de antes: 18 × 10 unidades, 150 px/s y 1,7 s', () => {
    expect([K.waveWidth, K.waveHeight, K.waveSpeed, K.waveLifeMs]).toEqual([18, 10, 150, 1700]);
  });

  it('avanza a la velocidad de siempre y se apaga al acabarse la vida o al salir de la arena', () => {
    const w = { x: 100, vx: K.waveSpeed, lifeMs: K.waveLifeMs };
    let steps = 0;
    while (stepWave(w, 100, 0, 10_000)) steps++;
    // 16 pasos de 100 ms vivos (1,6 s); el 17.º agota los 1,7 s.
    expect(steps).toBe(16);
    expect(w.lifeMs).toBe(0);
    expect(w.x).toBeCloseTo(100 + K.waveSpeed * 1.7);
    // Hacia la izquierda, contra el borde de la arena: se apaga al pasarlo.
    const l = { x: 40, vx: -K.waveSpeed, lifeMs: K.waveLifeMs };
    expect(stepWave(l, 100, 20, 600)).toBe(true);
    expect(stepWave(l, 100, 20, 600)).toBe(false);
    expect(l.lifeMs).toBe(0);
    // Apagada no se mueve.
    const x = l.x;
    expect(stepWave(l, 100, 20, 600)).toBe(false);
    expect(l.x).toBe(x);
  });

  it('la hitbox es la del rectángulo de antes: centrada en la onda, con la base en el suelo', () => {
    const out: Box = { x: 0, y: 0, width: 0, height: 0 };
    expect(waveBox(200, 500, K.waveWidth, K.waveHeight, out)).toEqual({ x: 191, y: 490, width: 18, height: 10 });
  });

  it('las grietas se cierran en tres pasos y se apagan; la cresta da vueltas a su ritmo', () => {
    const stages = W.crack.stageMs;
    const total = stages.reduce((a, b) => a + b, 0);
    expect(crackStage(0, stages)).toBe(0);
    expect(crackStage(stages[0] - 1, stages)).toBe(0);
    expect(crackStage(stages[0], stages)).toBe(1);
    expect(crackStage(total - 1, stages)).toBe(2);
    expect(crackStage(total, stages)).toBe(-1);
    expect(loopFrame(0, W.crestFps, CREST_FRAMES)).toBe(0);
    expect(loopFrame((1000 / W.crestFps) * (CREST_FRAMES + 1) + 1, W.crestFps, CREST_FRAMES)).toBe(1);
  });

  it('pixel art: siempre igual, sin alfa a medias y solo con los colores medidos', () => {
    const a = waveFrames(K.waveWidth, K.waveHeight);
    const b = waveFrames(K.waveWidth, K.waveHeight);
    expect(a.map((f) => f.name)).toEqual(b.map((f) => f.name));
    const palette = new Set(WAVE_COLORS);
    for (let i = 0; i < a.length; i++) {
      expect(Array.from(a[i].px.data)).toEqual(Array.from(b[i].px.data));
      const p = a[i].px;
      for (let y = 0; y < p.height; y++) {
        for (let x = 0; x < p.width; x++) {
          const al = alphaAt(p, x, y);
          expect(al === 0 || al === 255).toBe(true);
          if (al) expect(palette.has(colorAt(p, x, y)), `${a[i].name} (${x}, ${y})`).toBe(true);
        }
      }
    }
  });

  it('la cresta llena la hitbox (lo que daña se ve) y casi no sale de ella', () => {
    const s = crestSize(K.waveWidth, K.waveHeight);
    const top = s.floor - K.waveHeight * WAVE_DETAIL;
    expect(s.right - s.left + 1).toBe(K.waveWidth * WAVE_DETAIL);
    for (let f = 0; f < CREST_FRAMES; f++) {
      const p = paintCrest(s, f);
      const area = (s.right - s.left + 1) * (s.floor - top);
      const inside = count(p, s.left, top, s.right, s.floor - 1);
      // Fuera de la hitbox, sobre el suelo: los terrones que salta y lo que se desmorona adelante.
      const above = count(p, 0, 0, s.width - 1, top - 1);
      expect(inside / area, `cuadro ${f}`).toBeGreaterThan(0.6);
      expect(above / inside, `cuadro ${f}`).toBeLessThan(0.15);
      // Las dos unidades de abajo, macizas de punta a punta: no se puede pasar por debajo de lo que se ve.
      for (let y = s.floor - 4; y < s.floor; y++) expect(count(p, s.left, y, s.right, y), `cuadro ${f}, fila ${y}`).toBeGreaterThanOrEqual(s.right - s.left - 1);
      // Mira hacia donde corre: adelante es más alta que atrás, y llega al alto de la hitbox.
      const heights: number[] = [];
      for (let x = s.left; x <= s.right; x++) {
        let y = top;
        while (y < s.floor && !opaque(p, x, y)) y++;
        heights.push(s.floor - y);
      }
      const mean = (a: number[]): number => a.reduce((t, v) => t + v, 0) / a.length;
      const q = Math.floor(heights.length / 4);
      expect(mean(heights.slice(heights.length / 2)), `cuadro ${f}`).toBeGreaterThan(mean(heights.slice(0, q)));
      expect(Math.max(...heights)).toBeGreaterThanOrEqual(K.waveHeight * WAVE_DETAIL - 2);
    }
    // El derrumbe: cada vez más bajo.
    const heights = [paintCrest(s, 0), paintCrest(s, 0, 1), paintCrest(s, 0, 2)].map((p) => count(p, s.left, 0, s.right, s.floor - 1));
    expect(heights[1]).toBeLessThan(heights[0]);
    expect(heights[2]).toBeLessThan(heights[1]);
    expect(COLLAPSE_FRAMES).toBe(2);
  });

  it('las grietas se empalman de celda a celda, van en lo lleno del piso y se borran de a poco', () => {
    for (let v = 0; v < CRACK_VARIANTS; v++) {
      const open = paintCrack(v, 0);
      // Entra y sale por la misma fila: dos grietas seguidas (cada `everyPx`, más angostas que la grieta) se continúan.
      expect(DARK.has(colorAt(open, 0, CRACK.seam)) && opaque(open, 0, CRACK.seam)).toBe(true);
      expect(DARK.has(colorAt(open, CRACK.width - 1, CRACK.seam)) && opaque(open, CRACK.width - 1, CRACK.seam)).toBe(true);
      expect(W.crack.everyPx).toBeLessThan(CRACK.width);
      // Lo oscuro, nunca en las filas ralas del borde de selva.png (0 y 1 de la casilla): flotaría sobre el fondo.
      for (let st = 0; st < CRACK_STAGES; st++) {
        const p = paintCrack(v, st);
        for (let y = 0; y < CRACK.seam; y++) for (let x = 0; x < CRACK.width; x++) if (opaque(p, x, y)) expect(DARK.has(colorAt(p, x, y))).toBe(false);
      }
      const n = [0, 1, 2].map((st) => count(paintCrack(v, st)));
      expect(n[0]).toBeGreaterThan(n[1]);
      expect(n[1]).toBeGreaterThan(n[2]);
      expect(n[2]).toBeGreaterThan(0);
    }
  });

  it('el polvo crece y se deshace en grumos', () => {
    const n = Array.from({ length: DUST_FRAMES }, (_, i) => count(paintDust(i)));
    expect(n[1]).toBeGreaterThan(n[0]);
    expect(n[DUST_FRAMES - 1]).toBeLessThan(n[2]);
  });
});
