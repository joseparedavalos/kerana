import { describe, expect, it } from 'vitest';
import { parseAscii } from '../tools/lib/ascii-map.mjs';
import { placeTuft, type PropTuft } from '../src/assets/propLayout';

// Props colocados en los niveles (S51, RECETA-NIVEL §19): son decorado y no pueden estorbar.
const TILE = 16;
// Lo que un prop no puede tapar: plataformas, móviles, pickups, fuegos, rompibles, piedras, rejas, peligros, carteles
// y enemigos (las letras de la línea `enemy`). El inicio (P) no se ve: se puede tapar.
const OBJECT_CHARS = new Set('=-+:SMRBHCGLF%|*^~123456789'.split(''));
const HIDDEN_RECTS = new Set(['Breakable', 'Fireflies', 'Offering']);
// Un prop que cuelga no puede quedar a menos de esto (tiles) de una estalactita que cae: no se distinguirían.
const HANG_CLEAR = 8;
// Junto a la patrulla de un enemigo (el teju'i va y viene 40 unidades: 2,5 tiles), nada más alto que un tile: si no,
// el enemigo pasa delante del prop y se lee peor.
const PATROL_CLEAR = 4;
const PATROL_MAX_HEIGHT = 1;
// Lo que un prop puede salirse del borde de su piso (tiles) antes de quedar en el aire.
const OVERHANG = 0.3;

interface Frame { w: number; h: number; hang: boolean; sink: number; tufts: PropTuft[] }
const frames = new Map<string, Frame>();
const ATLASES = import.meta.glob('../public/assets/props/*.json', { eager: true, import: 'default' }) as Record<string, any>;
for (const [file, atlas] of Object.entries(ATLASES)) {
  const detail = atlas.meta?.detail ?? 1;
  for (const [name, f] of Object.entries<any>(atlas.frames))
    frames.set(`${file.replace(/^.*\/|\.json$/g, '')}/${name}`, { w: f.sourceSize.w / detail, h: f.sourceSize.h / detail, hang: f.hang === true, sink: f.sink ?? 0, tufts: f.tufts ?? [] });
}

/** Caja (en tiles) que ocupa un prop colocado en (x, y), con sus matas. */
function propBox(p: { x: number; y: number; art: string; scale?: number; flip?: boolean }) {
  const f = frames.get(p.art)!;
  const s = p.scale ?? 1;
  const cx = (p.x * TILE + TILE / 2) / TILE;
  let left = cx - (f.w * s) / 2 / TILE;
  let right = cx + (f.w * s) / 2 / TILE;
  for (const tuft of f.tufts) {
    const t = frames.get(tuft.prop);
    if (!t) continue;
    const at = placeTuft(tuft, f.w, s, p.flip === true);
    left = Math.min(left, cx + (at.dx - (t.w * at.scale) / 2) / TILE);
    right = Math.max(right, cx + (at.dx + (t.w * at.scale) / 2) / TILE);
  }
  const top = f.hang ? p.y : p.y + 1 - ((f.h - f.sink) * s) / TILE;
  const bottom = f.hang ? p.y + (f.h * s) / TILE : p.y + 1;
  return { left, right, top, bottom, hang: f.hang };
}

const SOURCES = import.meta.glob('../tools/levels/l[0-9].txt', { eager: true, query: '?raw', import: 'default' }) as Record<string, string>;
const levels: { id: string; map: any }[] = Object.entries(SOURCES).map(([file, text]) => ({ id: file.replace(/^.*\/|\.txt$/g, ''), map: parseAscii(text) }));

