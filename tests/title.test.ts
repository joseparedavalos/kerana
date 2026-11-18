import { describe, expect, it } from 'vitest';
import { GAMEPLAY } from '../src/config/gameplay';
import { en } from '../src/i18n/en';
import { es } from '../src/i18n/es';
import { pt } from '../src/i18n/pt';
import { BIG_CAP, glyphFor, missingGlyphs, setText } from '../src/scenes/title/logoFont';
import { INTRO_DONE, introPose, nextGap, SHINE_END_MS, shineFrame, shootingPose, twinkle } from '../src/scenes/title/titleLogic';
import { paintFogStrip, paintMenuStar, paintShineFrames, paintStar, paintTitleBlock, titleArt } from '../src/scenes/title/titlePaint';
import { alphaAt, colorAt } from '../src/systems/pixelArt';

// S105: la portada. Solo el dibujo y sus tiempos (el menú y lo que hace cada opción no cambiaron).
const LOOK = GAMEPLAY.titleLook;
const LANGS = { es, en, pt };

describe('logo en pixel art', () => {
  it('la fuente tiene todas las letras del título y del subtítulo en cada idioma', () => {
    for (const [lang, dict] of Object.entries(LANGS)) {
      expect(missingGlyphs(dict['game.title'], 'big'), lang).toEqual([]);
      expect(missingGlyphs(dict['game.subtitle'], 'small'), lang).toEqual([]);
    }
  });

  it('las mayúsculas miden lo mismo: tinta en la primera y en la última fila de cada una', () => {
    for (const ch of 'KERAN') {
      const g = glyphFor(ch, 'big')!;
      expect(g.height).toBe(BIG_CAP);
      const row = (y: number): boolean => g.ink.slice(y * g.width, (y + 1) * g.width).some(Boolean);
      expect(row(0), ch).toBe(true);
      expect(row(BIG_CAP - 1), ch).toBe(true);
    }
  });

  it('õ y ñ llevan la virgulilla separada de la letra por una fila', () => {
    for (const ch of ['õ', 'ñ']) {
      const g = glyphFor(ch, 'small')!;
      const base = glyphFor(ch === 'õ' ? 'o' : 'n', 'small')!;
      const rows = (gl: typeof g): number[] => [...Array(gl.height).keys()].filter((y) => gl.ink.slice(y * gl.width, (y + 1) * gl.width).some(Boolean));
      const extra = rows(g).filter((y) => !rows(base).includes(y));
      expect(extra.length, ch).toBe(2);
      // La fila de abajo de la virgulilla y la de arriba de la letra no se tocan.
      expect(Math.min(...rows(base)) - Math.max(...extra), ch).toBe(2);
    }
  });

  it('cinco tonos de oro a ámbar, brillo en cada borde de arriba y contorno ciruela alrededor de toda la tinta', () => {
    const block = paintTitleBlock('KERANA', 'Pokõi ñemoñare');
    const { px, ink } = block;
    const L = LOOK.logo;
    const used = new Set<number>();
    for (let y = 0; y < px.height; y++)
      for (let x = 0; x < px.width; x++) {
        const i = y * px.width + x;
        if (!ink[i]) continue;
        const c = colorAt(px, x, y);
        const above = y > 0 && ink[i - px.width];
        if (!above) expect(c).toBe(L.highlight);
        used.add(c);
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            const j = (y + dy) * px.width + x + dx;
            if (!ink[j]) {
              expect(alphaAt(px, x + dx, y + dy)).toBe(255);
              expect(colorAt(px, x + dx, y + dy)).toBe(L.outline);
            }
          }
      }
    for (const tone of L.gradient) expect(used.has(tone)).toBe(true);
  });

  it('el logo cabe en la vista, centrado, y debajo de Eichu', () => {
    const block = paintTitleBlock(es['game.title'], es['game.subtitle']);
    const left = LOOK.logo.centerX - block.logoWidth / 2;
    expect(left).toBeGreaterThan(40);
    expect(left + block.logoWidth).toBeLessThan(600);
    const lowestStar = Math.max(...LOOK.eichu.stars.map(([, y]) => y));
    expect(LOOK.logo.top).toBeGreaterThan(lowestStar + 12);
    // Y el ñandutí no se mete en el menú.
    expect(LOOK.logo.top - block.logoY + block.bottom + LOOK.nanduti.gapBelow + LOOK.nanduti.radius + 2).toBeLessThan(LOOK.menu.rows[0] - 12);
  });

  it('el destello cruza solo las letras y recorre el logo de punta a punta', () => {
    const block = paintTitleBlock('KERANA', 'Pokõi ñemoñare');
    const frames = paintShineFrames(block);
    expect(frames.length).toBeGreaterThan(20);
    let minX = Infinity;
    let maxX = -Infinity;
    for (const f of frames)
      for (let y = 0; y < f.px.height; y++)
        for (let x = 0; x < f.px.width; x++) {
          if (!alphaAt(f.px, x, y)) continue;
          expect(block.ink[(f.y + y) * block.px.width + f.x + x]).toBe(true);
          minX = Math.min(minX, f.x + x);
          maxX = Math.max(maxX, f.x + x);
        }
    expect(minX).toBeLessThanOrEqual(block.logoX + 2);
    expect(maxX).toBeGreaterThanOrEqual(block.logoX + block.logoWidth - 3);
  });

  it('la textura se arma igual dos veces (se pinta una sola vez y es estable)', () => {
    const a = titleArt('KERANA', 'Pokõi ñemoñare').frames;
    const b = titleArt('KERANA', 'Pokõi ñemoñare').frames;
    expect(a.map((f) => f.name)).toEqual(b.map((f) => f.name));
    a.forEach((f, i) => expect([...f.px.data]).toEqual([...b[i].px.data]));
  });
});

