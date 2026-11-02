import { describe, expect, it } from 'vitest';
import { groundHeadY, HeartThief, pulseBlocked, restingSegmentY, strikeTargets, strikeZone, type Trunk } from '../src/entities/bosses/monaiLogic';
import { BossBrain } from '../src/entities/bosses/BossBrain';
import { boxesOverlap, slashRect, type Box } from '../src/entities/slashRect';
import { Health } from '../src/systems/Health';
import { StatusEffects } from '../src/systems/StatusEffects';
import { GAMEPLAY } from '../src/config/gameplay';
import { getBossDef } from '../src/data/bosses';

describe('Hipnosis (StatusEffects)', () => {
  it('invierte izquierda y derecha mientras dura y después vuelve a la normalidad', () => {
    const s = new StatusEffects();
    expect(s.applyHypnosis(3000)).toBe(true);
    const input = { left: true, right: false };
    s.applyTo(input);
    expect(input).toEqual({ left: false, right: true });
    s.step(2999);
    expect(s.hypnotized).toBe(true);
    s.step(1);
    expect(s.hypnotized).toBe(false);
    const after = { left: true, right: false };
    s.applyTo(after);
    expect(after).toEqual({ left: true, right: false });
  });

  it('un segundo pulso renueva la duración sin acumularla', () => {
    const s = new StatusEffects();
    s.applyHypnosis(3000);
    s.step(2000);
    expect(s.applyHypnosis(3000)).toBe(false);
    s.step(2999);
    expect(s.hypnotized).toBe(true);
    s.step(1);
    expect(s.hypnotized).toBe(false);
  });

  it('clear la quita (al reaparecer)', () => {
    const s = new StatusEffects();
    s.applyHypnosis(3000);
    s.clear();
    expect(s.hypnotized).toBe(false);
  });
});

describe('Troncos que bloquean el pulso', () => {
  const trunks: Trunk[] = [{ x: 100, halfWidth: 6, topY: 200 }];

  it('bloquea si el tronco está entre Moñái y Kerana y ella está debajo de la copa', () => {
    expect(pulseBlocked(50, 150, 250, trunks)).toBe(true);
    expect(pulseBlocked(150, 50, 250, trunks)).toBe(true);
  });

  it('no bloquea si no hay tronco en medio o si Kerana está sobre la copa', () => {
    expect(pulseBlocked(120, 180, 250, trunks)).toBe(false);
    expect(pulseBlocked(50, 150, 200, trunks)).toBe(false);
  });
});

describe('Robo del corazón (HeartThief)', () => {
  it('la embestida se lleva un corazón y golpear la cola lo devuelve', () => {
    const h = new Health(4, 4);
    const thief = new HeartThief();
    expect(thief.steal(() => h.damage(1, 0) && !h.isDead)).toBe(true);
    expect(h.current).toBe(3);
    expect(thief.holding).toBe(true);
    expect(thief.recover((n) => h.heal(n))).toBe(true);
    expect(h.current).toBe(4);
    expect(thief.holding).toBe(false);
    expect(thief.recover((n) => h.heal(n))).toBe(false);
  });

  it('guarda uno a la vez: un segundo acierto es daño común', () => {
    const h = new Health(4, 4);
    const thief = new HeartThief();
    thief.steal(() => h.damage(1, 0));
    expect(thief.steal(() => h.damage(1, 0))).toBe(false);
    expect(h.current).toBe(2);
    thief.recover((n) => h.heal(n));
    expect(h.current).toBe(3);
  });

  it('no roba si el golpe no se aplicó (invulnerable) ni si Kerana cayó', () => {
    const h = new Health(1, 4);
    const thief = new HeartThief();
    expect(thief.steal(() => false)).toBe(false);
    expect(thief.steal(() => h.damage(1, 0) && !h.isDead)).toBe(false);
    expect(thief.holding).toBe(false);
  });

  it('reset pierde el corazón guardado', () => {
    const thief = new HeartThief();
    thief.steal(() => true);
    thief.reset();
    expect(thief.holding).toBe(false);
  });
});

