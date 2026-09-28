import { describe, expect, it } from 'vitest';
import { GAMEPLAY } from '../src/config/gameplay';
import { getBossDef } from '../src/data/bosses';
import { getEnemyDef } from '../src/data/enemies';
import { BossBrain } from '../src/entities/bosses/BossBrain';
import { chargeTarget, cubsForPhase, nearestIndex, onRefuge, type ChargeResult, type Refuge } from '../src/entities/bosses/aoAoLogic';

describe('Ao Ao (GDD §6.6)', () => {
  it('15 golpes en 3 fases de 5', () => {
    const brain = new BossBrain(getBossDef('ao_ao'));
    expect(brain.maxHp).toBe(15);
    brain.start();
    brain.damage(5);
    expect(brain.phase).toBe(1);
    expect(brain.phaseDef.attacks.map((a) => a.id)).toEqual(expect.arrayContaining(['claw', 'howl']));
    brain.damage(5);
    expect(brain.phase).toBe(2);
    expect(brain.phaseDef.attacks.map((a) => a.id)).toContain('double_charge');
  });

  it('la embestida se detiene contra la primera roca en el camino (aturdido) o en el borde', () => {
    const out: ChargeResult = { x: 0, hitRock: false };
    const rocks = [200, 460];
    // Desde 300 hacia la derecha: choca con la roca de 460 (medio ancho 16 + medio cuerpo 22).
    expect(chargeTarget(300, 1, rocks, 16, 22, 40, 600, out)).toEqual({ x: 422, hitRock: true });
    // Desde 300 hacia la izquierda: choca con la de 200.
    expect(chargeTarget(300, -1, rocks, 16, 22, 40, 600, out)).toEqual({ x: 238, hitRock: true });
    // Pasada la última roca, llega al borde sin chocar: no hay ventana.
    expect(chargeTarget(500, 1, rocks, 16, 22, 40, 600, out)).toEqual({ x: 600, hitRock: false });
  });

  it('las crías llegan de a 2 en la fase 2 y de a 3 en la furia', () => {
    expect(cubsForPhase(0, GAMEPLAY.aoAo.cubsPerHowl)).toBe(0);
    expect(cubsForPhase(1, GAMEPLAY.aoAo.cubsPerHowl)).toBe(2);
    expect(cubsForPhase(2, GAMEPLAY.aoAo.cubsPerHowl)).toBe(3);
  });

  it('da vueltas al pie del pindó más cercano a Kerana', () => {
    expect(nearestIndex(60, [56, 584])).toBe(0);
    expect(nearestIndex(500, [56, 584])).toBe(1);
  });

  it('taitetu es Charger y la cría es Jumper (GDD §5.3)', () => {
    expect(getEnemyDef('taitetu').archetype).toBe('charger');
    expect(getEnemyDef('ao_ao_cria').archetype).toBe('jumper');
    expect(getEnemyDef('vaca_embrujada').archetype).toBe('charger');
    expect(getEnemyDef('vaca_embrujada').purifiesInto).toBe('vaca');
  });
});

describe('Refugio en el pindó', () => {
  const tol = GAMEPLAY.pindo.feetTolerancePx;
  const crowns: Refuge[] = [{ left: 32, right: 80, top: 208 }];

  it('parada en la copa está a salvo', () => {
    expect(onRefuge(56, 208, true, crowns, tol)).toBe(true);
    expect(onRefuge(33, 209, true, crowns, tol)).toBe(true);
  });

  it('saltando, al pie del pindó o fuera de la copa, no', () => {
    expect(onRefuge(56, 208, false, crowns, tol)).toBe(false);
    expect(onRefuge(56, 256, true, crowns, tol)).toBe(false);
    expect(onRefuge(100, 208, true, crowns, tol)).toBe(false);
    expect(onRefuge(56, 208, true, [], tol)).toBe(false);
  });
});
