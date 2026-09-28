import Phaser from 'phaser';
import { getEnemyDef } from '../../data/enemies';
import { Charger } from './Charger';
import { Diver } from './Diver';
import type { EnemyBase } from './EnemyBase';
import { Flyer } from './Flyer';
import { Lurker } from './Lurker';
import { Swarm } from './Swarm';
import { Walker } from './Walker';

/** `oneShot`: enjambre llamado por un jefe (persigue enseguida y desaparece al dispersarse). */
export function createEnemy(scene: Phaser.Scene, kind: string, x: number, y: number, facing: 1 | -1, oneShot = false): EnemyBase {
  const def = getEnemyDef(kind);
  switch (def.archetype) {
    case 'swarm':
      return new Swarm(scene, x, y, def, facing, oneShot);
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
