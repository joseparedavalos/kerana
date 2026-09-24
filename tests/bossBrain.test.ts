import { describe, expect, it } from 'vitest';
import { BOSSES, TEJU_JAGUA_HEADS, TEJU_JAGUA_HITS_PER_HEAD, type AttackDef, type BossDef } from '../src/data/bosses';
import { BossBrain, phaseIndexFor, pickWeighted } from '../src/entities/bosses/BossBrain';

const TEJU = BOSSES.teju_jagua as BossDef;

/** Generador determinista: devuelve los valores dados en ciclo. */
function seq(...values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length];
}

describe('BossBrain: umbrales de fase', () => {
  it('Teju Jagua tiene 14 de vida (7 cabezas × 2 golpes)', () => {
    expect(TEJU.hp).toBe(TEJU_JAGUA_HEADS * TEJU_JAGUA_HITS_PER_HEAD);
    expect(TEJU.hp).toBe(14);
  });

  it('fase 1 hasta dormir 3 cabezas, fase 2 hasta dormir 6, fase 3 con la última', () => {
    const hpAfterHeads = (asleep: number) => TEJU.hp - asleep * TEJU_JAGUA_HITS_PER_HEAD;
    expect(phaseIndexFor(hpAfterHeads(0), TEJU.hp, TEJU.phases)).toBe(0);
    expect(phaseIndexFor(hpAfterHeads(2), TEJU.hp, TEJU.phases)).toBe(0);
    expect(phaseIndexFor(hpAfterHeads(3), TEJU.hp, TEJU.phases)).toBe(1);
    expect(phaseIndexFor(hpAfterHeads(5), TEJU.hp, TEJU.phases)).toBe(1);
    expect(phaseIndexFor(hpAfterHeads(6), TEJU.hp, TEJU.phases)).toBe(2);
    expect(phaseIndexFor(1, TEJU.hp, TEJU.phases)).toBe(2);
  });

  it('damage avisa el cambio de fase y la derrota', () => {
    const brain = new BossBrain(TEJU, { rng: seq(0) });
    brain.start();
    expect(brain.damage(4)).toEqual({ phaseChanged: false, defeated: false });
    expect(brain.damage(2)).toEqual({ phaseChanged: true, defeated: false });
    expect(brain.phase).toBe(1);
    expect(brain.damage(6)).toEqual({ phaseChanged: true, defeated: false });
    expect(brain.phase).toBe(2);
    expect(brain.damage(5)).toEqual({ phaseChanged: false, defeated: true });
    expect(brain.state).toBe('defeated');
    expect(brain.hp).toBe(0);
  });

  it('reset vuelve a la vida completa y a la fase 1', () => {
    const brain = new BossBrain(TEJU);
    brain.start();
    brain.damage(10);
    brain.reset();
    expect(brain.hp).toBe(TEJU.hp);
    expect(brain.phase).toBe(0);
    expect(brain.state).toBe('waiting');
  });
});

describe('BossBrain: selección de ataques', () => {
  const attacks: AttackDef[] = [
    { id: 'a', weight: 3, telegraphMs: 100, activeMs: 100, recoverMs: 100 },
    { id: 'b', weight: 1, telegraphMs: 100, activeMs: 100, recoverMs: 100 },
  ];

  it('respeta los pesos', () => {
    expect(pickWeighted(attacks, () => 0).id).toBe('a');
    expect(pickWeighted(attacks, () => 0.74).id).toBe('a');
    expect(pickWeighted(attacks, () => 0.76).id).toBe('b');
    expect(pickWeighted(attacks, () => 0.9999).id).toBe('b');
  });

  it('con muchas tiradas, la proporción se acerca a los pesos', () => {
    let a = 0;
    const n = 4000;
    for (let i = 0; i < n; i++) if (pickWeighted(attacks, () => (i + 0.5) / n).id === 'a') a++;
    expect(a / n).toBeCloseTo(0.75, 2);
  });

  it('no repite el mismo ataque si hay alternativa', () => {
    expect(pickWeighted(attacks, () => 0, 'a').id).toBe('b');
    const single = [attacks[0]];
    expect(pickWeighted(single, () => 0, 'a').id).toBe('a');
  });

  it('solo elige ataques de la fase actual', () => {
    const brain = new BossBrain(TEJU, { rng: Math.random });
    brain.start();
    brain.damage(12); // fase 3: mordida y fuego
    for (let i = 0; i < 40; i++) {
      brain.interrupt();
      const t = brain.step(10_000);
      expect(t?.state).toBe('telegraph');
      expect(['bite', 'fire']).toContain(t?.attack?.id);
    }
  });
});

describe('BossBrain: ciclo aviso → activo → recuperación', () => {
  it('recorre los estados con los tiempos del ataque y solo es vulnerable en la ventana', () => {
    const brain = new BossBrain(TEJU, { rng: seq(0) });
    brain.start();
    expect(brain.state).toBe('idle');
    const idleMs = TEJU.phases[0].idleMs;
    expect(brain.step(idleMs - 1)).toBeNull();
    const t1 = brain.step(1);
    expect(t1?.state).toBe('telegraph');
    const attack = t1!.attack!;
    expect(attack.id).toBe('bite');
    expect(brain.vulnerable).toBe(false);
    expect(brain.step(attack.telegraphMs)?.state).toBe('active');
    expect(brain.vulnerable).toBe(false);
    expect(brain.step(attack.activeMs)?.state).toBe('recover');
    expect(brain.vulnerable).toBe(true);
    expect(brain.step(attack.recoverMs)?.state).toBe('idle');
    expect(brain.vulnerable).toBe(false);
  });

  it('el coletazo no abre ventana (hay que saltarlo)', () => {
    const brain = new BossBrain(TEJU, { rng: seq(0.99) });
    brain.start();
    const t = brain.step(10_000);
    expect(t?.attack?.id).toBe('tail');
    brain.step(10_000);
    brain.step(10_000);
    expect(brain.state).toBe('recover');
    expect(brain.vulnerable).toBe(false);
  });

  it('el modo asistido alarga los avisos', () => {
    const brain = new BossBrain(TEJU, { rng: seq(0), telegraphScale: 1.3 });
    brain.start();
    const t = brain.step(10_000);
    expect(brain.msLeft).toBeCloseTo(t!.attack!.telegraphMs * 1.3);
  });

  it('todos los ataques tienen aviso de al menos 0,5 s (se pueden evitar)', () => {
    for (const def of Object.values(BOSSES)) {
      for (const phase of def!.phases) for (const a of phase.attacks) expect(a.telegraphMs).toBeGreaterThanOrEqual(500);
    }
  });
});
