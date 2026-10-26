import { describe, expect, it } from 'vitest';
import { platformPieces } from '../src/entities/moverLook';

// S57: la plataforma móvil se dibuja con las casillas 16 a 18 del tileset.
describe('platformPieces', () => {
  it('izquierda, medio repetido y derecha para cualquier ancho', () => {
    expect(platformPieces(32, 16)).toEqual([16, 18]);
    expect(platformPieces(48, 16)).toEqual([16, 17, 18]);
    expect(platformPieces(64, 16)).toEqual([16, 17, 17, 18]);
    expect(platformPieces(96, 16)).toEqual([16, 17, 17, 17, 17, 18]);
  });
  it('una de un solo tile usa la del medio', () => {
    expect(platformPieces(16, 16)).toEqual([17]);
    expect(platformPieces(4, 16)).toEqual([17]);
  });
});
