import Phaser from 'phaser';
import { getEnemyDef } from '../../data/enemies';
import { Charger } from './Charger';
import type { EnemyBase } from './EnemyBase';
import { Flyer } from './Flyer';
import { Walker } from './Walker';

export function createEnemy(scene: Phaser.Scene, kind: string, x: number, y: number, facing: 1 | -1): EnemyBase {
  const def = getEnemyDef(kind);
  switch (def.archetype) {
    case 'charger':
      return new Charger(scene, x, y, def, facing);
    case 'flyer':
      return new Flyer(scene, x, y, def, facing);
    default:
      return new Walker(scene, x, y, def, facing);
  }
}

export { EnemyBase } from './EnemyBase';
