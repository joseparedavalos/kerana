import { describe, expect, it } from 'vitest';
import { parseAscii } from '../tools/lib/ascii-map.mjs';
import { GAMEPLAY } from '../src/config/gameplay';
import { ENEMIES } from '../src/data/enemies';
import { guardFrame, GuardMotor, guardTurns, strikeZone } from '../src/entities/enemies/GuardMotor';
import l4Text from '../tools/levels/l4.txt?raw';
import sheet from '../raw/karai_vosa/sprite.json';

// Karaí Vosá (S70; guardián fijo desde S71): quieto y a la vista, avisa, pega un cucharazo y se recupera.
const K = GAMEPLAY.karaiVosa;
const TILE = 16;
const motor = () => new GuardMotor({ detectRadius: K.detectRadius, detectHeight: K.detectHeight, telegraphMs: K.telegraphMs, activeMs: K.activeMs, recoverMs: K.recoverMs });

describe('Karaí Vosá: los tres tiempos del cucharazo', () => {
  it('es un guardián humano que no camina', () => {
    const def = ENEMIES.karai_vosa;
    expect(def.archetype).toBe('guard');
    expect(def.human).toBe(true);
    expect(def.speed).toBeUndefined();
    expect(def.patrolDistance).toBeUndefined();
  });

  it('quieto hasta que Kerana entra en el radio; aviso → golpe → recuperación → quieto', () => {
    const m = motor();
    expect(m.step(16, false)).toBe('idle');
    expect(m.step(1000, false)).toBe('idle');
    expect(m.step(16, true)).toBe('telegraph');
    expect(m.step(K.telegraphMs - 1, false)).toBe('telegraph');
    // Una vez que avisa, golpea aunque ella se vaya: el aviso no engaña.
    expect(m.step(1, false)).toBe('active');
    expect(m.step(K.activeMs, false)).toBe('recover');
    expect(m.step(K.recoverMs, false)).toBe('idle');
    // Sigue cerca: vuelve a avisar, pero recién después de recuperarse.
    expect(m.step(16, true)).toBe('telegraph');
  });

  it('el tiempo que sobra de un paso pasa al estado siguiente (el golpe dura lo mismo con cualquier fps)', () => {
    const m = motor();
    m.step(16, true);
    m.step(K.telegraphMs + 50, true);
    expect(m.state).toBe('active');
    expect(m.elapsedMs).toBe(50);
  });

  it('el radio es horizontal y con tope de altura: no la ve en el techo de arriba', () => {
    const m = motor();
    expect(m.inRange(K.detectRadius, 0)).toBe(true);
    expect(m.inRange(-K.detectRadius - 1, 0)).toBe(false);
    expect(m.inRange(0, -K.detectHeight - 1)).toBe(false);
    expect(m.inRange(0, K.detectHeight)).toBe(true);
  });

  it('la hoja de ataque se usa entera: aviso 0-4, golpe 5-7, recuperación 8-9, y en reposo la hoja idle', () => {
    expect(guardFrame('idle', 0, K.frames)).toBeNull();
    expect(guardFrame('telegraph', 0, K.frames)).toBe(0);
    expect(guardFrame('telegraph', 0.99, K.frames)).toBe(4);
    expect(guardFrame('telegraph', 1, K.frames)).toBe(4);
    expect(guardFrame('active', 0, K.frames)).toBe(5);
    expect(guardFrame('active', 0.5, K.frames)).toBe(6);
    expect(guardFrame('active', 1, K.frames)).toBe(7);
    expect(guardFrame('recover', 0, K.frames)).toBe(8);
    expect(guardFrame('recover', 1, K.frames)).toBe(9);
    // Los tres tramos cubren los diez cuadros de raw/karai_vosa (5 × 2), sin huecos ni repetidos.
    const used = (['telegraph', 'active', 'recover'] as const).flatMap((s) => {
      const [a, b] = K.frames[s];
      return Array.from({ length: b - a + 1 }, (_, i) => a + i);
    });
    expect(used).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(Object.keys(sheet.sheets)).toContain('attack');
  });

  it('mira hacia Kerana quieto y avisando; golpeando y recuperándose, no gira', () => {
    expect(guardTurns('idle')).toBe(true);
    expect(guardTurns('telegraph')).toBe(true);
    expect(guardTurns('active')).toBe(false);
    expect(guardTurns('recover')).toBe(false);
  });

  it('el cucharazo va delante del cuerpo, hacia donde mira, y es corto', () => {
    const left = strikeZone(100, 200, -1, 7, K.strike);
    expect(left.x + left.width).toBe(93);
    expect(left.y).toBe(200 - K.strike.height);
    const right = strikeZone(100, 200, 1, 7, K.strike);
    expect(right.x).toBe(107);
    expect(right.width).toBe(K.strike.reach);
    // Corto: el tajo de Kerana llega más lejos, así que se lo puede enfrentar.
    expect(K.strike.reach).toBeLessThan(GAMEPLAY.attack.hitboxWidth);
    // El radio deja ver el aviso antes de quedar al alcance de la cuchara.
    expect(K.detectRadius).toBeGreaterThan(ENEMIES.karai_vosa.width / 2 + K.strike.reach + TILE);
  });
});

