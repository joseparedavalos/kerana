import { describe, expect, it } from 'vitest';
import { parseAscii } from '../tools/lib/ascii-map.mjs';
import { placeTuft, type PropTuft } from '../src/assets/propLayout';
import { GAMEPLAY } from '../src/config/gameplay';

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

// S52: lo que un prop que solo va sobre agua (`waterOnly`: camalote, irupé) tiene que quedar lejos de un camalote que
// se hunde (`S`) o de una balsa (tiles): no se distinguirían de algo que se pisa.
const WATER_CLEAR = 3;

// S54: un farol (point Lantern) ocupa ≈ 1,5 tiles de ancho y 2,25 de alto sobre su pie: ningún prop lo tapa. Su luz
// sale a la altura de la cabeza (`postHeight` + 4 px sobre el pie, como en Lantern.ts) y alcanza `radius`; la de un
// fuego encendido, 12 px sobre el pie (LevelScene).
const LANTERN_HALF_W = 0.75;
const LANTERN_H = 2.25;
const LANTERN_LIGHT_UP = (GAMEPLAY.lantern.postHeight + 4) / TILE;
const FIRE_LIGHT_UP = 12 / TILE;
const LIGHT_RADIUS = GAMEPLAY.lantern.radius / TILE;
// S54: l7 tiene dos sitios que no se mezclan (cabecera de tools/levels/l7.txt): la calle y la catedral (x < 292, solo
// l7_calle) y el camposanto con la antesala y la arena (x ≥ 292, solo l7_camposanto). La torre de la ronda del
// farolero (x 172-189) no lleva props: el jugador mira cuándo llega cada ascensor.
const L7_CAMPOSANTO_X = 292;
const L7_RONDA = [172, 190];

interface Frame { w: number; h: number; hang: boolean; sink: number; waterOnly: boolean; tufts: PropTuft[]; wall: boolean; span?: string[] }
const frames = new Map<string, Frame>();
const ATLASES = import.meta.glob('../public/assets/props/*.json', { eager: true, import: 'default' }) as Record<string, any>;
for (const [file, atlas] of Object.entries(ATLASES)) {
  const detail = atlas.meta?.detail ?? 1;
  for (const [name, f] of Object.entries<any>(atlas.frames))
    frames.set(`${file.replace(/^.*\/|\.json$/g, '')}/${name}`, { w: f.sourceSize.w / detail, h: f.sourceSize.h / detail, hang: f.hang === true, sink: f.sink ?? 0, waterOnly: f.waterOnly === true, tufts: f.tufts ?? [], wall: f.wall === true, span: f.span });
}

/** Caja (en tiles) que ocupa un prop colocado en (x, y), con sus matas. S54: con `span` (prop X1-X2,Y), el tramo da la escala. */
function propBox(p: { x: number; y: number; art: string; scale?: number; flip?: boolean; span?: number }) {
  const f = frames.get(p.art)!;
  const s = p.span !== undefined ? (p.span * TILE) / f.w : (p.scale ?? 1);
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
  return { left, right, top, bottom, hang: f.hang, waterOnly: f.waterOnly, wall: f.wall, span: p.span !== undefined ? f.span : undefined };
}

/** S54: lo que más se acerca la caja a un punto (tiles). */
const boxDistance = (b: { left: number; right: number; top: number; bottom: number }, x: number, y: number) =>
  Math.hypot(Math.max(b.left - x, 0, x - b.right), Math.max(b.top - y, 0, y - b.bottom));


const SOURCES = import.meta.glob('../tools/levels/l[0-9].txt', { eager: true, query: '?raw', import: 'default' }) as Record<string, string>;
const levels: { id: string; map: any }[] = Object.entries(SOURCES).map(([file, text]) => ({ id: file.replace(/^.*\/|\.txt$/g, ''), map: parseAscii(text) }));

