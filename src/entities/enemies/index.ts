import Phaser from 'phaser';
import { getEnemyDef } from '../../data/enemies';
import { Charger } from './Charger';
import { Diver } from './Diver';
import type { EnemyBase } from './EnemyBase';
import { Flyer } from './Flyer';
import { Lurker } from './Lurker';
import { Walker } from './Walker';

export function createEnemy(scene: Phaser.Scene, kind: string, x: number, y: number, facing: 1 | -1): EnemyBase {
  const def = getEnemyDef(kind);
  switch (def.archetype) {
    case 'charger':
      return new Charger(scene, x, y, def, facing);
    case 'flyer':
      return new Flyer(scene, x, y, def, facing);
    case 'lurker':
      return new Lurker(scene, x, y, def, facing);
    case 'diver':
      return new Diver(scene, x, y, def, facing);
    default:
      return new Walker(scene, x, y, def, facing);
  }
}

export { EnemyBase } from './EnemyBase';
