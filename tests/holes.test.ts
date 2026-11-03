import { describe, expect, it } from 'vitest';
import { GAMEPLAY } from '../src/config/gameplay';
import { LEVELS } from '../src/data/levels';
import { caveColumns, earthCells, isFloorTile, terrainAlpha, terrainDepths, terrainFloor } from '../src/systems/terrainLogic';

// S75: «nada de agujeros» (CLAUDE.md, RECETA-NIVEL). Con `terrainShell`, la capa Ground solo se dibuja entera hasta
// unos tiles del aire; más adentro se vería el fondo del nivel dentro de la masa sólida (el marco hueco con el cielo
// encerrado). Toda celda sólida tiene que estar dibujada entera (cerca del aire o en el piso de S29), o tapada por el
// fondo de tierra (`earthBackdrop`) o por el fondo de cueva (zonas `Cave`). Los dos arreglos válidos: rellenar la masa
// (`earthBackdrop: true`) o adelgazarla hasta una plataforma con aire alrededor (en el ASCII del nivel).
const MAPS = import.meta.glob('../public/assets/maps/*.json', { eager: true, import: 'default' }) as Record<string, any>;

function mapOf(key: string): any {
  const file = Object.keys(MAPS).find((f) => f.endsWith(`/${key.replace(/^map_/, '')}.json`));
  return file ? MAPS[file] : undefined;
}

/** Celdas sólidas de Ground que se ven huecas: ni dibujadas enteras ni tapadas por un fondo. */
export function holes(map: any, shell: number, opts: { solidFloor: boolean; earth: boolean }): { x: number; y: number }[] {
  const { width, height, tilewidth } = map;
  const ground: number[] = map.layers.find((l: any) => l.name === 'Ground').data;
  const solid = (x: number, y: number) => ground[y * width + x] !== 0;
  const depth = terrainDepths(solid, width, height, shell);
  const floor = terrainFloor(solid, width, height);
  const objects = map.layers.filter((l: any) => l.type === 'objectgroup').flatMap((l: any) => l.objects);
  const caves = caveColumns(
    objects.filter((o: any) => (o.type || o.class) === 'Cave').map((o: any) => ({ x: o.x, width: o.width ?? 16 })),
    width,
    tilewidth,
  );
  const drawn = (x: number, y: number) =>
    (opts.solidFloor && isFloorTile(floor, x, y)) || terrainAlpha(depth[y * width + x], shell, GAMEPLAY.backdrop.terrainFadeAlpha) >= 1;
  // Lo mismo que hace LevelScene: la tierra va donde la repisa no dibuja, salvo el piso y las cuevas.
  const earth = new Set(
    opts.earth
      ? earthCells(depth, width, shell, (i) => caves[i % width] === 1 || (opts.solidFloor && isFloorTile(floor, i % width, Math.floor(i / width)))).map(
          (c) => c.y * width + c.x,
        )
      : [],
  );
  const out: { x: number; y: number }[] = [];
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      if (solid(x, y) && !drawn(x, y) && !earth.has(y * width + x) && caves[x] !== 1) out.push({ x, y });
  return out;
}

/** Agrupa las celdas en rectángulos por columnas seguidas, para un mensaje legible. */
function describe_(cells: { x: number; y: number }[]): string {
  const cols = new Map<number, number[]>();
  for (const c of cells) cols.set(c.x, [...(cols.get(c.x) ?? []), c.y]);
  const runs: string[] = [];
  let run: { x0: number; x1: number; y0: number; y1: number } | null = null;
  for (const x of [...cols.keys()].sort((a, b) => a - b)) {
    const ys = cols.get(x)!;
    const y0 = Math.min(...ys);
    const y1 = Math.max(...ys);
    if (run && x === run.x1 + 1) Object.assign(run, { x1: x, y0: Math.min(run.y0, y0), y1: Math.max(run.y1, y1) });
    else {
      if (run) runs.push(`x ${run.x0}-${run.x1}, filas ${run.y0}-${run.y1}`);
      run = { x0: x, x1: x, y0, y1 };
    }
  }
  if (run) runs.push(`x ${run.x0}-${run.x1}, filas ${run.y0}-${run.y1}`);
  return runs.join('; ');
}

