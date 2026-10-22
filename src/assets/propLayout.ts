// Props por bioma (S46): lógica pura, sin Phaser (se prueba en tests/propLayout.test.ts).

/** Prop por bioma (S46): "carpeta/nombre" → atlas props_<carpeta>, frame <nombre>. */
export function parsePropId(id: string): { folder: string; name: string } | null {
  const m = /^([a-z0-9_]+)\/([a-z0-9_]+)$/.exec(id);
  return m ? { folder: m[1]!, name: m[2]! } : null;
}

/** Un prop de la vitrina: tamaño en unidades (ya escalado) y si cuelga. */
export interface ShowcaseItem {
  id: string;
  width: number;
  height: number;
  hang: boolean;
  /** S47: solo va sobre agua (la vitrina le dibuja una lámina de agua). */
  waterOnly?: boolean;
}

/**
 * Vitrina de props (S46), lógica pura: pone los props de izquierda a derecha, `gap` unidades entre uno y otro y
 * `groupGap` entre carpetas. Devuelve el centro en X de cada prop, el comienzo de cada carpeta y el borde derecho.
 */
export function layoutShowcase(
  groups: { folder: string; items: ShowcaseItem[] }[],
  left: number,
  gap: number,
  groupGap: number,
): { items: (ShowcaseItem & { x: number; group: number })[]; groups: { folder: string; x: number }[]; right: number } {
  const items: (ShowcaseItem & { x: number; group: number })[] = [];
  const starts: { folder: string; x: number }[] = [];
  let x = left;
  groups.forEach(({ folder, items: list }, group) => {
    if (list.length === 0) return;
    if (starts.length > 0) x += groupGap - gap;
    starts.push({ folder, x });
    for (const item of list) {
      items.push({ ...item, x: x + item.width / 2, group });
      x += item.width + gap;
    }
  });
  return { items, groups: starts, right: x - (items.length ? gap : 0) };
}
