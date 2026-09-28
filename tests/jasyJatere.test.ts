import { describe, expect, it } from 'vitest';
import { BossBrain } from '../src/entities/bosses/BossBrain';
import { lethalClamp, panFor, Reveal, StaffRace } from '../src/entities/bosses/jasyLogic';
import { SwarmMotor } from '../src/entities/enemies/SwarmMotor';
import { getBossDef } from '../src/data/bosses';

describe('Jasy Jatere: golpe final y carrera por el bastón', () => {
  it('el golpe que lo dejaría en 0 lo deja en 1 y suelta el bastón', () => {
    expect(lethalClamp(5, 1)).toEqual({ applied: 1, race: false });
    expect(lethalClamp(1, 1)).toEqual({ applied: 0, race: true });
    // El tajo cargado (3) con 3 de vida también: queda en 1.
    expect(lethalClamp(3, 3)).toEqual({ applied: 2, race: true });
  });

  it('9 golpes en 3 fases de 3; el noveno empieza la carrera', () => {
    const brain = new BossBrain(getBossDef('jasy_jatere'));
    expect(brain.maxHp).toBe(9);
    const phases: number[] = [];
    let race = false;
    for (let i = 0; i < 9 && !race; i++) {
      const r = lethalClamp(brain.hp, 1);
      brain.damage(r.applied);
      race = r.race;
      phases.push(brain.phase);
    }
    expect(phases).toEqual([0, 0, 1, 1, 1, 2, 2, 2, 2]);
    expect(race).toBe(true);
    expect(brain.hp).toBe(1);
    expect(brain.state).not.toBe('defeated');
  });

  it('si Kerana toca el bastón primero, gana', () => {
    const race = new StaffRace();
    race.start(3000);
    expect(race.step(1000, false)).toBe(null);
    expect(race.progress(3000)).toBeCloseTo(1 / 3);
    expect(race.step(16, true)).toBe('kerana');
    expect(race.active).toBe(false);
  });

  it('si pasan 3 s, Jasy Jatere lo recupera', () => {
    const race = new StaffRace();
    race.start(3000);
    expect(race.step(2999, false)).toBe(null);
    expect(race.step(1, false)).toBe('jasy');
    expect(race.active).toBe(false);
    expect(race.step(16, true)).toBe(null);
  });

  it('cada golpe lo deja visible 2 s', () => {
    const r = new Reveal();
    r.show(2000);
    r.step(1999);
    expect(r.visible).toBe(true);
    r.step(1);
    expect(r.visible).toBe(false);
  });

  it('el silbido se panea según dónde está en la pantalla', () => {
    expect(panFor(100, 100, 160)).toBe(0);
    expect(panFor(-100, 100, 160)).toBe(-1);
    expect(panFor(180, 100, 160)).toBeCloseTo(0.5);
  });
});

describe('SwarmMotor (abejas)', () => {
  const cfg = { detectRadius: 80, chaseMs: 2000, disperseMs: 500, cooldownMs: 1000 };

  it('panal → persigue → se dispersa → espera → vuelve a estar lista', () => {
    const m = new SwarmMotor(cfg);
    expect(m.step(16, 200)).toBe('idle');
    expect(m.step(16, 60)).toBe('chase');
    expect(m.harmful).toBe(true);
    m.step(2000, 10);
    expect(m.state).toBe('disperse');
    expect(m.harmful).toBe(false);
    m.step(500, 10);
    expect(m.state).toBe('cooldown');
    m.step(1000, 10);
    expect(m.state).toBe('idle');
  });

  it('el enjambre del jefe persigue enseguida y desaparece al dispersarse', () => {
    const m = new SwarmMotor(cfg, true);
    expect(m.state).toBe('chase');
    m.step(2000, 500);
    m.step(500, 500);
    expect(m.state).toBe('gone');
  });
});