// Excepciones conocidas (S75): niveles que hoy tienen agujeros y quedan pendientes (docs/PENDIENTES.md, punto 26). Cada
// una guarda la huella exacta (cuántas celdas y en qué tramos): si el nivel gana un agujero nuevo, el test falla igual;
// si se arregla, también falla, para que se saque de la lista. No se agregan niveles acá para que el test pase.
const KNOWN_HOLES: Record<string, { cells: number; where: string }> = {
  // Pendiente (S75, no se tocó): la ladera entre las dos cuevas; el cerro de piedra muestra el bosque del fondo adentro.
  l1: { cells: 2416, where: 'x 45-73, filas 11-33; x 81-115, filas 0-33; x 132-185, filas 10-33' },
  // Pendiente (S75, no se tocó): falta el relleno (earthBackdrop) o adelgazar.
  l2: { cells: 218, where: 'x 144-150, filas 28-32; x 157-158, filas 20-26; x 241-250, filas 14-32' },
  // Pendiente (S75, no se tocó): ídem; l5 ya carga la lluvia y el dosel, medir el relleno en un celular.
  l5: { cells: 585, where: 'x 18-23, filas 76-86; x 98-128, filas 36-91; x 261-263, filas 26-91' },
  // Pendiente (S75, no se tocó): ídem; es el que más tiene.
  l6: {
    cells: 3463,
    where: 'x 46-57, filas 25-25; x 72-73, filas 47-55; x 87-89, filas 47-48; x 98-101, filas 37-38; x 115-125, filas 19-45; x 144-163, filas 17-45; x 189-204, filas 11-45; x 232-238, filas 16-45; x 260-284, filas 18-45; x 293-305, filas 24-45; x 332-361, filas 21-45; x 371-398, filas 24-45; x 429-429, filas 42-45; x 448-449, filas 44-45',
  },
};

describe('nada de agujeros: ninguna masa sólida deja ver el fondo por dentro (S75)', () => {
  const levels = Object.values(LEVELS).filter((l) => l && mapOf(l.mapKey));
  it('hay mapas para revisar', () => expect(levels.length).toBeGreaterThanOrEqual(7));
  for (const l of levels) {
    it(`${l!.id}: toda celda sólida está dibujada o tapada por el fondo del nivel`, () => {
      if (!l!.terrainShell) return; // sin repisa, Ground se dibuja entero
      const cells = holes(mapOf(l!.mapKey), l!.terrainShell, { solidFloor: l!.solidFloor !== false, earth: l!.earthBackdrop === true });
      const known = KNOWN_HOLES[l!.id];
      if (known) {
        expect(
          { cells: cells.length, where: describe_(cells) },
          `${l!.id} está en KNOWN_HOLES (pendiente) y sus agujeros cambiaron: si se arreglaron, sacalo de la lista; si hay uno nuevo, arreglalo`,
        ).toEqual(known);
        return;
      }
      expect(
        cells.length,
        `${l!.id}: ${cells.length} celdas sólidas sin dibujar, se ve el fondo adentro (${describe_(cells)}). Rellená la masa ` +
          '(earthBackdrop: true en levels.ts) o adelgazala hasta una plataforma con aire alrededor (RECETA-NIVEL, al principio).',
      ).toBe(0);
    });
  }

  it('el test detecta un agujero: el l4 sin relleno marca celdas y nombra el nivel y las coordenadas', () => {
    const l4 = LEVELS.l4!;
    const cells = holes(mapOf(l4.mapKey), l4.terrainShell!, { solidFloor: true, earth: false });
    expect(cells.length).toBeGreaterThan(0);
    expect(describe_(cells)).toMatch(/^x \d+-\d+, filas \d+-\d+/);
  });

  it('el corte del l4 (S75): casa Z, la plaza y la base del campanario no tienen celdas huecas ni con el relleno apagado', () => {
    const l4 = LEVELS.l4!;
    const cells = holes(mapOf(l4.mapKey), l4.terrainShell!, { solidFloor: true, earth: false });
    expect(cells.filter((c) => c.x >= 254 && c.x <= 319)).toEqual([]);
  });
});