describe('estrellas', () => {
  it('las estrellitas son simétricas en las cuatro puntas', () => {
    for (const p of [paintStar(6), paintMenuStar(4.5), paintMenuStar(3.5)]) {
      const n = p.width - 1;
      for (let y = 0; y < p.height; y++)
        for (let x = 0; x < p.width; x++) {
          expect(alphaAt(p, n - x, y)).toBe(alphaAt(p, x, y));
          expect(alphaAt(p, y, x)).toBe(alphaAt(p, x, y));
        }
    }
  });

  it('siete estrellas de Eichu, ninguna sobre la octava tapada por el parche de S13', () => {
    expect(LOOK.eichu.stars.length).toBe(7);
    // tools/backgrounds.mjs tapa (895, 425) del original de 1792 × 1008: en el mundo, (319,6; 151,8).
    const patched = [(895 * 1280) / 1792 / 2, (425 * 720) / 1008 / 2];
    for (const [x, y] of LOOK.eichu.stars) expect(Math.hypot(x - patched[0], y - patched[1])).toBeGreaterThan(20);
  });

  it('el titilar crece y decrece; sin destellos, no pasa del cuadro tranquilo', () => {
    const last = LOOK.eichu.arms.length - 1;
    for (let i = 0; i < 7; i++) {
      const frames = new Set<number>();
      for (let t = 0; t < 8000; t += 50) {
        const tw = twinkle(i, t, 1, false);
        frames.add(tw.frame);
        expect(twinkle(i, t, 1, true).frame).toBeLessThanOrEqual(LOOK.eichu.calmMaxFrame);
      }
      expect(frames.has(0)).toBe(true);
      expect(frames.has(last)).toBe(true);
    }
    // Al encenderse en la entrada, llega al cuadro más grande; apagada, no se ve.
    expect(twinkle(0, 0, 0.3, false).frame).toBe(last);
    expect(twinkle(0, 0, -1, false).alpha).toBe(0);
  });
});

