import { describe, expect, it } from 'vitest';
import { GAMEPLAY } from '../src/config/gameplay';
import { getBossDef } from '../src/data/bosses';
import { getEnemyDef } from '../src/data/enemies';
import { chainStepAt, chargeDir, farthestIndex, howlBlacksOut } from '../src/entities/bosses/luisonLogic';
import { ambientTarget, inAnyArea, isLit, lerpColor, takesDamage, type LightSource } from '../src/systems/lightLogic';

describe('Luz y vulnerabilidad (GDD §4.8, §5.3)', () => {
  const halo: LightSource = { x: 0, y: 0, radius: 72, on: true };
  const lantern: LightSource = { x: 300, y: 0, radius: 88, on: false };

  it('iluminado dentro del halo de Kerana, a oscuras fuera', () => {
    expect(isLit(50, 30, [halo])).toBe(true);
    expect(isLit(100, 0, [halo])).toBe(false);
  });

  it('un farol apagado no alumbra; encendido, sí', () => {
    expect(isLit(320, 0, [halo, lantern])).toBe(false);
    lantern.on = true;
    expect(isLit(320, 0, [halo, lantern])).toBe(true);
    lantern.on = false;
  });

  it('el póra solo recibe daño iluminado; los demás enemigos, siempre', () => {
    expect(getEnemyDef('pora').needsLight).toBe(true);
    expect(takesDamage(true, false)).toBe(false);
    expect(takesDamage(true, true)).toBe(true);
    expect(takesDamage(false, false)).toBe(true);
    expect(getEnemyDef('jagua_hu').needsLight).toBeFalsy();
    expect(getEnemyDef('jagua_hu').glowEyes).toBe(true);
  });

  it('zonas oscuras y ambiente: velas > apagón o zona oscura > noche', () => {
    const colors = { night: 1, dark: 2, candles: 3 };
    const zones = [{ x: 100, y: 0, width: 50, height: 50 }];
    expect(inAnyArea(120, 10, zones)).toBe(true);
    expect(inAnyArea(90, 10, zones)).toBe(false);
    expect(ambientTarget(false, false, false, colors)).toBe(1);
    expect(ambientTarget(true, false, false, colors)).toBe(2);
    expect(ambientTarget(false, true, false, colors)).toBe(2);
    expect(ambientTarget(true, true, true, colors)).toBe(3);
  });

  it('mezcla colores del ambiente', () => {
    expect(lerpColor(0x000000, 0xffffff, 0)).toBe(0x000000);
    expect(lerpColor(0x000000, 0xffffff, 1)).toBe(0xffffff);
    expect(lerpColor(0x000000, 0x0000ff, 0.5)).toBe(0x000080);
    expect(lerpColor(0x102030, 0x405060, 2)).toBe(0x405060);
  });
});

describe('Luisón (GDD §6.7)', () => {
  it('18 golpes en 3 fases de 6', () => {
    const def = getBossDef('luison');
    expect(def.hp).toBe(18);
    expect(def.phases).toHaveLength(3);
    expect(def.phases.map((p) => Math.round(p.untilHpRatio * def.hp))).toEqual([12, 6, 0]);
  });

  it('avisos y ventanas del GDD', () => {
    const [p1, p2, p3] = getBossDef('luison').phases;
    const howl = p1.attacks.find((a) => a.id === 'howl')!;
    expect(howl.telegraphMs).toBe(1000);
    expect(howl.recoverMs).toBe(1500);
    expect(p1.attacks.find((a) => a.id === 'clods')!.telegraphMs).toBe(600);
    const charge = p2.attacks.find((a) => a.id === 'charge')!;
    expect(charge.telegraphMs).toBe(1000);
    expect(charge.recoverMs).toBe(1200);
    for (const a of p3.attacks) {
      expect(a.telegraphMs).toBe(600);
      expect(a.recoverMs).toBe(1000);
    }
  });

  it('tira los terrones desde el techo más lejano a Kerana', () => {
    expect(farthestIndex(10, [0, 100])).toBe(1);
    expect(farthestIndex(90, [0, 100])).toBe(0);
  });

  it('la cadena de la fase 3 es embestida, terrones y póra', () => {
    expect(chainStepAt(0, 2400)).toBe('charge');
    expect(chainStepAt(900, 2400)).toBe('clods');
    expect(chainStepAt(1700, 2400)).toBe('pora');
    expect(chainStepAt(5000, 2400)).toBe('pora');
  });

  it('el aullido apaga las luces desde la luna llena; embiste hacia Kerana', () => {
    expect(howlBlacksOut(0)).toBe(false);
    expect(howlBlacksOut(1)).toBe(true);
    expect(chargeDir(100, 40)).toBe(-1);
    expect(chargeDir(100, 140)).toBe(1);
  });

  it('los lugares de la arena caben en ella (40 tiles)', () => {
    const c = GAMEPLAY.luison;
    expect(c.floorTiles[0]).toBeLessThan(c.tombTile);
    expect(c.tombTile).toBeLessThan(c.floorTiles[1]);
    expect(c.roofTiles[1]).toBeLessThan(40);
  });
});