describe('Karaí Vosá en l4: guardianes de un lugar', () => {
  const map = parseAscii(l4Text);
  const g: string[] = map.grid;
  const at = (x: number, y: number) => g[y]?.[x] ?? '#';
  const legend = map.enemies as Record<string, string>;
  const chars = Object.entries(legend).filter(([, kind]) => kind === 'karai_vosa').map(([c]) => c);
  const spots: [number, number][] = [];
  g.forEach((row, y) => [...row].forEach((c, x) => chars.includes(c) && spots.push([x, y])));
  const radiusTiles = Math.ceil(K.detectRadius / TILE);

  it('hay cuatro: el del zaguán y tres más', () => {
    expect(spots).toHaveLength(4);
  });

  it('cada uno de pie sobre piso parejo, con lugar para su alto, y nunca en medio de un salto', () => {
    const rows = Math.ceil(ENEMIES.karai_vosa.height / TILE);
    for (const [x, y] of spots) {
      // Piso firme debajo de él y a los costados hasta el alcance del cucharazo (no hay hueco que saltar ahí).
      for (let dx = -2; dx <= 2; dx++) expect(at(x + dx, y + 1), `piso en (${x + dx}, ${y + 1})`).toBe('#');
      for (let r = 0; r < rows; r++) expect(at(x, y - r)).not.toBe('#');
    }
  });

  it('lejos de los fuegos, de las espinas y de los otros enemigos: no se reaparece a su alcance ni se suman', () => {
    const others = new Set(Object.keys(legend).filter((c) => !chars.includes(c)));
    for (const [x, y] of spots) {
      for (let yy = y - 4; yy <= y + 4; yy++) {
        for (let xx = x - radiusTiles - 2; xx <= x + radiusTiles + 2; xx++) {
          const c = at(xx, yy);
          expect(c, `"${c}" en (${xx}, ${yy}) junto al de (${x}, ${y})`).not.toBe('C');
          expect(c, `espina en (${xx}, ${yy})`).not.toBe('^');
          expect(others.has(c), `enemigo "${c}" en (${xx}, ${yy}) junto al de (${x}, ${y})`).toBe(false);
        }
      }
    }
  });

  it('están separados: cada uno cuida su lugar', () => {
    const xs = spots.map(([x]) => x).sort((a, b) => a - b);
    for (let i = 1; i < xs.length; i++) expect(xs[i] - xs[i - 1]).toBeGreaterThan(20);
  });

  it('el del zaguán está junto a la carreta, sin `front`: siempre a la vista', () => {
    const zaguan = spots.find(([x]) => x < 60)!;
    const cart = (map.props as any[]).find((p) => p.art === 'l4_calle/wooden_cart');
    expect(cart).toBeDefined();
    expect(Math.abs(cart.x - zaguan[0])).toBeLessThanOrEqual(3);
    expect(cart.front).toBeFalsy();
  });

  it('el fardo que Kerana rompe al lado de uno queda entre los dos: no lo golpea a través de él', () => {
    for (const [x, y] of spots) {
      for (let fx = x - radiusTiles; fx <= x + radiusTiles; fx++) {
        if (at(fx, y) !== '%') continue;
        // Kerana lo rompe pegada del otro lado; la línea a la altura del pecho cruza el fardo (eyeHeight < 4 tiles).
        const eyeRow = y - Math.floor(K.eyeHeight / TILE);
        expect(at(fx, eyeRow)).toBe('%');
      }
    }
  });
});