describe('props colocados en los niveles (S51)', () => {
  it('l1 tiene props', () => {
    expect(levels.find((l) => l.id === 'l1')!.map.props.length).toBeGreaterThan(20);
  });

  for (const { id, map } of levels) {
    if (map.props.length === 0) continue;
    const g: string[] = map.grid;
    const enemyChars = new Set(Object.keys(map.enemies));
    const at = (x: number, y: number) => g[y]?.[x] ?? '#';
    const inCave = (x: number, y: number) =>
      map.rects.some((r: any) => r.cls === 'Cave' && x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h);

    it(`${id}: cada prop es de una carpeta de su nivel y existe`, () => {
      const bad = map.props.filter((p: any) => !frames.has(p.art) || !p.art.startsWith(`${id}_`)).map((p: any) => `${p.art} (${p.x}, ${p.y})`);
      expect(bad).toEqual([]);
    });

    it(`${id}: bajo tierra solo van los de la cueva, y afuera ninguno de la cueva`, () => {
      if (![...frames.keys()].some((k) => k.startsWith(`${id}_cueva/`))) return;
      const bad = map.props
        .filter((p: any) => inCave(p.x, p.y) !== p.art.startsWith(`${id}_cueva/`))
        .map((p: any) => `${p.art} (${p.x}, ${p.y})`);
      expect(bad).toEqual([]);
    });

    it(`${id}: apoyados en el piso (o colgados del techo), sin quedar en el aire ni metidos en la pared`, () => {
      const bad: string[] = [];
      for (const p of map.props as any[]) {
        const b = propBox(p);
        const support = b.hang ? p.y - 1 : p.y + 1;
        if (at(p.x, p.y) === '#' || at(p.x, support) !== '#') bad.push(`${p.art} (${p.x}, ${p.y}): sin piso o techo`);
        for (let x = Math.floor(b.left); x < Math.ceil(b.right); x++) {
          const cover = Math.min(b.right, x + 1) - Math.max(b.left, x);
          if (cover <= OVERHANG) continue;
          if (at(x, support) !== '#') bad.push(`${p.art} (${p.x}, ${p.y}): columna ${x} en el aire`);
          for (let y = Math.floor(b.top); y < Math.ceil(b.bottom); y++)
            if (at(x, y) === '#' && Math.min(b.bottom, y + 1) - Math.max(b.top, y) > OVERHANG) bad.push(`${p.art} (${p.x}, ${p.y}): metido en la pared en (${x}, ${y})`);
        }
      }
      expect(bad).toEqual([]);
    });

    it(`${id}: ningún prop tapa una plataforma, un pickup, un fuego, un rompible, una piedra, una reja, un peligro o un enemigo`, () => {
      const bad: string[] = [];
      for (const p of map.props as any[]) {
        const b = propBox(p);
        for (let y = Math.floor(b.top); y < Math.ceil(b.bottom); y++)
          for (let x = Math.floor(b.left); x < Math.ceil(b.right); x++) {
            const c = at(x, y);
            if (OBJECT_CHARS.has(c) || enemyChars.has(c)) bad.push(`${p.art} (${p.x}, ${p.y}) tapa "${c}" en (${x}, ${y})`);
          }
        for (const r of map.rects as any[])
          if (HIDDEN_RECTS.has(r.cls) && b.left < r.x + r.w && b.right > r.x && b.top < r.y + r.h && b.bottom > r.y)
            bad.push(`${p.art} (${p.x}, ${p.y}) tapa ${r.cls} en (${r.x}, ${r.y})`);
        if (!b.hang && b.bottom - b.top > PATROL_MAX_HEIGHT)
          // Hacia cada lado, hasta una pared (un enemigo del otro lado no llega).
          for (const [from, to, dir] of [[p.x, Math.floor(b.left - PATROL_CLEAR), -1], [p.x, Math.ceil(b.right + PATROL_CLEAR), 1]])
            for (let x = from; x !== to && at(x, p.y) !== '#'; x += dir)
              if (enemyChars.has(at(x, p.y))) bad.push(`${p.art} (${p.x}, ${p.y}) es alto y está en la patrulla del enemigo de (${x}, ${p.y})`);
        if (b.hang)
          for (const h of map.points as any[])
            if (h.cls === 'FallingHazard' && Math.abs(h.x - p.x) < HANG_CLEAR) bad.push(`${p.art} (${p.x}, ${p.y}) cuelga junto a la estalactita de (${h.x}, ${h.y})`);
        if (b.hang && map.rects.some((r: any) => r.cls === 'BossArena' && p.x >= r.x && p.x < r.x + r.w)) bad.push(`${p.art} (${p.x}, ${p.y}) cuelga en la arena`);
      }
      expect(bad).toEqual([]);
    });
  }
});