describe('Confusión de Moñái (S44)', () => {
  const press = () => ({ left: false, right: true, attackPressed: true, attackHeld: true });

  it('invierte los controles y además no deja atacar mientras dura', () => {
    const s = new StatusEffects();
    expect(s.applyConfusion(4500, 0)).toBe(true);
    expect(s.confused).toBe(true);
    const input = press();
    s.applyTo(input);
    expect(input).toEqual({ left: true, right: false, attackPressed: false, attackHeld: false });
    s.step(4500);
    expect(s.confused).toBe(false);
    const after = press();
    s.applyTo(after);
    expect(after.attackPressed).toBe(true);
    expect(after.right).toBe(true);
  });

  it('cada intento de atacar la sacude y la acorta, hasta quitarla', () => {
    const s = new StatusEffects();
    s.applyConfusion(1000, 400);
    s.applyTo(press());
    s.applyTo(press());
    expect(s.confused).toBe(true);
    s.applyTo({ left: false, right: false });
    expect(s.confused).toBe(true);
    s.applyTo(press());
    expect(s.confused).toBe(false);
    expect(s.hypnotized).toBe(false);
  });

  it('la hipnosis de Tau sigue sin quitar el tajo', () => {
    const s = new StatusEffects();
    s.applyHypnosis(3000);
    expect(s.confused).toBe(false);
    const input = press();
    s.applyTo(input);
    expect(input.attackPressed).toBe(true);
  });

  it('las ventanas de Moñái salen de gameplay.ts y son más cortas que antes de S44', () => {
    const cfg = GAMEPLAY.monai;
    expect(cfg.dazeMs).toBeLessThan(1500);
    expect(cfg.afterPulseMs).toBeLessThan(1000);
    expect(cfg.tailMs).toBeLessThan(1200);
    const windows = getBossDef('monai').phases.flatMap((p) => p.attacks.map((a) => a.recoverMs));
    expect(new Set(windows)).toEqual(new Set([cfg.dazeMs, cfg.dazeFastMs, cfg.afterPulseMs, cfg.tailMs]));
    // La vida no cambia (S44).
    expect(getBossDef('monai').hp).toBe(12);
  });
});