describe('props colocados en los niveles (S51)', () => {
  it('l1 a l7 tienen props', () => {
    // l2 y l3 llevan menos que l1 (S52): casi todo su recorrido es agua, balsas, viento y copas, que van limpios. l4 a l6
    // (S53), menos todavía: casas y rejas, el dosel y la persecución. l7 (S54): la ronda y los tejados de la catedral van
    // limpios, y en el camposanto solo hay lugar junto a una luz.
    for (const [id, min] of [['l1', 20], ['l2', 10], ['l3', 10], ['l4', 8], ['l5', 8], ['l6', 8], ['l7', 10]] as const) expect(levels.find((l) => l.id === id)!.map.props.length).toBeGreaterThan(min);
  });

  for (const { id, map } of levels) {
    if (map.props.length === 0) continue;
    const g: string[] = map.grid;
    const enemyChars = new Set(Object.keys(map.enemies));
    const at = (x: number, y: number) => g[y]?.[x] ?? '#';
    // S52: el fondo de cueva se dibuja por columnas (LevelBackdrop): todo el ancho de un `rect Cave`, de arriba abajo,
    // sin mirar su `y`. Un prop de afuera bajo esas columnas queda en penumbra con su luz de sol pintada.
    const caveCols = (left: number, right: number) =>
      map.rects.filter((r: any) => r.cls === 'Cave').reduce((n: number, r: any) => n + Math.max(0, Math.min(right, r.x + r.w) - Math.max(left, r.x)), 0);
    const isWater = (x: number, y: number) =>
      at(x, y) === '~' || map.rects.some((r: any) => r.cls === 'ShallowWater' && x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h);

    it(`${id}: cada prop es de una carpeta de su nivel y existe`, () => {
      const bad = map.props.filter((p: any) => !frames.has(p.art) || !p.art.startsWith(`${id}_`)).map((p: any) => `${p.art} (${p.x}, ${p.y})`);
      expect(bad).toEqual([]);
    });

    it(`${id}: bajo tierra solo van los de la cueva, y afuera ninguno de la cueva`, () => {
      const bad = map.props
        .filter((p: any) => {
          const b = propBox(p);
          const under = caveCols(b.left, b.right);
          // Los de la cueva, enteros bajo el fondo de cueva; los demás, nada bajo él (S52: el tacurú de x 187 en l1).
          return p.art.startsWith(`${id}_cueva/`) ? under < b.right - b.left - 1e-6 : under > 0;
        })
        .map((p: any) => `${p.art} (${p.x}, ${p.y})`);
      expect(bad).toEqual([]);
    });

    it(`${id}: los que van sobre agua, solo sobre agua y lejos de los camalotes que se hunden y de las balsas`, () => {
      const bad: string[] = [];
      for (const p of map.props as any[]) {
        const b = propBox(p);
        if (!b.waterOnly) continue;
        for (let x = Math.floor(b.left); x < Math.ceil(b.right); x++) {
          if (Math.min(b.right, x + 1) - Math.max(b.left, x) <= OVERHANG) continue;
          if (!isWater(x, p.y + 1)) bad.push(`${p.art} (${p.x}, ${p.y}): columna ${x} sin agua debajo`);
        }
        for (let x = Math.floor(b.left) - WATER_CLEAR; x < Math.ceil(b.right) + WATER_CLEAR; x++)
          for (const y of [p.y, p.y + 1])
            if ('S-+:'.includes(at(x, y))) bad.push(`${p.art} (${p.x}, ${p.y}) junto a "${at(x, y)}" en (${x}, ${y})`);
        for (const r of map.rects as any[])
          if (r.cls === 'Sinking' && b.left - WATER_CLEAR < r.x + r.w && b.right + WATER_CLEAR > r.x && p.y + 1 >= r.y && p.y < r.y + r.h)
            bad.push(`${p.art} (${p.x}, ${p.y}) junto al camalote de (${r.x}, ${r.y})`);
      }
      expect(bad).toEqual([]);
    });

    it(`${id}: apoyados en el piso (o colgados del techo), sin quedar en el aire ni metidos en la pared`, () => {
      const bad: string[] = [];
      for (const p of map.props as any[]) {
        const b = propBox(p);
        if (b.waterOnly) continue; // sobre agua: la prueba de abajo
        const covers = (x: number, y: number) => Math.min(b.right, x + 1) - Math.max(b.left, x) > OVERHANG && Math.min(b.bottom, y + 1) - Math.max(b.top, y) > OVERHANG;
        if (b.wall) {
          // S54: de fachada: entero sobre los tiles de un muro (no se apoya en nada).
          for (let y = Math.floor(b.top); y < Math.ceil(b.bottom); y++)
            for (let x = Math.floor(b.left); x < Math.ceil(b.right); x++)
              if (covers(x, y) && at(x, y) !== '#') bad.push(`${p.art} (${p.x}, ${p.y}): fachada fuera del muro en (${x}, ${y})`);
          continue;
        }
        if (b.span) {
          // S54: entre dos puntos: por dentro, aire; cada extremo, contra un muro (en todo su alto) o con el suelo debajo.
          const ends = p.flip ? [...b.span].reverse() : b.span;
          const rows = Array.from({ length: Math.ceil(b.bottom) - Math.floor(b.top) }, (_, i) => Math.floor(b.top) + i);
          for (const y of rows)
            for (let x = Math.floor(b.left); x < Math.ceil(b.right); x++) if (covers(x, y) && at(x, y) === '#') bad.push(`${p.art} (${p.x}, ${p.y}): metido en la pared en (${x}, ${y})`);
          for (const [end, inside, outside] of [[ends[0], Math.round(b.left), Math.round(b.left) - 1], [ends[1], Math.round(b.right) - 1, Math.round(b.right)]] as const) {
            if (end === 'wall' && rows.some((y) => at(outside, y) !== '#')) bad.push(`${p.art} (${p.x}, ${p.y}): sin muro en la columna ${outside}`);
            if (end === 'floor' && at(inside, Math.floor(p.y) + 1) !== '#') bad.push(`${p.art} (${p.x}, ${p.y}): sin suelo bajo la columna ${inside}`);
          }
          continue;
        }
        const support = b.hang ? p.y - 1 : p.y + 1;
        if (at(Math.floor(p.x), p.y) === '#' || at(Math.floor(p.x), support) !== '#') bad.push(`${p.art} (${p.x}, ${p.y}): sin piso o techo`);
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
        // S54: ni un farol (en l7 son la mecánica del nivel).
        for (const l of map.points as any[])
          if (l.cls === 'Lantern' && b.left < l.x + 0.5 + LANTERN_HALF_W && b.right > l.x + 0.5 - LANTERN_HALF_W && b.top < l.y + 1 && b.bottom > l.y + 1 - LANTERN_H)
            bad.push(`${p.art} (${p.x}, ${p.y}) tapa el farol de (${l.x}, ${l.y})`);
        if (!b.hang && b.bottom - b.top > PATROL_MAX_HEIGHT)
          // Hacia cada lado, hasta una pared (un enemigo del otro lado no llega).
          for (const [from, to, dir] of [[Math.floor(p.x), Math.floor(b.left - PATROL_CLEAR), -1], [Math.floor(p.x), Math.ceil(b.right + PATROL_CLEAR), 1]])
            for (let x = from; x !== to && at(x, p.y) !== '#'; x += dir)
              if (enemyChars.has(at(x, p.y))) bad.push(`${p.art} (${p.x}, ${p.y}) es alto y está en la patrulla del enemigo de (${x}, ${p.y})`);
        if (b.hang)
          for (const h of map.points as any[])
            if (h.cls === 'FallingHazard' && Math.abs(h.x - p.x) < HANG_CLEAR) bad.push(`${p.art} (${p.x}, ${p.y}) cuelga junto a la estalactita de (${h.x}, ${h.y})`);
        if (b.hang && map.rects.some((r: any) => r.cls === 'BossArena' && p.x >= r.x && p.x < r.x + r.w)) bad.push(`${p.art} (${p.x}, ${p.y}) cuelga en la arena`);
      }
      expect(bad).toEqual([]);
    });

    if (id === 'l7')
      it('l7: la calle y el camposanto no se mezclan, la ronda va limpia y cada prop está cerca de un farol o un fuego', () => {
        // S54: es de noche y los props traen luz de farol pintada: lejos de toda luz se verían encendidos en lo oscuro.
        // S60: salvo los de fachada en la calle a la luz de la luna (fuera de las DarkZone): son parte de la casa, y el
        // tejado va arriba del todo, lejos de los faroles de la vereda. La luna los oscurece como al muro.
        const dark = (map.rects as any[]).filter((r) => r.cls === 'DarkZone');
        const moonlit = (b: { left: number; right: number; top: number; bottom: number }) =>
          b.right <= L7_CAMPOSANTO_X && !dark.some((r) => b.left < r.x + r.w && b.right > r.x && b.top < r.y + r.h && b.bottom > r.y);
        const lights: [number, number][] = [];
        for (const l of map.points as any[]) if (l.cls === 'Lantern') lights.push([l.x + 0.5, l.y + 1 - LANTERN_LIGHT_UP]);
        g.forEach((row, y) => [...row].forEach((c, x) => c === 'C' && lights.push([x + 0.5, y + 1 - FIRE_LIGHT_UP])));
        const bad: string[] = [];
        for (const p of map.props as any[]) {
          const b = propBox(p);
          const folder = b.left >= L7_CAMPOSANTO_X ? 'l7_camposanto/' : b.right <= L7_CAMPOSANTO_X ? 'l7_calle/' : '(en el borde)';
          if (!p.art.startsWith(folder)) bad.push(`${p.art} (${p.x}, ${p.y}): de este lado van los de ${folder}`);
          if (b.left < L7_RONDA[1] && b.right > L7_RONDA[0]) bad.push(`${p.art} (${p.x}, ${p.y}): en la torre de la ronda`);
          if (!(b.wall && moonlit(b)) && !lights.some(([lx, ly]) => boxDistance(b, lx, ly) <= LIGHT_RADIUS)) bad.push(`${p.art} (${p.x}, ${p.y}): lejos de toda luz`);
        }
        expect(bad).toEqual([]);
      });
  }
});
