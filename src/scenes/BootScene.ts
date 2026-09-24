import Phaser from 'phaser';
import { DEBUG } from '../config/debug';

// Lee los parámetros de URL y pasa a la carga. (La partida guardada llega en S4.)
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    this.registry.set('debug', DEBUG);
    this.scene.start('Preload');
  }
}