describe('El último golpe a Moñái entra (S65)', () => {
  // Suelo de la arena de l3 (y del mundo); cualquier valor sirve: todo se mide desde él.
  const FLOOR = 528;
  const box = (): Box => ({ x: 0, y: 0, width: 0, height: 0 });

  /** Tajo de Kerana parada (o con los pies `lift` px sobre el suelo) a `dx` de la parte, mirándola. */
  function slashAt(partX: number, dx: number, lift = 0, charged = false): Box {
    const facing = dx > 0 ? -1 : 1;
    return slashRect(partX + dx, FLOOR - lift, facing, charged, box());
  }

  /** Lleva el cerebro de Moñái a 1 de vida y junta las ventanas que ofrece con esa vida. */
  function lastHpWindows(): { brain: BossBrain; windows: Set<string> } {
    let seed = 7;
    const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const brain = new BossBrain(getBossDef('monai'), { rng });
    brain.start();
    brain.damage(brain.maxHp - 1);
    const windows = new Set<string>();
    for (let t = 0; t < 120000 && windows.size < 3; t += 50) {
      brain.step(50);
      if (brain.vulnerable && brain.attack) windows.add(brain.attack.id);
    }
    return { brain, windows };
  }

  it('con 1 de vida sigue en la fase 3 y abre las tres ventanas (descenso, pulso y cola)', () => {
    const { brain, windows } = lastHpWindows();
    expect(brain.hp).toBe(1);
    expect(brain.phase).toBe(2);
    expect(windows).toEqual(new Set(['descent', 'pulse', 'steal']));
  });

  it('en cada ventana, el tajo de Kerana parada junto a la parte expuesta entra y la vence', () => {
    const { brain, windows } = lastHpWindows();
    const x = 300;
    for (const id of windows) {
      // Descenso y pulso: la cabeza apoyada en el suelo. Robo: la cola, tirada en el suelo.
      const zone = id === 'steal' ? strikeZone('tail', x, restingSegmentY(FLOOR), box()) : strikeZone('head', x, groundHeadY(FLOOR), box());
      for (const dx of [-22, 22]) expect(boxesOverlap(slashAt(x, dx), zone), `${id}, Kerana a ${dx} px`).toBe(true);
    }
    expect(brain.damage(1).defeated).toBe(true);
  });

  it('la cola se alcanza con el tajo normal, no solo con el cargado (hasta S64, nunca)', () => {
    const tail = strikeZone('tail', 300, restingSegmentY(FLOOR), box());
    expect(boxesOverlap(slashAt(300, 22), tail)).toBe(true);
    expect(boxesOverlap(slashAt(300, 22, 8), tail)).toBe(true);
  });

  it('la cabeza aturdida se alcanza también desde un saltito (al aterrizar de saltar la joroba)', () => {
    const head = strikeZone('head', 300, groundHeadY(FLOOR), box());
    for (const lift of [0, 8, 14]) expect(boxesOverlap(slashAt(300, 24, lift), head), `pies a ${lift} px`).toBe(true);
  });

  it('solo crece hacia arriba la zona que recibe el tajo: abajo y a los lados no cambia', () => {
    const cfg = GAMEPLAY.monai;
    const head = strikeZone('head', 300, groundHeadY(FLOOR), box());
    expect(cfg.strikeRise).toBeGreaterThan(0);
    expect(head.y + head.height).toBe(FLOOR);
    expect(head.width).toBe(cfg.headWidth);
    expect(head.height).toBe(cfg.headHeight + cfg.strikeRise);
  });
});

describe('La cabeza de Moñái es blanco en toda ventana (S66)', () => {
  it('en la ventana del robo, el tajo a la cabeza cuenta (hasta S65 solo valía la cola)', () => {
    expect(GAMEPLAY.monai.headInTailWindow).toBe(true);
    expect(strikeTargets('tail', true)).toEqual({ head: true, tail: true });
    // Con el valor viejo, la cabeza no era blanco: el fallo de S66.
    expect(strikeTargets('tail', true, false)).toEqual({ head: false, tail: true });
  });

  it('aturdida (descenso o pulso) solo la cabeza; fuera de la ventana, nada', () => {
    expect(strikeTargets('body', true)).toEqual({ head: true, tail: false });
    for (const exposed of ['none', 'body', 'tail'] as const) expect(strikeTargets(exposed, false)).toEqual({ head: false, tail: false });
    expect(strikeTargets('none', true)).toEqual({ head: false, tail: false });
  });

  it('con 4 de vida (fase 3) se vence solo con golpes a la cabeza, aunque toquen ventanas de robo', () => {
    let seed = 11;
    const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const brain = new BossBrain(getBossDef('monai'), { rng });
    brain.start();
    brain.damage(brain.maxHp - 4);
    expect(brain.phase).toBe(2);
    const hitIn = new Set<string>();
    let wasOpen = false;
    for (let t = 0; t < 600000 && brain.state !== 'defeated'; t += 50) {
      brain.step(50);
      // Un golpe a la cabeza por ventana, si la ventana la acepta.
      const open = brain.vulnerable;
      if (open && !wasOpen && brain.attack) {
        const exposed = brain.attack.id === 'steal' ? 'tail' : 'body';
        if (strikeTargets(exposed, true).head) {
          hitIn.add(brain.attack.id);
          brain.damage(1);
        }
      }
      wasOpen = open;
    }
    expect(brain.state).toBe('defeated');
    expect(hitIn.has('steal')).toBe(true);
  });
});
