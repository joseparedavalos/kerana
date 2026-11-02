import { describe, expect, it } from 'vitest';
import { parseAscii } from '../tools/lib/ascii-map.mjs';
import { GAMEPLAY } from '../src/config/gameplay';
import { ENEMIES } from '../src/data/enemies';
import { hideCrouch, LurkerMotor, strikeActive, strikeZone } from '../src/entities/enemies/LurkerMotor';
import l4Text from '../tools/levels/l4.txt?raw';

// Karaí Vosá (S70): lurker escondido detrás de algo.
const K = GAMEPLAY.karaiVosa;
const TILE = 16;

describe('Karaí Vosá: agacharse, asomar y salir', () => {
  it('escondido, todo el dibujo queda bajo el borde de lo que lo tapa; en el aviso asoma solo el sombrero', () => {
    const hidden = hideCrouch('hidden', K);
    expect(K.artHeight - hidden).toBeLessThan(K.coverHeight);
    expect(hideCrouch('cooldown', K)).toBe(hidden);
    const peeking = K.artHeight - hideCrouch('warn', K);
    expect(peeking).toBeGreaterThan(K.coverHeight);
    expect(peeking - K.coverHeight).toBeLessThanOrEqual(K.peek);
    expect(hideCrouch('exposed', K)).toBe(0);
  });

  it('es un lurker humano que no camina, con el ciclo del motor de siempre', () => {
    const def = ENEMIES.karai_vosa;
    expect(def.archetype).toBe('lurker');
    expect(def.hides && def.human).toBe(true);
    expect(def.speed).toBeUndefined();
    const m = new LurkerMotor({ detectRadius: def.detectRadius!, warnMs: def.warnMs!, exposedMs: def.exposedMs!, cooldownMs: def.cooldownMs! });
    expect(m.step(16, def.detectRadius! + 1)).toBe('hidden');
    expect(m.step(16, def.detectRadius!)).toBe('warn');
    expect(m.step(def.warnMs!, Infinity)).toBe('exposed');
    expect(m.step(def.exposedMs!, Infinity)).toBe('cooldown');
    expect(m.step(def.cooldownMs!, Infinity)).toBe('hidden');
  });

  it('el cucharón lastima solo en su ventana, que cabe entera mientras está afuera', () => {
    expect(strikeActive(K.strike.fromMs - 1, K.strike)).toBe(false);
    expect(strikeActive(K.strike.fromMs, K.strike)).toBe(true);
    expect(strikeActive(K.strike.toMs, K.strike)).toBe(false);
    expect(K.strike.toMs).toBeLessThan(K.exposedMs);
    // Sale antes de golpear: el paso al costado termina antes de la ventana.
    expect(K.stepMs).toBeLessThan(K.strike.fromMs);
  });

  it('la zona del cucharón va delante del cuerpo, hacia donde mira', () => {
    const left = strikeZone(100, 200, -1, 7, K.strike);
    expect(left.x + left.width).toBe(93);
    expect(left.y).toBe(200 - K.strike.height);
    const right = strikeZone(100, 200, 1, 7, K.strike);
    expect(right.x).toBe(107);
    expect(right.width).toBe(K.strike.reach);
  });
});

describe('Karaí Vosá en l4 (prototipo)', () => {
  const map = parseAscii(l4Text);
  const g: string[] = map.grid;
  const at = (x: number, y: number) => g[y]?.[x] ?? '#';
  const chars = Object.entries(map.enemies as Record<string, string>).filter(([, kind]) => kind === 'karai_vosa').map(([c]) => c);
  const spots: [number, number][] = [];
  g.forEach((row, y) => [...row].forEach((c, x) => chars.includes(c) && spots.push([x, y])));

  it('hay uno solo, de pie sobre el suelo y detrás de un prop con `front` que lo tapa entero', () => {
    expect(spots).toHaveLength(1);
    const [x, y] = spots[0];
    expect(at(x, y + 1)).toBe('#');
    const cover = (map.props as any[]).find((p) => p.front && p.y === y && Math.abs(p.x - x) <= 1);
    expect(cover?.art).toBe('l4_calle/wooden_cart');
  });

  it('al salir hacia cualquier lado queda sobre piso libre, sin pared ni hueco', () => {
    const [x, y] = spots[0];
    const cx = x * TILE + TILE / 2;
    const half = ENEMIES.karai_vosa.width / 2;
    const rows = Math.ceil(ENEMIES.karai_vosa.height / TILE);
    for (const dir of [-1, 1]) {
      const out = cx + dir * K.stepOut;
      for (let tx = Math.floor((out - half) / TILE); tx <= Math.floor((out + half - 1) / TILE); tx++) {
        expect(at(tx, y + 1)).toBe('#');
        for (let r = 0; r < rows; r++) expect(at(tx, y - r)).not.toBe('#');
      }
    }
  });

  it('no despierta mientras Kerana rompe el fardo de al lado: el radio no llega al otro lado del fardo', () => {
    const [x, y] = spots[0];
    // El fardo más cercano a su izquierda; Kerana lo rompe parada pegada a él.
    let fx = x - 1;
    while (fx > 0 && at(fx, y) !== '%') fx--;
    expect(at(fx, y)).toBe('%');
    const keranaHalf = GAMEPLAY.player.bodyWidth / 2;
    const keranaX = fx * TILE - keranaHalf;
    expect(x * TILE + TILE / 2 - keranaX).toBeGreaterThan(K.detectRadius);
  });
});
