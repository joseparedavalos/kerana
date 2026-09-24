import { describe, expect, it } from 'vitest';
import { parseDebugFlags, parseLevelParam } from '../src/config/debug';

describe('parámetros de depuración', () => {
  it('traduce el nivel', () => {
    expect(parseLevelParam('test')).toBe('test');
    expect(parseLevelParam('3')).toBe('l3');
    expect(parseLevelParam('9')).toBeNull();
    expect(parseLevelParam(null)).toBeNull();
  });

  it('solo se activan en desarrollo o con debug=1', () => {
    expect(parseDebugFlags('?level=2&god=1', false)).toMatchObject({ debug: false, level: null, god: false });
    expect(parseDebugFlags('?level=2&god=1', true)).toMatchObject({ level: 'l2', god: true });
    expect(parseDebugFlags('?debug=1&level=test&gifts=all&boss=1', false)).toEqual({
      debug: true, level: 'test', boss: true, giftsAll: true, god: false,
    });
  });
});
