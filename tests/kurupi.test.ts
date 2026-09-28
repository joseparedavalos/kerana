import { describe, expect, it } from 'vitest';
import { getBossDef } from '../src/data/bosses';
import { BossBrain } from '../src/entities/bosses/BossBrain';
import { callPlan, pickRealSlot, runDirection, runTargetX, toeSide, type CallPlan } from '../src/entities/bosses/kurupiLogic';

describe('Kurupi (GDD §6.5)', () => {
  it('12 golpes en 3 fases de 4', () => {
    const brain = new BossBrain(getBossDef('kurupi'));
    expect(brain.maxHp).toBe(12);
    brain.start();
    brain.damage(4);
    expect(brain.phase).toBe(1);
    brain.damage(4);
    expect(brain.phase).toBe(2);
    expect(brain.phaseDef.attacks.map((a) => a.id)).toContain('decoy');
  });

  it('el llamado trae 2 kuati o 1 ka\'i', () => {
    const out: CallPlan = { kind: 'kuati', count: 0 };
    expect(callPlan(0.1, 0.35, 2, out)).toEqual({ kind: 'kai', count: 1 });
    expect(callPlan(0.9, 0.35, 2, out)).toEqual({ kind: 'kuati', count: 2 });
  });

  it('con los pies al revés corre hacia donde no mira y las huellas apuntan al revés de la carrera', () => {
    expect(runDirection(1, true)).toBe(-1);
    expect(runDirection(-1, true)).toBe(1);
    expect(runDirection(1, false)).toBe(1);
    // Mira a la derecha y corre a la izquierda: los dedos de la huella apuntan a la derecha (hacia donde mira).
    const dir = runDirection(1, true);
    expect(toeSide(dir, true)).toBe(1);
    expect(toeSide(dir, false)).toBe(-1);
  });

  it('la carrera no sale de la arena', () => {
    expect(runTargetX(100, 1, 150, 40, 600)).toBe(250);
    expect(runTargetX(100, -1, 150, 40, 600)).toBe(40);
    expect(runTargetX(500, 1, Infinity, 40, 600)).toBe(600);
  });

  it('el verdadero puede estar en cualquiera de los tres lugares', () => {
    expect([0, 0.34, 0.67, 0.999].map((r) => pickRealSlot(r, 3))).toEqual([0, 1, 2, 2]);
  });
});