describe('entrada', () => {
  it('empieza en negro, las estrellas se encienden de a una y a los 1,5 s todo está listo', () => {
    const start = introPose(0);
    expect(start.black).toBe(1);
    expect(start.stars.every((s) => s < 0)).toBe(true);
    expect(start.menu).toBe(0);
    const lit = (t: number): number => introPose(t).stars.filter((s) => s >= 0).length;
    let prev = 0;
    for (let t = 0; t <= LOOK.intro.totalMs; t += 10) {
      const n = lit(t);
      expect(n - prev).toBeLessThanOrEqual(1);
      prev = n;
    }
    expect(LOOK.intro.totalMs).toBeLessThanOrEqual(1600);
    const end = introPose(LOOK.intro.totalMs);
    expect(end).toEqual(INTRO_DONE);
    expect(end.black).toBe(0);
    expect(end.logo).toBe(1);
    expect(end.menu).toBe(1);
    expect(end.stars.every((s) => s === 1)).toBe(true);
    // Las estrellas se encienden antes de que se vea el fondo y el logo aparece después.
    expect(lit(LOOK.intro.blackFade[0])).toBe(7);
    expect(introPose(LOOK.intro.starStartMs + 6 * LOOK.intro.starStepMs).logo).toBe(0);
  });
});

describe('destellos y estrella fugaz', () => {
  it('el destello vuelve cada 5 a 7 s y la estrella fugaz cada 8 a 15 s', () => {
    for (let n = 0; n < 50; n++) {
      const g = nextGap(LOOK.shine.everyMs, n, 61);
      expect(g).toBeGreaterThanOrEqual(5000);
      expect(g).toBeLessThanOrEqual(7000);
      expect(g).toBeGreaterThan(SHINE_END_MS);
      const s = nextGap(LOOK.shootingStar.everyMs, n, 67);
      expect(s).toBeGreaterThanOrEqual(8000);
      expect(s).toBeLessThanOrEqual(15000);
    }
    expect(shineFrame(-1, 30)).toBe(-1);
    expect(shineFrame(0, 30)).toBe(0);
    expect(shineFrame(LOOK.shine.durationMs - 1, 30)).toBe(29);
    expect(shineFrame(LOOK.shine.durationMs, 30)).toBe(-1);
  });

  it('la estrella fugaz cruza el cielo lejos del logo y de Eichu', () => {
    for (let n = 0; n < 60; n++)
      for (let t = 0; t < LOOK.shootingStar.durationMs; t += 35) {
        const p = shootingPose(n, t);
        expect(p).not.toBeNull();
        expect(p!.x < 220 || p!.x > 420, `n ${n}`).toBe(true);
        expect(p!.y).toBeLessThan(140);
        expect(p!.x).toBeGreaterThan(-30);
        expect(p!.x).toBeLessThan(670);
      }
    expect(shootingPose(0, LOOK.shootingStar.durationMs)).toBeNull();
  });
});

describe('bruma', () => {
  it('cada capa se repite sin costura y no deja columnas vacías', () => {
    LOOK.fog.layers.forEach((_, layer) => {
      const p = paintFogStrip(layer);
      const topRow = (x: number): number => {
        for (let y = 0; y < p.height; y++) if (alphaAt(p, x, y)) return y;
        return p.height;
      };
      for (let x = 0; x < p.width; x++) expect(topRow(x), `capa ${layer}, x ${x}`).toBeLessThan(p.height);
      expect(Math.abs(topRow(0) - topRow(p.width - 1))).toBeLessThanOrEqual(3);
    });
  });
});

describe('Kerana y Mainumby', () => {
  it('a escala entera', () => {
    expect(Number.isInteger(LOOK.kerana.artPx)).toBe(true);
    expect(LOOK.kerana.artPx).toBeGreaterThanOrEqual(1);
  });

  it('el subtítulo entra en una línea más angosta que el logo', () => {
    expect(setText(es['game.subtitle'], 'small').width).toBeLessThan(setText(es['game.title'], 'big').width);
  });
});
