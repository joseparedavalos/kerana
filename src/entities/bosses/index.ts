import Phaser from 'phaser';
import type { BossId } from '../../data/types';
import type { Boss, BossContext } from './Boss';
import { TejuJagua } from './TejuJagua';

/** Crea el jefe de la arena; los que todavía no existen devuelven null (el nivel sigue sin jefe). */
export function createBoss(scene: Phaser.Scene, id: BossId, ctx: BossContext): Boss | null {
  switch (id) {
    case 'teju_jagua':
      return new TejuJagua(scene, ctx);
    default:
      console.warn(`[JEFE] "${id}" todavía no está implementado.`);
      return null;
  }
}

export type { Boss, BossContext } from './Boss';
