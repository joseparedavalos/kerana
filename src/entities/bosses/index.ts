import Phaser from 'phaser';
import type { BossId } from '../../data/types';
import { AoAo } from './AoAo';
import type { Boss, BossContext } from './Boss';
import { JasyJatere } from './JasyJatere';
import { Kurupi } from './Kurupi';
import { MboiTui } from './MboiTui';
import { Monai } from './Monai';
import { TejuJagua } from './TejuJagua';

/** Crea el jefe de la arena; los que todavía no existen devuelven null (el nivel sigue sin jefe). */
export function createBoss(scene: Phaser.Scene, id: BossId, ctx: BossContext): Boss | null {
  switch (id) {
    case 'teju_jagua':
      return new TejuJagua(scene, ctx);
    case 'mboi_tui':
      return new MboiTui(scene, ctx);
    case 'monai':
      return new Monai(scene, ctx);
    case 'jasy_jatere':
      return new JasyJatere(scene, ctx);
    case 'kurupi':
      return new Kurupi(scene, ctx);
    case 'ao_ao':
      return new AoAo(scene, ctx);
    default:
      console.warn(`[JEFE] "${id}" todavía no está implementado.`);
      return null;
  }
}

export type { Boss, BossContext } from './Boss';
